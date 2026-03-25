import React, { useState, useEffect } from 'react';
import { getCarreras } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const TrashIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

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

function ListaCarreras({ isDark }) {
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Modal de editar
  const [showModal, setShowModal] = useState(false);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    facultad: '',
    activo: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

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

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);

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
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
  };

  const abrirModalEditar = (carrera) => {
    setCarreraSeleccionada(carrera);
    setFormData({
      nombre: carrera.nombre,
      codigo: carrera.codigo,
      facultad: carrera.facultad,
      activo: carrera.activo
    });
    setShowModal(true);
    setIsCreating(false);
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
      await api.post('/carreras/', formData);
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
      await api.put(`/carreras/${carreraSeleccionada.id}/`, formData);
      toast.success('Carrera actualizada correctamente');
      setShowModal(false);
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                🎓 Carreras
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Gestión de carreras universitarias
              </p>
            </div>
            {esAdmin() && (
              <button
                onClick={handleToggleCreateForm}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
              >
                <span>{isCreating ? '➖' : '➕'}</span>
                {isCreating ? 'Cancelar' : 'Nueva Carrera'}
              </button>
            )}
          </div>
        </div>

        {/* FORMULARIO DE CREACIÓN EN LÍNEA */}
        {isCreating && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg mt-6 animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Crear Nueva Carrera
              </h2>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Nombre de la Carrera" name="nombre" value={formData.nombre} onChange={handleChange} required error={errors.nombre} />
                <InputField label="Código" name="codigo" value={formData.codigo} onChange={handleChange} required error={errors.codigo} />
                <InputField label="Facultad" name="facultad" value={formData.facultad} onChange={handleChange} required error={errors.facultad} />
              </div>
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreating(false)} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105">
                  {isSubmitting ? 'Guardando...' : 'Crear Carrera'}
                </button>
              </div>
            </form>
          </div>
        )}

        {carreras.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {carreras.map((carrera) => (
              <div 
                key={carrera.id} 
                className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="p-5">
                  {/* Fila superior */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-blue-600 dark:text-white truncate">
                        {carrera.nombre}
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-400 truncate">
                        {carrera.facultad}
                      </p>
                    </div>
                    {/* Código */}
                    <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-sm min-w-[74px] min-h-[56px] flex items-center justify-center">
                      <div className="text-xl font-extrabold text-slate-800 dark:text-white text-center tracking-wide leading-none">
                        {carrera.codigo}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción - Solo admin */}
                  {esAdmin() && (
                    <div className="flex gap-2 pt-3 border-t-2 border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => abrirModalEditar(carrera)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => eliminarCarrera(carrera)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  )}
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-up" style={{ animationDuration: '180ms' }}>
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE] rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                ✏️ Editar Carrera
              </h3>
            </div>

            {/* Formulario */}
            <form onSubmit={handleUpdateSubmit} className="px-6 py-4">
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
                    placeholder="Ej: Ingeniería de Sistemas"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
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
                    placeholder="Ej: IS"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
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
                    placeholder="Ej: Ciencias y Tecnología"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border-2 border-slate-300 dark:border-slate-600">
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      isActive={Boolean(formData.activo)}
                      onChange={handleActivoSwitchChange}
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
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:scale-105"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                >
                  💾 Actualizar
                </button>
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