import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getAllDirecciones, deleteDireccion, getOperacionesPorDireccion, deleteCatalogoOperacion } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import NuevaDireccionModal from '../components/NuevaDireccionModal';
import IconButton from '../components/IconButton';
import { FaEdit, FaTrash } from 'react-icons/fa';

const DireccionesPage = () => {
  const [direcciones, setDirecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDireccion, setSelectedDireccion] = useState(null);
  const [operaciones, setOperaciones] = useState([]);
  const [opsQuery, setOpsQuery] = useState('');
  const [selectedOperacion, setSelectedOperacion] = useState(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState(null);
  const scrollRef = useRef(null);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch direcciones on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAllDirecciones();
        if (!mounted) return;
        setDirecciones(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setError(err?.response?.data?.detail || err.message || 'Error al obtener direcciones');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = String(debouncedQuery || '').trim().toLowerCase();
    if (!q) return direcciones;
    return direcciones.filter(d => {
      const s = `${d?.nombre || ''} ${d?.descripcion || ''} ${d?.direccion || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [direcciones, debouncedQuery]);

  const filteredOperaciones = useMemo(() => {
    const q = String(opsQuery || '').trim().toLowerCase();
    if (!q) return operaciones;
    return operaciones.filter((op) => {
      const text = [
        op?.servicio,
        op?.proceso,
        op?.operacion,
        op?.producto_intermedio,
        op?.indicador,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [operaciones, opsQuery]);

  const handleCreated = (nueva) => {
    if (!nueva) return;
    setDirecciones(prev => [nueva, ...prev]);
    setModalOpen(false);
    toast.success('Dirección creada');
  };

  const handleUpdated = (updated) => {
    if (!updated) return;
    setDirecciones(prev => prev.map(d => d.id === updated.id ? updated : d));
    setModalOpen(false);
    toast.success('Dirección actualizada');
  };

  const openEdit = (e, dir) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditing(dir);
    setModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm('¿Eliminar dirección?')) return;
    try {
      await deleteDireccion(id);
      setDirecciones(prev => prev.filter(d => d.id !== id));
      toast.success('Dirección eliminada');
      // si la dirección eliminada estaba seleccionada, limpiarla
      if (selectedDireccion && selectedDireccion.id === id) {
        setSelectedDireccion(null);
        setOperaciones([]);
      }
    } catch (err) {
      console.error('Error eliminando dirección:', err);
      toast.error(err?.response?.data?.detail || 'Error al eliminar dirección');
    }
  };

  const onCardClick = (dir) => {
    fetchOperaciones(dir);
  };

  const fetchOperaciones = async (dir) => {
    if (!dir || dir.id === undefined || dir.id === null) return;
    setSelectedDireccion(dir);
    setOpsQuery('');
    setSelectedOperacion(null);
    try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (e) { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('direccion-selected', { detail: dir })); } catch (e) { /* ignore */ }
    setOpsLoading(true);
    setOpsError(null);
    try {
      const res = await getOperacionesPorDireccion(dir.id);
      setOperaciones(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setOpsError(err?.response?.data?.detail || err.message || 'Error al obtener operaciones');
      setOperaciones([]);
    } finally {
      setOpsLoading(false);
    }
  };

  // Escuchar evento global que indica que se creó una operación para refrescar la lista
  useEffect(() => {
    const h = (e) => {
      if (selectedDireccion) fetchOperaciones(selectedDireccion);
    };
    window.addEventListener('operacion-creada', h);
    return () => window.removeEventListener('operacion-creada', h);
  }, [selectedDireccion]);

  // Escuchar evento global para eliminar una operación desde el header
  useEffect(() => {
    const h = async (e) => {
      const op = e?.detail ?? null;
      if (!op || !op.id) return;
      try {
        await deleteCatalogoOperacion(op.id);
        toast.success('Operación eliminada');
        if (selectedDireccion) fetchOperaciones(selectedDireccion);
      } catch (err) {
        console.error('Error eliminando operación:', err);
        toast.error(err?.response?.data?.detail || 'Error al eliminar operación');
      }
    };
    window.addEventListener('delete-operacion', h);
    return () => window.removeEventListener('delete-operacion', h);
  }, [selectedDireccion]);

  // Escuchar petición de edición/eliminación desde header (opcional) - limpia selección al cerrar dirección
  useEffect(() => {
    const onDirCleared = (e) => {
      const d = e?.detail ?? null;
      if (!d) {
        setSelectedOperacion(null);
        try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (err) { /* ignore */ }
      }
    };
    window.addEventListener('direccion-selected', onDirCleared);
    return () => window.removeEventListener('direccion-selected', onDirCleared);
  }, []);

  // Escuchar el botón global 'Nuevo' del header (App.jsx) y abrir modal cuando la página sea 'direcciones'
  useEffect(() => {
    const h = (e) => {
      const page = e?.detail?.page ?? null;
      if (page === 'direcciones') {
        setEditing(null);
        setModalOpen(true);
      }
    };
    window.addEventListener('open-new', h);
    return () => window.removeEventListener('open-new', h);
  }, []);

  // (Se eliminó la lógica de drag & drop — ya no es necesaria)

  return (
    <div className=" w-full max-w-screen-xl mx-auto">
      {selectedDireccion && (
        <div className="-mt-6 mb-4 p-4 bg-white rounded shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-800">{selectedDireccion.nombre || selectedDireccion.descripcion || selectedDireccion.direccion || ' — '}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedDireccion(null); setOperaciones([]); setOpsError(null); try { window.dispatchEvent(new CustomEvent('direccion-selected', { detail: null })); } catch(e){} }} className="px-3 py-1 bg-gray-200 rounded">Cerrar</button>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-3">
              <input
                type="text"
                value={opsQuery}
                onChange={(e) => setOpsQuery(e.target.value)}
                placeholder="Buscar en operaciones e indicadores..."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {opsLoading ? (
              <div>Cargando operaciones...</div>
            ) : opsError ? (
              <div className="text-red-600">{opsError}</div>
            ) : filteredOperaciones && filteredOperaciones.length > 0 ? (
              <div className="relative">
                <div className="flex items-center justify-end mb-2 gap-2"></div>
                <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
                  <table className="min-w-full border-collapse leading-6">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 w-80 border">Servicios</th>
                        <th className="p-3 w-80 border">Procesos</th>
                        <th className="p-3 w-96 border">Operaciones</th>
                        <th className="p-3 w-80 border">Productos Intermedios</th>
                        <th className="p-3 w-96 border">Indicador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOperaciones.map((op) => {
                        const isSelected = selectedOperacion && selectedOperacion.id === op.id;
                        return (
                          <tr
                            key={op.id}
                            className={`border-b hover:cursor-pointer ${isSelected ? 'bg-blue-200 border-l-4 border-blue-900' : ''}`}
                            onClick={() => {
                              if (selectedOperacion && selectedOperacion.id === op.id) {
                                setSelectedOperacion(null);
                                try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (e) { }
                              } else {
                                setSelectedOperacion(op);
                                try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: op })); } catch (e) { }
                              }
                            }}
                          >
                            <td className={`p-3 align-top ${isSelected ? 'text-white' : ''}`}>{op.servicio || op.unidad || <span className="text-gray-400">Sin datos</span>}</td>
                            <td className={`p-3 align-top ${isSelected ? 'text-white' : ''}`}>{op.proceso || op.proceso_nombre || <span className="text-gray-400">Sin datos</span>}</td>
                            <td className={`p-3 align-top font-medium ${isSelected ? 'text-white' : ''}`}>{op.nombre || op.operacion || op.operaciones || op.descripcion || op.codigo || <span className="text-gray-400">Sin datos</span>}</td>
                            <td className={`p-3 align-top ${isSelected ? 'text-white' : ''}`}>{op.producto_intermedio || op.producto || <span className="text-gray-400">Sin datos</span>}</td>
                            <td className={`p-3 align-top ${isSelected ? 'text-white' : ''}`}>{op.indicador || op.indicador_nombre || <span className="text-gray-400">Sin datos</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                {operaciones.length > 0 ? 'No hay resultados para la busqueda actual.' : 'No hay operaciones para esta direccion.'}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div>Cargando direcciones...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-3">
          <div className="mb-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar direccion..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {Array.isArray(filtered) && filtered.length > 0 ? (
            filtered.map(dir => (
              <div
                key={dir.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCardClick(dir); }}
                onClick={() => onCardClick(dir)}
                className="bg-white rounded-lg p-4 flex items-center justify-between border border-blue-100 hover:scale-105 hover:-translate-y-1 hover:shadow-xl transition-transform duration-200 cursor-pointer"
              >
                <div className="flex-1">
                  <div className="font-semibold text-blue-800">{dir.nombre || dir.descripcion || dir.direccion || ' — '}</div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <IconButton icon={<FaEdit />} onClick={(e) => openEdit(e, dir)} className="bg-[#f59e0b] text-white rounded shadow hover:bg-[#d97706] p-2" title="Editar" />
                  <IconButton icon={<FaTrash />} onClick={(e) => handleDelete(e, dir.id)} className="bg-[#ef4444] text-white rounded shadow hover:bg-[#dc2626] p-2" title="Eliminar" />
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-gray-500">No hay direcciones que coincidan.</div>
          )}
        </div>
      )}

      {modalOpen && (
        <NuevaDireccionModal
          onClose={() => { setModalOpen(false); setEditing(null); }}
          direccion={editing}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
};

export default DireccionesPage;
