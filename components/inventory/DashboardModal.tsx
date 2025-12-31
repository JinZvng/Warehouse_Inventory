/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, TrendingUp, AlertTriangle, Package, CheckCircle2, BarChart3, PieChart, Activity } from 'lucide-react';

interface DashboardModalProps {
  onClose: () => void;
}

export default function DashboardModal({ onClose }: DashboardModalProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
      topIncidencias: [],
      estadoDistribucion: [],
      movimientosSemana: 0,
      totalQuiebres: 0
  });

  useEffect(() => {
    calculateStats();
  }, []);

  const calculateStats = async () => {
      setLoading(true);
      
      // 1. Cargar datos crudos
      const { data: incidentes } = await supabase.from('reportes_incidentes').select('*');
      const { data: herramientas } = await supabase.from('herramientas').select('estado');
      const { data: historial } = await supabase.from('historial_movimientos').select('created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 7 días

      // A. Top Repuestos con Falla (Pareto)
      const conteoRepuestos: Record<string, number> = {};
      incidentes?.forEach((inc: any) => {
          const codigo = inc.codigo_repuesto.trim().toUpperCase();
          conteoRepuestos[codigo] = (conteoRepuestos[codigo] || 0) + (inc.cantidad || 1);
      });

      const topIncidencias = Object.entries(conteoRepuestos)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5) // Top 5
          .map(([codigo, cantidad]) => ({ codigo, cantidad }));

      // B. Distribución de Estados
      const estados = {
          'En desarme': 0,
          'Desarmado': 0,
          'Rearmando': 0,
          'En Taller': 0
      };
      
      herramientas?.forEach((h: any) => {
          // Normalizar estados si es necesario
          const st = h.estado === 'Rearmadas' ? 'Disponible' : h.estado;
          if (estados[st as keyof typeof estados] !== undefined) {
              estados[st as keyof typeof estados]++;
          }
      });

      const totalH = herramientas?.filter((h: any) => h.estado !== 'Rearmadas').length || 1;
      const estadoDistribucion = Object.entries(estados).map(([nombre, valor]) => ({
          nombre,
          valor,
          porcentaje: Math.round((valor / totalH) * 100)
      }));

      setStats({
          topIncidencias,
          estadoDistribucion,
          movimientosSemana: historial?.length || 0,
          totalQuiebres: incidentes?.length || 0
      });
      
      setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-50 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-8">
        
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-indigo-600"/> Dashboard de Gestión
                </h2>
                <p className="text-slate-500 font-medium">Métricas clave de rendimiento en bodega</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-slate-400"/></button>
        </div>

        {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400">Calculando métricas...</div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* TARJETA 1: MOVIMIENTOS RECIENTES */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Activity className="w-6 h-6"/></div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-700">Actividad Semanal</h3>
                            <p className="text-xs text-slate-400">Movimientos últimos 7 días</p>
                        </div>
                        <div className="ml-auto text-4xl font-black text-blue-600">{stats.movimientosSemana}</div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-2/3 animate-pulse"></div>
                    </div>
                    <p className="text-xs text-center mt-2 text-slate-400">Ritmo operativo saludable</p>
                </div>

                {/* TARJETA 2: TOTAL QUIEBRES */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><AlertTriangle className="w-6 h-6"/></div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-700">Incidentes Totales</h3>
                            <p className="text-xs text-slate-400">Acumulado histórico</p>
                        </div>
                        <div className="ml-auto text-4xl font-black text-orange-500">{stats.totalQuiebres}</div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 w-full opacity-80"></div>
                    </div>
                    <p className="text-xs text-center mt-2 text-slate-400">Repuestos reportados como faltantes</p>
                </div>

                {/* GRÁFICO 1: TOP 5 QUIEBRES */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-red-500"/> Top 5 Repuestos Críticos
                    </h3>
                    <div className="space-y-4">
                        {stats.topIncidencias.map((item: any, idx: number) => (
                            <div key={idx} className="relative">
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="text-slate-600 font-mono">{item.codigo}</span>
                                    <span className="text-red-600">{item.cantidad} reportes</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-red-500 rounded-full" 
                                        style={{ width: `${(item.cantidad / (stats.topIncidencias[0]?.cantidad || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {stats.topIncidencias.length === 0 && <p className="text-center text-slate-300 py-4">Sin datos suficientes</p>}
                    </div>
                </div>

                {/* GRÁFICO 2: ESTADO DEL PARQUE */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-emerald-500"/> Distribución de Herramientas
                    </h3>
                    <div className="space-y-3">
                        {stats.estadoDistribucion.map((est: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="w-24 text-xs font-bold text-slate-500 text-right">{est.nombre}</div>
                                <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden flex items-center px-2 relative border border-slate-100">
                                    <div 
                                        className={`absolute left-0 top-0 bottom-0 opacity-20 ${
                                            est.nombre === 'Disponible' ? 'bg-emerald-500' :
                                            est.nombre === 'Desarmado' ? 'bg-slate-800' :
                                            est.nombre === 'En desarme' ? 'bg-amber-500' : 'bg-blue-500'
                                        }`} 
                                        style={{ width: `${est.porcentaje}%` }}
                                    ></div>
                                    <span className="relative z-10 text-xs font-bold text-slate-700">{est.valor} un.</span>
                                </div>
                                <div className="w-12 text-xs font-mono text-slate-400 text-right">{est.porcentaje}%</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        )}
      </div>
    </div>
  );
}