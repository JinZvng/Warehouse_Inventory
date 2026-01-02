/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Herramienta } from '@/types';
// 1. IMPORTAMOS LOS HOOKS DE NAVEGACIÓN
import { useSearchParams, useRouter } from 'next/navigation';

import ToolCard from './ToolCard';
import ToolDetail from './ToolDetail';
import RequestSapModal from './RequestSapModal';
import ConfirmArrivalModal from './ConfirmArrivalModal';
import FinalizeTechModal from './FinalizeTechModal';
import ImportToolsModal from './ImportToolsModal';
import ImportPartsModal from './ImportPartsModal';
import ReassembleListModal from './ReassembleListModal';
import ReassembleModal from './ReassembleModal'; 
import FinishReassemblyModal from './FinishReassemblyModal';
import { useKonamiCode } from '@/hooks/useKonamiCode';
import confetti from 'canvas-confetti';
import DashboardModal from './DashboardModal';
import ToolHistoryModal from './ToolHistoryModal';
import QRScannerModal from './QRScannerModal';
import MakitaLoader from './MakitaLoader';

import { 
  Search, LayoutGrid, LayoutList, ChevronLeft, ChevronRight, 
  Wrench, Package, ClipboardList, PackageOpen, 
  RefreshCw, CheckCircle2, Upload, Hammer, Plus, Loader2, CheckCheck, Skull, AlertTriangle, BarChart3, History,
  Printer, ScanBarcode, FileSpreadsheet
} from 'lucide-react';


