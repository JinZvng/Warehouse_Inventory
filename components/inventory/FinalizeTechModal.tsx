/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
"use client";
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, Wrench, CheckSquare, Square, Printer, Loader2, Plus, Trash2, ListChecks, Zap } from 'lucide-react';

interface FinalizeTechModalProps {
  tool: Herramienta;
  onClose: () => void;
  onSuccess: () => void;
}

interface PartRow {
  codigo: string;
  descripcion: string;
  cliente: string;
  isExtracted: boolean;
  origin: 'SAP' | 'MANUAL';
}

export default function FinalizeTechModal({ tool, onClose, onSuccess }: FinalizeTechModalProps) {
  const [step, setStep] = useState<'form' | 'ticket'>('form');
  const [loading, setLoading] = useState(false);
  const [fetchingManual, setFetchingManual] = useState(false);
  const initialSerie = tool.serie.startsWith('PENDIENTE') ? '' : tool.serie;
  
  const [formData, setFormData] = useState({
    realSerie: initialSerie, // <--- Aquí pre-llenamos
    realPallet: tool.pallet === 'RECEPCIÓN' || tool.pallet === 'RECEPCIÓN ST02' ? '' : tool.pallet,
  });

  const [partsList, setPartsList] = useState<PartRow[]>([]);
  
  // Inputs temporales
  const [newExtraCode, setNewExtraCode] = useState('');
  const [newExtraDesc, setNewExtraDesc] = useState('');

  const ticketRef = useRef<HTMLDivElement>(null);

  // --- CARGA INICIAL ---
  useEffect(() => {
    const codes = (tool.repuesto_objetivo || '').split('\n').filter(x => x.trim());
    const descs = (tool.descripcion_objetivo || '').split('\n');
    const clients = (tool.solicitante || '').split('\n');

    const sapParts: PartRow[] = codes.map((code, i) => ({
        codigo: code,
        descripcion: descs[i] || 'Sin descripción',
        cliente: clients[i] || clients[0] || 'Anónimo',
        isExtracted: false,
        origin: 'SAP'
    }));

    setPartsList(sapParts);
  }, [tool]);

  // --- API MANUAL ---
  const fetchManualDescription = async () => {
    if (!newExtraCode) return;
    setFetchingManual(true);
    setNewExtraDesc("Buscando..."); 

    try {
        const response = await fetch(`/api/sap-proxy?code=${encodeURIComponent(newExtraCode)}`);
        if (response.ok) {
            const data = await response.json();
            const desc = data.Descripcion || data.ItemName || data.descripcion || "⚠️ Sin nombre";
            setNewExtraDesc(desc);
        } else {
            setNewExtraDesc("❌ No encontrado");
        }
    } catch (error) {
        setNewExtraDesc("❌ Error Red");
    } finally {
        setFetchingManual(false);
    }
  };

  // --- ACCIONES LISTA ---
  const togglePart = (index: number) => {
    const newList = [...partsList];
    newList[index].isExtracted = !newList[index].isExtracted;
    setPartsList(newList);
  };

  const handleAddButton = () => {
    if (!newExtraDesc) return alert("Escribe una descripción primero.");
    const newPart: PartRow = {
        codigo: newExtraCode || 'S/C',
        descripcion: newExtraDesc,
        cliente: 'Dañado extraccion',
        isExtracted: true,
        origin: 'MANUAL'
    };
    setPartsList(prev => [...prev, newPart]);
    setNewExtraCode('');
    setNewExtraDesc('');
  };

  const handleRemoveManual = (index: number) => {
    setPartsList(prev => prev.filter((_, i) => i !== index));
  };

  // --- GUARDADO ---
  const handleSave = async () => {
    if (!formData.realSerie || !formData.realPallet) return alert("Falta Serie o Ubicación.");

    setLoading(true);

    try {
        // Auto-guardado de input pendiente
        let finalPartsList = [...partsList];
        if (newExtraDesc.trim().length > 0) {
            finalPartsList.push({
                codigo: newExtraCode || 'S/C',
                descripcion: newExtraDesc,
                cliente: 'Técnico Taller',
                isExtracted: true,
                origin: 'MANUAL'
            });
        }

        const extractedParts = finalPartsList.filter(p => p.isExtracted);
        if (extractedParts.length === 0) {
            if (!confirm("No has marcado repuestos. ¿Finalizar solo como Desarmado?")) {
                setLoading(false);
                return;
            }
        }

        // 1. ACTUALIZAR HERRAMIENTA -> ESTADO: 'Desarmado'
        const { error: toolError } = await supabase.from('herramientas')
            .update({ 
                serie: formData.realSerie.toUpperCase(), 
                pallet: formData.realPallet,
                estado: 'Desarmado' // <--- AQUÍ ESTÁ EL CAMBIO CLAVE
            })
            .eq('id', tool.id);

        if (toolError) throw toolError;

        // 2. INSERTAR REPUESTOS
        if (extractedParts.length > 0) {
            const dbInserts = extractedParts.map(part => ({
                herramienta_id: tool.id,
                repuesto: part.descripcion,
                descripcion: `Cod: ${part.codigo} | Origen: ${part.origin} | Para: ${part.cliente}`,
            }));

            const { error: partError } = await supabase.from('repuestos').insert(dbInserts);
            if (partError) throw partError;
        }

        onSuccess();
        setStep('ticket');

    } catch (error: any) {
        alert("Error al guardar: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handlePrint = () => {
    const content = ticketRef.current;
    if (content) {
        const original = document.body.innerHTML;
        document.body.innerHTML = content.innerHTML;
        window.print();
        document.body.innerHTML = original;
        window.location.reload(); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5 text-yellow-400"/> Proceso de Desarme
            </h3>
            <button onClick={onClose}><X className="w-5 h-5 hover:text-red-400"/></button>
        </div>

        {step === 'form' && (
            <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-6">
                    
                    {/* INFO */}
                    <div className="flex justify-between items-end border-b pb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Modelo a Desarmar</p>
                            <h2 className="text-3xl font-black text-slate-800">{tool.modelo}</h2>
                        </div>
                        <div className="flex gap-4">
                             <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Serie Real</label>
                                <input type="text" className="w-32 p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none font-mono uppercase font-bold"
                                    value={formData.realSerie} onChange={e => setFormData({...formData, realSerie: e.target.value})} autoFocus />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Ubicación</label>
                                <input type="text" className="w-32 p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none uppercase font-bold"
                                    value={formData.realPallet} onChange={e => setFormData({...formData, realPallet: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* LISTA */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <ListChecks className="w-5 h-5 text-blue-600"/>
                            <h4 className="font-bold text-slate-700">Lista de Recuperación</h4>
                        </div>
                        
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-3 w-10 text-center">Extraido</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Descripción</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {partsList.length === 0 && (
                                        <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">No hay repuestos solicitados</td></tr>
                                    )}
                                    {partsList.map((part, idx) => (
                                        <tr 
                                            key={idx} 
                                            onClick={() => togglePart(idx)}
                                            className={`cursor-pointer transition-colors ${part.isExtracted ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-4 py-3 text-center">
                                                {part.isExtracted ? 
                                                    <CheckSquare className="w-5 h-5 text-green-600 mx-auto fill-green-100"/> : 
                                                    <Square className="w-5 h-5 text-slate-300 mx-auto"/>
                                                }
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-700">{part.codigo}</td>
                                            <td className={`px-4 py-3 font-medium ${part.isExtracted ? 'text-green-800' : 'text-slate-600'}`}>
                                                {part.descripcion}
                                                {part.origin === 'MANUAL' && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">EXTRA</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs uppercase text-slate-500">{part.cliente}</td>
                                            <td className="px-4 py-3 text-right">
                                                {part.origin === 'MANUAL' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveManual(idx); }} className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4"/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AGREGAR MANUAL */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Agregar repuesto dañado</p>
                        <div className="flex gap-2 items-center">
                            <div className="w-1/3 relative">
                                <input 
                                    type="text" 
                                    placeholder="Código" 
                                    className="w-full p-2 pr-8 text-sm border rounded-lg" 
                                    value={newExtraCode} 
                                    onChange={e => setNewExtraCode(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchManualDescription()}
                                />
                                <button 
                                    onClick={fetchManualDescription}
                                    disabled={fetchingManual}
                                    className="absolute right-1 top-1 p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-colors"
                                >
                                    {fetchingManual ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 fill-current"/>}
                                </button>
                            </div>

                            <input 
                                type="text" 
                                placeholder="Descripción..." 
                                className="flex-1 p-2 text-sm border rounded-lg bg-white" 
                                value={newExtraDesc} 
                                onChange={e => setNewExtraDesc(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && handleAddButton()} 
                            />
                            
                            <button onClick={handleAddButton} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-green-100 hover:text-green-600 font-bold transition-colors">
                                <Plus className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>

                </div>

                <div className="p-4 bg-white border-t shrink-0">
                    <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2">
                        {loading ? <Loader2 className="animate-spin w-5 h-5"/> : `Finalizar como "Desarmado"`}
                    </button>
                </div>
            </div>
        )}

        {/* TICKET */}
        {step === 'ticket' && (
            <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                    <div ref={ticketRef} className="bg-white w-full max-w-sm p-6 shadow-none border border-slate-200 print:w-full print:border-none print:shadow-none">
                        
                        <div className="text-center border-b-2 border-black pb-4 mb-4">
                            <h1 className="text-2xl font-black uppercase">Ticket Desarme</h1>
                            <p className="text-xs font-mono">#{tool.id_corto} | {new Date().toLocaleDateString()}</p>
                        </div>

                        <div className="mb-4 flex justify-between items-end border-b pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-500">Modelo</p>
                                <p className="text-2xl font-black">{tool.modelo}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold uppercase text-slate-500">Ubicación</p>
                                <p className="text-xl font-bold">{formData.realPallet}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-xs font-bold uppercase text-slate-500 mb-2">Piezas Recuperadas</p>
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="border-b border-black">
                                        <th className="py-1">Cant</th>
                                        <th className="py-1">Descripción</th>
                                        <th className="py-1 w-16 text-right">Cód</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {partsList.filter(p => p.isExtracted).map((p, i) => (
                                        <tr key={i}>
                                            <td className="py-1 font-bold">1</td>
                                            <td className="py-1">{p.descripcion.slice(0, 20)}</td>
                                            <td className="py-1 text-right">{p.codigo}</td>
                                        </tr>
                                    ))}
                                    {partsList.filter(p => p.isExtracted).length === 0 && (
                                        <tr><td colSpan={3} className="py-2 text-center italic">Solo desarme (Sin piezas)</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-[10px] text-center text-slate-500 mt-8 pt-2 border-t border-dashed border-slate-300">
                             S/N: {formData.realSerie} | ESTADO: DESARMADO
                        </div>
                    </div>
                </div>
                
                <div className="p-4 bg-white border-t flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cerrar</button>
                    <button onClick={handlePrint} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg flex justify-center items-center gap-2 hover:bg-blue-700 shadow-lg">
                        <Printer className="w-4 h-4"/> Imprimir
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}