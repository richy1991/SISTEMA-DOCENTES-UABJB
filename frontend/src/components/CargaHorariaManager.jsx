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

const SEMANAS_CLASES_ANUAL = 40;

const SUBACTIVIDADES_DOCENTE = [
    { value: 'preparacion_temas', label: 'Preparación de temas', horas: 1.5 },
    { value: 'clases_aula', label: 'Clases en aula', horas: 9 },
    { value: 'elaboracion_tp', label: 'Elaboración de Trabajos Prácticos', horas: 1 },
    { value: 'revision_tp', label: 'Revisión y Calificación de Trabajos Prácticos', horas: 2 },
    { value: 'elaboracion_examenes', label: 'Elaboración de Exámenes', horas: 0.3 },
    { value: 'revision_examenes', label: 'Revisión y Calificación de Exámenes', horas: 1.5 },
    { value: 'consultas_reclamos', label: 'Consultas y Reclamos de Calificaciones', horas: 0.4 },
    { value: 'planillas_notas', label: 'Elaboración de planillas e Introducción de notas', horas: 0.2 },
    { value: 'planificacion_extra_aula', label: 'Planificación y gestión de práctica extra aula', horas: 0.4 },
    { value: 'ejecucion_extra_aula', label: 'Ejecución de práctica extra aula', horas: 2 },
    { value: 'descargo_viaje', label: 'Informe de descargo de viaje en prácticas', horas: 0 },
    { value: 'laboratorios', label: 'Práctica de Laboratorios', horas: 0 },
    { value: 'campo', label: 'Prácticas de Campo', horas: 2 },
    { value: 'produccion_docente', label: 'Producción docente (textos guías)', horas: 2 },
    { value: 'cursos_verano', label: 'Cursos de verano', horas: 0 },
];

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
                                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
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

