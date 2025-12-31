/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, Search, Printer, FileText, Hammer, Loader2, AlertTriangle, CheckCircle2, Ban, History } from 'lucide-react';

interface ReassembleModalProps {
  tool: Herramienta;
  onClose: () => void;
  onSuccess: () => void;
}

interface ExtractedPart {
  id: string;
  codigo_parte: string;
  nombre_pieza: string;
  fecha_extraccion: string;
  // Stock data
  stock_remanente?: number;
  stock_final?: number;
  stock_reservado?: number;
  stock_disponible?: number;
  cantidad_necesaria_total?: number;
  tiene_stock_suficiente?: boolean;
  // Flag de Incidencia
  es_incidente?: boolean; 
  fecha_incidente?: string;
}

export default function ReassembleModal({ tool, onClose, onSuccess }: ReassembleModalProps) {
  const [partsList, setPartsList] = useState<ExtractedPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  
  const [step, setStep] = useState<'selection' | 'solicitante' | 'ticket'>('selection');
  const [solicitante, setSolicitante] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tool?.id) fetchExtractedHistory();
  }, [tool]);

  // Normalizador
  const normalize = (str: string) => str ? str.replace(/\s+/g, '').toUpperCase() : '';

  const fetchExtractedHistory = async () => {
    setLoading(true);

    const { data: extractionData } = await supabase
        .from('repuestos')
        .select('*')
        .eq('herramienta_id', tool.id)
        .order('created_at', { ascending: false });

    const { data: incidentData } = await supabase
        .from('reportes_incidentes')
        .select('codigo_repuesto, descripcion_repuesto, cantidad, created_at')
        .eq('herramienta_id', tool.id);

    const masterMap = new Map<string, ExtractedPart>();

    // A. Desarmes Normales
    if (extractionData) {
        extractionData.forEach(item => {
            const codeMatch = item.descripcion ? item.descripcion.match(/Cod:\s*([^|]+)/) : null;
            const code = codeMatch ? normalize(codeMatch[1]) : normalize(item.repuesto); 
            
            if (code && code !== 'S/C') {
                const existing = masterMap.get(code);
                const currentQty = existing?.cantidad_necesaria_total || 0;

                masterMap.set(code, {
                    id: item.id,
                    codigo_parte: code,
                    nombre_pieza: item.repuesto,
                    fecha_extraccion: new Date(item.created_at).toLocaleDateString(),
                    cantidad_necesaria_total: currentQty + 1,
                    es_incidente: false
                });
            }
        });
    }

    // B. Incidentes
    if (incidentData) {
        incidentData.forEach((inc: any) => {
            const code = normalize(inc.codigo_repuesto);
            const existing = masterMap.get(code);
            const qtyIncidente = inc.cantidad || 1;

            if (existing) {
                masterMap.set(code, {
                    ...existing,
                    es_incidente: true,
                    fecha_incidente: new Date(inc.created_at).toLocaleDateString(),
                });
            } else {
                masterMap.set(code, {
                    id: `inc-${code}`,
                    codigo_parte: code,
                    nombre_pieza: inc.descripcion_repuesto || 'REPUESTO FALTANTE',
                    fecha_extraccion: new Date(inc.created_at).toLocaleDateString(),
                    cantidad_necesaria_total: qtyIncidente,
                    es_incidente: true,
                    fecha_incidente: new Date(inc.created_at).toLocaleDateString()
                });
            }
        });
    }

    const finalList = Array.from(masterMap.values());
    finalList.sort((a, b) => (a.es_incidente === b.es_incidente) ? 0 : a.es_incidente ? -1 : 1);

    setPartsList(finalList);
    
    const counts: Record<string, number> = {};
    finalList.forEach(p => {
        counts[p.codigo_parte] = p.cantidad_necesaria_total || 1;
    });

    checkStockStrict(finalList, counts);
    setLoading(false);
  };

  const checkStockStrict = async (parts: ExtractedPart[], requiredCounts: Record<string, number>) => {
    setStockLoading(true);
    let globalBlock = false;
    const uniqueCodes = Object.keys(requiredCounts);
    const stockMap: Record<string, { final: number, reservado: number, disponible: number }> = {};

    for (const code of uniqueCodes) {
        if (code === 'S/C') continue;
        try {
            const res = await fetch(`/api/sap-proxy?code=${encodeURIComponent(code)}`);
            if (res.ok) {
                const data = await res.json();
                const stockData = Array.isArray(data) ? data.find((d: any) => d.Bodega === 'BOD01') : (data.Bodega === 'BOD01' ? data : null);
                
                const final = stockData ? Number(stockData.StockFinal || 0) : 0;
                const reservado = stockData ? Number(stockData.Reservado || 0) : 0;
                // Stock disponible real
                const disponible = Math.max(0, final - reservado); 

                stockMap[code] = { final, reservado, disponible };
            } else { stockMap[code] = { final: 0, reservado: 0, disponible: 0 }; }
        } catch { stockMap[code] = { final: 0, reservado: 0, disponible: 0 }; }
    }

    setPartsList(prev => prev.map(p => {
        const stockInfo = stockMap[p.codigo_parte] || { final: 0, reservado: 0, disponible: 0 };
        const necesario = p.cantidad_necesaria_total || 1;
        const remanente = stockInfo.disponible - necesario;
        
        // --- LOGICA CORREGIDA ---
        // Si remanente es >= 0, significa que alcanza (incluso si queda en 0)
        const suficiente = remanente >= 0; 
        
        if (!suficiente) globalBlock = true; 

        return {
            ...p,
            stock_final: stockInfo.final,
            stock_reservado: stockInfo.reservado,
            stock_disponible: stockInfo.disponible,
            stock_remanente: remanente,
            tiene_stock_suficiente: suficiente
        };
    }));

    setIsBlocked(globalBlock);
    setStockLoading(false);
  };

  const filteredParts = partsList.filter(part => 
    part.nombre_pieza.toLowerCase().includes(searchTerm.toLowerCase()) || 
    part.codigo_parte.includes(searchTerm.toUpperCase())
  );

  const handleConfirmReassembly = async () => {
    if (isBlocked) return alert("No hay stock suficiente.");
    if (!confirm("¿Confirmas el rearme?")) return;
    setFinishing(true);
    try {
        const { error } = await supabase.from('herramientas').update({ estado: 'Rearmadas' }).eq('id', tool.id);
        if (error) throw error;
        onSuccess();
        onClose();
    } catch (e: any) { alert(e.message); } 
    finally { setFinishing(false); }
  };

  const handlePrint = () => {
    if (ticketRef.current) {
        const original = document.body.innerHTML;
        document.body.innerHTML = ticketRef.current.innerHTML;
        window.print();
        document.body.innerHTML = original;
        window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in">
        
        {step === 'selection' && (
            <>
                <div className="bg-emerald-700 text-white p-5 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2"><Hammer className="w-5 h-5"/> Validación de Rearme</h2>
                        <p className="text-emerald-100 text-sm opacity-90">{tool.modelo} • ID #{tool.id_corto}</p>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 hover:text-emerald-200"/></button>
                </div>

                {partsList.some(p => p.es_incidente) && (
                    <div className="bg-orange-100 p-3 text-orange-800 text-xs font-bold flex items-center gap-2 justify-center border-b border-orange-200 animate-pulse">
                        <AlertTriangle className="w-4 h-4"/> ATENCIÓN: Este equipo tiene repuestos marcados como INCIDENCIA.
                    </div>
                )}

                {stockLoading ? (
                    <div className="bg-blue-50 p-3 text-blue-700 text-xs font-bold flex items-center gap-2 justify-center border-b border-blue-100">
                        <Loader2 className="w-4 h-4 animate-spin"/> Verificando stock...
                    </div>
                ) : isBlocked ? (
                    <div className="bg-red-600 text-white p-3 text-sm font-bold flex items-center gap-2 justify-center shadow-inner">
                        <Ban className="w-5 h-5"/> STOCK INSUFICIENTE EN BODEGA
                    </div>
                ) : (
                    <div className="bg-emerald-100 p-3 text-emerald-800 text-sm font-bold flex items-center gap-2 justify-center border-b border-emerald-200">
                        <CheckCircle2 className="w-5 h-5"/> Stock Suficiente
                    </div>
                )}

                <div className="p-4 border-b bg-slate-50">
                    <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><input type="text" placeholder="Buscar repuesto..." className="w-full pl-9 p-2 border rounded-lg text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-500 uppercase text-xs sticky top-0 font-bold z-10">
                            <tr><th className="p-3">Código</th><th className="p-3">Descripción</th><th className="p-3 text-center">Fecha</th><th className="p-3 text-center border-l bg-slate-200">Stock</th><th className="p-3 text-center w-24">Estado</th></tr>
                        </thead>
                        <tbody className="divide-y">
                        {filteredParts.map(part => {
                            // VARIABLES DEFINIDAS AQUÍ PARA EVITAR EL ERROR
                            const final = part.stock_final ?? 0;
                            const resv = part.stock_reservado ?? 0;
                            const ok = part.tiene_stock_suficiente;
                            const isIncident = part.es_incidente; // <--- AQUÍ ESTÁ LA CORRECCIÓN

                            return (
                                <tr key={part.id} className={`hover:bg-slate-50 transition-colors ${isIncident ? 'bg-orange-50 border-l-4 border-l-orange-500' : (!ok ? 'bg-red-50' : '')}`}>
                                    <td className="p-3 font-mono font-bold text-slate-700">
                                        {part.codigo_parte}
                                        {isIncident && <span className="block text-[9px] text-orange-600 font-bold uppercase mt-1 items-center gap-1"><AlertTriangle className="w-3 h-3"/> INCIDENCIA</span>}
                                    </td>
                                    <td className="p-3 text-slate-600">
                                        {part.nombre_pieza}
                                        {isIncident && <span className="block text-xs text-orange-500 mt-0.5 font-medium">⚠️ Faltante reportado: {part.cantidad_necesaria_total} un.</span>}
                                    </td>
                                    <td className="p-3 text-center text-xs text-slate-400 font-mono">
                                        {part.fecha_extraccion}
                                    </td>
                                    
                                    <td className="p-3 border-l bg-slate-50/50 w-48">
                                        {stockLoading ? <span className="text-xs text-slate-400">...</span> : 
                                            <div className="flex flex-col text-xs">
                                                <div className="flex justify-between mb-1 px-2"><span className="text-slate-500">Hay: <b>{Math.max(0, final-resv)}</b></span><span className="text-slate-500">Pide: <b>{part.cantidad_necesaria_total}</b></span></div>
                                                <div className={`text-center font-bold px-2 py-1 rounded border ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                    {ok 
                                                        ? (part.stock_remanente === 0 ? 'ASIGNADO (0) 👌' : `Quedan ${part.stock_remanente} ✅`)
                                                        : 'FALTAN ⛔'
                                                    }
                                                </div>
                                            </div>
                                        }
                                    </td>
                                    <td className="p-3 text-center">
                                        {isIncident ? <div className="flex flex-col items-center animate-pulse" title="Incidencia activa"><History className="w-6 h-6 text-orange-500"/></div> : (stockLoading ? null : ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto"/> : <AlertTriangle className="w-5 h-5 text-red-500 mx-auto"/>)}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t flex justify-between items-center bg-white z-10">
                    <button onClick={handleConfirmReassembly} disabled={finishing || isBlocked || stockLoading} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm transition-all ${isBlocked || stockLoading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white shadow-lg'}`}>
                        {finishing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Hammer className="w-4 h-4"/>} {isBlocked ? 'Bloqueado' : 'Confirmar'}
                    </button>
                    <button onClick={() => setStep('solicitante')} disabled={isBlocked || stockLoading} className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg disabled:opacity-50">
                        <FileText className="w-4 h-4"/> Generar Vale
                    </button>
                </div>
            </>
        )}

        {/* PASO 2: SOLICITANTE */}
        {step === 'solicitante' && (
            <div className="flex flex-col h-full p-8 items-center justify-center bg-slate-50">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in">
                    <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Responsable</h3>
                    <input type="text" placeholder="Ej: Juan Pérez" className="w-full p-3 border rounded-xl mb-6 text-center font-bold text-lg uppercase outline-none" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} autoFocus />
                    <div className="flex gap-3"><button onClick={() => setStep('selection')} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-slate-500">Volver</button><button onClick={() => setStep('ticket')} disabled={!solicitante} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-50">Ver Vale</button></div>
                </div>
            </div>
        )}

        {/* PASO 3: TICKET DE IMPRESIÓN */}
        {step === 'ticket' && (
            <div className="flex flex-col h-full bg-slate-100">
                <div className="bg-white p-4 border-b flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg">Vista Previa</h3>
                    <div className="flex gap-2"><button onClick={() => setStep('selection')} className="px-4 py-2 font-bold text-slate-500">Volver</button><button onClick={handlePrint} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg"><Printer className="w-4 h-4 mr-2 inline"/> Imprimir</button></div>
                </div>
                <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100">
                    <div ref={ticketRef} className="bg-white w-full max-w-2xl p-10 shadow-2xl text-slate-900 print:shadow-none print:w-full">
                        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between"><h1 className="text-3xl font-black">ORDEN DE REARME</h1><div className="text-right"><div className="bg-black text-white px-2 font-bold text-xl">ID #{tool.id_corto}</div><p className="text-xs">{new Date().toLocaleDateString()}</p></div></div>
                        <div className="grid grid-cols-2 gap-4 mb-6"><div className="border p-2"><p className="text-xs font-bold text-slate-400">Modelo</p><p className="text-xl font-black">{tool.modelo}</p></div><div className="border p-2"><p className="text-xs font-bold text-slate-400">Serie</p><p className="text-lg font-mono">{tool.serie}</p></div></div>
                        <div className="mb-6 border-b pb-2"><span className="font-bold text-slate-500">TÉCNICO:</span> <span className="font-bold uppercase">{solicitante}</span></div>
                        <table className="w-full text-sm mb-10"><thead><tr className="border-b-2 border-black"><th className="py-2 text-left">Código</th><th className="py-2 text-left">Descripción</th><th className="py-2 text-center">Cant.</th><th className="py-2 text-center">Stock</th><th className="py-2 text-center">Check</th></tr></thead>
                        <tbody>{partsList.map(p => (<tr key={p.id} className="border-b"><td className="py-2 font-mono font-bold">{p.codigo_parte} {p.es_incidente && '(INCIDENCIA)'}</td><td className="py-2">{p.nombre_pieza}</td><td className="py-2 text-center font-bold">{p.cantidad_necesaria_total}</td><td className="py-2 text-center">{p.stock_final}</td><td className="py-2 text-center"><div className="w-4 h-4 border border-black mx-auto"></div></td></tr>))}</tbody></table>
                        <div className="flex justify-between mt-12 pt-8 border-t-2 border-black text-xs font-bold uppercase text-center"><div className="w-1/3 border-t border-slate-400 pt-1">Firma Bodega</div><div className="w-1/3 border-t border-slate-400 pt-1">Firma Técnico</div></div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}