import React, { useState, useEffect } from 'react';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { createCatalogoItem, updateCatalogoItem } from '../../../apis/poa.api';
import toast from 'react-hot-toast';

const NuevoCatalogoItemModal = ({ partida, item, onClose, onCreated, onUpdated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    descripcion: '',
    unidad_medida: '',
    codigo: '',
  });

  useEffect(() => {
    if (item && typeof item === 'object') {
      setForm({
        descripcion: item.descripcion ?? item.nombre ?? item.titulo ?? '',
        unidad_medida: item.unidad_medida ?? item.unidad ?? item.uom ?? '',
        codigo: item.codigo ?? '',
      });
    } else if (partida) {
      setForm(prev => ({ ...prev, unidad_medida: partida.unidad_medida || partida.unidad || prev.unidad_medida }));
    }
  }, [item, partida]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!String(form.descripcion || '').trim()) {
      setFieldErrors({ descripcion: 'Requerido' });
      return;
    }

    const payload = {
      descripcion: form.descripcion.trim(),
      unidad_medida: form.unidad_medida || null,
      codigo: form.codigo || undefined,
    };
    if (partida) {
      if (partida.id !== undefined) payload.partida_id = Number(partida.id);
      if (partida.codigo !== undefined) payload.partida = partida.codigo;
    }

    setSubmitting(true);
    try {
      if (item && item.id) {
        const res = await updateCatalogoItem(item.id, payload);
        toast.success('Item actualizado');
        if (onUpdated) onUpdated(res.data || res);
        if (onClose) onClose();
      } else {
        const res = await createCatalogoItem(payload);
        toast.success('Item creado');
        if (onCreated) onCreated(res.data || res);
        if (onClose) onClose();
      }
    } catch (err) {
      const resp = err?.response?.data;
      if (resp && typeof resp === 'object') {
        const newFieldErrors = {};
        for (const k of Object.keys(resp)) {
          if (Array.isArray(resp[k])) newFieldErrors[k] = String(resp[k].join(' '));
          else newFieldErrors[k] = String(resp[k]);
        }
        setFieldErrors(newFieldErrors);
        toast.error('Error validando campos');
      } else {
        const msg = err?.message || String(err);
        setError(String(msg));
        toast.error(String(msg));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative z-20 w-full max-w-md modal-panel card-elegant oe-modern rounded-xl overflow-hidden">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">{item ? 'Editar ítem de catálogo' : 'Nuevo ítem de catálogo'}</h3>
          <IconButton onClick={onClose} className="bg-transparent text-white hover:bg-white/10" ariaLabel="Cerrar">
            <FaTimes />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 modal-body">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div>
            <label className="block text-sm text-gray-700">Descripción</label>
            <input
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              className={`w-full border rounded px-2 py-1 ${fieldErrors.descripcion ? 'border-red-600' : ''}`}
            />
            {fieldErrors.descripcion && <div className="text-sm text-red-600 mt-1">{fieldErrors.descripcion}</div>}
          </div>

          <div>
            <label className="block text-sm text-gray-700">Unidad de medida</label>
            <input name="unidad_medida" value={form.unidad_medida} onChange={handleChange} className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Código (opcional)</label>
            <input name="codigo" value={form.codigo} onChange={handleChange} className="w-full border rounded px-2 py-1" />
          </div>

          <div className="flex justify-end gap-2 modal-actions">
            <button type="button" onClick={onClose} className="px-3 py-1 rounded border bg-white">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-1 rounded bg-emerald-600 text-white">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NuevoCatalogoItemModal;
