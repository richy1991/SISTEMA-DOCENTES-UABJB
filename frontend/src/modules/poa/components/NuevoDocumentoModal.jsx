import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave, FaCalendarAlt } from 'react-icons/fa';
import { createDocumentoPOA, updateDocumentoPOA, getUsuariosPOA, getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import { Textarea, Modal } from './base';
import { DEFAULT_ENTIDAD } from '../config/defaults';
import { DEFAULT_ERROR_LABELS, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const ELABORADOR_ROLE = 'elaborador';
const DIRECTOR_ROLE = 'director_carrera';

const ERROR_LABELS = {
  ...DEFAULT_ERROR_LABELS,
};

const getPersonaNombre = (persona) => {
  if (!persona) return '';
  return (
    persona.nombre_display ||
    persona.docente_detalle?.nombre_completo ||
    persona.user_detalle?.nombre_completo ||
    persona.docente_detalle?.nombres ||
    persona.user_detalle?.username ||
    persona.nombre ||
    `Usuario POA #${persona.id}`
  );
};

const matchesPersonaQuery = (persona, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const candidates = [
    getPersonaNombre(persona),
    persona.user_detalle?.username,
    persona.rol_display,
  ].filter(Boolean);

  return candidates.some((value) => String(value).toLowerCase().includes(normalizedQuery));
};

const NuevoDocumentoModal = ({ onClose, onCreated, initialGestion, document: docToEdit, onUpdated }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const [form, setForm] = useState({
    entidad: DEFAULT_ENTIDAD,
    gestion: initialGestion || new Date().getFullYear(),
    programa: '',
    unidad_solicitante: '',
    objetivo_gestion_institucional: '',
    elaborado_por: '',
    jefe_unidad: '',
    observaciones: '',
  });
  const [fechaElab, setFechaElab] = useState('');
  const dateInputRef = React.useRef(null);
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const focusFirstError = (errors) => {
    const firstKey = Object.keys(errors || {})[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const field = document.querySelector(`[name="${firstKey}"]`);
      if (field) {
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const [personas, setPersonas] = useState([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [personasError, setPersonasError] = useState(null);

  const [elabQuery, setElabQuery] = useState('');
  const [elabFilteredPersonas, setElabFilteredPersonas] = useState([]);
  const [showElabDropdown, setShowElabDropdown] = useState(false);
  const [elabHighlight, setElabHighlight] = useState(0);

  const [jefeQuery, setJefeQuery] = useState('');
  const [jefeFilteredPersonas, setJefeFilteredPersonas] = useState([]);
  const [showJefeDropdown, setShowJefeDropdown] = useState(false);
  const [jefeHighlight, setJefeHighlight] = useState(0);
  const [justificacionEdicion, setJustificacionEdicion] = useState('');

  const requiereJustificacionEdicion = Boolean(
    docToEdit?.id && ['aprobado', 'ejecucion'].includes(String(docToEdit?.estado || '').toLowerCase())
  );

  useEffect(() => {
    setPersonasLoading(true);
    getUsuariosPOA({ activo: true })
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data.results || []);
        const list = raw.map(p => ({
          id: p.id,
          nombre: getPersonaNombre(p),
          username: p.user_detalle?.username || '',
          rol: p.rol || '',
          rol_display: p.rol_display || '',
          activo: Boolean(p.activo),
          raw: p,
        })).filter(x => x.id !== null);
        setPersonas(list);
      })
      .catch(err => setPersonasError(err?.response?.data || err.message || 'Error al cargar usuarios POA'))
      .finally(() => setPersonasLoading(false));
  }, []);

  useEffect(() => {
    if (initialGestion) {
      setForm(f => ({ ...f, gestion: initialGestion }));
    }
  }, [initialGestion]);

  useEffect(() => {
    if (!docToEdit) return;
    try {
      setForm(f => ({
        ...f,
        entidad: docToEdit.entidad ?? DEFAULT_ENTIDAD,
        gestion: (docToEdit.gestion ?? initialGestion) || new Date().getFullYear(),
        programa: typeof docToEdit.programa === 'object' ? (docToEdit.programa.nombre || docToEdit.programa) : (docToEdit.programa || ''),
        unidad_solicitante: docToEdit.unidad_solicitante?.nombre ?? docToEdit.unidad_solicitante ?? docToEdit.unidad_solicitante_id ?? '',
        objetivo_gestion_institucional: docToEdit.objetivo_gestion_institucional ?? '',
        elaborado_por: docToEdit.elaborado_por?.id ?? docToEdit.elaborado_por_id ?? docToEdit.elaborado_por ?? '',
        jefe_unidad: docToEdit.jefe_unidad?.id ?? docToEdit.jefe_unidad_id ?? docToEdit.jefe_unidad ?? '',
        observaciones: docToEdit.observaciones ?? '',
      }));
      setFechaElab(docToEdit.fecha_elaboracion ? String(docToEdit.fecha_elaboracion).slice(0,10) : '');
      setElabQuery(docToEdit.elaborado_por?.nombre_display ?? docToEdit.elaborado_por?.nombre ?? docToEdit.elaborado_por?.user?.username ?? (typeof docToEdit.elaborado_por === 'string' ? docToEdit.elaborado_por : ''));
      setJefeQuery(docToEdit.jefe_unidad?.nombre_display ?? docToEdit.jefe_unidad?.nombre ?? docToEdit.jefe_unidad?.user?.username ?? (typeof docToEdit.jefe_unidad === 'string' ? docToEdit.jefe_unidad : ''));
      setJustificacionEdicion('');
    } catch (e) {
      // ignore
    }
  }, [docToEdit, initialGestion]);

  useEffect(() => {
    let mounted = true;
    const elaboradores = personas.filter(p => p.activo && p.rol === ELABORADOR_ROLE && String(p.id) !== String(form.jefe_unidad));
    if (!elabQuery || elabQuery.trim().length === 0) {
      setElabFilteredPersonas(elaboradores.slice(0, 10));
      return undefined;
    }
    const q = elabQuery.trim();
    const t = setTimeout(() => {
      const filtered = elaboradores.filter(p => matchesPersonaQuery(p, q));
      if (mounted) { setElabFilteredPersonas(filtered.slice(0,50)); setElabHighlight(0); }
    }, 200);
    return () => { mounted = false; clearTimeout(t); };
  }, [elabQuery, personas, form.jefe_unidad]);

  useEffect(() => {
    let mounted = true;
    const directores = personas.filter(p => p.activo && p.rol === DIRECTOR_ROLE && String(p.id) !== String(form.elaborado_por));
    if (!jefeQuery || jefeQuery.trim().length === 0) {
      setJefeFilteredPersonas(directores.slice(0, 10));
      return undefined;
    }
    const q = jefeQuery.trim();
    const t = setTimeout(() => {
      const filtered = directores.filter(p => matchesPersonaQuery(p, q));
      if (mounted) { setJefeFilteredPersonas(filtered.slice(0,50)); setJefeHighlight(0); }
    }, 200);
    return () => { mounted = false; clearTimeout(t); };
  }, [jefeQuery, personas, form.elaborado_por]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCreate = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setErrorMessages([]);
    setFieldErrors({});
    if (!form.gestion || !form.unidad_solicitante) {
      const nextErrors = {};
      if (!form.gestion) nextErrors.gestion = 'Este campo es obligatorio.';
      if (!form.unidad_solicitante) nextErrors.unidad_solicitante = 'Este campo es obligatorio.';
      setFieldErrors(nextErrors);
      setErrorMessages(['Gestión: este campo es obligatorio.', 'Unidad solicitante: este campo es obligatorio.']);
      focusFirstError(nextErrors);
      return;
    }
    if (form.elaborado_por && form.jefe_unidad && String(form.elaborado_por) === String(form.jefe_unidad)) {
      const nextErrors = { elaborado_por_id: 'Debe ser diferente de Jefe de unidad.', jefe_unidad_id: 'Debe ser diferente de Elaborado por.' };
      setFieldErrors(nextErrors);
      setErrorMessages(['Validación general: "Elaborado por" y "Jefe de unidad" deben ser personas diferentes.']);
      focusFirstError(nextErrors);
      return;
    }
    if (docToEdit?.id && requiereJustificacionEdicion && !String(justificacionEdicion || '').trim()) {
      const nextErrors = { justificacion_edicion: 'Este campo es obligatorio para editar documentos aprobados o en ejecución.' };
      setFieldErrors(nextErrors);
      setErrorMessages(['Justificación de edición: este campo es obligatorio para editar documentos aprobados o en ejecución.']);
      focusFirstError(nextErrors);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        entidad: DEFAULT_ENTIDAD,
        gestion: Number(form.gestion),
        programa: form.programa || null,
        objetivo_gestion_institucional: form.objetivo_gestion_institucional || null,
        unidad_solicitante: form.unidad_solicitante || null,
        elaborado_por_id: form.elaborado_por ? Number(form.elaborado_por) : null,
        jefe_unidad_id: form.jefe_unidad ? Number(form.jefe_unidad) : null,
        fecha_elaboracion: fechaElab || null,
        observaciones: form.observaciones || '',
      };

      if (docToEdit?.id && requiereJustificacionEdicion) {
        payload.justificacion_edicion = String(justificacionEdicion || '').trim();
      }

      if (docToEdit && docToEdit.id) {
        const res = await updateDocumentoPOA(docToEdit.id, payload, Number(payload.gestion));
        const updated = res?.data;
        toast.success('Edición guardada');
        if (onUpdated) onUpdated(updated || res.data);
        if (onClose) onClose();
      } else {
        payload.estado = 'elaboracion';
        const res = await createDocumentoPOA(payload);
        let created = res?.data;
        if ((!created || (typeof created === 'object' && Object.keys(created).length === 0)) && res && (res.status === 201 || res.status === 200)) {
          try {
            const listRes = await getDocumentosPOAPorGestion(payload.gestion);
            const list = Array.isArray(listRes.data) ? listRes.data : (listRes.data.results || listRes.data.documentos || []);
            if (payload.unidad_solicitante || payload.programa) {
              const candidate = list.find(d => (payload.unidad_solicitante ? (d.unidad_solicitante === payload.unidad_solicitante) : false) && (payload.programa ? (d.programa === payload.programa || (d.programa && d.programa.nombre === payload.programa)) : true));
              if (candidate) created = candidate;
            }
            if (!created && list.length > 0) {
              const byId = list.filter(d => d && d.id).sort((a,b) => Number(b.id) - Number(a.id));
              created = byId.length > 0 ? byId[0] : list[0];
            }
          } catch (e) {
            // no hacemos nada especial
          }
        }

        if (onCreated) onCreated(created || res.data);
        toast.success('Documento creado correctamente');
        if (onClose) onClose();
      }
    } catch (err) {
      const resp = err?.response?.data;
      const nextFieldErrors = mapApiErrorsToFieldErrors(resp || {});
      setFieldErrors(nextFieldErrors);
      const messages = formatApiErrors(resp || err?.message || 'Error al crear documento');
      setErrorMessages(messages);
      toast.error(messages[0] || 'Error al guardar documento');
      focusFirstError(nextFieldErrors);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-11/12 max-w-2xl">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="font-semibold text-lg truncate">{docToEdit ? 'Editar Documento POA' : 'Nuevo Documento POA'}</div>
            <span className="inline-flex items-center rounded-md border border-blue-300/60 bg-blue-500/15 px-3 py-1 text-sm font-semibold text-blue-100">
              Gestion: {form.gestion || initialGestion || new Date().getFullYear()}
            </span>
          </div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="card-divider" />
        <div className="px-8 py-6 modal-body">

          <ModalErrorAlert title="No se pudo guardar el documento:" messages={errorMessages} />

          <form onSubmit={handleCreate} className="space-y-5">

            {/* Fila 1: Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha de elaboración</label>
              <div className="flex items-center gap-2">
                <input
                  ref={dateInputRef}
                  name="fecha_elaboracion"
                  type="date"
                  value={fechaElab}
                  onChange={e => {
                    setFechaElab(e.target.value);
                    if (fieldErrors.fecha_elaboracion) setFieldErrors(prev => ({ ...prev, fecha_elaboracion: '' }));
                  }}
                  className={`poa-input w-36 text-sm ${fieldErrors.fecha_elaboracion ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                />
                <IconButton
                  icon={<FaCalendarAlt />}
                  onClick={() => {
                    const el = dateInputRef.current;
                    if (!el) return;
                    try {
                      if (typeof el.showPicker === 'function') el.showPicker();
                      else el.focus();
                    } catch { el.focus(); }
                  }}
                  className="btn-primary rounded px-3 py-2 shrink-0"
                  title="Seleccionar fecha"
                  ariaLabel="Seleccionar fecha"
                />
              </div>
            </div>

            {/* Fila 2: Unidad solicitante + Programa */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Unidad solicitante</label>
                <input
                  name="unidad_solicitante"
                  value={form.unidad_solicitante}
                  onChange={handleChange}
                  className={`poa-input block w-full ${fieldErrors.unidad_solicitante ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                  placeholder="Ingrese la unidad solicitante..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Programa</label>
                <input
                  name="programa"
                  value={form.programa}
                  onChange={handleChange}
                  className={`poa-input block w-full ${fieldErrors.programa ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                />
              </div>
            </div>

            {/* Fila 3: Objetivo de gestión */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Objetivo de gestión institucional</label>
              <Textarea
                name="objetivo_gestion_institucional"
                value={form.objetivo_gestion_institucional}
                onChange={handleChange}
                rows={3}
                className="resize-y"
                error={fieldErrors.objetivo_gestion_institucional}
              />
            </div>

            {/* Fila 5: Elaborado por + Jefe de unidad */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Elaborado por</label>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Solo usuarios POA activos con rol Elaborador del POA.</p>
                {personasLoading ? (
                  <div className="mt-1 text-sm text-gray-600 dark:text-slate-400">Cargando usuarios POA...</div>
                ) : personasError ? (
                  <div className="mt-1 text-sm text-red-600 dark:text-red-400">{String(personasError)}</div>
                ) : (
                  <div className="relative min-w-0">
                    <input
                      name="elaborado_por_id"
                      value={elabQuery}
                      onChange={e => {
                        setElabQuery(e.target.value);
                        setForm(f => ({ ...f, elaborado_por: '' }));
                        setShowElabDropdown(true);
                        if (fieldErrors.elaborado_por_id) setFieldErrors(prev => ({ ...prev, elaborado_por_id: '' }));
                      }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setElabHighlight(i => Math.min(i + 1, elabFilteredPersonas.length - 1)); setShowElabDropdown(true); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setElabHighlight(i => Math.max(i - 1, 0)); }
                        if (e.key === 'Enter') { e.preventDefault(); const sel = elabFilteredPersonas[elabHighlight]; if (sel) { setForm(f => ({ ...f, elaborado_por: sel.id })); setElabQuery(sel.nombre || sel.username || ''); setShowElabDropdown(false); } }
                        if (e.key === 'Escape') { setShowElabDropdown(false); }
                      }}
                      placeholder="Buscar persona..."
                      className={`poa-input mt-1 block w-full bg-white dark:bg-slate-900 ${fieldErrors.elaborado_por_id ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                    />
                    {showElabDropdown && elabFilteredPersonas.length > 0 && (
                      <ul className="absolute z-50 mt-1 w-full max-w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded shadow-lg max-h-56 overflow-auto">
                        {elabFilteredPersonas.map((p, i) => (
                          <li key={p.id} onMouseEnter={() => setElabHighlight(i)} onMouseDown={ev => ev.preventDefault()} onClick={() => { setForm(f => ({ ...f, elaborado_por: p.id })); setElabQuery(p.nombre || p.username || ''); setShowElabDropdown(false); }} className={`px-3 py-2 cursor-pointer ${elabHighlight === i ? 'bg-blue-100 dark:bg-slate-700' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                            {p.nombre || p.username}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showElabDropdown && elabFilteredPersonas.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full max-w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded shadow-lg px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
                        No hay usuarios POA activos con rol Elaborador del POA.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Jefe de unidad</label>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Solo usuarios POA activos con rol Director de Carrera.</p>
                {personasLoading ? (
                  <div className="mt-1 text-sm text-gray-600 dark:text-slate-400">Cargando usuarios POA...</div>
                ) : personasError ? (
                  <div className="mt-1 text-sm text-red-600 dark:text-red-400">{String(personasError)}</div>
                ) : (
                  <div className="relative min-w-0">
                    <input
                      name="jefe_unidad_id"
                      value={jefeQuery || (form.jefe_unidad ? (personas.find(p => String(p.id) === String(form.jefe_unidad))?.nombre || '') : '')}
                      onChange={e => {
                        const q = e.target.value;
                        setJefeQuery(q);
                        setForm(f => ({ ...f, jefe_unidad: '' }));
                        setShowJefeDropdown(true);
                        if (fieldErrors.jefe_unidad_id) setFieldErrors(prev => ({ ...prev, jefe_unidad_id: '' }));
                      }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setJefeHighlight(i => Math.min(i + 1, jefeFilteredPersonas.length - 1)); setShowJefeDropdown(true); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setJefeHighlight(i => Math.max(i - 1, 0)); }
                        if (e.key === 'Enter') { e.preventDefault(); const sel = jefeFilteredPersonas[jefeHighlight]; if (sel) { setForm(f => ({ ...f, jefe_unidad: sel.id })); setJefeQuery(sel.nombre || sel.username || ''); setShowJefeDropdown(false); } }
                        if (e.key === 'Escape') { setShowJefeDropdown(false); }
                      }}
                      placeholder="Buscar jefe de unidad..."
                      className={`poa-input mt-1 block w-full bg-white dark:bg-slate-900 ${fieldErrors.jefe_unidad_id ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                    />
                    {showJefeDropdown && jefeFilteredPersonas.length > 0 && (
                      <ul className="absolute z-50 mt-1 w-full max-w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded shadow-lg max-h-56 overflow-auto">
                        {jefeFilteredPersonas.map((p, i) => (
                          <li key={p.id} onMouseEnter={() => setJefeHighlight(i)} onMouseDown={ev => ev.preventDefault()} onClick={() => { setForm(f => ({ ...f, jefe_unidad: p.id })); setJefeQuery(p.nombre || p.username || ''); setShowJefeDropdown(false); }} className={`px-3 py-2 cursor-pointer ${jefeHighlight === i ? 'bg-blue-100 dark:bg-slate-700' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                            {p.nombre || p.username}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showJefeDropdown && jefeFilteredPersonas.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full max-w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded shadow-lg px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
                        No hay usuarios POA activos con rol Director de Carrera.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {docToEdit?.id && requiereJustificacionEdicion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Justificación de modificación</label>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                  Este comentario se guardará en la bitácora con fecha y usuario que realizó la modificación.
                </p>
                <Textarea
                  name="justificacion_edicion"
                  value={justificacionEdicion}
                  onChange={(e) => {
                    setJustificacionEdicion(e.target.value);
                    if (fieldErrors.justificacion_edicion) setFieldErrors(prev => ({ ...prev, justificacion_edicion: '' }));
                  }}
                  rows={3}
                  className="resize-y"
                  placeholder="Explique por qué se modifica este documento después de su aprobación..."
                  error={fieldErrors.justificacion_edicion}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 modal-actions">
              <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-cancel px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={loading} className="btn-success px-3 py-2 rounded" title={loading ? 'Guardando...' : (docToEdit ? 'Guardar' : 'Crear')}>
                {loading ? (docToEdit ? 'Guardando...' : 'Guardando...') : (docToEdit ? 'Guardar' : 'Crear')}
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default NuevoDocumentoModal;
