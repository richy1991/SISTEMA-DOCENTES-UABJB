import React, { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const PlusIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const XMarkIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const ChevronDown = () => (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);

const CargaHorariaManager = ({ docenteId, calendarioId, onCargaUpdate, cargaEdicion, onCancelarEdicion }) => {
    const [cargas, setCargas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [semestre, setSemestre] = useState('');
    const [materias, setMaterias] = useState([]);
    const [loadingMaterias, setLoadingMaterias] = useState(false);
    const [allMaterias, setAllMaterias] = useState([]);
    const [semestresDisponibles, setSemestresDisponibles] = useState([]);
    const [formData, setFormData] = useState({
        categoria: 'docente',
        titulo_actividad: '',
        horas: '',
        documento_respaldo: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const CATEGORIA_OPCIONES = [
        { value: 'docente', label: 'Docencia' },
        { value: 'investigacion', label: 'Investigación' },
        { value: 'extension', label: 'Extensión e Interacción' },
        { value: 'asesorias', label: 'Asesorías y Tutorías' },
        { value: 'tribunales', label: 'Tribunales' },
        { value: 'administrativo', label: 'Administrativo / Gestión' },
        { value: 'vida_universitaria', label: 'Vida Universitaria' },
    ];

    useEffect(() => {
        if (docenteId && calendarioId) cargarCargas();
    }, [docenteId, calendarioId]);

    useEffect(() => {
        if (cargaEdicion) {
            setFormData({
                categoria: cargaEdicion.categoria || 'docente',
                titulo_actividad: cargaEdicion.titulo_actividad,
                horas: cargaEdicion.horas,
                documento_respaldo: cargaEdicion.respaldo || ''
            });
        } else {
            setFormData({ categoria: 'docente', titulo_actividad: '', horas: '', documento_respaldo: '' });
        }
    }, [cargaEdicion]);

    useEffect(() => {
        const fetchAllMaterias = async () => {
            setLoadingMaterias(true);
            try {
                let todas = [];
                let nextUrl = '/materias/';
                while (nextUrl) {
                    const response = await api.get(nextUrl);
                    const data = response.data;
                    if (data.results) {
                        todas = [...todas, ...data.results];
                        nextUrl = data.next;
                    } else {
                        todas = Array.isArray(data) ? data : [];
                        nextUrl = null;
                    }
                }
                setAllMaterias(todas);
                const uniqueSemestres = [...new Set(todas.map(m => m.semestre))].sort((a, b) => a - b);
                setSemestresDisponibles(uniqueSemestres);
            } catch (error) {
                console.error("Error cargando materias:", error);
                toast.error("Error al cargar materias");
            } finally {
                setLoadingMaterias(false);
            }
        };
        fetchAllMaterias();
    }, []);

    useEffect(() => {
        if (semestre) {
            setMaterias(allMaterias.filter(m => m.semestre.toString() === semestre.toString()));
        } else {
            setMaterias([]);
        }
    }, [semestre, allMaterias]);

    const cargarCargas = async () => {
        try {
            setLoading(true);
            const response = await api.get('/cargas-horarias/', {
                params: { docente: docenteId, calendario: calendarioId }
            });
            setCargas(response.data.results || response.data);
        } catch (error) {
            console.error("Error al cargar cargas horarias:", error);
            toast.error("Error al cargar asignaciones");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.titulo_actividad || !formData.horas) {
            toast.error("Complete los campos obligatorios");
            return;
        }
        setIsSubmitting(true);
        try {
            if (cargaEdicion) {
                await api.put(`/cargas-horarias/${cargaEdicion.id}/`, {
                    ...formData, docente: docenteId, calendario: calendarioId
                });
                toast.success("Asignación actualizada");
                if (onCancelarEdicion) onCancelarEdicion();
            } else {
                await api.post('/cargas-horarias/', {
                    ...formData, docente: docenteId, calendario: calendarioId
                });
                toast.success("Asignación agregada");
            }
            setFormData({ categoria: 'docente', titulo_actividad: '', horas: '', documento_respaldo: '' });
            setSemestre('');
            cargarCargas();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar esta asignación?")) return;
        try {
            await api.delete(`/cargas-horarias/${id}/`);
            toast.success("Eliminado");
            cargarCargas();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar");
        }
    };

    const handleMateriaChange = (e) => {
        const materiaId = e.target.value;
        const materia = materias.find(m => m.id.toString() === materiaId);
        if (materia) {
            const horasAnuales = Math.round((materia.horas_totales || 0) * 45.8);
            setFormData({ ...formData, titulo_actividad: materia.nombre, horas: horasAnuales, categoria: 'docente' });
        }
    };

    // Estilos reutilizables idénticos al resto del sistema
    const selectCls = "w-full pl-3 pr-8 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-transparent transition-all cursor-pointer appearance-none disabled:opacity-40 disabled:cursor-not-allowed";
    const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-transparent transition-all";
    const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

    return (
        /* h-full + flex-col: el componente se estira hasta la altura asignada por el padre */
        <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm relative overflow-hidden">

            {/* Barra superior — idéntica a Balance y Distribución */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />

            {/* Contenido — flex-1 para ocupar todo el alto, flex-col para distribuir */}
            <div className="flex-1 flex flex-col px-5 pt-6 pb-5 overflow-y-auto">

                {/* ── Header ───────────────────────────────────── */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        Asignación de Carga Horaria
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-blue-400 dark:text-blue-500 normal-case font-semibold tracking-normal text-[10px]">Jefatura</span>
                    </h3>
                    {cargaEdicion && (
                        <button type="button" onClick={onCancelarEdicion}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1 rounded-lg transition-colors">
                            <XMarkIcon className="w-3 h-3" /> Cancelar
                        </button>
                    )}
                </div>

                {/* Banner edición */}
                {cargaEdicion && (
                    <div className="mb-3 shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <PencilIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">
                            Editando: <span className="font-bold">{cargaEdicion.titulo_actividad}</span>
                        </p>
                    </div>
                )}

                {/* ── Formulario — flex-1 + flex-col + justify-between ── */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between gap-0">

                    {/* Campos superiores */}
                    <div className="space-y-4">

                        {/* Fila 1: Categoría + Semestre */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Categoría</label>
                                <div className="relative">
                                    <select className={selectCls} value={formData.categoria}
                                        onChange={e => setFormData({ ...formData, categoria: e.target.value })}>
                                        {CATEGORIA_OPCIONES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Semestre / Nivel</label>
                                <div className="relative">
                                    <select className={selectCls} value={semestre}
                                        onChange={e => setSemestre(e.target.value)} disabled={loadingMaterias}>
                                        <option value="">{loadingMaterias ? 'Cargando…' : '-- Nivel --'}</option>
                                        {semestresDisponibles.map(s => (
                                            <option key={s} value={s}>{s}° Semestre</option>
                                        ))}
                                    </select>
                                    <ChevronDown />
                                </div>
                            </div>
                        </div>

                        {/* Fila 2: Materia */}
                        <div>
                            <label className={labelCls}>Materia (Malla curricular)</label>
                            <div className="relative">
                                <select className={selectCls} onChange={handleMateriaChange} disabled={!semestre}
                                    value={materias.find(m => m.nombre === formData.titulo_actividad)?.id || ''}>
                                    <option value="">{!semestre ? '← Seleccione un nivel primero' : '-- Seleccionar Materia --'}</option>
                                    {materias.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.nombre} ({m.horas_teoricas} HT / {m.horas_practicas} HP - Total: {m.horas_totales} hrs/sem)
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown />
                            </div>
                        </div>

                        {/* Fila 3: Horas calculadas — tarjeta destacada */}
                        <div className={`rounded-xl border-2 transition-all p-4 ${formData.horas
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider ${formData.horas ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    Horas Anuales <span className="font-normal normal-case opacity-70">(auto)</span>
                                </span>
                                {formData.horas && (
                                    <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                        CALCULADO
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-black leading-none ${formData.horas ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                    {formData.horas || '0'}
                                </span>
                                <span className={`text-sm font-bold ${formData.horas ? 'text-blue-400 dark:text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                    hrs/año
                                </span>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 leading-tight">
                                Total horas anuales = (HT + HP) × 45.8 semanas
                            </p>
                        </div>

                        {/* Fila 4: Respaldo */}
                        <div>
                            <label className={labelCls}>
                                Respaldo <span className="text-slate-400 dark:text-slate-500 font-normal normal-case">(opcional)</span>
                            </label>
                            <input type="text" className={inputCls} placeholder="Ej: Memo #123"
                                value={formData.documento_respaldo}
                                onChange={e => setFormData({ ...formData, documento_respaldo: e.target.value })} />
                        </div>
                    </div>

                    {/* ── Botón — pegado al fondo con mt-auto ── */}
                    <div className="mt-5">
                        <button type="submit"
                            disabled={isSubmitting || !formData.titulo_actividad || !formData.horas}
                            className={`w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none
                                ${cargaEdicion
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/20'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                                }`}>
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Guardando…
                                </>
                            ) : cargaEdicion ? (
                                <><PencilIcon className="w-4 h-4" /> Actualizar Asignación</>
                            ) : (
                                <><PlusIcon className="w-4 h-4" /> Agregar Asignación</>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CargaHorariaManager;