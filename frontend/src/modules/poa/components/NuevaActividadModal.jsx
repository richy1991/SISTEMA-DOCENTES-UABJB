import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createActividad, updateActividad, getCatalogoOperaciones, searchOperacionesCatalogo } from '../../../apis/poa.api';
import IconButton from './IconButton';
import { FaTimes, FaSave } from 'react-icons/fa';

const formatError = (err) => {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    // DRF usually returns dict of field -> [errors]
    if (Array.isArray(err)) return err.join(', ');
    try {
      // Convertir objeto a string legible
      return Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : String(v)}`).join(' | ');
    } catch (e) {
      return String(err);
    }
  }
  return String(err);
};

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
  // ahora guardamos la descripción del indicador; el usuario busca y selecciona un indicador
  // guardamos el objeto seleccionado para poder rellenar la descripción cuando se cree la actividad
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
  const [error, setError] = useState(null);
  const skipNextSearchRef = useRef(false);

  const indicadorLabel = useCallback((item) => {
    if (!item) return '';
    const indicadorField = typeof item.indicador === 'string'
      ? item.indicador
      : (item.indicador?.nombre || item.indicador?.descripcion);
    return indicadorField || item.nombre || item.descripcion || item.label || item.titulo || `#${item.id}`;
  }, []);

  // Cuando se pasa una actividad (modo edición), precargar los campos
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
      // indicador: puede ser objeto o string
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

      // A veces la línea base / meta vienen en otras claves del objeto actividad (no dentro de `indicador`).
      // Buscar en varias posibles propiedades y asignar sólo si aún no tenemos valor.
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

      // actividad de catálogo
      if (actividad.catalogo_operacion_id) setActividadCatalogoId(String(actividad.catalogo_operacion_id));
    } catch (e) {
      // silencioso
    }
  }, [actividad]);

  const handleCreate = async (e) => {
    e && e.preventDefault && e.preventDefault();
  setError(null);
  // Validaciones mínimas: el endpoint requiere objetivo_id, codigo y nombre
  if (!codigo || String(codigo).trim() === '' || String(codigo).trim() === 'AC-') return setError('El código es obligatorio y no puede quedarse como "AC-"');
  if (!nombre || String(nombre).trim() === '') return setError('El nombre es obligatorio');
    setLoading(true);
    try {
      const payload = {
        // El backend espera el campo `objetivo_id` con el id del objetivo relacionado
        objetivo_id: Number(objetivoId),
        codigo: codigo || '',
        nombre,
        // `productos_esperados` es requerido por el servidor; enviarlo siempre (cadena vacía si no hay valor)
        productos_esperados: productos || '',
      };
      // Campos opcionales: añadimos solo si tienen valor (excepto productos_esperados que ya se incluyó)
      if (responsable) payload.responsable = responsable;
      if (mesInicio) payload.mes_inicio = mesInicio;
      if (mesFin) payload.mes_fin = mesFin;
      if (estado) payload.estado = estado;
      // El backend ahora espera la descripción del indicador (texto). Si el usuario seleccionó
      // una sugerencia, usamos su nombre/descripcion; si no, enviamos la cadena que escribió.
      if (indicadorSeleccionado) {
        payload.indicador_descripcion = indicadorSeleccionado.descripcion || indicadorSeleccionado.nombre || String(indicadorQuery || '');
      } else if (indicadorQuery && String(indicadorQuery).trim() !== '') {
        payload.indicador_descripcion = String(indicadorQuery).trim();
      }
      if (indicadorUnidad) payload.indicador_unidad = indicadorUnidad;
      if (indicadorLineaBase !== '') payload.indicador_linea_base = Number(indicadorLineaBase);
      if (indicadorMeta !== '') payload.indicador_meta = Number(indicadorMeta);
      // Enviar id del catálogo de operación (actividad) si fue seleccionado
      if (actividadCatalogoId) payload.catalogo_operacion_id = Number(actividadCatalogoId);

      let res;
      if (actividad && actividad.id) {
        // Modo edición: actualizar
        res = await updateActividad(actividad.id, payload);
        if (onUpdated) onUpdated(res.data);
      } else {
        // Modo creación
        res = await createActividad(payload);
        if (onCreated) onCreated(res.data);
      }
      if (onClose) onClose();
    } catch (err) {
      // Guardamos el body de error para formatearlo en el render
      const data = err?.response?.data ?? err?.message ?? err;
      setError(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Traer algunas operaciones iniciales (primeras páginas) para no mostrar empty
    let mounted = true;
    getCatalogoOperaciones()
      .then(r => {
        if (!mounted) return;
        const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
        // Tomar las primeras 2 opciones por defecto según petición
        const defaults = (list || []).slice(0, 2);
        setOperaciones(defaults);
        // si hay al menos una opción, preseleccionar la primera
        if (defaults.length > 0) setActividadCatalogoId(String(defaults[0].id));
      })
      .catch(() => { /* silencioso */ });
    return () => { mounted = false; };
  }, []);

  // Buscar sugerencias cuando cambia la query del indicador
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

  const formatCurrency = (v) => {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
    if (Number.isNaN(n)) return '';
    // Formato simple: usar Intl
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const parseCurrencyToNumber = (formatted) => {
    if (!formatted && formatted !== 0) return null;
    const raw = String(formatted).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
    <div className="relative z-20 w-11/12 max-w-4xl modal-panel card-elegant oe-modern rounded-xl overflow-hidden">
        <div className="modal-header flex items-center justify-between px-6 py-4">
            <div className="font-semibold">{actividad && actividad.id ? 'Editar Actividad' : 'Nueva Actividad'}</div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
          <div className="p-6 modal-body">

        {error && (
          <div className="text-red-600 mb-3">
            {formatError(error)}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Código</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)} maxLength={6} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
            <div className="col-span-7">
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <textarea
                ref={nombreRef}
                value={nombre}
                onChange={e => {
                  const val = e.target.value;
                  setNombre(val);
                  // Mantener visible el texto mientras escribe (scroll al fondo)
                  requestAnimationFrame(() => {
                    if (nombreRef.current) {
                      nombreRef.current.scrollTop = nombreRef.current.scrollHeight;
                    }
                  });
                }}
                className="mt-1 block w-full border rounded px-3 py-2 overflow-auto"
                rows={2}
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700">Responsable</label>
              <input
                ref={responsableRef}
                value={responsable}
                onChange={e => {
                  const val = e.target.value;
                  setResponsable(val);
                  requestAnimationFrame(() => {
                    if (responsableRef.current) {
                      responsableRef.current.scrollLeft = responsableRef.current.scrollWidth;
                    }
                  });
                }}
                className="mt-1 block w-full border rounded px-3 py-2 overflow-x-auto whitespace-nowrap"
                style={{ WebkitOverflowScrolling: 'touch' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Productos esperados</label>
            <textarea
              ref={productosRef}
              value={productos}
              onChange={e => {
                const val = e.target.value;
                setProductos(val);
                requestAnimationFrame(() => {
                  if (productosRef.current) {
                    productosRef.current.scrollTop = productosRef.current.scrollHeight;
                  }
                });
              }}
              className="mt-1 block w-full border rounded px-3 py-2 overflow-auto"
              rows={3}
            />
          </div>

          {/* Indicador / meta / unidad */}
          <div className="grid grid-cols-12 gap-2 relative items-start">
            <div className="col-span-7">
              <label className="block text-xs font-medium text-gray-700">Indicador (buscar)</label>
              <input value={indicadorQuery} onChange={e => { setIndicadorQuery(e.target.value); setIndicadorSeleccionado(null); }} placeholder="Escribe para buscar..." autoComplete="off" className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
              {/* suggestions */}
              {indicadorSuggestions && indicadorSuggestions.length > 0 && (
                <ul className="absolute bg-white dark:bg-gray-800 border dark:border-gray-600 rounded mt-1 w-full max-h-44 overflow-auto z-30">
                  {indicadorSuggestions.map(s => {
                    const label = indicadorLabel(s);
                    return (
                      <li
                        key={s.id}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"
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
              <label className="block text-xs font-medium text-gray-700">Unidad</label>
              <select value={indicadorUnidad} onChange={e => setIndicadorUnidad(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1 text-xs">
                <option value="numero">Número</option>
                <option value="porcentaje">Porcentaje</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700">Línea base</label>
              <input type="number" value={indicadorLineaBase} onChange={e => setIndicadorLineaBase(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-12 gap-2 items-center">
            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-gray-700">Meta</label>
              <input type="number" value={indicadorMeta} onChange={e => setIndicadorMeta(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
            </div>
            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-gray-700">Estado</label>
              <select value={estado} onChange={e => setEstado(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1 text-xs">
                <option value="programado">Programado</option>
                <option value="en_ejecucion">En ejecución</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-gray-700">Mes inicio</label>
              <input value={mesInicio} onChange={e => setMesInicio(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
            </div>
            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-gray-700">Mes fin</label>
              <input value={mesFin} onChange={e => setMesFin(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
            </div>
          </div>

          <div className="flex justify-end gap-3 modal-actions">
            <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="px-3 py-2 border rounded" title="Cancelar">Cancelar</IconButton>
            <IconButton icon={<FaSave />} type="submit" disabled={loading} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" title={loading ? 'Guardando...' : (actividad && actividad.id ? 'Guardar' : 'Crear')}>{loading ? 'Guardando...' : (actividad && actividad.id ? 'Guardar' : 'Crear')}</IconButton>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
};

export default NuevaActividadModal;
