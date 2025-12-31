/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, Search, Hammer, ArrowRight, CheckCircle2, Loader2, Printer, CheckSquare, Square, PackageX, Filter, AlertTriangle } from 'lucide-react';
import ReassembleModal from './ReassembleModal'; 

interface ReassembleListModalProps {
  tools: Herramienta[];
  onClose: () => void;
  onSuccess: () => void;
}

interface AnalyzedTool {
    tool: Herramienta;
    status: 'ok' | 'quiebre';
    missingCount: number;
    missingCodes: string[]; // Guardamos qué falta para mostrarlo
}

export default function ReassembleListModal({ tools, onClose, onSuccess }: ReassembleListModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTool, setSelectedTool] = useState<Herramienta | null>(null);
  const [analyzedList, setAnalyzedList] = useState<AnalyzedTool[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'ok' | 'quiebre'>('all');
  const [analyzing, setAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [delivering, setDelivering] = useState(false);

  // Estados del Reporte
  const [selectedForReport, setSelectedForReport] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [digitalChecks, setDigitalChecks] = useState<Record<string, boolean>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tools.length > 0) {
        runSmartScan();
    } else {
        setAnalyzing(false);
    }
  }, [tools]);

  const normalize = (str: string) => str ? str.replace(/\s+/g, '').toUpperCase() : '';

  const runSmartScan = async () => {
    setAnalyzing(true);
    setProgress(10);
    try {
        const toolIds = tools.map(t => t.id);
        
        // 1. Obtener Desarmes
        const { data: allParts } = await supabase.from('repuestos').select('herramienta_id, descripcion').in('herramienta_id', toolIds);
        // 2. Obtener Incidentes
        const { data: allIncidents } = await supabase.from('reportes_incidentes').select('herramienta_id, codigo_repuesto, cantidad').in('herramienta_id', toolIds);

        setProgress(30);
        
        // 3. Unificar Requerimientos por Herramienta
        const toolRequirements: Record<string, Record<string, number>> = {};
        const uniqueCodes = new Set<string>();

        // Función auxiliar para sumar requerimientos
        const addRequirement = (tId: string, rawCode: string, qty: number) => {
            const code = normalize(rawCode);
            if (!code || code === 'S/C') return;
            uniqueCodes.add(code);
            if (!toolRequirements[tId]) toolRequirements[tId] = {};
            toolRequirements[tId][code] = (toolRequirements[tId][code] || 0) + qty;
        };

        if (allParts) {
            allParts.forEach(p => {
                const match = p.descripcion ? p.descripcion.match(/Cod:\s*([^|]+)/) : null;
                if (match) addRequirement(p.herramienta_id, match[1], 1);
            });
        }

        if (allIncidents) {
            allIncidents.forEach(inc => {
                addRequirement(inc.herramienta_id, inc.codigo_repuesto, inc.cantidad || 1);
            });
        }

        setProgress(50);

        // 4. Consultar Stock Real a SAP
        const codesArray = Array.from(uniqueCodes);
        const stockMap: Record<string, number> = {}; // Stock Real
        let processed = 0;
        
        for (const code of codesArray) {
            try {
                const res = await fetch(`/api/sap-proxy?code=${encodeURIComponent(code)}`);
                if (res.ok) {
                    const rawData = await res.json();
                    const stockData = Array.isArray(rawData) ? rawData.find((d: any) => d.Bodega === 'BOD01') : (rawData.Bodega === 'BOD01' ? rawData : null);
                    
                    const final = stockData ? Number(stockData.StockFinal || 0) : 0;
                    const reservado = stockData ? Number(stockData.Reservado || 0) : 0;
                    stockMap[code] = Math.max(0, final - reservado);
                } else { stockMap[code] = 0; }
            } catch { stockMap[code] = 0; }
            
            processed++;
            setProgress(50 + Math.floor((processed / codesArray.length) * 40));
        }

        // 5. Asignación de Stock Virtual (Aquí estaba el problema)
        // La asignación debe ser secuencial. El primero que llega se lo lleva.
        const results: AnalyzedTool[] = [];
        const virtualStock = { ...stockMap }; // Copia para ir descontando

        tools.forEach(t => {
            const reqs = toolRequirements[t.id];
            
            if (!reqs || Object.keys(reqs).length === 0) {
                results.push({ tool: t, status: 'ok', missingCount: 0, missingCodes: [] });
                return;
            }

            let missing = 0;
            let canBuild = true;
            const missingCodes: string[] = [];

            // Paso A: VERIFICAR si alcanza para ESTA herramienta
            for (const [code, qtyNeeded] of Object.entries(reqs)) {
                const currentAvailable = virtualStock[code] || 0;
                if (currentAvailable < qtyNeeded) {
                    canBuild = false;
                    missing++;
                    missingCodes.push(code);
                }
            }

            // Paso B: Si alcanza, DESCONTAMOS (Reservamos) para que el siguiente no lo vea
            if (canBuild) {
                for (const [code, qtyNeeded] of Object.entries(reqs)) {
                    if (virtualStock[code] !== undefined) {
                        virtualStock[code] -= qtyNeeded;
                    }
                }
                results.push({ tool: t, status: 'ok', missingCount: 0, missingCodes: [] });
            } else {
                results.push({ tool: t, status: 'quiebre', missingCount: missing, missingCodes });
            }
        });

        // Ordenar: OK primero
        results.sort((a, b) => (a.status === 'ok' ? -1 : 1));
        setAnalyzedList(results);
        setProgress(100);

    } catch (error) { console.error(error); } 
    finally { setAnalyzing(false); }
  };

  // ... (RESTO DE FUNCIONES IGUALES) ...
  // Solo renderizado del item de la lista cambia ligeramente para mostrar info extra si quieres
  
  // Renderizado abreviado para copiar
  const filteredList = analyzedList.filter(item => {
      const matchesSearch = item.tool.modelo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.tool.id_corto.toString().includes(searchTerm);
      if (filterMode === 'all') return matchesSearch;
      return matchesSearch && item.status === filterMode;
  });

  const toggleSelectReport = (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (selectedForReport.includes(id)) setSelectedForReport(prev => prev.filter(x => x !== id)); else setSelectedForReport(prev => [...prev, id]); };
  const handleSelectAll = () => { const availableOk = filteredList.filter(x => x.status === 'ok').map(x => x.tool.id); if (selectedForReport.length === availableOk.length) setSelectedForReport([]); else setSelectedForReport(availableOk); };
  
  const handleGenerateReport = async () => {
      if (selectedForReport.length === 0) return;
      
      const { data: partsData } = await supabase.from('repuestos').select('*').in('herramienta_id', selectedForReport);
      const { data: incidentData } = await supabase.from('reportes_incidentes').select('*').in('herramienta_id', selectedForReport);

      const reportMap = selectedForReport.map(toolId => {
          const tool = tools.find(t => t.id === toolId);
          
          // Procesar Repuestos
          const toolParts = (partsData || []).filter(d => d.herramienta_id === toolId).map(p => {
             const match = p.descripcion ? p.descripcion.match(/Cod:\s*([^|]+)/) : null;
             return { codigo: match ? normalize(match[1]) : 'S/C', descripcion: p.repuesto, cantidad: 1 };
          });

          // Procesar Incidentes
          const toolIncidents = (incidentData || []).filter(d => d.herramienta_id === toolId).map(i => ({
              codigo: normalize(i.codigo_repuesto),
              descripcion: `${i.descripcion_repuesto} (INCIDENCIA)`,
              cantidad: i.cantidad || 1
          }));

          // Consolidar
          const allItems = [...toolParts, ...toolIncidents];
          const consolidatedParts: any[] = [];
          
          allItems.forEach(p => {
              const existing = consolidatedParts.find(cp => cp.codigo === p.codigo);
              if (existing) existing.cantidad += p.cantidad;
              else consolidatedParts.push({...p});
          });
          
          return { tool, parts: consolidatedParts };
      });

      setReportData(reportMap);
      setShowReport(true);

      // --- CAMBIO AQUÍ: PRE-MARCAR LOS CHECKS ---
      // En vez de limpiar, marcamos automáticamente todo lo que seleccionaste
      const autoChecks: Record<string, boolean> = {};
      selectedForReport.forEach(id => {
          autoChecks[id] = true;
      });
      setDigitalChecks(autoChecks); 
      // ------------------------------------------
  };

  const toggleDigitalCheck = (toolId: string) => { setDigitalChecks(prev => ({ ...prev, [toolId]: !prev[toolId] })); };
  const handleConfirmDelivery = async () => {
      const checkedIds = Object.keys(digitalChecks).filter(k => digitalChecks[k]);
      if (checkedIds.length === 0) return alert("No has marcado ningún equipo.");
      if (!confirm(`¿Confirmas la entrega?`)) return;
      setDelivering(true);
      try {
          const { error } = await supabase.from('herramientas').update({ estado: 'Rearmando' }).in('id', checkedIds);
          if (error) throw error;
          onSuccess(); onClose();
      } catch (e: any) { alert("Error: " + e.message); } finally { setDelivering(false); }
  };
  const handlePrintReport = () => { if (reportRef.current) { const original = document.body.innerHTML; document.body.innerHTML = reportRef.current.innerHTML; window.print(); document.body.innerHTML = original; window.location.reload(); } };

  if (selectedTool) return <ReassembleModal tool={selectedTool} onClose={() => setSelectedTool(null)} onSuccess={onSuccess} />;

  // RENDER REPORT (IGUAL AL ANTERIOR)
  if (showReport) { return ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0 print:bg-white print:static"> <div className="bg-white w-full max-w-5xl h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in print:shadow-none print:h-auto print:w-full print:rounded-none"> <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0 print:hidden"> <h3 className="font-bold text-lg flex items-center gap-2">Informe Consolidado</h3> <div className="flex gap-2"> <button onClick={() => setShowReport(false)} disabled={delivering} className="px-4 py-2 text-slate-300 hover:text-white font-bold">Volver</button> <button onClick={handlePrintReport} disabled={delivering} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg flex items-center gap-2 border border-slate-600"><Printer className="w-4 h-4"/> Imprimir</button> <button onClick={handleConfirmDelivery} disabled={delivering} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 shadow-lg">{delivering ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} Confirmar Entrega</button> </div> </div> <div className="flex-1 overflow-y-auto bg-slate-100 p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible"> <div ref={reportRef} className="bg-white w-full max-w-4xl shadow-xl p-12 text-slate-900 print:shadow-none print:p-2 print:m-0 print:w-full"> <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end print:mb-2 print:pb-2 print:border-black"> <div><h1 className="text-3xl font-black uppercase text-slate-900 print:text-xl">PLANILLA DE RETIRO MASIVO</h1><p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1 print:text-xs">ENTREGA DE KIT DE REARME</p></div> <div className="text-right"><h2 className="text-xl font-black text-slate-900 uppercase print:text-lg">TOTAL: {reportData.length} EQUIPOS</h2><p className="text-xs font-mono text-slate-500 print:text-[10px]">{new Date().toLocaleDateString()}</p></div> </div> <div className="space-y-6 print:hidden"> {reportData.map((item, idx) => { const isChecked = digitalChecks[item.tool.id]; return ( <div key={idx} onClick={() => toggleDigitalCheck(item.tool.id)} className={`break-inside-avoid border rounded-lg overflow-hidden transition-all cursor-pointer ${isChecked ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'border-slate-300 shadow-sm hover:border-slate-400'}`}> <div className={`p-3 border-b flex justify-between items-center ${isChecked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'}`}> <div className="flex items-baseline gap-3"><span className="text-xl font-black text-slate-800">{item.tool?.modelo}</span><span className="text-sm font-medium text-slate-500">S/N: {item.tool?.serie}</span></div> <div className="bg-slate-900 text-white px-3 py-1 font-bold text-sm rounded shadow-sm">ID #{item.tool?.id_corto}</div> </div> <table className="w-full text-sm text-left"><thead className="text-[10px] uppercase font-bold text-slate-500 bg-white border-b border-slate-100"><tr><th className="py-2 pl-4 w-24">Código</th><th className="py-2">Repuesto</th><th className="py-2 text-center w-16">Cant.</th><th className="py-2 text-center w-16 pr-4">Check</th></tr></thead> <tbody className="divide-y divide-slate-100 bg-white">{item.parts.map((p:any, i:number) => (<tr key={i} className={isChecked ? 'bg-emerald-50/30' : ''}><td className="py-2 pl-4 font-mono font-bold text-slate-700">{p.codigo}</td><td className="py-2 text-slate-600">{p.descripcion}</td><td className="py-2 text-center font-bold text-slate-800">{p.cantidad}</td><td className="py-2 text-center pr-4"><div className={`w-5 h-5 border-2 mx-auto rounded flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>{isChecked && <ArrowRight className="w-3 h-3 text-white stroke-3"/>}</div></td></tr>))}</tbody></table> </div> ); })} </div> <div className="hidden print:block"><table className="w-full text-left border-collapse border border-black"><thead className="bg-gray-100 text-black uppercase text-[9px] font-bold border-b border-black"><tr><th className="p-1 border-r border-black w-10 text-center">ID</th><th className="p-1 border-r border-black w-16 text-center">Ubic.</th><th className="p-1 border-r border-black w-32">Equipo</th><th className="p-1 border-r border-black">Repuestos</th><th className="p-1 w-8 text-center">OK</th></tr></thead><tbody className="text-[10px]">{reportData.map((item, idx) => (<tr key={idx} className="border-b border-black break-inside-avoid"><td className="p-1 border-r border-black text-center font-bold">#{item.tool?.id_corto}</td><td className="p-1 border-r border-black text-center">{item.tool?.pallet || '-'}</td><td className="p-1 border-r border-black"><div className="font-bold">{item.tool?.modelo}</div><div className="text-[9px]">{item.tool?.serie}</div></td><td className="p-1 border-r border-black"><div className="flex flex-wrap gap-x-3">{item.parts.map((p:any, i:number) => (<span key={i} className="whitespace-nowrap"><b>{p.cantidad}x</b> {p.codigo}</span>))}</div></td><td className="p-1 text-center"><div className="w-4 h-4 border border-black mx-auto"></div></td></tr>))}</tbody></table></div> <div className="mt-12 pt-8 border-t-2 border-slate-900 flex justify-between gap-12 page-break-inside-avoid print:mt-4 print:pt-4 print:border-black"><div className="flex-1 text-center"><div className="border-t border-slate-400 w-2/3 mx-auto pt-2 print:border-black"><p className="text-[10px] font-bold uppercase text-slate-600 print:text-black">Firma Bodega</p></div></div><div className="flex-1 text-center"><div className="border-t border-slate-400 w-2/3 mx-auto pt-2 print:border-black"><p className="text-[10px] font-bold uppercase text-slate-600 print:text-black">Firma Técnico</p></div></div></div> </div> </div> </div> </div> ); }

  // RENDER PRINCIPAL
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in">
             <div className="bg-emerald-700 text-white p-5 flex justify-between items-center shrink-0">
                <div><h3 className="font-bold text-xl flex items-center gap-2"><Hammer className="w-6 h-6 text-emerald-300"/> Centro de Rearme</h3><p className="text-emerald-100/80 text-xs">{analyzing ? 'Analizando stock...' : `Total: ${analyzedList.length} equipos en proceso`}</p></div>
                <button onClick={onClose}><X className="w-6 h-6 hover:text-emerald-200"/></button>
            </div>
            {analyzing ? ( <div className="flex-1 flex flex-col items-center justify-center p-10"><Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4"/><h3 className="text-xl font-bold text-slate-700">Analizando Disponibilidad</h3><p className="text-slate-500 mb-4">Calculando stock (Desarmes + Incidentes)...</p><div className="w-64 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${progress}%`}}></div></div></div> ) : (
                <>
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button onClick={() => setFilterMode('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${filterMode === 'all' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Todos <span className="bg-slate-600/30 px-1.5 rounded text-[10px]">{analyzedList.length}</span></button>
                        <button onClick={() => setFilterMode('ok')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${filterMode === 'ok' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}><CheckCircle2 className="w-4 h-4"/> Listos <span className="bg-white/20 px-1.5 rounded text-[10px]">{analyzedList.filter(x => x.status === 'ok').length}</span></button>
                        <button onClick={() => setFilterMode('quiebre')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${filterMode === 'quiebre' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:bg-red-50 hover:text-red-600'}`}><PackageX className="w-4 h-4"/> Quiebre <span className="bg-white/20 px-1.5 rounded text-[10px]">{analyzedList.filter(x => x.status === 'quiebre').length}</span></button>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto"><div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400"/><input type="text" placeholder="Buscar modelo..." className="w-full pl-10 p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>{selectedForReport.length > 0 && <button onClick={handleGenerateReport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 animate-in slide-in-from-right-5 whitespace-nowrap"><Printer className="w-4 h-4"/> Generar ({selectedForReport.length})</button>}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
                     <div className="grid grid-cols-1 gap-3">
                        {filteredList.map(({ tool, status, missingCount, missingCodes }) => {
                             const isSelected = selectedForReport.includes(tool.id);
                             const isOk = status === 'ok';
                             return ( <div key={tool.id} onClick={() => setSelectedTool(tool)} className={`p-4 rounded-xl border shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer bg-white ${isOk ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500 opacity-90'} ${isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''}`}> <div className="flex items-center gap-4"> {isOk ? <div onClick={(e) => toggleSelectReport(tool.id, e)} className="text-slate-400 hover:text-emerald-600 cursor-pointer p-2">{isSelected ? <CheckSquare className="w-6 h-6 text-emerald-600"/> : <Square className="w-6 h-6"/>}</div> : <div className="p-2 text-red-300"><PackageX className="w-6 h-6"/></div>} <div className="w-12 h-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center border border-slate-200 text-slate-500"><span className="text-[9px] font-bold uppercase">ID</span><span className="text-lg font-black">#{tool.id_corto}</span></div> <div><h4 className="font-black text-slate-800 text-lg flex items-center gap-2">{tool.modelo} {isOk ? <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> LISTO</span> : <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full border border-red-200 font-bold flex items-center gap-1"><PackageX className="w-3 h-3"/> QUIEBRE</span>}</h4>
                             <p className="text-xs text-slate-500 font-mono flex items-center gap-2">S/N: {tool.serie} • {tool.pallet} {!isOk && <span className="text-red-500 font-bold ml-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Faltan {missingCount} repuestos</span>}</p></div> </div> <button className="px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100">Gestionar <ArrowRight className="w-4 h-4"/></button> </div> ); })}
                        {filteredList.length === 0 && <div className="text-center py-10 text-slate-400"><Filter className="w-12 h-12 mx-auto mb-2 opacity-20"/><p>No hay equipos en esta categoría.</p></div>}
                     </div>
                </div>
                </>
            )}
        </div>
    </div>
  );
}