import React, { useEffect, useState } from 'react';
import { createDireccion, updateDireccion } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';

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
      // El backend suele usar el campo 'nombre' para la dirección; enviamos 'nombre' y
      // soportamos objetos que lleguen con 'nombre' o 'descripcion'.
      if (direccion && direccion.id) {
        const payload = { nombre: descripcion.trim() };
        const res = await updateDireccion(direccion.id, payload);
        // onUpdated espera el objeto actualizado; algunos endpoints devuelven el objeto
        // en res.data, otros no, por eso hay una fallback.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative z-20 w-full max-w-lg modal-panel card-elegant oe-modern rounded-xl overflow-hidden">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="text-lg font-semibold">{direccion ? 'Editar Dirección' : 'Nueva Dirección'}</h3>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Nombre de la dirección</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Ej: Dirección de Sistemas"
            />
            <div className="flex justify-end gap-2 modal-actions">
              <IconButton icon={<FaTimes />} onClick={onClose} className="bg-gray-200 px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white" title={saving ? 'Guardando...' : 'Guardar'}>{saving ? 'Guardando...' : 'Guardar'}</IconButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NuevaDireccionModal;
