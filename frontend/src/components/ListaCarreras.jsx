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

  const eliminarCarrera = (carrera) => {
    setCarreraToDelete(carrera);
    setShowDeleteModal(true);
  };

  const confirmarEliminar = async () => {
    if (!carreraToDelete) return;
    try {
      await api.delete(`/carreras/${carreraToDelete.id}/`);
      toast.success('Carrera eliminada correctamente');
      cargarCarreras();
      setShowDeleteModal(false);
      setCarreraToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar: ' + (err.response?.data?.detail || err.message));
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
                    <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-sm">
                      <div className="text-sm font-bold text-slate-800 dark:text-white text-center">
                        {carrera.codigo}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-400 font-medium">Código</div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <h3 className="text-xl font-bold text-blue-600 dark:text-white flex items-center gap-2">
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-300">
                      ✅ Carrera Activa
                    </span>
                  </label>
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-300/40 dark:border-red-700/50 bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r from-red-900/30 to-slate-900">
              <h4 className="text-lg font-bold text-red-300 flex items-center gap-2">
                <span>🗑️</span>
                Confirmar Eliminación
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-200">
              <p className="text-sm leading-relaxed">
                Se eliminará la carrera <strong className="text-white">{carreraToDelete?.nombre}</strong> del sistema de forma permanente.
              </p>
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
                Acción irreversible: <strong className="text-red-300">la carrera quedará eliminada definitivamente.</strong>
              </div>
              <p className="text-xs text-slate-400">
                Esta operación no se puede deshacer.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-700/70 flex justify-end gap-3 bg-slate-950/70">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-300 border border-slate-600 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListaCarreras;