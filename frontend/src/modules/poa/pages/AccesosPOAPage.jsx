import React, { useEffect, useState, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaSearch, FaUserShield } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { getUsuariosPOA, deleteUsuarioPOA, updateUsuarioPOA, ROL_POA_CHOICES } from '../../../apis/poa.api';
import AsignarAccesoPOAModal from '../components/AsignarAccesoPOAModal';
import { useOutletContext } from 'react-router-dom';

const ROL_COLOR = {
  elaborador: 'bg-blue-100 text-blue-800 border-blue-200',
};

const ROL_DARK = {
  elaborador: 'dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
};

const getRolLabel = (rol) => ROL_POA_CHOICES.find(r => r.value === rol)?.label || rol;

export default function AccesosPOAPage() {
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const canManageAccess = !!poaPermissions.canManageAccess;
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [filterRol, setFilterRol] = useState('todos');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchAccesos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsuariosPOA();
      // DRF puede devolver paginado { results: [...] } o lista directa
      const data = res?.data;
      setAccesos(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      toast.error('Error al cargar los accesos POA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccesos(); }, [fetchAccesos]);

  // Escuchar evento global para abrir el modal
  useEffect(() => {
    const handler = (e) => {
      if (canManageAccess && e?.detail?.page === 'accesos') { setEditTarget(null); setShowModal(true); }
    };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, [canManageAccess]);

  const handleToggleActivo = async (acceso) => {
    if (!canManageAccess) {
      toast.error('No tiene permisos para gestionar accesos POA.');
      return;
    }
    try {
      const res = await updateUsuarioPOA(acceso.id, { activo: !acceso.activo });
      setAccesos(prev => prev.map(a => a.id === acceso.id ? { ...a, activo: res.data.activo } : a));
      toast.success(res.data.activo ? 'Acceso activado' : 'Acceso desactivado');
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleDelete = async (id) => {
    if (!canManageAccess) {
      toast.error('No tiene permisos para gestionar accesos POA.');
      return;
    }
    try {
      await deleteUsuarioPOA(id);
      setAccesos(prev => prev.filter(a => a.id !== id));
      toast.success('Acceso eliminado');
      setConfirmDelete(null);
    } catch {
      toast.error('Error al eliminar el acceso');
    }
  };

  // Filtros
  const filtered = accesos.filter(a => {
    const nombre = (a.nombre_display || a.user_detalle?.nombre_completo || a.docente_detalle?.nombre_completo || '').toLowerCase();
    const username = (a.user_detalle?.username || '').toLowerCase();
    const entidad = a.nombre_entidad?.toLowerCase() || '';
    const matchSearch = !search || nombre.includes(search.toLowerCase()) || username.includes(search.toLowerCase()) || entidad.includes(search.toLowerCase());
    const matchRol = filterRol === 'todos' || a.rol === filterRol;
    return matchSearch && matchRol;
  });

  // Agrupar por rol para el resumen
  const counts = ROL_POA_CHOICES.map(r => ({
    ...r,
    count: accesos.filter(a => a.rol === r.value && a.activo).length,
  }));

  if (!canManageAccess) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          No tiene permisos para administrar accesos del modulo POA.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="accesos-panel rounded-3xl border border-slate-200/90 bg-white/80 p-5 shadow-xl backdrop-blur-sm dark:border-sky-900/40 dark:bg-slate-900/65">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <FaUserShield className="text-blue-500" />
            Accesos al Módulo POA
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-slate-300">
            Gestiona qué usuarios tienen permisos y qué pueden hacer en el módulo POA.
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition"
        >
          <FaPlus /> Asignar Acceso
        </button>
      </div>

      {/* Resumen por rol */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {counts.map(r => (
          <button
            key={r.value}
            onClick={() => setFilterRol(prev => prev === r.value ? 'todos' : r.value)}
            className={`accesos-kpi rounded-xl border px-3 py-2.5 text-left transition-all text-xs font-semibold
              ${filterRol === r.value ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'}
              ${ROL_COLOR[r.value]} ${ROL_DARK[r.value]}`}
          >
            <div className="text-lg font-bold">{r.count}</div>
            <div className="leading-tight mt-0.5">{r.label}</div>
          </button>
        ))}
      </div>

      {/* Barra de búsqueda y filtro */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario o entidad..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-100"
          />
        </div>
        <select
          value={filterRol}
          onChange={e => setFilterRol(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-100"
        >
          <option value="todos">Todos los roles</option>
          {ROL_POA_CHOICES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-blue-500 dark:text-sky-300">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
          Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-400">
          <FaUserShield className="mx-auto text-4xl mb-3 opacity-30" />
          <p className="text-sm">
            {accesos.length === 0 ? 'No hay accesos asignados todavía.' : 'Sin resultados para los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="accesos-table-shell bg-white rounded-2xl shadow border border-gray-100 overflow-hidden dark:border-slate-700 dark:bg-slate-900/70">
          <table className="accesos-table w-full text-sm">
            <thead>
              <tr className="accesos-table-head text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Rol POA</th>
                <th className="px-4 py-3 text-left">Entidad</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr key={a.id} className={`border-t border-gray-100 dark:border-slate-700/70 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900/55' : 'bg-gray-50/50 dark:bg-slate-800/35'} hover:bg-blue-50/30 dark:hover:bg-sky-900/20 transition`}>
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100">
                    <div>{a.nombre_display || a.user_detalle?.nombre_completo || a.docente_detalle?.nombre_completo || '—'}</div>
                    {a.user_detalle?.username && (
                      <div className="text-xs text-gray-400 dark:text-slate-400 font-normal">@{a.user_detalle.username}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${ROL_COLOR[a.rol] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {a.rol_display || getRolLabel(a.rol)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                    {a.nombre_entidad || <span className="text-gray-300 dark:text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleActivo(a)} title={a.activo ? 'Desactivar' : 'Activar'}>
                      {a.activo
                        ? <FaToggleOn className="text-green-500 text-xl mx-auto" />
                        : <FaToggleOff className="text-gray-400 dark:text-slate-500 text-xl mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setEditTarget(a); setShowModal(true); }}
                        className="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-sky-900/25 transition"
                        title="Editar"
                      >
                        <FaEdit size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(a)}
                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Eliminar"
                      >
                        <FaTrash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal asignar/editar */}
      {showModal && (
        <AsignarAccesoPOAModal
          accesoToEdit={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onCreated={(nuevo) => { setAccesos(prev => [nuevo, ...prev]); setShowModal(false); }}
          onUpdated={(updated) => {
            setAccesos(prev => prev.map(a => a.id === updated.id ? updated : a));
            setShowModal(false); setEditTarget(null);
          }}
        />
      )}

      {/* Confirmación de eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 dark:border dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-slate-100">¿Eliminar acceso?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-5">
              Se eliminará el acceso de <strong>{confirmDelete.docente_detalle?.nombre_completo}</strong> como{' '}
              <strong>{confirmDelete.rol_display}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 transition font-medium">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
