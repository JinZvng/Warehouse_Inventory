/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Truck, Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmArrivalModalProps {
  request: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfirmArrivalModal({ request, onClose, onSuccess }: ConfirmArrivalModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);

    try {
        // LÓGICA HÍBRIDA: ¿Es una herramienta existente (ST02) o nueva (BOD01)?
        
        if (request.tool_id_origen) {
            // === CASO A: HERRAMIENTA EXISTENTE (UPDATE) ===
            // Actualizamos la herramienta existente para que vuelva al ciclo "En desarme"
            const { error: updateToolError } = await supabase
                .from('herramientas')
                .update({
                    estado: 'En desarme', // La "resucitamos" xd
                    pallet: request.ubicacion || 'RECEPCIÓN ST02', // Nueva ubicación
                    solicitud_sap_id: request.id, // Vinculamos la nueva solicitud
                    repuesto_objetivo: request.codigo_objetivo,
                    descripcion_objetivo: request.desc_objetivo,
                    solicitante: request.solicitante
                    // NOTA: No tocamos modelo ni serie, porque ya existen y son los mismos
                })
                .eq('id_corto', request.tool_id_origen); // Buscamos por el ID visual (#)

            if (updateToolError) throw new Error("Error al actualizar herramienta existente: " + updateToolError.message);

        } else {
            // === CASO B: HERRAMIENTA NUEVA (INSERT) ===
            // 1. Buscamos el último ID para el correlativo
            const { data: maxTool } = await supabase
                .from('herramientas')
                .select('id_corto')
                .order('id_corto', { ascending: false })
                .limit(1)
                .single();
            
            const nextId = (maxTool?.id_corto || 0) + 1;

            // 2. Creamos la herramienta nueva
            const { error: insertError } = await supabase.from('herramientas').insert([{
                modelo: request.modelo,
                serie: `PENDIENTE-${nextId}`, // Serie temporal
                pallet: 'RECEPCIÓN',
                estado: 'En desarme',
                id_corto: nextId,
                solicitud_sap_id: request.id,
                repuesto_objetivo: request.codigo_objetivo,
                descripcion_objetivo: request.desc_objetivo,
                solicitante: request.solicitante
            }]);

            if (insertError) throw insertError;
        }

        // 3. Común: Actualizamos el contador del SAP para cerrarlo
        const { error: updateError } = await supabase
            .from('solicitudes_sap')
            .update({ cantidad_procesada: request.cantidad_procesada + 1 })
            .eq('id', request.id);

        if (updateError) console.error("Error contador", updateError);

        onSuccess();
        onClose();

    } catch (error: any) {
        alert("Error: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const isExisting = !!request.tool_id_origen;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm p-6 rounded-2xl shadow-2xl relative animate-in fade-in zoom-in">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-red-500"><X className="w-5 h-5"/></button>
        
        <div className="text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isExisting ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                <Truck className="w-8 h-8"/>
            </div>
            
            <h2 className="text-lg font-bold text-slate-800">
                {isExisting ? 'Reingreso Taller' : 'Confirmar Llegada'}
            </h2>
            
            {isExisting ? (
                 <div className="bg-blue-50 border border-blue-200 text-blue-800 p-2 rounded-lg text-xs font-bold mt-2 mb-2">
                    Esta herramienta YA EXISTE (ID #{request.tool_id_origen}).<br/>
                    Se actualizará su estado a "En Desarme".
                 </div>
            ) : (
                <p className="text-sm text-slate-500 mt-1">
                    Ingresando equipo nuevo: <b className="text-slate-800">{request.modelo}</b>
                </p>
            )}
            
            <div className="mt-4 bg-slate-50 p-3 rounded-lg text-left text-xs text-slate-500 border border-slate-200">
                <p><strong>Info para el Técnico:</strong></p>
                <div className="max-h-20 overflow-y-auto mt-1">
                    <p className="whitespace-pre-wrap">{request.desc_objetivo || 'Sin descripción'}</p>
                </div>
            </div>

            <button 
                onClick={handleConfirm} 
                disabled={loading} 
                className={`w-full mt-6 py-3 font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 text-white ${isExisting ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
                {loading ? <Loader2 className="animate-spin w-5 h-5"/> : (isExisting ? 'Actualizar Herramienta' : 'Crear Herramienta')}
            </button>
        </div>
      </div>
    </div>
  );
}