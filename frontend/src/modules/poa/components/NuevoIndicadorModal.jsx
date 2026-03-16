import React, { useEffect, useState } from 'react';
import { createCatalogoOperacion, updateCatalogoOperacion } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';
import { Input, Textarea, Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, ModalErrorAlert } from './formErrorUtils';

const NuevoIndicadorModal = ({ onClose, direccion, operacion: operacionProp }) => {
  const [servicio, setServicio] = useState('');
  const [proceso, setProceso] = useState('');
  const [operacion, setOperacion] = useState('');
  const [productoIntermedio, setProductoIntermedio] = useState('');
  const [indicador, setIndicador] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);

  useEffect(() => {
    setServicio(''); setProceso(''); setOperacion(''); setProductoIntermedio(''); setIndicador('');
    setErrorMessages([]);
    if (operacionProp) {
      setServicio(operacionProp.servicio || operacionProp.unidad || '');
      setProceso(operacionProp.proceso || operacionProp.proceso_nombre || '');
      setOperacion(operacionProp.nombre || operacionProp.operacion || '');
      setProductoIntermedio(operacionProp.producto_intermedio || operacionProp.producto || '');
      setIndicador(operacionProp.indicador || operacionProp.indicador_nombre || '');
    }
  }, [direccion, operacionProp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clientErrors = {};
    setErrorMessages([]);
    if (!operacion || operacion.trim() === '') clientErrors.operacion = 'Ingrese el nombre de la operación.';
    if (!direccion || !direccion.id) clientErrors.detail = 'No hay dirección seleccionada.';
    if (Object.keys(clientErrors).length > 0) {
      const messages = buildClientErrorMessages(clientErrors);
      setErrorMessages(messages);
      toast.error(messages[0]);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        direccion_id: Number(direccion.id),
        servicio: servicio ? servicio.trim() : undefined,
        proceso: proceso ? proceso.trim() : undefined,
        operacion: operacion.trim(),
        producto_intermedio: productoIntermedio ? productoIntermedio.trim() : undefined,
        indicador: indicador ? indicador.trim() : undefined,
      };
      console.debug('Crear/Actualizar operación payload:', payload);
      if (operacionProp && operacionProp.id) {
        const res = await updateCatalogoOperacion(operacionProp.id, payload);
        toast.success('Operación actualizada');
        try { window.dispatchEvent(new CustomEvent('operacion-creada', { detail: res.data })); } catch (er) { /* ignore */ }
      } else {
        const res = await createCatalogoOperacion(payload);
        toast.success('Operación creada');
        try { window.dispatchEvent(new CustomEvent('operacion-creada', { detail: res.data })); } catch (er) { /* ignore */ }
      }
      onClose && onClose();
    } catch (err) {
      console.error('Error al crear operación:', err);
      const messages = formatApiErrors(err?.response?.data || err?.message || 'Error al crear operación');
      setErrorMessages(messages);
      toast.error(messages[0] || 'Error al crear operación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-full max-w-2xl">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">{operacionProp ? 'Editar indicador' : 'Nuevo indicador'}</h3>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">
          <ModalErrorAlert title="No se pudo guardar el indicador:" messages={errorMessages} />
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Servicio"
                value={servicio}
                onChange={(e) => setServicio(e.target.value)}
              />

              <Input
                label="Proceso"
                value={proceso}
                onChange={(e) => setProceso(e.target.value)}
              />

              <Input
                label="Operación"
                value={operacion}
                onChange={(e) => setOperacion(e.target.value)}
              />

              <Input
                label="Producto intermedio (opcional)"
                value={productoIntermedio}
                onChange={(e) => setProductoIntermedio(e.target.value)}
              />

              <Textarea
                label="Indicador (opcional)"
                value={indicador}
                onChange={(e) => setIndicador(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4 modal-actions">
              <IconButton icon={<FaTimes />} onClick={onClose} className="btn-cancel px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={saving} className="btn-primary px-3 py-2 rounded" title={saving ? 'Guardando...' : (operacionProp ? 'Actualizar' : 'Guardar')}>
                {saving ? (operacionProp ? 'Actualizando...' : 'Guardando...') : (operacionProp ? 'Actualizar' : 'Guardar')}
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default NuevoIndicadorModal;
