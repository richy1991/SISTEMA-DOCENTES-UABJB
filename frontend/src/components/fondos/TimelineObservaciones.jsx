import { useState, useEffect } from 'react';
import { getObservacionesPorFondo, responderObservacion } from '../../apis/api';
import toast from 'react-hot-toast';

function TimelineObservaciones({ fondoId, puedeResponder = false }) {
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondiendo, setRespondiendo] = useState(null);
  const [respuestaTexto, setRespuestaTexto] = useState('');

  useEffect(() => {
    cargarObservaciones();
  }, [fondoId]);

  const cargarObservaciones = async () => {
    try {
      setLoading(true);
      const response = await getObservacionesPorFondo(fondoId);
      setObservaciones(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error al cargar observaciones:', err);
      toast.error('Error al cargar observaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleResponder = async (observacionId) => {
    if (!respuestaTexto.trim()) {
      toast.error('La respuesta no puede estar vacía');
      return;
    }

    try {
      await responderObservacion(observacionId, respuestaTexto);
      toast.success('✅ Respuesta enviada');
      setRespondiendo(null);
      setRespuestaTexto('');
      await cargarObservaciones();
    } catch (err) {
      console.error('Error al responder:', err);
      toast.error('Error al enviar respuesta');
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">Cargando observaciones...</p>
        </div>
      </div>
    );
  }

  if (observaciones.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center py-4">
          <span className="text-4xl mb-3 block">📭</span>
          <p className="text-slate-600 dark:text-slate-400">No hay observaciones registradas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 px-5 py-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>💬</span> Observaciones y Respuestas
        </h2>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <div className="space-y-4">
          {observaciones.map((obs, index) => (
            <div key={obs.id} className="relative">
              {/* Línea vertical del timeline */}
              {index < observaciones.length - 1 && (
                <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
              )}

              {/* Observación */}
              <div className="relative">
                {/* Avatar/Icono */}
                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border-2 border-orange-500">
                  <span className="text-orange-600 dark:text-orange-400 text-sm font-bold">
                    {obs.rol === 'director' ? '👔' : '📋'}
                  </span>
                </div>

                {/* Contenido */}
                <div className="ml-12">
                  {/* Header de la observación */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white">
                        {obs.autor_nombre || 'Usuario'}
                      </span>
                      <span className="mx-2 text-slate-400">•</span>
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                        {obs.rol_display || 'Director'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatearFecha(obs.fecha)}
                    </span>
                  </div>

                  {/* Texto de la observación */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 rounded-lg p-4 mb-3">
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {obs.observacion}
                    </p>
                  </div>

                  {/* Respuesta si existe */}
                  {obs.resuelta && obs.respuesta && (
                    <div className="ml-4 mt-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                              {obs.respondida_por_nombre || 'Docente'}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatearFecha(obs.fecha_respuesta)}
                            </span>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">
                              {obs.respuesta}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Formulario para responder */}
                  {!obs.resuelta && puedeResponder && (
                    <div className="ml-4 mt-3">
                      {respondiendo === obs.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={respuestaTexto}
                            onChange={(e) => setRespuestaTexto(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResponder(obs.id)}
                              className="px-4 py-2 rounded-lg font-semibold bg-green-500 hover:bg-green-600 text-white transition-all text-sm"
                            >
                              ✓ Enviar Respuesta
                            </button>
                            <button
                              onClick={() => {
                                setRespondiendo(null);
                                setRespuestaTexto('');
                              }}
                              className="px-4 py-2 rounded-lg font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRespondiendo(obs.id)}
                          className="px-4 py-2 rounded-lg font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-all text-sm flex items-center gap-2"
                        >
                          <span>↩️</span> Responder
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TimelineObservaciones;