import { useState, useEffect } from 'react';
import { getCategoriasPorFondo } from '../api';
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

function DistribuirHoras({ fondoId, horasEfectivas = 1832, onAgregarActividad }) {
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
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-4 text-center">
        <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
          Distribución de Horas por Función
        </h2>
        <p className="text-xs text-blue-100 mt-1 max-w-2xl mx-auto">
          Visualiza el avance de tus horas requeridas según tu tiempo de dedicación y la asignación de Jefatura.
        </p>
      </div>

      <div className="p-5">
        {/* 1. Tarjetas de Resumen (Arriba) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {FUNCIONES_SUSTANTIVAS.map((funcion) => {
            const cat = categorias[funcion.tipo];
            const horas = cat?.horas || 0;
            const tieneHoras = horas > 0;

            return (
              <div
                key={funcion.tipo}
                className={`relative overflow-hidden rounded-xl border flex flex-col justify-between p-4 transition-all duration-300 ${tieneHoras
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

                <h3 className={`font-semibold text-xs leading-tight mb-3 ${tieneHoras ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                  {funcion.nombre}
                </h3>

                <div className="flex items-baseline gap-1 mt-auto">
                  <span className={`text-2xl font-black ${tieneHoras ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                    {Math.round(horas)}
                  </span>
                  <span className={`text-xs font-bold leading-none ${tieneHoras ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'}`}>
                    hrs
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. TotalValidator (El Semáforo - Abajo) */}
        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-5 border-2 border-slate-200 dark:border-slate-600">
          <div className="flex flex-col md:flex-row justify-between items-end mb-3 gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Progreso Global del Contrato
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-800 dark:text-white">
                  {Math.round(totalAsignado)}
                </span>
                <span className="text-lg font-medium text-slate-500 dark:text-slate-400">
                  / {Math.round(horasEfectivas)} hrs
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-black ${statusColor} flex items-center justify-end gap-2`}>
                {Math.abs(diff) < 0.1 ? '✅' : diff > 0 ? '⚠️' : '📝'} {statusText}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                {statusMessage}
              </p>
            </div>
          </div>

          {/* Barra de Progreso */}
          <div className="h-8 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner relative">
            <div
              className={`h-full transition-all duration-1000 ease-out ${barColor} flex items-center justify-end pr-3 relative`}
              style={{ width: `${Math.min((totalAsignado / horasEfectivas) * 100, 100)}%` }}
            >
              <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
              <span className="text-white text-xs font-bold drop-shadow-md relative z-10">
                {Math.round(porcentaje)}%
              </span>
            </div>
          </div>

          {onAgregarActividad && (
            <button
              onClick={onAgregarActividad}
              className="mt-5 w-full py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">➕</span>
              <span>Agregar Nueva Actividad</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default DistribuirHoras;