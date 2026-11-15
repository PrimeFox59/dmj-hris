import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SlidersHorizontal,
  Building2,
  HardHat,
  Calculator,
  CheckCircle2,
  Info,
  Save,
  X,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight
} from 'lucide-react';
import { SalaryRuleConfig, SalaryDailyDivisorMode, Project } from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';

interface PayrollDailyDivisorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  salaryRules: SalaryRuleConfig;
  currentWorkingDays: number;
  onSaveSalaryRules: (updated: SalaryRuleConfig) => void;
  projects?: Project[];
}

export const PayrollDailyDivisorSettingsModal: React.FC<PayrollDailyDivisorSettingsModalProps> = ({
  isOpen,
  onClose,
  salaryRules,
  currentWorkingDays,
  onSaveSalaryRules,
  projects = []
}) => {
  const [officeMode, setOfficeMode] = useState<SalaryDailyDivisorMode>(
    salaryRules.officeDailyDivisorMode || 'OFFICE_WORKING_DAYS'
  );
  const [officeCustomDays, setOfficeCustomDays] = useState<number>(
    salaryRules.officeDailyDivisorDays || 22
  );
  const [projectMode, setProjectMode] = useState<SalaryDailyDivisorMode>(
    salaryRules.projectDailyDivisorMode || 'CALENDAR_30'
  );
  const [projectCustomDays, setProjectCustomDays] = useState<number>(
    salaryRules.projectDailyDivisorDays || 30
  );
  const [projectStandardDays, setProjectStandardDays] = useState<number>(
    salaryRules.projectStandardWorkDaysPerMonth || 25
  );
  const [officeStandardDays, setOfficeStandardDays] = useState<number>(
    salaryRules.standardWorkDaysPerMonth || 22
  );

  // Simulation state
  const [sampleSalary, setSampleSalary] = useState<number>(10000000);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute effective divisors for preview
  const effectiveOfficeDivisor =
    officeMode === 'OFFICE_WORKING_DAYS'
      ? (currentWorkingDays || officeStandardDays || 22)
      : officeMode === 'PROJECT_25'
      ? 25
      : officeMode === 'CALENDAR_30'
      ? 30
      : officeCustomDays || 22;

  const effectiveProjectDivisor =
    projectMode === 'CALENDAR_30'
      ? 30
      : projectMode === 'PROJECT_25'
      ? 25
      : projectMode === 'OFFICE_WORKING_DAYS'
      ? (currentWorkingDays || officeStandardDays || 22)
      : projectCustomDays || 30;

  const officeDailyRate = Math.round(sampleSalary / Math.max(1, effectiveOfficeDivisor));
  const projectDailyRate = Math.round(sampleSalary / Math.max(1, effectiveProjectDivisor));

  const handleSave = () => {
    const updated: SalaryRuleConfig = {
      ...salaryRules,
      standardWorkDaysPerMonth: officeStandardDays,
      officeDailyDivisorMode: officeMode,
      officeDailyDivisorDays: officeCustomDays,
      projectDailyDivisorMode: projectMode,
      projectDailyDivisorDays: projectCustomDays,
      projectStandardWorkDaysPerMonth: projectStandardDays
    };

    onSaveSalaryRules(updated);
    setSavedToast('Aturan pembagian gaji & potongan harian berhasil disimpan!');
    setTimeout(() => {
      setSavedToast(null);
      onClose();
    }, 1200);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-4xl w-full p-5 sm:p-6 text-left space-y-6 relative max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-[#FF6B00] text-white shadow-md shadow-orange-500/20 shrink-0">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Pengaturan Pembagian Gaji Harian (Divisor By Day) & Hari Kerja
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#FF6B00] uppercase tracking-wider font-mono-code">
                HR & Payroll Policy
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Atur rumus pembagi gaji harian (rate per hari) untuk menghitung upah per hari, potongan ketidakhadiran (alpha/mangkir), dan cuti tanpa upah (unpaid leave) secara fleksibel antara <strong>Bagian Office</strong> dan <strong>Site Proyek</strong>.
            </p>
          </div>
        </div>

        {/* Toast Alert */}
        {savedToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedToast}</span>
          </div>
        )}

        {/* SECTION 1: KARYAWAN OFFICE */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  1. Basis Pembagi Gaji Harian: Bagian Office (Kantor Pusat)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Berlaku untuk staf Head Office, HR, Finance, Accounting, dan Management Support
                </p>
              </div>
            </div>
            <span className="text-xs font-bold font-mono-code px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              Aktif: {effectiveOfficeDivisor} Hari Pembagi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Office Option 1 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                officeMode === 'OFFICE_WORKING_DAYS'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="officeMode"
                value="OFFICE_WORKING_DAYS"
                checked={officeMode === 'OFFICE_WORKING_DAYS'}
                onChange={() => setOfficeMode('OFFICE_WORKING_DAYS')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Mengikuti Hari Kerja HRD</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                    Rekomendasi
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Membagi gaji berdasarkan hari kerja efektif kalender bulanan ({currentWorkingDays || officeStandardDays} HK). Potongan absen = Upah / {currentWorkingDays || officeStandardDays} HK.
                </p>
              </div>
            </label>

            {/* Office Option 2 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                officeMode === 'PROJECT_25'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="officeMode"
                value="PROJECT_25"
                checked={officeMode === 'PROJECT_25'}
                onChange={() => setOfficeMode('PROJECT_25')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <div className="font-bold text-slate-900">25 Hari Kerja Tetap</div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Gaji dibagi tetap 25 hari kerja setiap bulan. Potongan per hari absen = Upah / 25 HK.
                </p>
              </div>
            </label>

            {/* Office Option 3 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                officeMode === 'CALENDAR_30'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="officeMode"
                value="CALENDAR_30"
                checked={officeMode === 'CALENDAR_30'}
                onChange={() => setOfficeMode('CALENDAR_30')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <div className="font-bold text-slate-900">30 Hari Kalender Penuh</div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Gaji dibagi flat 30 hari kalender sebulan. Potongan per hari absen = Upah / 30 Hari.
                </p>
              </div>
            </label>

            {/* Office Option 4 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                officeMode === 'CUSTOM'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="officeMode"
                value="CUSTOM"
                checked={officeMode === 'CUSTOM'}
                onChange={() => setOfficeMode('CUSTOM')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div className="flex-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Kustom Hari Kerja Office</span>
                  {officeMode === 'CUSTOM' && (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={officeCustomDays}
                      onChange={e => setOfficeCustomDays(Number(e.target.value))}
                      className="w-14 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-center"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Tentukan jumlah pembagi hari kerja sendiri (misal 20, 21, atau 24 hari).
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 2: KARYAWAN SITE PROYEK */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                <HardHat className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  2. Basis Pembagi Gaji Harian: Site Proyek (Lapangan / Smelter / Konstruksi)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Berlaku untuk seluruh engineer lapangan, mandor, pengawas site, dan kru operasional proyek
                </p>
              </div>
            </div>
            <span className="text-xs font-bold font-mono-code px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 border border-orange-200">
              Aktif: {effectiveProjectDivisor} Hari Pembagi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Project Option 1 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                projectMode === 'CALENDAR_30'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="projectMode"
                value="CALENDAR_30"
                checked={projectMode === 'CALENDAR_30'}
                onChange={() => setProjectMode('CALENDAR_30')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>30 Hari Kalender Proyek</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800">
                    Standar Proyek / Smelter
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Gaji pokok dibagi 30 hari kalender flat sesuai standar kontrak proyek site smelter/konstruksi (Rp Gaji / 30 Hari).
                </p>
              </div>
            </label>

            {/* Project Option 2 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                projectMode === 'PROJECT_25'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="projectMode"
                value="PROJECT_25"
                checked={projectMode === 'PROJECT_25'}
                onChange={() => setProjectMode('PROJECT_25')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <div className="font-bold text-slate-900">25 Hari Kerja Proyek</div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Gaji dibagi 25 hari kerja lapangan (jadwal operasional 6 hari kerja/minggu). Potongan absen = Upah / 25 HK.
                </p>
              </div>
            </label>

            {/* Project Option 3 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                projectMode === 'OFFICE_WORKING_DAYS'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="projectMode"
                value="OFFICE_WORKING_DAYS"
                checked={projectMode === 'OFFICE_WORKING_DAYS'}
                onChange={() => setProjectMode('OFFICE_WORKING_DAYS')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <div className="font-bold text-slate-900">Mengikuti Hari Kerja HRD (Office)</div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Disamakan dengan hari kerja kalender kantor pusat ({currentWorkingDays || officeStandardDays} HK).
                </p>
              </div>
            </label>

            {/* Project Option 4 */}
            <label
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                projectMode === 'CUSTOM'
                  ? 'bg-white border-[#FF6B00] ring-2 ring-[#FF6B00]/20 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="projectMode"
                value="CUSTOM"
                checked={projectMode === 'CUSTOM'}
                onChange={() => setProjectMode('CUSTOM')}
                className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div className="flex-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Kustom Hari Kerja Proyek</span>
                  {projectMode === 'CUSTOM' && (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={projectCustomDays}
                      onChange={e => setProjectCustomDays(Number(e.target.value))}
                      className="w-14 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-center"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Tentukan jumlah pembagi hari kerja proyek secara fleksibel (misal 26 atau 28 hari).
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 3: SIMULATOR DAMPAK PERHITUNGAN NYATA (LIVE MATRIX) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#FF6B00]" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono-code">
                Simulasi Dampak Nominal Gaji & Potongan Harian
              </h4>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Contoh Gaji Pokok:</span>
              <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 border border-white/20">
                <span className="text-orange-400 font-mono-code font-bold mr-1">Rp</span>
                <input
                  type="number"
                  step={500000}
                  value={sampleSalary}
                  onChange={e => setSampleSalary(Number(e.target.value))}
                  className="w-24 bg-transparent text-white font-bold font-mono-code text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Office Preview Card */}
            <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Bagian Office ({effectiveOfficeDivisor} HK)
                </span>
                <span className="text-[10px] font-mono-code text-slate-400">
                  Basis: {officeMode}
                </span>
              </div>
              <div className="pt-1 border-t border-white/10 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Nilai Gaji Pokok Harian:</span>
                  <span className="font-mono-code font-bold text-white text-sm">
                    {formatSalaryDisplay(officeDailyRate, true)} / hari
                  </span>
                </div>
                <div className="flex justify-between items-center text-rose-300">
                  <span>Potongan 1 Hari Alpha/Unpaid:</span>
                  <span className="font-mono-code font-bold">
                    -{formatSalaryDisplay(officeDailyRate, true)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-rose-300">
                  <span>Potongan 3 Hari Alpha/Unpaid:</span>
                  <span className="font-mono-code font-bold">
                    -{formatSalaryDisplay(officeDailyRate * 3, true)}
                  </span>
                </div>
              </div>
            </div>

            {/* Project Preview Card */}
            <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-orange-300 flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5" /> Site Proyek ({effectiveProjectDivisor} Hari)
                </span>
                <span className="text-[10px] font-mono-code text-slate-400">
                  Basis: {projectMode}
                </span>
              </div>
              <div className="pt-1 border-t border-white/10 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Nilai Gaji Pokok Harian:</span>
                  <span className="font-mono-code font-bold text-white text-sm">
                    {formatSalaryDisplay(projectDailyRate, true)} / hari
                  </span>
                </div>
                <div className="flex justify-between items-center text-rose-300">
                  <span>Potongan 1 Hari Alpha/Unpaid:</span>
                  <span className="font-mono-code font-bold">
                    -{formatSalaryDisplay(projectDailyRate, true)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-rose-300">
                  <span>Potongan 3 Hari Alpha/Unpaid:</span>
                  <span className="font-mono-code font-bold">
                    -{formatSalaryDisplay(projectDailyRate * 3, true)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span>Perbedaan Beban Potongan per Hari (Office vs Proyek):</span>
            <span className="font-bold font-mono-code text-amber-300">
              Selisih {formatSalaryDisplay(Math.abs(officeDailyRate - projectDailyRate), true)} / hari
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <p className="text-[11px] text-slate-500 font-mono-code hidden sm:block">
            Perubahan otomatis berlaku ke seluruh perhitungan gaji & rekapitulasi audit HR.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6B00] hover:from-orange-600 hover:to-[#e56000] text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan & Terapkan Pengaturan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
