import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const PDFPreviewPOAModal = ({
  isOpen,
  onClose,
  pdfUrl,
  downloadFileName = 'Documento_POA.pdf',
  title = 'Vista Previa del Documento POA',
  subtitle = 'Revise la información antes de descargar.',
}) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const loadPdf = async () => {
      if (!isOpen || !pdfUrl) return;
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const urlWithParam = `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}view=true`;

        const response = await fetch(urlWithParam, { headers });
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('No autorizado. Su sesión puede haber expirado.');
          }
          throw new Error('Error al cargar el documento PDF.');
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setBlobUrl(objectUrl);
      } catch (err) {
        if (active) setError(err.message || 'Error al cargar el PDF');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlobUrl(null);
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-1 md:p-2">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[98vw] max-w-[1500px] h-[98vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 bg-slate-100 dark:bg-slate-900 relative flex items-center justify-center">
          {loading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Generando vista previa...</p>
            </div>
          )}

          {error && <div className="text-red-500 font-bold px-6 text-center">{error}</div>}

          {!loading && !error && blobUrl && (
            <iframe
              src={`${blobUrl}#view=FitH&zoom=page-width`}
              className="w-full h-full"
              title="Vista Previa PDF POA"
              style={{ border: 'none' }}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium">Cancelar</button>
          {blobUrl && (
            <a
              href={blobUrl}
              download={downloadFileName}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
              Descargar PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PDFPreviewPOAModal;
