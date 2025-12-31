/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, History, User, Calendar, Tag, ArrowUpRight, AlertTriangle } from 'lucide-react';

interface ToolHistoryModalProps {
  tool: Herramienta;
  onClose: () => void;
}

export default function ToolHistoryModal({ tool, onClose }: ToolHistoryModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
        // Obtenemos historial unificado (Movimientos + Incidentes)
        // 1. Movimientos Generales
        const { data: movs } = await supabase
            .from('historial_movimientos')
            .select('*')
            .eq('herramienta_id', tool.id);

        // 2. Incidentes reportados
        const { data: incs } = await supabase
            .from('reportes_incidentes')
            .select('*')
            .eq('herramienta_id', tool.id);

        // Normalizamos para mostrar en una lista
        const normalizedMovs = (movs || []).map(m => ({
            id: `mov-${m.id}`,
            tipo: 'MOVIMIENTO',
            accion: m.tipo_accion,
            desc: m.descripcion,
            user: m.usuario || 'Sistema',
            fecha: new Date(m.created_at)
        }));

        const normalizedIncs = (incs || []).map(i => ({
            id: `inc-${i.id}`,
            tipo: 'INCIDENTE',
            accion: 'REPORTE FALLA',
            desc: `Faltante: ${i.cantidad}x ${i.codigo_repuesto} (${i.descripcion_repuesto})`,
            user: 'Técnico',
            fecha: new Date(i.created_at)
        }));

        const all = [...normalizedMovs, ...normalizedIncs].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
        
        setLogs(all);
        setLoading(false);
    };
    fetchLogs();
  }, [tool]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
        
        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg flex items-center gap-2"><History className="w-5 h-5 text-blue-600"/> Bitácora de Vida</h3>
                <p className="text-xs text-slate-500">Historial completo del equipo <b>{tool.modelo} #{tool.id_corto}</b></p>
            </div>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            {loading ? (
                <p className="text-center text-slate-400 mt-10">Cargando historia...</p>
            ) : logs.length === 0 ? (
                <div className="text-center text-slate-400 mt-10">
                    <Tag className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                    <p>No hay registros históricos para este equipo aún.</p>
                </div>
            ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {logs.map((log) => (
                        <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            
                            {/* PUNTO EN LA LÍNEA DE TIEMPO */}
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-hover:bg-blue-500 transition-colors shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                {log.tipo === 'INCIDENTE' ? <AlertTriangle className="w-5 h-5 text-white"/> : <ArrowUpRight className="w-5 h-5 text-white"/>}
                            </div>
                            
                            {/* TARJETA DE INFORMACIÓN */}
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 shadow-sm bg-white">
                                <div className="flex items-center justify-between space-x-2 mb-1">
                                    <span className={`font-bold text-xs px-2 py-0.5 rounded border ${log.tipo === 'INCIDENTE' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        {log.accion}
                                    </span>
                                    <span className="text-xs font-mono text-slate-400">{log.fecha.toLocaleDateString()} {log.fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-2">{log.desc}</p>
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <User className="w-3 h-3"/> {log.user}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}