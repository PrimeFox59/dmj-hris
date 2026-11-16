import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Download, FileText, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl?: string | null;
  documentName?: string;
  documentType?: string;
  title?: string;
  submittedBy?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  documentUrl,
  documentName = 'Dokumen Lampiran',
  documentType,
  title,
  submittedBy
}) => {
  const [zoom, setZoom] = React.useState<number>(1);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset zoom when modal opens or url changes
  useEffect(() => {
    setZoom(1);
  }, [isOpen, documentUrl]);

  if (!isOpen || !documentUrl || typeof document === 'undefined') return null;

  const isPdf = Boolean(
    documentType?.includes('pdf') || 
    documentName?.toLowerCase().endsWith('.pdf') || 
    documentUrl.startsWith('data:application/pdf') ||
    documentUrl.toLowerCase().includes('.pdf')
  );

  const isImage = Boolean(
    documentType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(documentName) ||
    documentUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(documentUrl)
  );

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = documentUrl;
    a.download = documentName || 'dokumen_lampiran';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    window.open(documentUrl, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden modal-dialog-animate"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isPdf ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
            }`}>
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate" title={documentName}>
                  {documentName}
                </h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-bold uppercase tracking-wide shrink-0 ${
                  isPdf ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {isPdf ? 'DOKUMEN PDF' : isImage ? 'GAMBAR / FOTO' : 'LAMPIRAN'}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {submittedBy ? `Pengaju: ${submittedBy}` : ''} {title ? `• ${title}` : ''}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-1 mr-1">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono-code font-bold text-slate-600 min-w-[40px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenNewTab}
              className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer"
              title="Buka di Tab Baru"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer"
              title="Unduh File"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer ml-1"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-900/5 min-h-[350px] max-h-[75vh] flex items-center justify-center">
          {isPdf ? (
            <div className="w-full h-[70vh] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
              <iframe
                src={documentUrl}
                title={documentName}
                className="w-full h-full border-0"
              />
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={documentUrl}
                alt={documentName}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
                className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-lg border border-slate-200/60"
              />
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-3xl bg-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-base">{documentName}</h4>
                <p className="text-xs text-slate-500">
                  Format dokumen ini tidak dapat dipratinjau langsung di dalam browser. Silakan unduh atau buka dokumen secara terpisah.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="btn-orange text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Dokumen Sekarang</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Footer Information */}
        <div className="px-5 py-3 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-mono-code text-[11px]">
            Sistem Dokumen Sah HRIS DMJ Enterprise
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
