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
  const [selectedOperacion, setSelectedOperacion] = useState(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getAllDirecciones()
      .then(res => {
        setDirecciones(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err?.response?.data?.detail || err.message || 'Error al obtener direcciones');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e?.detail?.page === 'direcciones') {
        setEditing(null);
        setModalOpen(true);
      }
    };
    window.addEventListener('open-new', h);
    return () => window.removeEventListener('open-new', h);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 220);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return direcciones;
    return direcciones.filter(d => ((d.nombre || d.descripcion || d.direccion || '') + '').toLowerCase().includes(debouncedQuery));
  }, [direcciones, debouncedQuery]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta dirección? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDireccion(id);
      setDirecciones(prev => prev.filter(d => d.id !== id));
      toast.success('Dirección eliminada');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Error al eliminar');
    }
  };

  const openEdit = (e, direccion) => {
    e.stopPropagation();
    setEditing(direccion);
    setModalOpen(true);
  };

  const handleCreated = (newDir) => {
    setDirecciones(prev => [newDir, ...prev]);
    setModalOpen(false);
    toast.success('Dirección creada');
  };

  const handleUpdated = (updated) => {
    setDirecciones(prev => prev.map(d => d.id === updated.id ? updated : d));
    setModalOpen(false);
    toast.success('Dirección actualizada');
  };

  const onCardClick = (dir) => {
    fetchOperaciones(dir);
  };

  const fetchOperaciones = async (dir) => {
    if (!dir || dir.id === undefined || dir.id === null) return;
    setSelectedDireccion(dir);
    setSelectedOperacion(null);
    try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (e) { }
    try { window.dispatchEvent(new CustomEvent('direccion-selected', { detail: dir })); } catch (e) { }
    setOpsLoading(true);
    setOpsError(null);
    try {
      const res = await getOperacionesPorDireccion(dir.id);
      setOperaciones(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setOpsError(err?.response?.data?.detail || err.message || 'Error al obtener operaciones');
      setOperaciones([]);
    } finally {
      setOpsLoading(false);
    }
  };

  useEffect(() => {
    const h = (e) => {
      if (selectedDireccion) fetchOperaciones(selectedDireccion);
    };
    window.addEventListener('operacion-creada', h);
    return () => window.removeEventListener('operacion-creada', h);
  }, [selectedDireccion]);

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

  useEffect(() => {
    const onDirCleared = (e) => {
      const d = e?.detail ?? null;
      if (!d) {
        setSelectedOperacion(null);
        try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (err) { }
      }
    };
    window.addEventListener('direccion-selected', onDirCleared);
    return () => window.removeEventListener('direccion-selected', onDirCleared);
  }, []);

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
            {opsLoading ? (
              <div>Cargando operaciones...</div>
            ) : opsError ? (
              <div className="text-red-600">{opsError}</div>
            ) : operaciones && operaciones.length > 0 ? (
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
                      {operaciones.map((op) => {
                        const isSelected = selectedOperacion && selectedOperacion.id === op.id;
                        return (
                          <tr
                            key={op.id}
                            className={`border-b hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-700 text-white border-l-4 border-blue-900' : ''}`}
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
              <div className="text-gray-500">No hay operaciones para esta dirección.</div>
            )}
          </div>
        </div>
      )}

      {loading && <div>Cargando direcciones...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-3">
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
