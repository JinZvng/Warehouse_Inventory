"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save, ArrowRightCircle, Loader2 } from 'lucide-react';
import { Herramienta } from '@/types';

interface CreateToolModalProps {
  onClose: () => void;
  onToolAdded: () => void;
  // Nueva función opcional para abrir el despiece directo
  onToolCreatedAndOpen?: (tool: Herramienta) => void;
}

export default function CreateToolModal({ onClose, onToolAdded, onToolCreatedAndOpen }: CreateToolModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    modelo: '',
    serie: '',
    pallet: '',
    estado: 'En desarme' // Por defecto para lo que necesitas
  });

  // Función genérica de guardado
  const saveToDb = async () => {
    if (!formData.modelo || !formData.serie) {
      alert("Faltan datos obligatorios");
      return null;
    }

    setLoading(true);

    // 1. Verificamos si ya existe la serie
    const { data: existing } = await supabase
        .from('herramientas')
        .select('id')
        .eq('serie', formData.serie.toUpperCase())
        .single();
    
    if (existing) {
        alert("⚠️ Esta serie ya existe en el sistema.");
        setLoading(false);
        return null;
    }

    // 2. Insertamos (Convertimos a mayúsculas para mantener orden)
    const { data, error } = await supabase
      .from('herramientas')
      .insert([{
        modelo: formData.modelo.toUpperCase(),
        serie: formData.serie.toUpperCase(),
        pallet: formData.pallet || 'BODEGA',
        estado: formData.estado
      }])
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
      return null;
    }
    
    return data as Herramienta;
  };

  // Botón "Guardar y Cerrar" (Flujo normal)
  const handleSaveNormal = async () => {
    const newTool = await saveToDb();
    if (newTool) {
        onToolAdded();
        onClose();
    }
  };

  // Botón "Guardar e ir al Despiece" (Flujo rápido)
  const handleSaveAndOpen = async () => {
    const newTool = await saveToDb();
    if (newTool && onToolCreatedAndOpen) {
        onToolAdded(); // Refresca la lista de fondo
        onToolCreatedAndOpen(newTool); // Abre el modal de detalle inmediatamente
        onClose(); // Cierra este modal de creación
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">
            <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-1">Nueva Herramienta</h2>
        <p className="text-sm text-slate-500 mb-6">Ingreso manual de equipo</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Modelo</label>
            <input 
              type="text" 
              placeholder="Ej: DGA454"
              className="w-full p-2 border rounded-lg uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.modelo}
              onChange={e => setFormData({...formData, modelo: e.target.value})}
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Serie (S/N)</label>
            <input 
              type="text" 
              placeholder="Ej: 12345Y"
              className="w-full p-2 border rounded-lg uppercase font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.serie}
              onChange={e => setFormData({...formData, serie: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Ubicación</label>
                <input 
                type="text" 
                placeholder="Ej: A-10"
                className="w-full p-2 border rounded-lg"
                value={formData.pallet}
                onChange={e => setFormData({...formData, pallet: e.target.value})}
                />
            </div>
            
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Estado</label>
                <select 
                    className="w-full p-2 border rounded-lg bg-white"
                    value={formData.estado}
                    onChange={e => setFormData({...formData, estado: e.target.value})}
                >
                    <option value="En desarme">En desarme</option>
                    <option value="Rearmando">Rearmando</option>
                    <option value="Rearmadas">Rearmadas</option>
                    <option value="En mantención">En mantención</option>
                </select>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            {/* OPCIÓN 1: GUARDAR Y GENERAR TICKET (DESTACADO) */}
            <button 
                onClick={handleSaveAndOpen} 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <ArrowRightCircle className="w-5 h-5" />}
                Guardar e ir a Despiece
            </button>

            {/* OPCIÓN 2: GUARDAR NORMAL (SECUNDARIO) */}
            <button 
                onClick={handleSaveNormal} 
                disabled={loading} 
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
                <Save className="w-4 h-4" />
                Solo Guardar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}