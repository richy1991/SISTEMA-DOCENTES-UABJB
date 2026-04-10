// API centralizado para POA
import axios from 'axios';

export const API_BASE = 'http://127.0.0.1:8000';

// Cliente axios centralizado
const api = axios.create({ baseURL: API_BASE, withCredentials: true });

api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('access_token');
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

// Helper: rechazar como si fuera un error axios con response.status = 400
const badRequest = (data) => Promise.reject({ response: { status: 400, data } });

api.interceptors.response.use(
	(r) => r,
	async (error) => {
		const originalRequest = error?.config;

		if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
			originalRequest._retry = true;

			try {
				const refreshToken = localStorage.getItem('refresh_token');
				if (!refreshToken) {
					localStorage.clear();
					window.location.href = '/login';
					return Promise.reject(error);
				}

				const response = await axios.post(`${API_BASE}/api/token/refresh/`, {
					refresh: refreshToken,
				});

				const newAccessToken = response.data.access;
				localStorage.setItem('access_token', newAccessToken);
				originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
				return api(originalRequest);
			} catch (refreshError) {
				localStorage.clear();
				window.location.href = '/login';
				return Promise.reject(refreshError);
			}
		}

		return Promise.reject(error);
	}
);

// Direcciones (expuestas por el app poa_document según apis.md)
// Endpoint: GET /api/poa/direcciones/
export const getAllDirecciones = () => api.get('/api/poa/direcciones/');
export const getDireccionPorId = (id) => api.get(`/api/poa/direcciones/${id}/`);
export const createDireccion = (payload) => api.post('/api/poa/direcciones/', payload);
export const updateDireccion = (id, payload) => api.patch(`/api/poa/direcciones/${id}/`, payload);
export const deleteDireccion = (id) => api.delete(`/api/poa/direcciones/${id}/`);
// Buscar direcciones por texto (usa parámetro 'search' compatible con DRF SearchFilter)
export const searchDirecciones = (q) => api.get('/api/poa/direcciones/', { params: { search: q } });

// Documentos POA
// Encabezados (solo lectura). Si no envías gestion, el backend devuelve la del año actual.
export const getDocumentosPOAEncabezados = (gestion) => api.get('/api/poa/documentos_poa_encabezados/', { params: { gestion } });

// Lista de documentos filtrados por gestion (gestion obligatorio)
export const getDocumentosPOAPorGestion = (gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/poa/documentos_poa/', { params: { gestion: Number(gestion) } });
};

// Recuperar detalle de un documento (requiere ?gestion=YYYY)
export const getDocumentoPOAPorId = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get(`/api/poa/documentos_poa/${id}/`, { params: { gestion: Number(gestion) } });
};

// Obtener árbol (documento + objetivos + actividades + detalle_presupuesto)
export const getDocumentoPOATree = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get(`/api/poa/documentos_poa/${id}/tree/`, { params: { gestion: Number(gestion) } });
};

// Compatibilidad: antigua función que listaba encabezados
export const getAllDocumentosPOA = (gestion) => getDocumentosPOAEncabezados(gestion);

// CRUD Documentos
export const createDocumentoPOA = (payload) => {
	// Validaciones mínimas en cliente
	if (!payload || (payload.gestion === undefined || payload.gestion === null || Number.isNaN(Number(payload.gestion)))) {
		return badRequest({ gestion: ['El campo "gestion" es obligatorio y debe ser un entero.'] });
	}
	// payload debe contener al menos unidad_solicitante_id y programa en el servidor; aquí no forzamos todo
	return api.post('/api/poa/documentos_poa/', payload);
};

export const updateDocumentoPOA = (id, payload, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.patch(`/api/poa/documentos_poa/${id}/`, payload, { params: { gestion: Number(gestion) } });
};

export const deleteDocumentoPOA = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.delete(`/api/poa/documentos_poa/${id}/`, { params: { gestion: Number(gestion) } });
};

export const getHistorialDocumentoPOA = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion))) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio.'] });
	}
	return api.get(`/api/poa/documentos_poa/${id}/historial/`, { params: { gestion: Number(gestion) } });
};

