/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Scanner } from '@yudiel/react-qr-scanner';
import { X, Zap } from 'lucide-react';
import { useState } from 'react';

interface QRScannerModalProps {
  onClose: () => void;
  onScan: (id: string) => void;
}

export default function QRScannerModal({ onClose, onScan }: QRScannerModalProps) {
  const [error, setError] = useState<string>('');

  const handleScan = (result: any) => {
    if (result) {
      // El result suele venir como un array de objetos. Tomamos el rawValue.
      // El QR trae algo como: "https://misitio.com/?qr_open=501"
      // O simplemente texto si hiciste un QR simple.
      const rawValue = result[0]?.rawValue;

      if (rawValue) {
        try {
          // Intentamos extraer el ID del parámetro qr_open
          const url = new URL(rawValue);
          const id = url.searchParams.get('qr_open');
          
          if (id) {
             onScan(id); // ¡Éxito! Encontramos el ID 501
          } else {
             setError("QR no válido: No contiene ID de herramienta");
          }
        } catch (e) {
          // Si no es una URL, quizás es el ID directo?
          // Asumimos que si falla el parseo URL, el texto raw es el ID (por si acaso)
          onScan(rawValue);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      
      {/* Botón Cerrar */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-20 bg-white/20 p-3 rounded-full text-white backdrop-blur-md hover:bg-white/40 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="w-full max-w-md relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 mx-4">
          
          {/* Título decorativo */}
          <div className="absolute top-4 left-0 right-0 z-10 text-center">
              <span className="bg-black/50 text-white px-4 py-1 rounded-full text-xs font-bold backdrop-blur-sm border border-white/10">
                  Apunta al código QR
              </span>
          </div>

          {/* EL ESCÁNER */}
          <div className="aspect-square bg-black">
              <Scanner 
                  onScan={handleScan}
                  onError={(err) => setError("Error de cámara: " + (err instanceof Error ? err.message : String(err)))}
                  components={{
                      finder: true, // Muestra el cuadradito de enfoque
                  }}
                  styles={{
                      container: { width: '100%', height: '100%' }
                  }}
              />
          </div>

          {/* Mensajes de Estado */}
          <div className="bg-slate-900 p-6 text-center">
             {!error ? (
                 <p className="text-slate-400 text-sm animate-pulse flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400"/> Buscando herramienta...
                 </p>
             ) : (
                 <p className="text-red-400 text-sm font-bold">{error}</p>
             )}
          </div>
      </div>
    </div>
  );
}