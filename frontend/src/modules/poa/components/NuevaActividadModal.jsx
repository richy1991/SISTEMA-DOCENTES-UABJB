import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createActividad, updateActividad, getCatalogoOperaciones, searchOperacionesCatalogo } from '../../../apis/poa.api';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';
import { Input, Textarea, Select, Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const NuevaActividadModal = ({ onClose, onCreated, onUpdated, objetivoId, actividad }) => {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const nombreRef = useRef(null);
  const [responsable, setResponsable] = useState('');
  const responsableRef = useRef(null);
  const [productos, setProductos] = useState('');
  const productosRef = useRef(null);
  const [mesInicio, setMesInicio] = useState('enero');
  const [mesFin, setMesFin] = useState('diciembre');
  const [indicadorSeleccionado, setIndicadorSeleccionado] = useState(null);
  const [indicadorUnidad, setIndicadorUnidad] = useState('numero');
  const [indicadorLineaBase, setIndicadorLineaBase] = useState('');
  const [indicadorMeta, setIndicadorMeta] = useState('');
  const [estado, setEstado] = useState('programado');
  const [operaciones, setOperaciones] = useState([]);
  const [actividadCatalogoId, setActividadCatalogoId] = useState('');
  const [indicadorQuery, setIndicadorQuery] = useState('');
  const [indicadorSuggestions, setIndicadorSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const skipNextSearchRef = useRef(false);

  const focusFirstError = (errors) => {
    const firstKey = Object.keys(errors || {})[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const field = document.querySelector(`[name="${firstKey}"]`);
      if (field) {
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const indicadorLabel = useCallback((item) => {
    if (!item) return '';
    const indicadorField = typeof item.indicador === 'string'
      ? item.indicador
      : (item.indicador?.nombre || item.indicador?.descripcion);
    return indicadorField || item.nombre || item.descripcion || item.label || item.titulo || `#${item.id}`;
  }, []);

  useEffect(() => {
    if (!actividad) return;
    try {
      setCodigo(actividad.codigo || '');
      setNombre(actividad.nombre || '');
      setResponsable(actividad.responsable || '');
      setProductos(actividad.productos_esperados || actividad.productos || '');
      setMesInicio(actividad.mes_inicio || actividad.mes || actividad.fecha_inicio || '');
      setMesFin(actividad.mes_fin || '');
      setEstado(actividad.estado || 'programado');
      if (actividad.indicador && typeof actividad.indicador === 'object') {
        setIndicadorSeleccionado(actividad.indicador);
        setIndicadorQuery(actividad.indicador.descripcion || actividad.indicador.nombre || '');
        setIndicadorUnidad(actividad.indicador.unidad || actividad.indicador.indicador_unidad || indicadorUnidad);
        setIndicadorLineaBase(actividad.indicador.linea_base ?? actividad.indicador.indicador_linea_base ?? actividad.indicador.lineaBase ?? '');
        setIndicadorMeta(actividad.indicador.meta ?? actividad.indicador.indicador_meta ?? '');
      } else if (actividad.indicador && typeof actividad.indicador === 'string') {
        setIndicadorSeleccionado(null);
        setIndicadorQuery(actividad.indicador);
      } else if (actividad.indicador_descripcion) {
        setIndicadorSeleccionado(null);
        setIndicadorQuery(actividad.indicador_descripcion);
      }

      const buscarValor = (candidates) => {
        for (const c of candidates) {
          if (c !== undefined && c !== null && c !== '') return c;
        }
        return '';
      };

      const lbCandidates = [
        actividad.indicador?.linea_base,
        actividad.indicador?.indicador_linea_base,
        actividad.indicador?.lineaBase,
        actividad.indicador_linea_base,
        actividad.indicador_lineaBase,
        actividad.linea_base,
        actividad.lineaBase,
        actividad.indicador_linea_base,
      ];
      const metaCandidates = [
        actividad.indicador?.meta,
        actividad.indicador?.indicador_meta,
        actividad.indicador_meta,
        actividad.meta,
        actividad.indicador_meta,
      ];

      const foundLB = buscarValor(lbCandidates);
      const foundMeta = buscarValor(metaCandidates);
      if (foundLB !== '') setIndicadorLineaBase(String(foundLB));
      if (foundMeta !== '') setIndicadorMeta(String(foundMeta));

      if (actividad.catalogo_operacion_id) setActividadCatalogoId(String(actividad.catalogo_operacion_id));
    } catch (e) {
      // silencioso
    }
  }, [actividad, indicadorUnidad]);

  const handleCreate = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setErrorMessages([]);
    setFieldErrors({});
    const clientErrors = {};
    if (!codigo || String(codigo).trim() === '' || String(codigo).trim() === 'AC-') clientErrors.codigo = 'El código es obligatorio y no puede quedarse como "AC-".';
    if (!nombre || String(nombre).trim() === '') clientErrors.nombre = 'El nombre es obligatorio.';
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setErrorMessages(buildClientErrorMessages(clientErrors));
      focusFirstError(clientErrors);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        objetivo_id: Number(objetivoId),
        codigo: codigo || '',
        nombre,
        productos_esperados: productos || '',
      };
      if (responsable) payload.responsable = responsable;
      if (mesInicio) payload.mes_inicio = mesInicio;
      if (mesFin) payload.mes_fin = mesFin;
      if (estado) payload.estado = estado;
      if (indicadorSeleccionado) {
        payload.indicador_descripcion = indicadorSeleccionado.descripcion || indicadorSeleccionado.nombre || String(indicadorQuery || '');
      } else if (indicadorQuery && String(indicadorQuery).trim() !== '') {
        payload.indicador_descripcion = String(indicadorQuery).trim();
      }
      if (indicadorUnidad) payload.indicador_unidad = indicadorUnidad;
      if (indicadorLineaBase !== '') payload.indicador_linea_base = Number(indicadorLineaBase);
      if (indicadorMeta !== '') payload.indicador_meta = Number(indicadorMeta);
      if (actividadCatalogoId) payload.catalogo_operacion_id = Number(actividadCatalogoId);

      let res;
      if (actividad && actividad.id) {
        res = await updateActividad(actividad.id, payload);
        if (onUpdated) onUpdated(res.data);
      } else {
        res = await createActividad(payload);
        if (onCreated) onCreated(res.data);
      }
      if (onClose) onClose();
    } catch (err) {
      const messages = formatApiErrors(err?.response?.data ?? err?.message ?? err);
      const nextFieldErrors = mapApiErrorsToFieldErrors(err?.response?.data || {});
      setFieldErrors(nextFieldErrors);
      setErrorMessages(messages);
      focusFirstError(nextFieldErrors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    getCatalogoOperaciones()
      .then(r => {
        if (!mounted) return;
        const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
        const defaults = (list || []).slice(0, 2);
        setOperaciones(defaults);
        if (defaults.length > 0) setActividadCatalogoId(String(defaults[0].id));
      })
      .catch(() => { /* silencioso */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (!indicadorQuery || String(indicadorQuery).trim().length < 2) {
      setIndicadorSuggestions([]);
      return;
    }
    let mounted = true;
    searchOperacionesCatalogo(indicadorQuery)
      .then(r => {
        if (!mounted) return;
        const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
        const normalizedQuery = String(indicadorQuery).trim().toLowerCase();
        const filtered = (list || []).filter(item => indicadorLabel(item).toLowerCase().includes(normalizedQuery));
        setIndicadorSuggestions(filtered);
      })
      .catch(() => setIndicadorSuggestions([]));
    return () => { mounted = false; };
  }, [indicadorQuery, indicadorLabel]);

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-11/12 max-w-4xl">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="font-semibold">{actividad && actividad.id ? 'Editar Actividad' : 'Nueva Actividad'}</div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">

          <ModalErrorAlert title="No se pudo guardar la actividad:" messages={errorMessages} />

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-2">
                <Input
                  label="Código"
                  name="codigo"
                  value={codigo}
                  onChange={e => {
                    setCodigo(e.target.value);
                    if (fieldErrors.codigo) setFieldErrors(prev => ({ ...prev, codigo: '' }));
                  }}
                  maxLength={6}
                  error={fieldErrors.codigo}
                />
              </div>
              <div className="col-span-7">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nombre</label>
                <Textarea
                  name="nombre"
                  ref={nombreRef}
                  value={nombre}
                  onChange={e => {
                    const val = e.target.value;
                    setNombre(val);
                    if (fieldErrors.nombre) setFieldErrors(prev => ({ ...prev, nombre: '' }));
                    requestAnimationFrame(() => {
                      if (nombreRef.current) {
                        nombreRef.current.scrollTop = nombreRef.current.scrollHeight;
                      }
                    });
                  }}
                  className="overflow-auto"
                  rows={2}
                  error={fieldErrors.nombre}
                />
              </div>
              <div className="col-span-3">
                <Input
                  label="Responsable"
                  name="responsable"
                  value={responsable}
                  ref={responsableRef}
                  onChange={e => {
                    const val = e.target.value;
                    setResponsable(val);
                    if (fieldErrors.responsable) setFieldErrors(prev => ({ ...prev, responsable: '' }));
                    requestAnimationFrame(() => {
                      if (responsableRef.current) {
                        responsableRef.current.scrollLeft = responsableRef.current.scrollWidth;
                      }
                    });
                  }}
                  className="overflow-x-auto whitespace-nowrap"
                  error={fieldErrors.responsable}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Productos esperados</label>
              <Textarea
                name="productos_esperados"
                ref={productosRef}
                value={productos}
                onChange={e => {
                  const val = e.target.value;
                  setProductos(val);
                  if (fieldErrors.productos_esperados) setFieldErrors(prev => ({ ...prev, productos_esperados: '' }));
                  requestAnimationFrame(() => {
                    if (productosRef.current) {
                      productosRef.current.scrollTop = productosRef.current.scrollHeight;
                    }
                  });
                }}
                className="overflow-auto"
                rows={3}
                error={fieldErrors.productos_esperados}
              />
            </div>

            {/* Indicador / meta / unidad */}
            <div className="grid grid-cols-12 gap-2 relative items-start">
              <div className="col-span-7">
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Indicador (buscar)</label>
                <input
                  name="indicador_descripcion"
                  value={indicadorQuery}
                  onChange={e => {
                    setIndicadorQuery(e.target.value);
                    setIndicadorSeleccionado(null);
                    if (fieldErrors.indicador_descripcion) setFieldErrors(prev => ({ ...prev, indicador_descripcion: '' }));
                  }}
                  placeholder="Escribe para buscar..."
                  autoComplete="off"
                  className={`poa-input mt-1 block w-full rounded px-2 py-1 text-xs ${fieldErrors.indicador_descripcion ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                />
                {indicadorSuggestions && indicadorSuggestions.length > 0 && (
                  <ul className="absolute bg-white dark:bg-slate-800 border dark:border-slate-600 rounded mt-1 w-full max-h-44 overflow-auto z-30 shadow-lg">
                    {indicadorSuggestions.map(s => {
                      const label = indicadorLabel(s);
                      return (
                        <li
                          key={s.id}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-gray-900 dark:text-slate-100"
                          onClick={() => {
                            skipNextSearchRef.current = true;
                            setIndicadorSeleccionado(s);
                            setIndicadorQuery(label);
                            setIndicadorSuggestions([]);
                          }}
                        >
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="col-span-3">
                <Select
                  label="Unidad"
                  name="indicador_unidad"
                  value={indicadorUnidad}
                  onChange={e => {
                    setIndicadorUnidad(e.target.value);
                    if (fieldErrors.indicador_unidad) setFieldErrors(prev => ({ ...prev, indicador_unidad: '' }));
                  }}
                  className="text-xs"
                  error={fieldErrors.indicador_unidad}
                >
                  <option value="numero">Número</option>
                  <option value="porcentaje">Porcentaje</option>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  label="Línea base"
                  name="indicador_linea_base"
                  type="number"
                  value={indicadorLineaBase}
                  onChange={e => {
                    setIndicadorLineaBase(e.target.value);
                    if (fieldErrors.indicador_linea_base) setFieldErrors(prev => ({ ...prev, indicador_linea_base: '' }));
                  }}
                  className="text-xs"
                  error={fieldErrors.indicador_linea_base}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-12 gap-2 items-center">
              <div className="col-span-1 md:col-span-3">
                <Input
                  label="Meta"
                  name="indicador_meta"
                  type="number"
                  value={indicadorMeta}
                  onChange={e => {
                    setIndicadorMeta(e.target.value);
                    if (fieldErrors.indicador_meta) setFieldErrors(prev => ({ ...prev, indicador_meta: '' }));
                  }}
                  className="text-xs"
                  error={fieldErrors.indicador_meta}
                />
              </div>
              <div className="col-span-1 md:col-span-3">
                <Select
                  label="Estado"
                  name="estado"
                  value={estado}
                  onChange={e => {
                    setEstado(e.target.value);
                    if (fieldErrors.estado) setFieldErrors(prev => ({ ...prev, estado: '' }));
                  }}
                  className="text-xs"
                  error={fieldErrors.estado}
                >
                  <option value="programado">Programado</option>
                  <option value="en_ejecucion">En ejecución</option>
                  <option value="completado">Completado</option>
                  <option value="cancelado">Cancelado</option>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-3">
                <Input
                  label="Mes inicio"
                  name="mes_inicio"
                  value={mesInicio}
                  onChange={e => {
                    setMesInicio(e.target.value);
                    if (fieldErrors.mes_inicio) setFieldErrors(prev => ({ ...prev, mes_inicio: '' }));
                  }}
                  className="text-xs"
                  error={fieldErrors.mes_inicio}
                />
              </div>
              <div className="col-span-1 md:col-span-3">
                <Input
                  label="Mes fin"
                  name="mes_fin"
                  value={mesFin}
                  onChange={e => {
                    setMesFin(e.target.value);
                    if (fieldErrors.mes_fin) setFieldErrors(prev => ({ ...prev, mes_fin: '' }));
                  }}
                  className="text-xs"
                  error={fieldErrors.mes_fin}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 modal-actions">
              <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-cancel px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={loading} className="btn-success px-3 py-2 rounded" title={loading ? 'Guardando...' : (actividad && actividad.id ? 'Guardar' : 'Crear')}>
                {loading ? 'Guardando...' : (actividad && actividad.id ? 'Guardar' : 'Crear')}
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default NuevaActividadModal;
