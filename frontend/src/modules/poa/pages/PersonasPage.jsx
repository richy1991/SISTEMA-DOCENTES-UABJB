import React, { useEffect, useState, useMemo } from 'react';
import { getAllPersonas, deletePersona } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import NuevaPersonaModal from '../components/NuevaPersonaModal';
import IconButton from '../components/IconButton';
import { FaEdit, FaTrash } from 'react-icons/fa';

const PersonasPage = () => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllPersonas();
      const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setPersonas(list);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err?.message || 'Error al cargar personas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const h = (e) => {
      const page = e?.detail?.page ?? null;
      if (page === 'personas') {
        setEditing(null);
        setModalOpen(true);
      }
    };
    window.addEventListener('open-new', h);
    return () => window.removeEventListener('open-new', h);
  }, []);

  const filtered = useMemo(() => {
    const q = String(debouncedQuery || '').trim().toLowerCase();
    if (!q) return personas;
    return personas.filter(p => {
      const s = `${p?.nombre || ''} ${p?.email || ''} ${p?.user?.username || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [personas, debouncedQuery]);

  const handleCreated = (nueva) => {
    if (!nueva) return;
    setPersonas(prev => [nueva, ...prev]);
    setModalOpen(false);
    toast.success('Persona creada');
  };

  const handleUpdated = (updated) => {
    if (!updated) return;
    setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p));
    setModalOpen(false);
    toast.success('Persona actualizada');
  };

  const openEdit = (e, p) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditing(p);
    setModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm('¿Eliminar persona?')) return;
    try {
      await deletePersona(id);
      setPersonas(prev => prev.filter(x => x.id !== id));
      toast.success('Persona eliminada');
      // removed selected panel handling
    } catch (err) {
      console.error('Error eliminando persona', err);
      toast.error(err?.response?.data?.detail || 'Error al eliminar persona');
    }
  };
  return (
    <div className="w-full max-w-screen-xl mx-auto">
      {/* Profile panel removed as requested */}



      {loading && <div>Cargando personas...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {Array.isArray(filtered) && filtered.length > 0 ? (
            filtered.map(p => (
              <div key={p.id} role="button" tabIndex={0} onClick={(e) => openEdit(e, p)} className="bg-white rounded-lg p-4 flex items-center justify-between border border-blue-100 hover:scale-105 hover:-translate-y-1 hover:shadow-xl transition-transform duration-200 cursor-pointer">
                <div className="flex-1">
                  <div className="font-semibold text-blue-800">{p.nombre || p.user?.username || ' — '}</div>
                  <div className="text-sm text-gray-600">{p.cargo || p.email || ''}</div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <IconButton icon={<FaEdit />} onClick={(e) => openEdit(e, p)} className="bg-[#f59e0b] text-white rounded shadow hover:bg-[#d97706] p-2" title="Editar" />
                  <IconButton icon={<FaTrash />} onClick={(e) => handleDelete(e, p.id)} className="bg-[#ef4444] text-white rounded shadow hover:bg-[#dc2626] p-2" title="Eliminar" />
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-gray-500">No hay personas que coincidan.</div>
          )}
        </div>
      )}

      {modalOpen && (
        <NuevaPersonaModal onClose={() => { setModalOpen(false); setEditing(null); }} persona={editing} onCreated={handleCreated} onUpdated={handleUpdated} />
      )}
    </div>
  );

};

export default PersonasPage;
