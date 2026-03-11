import React, { useEffect, useState } from 'react';
import { FaChevronDown, FaTrash, FaEdit, FaPlus } from 'react-icons/fa';
import { getCatalogoPartidas, getCatalogoItems, deleteCatalogoItem } from '../../../apis/poa.api';
import NuevoCatalogoItemModal from '../components/NuevoCatalogoItemModal';
import IconButton from '../components/IconButton';
import toast from 'react-hot-toast';

const CatalogoItems = () => {
	const [partidas, setPartidas] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	// estado para expandir una partida y cachear items por partida
	const [openPartidaId, setOpenPartidaId] = useState(null);
	const [itemsByPartida, setItemsByPartida] = useState({});
	const [loadingPartida, setLoadingPartida] = useState({});
	const [errorPartida, setErrorPartida] = useState({});

	// modal para crear/editar items
	const [showItemModal, setShowItemModal] = useState(false);
	const [modalPartida, setModalPartida] = useState(null);
	const [modalItem, setModalItem] = useState(null);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		setError(null);
		getCatalogoPartidas()
			.then(res => {
				if (!mounted) return;
				// Normalizar distintas formas de respuesta del backend
				// Puede ser: []  OR { results: [] } OR { data: [] } OR { partidas: [] }
				const d = res?.data;
				let list = [];
				if (Array.isArray(d)) {
					list = d;
				} else if (d && Array.isArray(d.results)) {
					list = d.results;
				} else if (d && Array.isArray(d.data)) {
					list = d.data;
				} else if (d && Array.isArray(d.partidas)) {
					list = d.partidas;
				} else {
					// intentar buscar la primera propiedad que sea un array
					for (const k of Object.keys(d || {})) {
						if (Array.isArray(d[k])) { list = d[k]; break; }
					}
				}
				console.debug('getCatalogoPartidas response normalized length:', list.length, 'raw:', d);
				setPartidas(list);
			})
			.catch(err => {
				if (!mounted) return;
				console.error('Error cargando partidas:', err);
				setError(err?.response?.data || err?.message || 'Error desconocido');
			})
			.finally(() => {
				if (!mounted) return;
				setLoading(false);
			});
		return () => { mounted = false; };
	}, []);

	const togglePartida = (p) => {
		// normalizar id a string para evitar keys duplicadas/ambigüedad
		const idRaw = p?.id ?? p?.pk ?? p?.codigo ?? null;
		if (!idRaw) return;
		const id = String(idRaw);
		const isOpen = openPartidaId === id;
		if (isOpen) {
			setOpenPartidaId(null);
			return;
		}
		// abrir
		setOpenPartidaId(id);
		// si ya tenemos items en cache, no volver a pedir
		if (itemsByPartida[id]) return;

		// marcar carga
		setLoadingPartida(prev => ({ ...prev, [id]: true }));
		setErrorPartida(prev => ({ ...prev, [id]: null }));

		// Intentar solicitar al endpoint pasando el id de la partida en varias claves
		// para maximizar compatibilidad con lo que el backend espere.
		const params = { partida_id: idRaw, partida: idRaw, partida_codigo: p.codigo ?? undefined };
		getCatalogoItems(params)
			.then(res => {
				// Normalizar la respuesta del endpoint de items: puede devolver [] o { results: [] } etc.
				const d = res?.data;
				let items = [];
				if (Array.isArray(d)) items = d;
				else if (d && Array.isArray(d.results)) items = d.results;
				else if (d && Array.isArray(d.data)) items = d.data;
				else if (d && Array.isArray(d.items)) items = d.items;
				else {
					for (const k of Object.keys(d || {})) { if (Array.isArray(d[k])) { items = d[k]; break; } }
				}
				// Si el endpoint ya devolvió items (filtrados por la partida), los usamos directamente.
				if (items.length > 0) {
					console.debug('getCatalogoItems returned items for partida', id, 'len', items.length);
					setItemsByPartida(prev => ({ ...prev, [id]: items }));
					return;
				}
				// Si no devolvió nada, caemos al fallback: intentar filtrar localmente sobre d (si es array)
				const data = Array.isArray(d) ? d : [];
				if (data.length === 0) {
					console.debug('getCatalogoItems no devolvió array; raw:', d);
					setItemsByPartida(prev => ({ ...prev, [id]: [] }));
					return;
				}
				// Fallback: filtrar localmente usando la lógica robusta anterior
				const partidaValuesFromItem = (it) => {
					const vals = [];
					if (it.partida_id !== undefined && it.partida_id !== null) vals.push(String(it.partida_id));
					if (it.partida !== undefined && it.partida !== null) {
						if (typeof it.partida === 'object') {
							if (it.partida.id !== undefined) vals.push(String(it.partida.id));
							if (it.partida.pk !== undefined) vals.push(String(it.partida.pk));
							if (it.partida.codigo !== undefined) vals.push(String(it.partida.codigo));
						} else {
							vals.push(String(it.partida));
						}
					}
					if (it.codigo_partida !== undefined && it.codigo_partida !== null) vals.push(String(it.codigo_partida));
					if (it.partida_codigo !== undefined && it.partida_codigo !== null) vals.push(String(it.partida_codigo));
					return vals.map(v => v.trim());
				};
				const candidates = [String(id), String(p.codigo ?? ''), String(p.partida ?? '')].map(v => v.trim()).filter(v => v !== '');
				let filtered = data.filter(it => {
					const vals = partidaValuesFromItem(it);
					for (const c of candidates) {
						for (const v of vals) {
							if (v === c) return true;
							if (v.includes && c && v.includes(c)) return true;
							if (c.includes && v && c.includes(v)) return true;
						}
					}
					return false;
				});
				console.debug('fallback filtered items for partida', id, 'filteredLen', filtered.length);
				setItemsByPartida(prev => ({ ...prev, [id]: filtered }));
			})
			.catch(err => {
				console.error('Error cargando items para partida', id, err);
				setErrorPartida(prev => ({ ...prev, [id]: err?.response?.data || err?.message || 'Error desconocido' }));
			})
			.finally(() => {
				setLoadingPartida(prev => ({ ...prev, [id]: false }));
			});
	};

	const openNuevoItem = (p) => {
		setModalPartida(p);
		setModalItem(null);
		setShowItemModal(true);
	};

	const openEditarItem = (p, it) => {
		setModalPartida(p);
		setModalItem(it);
		setShowItemModal(true);
	};

	const handleItemCreated = (created) => {
		// agregar al listado de la partida correspondiente
		const id = String(modalPartida?.id ?? modalPartida?.pk ?? modalPartida?.codigo ?? '');
		setItemsByPartida(prev => {
			const list = Array.isArray(prev[id]) ? [...prev[id]] : [];
			list.unshift(created);
			return { ...prev, [id]: list };
		});
		setShowItemModal(false);
	};

	const handleItemUpdated = (updated) => {
		const id = String(modalPartida?.id ?? modalPartida?.pk ?? modalPartida?.codigo ?? '');
		setItemsByPartida(prev => {
			const list = Array.isArray(prev[id]) ? prev[id].map(it => (String(it.id) === String(updated.id) ? updated : it)) : [updated];
			return { ...prev, [id]: list };
		});
		setShowItemModal(false);
	};

	const handleEliminarItem = async (p, it) => {
		const ok = window.confirm(`Eliminar item ${it.id || it.codigo || it.descripcion || ''}?`);
		if (!ok) return;
		try {
			await deleteCatalogoItem(it.id);
			const id = String(p?.id ?? p?.pk ?? p?.codigo ?? '');
			setItemsByPartida(prev => ({ ...prev, [id]: (prev[id] || []).filter(x => String(x.id) !== String(it.id)) }));
			toast.success('Item eliminado');
		} catch (err) {
			console.error('Error eliminando item', err);
			toast.error('No se pudo eliminar el item');
		}
	};

	return (
		<div className="catalogo-card w-full max-w-6xl mx-auto p-6 bg-white rounded shadow">
			{loading && <div className="text-blue-600">Cargando partidas...</div>}
			{error && <div className="text-red-600">Error al cargar partidas: {typeof error === 'string' ? error : JSON.stringify(error)}</div>}

			{!loading && !error && (
				<div className="space-y-3">
						{partidas.length === 0 && (
							<div className="text-gray-500">No se encontraron partidas.</div>
						)}
						{/* Mostrar conteo de partidas para depuración rápida */}
						<div className="text-sm text-gray-400">Partidas encontradas: {partidas.length}</div>

					{partidas.map((p, idx) => {
						const idRaw = p?.id ?? p?.pk ?? p?.codigo ?? '';
						const id = String(idRaw);
						const isOpen = openPartidaId === id;
						const partidaItems = itemsByPartida[id] ?? [];
						const partidaLoading = loadingPartida[id];
						const partidaError = errorPartida[id];

						return (
							<div key={`partida-${id}-${idx}`} className="catalogo-item border rounded">
								<button type="button" onClick={() => togglePartida(p)} className="catalogo-item-header w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
									<div className="flex items-center gap-4">
										<div className="catalogo-code font-mono text-sm text-gray-700">{p.codigo ?? p.partida ?? id}</div>
										<div className="catalogo-name font-semibold text-gray-800">{p.nombre ?? p.titulo ?? '—'}</div>
									</div>
									<FaChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
								</button>

								<div className={`catalogo-item-body px-4 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 py-4' : 'max-h-0'}`}>
									{isOpen && (
										<div className="flex justify-end mb-3">
											<IconButton showIcon icon={<FaPlus />} onClick={() => openNuevoItem(p)} className="btn-futuristic font-bold py-1 px-3 rounded" title="Nuevo ítem">Nuevo</IconButton>
										</div>
									)}
									{partidaLoading && <div className="text-blue-600">Cargando items...</div>}
									{partidaError && <div className="text-red-600">Error: {typeof partidaError === 'string' ? partidaError : JSON.stringify(partidaError)}</div>}

									{!partidaLoading && !partidaError && (
										<div>
											{partidaItems.length === 0 ? (
												<div className="text-gray-500">No se encontraron items para esta partida.</div>
											) : (
												<div className="overflow-x-auto">

								{showItemModal && (
									<NuevoCatalogoItemModal
										partida={modalPartida}
										item={modalItem}
										onClose={() => setShowItemModal(false)}
										onCreated={handleItemCreated}
										onUpdated={handleItemUpdated}
									/>
								)}
													<table className="min-w-full table-auto border-collapse font-sans text-base leading-snug text-blue-900 dark:text-white poa-borders-ultra">
														<thead>
															<tr className="text-left bg-blue-100 dark:bg-transparent text-blue-900 dark:text-white">
																<th className="px-4 py-2 border border-blue-300 dark:border-gray-600 font-medium">Descripción</th>
																<th className="px-4 py-2 border border-blue-300 dark:border-gray-600 font-medium">Unidad de medida</th>
																<th className="px-4 py-2 border border-blue-300 dark:border-gray-600 w-24 font-medium">&nbsp;</th>
																</tr>
														</thead>
														<tbody>
															{partidaItems.map((it, idx) => {
																const desc = it.descripcion ?? it.detalle ?? it.nombre ?? it.titulo ?? '';
																const unidad = it.unidad_medida ?? it.unidad ?? it.uom ?? it.medida ?? it.unidadMedida ?? '';
																return (
																	<tr key={`item-${it?.id ?? idx}`} className="odd:bg-white even:bg-blue-50 text-blue-900 dark:text-white">
																		<td className="px-4 py-2 border border-blue-300 dark:border-gray-600 align-top"><div className="table-cell-clamp">{desc}</div></td>
																		<td className="px-4 py-2 border border-blue-300 dark:border-gray-600 align-top">{unidad}</td>
																		<td className="px-4 py-2 border border-blue-300 dark:border-gray-600 align-top">
																			<div className="flex items-center gap-2 justify-end">
																				<IconButton icon={<FaEdit />} onClick={() => openEditarItem(p, it)} title="Editar" />
																				<IconButton icon={<FaTrash />} onClick={() => handleEliminarItem(p, it)} title="Eliminar" />
																			</div>
																		</td>
																	</tr>
																);
															})}
														</tbody>
													</table>
												</div>
											)}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default CatalogoItems;

