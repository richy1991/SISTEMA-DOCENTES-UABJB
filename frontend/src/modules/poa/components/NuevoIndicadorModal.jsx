import React, { useEffect, useState } from 'react';
import { createCatalogoOperacion, updateCatalogoOperacion } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';

const NuevoIndicadorModal = ({ onClose, direccion, operacion: operacionProp }) => {
  const [servicio, setServicio] = useState('');
  const [proceso, setProceso] = useState('');
  const [operacion, setOperacion] = useState('');
  const [productoIntermedio, setProductoIntermedio] = useState('');
  const [indicador, setIndicador] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // limpiar al abrir
    setServicio(''); setProceso(''); setOperacion(''); setProductoIntermedio(''); setIndicador('');
    // Si nos pasan una operación (modo edición), precargar valores
    if (operacionProp) {
      setServicio(operacionProp.servicio || operacionProp.unidad || '');
      setProceso(operacionProp.proceso || operacionProp.proceso_nombre || '');
      // operacion/nombre
      setOperacion(operacionProp.nombre || operacionProp.operacion || '');
      setProductoIntermedio(operacionProp.producto_intermedio || operacionProp.producto || '');
      setIndicador(operacionProp.indicador || operacionProp.indicador_nombre || '');
    }
  }, [direccion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operacion || operacion.trim() === '') return toast.error('Ingrese el nombre de la operación');
    if (!direccion || !direccion.id) return toast.error('No hay dirección seleccionada');
    setSaving(true);
    try {
      // El backend devuelve y muestra el campo `nombre` para la operación.
      // Enviar `nombre` en lugar de `operacion` para que la tabla lo muestre correctamente.
      const payload = {
        direccion_id: Number(direccion.id),
        servicio: servicio ? servicio.trim() : undefined,
        proceso: proceso ? proceso.trim() : undefined,
        operacion: operacion.trim(),
        producto_intermedio: productoIntermedio ? productoIntermedio.trim() : undefined,
        indicador: indicador ? indicador.trim() : undefined,
      };
  // Log payload para depuración rápida en consola
  // (puedes borrar este console.log una vez confirmes que el backend acepta los campos)
      console.debug('Crear/Actualizar operación payload:', payload);
      if (operacionProp && operacionProp.id) {
        // editar
        const res = await updateCatalogoOperacion(operacionProp.id, payload);
        toast.success('Operación actualizada');
        try { window.dispatchEvent(new CustomEvent('operacion-creada', { detail: res.data })); } catch (er) { /* ignore */ }
      } else {
        // crear
        const res = await createCatalogoOperacion(payload);
        toast.success('Operación creada');
        try { window.dispatchEvent(new CustomEvent('operacion-creada', { detail: res.data })); } catch (er) { /* ignore */ }
      }
      onClose && onClose();
    } catch (err) {
      console.error('Error al crear operación:', err);
      const data = err?.response?.data;
      // Mostrar errores de validación detallados si el backend los proporciona
      if (data) {
        let message = '';
        if (typeof data === 'string') {
          message = data;
        } else if (data.detail) {
          // detail puede ser string o arreglo/obj
          message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else {
          // eslint-disable-next-line no-unused-vars
          const parts = Object.entries(data).map(([k, v]) => {
            const val = Array.isArray(v) ? v.join('; ') : (typeof v === 'object' ? JSON.stringify(v) : String(v));
            return `${k}: ${val}`;
          });
          message = parts.join(' | ');
        }
        toast.error(message || 'Error al crear operación');
      } else {
        toast.error('Error al crear operación');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative z-20 w-full max-w-2xl modal-panel card-elegant oe-modern rounded-xl overflow-hidden">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">{operacionProp ? 'Editar indicador' : 'Nuevo indicador'}</h3>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3">
              <label className="block text-sm font-medium text-gray-700">Servicio</label>
              <input value={servicio} onChange={(e) => setServicio(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />

              <label className="block text-sm font-medium text-gray-700">Proceso</label>
              <input value={proceso} onChange={(e) => setProceso(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />

              <label className="block text-sm font-medium text-gray-700">Operación</label>
              <input value={operacion} onChange={(e) => setOperacion(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />

              <label className="block text-sm font-medium text-gray-700">Producto intermedio (opcional)</label>
              <input value={productoIntermedio} onChange={(e) => setProductoIntermedio(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />

              <label className="block text-sm font-medium text-gray-700">Indicador (opcional)</label>
              <textarea value={indicador} onChange={(e) => setIndicador(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" rows={3} />
            </div>

            <div className="flex justify-end gap-2 mt-4 modal-actions">
              <IconButton icon={<FaTimes />} onClick={onClose} className="bg-gray-200 px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white" title={saving ? 'Guardando...' : (operacionProp ? 'Actualizar' : 'Guardar')}>{saving ? (operacionProp ? 'Actualizando...' : 'Guardando...') : (operacionProp ? 'Actualizar' : 'Guardar')}</IconButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NuevoIndicadorModal;
