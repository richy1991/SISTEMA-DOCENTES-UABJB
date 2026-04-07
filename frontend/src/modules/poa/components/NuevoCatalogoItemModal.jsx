import React, { useState, useEffect } from 'react';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { createCatalogoItem, updateCatalogoItem } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import { Input, Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const NuevoCatalogoItemModal = ({ partida, item, onClose, onCreated, onUpdated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
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
    setErrorMessages([]);
    setFieldErrors({});
    if (!String(form.descripcion || '').trim()) {
      const nextFieldErrors = { descripcion: 'Requerido.' };
      setFieldErrors(nextFieldErrors);
      setErrorMessages(buildClientErrorMessages(nextFieldErrors));
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
        const newFieldErrors = mapApiErrorsToFieldErrors(resp);
        setFieldErrors(newFieldErrors);
        const messages = formatApiErrors(resp);
        setErrorMessages(messages);
        toast.error(messages[0] || 'Error validando campos');
      } else {
        const messages = formatApiErrors(err?.message || String(err));
        setErrorMessages(messages);
        toast.error(messages[0] || 'Error al guardar');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-full max-w-md">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">{item ? 'Editar ítem de catálogo' : 'Nuevo ítem de catálogo'}</h3>
          <IconButton onClick={onClose} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" ariaLabel="Cerrar">
            <FaTimes />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 modal-body">
          <ModalErrorAlert title="No se pudo guardar el ítem de catálogo:" messages={errorMessages} />
          <div>
            <Input
              label="Descripción"
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              error={fieldErrors.descripcion}
            />
            {fieldErrors.descripcion && <div className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.descripcion}</div>}
          </div>

          <div>
            <Input
              label="Unidad de medida"
              name="unidad_medida"
              value={form.unidad_medida}
              onChange={handleChange}
            />
          </div>

          <div>
            <Input
              label="Código (opcional)"
              name="codigo"
              value={form.codigo}
              onChange={handleChange}
            />
          </div>

          <div className="flex justify-end gap-2 modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel px-3 py-1 rounded border">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-success px-4 py-1 rounded">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default NuevoCatalogoItemModal;
