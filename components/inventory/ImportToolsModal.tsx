/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import readXlsxFile from 'read-excel-file';
import { X, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface ImportToolsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportToolsModal({ onClose, onSuccess }: ImportToolsModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'error'>('upload');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [existingSerials, setExistingSerials] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] = useState<string>('');
  
  // Opción para cuando el Excel no trae columna de Modelo
  const [manualModel, setManualModel] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorDetails('');

    try {
        const rows = await readXlsxFile(file);

        // --- 1. ESCÁNER DE ENCABEZADOS SUPER FLEXIBLE ---
        let headerRowIndex = -1;
        
        // Diccionario de sinónimos
        const keysModel = ['modelo', 'model', 'producto', 'herramienta', 'item', 'tipo'];
        const keysSerial = ['serie', 'serial', 'sn', 's/n', 'nro', 'número', 'numero'];
        const keysPallet = ['pallet', 'ubicacion', 'estante', 'bodega', 'lugar', 'mesa', 'posicion'];
        const keysStatus = ['estado', 'status', 'situacion', 'condicion', 'observacion', 'obs'];

        // Escaneamos las primeras 20 filas buscando AL MENOS la serie
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const rowStr = rows[i].map(cell => String(cell || '').toLowerCase());
          
          // Buscamos si la fila tiene algo que parezca "Serie"
          const hasSerial = rowStr.some(c => keysSerial.some(k => c.includes(k)));
          
          // Si encontramos "Serie", asumimos que esta es la cabecera
          if (hasSerial) {
             headerRowIndex = i;
             break;
          }
        }

        if (headerRowIndex === -1) {
          // Si no encontramos nada, mostramos qué leímos en las primeras 3 filas para diagnosticar
          const dump = rows.slice(0, 3).map(r => r.join(' | ')).join('\n');
          throw new Error(`No encontré ninguna columna que diga 'Serie', 'S/N' o 'Serial'.\n\nPrimeras filas leídas:\n${dump}`);
        }

        // --- 2. MAPEO DE COLUMNAS ---
        const headers = rows[headerRowIndex].map(h => String(h || '').toLowerCase().trim());
        
        const colModel = headers.findIndex(h => keysModel.some(k => h.includes(k)));
        const colSerial = headers.findIndex(h => keysSerial.some(k => h.includes(k)));
        const colPallet = headers.findIndex(h => keysPallet.some(k => h.includes(k)));
        const colStatus = headers.findIndex(h => keysStatus.some(k => h.includes(k)));

        // --- 3. EXTRACCIÓN ---
        const toolsList: any[] = [];
        const serialsToCheck: string[] = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            // Logica: Si hay columna modelo, úsala. Si no, usa el manual (o deja vacío para pedirlo después)
            const modelo = colModel !== -1 ? String(row[colModel] || '').trim().toUpperCase() : manualModel.toUpperCase();
            const serie = row[colSerial] ? String(row[colSerial]).trim().toUpperCase() : '';
            
            // Validación relajada: Solo pedimos que tenga serie
            if (!serie) continue;

            const pallet = colPallet !== -1 && row[colPallet] ? String(row[colPallet]).trim() : 'BODEGA';
            
            // Lógica de Estado (Busca palabras clave en observaciones o estado)
            const estadoRaw = colStatus !== -1 && row[colStatus] ? String(row[colStatus]).trim().toLowerCase() : '';
            let estado = 'En desarme'; 

            if (estadoRaw.includes('rearmando') || estadoRaw.includes('oper')) estado = 'Rearmando';
            if (estadoRaw.includes('listo') || estadoRaw.includes('rearmada') || estadoRaw.includes('ok')) estado = 'Rearmadas';
            if (estadoRaw.includes('mant')) estado = 'En mantención';

            toolsList.push({ modelo, serie, pallet, estado });
            serialsToCheck.push(serie);
        }

        if (toolsList.length === 0) {
            throw new Error(`Encontré la columna de Serie en la fila ${headerRowIndex + 1}, pero no pude leer datos debajo.`);
        }

        // --- 4. SI FALTA MODELO, LO PEDIMOS AHORA ---
        // Si el Excel no tenía columna modelo y el usuario no lo escribió antes
        const missingModel = toolsList.some(t => !t.modelo || t.modelo.length < 2);
        
        // --- 5. VERIFICACIÓN DE DUPLICADOS ---
        if (serialsToCheck.length > 0) {
            const { data: existing } = await supabase
                .from('herramientas')
                .select('serie')
                .in('serie', serialsToCheck);
            
            const existingSet = new Set(existing?.map(e => e.serie));
            setExistingSerials(Array.from(existingSet));
            
            const newTools = toolsList.filter(t => !existingSet.has(t.serie));
            setParsedData(newTools);
        } else {
            setParsedData(toolsList);
        }

        setPreviewData(toolsList.slice(0, 5));
        setStep('preview');
        setLoading(false);

    } catch (error: any) {
        setLoading(false);
        setErrorDetails(error.message);
        setStep('error');
    }
  };

  const handleSave = async () => {
    // Validación final de modelo
    const toolsToSave = parsedData.map(t => ({
        ...t,
        modelo: t.modelo || manualModel.toUpperCase() // Aplicar modelo manual si faltaba
    }));

    if (toolsToSave.some(t => !t.modelo)) {
        alert("⚠️ Falta el MODELO. Por favor escríbelo en el campo de texto superior.");
        return;
    }

    setLoading(true);
    const { error } = await supabase.from('herramientas').insert(toolsToSave);
    
    if (error) {
        alert("Error al guardar: " + error.message);
    } else {
        onSuccess();
        alert(`✅ Importación exitosa.`);
        onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-xl font-bold text-slate-800">Carga Masiva (Diagnóstico)</h3>
          <button onClick={onClose}><X className="text-slate-400 hover:text-red-500" /></button>
        </div>

        {step === 'error' && (
            <div className="bg-red-50 p-6 rounded-xl overflow-y-auto border border-red-200">
                <div className="flex items-center gap-2 mb-3 text-red-800 font-bold">
                    <AlertTriangle className="w-6 h-6"/> No pude leer el Excel
                </div>
                <p className="text-sm text-red-700 mb-4">Detalles técnicos de lo que encontré:</p>
                <pre className="bg-white p-4 rounded border border-red-100 text-xs font-mono text-slate-600 whitespace-pre-wrap">
                    {errorDetails}
                </pre>
                <div className="mt-4 flex justify-end">
                    <button onClick={() => setStep('upload')} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold">Intentar de nuevo</button>
                </div>
            </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
             {/* CAMPO DE MODELO MANUAL (OPCIONAL) */}
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                    ¿Tu Excel NO tiene columna de Modelo?
                </label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Escribe el modelo aquí (Ej: DGA454)" 
                        className="flex-1 p-2 rounded border border-blue-200 text-sm"
                        value={manualModel}
                        onChange={(e) => setManualModel(e.target.value)}
                    />
                    <div className="text-xs text-blue-600 flex items-center">
                        <HelpCircle className="w-4 h-4 mr-1"/>
                        <span>Si lo dejas vacío, buscaré la columna "Modelo" en el Excel.</span>
                    </div>
                </div>
             </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center relative hover:bg-slate-50 transition-colors">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading} />
                {loading ? (
                    <div className="flex flex-col items-center"><Loader2 className="animate-spin text-green-600 mb-2"/><span className="text-sm">Analizando estructura...</span></div>
                ) : (
                    <div className="flex flex-col items-center text-slate-500">
                        <FileSpreadsheet className="w-12 h-12 mb-2 text-slate-400"/>
                        <span className="font-bold text-slate-700">Subir Planilla</span>
                    </div>
                )}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
            <div className="flex gap-3 text-sm shrink-0">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5"/>
                    <span><b>{parsedData.length}</b> Detectadas</span>
                </div>
                {existingSerials.length > 0 && (
                     <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5"/>
                        <span><b>{existingSerials.length}</b> Duplicadas</span>
                    </div>
                )}
            </div>

            {/* Si falta el modelo en las filas, avisar */}
            {parsedData.some(t => !t.modelo) && !manualModel && (
                <div className="bg-red-50 text-red-700 p-2 rounded text-xs font-bold text-center animate-pulse">
                    ⚠️ ALERTA: No detecté el Modelo en el Excel. Escríbelo arriba antes de guardar.
                </div>
            )}

            {/* Input Manual en Preview por si se olvidó */}
            {parsedData.some(t => !t.modelo) && (
                 <input 
                    type="text" 
                    placeholder="INGRESA EL MODELO AQUÍ (Ej: DGA454)" 
                    className="w-full p-2 border-2 border-red-300 bg-red-50 rounded font-bold text-center"
                    value={manualModel}
                    onChange={(e) => setManualModel(e.target.value)}
                />
            )}

            <div className="border rounded-lg overflow-auto bg-white flex-1 shadow-sm">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-800 text-white font-bold sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Modelo</th>
                            <th className="px-4 py-2">Serie</th>
                            <th className="px-4 py-2">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {previewData.map((row, i) => (
                            <tr key={i} className={existingSerials.includes(row.serie) ? 'bg-amber-50 opacity-50' : ''}>
                                <td className="px-4 py-2 font-bold">{row.modelo || manualModel.toUpperCase() || <span className="text-red-500">???</span>}</td>
                                <td className="px-4 py-2 font-mono">{row.serie}</td>
                                <td className="px-4 py-2 text-xs">{row.estado}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 pt-2 shrink-0">
                <button onClick={() => setStep('upload')} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-500">Atrás</button>
                <button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800">Confirmar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}