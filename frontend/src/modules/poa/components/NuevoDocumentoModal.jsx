import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave, FaCalendarAlt } from 'react-icons/fa';
import { createDocumentoPOA, updateDocumentoPOA, getUsuariosPOA, getDocumentosPOAPorGestion, getCarreraById, getDirectorPorCarrera } from '../../../apis/poa.api';
import { Textarea, Modal } from './base';
import { DEFAULT_ENTIDAD } from '../config/defaults';
import { DEFAULT_ERROR_LABELS, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const ELABORADOR_ROLE = 'elaborador';

const ERROR_LABELS = {
  ...DEFAULT_ERROR_LABELS,
};

const NuevoDocumentoModal = ({ onClose, onCreated, initialGestion, document: docToEdit, onUpdated, currentUser }) => {
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
  const [userCarrera, setUserCarrera] = useState(null);
  const [usuarioPoaActual, setUsuarioPoaActual] = useState(null);
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

  const [justificacionEdicion, setJustificacionEdicion] = useState('');

  const requiereJustificacionEdicion = Boolean(
    docToEdit?.id && ['aprobado', 'ejecucion'].includes(String(docToEdit?.estado || '').toLowerCase())
  );

  // Obtener el usuario POA actual
  useEffect(() => {
    if (!currentUser?.id) {
      setUsuarioPoaActual(null);
      return;
    }

    getUsuariosPOA({ activo: true })
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data.results || []);
        const usuarioPoa = raw.find(p =>
          Number(p.user) === Number(currentUser.id) ||
          Number(p.user_detalle?.id) === Number(currentUser.id)
        );
        if (usuarioPoa) {
          const nombre = usuarioPoa.nombre_display ||
            usuarioPoa.docente_detalle?.nombre_completo ||
            usuarioPoa.user_detalle?.nombre_completo ||
            usuarioPoa.user_detalle?.username ||
            `Usuario POA #${usuarioPoa.id}`;
          setUsuarioPoaActual({ ...usuarioPoa, nombre });
        } else {
          setUsuarioPoaActual(null);
        }
      })
      .catch(err => {
        console.error('Error al obtener usuario POA:', err);
        setUsuarioPoaActual(null);
      });
  }, [currentUser?.id]);

  // Obtener carrera del usuario actual y su director
  useEffect(() => {
    // En modo edición, no cargar la carrera del usuario actual
    if (docToEdit) {
      setUserCarrera(null);
      return;
    }
    if (!currentUser?.perfil?.carrera) {
      setUserCarrera(null);
      return;
    }

    // Obtener datos completos de la carrera
    getCarreraById(currentUser.perfil.carrera)
      .then(res => {
        const carrera = res.data;
        setUserCarrera(carrera);
      })
      .catch(err => {
        console.error('Error al obtener carrera:', err);
        setUserCarrera(null);
      });
  }, [currentUser?.perfil?.carrera, docToEdit]);

  // Auto-llenar campos cuando se carga el usuario actual
  useEffect(() => {
    // Siempre auto-llenar elaborado_por con el usuario actual
    if (usuarioPoaActual?.nombre) {
      setForm(f => ({ ...f, elaborado_por: usuarioPoaActual.nombre }));
    }

    // En modo creación, auto-llenar unidad_solicitante y jefe_unidad
    if (!docToEdit && userCarrera) {
      setForm(f => ({ ...f, unidad_solicitante: userCarrera.id }));

      // Obtener el director de carrera específico del sistema principal
      if (userCarrera.id) {
        getDirectorPorCarrera(userCarrera.id)
          .then(res => {
            const directorSistema = res.data;
            if (directorSistema?.nombre) {
              setForm(f => ({ ...f, jefe_unidad: directorSistema.nombre }));
            }
          })
          .catch(err => {
            console.error('Error al obtener director de carrera:', err);
          });
      }
    }

    // Cargar la fecha actual solo en modo creación
    if (!docToEdit) {
      const hoy = new Date();
      const fechaHoy = hoy.toISOString().split('T')[0];
      setFechaElab(fechaHoy);
    }
  }, [usuarioPoaActual, docToEdit, userCarrera]);

  useEffect(() => {
    if (initialGestion) {
      setForm(f => ({ ...f, gestion: initialGestion }));
    }
  }, [initialGestion]);

  // En modo edición, obtener el director basado en la carrera del documento
  useEffect(() => {
    if (!docToEdit) return;

    const carreraId = typeof docToEdit.unidad_solicitante === 'object'
      ? docToEdit.unidad_solicitante.id
      : docToEdit.unidad_solicitante;

    if (carreraId) {
      getDirectorPorCarrera(carreraId)
        .then(res => {
          const directorSistema = res.data;
          if (directorSistema?.nombre) {
            setForm(f => ({ ...f, jefe_unidad: directorSistema.nombre }));
          }
        })
        .catch(err => {
          console.error('Error al obtener director de carrera:', err);
        });
    }
  }, [docToEdit]);

  useEffect(() => {
    if (!docToEdit) return;
    try {
      setForm(f => ({
        ...f,
        entidad: docToEdit.entidad ?? DEFAULT_ENTIDAD,
        gestion: (docToEdit.gestion ?? initialGestion) || new Date().getFullYear(),
        programa: typeof docToEdit.programa === 'object' ? (docToEdit.programa.nombre || docToEdit.programa) : (docToEdit.programa || ''),
        // unidad_solicitante es ahora un ID de carrera o un objeto con id y nombre
        unidad_solicitante: typeof docToEdit.unidad_solicitante === 'object' ? docToEdit.unidad_solicitante.id : docToEdit.unidad_solicitante,
        objetivo_gestion_institucional: docToEdit.objetivo_gestion_institucional ?? '',
        // elaborado_por y jefe_unidad son ahora strings (nombres)
        elaborado_por: docToEdit.elaborado_por ?? '',
        jefe_unidad: docToEdit.jefe_unidad ?? '',
        observaciones: docToEdit.observaciones ?? '',
      }));
      setFechaElab(docToEdit.fecha_elaboracion ? String(docToEdit.fecha_elaboracion).slice(0,10) : '');
      setJustificacionEdicion('');
    } catch (e) {
      // ignore
    }
  }, [docToEdit, initialGestion]);

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
      const nextErrors = { elaborado_por: 'Debe ser diferente de Jefe de unidad.', jefe_unidad: 'Debe ser diferente de Elaborado por.' };
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
        unidad_solicitante: form.unidad_solicitante ? Number(form.unidad_solicitante) : null,
        elaborado_por: form.elaborado_por || '',
        jefe_unidad: form.jefe_unidad || '',
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Unidad solicitante (Carrera)</label>
                <input
                  type="text"
                  value={
                    docToEdit
                      ? (typeof docToEdit.unidad_solicitante === 'object'
                          ? docToEdit.unidad_solicitante.nombre
                          : docToEdit.unidad_solicitante_data?.nombre || '')
                      : (userCarrera?.nombre || '')
                  }
                  readOnly
                  className="poa-input block w-full bg-gray-100 dark:bg-slate-700 cursor-not-allowed"
                  placeholder="Cargando carrera..."
                />
                {!docToEdit && !!userCarrera && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Asignada automáticamente de tu carrera.</p>
                )}
                {docToEdit && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No se puede modificar.</p>
                )}
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
                <input
                  type="text"
                  value={form.elaborado_por || ''}
                  readOnly
                  className="poa-input block w-full bg-gray-100 dark:bg-slate-700 cursor-not-allowed"
                  placeholder="Cargando..."
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {docToEdit ? 'Actualizado a tu usuario actual.' : 'Asignado automáticamente.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Jefe de unidad</label>
                <input
                  type="text"
                  value={form.jefe_unidad || ''}
                  readOnly
                  className="poa-input block w-full bg-gray-100 dark:bg-slate-700 cursor-not-allowed"
                  placeholder="Cargando..."
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {docToEdit ? 'Actualizado automáticamente.' : 'Director de carrera asignado automáticamente.'}
                </p>
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
