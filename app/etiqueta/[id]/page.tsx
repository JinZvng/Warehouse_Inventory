"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import QRCode from "react-qr-code"; //

export default function EtiquetaPage() {
  const { id } = useParams();
  const [tool, setTool] = useState<Herramienta | null>(null);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchTool = async () => {
      const { data } = await supabase.from('herramientas').select('*').eq('id', id).single();
      if (data) {
          setTool(data as Herramienta);
          // Generamos la URL dinámicamente basada en donde esté alojada la web
          // Apunta a la página de inventario con el gatillo "?qr_open="
          if (typeof window !== 'undefined') {
              setQrUrl(`${window.location.origin}/?qr_open=${data.id_corto}`);
          }
      }
    };
    fetchTool();
  }, [id]);

  if (!tool) return <div className="p-10 text-xs">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center print:bg-white print:block print:h-auto print:w-auto print:m-0">
      
      <button 
        onClick={() => window.print()}
        className="mb-10 bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-gray-800 print:hidden"
      >
        <Printer size={20} /> Imprimir
      </button>

      {/* --- ETIQUETA 50x50mm --- */}
      <div className="etiqueta-box bg-white text-black border border-gray-300 relative flex flex-col overflow-hidden print:border-none">
        
        {/* 1. Cabecera: ID y Pallet */}
        <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-1 shrink-0">
          <div className="leading-none">
            <span className="text-[10px] font-bold block">ID</span>
            <span className="text-2xl font-black">#{tool.id_corto}</span>
          </div>
          <div className="text-right">
             <div className="text-black px-1 text-[8px] font-bold uppercase mb-0.5">PALLET</div>
             <div className="font-mono font-bold text-sm text-center border border-black min-w-7.5">{tool.pallet}</div>
          </div>
        </div>

        {/* 2. Cuerpo: Dividido en Datos y QR */}
        <div className="flex flex-1 items-center gap-1">
            
            {/* Izquierda: Info Modelo */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="text-[8px] uppercase font-bold text-black-600 block leading-tight">Modelo</span>
                <span className="text-lg font-black block leading-none wrap-break-word mb-1">{tool.modelo}</span>
                
                <span className="text-[10px] uppercase font-bold text-black-600 block leading-tight">Serie</span>
                <span className="block text-[11px] text-black font-bold font-mono leading-none truncate">{tool.serie}</span>
            </div>

            {/* Derecha: QR Code */}
            <div className="shrink-0 w-[15mm] h-[20mm] bg-white flex items-center justify-center">
                {qrUrl && (
                    <QRCode 
                        value={qrUrl}
                        size={256}
                        style={{ height: "auto", maxWidth: "75%", width: "75%" }}
                        viewBox={`0 0 256 256`}
                    />
                )}
            </div>
        </div>

        {/* 3. Footer */}
        <div className="mt-1 pt-1 border-t border-black text-center shrink-0">
          <span className="block text-[8px] font-bold font-mono leading-none tracking-tighter">SERVICIO TÉCNICO Y POSTVENTA - ST02</span>
        </div>

      </div>

      <style jsx global>{`
        .etiqueta-box {
          width: 50mm;
          height: 50mm;
          padding: 2mm;
          box-sizing: border-box; /* Importante para que el padding no aumente el tamaño */
        }

        @media print {
          @page {
            size: 50mm 50mm;
            margin: 0;
          }
          body {
            visibility: hidden;
            background: white;
          }
          .etiqueta-box {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 50mm !important;
            height: 50mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box;
          }
        }
      `}</style>
    </div>
  );
}