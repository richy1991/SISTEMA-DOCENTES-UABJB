import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaEdit, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import {
  createIndicadorCatalogo,
  deleteIndicadorCatalogo,
  getIndicadoresCatalogo,
  importarIndicadoresPdf,
  updateIndicadorCatalogo,
} from '../../../apis/poa.api';

const IndicadoresPage = () => {
  const inputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [indicadores, setIndicadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [indicador, setIndicador] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let mounted = true;

    const loadIndicadores = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = debouncedSearchQuery.trim() ? { search: debouncedSearchQuery.trim() } : undefined;
        const res = await getIndicadoresCatalogo(params);
        if (!mounted) return;
        const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        setIndicadores(list || []);
      } catch (err) {
        if (!mounted) return;
        setIndicadores([]);
        setError(err?.response?.data?.detail || err?.message || 'No se pudieron cargar los indicadores.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadIndicadores();

    return () => {
      mounted = false;
    };
  }, [debouncedSearchQuery]);

  const totalIndicadores = useMemo(() => indicadores.length, [indicadores]);

  const refreshIndicadores = async (queryValue = debouncedSearchQuery) => {
    const trimmed = String(queryValue || '').trim();
    const params = trimmed ? { search: trimmed } : undefined;
    const res = await getIndicadoresCatalogo(params);
    const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
    setIndicadores(list || []);
    return list || [];
  };

  const resetForm = () => {
    setEditingId(null);
    setIndicador('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = String(indicador || '').trim();
    if (!value) {
      toast.error('Escribe un indicador.');
      return;
    }

    setSaving(true);
    try {
      const payload = { indicador: value };
      if (editingId) {
        const res = await updateIndicadorCatalogo(editingId, payload);
        const updated = res?.data || { id: editingId, indicador: value };
        setIndicadores((prev) => prev.map((item) => (Number(item.id) === Number(editingId) ? updated : item)));
        toast.success('Indicador actualizado.');
      } else {
        const res = await createIndicadorCatalogo(payload);
        const created = res?.data || { indicador: value };
        setIndicadores((prev) => [created, ...prev]);
        toast.success('Indicador agregado.');
      }
      resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.indicador?.[0] || err?.response?.data?.detail || err?.message || 'No se pudo guardar el indicador.');
    } finally {
      setSaving(false);
    }
  };

  const handlePdfImport = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) return;

    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    if (!name.endsWith('.pdf') && type !== 'application/pdf') {
      toast.error('Selecciona un archivo PDF.');
      return;
    }

    setImportingPdf(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await importarIndicadoresPdf(formData);
      const creados = Number(res?.data?.indicadores_creados || 0);
      await refreshIndicadores(searchQuery);
      toast.success(creados > 0 ? `Se importaron ${creados} indicadores.` : 'El PDF ya estaba reflejado en el catálogo.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.sugerencia || err?.message || 'No se pudo importar el PDF.');
    } finally {
      setImportingPdf(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setIndicador(item.indicador || '');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Eliminar indicador "${item.indicador || ''}"?`)) return;

    setDeletingId(item.id);
    try {
      await deleteIndicadorCatalogo(item.id);
      setIndicadores((prev) => prev.filter((current) => Number(current.id) !== Number(item.id)));
      toast.success('Indicador eliminado.');
      if (Number(editingId) === Number(item.id)) resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar el indicador.');
    } finally {
      setDeletingId(null);
    }
  };

  const hasResults = indicadores.length > 0;

  return (
    <section className="flex flex-col items-start justify-start flex-1 pb-6 px-3 md:px-6 py-4 w-full">
      <div className="w-full max-w-[1200px] mx-auto space-y-4">
        <div className="rounded-2xl border border-blue-200/80 bg-white/75 backdrop-blur-sm p-4 md:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/55">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-blue-700 dark:text-sky-300">Catálogo POA</p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-slate-100 leading-tight">Catálogo de indicadores</h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                Este catálogo almacena una sola lista de indicadores. Las actividades los usan como sugerencias al momento de crear o editar.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-white/85 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 min-w-[190px]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-blue-700 dark:text-sky-300 font-bold">Indicadores cargados</p>
              <p className="text-3xl font-black mt-1 text-slate-900 dark:text-white">{totalIndicadores}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/55">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {editingId ? 'Editar indicador' : 'Nuevo indicador'}
              </label>
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={indicador}
                  onChange={(e) => setIndicador(e.target.value)}
                  placeholder="Escribe un indicador..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <FaPlus />
                    {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Agregar')}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="w-full lg:w-80">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Buscar indicador</label>
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtra la lista..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/75 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Importar desde PDF</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sube un PDF con texto extraíble. Se guardará una lista de indicadores, uno por línea, sin duplicados.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfImport}
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={importingPdf}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {importingPdf ? 'Importando...' : 'Subir PDF'}
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="text-blue-800 dark:text-slate-200">Cargando indicadores...</div>}
        {error && <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{String(error)}</div>}

        {!loading && !error && (
          hasResults ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/55">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Indicador</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {indicadores.map((item, index) => (
                    <tr
                      key={item.id || `${item.indicador}-${index}`}
                      className="border-t border-slate-200 dark:border-slate-800 bg-white odd:bg-slate-50/70 dark:bg-slate-900/30 dark:odd:bg-slate-950/35"
                    >
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">{item.indicador}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
                          >
                            <FaEdit /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <FaTrash /> {deletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/75 px-5 py-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
              No hay indicadores que coincidan con la búsqueda.
            </div>
          )
        )}
      </div>
    </section>
  );
};

export default IndicadoresPage;
