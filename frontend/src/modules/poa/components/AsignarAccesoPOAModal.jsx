import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSave, FaSearch, FaUserCheck } from 'react-icons/fa';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { buscarDocentesPOA, createUsuarioPOA, updateUsuarioPOA, ROL_POA_CHOICES } from '../../../apis/poa.api';

const REVISORES = ['revisor_1', 'revisor_2', 'revisor_3', 'revisor_4'];

const AsignarAccesoPOAModal = ({ onClose, accesoToEdit, onCreated, onUpdated }) => {
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedDocente, setSelectedDocente] = useState(null);
  const [rol, setRol] = useState('elaborador');
  const [nombreEntidad, setNombreEntidad] = useState('');
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef(null);

  // Bloquear scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Si estamos editando, pre-cargar datos
  useEffect(() => {
    if (!accesoToEdit) return;
    setRol(accesoToEdit.rol || 'elaborador');
    setNombreEntidad(accesoToEdit.nombre_entidad || '');
    if (accesoToEdit.docente_detalle) {
      setSelectedDocente(accesoToEdit.docente_detalle);
      setSearchQ(accesoToEdit.docente_detalle.nombre_completo || '');
    }
  }, [accesoToEdit]);

  const handleSearch = (val) => {
    setSearchQ(val);
    setSelectedDocente(null);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await buscarDocentesPOA(val.trim());
        setSearchResults(res?.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectDocente = (doc) => {
    setSelectedDocente(doc);
    setSearchQ(doc.nombre_completo);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedDocente) { toast.error('Selecciona un docente'); return; }
    if (!rol) { toast.error('Selecciona un rol'); return; }
    if (REVISORES.includes(rol) && !nombreEntidad.trim()) {
      toast.error('Ingresa el nombre de la entidad revisora'); return;
    }
    setLoading(true);
    try {
      const payload = {
        docente: selectedDocente.id,
        rol,
        nombre_entidad: REVISORES.includes(rol) ? nombreEntidad.trim() : '',
        activo: true,
      };
      if (accesoToEdit?.id) {
        const res = await updateUsuarioPOA(accesoToEdit.id, payload);
        toast.success('Acceso actualizado');
        if (onUpdated) onUpdated(res?.data || res);
      } else {
        const res = await createUsuarioPOA(payload);
        toast.success('Acceso asignado correctamente');
        if (onCreated) onCreated(res?.data || res);
      }
      onClose?.();
    } catch (err) {
      const data = err?.response?.data;
      const msg = data?.non_field_errors?.[0] || data?.detail ||
        (typeof data === 'string' ? data : 'Error al guardar');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const rolData = ROL_POA_CHOICES.find(r => r.value === rol);
  const isEditor = accesoToEdit != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />
      <div className="relative z-20 w-full max-w-lg modal-panel card-elegant oe-modern rounded-xl overflow-hidden" style={{ transform: 'none' }}>

        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <FaUserCheck className="text-xl opacity-90" />
            <span className="font-bold text-base">
              {isEditor ? 'Editar Acceso POA' : 'Asignar Acceso POA'}
            </span>
          </div>
          <IconButton icon={<FaTimes />} onClick={onClose}
            className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-white/20 transition"
            title="Cerrar" ariaLabel="Cerrar" />
        </div>

        {/* Body */}
        <div className="px-6 py-5 modal-body space-y-5">

          {/* Búsqueda de docente */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Docente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FaSearch size={13} />
              </span>
              <input
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                disabled={isEditor}
                placeholder="Buscar por nombre, apellido o CI..."
                className="modal-input block w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400">Buscando…</span>
              )}
            </div>
            {/* Dropdown de resultados */}
            {searchResults.length > 0 && !selectedDocente && (
              <ul className="mt-1 border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto bg-white z-10">
                {searchResults.map(doc => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => selectDocente(doc)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex flex-col"
                    >
                      <span className="font-semibold text-gray-800">{doc.nombre_completo}</span>
                      <span className="text-gray-500 text-xs">CI: {doc.ci} · {doc.email || '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Docente seleccionado */}
            {selectedDocente && (
              <div className="mt-2 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {selectedDocente.nombre_completo?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 text-sm truncate">{selectedDocente.nombre_completo}</p>
                  <p className="text-xs text-blue-600">CI: {selectedDocente.ci} · {selectedDocente.email || '—'}</p>
                </div>
                {!isEditor && (
                  <button type="button" onClick={() => { setSelectedDocente(null); setSearchQ(''); }}
                    className="text-blue-400 hover:text-red-500 flex-shrink-0 transition">
                    <FaTimes size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Selector de rol */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Rol / Permiso <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROL_POA_CHOICES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRol(r.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-150 ${
                    rol === r.value
                      ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    REVISORES.includes(r.value) ? 'bg-violet-400' : 'bg-blue-400'
                  } ${rol === r.value ? 'bg-white' : ''}`} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre entidad (solo para revisores) */}
          {REVISORES.includes(rol) && (
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                Nombre de la Entidad Revisora <span className="text-red-500">*</span>
              </label>
              <input
                value={nombreEntidad}
                onChange={e => setNombreEntidad(e.target.value)}
                placeholder="Ej: DAF, VRA, DI, Rectorado…"
                className="modal-input block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nombre de la institución o unidad que revisa y aprueba documentos POA.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 modal-actions flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition font-medium">
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !selectedDocente}
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition">
            <FaSave size={13} />
            {loading ? 'Guardando…' : (isEditor ? 'Guardar cambios' : 'Asignar acceso')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsignarAccesoPOAModal;
