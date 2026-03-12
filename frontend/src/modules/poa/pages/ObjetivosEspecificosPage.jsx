import React, { useEffect, useState } from 'react';
import { getObjetivosEspecificos, deleteObjetivo, getDocumentoPOAPorId, getDocumentosPOAEncabezados, getActividadesPorObjetivo } from '../../../apis/poa.api';
import { DEFAULT_ENTIDAD } from '../config/defaults';
import NuevoObjetivoModal from '../components/NuevoObjetivoModal';
import IconButton from '../components/IconButton';
import { FaEdit, FaTrash, FaUniversity, FaCalendarAlt, FaLayerGroup, FaBuilding, FaBullseye } from 'react-icons/fa';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

// Página que muestra los objetivos específicos relacionados a un documento
const ObjetivosEspecificosPage = () => {
  const { documentId } = useParams();
  const [objetivos, setObjetivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [documentHeader, setDocumentHeader] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const navigate = useNavigate();
  const [editingObjetivo, setEditingObjetivo] = useState(null);
  const location = useLocation();
  const [recursosPorObjetivo, setRecursosPorObjetivo] = useState({});
  const [actividadesCountPorObjetivo, setActividadesCountPorObjetivo] = useState({});

  // Helper: parse codigo to number for sorting. Strategy:
  // - extract the LAST contiguous digit-sequence in the codigo string (e.g. 'OE-12-A' -> 12)
  // - if no numeric sequence is found, treat it as Infinity so it sorts to the end
  // - return a tuple-like comparison: numeric part first, then full codigo as tiebreaker
  const codigoToNumber = (c) => {
    if (c === undefined || c === null) return Infinity;
    const s = String(c).trim();
    // find all digit sequences and take the last one
    const matches = s.match(/\d+/g);
    if (!matches || matches.length === 0) return Infinity;
    const last = matches[matches.length - 1];
    const n = Number(last);
    return Number.isNaN(n) ? Infinity : n;
  };

  const normalizeMonto = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    const cleaned = String(value).replace(/\s/g, '').replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const formatMonto = (value) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return '0,00';
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const sortByCodigo = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice().sort((a, b) => {
      const aNum = codigoToNumber(a?.codigo);
      const bNum = codigoToNumber(b?.codigo);
      if (aNum !== bNum) return aNum - bNum;
      // numeric parts equal (or both Infinity) -> fallback to stable text comparison
      const aCode = String(a?.codigo ?? '').trim();
      const bCode = String(b?.codigo ?? '').trim();
      return aCode.localeCompare(bCode, undefined, { sensitivity: 'base', numeric: true });
    });
  };

  // Detecta si un objetivo pertenece al documento (búsqueda recursiva sobre claves y valores)
  const objetivoPerteneceAlDocumento = (obj, docId) => {
    if (!obj) return false;
    const idStr = String(docId);
    const keyIndicators = ['document', 'documento', 'doc', 'encabezado', 'documento_id', 'document_id'];

    const search = (value, pathKey) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          for (const v of value) if (search(v, pathKey)) return true;
          return false;
        }
        // Si el objeto tiene id
        if (value.id !== undefined && String(value.id) === idStr) return true;
        for (const k of Object.keys(value)) {
          const v = value[k];
          const lowerK = String(k).toLowerCase();
          if (keyIndicators.some(ind => lowerK.includes(ind))) {
            if (v !== undefined && v !== null) {
              if (typeof v === 'object') {
                if (v.id !== undefined && String(v.id) === idStr) return true;
              } else {
                if (String(v) === idStr) return true;
              }
            }
          }
          if (search(v, k)) return true;
        }
        return false;
      } else {
        if (!pathKey) return false;
        const lowerKey = String(pathKey).toLowerCase();
        if (keyIndicators.some(ind => lowerKey.includes(ind)) && String(value) === idStr) return true;
        return false;
      }
    };

    return search(obj, null);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    getObjetivosEspecificos(documentId)
      .then(res => {
        const objs = Array.isArray(res.data) ? res.data : (res.data.results || []);
        const filtered = objs.filter(o => objetivoPerteneceAlDocumento(o, documentId));
  const finalList = filtered.length > 0 ? filtered : objs; // si backend ya filtró, usamos objs
  setObjetivos(sortByCodigo(finalList));

  // intentar obtener encabezado del documento desde los datos recibidos (si está embebido)
  try {
    if (finalList && finalList.length > 0) {
      // Buscar claves comunes que puedan contener información del documento
      const first = finalList[0];
      const tryDoc = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const candidates = ['documento', 'document', 'encabezado', 'documento_id', 'header', 'doc'];
        for (const k of Object.keys(obj)) {
          if (candidates.includes(k)) {
            const v = obj[k];
            if (v && typeof v === 'object') return v;
          }
        }
        return null;
      };
      const embedded = tryDoc(first) || tryDoc(finalList.find(Boolean));
      if (embedded) {
        setDocumentHeader(embedded);
      } else {
        // intentar recuperar encabezado: primero si la ubicación tiene `gestion`, pedir el documento completo al backend
        const gestion = location?.state?.gestion ?? location?.state?.gestionState ?? null;
        if (gestion) {
          setDocLoading(true);
          getDocumentoPOAPorId(Number(documentId), Number(gestion))
            .then(r => setDocumentHeader(r.data))
            .catch(() => setDocumentHeader(null))
            .finally(() => setDocLoading(false));
        } else {
          // Si no hay gestion en el state, consultar encabezados (devuelve gestión actual si no se pasa param)
          setDocLoading(true);
          getDocumentosPOAEncabezados()
            .then(r => {
              const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
              const found = list.find(d => String(d.id) === String(documentId) || String(d.pk) === String(documentId));
              if (found) setDocumentHeader(found);
              else setDocumentHeader(null);
            })
            .catch(() => setDocumentHeader(null))
            .finally(() => setDocLoading(false));
        }
      }
    }
  } catch (e) {
    // silencioso
  }
      })
      .catch(err => {
        setError(err?.response?.data?.detail || err?.message || 'Error al cargar objetivos');
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!objetivos || objetivos.length === 0) {
      setRecursosPorObjetivo({});
      setActividadesCountPorObjetivo({});
      return;
    }
    let mounted = true;

    const fetchTotals = async () => {
      const promises = objetivos.map(obj =>
        getActividadesPorObjetivo(obj.id, documentId)
          .then(res => ({
            objetivoId: obj.id,
            actividades: Array.isArray(res.data) ? res.data : (res.data?.results || [])
          }))
          .catch(() => ({ objetivoId: obj.id, actividades: [] }))
      );
      const results = await Promise.all(promises);
      if (!mounted) return;
      const totals = {};
      const counts = {};
      results.forEach(({ objetivoId, actividades }) => {
        const sum = actividades.reduce((acc, actividad) => {
          const funcion = normalizeMonto(actividad.monto_funcion ?? actividad.monto_funcion_valor ?? actividad.monto_funcion_bs);
          const inversion = normalizeMonto(actividad.monto_inversion ?? actividad.monto_inversion_valor ?? actividad.monto_inversion_bs);
          return acc + funcion + inversion;
        }, 0);
        totals[objetivoId] = sum;
        counts[objetivoId] = Array.isArray(actividades) ? actividades.length : 0;
      });
      setRecursosPorObjetivo(totals);
      setActividadesCountPorObjetivo(counts);
    };

    fetchTotals();

    return () => { mounted = false; };
  }, [objetivos, documentId]);

  const openNuevo = () => { setEditingObjetivo(null); setShowNuevo(true); };
  const closeNuevo = () => { setEditingObjetivo(null); setShowNuevo(false); };

  const openEdit = (obj) => { setEditingObjetivo(obj); setShowNuevo(true); };

  const handleDeleted = async (id) => {
    if (!window.confirm('¿Confirma eliminar este objetivo?')) return;
    try {
      await deleteObjetivo(id);
      setObjetivos(prev => (prev || []).filter(o => Number(o.id) !== Number(id)));
      toast.success('Objetivo eliminado');
    } catch (err) {
      const msg = err?.response?.data || err?.message || '';
      toast.error('Error eliminando objetivo: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const handleUpdated = (updated) => {
    setObjetivos(prev => (prev || []).map(o => (Number(o.id) === Number(updated.id) ? updated : o)));
    closeNuevo();
  };

  // Listen for header 'Nuevo' button events
  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.page === 'objetivos') openNuevo();
    };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, []);


  const handleVerActividades = (objetivoId) => navigate(`/poa/actividades/${objetivoId}`);

  return (
    <section className="flex flex-col items-center justify-start flex-1 pb-4 px-4 w-full">
        {/* Header controls moved to global header; page-level controls removed */}
        {/* Mostrar encabezado del documento (solo datos solicitados, alineados a la izquierda como título) */}
        {documentHeader && (
          <div className="w-full max-w-5xl mx-auto mb-3">
            <div className="card-refined card-elegant p-2 md:p-3 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                    <FaUniversity className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </span>
                  <span className="code-badge inline-block rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.8rem] font-semibold">ENTIDAD</span>
                  <div className="text-[0.72rem] md:text-[0.9rem] card-kv-value font-semibold">
                    {documentHeader.entidad ? (typeof documentHeader.entidad === 'object' ? (documentHeader.entidad.nombre || String(documentHeader.entidad)) : documentHeader.entidad) : DEFAULT_ENTIDAD}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                    <FaCalendarAlt className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </span>
                  <span className="code-badge inline-block rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.8rem] font-semibold">GESTIÓN</span>
                  <div className="text-[0.72rem] md:text-[0.9rem] card-kv-value font-semibold">
                    {documentHeader.gestion || documentHeader.gestion_nombre || ''}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                    <FaLayerGroup className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </span>
                  <span className="code-badge inline-block rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.8rem] font-semibold">PROGRAMA</span>
                  <div className="text-[0.72rem] md:text-[0.9rem] card-kv-value font-semibold">
                    {documentHeader.programa ? (typeof documentHeader.programa === 'object' ? (documentHeader.programa.nombre || String(documentHeader.programa)) : documentHeader.programa) : ''}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                    <FaBuilding className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </span>
                  <span className="code-badge inline-block rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.8rem] font-semibold">UNIDAD SOLICITANTE</span>
                  <div className="text-[0.72rem] md:text-[0.9rem] card-kv-value font-semibold">
                    {documentHeader.unidad_solicitante ? (typeof documentHeader.unidad_solicitante === 'object' ? (documentHeader.unidad_solicitante.nombre || String(documentHeader.unidad_solicitante)) : documentHeader.unidad_solicitante) : ''}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                    <FaBullseye className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </span>
                  <span className="code-badge inline-block rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.8rem] font-semibold">OBJETIVO DE GESTIÓN INSTITUCIONAL</span>
                </div>
                <p className="text-[0.72rem] md:text-[0.9rem] leading-snug card-objective">
                  {documentHeader.objetivo_gestion_institucional ? (typeof documentHeader.objetivo_gestion_institucional === 'object' ? (documentHeader.objetivo_gestion_institucional.nombre || documentHeader.objetivo_gestion_institucional.descripcion || String(documentHeader.objetivo_gestion_institucional)) : documentHeader.objetivo_gestion_institucional) : ''}
                </p>
              </div>
            </div>
          </div>
        )}
        {showNuevo && (
          <NuevoObjetivoModal
            documentoId={documentId}
            objetivo={editingObjetivo}
            existingObjetivos={objetivos}
            onClose={closeNuevo}
            onCreated={(obj) => { setObjetivos(prev => sortByCodigo([...(prev || []), obj])); closeNuevo(); }}
            onUpdated={handleUpdated}
          />
        )}
      {loading && <div className="text-blue-800">Cargando objetivos específicos...</div>}

      {error && (
        <div className="text-red-600">
          {error} <br />
          Por favor, verifica que el backend esté corriendo y que la configuración CORS permita esta petición.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full max-w-5xl mx-auto">
        {objetivos && objetivos.length > 0 ? (
          objetivos.map((obj, idx) => {
            const total = recursosPorObjetivo[obj.id] ?? 0;
            const actCount = actividadesCountPorObjetivo[obj.id] ?? 0;
            return (
              <div key={obj.id || idx} className="w-full">
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerActividades(obj.id); } }}
                  onClick={() => handleVerActividades(obj.id)}
                  className="card-refined card-elegant oe-modern p-1.5 md:p-2.5 flex flex-col gap-1.5 md:gap-2 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {/* Encabezado compacto: código como badge y total al lado derecho */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="code-badge inline-block rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.8rem] font-semibold">
                      {obj.codigo}
                    </span>
                    <div className="flex items-center gap-2">
                      {total > 0 && (
                        <div className="text-[0.6rem] md:text-[0.8rem] font-semibold card-kv-label">
                          Presupuesto: <span className="card-kv-value">{formatMonto(total)}</span>
                        </div>
                      )}
                      <span className={`activity-badge ${actCount === 0 ? 'is-zero' : ''} inline-flex items-center justify-center rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.75rem]`}>
                        {actCount} actividades
                      </span>
                    </div>
                  </div>

                  {/* Descripción elegante */}
                  <p className="text-[0.7rem] md:text-[0.9rem] leading-snug line-clamp-4 card-objective">
                    {obj.nombre || obj.descripcion || JSON.stringify(obj)}
                  </p>

                  {/* Acciones al pie derecho */}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <IconButton icon={<FaEdit />} onClick={(e) => { e.stopPropagation(); openEdit(obj); }} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-0.5 md:py-1 px-2.5 md:px-3 text-[0.65rem] md:text-sm rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition duration-300" title="Editar">Editar</IconButton>
                    <IconButton icon={<FaTrash />} onClick={(e) => { e.stopPropagation(); handleDeleted(obj.id); }} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-0.5 md:py-1 px-2.5 md:px-3 text-[0.65rem] md:text-sm rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition duration-300" title="Eliminar">Eliminar</IconButton>
                  </div>
                </div>
              </div>
            );
          })
        ) : !loading && !error ? (
          <div className="col-span-full text-gray-500">No hay objetivos específicos para mostrar.</div>
        ) : null}
      </div>

      
    </section>
  );
};

export default ObjetivosEspecificosPage;
