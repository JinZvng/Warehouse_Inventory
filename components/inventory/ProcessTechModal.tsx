/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, ArrowDownCircle, Loader2 } from 'lucide-react';

interface ProcessTechModalProps {
  request: any; 
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProcessTechModal({ request, onClose, onSuccess }: ProcessTechModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    serie: '',
    pallet: '',
  });

  const handleSave = async () => {
    if (!formData.serie || !formData.pallet) return alert("Debes ingresar Serie y Ubicación");
    setLoading(true);

    try {
        // 1. BUSCAR EL ÚLTIMO ID USADO PARA SER CORRELATIVO
        const { data: maxTool } = await supabase
            .from('herramientas')
            .select('id_corto')
            .order('id_corto', { ascending: false })
            .limit(1)
            .single();
        
        // Si no hay herramientas, empezamos en el 1. Si hay, sumamos 1.
        const nextId = (maxTool?.id_corto || 0) + 1;

        // 2. Crear la herramienta REAL con el ID secuencial
        const { error: insertError } = await supabase.from('herramientas').insert([{
            modelo: request.modelo,
            serie: formData.serie.toUpperCase(),
            pallet: formData.pallet,
            estado: 'En desarme',
            id_corto: nextId // <--- AQUI ESTÁ EL CAMBIO (Antes era Random)
        }]);

        if (insertError) throw insertError;

        // 3. Descontar del contador SAP
        const { error: updateError } = await supabase
            .from('solicitudes_sap')
            .update({ cantidad_procesada: request.cantidad_procesada + 1 })
            .eq('id', request.id);

        if (updateError) console.error("Error actualizando contador", updateError);

        onSuccess();
        onClose();

    } catch (error: any) {
        alert("Error: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><X className="w-6 h-6"/></button>
        
        <div className="text-center mb-6">
            <div className="inline-flex justify-center items-center w-12 h-12 bg-blue-100 rounded-full text-blue-600 mb-3">
                <ArrowDownCircle className="w-6 h-6"/>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Ingreso Físico</h2>
            <p className="text-sm text-slate-500">Procesando solicitud <span className="font-mono font-bold text-slate-700">{request.nro_sap}</span></p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase">Estás ingresando un</p>
            <p className="text-3xl font-black text-slate-800">{request.modelo}</p>
            <p className="text-xs text-slate-500 mt-1">Pendientes: <b className="text-orange-600">{request.cantidad_total - request.cantidad_procesada}</b></p>
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">1. ¿Qué Serie tiene?</label>
                <input type="text" placeholder="Mira la placa (Ej: 12345Y)" className="w-full p-3 border-2 border-blue-100 rounded-xl font-mono text-lg focus:border-blue-500 outline-none uppercase"
                    value={formData.serie} onChange={e => setFormData({...formData, serie: e.target.value})} autoFocus />
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">2. ¿Dónde la dejarás?</label>
                <input type="text" placeholder="Ej: Mesa 2, A-15" className="w-full p-3 border rounded-xl"
                    value={formData.pallet} onChange={e => setFormData({...formData, pallet: e.target.value})} />
            </div>

            <button onClick={handleSave} disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg mt-4 flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar Ingreso'}
            </button>
        </div>
      </div>
    </div>
  );
}