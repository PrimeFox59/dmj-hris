import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Briefcase,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Plane,
  Home,
  Plus,
  X,
  Eye,
  EyeOff,
  Info,
  ArrowRight,
  RefreshCw,
  Building2,
  CalendarCheck,
  CalendarClock,
  Layers,
  Sparkles,
  MapPin,
  ChevronDown,
  UserCheck,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, Project, ApprovalItem, WorkLocationType, NonLokalLeaveConfig } from '../types';
import { api } from '../services/api';

interface LeaveGanttChartTabProps {
  employees: Employee[];
  approvals: ApprovalItem[];
  projects: Project[];
  currentUser: Employee;
  onNavigateToTab?: (tabId: string, projectId?: string) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  onSubmitNewLeaveRequest?: (item: ApprovalItem) => void;
  isEmbedded?: boolean;
}

export type ZoomMode = '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR';
export type FilterLocation = 'ALL' | 'NON_LOKAL' | 'LOKAL';
export type FilterStatusType = 'ALL' | 'PLAN' | 'ACTUAL' | 'ACTIVE_TODAY' | 'OVERLAP';

export interface LeaveSpan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  position: string;
  department: string;
  projectId?: string;
  projectName?: string;
  locationType: WorkLocationType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  leaveType: string;
  category: 'PLAN' | 'ACTUAL' | 'PLAN_PENDING';
  approvalStatus?: string;
  source: 'ROSTER_CONFIG' | 'APPROVAL' | 'MANUAL';
  notes?: string;
  isConflict?: boolean;
  conflictDetails?: string[];
  deviationDays?: number;
}

// Helper: Indonesian Month Names
const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Date arithmetic utilities
function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(str: string): Date {
  const parts = str.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2] || 1);
}

function addDaysToYMD(str: string, days: number): string {
  try {
    const d = parseYMD(str);
    d.setDate(d.getDate() + days);
    return formatYMD(d);
  } catch (e) {
    return str;
  }
}

function getDaysDiffInclusive(start: string, end: string): number {
  try {
    const d1 = parseYMD(start).getTime();
    const d2 = parseYMD(end).getTime();
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  } catch (e) {
    return 1;
  }
}

function doDateRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}

