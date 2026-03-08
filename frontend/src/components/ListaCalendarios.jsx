import React, { useState, useEffect } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';

// --- ICONOS ---
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

const CheckCircleIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const InputField = ({ label, name, type = 'text', value, onChange, required, error, ...props }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
      {...props}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

function ListaCalendarios() {
  const [calendarios, setCalendarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [calendarioSeleccionado, setCalendarioSeleccionado] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [calendarioToDelete, setCalendarioToDelete] = useState(null);

  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    cargarCalendarios();
  }, []);

  const cargarCalendarios = async () => {
    setLoading(true);
    try {
      const response = await api.get('/calendarios/');
      const data = response.data.results || response.data;
      setCalendarios(Array.isArray(data) ? data.sort((a, b) => b.gestion - a.gestion || b.periodo.localeCompare(a.periodo)) : []);
    } catch (err) {
      setError('Error al cargar los calendarios académicos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (calendario = null) => {
    setCalendarioSeleccionado(calendario);
    setFormData({
      gestion: calendario?.gestion || new Date().getFullYear(),
      periodo: calendario?.periodo || '1',
      fecha_inicio: calendario?.fecha_inicio || '',
      fecha_fin: calendario?.fecha_fin || '',
      fecha_inicio_presentacion_proyectos: calendario?.fecha_inicio_presentacion_proyectos || '',
      fecha_limite_presentacion_proyectos: calendario?.fecha_limite_presentacion_proyectos || '',
      semanas_efectivas: calendario?.semanas_efectivas || 16,
      activo: calendario?.activo || false,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    
    const payload = { ...formData, gestion: parseInt(formData.gestion), semanas_efectivas: parseInt(formData.semanas_efectivas) };

    try {
      if (calendarioSeleccionado) {
        await api.put(`/calendarios/${calendarioSeleccionado.id}/`, payload);
        toast.success('Calendario actualizado correctamente');
      } else {
        await api.post('/calendarios/', payload);
        toast.success('Calendario creado correctamente');
      }
      setShowModal(false);
      cargarCalendarios();
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

  const handleSetActivo = async (calendarioId) => {
    toast.loading('Activando calendario...');
    try {
      await api.patch(`/calendarios/${calendarioId}/`, { activo: true });
      toast.dismiss();
      toast.success('Calendario activado correctamente.');
      cargarCalendarios();
    } catch (err) {
      toast.dismiss();
      toast.error('Error al activar el calendario.');
      console.error(err);
    }
  };

  const eliminarCalendario = (calendario) => {
    setCalendarioToDelete(calendario);
    setShowDeleteModal(true);
  };

  const confirmarEliminar = async () => {
    if (!calendarioToDelete) return;
    try {
      await api.delete(`/calendarios/${calendarioToDelete.id}/`);
      toast.success('Calendario eliminado correctamente');
      cargarCalendarios();
      setShowDeleteModal(false);
      setCalendarioToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando calendarios...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                🗓️ Calendarios Académicos
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Gestión de periodos, gestiones y fechas importantes.
              </p>
            </div>
            <button
              onClick={() => abrirModal()}
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
            >
              <span>➕</span>
              Nuevo Calendario
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {calendarios.map((cal) => (
            <div key={cal.id} className={`bg-white dark:bg-slate-800 rounded-2xl border-2 shadow-md hover:shadow-xl transition-all duration-200 ${cal.activo ? 'border-green-500 dark:border-green-600 ring-4 ring-green-500/20' : 'border-slate-300 dark:border-slate-700'}`}>
              <div className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xl flex-shrink-0 ${cal.activo ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                      {cal.gestion}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-600 dark:text-white">
                        Gestión {cal.gestion} - {cal.periodo_display}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <span>🗓️ {new Date(cal.fecha_inicio).toLocaleDateString()} - {new Date(cal.fecha_fin).toLocaleDateString()}</span>
                        <span>|</span>
                        <span>📦 Límite Presentación: {new Date(cal.fecha_limite_presentacion_proyectos).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cal.activo ? (
                      <span className="px-4 py-2 rounded-lg text-sm font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" /> Activo
                      </span>
                    ) : (
                      <button onClick={() => handleSetActivo(cal.id)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-slate-700 dark:text-slate-300 hover:text-green-700 dark:hover:text-green-300 transition-colors">
                        Activar
                      </button>
                    )}
                    <button onClick={() => abrirModal(cal)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><PencilIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                    <button onClick={() => eliminarCalendario(cal)} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"><TrashIcon className="w-5 h-5 text-red-500" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b-2 border-slate-300 dark:border-slate-700">
              <h3 className="text-xl font-bold text-blue-600 dark:text-white">
                {calendarioSeleccionado ? 'Editar Calendario' : 'Nuevo Calendario'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Gestión (Año)" name="gestion" type="number" value={formData.gestion} onChange={handleChange} required error={errors.gestion} />
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Periodo</label>
                  <select name="periodo" value={formData.periodo} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                    <option value="1">Primer Semestre</option>
                    <option value="2">Segundo Semestre</option>
                    <option value="anual">Anual</option>
                  </select>
                  {errors.periodo && <p className="text-xs text-red-600 mt-1">{errors.periodo}</p>}
                </div>
                <InputField label="Fecha de Inicio" name="fecha_inicio" type="date" value={formData.fecha_inicio} onChange={handleChange} required error={errors.fecha_inicio} />
                <InputField label="Fecha de Fin" name="fecha_fin" type="date" value={formData.fecha_fin} onChange={handleChange} required error={errors.fecha_fin} />
                <InputField label="Inicio Presentación Proyectos" name="fecha_inicio_presentacion_proyectos" type="date" value={formData.fecha_inicio_presentacion_proyectos} onChange={handleChange} required error={errors.fecha_inicio_presentacion_proyectos} />
                <InputField label="Límite Presentación Proyectos" name="fecha_limite_presentacion_proyectos" type="date" value={formData.fecha_limite_presentacion_proyectos} onChange={handleChange} required error={errors.fecha_limite_presentacion_proyectos} />
                <InputField label="Semanas Efectivas" name="semanas_efectivas" type="number" value={formData.semanas_efectivas} onChange={handleChange} required error={errors.semanas_efectivas} />
                <div className="flex items-center gap-2 mt-4">
                    <input type="checkbox" id="activo" name="activo" checked={formData.activo} onChange={handleChange} className="w-4 h-4" />
                    <label htmlFor="activo" className="text-sm font-medium text-slate-800 dark:text-slate-300">Marcar como calendario activo</label>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-700 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50">
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
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
                ¿Estás seguro de que deseas eliminar el calendario <strong>{calendarioToDelete?.gestion} - {calendarioToDelete?.periodo}</strong>?
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

export default ListaCalendarios;