import React, { useEffect, useMemo, useState } from 'react';
import { getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaUniversity,
  FaCalendarAlt,
  FaBuilding,
  FaBullseye,
  FaChevronRight,
  FaFileAlt,
  FaCheckCircle,
  FaClock,
  FaLayerGroup,
} from 'react-icons/fa';

const POAHomePage = () => {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const resolveGestionCandidate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
      return value.id ?? value.pk ?? value.gestion ?? value.nombre ?? value;
    }
    return value;
  };

  const getGestionForDoc = (doc) => {
    const candidate = resolveGestionCandidate(doc?.gestion);
    if (candidate === null || candidate === undefined) return null;
    const numeric = Number(candidate);
    return (!Number.isNaN(numeric) && Number.isFinite(numeric)) ? numeric : null;
  };

  const normalizeApiError = (err, fallbackMessage) => {
    const detail = err?.response?.data?.detail ?? err?.response?.data;
    if (typeof detail === 'string') {
      const normalized = detail.trim();
      if (normalized.startsWith('<!DOCTYPE html') || normalized.startsWith('<html') || normalized.includes('OperationError')) {
        return fallbackMessage;
      }
      return normalized;
    }
    if (detail && typeof detail === 'object') {
      try {
        return JSON.stringify(detail);
      } catch {
        return fallbackMessage;
      }
    }
    return err?.message || fallbackMessage;
  };

  const getUnidadSolicitanteLabel = (doc) => {
    const carrera = doc?.unidad_solicitante_detalle;
    if (carrera && typeof carrera === 'object') {
      return carrera.nombre || carrera.codigo || `Carrera #${carrera.id}`;
    }
    if (typeof doc?.unidad_solicitante === 'object') {
      return doc.unidad_solicitante.nombre || doc.unidad_solicitante.codigo || '';
    }
    return String(doc?.unidad_solicitante || '').trim();
  };

  useEffect(() => {
    setLoading(true);
    const currentYear = new Date().getFullYear();
    getDocumentosPOAPorGestion(currentYear)
      .then((res) => {
        const data = res.data;
        let docs = [];
        if (Array.isArray(data)) docs = data;
        else if (Array.isArray(data.results)) docs = data.results;
        else if (Array.isArray(data.documentos)) docs = data.documentos;
        else if (Array.isArray(data.data)) docs = data.data;
        else {
          for (const key of ['results', 'documentos', 'data']) {
            if (Array.isArray(data[key])) {
              docs = data[key];
              break;
            }
          }
        }
        setDocumentos(docs);
        setLoading(false);
      })
      .catch((err) => {
        setError(normalizeApiError(err, 'Error al cargar los documentos POA.'));
        setLoading(false);
      });
  }, []);

  const resumen = useMemo(() => {
    const list = Array.isArray(documentos) ? documentos : [];
    const total = list.length;
    const programas = new Set(list.map((d) => String(d?.programa || '').trim()).filter(Boolean)).size;
    const unidades = new Set(list.map((d) => String(getUnidadSolicitanteLabel(d) || '').trim()).filter(Boolean)).size;
    const observados = list.filter((d) => String(d?.estado || '').toLowerCase() === 'observado').length;
    const enRevision = list.filter((d) => String(d?.estado || '').toLowerCase() === 'revision').length;
    return { total, programas, unidades, observados, enRevision };
  }, [documentos]);

  const handleVerActividades = (doc) => {
    if (!doc?.id) return;
    const gestionValue = getGestionForDoc(doc);
    navigate(`/poa/objetivos-especificos/${doc.id}`, {
      state: {
        gestion: gestionValue,
        gestionState: gestionValue,
      },
    });
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  };

  return (
    <section className="flex flex-col items-stretch justify-start flex-1 pb-6 w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-[1500px] mx-auto"
      >
        <div className="rounded-2xl border border-blue-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/55 backdrop-blur-sm p-4 md:p-5 shadow-sm">
          <h2 className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-slate-100 leading-tight">
            Dashboard de Documentos POA
          </h2>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
            Vista central del modulo para abrir rapidamente cada documento desde sus tarjetas.
          </p>
        </div>

        {loading && <div className="mt-4 text-blue-800 dark:text-slate-200">Cargando documentos...</div>}
        {error && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {String(error)}
          </div>
        )}

        {!loading && !error && (
          <>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4"
            >
              {[
                { label: 'Total documentos', value: resumen.total, icon: <FaFileAlt /> },
                { label: 'Programas', value: resumen.programas, icon: <FaLayerGroup /> },
                { label: 'Unidades', value: resumen.unidades, icon: <FaBuilding /> },
                { label: 'En revision', value: resumen.enRevision, icon: <FaClock /> },
                { label: 'Observados', value: resumen.observados, icon: <FaCheckCircle /> },
              ].map((it) => (
                <motion.div
                  key={it.label}
                  variants={itemVariants}
                  className="rounded-xl border border-blue-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/60 px-3 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">{it.label}</p>
                    <span className="text-blue-600 dark:text-sky-300">{it.icon}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-blue-900 dark:text-slate-100 mt-1">{it.value}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-4 w-full mt-4"
            >
              {documentos && documentos.length > 0 ? (
                documentos.map((doc, idx) => {
                  const gestion = typeof doc.gestion === 'object' ? (doc.gestion.nombre || '') : (doc.gestion || 'N/A');
                  const programa = typeof doc.programa === 'object' ? (doc.programa.nombre || '') : (doc.programa || 'Sin programa');
                  const unidad = getUnidadSolicitanteLabel(doc) || 'No especificada';
                  const entidad = typeof doc.entidad === 'object' ? (doc.entidad.nombre || 'UABJB') : (doc.entidad || 'UABJB');
                  const objetivo = typeof doc.objetivo_gestion_institucional === 'object'
                    ? (doc.objetivo_gestion_institucional.nombre || '')
                    : (doc.objetivo_gestion_institucional || 'Sin objetivo registrado');

                  return (
                    <motion.div
                      key={doc.id || idx}
                      variants={itemVariants}
                      whileHover={{ y: -4 }}
                      className="relative bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border-2 border-blue-400/70 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20 w-full focus:outline-none"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleVerActividades(doc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleVerActividades(doc);
                        }
                      }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" />

                      <div className="grid grid-cols-12">
                        <div className="col-span-12 md:col-span-2 flex flex-col items-center justify-center gap-1 border-b md:border-b-0 md:border-r border-blue-300 dark:border-slate-800 bg-blue-100/50 dark:bg-transparent px-4 py-5">
                          <span className="text-4xl font-bold text-slate-900 dark:text-white font-mono leading-none">{gestion}</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Gestion</span>
                        </div>

                        <div className="col-span-12 md:col-span-10 p-5 bg-white/55 dark:bg-transparent">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-bold">
                              <FaUniversity size={10} /> Entidad: {entidad}
                            </span>
                          </div>

                          <div className="mb-3 space-y-2">
                            <div className="min-w-0">
                              <p className="text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Programa</p>
                              <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight truncate" title={programa}>{programa}</h3>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Unidad solicitante</p>
                              <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-sm truncate" title={unidad}>
                                <FaBuilding className="flex-shrink-0" size={11} />
                                <span className="truncate">{unidad}</span>
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 bg-blue-100/70 dark:bg-slate-950/50 border border-blue-300 dark:border-slate-800 rounded-lg p-3 flex gap-2 items-start">
                            <FaBullseye size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider mb-0.5">Objetivo institucional</p>
                              <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed line-clamp-2">{objetivo}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-end gap-2 text-blue-700/80 dark:text-sky-300">
                            <span className="text-xs font-semibold">Abrir actividades</span>
                            <FaChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="col-span-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/75 dark:bg-slate-900/60 px-4 py-6 text-center text-slate-500 dark:text-slate-300">
                  No hay documentos para mostrar en esta gestion.
                </div>
              )}
            </motion.div>
          </>
        )}
      </motion.div>
    </section>
  );
};

export default POAHomePage;