const CargaHorariaManager = ({ fondoId, docenteId, calendarioId, onCargaUpdate, cargaEdicion, onCancelarEdicion, readOnly = true }) => {
    const [cargas, setCargas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [semestre, setSemestre] = useState('');
    const [materias, setMaterias] = useState([]);
    const [loadingMaterias, setLoadingMaterias] = useState(false);
    const FIELD_LABELS = {
        materia: 'Materia',
        docente: 'Docente',
        calendario: 'Calendario academico',
        categoria: 'Categoria',
        horas: 'Horas por año',
        titulo_actividad: 'Actividad',
        documento_respaldo: 'Respaldo',
        hora_inicio: 'Hora de inicio',
        hora_fin: 'Hora de fin',
        aula: 'Aula',
        paralelo: 'Paralelo',
        dia_semana: 'Dia de la semana'
    };
    const formatFieldError = (field, value) => {
        const label = FIELD_LABELS[field] || field;
        if (Array.isArray(value) && value.length > 0) return `${label}: ${value[0]}`;
        if (typeof value === 'string') return `${label}: ${value}`;
        if (typeof value === 'object' && value !== null) {
            const nestedKey = Object.keys(value)[0];
            if (nestedKey) return `${label}: ${formatFieldError(nestedKey, value[nestedKey])}`;
        }
        return `${label}: Datos invalidos.`;
    };
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
            if (firstKey) return formatFieldError(firstKey, firstValue);
        }

        return 'Datos inválidos.';
    };
    const [allMaterias, setAllMaterias] = useState([]);
    const [semestresDisponibles, setSemestresDisponibles] = useState([]);
    const [fondoDetalle, setFondoDetalle] = useState(null);
    const [formData, setFormData] = useState({
        categoria: 'academica',
        materia: '',
        titulo_actividad: '',
        horas: '',
        documento_respaldo: ''
    });
    const [modoFormulario, setModoFormulario] = useState('academica');
    const [actividadLibre, setActividadLibre] = useState({
        categoria: '',
        periodo: '',
        nombre: '',
        descripcion: '',
        horas_semana: '',
        evidencias: ''
    });
    const [subActividadDocente, setSubActividadDocente] = useState({
        tipo: '',
        horas_semana: '',
        evidencias: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isReadOnly = Boolean(readOnly);

    const CATEGORIA_OPCIONES = [
        { value: 'academica', label: 'DOCENTE' },
    ];

    useEffect(() => {
        if (docenteId && calendarioId) {
            cargarCargas();
            cargarFondoDetalle();
        }
    }, [fondoId, docenteId, calendarioId]);

    useEffect(() => {
        if (cargaEdicion) {
            const semestreEdicion = cargaEdicion.materia_semestre || cargaEdicion.semestre || '';
            setSemestre(semestreEdicion ? semestreEdicion.toString() : '');
            setFormData({
                categoria: 'academica',
                materia: cargaEdicion.materia || cargaEdicion.materia_id || '',
                titulo_actividad: cargaEdicion.titulo_actividad || '',
                horas: cargaEdicion.horas,
                documento_respaldo: cargaEdicion.respaldo || ''
            });
        } else {
            setSemestre('');
            setFormData({ categoria: 'academica', materia: '', titulo_actividad: '', horas: '', documento_respaldo: '' });
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
                setSemestresDisponibles([]);
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
        const carreraId = fondoDetalle?.carrera?.id || fondoDetalle?.carrera;
        const materiasCarrera = allMaterias.filter(m => {
            if (!carreraId) return true;
            const materiaCarrera = m.carrera?.id || m.carrera_id || m.carrera;
            return materiaCarrera?.toString() === carreraId.toString();
        });
        setSemestresDisponibles(Array.from({ length: 10 }, (_, idx) => idx + 1));

        if (semestre) {
            setMaterias(materiasCarrera.filter(m => m.semestre?.toString() === semestre.toString()));
        } else {
            setMaterias([]);
        }
    }, [semestre, allMaterias, fondoDetalle]);

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

    const cargarFondoDetalle = async () => {
        try {
            if (fondoId) {
                const detalle = await api.get(`/fondos-tiempo/${fondoId}/`);
                setFondoDetalle(detalle.data);
                return;
            }
            const response = await api.get('/fondos-tiempo/', {
                params: { docente: docenteId, calendario: calendarioId }
            });
            const fondos = response.data.results || response.data;
            const fondo = Array.isArray(fondos) ? fondos[0] : null;
            if (!fondo?.id) {
                setFondoDetalle(null);
                return;
            }
            const detalle = await api.get(`/fondos-tiempo/${fondo.id}/`);
            setFondoDetalle(detalle.data);
        } catch (error) {
            console.error("Error al cargar presupuesto macro:", error);
            setFondoDetalle(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isReadOnly) return;
        const esAcademica = true;
        if (esAcademica && !formData.materia) {
            toast.error("Seleccione una materia del plan de estudios");
            return;
        }
        if (!esAcademica && !formData.titulo_actividad?.trim()) {
            toast.error("Ingrese una descripción de la actividad");
            return;
        }
        if (!formData.horas || Number(formData.horas) <= 0) {
            toast.error("Verifique las horas por año");
            return;
        }
        setIsSubmitting(true);
        const payload = {
            ...formData,
            categoria: 'academica',
            materia: esAcademica ? formData.materia : null,
            titulo_actividad: esAcademica ? formData.titulo_actividad : formData.titulo_actividad.trim(),
            docente: docenteId,
            calendario: calendarioId
        };
        try {
            if (cargaEdicion) {
                await api.put(`/cargas-horarias/${cargaEdicion.id}/`, payload);
                toast.success("Asignación actualizada");
                if (onCancelarEdicion) onCancelarEdicion();
            } else {
                await api.post('/cargas-horarias/', payload);
                toast.success("Asignación agregada");
            }
            setFormData({ categoria: 'academica', materia: '', titulo_actividad: '', horas: '', documento_respaldo: '' });
            setSemestre('');
            cargarCargas();
            cargarFondoDetalle();
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
        if (!id) return;
        try {
            await api.delete(`/cargas-horarias/${id}/`);
            toast.success("Eliminado");
            cargarCargas();
            cargarFondoDetalle();
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
            const horasAnio = Math.round((materia.horas_totales || 0) * SEMANAS_CLASES_ANUAL);
            setFormData({ ...formData, materia: materiaId, titulo_actividad: materia.nombre, horas: horasAnio });
        }
    };


    const categoriaOptions = CATEGORIA_OPCIONES.map(opt => ({ value: opt.value, label: opt.label }));
    const semestreOptions = semestresDisponibles.map(s => ({ value: s.toString(), label: `${s}° Semestre` }));
    const materiaOptions = materias.map(m => ({
        value: m.id.toString(),
        label: `${m.nombre} (${m.horas_teoricas} HT / ${m.horas_practicas} HP - Total: ${m.horas_totales} hrs/sem)`
    }));
    const categoriasActividadOptions = (fondoDetalle?.categorias || [])
        .filter(cat => cat.tipo !== 'academica')
        .map(cat => ({ value: cat.id.toString(), label: cat.tipo_display || cat.nombre || cat.tipo }));
    const gestionFondo = fondoDetalle?.gestion || fondoDetalle?.calendario_academico?.gestion || '';
    const gestionFondoLabel = gestionFondo ? `Gestión ${gestionFondo}` : 'Gestión del fondo';
    const periodoActividadOptions = gestionFondo
        ? [
            { value: `1er Semestre ${gestionFondo}`, label: `1er Semestre ${gestionFondo}` },
            { value: `2do Semestre ${gestionFondo}`, label: `2do Semestre ${gestionFondo}` },
            { value: `Gestión ${gestionFondo} Completo`, label: `Gestión ${gestionFondo} Completo` },
            { value: 'Transversal', label: 'Transversal' },
        ]
        : [{ value: 'Transversal', label: 'Transversal' }];
    const selectedMateriaId = formData.materia?.toString() || '';
    const esAcademica = true;
    const semanasPresupuesto = SEMANAS_CLASES_ANUAL;
    const categoriaPresupuesto = fondoDetalle?.categorias?.find(cat => cat.tipo === formData.categoria);
    const presupuestoSemana = Number(categoriaPresupuesto?.total_horas || 0);
    const asignadoSemana = cargas
        .filter(carga => carga.categoria === formData.categoria && carga.id !== cargaEdicion?.id)
        .reduce((total, carga) => total + (Number(carga.horas || 0) / semanasPresupuesto), 0);
    const disponibleSemana = presupuestoSemana - asignadoSemana;
    const respaldoRequerido = false;
    const respaldoInvalido = respaldoRequerido && !formData.documento_respaldo?.trim();
    const submitDisabled = isSubmitting
        || (esAcademica ? !formData.materia : !formData.titulo_actividad?.trim())
        || !formData.horas
        || Number(formData.horas) <= 0
        || respaldoInvalido;
    const actividadHorasAnio = Math.round((Number(actividadLibre.horas_semana) || 0) * SEMANAS_CLASES_ANUAL);
    const actividadSubmitDisabled = isSubmitting
        || !actividadLibre.categoria
        || !actividadLibre.periodo
        || !actividadLibre.nombre.trim()
        || !actividadLibre.descripcion.trim()
        || !actividadLibre.horas_semana
        || Number(actividadLibre.horas_semana) <= 0;
    const subactividadesRegistradas = fondoDetalle?.categorias?.find(cat => cat.tipo === 'academica')?.subactividades_docente || [];
    const tiposSubactividadesRegistradas = new Set(subactividadesRegistradas.map(item => item.tipo));
    const subActividadOptions = SUBACTIVIDADES_DOCENTE
        .filter(opt => !tiposSubactividadesRegistradas.has(opt.value) || opt.value === subActividadDocente.tipo)
        .map(opt => ({ value: opt.value, label: opt.label }));
    const subActividadHorasAnio = Math.round((Number(subActividadDocente.horas_semana) || 0) * SEMANAS_CLASES_ANUAL);
    const subActividadSubmitDisabled = isSubmitting
        || !subActividadDocente.tipo
        || subActividadDocente.horas_semana === ''
        || Number(subActividadDocente.horas_semana) < 0;

    const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-transparent transition-all";
    const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

    const handleActividadSubmit = async (e) => {
        e.preventDefault();
        if (isReadOnly || actividadSubmitDisabled) return;
        setIsSubmitting(true);

        const payload = {
            categoria: Number(actividadLibre.categoria),
            detalle: `${gestionFondoLabel} - ${actividadLibre.periodo} - ${actividadLibre.nombre.trim()}: ${actividadLibre.descripcion.trim()}`,
            horas_semana: Number(actividadLibre.horas_semana),
            evidencias: actividadLibre.evidencias.trim()
        };

        try {
            await api.post('/actividades/', payload);
            toast.success('Actividad agregada');
            setActividadLibre({ categoria: '', periodo: '', nombre: '', descripcion: '', horas_semana: '', evidencias: '' });
            cargarFondoDetalle();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            const validationMessage = extractValidationMessage(error.response?.data);
            toast.error(error.response?.status === 400 ? `ERROR DE VALIDACIÓN: ${validationMessage}` : 'Error al guardar actividad');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubActividadChange = (tipo) => {
        const plantilla = SUBACTIVIDADES_DOCENTE.find(item => item.value === tipo);
        setSubActividadDocente(prev => ({
            ...prev,
            tipo,
            horas_semana: plantilla ? String(plantilla.horas) : prev.horas_semana
        }));
    };

    const handleSubActividadSubmit = async (e) => {
        e.preventDefault();
        if (isReadOnly || subActividadSubmitDisabled || !fondoDetalle?.id) return;
        setIsSubmitting(true);

        try {
            await api.post('/subactividades-docente/', {
                fondo_tiempo: fondoDetalle.id,
                tipo: subActividadDocente.tipo,
                horas_semana: Number(subActividadDocente.horas_semana),
                evidencias: subActividadDocente.evidencias.trim()
            });
            toast.success('Sub-actividad DOCENTE agregada');
            setSubActividadDocente({ tipo: '', horas_semana: '', evidencias: '' });
            cargarFondoDetalle();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            const validationMessage = extractValidationMessage(error.response?.data);
            toast.error(error.response?.status === 400 ? `ERROR DE VALIDACIÓN: ${validationMessage}` : 'Error al guardar sub-actividad');
        } finally {
            setIsSubmitting(false);
        }
    };

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

                {/* -- Formulario - flex-1 + flex-col + justify-between -- */}
                <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 p-1 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setModoFormulario('academica')}
                        className={`rounded-lg px-3 py-2 transition-colors ${modoFormulario === 'academica' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        DOCENTE
                    </button>
                    <button
                        type="button"
                        onClick={() => setModoFormulario('otras')}
                        className={`rounded-lg px-3 py-2 transition-colors ${modoFormulario === 'otras' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Actividades no académicas
                    </button>
                </div>

                {modoFormulario === 'academica' ? (
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
                                    onChange={() => {}}
                                    placeholder="DOCENTE"
                                    disabled={true}
                                />
                            </div>
                            {esAcademica && (
                                <div>
                                    <label className={labelCls}>Semestre / Nivel</label>
                                    <CustomSelect
                                        value={semestre}
                                        options={semestreOptions}
                                        onChange={(newValue) => {
                                            setSemestre(newValue);
                                            setFormData(prev => ({ ...prev, materia: '', titulo_actividad: '', horas: '' }));
                                        }}
                                        placeholder={loadingMaterias ? 'Cargando...' : '-- Nivel --'}
                                        disabled={loadingMaterias || isReadOnly}
                                        emptyText={loadingMaterias ? 'Cargando niveles...' : 'No hay niveles disponibles'}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-[11px] font-semibold text-cyan-800 dark:border-cyan-800/70 dark:bg-cyan-950/25 dark:text-cyan-200">
                            Presupuesto: {presupuestoSemana.toFixed(2)} hrs/sem | Asignado: {asignadoSemana.toFixed(2)} hrs/sem | Disponible: {disponibleSemana.toFixed(2)} hrs/sem
                        </div>

                        {/* Fila 2: Materia o actividad */}
                        {esAcademica ? (
                            <div>
                                <label className={labelCls}>Materia (Malla curricular)</label>
                                <CustomSelect
                                    value={selectedMateriaId}
                                    options={materiaOptions}
                                    onChange={handleMateriaChange}
                                    placeholder={!semestre ? 'Seleccione un nivel primero' : '-- Seleccionar Materia --'}
                                    disabled={!semestre || isReadOnly}
                                    emptyText={!semestre ? 'Selecciona primero un nivel' : 'No hay materias en este nivel'}
                                    menuMaxHeight="max-h-64"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className={labelCls}>Descripción de actividad</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="Ej: Proyecto de investigación, extensión o gestión"
                                    value={formData.titulo_actividad}
                                    onChange={e => setFormData({ ...formData, titulo_actividad: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                        )}

                        {/* Fila 3: Horas calculadas - tarjeta destacada */}
                        <div className={`rounded-xl border-2 transition-all p-4 ${formData.horas
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider ${formData.horas ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    Horas por año <span className="font-normal normal-case opacity-70">({esAcademica ? 'auto' : 'manual'})</span>
                                </span>
                                {formData.horas && (
                                    <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                        CALCULADO
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-2">
                                {esAcademica ? (
                                    <span className={`text-3xl font-black leading-none ${formData.horas ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                        {formData.horas || '0'}
                                    </span>
                                ) : (
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="w-32 rounded-lg border border-blue-200 bg-white px-3 py-2 text-2xl font-black leading-none text-blue-600 outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-400"
                                        value={formData.horas}
                                        onChange={e => setFormData({ ...formData, horas: e.target.value })}
                                        disabled={isReadOnly}
                                    />
                                )}
                                <span className={`text-sm font-bold ${formData.horas ? 'text-blue-400 dark:text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                    hrs/año
                                </span>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 leading-tight">
                                {esAcademica
                                    ? `Total horas año = (HT + HP) x ${SEMANAS_CLASES_ANUAL} semanas`
                                    : `Equivalencia semanal aproximada = horas año / ${semanasPresupuesto}`}
                            </p>
                        </div>

                        {/* Fila 4: Respaldo */}
                        <div>
                            <label className={labelCls}>
                                Respaldo <span className={`font-normal normal-case ${respaldoInvalido ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    (opcional)
                                </span>
                            </label>
                            <input type="text" className={`${inputCls} ${respaldoInvalido ? 'border-red-500 dark:border-red-400 focus:ring-red-400 dark:focus:ring-red-500' : ''}`} placeholder="Ej: Memo #123"
                                value={formData.documento_respaldo}
                                onChange={e => setFormData({ ...formData, documento_respaldo: e.target.value })}
                                disabled={isReadOnly} />
                        </div>

                        <div className="rounded-xl border border-slate-300 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/35">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                        Sub-actividades DOCENTE
                                    </h4>
                                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        Valores sugeridos editables del documento de referencia.
                                    </p>
                                </div>
                                <span className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-extrabold text-blue-700 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300">
                                    {subActividadHorasAnio} hrs/año
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
                                <div>
                                    <label className={labelCls}>Actividad pedagógica</label>
                                    <CustomSelect
                                        value={subActividadDocente.tipo}
                                        options={subActividadOptions}
                                        onChange={handleSubActividadChange}
                                        placeholder="Seleccione sub-actividad"
                                        disabled={isReadOnly}
                                        emptyText="Todas las sub-actividades ya fueron registradas"
                                        menuMaxHeight="max-h-64"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Hrs/Sem</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        className={inputCls}
                                        value={subActividadDocente.horas_semana}
                                        onChange={e => setSubActividadDocente(prev => ({ ...prev, horas_semana: e.target.value }))}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="mt-3">
                                <label className={labelCls}>Respaldo / Evidencia</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    value={subActividadDocente.evidencias}
                                    onChange={e => setSubActividadDocente(prev => ({ ...prev, evidencias: e.target.value }))}
                                    placeholder="Opcional"
                                    disabled={isReadOnly}
                                />
                            </div>

                            {!isReadOnly && (
                                <button
                                    type="button"
                                    onClick={handleSubActividadSubmit}
                                    disabled={subActividadSubmitDisabled}
                                    className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all ${
                                        subActividadSubmitDisabled
                                            ? 'cursor-not-allowed bg-slate-400 opacity-60 dark:bg-slate-600'
                                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-md shadow-blue-500/20 hover:from-cyan-700 hover:to-blue-700'
                                    }`}
                                >
                                    Agregar Sub-actividad DOCENTE
                                </button>
                            )}
                        </div>
                    </div>

                    {/* -- Botón - pegado al fondo con mt-auto -- */}
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
                                    Guardando...
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
                ) : (
                <form onSubmit={handleActividadSubmit} className="flex-1 flex flex-col justify-between gap-0">
                    <div className="space-y-4">
                        <div>
                            <label className={labelCls}>Categoria</label>
                            <CustomSelect
                                value={actividadLibre.categoria}
                                options={categoriasActividadOptions}
                                onChange={(value) => setActividadLibre(prev => ({ ...prev, categoria: value }))}
                                placeholder="Seleccione una categoria"
                                disabled={isReadOnly}
                                emptyText="No hay categorias disponibles"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Gestión</label>
                                <input
                                    type="text"
                                    className={`${inputCls} cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-900/70 dark:text-slate-400`}
                                    value={gestionFondoLabel}
                                    readOnly
                                    disabled
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Periodo</label>
                                <CustomSelect
                                    value={actividadLibre.periodo}
                                    options={periodoActividadOptions}
                                    onChange={(value) => setActividadLibre(prev => ({ ...prev, periodo: value }))}
                                    placeholder="Seleccione un periodo"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Nombre de actividad</label>
                            <input
                                type="text"
                                className={inputCls}
                                value={actividadLibre.nombre}
                                onChange={e => setActividadLibre(prev => ({ ...prev, nombre: e.target.value }))}
                                placeholder="Ej: Proyecto de investigacion aplicada"
                                disabled={isReadOnly}
                            />
                        </div>

                        <div>
                            <label className={labelCls}>Descripcion</label>
                            <textarea
                                rows={3}
                                className={`${inputCls} resize-none h-auto py-3`}
                                value={actividadLibre.descripcion}
                                onChange={e => setActividadLibre(prev => ({ ...prev, descripcion: e.target.value }))}
                                placeholder="Detalle brevemente la actividad planificada"
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                            <div>
                                <label className={labelCls}>Horas/semana</label>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    className={inputCls}
                                    value={actividadLibre.horas_semana}
                                    onChange={e => setActividadLibre(prev => ({ ...prev, horas_semana: e.target.value }))}
                                    placeholder="2"
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-2.5 text-right dark:border-blue-800 dark:bg-blue-900/20">
                                <div className="text-[10px] font-bold uppercase text-blue-500 dark:text-blue-300">Horas año</div>
                                <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{actividadHorasAnio} hrs</div>
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Respaldo / Evidencia</label>
                            <textarea
                                rows={2}
                                className={`${inputCls} resize-none h-auto py-3`}
                                value={actividadLibre.evidencias}
                                onChange={e => setActividadLibre(prev => ({ ...prev, evidencias: e.target.value }))}
                                placeholder="Enlace o descripcion del respaldo"
                                disabled={isReadOnly}
                            />
                        </div>

                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            Formula: horas/semana x {SEMANAS_CLASES_ANUAL} semanas = horas/año.
                        </p>
                    </div>

                    <div className="mt-5">
                        {!isReadOnly && (
                            <button
                                type="submit"
                                disabled={actividadSubmitDisabled}
                                className={`w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all ${
                                    actividadSubmitDisabled
                                        ? 'bg-slate-400 dark:bg-slate-600 opacity-60 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg hover:scale-[1.01]'
                                }`}
                            >
                                {isSubmitting ? 'Guardando...' : <><PlusIcon className="w-4 h-4" /> Agregar Actividad</>}
                            </button>
                        )}
                    </div>
                </form>
                )}
            </div>
        </div>
    );
};

export default CargaHorariaManager;
