import { createPortal } from 'react-dom';
import React, { useState, useMemo } from 'react';
import {
  Banknote,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter,
  Layers,
  FileSpreadsheet,
  Building2,
  PieChart,
  ShieldCheck,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Project, Employee, SalaryRuleConfig } from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';

interface FinanceTimelineChartProps {
  projects: Project[];
  employees: Employee[];
  salaryRules: SalaryRuleConfig;
  onNavigateToTab: (tabId: string, projectIdFilter?: string) => void;
}

interface FinancialMilestone {
  day: number;
  dateStr: string;
  title: string;
  phase: string;
  category: 'PREPARATION' | 'SIMULATION' | 'TAX_BPJS' | 'DISBURSEMENT' | 'BILLING';
  estAmount: number;
  status: 'COMPLETED' | 'ACTIVE_TODAY' | 'SCHEDULED';
  description: string;
  parties: string[];
}

export const FinanceTimelineChart: React.FC<FinanceTimelineChartProps> = ({
  projects,
  employees,
  salaryRules,
  onNavigateToTab
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [scrubberDay, setScrubberDay] = useState<number>(8); // Defaults to Day 8 (Today: Sep 8)
  const [selectedMilestone, setSelectedMilestone] = useState<FinancialMilestone | null>(null);
  const [showChartNominal, setShowChartNominal] = useState<boolean>(false);

  // Compute total monthly payroll estimate across all employees
  const totalMonthlyBaseSalary = employees.reduce((acc, e) => acc + (e.baseSalary || 0), 0);
  const totalMonthlyFixedAllowance = employees.reduce((acc, e) => acc + (e.fixedAllowance || 0), 0);
  const totalMonthlyDailyAllowance = employees.reduce((acc, e) => acc + ((e.dailyAllowance || 0) * 22), 0);
  const totalEstimatedOvertime = employees.reduce((acc, e) => {
    const hourlyRate = (e.baseSalary || 0) / 173;
    return acc + Math.round(hourlyRate * 12);
  }, 0);
  const totalEstimatedGross = totalMonthlyBaseSalary + totalMonthlyFixedAllowance + totalMonthlyDailyAllowance + totalEstimatedOvertime;
  const bpjsRate = (salaryRules.bpjsKetenagakerjaanRate || 0.03) + (salaryRules.bpjsKesehatanRate || 0.01);
  const totalEstimatedDeductions = Math.round(totalMonthlyBaseSalary * bpjsRate) + 3200000;
  const totalNetPayrollDisbursement = Math.max(0, totalEstimatedGross - totalEstimatedDeductions);

  // Key Financial Milestones in the 30-day cycle
  const milestones: FinancialMilestone[] = [
    {
      day: 5,
      dateStr: '5 September 2026',
      title: 'Verifikasi Absensi & Timesheet Minggu I',
      phase: 'Timesheet Ingestion',
      category: 'PREPARATION',
      estAmount: Math.round(totalNetPayrollDisbursement * 0.15),
      status: 'COMPLETED',
      description: 'Rekonsiliasi awal rekaman check-in kamera, verifikasi Geofence GPS kantor pusat & seluruh site proyek PT Dwi Martha Jaya.',
      parties: ['HR People Operations', 'Site Supervisor']
    },
    {
      day: 8,
      dateStr: '8 September 2026 (HARI INI)',
      title: 'Cutoff Interim & Simulasi Payroll Bulanan',
      phase: 'Interim Payroll Run',
      category: 'SIMULATION',
      estAmount: Math.round(totalNetPayrollDisbursement * 0.25),
      status: 'ACTIVE_TODAY',
      description: 'Kalkulasi interim gaji pokok, tunjangan penugasan proyek, serta simulasi pembebanan biaya tenaga kerja antar-proyek.',
      parties: ['Finance Lead', 'HR Manager']
    },
    {
      day: 15,
      dateStr: '15 September 2026',
      title: 'Audit Kehadiran & Tunjangan Site',
      phase: 'Attendance & Site Audit',
      category: 'PREPARATION',
      estAmount: Math.round(totalNetPayrollDisbursement * 0.50),
      status: 'SCHEDULED',
      description: 'Verifikasi presensi tervalidasi dan tunjangan penugasan personil lapangan serta lembur terkonfirmasi.',
      parties: ['Project Manager Divisi', 'Payroll Officer']
    },
    {
      day: 20,
      dateStr: '20 September 2026',
      title: 'Finalisasi Pajak PPh 21 & Iuran BPJS',
      phase: 'Tax & Compliance Audit',
      category: 'TAX_BPJS',
      estAmount: totalEstimatedDeductions,
      status: 'SCHEDULED',
      description: 'Penyusunan bukti potong PPh 21 Pasal 21/26, BPJS Ketenagakerjaan (3%) dan BPJS Kesehatan (1%) yang disetor ke kas negara.',
      parties: ['Tax Accountant', 'BPJS Ketenagakerjaan']
    },
    {
      day: 25,
      dateStr: '25 September 2026',
      title: 'DISBURSEMENT PAYROLL RUN (Transfer Bank)',
      phase: 'Cash Outflow Settlement',
      category: 'DISBURSEMENT',
      estAmount: totalNetPayrollDisbursement,
      status: 'SCHEDULED',
      description: 'Pencairan gaji bersih (THP) seluruh tenaga kerja PT Dwi Martha Jaya serentak via Auto-Debit Bank Mandiri, BCA, BNI & BSI.',
      parties: ['Managing Director', 'Bank Mitra Cash Management']
    },
    {
      day: 28,
      dateStr: '28 September 2026',
      title: 'Invoicing Tagihan Tenaga Kerja ke Proyek',
      phase: 'Project Cost Allocation & Billing',
      category: 'BILLING',
      estAmount: totalEstimatedGross,
      status: 'SCHEDULED',
      description: 'Jurnal akuntansi pembebanan biaya tenaga kerja langsung (Direct Labor Cost) ke kode akun proyek PT Dwi Martha Jaya.',
      parties: ['Project Accounting Lead', 'Client Representative']
    }
  ];

  // Filtered Project stats
  const activeProject = selectedProjectId === 'ALL' ? null : projects.find(p => p.id === selectedProjectId);
  const totalAllocatedBudget = projects.reduce((acc, p) => acc + (p.allocatedBudget || 0), 0);
  const totalActualLaborCost = projects.reduce((acc, p) => acc + (p.actualLaborCost || 0), 0);
  const overallBurnRate = totalAllocatedBudget > 0 ? Math.round((totalActualLaborCost / totalAllocatedBudget) * 100) : 0;

  // Bank Disbursement Breakdown Data
  const bankBreakdowns = [
    { bank: 'Bank Central Asia (BCA)', employees: Math.max(1, Math.round(employees.length * 0.45)), total: Math.round(totalNetPayrollDisbursement * 0.46), color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { bank: 'Bank Mandiri', employees: Math.max(1, Math.round(employees.length * 0.25)), total: Math.round(totalNetPayrollDisbursement * 0.25), color: 'text-amber-800 bg-amber-50 border-amber-200' },
    { bank: 'Bank Negara Indonesia (BNI)', employees: Math.max(1, Math.round(employees.length * 0.18)), total: Math.round(totalNetPayrollDisbursement * 0.18), color: 'text-teal-800 bg-teal-50 border-teal-200' },
    { bank: 'Bank Syariah Indonesia (BSI)', employees: Math.max(1, Math.round(employees.length * 0.12)), total: Math.round(totalNetPayrollDisbursement * 0.11), color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  ];

  // Interactive Progressive Cashflow Curve (Proportional S-Curve based on actual totalNetPayrollDisbursement)
  const daysInMonth = 30;
  const curvePoints = useMemo(() => {
    const peak = totalNetPayrollDisbursement > 0 ? totalNetPayrollDisbursement : 150000000;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      let cumulativeCash = 0;
      if (day <= 5) {
        // Week 1: Initial labor accrual (0% -> 15%)
        cumulativeCash = (day / 5) * (peak * 0.15);
      } else if (day <= 15) {
        // Week 2: Mid-month site progress & overtime (15% -> 50%)
        cumulativeCash = (peak * 0.15) + ((day - 5) / 10) * (peak * 0.35);
      } else if (day <= 24) {
        // Week 3-4: Cutoff preparation & BPJS accrual (50% -> 90%)
        cumulativeCash = (peak * 0.50) + ((day - 15) / 9) * (peak * 0.40);
      } else {
        // Day 25+: Final disbursement execution & settlement (100% peak)
        cumulativeCash = peak;
      }
      return { day, cash: Math.round(cumulativeCash) };
    });
  }, [totalNetPayrollDisbursement]);

  // SVG dimensions for smooth curve
  const svgWidth = 840;
  const svgHeight = 230;
  const maxCash = (totalNetPayrollDisbursement > 0 ? totalNetPayrollDisbursement : 150000000) * 1.15;

  // Convert points to smooth bezier path
  const svgPathData = useMemo(() => {
    const coords = curvePoints.map((pt, idx) => {
      const x = (idx / (daysInMonth - 1)) * (svgWidth - 70) + 35;
      const y = svgHeight - 40 - (pt.cash / maxCash) * (svgHeight - 75);
      return { x, y };
    });

    if (coords.length === 0) return { pathLine: '', pathArea: '' };

    let pathLine = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const current = coords[i];
      const next = coords[i + 1];
      const controlX = (current.x + next.x) / 2;
      pathLine += ` C ${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`;
    }

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottomY = svgHeight - 40;
    const pathArea = `${pathLine} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

    return { pathLine, pathArea };
  }, [curvePoints, maxCash]);

  // Current scrubbed point values
  const currentScrubbedCash = curvePoints[scrubberDay - 1]?.cash || 0;

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-md space-y-6 motion-fade-in-up">
      {/* 1. Header & Unified Control Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[10px] font-extrabold tracking-wider uppercase font-mono-code shadow-2xs">
              TIMELINE FINANCE &amp; CASHFLOW
            </span>
            <span className="text-xs font-bold text-slate-500 font-mono-code">
              Siklus Penggajian &amp; Arus Kas • DMJ HRIS Enterprise
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#FF6B00]" />
            Timeline Arus Kas Penggajian &amp; Anggaran Proyek (30 Hari)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulasi komitmen arus kas pencairan gaji, serta pembebanan biaya ke proyek PT Dwi Martha Jaya.
          </p>
        </div>

        {/* Unified Toolbar: Privacy Toggle + Project Filter */}
        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
          <button
            type="button"
            onClick={() => setShowChartNominal(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
              showChartNominal
                ? 'bg-orange-50 text-[#FF6B00] border-orange-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
            title="Buka / Tutup sensor angka nominal arus kas"
          >
            {showChartNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
            <span>{showChartNominal ? 'Sembunyikan Nominal' : 'Tampilkan Nominal'}</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shadow-2xs">
            <Building2 className="w-4 h-4 text-[#FF6B00] shrink-0" />
            <span className="font-bold text-slate-600 whitespace-nowrap">Alokasi:</span>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="bg-white rounded-lg px-2.5 py-1 font-bold text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer text-xs"
            >
              <option value="ALL">📁 Semua Proyek (Konsolidasi Total Enterprise)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  ⚡ [{p.code}] {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. 4 Finance KPI Summary Cards with Enhanced Typography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Disbursement Net */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50/90 to-amber-50/50 border border-orange-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6B00] font-mono-code">
                Estimasi Disbursement Net (THP)
              </span>
              <Banknote className="w-4 h-4 text-[#FF6B00]" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono-code mt-0.5 tracking-tight">
              {formatSalaryDisplay(totalNetPayrollDisbursement, showChartNominal)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-orange-200/50 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-500 font-medium">Jadwal Transfer:</span>
            <span className="font-bold text-orange-900 font-mono-code">25 September 2026</span>
          </div>
        </div>

        {/* KPI 2: Budget Tenaga Kerja */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 font-mono-code">
                Budget Tenaga Kerja Proyek
              </span>
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-950 font-mono-code mt-0.5 tracking-tight">
              {activeProject
                ? ((activeProject.allocatedBudget || 0) > 0 ? formatSalaryDisplay(activeProject.allocatedBudget, showChartNominal) : 'Belum Ditentukan (TBD)')
                : (totalAllocatedBudget > 0 ? formatSalaryDisplay(totalAllocatedBudget, showChartNominal) : 'Belum Ditentukan (TBD)')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-500 font-medium">Cakupan:</span>
            <span className="font-bold text-emerald-900 font-mono-code">
              {activeProject ? activeProject.code : `${projects.length} Proyek Aktif Terdaftar`}
            </span>
          </div>
        </div>

        {/* KPI 3: Tunjangan & Lembur */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-yellow-50/50 border border-amber-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 font-mono-code">
                Total Tunjangan Proyek
              </span>
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-950 font-mono-code mt-0.5 tracking-tight">
              {formatSalaryDisplay(totalEstimatedOvertime, showChartNominal)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-amber-200/50 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-500 font-medium">Formula Lembur:</span>
            <span className="font-bold text-amber-900 font-mono-code">1/173 Upah Pokok</span>
          </div>
        </div>

        {/* KPI 4: Burn Rate */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 font-mono-code">
                Burn Rate Anggaran Proyek
              </span>
              <PieChart className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-black text-blue-950 font-mono-code tracking-tight">
                {activeProject
                  ? ((activeProject.allocatedBudget || 0) > 0
                      ? `${Math.round((activeProject.actualLaborCost / activeProject.allocatedBudget) * 100)}%`
                      : '0%')
                  : (totalAllocatedBudget > 0 ? `${overallBurnRate}%` : '0%')}
              </span>
              <span className="text-[10.5px] font-semibold text-blue-700 font-mono-code">
                {totalAllocatedBudget > 0 ? 'Terkendali' : '(Pagu TBD)'}
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-blue-200/50 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-500 font-medium">Status Risiko:</span>
            <span className="font-bold text-blue-900">Aman di bawah target</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Timeline Canvas & Wave Chart */}
      <div className="relative bg-slate-900/5 rounded-3xl p-4 sm:p-6 border border-slate-200/90 space-y-4">
        
        {/* Scrubber Controls, Current Day Display & Quick Date Jumpers */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white flex items-center justify-center font-mono-code font-black text-base shadow-sm shadow-orange-500/25 shrink-0">
                {scrubberDay}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-900 leading-tight">
                    {scrubberDay} September 2026
                  </p>
                  {scrubberDay === 8 && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] font-black text-[9.5px] font-mono-code uppercase animate-pulse">
                      HARI INI
                    </span>
                  )}
                  {scrubberDay === 25 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[9.5px] font-mono-code uppercase">
                      PAYROLL RUN
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Akumulasi Komitmen Kas: <strong className="text-emerald-700 font-mono-code font-bold">{formatSalaryDisplay(currentScrubbedCash, showChartNominal)}</strong>
                </p>
              </div>
            </div>

            {/* Quick Milestone Navigation Shortcuts */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase font-semibold mr-1">Lompat Ke:</span>
              <button
                type="button"
                onClick={() => setScrubberDay(1)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono-code transition-all cursor-pointer ${
                  scrubberDay === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Tgl 1
              </button>
              <button
                type="button"
                onClick={() => setScrubberDay(8)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono-code transition-all cursor-pointer ${
                  scrubberDay === 8 ? 'bg-[#FF6B00] text-white shadow-xs' : 'bg-orange-100 hover:bg-orange-200 text-orange-800'
                }`}
              >
                Tgl 8 (Hari Ini)
              </button>
              <button
                type="button"
                onClick={() => setScrubberDay(15)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono-code transition-all cursor-pointer ${
                  scrubberDay === 15 ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Tgl 15
              </button>
              <button
                type="button"
                onClick={() => setScrubberDay(25)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono-code transition-all cursor-pointer ${
                  scrubberDay === 25 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                }`}
              >
                Tgl 25 (Disbursement)
              </button>
              <button
                type="button"
                onClick={() => setScrubberDay(30)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono-code transition-all cursor-pointer ${
                  scrubberDay === 30 ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Tgl 30
              </button>
            </div>
          </div>

          {/* Interactive Range Slider with Visual Progress Bar */}
          <div className="pt-1">
            <div className="flex items-center gap-3">
              <span className="text-[10.5px] font-mono-code font-bold text-slate-400 shrink-0">Tgl 1</span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={scrubberDay}
                  onChange={e => setScrubberDay(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF6B00] focus:outline-none"
                />
              </div>
              <span className="text-[10.5px] font-mono-code font-bold text-slate-400 shrink-0">Tgl 30</span>
            </div>
          </div>
        </div>

        {/* SVG Interactive Wave Chart Container */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-white p-3.5 sm:p-5 border border-slate-200/90 shadow-sm">
          
          {/* Chart Header Labels */}
          <div className="flex items-center justify-between text-xs font-mono-code font-bold text-slate-500 mb-3 px-2 border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
              Awal Periode: {showChartNominal ? 'Rp 0' : 'Rp ••••••••'}
            </span>
            <span className="text-[#FF6B00] font-black flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse"></span>
              Puncak Disbursement: {formatSalaryDisplay(totalNetPayrollDisbursement, showChartNominal)} (Tgl 25)
            </span>
          </div>

          {/* The Chart SVG */}
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 sm:h-64 select-none">
            <defs>
              <linearGradient id="financeWaveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#00E2B0" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Guides */}
            {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const yVal = svgHeight - 40 - ratio * (svgHeight - 75);
              return (
                <g key={idx}>
                  <line
                    x1="35"
                    y1={yVal}
                    x2={svgWidth - 35}
                    y2={yVal}
                    stroke="#F1F5F9"
                    strokeDasharray="4 4"
                    strokeWidth="1.2"
                  />
                  <text
                    x={svgWidth - 30}
                    y={yVal + 3}
                    textAnchor="start"
                    fontSize="9"
                    fill="#94A3B8"
                    fontFamily="monospace"
                  >
                    {Math.round(ratio * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Smooth Area Fill */}
            {svgPathData.pathArea && (
              <path
                d={svgPathData.pathArea}
                fill="url(#financeWaveGrad)"
              />
            )}

            {/* Main Smooth Trend Line */}
            {svgPathData.pathLine && (
              <path
                d={svgPathData.pathLine}
                fill="none"
                stroke="#FF6B00"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Today Indicator Line (Day 8 Fixed Marker) */}
            {(() => {
              const xToday = ((8 - 1) / (daysInMonth - 1)) * (svgWidth - 70) + 35;
              const yToday = svgHeight - 40 - ((curvePoints[7]?.cash || 0) / maxCash) * (svgHeight - 75);
              return (
                <g>
                  <line
                    x1={xToday}
                    y1="20"
                    x2={xToday}
                    y2={svgHeight - 40}
                    stroke="#FF6B00"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />
                  <circle cx={xToday} cy={yToday} r="5" fill="#FF6B00" stroke="#FFFFFF" strokeWidth="2" />
                  <rect
                    x={xToday - 38}
                    y="10"
                    width="76"
                    height="18"
                    rx="9"
                    fill="#FF6B00"
                    opacity="0.9"
                  />
                  <text
                    x={xToday}
                    y="22"
                    textAnchor="middle"
                    fontSize="9"
                    fill="#FFFFFF"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    HARI INI
                  </text>
                </g>
              );
            })()}

            {/* Milestone Markers along the Curve */}
            {milestones.map((m, idx) => {
              const x = ((m.day - 1) / (daysInMonth - 1)) * (svgWidth - 70) + 35;
              const y = svgHeight - 40 - ((curvePoints[m.day - 1]?.cash || 0) / maxCash) * (svgHeight - 75);
              const isDisbursement = m.category === 'DISBURSEMENT';

              return (
                <g
                  key={idx}
                  className="cursor-pointer group"
                  onClick={() => {
                    setScrubberDay(m.day);
                    setSelectedMilestone(m);
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isDisbursement ? 8 : 5.5}
                    fill={isDisbursement ? '#FF6B00' : '#00E2B0'}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    className="transition-transform group-hover:scale-150"
                  />
                </g>
              );
            })}

            {/* Dynamic Scrubber Interactive Cursor */}
            {(() => {
              const xScrubber = ((scrubberDay - 1) / (daysInMonth - 1)) * (svgWidth - 70) + 35;
              const yScrubber = svgHeight - 40 - (currentScrubbedCash / maxCash) * (svgHeight - 75);
              return (
                <g>
                  <line
                    x1={xScrubber}
                    y1="34"
                    x2={xScrubber}
                    y2={svgHeight - 40}
                    stroke="#0F172A"
                    strokeWidth="2"
                  />
                  <circle cx={xScrubber} cy={yScrubber} r="7" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2.5" />
                  
                  {/* Floating Tooltip Pill Above Cursor */}
                  <g transform={`translate(${Math.min(Math.max(xScrubber, 60), svgWidth - 60)}, 40)`}>
                    <rect
                      x="-42"
                      y="-18"
                      width="84"
                      height="20"
                      rx="10"
                      fill="#0F172A"
                      className="shadow-md"
                    />
                    <text
                      x="0"
                      y="-5"
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#FFFFFF"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      Tgl {scrubberDay}
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* X-Axis Days Labels */}
            {[1, 5, 8, 12, 15, 20, 25, 28, 30].map(d => {
              const x = ((d - 1) / (daysInMonth - 1)) * (svgWidth - 70) + 35;
              const isSelected = d === scrubberDay;
              const isToday = d === 8;
              return (
                <text
                  key={d}
                  x={x}
                  y={svgHeight - 16}
                  textAnchor="middle"
                  fontSize={isSelected ? "11" : "10"}
                  fontWeight={isSelected || isToday ? "bold" : "normal"}
                  fill={isSelected ? "#FF6B00" : isToday ? "#0F172A" : "#94A3B8"}
                  fontFamily="monospace"
                  className="cursor-pointer"
                  onClick={() => setScrubberDay(d)}
                >
                  Tgl {d}
                </text>
              );
            })}
          </svg>
        </div>

        {/* 4. Complete Milestone Sequence Grid (All 6 Stages Visible) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-xs font-black text-slate-800 uppercase font-mono-code tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
              Rangkaian Tahapan Finansial Bulanan (Klik Kartu Untuk Memilih)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono-code">6 Fase Utama Terdata</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {milestones.map(m => {
              const isActive = scrubberDay === m.day;
              return (
                <div
                  key={m.day}
                  onClick={() => {
                    setScrubberDay(m.day);
                    setSelectedMilestone(m);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer card-interactive ${
                    isActive
                      ? 'bg-orange-50/90 border-[#FF6B00] shadow-md ring-2 ring-[#FF6B00]/20'
                      : m.day === 8
                      ? 'bg-amber-50/50 border-amber-300/80 hover:border-amber-400'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black font-mono-code px-2 py-0.5 rounded-md ${
                      isActive ? 'bg-[#FF6B00] text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {m.dateStr}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono-code ${
                        m.status === 'ACTIVE_TODAY'
                          ? 'bg-orange-500 text-white animate-pulse'
                          : m.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.status === 'ACTIVE_TODAY' ? 'Fase Aktif' : m.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 line-clamp-1">{m.title}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">{m.description}</p>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono-code">
                    <span className="text-slate-400">Komitmen Kas:</span>
                    <span className="font-bold text-slate-800">
                      {m.estAmount > 0 ? formatSalaryDisplay(m.estAmount, showChartNominal) : 'Non-Cash Task'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Bank Disbursement Routing Breakdown (Bottom) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5 uppercase font-mono-code">
              <Banknote className="w-4 h-4 text-emerald-600" />
              Jalur Distribusi Pencairan Bank Payroll (Disbursement Run Tgl 25)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono-code">Total 4 Bank Rekanan Payroll</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {bankBreakdowns.map((b, idx) => (
              <div key={idx} className={`p-3.5 rounded-xl border flex flex-col justify-between ${b.color}`}>
                <div>
                  <span className="text-[10px] font-extrabold uppercase font-mono-code block truncate">
                    {b.bank}
                  </span>
                  <div className="text-base font-black text-slate-900 font-mono-code mt-1 tracking-tight">
                    {formatSalaryDisplay(b.total, showChartNominal)}
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-600">{b.employees} Karyawan</span>
                  <span className="font-bold text-emerald-700 bg-white/80 px-1.5 py-0.2 rounded border border-emerald-300">
                    Auto-Debit
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal Detail Milestone Finansial */}
      {selectedMilestone && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setSelectedMilestone(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative modal-dialog-animate my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FF6B00] text-white text-[10px] font-black uppercase font-mono-code">
                DETAIL TAHAPAN SIKLUS PAYROLL
              </span>
              <span className="text-xs font-mono-code text-slate-500">
                {selectedMilestone.dateStr}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900">{selectedMilestone.title}</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedMilestone.description}</p>

            <div className="my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Fase Operasional:</span>
                <span className="font-mono-code font-bold text-slate-900">{selectedMilestone.phase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimasi Pengeluaran Kas:</span>
                <span className="font-mono-code font-black text-emerald-700">
                  {selectedMilestone.estAmount > 0 ? formatSalaryDisplay(selectedMilestone.estAmount, showChartNominal) : 'Non-Cash Task'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pihak Terkait:</span>
                <span className="font-semibold text-slate-800">{selectedMilestone.parties.join(', ')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedMilestone(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setSelectedMilestone(null);
                  onNavigateToTab('payroll', selectedProjectId === 'ALL' ? undefined : selectedProjectId);
                }}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-500/25"
              >
                <span>Buka Detail Payroll &amp; Proyek</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
