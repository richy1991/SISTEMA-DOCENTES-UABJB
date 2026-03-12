import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave, FaCalendarAlt } from 'react-icons/fa';
import { createDocumentoPOA, updateDocumentoPOA, getAllDirecciones, getUsuariosPOA, getDocumentosPOAPorGestion, searchDirecciones } from '../../../apis/poa.api';
import { DEFAULT_ENTIDAD } from '../config/defaults';

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
    estado: 'elaboracion',
  });
  const [fechaElab, setFechaElab] = useState('');
  const dateInputRef = React.useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [personas, setPersonas] = useState([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [personasError, setPersonasError] = useState(null);

  // elaborado_por typeahead
  const [elabQuery, setElabQuery] = useState('');
  const [elabFilteredPersonas, setElabFilteredPersonas] = useState([]);
  const [showElabDropdown, setShowElabDropdown] = useState(false);
  const [elabHighlight, setElabHighlight] = useState(0);

  // jefe_unidad typeahead
  const [jefeQuery, setJefeQuery] = useState('');
  const [jefeFilteredPersonas, setJefeFilteredPersonas] = useState([]);
  const [showJefeDropdown, setShowJefeDropdown] = useState(false);
  const [jefeHighlight, setJefeHighlight] = useState(0);

  useEffect(() => {
    setPersonasLoading(true);
    getUsuariosPOA({ activo: true })
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data.results || []);
        // Normalizar: { id, nombre } desde UsuarioPOA con docente_detalle
        const list = raw.map(p => ({
          id: p.id,
          nombre: p.docente_detalle?.nombre_completo ?? p.docente_detalle?.nombres ?? `Usuario POA #${p.id}`,
          raw: p,
        })).filter(x => x.id !== null);
        setPersonas(list);
      })
      .catch(err => setPersonasError(err?.response?.data || err.message || 'Error al cargar usuarios POA'))
      .finally(() => setPersonasLoading(false));
  }, []);

  // Si initialGestion cambia, sincronizar el form.gestion
  useEffect(() => {
    if (initialGestion) {
      setForm(f => ({ ...f, gestion: initialGestion }));
    }
  }, [initialGestion]);

  // Si se pasa un documento para editar, prefills
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
        estado: docToEdit.estado ?? 'elaboracion',
      }));
      setFechaElab(docToEdit.fecha_elaboracion ? String(docToEdit.fecha_elaboracion).slice(0,10) : '');
      // set elabQuery/jefeQuery to show names in inputs
      setElabQuery(docToEdit.elaborado_por?.nombre ?? docToEdit.elaborado_por?.user?.username ?? (typeof docToEdit.elaborado_por === 'string' ? docToEdit.elaborado_por : ''));
      setJefeQuery(docToEdit.jefe_unidad?.nombre ?? docToEdit.jefe_unidad?.user?.username ?? (typeof docToEdit.jefe_unidad === 'string' ? docToEdit.jefe_unidad : ''));
    } catch (e) {
      // ignore
    }
  }, [docToEdit]);

  useEffect(() => {
    // elaborado_por filtered (exclude currently selected jefe_unidad)
    let mounted = true;
    if (!elabQuery || elabQuery.trim().length === 0) {
      setElabFilteredPersonas(personas.slice(0, 10).filter(p => String(p.id) !== String(form.jefe_unidad)));
      return undefined;
    }
    const q = elabQuery.trim();
    const t = setTimeout(() => {
      const filtered = personas.filter(p => (p.nombre || '').toLowerCase().includes(q.toLowerCase()) && String(p.id) !== String(form.jefe_unidad));
      if (mounted) { setElabFilteredPersonas(filtered.slice(0,50)); setElabHighlight(0); }
    }, 200);
    return () => { mounted = false; clearTimeout(t); };
  }, [elabQuery, personas, form.jefe_unidad]);

  useEffect(() => {
    // jefe_unidad filtered (exclude currently selected elaborado_por)
    let mounted = true;
    if (!jefeQuery || jefeQuery.trim().length === 0) {
      setJefeFilteredPersonas(personas.slice(0, 10).filter(p => String(p.id) !== String(form.elaborado_por)));
      return undefined;
    }
    const q = jefeQuery.trim();
    const t = setTimeout(() => {
      const filtered = personas.filter(p => (p.nombre || '').toLowerCase().includes(q.toLowerCase()) && String(p.id) !== String(form.elaborado_por));
      if (mounted) { setJefeFilteredPersonas(filtered.slice(0,50)); setJefeHighlight(0); }
    }, 200);
    return () => { mounted = false; clearTimeout(t); };
  }, [jefeQuery, personas, form.elaborado_por]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleCreate = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setError(null);
    if (!form.gestion || !form.unidad_solicitante) {
      setError('La gestión y la unidad solicitante son obligatorias');
      return;
    }
    // validar que elaborado_por y jefe_unidad sean diferentes
    if (form.elaborado_por && form.jefe_unidad && String(form.elaborado_por) === String(form.jefe_unidad)) {
      setError('El "Elaborado por" y el "Jefe de unidad" deben ser personas diferentes');
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
        estado: form.estado || 'elaboracion',
      };

      if (docToEdit && docToEdit.id) {
        // modo edición
        const res = await updateDocumentoPOA(docToEdit.id, payload, Number(payload.gestion));
        const updated = res?.data;
        toast.success('Edición guardada');
        if (onUpdated) onUpdated(updated || res.data);
        if (onClose) onClose();
      } else {
        // modo creación
        const res = await createDocumentoPOA(payload);
        // Manejar distintos formatos de respuesta del servidor
        let created = res?.data;
        if ((!created || (typeof created === 'object' && Object.keys(created).length === 0)) && res && (res.status === 201 || res.status === 200)) {
          // El servidor devolvió 201 pero sin contenido. Intentamos refetch de la lista por gestión
          try {
            const listRes = await getDocumentosPOAPorGestion(payload.gestion);
            const list = Array.isArray(listRes.data) ? listRes.data : (listRes.data.results || listRes.data.documentos || []);
            // Intentar localizar por unidad_solicitante y programa si están presentes
            if (payload.unidad_solicitante || payload.programa) {
              const candidate = list.find(d => (payload.unidad_solicitante ? (d.unidad_solicitante === payload.unidad_solicitante) : false) && (payload.programa ? (d.programa === payload.programa || (d.programa && d.programa.nombre === payload.programa)) : true));
              if (candidate) created = candidate;
            }
            // Si no encontramos candidato, usar el documento con id mayor (más reciente)
            if (!created && list.length > 0) {
              const byId = list.filter(d => d && d.id).sort((a,b) => Number(b.id) - Number(a.id));
              created = byId.length > 0 ? byId[0] : list[0];
            }
          } catch (e) {
            // no hacemos nada especial, created seguirá siendo vacío
          }
        }

        if (onCreated) onCreated(created || res.data);
        toast.success('Documento creado correctamente');
        if (onClose) onClose();
      }
    } catch (err) {
      // Normalizar mensajes de error: si response.data es objeto de campos, mostrarlo legible
      const resp = err?.response?.data;
      if (resp && typeof resp === 'object') {
        // convertir objeto de errores a string sencillo
        try {
          const s = JSON.stringify(resp);
          setError(s);
          toast.error('Error al guardar: ' + (resp.detail || s));
        } catch (e) {
          setError('Error al crear documento');
          toast.error('Error al guardar documento');
        }
      } else {
        const msg = resp || err?.message || 'Error al crear documento';
        setError(msg);
        toast.error(String(msg));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay: no onClick so clicks outside don't close modal (blocks page) */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative z-20 w-11/12 max-w-3xl modal-panel card-elegant oe-modern rounded-xl overflow-hidden">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="font-semibold text-lg">{docToEdit ? 'Editar Documento POA' : 'Nuevo Documento POA'}</div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="card-divider" />
        <div className="p-6 modal-body">

        {error && <div className="text-red-600 mb-3">{JSON.stringify(error)}</div>}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700">Gestión (Año)</label>
              <input name="gestion" value={form.gestion} onChange={handleChange} type="number" className="mt-1 block w-1/2 md:w-1/2 border rounded px-3 py-2" readOnly={!!initialGestion} disabled={!!initialGestion} />
              {initialGestion && <p className="text-xs text-gray-500 mt-1">Gestión seleccionada: {initialGestion}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de elaboración</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  ref={dateInputRef}
                  type="date"
                  value={fechaElab}
                  onChange={e => setFechaElab(e.target.value)}
                  className="block w-full border rounded px-3 py-2"
                />
                <IconButton
                  icon={<FaCalendarAlt />}
                  onClick={() => {
                    const el = dateInputRef.current;
                    if (!el) return;
                    try {
                      // Algunos navegadores soportan showPicker()
                      if (typeof el.showPicker === 'function') {
                        el.showPicker();
                      } else {
                        el.focus();
                        // Fallback: abrir mediante teclas (no siempre funciona)
                      }
                    } catch {
                      el.focus();
                    }
                  }}
                  className="btn-primary rounded px-3 py-2"
                  title="Seleccionar fecha"
                  ariaLabel="Seleccionar fecha"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700">Unidad solicitante</label>
                <input
                  name="unidad_solicitante"
                  value={form.unidad_solicitante}
                  onChange={handleChange}
                  className="mt-1 block w-full border rounded px-3 py-2"
                  placeholder="Ingrese la unidad solicitante..."
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700">Programa</label>
                <input name="programa" value={form.programa} onChange={handleChange} className="mt-1 block w-full border rounded px-3 py-2" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Objetivo de gestión institucional</label>
            <textarea name="objetivo_gestion_institucional" value={form.objetivo_gestion_institucional} onChange={handleChange} rows={2} className="mt-1 block w-full border rounded px-3 py-2 text-xs leading-snug resize-y" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado del documento</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'elaboracion', label: 'En elaboración', color: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
                { value: 'revision',   label: 'En revisión',    color: 'bg-blue-100 border-blue-400 text-blue-800' },
                { value: 'aprobado',   label: 'Aprobado',       color: 'bg-green-100 border-green-400 text-green-800' },
                { value: 'ejecucion',  label: 'En ejecución',   color: 'bg-purple-100 border-purple-400 text-purple-800' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, estado: opt.value }))}
                  className={`border-2 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${form.estado === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Elaborado por</label>
              {personasLoading ? (
                <div className="mt-1 text-sm text-gray-600">Cargando usuarios POA...</div>
              ) : personasError ? (
                <div className="mt-1 text-sm text-red-600">{String(personasError)}</div>
              ) : (
                <div className="relative min-w-0">
                  <input
                    value={elabQuery}
                    onChange={e => { setElabQuery(e.target.value); setForm(f => ({ ...f, elaborado_por: '' })); setShowElabDropdown(true); }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setElabHighlight(i => Math.min(i + 1, elabFilteredPersonas.length - 1)); setShowElabDropdown(true); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setElabHighlight(i => Math.max(i - 1, 0)); }
                      if (e.key === 'Enter') { e.preventDefault(); const sel = elabFilteredPersonas[elabHighlight]; if (sel) { setForm(f => ({ ...f, elaborado_por: sel.id })); setElabQuery(sel.nombre || sel.user?.username || ''); setShowElabDropdown(false); } }
                      if (e.key === 'Escape') { setShowElabDropdown(false); }
                    }}
                    placeholder="Buscar persona..."
                    className="mt-1 block w-full border rounded px-3 py-2 bg-white"
                  />
                  {showElabDropdown && elabFilteredPersonas.length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full max-w-full bg-white border rounded shadow max-h-56 overflow-auto">
                      {elabFilteredPersonas.map((p, i) => (
                        <li key={p.id} onMouseEnter={() => setElabHighlight(i)} onMouseDown={ev => ev.preventDefault()} onClick={() => { setForm(f => ({ ...f, elaborado_por: p.id })); setElabQuery(p.nombre || p.user?.username || ''); setShowElabDropdown(false); }} className={`px-3 py-2 cursor-pointer ${elabHighlight === i ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                          {p.nombre || p.user?.username}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700">Jefe de unidad</label>
              {personasLoading ? (
                <div className="mt-1 text-sm text-gray-600">Cargando usuarios POA...</div>
              ) : personasError ? (
                <div className="mt-1 text-sm text-red-600">{String(personasError)}</div>
              ) : (
                <div className="relative min-w-0">
                  <input
                    value={jefeQuery || (form.jefe_unidad ? (personas.find(p => String(p.id) === String(form.jefe_unidad))?.nombre || '') : '')}
                    onChange={e => { const q = e.target.value; setJefeQuery(q); setForm(f => ({ ...f, jefe_unidad: '' })); setShowJefeDropdown(true); }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setJefeHighlight(i => Math.min(i + 1, jefeFilteredPersonas.length - 1)); setShowJefeDropdown(true); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setJefeHighlight(i => Math.max(i - 1, 0)); }
                      if (e.key === 'Enter') { e.preventDefault(); const sel = jefeFilteredPersonas[jefeHighlight]; if (sel) { setForm(f => ({ ...f, jefe_unidad: sel.id })); setJefeQuery(sel.nombre || sel.user?.username || ''); setShowJefeDropdown(false); } }
                      if (e.key === 'Escape') { setShowJefeDropdown(false); }
                    }}
                    placeholder="Buscar jefe de unidad..."
                    className="mt-1 block w-full border rounded px-3 py-2 bg-white"
                  />
                  {showJefeDropdown && jefeFilteredPersonas.length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full max-w-full bg-white border rounded shadow max-h-56 overflow-auto">
                      {jefeFilteredPersonas.map((p, i) => (
                        <li key={p.id} onMouseEnter={() => setJefeHighlight(i)} onMouseDown={ev => ev.preventDefault()} onClick={() => { setForm(f => ({ ...f, jefe_unidad: p.id })); setJefeQuery(p.nombre || p.user?.username || ''); setShowJefeDropdown(false); }} className={`px-3 py-2 cursor-pointer ${jefeHighlight === i ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                          {p.nombre || p.user?.username}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 modal-actions">
            <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-cancel px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
            <IconButton icon={<FaSave />} type="submit" disabled={loading} className="btn-success px-3 py-2 rounded" title={loading ? 'Guardando...' : (docToEdit ? 'Guardar' : 'Crear')}>{loading ? (docToEdit ? 'Guardando...' : 'Guardando...') : (docToEdit ? 'Guardar' : 'Crear')}</IconButton>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
};

export default NuevoDocumentoModal;