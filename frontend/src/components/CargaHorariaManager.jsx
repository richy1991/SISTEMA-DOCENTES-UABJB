import React, { useState, useEffect, useRef } from 'react';
import api from '../apis/api';
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

const SEMANAS_GESTION = 45.8;

const ChevronDown = ({ open = false }) => (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
            <svg
                className={`w-3 h-3 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
        </span>
    </div>
);

const CustomSelect = ({
    value,
    options,
    onChange,
    placeholder,
    disabled = false,
    emptyText = 'Sin opciones disponibles',
    menuMaxHeight = 'max-h-56'
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selected = options.find(opt => opt.value?.toString() === value?.toString());

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handlePick = (newValue) => {
        onChange(newValue);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setOpen(prev => !prev)}
                disabled={disabled}
                className={`w-full text-left pl-3.5 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm shadow-sm transition-all ${
                    disabled
                        ? 'border-slate-300/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                        : open
                            ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100'
                            : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'
                }`}
            >
                <span className="block truncate font-semibold">{selected ? selected.label : placeholder}</span>
                <ChevronDown open={open} />
            </button>

            {open && !disabled && (
                <div className={`absolute z-30 mt-1.5 w-full overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35 ${menuMaxHeight}`}>
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
                    ) : (
                        options.map((opt) => {
                            const active = opt.value?.toString() === value?.toString();
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handlePick(opt.value)}
                                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors border-l-2 ${
                                        active
                                            ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold'
                                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/90'
                                    }`}
                                    title={opt.label}
                                >
                                    <span className="block truncate">{opt.label}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

const CargaHorariaManager = ({ docenteId, calendarioId, onCargaUpdate, cargaEdicion, onCancelarEdicion, readOnly = true }) => {
    const [cargas, setCargas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [semestre, setSemestre] = useState('');
    const [materias, setMaterias] = useState([]);
    const [loadingMaterias, setLoadingMaterias] = useState(false);
    const extractValidationMessage = (data) => {
        if (!data) return 'Datos inválidos.';
        if (typeof data === 'string') return data;
        if (typeof data?.error === 'string') return data.error;
        if (typeof data?.detail === 'string') return data.detail;
        if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length > 0) {
            return String(data.non_field_errors[0]);
        }

        if (typeof data === 'object') {
            const firstKey = Object.keys(data)[0];
            const firstValue = data[firstKey];
            if (Array.isArray(firstValue) && firstValue.length > 0) return String(firstValue[0]);
            if (typeof firstValue === 'string') return firstValue;
            if (typeof firstValue === 'object' && firstValue !== null) {
                const nested = Object.values(firstValue)[0];
                if (Array.isArray(nested) && nested.length > 0) return String(nested[0]);
                if (typeof nested === 'string') return nested;
            }
        }

        return 'Datos inválidos.';
    };
    const [allMaterias, setAllMaterias] = useState([]);
    const [semestresDisponibles, setSemestresDisponibles] = useState([]);
    const [formData, setFormData] = useState({
        categoria: 'docente',
        titulo_actividad: '',
        horas: '',
        documento_respaldo: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isReadOnly = Boolean(readOnly);

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
        if (isReadOnly) return;
        if (!formData.titulo_actividad || !formData.horas) {
            toast.error("Complete los campos obligatorios");
            return;
        }
        if (formData.categoria !== 'docente' && !formData.documento_respaldo?.trim()) {
            toast.error("El campo de respaldo es obligatorio para categorías distintas a Docencia");
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
            const statusCode = error.response?.status;
            const data = error.response?.data;
            if (statusCode === 400) {
                const validationMessage = extractValidationMessage(data);
                toast.error(`ERROR DE VALIDACIÓN: ${validationMessage}`);
            } else {
                toast.error("Error al guardar");
            }
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
            const statusCode = error.response?.status;
            const data = error.response?.data;
            if (statusCode === 400) {
                const validationMessage = extractValidationMessage(data);
                toast.error(`ERROR DE VALIDACIÓN: ${validationMessage}`);
            } else {
                toast.error("Error al eliminar");
            }
        }
    };

    const handleMateriaChange = (materiaId) => {
        const materia = materias.find(m => m.id.toString() === materiaId);
        if (materia) {
            const horasAnuales = Math.round((materia.horas_totales || 0) * SEMANAS_GESTION);
            setFormData({ ...formData, titulo_actividad: materia.nombre, horas: horasAnuales });
        }
    };

    const categoriaOptions = CATEGORIA_OPCIONES.map(opt => ({ value: opt.value, label: opt.label }));
    const semestreOptions = semestresDisponibles.map(s => ({ value: s.toString(), label: `${s}° Semestre` }));
    const materiaOptions = materias.map(m => ({
        value: m.id.toString(),
        label: `${m.nombre} (${m.horas_teoricas} HT / ${m.horas_practicas} HP - Total: ${m.horas_totales} hrs/sem)`
    }));
    const selectedMateriaId = materias.find(m => m.nombre === formData.titulo_actividad)?.id?.toString() || '';
    const respaldoRequerido = formData.categoria !== 'docente';
    const respaldoInvalido = respaldoRequerido && !formData.documento_respaldo?.trim();
    const submitDisabled = isSubmitting || !formData.titulo_actividad || !formData.horas || respaldoInvalido;

    const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-transparent transition-all";
    const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
            <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-100">
                    Asignacion de Carga Horaria
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Jefatura
                    </span>
                    {cargaEdicion && !isReadOnly && (
                        <button
                            type="button"
                            onClick={onCancelarEdicion}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="w-3 h-3" /> Cancelar
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto">

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
                                <CustomSelect
                                    value={formData.categoria}
                                    options={categoriaOptions}
                                    onChange={(newValue) => setFormData({ ...formData, categoria: newValue })}
                                    placeholder="Seleccionar categoría"
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Semestre / Nivel</label>
                                <CustomSelect
                                    value={semestre}
                                    options={semestreOptions}
                                    onChange={(newValue) => setSemestre(newValue)}
                                    placeholder={loadingMaterias ? 'Cargando…' : '-- Nivel --'}
                                    disabled={loadingMaterias || isReadOnly}
                                    emptyText={loadingMaterias ? 'Cargando niveles…' : 'No hay niveles disponibles'}
                                />
                            </div>
                        </div>

                        {/* Fila 2: Materia */}
                        <div>
                            <label className={labelCls}>Materia (Malla curricular)</label>
                            <CustomSelect
                                value={selectedMateriaId}
                                options={materiaOptions}
                                onChange={handleMateriaChange}
                                placeholder={!semestre ? '← Seleccione un nivel primero' : '-- Seleccionar Materia --'}
                                disabled={!semestre || isReadOnly}
                                emptyText={!semestre ? 'Selecciona primero un nivel' : 'No hay materias en este nivel'}
                                menuMaxHeight="max-h-64"
                            />
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
                                Total horas anuales = (HT + HP) × {SEMANAS_GESTION} semanas
                            </p>
                        </div>

                        {/* Fila 4: Respaldo */}
                        <div>
                            <label className={labelCls}>
                                Respaldo <span className={`font-normal normal-case ${respaldoInvalido ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    ({respaldoRequerido ? 'OBLIGATORIO' : 'opcional'})
                                </span>
                            </label>
                            <input type="text" className={`${inputCls} ${respaldoInvalido ? 'border-red-500 dark:border-red-400 focus:ring-red-400 dark:focus:ring-red-500' : ''}`} placeholder="Ej: Memo #123"
                                value={formData.documento_respaldo}
                                onChange={e => setFormData({ ...formData, documento_respaldo: e.target.value })}
                                disabled={isReadOnly} />
                        </div>
                    </div>

                    {/* ── Botón — pegado al fondo con mt-auto ── */}
                    <div className="mt-5">
                        {!isReadOnly && (
                        <button type="submit"
                            disabled={submitDisabled}
                            className={`w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all ${
                                submitDisabled
                                    ? 'bg-slate-400 dark:bg-slate-600 opacity-60 cursor-not-allowed shadow-none'
                                    : `shadow-md hover:shadow-lg hover:scale-[1.01] ${cargaEdicion
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/20'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                                    }`
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
                        )}
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CargaHorariaManager;