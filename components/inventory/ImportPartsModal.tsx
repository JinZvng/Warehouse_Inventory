/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface ImportPartsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportPartsModal({ onClose, onSuccess }: ImportPartsModalProps) {
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState('');
  const [step, setStep] = useState<'upload' | 'preview' | 'error'>('upload');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!modelName) {
      alert("⚠️ Escribe el modelo base primero (Ej: DGA454)");
      e.target.value = ''; 
      return;
    }

    setLoading(true);
    setDebugInfo('');

    
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from('catalogo_repuestos').insert(parsedData);
    if (error) {
        setDebugInfo("Error SQL: " + error.message);
        setStep('error');
    } else {
        onSuccess();
        alert(`✅ Se importaron ${parsedData.length} items (incluyendo versiones antiguas).`);
        onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="text-xl font-bold text-slate-800">Importar Catálogo (Histórico Completo)</h3>
          <button onClick={onClose}><X className="text-slate-400 hover:text-red-500" /></button>
        </div>

        {step === 'error' && (
           <div className="bg-red-50 p-6 rounded-xl overflow-y-auto">
             <h4 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle/> Error de Lectura</h4>
             <pre className="bg-slate-900 text-green-400 p-4 mt-2 rounded text-xs font-mono whitespace-pre-wrap">{debugInfo}</pre>
             <button onClick={() => setStep('upload')} className="mt-4 bg-slate-800 text-white px-4 py-2 rounded">Reintentar</button>
           </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
                <label className="text-sm font-bold text-slate-700">Modelo Base</label>
                <input type="text" placeholder="Ej: DGA454" className="w-full p-2 border rounded uppercase font-bold"
                    value={modelName} onChange={e => setModelName(e.target.value)} />
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center relative hover:bg-slate-50">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading} />
                {loading ? <div className="flex flex-col items-center"><Loader2 className="animate-spin text-blue-600"/><span>Leyendo...</span></div> : 
                <div className="flex flex-col items-center"><FileSpreadsheet className="w-12 h-12 text-green-600"/><span className="font-bold">Subir CSV</span></div>}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm flex items-center gap-2 mb-3 shrink-0">
                <CheckCircle className="w-5 h-5"/>
                <span><b>{totalCount}</b> items detectados. (Se cargarán todas las versiones)</span>
            </div>

            <div className="border rounded-lg overflow-auto bg-white flex-1">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-800 text-white font-bold sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-2 w-20">Item</th>
                            <th className="px-4 py-2 w-32">Código</th>
                            <th className="px-4 py-2">Descripción</th>
                            <th className="px-4 py-2 text-center">Cant.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {previewData.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-bold">{row.nro_item}</td>
                                <td className="px-4 py-2 font-mono">{row.codigo_parte}</td>
                                <td className="px-4 py-2">{row.nombre_pieza}</td>
                                <td className="px-4 py-2 text-center font-bold bg-slate-50">{row.cantidad}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 pt-4 shrink-0">
                <button onClick={() => setStep('upload')} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Atrás</button>
                <button onClick={handleSave} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">Importar Todo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}