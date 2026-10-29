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
  EyeOff
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
  const totalMonthlyBaseSalary = employees.reduce((acc, e) => acc + e.baseSalary, 0);
  const totalMonthlyFixedAllowance = employees.reduce((acc, e) => acc + e.fixedAllowance, 0);
  const totalMonthlyDailyAllowance = employees.reduce((acc, e) => acc + (e.dailyAllowance * 22), 0);
  const totalEstimatedOvertime = 4750000; // Estimated overtime pool
  const totalEstimatedGross = totalMonthlyBaseSalary + totalMonthlyFixedAllowance + totalMonthlyDailyAllowance + totalEstimatedOvertime;
  const totalEstimatedDeductions = Math.round(totalMonthlyBaseSalary * (salaryRules.bpjsKetenagakerjaanRate + salaryRules.bpjsKesehatanRate)) + 3200000;
  const totalNetPayrollDisbursement = totalEstimatedGross - totalEstimatedDeductions;

  // Key Financial Milestones in the 30-day cycle
  const milestones: FinancialMilestone[] = [
    {
      day: 5,
      dateStr: '5 September 2026',
      title: 'Verifikasi Absensi & Timesheet Minggu I',
      phase: 'Timesheet Ingestion',
      category: 'PREPARATION',
      estAmount: 0,
      status: 'COMPLETED',
      description: 'Rekonsiliasi awal rekaman check-in kamera, verifikasi Geofence GPS kantor, dan penyesuaian dinas luar site Pomalaa.',
      parties: ['HR People Operations', 'Site Supervisor']
    },
    {
      day: 8,
      dateStr: '8 September 2026 (HARI INI)',
      title: 'Cutoff Interim & Simulasi Payroll Bulanan',
      phase: 'Interim Payroll Run',
      category: 'SIMULATION',
      estAmount: totalNetPayrollDisbursement,
      status: 'ACTIVE_TODAY',
      description: 'Kalkulasi interim gaji pokok, tunjangan penugasan proyek, serta simulasi pembebanan biaya tenaga kerja antar-proyek.',
      parties: ['Finance Lead', 'HR Manager']
    },
    {
      day: 15,
      dateStr: '15 September 2026',
      title: 'Audit Lembur Mingguan & Tunjangan Site',
      phase: 'Overtime & Site Audit',
      category: 'PREPARATION',
      estAmount: totalEstimatedOvertime,
      status: 'SCHEDULED',
      description: 'Verifikasi lembur teknisi dan personil lapangan sesuai formula Depnaker 1/173 Upah Pokok.',
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
      description: 'Pencairan gaji bersih (THP) seluruh tenaga kerja PRIME Enterprise serentak via Auto-Debit Bank Mandiri, BCA, BNI & BSI.',
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
      description: 'Jurnal akuntansi pembebanan biaya tenaga kerja langsung (Direct Labor Cost) ke kode akun proyek PRIME Enterprise.',
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
    { bank: 'Bank Central Asia (BCA)', employees: 2, total: Math.round(totalNetPayrollDisbursement * 0.46), color: 'from-blue-600 to-blue-800' },
    { bank: 'Bank Mandiri', employees: 1, total: Math.round(totalNetPayrollDisbursement * 0.25), color: 'from-amber-600 to-yellow-800' },
    { bank: 'Bank Negara Indonesia (BNI)', employees: 1, total: Math.round(totalNetPayrollDisbursement * 0.18), color: 'from-teal-600 to-emerald-800' },
    { bank: 'Bank Syariah Indonesia (BSI)', employees: 1, total: Math.round(totalNetPayrollDisbursement * 0.11), color: 'from-emerald-600 to-teal-800' },
  ];

  // Interactive Curve Points for 30 Days SVG chart
  const daysInMonth = 30;
  const curvePoints = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      // Progressive curve rising up sharply on day 25 (payroll disbursement)
      let cumulativeCash = 0;
      if (day < 8) {
        cumulativeCash = (day / 8) * 8000000;
      } else if (day < 20) {
        cumulativeCash = 8000000 + ((day - 8) / 12) * 12000000;
      } else if (day < 25) {
        cumulativeCash = 20000000 + ((day - 20) / 5) * 8000000;
      } else {
        cumulativeCash = totalNetPayrollDisbursement; // Peak disbursement achieved
      }
      return { day, cash: Math.round(cumulativeCash) };
    });
  }, [totalNetPayrollDisbursement]);

  // SVG dimensions for smooth wave
  const svgWidth = 800;
  const svgHeight = 220;
  const maxCash = totalNetPayrollDisbursement * 1.15;

  const pointsString = useMemo(() => {
    return curvePoints.map((pt, idx) => {
      const x = (idx / (daysInMonth - 1)) * (svgWidth - 60) + 30;
      const y = svgHeight - 35 - (pt.cash / maxCash) * (svgHeight - 70);
      return `${x},${y}`;
    }).join(' ');
  }, [curvePoints, maxCash]);

  // Current scrubbed point values
  const currentScrubbedCash = curvePoints[scrubberDay - 1]?.cash || 0;

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-md space-y-5 motion-fade-in-up">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="prime-cut-corner bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code">
              TIMELINE INTERAKTIF FINANCE
            </span>
            <span className="text-xs font-bold text-slate-500 font-mono-code">
              Siklus Penggajian & Arus Kas • PRIME Enterprise
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#FF6B00]" />
            Timeline Arus Kas Penggajian & Anggaran Proyek (30 Hari)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulasi komitmen arus kas pencairan gaji, akumulasi lembur Depnaker, serta pembebanan biaya ke proyek PRIME Enterprise.
          </p>
        </div>

        {/* Project Selector Filter & Privacy Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowChartNominal(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showChartNominal
                ? 'bg-orange-50 text-[#FF6B00] border-orange-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Toggle sensor angka nominal arus kas (default: sensor)"
          >
            {showChartNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
            <span>{showChartNominal ? 'Sembunyikan Nominal' : 'Tampilkan Nominal'}</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <Building2 className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="font-bold text-slate-600">Alokasi Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="bg-white rounded-lg px-2 py-1 font-bold text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer"
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

      {/* 4 Finance KPI Summary Strips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-200/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6B00] font-mono-code block">
            Estimasi Disbursement Net (THP)
          </span>
          <div className="text-lg font-black text-slate-900 font-mono-code mt-0.5">
            {formatSalaryDisplay(totalNetPayrollDisbursement, showChartNominal)}
          </div>
          <span className="text-[10px] text-slate-600 font-medium">
            Jadwal transfer: 25 September 2026
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 font-mono-code block">
            Budget Tenaga Kerja Proyek
          </span>
          <div className="text-lg font-black text-emerald-900 font-mono-code mt-0.5">
            {activeProject
              ? ((activeProject.allocatedBudget || 0) > 0 ? formatSalaryDisplay(activeProject.allocatedBudget, showChartNominal) : 'Belum Ditentukan (TBD)')
              : (totalAllocatedBudget > 0 ? formatSalaryDisplay(totalAllocatedBudget, showChartNominal) : 'Belum Ditentukan (TBD)')}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">
            {activeProject ? activeProject.code : `${projects.length} Proyek Aktif Terdaftar`}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 font-mono-code block">
            Estimasi Lembur Depnaker
          </span>
          <div className="text-lg font-black text-amber-900 font-mono-code mt-0.5">
            {formatSalaryDisplay(totalEstimatedOvertime, showChartNominal)}
          </div>
          <span className="text-[10px] text-amber-700 font-medium">
            Formula 1/173 Upah Pokok
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 font-mono-code block">
            Burn Rate Anggaran Proyek
          </span>
          <div className="text-lg font-black text-blue-900 font-mono-code mt-0.5">
            {activeProject
              ? ((activeProject.allocatedBudget || 0) > 0
                  ? `${Math.round((activeProject.actualLaborCost / activeProject.allocatedBudget) * 100)}%`
                  : '0% (TBD)')
              : (totalAllocatedBudget > 0 ? `${overallBurnRate}%` : '0% (TBD)')}
          </div>
          <span className="text-[10px] text-blue-700 font-medium">
            {activeProject
              ? ((activeProject.allocatedBudget || 0) > 0 ? 'Status: Terpantau' : 'Status: Menunggu penetapan pagu')
              : (totalAllocatedBudget > 0 ? 'Status: Aman di bawah batas target' : 'Status: Menunggu penetapan pagu')}
          </span>
        </div>
      </div>

      {/* Interactive Timeline Canvas & Wave Chart */}
      <div className="relative pt-4 bg-slate-900/5 rounded-3xl p-4 sm:p-6 border border-slate-200 space-y-4">
        
        {/* Scrubber Controls & Current Day Display */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/90 rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-mono-code font-black text-sm">
              {scrubberDay}
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 leading-tight">
                {scrubberDay} September 2026 {scrubberDay === 8 ? '• (HARI INI)' : ''}
              </p>
              <p className="text-[11px] text-slate-500">
                Akumulasi Komitmen Kas: <strong className="text-emerald-700 font-mono-code">{formatSalaryDisplay(currentScrubbedCash, showChartNominal)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-72">
            <span className="text-[10px] font-mono-code text-slate-400">Tgl 1</span>
            <input
              type="range"
              min="1"
              max="30"
              value={scrubberDay}
              onChange={e => setScrubberDay(parseInt(e.target.value, 10))}
              className="w-full accent-[#FF6B00] cursor-pointer"
            />
            <span className="text-[10px] font-mono-code text-slate-400">Tgl 30</span>
          </div>
        </div>

        {/* SVG Interactive Wave Chart Container */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-white p-3 border border-slate-200/80 shadow-inner">
          
          <div className="flex items-center justify-between text-[11px] font-mono-code font-bold text-slate-400 mb-2 px-2">
            <span>{showChartNominal ? 'Rp 0' : 'Rp ••••••••'} (Awal Bulan)</span>
            <span className="text-[#FF6B00] font-black">Puncak Disbursement: {formatSalaryDisplay(totalNetPayrollDisbursement, showChartNominal)} (Tgl 25)</span>
          </div>

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-48 select-none">
            <defs>
              <linearGradient id="financeWaveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#00E2B0" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
              <line
                key={idx}
                x1="30"
                y1={svgHeight - 35 - ratio * (svgHeight - 70)}
                x2={svgWidth - 30}
                y2={svgHeight - 35 - ratio * (svgHeight - 70)}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            ))}

            {/* Area Fill */}
            <polygon
              points={`30,${svgHeight - 35} ${pointsString} ${svgWidth - 30},${svgHeight - 35}`}
              fill="url(#financeWaveGrad)"
            />

            {/* Main Trend Line */}
            <polyline
              fill="none"
              stroke="#FF6B00"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsString}
            />

            {/* Today Indicator Line (Day 8) */}
            {(() => {
              const xToday = ((8 - 1) / (daysInMonth - 1)) * (svgWidth - 60) + 30;
              return (
                <g>
                  <line
                    x1={xToday}
                    y1="10"
                    x2={xToday}
                    y2={svgHeight - 35}
                    stroke="#FF6B00"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                  <circle cx={xToday} cy="16" r="5" fill="#FF6B00" className="animate-ping" />
                  <circle cx={xToday} cy="16" r="4" fill="#FF6B00" />
                  <text x={xToday + 8} y="20" fontSize="10" fill="#FF6B00" fontWeight="bold" fontFamily="monospace">
                    HARI INI (Tgl 8)
                  </text>
                </g>
              );
            })()}

            {/* Scrubber Indicator Line */}
            {(() => {
              const xScrubber = ((scrubberDay - 1) / (daysInMonth - 1)) * (svgWidth - 60) + 30;
              const yScrubber = svgHeight - 35 - (currentScrubbedCash / maxCash) * (svgHeight - 70);
              return (
                <g>
                  <line
                    x1={xScrubber}
                    y1="25"
                    x2={xScrubber}
                    y2={svgHeight - 35}
                    stroke="#0F172A"
                    strokeWidth="2"
                  />
                  <circle cx={xScrubber} cy={yScrubber} r="7" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
                  <text
                    x={xScrubber}
                    y={yScrubber - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#0F172A"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    Tgl {scrubberDay}
                  </text>
                </g>
              );
            })()}

            {/* Milestone Markers */}
            {milestones.map((m, idx) => {
              const x = ((m.day - 1) / (daysInMonth - 1)) * (svgWidth - 60) + 30;
              const y = svgHeight - 35 - ((curvePoints[m.day - 1]?.cash || 0) / maxCash) * (svgHeight - 70);
              const isDisbursement = m.category === 'DISBURSEMENT';

              return (
                <g key={idx} className="cursor-pointer group" onClick={() => setSelectedMilestone(m)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isDisbursement ? 8 : 5}
                    fill={isDisbursement ? '#FF6B00' : '#00E2B0'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="transition-transform group-hover:scale-125"
                  />
                </g>
              );
            })}

            {/* Days axis labels */}
            {[1, 5, 8, 12, 15, 20, 25, 28, 30].map(d => {
              const x = ((d - 1) / (daysInMonth - 1)) * (svgWidth - 60) + 30;
              return (
                <text
                  key={d}
                  x={x}
                  y={svgHeight - 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#94A3B8"
                  fontFamily="monospace"
                >
                  Tgl {d}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Milestone Cards Carousel / Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {milestones.slice(1, 4).map(m => (
            <div
              key={m.day}
              onClick={() => setSelectedMilestone(m)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer card-interactive ${
                m.day === 8
                  ? 'bg-orange-50/80 border-orange-300 shadow-sm'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black font-mono-code px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
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
              <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{m.description}</p>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono-code">
                <span className="text-slate-400">Estimasi Nilai:</span>
                <span className="font-bold text-slate-800">{m.estAmount > 0 ? formatSalaryDisplay(m.estAmount, showChartNominal) : 'SOP Validasi'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bank Disbursement Routing Breakdown */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5 uppercase font-mono-code">
              <Banknote className="w-4 h-4 text-emerald-600" />
              Jalur Distribusi Pencairan Bank Payroll (Disbursement Run Tgl 25)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono-code">Total 4 Bank Rekanan Payroll</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {bankBreakdowns.map((b, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 font-mono-code block truncate">
                    {b.bank}
                  </span>
                  <div className="text-sm font-black text-slate-900 font-mono-code mt-0.5">
                    {formatSalaryDisplay(b.total, showChartNominal)}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{b.employees} Karyawan</span>
                  <span className="font-bold text-emerald-700">Auto-Debit Ready</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal Detail Milestone Finansial (Portal to document.body for guaranteed viewport centering) */}
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

            <div className="my-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
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
                <span>Buka Detail Payroll & Proyek</span>
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