export const LeaveGanttChartTab: React.FC<LeaveGanttChartTabProps> = ({
  employees,
  approvals,
  projects,
  currentUser,
  onNavigateToTab,
  onUpdateEmployee,
  onSubmitNewLeaveRequest,
  isEmbedded = false
}) => {
  // Today reference (Fixed or current system date)
  const todayStr = useMemo(() => {
    const now = new Date();
    return formatYMD(now);
  }, []);

  // Timeline view state
  const [zoomMode, setZoomMode] = useState<ZoomMode>('3_MONTHS');
  const [anchorMonthDate, setAnchorMonthDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Filter states
  const [filterLocation, setFilterLocation] = useState<FilterLocation>('ALL');
  const [filterStatusType, setFilterStatusType] = useState<FilterStatusType>('ALL');
  const [filterProjectId, setFilterProjectId] = useState<string>('ALL');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected leave detail popover / drawer
  const [selectedSpan, setSelectedSpan] = useState<LeaveSpan | null>(null);

  // Modal: Add / Schedule New Plan Leave
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [scheduleTargetEmpId, setScheduleTargetEmpId] = useState<string>('');
  const [scheduleStartDate, setScheduleStartDate] = useState<string>(todayStr);
  const [scheduleDays, setScheduleDays] = useState<number>(9);
  const [scheduleNotes, setScheduleNotes] = useState<string>('');
  const [isSubmittingPlan, setIsSubmittingPlan] = useState<boolean>(false);

  // Scroll container reference
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Compute Timeline Visible Date Range
  const { startDateRange, endDateRange, daysList, monthsHeader } = useMemo(() => {
    const start = new Date(anchorMonthDate);
    start.setDate(1);

    let totalMonths = 1;
    if (zoomMode === '1_MONTH') totalMonths = 1;
    else if (zoomMode === '3_MONTHS') totalMonths = 3;
    else if (zoomMode === '6_MONTHS') totalMonths = 6;
    else if (zoomMode === '1_YEAR') totalMonths = 12;

    const end = new Date(start);
    end.setMonth(end.getMonth() + totalMonths);
    end.setDate(0); // Last day of ending month

    const startStr = formatYMD(start);
    const endStr = formatYMD(end);

    const days: { dateStr: string; dayNum: number; dayName: string; isWeekend: boolean; isToday: boolean; monthIndex: number }[] = [];
    const cur = new Date(start);

    while (cur <= end) {
      const dStr = formatYMD(cur);
      const dayOfWeek = cur.getDay();
      days.push({
        dateStr: dStr,
        dayNum: cur.getDate(),
        dayName: DAY_NAMES_SHORT[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dStr === todayStr,
        monthIndex: cur.getMonth()
      });
      cur.setDate(cur.getDate() + 1);
    }

    // Build Month Headers
    const months: { label: string; year: number; daysCount: number }[] = [];
    let curMonth = new Date(start);
    for (let i = 0; i < totalMonths; i++) {
      const mIdx = curMonth.getMonth();
      const y = curMonth.getFullYear();
      const daysInThisMonth = new Date(y, mIdx + 1, 0).getDate();
      months.push({
        label: `${MONTH_NAMES_ID[mIdx]} ${y}`,
        year: y,
        daysCount: daysInThisMonth
      });
      curMonth.setMonth(curMonth.getMonth() + 1);
    }

    return {
      startDateRange: startStr,
      endDateRange: endStr,
      daysList: days,
      monthsHeader: months
    };
  }, [anchorMonthDate, zoomMode, todayStr]);

  // Aggregate All Leave Spans across employees
  const allLeaveSpans = useMemo(() => {
    const spans: LeaveSpan[] = [];

    employees.forEach(emp => {
      const locType: WorkLocationType = emp.workLocationType || (emp.nonLokalLeaveConfig ? 'NON_LOKAL' : 'LOKAL');
      const proj = projects.find(p => p.id === emp.assignedProjectId || p.code === emp.assignedProjectId);

      // 1. From NonLokalLeaveConfig Scheduled History
      if (emp.nonLokalLeaveConfig?.scheduledLeaveHistory) {
        emp.nonLokalLeaveConfig.scheduledLeaveHistory.forEach((item, idx) => {
          if (!item.startDate) return;
          const effectiveDays = Math.max(1, item.days || (item.endDate ? getDaysDiffInclusive(item.startDate, item.endDate) : 9));
          const consecutiveEnd = addDaysToYMD(item.startDate, effectiveDays - 1);
          const end = (item.endDate && item.endDate >= item.startDate && getDaysDiffInclusive(item.startDate, item.endDate) === effectiveDays)
            ? item.endDate
            : consecutiveEnd;
          const days = effectiveDays;
          const isPast = end < todayStr;
          const category: 'PLAN' | 'ACTUAL' = isPast ? 'ACTUAL' : 'PLAN';

          spans.push({
            id: `CFG-${emp.id}-${idx}`,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeNik: emp.nik,
            position: emp.position || 'Staff',
            department: emp.department || 'Operasional',
            projectId: proj?.id,
            projectName: proj?.name || emp.assignedProjectId || 'Head Office',
            locationType: locType,
            startDate: item.startDate,
            endDate: end,
            daysCount: days,
            leaveType: 'CUTI_ROSTER_NON_LOKAL',
            category,
            approvalStatus: isPast ? 'APPROVED' : 'SCHEDULED',
            source: 'ROSTER_CONFIG',
            notes: `Roster Rotasi Cuti ${emp.nonLokalLeaveConfig?.rosterCycleMonths || 3} Bulan (Jatah ${emp.nonLokalLeaveConfig?.leaveQuotaPerPeriod || 9} Hari)`
          });
        });
      }

      // 2. From nextEligibleLeaveDate if not already in history
      if (emp.nonLokalLeaveConfig?.nextEligibleLeaveDate) {
        const nextDate = emp.nonLokalLeaveConfig.nextEligibleLeaveDate;
        const exists = spans.some(s => s.employeeId === emp.id && s.startDate === nextDate);
        if (!exists && nextDate.length >= 8 && nextDate !== '5') {
          const quotaDays = emp.nonLokalLeaveConfig.leaveQuotaPerPeriod || 9;
          const end = addDaysToYMD(nextDate, quotaDays - 1);
          const isPast = end < todayStr;

          spans.push({
            id: `NEXT-${emp.id}`,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeNik: emp.nik,
            position: emp.position || 'Staff',
            department: emp.department || 'Operasional',
            projectId: proj?.id,
            projectName: proj?.name || emp.assignedProjectId || 'Head Office',
            locationType: locType,
            startDate: nextDate,
            endDate: end,
            daysCount: quotaDays,
            leaveType: 'CUTI_ROSTER_NON_LOKAL',
            category: isPast ? 'ACTUAL' : 'PLAN',
            approvalStatus: 'SCHEDULED',
            source: 'ROSTER_CONFIG',
            notes: `Estimasi Siklus Roster Berikutnya (${emp.nonLokalLeaveConfig.rosterCycleMonths || 3} Bulan)`
          });
        }
      }

      // 3. From lastLeaveDate if not already in history
      if (emp.nonLokalLeaveConfig?.lastLeaveDate) {
        const lastDate = emp.nonLokalLeaveConfig.lastLeaveDate;
        const exists = spans.some(s => s.employeeId === emp.id && (s.startDate === lastDate || s.endDate === lastDate));
        if (!exists && lastDate.length >= 8) {
          const quotaDays = emp.nonLokalLeaveConfig.leaveQuotaPerPeriod || 9;
          const start = addDaysToYMD(lastDate, -(quotaDays - 1));

          spans.push({
            id: `LAST-${emp.id}`,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeNik: emp.nik,
            position: emp.position || 'Staff',
            department: emp.department || 'Operasional',
            projectId: proj?.id,
            projectName: proj?.name || emp.assignedProjectId || 'Head Office',
            locationType: locType,
            startDate: start,
            endDate: lastDate,
            daysCount: quotaDays,
            leaveType: 'CUTI_ROSTER_NON_LOKAL',
            category: 'ACTUAL',
            approvalStatus: 'APPROVED',
            source: 'ROSTER_CONFIG',
            notes: 'Realisasi Cuti Roster Periode Terakhir'
          });
        }
      }

      // 4. From Approvals table (LEAVE type)
      const empApprovals = approvals.filter(a => a.employeeId === emp.id && a.type === 'LEAVE');
      empApprovals.forEach(appr => {
        if (!appr.startDate) return;
        // Line hanya nyambung jika beruntun dalam hari yang urut sesuai durasi cuti
        const effectiveDays = Math.max(1, appr.daysCount || (appr.endDate ? getDaysDiffInclusive(appr.startDate, appr.endDate) : 1));
        const consecutiveEnd = addDaysToYMD(appr.startDate, effectiveDays - 1);
        const end = (appr.endDate && appr.endDate >= appr.startDate && getDaysDiffInclusive(appr.startDate, appr.endDate) === effectiveDays)
          ? appr.endDate
          : consecutiveEnd;
        const days = effectiveDays;
        const isPast = end < todayStr;

        let category: 'PLAN' | 'ACTUAL' | 'PLAN_PENDING' = 'PLAN';
        if (appr.status === 'APPROVED') {
          category = isPast ? 'ACTUAL' : 'PLAN';
        } else if (appr.status === 'PENDING') {
          category = 'PLAN_PENDING';
        } else {
          return; // Skip rejected / revised in main timeline
        }

        // Avoid exact duplicate spans
        const dupIdx = spans.findIndex(s => s.employeeId === emp.id && s.startDate === appr.startDate);
        if (dupIdx >= 0) {
          spans[dupIdx].approvalStatus = appr.status;
          spans[dupIdx].notes = appr.description || spans[dupIdx].notes;
          spans[dupIdx].category = category;
        } else {
          spans.push({
            id: appr.id,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeNik: emp.nik,
            position: emp.position || 'Staff',
            department: emp.department || 'Operasional',
            projectId: proj?.id,
            projectName: proj?.name || emp.assignedProjectId || 'Head Office',
            locationType: locType,
            startDate: appr.startDate,
            endDate: end,
            daysCount: days,
            leaveType: appr.leaveType || (locType === 'NON_LOKAL' ? 'CUTI_ROSTER_NON_LOKAL' : 'CUTI_TAHUNAN'),
            category,
            approvalStatus: appr.status,
            source: 'APPROVAL',
            notes: appr.description || appr.title
          });
        }
      });
    });

    // Detect Overlap / Conflicts (e.g. 2+ employees in same project / department on leave at same time)
    spans.forEach(spanA => {
      const conflicts: string[] = [];
      spans.forEach(spanB => {
        if (spanA.id === spanB.id || spanA.employeeId === spanB.employeeId) return;

        // Same project or same department conflict check
        const sameProject = spanA.projectId && spanB.projectId && spanA.projectId === spanB.projectId;
        const sameDept = spanA.department && spanB.department && spanA.department === spanB.department;

        if ((sameProject || sameDept) && doDateRangesOverlap(spanA.startDate, spanA.endDate, spanB.startDate, spanB.endDate)) {
          conflicts.push(`${spanB.employeeName} (${spanB.position || 'Staff'} - ${spanB.projectName || spanB.department})`);
        }
      });

      if (conflicts.length > 0) {
        spanA.isConflict = true;
        spanA.conflictDetails = conflicts;
      }
    });

    return spans;
  }, [employees, approvals, projects, todayStr]);

  // Unique Departments and Projects for filters
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees & their corresponding spans
  const { filteredEmployees, employeeSpansMap, stats } = useMemo(() => {
    // 1. Filter spans by status type
    let relevantSpans = allLeaveSpans;
    if (filterStatusType === 'PLAN') {
      relevantSpans = relevantSpans.filter(s => s.category === 'PLAN' || s.category === 'PLAN_PENDING');
    } else if (filterStatusType === 'ACTUAL') {
      relevantSpans = relevantSpans.filter(s => s.category === 'ACTUAL');
    } else if (filterStatusType === 'ACTIVE_TODAY') {
      relevantSpans = relevantSpans.filter(s => s.startDate <= todayStr && s.endDate >= todayStr);
    } else if (filterStatusType === 'OVERLAP') {
      relevantSpans = relevantSpans.filter(s => s.isConflict);
    }

    // 2. Filter employees
    const matchedEmps = employees.filter(emp => {
      const locType: WorkLocationType = emp.workLocationType || (emp.nonLokalLeaveConfig ? 'NON_LOKAL' : 'LOKAL');

      if (filterLocation === 'NON_LOKAL' && locType !== 'NON_LOKAL') return false;
      if (filterLocation === 'LOKAL' && locType !== 'LOKAL') return false;

      if (filterProjectId !== 'ALL' && emp.assignedProjectId !== filterProjectId) return false;
      if (filterDepartment !== 'ALL' && emp.department !== filterDepartment) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = emp.name.toLowerCase().includes(q);
        const mNik = emp.nik.toLowerCase().includes(q);
        const mPos = (emp.position || '').toLowerCase().includes(q);
        if (!mName && !mNik && !mPos) return false;
      }

      // If filtering by specific status type, only show employees who have relevant spans
      if (filterStatusType !== 'ALL') {
        const hasSpan = relevantSpans.some(s => s.employeeId === emp.id);
        if (!hasSpan) return false;
      }

      return true;
    });

    // Map spans per employee
    const spanMap = new Map<string, LeaveSpan[]>();
    matchedEmps.forEach(e => {
      const empSpans = relevantSpans.filter(s => s.employeeId === e.id);
      spanMap.set(e.id, empSpans);
    });

    // High-level KPI Stats
    const totalNonLokal = employees.filter(e => (e.workLocationType === 'NON_LOKAL' || e.nonLokalLeaveConfig)).length;
    const totalLokal = employees.length - totalNonLokal;
    const activeTodayCount = allLeaveSpans.filter(s => s.startDate <= todayStr && s.endDate >= todayStr && s.category === 'ACTUAL').length;
    const planThisMonthCount = allLeaveSpans.filter(s => {
      const [y, m] = s.startDate.split('-').map(Number);
      const today = parseYMD(todayStr);
      return (s.category === 'PLAN' || s.category === 'PLAN_PENDING') && y === today.getFullYear() && m === (today.getMonth() + 1);
    }).length;
    const overlapCount = allLeaveSpans.filter(s => s.isConflict).length;

    return {
      filteredEmployees: matchedEmps,
      employeeSpansMap: spanMap,
      stats: {
        totalNonLokal,
        totalLokal,
        activeTodayCount,
        planThisMonthCount,
        overlapCount
      }
    };
  }, [employees, allLeaveSpans, filterLocation, filterStatusType, filterProjectId, filterDepartment, searchQuery, todayStr]);

  // Column width per day based on Zoom Mode
  const dayColWidth = useMemo(() => {
    switch (zoomMode) {
      case '1_MONTH': return 36;
      case '3_MONTHS': return 18;
      case '6_MONTHS': return 12;
      case '1_YEAR': return 7;
      default: return 18;
    }
  }, [zoomMode]);

  // Navigate periods
  const handlePrevPeriod = () => {
    setAnchorMonthDate(prev => {
      const d = new Date(prev);
      const step = zoomMode === '1_MONTH' ? 1 : zoomMode === '3_MONTHS' ? 3 : zoomMode === '6_MONTHS' ? 6 : 12;
      d.setMonth(d.getMonth() - step);
      return d;
    });
  };

  const handleNextPeriod = () => {
    setAnchorMonthDate(prev => {
      const d = new Date(prev);
      const step = zoomMode === '1_MONTH' ? 1 : zoomMode === '3_MONTHS' ? 3 : zoomMode === '6_MONTHS' ? 6 : 12;
      d.setMonth(d.getMonth() + step);
      return d;
    });
  };

  const handleResetToToday = () => {
    const d = new Date();
    d.setDate(1);
    setAnchorMonthDate(d);
  };

  // Auto-scroll timeline to Today on mount
  useEffect(() => {
    if (timelineScrollRef.current) {
      const todayIdx = daysList.findIndex(d => d.dateStr === todayStr);
      if (todayIdx > 5) {
        timelineScrollRef.current.scrollLeft = (todayIdx - 3) * dayColWidth;
      }
    }
  }, [daysList, dayColWidth, todayStr]);

  // Export Gantt Chart to Excel (.xlsx)
  const handleExportToExcel = () => {
    try {
      const allSpansToExport: any[] = [];
      let rowIdx = 1;

      filteredEmployees.forEach(emp => {
        const empSpans = employeeSpansMap.get(emp.id) || [];
        empSpans.forEach(span => {
          allSpansToExport.push({
            'No': rowIdx++,
            'NIK': span.employeeNik,
            'Nama Karyawan': span.employeeName,
            'Tipe Personil': span.locationType === 'NON_LOKAL' ? 'Non-Lokal (Site)' : 'Lokal',
            'Jabatan': span.position,
            'Departemen': span.department,
            'Proyek / Site': span.projectName,
            'Tipe Jadwal': span.category === 'PLAN' ? 'PLAN (Rencana)' : 'AKTUAL (Realisasi)',
            'Tanggal Mulai': span.startDate,
            'Tanggal Selesai': span.endDate,
            'Durasi (Hari)': span.daysCount,
            'Jenis Cuti': span.leaveType,
            'Status Otorisasi': span.approvalStatus,
            'Jadwal Bersamaan Tim': span.isConflict ? 'Ya' : 'Tidak',
            'Detail Bersamaan': span.conflictDetails?.join('; ') || '-',
            'Keterangan / Keperluan': span.notes || '-'
          });
        });
      });

      // Sheet 1: Detail Jadwal Cuti
      const wsDetail = XLSX.utils.json_to_sheet(allSpansToExport);
      wsDetail['!cols'] = [
        { wch: 6 },  // No
        { wch: 14 }, // NIK
        { wch: 25 }, // Nama
        { wch: 18 }, // Tipe Personil
        { wch: 20 }, // Jabatan
        { wch: 18 }, // Departemen
        { wch: 25 }, // Proyek
        { wch: 18 }, // Tipe Jadwal
        { wch: 14 }, // Tgl Mulai
        { wch: 14 }, // Tgl Selesai
        { wch: 12 }, // Durasi
        { wch: 25 }, // Jenis Cuti
        { wch: 16 }, // Status
        { wch: 20 }, // Bersamaan
        { wch: 35 }, // Detail
        { wch: 35 }  // Keterangan
      ];

      // Sheet 2: Ringkasan Eksekutif
      const summaryData = [
        { 'Indikator': 'Total Staf Non-Lokal (Site)', 'Nilai': stats.totalNonLokal, 'Keterangan': 'Personil rotasi roster site' },
        { 'Indikator': 'Total Staf Lokal', 'Nilai': stats.totalLokal, 'Keterangan': 'Personil cuti tahunan reguler' },
        { 'Indikator': 'Staf Sedang Cuti Hari Ini', 'Nilai': stats.activeTodayCount, 'Keterangan': 'Sedang menjalani cuti per ' + todayStr },
        { 'Indikator': 'Jadwal Bersamaan dengan Rekan Satu Tim', 'Nilai': stats.overlapCount, 'Keterangan': 'Tanggal cuti bertepatan di proyek/site sama' },
        { 'Indikator': 'Total Jadwal Terdata', 'Nilai': allSpansToExport.length, 'Keterangan': 'Total record Plan & Realisasi' },
        { 'Indikator': 'Tanggal Export Laporan', 'Nilai': todayStr, 'Keterangan': 'Diexport oleh ' + (currentUser?.name || 'Administrator') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [
        { wch: 35 },
        { wch: 12 },
        { wch: 45 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Jadwal Cuti Plan & Aktual');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

      XLSX.writeFile(wb, `Jadwal_Cuti_Gantt_Chart_PRIME_HRIS_${todayStr}.xlsx`);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('Gagal mengekspor data ke Excel.');
    }
  };

  // Handle Create / Schedule New Plan Leave
  const handleOpenScheduleModal = (employeeId?: string) => {
    setScheduleTargetEmpId(employeeId || (filteredEmployees[0]?.id || ''));
    setScheduleStartDate(todayStr);
    setScheduleDays(9);
    setScheduleNotes('');
    setShowScheduleModal(true);
  };

  const handleSavePlanLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTargetEmpId || !scheduleStartDate) return;

    setIsSubmittingPlan(true);
    const targetEmp = employees.find(e => e.id === scheduleTargetEmpId);
    if (!targetEmp) {
      setIsSubmittingPlan(false);
      return;
    }

    const calculatedEndDate = addDaysToYMD(scheduleStartDate, scheduleDays - 1);
    const isNonLokal = targetEmp.workLocationType === 'NON_LOKAL' || Boolean(targetEmp.nonLokalLeaveConfig);

    const newApproval: ApprovalItem = {
      id: `APP-PLAN-${Date.now()}`,
      type: 'LEAVE',
      employeeId: targetEmp.id,
      employeeName: targetEmp.name,
      employeeNik: targetEmp.nik,
      department: targetEmp.department || 'Operasional',
      title: `Plan Cuti Roster: ${targetEmp.name} (${scheduleDays} Hari)`,
      description: scheduleNotes || `Jadwal rencana cuti ${isNonLokal ? 'roster non-lokal' : 'tahunan'} periode ${scheduleStartDate} s/d ${calculatedEndDate}`,
      startDate: scheduleStartDate,
      endDate: calculatedEndDate,
      daysCount: scheduleDays,
      leaveType: isNonLokal ? 'CUTI_ROSTER_NON_LOKAL' : 'CUTI_TAHUNAN',
      status: 'APPROVED', // HR/PM planned schedule is pre-approved plan
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reviewedBy: `${currentUser.name} (${currentUser.role})`,
      reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reviewNote: 'Jadwal Plan Cuti Terdaftar Resmi'
    };

    try {
      if (onSubmitNewLeaveRequest) {
        onSubmitNewLeaveRequest(newApproval);
      } else {
        await api.submitApproval(newApproval);
      }

      // Also update employee's nextEligibleLeaveDate if non-lokal
      if (isNonLokal && onUpdateEmployee) {
        const nextDate = addDaysToYMD(calculatedEndDate, (targetEmp.nonLokalLeaveConfig?.rosterCycleMonths || 3) * 30);
        const updatedConfig: NonLokalLeaveConfig = {
          ...(targetEmp.nonLokalLeaveConfig || {
            rosterCycleMonths: 3,
            leaveQuotaPerPeriod: scheduleDays,
            usedPeriodLeave: 0
          }),
          lastLeaveDate: targetEmp.nonLokalLeaveConfig?.lastLeaveDate,
          nextEligibleLeaveDate: nextDate,
          scheduledLeaveHistory: [
            ...(targetEmp.nonLokalLeaveConfig?.scheduledLeaveHistory || []),
            {
              startDate: scheduleStartDate,
              endDate: calculatedEndDate,
              days: scheduleDays,
              status: 'SCHEDULED'
            }
          ]
        };

        const updatedEmp: Employee = {
          ...targetEmp,
          workLocationType: 'NON_LOKAL',
          nonLokalLeaveConfig: updatedConfig
        };

        onUpdateEmployee(updatedEmp);
        await api.saveEmployee(updatedEmp).catch(() => {});
      }

      setShowScheduleModal(false);
    } catch (err) {
      console.error('Failed to save plan leave', err);
      alert('Gagal menyimpan rencana cuti. Silakan coba kembali.');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'motion-fade-in-up'}`}>
      
      {/* 1. Header Banner & Executive Controls */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="prime-cut-corner bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code">
                MODUL MANAJEMEN ROSTER & CUTI
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono-code">
                Visualisasi Gantt Chart • Plan vs Aktual
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-[#FF6B00]" />
              <span>Gantt Chart Jadwal Cuti Karyawan Lokal & Non-Lokal</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Monitoring jadwal rencana (Plan Bar) & realisasi (Aktual Line Overlay) rotasi cuti site staf Non-Lokal serta staf Lokal secara visual & presisi.
            </p>
          </div>

          {/* Action Buttons: Export ke Excel & Jadwalkan Plan Cuti Baru */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0 flex-wrap">
            <button
              onClick={handleExportToExcel}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs hover:shadow-emerald-500/10 transition-all cursor-pointer active:scale-95"
              title="Unduh Rekap Jadwal Gantt Chart ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export ke Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => handleOpenScheduleModal()}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-orange-500/25 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Jadwalkan Plan Cuti</span>
            </button>
          </div>
        </div>

        {/* 2. KPI Summary Mini Strip (4 Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4">
          {/* Card 1: Non-Lokal Staff */}
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-mono-code block">
                Staf Non-Lokal (Site)
              </span>
              <div className="text-xl font-black text-purple-900 font-mono-code mt-0.5">
                {stats.totalNonLokal} <span className="text-xs font-medium text-purple-600">Personil</span>
              </div>
              <span className="text-[10px] text-purple-600 font-medium">Rotasi Roster 3 Bulan Sekali</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Lokal Staff */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 font-mono-code block">
                Staf Lokal (Pusat/Site)
              </span>
              <div className="text-xl font-black text-blue-900 font-mono-code mt-0.5">
                {stats.totalLokal} <span className="text-xs font-medium text-blue-600">Personil</span>
              </div>
              <span className="text-[10px] text-blue-600 font-medium">Jatah Cuti Tahunan 12 Hari</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Sedang Cuti Hari Ini */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono-code block">
                Sedang Cuti Hari Ini
              </span>
              <div className="text-xl font-black text-emerald-900 font-mono-code mt-0.5">
                {stats.activeTodayCount} <span className="text-xs font-medium text-emerald-600">Aktif</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">Status Realisasi Aktual</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Jadwal Tim Bersamaan */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/60 flex items-center justify-between text-indigo-950">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono-code block">
                Jadwal Tim Bersamaan
              </span>
              <div className="text-xl font-black text-indigo-900 font-mono-code mt-0.5">
                {stats.overlapCount} <span className="text-xs font-medium text-indigo-600">Personil</span>
              </div>
              <span className="text-[10px] text-indigo-600 font-medium">Tanggal Cuti Berdekatan / Bersamaan</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Filter & Timeline Navigation Bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        {/* Top Filter Row: Location, Status, Department, Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Location Segment Control */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 shrink-0">
            {[
              { id: 'ALL', label: 'Semua Kategori', count: employees.length },
              { id: 'NON_LOKAL', label: 'Non-Lokal (Roster)', count: stats.totalNonLokal, icon: Plane },
              { id: 'LOKAL', label: 'Lokal', count: stats.totalLokal, icon: Home }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterLocation(tab.id as FilterLocation)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterLocation === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-mono-code px-1.5 py-0.2 rounded-full ${
                    filterLocation === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Segment Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'Semua (Plan & Aktual)' },
              { id: 'PLAN', label: 'Hanya Plan (Bar)' },
              { id: 'ACTUAL', label: 'Hanya Aktual (Line)' },
              { id: 'ACTIVE_TODAY', label: 'Cuti Hari Ini' },
              { id: 'OVERLAP', label: `Jadwal Bersamaan (${stats.overlapCount})` }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setFilterStatusType(btn.id as FilterStatusType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterStatusType === btn.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari staf / NIK / jabatan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#FF6B00] bg-white text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Control Row: Project Selector, Zoom Mode, Month Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          
          {/* Project & Department Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project Select */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <Briefcase className="w-3.5 h-3.5 text-[#FF6B00]" />
              <select
                value={filterProjectId}
                onChange={e => setFilterProjectId(e.target.value)}
                className="bg-transparent font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL">Semua Proyek Site ({projects.length})</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name.length > 25 ? p.name.slice(0, 25) + '...' : p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Select */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterDepartment}
                onChange={e => setFilterDepartment(e.target.value)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL">Semua Divisi ({departmentsList.length})</option>
                {departmentsList.map(dept => (
                  <option key={dept} value={dept}>
                    {dept.length > 25 ? dept.slice(0, 25) + '...' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeline Range Mode & Month Steppers */}
          <div className="flex items-center gap-2 ml-auto">
            
            {/* Zoom Range Stepper */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200 text-[11px] font-bold">
              {[
                { id: '1_MONTH', label: '1 Bln' },
                { id: '3_MONTHS', label: '3 Bln (Triwulan)' },
                { id: '6_MONTHS', label: '6 Bln' },
                { id: '1_YEAR', label: '1 Thn' }
              ].map(z => (
                <button
                  key={z.id}
                  onClick={() => setZoomMode(z.id as ZoomMode)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    zoomMode === z.id
                      ? 'bg-white text-[#FF6B00] shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            {/* Prev / Today / Next Controls */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={handlePrevPeriod}
                title="Periode Sebelumnya"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetToToday}
                className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6B00] font-bold text-[11px] cursor-pointer font-mono-code transition-all"
              >
                Bulan Ini
              </button>

              <button
                onClick={handleNextPeriod}
                title="Periode Berikutnya"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend Indicator Strip */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-slate-600 pt-1 border-t border-slate-100/80">
          <span className="font-bold text-slate-700">Keterangan:</span>
          
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-3.5 rounded-md bg-amber-500/20 border-1.5 border-amber-400"></span>
            <span><strong>Plan (Bar)</strong>: Rencana Jadwal Cuti / Roster</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xs ring-1 ring-white"></span>
            <span><strong>Aktual (Line)</strong>: Realisasi Cuti (Overlay di atas Plan Bar)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-3.5 rounded-md border-2 border-dashed border-amber-400 bg-amber-50/70"></span>
            <span><strong>Plan Pending</strong>: Menunggu Approval</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md border-1.5 border-purple-400 bg-purple-50 ring-1 ring-purple-300"></span>
            <span className="text-purple-700 font-semibold">Tanda Ungu: Jadwal Tim Bersamaan</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="font-mono-code font-bold text-rose-600">Garis Merah: Hari Ini ({todayStr})</span>
          </div>
        </div>
      </div>

      {/* 4. The Interactive Gantt Chart Canvas */}
      <div className="glass-card rounded-3xl border border-slate-200/90 shadow-lg overflow-hidden bg-white">
        
        {/* Main Gantt Grid Horizontal Scrollable */}
        <div ref={timelineScrollRef} className="overflow-x-auto relative select-none max-h-[680px] overflow-y-auto">
          
          <div style={{ minWidth: 320 + daysList.length * dayColWidth }} className="relative">
            
            {/* Header Sticky Rows */}
            <div className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
              
              {/* Row 1: Month Groups */}
              <div className="flex border-b border-slate-800">
                {/* Left Header Corner */}
                <div className="w-80 shrink-0 p-3 font-bold text-xs uppercase tracking-wider font-mono-code text-slate-300 border-r border-slate-800 flex items-center justify-between sticky left-0 z-40 bg-slate-900">
                  <span>Nama Karyawan & Penempatan</span>
                  <span className="text-[10px] text-slate-400 font-normal">({filteredEmployees.length} staf)</span>
                </div>

                {/* Months Ribbon */}
                <div className="flex-1 flex">
                  {monthsHeader.map((m, idx) => (
                    <div
                      key={idx}
                      style={{ width: m.daysCount * dayColWidth }}
                      className="p-2 text-center text-xs font-bold border-r border-slate-800/80 uppercase font-mono-code tracking-wide text-orange-400 bg-slate-900/90 truncate"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: Days Header Grid */}
              <div className="flex border-b border-slate-800/80">
                {/* Left Corner: Role / Subtitle */}
                <div className="w-80 shrink-0 px-3 py-1.5 text-[10px] font-bold text-slate-400 border-r border-slate-800 flex items-center justify-between sticky left-0 z-40 bg-slate-900">
                  <span>Posisi • Proyek • Roster</span>
                  <span>Jatah Cuti</span>
                </div>

                {/* Days Columns */}
                <div className="flex-1 flex">
                  {daysList.map((d, idx) => (
                    <div
                      key={idx}
                      style={{ width: dayColWidth }}
                      className={`text-center py-1 text-[10px] font-mono-code shrink-0 border-r border-slate-800/50 flex flex-col justify-center items-center overflow-hidden ${
                        d.isToday
                          ? 'bg-rose-600 text-white font-black ring-2 ring-rose-400 z-10'
                          : d.isWeekend
                          ? 'bg-slate-800/80 text-slate-400'
                          : 'text-slate-300'
                      }`}
                      title={`${d.dateStr} (${d.dayName})`}
                    >
                      {dayColWidth >= 28 ? (
                        <span className="text-[8px] leading-tight opacity-75">{d.dayName}</span>
                      ) : dayColWidth >= 16 ? (
                        <span className="text-[7.5px] leading-tight opacity-60 font-semibold">{d.dayName.charAt(0)}</span>
                      ) : null}
                      <span className={`font-bold leading-tight ${dayColWidth < 14 ? 'text-[8px]' : 'text-[10px]'}`}>{d.dayNum}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gantt Body: Employee Rows */}
            <div className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <div className="p-16 text-center text-slate-500 space-y-3">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800">Tidak ada data karyawan yang cocok</h3>
                  <p className="text-xs max-w-sm mx-auto">
                    Coba sesuaikan filter kategori lokasi, proyek, status, atau kata kunci pencarian di atas.
                  </p>
                </div>
              ) : (
                filteredEmployees.map((emp, empIdx) => {
                  const empSpans = employeeSpansMap.get(emp.id) || [];
                  const isNonLokal = emp.workLocationType === 'NON_LOKAL' || Boolean(emp.nonLokalLeaveConfig);
                  const proj = projects.find(p => p.id === emp.assignedProjectId || p.code === emp.assignedProjectId);

                  return (
                    <div
                      key={emp.id}
                      className={`flex hover:bg-orange-50/20 transition-colors group relative ${
                        empIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Left Sticky Column: Employee Identity & Metadata */}
                      <div className="w-80 shrink-0 p-3 border-r border-slate-200/90 flex items-center justify-between gap-3 sticky left-0 z-20 bg-inherit shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                            {emp.avatar ? (
                              <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              emp.name.charAt(0)
                            )}
                          </div>

                          {/* Name & Position */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 truncate" title={emp.name}>
                                {emp.name}
                              </span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md font-mono-code shrink-0 ${
                                isNonLokal
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {isNonLokal ? 'NON-LOKAL' : 'LOKAL'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 truncate" title={emp.position}>
                              {emp.position || 'Staff'} • <span className="text-slate-700 font-medium">{proj?.code || emp.assignedProjectId || 'HO'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Right Pill: Leave Quota or Roster Cycle */}
                        <div className="text-right shrink-0">
                          {isNonLokal ? (
                            <div>
                              <span className="text-[10px] font-bold text-purple-700 font-mono-code block">
                                {emp.nonLokalLeaveConfig?.rosterCycleMonths || 3}B : {emp.nonLokalLeaveConfig?.leaveQuotaPerPeriod || 9}H
                              </span>
                              <span className="text-[9px] text-slate-400">
                                Sisa: {(emp.nonLokalLeaveConfig?.leaveQuotaPerPeriod || 9) - (emp.nonLokalLeaveConfig?.usedPeriodLeave || 0)} hr
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] font-bold text-blue-700 font-mono-code block">
                                Sisa: {emp.leaveQuota - emp.usedLeave} / {emp.leaveQuota}
                              </span>
                              <span className="text-[9px] text-slate-400">Tahunan</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Grid Column: Days Cells & Gantt Spans */}
                      <div className="flex-1 flex relative h-14 items-center">
                        
                        {/* Background Days Grid Lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {daysList.map((d, dIdx) => (
                            <div
                              key={dIdx}
                              style={{ width: dayColWidth }}
                              className={`shrink-0 border-r border-slate-100 h-full ${
                                d.isToday
                                  ? 'bg-rose-500/10 border-rose-300'
                                  : d.isWeekend
                                  ? 'bg-slate-100/50'
                                  : ''
                              }`}
                            />
                          ))}
                        </div>

                        {/* Red Vertical Today Line */}
                        {daysList.some(d => d.isToday) && (
                          <div
                            style={{
                              left: (daysList.findIndex(d => d.isToday) + 0.5) * dayColWidth
                            }}
                            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none"
                          />
                        )}

                        {/* ============================================================
                            LAYER 1: PLAN BARS (Plan Digambarkan Sebagai Bar)
                           ============================================================ */}
                        {empSpans
                          .filter(s => s.category === 'PLAN' || s.category === 'PLAN_PENDING')
                          .map(span => {
                            const rangeStart = daysList[0].dateStr;
                            const rangeEnd = daysList[daysList.length - 1].dateStr;
                            if (span.endDate < rangeStart || span.startDate > rangeEnd) return null;

                            const visibleStart = span.startDate < rangeStart ? rangeStart : span.startDate;
                            const visibleEnd = span.endDate > rangeEnd ? rangeEnd : span.endDate;
                            const startIdx = daysList.findIndex(d => d.dateStr === visibleStart);
                            const endIdx = daysList.findIndex(d => d.dateStr === visibleEnd);
                            if (startIdx < 0 || endIdx < 0) return null;

                            const leftPos = startIdx * dayColWidth + 1;
                            const spanWidth = Math.max(dayColWidth - 2, (endIdx - startIdx + 1) * dayColWidth - 2);
                            const isPending = span.category === 'PLAN_PENDING';

                            return (
                              <div
                                key={`plan-${span.id}`}
                                style={{
                                  left: `${leftPos}px`,
                                  width: `${spanWidth}px`
                                }}
                                onClick={() => setSelectedSpan(span)}
                                className={`absolute h-8 top-3 rounded-xl px-2 flex items-center justify-between text-[10px] font-bold transition-all cursor-pointer hover:z-25 z-10 ${
                                  isPending
                                    ? 'border-2 border-dashed border-amber-400 bg-amber-50/75 text-amber-900 shadow-2xs'
                                    : 'bg-amber-500/15 border-1.5 border-amber-400/90 text-amber-950 shadow-2xs hover:bg-amber-500/25'
                                } ${span.isConflict ? 'ring-1.5 ring-purple-400' : ''}`}
                                title={`PLAN: ${span.employeeName} (${span.startDate} s/d ${span.endDate}) • ${span.daysCount} Hari`}
                              >
                                <div className="flex items-center gap-1 min-w-0 truncate">
                                  <CalendarClock className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="text-[9px] font-mono-code font-bold text-amber-800 truncate">
                                    {isPending ? 'Pending' : 'Plan'} {span.daysCount}h
                                  </span>
                                </div>
                                {span.isConflict && (
                                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" title="Jadwal bersamaan dengan rekan tim" />
                                )}
                              </div>
                            );
                          })}

                        {/* ============================================================
                            LAYER 2: ACTUAL LINES (Aktual Line Overlay Di Atas Plan Bar)
                           ============================================================ */}
                        {empSpans
                          .filter(s => s.category === 'ACTUAL')
                          .map(span => {
                            const rangeStart = daysList[0].dateStr;
                            const rangeEnd = daysList[daysList.length - 1].dateStr;
                            if (span.endDate < rangeStart || span.startDate > rangeEnd) return null;

                            const visibleStart = span.startDate < rangeStart ? rangeStart : span.startDate;
                            const visibleEnd = span.endDate > rangeEnd ? rangeEnd : span.endDate;
                            const startIdx = daysList.findIndex(d => d.dateStr === visibleStart);
                            const endIdx = daysList.findIndex(d => d.dateStr === visibleEnd);
                            if (startIdx < 0 || endIdx < 0) return null;

                            const leftPos = startIdx * dayColWidth + 1;
                            const spanWidth = Math.max(dayColWidth - 2, (endIdx - startIdx + 1) * dayColWidth - 2);

                            return (
                              <div
                                key={`act-${span.id}`}
                                style={{
                                  left: `${leftPos}px`,
                                  width: `${spanWidth}px`
                                }}
                                onClick={() => setSelectedSpan(span)}
                                className="absolute h-3 top-[22px] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md ring-1.5 ring-white hover:ring-2 hover:ring-emerald-400 hover:h-4 hover:top-[20px] transition-all cursor-pointer z-20 flex items-center px-1.5 group/act"
                                title={`AKTUAL: ${span.employeeName} (${span.startDate} s/d ${span.endDate}) • ${span.daysCount} Hari`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0 shadow-2xs" />
                                {spanWidth >= 44 && (
                                  <span className="text-[8px] font-black text-white font-mono-code truncate ml-1 drop-shadow-2xs select-none">
                                    Aktual {span.daysCount}h
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Modal / Drawer: Leave Span Detail Inspection */}
      {selectedSpan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono-code uppercase ${
                    selectedSpan.locationType === 'NON_LOKAL'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedSpan.locationType}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono-code uppercase ${
                    selectedSpan.category === 'ACTUAL'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedSpan.category === 'PLAN_PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {selectedSpan.category === 'ACTUAL' ? 'REALISASI (AKTUAL)' : selectedSpan.category === 'PLAN_PENDING' ? 'MENUNGGU PERSETUJUAN' : 'RENCANA (PLAN)'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">{selectedSpan.employeeName}</h3>
                <p className="text-xs text-slate-500">{selectedSpan.position} • {selectedSpan.employeeNik}</p>
              </div>

              <button
                onClick={() => setSelectedSpan(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overlap Informational Notice if any */}
            {selectedSpan.isConflict && selectedSpan.conflictDetails && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs text-indigo-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span>Informasi: Jadwal Cuti Bersamaan dengan Tim Site</span>
                </div>
                <p className="text-[11px] text-indigo-800/90">
                  Jadwal ini bertepatan pada tanggal yang sama dengan rekan personil pada site / unit kerja:
                </p>
                <ul className="list-disc list-inside text-[11px] font-semibold text-indigo-900 pl-1">
                  {selectedSpan.conflictDetails.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Leave Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-medium block text-[10px] uppercase">Tanggal Mulai Cuti</span>
                <span className="text-sm font-black text-slate-900 font-mono-code">{selectedSpan.startDate}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-medium block text-[10px] uppercase">Tanggal Selesai Cuti</span>
                <span className="text-sm font-black text-slate-900 font-mono-code">{selectedSpan.endDate}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-medium block text-[10px] uppercase">Durasi Total</span>
                <span className="text-sm font-black text-[#FF6B00] font-mono-code">{selectedSpan.daysCount} Hari Kalender</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-medium block text-[10px] uppercase">Proyek Penugasan</span>
                <span className="text-xs font-bold text-slate-800 truncate block">{selectedSpan.projectName || 'Head Office'}</span>
              </div>
            </div>

            {/* Notes & Description */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-700 block">Keterangan & Dasar Cuti:</span>
              <p className="leading-relaxed">{selectedSpan.notes || 'Tidak ada catatan tambahan.'}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedSpan(null);
                  if (onNavigateToTab) onNavigateToTab('approvals');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Lihat di Pusat Approval
              </button>

              <button
                onClick={() => setSelectedSpan(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Form Jadwalkan Plan Cuti Baru */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Jadwalkan Plan Cuti Baru</h3>
                  <p className="text-xs text-slate-500">Tetapkan tanggal rencana cuti roster atau cuti tahunan staf</p>
                </div>
              </div>

              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Schedule Form */}
            <form onSubmit={handleSavePlanLeave} className="space-y-4 text-xs">
              
              {/* Employee Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pilih Karyawan:</label>
                <select
                  value={scheduleTargetEmpId}
                  onChange={e => {
                    setScheduleTargetEmpId(e.target.value);
                    const selected = employees.find(emp => emp.id === e.target.value);
                    if (selected?.nonLokalLeaveConfig?.leaveQuotaPerPeriod) {
                      setScheduleDays(selected.nonLokalLeaveConfig.leaveQuotaPerPeriod);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:border-[#FF6B00] outline-none"
                  required
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.nik}) - {emp.workLocationType || (emp.nonLokalLeaveConfig ? 'NON-LOKAL' : 'LOKAL')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date & Days Count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Mulai Cuti:</label>
                  <input
                    type="date"
                    value={scheduleStartDate}
                    onChange={e => setScheduleStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-mono-code font-bold focus:border-[#FF6B00] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Durasi Hari Cuti:</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={scheduleDays}
                    onChange={e => setScheduleDays(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-mono-code font-bold focus:border-[#FF6B00] outline-none"
                    required
                  />
                </div>
              </div>

              {/* Calculated End Date Preview */}
              <div className="p-3 rounded-2xl bg-orange-50/80 border border-orange-200 flex items-center justify-between text-orange-950 font-bold">
                <span>Perkiraan Selesai Cuti:</span>
                <span className="font-mono-code text-sm text-[#FF6B00]">
                  {addDaysToYMD(scheduleStartDate, scheduleDays - 1)}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Keterangan / Alasan Roster:</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Jadwal cuti rotasi triwulan II site Pomalaa..."
                  value={scheduleNotes}
                  onChange={e => setScheduleNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-[#FF6B00] outline-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingPlan}
                  className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-orange-600 text-white font-bold cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingPlan ? 'Menyimpan...' : 'Simpan Jadwal Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
