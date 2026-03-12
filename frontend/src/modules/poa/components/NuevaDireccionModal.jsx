import React, { useEffect, useState } from 'react';
import { createDireccion, updateDireccion } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';
import { Input, Modal } from './base';

const NuevaDireccionModal = ({ onClose, direccion, onCreated, onUpdated }) => {
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (direccion) setDescripcion(direccion.nombre || direccion.descripcion || direccion.direccion || direccion.nombre_completo || '');
    else setDescripcion('');
  }, [direccion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!descripcion || descripcion.trim() === '') return toast.error('Ingrese el nombre de la dirección');
    setSaving(true);
    try {
      if (direccion && direccion.id) {
        const payload = { nombre: descripcion.trim() };
        const res = await updateDireccion(direccion.id, payload);
        onUpdated && onUpdated(res.data || { ...direccion, nombre: descripcion.trim(), descripcion: descripcion.trim() });
        toast.success('Dirección actualizada');
      } else {
        const payload = { nombre: descripcion.trim() };
        const res = await createDireccion(payload);
        onCreated && onCreated(res.data);
        toast.success('Dirección creada');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-full max-w-lg">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="text-lg font-semibold">{direccion ? 'Editar Dirección' : 'Nueva Dirección'}</h3>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nombre de la dirección"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Dirección de Sistemas"
            />
            <div className="flex justify-end gap-2 modal-actions">
              <IconButton icon={<FaTimes />} onClick={onClose} className="btn-cancel px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={saving} className="btn-primary px-3 py-2 rounded" title={saving ? 'Guardando...' : 'Guardar'}>
                {saving ? 'Guardando...' : 'Guardar'}
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default NuevaDireccionModal;