/*ESTADOS*/
export default function ToolGrid() {
  const [tools, setTools] = useState<Herramienta[]>([]);
  const [sapRequests, setSapRequests] = useState<any[]>([]);
  
  const [selectedTool, setSelectedTool] = useState<Herramienta | null>(null);
  const [confirmingRequest, setConfirmingRequest] = useState<any | null>(null);
  const [finalizingTool, setFinalizingTool] = useState<Herramienta | null>(null);
  const [reassembleTool, setReassembleTool] = useState<Herramienta | null>(null); 
  const [finishingReassemblyTool, setFinishingReassemblyTool] = useState<Herramienta | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [historyTool, setHistoryTool] = useState<Herramienta | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [bulkLoading, setBulkLoading] = useState(false);

  const [isSapModalOpen, setIsSapModalOpen] = useState(false);
  const [isImportToolsOpen, setIsImportToolsOpen] = useState(false);
  const [isImportPartsOpen, setIsImportPartsOpen] = useState(false);
  const [isReassembleListOpen, setIsReassembleListOpen] = useState(false);

  const [mainView, setMainView] = useState<'inventory' | 'sap'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'grid' ? 12 : 20;
    
  const [isLoading, setIsLoading] = useState(true);


  // 3. INICIALIZAMOS LOS HOOKS DE URL
  const searchParams = useSearchParams();

  // --- FETCH DATA ---
  const fetchData = async () => {
    const { data: toolsData } = await supabase.from('herramientas').select('*').order('created_at', { ascending: false });
    if (toolsData) setTools(toolsData as Herramienta[]);
    
    const { data: sapData } = await supabase.from('solicitudes_sap').select('*').order('created_at', { ascending: false });
    if (sapData) {
        const pending = sapData.filter(r => r.cantidad_procesada < r.cantidad_total);
        setSapRequests(pending);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    console.log("📡 Conectando antena...");
    const channel = supabase
      .channel('cambios-globales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'herramientas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_sap' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ---------------------------------------------------------
  // 4. LA MAGIA DEL QR (EL OÍDO)
  // ---------------------------------------------------------
  useEffect(() => {
    // Busca el parametro ?qr_open=ID en la url
    const qrId = searchParams.get('qr_open');

    // Solo actuamos si hay un ID y las herramientas ya cargaron
    if (qrId && tools.length > 0) {
        // Busca la herramienta por ID_CORTO. Convertimos a string por seguridad.
        const found = tools.find(t => t.id_corto?.toString() === qrId);

        if (found) {
            // ¡ABRE EL MODAL!
            // Usamos la función que determina si abre detalle o finalización
            // O forzamos detalle directo con setSelectedTool(found) si prefieres
            handleToolClick(found); 

            // Limpiamos la URL silenciosamente para que no moleste visualmentee
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }
  }, [searchParams, tools]); // Se ejecuta al cambiar la URL o cargar herramientas
  // ---------------------------------------------------------

    // --- FUNCIÓN AL DETECTAR CÓDIGO ---
  const handleScanSuccess = (scannedId: string) => {
      // 1. Cerramos el scanner
      setIsScannerOpen(false);

      // 2. Buscamos la herramienta
      const found = tools.find(t => t.id_corto?.toString() === scannedId);

      if (found) {
          // 3. Abrimos el modal de la herramienta (Simulamos el click)
          handleToolClick(found);
          // Opcional: Feedback vibración si es móvil
          if (navigator.vibrate) navigator.vibrate(200);
      } else {
          alert(`❌ Herramienta ID #${scannedId} no encontrada en bodega.`);
      }
  };

  // KONAMI CODE
  const triggerMakitaParty = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#008E9B', '#F97316', '#ffffff']; 

    (function frame() {
      confetti({ particleCount: 20, angle: 60, spread: 360, origin: { x: 0 }, colors: colors });
      confetti({ particleCount: 20, angle: 120, spread: 360, origin: { x: 1 }, colors: colors });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
    alert("🎈 Easter Egg Encontrado! 🎈\n\nSistema creado por Byron Barrientos");
  };
  useKonamiCode(triggerMakitaParty);


  // --- CONFIRMACIÓN MASIVA INTELIGENTE ---
  const handleBulkConfirm = async () => {
    if (sapRequests.length === 0) return;
    const totalItems = sapRequests.reduce((acc, req) => acc + (req.cantidad_total - req.cantidad_procesada), 0);
    
    if (!confirm(`¿Procesar ${totalItems} items pendientes?`)) return;

    setBulkLoading(true);
    try {
        const { data: maxTool } = await supabase.from('herramientas').select('id_corto').order('id_corto', { ascending: false }).limit(1).single();
        let currentId = maxTool?.id_corto || 0;
        
        const toolsToInsert = [];
        const toolsToUpdatePromises = [];
        const sapUpdates = [];

        for (const req of sapRequests) {
            const pendingQty = req.cantidad_total - req.cantidad_procesada;
            if (req.bodega_origen === 'ST02' && req.tool_id_origen) {
                 toolsToUpdatePromises.push(
                    supabase.from('herramientas')
                        .update({
                            estado: 'En desarme',
                            pallet: req.ubicacion || 'RECEPCIÓN ST02',
                            solicitud_sap_id: req.id,
                            repuesto_objetivo: req.codigo_objetivo,
                            descripcion_objetivo: req.desc_objetivo,
                            solicitante: req.solicitante
                        })
                        .eq('id_corto', req.tool_id_origen)
                 );
            } else {
                for (let i = 0; i < pendingQty; i++) {
                    currentId++;
                    toolsToInsert.push({
                        modelo: req.modelo,
                        serie: `PENDIENTE-${currentId}`,
                        pallet: 'RECEPCIÓN',
                        estado: 'En desarme',
                        id_corto: currentId,
                        solicitud_sap_id: req.id,
                        repuesto_objetivo: req.codigo_objetivo,
                        descripcion_objetivo: req.desc_objetivo,
                        solicitante: req.solicitante
                    });
                }
            }
            sapUpdates.push(supabase.from('solicitudes_sap').update({ cantidad_procesada: req.cantidad_total }).eq('id', req.id));
        }

        if (toolsToInsert.length > 0) await supabase.from('herramientas').insert(toolsToInsert);
        if (toolsToUpdatePromises.length > 0) await Promise.all(toolsToUpdatePromises);
        await Promise.all(sapUpdates);

        await fetchData();
        alert(`✅ Procesado correctamente.`);

    } catch (error: any) {
        alert("Error masivo: " + error.message);
    } finally {
        setBulkLoading(false);
    }
  };

  const handleToolClick = (tool: Herramienta) => {
    if (tool.serie.startsWith('PENDIENTE') || tool.estado === 'En desarme') {
        setFinalizingTool(tool); 
    } else if (tool.estado === 'Rearmando') {
        setFinishingReassemblyTool(tool);
    } else {
        setSelectedTool(tool);
    }
  };

  const stats = useMemo(() => {
    return {
      total: tools.filter(t => ['En desarme', 'Desarmado', 'Rearmando'].includes(t.estado)).length,
      en_desarme: tools.filter(t => t.estado === 'En desarme').length,
      desarmado: tools.filter(t => t.estado === 'Desarmado').length, 
      rearmando: tools.filter(t => t.estado === 'Rearmando').length,
      rearmadas: tools.filter(t => t.estado === 'Rearmadas').length,
    };
  }, [tools]);


  const filteredTools = tools.filter(t => {
    const matchesTab = activeTab === 'Todos' ? true : t.estado === activeTab;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      t.modelo.toLowerCase().includes(term) || 
      t.serie.toLowerCase().includes(term) || 
      t.pallet.toLowerCase().includes(term) ||
      (`#${t.id_corto}`).includes(term);

    return matchesTab && matchesSearch;
  }).sort((a, b) => (a.id_corto || 0) - (b.id_corto || 0));

  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab, viewMode, mainView]);

  const totalPages = Math.ceil(filteredTools.length / itemsPerPage);
  const paginatedTools = filteredTools.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string) => {
    const styles: any = {
      'En desarme':  'bg-amber-100 text-amber-700 border-amber-200',
      'Desarmado':   'bg-slate-800 text-white border-slate-700', 
      'Rearmando':   'bg-blue-100 text-blue-700 border-blue-200',
      'Rearmadas':   'bg-emerald-100 text-emerald-700 border-emerald-200'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
  };

  const renderInventoryView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            <div onClick={() => setActiveTab('Todos')} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeTab === 'Todos' ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-[1.02]' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2 rounded-lg ${activeTab === 'Todos' ? 'bg-slate-700' : 'bg-slate-100 text-slate-600'}`}><Wrench className="w-5 h-5"/></div>
                    <span className="text-2xl font-black">{stats.total}</span>
                </div>
                <p className="text-xs font-bold opacity-70">Total Bodega</p>
            </div>
            
            <div onClick={() => setActiveTab('En desarme')} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeTab === 'En desarme' ? 'bg-amber-500 text-white border-amber-500 shadow-lg scale-[1.02]' : 'bg-white border-slate-200 hover:border-amber-300'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2 rounded-lg ${activeTab === 'En desarme' ? 'bg-amber-400/50' : 'bg-amber-50 text-amber-600'}`}><PackageOpen className="w-5 h-5"/></div>
                    <span className="text-2xl font-black">{stats.en_desarme}</span>
                </div>
                <p className="text-xs font-bold opacity-70">En desarme</p>
            </div>

            <div onClick={() => setActiveTab('Desarmado')} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeTab === 'Desarmado' ? 'bg-slate-600 text-white border-slate-600 shadow-lg scale-[1.02]' : 'bg-white border-slate-200 hover:border-slate-400'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2 rounded-lg ${activeTab === 'Desarmado' ? 'bg-slate-500' : 'bg-slate-100 text-slate-600'}`}><Skull className="w-5 h-5"/></div>
                    <span className="text-2xl font-black">{stats.desarmado}</span>
                </div>
                <p className="text-xs font-bold opacity-70">Desarmado</p>
            </div>

            <div onClick={() => setActiveTab('Rearmando')} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeTab === 'Rearmando' ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-[1.02]' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2 rounded-lg ${activeTab === 'Rearmando' ? 'bg-blue-500/50' : 'bg-blue-50 text-blue-600'}`}><RefreshCw className="w-5 h-5"/></div>
                    <span className="text-2xl font-black">{stats.rearmando}</span>
                </div>
                <p className="text-xs font-bold opacity-70">En rearme</p>
            </div>

            <div onClick={() => setActiveTab('Rearmadas')} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeTab === 'Rearmadas' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-[1.02]' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2 rounded-lg ${activeTab === 'Rearmadas' ? 'bg-emerald-500/50' : 'bg-emerald-50 text-emerald-600'}`}><CheckCircle2 className="w-5 h-5"/></div>
                    <span className="text-2xl font-black">{stats.rearmadas}</span>
                </div>
                <p className="text-xs font-bold opacity-70">Listas</p>
            </div>
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-20">
            <div className="flex gap-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 px-2 md:px-0 scrollbar-hide">
                {['Todos', 'En desarme', 'Desarmado', 'Rearmando', 'Rearmadas'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        {tab}
                    </button>
                ))}
            </div>
            
            <div className="flex gap-3 w-full md:w-auto items-center px-2 md:px-0">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" />
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="flex gap-1">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutList className="w-5 h-5" /></button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutGrid className="w-5 h-5" /></button>
                </div>
            </div>
        </div>

        {/* CONTENIDO */}
        {filteredTools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                <Hammer className="w-12 h-12 text-slate-300 mb-3"/>
                <p className="text-slate-500 font-medium">No encontré herramientas en &rdquo;{activeTab}&rdquo;.</p>
                {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-600 text-sm font-bold hover:underline">Limpiar filtros</button>}
            </div>
        ) : (
            <>
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {paginatedTools.map(t => {
                            const hasConflict = t.tiene_conflicto && t.estado === 'Desarmado';

                            return (
                                <div key={t.id} className="relative group">
                                    {hasConflict && (
                                        <div className="absolute -top-2 -right-2 z-10 bg-orange-500 text-white px-2 py-1 text-[10px] font-bold rounded-full shadow-md flex items-center gap-1 animate-pulse">
                                            <AlertTriangle className="w-3 h-3"/> INCIDENCIA
                                        </div>
                                    )}

                                    <div className={hasConflict ? 'ring-2 ring-orange-400 rounded-xl' : ''}>
                                        <ToolCard tool={t} onClick={handleToolClick}/>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                                <tr><th className="p-4">Modelo</th><th className="p-4">Serie</th><th className="p-4">Ubicación</th><th className="p-4 text-center">Estado</th><th className="p-4"></th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedTools.map(t => (
                                    <tr key={t.id} onClick={() => handleToolClick(t)} className="hover:bg-slate-50 cursor-pointer group">
                                        <td className="p-4 font-bold">{t.modelo}</td>
                                        <td className="p-4 font-mono">{t.serie}</td>
                                        <td className="p-4">{t.pallet}</td>
                                        <td className="p-4 text-center">{getStatusBadge(t.estado)}</td>
                                        <td className="p-4 text-right text-slate-400">
                                            <div className="flex justify-end items-center gap-2">
                                                {/* 5. NUEVO BOTÓN: IMPRIMIR ETIQUETA (LIST MODE) */}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(`/etiqueta/${t.id}`, '_blank');
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-black hover:bg-slate-200 rounded-lg transition-colors"
                                                    title="Imprimir Etiqueta"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>

                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setHistoryTool(t); 
                                                    }} 
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" 
                                                    title="Ver Bitácora"
                                                >
                                                    <History className="w-4 h-4"/>
                                                </button>
                                                
                                                <span className="text-xs font-bold text-slate-500">Ver →</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {totalPages > 1 && <div className="flex justify-center gap-4 mt-6"><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronLeft/></button><span className="py-2 text-sm text-slate-500">Pág {currentPage}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="p-2 border rounded hover:bg-white disabled:opacity-50"><ChevronRight/></button></div>}
            </>
        )}
    </div>
  );

  const renderSapView = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-yellow-900 flex items-center gap-2">
                    <ClipboardList className="w-6 h-6"/> Solicitudes de Traslado
                </h2>
                <p className="text-yellow-800/70 text-sm mt-1">Gestión administrativa de ingresos pendientes.</p>
            </div>
            
            <div className="flex gap-2">
                {sapRequests.length > 0 && (
                    <button onClick={handleBulkConfirm} disabled={bulkLoading} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-transform hover:scale-105">
                        {bulkLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCheck className="w-5 h-5"/>}
                        Confirmar Todo
                    </button>
                )}
                <button onClick={() => setIsSapModalOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-yellow-200 flex items-center gap-2 transition-transform hover:scale-105">
                    <Plus className="w-5 h-5"/> Formulario Ingreso
                </button>
            </div>
        </div>

        {sapRequests.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <ClipboardList className="w-16 h-16 text-slate-200 mx-auto mb-4"/>
                <p className="text-slate-400 font-medium text-lg">Sin solicitudes pendientes.</p>
            </div>
        ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs tracking-wider">
<tr>
                            <th className="p-4 w-32">Fecha</th>
                            <th className="p-4 w-24">SAP</th>
                            <th className="p-4">Item (Modelo)</th>
                            <th className="p-4">Origen</th>
                            <th className="p-4">Buscan Repuesto</th>
                            <th className="p-4">Solicitante</th>
                            <th className="p-4 text-center">Progreso</th>
                            <th className="p-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sapRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-yellow-50/30 transition-colors group">
                                <td className="p-4 text-slate-400 whitespace-nowrap">
                                    {new Date(req.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4 font-mono font-bold text-slate-600 bg-slate-50/50">
                                    {req.nro_sap}
                                </td>
                                <td className="p-4 font-black text-slate-800 text-lg">
                                    {req.modelo}
                                </td>
                                <td className="p-4">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">{req.bodega_origen || 'BOD01'}</span>
                                </td>
                                <td className="p-4">
                                    {req.codigo_objetivo ? (
                                        <div>
                                            <p className="font-mono text-xs font-bold text-blue-600">{req.codigo_objetivo.split('\n')[0]}...</p>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="p-4 text-slate-600 font-medium text-xs uppercase">
                                    {req.solicitante ? req.solicitante.split('\n')[0] : 'Anónimo'}
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-bold mb-1 text-slate-500">{req.cantidad_procesada} / {req.cantidad_total}</span>
                                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-yellow-400" style={{ width: `${(req.cantidad_procesada / req.cantidad_total) * 100}%` }}></div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setConfirmingRequest(req)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-600 transition-colors shadow-md group-hover:scale-105 whitespace-nowrap">
                                        Confirmar Entrega
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );

  const disassembledTools = tools.filter(t => t.estado === 'Desarmado'); 

  if (isLoading) {
    return <MakitaLoader onFinish={() => setIsLoading(false)} />;
  }
  
  return (
    <div className="container mx-auto p-6 max-w-7xl min-h-screen flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
        <div>
        <a href="https://makita.cl">
            <img src="https://makita.cl/wp-content/uploads/2025/01/logo_makita.svg" style={{ width: '150px', height: '80px' }} />
        </a>
          <p className="text-slate-500 text-sm font-medium">Sistema de Control de Desarmes</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {/* <button onClick={() => setIsImportPartsOpen(true)} className="bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-colors text-sm">
                <Upload className="w-4 h-4" /> Importar Catálogo
            </button> */ }{/*Comentada para recuperar*/}
            <button onClick={() => setIsDashboardOpen(true)} className="bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-colors text-sm">
                <BarChart3 className="w-4 h-4" /> Dashboard
            </button>
            {/* <button onClick={() => setIsImportToolsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-200 transition-colors text-sm">
                <PackageOpen className="w-4 h-4" /> Carga Masiva (Excel)
            </button> */}{/*Comentada para recuperar*/}

            <button 
                onClick={() => setIsReassembleListOpen(true)} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-emerald-100 transition-colors text-sm"
            >
                <Hammer className="w-4 h-4" /> Gestión Rearme
            </button>
            {/* --- BOTÓN FLOTANTE DE ESCANER (SOLO MÓVIL) --- */}
            <button 
              onClick={() => setIsScannerOpen(true)} // AHORA ABRE EL MODAL REAL
              className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-900/40 md:hidden active:scale-95 transition-transform border border-slate-700"
            >
              <ScanBarcode className="w-7 h-7" />
            </button>

        </div>
      </div>
      <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full max-w-2xl mx-auto mb-8 shadow-inner border border-slate-200">
        <button onClick={() => setMainView('inventory')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mainView === 'inventory' ? 'bg-white text-blue-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
            <Package className="w-5 h-5"/> Inventario Bodega
        </button>
        <button onClick={() => setMainView('sap')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mainView === 'sap' ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
            <ClipboardList className="w-5 h-5"/> Solicitud Herramienta
            {sapRequests.length > 0 && <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{sapRequests.length}</span>}
        </button>
      </div>

      <div className="flex-1 relative">
        {mainView === 'inventory' ? renderInventoryView() : renderSapView()}
      </div>
      
      {reassembleTool && <ReassembleModal tool={reassembleTool} onClose={() => setReassembleTool(null)} onSuccess={fetchData} />}
      {isReassembleListOpen && (
          <ReassembleListModal 
              tools={disassembledTools} 
              onClose={() => setIsReassembleListOpen(false)} 
              onSuccess={fetchData} 
          />
      )}
      
      {isScannerOpen && (
          <QRScannerModal 
             onClose={() => setIsScannerOpen(false)} 
             onScan={handleScanSuccess} 
          />
      )}
      {isDashboardOpen && <DashboardModal onClose={() => setIsDashboardOpen(false)} />}
      {historyTool && <ToolHistoryModal tool={historyTool} onClose={() => setHistoryTool(null)} />}
      {finishingReassemblyTool && <FinishReassemblyModal tool={finishingReassemblyTool} onClose={() => setFinishingReassemblyTool(null)} onSuccess={fetchData} />}
      {selectedTool && <ToolDetail tool={selectedTool} onClose={() => setSelectedTool(null)} />}
      {confirmingRequest && <ConfirmArrivalModal request={confirmingRequest} onClose={() => setConfirmingRequest(null)} onSuccess={fetchData} />}
      {finalizingTool && <FinalizeTechModal tool={finalizingTool} onClose={() => setFinalizingTool(null)} onSuccess={fetchData} />}
      {isSapModalOpen && <RequestSapModal onClose={() => setIsSapModalOpen(false)} onSuccess={fetchData} />}
      {isImportToolsOpen && <ImportToolsModal onClose={() => setIsImportToolsOpen(false)} onSuccess={fetchData} />}
      {isImportPartsOpen && <ImportPartsModal onClose={() => setIsImportPartsOpen(false)} onSuccess={() => {}} />}
    </div>
  );
}