export const enviarRevisionDocumentoPOA = (id, gestion, revisoresIds = []) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	if (!Array.isArray(revisoresIds) || revisoresIds.length !== 2) {
		return badRequest({ revisores_ids: ['Debe seleccionar exactamente 2 entidades revisoras.'] });
	}
	return api.post(`/api/poa/documentos_poa/${id}/enviar-revision/`, { revisores_ids: revisoresIds.map((value) => Number(value)) }, { params: { gestion: Number(gestion) } });
};

export const aprobarDocumentoPOA = (id, gestion, observacion = '') => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	const payload = observacion ? { observacion } : {};
	return api.post(`/api/poa/documentos_poa/${id}/aprobar/`, payload, { params: { gestion: Number(gestion) } });
};

export const observarDocumentoPOA = (id, gestion, observaciones) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	if (!observaciones || !String(observaciones).trim()) {
		return badRequest({ observaciones: ['Debe registrar observaciones para marcar como observado.'] });
	}
	return api.post(`/api/poa/documentos_poa/${id}/observar/`, { observaciones: String(observaciones).trim() }, { params: { gestion: Number(gestion) } });
};

// Reportes POA (mismo patrón que el sistema principal: axios + blob)
export const descargarReporteGeneralPOA = (gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion))) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/reportes/generar-reporte-general/', {
		params: { gestion: Number(gestion) },
		responseType: 'blob',
	});
};

export const descargarReporteDocumentoPOA = (documentoId, gestion) => {
	if (documentoId === undefined || documentoId === null || Number.isNaN(Number(documentoId))) {
		return badRequest({ documento_id: ['El parámetro "documento_id" es obligatorio y debe ser un entero.'] });
	}
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion))) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get(`/api/poa/documentos_poa/${Number(documentoId)}/pdf-oficial/`, {
		params: { gestion: Number(gestion) },
		responseType: 'blob',
	});
};

