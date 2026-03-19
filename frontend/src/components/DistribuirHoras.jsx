import { useState, useEffect } from 'react';
import { getCategoriasPorFondo } from '../apis/api';
import toast from 'react-hot-toast';

const FUNCIONES_SUSTANTIVAS = [
  { tipo: 'docente', nombre: 'Docente', icon: '📖', color: '#3B82F6' },
  { tipo: 'investigacion', nombre: 'Investigación', icon: '🔬', color: '#10B981' },
  { tipo: 'extension', nombre: 'Extensión e Interacción Social', icon: '🤝', color: '#F59E0B' },
  { tipo: 'asesorias', nombre: 'Asesorías y Tutorías', icon: '👥', color: '#EF4444' },
  { tipo: 'tribunales', nombre: 'Tribunales', icon: '⚖️', color: '#8B5CF6' },
  { tipo: 'administrativo', nombre: 'Administrativo', icon: '📋', color: '#EC4899' },
  { tipo: 'vida_universitaria', nombre: 'Vida Universitaria', icon: '🎓', color: '#06B6D4' },
];

const LockClosedIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

function DistribuirHoras({ fondoId, horasEfectivas = 1832, onAgregarActividad, hideActionButtons = false }) {
  const [categorias, setCategorias] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarCategorias();
  }, [fondoId]);

  const cargarCategorias = async () => {
    try {
      setLoading(true);
      const response = await getCategoriasPorFondo(fondoId);

      const categoriasArray = response.data.results || response.data;

      if (!Array.isArray(categoriasArray)) {
        setCategorias({});
        return;
      }

      const categoriasObj = {};
      categoriasArray.forEach(cat => {
        categoriasObj[cat.tipo] = {
          id: cat.id,
          horas: parseFloat(cat.total_horas) || 0,
          detalles_carga: cat.detalles_carga || [],
          actividades: cat.actividades || []
        };
      });

      setCategorias(categoriasObj);

    } catch (err) {
      if (err.response?.status === 404) {
        setCategorias({});
      } else {
        toast.error('Error al cargar la distribución');
      }
    } finally {
      setLoading(false);
    }
  };

  const calcularTotales = () => {
    const totalAsignado = Object.values(categorias).reduce(
      (sum, cat) => sum + (cat.horas || 0),
      0
    );
    const disponible = horasEfectivas - totalAsignado;
    // Evitar división por cero
    const porcentaje = horasEfectivas > 0 ? (totalAsignado / horasEfectivas * 100) : 0;

    return { totalAsignado, disponible, porcentaje };
  };

  const { totalAsignado, disponible, porcentaje } = calcularTotales();

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600 mx-auto mb-3"></div>
          <p className="text-slate-700 dark:text-slate-300 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Lógica del Semáforo (TotalValidator)
  const diff = totalAsignado - horasEfectivas;
  let barColor = 'bg-blue-500';
  let statusColor = 'text-blue-600 dark:text-blue-400';
  let statusText = 'DÉFICIT DE HORAS';
  let statusMessage = `Faltan ${Math.round(disponible)} hrs para cumplir el contrato`;

  if (Math.abs(diff) < 0.1) { // Margen de error pequeño para flotantes
    barColor = 'bg-green-500';
    statusColor = 'text-green-600 dark:text-green-400';
    statusText = 'CUMPLIMIENTO PERFECTO';
    statusMessage = 'Has completado exactamente las horas requeridas';
  } else if (diff > 0) {
    barColor = 'bg-orange-500';
    statusColor = 'text-orange-600 dark:text-orange-400';
    statusText = 'EXCESO DE HORAS';
    statusMessage = `Te has pasado por ${Math.round(diff)} hrs`;
  }

  return (
    <div className="space-y-2">
      {/* Cuadro de Distribución */}
      <div className="bg-white dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
        <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 text-center transition-colors duration-300">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-100">
            Distribucion de Horas por Funcion
          </h2>
        </div>
        <div className="p-4 sm:p-5">
          {/* 1. Tarjetas de Resumen (Arriba) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {FUNCIONES_SUSTANTIVAS.map((funcion) => {
              const cat = categorias[funcion.tipo];
              const horas = cat?.horas || 0;
              const tieneHoras = horas > 0;

              return (
                <div
                  key={funcion.tipo}
                  className={`relative overflow-hidden rounded-xl border flex flex-col justify-between p-3 transition-all duration-300 ${tieneHoras
                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
                    }`}
                >
                  {/* Acento de color superior (solo si tiene horas) */}
                  {tieneHoras && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: funcion.color }}
                    />
                  )}

                <h3 className={`font-semibold text-xs leading-tight mb-2 ${tieneHoras ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                  {funcion.nombre}
                </h3>

                <div className="flex items-baseline gap-1 mt-auto">
                  <span className={`text-lg sm:text-xl font-black leading-none ${tieneHoras ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                      {Math.round(horas)}
                    </span>
                    <span className={`text-xs font-semibold leading-none ${tieneHoras ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'}`}>
                      hrs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. TotalValidator (Fuera del cuadro) */}
      <div className={`bg-slate-50/90 dark:bg-slate-900/50 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300 flex flex-col ${onAgregarActividad && !hideActionButtons ? 'justify-between' : 'justify-center min-h-[220px]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Progreso Global del Contrato
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">
                {Math.round(totalAsignado)}
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                / {Math.round(horasEfectivas)} hrs
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${
              Math.abs(diff) < 0.1
                ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700'
                : diff > 0
                ? 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
                : 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            }`}>
              {Math.abs(diff) < 0.1 ? 'CUMPLIDO' : diff > 0 ? 'EXCESO' : 'DEFICIT'}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium text-right">
              {statusMessage}
            </span>
          </div>
        </div>

        {/* Barra de Progreso */}
        <div className="relative mt-3">
          <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ring-2 ring-slate-300/80 dark:ring-slate-600/80">
            <div
              className={`h-full transition-all duration-700 ease-out ${barColor} relative`}
              style={{ width: `${Math.min((totalAsignado / horasEfectivas) * 100, 100)}%` }}
            >
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,rgba(255,255,255,.4) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.4) 50%,rgba(255,255,255,.4) 75%,transparent 75%,transparent)',
                  backgroundSize: '0.75rem 0.75rem'
                }}
              ></div>
            </div>
          </div>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white drop-shadow-md">
            {Math.round(porcentaje)}%
          </span>
        </div>

        {onAgregarActividad && !hideActionButtons && (
          <button
            onClick={onAgregarActividad}
            className="mt-4 w-full py-2 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <span className="text-base leading-none">➕</span>
            <span>Agregar Nueva Actividad</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default DistribuirHoras;