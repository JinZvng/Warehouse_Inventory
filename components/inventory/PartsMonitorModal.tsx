/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, RefreshCw, AlertCircle, CheckCircle2, PackageSearch, ArrowRight } from 'lucide-react';

interface PartsMonitorModalProps {
  onClose: () => void;
}

interface FlatItem {
  toolId: number;
  modelo: string;
  serie: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
}

export default function PartsMonitorModal({ onClose }: PartsMonitorModalProps) {
  const [loading, setLoading] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);
  
  // Datos aplanados (Fila por repuesto, no por herramienta)
  const [items, setItems] = useState<FlatItem[]>([]);
  
  // Diccionario de Stock en tiempo real: { "629B61-9": 5, ... }
  const [stockMap, setStockMap] = useState<Record<string, number | null>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // 1. Buscamos herramientas que están esperando repuestos (En rearme)
    const { data } = await supabase
        .from('herramientas')
        .select('id_corto, modelo, serie, plan_rearme')
        .eq('estado', 'En rearme');

    if (data) {
        const flatList: FlatItem[] = [];
        
        // 2. Aplanamos la data: Dejamos de pensar en "Herramientas" y pensamos en "Repuestos Necesarios"
        data.forEach(tool => {
            const plan = tool.plan_rearme as any[];
            if (Array.isArray(plan)) {
                plan.forEach(part => {
                    flatList.push({
                        toolId: tool.id_corto,
                        modelo: tool.modelo,
                        serie: tool.serie,
                        codigo: part.codigo,
                        descripcion: part.descripcion,
                        cantidad: part.cantidad || 1
                    });
                });
            }
        });
        setItems(flatList);
        
        // 3. Iniciar chequeo de stock automático
        checkBulkStock(flatList);
    }
    setLoading(false);
  };

  // --- CONSULTA MASIVA A TU API ---
  const checkBulkStock = async (list: FlatItem[]) => {
    setCheckingStock(true);
    const uniqueCodes = [...new Set(list.map(i => i.codigo))];
    const newStocks: Record<string, number | null> = {};

    // Procesamos en serie para no matar el navegador (o usa Promise.all con lotes si son muchos)
    for (const code of uniqueCodes) {
        try {
            const res = await fetch(`/api/sap-proxy?code=${encodeURIComponent(code)}`);
            if (res.ok) {
                const data = await res.json();
                // Ajusta 'OnHand' o 'Stock' según tu JSON real
                newStocks[code] = Number(data.OnHand || data.Stock || 0);
            } else {
                newStocks[code] = -1; // Error
            }
        } catch (e) {
            newStocks[code] = -1;
        }
        // Actualizamos progresivamente para efecto visual
        setStockMap(prev => ({ ...prev, ...newStocks }));
    }
    setCheckingStock(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in">
        
        {/* HEADER */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
            <div>
                <h3 className="font-bold text-xl flex items-center gap-2">
                    <PackageSearch className="w-6 h-6 text-yellow-400"/> Monitor de Faltantes
                </h3>
                <p className="text-xs text-slate-400">Vista consolidada de repuestos requeridos para rearmar</p>
            </div>
            <button onClick={onClose}><X className="w-6 h-6 hover:text-red-400"/></button>
        </div>

        {/* CONTENIDO TABLA */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 w-24">ID Herr.</th>
                            <th className="p-4 w-32">Modelo</th>
                            <th className="p-4 w-32">Cód. Repuesto</th>
                            <th className="p-4">Descripción</th>
                            <th className="p-4 text-center w-20">Cant.</th>
                            <th className="p-4 text-center w-32 bg-yellow-50 text-yellow-800 border-l border-yellow-100">Stock BOD01</th>
                            <th className="p-4 text-center w-32">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={7} className="p-10 text-center text-slate-400">Cargando datos...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={7} className="p-10 text-center text-slate-400">¡Todo al día! No hay repuestos pendientes.</td></tr>
                        ) : (
                            items.map((item, idx) => {
                                const stock = stockMap[item.codigo];
                                const hasStock = stock !== null && stock >= item.cantidad;
                                const isChecking = stock === undefined;

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-500">#{item.toolId}</td>
                                        <td className="p-4 font-black text-slate-800">{item.modelo}</td>
                                        <td className="p-4 font-mono font-bold text-blue-600">{item.codigo}</td>
                                        <td className="p-4 text-slate-600 truncate max-w-xs">{item.descripcion}</td>
                                        <td className="p-4 text-center font-bold">{item.cantidad}</td>
                                        
                                        {/* COLUMNA STOCK EN VIVO */}
                                        <td className={`p-4 text-center font-bold border-l border-slate-100 ${
                                            isChecking ? 'text-slate-400' : 
                                            stock === -1 ? 'text-slate-300' :
                                            hasStock ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
                                        }`}>
                                            {isChecking ? <RefreshCw className="w-4 h-4 animate-spin mx-auto"/> : 
                                             stock === -1 ? 'Err' : stock}
                                        </td>

                                        {/* COLUMNA ESTADO (SEMÁFORO) */}
                                        <td className="p-4 text-center">
                                            {isChecking ? (
                                                <span className="text-xs text-slate-400">Consultando...</span>
                                            ) : hasStock ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                                                    <CheckCircle2 className="w-3 h-3"/> Disponible
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
                                                    <AlertCircle className="w-3 h-3"/> Faltante
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white p-4 border-t flex justify-between items-center">
             <div className="text-xs text-slate-500 flex gap-4">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-full"></div> Listo para armar</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded-full"></div> Sin stock suficiente</span>
             </div>
             <div className="flex gap-2">
                <button 
                    onClick={() => checkBulkStock(items)} 
                    disabled={checkingStock}
                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg flex items-center gap-2 border border-slate-200"
                >
                    <RefreshCw className={`w-4 h-4 ${checkingStock ? 'animate-spin' : ''}`}/> Actualizar Stock
                </button>
             </div>
        </div>

      </div>
    </div>
  );
}