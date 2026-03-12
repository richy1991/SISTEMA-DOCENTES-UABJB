import React, { useState, useEffect } from 'react';
import { getDocentes } from '../apis/api';
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

const InfoIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

const dedicacionStyles = {
  tiempo_completo: {
    bg: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    border: 'border-blue-500',
    icon: 'text-blue-500',
    title: 'text-blue-800 dark:text-blue-300',
    text: 'text-blue-700 dark:text-blue-400',
  },
  medio_tiempo: {
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
    border: 'border-green-500',
    icon: 'text-green-500',
    title: 'text-green-800 dark:text-green-300',
    text: 'text-green-700 dark:text-green-400',
  },
  horario: {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
    border: 'border-orange-500',
    icon: 'text-orange-500',
    title: 'text-orange-800 dark:text-orange-300',
    text: 'text-orange-700 dark:text-orange-400',
  },
};

function ListaDocentes({ isDark }) {
  const [docentes, setDocentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Modal de crear/editar
  const [showModal, setShowModal] = useState(false);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    ci: '',
    categoria: 'catedratico',
    dedicacion: 'tiempo_completo',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    email: '',
    telefono: '',
    horas_contrato_semanales: null,
    activo: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docenteToDelete, setDocenteToDelete] = useState(null);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    cargarDocentes();
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
  }, []);

  const cargarDocentes = async () => {
    setLoading(true);
    try {
      const response = await getDocentes();
      const data = response.data.results || response.data;
      setDocentes(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar docentes');
      setLoading(false);
      console.error(err);
    }
  };

  useEffect(() => {
    const initialData = {
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
      ci: '',
      categoria: 'catedratico',
      dedicacion: 'tiempo_completo',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      email: '',
      telefono: '',
      horas_contrato_semanales: null,
      activo: true,
    };
    if (isCreating) {
      setFormData(initialData);
      setErrors({});
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
  };

  const abrirModalEditar = (docente) => {
    setDocenteSeleccionado(docente);
    setFormData({
      nombres: docente.nombres,
      apellido_paterno: docente.apellido_paterno,
      apellido_materno: docente.apellido_materno || '',
      ci: docente.ci,
      categoria: docente.categoria,
      dedicacion: docente.dedicacion,
      fecha_ingreso: docente.fecha_ingreso || new Date().toISOString().split('T')[0],
      email: docente.email || '',
      telefono: docente.telefono || '',
      horas_contrato_semanales: docente.horas_contrato_semanales || null,
      activo: docente.activo,
    });
    setShowModal(true);
    setIsCreating(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newState = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      if (name === 'dedicacion' && value !== 'horario') {
        newState.horas_contrato_semanales = null;
      }
      return newState;
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    try {
      const payload = { ...formData };
      if (payload.email === '') payload.email = null;
      if (payload.telefono === '') payload.telefono = null;
      await api.post('/docentes/', payload);
      toast.success('Docente creado correctamente');
      setIsCreating(false);
      cargarDocentes();
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
      await api.put(`/docentes/${docenteSeleccionado.id}/`, formData);
      toast.success('Docente actualizado correctamente');
      setShowModal(false);
      cargarDocentes();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const eliminarDocente = (docente) => {
    setDocenteToDelete(docente);
    setShowDeleteModal(true);
  };

  const confirmarEliminar = async () => {
    if (!docenteToDelete) return;
    try {
      await api.delete(`/docentes/${docenteToDelete.id}/`);
      toast.success('Docente eliminado correctamente');
      cargarDocentes();
      setShowDeleteModal(false);
      setDocenteToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar: ' + (err.response?.data?.detail || err.message));
    }
  };

  const esAdmin = () => user?.is_superuser || user?.perfil?.rol === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando docentes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-md">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                👨 Docentes
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Gestión del personal docente
              </p>
            </div>
            <div className="flex items-center gap-4">
              {esAdmin() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
                >
                  <span>{isCreating ? '➖' : '➕'}</span>
                  {isCreating ? 'Cancelar' : 'Nuevo Docente'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FORMULARIO DE CREACIÓN EN LÍNEA */}
        {isCreating && (
          <div className="mt-6 animate-fade-in">
            {/* Header degradado */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-t-2xl px-5 py-3.5 flex items-center gap-3 shadow-lg">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                <span className="text-base">👨‍🏫</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white leading-tight">Nuevo Docente</h2>
                <p className="text-blue-200 text-xs">Complete los datos del docente</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="bg-white dark:bg-slate-800 rounded-b-2xl border-2 border-t-0 border-slate-200 dark:border-slate-700 shadow-xl">
              <div className="p-4 space-y-3">

                {/* Sección: Datos personales */}
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-2 flex items-center gap-1">
                    <span>👤</span> Datos Personales
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2">
                      <InputField label="Nombres" name="nombres" value={formData.nombres} onChange={handleChange} required error={errors.nombres} />
                    </div>
                    <InputField label="Apellido Paterno" name="apellido_paterno" value={formData.apellido_paterno} onChange={handleChange} required error={errors.apellido_paterno} />
                    <InputField label="Apellido Materno" name="apellido_materno" value={formData.apellido_materno} onChange={handleChange} error={errors.apellido_materno} />
                    <InputField label="Cédula de Identidad (CI)" name="ci" value={formData.ci} onChange={handleChange} required error={errors.ci} />
                    {/* Fecha de ingreso */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                        📅 Fecha de Ingreso <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="fecha_ingreso"
                        value={formData.fecha_ingreso}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md border-slate-300 dark:border-slate-600 cursor-pointer"
                        style={{ colorScheme: 'auto' }}
                      />
                      {errors.fecha_ingreso && <p className="text-xs text-red-600 mt-1">{errors.fecha_ingreso}</p>}
                    </div>
                  </div>
                </div>

                {/* Sección: Cargo y Dedicación */}
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-2 flex items-center gap-1">
                    <span>🏫</span> Cargo y Dedicación
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Categoría</label>
                      <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-3 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm">
                        <option value="catedratico">Catedrático</option>
                        <option value="adjunto">Adjunto</option>
                        <option value="asistente">Asistente</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Dedicación</label>
                      <select name="dedicacion" value={formData.dedicacion} onChange={handleChange} className="w-full px-3 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm">
                        <option value="tiempo_completo">Tiempo Completo</option>
                        <option value="medio_tiempo">Medio Tiempo</option>
                        <option value="horario">Horario</option>
                      </select>
                    </div>
                    {formData.dedicacion === 'horario' ? (
                      <InputField
                        label="Horas / Semana"
                        name="horas_contrato_semanales"
                        type="number"
                        value={formData.horas_contrato_semanales || ''}
                        onChange={handleChange}
                        required
                        error={errors.horas_contrato_semanales}
                      />
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Horas / Semana</label>
                        <div className="w-full px-3 py-2.5 rounded-xl border-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 flex items-center justify-between">
                          <span className="font-bold text-lg text-slate-700 dark:text-slate-300">
                            {formData.dedicacion === 'tiempo_completo' ? 40 : 20}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">hrs</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Banner info dedicación */}
                  <div className={`mt-3 px-3 py-2 rounded-lg ${dedicacionStyles[formData.dedicacion]?.bg} border-l-4 ${dedicacionStyles[formData.dedicacion]?.border} flex items-center gap-2`}>
                    <InfoIcon className={`w-4 h-4 ${dedicacionStyles[formData.dedicacion]?.icon} flex-shrink-0`} />
                    <p className={`text-xs ${dedicacionStyles[formData.dedicacion]?.text}`}>
                      {formData.dedicacion === 'tiempo_completo' && '40 horas semanales — Tiempo Completo'}
                      {formData.dedicacion === 'medio_tiempo' && '20 horas semanales — Medio Tiempo'}
                      {formData.dedicacion === 'horario' && 'Ingrese las horas según el contrato vigente'}
                    </p>
                  </div>
                </div>

                {/* Sección: Contacto */}
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400 mb-2 flex items-center gap-1">
                    <span>📞</span> Contacto
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
                    <InputField label="Teléfono" name="telefono" value={formData.telefono} onChange={handleChange} error={errors.telefono} />
                  </div>
                </div>
              </div>

              {/* Footer con botones */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 rounded-b-2xl border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all shadow-sm disabled:opacity-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>✅ Crear Docente</>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de docentes */}
        {docentes.length > 0 ? (
          <div className="space-y-4">
            {docentes.map((docente) => (
              <div
                key={docente.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.01]"
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info del docente */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xl flex-shrink-0">
                        {docente.nombres[0]}{docente.apellido_paterno[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-blue-600 dark:text-white truncate">
                          {docente.nombres} {docente.apellido_paterno} {docente.apellido_materno}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600 shadow-sm">
                            🆔 CI: {docente.ci}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700 shadow-sm">
                            {docente.categoria === 'catedratico' ? '👨‍🏫 Catedrático' :
                              docente.categoria === 'adjunto' ? '👔 Adjunto' : '🎓 Asistente'}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700 shadow-sm">
                            {docente.dedicacion === 'tiempo_completo' ? '⏰ Tiempo Completo' :
                              docente.dedicacion === 'horario' ? '🕐 Horario' : '⏳ Medio Tiempo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción - Solo admin */}
                    {esAdmin() && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirModalEditar(docente)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                        >
                          <PencilIcon className="w-4 h-4" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => eliminarDocente(docente)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">👨‍🏫</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay docentes registrados
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Comienza agregando tu primer docente
            </p>
            {esAdmin() && (
              <button
                onClick={handleToggleCreateForm}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
              >
                <span>➕</span>
                Crear Primer Docente
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && docenteSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <h3 className="text-xl font-bold text-blue-600 dark:text-white flex items-center gap-2">
                ✏️ Editar Docente
              </h3>
            </div>

            {/* Formulario */}
            <form onSubmit={handleUpdateSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div className="md:col-span-2">
                  <InputField label="Nombres" name="nombres" value={formData.nombres} onChange={handleChange} required error={errors.nombres} />
                </div>
                <InputField label="Apellido Paterno" name="apellido_paterno" value={formData.apellido_paterno} onChange={handleChange} required error={errors.apellido_paterno} />
                <InputField label="Apellido Materno" name="apellido_materno" value={formData.apellido_materno} onChange={handleChange} error={errors.apellido_materno} />
                <InputField label="Cédula de Identidad (CI)" name="ci" value={formData.ci} onChange={handleChange} required error={errors.ci} />
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Categoría</label>
                  <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                    <option value="catedratico">Catedrático</option>
                    <option value="adjunto">Adjunto</option>
                    <option value="asistente">Asistente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Dedicación</label>
                  <select name="dedicacion" value={formData.dedicacion} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                    <option value="tiempo_completo">Tiempo Completo</option>
                    <option value="medio_tiempo">Medio Tiempo</option>
                    <option value="horario">Horario</option>
                  </select>
                </div>
                {formData.dedicacion === 'horario' ? (
                  <InputField
                    label="Horas Semanales por Contrato"
                    name="horas_contrato_semanales"
                    type="number"
                    value={formData.horas_contrato_semanales || ''}
                    onChange={handleChange}
                    required
                    error={errors.horas_contrato_semanales}
                    placeholder="Ej: 8, 12, 16"
                  />
                ) : (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Horas Semanales Requeridas</label>
                    <input
                      type="number"
                      value={formData.dedicacion === 'tiempo_completo' ? 40 : 20}
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl border-2 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                    />
                  </div>
                )}
                <InputField label="Fecha de Ingreso" name="fecha_ingreso" type="date" value={formData.fecha_ingreso} onChange={handleChange} required error={errors.fecha_ingreso} />
                <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
                <InputField label="Teléfono" name="telefono" value={formData.telefono} onChange={handleChange} error={errors.telefono} />
              </div>

              <div className={`mt-6 p-4 rounded-xl ${dedicacionStyles[formData.dedicacion]?.bg} border-l-4 ${dedicacionStyles[formData.dedicacion]?.border} shadow-sm`}>
                <div className="flex items-start gap-3">
                  <InfoIcon className={`w-6 h-6 ${dedicacionStyles[formData.dedicacion]?.icon} flex-shrink-0 mt-0.5`} />
                  <div>
                    <h5 className={`font-semibold ${dedicacionStyles[formData.dedicacion]?.title}`}>Información sobre Dedicación</h5>
                    <p className={`text-sm ${dedicacionStyles[formData.dedicacion]?.text} mt-1`}>
                      {formData.dedicacion === 'tiempo_completo' && 'La dedicación a Tiempo Completo implica un total de 40 horas semanales.'}
                      {formData.dedicacion === 'medio_tiempo' && 'La dedicación a Medio Tiempo implica un total de 20 horas semanales.'}
                      {formData.dedicacion === 'horario' && 'Para la dedicación por Horario, debe especificar el número de horas semanales según el contrato.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border-2 border-slate-300 dark:border-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={formData.activo}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-300">
                    ✅ Docente activo
                  </span>
                </label>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrashIcon className="w-6 h-6 text-white" />
                Confirmar Eliminación
              </h2>
            </div>
            <div className="p-6">
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                ¿Estás seguro de que deseas eliminar al docente <strong>{docenteToDelete?.nombre_completo}</strong>?
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold transition-colors">Cancelar</button>
              <button onClick={confirmarEliminar} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListaDocentes;