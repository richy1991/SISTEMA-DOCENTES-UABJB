import React, { useState, useEffect, useRef } from 'react';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { createDetallePresupuesto, updateDetalle, getItemsCatalogo } from '../../../apis/poa.api';
import NuevoCatalogoItemModal from './NuevoCatalogoItemModal';
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
  const [hasSearchedItem, setHasSearchedItem] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [showNuevoCatalogoItemModal, setShowNuevoCatalogoItemModal] = useState(false);
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
      if (detalle.item) {
        setSelectedCatalogItem({
          id: detalle.id ? `detalle-${detalle.id}` : `detalle-${Date.now()}`,
          detalle: detalle.item,
          partida: detalle.partida ?? '',
          unidad_medida: detalle.unidad_medida ?? '',
        });
      }
    }
  }, [detalle]);

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
      setSelectedCatalogItem(null);
      setItemQuery(value);
      setCatalogItems([]);
      setCatalogError(null);
      setHasSearchedItem(false);
      setShowDropdown(false);
    }
  };

  const handleBuscarCatalogoItem = async () => {
    const query = String(form.item || '').trim();
    if (query.length < 2) {
      setCatalogItems([]);
      setCatalogError('Escribe al menos 2 caracteres para buscar.');
      setHasSearchedItem(true);
      setShowDropdown(true);
      return;
    }

    setCatalogLoading(true);
    setCatalogError(null);
    setHasSearchedItem(true);
    setShowDropdown(true);

    try {
      const res = await getItemsCatalogo({ q: query });
      const data = res?.data ?? [];
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data.results) ? data.results : []);
      setCatalogItems(list);
    } catch {
      setCatalogError('No se pudo cargar el catálogo de ítems');
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const filteredItems = (catalogItems || []).filter((it) => {
    if (!itemQuery) return true;
    const q = String(itemQuery).toLowerCase();
    const descripcion = String(it.detalle || it.descripcion || it.nombre || it.nombre_item || it.codigo || '').toLowerCase();
    const partidaCodigo = String(it.partida?.codigo ?? it.partida ?? '').toLowerCase();
    return descripcion.includes(q) || partidaCodigo.includes(q);
  }).slice(0, 20);

  const handleSelectCatalogItem = (itemData) => {
    const descripcion = itemData.detalle ?? itemData.descripcion ?? itemData.nombre ?? itemData.nombre_item ?? itemData.codigo ?? '';
    const partidaCodigo = itemData.partida?.codigo ?? itemData.partida ?? itemData.codigo_partida ?? '';
    const unidadMedida = itemData.unidad_medida ?? itemData.unidad ?? '';
    setForm(prev => ({
      ...prev,
      item: descripcion,
      partida: partidaCodigo || prev.partida,
      unidad_medida: unidadMedida || prev.unidad_medida,
    }));
    setSelectedCatalogItem(itemData);
    setItemQuery(descripcion);
    setShowDropdown(false);
  };

  const handleNuevoCatalogoItemCreado = (nuevoItem) => {
    if (!nuevoItem) return;
    handleSelectCatalogItem(nuevoItem);
    setShowNuevoCatalogoItemModal(false);
    toast.success('Item agregado al catálogo y seleccionado.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]);
    const errs = {};
    if (!actividadId) errs.actividad_id = 'Actividad desconocida';
    if (!form.item || String(form.item).trim() === '') {
      errs.item = 'Requerido';
    } else if (!selectedCatalogItem) {
      errs.item = 'Debes seleccionar un item desde el catálogo.';
    }
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
            <div className="relative flex items-center gap-2">
              <input
                name="item"
                value={form.item}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBuscarCatalogoItem();
                  }
                }}
                autoComplete="off"
                className={`poa-input w-full px-2 py-1 ${fieldErrors.item ? 'error' : ''}`}
                placeholder={catalogLoading ? 'Buscando ítems...' : 'Escribe el item y presiona Enter o Buscar'}
              />
              <button
                type="button"
                onClick={handleBuscarCatalogoItem}
                className="inline-flex items-center justify-center h-9 px-3 rounded bg-blue-600 text-white hover:bg-blue-700"
                title="Buscar item en catálogo"
              >
                Buscar
              </button>
              {showDropdown && filteredItems.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    Resultados encontrados: {filteredItems.length}
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {catalogLoading && <div className="p-3 text-sm text-gray-600 dark:text-slate-400">Cargando...</div>}
                    {catalogError && <div className="p-3 text-sm text-red-600 dark:text-red-400">{catalogError}</div>}
                    {!catalogLoading && !catalogError && filteredItems.map(it => (
                      <button
                        key={it.id ?? it.codigo ?? it.detalle ?? it.descripcion}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectCatalogItem(it); }}
                        className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700"
                      >
                        <div className="font-medium">{it.detalle ?? it.descripcion ?? it.nombre ?? it.nombre_item ?? it.codigo}</div>
                        {it.partida && <div className="text-xs text-gray-500 dark:text-slate-400">Partida: {it.partida.codigo ?? it.partida}</div>}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowDropdown(false);
                      }}
                      className="px-3 py-1.5 rounded bg-slate-200 text-slate-800 text-sm hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
              {showDropdown && hasSearchedItem && !catalogLoading && !catalogError && filteredItems.length === 0 && (
                <div className="absolute z-30 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 mt-1 rounded shadow-lg p-2">
                  <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">No se encontró el item en catálogo.</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowNuevoCatalogoItemModal(true);
                      }}
                      className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      + Agregar nuevo item
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowDropdown(false);
                      }}
                      className="px-3 py-1.5 rounded bg-slate-200 text-slate-800 text-sm hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    >
                      Ninguno de estos / Cerrar
                    </button>
                  </div>
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
                disabled
                error={fieldErrors.partida}
              />
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">La partida se autocompleta desde el item seleccionado.</div>
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

      {showNuevoCatalogoItemModal && (
        <NuevoCatalogoItemModal
          partida={null}
          item={{
            detalle: itemQuery || '',
            partida: form.partida || '',
            unidad_medida: form.unidad_medida || '',
          }}
          onClose={() => setShowNuevoCatalogoItemModal(false)}
          onCreated={handleNuevoCatalogoItemCreado}
          onUpdated={handleNuevoCatalogoItemCreado}
        />
      )}
    </Modal>
  );
};

export default NuevoPresupuestoModal;
