/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, CheckSquare, Square, Loader2, Hammer, Zap, Plus} from 'lucide-react';

interface FinalizeReassembleModalProps {
  tool: Herramienta;
  onClose: () => void;
  onSuccess: () => void;
}

interface PartRow {
  codigo: string;
  descripcion: string;
  isInstalled: boolean;
  origin: 'PLAN' | 'EXTRA';
}

export default function FinalizeReassembleModal({ tool, onClose, onSuccess }: FinalizeReassembleModalProps) {
  const [loading, setLoading] = useState(false);
  const [partsList, setPartsList] = useState<PartRow[]>([]);
  
  // Para agregar extras
  const [extraCode, setExtraCode] = useState('');
  const [extraDesc, setExtraDesc] = useState('');
  const [fetchingExtra, setFetchingExtra] = useState(false);

  // Cargar el plan JSON
  useEffect(() => {
    // @ts-ignore (Supabase types a veces no detectan columnas nuevas JSONB)
    const plan = tool.plan_rearme as any[];
    
    if (plan && Array.isArray(plan)) {
        setPartsList(plan.map(p => ({
            codigo: p.codigo,
            descripcion: p.descripcion,
            isInstalled: false, // El técnico debe marcarlo
            origin: 'PLAN'
        })));
    }
  }, [tool]);

  const togglePart = (index: number) => {
    const newList = [...partsList];
    newList[index].isInstalled = !newList[index].isInstalled;
    setPartsList(newList);
  };

  // --- API EXTRA ---
  const fetchExtra = async () => {
    if (!extraCode) return;
    setFetchingExtra(true);
    try {
        const res = await fetch(`/api/sap-proxy?code=${encodeURIComponent(extraCode)}`);
        if (res.ok) {
            const data = await res.json();
            setExtraDesc(data.Descripcion || data.ItemName || "Sin nombre");
        } else {
            setExtraDesc("❌ No encontrado");
        }
    } catch (e) { setExtraDesc("Error"); }
    finally { setFetchingExtra(false); }
  };

  const addExtra = () => {
    if (!extraDesc || extraDesc.startsWith('❌')) return;
    setPartsList([...partsList, { codigo: extraCode, descripcion: extraDesc, isInstalled: true, origin: 'EXTRA' }]);
    setExtraCode(''); setExtraDesc('');
  };

  const handleFinish = async () => {
    const installed = partsList.filter(p => p.isInstalled);
    if (installed.length === 0 && !confirm("¿Confirmas el rearme SIN instalar ningún repuesto?")) return;

    setLoading(true);
    try {
        // 1. Actualizar Herramienta -> 'Rearmadas'
        const { error: toolError } = await supabase.from('herramientas')
            .update({ estado: 'Rearmadas', updated_at: new Date().toISOString() })
            .eq('id', tool.id);
        if (toolError) throw toolError;

        // 2. Guardar Repuestos Instalados
        if (installed.length > 0) {
            const dbInserts = installed.map(p => ({
                herramienta_id: tool.id,
                repuesto: p.descripcion,
                descripcion: `REARME | Cod: ${p.codigo} | Origen: ${p.origin}`,
            }));
            await supabase.from('repuestos').insert(dbInserts);
        }

        onSuccess();
        onClose();
    } catch (error: any) {
        alert("Error: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in">
        
        {/* HEADER VERDE (EJECUCIÓN) */}
        <div className="bg-emerald-600 text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <Hammer className="w-5 h-5"/> Ejecutar Rearme
            </h3>
            <button onClick={onClose}><X className="w-5 h-5 hover:text-emerald-200"/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
             {/* INFO TOOL */}
             <div className="flex justify-between items-end border-b pb-4 mb-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Modelo</p>
                    <h2 className="text-3xl font-black text-slate-800">{tool.modelo}</h2>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Serie</p>
                    <p className="font-mono font-bold text-lg">{tool.serie}</p>
                </div>
            </div>

            <h4 className="font-bold text-slate-700 mb-3">Lista de Instalación (Ordenada por Admin)</h4>
            
            <div className="border rounded-xl overflow-hidden shadow-sm mb-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                        <tr>
                            <th className="px-4 py-3 text-center w-10">Instalado</th>
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3">Descripción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {partsList.length === 0 && <tr><td colSpan={3} className="p-4 text-center italic text-slate-400">Sin repuestos planificados</td></tr>}
                        {partsList.map((part, idx) => (
                            <tr key={idx} onClick={() => togglePart(idx)} className={`cursor-pointer transition-colors ${part.isInstalled ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3 text-center">
                                    {part.isInstalled ? <CheckSquare className="w-5 h-5 text-emerald-600"/> : <Square className="w-5 h-5 text-slate-300"/>}
                                </td>
                                <td className="px-4 py-3 font-mono font-bold">{part.codigo}</td>
                                <td className="px-4 py-3">
                                    {part.descripcion}
                                    {part.origin === 'EXTRA' && <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1 rounded font-bold">EXTRA</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* AGREGAR EXTRA */}
            <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Agregar repuesto adicional (No planificado)</p>
                <div className="flex gap-2">
                     <div className="w-1/3 relative">
                        <input type="text" placeholder="Código" className="w-full p-2 text-sm border rounded" value={extraCode} onChange={e=>setExtraCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchExtra()}/>
                        <button onClick={fetchExtra} className="absolute right-1 top-1.5">{fetchingExtra ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 text-slate-400"/>}</button>
                     </div>
                     <input type="text" readOnly placeholder="Descripción" className="flex-1 p-2 text-sm border rounded bg-white" value={extraDesc}/>
                     <button onClick={addExtra} className="p-2 bg-slate-200 rounded hover:bg-blue-100"><Plus className="w-5 h-5"/></button>
                </div>
            </div>
        </div>

        <div className="p-4 bg-slate-50 border-t">
            <button onClick={handleFinish} disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin"/> : "Confirmar Rearme y Finalizar"}
            </button>
        </div>
      </div>
    </div>
  );
}