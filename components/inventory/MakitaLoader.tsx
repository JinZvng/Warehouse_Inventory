"use client";
import { useEffect, useState } from "react";
// 1. CAMBIAMOS EL IMPORT (Ahora usamos localFont)
import localFont from 'next/font/local';

// 2. CARGAMOS TU ARCHIVO DE DAFONT
// Ajusta la ruta './fonts/...' según donde pegaste el archivo.
// Si el archivo está en app/fonts y este componente en app/components,
// la ruta sería '../fonts/MakitaFont.ttf'
const myCustomFont = localFont({
  src: '../../app/fonts/MakitaFont.otf', // <--- ¡VERIFICA ESTA RUTA!
  display: 'swap',
});

interface MakitaLoaderProps {
  onFinish: () => void;
}

export default function MakitaLoader({ onFinish }: MakitaLoaderProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => onFinish(), 500);
    }, 3000); 

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="relative w-72 h-32 md:w-96 md:h-40">
        <svg viewBox="0 0 400 120" className="w-full h-full">
          <text 
            x="50%" 
            y="55%" 
            dy=".35em" 
            textAnchor="middle"
            className="makita-text"
            // 3. APLICAMOS TU FUENTE LOCAL AQUÍ
            style={{ 
              fontFamily: myCustomFont.style.fontFamily, // Next.js se encarga del nombre
              fontSize: '85px',    
              letterSpacing: '-3px' 
            }}
          >
            Makita
          </text>
        </svg>
      </div>
      
      {/* También aplicamos la fuente al texto de abajo para que combine */}
      <div className="mt-4 text-slate-400 text-sm font-bold tracking-widest uppercase animate-pulse font-sans">
        Cargando Sistema...
      </div>

      <style jsx>{`
        .makita-text {
          fill: transparent;
          stroke: #D30000; 
          stroke-width: 3px;
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: draw 2.2s ease-in-out forwards, fillIn 0.6s 2.2s forwards;
        }

        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }

        @keyframes fillIn {
          to {
            fill: #D30000;
            stroke: transparent;
          }
        }
      `}</style>
    </div>
  );
}