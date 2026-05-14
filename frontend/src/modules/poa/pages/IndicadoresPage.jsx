import React, { useEffect, useMemo, useState } from 'react';
import { getAllDirecciones, deleteDireccion, getOperacionesPorDireccion, deleteCatalogoOperacion, createCatalogoOperacion } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import NuevaDireccionModal from '../components/NuevaDireccionModal';
import IconButton from '../components/IconButton';
import { FaEdit, FaTrash } from 'react-icons/fa';

const getDirectionToneClass = (name = '') => {
  const text = String(name).toLowerCase();
  if (text.includes('internacional')) return 'border-sky-200 bg-sky-50/80 dark:border-sky-700/40 dark:bg-sky-950/20';
  if (text.includes('planific')) return 'border-amber-200 bg-amber-50/80 dark:border-amber-700/40 dark:bg-amber-950/20';
  if (text.includes('carrera') || text.includes('decanato')) return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-700/40 dark:bg-emerald-950/20';
  if (text.includes('distancia')) return 'border-violet-200 bg-violet-50/80 dark:border-violet-700/40 dark:bg-violet-950/20';
  return 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90';
};

const IndicadoresPage = () => {
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
  const [savingManual, setSavingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    direccion_id: '',
    servicio: '',
    proceso: '',
    operacion: '',
    producto_intermedio: '',
    indicador: '',
  });
  const [directionCounts, setDirectionCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAllDirecciones();
        if (!mounted) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setDirecciones(list);
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

  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      if (!Array.isArray(direcciones) || direcciones.length === 0) {
        setDirectionCounts({});
        return;
      }
      setCountsLoading(true);
      try {
        const pairs = await Promise.all(
          direcciones.map(async (dir) => {
            try {
              const res = await getOperacionesPorDireccion(dir.id);
              const list = Array.isArray(res?.data) ? res.data : [];
              return [dir.id, list.length];
            } catch (err) {
              return [dir.id, 0];
            }
          })
        );
        if (!mounted) return;
        setDirectionCounts(Object.fromEntries(pairs));
      } finally {
        if (mounted) setCountsLoading(false);
      }
    };
    loadCounts();
    return () => { mounted = false; };
  }, [direcciones]);

  const filtered = useMemo(() => {
    const q = String(debouncedQuery || '').trim().toLowerCase();
    if (!q) return direcciones;
    return direcciones.filter((d) => {
      const s = `${d?.nombre || ''} ${d?.descripcion || ''} ${d?.direccion || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [direcciones, debouncedQuery]);

  const filteredOperaciones = useMemo(() => {
    const q = String(opsQuery || '').trim().toLowerCase();
    if (!q) return operaciones;
    return operaciones.filter((op) => {
      const text = [op?.servicio, op?.proceso, op?.operacion, op?.producto_intermedio, op?.indicador].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [operaciones, opsQuery]);

  const handleCreated = (nueva) => {
    if (!nueva) return;
    setDirecciones((prev) => [nueva, ...prev]);
    setModalOpen(false);
    toast.success('Direccion creada');
  };

  const handleUpdated = (updated) => {
    if (!updated) return;
    setDirecciones((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setModalOpen(false);
    toast.success('Direccion actualizada');
  };

  const openEdit = (e, dir) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditing(dir);
    setModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm('Eliminar direccion?')) return;
    try {
      await deleteDireccion(id);
      setDirecciones((prev) => prev.filter((d) => d.id !== id));
      toast.success('Direccion eliminada');
      if (selectedDireccion && selectedDireccion.id === id) {
        setSelectedDireccion(null);
        setOperaciones([]);
      }
    } catch (err) {
      console.error('Error eliminando direccion:', err);
      toast.error(err?.response?.data?.detail || 'Error al eliminar direccion');
    }
  };

  const handleManualChange = (field, value) => {
    setManualForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      direccion_id: Number(manualForm.direccion_id),
      servicio: String(manualForm.servicio || '').trim(),
      proceso: String(manualForm.proceso || '').trim(),
      operacion: String(manualForm.operacion || '').trim(),
      producto_intermedio: String(manualForm.producto_intermedio || '').trim(),
      indicador: String(manualForm.indicador || '').trim(),
    };

    if (!payload.direccion_id || Number.isNaN(payload.direccion_id)) {
      toast.error('Selecciona una direccion.');
      return;
    }
    if (!payload.servicio || !payload.proceso || !payload.operacion || !payload.indicador) {
      toast.error('Completa direccion, servicio, proceso, operacion e indicador.');
      return;
    }

    setSavingManual(true);
    try {
      const res = await createCatalogoOperacion(payload);
      const nueva = res?.data;
      toast.success('Indicador registrado correctamente.');

      setManualForm((prev) => ({
        ...prev,
        indicador: '',
      }));

      setDirectionCounts((prev) => ({
        ...prev,
        [payload.direccion_id]: Math.max(0, Number(prev?.[payload.direccion_id] || 0) + 1),
      }));

      if (selectedDireccion?.id === payload.direccion_id && nueva) {
        setOperaciones((prev) => [nueva, ...prev]);
      }
      try { window.dispatchEvent(new CustomEvent('operacion-creada')); } catch (err) { }
    } catch (err) {
      console.error('Error creando indicador manual:', err);
      toast.error(err?.response?.data?.detail || 'No se pudo registrar el indicador.');
    } finally {
      setSavingManual(false);
    }
  };

  const onCardClick = (dir) => {
    if (selectedDireccion && selectedDireccion.id === dir.id) {
      setSelectedDireccion(null);
      setOperaciones([]);
      setOpsError(null);
      setSelectedOperacion(null);
      try { window.dispatchEvent(new CustomEvent('direccion-selected', { detail: null })); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (e) { }
      return;
    }
    fetchOperaciones(dir);
  };

  const fetchOperaciones = async (dir) => {
    if (!dir || dir.id === undefined || dir.id === null) return;
    setSelectedDireccion(dir);
    setOpsQuery('');
    setSelectedOperacion(null);
    try { window.dispatchEvent(new CustomEvent('operacion-selected', { detail: null })); } catch (e) { }
    try { window.dispatchEvent(new CustomEvent('direccion-selected', { detail: dir })); } catch (e) { }
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

  useEffect(() => {
    const h = () => {
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
        toast.success('Operacion eliminada');
        if (selectedDireccion) fetchOperaciones(selectedDireccion);
      } catch (err) {
        console.error('Error eliminando operacion:', err);
        toast.error(err?.response?.data?.detail || 'Error al eliminar operacion');
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

  return (
    <div className=" w-full max-w-screen-xl mx-auto">
      <div className="mb-4 rounded-lg border border-slate-200 bg-white/90 p-4 shadow dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mb-3">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Registro manual de indicadores</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">Ingresa un indicador por vez. El sistema mantiene el contexto para repetir servicio, proceso y operacion para cada indicador.</div>
        </div>
        <form onSubmit={handleManualSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={manualForm.direccion_id}
            onChange={(e) => handleManualChange('direccion_id', e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          >
            <option value="">Seleccionar direccion</option>
            {direcciones.map((dir) => (
              <option key={dir.id} value={dir.id}>{dir.nombre || dir.direccion || `Direccion ${dir.id}`}</option>
            ))}
          </select>
          <input
            type="text"
            value={manualForm.servicio}
            onChange={(e) => handleManualChange('servicio', e.target.value)}
            placeholder="Servicio"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="text"
            value={manualForm.proceso}
            onChange={(e) => handleManualChange('proceso', e.target.value)}
            placeholder="Proceso"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="text"
            value={manualForm.operacion}
            onChange={(e) => handleManualChange('operacion', e.target.value)}
            placeholder="Operacion"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="text"
            value={manualForm.producto_intermedio}
            onChange={(e) => handleManualChange('producto_intermedio', e.target.value)}
            placeholder="Producto intermedio (opcional)"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text"
            value={manualForm.indicador}
            onChange={(e) => handleManualChange('indicador', e.target.value)}
            placeholder="Indicador"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <div className="xl:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={savingManual}
              className="btn-futuristic rounded px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingManual ? 'Guardando...' : 'Guardar indicador'}
            </button>
          </div>
        </form>
      </div>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
        Se deshabilito la carga directa por archivo. El registro del catalogo de indicadores ahora es manual, uno por uno, desde este formulario.
      </div>

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
            filtered.map((dir) => {
              const isExpanded = selectedDireccion && selectedDireccion.id === dir.id;
              const count = directionCounts?.[dir.id];
              return (
                <div
                  key={dir.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCardClick(dir); }}
                  onClick={() => onCardClick(dir)}
                  className={`rounded-lg p-4 border transition-shadow duration-200 cursor-pointer ${getDirectionToneClass(dir.nombre || dir.descripcion || dir.direccion || '')} ${isExpanded ? 'shadow-xl ring-2 ring-blue-200' : 'hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-xl'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-blue-800">{dir.nombre || dir.descripcion || dir.direccion || ' - '}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {countsLoading && !isExpanded ? 'Contando indicadores...' : isExpanded ? `${operaciones.length} indicadores cargados` : `${typeof count === 'number' ? count : 0} indicadores`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <IconButton icon={<FaEdit />} onClick={(e) => openEdit(e, dir)} className="bg-[#f59e0b] text-white rounded shadow hover:bg-[#d97706] p-2" title="Editar" />
                      <IconButton icon={<FaTrash />} onClick={(e) => handleDelete(e, dir.id)} className="bg-[#ef4444] text-white rounded shadow hover:bg-[#dc2626] p-2" title="Eliminar" />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="mb-3">
                        <input
                          type="text"
                          value={opsQuery}
                          onChange={(e) => setOpsQuery(e.target.value)}
                          placeholder="Buscar en este bloque..."
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      {opsLoading ? (
                        <div>Cargando indicadores...</div>
                      ) : opsError ? (
                        <div className="text-red-600">{opsError}</div>
                      ) : filteredOperaciones && filteredOperaciones.length > 0 ? (
                        <div className="overflow-x-auto no-scrollbar">
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
                      ) : (
                        <div className="text-gray-500">
                          {operaciones.length > 0 ? 'No hay resultados para la busqueda actual.' : 'No hay indicadores para esta direccion.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
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

export default IndicadoresPage;
