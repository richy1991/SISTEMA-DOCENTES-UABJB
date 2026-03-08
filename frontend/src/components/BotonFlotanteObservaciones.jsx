import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { getObservacionesPorFondo, agregarMensajeObservacion } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';

const BotonFlotanteObservaciones = forwardRef(({ fondoId, estadoFondo, onObservacionCambiada }, ref) => {
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [animandoEntrada, setAnimandoEntrada] = useState(false);
  const [cerrandoPanel, setCerrandoPanel] = useState(false);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const scrollRef = useRef(null);
  const [mensajesAnimando, setMensajesAnimando] = useState([]);

  useEffect(() => {
    if (fondoId) {
      cargarObservaciones();
      cargarUsuario();
    }
  }, [fondoId]);

  useEffect(() => {
    // Scroll automático al fondo cuando se abra el panel o cambien observaciones
    if (panelAbierto && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }
  }, [panelAbierto, observaciones]);

  const cargarUsuario = async () => {
    try {
      const response = await api.get('/usuario/');
      setUsuarioActual(response.data);
    } catch (err) {
      console.error('Error al cargar usuario:', err);
    }
  };

  const cargarObservaciones = async () => {
    try {
      setLoading(true);
      const response = await getObservacionesPorFondo(fondoId);
      const nuevasObs = response.data.results || response.data || [];
      
      // Detectar nuevos mensajes para animación
      if (observaciones.length > 0 && nuevasObs.length > 0) {
        nuevasObs.forEach(obs => {
          const obsAnterior = observaciones.find(o => o.id === obs.id);
          if (obsAnterior && obs.mensajes.length > obsAnterior.mensajes.length) {
            const nuevosMensajes = obs.mensajes.slice(obsAnterior.mensajes.length);
            nuevosMensajes.forEach(msg => {
              setMensajesAnimando(prev => [...prev, msg.id]);
              setTimeout(() => {
                setMensajesAnimando(prev => prev.filter(id => id !== msg.id));
              }, 500);
            });
          }
        });
      }
      
      setObservaciones(nuevasObs);
    } catch (err) {
      console.error('Error al cargar observaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarMensaje = async () => {
    if (!mensajeTexto.trim()) {
      toast.error('El mensaje no puede estar vacío');
      return;
    }

    if (mensajeTexto.trim().length < 10) {
      toast.error('El mensaje debe tener al menos 10 caracteres');
      return;
    }

    // Enviar a la última conversación activa
    const conversacionActiva = observaciones.filter(obs => !obs.resuelta).pop();
    if (!conversacionActiva) {
      toast.error('No hay conversaciones activas');
      return;
    }

    try {
      setEnviando(true);
      await agregarMensajeObservacion(conversacionActiva.id, mensajeTexto);
      setMensajeTexto('');
      await cargarObservaciones();
      // NO llamar onObservacionCambiada() para evitar recarga de página
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      toast.error(err.response?.data?.error || 'Error al enviar mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarPanel = () => {
    setAnimandoEntrada(false);
    setCerrandoPanel(true);
    setTimeout(() => {
      setPanelAbierto(false);
      setCerrandoPanel(false);
    }, 500);
  };

  const formatearFechaCorta = (fecha) => {
    const date = new Date(fecha);
    const ahora = new Date();
    const diff = Math.floor((ahora - date) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff === 1) return 'Ayer';
    if (diff < 7) return `Hace ${diff} días`;
    
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Exponer función para abrir panel desde el padre
  useImperativeHandle(ref, () => ({
    abrirPanel: () => {
      setPanelAbierto(true);
      setTimeout(() => {
        setAnimandoEntrada(true);
      }, 10);
      // Notificar al padre que se abrió el panel (para limpiar badge)
      if (onObservacionCambiada) {
        onObservacionCambiada();
      }
    },
    obtenerPendientes: () => {
      // Contar solo mensajes del OTRO usuario que no he leído
      const esAdmin = usuarioActual?.is_staff;
      let count = 0;
      
      observaciones.filter(obs => !obs.resuelta).forEach(obs => {
        if (obs.mensajes) {
          // Contar mensajes del otro usuario
          const mensajesOtro = obs.mensajes.filter(msg => 
            esAdmin ? !msg.es_admin : msg.es_admin
          );
          count += mensajesOtro.length;
        }
      });
      
      return count;
    },
    actualizarObservaciones: async () => {
      await cargarObservaciones();
    }
  }));

  // Ordenar todas las observaciones por fecha (más vieja arriba, más nueva abajo)
  const todasOrdenadas = [...observaciones].sort((a, b) => 
    new Date(a.fecha_creacion) - new Date(b.fecha_creacion)
  );
  
  const esAdmin = usuarioActual?.is_staff;
  // El admin siempre puede responder, el docente solo si el fondo está en "observado"
  // Se considera autoridad a admin, director y jefe de estudios.
  const esAutoridad = usuarioActual?.perfil?.rol === 'admin' || 
                      usuarioActual?.perfil?.rol === 'director' || 
                      usuarioActual?.perfil?.rol === 'jefe_estudios';
  const hayConversacionActiva = observaciones.some(obs => !obs.resuelta);

  // Permitir responder si es autoridad, si el estado es observado, O SI HAY UNA CONVERSACIÓN ABIERTA.
  const puedeResponder = esAutoridad || estadoFondo === 'observado' || hayConversacionActiva;

  // Determinar si un mensaje es del usuario actual
  const esMiMensaje = (mensaje) => {
    return esAutoridad ? mensaje.es_admin : !mensaje.es_admin;
  };
  
  // Determinar si un mensaje es una observación inicial (primer mensaje del admin)
  const esObservacionInicial = (mensaje, observacion) => {
    return mensaje.es_admin && observacion.mensajes && observacion.mensajes[0]?.id === mensaje.id;
  };

  // Calcular badge count (mensajes del otro usuario en conversaciones activas)
  const badgeCount = observaciones
    .filter(obs => !obs.resuelta)
    .reduce((count, obs) => {
      if (obs.mensajes) {
        const mensajesOtro = obs.mensajes.filter(msg =>
          esAutoridad ? !msg.es_admin : msg.es_admin
        );
        return count + mensajesOtro.length;
      }
      return count;
    }, 0);

  return (
    <>
      {/* Botón flotante - Siempre visible */}
      <button
        onClick={() => {
          setPanelAbierto(true);
          setTimeout(() => {
            setAnimandoEntrada(true);
          }, 10);
        }}
        className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center text-white relative"
      >
        {/* Ícono de chat */}
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        
        {/* Badge con número de mensajes del otro usuario */}
        {badgeCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
            {badgeCount}
          </div>
        )}
      </button>

      {/* Panel deslizante */}
      {panelAbierto && (
        <div className="fixed inset-0 z-[60]">
          {/* Overlay */}
          <div 
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${
              !animandoEntrada || cerrandoPanel ? 'opacity-0' : 'opacity-100'
            }`}
            onClick={cerrarPanel}
          ></div>

          {/* Panel */}
          <div 
            className={`absolute right-4 top-4 bottom-4 w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${
              !animandoEntrada || cerrandoPanel ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
            }`}
          >
            {/* Header fijo */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-3xl">💬</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Conversaciones</h2>
                  {hayConversacionActiva && (
                    <p className="text-blue-100 text-sm">
                      {observaciones.filter(o => !o.resuelta).length} activa{observaciones.filter(o => !o.resuelta).length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={cerrarPanel}
                className="w-10 h-10 rounded-xl hover:bg-white/20 flex items-center justify-center text-white transition-all hover:rotate-90 duration-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Área de scroll con todas las conversaciones */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-slate-50 dark:bg-slate-900"
            >
              {observaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <span className="text-4xl">💬</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Sin conversaciones
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No hay observaciones para este fondo
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Todas las conversaciones en orden cronológico */}
                  {todasOrdenadas.map((obs, obsIndex) => (
                    <div key={obs.id} className="space-y-3">
                      {/* Mensajes */}
                      {obs.mensajes && obs.mensajes.map((mensaje) => (
                        <div
                          key={mensaje.id}
                          className={`flex ${esMiMensaje(mensaje) ? 'justify-end' : 'justify-start'} ${
                            mensajesAnimando.includes(mensaje.id) ? 'animate-slideIn' : ''
                          }`}
                        >
                          <div className={`max-w-[65%] flex flex-col ${esMiMensaje(mensaje) ? 'items-end' : 'items-start'}`}>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mb-1 px-2">
                              {mensaje.autor_nombre} • {formatearFechaCorta(mensaje.fecha)}
                            </span>
                            <div className={`px-4 py-2.5 rounded-3xl shadow-sm ${
                              esObservacionInicial(mensaje, obs)
                                ? obs.resuelta
                                  ? 'bg-green-100 dark:bg-green-900/30 text-slate-800 dark:text-green-100 rounded-bl-md border-2 border-green-400 dark:border-green-600'
                                  : 'bg-orange-100 dark:bg-orange-900/30 text-slate-800 dark:text-orange-100 rounded-bl-md border-2 border-orange-400 dark:border-orange-600'
                                : esMiMensaje(mensaje)
                                ? 'bg-green-100 dark:bg-green-900/30 text-slate-800 dark:text-green-100 rounded-br-md border border-green-200 dark:border-green-800'
                                : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-blue-200 dark:border-slate-600 rounded-bl-md'
                            }`}>
                              {esObservacionInicial(mensaje, obs) && (
                                <div className={`flex items-center gap-2 mb-2 pb-2 ${
                                  obs.resuelta 
                                    ? 'border-b border-green-300 dark:border-green-700'
                                    : 'border-b border-orange-300 dark:border-orange-700'
                                }`}>
                                  <span className={`font-bold text-xs ${
                                    obs.resuelta
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-orange-600 dark:text-orange-400'
                                  }`}>
                                    {obs.resuelta ? '✓ OBSERVACIÓN RESUELTA' : '⚠️ OBSERVACIÓN'}
                                  </span>
                                </div>
                              )}
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {mensaje.texto}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Banner Resuelta */}
                      {obs.resuelta && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">
                            Resuelta
                          </span>
                        </div>
                      )}

                      {/* Separador entre conversaciones (excepto la última) */}
                      {obsIndex < todasOrdenadas.length - 1 && (
                        <div className="border-b border-slate-200 dark:border-slate-700 my-2"></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input fijo ABAJO */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 flex-shrink-0">
              {hayConversacionActiva ? (
                <div className="flex gap-3 items-end">
                  {/* Textarea */}
                  <textarea
                    value={mensajeTexto}
                    onChange={(e) => setMensajeTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (puedeResponder) {
                          handleAgregarMensaje();
                        }
                      }
                    }}
                    placeholder={!puedeResponder ? "No puedes responder en este estado" : "Escribe un mensaje..."}
                    rows={2}
                    disabled={enviando || !puedeResponder}
                    className="flex-1 px-4 py-3 rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  {/* Botón Enviar - Ícono de avión */}
                  <button
                    onClick={handleAgregarMensaje}
                    disabled={enviando || !puedeResponder || !mensajeTexto.trim()}
                    className="px-4 py-3 rounded-2xl font-semibold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700 transition-all shadow-sm hover:shadow-md hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 flex-shrink-0"
                  >
                    {enviando ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No hay conversaciones activas
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
});

BotonFlotanteObservaciones.displayName = 'BotonFlotanteObservaciones';

export default BotonFlotanteObservaciones;