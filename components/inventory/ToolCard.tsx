"use client";
import { useState } from 'react';
import { Herramienta } from '@/types';
import { Wrench, Box, Activity, Printer, AlertTriangle } from 'lucide-react';
// import Link from 'next/link'; // Ya no es necesario si usamos window.open, pero puedes dejarlo si prefieres Link

interface ToolCardProps {
  tool: Herramienta;
  onClick: (tool: Herramienta) => void;
}

export default function ToolCard({ tool, onClick }: ToolCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const hasConflict = tool.tiene_conflicto && tool.estado === 'Desarmado';
  const imageUrl = `https://mbrconnect.makita.com.br/img/${tool.modelo}.png`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Rearmando': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'En desarme': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Rearmadas': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'En mantención': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div 
      onClick={() => onClick(tool)}
      className={`
        group relative flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-sm transition-all cursor-pointer
        ${hasConflict 
            ? 'border-2 border-orange-400 ring-4 ring-orange-100 shadow-md' 
            : 'border border-slate-200 hover:shadow-lg hover:border-blue-400' 
        }
      `}
    >
      {/* --- ETIQUETA DE ALERTA --- */}
      {hasConflict && (
         <div className="absolute top-0 left-0 z-20 bg-orange-500 text-white px-3 py-1 text-[10px] font-bold rounded-br-xl shadow-md flex items-center gap-1 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-white"/> INCIDENCIA REPORTADA
         </div>
      )}

      {/* --- ZONA DE IMAGEN --- */}
      <div className="relative h-48 bg-white border-b border-slate-100 p-4 flex items-center justify-center group-hover:bg-slate-50 transition-colors">
        
        {/* Etiqueta de Estado */}
        <span className={`absolute top-3 right-3 z-10 text-[10px] font-bold px-2 py-1 rounded-full border shadow-sm ${getStatusColor(tool.estado)}`}>
          {tool.estado}
        </span>

        {/* --- NUEVO BOTÓN FLOTANTE DE IMPRESIÓN --- */}
        <button
            onClick={(e) => {
                e.stopPropagation(); // Evita abrir el detalle
                window.open(`/etiqueta/${tool.id}`, '_blank');
            }}
            className="absolute top-3 left-3 z-20 p-2 bg-white/90 hover:bg-black hover:text-white text-slate-400 rounded-lg shadow-sm border border-slate-200 transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
            title="Imprimir Etiqueta QR"
        >
            <Printer className="w-4 h-4" />
        </button>
        {/* ----------------------------------------- */}

        {/* Imagen */}
        {!imageError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={imageUrl} 
            alt={tool.modelo}
            className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-300">
             <Wrench className="w-16 h-16 mb-2 opacity-20" />
             <span className="text-xs font-medium">Sin imagen</span>
          </div>
        )}
      </div>
      
      {/* --- ZONA DE DETALLES --- */}
      <div className={`p-5 flex flex-col flex-1 ${hasConflict ? 'bg-orange-50/30' : ''}`}>
        <div className="flex justify-between items-start mb-2">
           <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modelo</span>
              <h3 className="text-xl font-black text-slate-800 leading-tight">{tool.modelo}</h3>
           </div>
           <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">ID</span>
              <span className="text-lg font-mono font-bold text-slate-600">#{tool.id_corto}</span>
           </div>
        </div>
        
        <div className="space-y-2 mt-2 flex-1">
          <div className="flex items-center text-sm text-slate-600 bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
            <Activity className="w-4 h-4 mr-2 text-slate-400" />
            <span className="font-mono text-xs">{tool.serie}</span>
          </div>
          <div className="flex items-center text-sm text-slate-600 bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
            <Box className="w-4 h-4 mr-2 text-slate-400" />
            <span className="text-xs font-bold">Ubicación: <span className="text-slate-800">{tool.pallet}</span></span>
          </div>
        </div>

        {/* Footer simple */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="text-xs text-slate-400">Servicio Técnico</span>
            {/* Si prefieres dejar el botón abajo también, descomenta esto: */}
            {/* <Printer className="w-4 h-4 text-slate-300" /> */}
        </div>
      </div>
    </div>
  );
}