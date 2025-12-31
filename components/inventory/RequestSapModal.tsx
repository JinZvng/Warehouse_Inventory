/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save, Plus, Trash2, ClipboardList, Zap, Loader2, Package, User, MapPin, Hash, ArrowRightLeft, History, AlertTriangle } from 'lucide-react';

interface RequestSapModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface PartItem {
  code: string;
  description: string;
  client: string;
  quantity: number;
  loading?: boolean;
  error?: string; // Para mostrar error de duplicado visualmente
}

interface RequestGroup {
  modelo: string;
  cantidad: number;
  bodega: string;
  toolId?: string;
  ubicacion?: string; 
  
  // Estados de control
  lastHistory?: string; 
  takenCodes?: string[]; // Lista de códigos YA extraídos (Bloqueados)
  loadingTool?: boolean;
  parts: PartItem[];
}

export default function RequestSapModal({ onClose, onSuccess }: RequestSapModalProps) {
  const [loading, setLoading] = useState(false);
  const [nroSap, setNroSap] = useState('');
  
  const [requests, setRequests] = useState<RequestGroup[]>([
    { 
      modelo: '', 
      cantidad: 1, 
      bodega: 'BOD01', 
      toolId: '',      
      ubicacion: '',
      takenCodes: [], // Inicialmente vacío
      parts: [{ code: '', description: '', client: '', quantity: 1 }] 
    }
  ]);

  // --- BUSCADOR INTELIGENTE POR ID ---
  const fetchToolById = async (index: number) => {
    const idStr = requests[index].toolId;
    if (!idStr || requests[index].bodega !== 'ST02') return;

    const newRequests = [...requests];
    newRequests[index].loadingTool = true;
    newRequests[index].lastHistory = ''; 
    newRequests[index].modelo = ''; 
    newRequests[index].ubicacion = ''; 
    newRequests[index].takenCodes = []; // Reseteamos la lista de bloqueados
    setRequests(newRequests);

    try {
        // 1. Buscamos la herramienta (Modelo y Ubicación actual)
        const { data: toolData, error } = await supabase
            .from('herramientas')
            .select('id, modelo, pallet')
            .eq('id_corto', parseInt(idStr))
            .single();

        if (error || !toolData) {
            alert("❌ No encontré ninguna herramienta con el ID #" + idStr);
            const resetReq = [...requests];
            resetReq[index].loadingTool = false;
            setRequests(resetReq);
            return;
        }

        // 2. Buscamos TODOS los repuestos históricos para validar duplicados
        const { data: historyData } = await supabase
            .from('repuestos')
            .select('descripcion, repuesto')
            .eq('herramienta_id', toolData.id);

        // Parseamos los códigos extraídos anteriormente
        // Formato esperado en DB: "Cod: 12345 | ..."
        const extractedCodes: string[] = [];
        const historySummary: string[] = [];

        if (historyData) {
            historyData.forEach(h => {
                // Guardamos descripción para el resumen visual
                historySummary.push(h.repuesto); 

                // Intentamos extraer el código limpio para la validación
                // Buscamos el patrón "Cod: XXXXX |"
                const match = h.descripcion.match(/Cod:\s*([^|]+)/);
                if (match && match[1]) {
                    extractedCodes.push(match[1].trim());
                }
            });
        }

        // 3. Actualizamos la tarjeta
        const updatedReq = [...requests];
        updatedReq[index].modelo = toolData.modelo; 
        updatedReq[index].ubicacion = toolData.pallet; // <--- UBICACIÓN AUTOMÁTICA
        updatedReq[index].lastHistory = historySummary.slice(0, 3).join(', ') + (historySummary.length > 3 ? '...' : '');
        updatedReq[index].takenCodes = extractedCodes; // <--- LISTA NEGRA DE REPUESTOS
        updatedReq[index].loadingTool = false;
        
        setRequests(updatedReq);

    } catch (err) {
        console.error(err);
        const resetReq = [...requests];
        resetReq[index].loadingTool = false;
        setRequests(resetReq);
    }
  };

  const addRequestGroup = () => {
    setRequests([...requests, { 
      modelo: '', 
      cantidad: 1, 
      bodega: 'BOD01', 
      toolId: '',
      ubicacion: '',
      takenCodes: [],
      parts: [{ code: '', description: '', client: '', quantity: 1 }] 
    }]);
  };

  const removeRequestGroup = (index: number) => {
    if (requests.length > 1) {
        setRequests(requests.filter((_, i) => i !== index));
    }
  };

  const updateRequestField = (index: number, field: keyof RequestGroup, value: any) => {
    const newRequests = [...requests];
    // @ts-ignore
    newRequests[index][field] = value;
    
    if (field === 'bodega') {
        newRequests[index].toolId = '';
        newRequests[index].ubicacion = '';
        newRequests[index].lastHistory = '';
        newRequests[index].takenCodes = [];
        if (value === 'BOD01') newRequests[index].lastHistory = undefined;
    }
    
    setRequests(newRequests);
  };

  const addPartToRequest = (reqIndex: number) => {
    const newRequests = [...requests];
    newRequests[reqIndex].parts.push({ code: '', description: '', client: '', quantity: 1 });
    setRequests(newRequests);
  };

  const removePartFromRequest = (reqIndex: number, partIndex: number) => {
    const newRequests = [...requests];
    if (newRequests[reqIndex].parts.length > 1) {
        newRequests[reqIndex].parts = newRequests[reqIndex].parts.filter((_, i) => i !== partIndex);
        setRequests(newRequests);
    }
  };

  // --- VALIDACIÓN EN TIEMPO REAL AL ESCRIBIR ---
  const updatePartField = (reqIndex: number, partIndex: number, field: keyof PartItem, value: string) => {
    const newRequests = [...requests];
    // @ts-ignore
    newRequests[reqIndex].parts[partIndex][field] = value;

    // Si cambió el código, validamos si ya existe en la lista negra
    if (field === 'code') {
        const currentReq = newRequests[reqIndex];
        const codeToCheck = value.trim(); // Podríamos hacer .toUpperCase() si tus códigos son consistentes

        if (currentReq.bodega === 'ST02' && currentReq.takenCodes?.includes(codeToCheck)) {
            newRequests[reqIndex].parts[partIndex].error = "⛔ YA EXTRAÍDO";
        } else {
            newRequests[reqIndex].parts[partIndex].error = undefined;
        }
    }

    setRequests(newRequests);
  };

  const fetchPartDescription = async (reqIndex: number, partIndex: number) => {
    const code = requests[reqIndex].parts[partIndex].code;
    if (!code) return;

    const newRequests = [...requests];
    newRequests[reqIndex].parts[partIndex].loading = true;
    setRequests(newRequests);

    try {
        const response = await fetch(`/api/sap-proxy?code=${encodeURIComponent(code)}`);
        if (response.ok) {
            const data = await response.json();
            const desc = data.Descripcion || data.ItemName || data.descripcion || "⚠️ Sin nombre";
            const updatedRequests = [...requests];
            updatedRequests[reqIndex].parts[partIndex].description = desc;
            updatedRequests[reqIndex].parts[partIndex].loading = false;
            setRequests(updatedRequests);
        } else {
             const updatedRequests = [...requests];
             updatedRequests[reqIndex].parts[partIndex].description = "❌ No encontrado";
             updatedRequests[reqIndex].parts[partIndex].loading = false;
             setRequests(updatedRequests);
        }
    } catch (error) {
        const updatedRequests = [...requests];
        updatedRequests[reqIndex].parts[partIndex].description = "❌ Error Red";
        updatedRequests[reqIndex].parts[partIndex].loading = false;
        setRequests(updatedRequests);
    }
  };

  // --- GUARDADO ---
  const handleSave = async () => {
    if (!nroSap) return alert("Falta el N° Correlativo SAP");
    
    for (const [index, req] of requests.entries()) {
        if (!req.modelo) return alert(`Falta el Modelo en la tarjeta #${index + 1}`);
        if (req.bodega === 'ST02') {
            if (!req.toolId) return alert(`Falta ID en tarjeta #${index + 1}`);
            
            // VALIDACIÓN FINAL DE BLOQUEO
            const blockedPart = req.parts.find(p => p.error);
            if (blockedPart) {
                return alert(`⚠️ Error en tarjeta #${index + 1}: El repuesto ${blockedPart.code} ya fue extraído de esta herramienta. No puedes pedirlo de nuevo.`);
            }
        }
    }

    setLoading(true);

    const dataToInsert = requests.map(req => {
        // --- NUEVA LÓGICA DE EXPANSIÓN ---
        // Creamos un array temporal donde repetimos el item según su cantidad
        const expandedParts: PartItem[] = [];
        
        req.parts.forEach(p => {
            const qty = p.quantity || 1; // Protección por si es 0 o null
            for (let i = 0; i < qty; i++) {
                expandedParts.push(p);
            }
        });

        // Ahora usamos expandedParts en lugar de req.parts para generar los strings
        const codesString = expandedParts.map(p => p.code).join('\n');
        const descsString = expandedParts.map(p => p.description).join('\n');
        const clientsString = expandedParts.map(p => p.client || 'Anónimo').join('\n');
        // ----------------------------------

        return {
            nro_sap: nroSap,
            modelo: req.modelo.toUpperCase(),
            cantidad_total: req.cantidad, // Esta es la cantidad de la herramienta (cabecera)
            bodega_origen: req.bodega,
            tool_id_origen: req.bodega === 'ST02' && req.toolId ? parseInt(req.toolId) : null,
            ubicacion: req.ubicacion ? req.ubicacion.toUpperCase() : null,
            codigo_objetivo: codesString, 
            desc_objetivo: descsString,   
            solicitante: clientsString,   
            cantidad_procesada: 0,
            created_at: new Date().toISOString()
        };
    });

    const { error } = await supabase.from('solicitudes_sap').insert(dataToInsert);

    setLoading(false);

    if (error) {
        alert("Error: " + error.message);
    } else {
        onSuccess();
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="bg-yellow-400 p-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <div className="flex items-center gap-3 text-yellow-900">
                <div className="bg-white/50 p-2 rounded-lg"><ClipboardList className="w-6 h-6"/></div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Ingreso de Solicitud</h2>
                    <p className="text-xs font-bold opacity-80">ST02: Validación de ID y Stock Histórico</p>
                </div>
            </div>
            <button onClick={onClose} className="bg-white/20 hover:bg-white/40 p-2 rounded-full text-yellow-900"><X className="w-6 h-6"/></button>
        </div>

        {/* INPUT SAP */}
        <div className="bg-white p-4 border-b border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">N° Solicitud de Traslado (SAP)</label>
            <input 
                type="text" 
                placeholder="Ej: 45000..." 
                className="w-full max-w-xs p-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-xl focus:border-yellow-400 outline-none"
                value={nroSap}
                onChange={e => setNroSap(e.target.value)}
                autoFocus
            />
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {requests.map((req, reqIndex) => (
                <div key={reqIndex} className={`bg-white rounded-2xl border shadow-sm overflow-hidden group transition-all ${req.bodega === 'ST02' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                    
                    {/* ENCABEZADO */}
                    <div className={`p-4 border-b border-slate-200 transition-colors ${req.bodega === 'ST02' ? 'bg-blue-50' : 'bg-slate-100'}`}>
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${req.bodega === 'ST02' ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                {reqIndex + 1}
                            </div>

                            <div className="w-32">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Origen</label>
                                <div className="relative">
                                    <ArrowRightLeft className="absolute left-2 top-2.5 w-3 h-3 text-slate-400"/>
                                    <select 
                                        className={`w-full pl-7 p-2 border rounded-lg text-sm font-bold outline-none ${req.bodega === 'ST02' ? 'border-blue-300 text-blue-700 bg-white' : 'border-slate-300'}`}
                                        value={req.bodega}
                                        onChange={e => updateRequestField(reqIndex, 'bodega', e.target.value)}
                                    >
                                        <option value="BOD01">BOD01</option>
                                        <option value="ST02">ST02</option>
                                    </select>
                                </div>
                            </div>

                            {/* ID (Busca) */}
                            {req.bodega === 'ST02' && (
                                <div className="w-40 animate-in fade-in slide-in-from-left-2">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1 items-center gap-1">
                                        <Hash className="w-3 h-3"/> ID (Enter)
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            placeholder="501" 
                                            className="w-full p-2 pr-8 border-2 border-blue-200 rounded-lg font-mono font-bold text-blue-900 focus:border-blue-500 outline-none bg-white"
                                            value={req.toolId}
                                            onChange={e => updateRequestField(reqIndex, 'toolId', e.target.value)}
                                            onBlur={() => fetchToolById(reqIndex)}
                                            onKeyDown={(e) => e.key === 'Enter' && fetchToolById(reqIndex)}
                                        />
                                        {req.loadingTool && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 text-blue-500 animate-spin"/>}
                                    </div>
                                </div>
                            )}

                            {/* MODELO (BLOQUEADO EN ST02) */}
                            <div className="flex-1 min-w-50">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Modelo Herramienta</label>
                                <div className="relative">
                                    <Package className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        placeholder={req.bodega === 'ST02' ? 'Buscando...' : 'Ej: DGA454'} 
                                        className={`w-full pl-9 p-2 border border-slate-300 rounded-lg font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none ${
                                            req.bodega === 'ST02' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                                        }`}
                                        value={req.modelo}
                                        onChange={e => updateRequestField(reqIndex, 'modelo', e.target.value)}
                                        // BLOQUEO: Solo lectura si es ST02
                                        readOnly={req.bodega === 'ST02'} 
                                    />
                                </div>
                            </div>

                            <div className="w-20">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cant.</label>
                                <input 
                                    type="number" min="1"
                                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={req.cantidad}
                                    onChange={e => updateRequestField(reqIndex, 'cantidad', e.target.value)}
                                />
                            </div>

                            {/* UBICACIÓN (BLOQUEADO/AUTO EN ST02) */}
                            {req.bodega === 'ST02' && (
                                <div className="w-32 animate-in fade-in slide-in-from-left-4">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1 items-center gap-1"><MapPin className="w-3 h-3"/> Ubicación</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border-2 border-blue-200 rounded-lg font-bold uppercase text-blue-900 outline-none bg-slate-50 cursor-not-allowed"
                                        value={req.ubicacion}
                                        readOnly // Solo lectura
                                    />
                                </div>
                            )}

                            {requests.length > 1 && (
                                <button onClick={() => removeRequestGroup(reqIndex)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto">
                                    <Trash2 className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                        
                        {/* HISTORIAL */}
                        {req.lastHistory && (
                            <div className="mt-2 px-1 flex items-start gap-2 text-[11px] text-blue-700 bg-blue-100/50 p-2 rounded-lg border border-blue-200">
                                <History className="w-4 h-4 shrink-0 mt-0.5"/>
                                <div>
                                    <span className="font-bold">Extracciones Previas:</span> {req.lastHistory}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CUERPO: REPUESTOS */}
                    <div className="p-4">
                        <div className="mb-2 flex items-center gap-2">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalle de Repuestos</h4>
                        </div>

                        <table className="w-full text-sm">
                            <thead className="text-slate-500 font-bold text-[10px] uppercase bg-slate-50 border-y border-slate-100">
                                <tr>
                                    <th className="px-2 py-2 text-left w-48">Código</th>
                                    <th className="px-2 py-2 text-center w-16">Cant.</th>
                                    <th className="px-2 py-2 text-left">Descripción</th>
                                    <th className="px-2 py-2 text-left w-40">Solicitante</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {req.parts.map((part, partIndex) => (
                                    <tr key={partIndex} className={part.error ? 'bg-red-50' : ''}>
                                        <td className="p-2 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex gap-1">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Código" 
                                                        className={`w-full p-1.5 border rounded font-mono text-sm outline-none uppercase ${part.error ? 'border-red-500 text-red-600' : 'border-slate-200 focus:border-blue-500'}`}
                                                        value={part.code}
                                                        onChange={e => updatePartField(reqIndex, partIndex, 'code', e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') fetchPartDescription(reqIndex, partIndex);
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => fetchPartDescription(reqIndex, partIndex)}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-colors border border-blue-100"
                                                        disabled={part.loading}
                                                    >
                                                        {part.loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 fill-current"/>}
                                                    </button>
                                                </div>
                                                {/* MENSAJE DE ERROR DUPLICADO */}
                                                {part.error && (
                                                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3"/> {part.error}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2 align-top">
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-1.5 border border-slate-200 rounded font-bold text-center outline-none focus:border-blue-500"
                                                value={part.quantity}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    // Usamos tu función updatePartField existente, pero hay que hacerle un pequeño ajuste de tipos
                                                    // O simplemente hacerlo directo aquí para no romper el tipado de updatePartField si es estricto:
                                                    const newRequests = [...requests];
                                                    newRequests[reqIndex].parts[partIndex].quantity = val;
                                                    setRequests(newRequests);
                                                }}
                                            />
                                        </td>
                                        <td className="p-2 align-top">
                                            <input 
                                                type="text" 
                                                placeholder="Descripción..." 
                                                className="w-full p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                value={part.description}
                                                onChange={e => updatePartField(reqIndex, partIndex, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2 align-top">
                                            <div className="relative">
                                                <User className="absolute left-2 top-2 w-3 h-3 text-slate-300"/>
                                                <input 
                                                    type="text" 
                                                    placeholder="Nombre..." 
                                                    className="w-full pl-6 p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none uppercase"
                                                    value={part.client}
                                                    onChange={e => updatePartField(reqIndex, partIndex, 'client', e.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-2 text-center align-top pt-2">
                                            {req.parts.length > 1 && (
                                                <button onClick={() => removePartFromRequest(reqIndex, partIndex)} className="text-slate-300 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        <button onClick={() => addPartToRequest(reqIndex)} className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded transition-colors">
                            <Plus className="w-3 h-3"/> Agregar repuesto
                        </button>
                    </div>
                </div>
            ))}

            <button onClick={addRequestGroup} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-bold hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all flex justify-center items-center gap-2">
                <Plus className="w-5 h-5"/> Agregar Otra Herramienta
            </button>

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 z-10">
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="px-8 py-3 rounded-xl font-bold bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-lg shadow-yellow-200 transition-all flex items-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                Guardar Todo
            </button>
        </div>

      </div>
    </div>
  );
}