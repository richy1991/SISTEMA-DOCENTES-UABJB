import React, { useEffect, useState } from 'react';
import { createPersona, updatePersona } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';

const NuevaPersonaModal = ({ onClose, persona: personaToEdit, onCreated, onUpdated }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [form, setForm] = useState({ nombre: '', cargo: '', email: '', telefono: '', user: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!personaToEdit) return;
    try {
      setForm({
        nombre: personaToEdit.nombre || personaToEdit.name || '',
        cargo: personaToEdit.cargo || personaToEdit.puesto || '',
        email: personaToEdit.email || personaToEdit.correo || '',
        telefono: personaToEdit.telefono || personaToEdit.phone || '',
        user: personaToEdit.user?.username || personaToEdit.user || '',
      });
    } catch (e) { /* ignore */ }
  }, [personaToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setError(null);
    if (!form.nombre || form.nombre.trim() === '') {
      setError('El nombre es obligatorio');
      return;
    }
    setLoading(true);
    try {
      // Construir payload. Asumimos que el backend acepta 'user' como username o 'user_id' si se envía número.
      const payload = {
        nombre: form.nombre.trim(),
        cargo: form.cargo?.trim() || null,
        email: form.email?.trim() || null,
        telefono: form.telefono?.trim() || null,
      };
      if (form.user && String(form.user).trim() !== '') {
        const maybeNum = Number(String(form.user).trim());
        if (!Number.isNaN(maybeNum) && Number.isFinite(maybeNum)) {
          payload.user_id = Number(maybeNum);
        } else {
          // enviar como username en campo `user` (si el backend lo interpreta)
          payload.user = String(form.user).trim();
        }
      }

      if (personaToEdit && personaToEdit.id) {
        const res = await updatePersona(personaToEdit.id, payload);
        toast.success('Persona actualizada');
        if (onUpdated) onUpdated(res?.data || res);
        if (onClose) onClose();
      } else {
        const res = await createPersona(payload);
        // En algunos backends puede devolver 201 sin body; enviamos el objeto devuelto al callback
        const created = res?.data || res;
        toast.success('Persona creada');
        if (onCreated) onCreated(created);
        if (onClose) onClose();
      }
    } catch (err) {
      console.error('Error guardando persona', err);
      const data = err?.response?.data;
      if (data) {
        setError(typeof data === 'string' ? data : JSON.stringify(data));
        toast.error(data.detail || (typeof data === 'string' ? data : 'Error al guardar persona'));
      } else {
        setError(err?.message || 'Error al guardar persona');
        toast.error(err?.message || 'Error al guardar persona');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div className="relative z-20 w-full max-w-2xl modal-panel card-elegant oe-modern rounded-xl overflow-hidden" style={{transform:'none'}}>
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="font-semibold">{personaToEdit ? 'Editar Persona' : 'Nueva Persona'}</div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="px-8 py-6 modal-body">
          {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-sm">{JSON.stringify(error)}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{color:'inherit'}}>Nombre <span className="text-red-500">*</span></label>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre completo" className="modal-input block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1" style={{color:'inherit'}}>Cargo / Rol</label>
              <input name="cargo" value={form.cargo} onChange={handleChange} placeholder="Cargo o rol en el proyecto" className="modal-input block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{color:'inherit'}}>Email</label>
                <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="correo@ejemplo.com" className="modal-input block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{color:'inherit'}}>Teléfono</label>
                <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="Ej: 70012345" className="modal-input block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1" style={{color:'inherit'}}>Vincular a usuario</label>
              <input name="user" value={form.user} onChange={handleChange} placeholder="username o id numérico" className="modal-input block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <p className="text-xs text-gray-500 mt-1">Número = user_id; texto = username (según backend).</p>
            </div>

            <div className="flex justify-end gap-3 pt-2 modal-actions">
              <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium" title={loading ? 'Guardando...' : (personaToEdit ? 'Guardar cambios' : 'Crear persona')}>{loading ? 'Guardando...' : (personaToEdit ? 'Guardar cambios' : 'Crear persona')}</IconButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NuevaPersonaModal;
