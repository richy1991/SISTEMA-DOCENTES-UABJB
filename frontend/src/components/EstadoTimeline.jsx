import React from 'react';

const ETAPAS = [
  { key: 'borrador', label: 'Borrador', colorActivo: 'bg-slate-500' },
  { key: 'presentado_jefe', label: 'En Revision', colorActivo: 'bg-blue-500' },
  { key: 'presentado_director', label: 'A Director', colorActivo: 'bg-indigo-500' },
  { key: 'aprobado_director', label: 'Aprobado', colorActivo: 'bg-green-500' },
  { key: 'en_ejecucion', label: 'En Ejecucion', colorActivo: 'bg-purple-500' },
  { key: 'informe_presentado', label: 'Informe Presentado', colorActivo: 'bg-indigo-500' },
  { key: 'finalizado', label: 'Finalizado', colorActivo: 'bg-teal-500' },
];

const EstadoTimeline = ({
  estado,
  tieneObservaciones = false,
  observacionesPendientes = 0,
  historial = [],
  fueObservado = false,
  esVistaDocente = false,
}) => {
  const estadoVisual = estado === 'observado' ? 'presentado_director' : estado;
  const indiceActual = ETAPAS.findIndex((etapa) => etapa.key === estadoVisual);
  const hayHistorial = Array.isArray(historial) && historial.length > 0;
  const historialEstados = new Set();

  if (hayHistorial) {
    historial.forEach((evento) => {
      if (evento.estado_anterior) historialEstados.add(evento.estado_anterior);
      if (evento.estado_nuevo) historialEstados.add(evento.estado_nuevo);
    });
    if (estado) historialEstados.add(estado);
    if (estadoVisual) historialEstados.add(estadoVisual);
    historialEstados.add('borrador');
  }

  const observadoEnHistorial = hayHistorial && historial.some(
    (evento) => evento.estado_anterior === 'observado' || evento.estado_nuevo === 'observado'
  );
  const mostrarObservaciones = fueObservado || tieneObservaciones || estado === 'observado' || observadoEnHistorial;

  const etapaFueRecorrida = (etapa, index) => {
    if (hayHistorial) return historialEstados.has(etapa.key);
    return indiceActual >= 0 && index <= indiceActual;
  };

  const getEstadoBadgeColor = (estadoActual) => {
    const colores = {
      borrador: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
      presentado_jefe: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      observado: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
      presentado_director: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      aprobado_director: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
      en_ejecucion: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      informe_presentado: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      finalizado: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
      rechazado: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
    };
    return colores[estadoActual] || colores.borrador;
  };

  const getEstadoLabel = (estadoActual) => {
    const labels = {
      borrador: 'Borrador',
      presentado_jefe: 'Presentado a Jefe',
      observado: observacionesPendientes > 0 ? `Con Observaciones (${observacionesPendientes})` : 'Con Observaciones',
      presentado_director: 'Presentado a Director',
      aprobado_director: 'Aprobado por Director',
      en_ejecucion: 'En Ejecucion',
      informe_presentado: 'Informe Presentado',
      finalizado: 'Finalizado',
      rechazado: 'Rechazado',
    };
    return labels[estadoActual] || estadoActual;
  };

  return (
    <div className="h-full flex flex-col pb-2 justify-between">
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Estado del Proceso
      </h3>

      <div className={`flex-1 flex flex-col items-center justify-center gap-4 px-4 py-6 rounded-2xl border-2 ${getEstadoBadgeColor(estado)} mb-4`}>
        <div className="text-4xl">
          {estado === 'borrador' && '📝'}
          {estado === 'presentado_jefe' && '👁️'}
          {estado === 'observado' && '⚠️'}
          {estado === 'presentado_director' && '📬'}
          {estado === 'aprobado_director' && '✅'}
          {estado === 'en_ejecucion' && '⚡'}
          {estado === 'informe_presentado' && '📊'}
          {estado === 'finalizado' && '🏁'}
          {estado === 'rechazado' && '❌'}
        </div>

        <div className="text-center">
          <p className="text-sm font-black mb-1">{getEstadoLabel(estado)}</p>
          {estado === 'observado' && tieneObservaciones && (
            <p className="text-xs opacity-75 mt-2">
              Hay {observacionesPendientes} hilo{observacionesPendientes === 1 ? '' : 's'} pendiente{observacionesPendientes === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Progreso
        </p>

        <div className="space-y-2">
          {ETAPAS.map((etapa, idx) => {
            const isActual = etapa.key === estadoVisual;
            const recorrida = etapaFueRecorrida(etapa, idx);
            const completada = recorrida && !isActual;

            return (
              <React.Fragment key={etapa.key}>
                <div className="flex items-center gap-2 text-[10px]">
                  <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 ${
                    isActual
                      ? etapa.colorActivo
                      : completada
                      ? 'bg-green-500'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`} />

                  <span className={`flex-1 truncate ${
                    isActual
                      ? 'font-bold text-slate-800 dark:text-slate-100'
                      : completada
                      ? 'text-slate-600 dark:text-slate-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {etapa.label}
                  </span>

                  {completada && (
                    <span className="flex-shrink-0 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
                  )}
                </div>

                {etapa.key === 'presentado_director' && mostrarObservaciones && (
                  <div className={`pl-5 text-[10px] ${
                    estado === 'observado'
                      ? 'font-semibold text-orange-600 dark:text-orange-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    – Con Observaciones
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {estado === 'finalizado' && (
        <div className="mt-3 p-2.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2 shadow-sm">
          <span className="text-lg flex-shrink-0">🎉</span>
          <p className="text-[11px] text-green-700 dark:text-green-400 font-semibold">Fondo completado exitosamente.</p>
        </div>
      )}

      {estado === 'en_ejecucion' && (
        <div className="mt-3 p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-start gap-2 shadow-sm">
          <span className="text-lg flex-shrink-0">⚡</span>
          <p className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold">
            {esVistaDocente
              ? 'Tu fondo esta siendo ejecutado. Documentaras mediante informes.'
              : 'El fondo esta en ejecucion. El docente documentara mediante informes.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default EstadoTimeline;
