/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X,Plus, Trash2, Zap, Loader2, ClipboardList, Hammer } from 'lucide-react';

interface RequestReassembleModalProps {
  tool: Herramienta;
  onClose: () => void;
  onSuccess: () => void;
}

interface PartPlan {
  codigo: string;
  descripcion: string;
  cantidad: number;
}

export default function RequestReassembleModal({ tool, onClose, onSuccess }: RequestReassembleModalProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // Lista de planificación
  const [partsList, setPartsList] = useState<PartPlan[]>([]);
  
  // Inputs
  const [inputCode, setInputCode] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [inputStock, setInputStock] = useState<number | null>(null);

  // --- API SAP ---
  const fetchPartData = async () => {
    if (!inputCode) return;
    setFetching(true);
    setInputDesc("Buscando...");
    setInputStock(null);

    try {
        const response = await fetch(`/api/sap-proxy?code=${encodeURIComponent(inputCode)}`);
        if (response.ok) {
            const data = await response.json();
            const desc = data.Descripcion || data.ItemName || data.descripcion || "⚠️ Sin nombre";
            const stock = data.OnHand || data.Stock || 0;
            setInputDesc(desc);
            setInputStock(Number(stock));
        } else {
            setInputDesc("❌ No encontrado");
        }
    } catch (error) {
        setInputDesc("❌ Error Red");
    } finally {
        setFetching(false);
    }
  };

  const handleAddPart = () => {
    if (!inputCode || !inputDesc || inputDesc.startsWith('❌')) return;
    
    setPartsList([...partsList, {
        codigo: inputCode,
        descripcion: inputDesc,
        cantidad: 1
    }]);

    setInputCode('');
    setInputDesc('');
    setInputStock(null);
  };

  const handleRemove = (index: number) => {
    setPartsList(partsList.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async () => {
    if (partsList.length === 0 && !confirm("¿Crear orden de rearme SIN repuestos (Solo mano de obra)?")) return;

    setLoading(true);
    try {
        // Guardamos el PLAN en la columna JSON y cambiamos estado
        const { error } = await supabase.from('herramientas')
            .update({
                estado: 'En rearme', // Pasamos la pelota al técnico
                plan_rearme: partsList, // Guardamos la lista JSON
                updated_at: new Date().toISOString()
            })
            .eq('id', tool.id);

        if (error) throw error;
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
        
        {/* HEADER AZUL (PLANIFICACIÓN) */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5"/> Generar Orden de Rearme
            </h3>
            <button onClick={onClose}><X className="w-5 h-5 hover:text-blue-200"/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            <div className="bg-slate-50 p-4 rounded-xl border mb-6 flex justify-between items-center">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Equipo a Rearmar</p>
                    <h2 className="text-2xl font-black text-slate-800">{tool.modelo}</h2>
                    <p className="text-sm font-mono text-slate-500">ID #{tool.id_corto} | S/N: {tool.serie}</p>
                </div>
            </div>

            <p className="text-sm font-bold text-slate-700 mb-2">1. Definir repuestos necesarios (Búsqueda SAP)</p>
            
            <div className="flex gap-2 items-start mb-4 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                <div className="w-1/3 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Código</label>
                    <input 
                        type="text" placeholder="Ej: 629B61-9" 
                        className="w-full p-2 pr-8 text-sm border-b-2 border-slate-200 focus:border-blue-500 outline-none font-mono font-bold uppercase"
                        value={inputCode} onChange={e => setInputCode(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchPartData()}
                    />
                    <button onClick={fetchPartData} disabled={fetching} className="absolute right-0 bottom-2 p-1 text-slate-400 hover:text-blue-600">
                        {fetching ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 fill-current"/>}
                    </button>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción</label>
                    <input type="text" readOnly value={inputDesc} className="w-full p-2 text-sm border-b-2 border-slate-200 outline-none bg-transparent"/>
                </div>
                <div className="w-16 text-center">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Stock</label>
                     <div className={`text-sm font-bold ${inputStock && inputStock > 0 ? 'text-green-600' : 'text-red-400'}`}>{inputStock ?? '-'}</div>
                </div>
                <button onClick={handleAddPart} className="mt-4 p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"><Plus className="w-5 h-5"/></button>
            </div>

            {/* LISTA PLANIFICADA */}
            <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold">
                        <tr>
                            <th className="px-4 py-2">Código</th>
                            <th className="px-4 py-2">Repuesto Solicitado</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {partsList.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400 italic">Lista vacía</td></tr>}
                        {partsList.map((part, i) => (
                            <tr key={i}>
                                <td className="px-4 py-2 font-mono font-bold">{part.codigo}</td>
                                <td className="px-4 py-2">{part.descripcion}</td>
                                <td className="px-4 py-2"><button onClick={() => handleRemove(i)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
            <button onClick={handleSaveOrder} disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Hammer className="w-4 h-4"/>} Generar Orden
            </button>
        </div>
      </div>
    </div>
  );
}