import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import api from '../apis/api';
import ModalUsuario from './ModalUsuario';
import toast from 'react-hot-toast';

const getBackendErrorMessage = (apiErrors, fallback = 'Ocurrió un error inesperado.') => {
  if (!apiErrors) return fallback;

  if (typeof apiErrors === 'string') {
    return apiErrors.includes('<!DOCTYPE') ? fallback : apiErrors;
  }

  if (typeof apiErrors.error === 'string' && apiErrors.error.trim()) return apiErrors.error;
  if (typeof apiErrors.detail === 'string' && apiErrors.detail.trim()) return apiErrors.detail;

  const nested = Object.values(apiErrors)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .find((value) => typeof value === 'string' && value.trim() && !value.includes('<!DOCTYPE'));

  return nested || fallback;
};

// Animación para el search input
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      width: 0;
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      width: 100%;
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(style);

const InfoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const PauseIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
    </svg>
);

const PlayIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
);

const TrashIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const InputField = ({ label, name, type = 'text', value, onChange, required, disabled, error }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      placeholder={required ? '' : ' '}
      className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${error ? 'border-red-500' : 'border-slate-400 dark:border-slate-600'}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

// Componente Select con Dropdown animado (igual que en ListaDocentes)
const SELECT_INPUT_BASE_CLASS = 'border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700';

const STATIC_CONTROL_STYLE = { transition: 'none', transform: 'none', animation: 'none' };

const SelectConDropdown = ({ label, name, value, onChange, options, error, disabled = false, required = false, placeholder = 'Seleccione...', hoverEffect = true, stable = false, standardStyle = false, onInteract = null }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selectedLabel = options.find(opt => opt.value === value)?.label;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          if (!disabled && typeof onInteract === 'function') {
            onInteract();
          }
          setOpen(!open);
        }}
        disabled={disabled}
        style={STATIC_CONTROL_STYLE}
        className={standardStyle
          ? `w-full h-[52px] px-4 py-3 rounded-2xl text-left flex items-center justify-between shadow-sm transition-none transform-none hover:shadow-none ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              error
                ? 'border-2 border-red-500 bg-slate-50 dark:bg-slate-700'
                : SELECT_INPUT_BASE_CLASS
            }`
          : `w-full h-[52px] px-4 py-3 rounded-xl text-left flex items-center justify-between shadow-sm transition-none transform-none hover:shadow-none ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              error 
                ? 'border-2 border-red-500 bg-slate-50 dark:bg-slate-700' 
                : SELECT_INPUT_BASE_CLASS
            }`
        }
      >
        <span className={standardStyle
          ? `${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight' : 'text-slate-400 dark:text-slate-500'}`
          : `${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight' : 'text-slate-400 dark:text-slate-500'}`
        }>
          {selectedLabel || placeholder}
        </span>
        <div style={STATIC_CONTROL_STYLE} className={standardStyle ? 'w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center transition-none transform-none' : 'w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center transition-none transform-none'}>
          <svg
            style={STATIC_CONTROL_STYLE}
            className="w-4 h-4 text-white transition-none transform-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange({ target: { name, value: option.value } });
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? 'bg-[#2C4AAE] text-white font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const FilterDocentes = ({
  label,
  name,
  value,
  onChange,
  docentes,
  error,
  disabled = false,
  required = false,
  placeholder = 'Buscar docente...'
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedDocente = docentes.find((d) => String(d.id) === String(value));

  useEffect(() => {
    if (selectedDocente?.nombre_completo) {
      setSearchTerm(selectedDocente.nombre_completo);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, selectedDocente]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filteredDocentes = docentes.filter((docente) => {
    const term = searchTerm.toLowerCase();
    const nombre = (docente.nombre_completo || '').toLowerCase();
    const ci = String(docente.ci || '').toLowerCase();
    return nombre.includes(term) || ci.includes(term);
  });

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setSearchTerm(nextValue);
    setOpen(true);
  };

  const handleButtonClick = () => {
    if (disabled) return;
    if (value) {
      setSearchTerm('');
      onChange({ target: { name, value: '' } });
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelectDocente = (docente) => {
    onChange({ target: { name, value: docente.id } });
    setSearchTerm(docente.nombre_completo || '');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label}
        </label>
      )}

      <div
        style={STATIC_CONTROL_STYLE}
        className={`flex items-center px-4 py-3 rounded-xl shadow-sm ${
          disabled
            ? `cursor-not-allowed opacity-60 ${SELECT_INPUT_BASE_CLASS}`
            : error
              ? 'border-2 border-red-500 bg-slate-50 dark:bg-slate-700'
              : SELECT_INPUT_BASE_CLASS
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-slate-800 dark:text-white focus:outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500"
        />

        <button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled}
          style={STATIC_CONTROL_STYLE}
          className="w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center flex-shrink-0 ml-2 disabled:opacity-70"
        >
          <svg
            style={STATIC_CONTROL_STYLE}
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-64 overflow-auto">
          {filteredDocentes.length > 0 ? (
            filteredDocentes.map((docente) => (
              <button
                key={docente.id}
                type="button"
                onClick={() => handleSelectDocente(docente)}
                className="w-full text-left px-4 py-3 text-sm transition-colors text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white border-b border-slate-200 dark:border-slate-700 last:border-b-0"
              >
                <div className="font-semibold">{docente.nombre_completo}</div>
              </button>
            ))
          ) : searchTerm ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay docentes que coincidan
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Escribe para buscar docentes
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const FilterCarreras = ({
  label,
  name,
  value,
  onChange,
  carreras,
  error,
  disabled = false,
  required = false,
  placeholder = 'Buscar carrera...'
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const clearingSelectionRef = useRef(false);

  const selectedCarrera = carreras.find((c) => String(c.id) === String(value));

  useEffect(() => {
    if (clearingSelectionRef.current) {
      if (!value) {
        clearingSelectionRef.current = false;
      }
      return;
    }
    if (selectedCarrera?.nombre) {
      setSearchTerm(selectedCarrera.nombre);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, selectedCarrera]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filteredCarreras = carreras.filter((carrera) => {
    const term = searchTerm.toLowerCase();
    const nombre = String(carrera.nombre || '').toLowerCase();
    const codigo = String(carrera.codigo || '').toLowerCase();
    const facultad = String(carrera.facultad_nombre || '').toLowerCase();
    return nombre.includes(term) || codigo.includes(term) || facultad.includes(term);
  });

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setSearchTerm(nextValue);
    setOpen(true);

    if (value) {
      onChange({ target: { name, value: '' } });
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    if (value) {
      clearingSelectionRef.current = true;
      setSearchTerm('');
      onChange({ target: { name, value: '' } });
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelectCarrera = (carrera) => {
    onChange({ target: { name, value: carrera.id } });
    setSearchTerm(carrera.nombre || '');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label}
        </label>
      )}

      <div
        style={STATIC_CONTROL_STYLE}
        className={`flex items-center px-4 py-3 rounded-xl shadow-sm ${
          disabled
            ? `cursor-not-allowed opacity-60 ${SELECT_INPUT_BASE_CLASS}`
            : error
              ? 'border-2 border-red-500 bg-slate-50 dark:bg-slate-700'
              : SELECT_INPUT_BASE_CLASS
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-slate-800 dark:text-white focus:outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500"
        />

        <button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled}
          style={STATIC_CONTROL_STYLE}
          className="w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center flex-shrink-0 ml-2 disabled:opacity-70"
        >
          <svg
            style={STATIC_CONTROL_STYLE}
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-64 overflow-auto">
          {filteredCarreras.length > 0 ? (
            filteredCarreras.map((carrera) => (
              <button
                key={carrera.id}
                type="button"
                onClick={() => handleSelectCarrera(carrera)}
                className="w-full text-left px-4 py-3 text-sm transition-colors text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white border-b border-slate-200 dark:border-slate-700 last:border-b-0"
              >
                <div className="font-semibold">{carrera.nombre}</div>
              </button>
            ))
          ) : searchTerm ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay carreras que coincidan
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Escribe para buscar carreras
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const ToggleSwitch = ({ isActive, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange()}
    disabled={disabled}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-500 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

// Dropdown simple estilo "Seleccione..."
const SimpleDropdown = ({ label, value, onChange, options, placeholder = 'Carreras', clearOnToggle = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const selectedLabel = options.find(opt => opt.value === value)?.label;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        {label}
      </label>
      <button
        type="button"
        onClick={() => {
          if (clearOnToggle) {
            onChange('');
          }
          setOpen(!open);
          if (open) {
            setSearch('');
          }
        }}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 border-2 border-slate-400 dark:border-slate-600 focus:border-blue-500 rounded-xl text-left flex items-center justify-between transition-all shadow-sm"
      >
        <span className={`${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedLabel || placeholder}
        </span>
        <div className="w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center">
          <svg
            className={`w-4 h-4 text-white ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          <div className="p-2 border-b border-slate-200 dark:border-slate-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar carrera..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setSearch('');
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? 'bg-[#2C4AAE] text-white font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay carreras que coincidan
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente de Búsqueda Animado
const SearchInput = ({ value, onChange, placeholder = 'Buscar por nombre o C.I....' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleBlur = () => {
    if (!value) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-row-reverse">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-2.5 bg-[#2C4AAE] hover:bg-[#1a3a8a] text-white rounded-xl transition-all duration-300 hover:scale-110 ${isExpanded ? 'rotate-0' : 'rotate-0'}`}
        title="Buscar usuario"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-[#2C4AAE] rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all"
        />
      </div>
    </div>
  );
};

function GestionUsuarios({ isDark, sidebarCollapsed = false, user, hasSidebar = true }) {
  const navigate = useNavigate();
  const restoringFormRef = useRef(false);
  const restoringEditModalRef = useRef(false);
  const restoringLinkRef = useRef(false);
  const [usuarios, setUsuarios] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [docenteReciente, setDocenteReciente] = useState(null);
  const [carreras, setCarreras] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing modal
  const [showModal, setShowModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({});
  const [crearNuevoDocente, setCrearNuevoDocente] = useState(false);
  const [bloquearCrearNuevoDocente, setBloquearCrearNuevoDocente] = useState(false);
  const [asignacionesExtra, setAsignacionesExtra] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [abrirModalAlVolver, setAbrirModalAlVolver] = useState(false);
  const [vinculacionRapidaDocente, setVinculacionRapidaDocente] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showToggleModal, setShowToggleModal] = useState(false);
  const [usuarioToToggle, setUsuarioToToggle] = useState(null);
  const [showOnlyOrphans, setShowOnlyOrphans] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrera, setSelectedCarrera] = useState('');
  
  // Usuarios huerfanos: sin perfil o con rol docente sin docente vinculado
  const esUsuarioHuerfano = (u) => !u?.perfil || (u.perfil?.rol === 'docente' && !u.perfil?.docente_id);
  const hayOrfanos = usuarios.length > 0 && usuarios.some(esUsuarioHuerfano);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (restoringEditModalRef.current || usuarios.length === 0) return;

    const datosEditarGuardados = sessionStorage.getItem('datosEditarUsuario');
    if (!datosEditarGuardados) return;

    try {
      const { userId } = JSON.parse(datosEditarGuardados);
      const usuario = usuarios.find((item) => item.id === userId);

      if (usuario) {
        restoringEditModalRef.current = true;
        setUsuarioEditando(usuario);
        setShowModal(true);
        setIsCreating(false);
      }
    } catch (e) {
      console.error('Error al recuperar edición de usuario:', e);
      sessionStorage.removeItem('datosEditarUsuario');
    }
  }, [usuarios]);

  useEffect(() => {
    if (restoringLinkRef.current) return;

    const vincularDocentePendiente = sessionStorage.getItem('vincularDocentePendiente');
    if (!vincularDocentePendiente) return;

    try {
      const datos = JSON.parse(vincularDocentePendiente);
      const docente = docentes.find((item) => String(item.id) === String(datos.docenteId));
      const docenteId = datos.docenteId;

      if (docente || docenteId) {
        restoringLinkRef.current = true;
        restoringFormRef.current = true;
        const datosCrearUsuarioRaw = sessionStorage.getItem('datosCrearUsuario');
        const datosCrearUsuario = datosCrearUsuarioRaw ? JSON.parse(datosCrearUsuarioRaw) : null;
        const nombreCompleto = datosCrearUsuario?.nombre_completo || `${datos.first_name || ''} ${datos.last_name || ''}`.trim();
        const firstName = datosCrearUsuario?.first_name || datos.first_name || '';
        const lastName = datosCrearUsuario?.last_name || datos.last_name || '';
        const carreraSeleccionada = datosCrearUsuario?.carrera || datos.carrera || docente?.carrera_id || docente?.carrera || '';

        setVinculacionRapidaDocente(true);
        setDocenteReciente({
          id: docenteId,
          nombre_completo: docente?.nombre_completo || nombreCompleto,
          ci: docente?.ci || '',
          carrera_id: carreraSeleccionada,
        });
        setFormData({
          username: datosCrearUsuario?.username || '',
          email: datosCrearUsuario?.email || datos.email || '',
          nombre_completo: nombreCompleto,
          first_name: firstName,
          last_name: lastName,
          rol: 'docente',
          carrera: carreraSeleccionada,
          docente: docenteId,
          docente_data: null,
          password: datosCrearUsuario?.password || '',
          password_confirm: datosCrearUsuario?.password_confirm || '',
        });
        setAsignacionesExtra([]);
        setCrearNuevoDocente(false);
        setBloquearCrearNuevoDocente(false);
        setErrors({});
        setUsuarioEditando(null);
        setIsCreating(true);
        sessionStorage.removeItem('vincularDocentePendiente');
      }
    } catch (e) {
      console.error('Error al preparar vínculo rápido de docente:', e);
      sessionStorage.removeItem('vincularDocentePendiente');
    }
  }, [docentes]);

  // 🔗 Recuperar datos del formulario al volver desde docentes
  useEffect(() => {
    const vincularDocentePendiente = sessionStorage.getItem('vincularDocentePendiente');
    if (vincularDocentePendiente) return;
    const datosGuardados = sessionStorage.getItem('datosCrearUsuario');
    if (datosGuardados) {
      try {
        const datos = JSON.parse(datosGuardados);
        const docenteRetornadoRaw = sessionStorage.getItem('docenteRetornadoDesdeUsuarios');
        const docenteRetornado = docenteRetornadoRaw ? JSON.parse(docenteRetornadoRaw) : null;
        const firstName = datos.first_name || '';
        const lastName = datos.last_name || '';
        const nombreCompleto = datos.nombre_completo || `${firstName} ${lastName}`.trim();

        setDocenteReciente(docenteRetornado ? {
          id: docenteRetornado.id,
          nombre_completo: docenteRetornado.nombre_completo || nombreCompleto,
          ci: docenteRetornado.ci || '',
          carrera_id: docenteRetornado.carrera || '',
        } : null);

        restoringFormRef.current = true;
        setFormData({
          ...datos,
          nombre_completo: nombreCompleto,
          first_name: firstName,
          last_name: lastName,
          carrera: docenteRetornado?.carrera || datos.carrera || '',
          docente: docenteRetornado?.id || (datos.docente || ''),
          docente_data: null,
        });
        setCrearNuevoDocente(false);
        setBloquearCrearNuevoDocente(Boolean(docenteRetornado?.id));
        setAsignacionesExtra([]);
        sessionStorage.removeItem('datosCrearUsuario');
        sessionStorage.removeItem('docenteRetornadoDesdeUsuarios');
        sessionStorage.removeItem('flujoDocenteDesdeUsuarios');
        // Abrir el modal automáticamente con los datos recuperados
        setIsCreating(true);
        setAbrirModalAlVolver(false);
      } catch (e) {
        console.error('Error al recuperar datos:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!isCreating) return;
    if (formData.rol !== 'docente') return;
    if (!docenteReciente?.id) return;
    if (formData.docente) return;

    setFormData((prev) => ({
      ...prev,
      docente: docenteReciente.id,
      docente_data: null,
      carrera: prev.carrera || docenteReciente.carrera_id || '',
    }));
  }, [isCreating, formData.rol, formData.docente, docenteReciente]);

  const cargarDatos = async () => {
    try {
      const [usuariosRes, docentesRes, carrerasRes, rolesRes] = await Promise.all([
        api.get('/usuarios/'),
        api.get('/docentes/'),
        api.get('/carreras/'),
        api.get('/usuarios/roles/')
      ]);

      setUsuarios(usuariosRes.data.results || usuariosRes.data);
      setDocentes(docentesRes.data.results || docentesRes.data);
      setCarreras(carrerasRes.data.results || carrerasRes.data);

      // Filtrar roles: solo superuser puede ver y asignar rol 'iiisyp'
      const todosRoles = rolesRes.data || [];
      const esSuperuser = user?.is_superuser === true;
      const rolesFiltrados = todosRoles.filter(rol => 
        esSuperuser ? true : rol.value !== 'iiisyp'
      );
      setRoles(rolesFiltrados);
      
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos');
      setLoading(false);
    }
  };

  const docentesDisponibles = docenteReciente && !docentes.some((item) => String(item.id) === String(docenteReciente.id))
    ? [...docentes, docenteReciente]
    : docentes;

  const docentesActivosDisponibles = docentesDisponibles.filter((docente) => docente?.activo !== false);
  const docentesPorId = new Map(docentes.map((docente) => [String(docente.id), docente]));

  const usuarioTieneDocenteInactivo = (usuario) => {
    if (usuario?.perfil?.rol !== 'docente') return false;
    const docenteId = usuario?.perfil?.docente_id;
    if (!docenteId) return false;
    const docente = docentesPorId.get(String(docenteId));
    return Boolean(docente && docente.activo === false);
  };

  const usuariosFiltrados = (() => {
    let result = showOnlyOrphans ? usuarios.filter(esUsuarioHuerfano) : usuarios;

    if (selectedCarrera) {
      result = result.filter((usuario) => String(usuario?.perfil?.carrera || '') === String(selectedCarrera));
    }

    // Filtrar por término de búsqueda (nombre o C.I.)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((usuario) => {
        const nombre = `${usuario.first_name || ''} ${usuario.last_name || ''}`.toLowerCase();
        const ci = usuario.ci || '';
        return nombre.includes(searchLower) || ci.includes(searchLower);
      });
    }

    // Orden jerárquico: Admin → Director → Jefe Estudios → Docente
    const ordenJerarquico = {
      'iiisyp': 0,
      'director': 1,
      'jefe_estudios': 2,
      'docente': 3
    };

    result = [...result].sort((a, b) => {
      const rolA = a.perfil?.rol || 'docente';
      const rolB = b.perfil?.rol || 'docente';
      const ordenA = ordenJerarquico[rolA] ?? 99;
      const ordenB = ordenJerarquico[rolB] ?? 99;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      // Si mismo rol, ordenar por apellido
      const apellidoA = (a.last_name || '').toLowerCase();
      const apellidoB = (b.last_name || '').toLowerCase();
      return apellidoA.localeCompare(apellidoB, 'es', { sensitivity: 'base' });
    });

    return result;
  })();

  // Initialize form when creation starts
  useEffect(() => {
    if (isCreating) {
      if (restoringFormRef.current) {
        restoringFormRef.current = false;
        setCrearNuevoDocente(false);
        setErrors({});
        return;
      }
      
      // Admin de carrera: bloquear con su propia carrera
      const esAdminCarrera = user?.perfil?.rol === 'iiisyp' && !user?.is_superuser;
      const carreraDefault = esAdminCarrera ? user?.perfil?.carrera : '';
      
      const initialData = {
        username: '',
        email: '',
        nombre_completo: '',
        first_name: '',
        last_name: '',
        rol: 'docente',
        carrera: carreraDefault,
        docente: '',
        docente_data: null,
        password: '',
        password_confirm: '',
      };
      setFormData(initialData);
      setAsignacionesExtra([]);
      setVinculacionRapidaDocente(false);
      setCrearNuevoDocente(false);
      setBloquearCrearNuevoDocente(false);
      setDocenteReciente(null);
      setErrors({});
    }
  }, [isCreating, user]);

  const handleToggleCreateForm = () => {
    sessionStorage.removeItem('datosEditarUsuario');
    if (isCreating) {
      setVinculacionRapidaDocente(false);
      setAsignacionesExtra([]);
      setBloquearCrearNuevoDocente(false);
    }
    setIsCreating(!isCreating);
    setUsuarioEditando(null); // Ensure we are not in edit mode
  };

  const abrirModalEditar = (usuario) => {
    sessionStorage.removeItem('datosEditarUsuario');
    restoringEditModalRef.current = false;
    setUsuarioEditando(usuario);
    setShowModal(true);
    setIsCreating(false); // Hide create form if it was open
  };

  const handleToggleActivo = (usuario) => {
    if (usuario?.is_superuser) {
      toast.error('El Super Admin no puede desactivarse');
      return;
    }
    setUsuarioToToggle(usuario);
    setShowToggleModal(true);
  };

  const handleEliminar = (usuario) => {
    setUsuarioToDelete(usuario);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUsuarioToDelete(null);
    setDeleteConfirmText('');
  };

  const confirmarEliminar = async () => {
    if (!usuarioToDelete) return;
    if (deleteConfirmText !== usuarioToDelete.username) {
      toast.error('Debes escribir exactamente el nombre de usuario para confirmar');
      return;
    }
    try {
      await api.delete(`/usuarios/${usuarioToDelete.id}/`);
      toast.success('Usuario eliminado con éxito');
      cargarDatos();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      console.log('Error response:', err.response);
      console.log('Error data:', err.response?.data);

      // Capturar mensaje de error específico del backend
      let errorMessage = 'Error al eliminar el usuario';

      if (err.response && err.response.data) {
        // Backend devolvió un error específico
        if (typeof err.response.data === 'object') {
          // Puede ser { error: 'mensaje' } o { detail: 'mensaje' }
          errorMessage = err.response.data.error || err.response.data.detail || JSON.stringify(err.response.data);
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error('Error message:', errorMessage);
      toast.error(errorMessage);
    }
  };
  // --- FORM LOGIC FOR INLINE CREATION ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      if (name === 'nombre_completo') {
        const partes = value.trim().split(/\s+/).filter(Boolean);
        updated.first_name = partes[0] || '';
        updated.last_name = partes.slice(1).join(' ');
      }

      // Auto-generar contraseña por defecto al escribir el username
      if (name === 'username') {
        updated.password = value + 'UABJB';
        updated.password_confirm = value + 'UABJB';
      }

      if (name === 'docente' && value) {
        updated.docente_data = null;
      }

      if (name === 'carrera' && updated.docente_data) {
        updated.docente_data = {
          ...updated.docente_data,
          carrera: value,
        };
      }

      return updated;
    });

    if (name === 'carrera') {
      setAsignacionesExtra((prev) => prev.map((item) => (
        item.rol === 'docente' ? { ...item, carrera: value } : item
      )));
    }

    if (name === 'docente' && value) {
      setCrearNuevoDocente(false);
    }

    // Limpia el error del campo al escribir para feedback inmediato
    setErrors((prev) => {
      const next = { ...prev };
      if (name === 'nombre_completo') {
        delete next.nombre_completo;
        delete next.first_name;
        delete next.last_name;
      } else {
        if (!prev?.[name]) return prev;
        delete next[name];
      }
      return next;
    });
  };

  const handleRolChange = (e) => {
    if (vinculacionRapidaDocente) return;

    const newRol = e.target.value;
    const esAdminCarrera = user?.perfil?.rol === 'iiisyp' && !user?.is_superuser;

    setErrors((prev) => ({ ...prev, rol: null }));
    
    setFormData(prev => ({
      ...prev,
      rol: newRol,
      // Admin de carrera siempre mantiene su carrera, otros roles la pierden al cambiar
      carrera: (newRol === 'director' || newRol === 'jefe_estudios' || newRol === 'iiisyp') 
        ? (esAdminCarrera ? user?.perfil?.carrera : prev.carrera) 
        : (newRol === 'docente' ? prev.carrera : ''),
      docente: newRol !== 'docente' ? '' : prev.docente,
      docente_data: newRol !== 'docente' ? null : prev.docente_data,
    }));
    if (newRol !== 'docente') {
      setCrearNuevoDocente(false);
    }
  };

  const handleCrearNuevoDocente = () => {
    // 🔗 Al marcar checkbox, ir a /fondo-tiempo/docentes y abrir modal
    // Guardar datos del formulario en sessionStorage para recuperarlos al volver
    sessionStorage.removeItem('vincularDocentePendiente');
    sessionStorage.setItem('datosCrearUsuario', JSON.stringify(formData));
    const apellidos = (formData.last_name || '').trim().split(/\s+/).filter(Boolean);
    sessionStorage.setItem('datosCrearDocente', JSON.stringify({
      nombres: formData.first_name || '',
      apellido_paterno: apellidos[0] || '',
      apellido_materno: apellidos.slice(1).join(' '),
      carrera: formData.carrera || '',
      nombre_completo: formData.nombre_completo || `${formData.first_name || ''} ${formData.last_name || ''}`.trim(),
      ci: '',
      telefono: '',
    }));
    sessionStorage.setItem('flujoDocenteDesdeUsuarios', 'crear_usuario');
    sessionStorage.setItem('abrirModalDesdeUsuarios', 'true');
    // Marcar para abrir modal al volver
    setAbrirModalAlVolver(true);
    navigate('/fondo-tiempo/docentes');
  };

  const handleAsignacionChange = (index, field, value) => {
    setAsignacionesExtra((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === 'rol') {
        return {
          ...item,
          rol: value,
          carrera: value === 'docente' ? (formData.carrera || '') : item.carrera,
          docente: value === 'docente' ? item.docente : '',
        };
      }
      if (field === 'carrera' && item.rol === 'docente') {
        return item;
      }
      return { ...item, [field]: value };
    }));
  };

  const MAX_ASIGNACIONES_TOTAL = 2;
  const totalAsignaciones = 1 + asignacionesExtra.length;
  const puedeAgregarAsignacion = totalAsignaciones < MAX_ASIGNACIONES_TOTAL;

  const agregarAsignacion = () => {
    if (asignacionesExtra.length > 0) {
      setAsignacionesExtra([]);
      return;
    }
    if (!puedeAgregarAsignacion) return;
    setAsignacionesExtra((prev) => ([...prev, { rol: 'docente', carrera: formData.carrera || '', docente: '' }]));
  };

  const eliminarAsignacion = (index) => {
    setAsignacionesExtra((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const esUsuarioSistema = ['iiisyp', 'director', 'jefe_estudios'].includes(formData.rol);
    const ciNormalizado = (formData.ci || '').trim();

    if (esUsuarioSistema && !ciNormalizado) {
      setErrors((prev) => ({
        ...prev,
        ci: ['El C.I. es obligatorio para este tipo de usuario.'],
      }));
      toast.error('El C.I. es obligatorio para este tipo de usuario.');
      setIsSubmitting(false);
      return;
    }

    const resolverDocenteId = () => {
      const valorDocente = formData.docente;
      const valorNormalizado = String(valorDocente ?? '').trim();

      if (valorNormalizado) {
        const idNumerico = Number(valorNormalizado);
        if (!Number.isNaN(idNumerico) && idNumerico > 0) {
          const existeDocente = docentesDisponibles.some((docente) => String(docente.id) === String(idNumerico));
          return existeDocente ? idNumerico : null;
        }

        const encontradoPorId = docentesDisponibles.find((docente) => String(docente.id) === valorNormalizado);
        if (encontradoPorId) {
          const idEncontrado = Number(encontradoPorId.id);
          return Number.isNaN(idEncontrado) ? encontradoPorId.id : idEncontrado;
        }
      }

      const nombreCompletoNormalizado = String(formData.nombre_completo || '').trim().toLowerCase();
      if (nombreCompletoNormalizado) {
        const encontradoPorNombre = docentesDisponibles.find((docente) =>
          String(docente.nombre_completo || '').trim().toLowerCase() === nombreCompletoNormalizado
        );
        if (encontradoPorNombre) {
          const idEncontrado = Number(encontradoPorNombre.id);
          return Number.isNaN(idEncontrado) ? encontradoPorNombre.id : idEncontrado;
        }
      }

      return null;
    };

    const docenteId = resolverDocenteId();
    const docenteTemporal = formData.docente_data && typeof formData.docente_data === 'object'
      ? formData.docente_data
      : null;
    const carreraDocente = formData.carrera || docenteTemporal?.carrera || '';

    if (formData.rol === 'docente' && !carreraDocente) {
      setErrors((prev) => ({
        ...prev,
        carrera: ['Debe seleccionar una carrera para el docente.'],
      }));
      toast.error('Debe seleccionar una carrera para el docente.');
      setIsSubmitting(false);
      return;
    }

    if (formData.rol === 'docente' && !docenteId && !docenteTemporal) {
      setErrors((prev) => ({
        ...prev,
        docente: ['Debe seleccionar un docente para vincular.'],
      }));
      toast.error('Debe seleccionar o registrar un docente para vincular.');
      setIsSubmitting(false);
      return;
    }

    let payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      rol: formData.rol,
      password: formData.password,
      password_confirm: formData.password_confirm,
    };

    if (asignacionesExtra.length > 0) {
      payload.asignaciones = asignacionesExtra;
    }

    // Admin, Director y Jefe de Estudios deben enviar carrera
    if (formData.rol === 'iiisyp' || formData.rol === 'director' || formData.rol === 'jefe_estudios') {
      payload.carrera = formData.carrera;
      payload.ci = ciNormalizado;
    }
    if (formData.rol === 'docente') {
      payload.carrera = carreraDocente;
      if (docenteTemporal) {
        payload.docente_data = {
          ...docenteTemporal,
          carrera: carreraDocente,
        };
      } else {
        payload.docente = docenteId;
      }
    }

    try {
      await api.post('/usuarios/', payload);
      toast.success('Usuario creado correctamente');
      setIsCreating(false);
      setAsignacionesExtra([]);
      sessionStorage.removeItem('docenteTemporalDesdeUsuarios');
      sessionStorage.removeItem('flujoDocenteDesdeUsuarios');
      cargarDatos();
    } catch (err) {
      console.error('Error al crear usuario:', err.response);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        if (typeof apiErrors === 'object') {
          const backendMessage = getBackendErrorMessage(apiErrors, '');
          const esErrorDeCargoPorCarrera =
            backendMessage.includes('ya tiene un Administrador asignado')
            || backendMessage.includes('ya tiene un Director asignado')
            || backendMessage.includes('ya tiene un Jefe de Estudios asignado');

          setErrors(
            esErrorDeCargoPorCarrera
              ? { ...apiErrors, rol: [backendMessage] }
              : apiErrors
          );
        }
        const ciMsg = Array.isArray(apiErrors?.ci)
          ? apiErrors.ci[0]
          : (typeof apiErrors?.ci === 'string' ? apiErrors.ci : null);
        const docenteMsg = Array.isArray(apiErrors?.docente)
          ? apiErrors.docente[0]
          : (typeof apiErrors?.docente === 'string' ? apiErrors.docente : null);
        if (ciMsg) {
          toast.error(`C.I.: ${ciMsg}`);
        } else if (docenteMsg) {
          toast.error(docenteMsg);
        } else if (typeof apiErrors === 'string' && apiErrors.includes('<!DOCTYPE')) {
          toast.error('Debe seleccionar un docente para vincular.');
        } else {
          toast.error(getBackendErrorMessage(apiErrors, 'Ocurrió un error inesperado al crear el usuario.'));
        }
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const ciError = Array.isArray(errors?.ci)
    ? errors.ci[0]
    : (typeof errors?.ci === 'string' ? errors.ci : null);

  const docenteError = Array.isArray(errors?.docente)
    ? errors.docente[0]
    : (typeof errors?.docente === 'string' ? errors.docente : null);

  const nombreCompletoError = Array.isArray(errors?.nombre_completo)
    ? errors.nombre_completo[0]
    : (Array.isArray(errors?.first_name)
      ? errors.first_name[0]
      : (Array.isArray(errors?.last_name)
        ? errors.last_name[0]
        : (typeof errors?.first_name === 'string'
          ? errors.first_name
          : (typeof errors?.last_name === 'string' ? errors.last_name : null))));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  // iiisyp es solo lectura: no puede crear/editar/eliminar usuarios
  const puedeGestionarUsuarios = () => user?.is_superuser === true;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Gestión de Usuarios
              </h1>
              <p className="text-slate-700 dark:text-slate-300 mt-1 italic">
                Administración de cuentas y permisos
              </p>
            </div>
            <div className="flex items-center gap-4">
              <SearchInput value={searchTerm} onChange={setSearchTerm} />
              <div className="w-48">
                <SimpleDropdown
                  label=""
                  value={selectedCarrera}
                  onChange={setSelectedCarrera}
                  options={carreras.map(c => ({ value: c.id, label: c.nombre }))}
                  placeholder="Carreras"
                  clearOnToggle
                />
              </div>
              {puedeGestionarUsuarios() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
                >
                  <span>{isCreating ? '➖' : '➕'}</span>
                  {isCreating ? 'Cancelar Creación' : 'Crear Usuario'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CREACIÓN DE USUARIO */}
        {isCreating && createPortal((
          <div
            className={`fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${crearNuevoDocente && formData.rol === 'docente' ? '!justify-center' : ''}`}
            style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0' }}
          >
            <div className={`flex items-center justify-center w-full h-full ${crearNuevoDocente && formData.rol === 'docente' ? 'gap-6' : ''}`}>
              {/* Modal Usuario - mantiene su tamaño original */}
              <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-fade-in transition-all duration-300 ${crearNuevoDocente && formData.rol === 'docente' ? 'max-w-2xl w-full' : 'max-w-2xl w-full mx-4'}`} style={{ overflow: 'visible' }}>
                {/* Header azul */}
                <div className="bg-[#2C4AAE] dark:bg-[#1a3a8a] px-6 py-4 rounded-t-2xl">
                  <h2 className="text-xl font-bold text-white">
                    Crear Nuevo Usuario
                  </h2>
                </div>

              <form onSubmit={handleSubmit}>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fila 1 */}
                    <InputField label="Usuario" name="username" value={formData.username || ''} onChange={handleChange} error={errors.username} />
                    <InputField
                      label="Nombre completo"
                      name="nombre_completo"
                      value={formData.nombre_completo || ''}
                      onChange={handleChange}
                      error={nombreCompletoError}
                    />

                    {/* Fila 2: Carrera - Vincular docente */}
                    <div>
                      {(formData.rol === 'docente' || formData.rol === 'iiisyp' || formData.rol === 'director' || formData.rol === 'jefe_estudios') ? (
                        <FilterCarreras
                          label="Carrera"
                          name="carrera"
                          value={formData.carrera || ''}
                          onChange={handleChange}
                          carreras={carreras}
                          error={errors.carrera}
                          disabled={formData.rol !== 'docente' && user?.perfil?.rol === 'iiisyp' && !user?.is_superuser}
                          required={formData.rol !== 'docente'}
                          placeholder="Buscar carrera..."
                        />
                      ) : (
                        <div />
                      )}
                    </div>

                    <div>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <SelectConDropdown
                            label="Rol"
                            name="rol"
                            value={formData.rol || 'docente'}
                            onChange={handleRolChange}
                            onInteract={() => setErrors((prev) => ({ ...prev, rol: null }))}
                            options={roles.map(rol => ({ value: rol.value, label: rol.label }))}
                            error={errors.rol}
                            disabled={vinculacionRapidaDocente}
                            required
                            standardStyle
                          />
                        </div>
                        <div className="shrink-0 pt-[28px]">
                          <button
                            type="button"
                            onClick={agregarAsignacion}
                            disabled={!puedeAgregarAsignacion && asignacionesExtra.length === 0}
                            style={STATIC_CONTROL_STYLE}
                            className={`h-[52px] w-16 rounded-2xl border-2 border-[#2C4AAE] text-white font-black text-2xl leading-none shadow-sm flex items-center justify-center transition-none transform-none hover:shadow-none ${(puedeAgregarAsignacion || asignacionesExtra.length > 0) ? 'bg-[#2C4AAE]' : 'bg-slate-400 cursor-not-allowed opacity-70'}`}
                            title={asignacionesExtra.length > 0 ? 'Cerrar asignación adicional' : 'Agregar asignación adicional'}
                          >
                            {asignacionesExtra.length > 0 ? '−' : '+'}
                          </button>
                        </div>
                      </div>
                      {vinculacionRapidaDocente && (
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                          Vinculo rapido desde "Sin Cuenta": rol bloqueado en Docente.
                        </p>
                      )}
                    </div>

                    <div>
                      {formData.rol === 'docente' ? (
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                            Vincular a Docente Existente
                          </label>
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <FilterDocentes
                                name="docente"
                                value={formData.docente}
                                onChange={handleChange}
                                docentes={docentesActivosDisponibles}
                                error={docenteError}
                                disabled={vinculacionRapidaDocente}
                                placeholder="Buscar docente..."
                              />
                            </div>
                            {!vinculacionRapidaDocente && (
                              <button
                                type="button"
                                disabled={bloquearCrearNuevoDocente || formData.rol !== 'docente'}
                                onClick={() => {
                                  if (bloquearCrearNuevoDocente || formData.rol !== 'docente') return;
                                  handleCrearNuevoDocente();
                                }}
                                title="Crear nuevo registro de docente"
                                className="h-[52px] w-[52px] bg-[#2C4AAE] hover:bg-[#1a3a8a] disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center flex-shrink-0"
                              >
                                <span className="text-xl leading-none">+</span>
                              </button>
                            )}
                          </div>
                          {formData.rol !== 'docente' && (
                            <p className="text-xs text-amber-500 dark:text-amber-300 mt-1">
                              No disponible para este rol
                            </p>
                          )}
                        </div>
                      ) : (formData.rol === 'iiisyp' || formData.rol === 'director' || formData.rol === 'jefe_estudios') ? (
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">C.I.</label>
                          <input
                            type="text"
                            name="ci"
                            value={formData.ci || ''}
                            onChange={handleChange}
                            className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              ciError ? 'border-red-500 dark:border-red-500' : 'border-slate-400 dark:border-slate-600'
                            }`}
                          />
                          {ciError && <p className="text-xs text-red-600 mt-1">{ciError}</p>}
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>

                    {(formData.rol === 'docente' || formData.rol === 'iiisyp' || formData.rol === 'director' || formData.rol === 'jefe_estudios') && !crearNuevoDocente ? (
                      <InputField
                        label="Email"
                        name="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={handleChange}
                        error={errors.email}
                      />
                    ) : (
                      <div />
                    )}

                    {/* Fila 4 (Docente): Contraseña inicial - Asignaciones adicionales */}
                    {formData.rol === 'docente' && !crearNuevoDocente && (
                        <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Contraseña inicial</label>
                        <div className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                          {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                        </div>
                      </div>
                    )}

                    {(formData.rol === 'iiisyp' || formData.rol === 'director' || formData.rol === 'jefe_estudios') && !crearNuevoDocente && (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Contraseña inicial</label>
                        <div className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                          {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                        </div>
                      </div>
                    )}

                    {/* C.I. para admin/director/jefe_estudios - abajo de Rol */}
                    {false && (formData.rol === 'iiisyp' || formData.rol === 'director' || formData.rol === 'jefe_estudios') && (
                      <div className="md:col-span-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">C.I.</label>
                            <input
                              type="text"
                              name="ci"
                              value={formData.ci || ''}
                              onChange={handleChange}
                              className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                ciError ? 'border-red-500 dark:border-red-500' : 'border-slate-400 dark:border-slate-600'
                              }`}
                            />
                            {ciError && <p className="text-xs text-red-600 mt-1">{ciError}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Contraseña inicial</label>
                            <div className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                              {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2 mt-2">
                      {false && !puedeAgregarAsignacion && (
                        <p className="text-xs text-amber-600 dark:text-amber-300 mb-3">
                          Límite alcanzado: máximo 2 asignaciones totales por usuario.
                        </p>
                      )}

                      <div
                        className={`${asignacionesExtra.length > 0 ? 'block' : 'hidden'}`}
                      >
                        <div className="space-y-4 pt-2">
                          {asignacionesExtra.map((asignacion, index) => {
                            const mostrarDocente = asignacion.rol === 'docente';
                            return (
                              <div key={index} className="rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FilterCarreras
                                    label="Carrera"
                                    name={`asignacion-carrera-${index}`}
                                    value={asignacion.carrera || ''}
                                    onChange={(e) => handleAsignacionChange(index, 'carrera', e.target.value)}
                                    carreras={carreras}
                                    error={errors[`asignaciones.${index}.carrera`]}
                                    required
                                    placeholder="Buscar carrera..."
                                  />

                                  {mostrarDocente ? (
                                    <FilterDocentes
                                      label="Docente"
                                      name={`asignacion-docente-${index}`}
                                      value={asignacion.docente || ''}
                                      onChange={(e) => handleAsignacionChange(index, 'docente', e.target.value)}
                                      docentes={docentesActivosDisponibles}
                                      error={errors[`asignaciones.${index}.docente`]}
                                      placeholder="Buscar docente..."
                                    />
                                  ) : (
                                    <div />
                                  )}

                                  <div className="md:col-span-2">
                                    <SelectConDropdown
                                      label="Rol"
                                      name={`asignacion-rol-${index}`}
                                      value={asignacion.rol || 'docente'}
                                      onChange={(e) => handleAsignacionChange(index, 'rol', e.target.value)}
                                      options={roles.map(rol => ({ value: rol.value, label: rol.label }))}
                                      error={errors[`asignaciones.${index}.rol`]}
                                      required
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer con botones */}
                <div className="px-6 py-4 bg-slate-100 dark:bg-slate-700 border-t border-slate-300 dark:border-slate-600 flex justify-end gap-3 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setVinculacionRapidaDocente(false);
                    }}
                    className="px-6 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#2C4AAE] hover:bg-[#1a3a8a] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        ), document.body)}
 
        {/* Modal for editing */}
        <ModalUsuario
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSaveSuccess={(usuarioActualizado) => {
            setShowModal(false);
            if (usuarioActualizado?.id) {
              setUsuarios((prev) => prev.map((usuario) => (
                usuario.id === usuarioActualizado.id ? usuarioActualizado : usuario
              )));
              setUsuarioEditando(usuarioActualizado);
            }
            cargarDatos();
          }}
          userToEdit={usuarioEditando}
          docentes={docentes}
          carreras={carreras}
          roles={roles}
          sidebarCollapsed={sidebarCollapsed}
          hasSidebar={hasSidebar}
          currentUser={user}
        />

        <div className="flex justify-end">
          {hayOrfanos && (
            <button
              type="button"
              onClick={() => setShowOnlyOrphans((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all shadow-md ${
                showOnlyOrphans
                  ? 'bg-red-700 text-white border-red-800 hover:bg-red-800 dark:bg-red-700 dark:border-red-900 animate-pulse-slow'
                  : 'bg-red-600 text-white border-red-700 hover:bg-red-700 dark:bg-red-600 dark:border-red-800 animate-pulse-slow'
              }`}
            >
              {showOnlyOrphans ? '⚠️ Mostrar Todos' : '⚠️ Urgente: Ver Huérfanos'}
            </button>
          )}
        </div>
        
        {/* Tabla de usuarios */}
        <div id="fondo-usuarios-tabla" className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-slate-300 dark:divide-slate-700">
              <thead className="bg-blue-800 dark:bg-blue-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Apellidos
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    C.I.
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Carrera
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {usuariosFiltrados.map(usuario => (
                  (() => {
                    const filaInactiva = usuario.is_active === false && !usuario.is_superuser;
                    const textoFila = filaInactiva ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300';
                    const textoPrincipal = filaInactiva ? 'font-bold text-red-700 dark:text-red-300' : 'font-bold text-slate-800 dark:text-white';
                    return (
                  <tr
                    key={usuario.id}
                    className={`transition-colors ${
                      usuario.is_active
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                        : 'bg-red-200/90 dark:bg-red-950/35 hover:bg-red-300/80 dark:hover:bg-red-900/45'
                    }`}
                  >
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className="space-y-1">
                        <div className={`flex items-center gap-2 ${textoPrincipal}`}>
                          <span>{usuario.username}</span>
                          {filaInactiva && (
                            <span className="inline-flex items-center rounded-md border border-red-700 bg-red-200 px-2 py-0.5 text-[11px] font-bold text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                              (inactivo)
                            </span>
                          )}
                        </div>
                        {/* Aviso si el usuario no tiene perfil */}
                        {!usuario.perfil && (
                          <div className={`text-xs font-semibold ${filaInactiva ? 'text-red-700 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            ⚠️ Sin Perfil
                          </div>
                        )}
                        {/* Aviso si el usuario tiene rol docente pero no tiene docente vinculado */}
                        {usuario.perfil?.rol === 'docente' && (!usuario.perfil?.docente_id || usuario.perfil.docente_id === null) && (
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            ❌ Sin Vínculo Docente
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm ${textoFila}`}>
                        {usuario.first_name || '-'}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm ${textoFila}`}>
                        {usuario.last_name || '-'}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm font-mono ${textoFila}`}>
                        {usuario.ci || '-'}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm font-bold ${textoFila}`}>
                        {usuario.carrera_codigo || '-'}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      {(() => {
                        const docenteInactivo = usuarioTieneDocenteInactivo(usuario);
                        return (
                      <span className={`px-3 py-1.5 inline-flex text-xs font-bold rounded-lg border-2 shadow-sm ${
                        usuario.is_superuser ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-600' :
                        docenteInactivo ? 'bg-red-200 dark:bg-red-900/30 text-red-900 dark:text-red-200 border-red-600 dark:border-red-700' :
                        usuario.perfil?.rol === 'iiisyp' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' :
                        usuario.perfil?.rol === 'director' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' :
                        usuario.perfil?.rol === 'jefe_estudios' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700' :
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                      }`}>
                        {usuario.is_superuser ? '👑 Super Admin' :
                         usuario.perfil?.rol === 'iiisyp' ? '🛡️ Admin' :
                         usuario.perfil?.rol === 'director' ? '🏛️ Director de Carrera' :
                         usuario.perfil?.rol === 'jefe_estudios' ? '📚 Jefe de Estudios' :
                         docenteInactivo ? '👨‍🏫 Docente (inactivo)' : '👨‍🏫 Docente'}
                      </span>
                        );
                      })()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className="flex items-center justify-center gap-3">
                        {!usuario.is_superuser && (
                          <ToggleSwitch
                            isActive={usuario.is_active}
                            disabled={usuario.is_superuser}
                            onChange={() => handleToggleActivo(usuario)}
                          />
                        )}
                        <span className="text-sm font-semibold">
                          {usuario.is_superuser
                            ? <span className="text-amber-600 dark:text-amber-400 italic">protegido</span>
                            : usuario.is_active
                            ? <span className="text-emerald-600 dark:text-emerald-400 italic">Activo</span>
                            : <span className="text-red-800 dark:text-red-400 font-black italic tracking-wide">inactivo</span>
                          }
                        </span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-center ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      {puedeGestionarUsuarios() && (
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => abrirModalEditar(usuario)}
                            className={`transition-all duration-200 hover:scale-110 ${
                              filaInactiva
                                ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-sm px-2 py-2 rounded-lg'
                                : 'text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300'
                            }`}
                            title="Editar"
                          >
                            <FaEdit size={18} />
                          </button>
                          <button
                            onClick={() => handleEliminar(usuario)}
                            disabled={usuario.is_superuser}
                            className={`transition-all duration-200 hover:scale-110 ${
                              usuario.is_superuser
                                ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                : filaInactiva
                                ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-sm px-2 py-2 rounded-lg'
                                : 'text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300'
                            }`}
                            title="Eliminar"
                          >
                            <FaTrash size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>

            {usuarios.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">No hay usuarios registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Confirmación de Toggle Estado */}
        {showToggleModal && usuarioToToggle && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowToggleModal(false)} />
            <div
              className={`relative w-full max-w-lg rounded-2xl border bg-slate-900 shadow-2xl overflow-hidden animate-slide-up ${
                usuarioToToggle.is_active
                  ? 'border-uab-gold-300/40 dark:border-uab-gold-700/50'
                  : 'border-uab-green-300/40 dark:border-uab-green-700/50'
              }`}
              style={{ animationDuration: '160ms' }}
            >
              <div className={`px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r ${usuarioToToggle.is_active ? 'from-uab-gold-900/30 to-slate-900' : 'from-uab-green-900/30 to-slate-900'}`}>
                <h4 className={`text-lg font-bold flex items-center gap-2 ${usuarioToToggle.is_active ? 'text-uab-gold-300' : 'text-uab-green-300'}`}>
                  <span>{usuarioToToggle.is_active ? '⏸️' : '▶️'}</span>
                  {usuarioToToggle.is_active ? 'Confirmar Pausa de Acceso' : 'Confirmar Reactivación'}
                </h4>
              </div>
              <div className="px-5 py-4 space-y-3 text-slate-200">
                <p className="text-sm leading-relaxed">
                  {usuarioToToggle.is_active
                    ? `Se pausará el acceso de ${usuarioToToggle.username} al sistema.`
                    : `Se reactivará el acceso de ${usuarioToToggle.username} al sistema.`}
                </p>
                <div className={`rounded-lg border px-3 py-2 text-sm ${usuarioToToggle.is_active ? 'border-uab-gold-500/40 bg-uab-gold-500/10' : 'border-uab-green-500/40 bg-uab-green-500/10'}`}>
                  Usuario: <strong className={usuarioToToggle.is_active ? 'text-uab-gold-300' : 'text-uab-green-300'}>{usuarioToToggle.username}</strong>
                </div>
                <p className="text-xs text-slate-400">
                  Esta acción se puede revertir desde el interruptor de estado.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-700/70 flex justify-end gap-3 bg-slate-950/70">
                <button
                  type="button"
                  onClick={() => setShowToggleModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-300 border border-slate-600 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.post(`/usuarios/${usuarioToToggle.id}/toggle_activo/`);
                      toast.success(`Usuario ${usuarioToToggle.is_active ? 'desactivado' : 'reactivado'} con éxito`);
                      setShowToggleModal(false);
                      cargarDatos();
                    } catch (err) {
                      console.error('Error:', err);
                      toast.error('Error al cambiar el estado del usuario');
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-white ${usuarioToToggle.is_active ? 'bg-uab-gold-600 hover:bg-uab-gold-700' : 'bg-uab-green-600 hover:bg-uab-green-700'}`}
                >
                  {usuarioToToggle.is_active ? '⏸️ Confirmar Pausa' : '▶️ Confirmar Reactivación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Eliminación */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
                  Se eliminará el usuario <strong className="text-slate-900 dark:text-white">{usuarioToDelete?.username}</strong> del sistema de forma permanente.
                </p>
                <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                  Acción irreversible: <strong className="text-red-900 dark:text-red-300">El usuario perderá su acceso definitivamente.</strong>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Escribe el nombre exacto de usuario para habilitar la eliminación:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Escribe el nombre de usuario para confirmar"
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
                  disabled={deleteConfirmText !== (usuarioToDelete?.username || '')}
                  className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GestionUsuarios;
