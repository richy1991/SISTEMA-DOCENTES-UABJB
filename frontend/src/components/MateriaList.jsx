import React, { useState, useEffect } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// --- ICONOS ---
const BookOpenIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.967 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

const PlusIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const ClockIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const AcademicCapIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.24 28.45 28.45 0 01-2.658.813m-15.482 0A28.33 28.33 0 0112 13.489a28.331 28.331 0 01-5.482-3.342z" />
    </svg>
);

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

const FilterIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
);

const MateriaList = ({ isDark }) => {
    const [materias, setMaterias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [semestreSeleccionado, setSemestreSeleccionado] = useState('todos');

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user') || 'null');
        setUser(userData);
        const fetchMaterias = async () => {
            try {
                let allMaterias = [];
                let nextUrl = '/materias/';

                while (nextUrl) {
                    const res = await api.get(nextUrl);
                    const data = res.data;
                    if (data.results) {
                        allMaterias = [...allMaterias, ...data.results];
                        nextUrl = data.next;
                    } else {
                        allMaterias = Array.isArray(data) ? data : [];
                        nextUrl = null;
                    }
                }
                setMaterias(allMaterias);
            } catch (error) {
                console.error("Error cargando materias:", error);
                toast.error("Error al cargar materias");
            } finally {
                setLoading(false);
            }
        };
        fetchMaterias();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta materia?')) {
            try {
                await api.delete(`/materias/${id}/`);
                setMaterias(materias.filter(m => m.id !== id));
                toast.success('Materia eliminada correctamente');
            } catch (error) {
                console.error("Error eliminando materia:", error);
                toast.error('Error al eliminar materia');
            }
        }
    };

    const canEdit = user?.is_superuser || user?.perfil?.rol === 'admin' || user?.perfil?.rol === 'director';

    // Obtener lista de semestres únicos para el filtro
    const semestresDisponibles = [...new Set(materias.map(m => m.semestre))].sort((a, b) => a - b);

    // Filtrar materias
    const materiasFiltradas = semestreSeleccionado === 'todos'
        ? materias
        : materias.filter(m => m.semestre.toString() === semestreSeleccionado);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando materias...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                                <BookOpenIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                Materias y Asignaturas
                            </h1>
                            <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                                Gestión del catálogo de materias por carrera
                            </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 items-center">
                            {/* Filtro por Semestre */}
                            <div className="relative w-full sm:w-auto">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FilterIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <select
                                    value={semestreSeleccionado}
                                    onChange={(e) => setSemestreSeleccionado(e.target.value)}
                                    className="w-full sm:w-auto appearance-none bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2.5 pl-10 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-shadow cursor-pointer"
                                >
                                    <option value="todos">Todos los Semestres</option>
                                    {semestresDisponibles.map(s => (
                                        <option key={s} value={s}>{s}º Semestre</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {canEdit && (
                                <Link 
                                    to="/fondo-tiempo/materias/nueva" 
                                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Nueva Materia
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid de Materias */}
                {materiasFiltradas.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {materiasFiltradas.map((materia) => (
                            <div 
                                key={materia.id} 
                                className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                            >
                                <div className="p-5">
                                    {/* Badges Superiores */}
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                            {materia.sigla}
                                        </span>
                                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                            {materia.semestre}º Semestre
                                        </span>
                                    </div>
                                    
                                    {/* Título */}
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {materia.nombre}
                                    </h3>
                                    
                                    {/* Carrera */}
                                    <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                                        <AcademicCapIcon className="w-4 h-4" />
                                        <span className="truncate">{materia.carrera_nombre || materia.carrera}</span>
                                    </div>

                                    {/* Footer con Horas */}
                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                            <ClockIcon className="w-4 h-4" />
                                            <span>Carga Horaria:</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800" title="Horas Teóricas">
                                                T: {materia.horas_teoricas}
                                            </span>
                                            <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-100 dark:border-emerald-800" title="Horas Prácticas">
                                                P: {materia.horas_practicas}
                                            </span>
                                        </div>
                                        {canEdit && (
                                            <div className="flex gap-2 ml-4">
                                                <Link 
                                                    to={`/fondo-tiempo/materias/editar/${materia.id}`}
                                                    className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                                    title="Editar"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </Link>
                                                <button 
                                                    onClick={() => handleDelete(materia.id)}
                                                    className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
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
                            <BookOpenIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            {materias.length > 0 ? 'No hay materias en este semestre' : 'No hay materias registradas'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            {materias.length > 0 ? 'Intenta seleccionar otro semestre o "Todos".' : 'Comienza agregando tu primera materia al sistema.'}
                        </p>
                        {canEdit && (
                            <Link 
                                to="/fondo-tiempo/materias/nueva" 
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Crear Primera Materia
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MateriaList;