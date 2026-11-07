import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Employee } from '../types';

interface BiometricDailyReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEnrollment: () => void;
  currentUser: Employee;
}

export const BiometricDailyReminderModal: React.FC<BiometricDailyReminderModalProps> = ({
  isOpen,
  onClose,
  onOpenEnrollment,
  currentUser
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative my-auto modal-dialog-animate overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative top background gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#FF6B00] via-amber-500 to-orange-400" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          title="Tutup Himbauan"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with 3D Shield Badge */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldAlert className="w-6 h-6 text-[#FF6B00]" />
          </div>
          <div className="pr-6">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider font-mono-code bg-orange-100 text-[#FF6B00] border border-orange-200/80">
                PENTING • ZERO-TRUST COMPLIANCE
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5 font-sans">
              Himbauan Pendaftaran Biometrik Wajah
            </h3>
            <p className="text-[11px] text-slate-500 font-mono-code">
              Standar ISO 27001 & Presensi Anti-Titip Absen
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="py-4 space-y-3.5 text-xs font-sans">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="text-slate-800 font-semibold leading-relaxed">
              Halo, <span className="font-black text-slate-900">{currentUser.name}</span>{' '}
              <span className="text-[11px] font-mono-code text-slate-500">
                ({currentUser.nik || (currentUser as any).loginId || currentUser.id})
              </span>
              ! Profil biometrik wajah 4-pose Anda{' '}
              <span className="text-rose-600 font-bold underline decoration-rose-300">belum terdaftar</span> di sistem.
            </p>
            <p className="text-slate-600 text-[11.5px] leading-relaxed">
              Untuk menjamin keabsahan presensi GPS kamera, liveness detection, dan perlindungan identitas akun dari fraud, silakan rekam 4 pose wajah Anda sekarang (proses cepat hanya ~30 detik).
            </p>
          </div>

          {/* 4 Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-200/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">4 Sudut Pose Wajah</span>
                <span className="text-[10px] text-slate-500 leading-tight">Depan, Kanan, Kiri, dan Senyum</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Anti-Titip Absen</span>
                <span className="text-[10px] text-slate-500 leading-tight">Verifikasi liveness & anti-spoofing</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Presensi Kilat 0.2s</span>
                <span className="text-[10px] text-slate-500 leading-tight">Pencocokan vektor instan saat presensi</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Terenkripsi Aman</span>
                <span className="text-[10px] text-slate-500 leading-tight">Privasi data terproteksi di SQLite WAL</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono-code pt-0.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Pemberitahuan ini otomatis muncul 1 kali per hari hingga biometrik Anda terdaftar.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Ingatkan Saya Besok
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEnrollment();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] via-amber-500 to-[#FF8533] hover:from-[#e56000] hover:to-[#e5752c] text-white text-xs font-black shadow-md shadow-orange-500/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Daftarkan Biometrik Sekarang (4 Pose)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