// Objetivos específicos
export const getObjetivosEspecificos = (documento_id) => {
	if (documento_id === undefined || documento_id === null || Number.isNaN(Number(documento_id))) {
		return badRequest({ documento_id: ['El parámetro "documento_id" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/poa/objetivos-especificos/', { params: { documento_id: Number(documento_id) } });
};

export const createObjetivoEspecifico = (payload) => {
	if (!payload || payload.documento_id === undefined || payload.documento_id === null || Number.isNaN(Number(payload.documento_id))) {
		return badRequest({ documento_id: ['El campo "documento_id" es obligatorio y debe ser un entero.'] });
	}
	if (!payload.codigo || !payload.descripcion) {
		return badRequest({ detail: ['Los campos "codigo" y "descripcion" son obligatorios.'] });
	}
	return api.post('/api/poa/objetivos-especificos/', payload);
};
export const getObjetivoPorId = (id) => api.get(`/api/poa/objetivos-especificos/${id}/`);
export const updateObjetivo = (id, payload) => api.patch(`/api/poa/objetivos-especificos/${id}/`, payload);
export const deleteObjetivo = (id) => api.delete(`/api/poa/objetivos-especificos/${id}/`);

// Actividades
export const getActividadesPorObjetivo = (objetivo_id, documento_id) => {
	if (objetivo_id === undefined || objetivo_id === null || Number.isNaN(Number(objetivo_id))) {
		return badRequest({ objetivo_id: ['El parámetro "objetivo_id" es obligatorio y debe ser un entero.'] });
	}
	const params = { objetivo_id: Number(objetivo_id) };
	if (documento_id !== undefined && documento_id !== null) params.documento_id = Number(documento_id);
	return api.get('/api/poa/actividades/', { params });
};

export const createActividad = (payload) => {
	if (!payload || payload.objetivo_id === undefined || payload.objetivo_id === null || Number.isNaN(Number(payload.objetivo_id))) {
		return badRequest({ objetivo_id: ['El campo "objetivo_id" es obligatorio y debe ser un entero.'] });
	}
	if (!payload.codigo || !payload.nombre) {
		return badRequest({ detail: ['Los campos "codigo" y "nombre" son obligatorios.'] });
	}
	return api.post('/api/poa/actividades/', payload);
};
export const getActividadPorId = (id) => api.get(`/api/poa/actividades/${id}/`);
export const updateActividad = (id, payload) => api.patch(`/api/poa/actividades/${id}/`, payload);
export const deleteActividad = (id) => api.delete(`/api/poa/actividades/${id}/`);

// Actions sobre actividades
export const asignarCatalogoActividad = (id, catalogo_id) => api.patch(`/api/poa/actividades/${id}/asignar_catalogo/`, { catalogo_id });
export const asignarIndicadorActividad = (id, indicador_id) => api.patch(`/api/poa/actividades/${id}/asignar_indicador/`, { indicador_id });
export const indicadoresPorDireccion = (direccion_id) => api.get('/api/poa/actividades/indicadores_por_direccion/', { params: { direccion_id } });

// Detalle presupuesto
export const getDetallePresupuestoPorActividad = (actividad_id, documento_id) => {
	if (actividad_id === undefined || actividad_id === null || Number.isNaN(Number(actividad_id))) {
		return badRequest({ actividad_id: ['El parámetro "actividad_id" es obligatorio y debe ser un entero.'] });
	}
	const params = { actividad_id: Number(actividad_id) };
	if (documento_id !== undefined && documento_id !== null) params.documento_id = Number(documento_id);
	return api.get('/api/poa/detalle-presupuesto/', { params });
};

export const createDetallePresupuesto = (payload) => {
	const required = ['actividad_id','partida','item','cantidad','costo_unitario','mes_requerimiento'];
	if (!payload) return badRequest({ detail: ['Payload vacío.'] });
	for (const f of required) {
		if (payload[f] === undefined || payload[f] === null || (typeof payload[f] === 'string' && payload[f].trim() === '')) {
			return badRequest({ [f]: [`El campo "${f}" es obligatorio.`] });
		}
	}

	// cantidad debe ser entero
	const cantidadNum = Number(payload.cantidad);
	if (Number.isNaN(cantidadNum) || !Number.isFinite(cantidadNum) || !Number.isInteger(cantidadNum)) {
		return badRequest({ cantidad: ['El campo "cantidad" debe ser un entero.'] });
	}
	return api.post('/api/poa/detalle-presupuesto/', payload);
};
export const getDetallePorId = (id) => api.get(`/api/poa/detalle-presupuesto/${id}/`);
export const updateDetalle = (id, payload) => api.patch(`/api/poa/detalle-presupuesto/${id}/`, payload);
export const deleteDetalle = (id) => api.delete(`/api/poa/detalle-presupuesto/${id}/`);


// Catálogos (app catalogos)
// Items
// `params` es opcional; permite filtrar por partida_id, search, etc.
export const getCatalogoItems = (params) => api.get('/api/catalogos/items/', { params });
// Nuevo endpoint específico para autocompletes/consultas de catálogo usado por el modal
// Endpoint: /api/catalogos/items-catalogo/
export const getItemsCatalogo = (params) => api.get('/api/catalogos/items-catalogo/', { params });
export const getCatalogoItemPorId = (id) => api.get(`/api/catalogos/items/${id}/`);
export const createCatalogoItem = (payload) => api.post('/api/catalogos/items/', payload);
export const updateCatalogoItem = (id, payload) => api.patch(`/api/catalogos/items/${id}/`, payload);
export const deleteCatalogoItem = (id) => api.delete(`/api/catalogos/items/${id}/`);
export const importarCatalogoItemsExcel = (formData) =>
	api.post('/api/catalogos/items/importar-excel/', formData);
export const descargarCatalogoItemsExcel = (options = {}) =>
	api.get('/api/catalogos/items-catalogo/exportar-excel/', {
		responseType: 'blob',
		...options,
	});

// Partidas presupuestarias (app catalogos)
// Endpoint: GET /api/catalogos/partidas/
export const getCatalogoPartidas = () => api.get('/api/catalogos/partidas/');

// Operaciones (indicadores)
export const getCatalogoOperaciones = () => api.get('/api/catalogos/operaciones/');
export const getCatalogoOperacionPorId = (id) => api.get(`/api/catalogos/operaciones/${id}/`);
export const createCatalogoOperacion = (payload) => api.post('/api/catalogos/operaciones/', payload);
export const updateCatalogoOperacion = (id, payload) => api.patch(`/api/catalogos/operaciones/${id}/`, payload);
export const deleteCatalogoOperacion = (id) => api.delete(`/api/catalogos/operaciones/${id}/`);
// Buscar operaciones/catalogo con parámetro 'search' (útil para autocompletes)
export const searchCatalogoOperaciones = (q) => api.get('/api/catalogos/operaciones/', { params: { search: q } });
export const searchOperacionesCatalogo = (q) => api.get('/api/catalogos/operaciones-catalogo/', { params: { search: q } });

// Obtener operaciones filtradas por dirección (si el backend soporta ?direccion_id=)
export const getOperacionesPorDireccion = (direccion_id) => {
	if (direccion_id === undefined || direccion_id === null || Number.isNaN(Number(direccion_id))) {
		return badRequest({ direccion_id: ['El parámetro "direccion_id" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/catalogos/operaciones/', { params: { direccion_id: Number(direccion_id) } });
};

// ─── Usuarios POA ─────────────────────────────────────────────────────────────
// Gestión de accesos al módulo POA (docentes con roles asignados)

export const getUsuariosPOA = (params) => api.get('/api/poa/usuarios-poa/', { params });
export const getUsuarioPOAPorId = (id) => api.get(`/api/poa/usuarios-poa/${id}/`);
export const createUsuarioPOA = (payload) => api.post('/api/poa/usuarios-poa/', payload);
export const updateUsuarioPOA = (id, payload) => api.patch(`/api/poa/usuarios-poa/${id}/`, payload);
export const deleteUsuarioPOA = (id) => api.delete(`/api/poa/usuarios-poa/${id}/`);

// Buscar usuarios del sistema principal (User) por nombre, username o email
export const buscarUsuariosSistema = (q) => {
	if (!q || String(q).trim().length < 2) return Promise.resolve({ data: [] });
	return api.get('/api/poa/usuarios/buscar/', { params: { q: String(q).trim() } });
};

// Buscar docentes del sistema principal para asignar
export const buscarDocentesPOA = (q) => {
	if (!q || String(q).trim().length < 2) return Promise.resolve({ data: [] });
	return api.get('/api/poa/docentes/buscar/', { params: { q: String(q).trim() } });
};

export const ROL_POA_CHOICES = [
	{ value: 'elaborador',       label: 'Elaborador del POA',    color: 'blue' },
	{ value: 'director_carrera', label: 'Director de Carrera',   color: 'indigo' },
	{ value: 'revisor_1',        label: 'Entidad Revisora 1',    color: 'violet' },
	{ value: 'revisor_2',        label: 'Entidad Revisora 2',    color: 'purple' },
	{ value: 'revisor_3',        label: 'Entidad Revisora 3',    color: 'fuchsia' },
	{ value: 'revisor_4',        label: 'Entidad Revisora 4',    color: 'pink' },
];

// ─── Conversaciones POA ───────────────────────────────────────────────────────

// Obtener hilos de conversación de un documento
export const getComentariosPOA = (documentoId) =>
	api.get('/api/poa/comentarios-poa/', { params: { documento: documentoId } });

// Abrir un nuevo hilo de conversación (solo si no hay uno activo)
export const crearComentarioPOA = (documentoId) =>
	api.post('/api/poa/comentarios-poa/', { documento: documentoId });

// Cerrar/reabrir un hilo
export const cerrarComentarioPOA = (comentarioId) =>
	api.patch(`/api/poa/comentarios-poa/${comentarioId}/`, { abierto: false });

// Enviar un mensaje a un hilo
export const enviarMensajePOA = (comentarioId, texto) =>
	api.post('/api/poa/mensajes-poa/', { comentario: comentarioId, texto });

// Eliminar un mensaje (solo el autor o superusuario)
export const eliminarMensajePOA = (mensajeId) =>
	api.delete(`/api/poa/mensajes-poa/${mensajeId}/`);

