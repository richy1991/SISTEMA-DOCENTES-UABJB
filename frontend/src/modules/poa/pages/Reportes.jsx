import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar,
  Download,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  Printer,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { API_BASE, descargarReporteGeneralPOA } from '../../../apis/poa.api';

const reportCards = [
  {
    id: 'general',
    title: 'Reporte general POA',
    description: 'Consolida todos los documentos de la gestión en un solo PDF con los formularios establecidos.',
    status: 'Disponible ahora',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
    icon: FileText,
    enabled: true,
  },
  {
    id: 'seguimiento',
    title: 'Seguimiento POA',
    description: 'Panel de seguimiento de ejecución, cumplimiento y alertas por documento y actividad.',
    status: 'Próximamente',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
    icon: TrendingUp,
    enabled: false,
  },
  {
    id: 'resumen',
    title: 'Resumen por carrera',
    description: 'Vista comparativa por unidad solicitante con indicadores clave y estado de documentos.',
    status: 'En diseño',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20',
    icon: FolderOpen,
    enabled: false,
  },
];

const filterSections = [
  {
    title: 'Gestión',
    description: 'Define el año sobre el que trabajará todo el módulo.',
    items: ['2026', '2025', '2024'],
  },
  {
    title: 'Alcance',
    description: 'Prepara el módulo para filtrar por unidad, estado o carrera.',
    items: ['Todas las carreras', 'Solo mi carrera', 'Solo documentos aprobados'],
  },
  {
    title: 'Formato',
    description: 'Elige cómo quieres consumir el reporte disponible.',
    items: ['Vista previa PDF', 'Descarga directa', 'Impresión'],
  },
];

