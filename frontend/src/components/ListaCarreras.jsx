import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaEdit, FaTrash, FaEye } from 'react-icons/fa';
import { getCarreras } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';

const InputField = ({ label, name, type = 'text', value, onChange, required, error }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const ToggleSwitch = ({ isActive, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

// Componente de Filtro de Carreras con Búsqueda
const FilterCarreras = ({ carreras, onSelect, placeholder = 'Buscar carrera...' }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filteredCarreras = carreras.filter(carrera =>
    carrera.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrera.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setOpen(true);
  };

  const handleButtonClick = () => {
    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelectCarrera = (carrera) => {
    onSelect(carrera);
    setSearchTerm('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-64">
      <div className={`flex items-center px-4 py-3 rounded-2xl transition-all ${
        open 
          ? 'border-2 border-[#2C4AAE] bg-white dark:bg-slate-800' 
          : 'border-2 border-slate-400 bg-slate-100 dark:bg-slate-700 hover:border-[#2C4AAE]'
      }`}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent text-slate-800 dark:text-white focus:outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={handleButtonClick}
          className="w-8 h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ml-2"
        >
          <svg
            className={`w-4 h-4 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-64 overflow-auto">
          {filteredCarreras.length > 0 ? (
            filteredCarreras.map((carrera) => (
              <button
                key={carrera.id}
                type="button"
                onClick={() => handleSelectCarrera(carrera)}
                className="w-full text-left px-4 py-3 text-sm transition-colors text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white border-b border-slate-200 dark:border-slate-700 last:border-b-0"
              >
                <div className="font-semibold">{carrera.nombre}</div>
              </button>
            ))
          ) : searchTerm ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay carreras que coincidan
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Escribe para buscar carreras
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function ListaCarreras({ isDark, sidebarCollapsed = false }) {
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Modal de editar
  const [showModal, setShowModal] = useState(false);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    facultad: '',
    activo: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [removeLogoCarrera, setRemoveLogoCarrera] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [carreraToDelete, setCarreraToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteImpact, setDeleteImpact] = useState({
    loading: false,
    materias: 0,
    semestres: 0,
    informes: 0,
    failed: false,
  });
  const [showDependencyWarningModal, setShowDependencyWarningModal] = useState(false);
  const createLogoInputRef = useRef(null);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);

  // Handler para el filtro de carreras
  const handleSelectCarreraFromFilter = (carrera) => {
    abrirModalVer(carrera);
  };

  useEffect(() => {
    cargarCarreras();
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
  }, []);

  const cargarCarreras = async () => {
    try {
      const response = await getCarreras();
      const data = response.data.results || response.data;
      setCarreras(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar carreras');
      setLoading(false);
      console.error(err);
    }
  };

  useEffect(() => {
    if (isCreating) {
      setFormData({
        nombre: '',
        codigo: '',
        facultad: '',
        activo: true,
      });
      setErrors({});
      setLogoFile(null);
      setLogoPreview('');
      setRemoveLogoCarrera(false);
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
  };

  const abrirModalEditar = (carrera) => {
    setCarreraSeleccionada(carrera);
    setIsViewMode(false);
    setFormData({
      nombre: carrera.nombre,
      codigo: carrera.codigo,
      facultad: carrera.facultad,
      activo: carrera.activo
    });
    setLogoFile(null);
    setLogoPreview(carrera.logo_carrera || '');
    setRemoveLogoCarrera(false);
    setShowModal(true);
    setIsCreating(false);
  };

  const abrirModalVer = (carrera) => {
    setCarreraSeleccionada(carrera);
    setIsViewMode(true);
    setFormData({
      nombre: carrera.nombre,
      codigo: carrera.codigo,
      facultad: carrera.facultad,
      activo: carrera.activo,
    });
    setLogoFile(null);
    setLogoPreview(carrera.logo_carrera || '');
    setRemoveLogoCarrera(false);
    setShowModal(true);
    setIsCreating(false);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida');
      return;
    }

    setLogoFile(file);
    setRemoveLogoCarrera(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setRemoveLogoCarrera(true);
  };

  const buildCarreraPayload = () => {
    const payload = new FormData();
    payload.append('nombre', formData.nombre);
    payload.append('codigo', formData.codigo);
    payload.append('facultad', formData.facultad);
    payload.append('activo', String(Boolean(formData.activo)));

    if (logoFile) {
      payload.append('logo_carrera_file', logoFile);
    }
    if (removeLogoCarrera) {
      payload.append('remove_logo_carrera', 'true');
    }

    return payload;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleActivoSwitchChange = () => {
    setFormData((prev) => ({
      ...prev,
      activo: !prev.activo,
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    try {
      const payload = buildCarreraPayload();
      await api.post('/carreras/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Carrera creada correctamente');
      setIsCreating(false);
      cargarCarreras();
    } catch (err) {
      console.error(err);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        setErrors(apiErrors);
        const errorMsg = Object.values(apiErrors).flat().join(' ');
        toast.error(`Error: ${errorMsg}`);
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = buildCarreraPayload();
      await api.put(`/carreras/${carreraSeleccionada.id}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Carrera actualizada correctamente');
      setShowModal(false);
      setLogoFile(null);
      setLogoPreview('');
      setRemoveLogoCarrera(false);
      cargarCarreras();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDependencyWarning = (carrera, impactData, customDetail) => {
    setCarreraToDelete(carrera);
    setDeleteImpact({
      loading: false,
      materias: impactData?.materias || 0,
      semestres: impactData?.semestres || 0,
      informes: impactData?.informes || 0,
      failed: false,
      detail: customDetail || '',
    });
    setShowDependencyWarningModal(true);
  };

  const eliminarCarrera = async (carrera) => {
    if (!carrera?.id) return;
    setDeleteConfirmText('');
    try {
      const response = await api.get(`/carreras/${carrera.id}/dependencias/`);
      const deps = response.data || {};
      if (deps.can_delete) {
        setCarreraToDelete(carrera);
        setDeleteImpact({
          loading: false,
          materias: deps.materias || 0,
          semestres: deps.semestres || 0,
          informes: deps.informes || 0,
          failed: false,
        });
        setShowDeleteModal(true);
        return;
      }

      openDependencyWarning(
        carrera,
        deps,
        `ERROR DE INTEGRIDAD: No se puede eliminar la carrera ${carrera.nombre} porque aún tiene ${deps.materias || 0} materias e informes vinculados.`
      );
    } catch (err) {
      console.error('Error verificando dependencias de carrera:', err);
      toast.error('No se pudo verificar dependencias de la carrera. Intenta nuevamente.');
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setCarreraToDelete(null);
    setDeleteConfirmText('');
    setDeleteImpact({
      loading: false,
      materias: 0,
      semestres: 0,
      informes: 0,
      failed: false,
    });
  };

  const confirmarEliminar = async () => {
    if (!carreraToDelete) return;
    if (deleteConfirmText !== carreraToDelete.nombre) {
      toast.error('Debes escribir exactamente el nombre de la carrera para confirmar');
      return;
    }
    try {
      await api.delete(`/carreras/${carreraToDelete.id}/`);
      toast.success('Carrera eliminada correctamente');
      cargarCarreras();
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      const apiData = err.response?.data;
      if (apiData?.code === 'protected_error') {
        const deps = apiData?.dependencias || {};
        closeDeleteModal();
        openDependencyWarning(carreraToDelete, deps, apiData?.detail);
        return;
      }
      toast.error('Error al eliminar: ' + (apiData?.detail || err.message));
    }
  };

  const esAdmin = () => user?.is_staff === true;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando carreras...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-md">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Carreras
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 italic">
                Gestión de carreras universitarias
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              {/* Filtro de Carreras */}
              <FilterCarreras 
                carreras={carreras} 
                onSelect={handleSelectCarreraFromFilter}
                placeholder="Buscar carrera..."
              />
              
              {/* Botón Nueva Carrera */}
              {esAdmin() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>{isCreating ? '➖' : '➕'}</span>
                  {isCreating ? 'Cancelar' : 'Nueva Carrera'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CREACIÓN DE CARRERA */}
        {isCreating && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
            style={{ left: sidebarCollapsed ? '5rem' : '18rem', animationDuration: '160ms' }}
          >
            <div className="max-w-2xl w-full">
              <div className="bg-white dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
                <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE]">
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    Nueva Carrera
                  </h2>
                </div>
                <form onSubmit={handleCreateSubmit} className="p-5 md:p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">
                    <div className="md:col-span-3 space-y-4">
                      <div className="rounded-xl border border-[#3D6DE0]/30 dark:border-[#4B67C0]/40 bg-gradient-to-r from-white/60 via-[#3D6DE0]/5 to-cyan-400/10 dark:from-slate-800/55 dark:to-cyan-900/20 p-4 shadow-sm">
                        <InputField label="Nombre de la Carrera" name="nombre" value={formData.nombre} onChange={handleChange} required error={errors.nombre} />
                      </div>
                      <InputField label="Facultad" name="facultad" value={formData.facultad} onChange={handleChange} required error={errors.facultad} />
                      <InputField label="Código" name="codigo" value={formData.codigo} onChange={handleChange} required error={errors.codigo} />
                    </div>

                    <div className="md:col-span-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-4">
                      <label className="block text-sm font-semibold mb-3 text-slate-800 dark:text-slate-300">
                        Logo de Carrera
                      </label>

                      <input
                        ref={createLogoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />

                      <div className="mx-auto w-36 h-36 rounded-full overflow-hidden border border-blue-300 dark:border-blue-700 shadow-md relative group bg-white dark:bg-slate-900">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo de carrera" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-950" />
                        )}

                        <div className="absolute inset-0 flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {logoPreview ? (
                            <>
                              <div
                                onClick={() => createLogoInputRef.current?.click()}
                                className="w-1/2 h-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer text-white"
                                title="Cambiar logo"
                              >
                                <span className="text-[10px] font-bold">CAMBIAR</span>
                              </div>
                              <div className="w-px h-full bg-white/20" />
                              <div
                                onClick={handleRemoveLogo}
                                className="w-1/2 h-full bg-red-600/65 hover:bg-red-600/85 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer text-white"
                                title="Eliminar logo"
                              >
                                <span className="text-[10px] font-bold">BORRAR</span>
                              </div>
                            </>
                          ) : (
                            <div
                              onClick={() => createLogoInputRef.current?.click()}
                              className="w-full h-full bg-black/35 hover:bg-black/55 backdrop-blur-md flex items-center justify-center cursor-pointer text-white"
                              title="Subir logo"
                            >
                              <span className="text-xs font-bold">SUBIR FOTO</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-400">
                        Pasa el cursor para subir, cambiar o eliminar el logo.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-colors border border-slate-300 dark:border-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Guardando...' : '💾 Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ), document.body)}

        {carreras.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {carreras.map((carrera) => (
              <div 
                key={carrera.id} 
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-[240px]"
              >
                <div className="p-6 flex flex-col flex-1">
                  {/* Contenido horizontal */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    {/* Info izquierda */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-800 dark:text-white">
                            {carrera.nombre}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {carrera.facultad}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Código */}
                    <div className="px-4 py-3 rounded-md border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/40">
                      <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300">
                        {carrera.codigo}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción - Una línea */}
                  <div className="flex gap-2 pt-4 mt-auto border-t border-slate-200 dark:border-slate-700 justify-center">
                    <button
                      onClick={() => abrirModalVer(carrera)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200 hover:shadow-md"
                      title="Ver"
                    >
                      <FaEye size={14} />
                    </button>

                    {esAdmin() && (
                      <button
                        onClick={() => abrirModalEditar(carrera)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded-lg text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all duration-200 hover:shadow-md"
                        title="Editar"
                      >
                        <FaEdit size={14} />
                      </button>
                    )}

                    {esAdmin() && (
                      <button
                        onClick={() => eliminarCarrera(carrera)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-200 hover:shadow-md"
                        title="Eliminar"
                      >
                        <FaTrash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">🎓</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay carreras registradas
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Comienza agregando tu primera carrera
            </p>
            {esAdmin() && (
              <button
                onClick={handleToggleCreateForm}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
              >
                <span>➕</span>
                Crear Primera Carrera
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && carreraSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" style={{ animationDuration: '160ms' }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE]">
                     <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                       {isViewMode ? 'Ver Carrera' : 'Editar Carrera'}
              </h3>
            </div>

            {/* Formulario */}
            <form onSubmit={handleUpdateSubmit} className="px-6 py-4 max-h-[calc(90vh-76px)] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                    Nombre de la Carrera <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    readOnly={isViewMode}
                    placeholder="Ej: Ingeniería de Sistemas"
                    className={`w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-all shadow-sm ${isViewMode ? 'cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md'}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                    Código <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    value={formData.codigo}
                    onChange={handleChange}
                    required
                    readOnly={isViewMode}
                    placeholder="Ej: IS"
                    className={`w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-all shadow-sm ${isViewMode ? 'cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md'}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                    Facultad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="facultad"
                    value={formData.facultad}
                    onChange={handleChange}
                    required
                    readOnly={isViewMode}
                    placeholder="Ej: Ciencias y Tecnología"
                    className={`w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-all shadow-sm ${isViewMode ? 'cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md'}`}
                  />
                </div>

                <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-4">
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                    Logo de Carrera
                  </label>

                  {!isViewMode && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700"
                      />
                      {(logoPreview || logoFile) && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-semibold"
                        >
                          Eliminar Logo
                        </button>
                      )}
                    </div>
                  )}

                  {logoPreview ? (
                    <div className="mt-3">
                      <img src={logoPreview} alt="Logo carrera" className="h-20 w-20 rounded-lg object-cover border border-slate-300 dark:border-slate-600" />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No hay logo cargado.</p>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border-2 border-slate-300 dark:border-slate-600">
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      isActive={Boolean(formData.activo)}
                      onChange={isViewMode ? () => {} : handleActivoSwitchChange}
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-300">
                      {formData.activo ? '✅ Carrera Activa' : '⚪ Carrera Inactiva'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-700 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setIsViewMode(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:scale-105"
                >
                  {isViewMode ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isViewMode && (
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                  >
                    💾 Actualizar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <span>🗑️</span>
                Confirmación Crítica
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed">
                ¿Estás seguro de eliminar esta carrera? Esta acción es irreversible y eliminará TODOS los semestres, materias e informes de docentes vinculados.
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                Carrera objetivo: <strong className="text-red-900 dark:text-red-300">{carreraToDelete?.nombre}</strong>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                {deleteImpact.loading && 'Calculando impacto de eliminación...'}
                {!deleteImpact.loading && !deleteImpact.failed && `Se eliminarán ${deleteImpact.materias} materias, ${deleteImpact.semestres} semestres y ${deleteImpact.informes} informes.`}
                {!deleteImpact.loading && deleteImpact.failed && 'No se pudo calcular el conteo de daños en este momento.'}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Escribe el nombre exacto de la carrera para habilitar la eliminación:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={carreraToDelete?.nombre || 'Nombre de la carrera'}
                  className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esta operación no se puede deshacer.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={closeDeleteModal}
                autoFocus
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== (carreraToDelete?.nombre || '')}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-700 hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                🗑️ Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {showDependencyWarningModal && carreraToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowDependencyWarningModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <span>⛔</span>
                Error de Integridad
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed">
                {deleteImpact.detail || `ERROR DE INTEGRIDAD: No se puede eliminar la carrera ${carreraToDelete.nombre} porque aún tiene ${deleteImpact.materias} materias e informes vinculados.`}
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
                Dependencias detectadas: {deleteImpact.materias} materias, {deleteImpact.semestres} semestres, {deleteImpact.informes} informes.
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                Para poder eliminar esta carrera, primero debes mover o eliminar manualmente todos sus registros asociados para evitar la pérdida accidental de datos.
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end bg-slate-50 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setShowDependencyWarningModal(false)}
                className="px-4 py-2 rounded-lg font-semibold text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700/60 bg-red-100 dark:bg-red-900/25 hover:bg-red-200 dark:hover:bg-red-900/35"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListaCarreras;
