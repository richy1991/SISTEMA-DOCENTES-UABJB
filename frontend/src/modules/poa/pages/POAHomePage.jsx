

import React, { useEffect, useState } from 'react';
import { getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import { useNavigate } from 'react-router-dom';
import { FaUniversity, FaCalendarAlt, FaLayerGroup, FaBuilding, FaBullseye, FaChevronRight } from 'react-icons/fa';

const POAHomePage = () => {
	const [documentos, setDocumentos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const navigate = useNavigate();

	const resolveGestionCandidate = (value) => {
		if (value === undefined || value === null || value === '') return null;
		if (typeof value === 'object') {
			return value.id ?? value.pk ?? value.gestion ?? value.nombre ?? value;
		}
		return value;
	};

	const getGestionForDoc = (doc) => {
		const candidate = resolveGestionCandidate(doc?.gestion);
		if (candidate === null || candidate === undefined) return null;
		const numeric = Number(candidate);
		return (!Number.isNaN(numeric) && Number.isFinite(numeric)) ? numeric : null;
	};

	useEffect(() => {
		setLoading(true);
		const currentYear = new Date().getFullYear();
		getDocumentosPOAPorGestion(currentYear)
			.then(res => {
				// Manejar varios formatos de respuesta que podría devolver el backend
				const data = res.data;
				let docs = [];
				if (Array.isArray(data)) {
					docs = data;
				} else if (Array.isArray(data.results)) {
					docs = data.results;
				} else if (Array.isArray(data.documentos)) {
					docs = data.documentos;
				} else if (Array.isArray(data.data)) {
					docs = data.data;
				} else {
					// Fallback: buscar arrays dentro del objeto
					for (const key of ['results', 'documentos', 'data']) {
						if (Array.isArray(data[key])) { docs = data[key]; break; }
					}
				}
				setDocumentos(docs);
				setLoading(false);
			})
			.catch(err => {
				setError(err?.response?.data?.detail || err?.response?.data || err.message);
				setLoading(false);
			});
	}, []);

	const handleVerActividades = (doc) => {
		if (!doc?.id) return;
		const gestionValue = getGestionForDoc(doc);
		navigate(`/poa/objetivos-especificos/${doc.id}`, {
			state: {
				gestion: gestionValue,
				gestionState: gestionValue,
			},
		});
	};

	return (
		<section className="flex flex-col items-center justify-start flex-1  pb-4 px-4 w-full">
			<h2 className="text-2xl font-bold text-blue-900 mb-4">Documentos POA - Gestión: {new Date().getFullYear()}</h2>
			{loading && <div className="text-blue-800">Cargando documentos...</div>}
			{error && (
				<div className="text-red-600">
					{error} <br />
					Por favor, verifica que el backend esté corriendo y que la configuración CORS permita esta petición.
				</div>
			)}
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full max-w-5xl mx-auto">
				{documentos && documentos.length > 0 ? (
					documentos.map((doc, idx) => {
						const entidadVal = typeof doc.entidad === 'object' ? (doc.entidad.nombre || JSON.stringify(doc.entidad)) : (doc.entidad || 'UABJB');
						const gestionVal = typeof doc.gestion === 'object' ? (doc.gestion.nombre || JSON.stringify(doc.gestion)) : (doc.gestion || 'N/A');
						const programaVal = typeof doc.programa === 'object' ? (doc.programa.nombre || JSON.stringify(doc.programa)) : (doc.programa || 'N/A');
						const unidadVal = typeof doc.unidad_solicitante === 'object' ? (doc.unidad_solicitante.nombre || JSON.stringify(doc.unidad_solicitante)) : (doc.unidad_solicitante || 'N/A');
						const objetivoVal = typeof doc.objetivo_gestion_institucional === 'object' ? (doc.objetivo_gestion_institucional.nombre || JSON.stringify(doc.objetivo_gestion_institucional)) : (doc.objetivo_gestion_institucional || 'N/A');
						return (
							<div
								key={doc.id || idx}
								className="card-refined card-elegant p-1.5 md:p-2.5 flex flex-col gap-1.5 md:gap-2 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500/40"
								role="button"
								tabIndex={0}
								onClick={() => handleVerActividades(doc)}
								onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerActividades(doc); } }}
							>
								<div className="flex flex-col gap-2 w-full">
									<div className="grid grid-cols-1 gap-2">
										<div className="grid grid-cols-2 gap-2">
											<div className="flex items-start gap-1.5 md:gap-3">
											<span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
												<FaUniversity className="w-3 h-3 md:w-3.5 md:h-3.5" />
											</span>
											<div>
												<div className="text-[0.6rem] md:text-[0.66rem] uppercase tracking-wide text-blue-700/90 font-semibold card-kv-label">Entidad</div>
												<div className="text-[0.72rem] md:text-[0.8rem] text-slate-800 font-semibold card-kv-value">{entidadVal}</div>
											</div>
											</div>

																						<div className="flex items-start gap-1.5 md:gap-3">
											<span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
												<FaCalendarAlt className="w-3 h-3 md:w-3.5 md:h-3.5" />

											</span>
											<div>
																								<div className="text-[0.6rem] md:text-[0.66rem] uppercase tracking-wide text-blue-700/90 font-semibold card-kv-label">Gestión</div>
																								<div className="text-[0.72rem] md:text-[0.8rem] text-slate-800 font-semibold card-kv-value">{gestionVal}</div>
											</div>
											</div>
										</div>

														<div className="flex items-start gap-1.5 md:gap-3">
											<span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
												<FaLayerGroup className="w-3 h-3 md:w-3.5 md:h-3.5" />
											</span>
											<div>
																<div className="text-[0.8rem] md:text-[0.9rem] uppercase tracking-wide text-blue-700/90 font-semibold font-serif card-kv-label">Programa</div>
																<div className="text-[1rem] md:text-[1.1rem] text-slate-800 font-semibold font-serif card-kv-value">{programaVal}</div>
											</div>
										</div>

														<div className="flex items-start gap-1.5 md:gap-3">
											<span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
												<FaBuilding className="w-3 h-3 md:w-3.5 md:h-3.5" />
											</span>
											<div>
																<div className="text-[0.8rem] md:text-[0.9rem] uppercase tracking-wide text-blue-700/90 font-semibold font-serif card-kv-label">Unidad solicitante</div>
																<div className="text-[1rem] md:text-[1.1rem] text-slate-800 font-semibold font-serif card-kv-value">{unidadVal}</div>
											</div>
										</div>
									</div>

									<div className="flex flex-col">
													<div className="flex items-center gap-1.5 md:gap-2 mb-1">
											<span className="inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
												<FaBullseye className="w-3 h-3 md:w-3.5 md:h-3.5" />
											</span>
												<span className="rounded-md px-1.5 md:px-2 py-0.5 text-[0.6rem] md:text-[0.66rem] bg-blue-100 text-blue-800 border border-blue-200 objective-pill">Objetivo de gestión institucional</span>
										</div>
										<p className="text-[0.72rem] md:text-[0.8rem] text-slate-800 leading-snug line-clamp-4 card-objective">{objetivoVal}</p>
									</div>
								</div>

											<div className="flex items-center justify-end gap-2 text-blue-700/80 card-cta-text">
												<span className="text-[0.6rem] md:text-[0.66rem] opacity-0 group-hover:opacity-100 transition-opacity">Abrir actividades</span>
												<FaChevronRight className="w-3 h-3 md:w-3.5 md:h-3.5 transform translate-x-0 group-hover:translate-x-1 transition" />
								</div>
							</div>
						);
					})
				) : !loading && !error ? (
					<div className="col-span-full text-gray-500">No hay documentos para mostrar.</div>
				) : null}
			</div>
		</section>
	);
};

export default POAHomePage;
