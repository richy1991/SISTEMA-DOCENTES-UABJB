import React, { useState, useEffect, useRef } from 'react';
import { createObjetivoEspecifico, updateObjetivo } from '../../../apis/poa.api';
import IconButton from './IconButton';
import { FaTimes, FaFileImport, FaSave } from 'react-icons/fa';
import toast from 'react-hot-toast';

const NuevoObjetivoModal = ({ onClose, onCreated, documentoId, objetivo, existingObjetivos = [], onUpdated, onImport }) => {
  const isEdit = Boolean(objetivo && objetivo.id !== undefined);
  // Cuando es creación, por defecto mostrar 'OE-' dentro del textbox para facilitar ingresar sólo el número
  const defaultCodigo = isEdit ? (objetivo?.codigo || '') : 'OE-';
  const [codigo, setCodigo] = useState(defaultCodigo);
  const [descripcion, setDescripcion] = useState(objetivo?.descripcion || '');
  const codigoRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Si recibimos un objetivo (modo edición) actualizamos los campos.
    // Si no (modo creación), no sobreescribimos el valor por defecto de `codigo` (OE-).
    if (objetivo) {
      setCodigo(objetivo?.codigo || '');
      setDescripcion(objetivo?.descripcion || '');
    } else {
      // creación: dejar codigo con el valor por defecto (OE-) y limpiar descripción
      setDescripcion('');
    }
    setError(null);
  }, [objetivo]);

  useEffect(() => {
    // En creación, enfocamos el input y colocamos el caret al final para que el usuario escriba el número inmediatamente
    if (!isEdit && codigoRef.current) {
      const el = codigoRef.current;
      try {
        el.focus();
        const length = el.value ? el.value.length : 0;
        if (el.setSelectionRange) {
          el.setSelectionRange(length, length);
        } else if (el.createTextRange) {
          const range = el.createTextRange();
          range.collapse(true);
          range.moveEnd('character', length);
          range.moveStart('character', length);
          range.select();
        }
      } catch (e) {
        // fallthrough silencioso
      }
    }
  }, [isEdit]);

  const handleCreate = async (e) => {
    e && e.preventDefault && e.preventDefault();
  setError(null);
  if (!descripcion) return setError('La descripción es obligatoria');

  // Client-side uniqueness validation within the same documento
  const nameLower = (descripcion || '').trim().toLowerCase();
  const codeLower = (codigo || '').trim().toLowerCase();
  const duplicateName = existingObjetivos.find(o => String(o.descripcion || o.nombre || '').trim().toLowerCase() === nameLower && (!isEdit || Number(o.id) !== Number(objetivo.id)));
  if (duplicateName) return setError('Ya existe un objetivo con la misma descripción en este documento.');
  const duplicateCode = existingObjetivos.find(o => String(o.codigo || '').trim().toLowerCase() === codeLower && codeLower !== '' && (!isEdit || Number(o.id) !== Number(objetivo.id)));
  if (duplicateCode) {
    setError('Ya existe un objetivo con el mismo código en este documento.');
    toast.error('Ya existe un objetivo con el mismo código en este documento.');
    return;
  }
    setLoading(true);
    try {
      const payload = {
        documento_id: Number(documentoId),
  // Si el usuario dejó el placeholder intacto ('OE-'), enviar cadena vacía para que el backend decida
  codigo: (codigo === 'OE-') ? '' : (codigo || ''),
        descripcion,
      };
      if (isEdit) {
        const res = await updateObjetivo(objetivo.id, payload);
        if (onUpdated) onUpdated(res.data);
      } else {
        const res = await createObjetivoEspecifico(payload);
        if (onCreated) onCreated(res.data);
      }
      // notificar éxito
      if (isEdit) toast.success('Objetivo actualizado');
      else toast.success('Objetivo creado');
      if (onClose) onClose();
    } catch (err) {
      const msg = err?.response?.data || err.message || 'Error al guardar objetivo';
      setError(msg);
      // mostrar toast con mensaje legible
      try {
        if (typeof msg === 'string') toast.error(msg);
        else toast.error(JSON.stringify(msg));
      } catch (e) {
        toast.error('Error al guardar objetivo');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    // Placeholder: si se pasa `onImport` desde el padre, llamarlo.
    if (onImport) return onImport();
    // Por ahora sólo focus en el campo codigo como feedback simple
    // (En el futuro se puede abrir un modal de importación o leer un archivo)
    const el = document.querySelector('input[name="codigo-input"]');
    if (el) el.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative z-20 w-11/12 max-w-lg modal-panel card-elegant oe-modern rounded-xl overflow-hidden">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="font-semibold text-lg">{isEdit ? 'Editar Objetivo Específico' : 'Nuevo Objetivo Específico'}</div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">

          {error && <div className="text-red-600 mb-3">{String(error)}</div>}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Código</label>
              <div className="mt-1 flex items-center gap-2">
                <input ref={codigoRef} name="codigo-input" value={codigo} onChange={e => setCodigo(e.target.value)} className="block w-full border rounded px-3 py-2" />
                <IconButton icon={<FaFileImport />} onClick={handleImport} className="border px-3 py-2 rounded bg-gray-100 text-sm" title="Importar">Importar</IconButton>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" rows={4} />
            </div>

            <div className="flex justify-end gap-3 modal-actions">
              <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="border px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={loading} className="bg-blue-600 text-white px-3 py-2 rounded" title={loading ? 'Guardando...' : (isEdit ? 'Guardar' : 'Crear')}>{loading ? 'Guardando...' : (isEdit ? 'Guardar' : 'Crear')}</IconButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NuevoObjetivoModal;
