import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import NuevoDocumentoModal from './NuevoDocumentoModal';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { Modal } from './base';
import { ModalErrorAlert, formatApiErrors } from './formErrorUtils';

const MIN_GESTION_YEAR = 2022;
const getMaxGestionYear = () => new Date().getFullYear() + 5;

const YearWheelItem = ({ year, distance, itemHeight }) => {
  const isCenter = Math.abs(distance) < 0.35;
  const clamped = Math.max(-4, Math.min(4, distance));
  const abs = Math.abs(clamped);
  const rotationX = Math.max(-62, Math.min(62, Math.sign(clamped) * Math.pow(abs, 1.08) * 16));
  const stepScale = abs < 0.35 ? 1 : 0.97;
  const opacity = abs < 0.35 ? 1 : Math.max(0.4, 1 - abs * 0.2);
  const translateZ = -Math.min(58, abs * 16);

  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        height: `${itemHeight}px`,
        width: '100%',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotationX}deg) translateZ(${translateZ}px) scale(${stepScale})`,
        transformOrigin: 'center center',
        opacity,
      }}
    >
      <span className={`tracking-wide ${isCenter ? 'font-extrabold text-lg text-transparent' : 'font-semibold text-sm text-slate-700 dark:text-slate-300'}`}>
        {year}
      </span>
    </div>
  );
};

const userHasElaboradorPOARole = (user, poaRoles = []) => {
  const directRoles = [
    ...(Array.isArray(poaRoles) ? poaRoles : []),
    ...(Array.isArray(user?.poaRoles) ? user.poaRoles : []),
    ...(Array.isArray(user?.poa_roles) ? user.poa_roles : []),
    ...(Array.isArray(user?.roles_poa) ? user.roles_poa : []),
    user?.rol_poa,
    user?.poa_rol,
  ].filter(Boolean);

  const accessLists = [
    user?.accesos_poa,
    user?.usuarios_poa,
    user?.poa_accesos,
  ].filter(Array.isArray);

  return (
    directRoles.includes('elaborador') ||
    accessLists.some((items) => items.some((item) => item?.rol === 'elaborador' && item?.activo !== false))
  );
};

const YearWheelPicker = ({ value, onChange, disabled = false, compact = false }) => {
  const viewportRef = useRef(null);
  const wheelDeltaAccumRef = useRef(0);
  const wheelLastStepAtRef = useRef(0);
  const wheelIdleResetTimerRef = useRef(null);
  const isExpanded = !compact;
  const visibleCount = compact ? 1 : 5;
  const itemHeight = 44;
  const minYear = MIN_GESTION_YEAR;
  const maxYear = getMaxGestionYear();
  const centerOffset = Math.floor(visibleCount / 2);
  const wheelHeight = visibleCount * itemHeight;

  const years = useMemo(() => {
    const list = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const rawValue = String(value ?? '').trim();
  const numericValue = rawValue && /^[0-9]+$/.test(rawValue) ? Number(rawValue) : new Date().getFullYear();
  const selectedYear = Number.isFinite(numericValue)
    ? Math.max(minYear, Math.min(maxYear, numericValue))
    : new Date().getFullYear();
  const selectedIndex = years.findIndex((year) => year === selectedYear);
  const targetY = (centerOffset - selectedIndex) * itemHeight;

  const stepSelection = useCallback((steps) => {
    if (disabled || steps === 0) return;
    const nextIndex = Math.max(0, Math.min(years.length - 1, selectedIndex + steps));
    onChange(String(years[nextIndex]));
  }, [disabled, onChange, selectedIndex, years]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || disabled) return undefined;

    wheelDeltaAccumRef.current = 0;
    wheelLastStepAtRef.current = 0;

    const handleWheelNative = (event) => {
      event.preventDefault();

      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * wheelHeight
            : event.deltaY;

      if (event.deltaMode === 0 && Math.abs(normalizedDelta) < 8) return;

      wheelDeltaAccumRef.current += normalizedDelta;
      if (Math.abs(wheelDeltaAccumRef.current) < 48) return;

      const now = Date.now();
      if (now - wheelLastStepAtRef.current < 95) return;

      stepSelection(wheelDeltaAccumRef.current > 0 ? 1 : -1);
      wheelLastStepAtRef.current = now;
      wheelDeltaAccumRef.current = 0;

      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
      wheelIdleResetTimerRef.current = setTimeout(() => {
        wheelDeltaAccumRef.current = 0;
      }, 140);
    };

    node.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelNative);
  }, [disabled, stepSelection, wheelHeight]);

  useEffect(() => {
    return () => {
      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`relative w-56 rounded-xl border border-[#3D6DE0]/35 dark:border-[#4B67C0]/45 bg-white/70 dark:bg-slate-800/60 overflow-hidden transition-all duration-200 ease-out ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      style={{
        height: `${wheelHeight}px`,
        perspective: '1000px',
        perspectiveOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y-2 border-[#3D6DE0]/60 dark:border-[#6B86DE]/70 bg-gradient-to-r from-[#3D6DE0]/15 to-[#3D6DE0]/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-1px_0_0_rgba(255,255,255,0.25)]"
        style={{
          top: `${centerOffset * itemHeight}px`,
          height: `${itemHeight}px`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="tracking-wide font-extrabold text-[#1F3274] dark:text-white text-lg drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
            style={{ transform: 'scale(1.28)', opacity: 1, filter: 'brightness(1.1)' }}
          >
            {years[selectedIndex]}
          </span>
        </div>
      </div>

      {isExpanded && (
        <>
          <button
            type="button"
            className="absolute inset-x-0 top-0 z-20 cursor-pointer bg-transparent focus:outline-none focus:bg-[#3D6DE0]/10"
            style={{ height: `${centerOffset * itemHeight}px` }}
            onClick={() => stepSelection(-1)}
            disabled={disabled || selectedIndex === 0}
            aria-label="Seleccionar gestión superior"
            title="Seleccionar gestión superior"
          />
          <button
            type="button"
            className="absolute inset-x-0 bottom-0 z-20 cursor-pointer bg-transparent focus:outline-none focus:bg-[#3D6DE0]/10"
            style={{ height: `${centerOffset * itemHeight}px` }}
            onClick={() => stepSelection(1)}
            disabled={disabled || selectedIndex === years.length - 1}
            aria-label="Seleccionar gestión inferior"
            title="Seleccionar gestión inferior"
          />
        </>
      )}

      <div className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25 z-10 transition-all duration-200 ${isExpanded ? 'h-14 opacity-100' : 'h-0 opacity-0'}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25 z-10 transition-all duration-200 ${isExpanded ? 'h-14 opacity-100' : 'h-0 opacity-0'}`} />

      <div
        ref={viewportRef}
        className="relative h-full select-none overflow-hidden cursor-default"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (event.repeat || disabled) return;
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            stepSelection(-1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            stepSelection(1);
          }
        }}
      >
        <div
          className="flex flex-col transition-transform duration-200 ease-out"
          style={{ transform: `translateY(${targetY}px)`, willChange: 'transform' }}
        >
          {years.map((year, idx) => (
            <YearWheelItem
              key={year}
              year={year}
              distance={idx - selectedIndex}
              itemHeight={itemHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const GestionSelectorModal = ({ onClose, onSuccess, currentUser = null, poaRoles = [] }) => {
  const [loading, setLoading] = useState(true);
  const [errorMessages, setErrorMessages] = useState([]);
  const [manualYear, setManualYear] = useState('');
  const [noDocsForYear, setNoDocsForYear] = useState(false);
  const maxGestionYear = getMaxGestionYear();
  const canCreatePOADocument = userHasElaboradorPOARole(currentUser, poaRoles);

  useEffect(() => {
    const current = new Date().getFullYear();
    const initialYear = Math.max(MIN_GESTION_YEAR, Math.min(maxGestionYear, current));
    setManualYear(String(initialYear));
    setLoading(false);
  }, [maxGestionYear]);

  const handleIngresar = async () => {
    const yearToQuery = String(manualYear).trim();
    if (!yearToQuery) {
      setErrorMessages(['Gestión: seleccione o ingrese una gestión (año).']);
      return;
    }
    if (!/^[0-9]{4}$/.test(yearToQuery)) {
      setErrorMessages(['Gestión: ingrese un año válido (ej: 2025).']);
      return;
    }
    setErrorMessages([]);
    setLoading(true);
    setNoDocsForYear(false);
    try {
      const res = await getDocumentosPOAPorGestion(Number(yearToQuery));
      const docs = Array.isArray(res.data) ? res.data : (res.data.results || []);
      if (!docs || docs.length === 0) {
        setNoDocsForYear(yearToQuery);
        return;
      }
      if (onSuccess) onSuccess({ gestion: yearToQuery, documentos: docs });
      if (onClose) onClose();
    } catch (err) {
      setErrorMessages(formatApiErrors(err?.response?.data || err?.message || 'Error al consultar documentos'));
    } finally {
      setLoading(false);
    }
  };

  const handleAgregar = () => {
    if (!canCreatePOADocument) return;
    setShowNuevoModal(true);
  };

  const [showNuevoModal, setShowNuevoModal] = useState(false);

  const handleCancelarNoDocs = () => {
    setNoDocsForYear(false);
    setErrorMessages([]);
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-96">
        <div className="modal-header px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white text-lg font-semibold">Seleccionar gestión</h3>
              <p className="text-blue-100 text-sm mt-0.5">Seleccione la gestión (año) para filtrar documentos POA</p>
            </div>
            <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
          </div>
        </div>

        <div className="p-5 modal-body">
            {loading && <div className="mb-3 text-sm text-gray-600 dark:text-slate-400">Cargando...</div>}
          <ModalErrorAlert title="No se pudo procesar la gestión:" messages={errorMessages} />

            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Año</label>

            <div className="flex items-center justify-center">
              <YearWheelPicker
                value={manualYear}
                onChange={setManualYear}
                disabled={!!noDocsForYear}
                compact={!!noDocsForYear}
              />
            </div>
            {!noDocsForYear && (
              <div className="mt-6 flex items-center justify-center gap-3 modal-actions">
                <IconButton onClick={() => onClose && onClose()} className="btn-cancel px-3 py-2 rounded-md" title="Cancelar">Cancelar</IconButton>
                <IconButton onClick={handleIngresar} disabled={loading} className="btn-primary px-3 py-2 rounded-md disabled:opacity-60" title={loading ? 'Buscando...' : 'Ingresar'}>{loading ? 'Buscando...' : 'Ingresar'}</IconButton>
              </div>
            )}

            {noDocsForYear && (
              <div className="no-docs-card mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">No se encontraron documentos para la gestión <strong>{noDocsForYear}</strong>.</p>

                {canCreatePOADocument ? (
                  <p className="text-sm text-gray-700 dark:text-slate-300 mt-2">¿Desea crear un nuevo documento para esta gestión?</p>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-slate-300 mt-2">No tiene permisos para crear un nuevo documento en esta gestión.</p>
                )}

                <div className="mt-3 flex gap-2 justify-end modal-actions">
                  <IconButton onClick={handleCancelarNoDocs} className="btn-cancel px-3 py-2 rounded-md" title="Cancelar">Cancelar</IconButton>
                  {canCreatePOADocument && (
                    <IconButton onClick={handleAgregar} className="btn-success px-3 py-2 rounded-md" title="Nuevo">Nuevo</IconButton>
                  )}
                </div>
              </div>
            )}
            {showNuevoModal && createPortal(
              (
                <div className="fixed inset-0 z-[70]">
                  <NuevoDocumentoModal
                    currentUser={currentUser}
                    initialGestion={noDocsForYear || manualYear}
                    onClose={() => setShowNuevoModal(false)}
                    onCreated={(created) => {
                      const year = noDocsForYear || manualYear;
                      if (onSuccess) onSuccess({ gestion: year });
                      if (onClose) onClose();
                    }}
                  />
                </div>
              ),
              document.body
            )}
        </div>
      </div>
    </Modal>
  );
};

export default GestionSelectorModal;
