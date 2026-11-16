import React, { useRef, useState } from 'react';
import { Paperclip, UploadCloud, FileText, Image as ImageIcon, Trash2, Eye, AlertCircle, Loader2 } from 'lucide-react';

export interface DocumentAttachmentData {
  dataUrl: string;
  name: string;
  type: string;
  size: number;
}

interface DocumentAttachmentUploadProps {
  value?: DocumentAttachmentData | null;
  onChange: (attachment: DocumentAttachmentData | null) => void;
  onPreview?: (attachment: DocumentAttachmentData) => void;
  label?: string;
  helperText?: string;
  required?: boolean;
}

export const DocumentAttachmentUpload: React.FC<DocumentAttachmentUploadProps> = ({
  value,
  onChange,
  onPreview,
  label = 'Upload Dokumen Bukti / Surat Dokter / Lampiran',
  helperText,
  required = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Gagal memproses gambar'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);

    // Max 10 MB limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMessage(`Ukuran file terlalu besar (${formatFileSize(file.size)}). Maksimal ukuran file adalah 10 MB.`);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      setErrorMessage('Format file tidak didukung. Harap upload dokumen PDF atau file gambar (JPG, PNG, WEBP).');
      return;
    }

    setIsProcessing(true);
    try {
      let dataUrl = '';
      let finalSize = file.size;

      if (isImage) {
        dataUrl = await compressImage(file);
        // Estimate base64 length in bytes
        finalSize = Math.round((dataUrl.length * 3) / 4);
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Gagal membaca berkas PDF'));
          reader.readAsDataURL(file);
        });
      }

      onChange({
        dataUrl,
        name: file.name,
        type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        size: finalSize
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input value so re-selecting same file fires onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const isPdf = Boolean(
    value?.type?.includes('pdf') || 
    value?.name?.toLowerCase().endsWith('.pdf') || 
    value?.dataUrl?.startsWith('data:application/pdf')
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {value && (
          <span className="text-[10px] font-mono-code font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            ✓ Berkas Siap Diunggah
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* When File is Selected / Uploaded */}
      {value ? (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/90 shadow-xs transition-all">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            ) : value.dataUrl.startsWith('data:image/') || value.dataUrl.startsWith('http') ? (
              <img
                src={value.dataUrl}
                alt={value.name}
                className="w-10 h-10 rounded-xl object-cover border border-indigo-200 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[280px]" title={value.name}>
                  {value.name}
                </p>
                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono-code font-bold uppercase ${
                  isPdf ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {isPdf ? 'PDF' : 'FOTO'}
                </span>
              </div>
              <p className="text-[10.5px] font-mono-code text-slate-500 mt-0.5">
                {formatFileSize(value.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {onPreview && (
              <button
                type="button"
                onClick={() => onPreview(value)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Pratinjau Dokumen"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lihat</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onChange(null);
                setErrorMessage(null);
              }}
              className="p-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Hapus / Ganti Dokumen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Empty Dropzone State */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-3.5 sm:p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/80 scale-[0.99]'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2 py-2 text-indigo-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-semibold">Memproses dan mengompres dokumen...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center shadow-xs">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">
                  <span className="text-indigo-600 hover:underline">Klik untuk pilih berkas</span> atau tarik file ke sini
                </p>
                <p className="text-[11px] text-slate-500">
                  Mendukung PDF, Foto JPG, PNG, WEBP (Maksimal 10 MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {helperText && !errorMessage && (
        <p className="text-[10.5px] text-slate-500 italic pl-1">
          {helperText}
        </p>
      )}
    </div>
  );
};
