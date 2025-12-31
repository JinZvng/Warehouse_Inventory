/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
import { X, CheckCircle2, Loader2, Wrench, AlertTriangle, ArrowLeft, Search, Plus, Trash2, ListPlus } from 'lucide-react';

interface FinishReassemblyModalProps {
  tool: Herramienta;
  onClose: () => void;
  onSuccess: () => void;
}

interface MissingItem {
    code: string;
    desc: string;
    qty: number;
}

export default function FinishReassemblyModal({ tool, onClose, onSuccess }: FinishReassemblyModalProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'confirm' | 'report'>('confirm'); 

  // Estados del "Carrito" de Faltantes
  const [missingList, setMissingList] = useState<MissingItem[]>([]);
  
  // Estados temporales para el input actual
  const [tempCode, setTempCode] = useState('');
  const [tempDesc, setTempDesc] = useState('');
  const [tempQty, setTempQty] = useState(1);
  const [searching, setSearching] = useState(false);

  // 1. CONFIRMAR ÉXITO (Flujo normal)
  const handleConfirmSuccess = async () => {
    setLoading(true);
    try {
        // A) Actualizar el estado de la herramienta
        const { error } = await supabase
            .from('herramientas')
            .update({ 
                estado: 'Rearmadas',
                tiene_conflicto: false 
            })
            .eq('id', tool.id);

        if (error) throw error;

        // --- B) INSERTAR LOG EN LA BITÁCORA (AQUÍ VA EL CÓDIGO NUEVO) ---
        await supabase.from('historial_movimientos').insert({
            herramienta_id: tool.id,
            tipo_accion: 'REARME',
            usuario: 'Técnico', // Podrías poner el nombre real si lo tuvieras
            descripcion: 'Equipo rearmado exitosamente y devuelto a stock disponible.'
        });
        // ----------------------------------------------------------------

        onSuccess();
        onClose();
    } catch (e: any) { alert('Error: ' + e.message); } 
    finally { setLoading(false); }
  };

  // 2. BUSCAR DESCRIPCIÓN
  const fetchDescription = async () => {
      if (!tempCode) return;
      setSearching(true);
      setTempDesc('Buscando...'); 

      try {
          const res = await fetch(`/api/sap-proxy?code=${encodeURIComponent(tempCode)}`);
          if (res.ok) {
              const data = await res.json();
              const item = Array.isArray(data) ? data[0] : data;
              const name = item?.ItemName || item?.ItemDescription || item?.Descripcion || null;
              if (name) setTempDesc(name);
              else setTempDesc('Descripción no encontrada en SAP');
          } else {
              setTempDesc('Código no existe en SAP');
          }
      } catch (e) {
          setTempDesc('Error de conexión');
      } finally {
          setSearching(false);
      }
  };

  // 3. AGREGAR A LA LISTA TEMPORAL
  const addItemToList = () => {
      if (!tempCode || !tempDesc) return;
      
      // Agregamos a la lista
      setMissingList(prev => [...prev, { code: tempCode.toUpperCase(), desc: tempDesc, qty: tempQty }]);
      
      // Limpiamos inputs para el siguiente
      setTempCode('');
      setTempDesc('');
      setTempQty(1);
  };

  // 4. ELIMINAR DE LA LISTA
  const removeItem = (index: number) => {
      setMissingList(prev => prev.filter((_, i) => i !== index));
  };

  // 5. GUARDAR TODO (REPORTAR INCIDENTE MASIVO)
  const handleReportIssue = async () => {
      if (missingList.length === 0) return alert("La lista de faltantes está vacía.");

      setLoading(true);
      try {
          // A) Preparamos los datos para inserción masiva
          const recordsToInsert = missingList.map(item => ({
              herramienta_id: tool.id,
              codigo_repuesto: item.code,
              descripcion_repuesto: item.desc,
              cantidad: item.qty,
              comentario: 'Faltante declarado en proceso de rearme'
          }));

          // B) Insertamos en la tabla de incidentes
          const { error: logError } = await supabase.from('reportes_incidentes').insert(recordsToInsert);
          if (logError) throw logError;

          // C) Marcamos la herramienta con conflicto
          const { error: toolError } = await supabase
              .from('herramientas')
              .update({ 
                  estado: 'Desarmado', 
                  tiene_conflicto: true 
              })
              .eq('id', tool.id);

          if (toolError) throw toolError;

          alert(`⚠️ Se reportaron ${missingList.length} ítems faltantes.\nEl equipo vuelve a estado 'Desarmado'.`);
          onSuccess();
          onClose();

      } catch (e: any) { alert('Error: ' + e.message); } 
      finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 transition-all">
        
        {/* HEADER */}
        <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${mode === 'report' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {mode === 'report' ? <AlertTriangle className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        {mode === 'report' ? 'Reportar Faltantes' : 'Finalizar Rearme'}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {mode === 'report' ? 'Declaración múltiple' : 'Confirmación de término'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X/></button>
        </div>

        {/* INFO EQUIPO */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-6 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-slate-700">{tool.modelo}</h3>
                <p className="font-mono text-xs text-slate-500">ID #{tool.id_corto}</p>
            </div>
            <div className="text-right text-xs text-slate-400">SN: {tool.serie}</div>
        </div>

        {/* --- MODO NORMAL --- */}
        {mode === 'confirm' && (
            <div className="animate-in fade-in slide-in-from-right-4">
                <p className="text-slate-600 mb-8 text-sm leading-relaxed">
                    ¿Confirmas que el técnico ha terminado de rearmar este equipo y está listo para volver a estar <b>Disponible</b>?
                </p>
                <div className="space-y-3">
                    <button onClick={handleConfirmSuccess} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>} Todo Correcto
                    </button>
                    <button onClick={() => setMode('report')} className="w-full py-3 text-orange-600 font-bold hover:bg-orange-50 rounded-xl flex items-center justify-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4"/> Faltaron repuestos
                    </button>
                </div>
            </div>
        )}

        {/* --- MODO REPORTE (CARRITO) --- */}
        {mode === 'report' && (
            <div className="animate-in fade-in slide-in-from-left-4">
                
                {/* FORMULARIO DE AGREGAR */}
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                    <div className="grid grid-cols-4 gap-3 mb-3">
                        <div className="col-span-3">
                            <label className="text-[10px] font-bold text-orange-800 uppercase">Código</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    className="w-full border border-orange-200 rounded-lg p-2 pl-2 pr-8 text-sm uppercase font-mono outline-none focus:ring-2 focus:ring-orange-400"
                                    placeholder="Ej: 629B61-9"
                                    value={tempCode}
                                    onChange={e => setTempCode(e.target.value)}
                                    onBlur={fetchDescription}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchDescription()}
                                />
                                {searching && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 text-orange-400 animate-spin"/>}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-orange-800 uppercase">Cant.</label>
                            <input 
                                type="number" 
                                min="1"
                                className="w-full border border-orange-200 rounded-lg p-2 text-sm text-center outline-none focus:ring-2 focus:ring-orange-400"
                                value={tempQty}
                                onChange={e => setTempQty(Number(e.target.value))}
                            />
                        </div>
                    </div>
                    
                    <div className="mb-3">
                        <input type="text" className="w-full bg-orange-100/50 border-none rounded text-xs text-orange-800 p-2 italic" value={tempDesc} readOnly placeholder="Descripción automática..." />
                    </div>

                    <button 
                        onClick={addItemToList}
                        disabled={!tempCode || !tempDesc || searching}
                        className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        <Plus className="w-4 h-4"/> Agregar a la Lista
                    </button>
                </div>

                {/* LISTA DE FALTANTES */}
                <div className="mb-6 max-h-40 overflow-y-auto border rounded-xl bg-white shadow-inner">
                    {missingList.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center">
                            <ListPlus className="w-8 h-8 mb-2 opacity-30"/>
                            Agrega los repuestos faltantes aquí.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-bold sticky top-0">
                                <tr>
                                    <th className="p-2 pl-3">Código</th>
                                    <th className="p-2">Desc.</th>
                                    <th className="p-2 text-center">Cant.</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {missingList.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 pl-3 font-mono font-bold text-slate-700">{item.code}</td>
                                        <td className="p-2 text-xs text-slate-500 truncate max-w-30">{item.desc}</td>
                                        <td className="p-2 text-center font-bold">{item.qty}</td>
                                        <td className="p-2 text-right">
                                            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded">
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* BOTONES FINALES */}
                <div className="flex gap-3">
                    <button onClick={() => setMode('confirm')} className="px-4 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">
                        <ArrowLeft className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={handleReportIssue} 
                        disabled={loading || missingList.length === 0} 
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <AlertTriangle className="w-5 h-5"/>}
                        Devolver a Bodega ({missingList.length})
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}