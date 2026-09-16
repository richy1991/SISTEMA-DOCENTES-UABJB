import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaSave, FaTimes } from 'react-icons/fa';
import { ChevronDown } from 'lucide-react';
import api from '../apis/api';
import {
  ERROR_FIELD_BORDER_CLASS,
  getApiErrorMessage,
  getErrorMessage,
  useErrorPulse,
} from '../utils/formErrors';

const SEMANAS_CLASES_ANUAL = 40;

const parseActividadDetalle = (detalle = '') => {
  const texto = String(detalle || '').trim();
  const partes = texto.split(' - ');
  const gestion = partes.length >= 3 ? partes[0] : '';
  const periodo = partes.length >= 3 ? partes[1] : '';
  const cuerpo = partes.length >= 3 ? partes.slice(2).join(' - ') : texto;
  const [nombre, ...descripcionPartes] = cuerpo.split(':');
  return {
    gestion,
    periodo,
    nombre: (nombre || '').trim(),
    descripcion: descripcionPartes.join(':').trim(),
  };
};

const SearchSelect = ({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  emptyText = 'Sin opciones',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((option) => option.value?.toString() === value?.toString());

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pick = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full rounded-xl border-2 px-4 py-3 pr-12 text-left text-sm font-semibold shadow-sm outline-none ${
          disabled
            ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500 opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
            : open
              ? 'border-[#3653c5] bg-white text-slate-900 ring-2 ring-[#3653c5]/20 dark:border-[#4262d5] dark:bg-slate-700 dark:text-white dark:ring-[#4262d5]/25'
              : 'border-[#94a3b8] bg-white text-slate-800 dark:border-[#3653c5] dark:bg-slate-700 dark:text-white'
        }`}
      >
        <span className="block truncate">{selected?.label || placeholder}</span>
        <span className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[#3653c5] text-white shadow-sm">
          <ChevronDown className={`h-4 w-4 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-[10001] mt-2 w-full overflow-hidden rounded-xl border-2 border-[#94a3b8] bg-white py-2 shadow-2xl dark:border-[#3653c5] dark:bg-slate-900">
          <div className="fondo-select-menu-scroll max-h-56 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
            ) : (
              options.map((option) => {
                const active = option.value?.toString() === value?.toString();
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => pick(option.value)}
                    className={`mx-2 w-[calc(100%-1rem)] rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      active
                        ? 'bg-[#3653c5] text-white'
                        : 'text-slate-700 hover:bg-[#3653c5] hover:text-white dark:text-slate-200 dark:hover:bg-[#3653c5] dark:hover:text-white'
                    }`}
                  >
                    <span className="block truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SemesterPicker = ({ value, onChange, error, onClearError, errorPulse = 0, showLabel = true }) => {
  const [open, setOpen] = useState(false);
  const [draftSemester, setDraftSemester] = useState(Number(value || 1));
  const [pickerOpenToken, setPickerOpenToken] = useState(0);
  const { motionClass } = useErrorPulse(error, errorPulse);
  const errorMessage = getErrorMessage(error);

  const minSemester = 1;
  const maxSemester = 10;
  const clampSemester = (sem) => Math.max(minSemester, Math.min(maxSemester, sem));

  useEffect(() => {
    if (!open) setDraftSemester(Number(value || 1));
  }, [value, open]);

  const commitDraftAndClose = () => {
    onChange({ target: { name: 'semestre', value: clampSemester(Number(draftSemester || 1)) } });
    setOpen(false);
  };

  const openSemesterSelector = () => {
    onClearError?.();
    setDraftSemester(Number(value || 1));
    setPickerOpenToken((prev) => prev + 1);
    setOpen(true);
  };

  return (
    <>
      <div className="w-full">
        {showLabel && (
          <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Semestre / Nivel
          </label>
        )}

        <button
          type="button"
          onClick={openSemesterSelector}
          aria-invalid={Boolean(errorMessage)}
          className={`w-full rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100 ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-2 border-slate-400 dark:border-slate-600 hover:border-[#3D6DE0]/70'
          }`}
        >
          <span className="font-semibold">{draftSemester || 'Seleccione...'}</span>
        </button>
        {errorMessage && <p className={`mt-1 text-xs text-red-600 dark:text-red-400 ${motionClass}`}>{errorMessage}</p>}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[10020] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={commitDraftAndClose} />
            <motion.div
              className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-[#7F97E8]/45 bg-white/90 shadow-2xl backdrop-blur-xl dark:bg-slate-900/90"
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.99, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div className="p-4">
                <VerticalSemesterWheelPicker
                  key={`semester-wheel-${pickerOpenToken}`}
                  value={Number(draftSemester || 1)}
                  onChange={(sem) => setDraftSemester(Number(sem))}
                  onSettled={(sem) => onChange({ target: { name: 'semestre', value: Number(sem) } })}
                  onConfirm={commitDraftAndClose}
                  wheelResetToken={pickerOpenToken}
                  minSemester={minSemester}
                  maxSemester={maxSemester}
                  visibleCount={5}
                  itemHeight={44}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const VerticalSemesterWheelPicker = ({
  value,
  onChange,
  onSettled,
  onConfirm,
  wheelResetToken,
  minSemester = 1,
  maxSemester = 10,
  visibleCount = 5,
  itemHeight = 52,
}) => {
  const iosWheelTransition = {
    type: 'spring',
    stiffness: 240,
    damping: 30,
    mass: 0.9,
    restDelta: 0.2,
    restSpeed: 0.2,
  };

  const getIndexFromSemester = (semValue) => {
    const numeric = Number(semValue);
    const fallbackSemester = Math.round((minSemester + maxSemester) / 2);
    const safeSemester = Number.isFinite(numeric) ? numeric : fallbackSemester;
    const clampedSemester = Math.max(minSemester, Math.min(maxSemester, safeSemester));
    return clampedSemester - minSemester;
  };

  const initialIndex = getIndexFromSemester(value ?? minSemester);
  const viewportRef = useRef(null);
  const padSlots = 3;
  const [targetIndex, setTargetIndex] = useState(initialIndex);
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);
  const [centerFloatIndex, setCenterFloatIndex] = useState(initialIndex);
  const centeredIndexRef = useRef(initialIndex);
  const centerFloatRef = useRef(initialIndex);
  const isIntroAnimatingRef = useRef(true);
  const lastInternalSemesterRef = useRef(null);
  const wheelDeltaAccumRef = useRef(0);
  const wheelLastStepAtRef = useRef(0);
  const wheelIdleResetTimerRef = useRef(null);
  const wheelIgnoreUntilRef = useRef(0);

  const semesters = useMemo(() => {
    const list = [];
    for (let s = minSemester; s <= maxSemester; s += 1) list.push(s);
    return list;
  }, [minSemester, maxSemester]);

  const clampIndex = (idx) => Math.max(0, Math.min(semesters.length - 1, idx));
  const wheelHeight = visibleCount * itemHeight;
  const centerOffset = Math.floor(visibleCount / 2);

  const displaySemesters = useMemo(() => {
    const top = new Array(padSlots).fill(null);
    const bottom = new Array(padSlots).fill(null);
    return [...top, ...semesters, ...bottom];
  }, [semesters]);

  const targetDisplayIndex = targetIndex + padSlots;
  const targetY = (centerOffset - targetDisplayIndex) * itemHeight;
  const clampedFloatIndex = Math.max(0, Math.min(semesters.length - 1, centerFloatIndex));
  const visualDisplayIndex = clampedFloatIndex + padSlots;
  const centeredDisplayIndex = centeredIndex + padSlots;
  const lowerFloatIndex = Math.floor(clampedFloatIndex);
  const upperFloatIndex = Math.ceil(clampedFloatIndex);
  const centerProgress = clampedFloatIndex - lowerFloatIndex;

  const getOverlayStyle = (offsetY) => {
    const ratio = Math.max(0, 1 - Math.abs(offsetY) / itemHeight);
    const eased = ratio * ratio;
    const scale = 0.92 + 0.48 * eased;
    const opacity = 0.22 + 0.78 * ratio;
    const brightness = 0.85 + 0.25 * eased;
    return {
      transform: `translateY(${offsetY}px) scale(${scale})`,
      opacity,
      filter: `brightness(${brightness})`,
    };
  };

  const stepSelection = (steps) => {
    if (!semesters.length || steps === 0) return;
    setTargetIndex((prev) => clampIndex(prev + steps));
  };

  useEffect(() => {
    if (!semesters.length) return;
    if (wheelResetToken === 0) return;
    const sourceSemester = Number.isFinite(Number(value)) ? value : minSemester;
    const idx = semesters.findIndex((s) => Number(s) === Number(sourceSemester));
    const syncIndex = idx >= 0 ? idx : Math.floor(semesters.length / 2);
    const syncSemester = semesters[syncIndex];

    setTargetIndex(syncIndex);
    setCenteredIndex(syncIndex);
    setCenterFloatIndex(syncIndex);
    centeredIndexRef.current = syncIndex;
    centerFloatRef.current = syncIndex;
    isIntroAnimatingRef.current = true;
    if (syncSemester !== undefined) lastInternalSemesterRef.current = Number(syncSemester);
  }, [wheelResetToken, semesters.length]);

  useEffect(() => {
    if (centeredIndex !== targetIndex) return;
    const selectedSemester = semesters[centeredIndex];
    if (selectedSemester === undefined) return;
    if (Number(selectedSemester) === lastInternalSemesterRef.current) return;
    lastInternalSemesterRef.current = Number(selectedSemester);
    onChange(selectedSemester);
    onSettled?.(selectedSemester);
  }, [centeredIndex, targetIndex, semesters]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    wheelIgnoreUntilRef.current = Date.now() + 360;
    wheelDeltaAccumRef.current = 0;
    wheelLastStepAtRef.current = 0;

    const handleWheelNative = (event) => {
      event.preventDefault();
      const now = Date.now();
      if (now < wheelIgnoreUntilRef.current) return;
      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * wheelHeight
            : event.deltaY;
      if (event.deltaMode === 0 && Math.abs(normalizedDelta) < 8) return;
      wheelDeltaAccumRef.current += normalizedDelta;
      const threshold = 48;
      if (Math.abs(wheelDeltaAccumRef.current) < threshold) return;
      const cooldownMs = 95;
      if (now - wheelLastStepAtRef.current < cooldownMs) return;
      const direction = wheelDeltaAccumRef.current > 0 ? 1 : -1;
      stepSelection(direction);
      wheelLastStepAtRef.current = now;
      wheelDeltaAccumRef.current = 0;
      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
      wheelIdleResetTimerRef.current = setTimeout(() => {
        wheelDeltaAccumRef.current = 0;
      }, 140);
    };

    node.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelNative);
  }, [semesters.length, wheelResetToken]);

  useEffect(() => {
    return () => {
      wheelDeltaAccumRef.current = 0;
      wheelLastStepAtRef.current = 0;
      wheelIgnoreUntilRef.current = 0;
      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
    };
  }, []);

  return (
    <div
      className="relative cursor-default select-none overflow-hidden rounded-xl border border-[#3D6DE0]/35 bg-white/70 transition-all duration-100 dark:border-[#4B67C0]/45 dark:bg-slate-800/60"
      style={{
        height: `${wheelHeight}px`,
        perspective: '1000px',
        perspectiveOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y-2 border-[#3D6DE0]/60 bg-gradient-to-r from-[#3D6DE0]/15 to-[#3D6DE0]/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-1px_0_0_rgba(255,255,255,0.25)] dark:border-[#6B86DE]/70"
        style={{ top: `${centerOffset * itemHeight}px`, height: `${itemHeight}px` }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="relative flex h-full w-full items-center justify-center">
            {semesters[lowerFloatIndex] !== undefined && (
              <span
                className="absolute text-base font-extrabold tracking-wide text-[#1F3274] drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:text-white dark:drop-shadow-lg"
                style={getOverlayStyle(-centerProgress * itemHeight)}
              >
                {semesters[lowerFloatIndex]}° Semestre
              </span>
            )}
            {upperFloatIndex !== lowerFloatIndex && semesters[upperFloatIndex] !== undefined && (
              <span
                className="absolute text-base font-extrabold tracking-wide text-[#1F3274] drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:text-white dark:drop-shadow-lg"
                style={getOverlayStyle((1 - centerProgress) * itemHeight)}
              >
                {semesters[upperFloatIndex]}° Semestre
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25" />

      <div
        ref={viewportRef}
        className="relative cursor-default select-none overflow-hidden"
        style={{ height: '100%', scrollSnapType: 'y mandatory', scrollSnapStop: 'always', touchAction: 'auto' }}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.repeat) return;
          const key = event.key.toLowerCase();
          if (key === 'w') {
            event.preventDefault();
            stepSelection(-1);
          } else if (key === 's') {
            event.preventDefault();
            stepSelection(1);
          } else if (key === 'enter') {
            event.preventDefault();
            const selectedSemester = semesters[centeredIndex];
            if (selectedSemester !== undefined) onConfirm?.(selectedSemester);
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.focus();
        }}
      >
        <motion.div
          className="flex flex-col"
          initial={{ y: targetY + itemHeight * 2 }}
          animate={{ y: targetY }}
          transition={iosWheelTransition}
          style={{ willChange: 'transform' }}
          onUpdate={(latest) => {
            const y = typeof latest === 'number' ? latest : latest?.y;
            if (!Number.isFinite(y)) return;
            const floatDisplayIndex = centerOffset - y / itemHeight;
            const floatIndex = floatDisplayIndex - padSlots;
            const boundedFloat = Math.max(0, Math.min(semesters.length - 1, floatIndex));
            if (Math.abs(boundedFloat - centerFloatRef.current) > 0.005) {
              centerFloatRef.current = boundedFloat;
              setCenterFloatIndex(boundedFloat);
            }
            if (isIntroAnimatingRef.current) return;
            const displayIndex = Math.round(centerOffset - y / itemHeight);
            const idx = clampIndex(displayIndex - padSlots);
            if (idx === centeredIndexRef.current) return;
            const current = centeredIndexRef.current;
            const directionToTarget = Math.sign(targetIndex - current);
            if (directionToTarget > 0 && idx <= current) return;
            if (directionToTarget < 0 && idx >= current) return;
            if (directionToTarget === 0) return;
            centeredIndexRef.current = idx;
            setCenteredIndex(idx);
          }}
          onAnimationComplete={() => {
            if (!isIntroAnimatingRef.current) return;
            isIntroAnimatingRef.current = false;
            setCenterFloatIndex(centeredIndexRef.current);
          }}
        >
          {displaySemesters.map((sem, idx) => {
            const isTopBottomPlaceholder = sem === null;
            const distance = idx - visualDisplayIndex;
            const clamped = Math.max(-4, Math.min(4, distance));
            const abs = Math.abs(clamped);
            const curvedDistance = Math.sign(clamped) * Math.pow(abs, 1.08);
            const rotationX = Math.max(-62, Math.min(62, curvedDistance * 16));
            const stepScale = abs < 0.35 ? 1 : 0.97;
            const opacity = abs < 0.35 ? 1 : Math.max(0.4, 1 - abs * 0.2);
            const translateZ = -Math.min(58, abs * 16);
            return (
              <div
                key={`semester-${sem !== null ? sem : 'placeholder'}-${idx}`}
                className="flex flex-shrink-0 items-center justify-center"
                style={{
                  height: `${itemHeight}px`,
                  width: '100%',
                  transformStyle: 'preserve-3d',
                  transform: `translateY(${Math.sign(clamped) * abs * 0.35}px) rotateX(${rotationX}deg) translateZ(${translateZ}px) scale(${stepScale})`,
                  transformOrigin: 'center center',
                  opacity: isTopBottomPlaceholder ? 0 : opacity,
                }}
                onClick={() => {
                  if (Math.abs(distance) < 0.35) onConfirm?.(sem);
                }}
              >
                {isTopBottomPlaceholder ? null : abs < 0.35 ? (
                  <span className="scale-125 select-none text-base font-extrabold tracking-wide text-transparent">
                    {sem}° Semestre
                  </span>
                ) : (
                  <span className="text-base font-semibold tracking-wide text-slate-700 dark:text-slate-300" style={{ opacity: 1 }}>
                    {sem}°
                  </span>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

function EditarActividadModal({
  tipo,
  item,
  fondo,
  categorias = [],
  docenteId,
  calendarioId,
  onClose,
  onSaved,
}) {
  const isAcademica = tipo === 'academica';
  const [materias, setMaterias] = useState([]);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => parseActividadDetalle(item?.detalle), [item]);
  const gestionFondo = fondo?.gestion || fondo?.calendario_academico?.gestion || '';
  const gestionLabel = gestionFondo ? `Gestión ${gestionFondo}` : parsed.gestion || 'Gestión del fondo';
  const periodoOptions = gestionFondo
    ? [
        { value: `1er Semestre ${gestionFondo}`, label: `1er Semestre ${gestionFondo}` },
        { value: `2do Semestre ${gestionFondo}`, label: `2do Semestre ${gestionFondo}` },
        { value: `Gestión ${gestionFondo} Completo`, label: `Gestión ${gestionFondo} Completo` },
        { value: 'Transversal', label: 'Transversal' },
      ]
    : [{ value: 'Transversal', label: 'Transversal' }];

  const [form, setForm] = useState(() => ({
    categoria: item?.categoria?.id || item?.categoria || '',
    semestre: (item?.materia_semestre || item?.semestre || '').toString(),
    materia: (item?.materia || item?.materia_id || '').toString(),
    horasSemana: isAcademica
      ? String(Number(item?.horas_semana || item?.horas_por_semana || (Number(item?.horas || 0) / SEMANAS_CLASES_ANUAL) || 0))
      : String(item?.horas_semana || ''),
    horasSemestre: isAcademica ? String(item?.horas || '') : String(item?.['horas_año'] || item?.horas_anio || ''),
    respaldo: item?.respaldo || item?.documento_respaldo || item?.evidencias || '',
    nombre: parsed.nombre,
    descripcion: parsed.descripcion,
    periodo: parsed.periodo || periodoOptions[0]?.value || '',
  }));

  useEffect(() => {
    if (!isAcademica) return;
    const loadMaterias = async () => {
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
        const carreraId = fondo?.carrera?.id || fondo?.carrera;
        setMaterias(todas.filter((materia) => {
          if (!carreraId) return true;
          const materiaCarrera = materia.carrera?.id || materia.carrera_id || materia.carrera;
          return materiaCarrera?.toString() === carreraId.toString();
        }));
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar materias');
      } finally {
        setLoadingMaterias(false);
      }
    };
    loadMaterias();
  }, [fondo, isAcademica]);

  const currentMateriaId = String(form.materia || item?.materia || item?.materia_id || '');
  const materiasAsignadas = new Set(
    (fondo?.categorias || [])
      .flatMap((categoria) => categoria.detalles_carga || [])
      .filter((detalle) => detalle.id !== item?.id)
      .map((detalle) => detalle.materia?.id || detalle.materia_id || detalle.materia)
      .filter(Boolean)
      .map((materiaId) => String(materiaId))
  );
  const materiasFiltradas = materias.filter((materia) => {
    const mismoSemestre = form.semestre
      ? materia.semestre?.toString() === form.semestre.toString()
      : true;
    const materiaId = String(materia.id);
    const disponible = !materiasAsignadas.has(materiaId) || materiaId === currentMateriaId;
    return mismoSemestre && disponible;
  });
  const materiaOptions = materiasFiltradas.map((materia) => ({
    value: String(materia.id),
    label: `${materia.codigo ? `${materia.codigo} - ` : ''}${materia.nombre} (${materia.horas_teoricas || 0} HT / ${materia.horas_practicas || 0} HP - Total: ${materia.horas_totales || 0} hrs/sem)`,
  }));
  const categoriaOptions = categorias
    .filter((categoria) => categoria.tipo !== 'academica')
    .map((categoria) => ({
      value: String(categoria.id),
      label: categoria.tipo_display || categoria.nombre || categoria.tipo,
    }));
  const horasSemana = Number(form.horasSemana) || 0;
  const horasSemestre = Math.round(horasSemana * SEMANAS_CLASES_ANUAL);

  const handleMateriaChange = (materiaId) => {
    const materia = materias.find((itemMateria) => String(itemMateria.id) === String(materiaId));
    if (!materia) return;
    const horas = Number(materia.horas_totales || 0);
    setForm((prev) => ({
      ...prev,
      materia: materiaId,
      horasSemana: String(horas),
      horasSemestre: String(Math.round(horas * SEMANAS_CLASES_ANUAL)),
    }));
  };

  const handleSemestreChange = (semestre) => {
    const nextSemestre = typeof semestre === 'object' ? semestre?.target?.value : semestre;
    setForm((prev) => {
      const materiaActual = materias.find((materia) => String(materia.id) === String(prev.materia));
      const conservarMateria = materiaActual?.semestre?.toString() === nextSemestre.toString();
      return {
        ...prev,
        semestre: String(nextSemestre),
        materia: conservarMateria ? prev.materia : '',
        horasSemana: conservarMateria ? prev.horasSemana : '',
        horasSemestre: conservarMateria ? prev.horasSemestre : '',
      };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (isAcademica) {
        if (!form.materia) {
          toast.error('Seleccione una materia');
          return;
        }
        const materiaSeleccionada = materias.find((materia) => String(materia.id) === String(form.materia));
        await api.put(`/cargas-horarias/${item.id}/`, {
          categoria: 'academica',
          materia: form.materia,
          titulo_actividad: materiaSeleccionada?.nombre || item.titulo_actividad,
          horas: horasSemestre,
          documento_respaldo: form.respaldo,
          docente: docenteId,
          calendario: calendarioId,
        });
        toast.success('Asignación actualizada');
      } else {
        if (!form.categoria || !form.nombre.trim() || !form.descripcion.trim() || horasSemana <= 0) {
          toast.error('Complete los campos obligatorios');
          return;
        }
        await api.put(`/actividades/${item.id}/`, {
          categoria: Number(form.categoria),
          detalle: `${gestionLabel} - ${form.periodo} - ${form.nombre.trim()}: ${form.descripcion.trim()}`,
          horas_semana: horasSemana,
          evidencias: form.respaldo.trim(),
        });
        toast.success('Actividad actualizada');
      }
      onSaved?.();
      onClose?.();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, 'Error al guardar cambios'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-950';
  const numericInputCls = 'w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-center text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-950';
  const textAreaCls = 'w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-950';
  const labelCls = 'mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200';
  const formPanelCls = 'rounded-2xl border-2 border-slate-300 bg-slate-50/80 p-4 shadow-inner shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/40 dark:shadow-black/10';

  return (
    <div
      className="fixed inset-y-0 right-0 left-[var(--fondo-sidebar-width,0px)] z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      style={{ fontFamily: '"Nunito Sans", "Segoe UI", Helvetica, Arial, sans-serif' }}
    >
      <div className="w-full max-w-3xl overflow-visible rounded-2xl border-2 border-slate-400 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between rounded-t-2xl border-b-2 border-slate-300 bg-[#eaf2f8] px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
              {isAcademica ? 'Editar asignación DOCENTE' : 'Editar actividad no académica'}
            </h2>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Guardar cambios sin mover la página.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6">
          {isAcademica ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:items-stretch">
              <div className="flex flex-col">
                <label className={labelCls}>Semestre / Nivel</label>
                <div className="flex flex-1 items-center rounded-2xl border-2 border-slate-300 bg-slate-50/80 p-3 shadow-inner shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/40 dark:shadow-black/10">
                  <SemesterPicker
                    value={form.semestre}
                    onChange={handleSemestreChange}
                    showLabel={false}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelCls}>Materia</label>
                  <SearchSelect
                    value={form.materia}
                    options={materiaOptions}
                    onChange={handleMateriaChange}
                    placeholder={loadingMaterias ? 'Cargando materias...' : 'Materia asignada'}
                    emptyText="No hay materias"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelCls}>Horas/Semana</label>
                    <input className={`${numericInputCls} cursor-not-allowed bg-slate-100 dark:bg-slate-800/70`} value={horasSemana.toFixed(2)} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Horas/Año</label>
                    <input className={`${numericInputCls} cursor-not-allowed bg-slate-100 dark:bg-slate-800/70`} value={horasSemestre} readOnly />
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Respaldo / Evidencia</label>
                <input
                  className={inputCls}
                  value={form.respaldo}
                  onChange={(event) => setForm((prev) => ({ ...prev, respaldo: event.target.value }))}
                  placeholder="Ej: Memo #123"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Categoría</label>
                <SearchSelect
                  value={form.categoria}
                  options={categoriaOptions}
                  onChange={(value) => setForm((prev) => ({ ...prev, categoria: value }))}
                  placeholder="Seleccione categoría"
                />
              </div>
              <div>
                <label className={labelCls}>Periodo</label>
                <SearchSelect
                  value={form.periodo}
                  options={periodoOptions}
                  onChange={(value) => setForm((prev) => ({ ...prev, periodo: value }))}
                  placeholder="Seleccione periodo"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Nombre de la Actividad</label>
                <input
                  className={inputCls}
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Descripción</label>
                <textarea
                  rows={3}
                  className={`${textAreaCls} resize-none`}
                  value={form.descripcion}
                  onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Horas/Semana</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={numericInputCls}
                  value={form.horasSemana}
                  onChange={(event) => setForm((prev) => ({ ...prev, horasSemana: event.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Horas/Año</label>
                <input className={`${numericInputCls} cursor-not-allowed bg-slate-100 dark:bg-slate-800/70`} value={horasSemestre} readOnly />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Respaldo / Evidencia</label>
                <textarea
                  rows={2}
                  className={`${textAreaCls} resize-none`}
                  value={form.respaldo}
                  onChange={(event) => setForm((prev) => ({ ...prev, respaldo: event.target.value }))}
                  placeholder="Enlace o descripción del respaldo"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t-2 border-slate-300 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue-950/20 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaSave className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditarActividadModal;
