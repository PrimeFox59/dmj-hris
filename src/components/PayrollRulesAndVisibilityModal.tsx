import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SlidersHorizontal,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  Percent,
  Sparkles,
  Save,
  FileText,
  Building,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SalaryRuleConfig, SlipVisibilityConfig } from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';

interface PayrollRulesAndVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  salaryRules: SalaryRuleConfig;
  onSaveSalaryRules: (updated: SalaryRuleConfig) => void;
}

export const PayrollRulesAndVisibilityModal: React.FC<PayrollRulesAndVisibilityModalProps> = ({
  isOpen,
  onClose,
  salaryRules,
  onSaveSalaryRules
}) => {
  const [activeTab, setActiveTab] = useState<'visibility' | 'deductions' | 'allowances'>('visibility');

  // Slip Visibility State
  const initialVis = salaryRules.slipVisibility || {};
  const [visibility, setVisibility] = useState<SlipVisibilityConfig>({
    showFixedAllowance: initialVis.showFixedAllowance ?? true,
    showDailyAllowance: initialVis.showDailyAllowance ?? true,
    showProjectAllowance: initialVis.showProjectAllowance ?? true,
    showOvertimePay: initialVis.showOvertimePay ?? true,
    showBpjsKetenagakerjaan: initialVis.showBpjsKetenagakerjaan ?? true,
    showBpjsKesehatan: initialVis.showBpjsKesehatan ?? true,
    showPph21: initialVis.showPph21 ?? true,
    showLateDeduction: initialVis.showLateDeduction ?? true,
    showUnpaidLeaveDeduction: initialVis.showUnpaidLeaveDeduction ?? true,
    showAlphaDeduction: initialVis.showAlphaDeduction ?? true,
    showKasbonDeduction: initialVis.showKasbonDeduction ?? true,
    hideZeroValues: initialVis.hideZeroValues ?? true
  });

  // Deduction Rates State
  const [bpjsTkPct, setBpjsTkPct] = useState<number>(() =>
    Math.round((salaryRules.bpjsKetenagakerjaanRate ?? 0.03) * 100 * 10) / 10
  );
  const [bpjsKesPct, setBpjsKesPct] = useState<number>(() =>
    Math.round((salaryRules.bpjsKesehatanRate ?? 0.01) * 100 * 10) / 10
  );
  const [pph21Enabled, setPph21Enabled] = useState<boolean>(
    salaryRules.pph21Enabled !== false
  );
  const [pph21Mode, setPph21Mode] = useState<'STANDARD' | 'CUSTOM'>(
    salaryRules.pph21CustomRate !== undefined ? 'CUSTOM' : 'STANDARD'
  );
  const [pph21CustomPct, setPph21CustomPct] = useState<number>(() =>
    salaryRules.pph21CustomRate !== undefined
      ? Math.round(salaryRules.pph21CustomRate * 100 * 10) / 10
      : 5.0
  );
  const [officeLatePenalty, setOfficeLatePenalty] = useState<number>(
    salaryRules.officeLatePenaltyPerHour ?? 50000
  );

  // Allowances State
  const [dailyAllowance, setDailyAllowance] = useState<number>(
    salaryRules.defaultDailyAllowance ?? 50000
  );
  const [projectAllowance, setProjectAllowance] = useState<number>(
    salaryRules.remoteProjectAllowance ?? 1500000
  );

  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleToggle = (key: keyof SlipVisibilityConfig) => {
    setVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleResetDefaults = () => {
    setVisibility({
      showFixedAllowance: true,
      showDailyAllowance: true,
      showProjectAllowance: true,
      showOvertimePay: true,
      showBpjsKetenagakerjaan: true,
      showBpjsKesehatan: true,
      showPph21: true,
      showLateDeduction: true,
      showUnpaidLeaveDeduction: true,
      showAlphaDeduction: true,
      showKasbonDeduction: true,
      hideZeroValues: true
    });
    setBpjsTkPct(3.0);
    setBpjsKesPct(1.0);
    setPph21Enabled(true);
    setPph21Mode('STANDARD');
    setPph21CustomPct(5.0);
    setOfficeLatePenalty(50000);
    setDailyAllowance(50000);
    setProjectAllowance(1500000);
  };

  const handleSave = () => {
    const updated: SalaryRuleConfig = {
      ...salaryRules,
      bpjsKetenagakerjaanRate: bpjsTkPct / 100,
      bpjsKesehatanRate: bpjsKesPct / 100,
      pph21Enabled,
      pph21CustomRate: pph21Enabled && pph21Mode === 'CUSTOM' ? pph21CustomPct / 100 : undefined,
      officeLatePenaltyPerHour: officeLatePenalty,
      defaultDailyAllowance: dailyAllowance,
      remoteProjectAllowance: projectAllowance,
      slipVisibility: visibility
    };

    onSaveSalaryRules(updated);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1000);
  };

  return typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 relative my-auto modal-dialog-animate max-h-[92vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center shadow-xs shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Pengaturan Tarif, Tunjangan & Visibilitas Slip</span>
                    <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold uppercase">
                      FINANCE SUITE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Konfigurasi fleksibilitas persentase potongan, nominal tunjangan, dan poin visibilitas pada Slip Gaji
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl my-4 shrink-0 text-xs font-bold font-mono-code">
              <button
                type="button"
                onClick={() => setActiveTab('visibility')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'visibility'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>1. Visibilitas Slip (Hide/Show)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('deductions')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'deductions'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5 text-rose-600" />
                <span>2. Persentase Potongan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('allowances')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'allowances'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Standar Tunjangan</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar text-xs">
              {/* TAB 1: VISIBILITAS KOMPONEN SLIP GAJI */}
              {activeTab === 'visibility' && (
                <div className="space-y-4">
                  {/* Master Switch: Sembunyikan Rp 0 */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-orange-50/90 border border-orange-200 flex items-center justify-between gap-4 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono-code font-black uppercase px-2 py-0.5 rounded bg-[#FF6B00] text-white">
                          REKOMENDASI EKSEKUTIF
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs">
                          Sembunyikan Otomatis Komponen Bernilai Rp 0
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Jika diaktifkan, komponen tunjangan atau potongan bernilai Rp 0 (seperti Uang Makan 0 hari atau Denda Terlambat Rp 0) otomatis tidak ditampilkan pada slip, menghasilkan tampilan yang jauh lebih bersih dan ringkas.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle('hideZeroValues')}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        visibility.hideZeroValues ? 'bg-[#FF6B00]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          visibility.hideZeroValues ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Individual Items Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Kolom A: Penerimaan */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <h5 className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider font-mono-code border-b border-emerald-200/80 pb-1.5 flex items-center justify-between">
                        <span>A. Komponen Penerimaan</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">Tampil / Sembunyi</span>
                      </h5>

                      <div className="space-y-2">
                        {[
                          { key: 'showFixedAllowance', label: 'Tunjangan Tetap / Jabatan' },
                          { key: 'showDailyAllowance', label: 'Uang Makan / Harian' },
                          { key: 'showProjectAllowance', label: 'Tunjangan Penugasan Proyek' },
                          { key: 'showOvertimePay', label: 'Upah Lembur Kerja' }
                        ].map(item => {
                          const isShown = visibility[item.key as keyof SlipVisibilityConfig] !== false;
                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between py-1 px-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs"
                            >
                              <span className="text-slate-700 text-xs font-medium">{item.label}</span>
                              <button
                                type="button"
                                onClick={() => handleToggle(item.key as keyof SlipVisibilityConfig)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono-code flex items-center gap-1 transition-all cursor-pointer ${
                                  isShown
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {isShown ? <Eye className="w-3 h-3 text-emerald-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
                                <span>{isShown ? 'TAMPIL' : 'SEMBUNYI'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Kolom B: Potongan */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <h5 className="font-bold text-rose-800 text-[11px] uppercase tracking-wider font-mono-code border-b border-rose-200/80 pb-1.5 flex items-center justify-between">
                        <span>B. Komponen Potongan</span>
                        <span className="text-[10px] text-rose-700 font-semibold">Tampil / Sembunyi</span>
                      </h5>

                      <div className="space-y-2">
                        {[
                          { key: 'showBpjsKetenagakerjaan', label: 'BPJS Ketenagakerjaan' },
                          { key: 'showBpjsKesehatan', label: 'BPJS Kesehatan' },
                          { key: 'showPph21', label: 'Estimasi Pajak PPh 21' },
                          { key: 'showLateDeduction', label: 'Potongan Keterlambatan' },
                          { key: 'showUnpaidLeaveDeduction', label: 'Potongan Cuti Unpaid' },
                          { key: 'showAlphaDeduction', label: 'Potongan Alpha / Mangkir' },
                          { key: 'showKasbonDeduction', label: 'Potongan Kasbon Pribadi' }
                        ].map(item => {
                          const isShown = visibility[item.key as keyof SlipVisibilityConfig] !== false;
                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between py-1 px-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs"
                            >
                              <span className="text-slate-700 text-xs font-medium">{item.label}</span>
                              <button
                                type="button"
                                onClick={() => handleToggle(item.key as keyof SlipVisibilityConfig)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono-code flex items-center gap-1 transition-all cursor-pointer ${
                                  isShown
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {isShown ? <Eye className="w-3 h-3 text-emerald-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
                                <span>{isShown ? 'TAMPIL' : 'SEMBUNYI'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSENTASE POTONGAN */}
              {activeTab === 'deductions' && (
                <div className="space-y-4">
                  {/* BPJS Ketenagakerjaan */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>BPJS Ketenagakerjaan (Iuran Karyawan)</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono-code text-[10px] font-bold">
                            Default: 3.0%
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Dipotong dari Gaji Pokok untuk JHT (2%) dan Jaminan Pensiun JP (1%)
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black font-mono-code text-blue-900">
                          {bpjsTkPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.5"
                        value={bpjsTkPct}
                        onChange={e => setBpjsTkPct(parseFloat(e.target.value))}
                        className="flex-1 accent-[#FF6B00] cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        {[0, 1, 2, 3].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setBpjsTkPct(val)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold border transition-all cursor-pointer ${
                              bpjsTkPct === val
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {val === 0 ? '0% (Bebas)' : `${val}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* BPJS Kesehatan */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>BPJS Kesehatan (Iuran Karyawan)</span>
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono-code text-[10px] font-bold">
                            Default: 1.0%
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Dipotong dari Gaji Pokok (sesuai regulasi 1% pekerja, 4% ditanggung perusahaan)
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black font-mono-code text-teal-900">
                          {bpjsKesPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={bpjsKesPct}
                        onChange={e => setBpjsKesPct(parseFloat(e.target.value))}
                        className="flex-1 accent-teal-600 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        {[0, 0.5, 1, 2].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setBpjsKesPct(val)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold border transition-all cursor-pointer ${
                              bpjsKesPct === val
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {val === 0 ? '0% (Bebas)' : `${val}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pajak Penghasilan PPh 21 */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>Estimasi Pemotongan Pajak PPh 21</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold uppercase ${
                            pph21Enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {pph21Enabled ? 'AKTIF DIPOTONG' : 'NONAKTIF / BEBAS PAJAK (0%)'}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Atur apakah pajak dipotong dari slip atau ditanggung perusahaan (Gross Up / Bebas)
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPph21Enabled(prev => !prev)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          pph21Enabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            pph21Enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {pph21Enabled && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase font-mono-code block">
                          Metode Perhitungan Tarif Pajak:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPph21Mode('STANDARD')}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              pph21Mode === 'STANDARD'
                                ? 'bg-white border-[#FF6B00] shadow-xs ring-1 ring-[#FF6B00]/20'
                                : 'bg-white/60 border-slate-200 hover:bg-white'
                            }`}
                          >
                            <span className="font-bold text-slate-900 block text-xs">Standar Progresif PTKP</span>
                            <span className="text-[10.5px] text-slate-500 block">Sesuai status TK/0, K/1, dst. (5% PKP)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPph21Mode('CUSTOM')}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              pph21Mode === 'CUSTOM'
                                ? 'bg-white border-[#FF6B00] shadow-xs ring-1 ring-[#FF6B00]/20'
                                : 'bg-white/60 border-slate-200 hover:bg-white'
                            }`}
                          >
                            <span className="font-bold text-slate-900 block text-xs">Tarif Persentase Kustom</span>
                            <span className="text-[10.5px] text-slate-500 block">Tentukan persentase flat khusus</span>
                          </button>
                        </div>

                        {pph21Mode === 'CUSTOM' && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-slate-600 text-xs">Persentase Kustom:</span>
                            <input
                              type="number"
                              min="0"
                              max="35"
                              step="0.5"
                              value={pph21CustomPct}
                              onChange={e => setPph21CustomPct(parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono-code font-bold text-xs"
                            />
                            <span className="text-slate-500 font-mono-code font-bold">% dari Penghasilan Kena Pajak</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Denda Keterlambatan */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">
                          Tarif Denda Keterlambatan Office (per Jam)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Berlaku khusus karyawan kantor pusat / office yang terlambat tanpa dispensasi
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700 font-mono-code">Rp</span>
                        <input
                          type="number"
                          step="10000"
                          min="0"
                          value={officeLatePenalty}
                          onChange={e => setOfficeLatePenalty(parseInt(e.target.value, 10) || 0)}
                          className="w-28 px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-mono-code font-bold text-xs text-right"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: STANDAR TUNJANGAN DI LUAR GAJI POKOK */}
              {activeTab === 'allowances' && (
                <div className="space-y-4">
                  {/* Standar Uang Makan */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>Standar Uang Makan / Harian</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono-code text-[10px] font-bold">
                            Per Hari Hadir Riil
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Dikalikan dengan jumlah hari hadir fisik karyawan (karyawan 0 hari hadir = Rp 0)
                        </p>
                      </div>

                      <span className="text-base font-black font-mono-code text-emerald-800">
                        {formatSalaryDisplay(dailyAllowance, false)} / hari
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono-code text-xs">Rp</span>
                        <input
                          type="number"
                          step="5000"
                          min="0"
                          value={dailyAllowance}
                          onChange={e => setDailyAllowance(parseInt(e.target.value, 10) || 0)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono-code font-bold text-xs text-slate-800"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {[0, 30000, 50000, 75000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDailyAllowance(val)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold border transition-all cursor-pointer ${
                              dailyAllowance === val
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {val === 0 ? 'Rp 0' : `Rp ${(val / 1000).toLocaleString('id-ID')}rb`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tunjangan Penugasan Proyek */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>Standar Tunjangan Penugasan Proyek (Remote / Roster)</span>
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono-code text-[10px] font-bold">
                            Per Bulan
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Diberikan bulanan untuk personel lapangan site non-lokal (dapat dioverride per karyawan)
                        </p>
                      </div>

                      <span className="text-base font-black font-mono-code text-purple-900">
                        {formatSalaryDisplay(projectAllowance, false)} / bln
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono-code text-xs">Rp</span>
                        <input
                          type="number"
                          step="100000"
                          min="0"
                          value={projectAllowance}
                          onChange={e => setProjectAllowance(parseInt(e.target.value, 10) || 0)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono-code font-bold text-xs text-slate-800"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {[0, 1000000, 1500000, 2000000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setProjectAllowance(val)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold border transition-all cursor-pointer ${
                              projectAllowance === val
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {val === 0 ? 'Rp 0' : `Rp ${(val / 1000000).toLocaleString('id-ID')}jt`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      <strong>Catatan Fleksibilitas:</strong> Tunjangan Tetap / Jabatan dan Tunjangan Proyek Khusus juga dapat diset secara personal per karyawan melalui modal <strong>Atur Struktur Gaji Karyawan</strong> di tabel payroll.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Kembalikan ke standar Depnaker RI"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>

              <div className="flex items-center gap-2">
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
                  className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {savedNotice ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Tersimpan!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan & Terapkan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
};
