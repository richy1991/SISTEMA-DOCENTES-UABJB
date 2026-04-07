import React, { useState, useEffect, useRef } from 'react';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { createDetallePresupuesto, updateDetalle, getItemsCatalogo } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import { Input, Select, Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const NuevoPresupuestoModal = ({ actividadId, documentoId, detalle, onClose, onCreated, onUpdated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    item: '',
    unidad_medida: '',
    caracteristicas: '',
    partida: '',
    cantidad: '',
    costo_unitario: '',
    mes_requerimiento: '',
    tipo: 'funcionamiento',
  });

  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [itemQuery, setItemQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (detalle && typeof detalle === 'object') {
      setForm({
        item: detalle.item ?? '',
        unidad_medida: detalle.unidad_medida ?? '',
        caracteristicas: detalle.caracteristicas ?? '',
        partida: detalle.partida ?? '',
        cantidad: detalle.cantidad ?? '',
        costo_unitario: detalle.costo_unitario ?? '',
        mes_requerimiento: detalle.mes_requerimiento ?? '',
        tipo: detalle.tipo ?? 'funcionamiento',
      });
      setItemQuery(detalle.item ?? '');
    }
  }, [detalle]);

  useEffect(() => {
    if (!showDropdown || !String(itemQuery).trim()) {
      setCatalogItems([]);
      setCatalogLoading(false);
      setCatalogError(null);
      return undefined;
    }

    let active = true;
    setCatalogLoading(true);
    setCatalogError(null);

    const timer = setTimeout(() => {
      getItemsCatalogo({ search: itemQuery.trim() })
        .then(res => {
          if (!active) return;
          const data = res?.data ?? [];
          const list = Array.isArray(data)
            ? data
            : (Array.isArray(data.results) ? data.results : []);
          setCatalogItems(list);
        })
        .catch(() => {
          if (!active) return;
          setCatalogError('No se pudo cargar el catálogo de ítems');
          setCatalogItems([]);
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [itemQuery, showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'item') {
      setItemQuery(value);
      setShowDropdown(true);
    }
  };

  const filteredItems = (catalogItems || []).filter((it) => {
    if (!itemQuery) return true;
    const q = String(itemQuery).toLowerCase();
    const descripcion = String(it.descripcion || it.nombre || it.nombre_item || it.codigo || '').toLowerCase();
    const partidaCodigo = String(it.partida?.codigo ?? it.partida ?? '').toLowerCase();
    return descripcion.includes(q) || partidaCodigo.includes(q);
  }).slice(0, 20);

  const handleSelectCatalogItem = (itemData) => {
    const descripcion = itemData.descripcion ?? itemData.nombre ?? itemData.nombre_item ?? itemData.codigo ?? '';
    const partidaCodigo = itemData.partida?.codigo ?? itemData.partida ?? itemData.codigo_partida ?? '';
    const unidadMedida = itemData.unidad_medida ?? itemData.unidad ?? '';
    setForm(prev => ({
      ...prev,
      item: descripcion,
      partida: partidaCodigo || prev.partida,
      unidad_medida: unidadMedida || prev.unidad_medida,
    }));
    setItemQuery(descripcion);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]);
    const errs = {};
    if (!actividadId) errs.actividad_id = 'Actividad desconocida';
    if (!form.item || String(form.item).trim() === '') errs.item = 'Requerido';
    if (!form.partida || String(form.partida).trim() === '') errs.partida = 'Requerido';
    if (!form.cantidad || String(form.cantidad).trim() === '') errs.cantidad = 'Requerido';
    if (!form.costo_unitario || String(form.costo_unitario).trim() === '') errs.costo_unitario = 'Requerido';
    if (!form.mes_requerimiento || String(form.mes_requerimiento).trim() === '') errs.mes_requerimiento = 'Requerido';
    if (!form.tipo || String(form.tipo).trim() === '') errs.tipo = 'Requerido';

    if (!errs.cantidad) {
      const n = Number(form.cantidad);
      if (!Number.isFinite(n) || !Number.isInteger(n)) errs.cantidad = 'La cantidad debe ser un entero';
      if (n < 0) errs.cantidad = 'La cantidad debe ser >= 0';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setErrorMessages(buildClientErrorMessages(errs));
      return;
    }

    const payload = {
      actividad_id: Number(actividadId),
      partida: form.partida,
      item: form.item,
      unidad_medida: form.unidad_medida || null,
      caracteristicas: form.caracteristicas || null,
      cantidad: Number.parseInt(String(form.cantidad), 10),
      costo_unitario: Number(form.costo_unitario) || 0,
      mes_requerimiento: form.mes_requerimiento,
      tipo: form.tipo,
    };
    if (documentoId) payload.documento_id = Number(documentoId);

    setSubmitting(true);
    setErrorMessages([]);
    try {
      if (detalle && detalle.id) {
        const res = await updateDetalle(detalle.id, payload);
        const updated = res.data || res;
        if (onUpdated) onUpdated(updated);
        if (onClose) onClose();
      } else {
        const res = await createDetallePresupuesto(payload);
        if (onCreated) onCreated(res.data || res?.data || payload);
        toast.success('Ítem de presupuesto creado');
        if (onClose) onClose();
      }
    } catch (err) {
      const resp = err?.response?.data;
      if (resp && typeof resp === 'object') {
        const newFieldErrors = mapApiErrorsToFieldErrors(resp);
        setFieldErrors(newFieldErrors);
        const messages = formatApiErrors(resp);
        setErrorMessages(messages);
        toast.error(messages[0] || 'Error validando campos. Revisa el formulario.');
      } else {
        const messages = formatApiErrors(resp || err?.message || 'Error al guardar ítem');
        setErrorMessages(messages);
        toast.error(messages[0] || 'Error al guardar ítem');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-full max-w-lg">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">{detalle ? 'Editar ítem de presupuesto' : 'Nuevo ítem de presupuesto'}</h3>
          <IconButton onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" ariaLabel="Cerrar">
            <FaTimes />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} ref={containerRef} className="p-4 space-y-4 modal-body">
          <ModalErrorAlert title="No se pudo guardar el presupuesto:" messages={errorMessages} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Ítem / Detalle</label>
            <div className="relative">
              <input
                name="item"
                value={form.item}
                onChange={handleChange}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
                className={`poa-input w-full px-2 py-1 ${fieldErrors.item ? 'error' : ''}`}
                placeholder={catalogLoading ? 'Cargando ítems...' : 'Buscar ítem del catálogo o escribir libremente'}
              />
              {showDropdown && filteredItems.length > 0 && (
                <div className="absolute z-30 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 mt-1 rounded max-h-56 overflow-auto shadow-lg">
                  {catalogLoading && <div className="p-2 text-sm text-gray-600 dark:text-slate-400">Cargando...</div>}
                  {catalogError && <div className="p-2 text-sm text-red-600 dark:text-red-400">{catalogError}</div>}
                  {!catalogLoading && !catalogError && filteredItems.map(it => (
                    <button
                      key={it.id ?? it.codigo ?? it.descripcion}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectCatalogItem(it); }}
                      className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-slate-100"
                    >
                      <div className="font-medium">{it.descripcion ?? it.nombre ?? it.nombre_item ?? it.codigo}</div>
                      {it.partida && <div className="text-xs text-gray-500 dark:text-slate-400">Partida: {it.partida.codigo ?? it.partida}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {fieldErrors.item && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.item}</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Unidad de medida"
                name="unidad_medida"
                value={form.unidad_medida}
                onChange={handleChange}
                autoComplete="off"
                error={fieldErrors.unidad_medida}
              />
              {fieldErrors.unidad_medida && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.unidad_medida}</div>}
            </div>
            <div>
              <Input
                label="Partida"
                name="partida"
                value={form.partida}
                onChange={handleChange}
                autoComplete="off"
                error={fieldErrors.partida}
              />
              {fieldErrors.partida && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.partida}</div>}
            </div>
          </div>

          <div>
            <Input
              label="Características"
              name="caracteristicas"
              value={form.caracteristicas}
              onChange={handleChange}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Cantidad"
                name="cantidad"
                type="number"
                min="0"
                step="1"
                value={form.cantidad}
                onChange={handleChange}
                autoComplete="off"
                error={fieldErrors.cantidad}
              />
              {fieldErrors.cantidad && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.cantidad}</div>}
            </div>
            <div>
              <Input
                label="Costo unitario"
                name="costo_unitario"
                type="number"
                step="any"
                value={form.costo_unitario}
                onChange={handleChange}
                autoComplete="off"
                error={fieldErrors.costo_unitario}
              />
              {fieldErrors.costo_unitario && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.costo_unitario}</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Mes de requerimiento"
                name="mes_requerimiento"
                value={form.mes_requerimiento}
                onChange={handleChange}
                error={fieldErrors.mes_requerimiento}
              />
              {fieldErrors.mes_requerimiento && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.mes_requerimiento}</div>}
            </div>

            <div>
              <Select
                label="Tipo"
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                error={fieldErrors.tipo}
              >
                <option value="funcionamiento">Funcionamiento</option>
                <option value="inversion">Inversión</option>
              </Select>
              {fieldErrors.tipo && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.tipo}</div>}
            </div>
          </div>

          <div className="flex justify-end gap-3 modal-actions">
            <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-cancel border px-3 py-2 rounded" title="Cancelar">
              Cancelar
            </IconButton>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded btn-success">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default NuevoPresupuestoModal;
