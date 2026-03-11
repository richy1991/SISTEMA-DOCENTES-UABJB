import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_ENTIDAD } from '../config/defaults';
import GestionSelectorModal from '../components/GestionSelectorModal';
import NuevoDocumentoModal from '../components/NuevoDocumentoModal';
import IconButton from '../components/IconButton';
import { FaEdit, FaTrash, FaBuilding, FaCalendarAlt, FaLayerGroup, FaBriefcase, FaBullseye } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteDocumentoPOA, getDocumentosPOAPorGestion, API_BASE } from '../../../apis/poa.api';

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
    navigate(`/objetivos-especificos/${id}`, {
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
    <section className="flex flex-col items-center justify-start flex-1 pb-4 px-4 w-full">
      <div className="w-full max-w-6xl">
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
            <h3 className="text-2xl font-bold text-blue-900 mb-2"> Gestión: {gestionState || location?.state?.gestion}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full max-w-5xl mx-auto">
              {docs && docs.length > 0 ? (
                docs.map((doc, idx) => (
                  <div key={doc.id || idx} className="w-full">
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerActividades(doc.id, doc); } }}
                      onClick={() => handleVerActividades(doc.id, doc)}
                      className="card-refined card-elegant p-1.5 md:p-2.5 flex flex-col gap-1.5 md:gap-2 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {/* Contenido compacto y moderno, igual que Home */}
                      <div className="flex flex-col gap-2 w-full">
                        {/* Fila: Entidad y Gestión siempre lado a lado */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                              <FaBuilding className="text-[10px] md:text-[12px]" />
                            </span>
                            <div>
                              <div className="text-[0.6rem] md:text-[0.66rem] uppercase tracking-wide text-blue-700/90 font-semibold card-kv-label">Entidad</div>
                              <div className="text-[0.72rem] md:text-[0.8rem] text-slate-800 font-semibold card-kv-value">{typeof doc.entidad === 'object' ? (doc.entidad.nombre || JSON.stringify(doc.entidad)) : (doc.entidad || DEFAULT_ENTIDAD)}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                              <FaCalendarAlt className="text-[10px] md:text-[12px]" />
                            </span>
                            <div>
                              <div className="text-[0.6rem] md:text-[0.66rem] uppercase tracking-wide text-blue-700/90 font-semibold card-kv-label">Gestión</div>
                              <div className="text-[0.72rem] md:text-[0.8rem] text-slate-800 font-semibold card-kv-value">{typeof doc.gestion === 'object' ? (doc.gestion.nombre || JSON.stringify(doc.gestion)) : (doc.gestion || location.state.gestion)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Resto: Programa y Unidad en una columna */}
                        {doc?.programa && (
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                              <FaLayerGroup className="text-[10px] md:text-[12px]" />
                            </span>
                            <div>
                              <div className="text-[0.6rem] md:text-[0.66rem] uppercase tracking-wide text-blue-700/90 font-semibold card-kv-label">Programa</div>
                              <div className="text-[0.72rem] md:text-[0.8rem] text-slate-800 font-semibold card-kv-value">{typeof doc.programa === 'object' ? (doc.programa.nombre || JSON.stringify(doc.programa)) : (doc.programa || 'N/A')}</div>
                            </div>
                          </div>
                        )}
                        {doc?.unidad_solicitante && (
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                              <FaBriefcase className="text-[10px] md:text-[12px]" />
                            </span>
                            <div>
                              <div className="text-[0.6rem] md:text-[0.66rem] uppercase tracking-wide text-blue-700/90 font-semibold card-kv-label">Unidad solicitante</div>
                              <div className="text-[0.72rem] md:text-[0.8rem] text-slate-800 font-semibold card-kv-value">{typeof doc.unidad_solicitante === 'object' ? (doc.unidad_solicitante.nombre || JSON.stringify(doc.unidad_solicitante)) : (doc.unidad_solicitante || 'N/A')}</div>
                            </div>
                          </div>
                        )}

                        {/* Objetivo con etiqueta y clamp */}
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                            <FaBullseye className="text-[10px] md:text-[12px]" />
                          </span>
                          <span className="rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.66rem] bg-blue-100 text-blue-800 border border-blue-200 objective-pill">Objetivo de gestión institucional</span>
                        </div>
                        <p className="text-[0.72rem] md:text-[0.8rem] text-slate-800 leading-snug line-clamp-4 card-objective">{typeof doc.objetivo_gestion_institucional === 'object' ? (doc.objetivo_gestion_institucional.nombre || JSON.stringify(doc.objetivo_gestion_institucional)) : (doc.objetivo_gestion_institucional || 'N/A')}</p>
                      </div>

                      {/* Acciones: colocadas al final, a la derecha */}
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <IconButton showIcon icon={<FaEdit />} onClick={(e) => { e.stopPropagation(); openEdit(doc); }} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-1 px-3 text-xs md:text-sm rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition duration-300">Editar</IconButton>
                        <IconButton showIcon icon={<FaTrash />} onClick={(e) => { e.stopPropagation(); handleDelete(doc); }} disabled={deletingId === doc.id} className={`${deletingId === doc.id ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-1 px-3 text-xs md:text-sm rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition duration-300'} text-white rounded`} title={deletingId === doc.id ? 'Eliminando...' : 'Eliminar'}>{deletingId === doc.id ? 'Eliminando...' : 'Eliminar'}</IconButton>
                      </div>
                    </div>
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
