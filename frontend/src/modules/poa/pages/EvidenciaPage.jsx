import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvidenciasPorActividad, crearEvidencia, updateEvidencia, deleteEvidencia, getActividadPorId } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaEdit, FaTrash, FaChevronLeft, FaChevronRight, FaLink, FaFileDownload } from 'react-icons/fa';
import Dialog from '../components/base/Dialog';

const EvidenciaPage = () => {
  const { actividadId } = useParams();
  const navigate = useNavigate();
  const [evidencia, setEvidencia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actividad, setActividad] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [linkItems, setLinkItems] = useState([{ id: 'link-0', url: '' }]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [formData, setFormData] = useState({ resultados_logrados: '', programado: 1, ejecutado: 1, grado_cumplimiento: '' });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef(null);

  const createLinkItem = (url = '') => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, url });
  const normalizeCumplimientoInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return String(Math.trunc(numeric));
  };
  const poaFieldClass = 'w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm';
  const poaCompactFieldClass = 'w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm';
  const poaTextAreaClass = `${poaFieldClass} resize-none`;
  const poaCancelButtonClass = 'min-w-[104px] rounded-xl px-4 py-2.5 text-sm font-bold transition-colors border border-slate-300 bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600';
  const poaSaveButtonClass = 'min-w-[104px] rounded-xl px-4 py-2.5 text-sm font-bold transition-colors border border-emerald-500/60 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md hover:brightness-105';
  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const addLinkItem = () => setLinkItems((c) => [...c, createLinkItem('')]);
  const updateLinkItem = (id, url) => setLinkItems((c) => c.map((it) => (it.id === id ? { ...it, url } : it)));
  const removeLinkItem = (id) => setLinkItems((current) => {
    const next = current.filter((item) => item.id !== id);
    return next.length > 0 ? next : [createLinkItem('')];
  });

  const revokePreviewUrls = (items) => {
    (items || []).forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  };

  const clearPendingFiles = () => {
    setFiles((current) => {
      revokePreviewUrls(current);
      return [];
    });
  };

  useEffect(() => {
    return () => revokePreviewUrls(files);
  }, [files]);

  // Cargar evidencia y actividad al montar / cuando cambia actividadId
  useEffect(() => {
    console.debug('[EvidenciaPage] useEffect mount/update actividadId', { actividadId });
    if (!actividadId) {
      console.debug('[EvidenciaPage] actividadId no definido, no se carga evidencia');
      setLoading(false);
      return;
    }

    loadEvidencia();

    getActividadPorId(actividadId)
      .then(res => {
        console.debug('[EvidenciaPage] getActividadPorId response', res && res.data);
        setActividad(res.data);
      })
      .catch(err => {
        console.error('[EvidenciaPage] error loading actividad', err);
        setActividad(null);
      });
  }, [actividadId]);

  const loadEvidencia = () => {
    console.debug('[EvidenciaPage] loadEvidencia start', { actividadId });
    setLoading(true);
    getEvidenciasPorActividad(actividadId)
      .then(res => {
        console.debug('[EvidenciaPage] getEvidenciasPorActividad response', res && res.data);
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        if (list.length > 0) {
          const ev = list[0];
          const links = (ev.archivos || [])
            .filter((archivo) => archivo.tipo === 'link' && archivo.url)
            .map((archivo, index) => ({
              id: archivo.id ? `link-${archivo.id}` : `link-${index}`,
              url: archivo.url,
            }));
          setEvidencia(ev);
          setCarouselIndex(0);
          setFormData({
            resultados_logrados: ev.resultados_logrados || '',
            programado: ev.programado || 1,
            ejecutado: ev.ejecutado || 1,
            grado_cumplimiento: normalizeCumplimientoInput(ev.grado_cumplimiento),
          });
          setLinkItems(links.length > 0 ? links : [createLinkItem('')]);
          setEditMode(false);
        } else {
          setEvidencia(null);
          setLinkItems([createLinkItem('')]);
        }
      })
      .catch(err => {
        console.error('[EvidenciaPage] error loading evidencias', err);
        toast.error('Error cargando evidencias');
      })
      .finally(() => {
        console.debug('[EvidenciaPage] loadEvidencia finally - setting loading false');
        setLoading(false);
      });
  };

  const addFiles = (incomingFiles) => {
    const list = Array.from(incomingFiles || []).filter(file => file && file.type?.startsWith('image/'));
    if (list.length === 0) return;

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
      const nextItems = list
        .filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
        .map((file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));

      return [...prev, ...nextItems];
    });
  };

  const onFileChange = (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  };

  const removePendingFile = (id) => {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const markImageForRemoval = (archivoId) => {
    setRemovedImageIds((current) => (current.includes(archivoId) ? current : [...current, archivoId]));
  };

  const unmarkImageRemoval = (archivoId) => {
    setRemovedImageIds((current) => current.filter((id) => id !== archivoId));
  };

  const onPaste = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const pastedFiles = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(file => file && file.type?.startsWith('image/'));

    if (pastedFiles.length > 0) {
      event.preventDefault();
      addFiles(pastedFiles);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer?.files);
  };

  const handleEditCancel = () => {
    if (evidencia) {
      const links = (evidencia.archivos || [])
        .filter((archivo) => archivo.tipo === 'link' && archivo.url)
        .map((archivo, index) => ({
          id: archivo.id ? `link-${archivo.id}` : `link-${index}`,
          url: archivo.url,
        }));
      setFormData({
        resultados_logrados: evidencia.resultados_logrados || '',
        programado: evidencia.programado || 1,
        ejecutado: evidencia.ejecutado || 1,
        grado_cumplimiento: normalizeCumplimientoInput(evidencia.grado_cumplimiento),
      });
      setLinkItems(links.length > 0 ? links : [createLinkItem('')]);
      setRemovedImageIds([]);
      clearPendingFiles();
      setEditMode(false);
      return;
    }

    navigate(-1);
  };

  const handleDelete = async () => {
    if (!evidencia) return;

    try {
      await deleteEvidencia(evidencia.id);
      toast.success('Evidencia eliminada');
      setEvidencia(null);
      clearPendingFiles();
      setEditMode(false);
      setCarouselIndex(0);
      setFormData({
        resultados_logrados: '',
        programado: 1,
        ejecutado: 1,
        grado_cumplimiento: '',
      });
      setLinkItems([createLinkItem('')]);
      setRemovedImageIds([]);
    } catch (error) {
      toast.error('No se pudo eliminar la evidencia');
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!actividadId) return;
    const isEditingExisting = Boolean(editMode && evidencia?.id);

    if (!formData.resultados_logrados.trim()) {
      toast.error('Debes escribir los resultados logrados');
      return;
    }

    const gradoCumplimientoTexto = String(formData.grado_cumplimiento).trim();
    if (!gradoCumplimientoTexto) {
      toast.error('Debes ingresar el grado de cumplimiento');
      return;
    }

    const gradoCumplimientoNumero = Number(gradoCumplimientoTexto);
    if (!Number.isInteger(gradoCumplimientoNumero) || gradoCumplimientoNumero < 0 || gradoCumplimientoNumero > 100) {
      toast.error('El grado de cumplimiento debe ser un número entero entre 0 y 100');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('actividad_id', String(actividadId));
      payload.append('resultados_logrados', formData.resultados_logrados);
      payload.append('programado', String(formData.programado));
      payload.append('ejecutado', String(formData.ejecutado));
      payload.append('grado_cumplimiento', String(gradoCumplimientoNumero));

      const links = linkItems
        .map((item) => item.url.trim())
        .filter(Boolean);
      const removedImages = Array.from(new Set(removedImageIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));

      links.forEach(link => payload.append('links', link));
      files.forEach((item) => payload.append('archivos', item.file));
      if (removedImages.length > 0) {
        payload.append('removed_archivos', JSON.stringify(removedImages));
      }

      if (isEditingExisting) {
        await updateEvidencia(evidencia.id, payload);
      } else {
        await crearEvidencia(payload);
      }
      toast.success(isEditingExisting ? 'Evidencia actualizada' : 'Evidencia registrada');
      clearPendingFiles();
      setLinkItems(links.length > 0 ? links.map((link) => createLinkItem(link)) : [createLinkItem('')]);
      setRemovedImageIds([]);
      setEditMode(false);
      loadEvidencia();
    } catch (error) {
      toast.error('No se pudo guardar la evidencia');
    } finally {
      setSubmitting(false);
    }
  };

  const nextImage = () => {
    const imagenes = evidencia?.archivos?.filter(a => a.tipo === 'imagen' && a.archivo_url) || [];
    if (imagenes.length > 1) {
      setCarouselIndex(prev => (prev + 1) % imagenes.length);
    }
  };

  const prevImage = () => {
    const imagenes = evidencia?.archivos?.filter(a => a.tipo === 'imagen' && a.archivo_url) || [];
    if (imagenes.length > 1) {
      setCarouselIndex(prev => (prev - 1 + imagenes.length) % imagenes.length);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const showForm = !evidencia || editMode;
  const isEditingExisting = Boolean(editMode && evidencia?.id);
  const pendingPreviewItems = files;
  const existingImageItems = (evidencia?.archivos || []).filter((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url && !removedImageIds.includes(archivo.id));
  const removedImageItems = (evidencia?.archivos || []).filter((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url && removedImageIds.includes(archivo.id));

  return (
    <section className="flex flex-col gap-4 w-full pb-8">
      <Dialog
        open={showDeleteDialog}
        type="danger"
        title="Eliminar evidencia"
        message="¿Eliminar esta evidencia? Esta acción actualizará el estado de la actividad."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* Actividad Context Card */}
      {actividad && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-l-4 border-blue-500 p-3 rounded-r-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Actividad:</div>
          <div className="text-base font-semibold text-blue-900 dark:text-blue-200">{actividad.codigo} - {actividad.nombre}</div>
        </div>
      )}

      {/* Form Section (centred small card) */}
      {!evidencia && !editMode ? (
        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Sin evidencia registrada</h2>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Aún no tiene cargada la evidencia.</p>
              <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                Al cargar evidencia, la actividad se marcará como <span className="font-semibold">completada</span> para incluirla en el reporte final de evidencias.
              </div>
              <div className="flex justify-center">
                <button type="button" onClick={() => setEditMode(true)} className="px-4 py-2 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white">Cargar evidencia</button>
              </div>
            </div>
          </div>
        </div>
      ) : showForm && (
        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-lg p-6" onPaste={onPaste}>
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{isEditingExisting ? 'Editar Evidencia' : 'Registrar Evidencia'}</h2>

              {/* Images area moved to bottom of form (see below) */}

              {/* Compact inputs */}
              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Resultados logrados</label>
                <textarea
                  placeholder="los resultados logrados en esta actividad son..."
                  className={poaTextAreaClass}
                  value={formData.resultados_logrados}
                  onChange={(e) => handleFormChange('resultados_logrados', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[110px_110px_160px] gap-3 mb-3 items-center">
                <div className="min-w-0">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block min-h-[2.5rem] leading-tight flex items-end">Programado</label>
                  <select className={poaCompactFieldClass} value={formData.programado} onChange={(e) => handleFormChange('programado', Number(e.target.value))}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block min-h-[2.5rem] leading-tight flex items-end">Ejecutado</label>
                  <select className={poaCompactFieldClass} value={formData.ejecutado} onChange={(e) => handleFormChange('ejecutado', Number(e.target.value))}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block min-h-[2.5rem] leading-tight flex items-end">Grado de cumplimiento (%)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={`${poaCompactFieldClass} w-full`}
                    placeholder="numero"
                    value={formData.grado_cumplimiento}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '');
                      handleFormChange('grado_cumplimiento', digitsOnly);
                    }}
                  />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 block">Medios (links)</label>
                  <button
                    type="button"
                    onClick={addLinkItem}
                    className="text-xs font-semibold text-green-600 hover:text-green-700"
                  >
                    Agregar enlace
                  </button>
                </div>
                <div className="space-y-2">
                  {linkItems.map((item, index) => (
                    <div key={item.id} className="flex gap-2">
                      <input
                        type="url"
                        className={poaFieldClass}
                        placeholder={`https://ejemplo.com/enlace-${index + 1}`}
                        value={item.url}
                        onChange={(e) => updateLinkItem(item.id, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeLinkItem(item.id)}
                        className="px-3 py-2 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Puedes editar los enlaces existentes o eliminarlos antes de guardar.
                </p>
              </div>

              {/* Sección de imágenes dentro de la tarjeta del formulario */}
              <div className="mt-6 rounded-xl border border-dashed border-green-400/70 bg-green-50/30 dark:bg-green-900/10 p-4">
                <div
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  onPaste={onPaste}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDrop}
                  tabIndex={0}
                  className="mb-4 flex min-h-44 items-center justify-center flex-col gap-3 rounded-lg border-2 border-dashed border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10 cursor-pointer px-4 py-6 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <div className="text-5xl">🖼️</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 max-w-sm">Pega aquí tus imágenes (Ctrl+V), arrástralas o haz click para seleccionar</div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      fileInputRef.current && fileInputRef.current.click();
                    }}
                    className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
                  >
                    Seleccionar imágenes
                  </button>
                  <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={onFileChange} className="hidden" />
                </div>

                {pendingPreviewItems.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Imágenes listas para guardar ({pendingPreviewItems.length})
                      </h3>
                      <button
                        type="button"
                        onClick={clearPendingFiles}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Limpiar todo
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {pendingPreviewItems.map((item) => (
                        <div key={item.id} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                          <img src={item.previewUrl} alt={item.file.name} className="h-28 w-full object-cover" />
                          <div className="p-2">
                            <div className="truncate text-[11px] text-gray-600 dark:text-gray-400">{item.file.name}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePendingFile(item.id)}
                            className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white opacity-90 group-hover:opacity-100"
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editMode && evidencia?.archivos?.some((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url) && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Imágenes guardadas ({existingImageItems.length} activas{removedImageItems.length > 0 ? `, ${removedImageItems.length} marcadas para eliminar` : ''})
                      </h3>
                    </div>
                    {existingImageItems.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {existingImageItems.map((archivo) => (
                          <div key={archivo.id} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                            <img src={archivo.archivo_url} alt={`Imagen guardada ${archivo.id}`} className="h-28 w-full object-cover" />
                            <div className="p-2 flex items-center justify-between gap-2">
                              <div className="truncate text-[11px] text-gray-600 dark:text-gray-400">Guardada</div>
                              <button
                                type="button"
                                onClick={() => markImageForRemoval(archivo.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
                        No quedan imágenes activas. Si cambias de idea, puedes volver a cargar nuevas antes de guardar.
                      </div>
                    )}

                    {removedImageItems.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Marcadas para eliminar</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {removedImageItems.map((archivo) => (
                            <div key={archivo.id} className="group relative overflow-hidden rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 opacity-75">
                              <img src={archivo.archivo_url} alt={`Imagen marcada ${archivo.id}`} className="h-28 w-full object-cover grayscale" />
                              <div className="p-2 flex items-center justify-between gap-2">
                                <div className="truncate text-[11px] text-red-700 dark:text-red-300">Se eliminará al guardar</div>
                                <button
                                  type="button"
                                  onClick={() => unmarkImageRemoval(archivo.id)}
                                  className="rounded-md border border-green-300 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                                >
                                  Deshacer
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className={poaCancelButtonClass}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className={poaSaveButtonClass}>
                  {submitting ? 'Guardando...' : (isEditingExisting ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidencia Display (si existe y no en editMode) */}
      {evidencia && !editMode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">✅</div>
                <h3 className="text-xl font-bold">Evidencia Registrada</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition"
                >
                  <FaEdit size={16} />
                  Editar
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition"
                >
                  <FaTrash size={16} />
                  Eliminar
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6">
            

            {/* Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-300 dark:border-blue-600/50 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">📅 Programado para la gestion:</div>
                <div className="text-4xl font-bold text-blue-700 dark:text-blue-300">{evidencia.programado}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">planificada</div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-300 dark:border-green-600/50 rounded-xl p-4">
                <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">✔️ Ejecutado en la gestion:</div>
                <div className="text-4xl font-bold text-green-700 dark:text-green-300">{evidencia.ejecutado}</div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">completada</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-300 dark:border-purple-600/50 rounded-xl p-4">
                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">🎯El grado de cumplimiento para esta actividad es de:</div>
                <div className="text-4xl font-bold text-purple-700 dark:text-purple-300">{evidencia.grado_cumplimiento}%</div>
                <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(evidencia.grado_cumplimiento, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="text-xl">📝</span>
                Resultados Logrados
              </h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                {evidencia.resultados_logrados}
              </p>
            </div>

            {/* Timestamp */}
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <div>
                📅 Registrada: <span className="font-semibold">{new Date(evidencia.creado_en).toLocaleString()}</span>
              </div>
              <div className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full font-semibold">
                Estado: Completada
              </div>
            </div>
            {/* Gallery Section (moved to bottom) */}
            {(() => {
              const imagenes = evidencia.archivos.filter(a => a.tipo === 'imagen' && a.archivo_url);
              const links = evidencia.archivos.filter(a => a.tipo === 'link' && a.url);

              if (imagenes.length > 0) {
                return (
                  <div className="mt-8">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span className="text-xl">🖼️</span>
                          Evidencia Visual ({imagenes.length} imagen{imagenes.length !== 1 ? 'es' : ''})
                        </h4>
                        {imagenes.length > 1 && (
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {carouselIndex + 1} / {imagenes.length}
                          </div>
                        )}
                      </div>

                      {/* Main Image Display */}
                      <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl overflow-hidden shadow-lg group">
                        <img
                          src={imagenes[carouselIndex].archivo_url}
                          alt={`Evidencia ${carouselIndex + 1}`}
                          className="w-full h-80 sm:h-96 md:h-[450px] object-contain transition-transform duration-300"
                        />

                        {/* Navigation Arrows */}
                        {imagenes.length > 1 && (
                          <>
                            <button
                              onClick={prevImage}
                              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full transition z-10 opacity-0 group-hover:opacity-100"
                            >
                              <FaChevronLeft size={20} />
                            </button>
                            <button
                              onClick={nextImage}
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full transition z-10 opacity-0 group-hover:opacity-100"
                            >
                              <FaChevronRight size={20} />
                            </button>
                          </>
                        )}

                        {/* Slide Counter */}
                        {imagenes.length > 1 && (
                          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-semibold">
                            {carouselIndex + 1} / {imagenes.length}
                          </div>
                        )}
                      </div>

                      {/* Thumbnail Strip */}
                      {imagenes.length > 1 && (
                        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                          {imagenes.map((img, idx) => (
                            <button
                              key={img.id}
                              onClick={() => setCarouselIndex(idx)}
                              className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${
                                idx === carouselIndex
                                  ? 'ring-2 ring-green-500 scale-105'
                                  : 'opacity-60 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={img.archivo_url}
                                alt={`Thumbnail ${idx + 1}`}
                                className="w-20 h-20 object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Links Section (moved to bottom) */}
            {(() => {
              const links = evidencia.archivos.filter(a => a.tipo === 'link' && a.url);
              if (links.length > 0) {
                return (
                  <div className="mt-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700/50">
                    <h4 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <FaLink size={18} />
                      Medios de Verificación ({links.length} enlace{links.length !== 1 ? 's' : ''})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {links.map((link, idx) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition border border-blue-300 dark:border-blue-600/50 group"
                        >
                          <div className="text-blue-600 dark:text-blue-400 text-xl flex-shrink-0">🔗</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Enlace {idx + 1}</div>
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate group-hover:underline">
                              {new URL(link.url).hostname || link.url}
                            </div>
                          </div>
                          <FaFileDownload size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </section>
  );
};

export default EvidenciaPage;
