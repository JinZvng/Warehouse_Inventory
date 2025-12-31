/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, Search, FileText, CheckSquare, Square, AlertTriangle, History, PackageX } from 'lucide-react';

interface ToolDetailProps {
  tool: Herramienta;
  onClose: () => void;
}

export default function ToolDetail({ tool, onClose }: ToolDetailProps) {
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Mapas para búsqueda rápida { "CODIGO_LIMPIO": "FECHA" }
  const [historyMap, setHistoryMap] = useState<Record<string, string>>({});
  const [incidentMap, setIncidentMap] = useState<Record<string, string>>({});

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (tool) fetchData();
  }, [tool]);

  const normalize = (str: string) => {
      if (!str) return '';
      return str.replace(/\s+/g, '').toUpperCase();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
        const modelClean = tool.modelo.trim();

        // 1. CARGAR CATÁLOGO (BOM)
        // Usamos ilike para ser un poco más flexibles con mayúsculas/minúsculas
        const { data: catalogData } = await supabase
            .from('catalogo_repuestos') 
            .select('*')
            .ilike('modelo_herramienta', modelClean) // DGA454 = dga454
            .order('nro_item', { ascending: true });

        // 2. CARGAR HISTORIAL (Lo que ya se sacó)
        const { data: historyData } = await supabase
            .from('repuestos')
            .select('*') // Necesitamos todo para reconstruir si falta en catálogo
            .eq('herramienta_id', tool.id);

        // 3. CARGAR INCIDENTES (Lo que se reportó)
        const { data: incidentData } = await supabase
            .from('reportes_incidentes')
            .select('*')
            .eq('herramienta_id', tool.id);

        // --- CONSTRUCCIÓN DE LA LISTA MAESTRA ---
        const masterMap = new Map<string, any>();
        
        // A. Llenar con Catálogo Oficial
        if (catalogData) {
            catalogData.forEach(item => {
                const code = normalize(item.codigo);
                masterMap.set(code, {
                    source: 'catalog',
                    nro_item: item.nro_item,
                    codigo: item.codigo, // Mantener original visual
                    code_clean: code,
                    descripcion: item.descripcion,
                    cantidad_base: item.cantidad || 1
                });
            });
        }

        // B. Procesar Historial (Mapas y Relleno)
        const hMap: Record<string, string> = {};
        if (historyData) {
            historyData.forEach((h: any) => {
                const match = h.descripcion ? h.descripcion.match(/Cod:\s*([^|]+)/) : null;
                const rawCode = match ? match[1] : 'S/C';
                const code = normalize(rawCode);
                
                if (code) {
                    // Guardamos la fecha (esto sobrescribe la fecha anterior, muestra la última)
                    hMap[code] = new Date(h.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
                    
                    // --- CORRECCIÓN AQUÍ ---
                    if (!masterMap.has(code)) {
                        // Si NO existe, lo creamos con cantidad 1
                        masterMap.set(code, {
                            source: 'history_fallback',
                            nro_item: 'HIST',
                            codigo: rawCode,
                            code_clean: code,
                            descripcion: h.repuesto || 'Repuesto Histórico (Sin Catálogo)',
                            cantidad_base: 1 // Empieza en 1
                        });
                    } else {
                        // Si YA EXISTE, verificamos si es un item "extra" (history_fallback)
                        const existingItem = masterMap.get(code);
                        if (existingItem.source === 'history_fallback') {
                            // Si es un extra, le sumamos 1 a la cantidad visual
                            existingItem.cantidad_base += 1;
                        }
                    }
                    // -----------------------
                }
            });
        }
        setHistoryMap(hMap);

        // C. Procesar Incidentes (Mapas y Relleno)
        const iMap: Record<string, string> = {};
        if (incidentData) {
            incidentData.forEach((i: any) => {
                const rawCode = i.codigo_repuesto;
                const code = normalize(rawCode);
                
                if (code) {
                    iMap[code] = new Date(i.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
                    
                    // Si este ítem NO está en catálogo ni historial, lo agregamos
                    if (!masterMap.has(code)) {
                        masterMap.set(code, {
                            source: 'incident_fallback',
                            nro_item: 'INC',
                            codigo: rawCode,
                            code_clean: code,
                            descripcion: i.descripcion_repuesto || 'Repuesto Reportado (Sin Catálogo)',
                            cantidad_base: i.cantidad || 1
                        });
                    }
                }
            });
        }
        setIncidentMap(iMap);

        // Convertir a Array y Ordenar
        // Prioridad orden: Items numéricos del catálogo -> Luego los agregados (Strings)
        const finalList = Array.from(masterMap.values()).sort((a, b) => {
            const numA = parseInt(a.nro_item);
            const numB = parseInt(b.nro_item);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (!isNaN(numA)) return -1;
            if (!isNaN(numB)) return 1;
            return a.code_clean.localeCompare(b.code_clean);
        });

        setItemsList(finalList);

    } catch (e) {
        console.error("Error cargando detalle:", e);
    } finally {
        setLoading(false);
    }
  };

  const filteredItems = itemsList.filter(p => {
    const term = normalize(searchTerm);
    const code = normalize(p.codigo);
    const desc = normalize(p.descripcion);
    return code.includes(term) || desc.includes(term) || p.nro_item.toString().includes(searchTerm);
  });

  const toggleSelect = (code: string) => {
    if (selectedItems.includes(code)) setSelectedItems(prev => prev.filter(c => c !== code));
    else setSelectedItems(prev => [...prev, code]);
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) setSelectedItems([]);
    else setSelectedItems(filteredItems.map(p => p.codigo));
  };

  const handleGenerateOrder = async () => {
      if (selectedItems.length === 0) return alert("Selecciona al menos un ítem.");
      
      setGenerating(true);
      try {
          const itemsToInsert = selectedItems.map(code => {
              // Buscar en nuestra lista maestra unificada
              // Importante: comparar con el código original visual o el limpio, usaremos el limpio para asegurar
              const cleanCode = normalize(code);
              const part = itemsList.find(p => p.code_clean === cleanCode);
              
              return {
                  herramienta_id: tool.id,
                  repuesto: part?.descripcion || 'Sin descripción',
                  descripcion: `Item: ${part?.nro_item} | Cod: ${part?.codigo} | Desc: ${part?.descripcion}`,
              };
          });

          const { error } = await supabase.from('repuestos').insert(itemsToInsert);
          if (error) throw error;

          alert("Orden generada correctamente.");
          onClose();
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setGenerating(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in">
      <div className="bg-white w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-white">
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-800">{tool.modelo}</h2>
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border">ID #{tool.id_corto}</span>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-1">Serie: <span className="font-mono text-slate-700">{tool.serie}</span> • Ubicación: {tool.pallet}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6"/>
            </button>
        </div>

        {/* BUSCADOR */}
        <div className="p-4 bg-slate-50 border-b flex gap-4 items-center">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                <input 
                    type="text" 
                    placeholder="Buscar repuesto..." 
                    className="w-full pl-9 p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg">
                {selectedItems.length > 0 && selectedItems.length === filteredItems.length ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                Seleccionar Todo
            </button>
        </div>

        {/* LISTADO */}
        <div className="flex-1 overflow-y-auto bg-white">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-sm">Cargando datos...</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                    <PackageX className="w-16 h-16 mb-4"/>
                    <p className="font-bold text-lg">No se encontró catálogo</p>
                    <p className="text-sm">Y no hay historial ni incidencias para mostrar.</p>
                </div>
            ) : (
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase sticky top-0 z-10 shadow-sm">
                        <tr><th className="p-4 w-16 text-center">Sel.</th><th className="p-4 w-20">Item</th><th className="p-4 w-32">Código</th><th className="p-4">Descripción</th><th className="p-4 w-20 text-center">Cant.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((part) => {
                            const isSelected = selectedItems.includes(part.codigo);
                            
                            // NORMALIZACIÓN
                            const codeClean = part.code_clean;
                            const incidentDate = incidentMap[codeClean];
                            const historyDate = historyMap[codeClean];
                            const isFallback = part.source !== 'catalog';

                            return (
                                <tr 
                                    key={part.code_clean + Math.random()} 
                                    onClick={() => toggleSelect(part.codigo)}
                                    className={`
                                        group cursor-pointer transition-colors
                                        ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}
                                        ${incidentDate ? 'bg-orange-50/60' : ''} 
                                        ${isFallback && !incidentDate ? 'bg-yellow-50/30' : ''} 
                                    `}
                                >
                                    <td className="p-4 text-center">
                                        <div className={`w-5 h-5 border-2 rounded mx-auto flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'}`}>
                                            <CheckSquare className={`w-3.5 h-3.5 ${isSelected ? 'block' : 'hidden'}`} />
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-slate-500 font-bold text-xs">
                                        {isFallback ? <span className="text-yellow-600">*EXTRA</span> : `#${part.nro_item}`}
                                    </td>
                                    <td className="p-4 font-mono font-bold text-slate-700">
                                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{part.codigo}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium text-slate-700">{part.descripcion}</div>
                                        
                                        <div className="flex flex-col gap-1 mt-1">
                                            {incidentDate && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded border border-orange-200 animate-pulse">
                                                    <AlertTriangle className="w-3 h-3"/> Reportado como faltante el {incidentDate}
                                                </span>
                                            )}
                                            {historyDate && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                    <History className="w-3 h-3"/> Anteriormente sacado el {historyDate}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-xs border">x{part.cantidad_base}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
            <div className="text-xs text-slate-500">{selectedItems.length} items seleccionados.</div>
        </div>
      </div>
    </div>
  );
}