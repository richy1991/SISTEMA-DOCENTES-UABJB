import { useState } from 'react';
import toast from 'react-hot-toast';

const SaveIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

function FormularioActividad({ categoria, categoriasDisponibles, onGuardar, onCancelar, actividadInicial, modoEdicion }) {
  const [formData, setFormData] = useState({
    categoria_id: actividadInicial?.categoria?.id || '',
    detalle: actividadInicial?.detalle || '',
    horas_semana: actividadInicial?.horas_semana || '',
    semanas_año: actividadInicial?.semanas_año || 45.8,
    evidencias: actividadInicial?.evidencias || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calcularHorasAño = () => {
    const horasSemana = parseFloat(formData.horas_semana) || 0;
    const semanasAño = parseFloat(formData.semanas_año) || 45.8;
    return Math.round(horasSemana * semanasAño);
  };

  const categoriaActual = categoriasDisponibles?.find(c => c.id === parseInt(formData.categoria_id)) || categoria;
  const esEvidenciaObligatoria = categoriaActual?.tipo !== 'docente';

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.categoria_id) {
      toast.error('❌ Selecciona una categoría');
      return;
    }

    if (!formData.detalle.trim()) {
      toast.error('❌ Escribe el detalle de la actividad');
      return;
    }

    if (!formData.horas_semana || parseFloat(formData.horas_semana) <= 0) {
      toast.error('❌ Las horas por semana deben ser mayor a 0');
      return;
    }

    // Validación de Seguridad: Evidencia obligatoria para no docentes
    if (esEvidenciaObligatoria && !formData.evidencias.trim()) {
      toast.error('Error: Debe proporcionar un enlace o descripción del respaldo legal');
      return;
    }

    const horasAño = calcularHorasAño();

    const data = {
      categoria: parseInt(formData.categoria_id),
      detalle: formData.detalle.trim(),
      horas_semana: parseFloat(formData.horas_semana),
      semanas_año: parseFloat(formData.semanas_año),
      horas_año: parseFloat(horasAño),
      evidencias: formData.evidencias.trim() || ""
    };

    onGuardar(data);
  };

  const botonGuardarDeshabilitado = esEvidenciaObligatoria && !formData.evidencias.trim();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{modoEdicion ? '✏️' : '➕'}</span> {modoEdicion ? 'Editar Actividad' : 'Nueva Actividad'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            Complete los detalles de la actividad a registrar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Categoría de la Actividad *
            </label>
            <select
              name="categoria_id"
              value={formData.categoria_id}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Seleccione una categoría --</option>
              {categoriasDisponibles?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Detalle de la actividad */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Detalle de la Actividad *
            </label>
            <textarea
              name="detalle"
              value={formData.detalle}
              onChange={handleChange}
              rows={3}
              placeholder="Ejemplo: Dictado de clases teóricas de Programación Web"
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Horas por semana */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Horas por Semana *
              </label>
              <input
                type="number"
                name="horas_semana"
                value={formData.horas_semana}
                onChange={handleChange}
                min="0.1"
                step="0.1"
                placeholder="8"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Semanas al Año
              </label>
              <input
                type="number"
                name="semanas_año"
                value={formData.semanas_año}
                onChange={handleChange}
                min="1"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Por defecto: 45.8 semanas
              </p>
            </div>
          </div>

          {/* Horas al año (calculado) */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Total Horas al Año (calculado):
              </span>
              <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                {calcularHorasAño()}h
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Fórmula: Horas/Semana × Semanas/Año
            </p>
          </div>

          {/* Evidencias */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
              {esEvidenciaObligatoria ? 'Respaldo / Evidencias (Obligatorio)' : 'Evidencias (Opcional)'}
              {actividadInicial?.archivo_evidencia && (
                <span className="text-xs text-green-600 dark:text-green-400 font-normal">
                  ✓ Archivo actual: {actividadInicial.archivo_evidencia.split('/').pop()}
                </span>
              )}
            </label>

            <textarea
              name="evidencias"
              value={formData.evidencias}
              onChange={handleChange}
              rows={2}
              placeholder="Ingrese el enlace de Google Drive o descripción del respaldo..."
              className={`w-full px-4 py-3 rounded-lg border-2 ${esEvidenciaObligatoria && !formData.evidencias.trim() ? 'border-red-300 focus:border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none`}
            />
            {esEvidenciaObligatoria && !formData.evidencias.trim() && (
              <p className="text-xs text-red-500 mt-1 font-medium">⚠️ Se requiere enlace o descripción de respaldo</p>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancelar}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={botonGuardarDeshabilitado}
              className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl ${botonGuardarDeshabilitado ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105'}`}
            >
              💾 Guardar Actividad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioActividad;