import { createPortal } from 'react-dom';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
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
  ArrowRight,
  Users
} from 'lucide-react';
import { Project, Employee, SalaryRuleConfig, getEmployeeAssignedProjects } from '../types';
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
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Filtered Project stats
  const activeProject = selectedProjectId === 'ALL' ? null : projects.find(p => p.id === selectedProjectId);
  const totalAllocatedBudget = projects.reduce((acc, p) => acc + (p.allocatedBudget || 0), 0);
  const totalActualLaborCost = projects.reduce((acc, p) => acc + (p.actualLaborCost || 0), 0);
  const overallBurnRate = totalAllocatedBudget > 0 ? Math.round((totalActualLaborCost / totalAllocatedBudget) * 100) : 0;

  // Proportional Multi-Project Financial Breakdown
  // Bila user terlibat di N proyek, beban gaji pokok, tunjangan & lembur dibagi rata 1/N.
  // Saat mode "Semua Proyek (Konsolidasi)", total resume sama persis dengan agregat aktual enterprise.
  const projectFinancials = useMemo(() => {
    const bpjsRate = (salaryRules.bpjsKetenagakerjaanRate || 0.03) + (salaryRules.bpjsKesehatanRate || 0.01);

    if (selectedProjectId === 'ALL') {
      const baseSalary = employees.reduce((acc, e) => acc + (e.baseSalary || 0), 0);
      const fixedAllowance = employees.reduce((acc, e) => acc + (e.fixedAllowance || 0), 0);
      const dailyAllowance = employees.reduce((acc, e) => acc + ((e.dailyAllowance || 0) * 22), 0);
      const overtime = employees.reduce((acc, e) => {
        const hourlyRate = (e.baseSalary || 0) / 173;
        return acc + Math.round(hourlyRate * 12);
      }, 0);
      const gross = baseSalary + fixedAllowance + dailyAllowance + overtime;
      const deductions = Math.round(baseSalary * bpjsRate) + 3200000;
      const net = Math.max(0, gross - deductions);

      // Multi-project personnel list across enterprise
      const multiProjectPersonnel = employees
        .map(emp => {
          const prjs = getEmployeeAssignedProjects(emp, projects);
          return { emp, prjs, count: prjs.length };
        })
        .filter(item => item.count > 1);

      return {
        isAll: true,
        assignedCount: employees.length,
        multiProjectCount: multiProjectPersonnel.length,
        baseSalary,
        fixedAllowance,
        dailyAllowance,
        estimatedOvertime: overtime,
        grossSalary: gross,
        deductions,
        netDisbursement: net,
        personnelList: employees.map(emp => {
          const prjs = getEmployeeAssignedProjects(emp, projects);
          return {
            emp,
            prjs,
            totalProjects: prjs.length,
            ratio: 1 / Math.max(1, prjs.length),
            allocatedBase: emp.baseSalary || 0,
            allocatedGross: (emp.baseSalary || 0) + (emp.fixedAllowance || 0) + ((emp.dailyAllowance || 0) * 22)
          };
        }),
        multiProjectPersonnel
      };
    }

    // Individual Selected Project:
    // Extract personnel assigned to this project and compute exact 1/N share
    const assignedPersonnel = employees
      .map(emp => {
        const prjs = getEmployeeAssignedProjects(emp, projects);
        const isAssigned = prjs.some(p => p.id === selectedProjectId || p.code === selectedProjectId);
        if (!isAssigned) return null;

        const totalProjects = Math.max(1, prjs.length);
        const ratio = 1 / totalProjects;
        const empBase = emp.baseSalary || 0;
        const empFixed = emp.fixedAllowance || 0;
        const empDaily = (emp.dailyAllowance || 0) * 22;
        const empOvertime = Math.round(((emp.baseSalary || 0) / 173) * 12);
        const empGross = empBase + empFixed + empDaily + empOvertime;
        const empDeduction = Math.round(empBase * bpjsRate);
        const empNet = Math.max(0, empGross - empDeduction);

        return {
          emp,
          prjs,
          totalProjects,
          ratio,
          allocatedBase: Math.round(empBase * ratio),
          allocatedFixed: Math.round(empFixed * ratio),
          allocatedDaily: Math.round(empDaily * ratio),
          allocatedOvertime: Math.round(empOvertime * ratio),
          allocatedGross: Math.round(empGross * ratio),
          allocatedDeductions: Math.round(empDeduction * ratio),
          allocatedNet: Math.round(empNet * ratio)
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const baseSalary = assignedPersonnel.reduce((acc, item) => acc + item.allocatedBase, 0);
    const fixedAllowance = assignedPersonnel.reduce((acc, item) => acc + item.allocatedFixed, 0);
    const dailyAllowance = assignedPersonnel.reduce((acc, item) => acc + item.allocatedDaily, 0);
    const overtime = assignedPersonnel.reduce((acc, item) => acc + item.allocatedOvertime, 0);
    const gross = baseSalary + fixedAllowance + dailyAllowance + overtime;
    const deductions = assignedPersonnel.reduce((acc, item) => acc + item.allocatedDeductions, 0);
    const net = Math.max(0, gross - deductions);

    const multiProjectItems = assignedPersonnel.filter(item => item.totalProjects > 1);

    return {
      isAll: false,
      assignedCount: assignedPersonnel.length,
      multiProjectCount: multiProjectItems.length,
      baseSalary,
      fixedAllowance,
      dailyAllowance,
      estimatedOvertime: overtime,
      grossSalary: gross,
      deductions,
      netDisbursement: net,
      personnelList: assignedPersonnel,
      multiProjectPersonnel: multiProjectItems
    };
  }, [selectedProjectId, employees, projects, salaryRules]);

  // Active Disbursement & Gross to drive timeline
  const activeNetDisbursement = projectFinancials.netDisbursement;
  const activeGrossSalary = projectFinancials.grossSalary;
  const activeDeductions = projectFinancials.deductions;

  // Key Financial Milestones in the 30-day cycle
  const milestones: FinancialMilestone[] = useMemo(() => [
    {
      day: 5,
      dateStr: '5 September 2026',
      title: 'Verifikasi Absensi & Timesheet Minggu I',
      phase: 'Timesheet Ingestion',
      category: 'PREPARATION',
      estAmount: Math.round(activeNetDisbursement * 0.15),
      status: 'COMPLETED',
      description: selectedProjectId === 'ALL'
        ? 'Rekonsiliasi awal rekaman check-in kamera, verifikasi Geofence GPS kantor pusat & seluruh site proyek PT Dwi Martha Jaya.'
        : `Verifikasi absensi terdistribusi personil proyek ${activeProject?.name || ''} dengan perhitungan porsi jam kerja proporsional.`,
      parties: ['HR People Operations', 'Site Supervisor']
    },
    {
      day: 8,
      dateStr: '8 September 2026 (HARI INI)',
      title: 'Cutoff Interim & Simulasi Payroll Bulanan',
      phase: 'Interim Payroll Run',
      category: 'SIMULATION',
      estAmount: Math.round(activeNetDisbursement * 0.25),
      status: 'ACTIVE_TODAY',
      description: selectedProjectId === 'ALL'
        ? 'Kalkulasi interim gaji pokok, tunjangan penugasan proyek, serta simulasi pembebanan biaya tenaga kerja antar-proyek.'
        : `Simulasi interim beban gaji proyek ${activeProject?.code || ''}: ${projectFinancials.multiProjectCount} personil dibagi proporsional dengan proyek lain.`,
      parties: ['Finance Lead', 'HR Manager']
    },
    {
      day: 15,
      dateStr: '15 September 2026',
      title: 'Audit Kehadiran & Tunjangan Site',
      phase: 'Attendance & Site Audit',
      category: 'PREPARATION',
      estAmount: Math.round(activeNetDisbursement * 0.50),
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
      estAmount: activeDeductions,
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
      estAmount: activeNetDisbursement,
      status: 'SCHEDULED',
      description: selectedProjectId === 'ALL'
        ? 'Pencairan gaji bersih (THP) seluruh tenaga kerja PT Dwi Martha Jaya serentak via Auto-Debit Bank Mandiri, BCA, BNI & BSI.'
        : `Estimasi pencairan gaji bersih (THP) proporsional untuk ${projectFinancials.assignedCount} tenaga kerja proyek ini.`,
      parties: ['Managing Director', 'Bank Mitra Cash Management']
    },
    {
      day: 28,
      dateStr: '28 September 2026',
      title: 'Invoicing Tagihan Tenaga Kerja ke Proyek',
      phase: 'Project Cost Allocation & Billing',
      category: 'BILLING',
      estAmount: activeGrossSalary,
      status: 'SCHEDULED',
      description: 'Jurnal akuntansi pembebanan biaya tenaga kerja langsung (Direct Labor Cost) ke kode akun proyek PT Dwi Martha Jaya.',
      parties: ['Project Accounting Lead', 'Client Representative']
    }
  ], [activeNetDisbursement, activeGrossSalary, activeDeductions, selectedProjectId, activeProject, projectFinancials]);

  // Bank Disbursement Breakdown Data
  const bankBreakdowns = useMemo(() => [
    { bank: 'Bank Central Asia (BCA)', employees: Math.max(1, Math.round(projectFinancials.assignedCount * 0.45)), total: Math.round(activeNetDisbursement * 0.46), color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { bank: 'Bank Mandiri', employees: Math.max(1, Math.round(projectFinancials.assignedCount * 0.25)), total: Math.round(activeNetDisbursement * 0.25), color: 'text-amber-800 bg-amber-50 border-amber-200' },
    { bank: 'Bank Negara Indonesia (BNI)', employees: Math.max(1, Math.round(projectFinancials.assignedCount * 0.18)), total: Math.round(activeNetDisbursement * 0.18), color: 'text-teal-800 bg-teal-50 border-teal-200' },
    { bank: 'Bank Syariah Indonesia (BSI)', employees: Math.max(1, Math.round(projectFinancials.assignedCount * 0.12)), total: Math.round(activeNetDisbursement * 0.11), color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  ], [projectFinancials.assignedCount, activeNetDisbursement]);

  // Interactive Progressive Cashflow Curve (Proportional S-Curve based on activeNetDisbursement)
  const daysInMonth = 30;
  const curvePoints = useMemo(() => {
    const peak = activeNetDisbursement > 0 ? activeNetDisbursement : 15000000;
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
  }, [activeNetDisbursement]);

  // ECharts Timeline Instance Setup & Responsive Rendering
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const daysLabels = curvePoints.map(p => `Tgl ${p.day}`);
    const cashData = curvePoints.map(p => p.cash);
    const peak = activeNetDisbursement > 0 ? activeNetDisbursement : 15000000;

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animationDuration: 600,
      animationEasing: 'cubicOut',
      grid: {
        top: 36,
        left: 14,
        right: 28,
        bottom: 24,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#FF6B00',
            width: 1.5,
            type: 'dashed'
          }
        },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        borderRadius: 12,
        padding: [10, 14],
        shadowColor: 'rgba(0, 0, 0, 0.25)',
        shadowBlur: 14,
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const day = idx + 1;
          const cash = curvePoints[idx]?.cash || 0;
          const pct = peak > 0 ? Math.round((cash / peak) * 100) : 0;
          const m = milestones.find(item => item.day === day);

          const isDisbursement = day === 25;
          const isToday = day === 8;

          return `
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; min-width: 220px; color: #F8FAFC;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 6px; margin-bottom: 8px;">
                <span style="font-weight: 800; font-size: 12.5px; color: #FFFFFF;">${day} September 2026</span>
                ${isToday ? '<span style="background: #FF6B00; color: #fff; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">HARI INI</span>' : ''}
                ${isDisbursement ? '<span style="background: #10B981; color: #fff; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">DISBURSEMENT</span>' : ''}
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; font-size: 11px;">
                <span style="color: #94A3B8;">Komitmen Kas:</span>
                <span style="font-weight: bold; color: #34D399; font-size: 12px;">${formatSalaryDisplay(cash, showChartNominal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 11px;">
                <span style="color: #94A3B8;">Progres Siklus:</span>
                <span style="font-weight: bold; color: #FF8533;">${pct}% dari Puncak</span>
              </div>
              ${m ? `
                <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px; margin-top: 6px; border-left: 3px solid ${m.category === 'DISBURSEMENT' ? '#FF6B00' : '#00E2B0'};">
                  <div style="font-size: 8.5px; color: #94A3B8; text-transform: uppercase; font-weight: bold;">Milestone: ${m.phase}</div>
                  <div style="font-weight: bold; color: #FFFFFF; font-size: 11px; margin-top: 2px;">${m.title}</div>
                </div>
              ` : ''}
              <div style="margin-top: 6px; font-size: 8.5px; color: #64748B; text-align: center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 5px;">
                💡 Klik untuk sinkronisasi scrubber & milestone
              </div>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'category',
        data: daysLabels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisTick: { show: false },
        axisLabel: {
          color: (_value?: string | number, index?: number) => {
            const day = (index ?? 0) + 1;
            if (day === scrubberDay) return '#FF6B00';
            if (day === 8) return '#0F172A';
            return '#64748B';
          },
          fontSize: 10,
          fontFamily: 'monospace',
          interval: (index: number) => {
            const day = index + 1;
            return [1, 5, 8, 12, 15, 20, 25, 28, 30].includes(day);
          },
          formatter: (val: string) => val
        }
      },
      yAxis: [
        {
          type: 'value',
          name: showChartNominal ? 'Komitmen Kas (Rp)' : 'Komitmen Kas',
          nameTextStyle: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
          splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
          axisLabel: {
            color: '#64748B',
            fontSize: 10,
            fontFamily: 'monospace',
            formatter: (val: number) => {
              if (!showChartNominal) return 'Rp •••••';
              if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} M`;
              if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(0)} Jt`;
              if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} Rb`;
              return `Rp ${val}`;
            }
          }
        },
        {
          type: 'value',
          min: 0,
          max: 100,
          name: '% Puncak',
          nameTextStyle: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
          splitLine: { show: false },
          axisLabel: {
            color: '#FF6B00',
            fontSize: 10,
            fontFamily: 'monospace',
            formatter: '{value}%'
          }
        }
      ],
      series: [
        {
          name: 'Akumulasi Kas',
          type: 'line',
          smooth: 0.35,
          data: cashData,
          showSymbol: false,
          lineStyle: {
            width: 3.5,
            color: '#FF6B00',
            shadowColor: 'rgba(255, 107, 0, 0.4)',
            shadowBlur: 10,
            shadowOffsetY: 4
          },
          itemStyle: {
            color: '#FF6B00',
            borderColor: '#FFFFFF',
            borderWidth: 2
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255, 107, 0, 0.40)' },
              { offset: 0.5, color: 'rgba(255, 133, 51, 0.15)' },
              { offset: 0.85, color: 'rgba(16, 185, 129, 0.05)' },
              { offset: 1, color: 'rgba(255, 255, 255, 0.0)' }
            ])
          },
          markPoint: {
            data: milestones.map(m => {
              const isDisb = m.category === 'DISBURSEMENT';
              const isToday = m.day === 8;
              return {
                name: m.title,
                coord: [`Tgl ${m.day}`, curvePoints[m.day - 1]?.cash || 0],
                symbol: isDisb ? 'diamond' : 'circle',
                symbolSize: isDisb ? 14 : 9,
                itemStyle: {
                  color: isDisb ? '#FF6B00' : isToday ? '#EA580C' : '#00E2B0',
                  borderColor: '#FFFFFF',
                  borderWidth: 2,
                  shadowColor: isDisb ? 'rgba(255, 107, 0, 0.7)' : 'rgba(0, 226, 176, 0.7)',
                  shadowBlur: 8
                }
              };
            })
          },
          markLine: {
            silent: false,
            symbol: ['none', 'none'],
            data: [
              {
                name: 'HARI INI',
                xAxis: 'Tgl 8',
                lineStyle: { color: '#FF6B00', width: 1.8, type: 'dashed' },
                label: {
                  show: true,
                  formatter: 'HARI INI',
                  position: 'insideStartTop',
                  color: '#FFFFFF',
                  backgroundColor: '#FF6B00',
                  padding: [3, 7],
                  borderRadius: 6,
                  fontSize: 9.5,
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }
              },
              {
                name: 'PAYROLL DISBURSEMENT',
                xAxis: 'Tgl 25',
                lineStyle: { color: '#10B981', width: 1.8, type: 'dashed' },
                label: {
                  show: true,
                  formatter: 'PAYROLL RUN',
                  position: 'insideStartTop',
                  color: '#FFFFFF',
                  backgroundColor: '#10B981',
                  padding: [3, 7],
                  borderRadius: 6,
                  fontSize: 9.5,
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }
              },
              {
                name: 'SCRUBBER',
                xAxis: `Tgl ${scrubberDay}`,
                lineStyle: { color: '#0F172A', width: 2, type: 'solid' },
                label: {
                  show: true,
                  formatter: `Tgl ${scrubberDay}`,
                  position: 'insideEndBottom',
                  color: '#FFFFFF',
                  backgroundColor: '#0F172A',
                  padding: [3, 7],
                  borderRadius: 6,
                  fontSize: 9.5,
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }
              }
            ]
          }
        }
      ]
    };

    chartInstance.current.setOption(option, true);

    // Click handler on chart
    chartInstance.current.off('click');
    chartInstance.current.on('click', (params: any) => {
      if (params.dataIndex !== undefined) {
        const day = params.dataIndex + 1;
        setScrubberDay(day);
        const m = milestones.find(item => item.day === day);
        if (m) {
          setSelectedMilestone(m);
        }
      }
    });
  }, [curvePoints, activeNetDisbursement, milestones, scrubberDay, showChartNominal]);

  // Synchronize tooltip highlight when scrubberDay changes
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: scrubberDay - 1
      });
    }
  }, [scrubberDay]);

  // Handle Resize & Observer
  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

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
              {formatSalaryDisplay(activeNetDisbursement, showChartNominal)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-orange-200/50 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-500 font-medium">Personel Terdata:</span>
            <span className="font-bold text-orange-900 font-mono-code">
              {projectFinancials.assignedCount} Org {projectFinancials.multiProjectCount > 0 && `(⚡ ${projectFinancials.multiProjectCount} Multi)`}
            </span>
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
                Total Tunjangan &amp; Lembur
              </span>
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-950 font-mono-code mt-0.5 tracking-tight">
              {formatSalaryDisplay(projectFinancials.estimatedOvertime + projectFinancials.fixedAllowance, showChartNominal)}
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
                      ? `${Math.round((activeGrossSalary / activeProject.allocatedBudget) * 100)}%`
                      : '0%')
                  : (totalAllocatedBudget > 0 ? `${overallBurnRate}%` : '0%')}
              </span>
              <span className="text-[10.5px] font-semibold text-blue-700 font-mono-code">
                {(activeProject ? (activeProject.allocatedBudget || 0) : totalAllocatedBudget) > 0 ? 'Terkendali' : '(Pagu TBD)'}
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-blue-200/50 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-500 font-medium">Realisasi Beban Gaji:</span>
            <span className="font-bold text-blue-900 font-mono-code">{formatSalaryDisplay(activeGrossSalary, showChartNominal)}</span>
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

        {/* Interactive ECharts Wave Chart Container */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-white p-3.5 sm:p-5 border border-slate-200/90 shadow-sm space-y-3">
          
          {/* Chart Header Labels & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono-code font-bold text-slate-500 gap-2 px-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                Awal Periode: <strong className="text-slate-800">{showChartNominal ? 'Rp 0' : 'Rp ••••••••'}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5 text-orange-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]"></span>
                Tgl 8: <strong>HARI INI</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#FF6B00] font-black flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00] animate-pulse"></span>
                Puncak Disbursement: {formatSalaryDisplay(activeNetDisbursement, showChartNominal)} (Tgl 25)
              </span>
            </div>
          </div>

          {/* The ECharts Interactive Canvas */}
          <div ref={chartRef} className="w-full h-72 sm:h-80 select-none" />

          {/* Immersive Interactive Hint Bar */}
          <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-500 px-2 pt-1 border-t border-slate-100/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Interaktif: Geser slider, klik tombol tanggal, atau klik titik chart untuk inspeksi detail.</span>
            </div>
            <div className="hidden md:flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00E2B0]"></span> Milestone Khusus</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#FF6B00]"></span> Hari Ini</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-600"></span> Disbursement</span>
            </div>
          </div>
        </div>

        {/* 3.5. Proportional Multi-Project Salary Allocation Ledger */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF6B00]"></span>
                <h4 className="text-xs font-black text-slate-900 uppercase font-mono-code tracking-tight flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#FF6B00]" />
                  {selectedProjectId === 'ALL'
                    ? 'Pemetaan Distribusi Gaji Personel Multi-Proyek (Konsolidasi Enterprise)'
                    : `Daftar Personel & Alokasi Beban Gaji: ${activeProject?.name || activeProject?.code}`}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedProjectId === 'ALL'
                  ? 'Karyawan yang terdaftar di multi-proyek memiliki beban gaji terbagi rata (1/N) per proyek. Total resume agregat tetap 100% presisi sesuai data aktual.'
                  : `Menampilkan ${projectFinancials.assignedCount} personel terdaftar (${projectFinancials.multiProjectCount} orang memiliki penugasan multi-proyek).`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-[#FF6B00] text-[10.5px] font-black font-mono-code">
                ⚡ {projectFinancials.multiProjectCount} Karyawan Multi-Proyek
              </span>
            </div>
          </div>

          {/* Roster Allocation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(selectedProjectId === 'ALL'
              ? projectFinancials.multiProjectPersonnel.map(m => {
                  const totalPrj = m.prjs.length;
                  const ratio = 1 / totalPrj;
                  const perProjSalary = Math.round((m.emp.baseSalary || 0) * ratio);
                  return {
                    emp: m.emp,
                    prjs: m.prjs,
                    totalProjects: totalPrj,
                    ratio,
                    allocatedBase: perProjSalary,
                    allocatedGross: perProjSalary
                  };
                })
              : projectFinancials.personnelList
            ).slice(0, 12).map((item, idx) => {
              const isMulti = item.totalProjects > 1;
              return (
                <div
                  key={`${item.emp.id}-${idx}`}
                  className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                    isMulti
                      ? 'bg-purple-50/50 border-purple-200/90 hover:border-purple-300'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <img
                        src={item.emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.emp.name)}&background=random`}
                        alt={item.emp.name}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate flex items-center justify-between">
                          <span className="truncate">{item.emp.name}</span>
                          <span className="text-[10px] font-mono-code text-slate-400 shrink-0 ml-1">
                            {item.emp.nik}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate">
                          {item.emp.position} • {item.emp.department}
                        </div>
                      </div>
                    </div>

                    {/* Multi-Project Involvement Badge & Projects List */}
                    {isMulti ? (
                      <div className="p-2 rounded-lg bg-white border border-purple-200/80 mb-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono-code font-black text-[9px] uppercase">
                            ⚡ Terlibat di {item.totalProjects} Proyek (Porsi 1/{item.totalProjects})
                          </span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-700 leading-tight">
                          {item.prjs.map((p, pIdx) => (
                            <span key={p.id || pIdx} className="inline-block mr-1.5 mb-0.5">
                              <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-700 font-mono-code font-bold text-[9.5px]">
                                {p.code || p.id}
                              </span>{' '}
                              <span className="text-slate-600">{p.name}</span>
                              {pIdx < item.prjs.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-slate-600">
                          Penugasan Tunggal (100%):
                        </span>
                        <span className="text-[10px] font-bold text-slate-800 font-mono-code">
                          {item.prjs[0]?.code || 'PRJ-001'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Allocated Cost Breakdown */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10.5px] font-mono-code">
                    <span className="text-slate-500">
                      {isMulti && selectedProjectId !== 'ALL' ? `Alokasi 1/${item.totalProjects}:` : 'Beban Gaji:'}
                    </span>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block">
                        {formatSalaryDisplay(item.allocatedBase, showChartNominal)}
                      </span>
                      {isMulti && (
                        <span className="text-[9px] text-slate-400 block">
                          Total: {formatSalaryDisplay(item.emp.baseSalary, showChartNominal)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {(selectedProjectId === 'ALL'
            ? projectFinancials.multiProjectPersonnel.length > 12
            : projectFinancials.personnelList.length > 12) && (
            <div className="text-center pt-1">
              <span className="text-[10.5px] text-slate-400 font-mono-code font-medium">
                + Menampilkan 12 dari total{' '}
                {selectedProjectId === 'ALL'
                  ? projectFinancials.multiProjectPersonnel.length
                  : projectFinancials.personnelList.length}{' '}
                personel terdata
              </span>
            </div>
          )}
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
