import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import NuevoDocumentoModal from './NuevoDocumentoModal';
import IconButton from './IconButton';
import { FaPlus, FaMinus, FaTimes } from 'react-icons/fa';

const GestionSelectorModal = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manualYear, setManualYear] = useState('');
  const [noDocsForYear, setNoDocsForYear] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const current = new Date().getFullYear();
    setManualYear(String(current));
    setLoading(false);
  }, []);

  const increaseYear = () => setManualYear(prev => String(Number(prev || new Date().getFullYear()) + 1));
  const decreaseYear = () => setManualYear(prev => String(Number(prev || new Date().getFullYear()) - 1));

  const handleIngresar = async () => {
    const yearToQuery = String(manualYear).trim();
    if (!yearToQuery) {
      setError('Seleccione o ingrese una gestión (año)');
      return;
    }
    if (!/^[0-9]{4}$/.test(yearToQuery)) {
      setError('Ingrese un año válido (ej: 2025)');
      return;
    }
    setError(null);
    setLoading(true);
    setNoDocsForYear(false);
    try {
  const res = await getDocumentosPOAPorGestion(Number(yearToQuery));
      const docs = Array.isArray(res.data) ? res.data : (res.data.results || []);
      if (!docs || docs.length === 0) {
        setNoDocsForYear(yearToQuery);
        return;
      }
      if (onSuccess) onSuccess({ gestion: yearToQuery, documentos: docs });
      // cerrar modal después de notificar al caller
      if (onClose) onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Error al consultar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleAgregar = () => {
    // Abrir el modal de creación directamente en lugar de navegar
    const year = noDocsForYear || manualYear;
    // mostrar el modal de documento sobre el selector (sin cerrar el selector)
    setShowNuevoModal(true);
  };

  const [showNuevoModal, setShowNuevoModal] = useState(false);

  const handleCancelarNoDocs = () => {
    setNoDocsForYear(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay ligero */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* modal centrado */}
      <div className="relative z-20">
        <div className="w-96 modal-panel transform transition-transform duration-200 card-elegant oe-modern rounded-xl overflow-hidden">
          {/* header azul */}
          <div className="modal-header px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white text-lg font-semibold">Seleccionar gestión</h3>
                <p className="text-blue-100 text-sm mt-0.5">Ingrese la gestión (año) para filtrar documentos POA</p>
              </div>
              <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
            </div>
          </div>

          {/* body */}
          <div className="p-5 modal-body">
            {loading && <div className="mb-3 text-sm text-gray-600">Cargando...</div>}
            {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

            <label className="block text-sm font-medium mb-3">Año</label>

            <div className="flex items-center justify-center">
              <div className="gestion-input-group inline-flex items-center bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-200">
                <input
                  type="number"
                  className={`w-24 text-center text-xl font-medium px-3 py-2 border-none focus:outline-none ${noDocsForYear ? 'opacity-60 cursor-not-allowed' : ''}`}
                  value={manualYear}
                  onChange={e => setManualYear(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowUp') { increaseYear(); }
                    if (e.key === 'ArrowDown') { decreaseYear(); }
                  }}
                  inputMode="numeric"
                  aria-label="Año de la gestión"
                  disabled={!!noDocsForYear}
                />

                <div className="flex flex-col border-l border-gray-200">
                  <IconButton icon={<FaPlus />} onClick={increaseYear} className={`px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 text-base font-semibold ${noDocsForYear ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!!noDocsForYear} title="Aumentar año"></IconButton>
                  <IconButton icon={<FaMinus />} onClick={decreaseYear} className={`px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 text-base font-semibold ${noDocsForYear ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!!noDocsForYear} title="Disminuir año"></IconButton>
                </div>
              </div>
            </div>


            {/* Ocultar flechitas nativas del input number */}
            <style>{`
              /* Chrome, Safari, Edge, Opera */
              input[type=number]::-webkit-outer-spin-button,
              input[type=number]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
              }
              /* Firefox */
              input[type=number] { -moz-appearance: textfield; }
            `}</style>

            {/* acciones: ocultar cuando no hay documentos para forzar elegir Nuevo/Cancelar */}
            {!noDocsForYear && (
              <div className="mt-6 flex items-center justify-center gap-3 modal-actions">
                <IconButton onClick={() => onClose && onClose()} className="btn-cancel px-3 py-2 rounded-md" title="Cancelar">Cancelar</IconButton>
                <IconButton onClick={handleIngresar} disabled={loading} className="btn-primary px-3 py-2 rounded-md disabled:opacity-60" title={loading ? 'Buscando...' : 'Ingresar'}>{loading ? 'Buscando...' : 'Ingresar'}</IconButton>
              </div>
            )}

            {/* estado: no docs */}
            {noDocsForYear && (
              <div className="no-docs-card mt-4 p-3 rounded-md">
                <p className="text-sm text-red-500">No se encontraron documentos para la gestión <strong>{noDocsForYear}</strong>.</p>
                <p className="text-sm  mt-2">¿Desea crear un nuevo documento para esta gestión?</p>
                <div className="mt-3 flex gap-2 justify-end modal-actions">
                  <IconButton onClick={handleCancelarNoDocs} className="btn-cancel px-3 py-2 rounded-md" title="Cancelar">Cancelar</IconButton>
                  <IconButton onClick={handleAgregar} className="btn-success px-3 py-2 rounded-md" title="Nuevo">Nuevo</IconButton>
                </div>
              </div>
            )}
            {/* Nuevo Documento Modal via Portal (fuera del árbol del selector) */}
            {showNuevoModal && createPortal(
              (
                <div className="fixed inset-0 z-[70]">
                  <NuevoDocumentoModal
                    initialGestion={noDocsForYear || manualYear}
                    onClose={() => setShowNuevoModal(false)}
                    onCreated={(created) => {
                      const year = noDocsForYear || manualYear;
                      if (onSuccess) onSuccess({ gestion: year });
                      if (onClose) onClose();
                    }}
                  />
                </div>
              ),
              document.body
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionSelectorModal;
