import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFondosTiempo } from '../apis/api';
import axios from 'axios';

// --- ICONOS ---
const EyeIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639l4.43-4.43a1.012 1.012 0 011.43 0l4.43 4.43a1.012 1.012 0 010 .639l-4.43 4.43a1.012 1.012 0 01-1.43 0l-4.43-4.43z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PencilIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
  </svg>
);

const ArchiveBoxIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" />
  </svg>
);

function ListaFondos({ isDark }) {
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    cargarFondos();
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
  }, []);

  const cargarFondos = async () => {
    try {
      const response = await getFondosTiempo();
      const data = response.data.results || response.data;
      setFondos(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar los fondos de tiempo');
      setLoading(false);
      console.error(err);
    }
  };

  const archivarFondo = async (fondoId) => {
    if (!confirm('¿Está seguro de archivar este fondo? Podrá restaurarlo después.')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(
        `http://127.0.0.1:8000/api/fondos-tiempo/${fondoId}/`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      await cargarFondos();
      alert('✅ Fondo archivado correctamente');
    } catch (err) {
      console.error(err);
      alert('❌ Error al archivar: ' + (err.response?.data?.detail || err.message));
    }
  };

  const puedeEditar = (fondo) => {
    if (user?.perfil?.rol === 'docente') return false;
    return fondo.estado === 'borrador';
  };

  // iiisyp es solo lectura: solo superuser puede archivar fondos
  const esAdmin = () => {
    return user?.is_superuser === true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-400">
            Cargando fondos de tiempo...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-6 bg-slate-50 dark:bg-slate-900">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header con mejor contraste */}
      <div className="bg-white dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 shadow-md">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Título */}
            <div>
              <h2 className="text-3xl font-bold text-blue-600 dark:text-white">
                Dashboard de Fondos
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Gestión del Fondo de Tiempo Docente
              </p>
            </div>

            {/* Contador y Botón */}
            <div className="flex items-center gap-4">
              <div className="bg-slate-50 dark:bg-slate-700 px-6 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-md">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-white">
                    {fondos.length}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-400 font-medium">Total fondos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de fondos */}
      <div className="max-w-7xl mx-auto p-6">
        {fondos.length > 0 ? (
          <div className="space-y-4">
            {fondos.map((fondo) => (
              <div 
                key={fondo.id} 
                className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
              >
                <div className="p-5">
                  {/* Fila superior */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    {/* Info del docente */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
                        {(fondo.docente_nombre || 'NN').split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-blue-600 dark:text-white truncate">
                          {fondo.docente_nombre}
                        </h3>
                        <p className="text-sm text-slate-700 dark:text-slate-400 truncate">
                          {fondo.carrera_nombre}
                        </p>
                      </div>
                    </div>

                    {/* Horas */}
                    <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-sm min-w-[140px]">
                      <div className="text-xl font-bold text-slate-800 dark:text-white text-center">
                        {Math.round(fondo.total_asignado || 0)} <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">/ {Math.round(fondo.horas_efectivas || 0)}</span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-400 font-medium text-center">hrs asignadas</div>
                    </div>

                    {/* Estado */}
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 shadow-sm ${
                      fondo.estado === 'validado' 
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700' 
                        : fondo.estado === 'aprobado' 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                          : fondo.estado === 'revision'
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    }`}>
                      {fondo.estado.toUpperCase()}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600">
                      📅 {fondo.gestion}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600">
                      📚 {fondo.asignatura}
                    </span>
                  </div>

                  {/* Progreso + Botones */}
                  <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t-2 border-slate-300 dark:border-slate-700">
                    {/* Progreso */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                          Progreso
                        </span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {Math.round(fondo.porcentaje_completado)}%
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${fondo.porcentaje_completado}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Botones */}
                    <div className="flex flex-wrap gap-2">
                      <Link 
                        to={`/fondo-tiempo/fondo/${fondo.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                      >
                        <EyeIcon className="w-5 h-5" />
                        <span>Ver</span>
                      </Link>

                      {puedeEditar(fondo) && (
                        <Link 
                          to={`/fondo-tiempo/editar-fondo/${fondo.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                        >
                          <PencilIcon className="w-5 h-5" />
                          <span>Editar</span>
                        </Link>
                      )}

                      {esAdmin() && ['aprobado_director', 'finalizado', 'rechazado', 'aprobado', 'anulado'].includes(fondo.estado) && (
                        <button
                          onClick={() => archivarFondo(fondo.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                        >
                          <ArchiveBoxIcon className="w-5 h-5" />
                          <span>Archivar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">📊</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay fondos registrados
            </h3>
            <p className="text-slate-700 dark:text-slate-400 mb-6">
              Comienza creando tu primer fondo de tiempo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ListaFondos;