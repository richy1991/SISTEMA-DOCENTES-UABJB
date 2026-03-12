import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_ENTIDAD } from '../config/defaults';
import GestionSelectorModal from '../components/GestionSelectorModal';
import NuevoDocumentoModal from '../components/NuevoDocumentoModal';
import IconButton from '../components/IconButton';
import { FaEdit, FaTrash, FaBuilding, FaCalendarAlt, FaLayerGroup, FaBriefcase, FaBullseye, FaCircle } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteDocumentoPOA, getDocumentosPOAPorGestion, API_BASE } from '../../../apis/poa.api';

const ESTADO_CONFIG = {
  elaboracion: { label: 'En elaboración', dot: 'bg-yellow-400',  badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300',  strip: 'from-yellow-400 to-amber-500',   text: 'text-yellow-500' },
  revision:    { label: 'En revisión',    dot: 'bg-sky-400',     badge: 'bg-sky-100 text-sky-800 border border-sky-300',           strip: 'from-sky-400 to-blue-500',       text: 'text-sky-400' },
  aprobado:    { label: 'Aprobado',       dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300', strip: 'from-emerald-400 to-green-500',  text: 'text-emerald-400' },
  ejecucion:   { label: 'En ejecución',   dot: 'bg-violet-400',  badge: 'bg-violet-100 text-violet-800 border border-violet-300',   strip: 'from-violet-400 to-purple-500',  text: 'text-violet-400' },
};

const DocumentosPOAPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const [docs, setDocs] = useState(location?.state?.documentos || []);
  const [gestionState, setGestionState] = useState(location?.state?.gestion || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resolveGestionCandidate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
      return value.id ?? value.pk ?? value.gestion ?? value.nombre ?? value;
    }
    return value;
  };

  const getGestionNumberForDoc = (doc) => {
    const candidates = [
      resolveGestionCandidate(doc?.gestion),
      resolveGestionCandidate(gestionState),
      resolveGestionCandidate(location?.state?.gestion),
    ];
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) continue;
      const numeric = Number(candidate);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) return numeric;
    }
    return null;
  };

  const fromDialog = docs && docs.length > 0;

  const handleOpen = () => setShowModal(true);
  const handleClose = () => setShowModal(false);
  const openNuevo = () => { setEditingDoc(null); setShowNuevoModal(true); };
  const closeNuevo = () => { setEditingDoc(null); setShowNuevoModal(false); };

  // Listen for header 'Nuevo' button events for documentos
  useEffect(() => {
    const handler = (e) => { if (e?.detail?.page === 'documentos') openNuevo(); };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, []);

  const openEdit = (doc) => { setEditingDoc(doc); setShowNuevoModal(true); };

  const handleUpdated = (updated) => {
    // reemplazar en la lista por id
    setDocs(prev => (prev || []).map(d => (Number(d.id) === Number(updated.id) ? updated : d)));
    closeNuevo();
    toast.success('Edición guardada');
  };

  const handleSuccess = ({ gestion, documentos }) => {
    // guardar en estado local para mostrar directamente
    setGestionState(gestion);
    setDocs(Array.isArray(documentos) ? documentos : []);
    setShowModal(false);
  };

  useEffect(() => {
    let mounted = true;
    const initialGestion = gestionState || location?.state?.gestion;
    const shouldFetch = (!docs || docs.length === 0) && initialGestion;
    if (!shouldFetch) return undefined;
    setLoading(true);
    setError(null);
    getDocumentosPOAPorGestion(Number(initialGestion))
      .then(res => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setDocs(list || []);
        setGestionState(initialGestion);
      })
      .catch(err => {
        if (!mounted) return;
        setError(err?.response?.data?.detail || err?.message || 'Error al cargar documentos');
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [location?.state?.gestion, gestionState]);

  // Escuchar evento global para generar PDF cuando el header dispare la acción
  useEffect(() => {
    const handler = async () => {
      const gestion = gestionState || location?.state?.gestion;
      if (!gestion) {
        toast.error('Seleccione una gestión antes de generar el reporte.');
        return;
      }
      const toastId = toast.loading('Generando reporte general...');
      try {
        const url = `${API_BASE}/api/reportes/generar-reporte-general/?gestion=${gestion}`;
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Error al generar el reporte');
        }
        const blob = await res.blob();
        const fileUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = `reporte_documentos_${gestion}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(fileUrl);
        toast.success('Reporte descargado');
      } catch (err) {
        console.error('Error generando reporte general', err);
        toast.error(err.message || 'Error al generar el reporte');
      } finally {
        toast.dismiss(toastId);
      }
    };
    window.addEventListener('generate-pdf-documentos', handler);
    return () => window.removeEventListener('generate-pdf-documentos', handler);
  }, [gestionState, location?.state?.gestion]);

  const handleVerActividades = (docId, doc) => {
    const id = docId ?? doc?.id;
    if (!id) return;
    const gestionValue = getGestionNumberForDoc(doc);
    navigate(`/poa/objetivos-especificos/${id}`, {
      state: {
        gestion: gestionValue,
        gestionState: gestionValue,
      },
    });
  };

  const [deletingId, setDeletingId] = useState(null);
  const handleDelete = async (doc) => {
    try {
      const gestion = gestionState || location?.state?.gestion || (doc && doc.gestion) || '';
      if (!gestion) {
        // No hay gestión disponible: avisar al usuario para que seleccione o pase la gestión
        toast.error('No se pudo eliminar: falta la gestión (año). Seleccione la gestión antes de eliminar.');
        return;
      }

      if (!window.confirm('\u00BFConfirma que desea eliminar este documento? Esta acción no se puede deshacer.')) return;

      setDeletingId(doc.id);
      await deleteDocumentoPOA(doc.id, Number(gestion));
      // actualizar lista localmente
      setDocs(prev => (prev || []).filter(d => Number(d.id) !== Number(doc.id)));
      setDeletingId(null);
  toast.success('Documento eliminado');
    } catch (err) {
      setDeletingId(null);
      // mostrar detalle del error si existe
      const message = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || err?.message || 'Error al eliminar documento';
      toast.error(String(message));
    }
  };

  return (
    <section className="flex flex-col items-start justify-start flex-1 pb-4 px-1 w-full">
      <div className="w-full">
        {/* Local controls removed: 'Nuevo documento' now available in global header */}

        {showModal && <GestionSelectorModal onClose={handleClose} onSuccess={handleSuccess} />}
        {showNuevoModal && (
          <NuevoDocumentoModal
            onClose={closeNuevo}
            initialGestion={gestionState || location?.state?.gestion || new Date().getFullYear()}
            document={editingDoc}
            onCreated={async (created) => {
              try {
                const g = created?.gestion || created?.gestion || gestionState || location?.state?.gestion || (new Date().getFullYear());
                // Intentar recuperar la lista completa del año para mostrar todos los documentos
                if (g) {
                  const res = await getDocumentosPOAPorGestion(Number(g));
                  const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
                  setDocs(list || [created]);
                  setGestionState(g);
                } else {
                  setDocs(prev => [created, ...(prev || [])]);
                }
                toast.success('Documento creado correctamente');
              } catch (e) {
                // fallback: insertar el creado en la lista
                setDocs(prev => [created, ...(prev || [])]);
                toast.success('Documento creado correctamente');
              } finally {
                closeNuevo();
              }
            }}
            onUpdated={handleUpdated}
          />
        )}

        {/* Documentos en estado local */}
        {fromDialog && (
          <div className="mt-6">
            <h3 className="text-2xl font-bold text-blue-900 mb-4"> Gestión: {gestionState || location?.state?.gestion}</h3>
            <div className="grid grid-cols-1 gap-4 w-full">
              {docs && docs.length > 0 ? (
                docs.map((doc, idx) => (
                  <div key={doc.id || idx} className="w-full">
                    {(() => {
                      const estado = doc.estado || 'elaboracion';
                      const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.elaboracion;
                      const gestion = typeof doc.gestion === 'object' ? (doc.gestion.nombre || '') : (doc.gestion || gestionState);
                      const programa = typeof doc.programa === 'object' ? (doc.programa.nombre || '') : (doc.programa || '');
                      const unidad = typeof doc.unidad_solicitante === 'object' ? (doc.unidad_solicitante.nombre || '') : (doc.unidad_solicitante || '');
                      const entidad = typeof doc.entidad === 'object' ? (doc.entidad.nombre || DEFAULT_ENTIDAD) : (doc.entidad || DEFAULT_ENTIDAD);
                      const objetivo = typeof doc.objetivo_gestion_institucional === 'object' ? (doc.objetivo_gestion_institucional.nombre || '') : (doc.objetivo_gestion_institucional || '');
                      return (
                        <div
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerActividades(doc.id, doc); } }}
                          onClick={() => handleVerActividades(doc.id, doc)}
                          className="poa-futura-card cursor-pointer group focus:outline-none flex flex-row overflow-hidden w-full"
                        >
                          {/* Columna izquierda: AÑO con gradiente de estado */}
                          <div className={`poa-futura-year bg-gradient-to-b ${cfg.strip} flex flex-col items-center justify-center px-8 py-7 flex-shrink-0 min-w-[170px] relative gap-1.5`}>
                            {/* Grid decorativo de fondo */}
                            <div className="poa-futura-year-grid" />
                            <div className="text-8xl font-black leading-none tracking-tighter text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] relative z-10 font-mono">{gestion}</div>
                            <div className="text-[0.6rem] uppercase tracking-[0.25em] font-bold text-white/60 relative z-10">Gestión</div>
                            {doc.fecha_elaboracion && (
                              <div className="mt-3 text-center border-t border-white/20 pt-2.5 w-full relative z-10">
                                <div className="text-[0.55rem] uppercase tracking-[0.2em] font-bold text-white/50">Elaboración</div>
                                <div className="text-xs font-bold text-white/80 font-mono mt-0.5">{doc.fecha_elaboracion}</div>
                              </div>
                            )}
                            {/* Línea brillante derecha */}
                            <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent" />
                          </div>

                          {/* Columna derecha: contenido */}
                          <div className="flex flex-col flex-1 min-w-0 px-7 py-5 gap-3 justify-between">

                            {/* Fila superior: entidad + badge estado */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className={`w-1 h-4 rounded-full bg-gradient-to-b ${cfg.strip} flex-shrink-0`} />
                                <FaBuilding className="text-xs poa-futura-icon flex-shrink-0" />
                                <span className="poa-futura-label text-[0.65rem] uppercase tracking-[0.18em] font-bold">{entidad}</span>
                              </div>
                              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[0.72rem] font-bold whitespace-nowrap ${cfg.badge}`}>
                                <span className={`w-2 h-2 rounded-full animate-pulse ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </div>

                            {/* Programa */}
                            {programa && (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <FaLayerGroup className="text-[0.6rem] poa-futura-accent" />
                                  <span className="poa-futura-accent text-[0.6rem] uppercase tracking-[0.2em] font-bold">Programa</span>
                                </div>
                                <div className="poa-futura-title text-2xl font-black tracking-tight leading-tight mt-0.5">{programa}</div>
                              </div>
                            )}

                            {/* Unidad como chip */}
                            {unidad && (
                              <div className="flex items-center gap-2">
                                <FaBriefcase className="text-xs poa-futura-icon" />
                                <span className="poa-futura-label text-[0.6rem] uppercase tracking-[0.18em] font-bold">Unidad</span>
                                <span className="poa-futura-chip px-3 py-0.5 rounded-full text-xs font-bold">{unidad}</span>
                              </div>
                            )}

                            {/* Separador luminoso */}
                            <div className="poa-futura-divider" />

                            {/* Objetivo */}
                            {objetivo && (
                              <div className="poa-futura-obj-box rounded-xl px-4 py-2.5 flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <FaBullseye className="text-xs poa-futura-accent" />
                                  <span className="poa-futura-accent text-[0.6rem] uppercase tracking-[0.2em] font-bold">Objetivo institucional</span>
                                </div>
                                <p className="poa-futura-body text-sm leading-relaxed line-clamp-2">{objetivo}</p>
                              </div>
                            )}

                            {/* Acciones */}
                            <div className="flex items-center justify-end gap-3 pt-1">
                              <IconButton showIcon icon={<FaEdit />} onClick={(e) => { e.stopPropagation(); openEdit(doc); }} className="poa-futura-btn-edit font-bold py-2 px-6 text-sm rounded-xl transition-all">Editar</IconButton>
                              <IconButton showIcon icon={<FaTrash />} onClick={(e) => { e.stopPropagation(); handleDelete(doc); }} disabled={deletingId === doc.id} className={`${deletingId === doc.id ? 'opacity-50 cursor-not-allowed poa-futura-btn-delete' : 'poa-futura-btn-delete'} font-bold py-2 px-6 text-sm rounded-xl transition-all`}>{deletingId === doc.id ? 'Eliminando...' : 'Eliminar'}</IconButton>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-gray-500">No hay documentos para mostrar.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DocumentosPOAPage;