const Reportes = () => {
  const currentYear = new Date().getFullYear();
  const [gestion, setGestion] = useState(String(currentYear));
  const [selectedReport, setSelectedReport] = useState('general');
  const [selectedScope, setSelectedScope] = useState('Todas las carreras');
  const [selectedFormat, setSelectedFormat] = useState('Vista previa PDF');
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  const gestionValida = /^[0-9]{4}$/.test(String(gestion).trim());
  const reportCardSelected = reportCards.find((item) => item.id === selectedReport) || reportCards[0];

  const clearBlob = () => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const buildGeneralPreview = async () => {
    const year = String(gestion).trim();
    if (!gestionValida) {
      toast.error('Ingrese una gestión válida de 4 dígitos.');
      return;
    }

    if (selectedReport !== 'general') {
      toast('Todavía no existe un generador para este tipo de reporte.', {
        icon: 'ℹ️',
      });
      return;
    }

    setLoading(true);
    setError(null);
    const toastId = toast.loading('Generando reporte general...');

    try {
      clearBlob();
      const token = localStorage.getItem('access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE}/api/reportes/generar-reporte-general/?gestion=${year}&view=true`, { headers });

      if (!response.ok) {
        if (response.status === 401) throw new Error('No autorizado. Su sesión puede haber expirado.');
        if (response.status === 404) throw new Error('No existe reporte general para esta gestión.');
        throw new Error('Error al generar el reporte general.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setBlobUrl(url);
      toast.success('Vista previa lista');
    } catch (err) {
      const message = err?.message || 'Error al generar el reporte general';
      setError(message);
      toast.error(message);
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const descargarDirecto = async () => {
    const year = String(gestion).trim();
    if (!gestionValida) {
      toast.error('Ingrese una gestión válida de 4 dígitos.');
      return;
    }

    if (selectedReport !== 'general') {
      toast('Esta opción todavía no está implementada para el reporte seleccionado.', {
        icon: 'ℹ️',
      });
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Generando PDF...');

    try {
      const res = await descargarReporteGeneralPOA(Number(year));
      const fileUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = `reporte_documentos_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
      toast.success('Reporte descargado');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Error al descargar el reporte');
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    if (!win) {
      toast.error('Primero genere una vista previa para poder imprimir.');
      return;
    }
    win.focus();
    win.print();
  };

  const handleChangeReport = (reportId) => {
    setSelectedReport(reportId);
    setError(null);
  };

  return (
    <section className="w-full min-h-[calc(100vh-4rem)] px-3 md:px-6 py-4">
      <div className="max-w-[1700px] mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden">
        <div className="px-5 md:px-7 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-sky-50/90">
                <Sparkles size={14} /> Hub de reportes
              </div>
              <h1 className="text-2xl md:text-3xl font-black mt-3">Reportes POA</h1>
              <p className="mt-2 text-sm text-sky-50/90 max-w-4xl">
                Centraliza aquí todos los reportes del módulo: filtro por gestión, selección del tipo de reporte, vista previa, impresión y descarga.
                El seguimiento queda preparado como línea de trabajo para el siguiente desarrollo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 backdrop-blur px-3 py-2">
                <Calendar size={16} className="text-white flex-shrink-0" />
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={gestion}
                  onChange={(e) => setGestion(e.target.value)}
                  className="w-24 bg-transparent outline-none text-lg font-bold text-white placeholder:text-white/60"
                  aria-label="Gestión para el reporte"
                />
              </div>

              <button
                type="button"
                onClick={buildGeneralPreview}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-700 shadow hover:bg-sky-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Eye size={16} /> {loading ? 'Cargando...' : 'Vista previa'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900/90 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800 transition"
              >
                <Printer size={16} /> Imprimir
              </button>
              <button
                type="button"
                onClick={descargarDirecto}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download size={16} /> Descargar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] min-h-[calc(100vh-10rem)] bg-slate-50 dark:bg-slate-950">
          <aside className="border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/40 p-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                <Filter size={16} /> Filtros del módulo
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Estos filtros organizan el centro de reportes y dejan lista la estructura para nuevas salidas como seguimiento.
              </p>
            </div>

            <div className="space-y-3">
              {filterSections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 shadow-sm">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{section.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {section.items.map((item) => {
                      const active = section.title === 'Alcance' ? selectedScope === item : section.title === 'Formato' ? selectedFormat === item : String(gestion) === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (section.title === 'Alcance') setSelectedScope(item);
                            if (section.title === 'Formato') setSelectedFormat(item);
                            if (section.title === 'Gestión') setGestion(item);
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/25 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <strong>Nota:</strong> Seguimiento no está implementado todavía. Aquí ya queda reservado el espacio y la navegación para cuando exista el backend.
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/25 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </aside>

          <div className="p-3 md:p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {reportCards.map((card) => {
                const Icon = card.icon;
                const active = selectedReport === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleChangeReport(card.id)}
                    className={`text-left rounded-2xl border p-4 shadow-sm transition ${active ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-slate-900/70' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{card.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.description}</p>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${card.badgeClass}`}>{card.status}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] font-bold text-slate-500 dark:text-slate-400">Reporte activo</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{reportCardSelected.title}</h2>
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${reportCardSelected.badgeClass}`}>{reportCardSelected.status}</span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400">{reportCardSelected.description}</p>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Gestión</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{gestionValida ? gestion : 'Inválida'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Alcance</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{selectedScope}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Formato</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{selectedFormat}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={buildGeneralPreview}
                    disabled={!gestionValida || loading || !reportCardSelected.enabled}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Eye size={16} /> Abrir vista previa
                  </button>
                  <button
                    type="button"
                    onClick={descargarDirecto}
                    disabled={!gestionValida || loading || !reportCardSelected.enabled}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Download size={16} /> Descargar PDF
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!blobUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Printer size={16} /> Imprimir
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3 md:p-4 shadow-sm min-h-[65vh]">
                {!showViewer && !blobUrl && !loading && (
                  <div className="h-full min-h-[60vh] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center">
                    <div className="max-w-xl text-center text-slate-500 dark:text-slate-400 px-6">
                      <div className="mx-auto w-20 h-20 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <Eye size={32} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Aquí aparecerá la vista previa del reporte seleccionado</p>
                      <p className="mt-2 text-sm">El reporte general ya está disponible. Los demás tipos quedan organizados para que el módulo pueda crecer sin rehacer la pantalla.</p>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="h-full min-h-[60vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400">Generando vista previa...</p>
                    </div>
                  </div>
                )}

                {blobUrl && !loading && (
                  <iframe
                    ref={iframeRef}
                    src={`${blobUrl}#view=FitH&zoom=page-width`}
                    className="w-full h-[75vh] rounded-2xl bg-white"
                    title="Vista Previa del Reporte POA"
                    style={{ border: 'none' }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Reportes;
