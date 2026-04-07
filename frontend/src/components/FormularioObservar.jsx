import { useState } from 'react';
import { observarFondo } from '../apis/api';
import toast from 'react-hot-toast';

const PaperAirplaneIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

function FormularioObservar({ fondo, onObservar, onCancelar }) {
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!observacion.trim()) {
    toast.error('❌ Debes escribir una observación');
    return;
  }

  if (observacion.trim().length < 10) {
    toast.error('❌ La observación debe tener al menos 10 caracteres');
    return;
  }

  try {
    setEnviando(true);
    await observarFondo(fondo.id, { 
      observacion: observacion.trim(),
      accion: 'observar'
    });
    
    // Cerrar modal primero
    onObservar();
    
    // Mostrar toast y recargar después
    toast.success('✅ Observación enviada al docente');
    
    // Esperar un poco y recargar
    setTimeout(() => {
    }, 500);
    
  } catch (err) {
    console.error('Error al observar:', err);
    if (err.response?.data?.error) {
      toast.error(`❌ ${err.response.data.error}`);
    } else {
      toast.error('❌ Error al enviar la observación');
    }
    setEnviando(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>⚠️</span> Observar Fondo de Tiempo
          </h2>
          <p className="text-orange-100 text-sm mt-1">
            Envía tus observaciones al docente para que realice las correcciones necesarias
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Info del fondo */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-600 dark:text-slate-400">Docente:</span>
                <p className="font-bold text-slate-800 dark:text-white">
                  {fondo.docente?.nombre_completo || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">Carrera:</span>
                <p className="font-bold text-slate-800 dark:text-white">
                  {fondo.carrera?.nombre || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">Asignatura:</span>
                <p className="font-bold text-slate-800 dark:text-white">
                  {fondo.asignatura || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">Gestión:</span>
                <p className="font-bold text-slate-800 dark:text-white">
                  {fondo.gestion} - {fondo.periodo}
                </p>
              </div>
            </div>
          </div>

          {/* Textarea para observación */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Observaciones *
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={8}
              placeholder="Ejemplo:&#10;&#10;1. Falta especificar las horas de tutoría en la función Docente.&#10;2. El porcentaje de Investigación (5%) está por debajo del mínimo requerido (10%).&#10;3. Debe adjuntar el programa analítico actualizado."
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              💡 Sé específico sobre qué debe corregir el docente
            </p>
          </div>

          {/* Advertencia */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 font-semibold mb-1">
                  Al enviar esta observación:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                  <li>El fondo volverá a estado <strong>"Observado"</strong></li>
                  <li>El docente podrá editar y corregir el fondo</li>
                  <li>El docente verá tus comentarios en el timeline</li>
                  <li>Deberás revisar nuevamente cuando lo vuelva a presentar</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancelar}
              disabled={enviando}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !observacion.trim()}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {enviando ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span>📤</span>
                  <span>Enviar Observación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioObservar;