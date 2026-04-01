import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { getDocentes } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';

// ============================================================================
// COMPONENTE INTERNO: FechaIngresoPicker (Calendario personalizado)
// ============================================================================
const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function parseIsoDate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
function toIsoDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDisplayDate(iso) {
  const dateObj = parseIsoDate(iso);
  if (!dateObj) return '';
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function parseDisplayDate(display) {
  if (!display || typeof display !== 'string') return null;
  const match = display.match(/^\d{2}\/\d{2}\/\d{4}$/);
  if (!match) return null;
  const [dd, mm, yyyy] = display.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function FechaIngresoPicker({ value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [openQuickPicker, setOpenQuickPicker] = useState(null);
  const [inputValue, setInputValue] = useState(formatDisplayDate(value));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selectedDate = parseIsoDate(value);
    const today = new Date();
    return selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [draftDay, setDraftDay] = useState(null);
  const [draftMonth, setDraftMonth] = useState(null);
  const [draftYear, setDraftYear] = useState(null);
  const [hasSelectedMonth, setHasSelectedMonth] = useState(false);
  const [hasSelectedYear, setHasSelectedYear] = useState(false);
  const containerRef = React.useRef(null);
  const yearMenuRef = React.useRef(null);
  const currentYearOptionRef = React.useRef(null);

  React.useEffect(() => {
    setInputValue(formatDisplayDate(value));
  }, [value]);

  React.useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const today = new Date();
  const currentYearRef = today.getFullYear();
  const startYear = currentYearRef - 25;
  const endYear = currentYearRef + 25;
  const yearOptions = Array.from({ length: endYear - startYear + 1 }, (_, idx) => startYear + idx);
  const monthOptions = monthNames.map((label, valueIndex) => ({ value: valueIndex, label }));
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < offset; i += 1) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    calendarCells.push(new Date(year, month, d));
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const isSameDate = (a, b) => (
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );

  const handlePickDate = (dateObj) => {
    setDraftDay(dateObj.getDate());
    setHasSelectedMonth(true);
    setHasSelectedYear(true);
    const iso = toIsoDate(dateObj);
    onChange(iso);
    setInputValue(formatDisplayDate(iso));
    setOpen(false);
  };

  const handleManualInputChange = (e) => {
    const rawValue = e.target.value;
    const onlyDigits = rawValue.replace(/\D/g, '').slice(0, 8);
    let formatted = onlyDigits;
    if (onlyDigits.length > 2) {
      formatted = `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2)}`;
    }
    if (onlyDigits.length > 4) {
      formatted = `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2, 4)}/${onlyDigits.slice(4)}`;
    }
    setInputValue(formatted);
    if (formatted.length === 10) {
      const parsed = parseDisplayDate(formatted);
      if (parsed) {
        onChange(toIsoDate(parsed));
        setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
    }
    if (!formatted) {
      onChange('');
    }
  };

  const handleManualInputBlur = () => {
    if (!inputValue) {
      onChange('');
      return;
    }
    const parsed = parseDisplayDate(inputValue);
    if (parsed) {
      const iso = toIsoDate(parsed);
      onChange(iso);
      setInputValue(formatDisplayDate(iso));
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      return;
    }
    onChange('');
    setInputValue('');
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Fecha de Ingreso <span className="text-red-500">*</span></label>
      <div className={`relative w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={inputValue}
          onChange={handleManualInputChange}
          onBlur={handleManualInputBlur}
          className="w-full bg-transparent text-slate-800 dark:text-white px-4 py-2.5 pr-12 rounded-xl focus:outline-none"
          aria-label="Fecha de Ingreso"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-1.5 top-1/2 h-8 w-8 rounded-lg border border-[#3A56AF]/40 bg-[#2C4AAE] text-white hover:bg-[#233C8F] transition-colors"
          style={{ transform: 'translateY(-50%)' }}
          aria-label="Abrir calendario de Fecha de Ingreso"
        >
          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="absolute z-50 mt-2 w-[268px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#7F97E8]/45 bg-[#2C4AAE] backdrop-blur-xl shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenQuickPicker((prev) => (prev === 'month' ? null : 'month'));
                }}
                className={`w-full h-8 text-left pl-2.5 pr-8 rounded-xl border bg-white dark:bg-slate-800 text-xs shadow-sm ${openQuickPicker === 'month' ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100' : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'}`}
                aria-label="Seleccionar mes"
              >
                <span className="block truncate font-semibold">{hasSelectedMonth && draftMonth !== null ? monthNames[draftMonth] : monthNames[month]}</span>
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
                    <svg className={`w-2.5 h-2.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${openQuickPicker === 'month' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </span>
              </button>
              {openQuickPicker === 'month' && (
                <div className="absolute z-40 mt-1.5 w-full max-h-40 overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  {monthOptions.map((opt) => {
                    const active = hasSelectedMonth && draftMonth !== null && opt.value === draftMonth;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftMonth(opt.value);
                          setHasSelectedMonth(true);
                          setVisibleMonth(new Date(year, opt.value, 1));
                          setOpenQuickPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs border-l-2 ${active ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold' : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'}`}
                      >
                        <span className="block truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenQuickPicker((prev) => (prev === 'year' ? null : 'year'));
                }}
                className={`w-full h-8 text-left pl-2.5 pr-8 rounded-xl border bg-white dark:bg-slate-800 text-xs shadow-sm ${openQuickPicker === 'year' ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100' : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'}`}
                aria-label="Seleccionar año"
              >
                <span className="block truncate font-semibold">{hasSelectedYear && draftYear !== null ? draftYear : year}</span>
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
                    <svg className={`w-2.5 h-2.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${openQuickPicker === 'year' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </span>
              </button>
              {openQuickPicker === 'year' && (
                <div ref={yearMenuRef} className="absolute z-40 mt-1.5 w-full max-h-40 overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  {yearOptions.map((y) => {
                    const active = hasSelectedYear && draftYear !== null && y === draftYear;
                    const isCurrentSystemYear = y === currentYearRef;
                    return (
                      <button
                        key={y}
                        ref={isCurrentSystemYear ? currentYearOptionRef : null}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftYear(y);
                          setHasSelectedYear(true);
                          setVisibleMonth(new Date(y, draftMonth ?? month, 1));
                          setOpenQuickPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs border-l-2 ${active ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold' : isCurrentSystemYear ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-400 text-blue-800 dark:text-blue-200 font-semibold hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]' : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="block truncate">{y}</span>
                          {isCurrentSystemYear && !active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/80 dark:bg-blue-800/50 text-blue-900 dark:text-blue-100">Actual</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {weekDays.map((wd) => (
              <div key={wd} className="text-center text-[10px] font-semibold text-slate-200/85 py-0.5">{wd}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((cellDate, idx) => {
              if (!cellDate) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isToday = isSameDate(cellDate, today);
              const isSelected = draftDay !== null && cellDate.getDate() === draftDay;
              return (
                <button
                  key={toIsoDate(cellDate)}
                  type="button"
                  onClick={() => handlePickDate(cellDate)}
                  className={`h-8 rounded-lg text-xs ${isSelected ? 'bg-[#4654E8] text-white font-semibold' : 'text-slate-100 hover:bg-white/15'} ${isToday && !isSelected ? 'border border-white/55' : 'border border-transparent'}`}
                >
                  {cellDate.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Componente Select con diseño personalizado (mismo estilo que FechaIngresoPicker)
const SelectConDropdown = ({ label, value, onChange, options, error, name }) => {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const selectedLabel = value && options.find(opt => opt.value === value)?.label;
  const displayLabel = selectedLabel || 'Seleccione...';

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label}</label>
      
      {/* Botón principal */}
      <div className={`relative w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${error ? 'border-red-500' : open ? 'border-[#3A56AF] dark:border-[#3A56AF]' : 'border-slate-300 dark:border-slate-600'}`}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full text-left px-4 py-2.5 rounded-xl bg-transparent text-slate-800 dark:text-white flex items-center justify-between gap-2"
        >
          <span className={`truncate ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}>{displayLabel}</span>
          <span className="flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE]">
            <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
      </div>

      {/* Menú desplegable */}
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#3A56AF] bg-white dark:bg-slate-900 shadow-xl">
          <div className="max-h-40 overflow-auto p-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 py-1.5 text-xs border-l-2 rounded-lg transition-colors ${
                  option.value === value
                    ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold'
                    : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                }`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const InfoIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InputField = ({ label, name, type = 'text', value, onChange, required, error }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const dedicacionStyles = {
  tiempo_completo: {
    bg: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    border: 'border-blue-500',
    icon: 'text-blue-500',
    title: 'text-blue-800 dark:text-blue-300',
    text: 'text-blue-700 dark:text-blue-400',
  },
  medio_tiempo: {
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
    border: 'border-green-500',
    icon: 'text-green-500',
    title: 'text-green-800 dark:text-green-300',
    text: 'text-green-700 dark:text-green-400',
  },
  horario: {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
    border: 'border-orange-500',
    icon: 'text-orange-500',
    title: 'text-orange-800 dark:text-orange-300',
    text: 'text-orange-700 dark:text-orange-400',
  },
};

function ListaDocentes({ isDark, sidebarCollapsed = false }) {
  const splitNombreCompleto = (nombreCompleto) => {
    const partes = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);

    if (partes.length === 0) {
      return { nombres: '', apellido_paterno: '', apellido_materno: '' };
    }
    if (partes.length === 1) {
      return { nombres: partes[0], apellido_paterno: '', apellido_materno: '' };
    }
    if (partes.length === 2) {
      return { nombres: partes[0], apellido_paterno: partes[1], apellido_materno: '' };
    }

    return {
      nombres: partes.slice(0, -2).join(' '),
      apellido_paterno: partes[partes.length - 2],
      apellido_materno: partes[partes.length - 1],
    };
  };

  const buildNombreCompleto = (nombres, apellidoPaterno, apellidoMaterno) =>
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim();

  const navigate = useNavigate();
  const restoringCreateFormRef = React.useRef(false);
  const [docentes, setDocentes] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Modal de crear/editar
  const [showModal, setShowModal] = useState(false);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    nombre_completo: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    carrera: '',
    ci: '',
    categoria: 'catedratico',
    dedicacion: 'tiempo_completo',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    email: '',
    telefono: '',
    horas_contrato_semanales: null,
    activo: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docenteToDelete, setDocenteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [abrirDesdeUsuarios, setAbrirDesdeUsuarios] = useState(false);
  const [showOnlyOrphans, setShowOnlyOrphans] = useState(false);

  useEffect(() => {
    cargarDocentes();
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
    
    // 🔗 Detectar si venimos desde "Crear Usuario" para abrir modal
    const abrirModal = sessionStorage.getItem('abrirModalDesdeUsuarios');
    if (abrirModal === 'true') {
      const datosDocenteGuardados = sessionStorage.getItem('datosCrearDocente');
      if (datosDocenteGuardados) {
        try {
          const datosDocente = JSON.parse(datosDocenteGuardados);
          restoringCreateFormRef.current = true;
          setFormData((prev) => ({
            ...prev,
            ...datosDocente,
            nombre_completo: buildNombreCompleto(
              datosDocente.nombres,
              datosDocente.apellido_paterno,
              datosDocente.apellido_materno
            ),
          }));
        } catch (e) {
          console.error('Error al recuperar datos de docente:', e);
        }
      }
      setAbrirDesdeUsuarios(true);
      setIsCreating(true);
      sessionStorage.removeItem('abrirModalDesdeUsuarios');
    }
  }, []);

  const cargarDocentes = async () => {
    setLoading(true);
    try {
      const [docentesResponse, carrerasResponse] = await Promise.all([
        getDocentes(),
        api.get('/carreras/'),
      ]);
      const docentesData = docentesResponse.data.results || docentesResponse.data;
      const carrerasData = carrerasResponse.data.results || carrerasResponse.data;
      setDocentes(Array.isArray(docentesData) ? docentesData : []);
      setCarreras(Array.isArray(carrerasData) ? carrerasData : []);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar docentes');
      setLoading(false);
      console.error(err);
    }
  };

  useEffect(() => {
    const initialData = {
      nombre_completo: '',
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
      carrera: '',
      ci: '',
      categoria: '',
      dedicacion: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      email: '',
      telefono: '',
      horas_contrato_semanales: null,
      activo: true,
    };
    if (isCreating) {
      if (restoringCreateFormRef.current) {
        restoringCreateFormRef.current = false;
        setErrors({});
        return;
      }
      setFormData(initialData);
      setErrors({});
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
  };

  const abrirModalEditar = (docente) => {
    setDocenteSeleccionado(docente);
    setFormData({
      nombres: docente.nombres,
      apellido_paterno: docente.apellido_paterno,
      apellido_materno: docente.apellido_materno || '',
      ci: docente.ci,
      categoria: docente.categoria,
      dedicacion: docente.dedicacion,
      fecha_ingreso: docente.fecha_ingreso || new Date().toISOString().split('T')[0],
      email: docente.email || '',
      telefono: docente.telefono || '',
      horas_contrato_semanales: docente.horas_contrato_semanales || null,
      activo: docente.activo,
    });
    setShowModal(true);
    setIsCreating(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      let nextValue = type === 'checkbox' ? checked : value;
      const newState = {
        ...prev,
        [name]: nextValue
      };

      if (name === 'nombre_completo') {
        const nombresSplit = splitNombreCompleto(String(nextValue));
        newState.nombres = nombresSplit.nombres;
        newState.apellido_paterno = nombresSplit.apellido_paterno;
        newState.apellido_materno = nombresSplit.apellido_materno;
      }

      if (name === 'dedicacion' && value !== 'horario') {
        newState.horas_contrato_semanales = null;
      }
      if (isCreating && abrirDesdeUsuarios) {
        sessionStorage.setItem('datosCrearDocente', JSON.stringify({
          nombres: newState.nombres,
          apellido_paterno: newState.apellido_paterno,
          apellido_materno: newState.apellido_materno,
          email: newState.email,
          telefono: newState.telefono,
          carrera: newState.carrera,
        }));
      }
      return newState;
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    console.log('Iniciando submit...', formData);
    setIsSubmitting(true);
    setErrors({});
    try {
      const nombresSplit = splitNombreCompleto(formData.nombre_completo);
      const payload = { ...formData };
      payload.nombres = nombresSplit.nombres;
      payload.apellido_paterno = nombresSplit.apellido_paterno;
      payload.apellido_materno = nombresSplit.apellido_materno;
      delete payload.nombre_completo;
      delete payload.carrera;
      if (payload.email === '') payload.email = null;
      if (payload.telefono === '') payload.telefono = null;
      
      console.log('Enviando payload:', payload);
      const response = await api.post('/docentes/', payload);
      console.log('Docente creado exitosamente');
      if (abrirDesdeUsuarios) {
        const docenteCreado = response?.data;
        if (docenteCreado?.id) {
          sessionStorage.setItem('docenteRetornadoDesdeUsuarios', JSON.stringify({
            id: docenteCreado.id,
            ci: docenteCreado.ci || payload.ci || '',
            carrera: formData.carrera || '',
          }));
        }
      }

      // 🔗 Si venimos desde usuarios, volver automáticamente
      if (abrirDesdeUsuarios) {
        toast.success('Docente creado. Volviendo a Crear Usuario...');
        setTimeout(() => {
          // Limpiar flag pero mantener datos en sessionStorage
          sessionStorage.removeItem('abrirModalDesdeUsuarios');
          sessionStorage.removeItem('datosCrearDocente');
          navigate('/fondo-tiempo/usuarios');
        }, 800);
      } else {
        toast.success('Docente creado correctamente');
        setIsCreating(false);
        cargarDocentes();
      }
    } catch (err) {
      console.error('Error al crear docente:', err);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        setErrors(apiErrors);
        const errorMsg = Object.values(apiErrors).flat().join(' ');
        toast.error(`Error: ${errorMsg}`);
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrearCuentaParaDocente = (docente) => {
    sessionStorage.setItem(
      'vincularDocentePendiente',
      JSON.stringify({
        docenteId: docente.id,
        first_name: docente.nombres || '',
        last_name: [docente.apellido_paterno, docente.apellido_materno].filter(Boolean).join(' '),
        email: docente.email || '',
      })
    );
    navigate('/fondo-tiempo/usuarios');
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.put(`/docentes/${docenteSeleccionado.id}/`, formData);
      toast.success('Docente actualizado correctamente');
      setShowModal(false);
      cargarDocentes();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const eliminarDocente = (docente) => {
    setDocenteToDelete(docente);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDocenteToDelete(null);
    setDeleteConfirmText('');
  };

  const confirmarEliminar = async () => {
    if (!docenteToDelete) return;
    if (deleteConfirmText !== docenteToDelete.nombre_completo) {
      toast.error('Debes escribir exactamente el nombre del docente para confirmar');
      return;
    }
    try {
      await api.delete(`/docentes/${docenteToDelete.id}/`);
      toast.success('Docente eliminado correctamente');
      cargarDocentes();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar docente:', err);
      
      // Capturar mensaje de error específico del backend
      let errorMessage = 'Error al eliminar el docente';
      
      if (err.response && err.response.data && err.response.data.error) {
        // Backend devolvió un error específico
        errorMessage = err.response.data.error;
      } else if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const esAdmin = () => user?.is_superuser || user?.perfil?.rol === 'admin';
  const docentesFiltrados = showOnlyOrphans
    ? docentes.filter((docente) => !docente.usuario_email)
    : docentes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando docentes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-md">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Docentes
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 italic">
                Gestión del personal docente
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowOnlyOrphans((prev) => !prev)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  showOnlyOrphans
                    ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                {showOnlyOrphans ? 'Ver todos' : 'Ver huérfanos'}
              </button>
              {esAdmin() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
                >
                  <span>{isCreating ? '➖' : '➕'}</span>
                  {isCreating ? 'Cancelar' : 'Nuevo Docente'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CREACIÓN DE DOCENTE */}
        {isCreating && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
            style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-[#2C4AAE] px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Nuevo Docente
                  </h2>
                  {abrirDesdeUsuarios && (
                    <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold text-white flex items-center gap-2">
                      <span>🔗</span>
                      Volviendo a Crear Usuario
                    </span>
                  )}
                </div>
              </div>
              {/* Body */}
              <form id="crear-docente-form" onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField
                    label="Nombre completo"
                    name="nombre_completo"
                    value={formData.nombre_completo}
                    onChange={handleChange}
                    required
                    error={errors.nombre_completo || errors.nombres || errors.apellido_paterno || errors.apellido_materno}
                  />
                  <InputField label="Cédula de Identidad (CI)" name="ci" value={formData.ci} onChange={handleChange} required error={errors.ci} />
                  <SelectConDropdown
                    label="Carrera"
                    name="carrera"
                    value={formData.carrera}
                    onChange={handleChange}
                    options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                    error={errors.carrera}
                  />
                  <FechaIngresoPicker
                    value={formData.fecha_ingreso}
                    onChange={(val) => setFormData(prev => ({ ...prev, fecha_ingreso: val }))}
                    error={errors.fecha_ingreso}
                  />
                  <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
                  <InputField label="Teléfono" name="telefono" value={formData.telefono} onChange={handleChange} error={errors.telefono} />
                  <SelectConDropdown
                    label="Categoría"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                    options={[
                      { value: 'catedratico', label: 'Catedrático' },
                      { value: 'adjunto', label: 'Adjunto' },
                      { value: 'asistente', label: 'Asistente' },
                    ]}
                    error={errors.categoria}
                  />
                  <SelectConDropdown
                    label="Dedicación"
                    name="dedicacion"
                    value={formData.dedicacion}
                    onChange={handleChange}
                    options={[
                      { value: 'tiempo_completo', label: 'Tiempo Completo' },
                      { value: 'medio_tiempo', label: 'Medio Tiempo' },
                      { value: 'horario', label: 'Horario' },
                    ]}
                    error={errors.dedicacion}
                  />
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[minmax(0,380px)_1fr] gap-4 items-start">
                    {formData.dedicacion === 'horario' ? (
                      <InputField
                        label="Horas / Semana"
                        name="horas_contrato_semanales"
                        type="number"
                        value={formData.horas_contrato_semanales || ''}
                        onChange={handleChange}
                        required={Boolean(formData.dedicacion)}
                        error={errors.horas_contrato_semanales}
                      />
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Horas / Semana</label>
                        <div className="w-full px-3 py-2.5 rounded-xl border-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 flex items-center justify-between min-h-[46px]">
                          <span className="font-bold text-lg text-slate-700 dark:text-slate-300">
                            {formData.dedicacion === 'tiempo_completo' ? 40 : formData.dedicacion === 'medio_tiempo' ? 20 : ''}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">hrs</span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`rounded-xl border-l-4 p-3.5 shadow-sm min-h-[92px] transition-opacity ${
                        formData.dedicacion
                          ? `${dedicacionStyles[formData.dedicacion]?.bg} ${dedicacionStyles[formData.dedicacion]?.border} opacity-100`
                          : 'bg-transparent border-transparent opacity-0'
                      }`}
                    >
                      {formData.dedicacion && (
                        <div className="flex items-start gap-3">
                          <InfoIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${dedicacionStyles[formData.dedicacion]?.icon}`} />
                          <div>
                            <h5 className={`text-sm font-semibold ${dedicacionStyles[formData.dedicacion]?.title}`}>Información sobre Dedicación</h5>
                            <p className={`text-xs leading-5 mt-1 ${dedicacionStyles[formData.dedicacion]?.text}`}>
                              {formData.dedicacion === 'tiempo_completo' && 'La dedicación a Tiempo Completo implica un total de 40 horas semanales.'}
                              {formData.dedicacion === 'medio_tiempo' && 'La dedicación a Medio Tiempo implica un total de 20 horas semanales.'}
                              {formData.dedicacion === 'horario' && 'Para la dedicación por Horario, debe especificar el número de horas semanales según el contrato.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </form>
              {/* Footer */}
              <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (abrirDesdeUsuarios) {
                      // Volver a usuarios si venimos desde allí
                      // Los datos se recuperarán automáticamente en GestionUsuarios
                      navigate('/fondo-tiempo/usuarios');
                    } else {
                      setIsCreating(false);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  {abrirDesdeUsuarios ? 'Cancelar y volver' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  form="crear-docente-form"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {abrirDesdeUsuarios ? 'Guardando y volviendo...' : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      {abrirDesdeUsuarios ? '💾 Guardar y volver a Usuario' : '💾 Guardar'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Lista de docentes */}
        {docentesFiltrados.length > 0 ? (
          <div className="space-y-4">
            {docentesFiltrados.map((docente) => (
              <div
                key={docente.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.01]"
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info del docente */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xl flex-shrink-0">
                        {docente.nombres[0]}{docente.apellido_paterno[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-blue-600 dark:text-white truncate">
                          {docente.nombres} {docente.apellido_paterno} {docente.apellido_materno}
                        </h3>
                        {!docente.usuario_email && (
                          <button
                            type="button"
                            onClick={() => handleCrearCuentaParaDocente(docente)}
                            className="mt-1 text-sm font-semibold text-red-600 transition-colors hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
                          >
                            ⚠️ Sin Cuenta
                          </button>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600 shadow-sm">
                            🆔 CI: {docente.ci}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700 shadow-sm">
                            {docente.categoria === 'catedratico' ? '👨‍🏫 Catedrático' :
                              docente.categoria === 'adjunto' ? '👔 Adjunto' : '🎓 Asistente'}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700 shadow-sm">
                            {docente.dedicacion === 'tiempo_completo' ? '⏰ Tiempo Completo' :
                              docente.dedicacion === 'horario' ? '🕐 Horario' : '⏳ Medio Tiempo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción - Solo admin */}
                    {esAdmin() && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => abrirModalEditar(docente)}
                          className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-200 hover:scale-110"
                          title="Editar"
                        >
                          <FaEdit size={18} />
                        </button>
                        <button
                          onClick={() => eliminarDocente(docente)}
                          className="text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 transition-all duration-200 hover:scale-110"
                          title="Eliminar"
                        >
                          <FaTrash size={18} />
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
              <span className="text-5xl">👨‍🏫</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay docentes registrados
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Comienza agregando tu primer docente
            </p>
            {esAdmin() && (
              <button
                onClick={handleToggleCreateForm}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
              >
                <span>➕</span>
                Crear Primer Docente
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && docenteSeleccionado && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <h3 className="text-xl font-bold text-blue-600 dark:text-white flex items-center gap-2">
                  Editar Docente
              </h3>
            </div>

            {/* Formulario */}
            <form onSubmit={handleUpdateSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div className="md:col-span-2">
                  <InputField label="Nombres" name="nombres" value={formData.nombres} onChange={handleChange} required error={errors.nombres} />
                </div>
                <InputField label="Apellido Paterno" name="apellido_paterno" value={formData.apellido_paterno} onChange={handleChange} required error={errors.apellido_paterno} />
                <InputField label="Apellido Materno" name="apellido_materno" value={formData.apellido_materno} onChange={handleChange} error={errors.apellido_materno} />
                <InputField label="Cédula de Identidad (CI)" name="ci" value={formData.ci} onChange={handleChange} required error={errors.ci} />
                <SelectConDropdown
                  label="Categoría"
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  options={[
                    { value: 'catedratico', label: 'Catedrático' },
                    { value: 'adjunto', label: 'Adjunto' },
                    { value: 'asistente', label: 'Asistente' },
                  ]}
                  error={errors.categoria}
                />
                <SelectConDropdown
                  label="Dedicación"
                  name="dedicacion"
                  value={formData.dedicacion}
                  onChange={handleChange}
                  options={[
                    { value: 'tiempo_completo', label: 'Tiempo Completo' },
                    { value: 'medio_tiempo', label: 'Medio Tiempo' },
                    { value: 'horario', label: 'Horario' },
                  ]}
                  error={errors.dedicacion}
                />
                {formData.dedicacion === 'horario' ? (
                  <InputField
                    label="Horas Semanales por Contrato"
                    name="horas_contrato_semanales"
                    type="number"
                    value={formData.horas_contrato_semanales || ''}
                    onChange={handleChange}
                    required
                    error={errors.horas_contrato_semanales}
                    placeholder="Ej: 8, 12, 16"
                  />
                ) : (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Horas Semanales Requeridas</label>
                    <input
                      type="number"
                      value={formData.dedicacion === 'tiempo_completo' ? 40 : 20}
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl border-2 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                    />
                  </div>
                )}
                <InputField label="Fecha de Ingreso" name="fecha_ingreso" type="date" value={formData.fecha_ingreso} onChange={handleChange} required error={errors.fecha_ingreso} />
                <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
                <InputField label="Teléfono" name="telefono" value={formData.telefono} onChange={handleChange} error={errors.telefono} />
              </div>

              <div className={`mt-6 p-4 rounded-xl ${dedicacionStyles[formData.dedicacion]?.bg} border-l-4 ${dedicacionStyles[formData.dedicacion]?.border} shadow-sm`}>
                <div className="flex items-start gap-3">
                  <InfoIcon className={`w-6 h-6 ${dedicacionStyles[formData.dedicacion]?.icon} flex-shrink-0 mt-0.5`} />
                  <div>
                    <h5 className={`font-semibold ${dedicacionStyles[formData.dedicacion]?.title}`}>Información sobre Dedicación</h5>
                    <p className={`text-sm ${dedicacionStyles[formData.dedicacion]?.text} mt-1`}>
                      {formData.dedicacion === 'tiempo_completo' && 'La dedicación a Tiempo Completo implica un total de 40 horas semanales.'}
                      {formData.dedicacion === 'medio_tiempo' && 'La dedicación a Medio Tiempo implica un total de 20 horas semanales.'}
                      {formData.dedicacion === 'horario' && 'Para la dedicación por Horario, debe especificar el número de horas semanales según el contrato.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border-2 border-slate-300 dark:border-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={formData.activo}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-300">
                    ✅ Docente activo
                  </span>
                </label>
              </div>

              {/* Botones */}
              <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-700 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:scale-105"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                >
                  💾 Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 z-[70] flex items-center justify-center p-4"
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <span>🗑️</span>
                Confirmar Eliminación
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed">
                Se eliminará el docente <strong className="text-slate-900 dark:text-white">{docenteToDelete?.nombre_completo}</strong> del sistema de forma permanente.
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                Acción irreversible: <strong className="text-red-900 dark:text-red-300">El docente perderá su acceso definitivamente.</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Escribe el nombre exacto del docente para habilitar la eliminación:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Escribe el nombre del docente para confirmar"
                  className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esta operación no se puede deshacer.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== (docenteToDelete?.nombre_completo || '')}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

export default ListaDocentes;
