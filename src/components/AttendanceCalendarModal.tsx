import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Coffee,
  Palmtree,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Sparkles,
  Filter,
  Grid,
  List,
  MapPin,
  User,
  ShieldCheck,
  Check,
  ArrowRight,
  Camera,
  Info,
  CalendarDays
} from 'lucide-react';
import {
  Employee,
  AttendanceRecord,
  ApprovalItem,
  Project,
  SalaryRuleConfig,
  AnnualWorkCalendarConfig,
  WorkPeriodItem
} from '../types';
import { getEmployeeProjectSchedule } from '../utils/scheduleHelper';
import { api } from '../services/api';

export interface AttendanceCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  projects: Project[];
  salaryRules: SalaryRuleConfig;
  annualWorkCalendar?: AnnualWorkCalendarConfig | null;
  onNavigateToTab?: (tabId: string, subView?: string) => void;
}

export type DayAttendanceStatus =
  | 'HADIR_LENGKAP'
  | 'LUPA_PULANG'
  | 'LUPA_MASUK'
  | 'ALPA'
  | 'CUTI_IZIN'
  | 'LIBUR'
  | 'SEDANG_BEKERJA'
  | 'BELUM_PRESENSI'
  | 'MENDATANG';

interface CalendarDayItem {
  blank: boolean;
  key: string;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  dayName: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isWorkDay: boolean; // Hari kerja HR
  isWeeklyOff: boolean;
  isNationalHoliday: boolean;
  holidayName?: string;
  attendance?: AttendanceRecord;
  approvedLeave?: ApprovalItem;
  status: DayAttendanceStatus;
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'cyan';
  checkInTime?: string;
  checkOutTime?: string;
  workDurationStr?: string;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyCheckOut?: boolean;
  earlyCheckOutMinutes?: number;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES_HEADER = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const getNationalHolidays = (year: number): Record<string, string> => ({
  [`${year}-01-01`]: 'Tahun Baru Masehi',
  [`${year}-01-29`]: 'Tahun Baru Imlek',
  [`${year}-03-20`]: 'Hari Raya Nyepi',
  [`${year}-03-21`]: 'Hari Raya Idul Fitri (Hari 1)',
  [`${year}-03-22`]: 'Hari Raya Idul Fitri (Hari 2)',
  [`${year}-04-03`]: 'Wafat Yesus Kristus',
  [`${year}-05-01`]: 'Hari Buruh Internasional',
  [`${year}-05-14`]: 'Kenaikan Yesus Kristus',
  [`${year}-05-31`]: 'Hari Raya Waisak',
  [`${year}-06-01`]: 'Hari Lahir Pancasila',
  [`${year}-06-27`]: 'Hari Raya Idul Adha',
  [`${year}-07-16`]: 'Tahun Baru Islam',
  [`${year}-08-17`]: 'Hari Kemerdekaan RI',
  [`${year}-09-25`]: 'Maulid Nabi Muhammad SAW',
  [`${year}-12-25`]: 'Hari Raya Natal'
});

export const AttendanceCalendarModal: React.FC<AttendanceCalendarModalProps> = ({
  isOpen,
  onClose,
  employee,
  attendances,
  approvals,
  projects,
  salaryRules,
  annualWorkCalendar: propCalendar,
  onNavigateToTab
}) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-indexed
  const [activeWorkCalendar, setActiveWorkCalendar] = useState<AnnualWorkCalendarConfig | null>(propCalendar || null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(todayStr);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HADIR' | 'ANOMALI' | 'ALPA' | 'LEAVE' | 'OFF'>('ALL');

  // Fetch HR Annual Work Calendar from backend if not passed in props
  useEffect(() => {
    if (propCalendar) {
      setActiveWorkCalendar(propCalendar);
      return;
    }
    let isMounted = true;
    api.getWorkCalendar(selectedYear)
      .then(res => {
        if (!isMounted) return;
        const cal = res?.calendar || res?.config;
        if (cal) setActiveWorkCalendar(cal);
      })
      .catch(err => {
        console.warn('[AttendanceCalendarModal] Failed fetching HR calendar:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedYear, propCalendar]);

  // Project and Schedule context
  const effectiveSchedule = useMemo(() => {
    return getEmployeeProjectSchedule(employee, projects, salaryRules.cutoffTime || '08:15');
  }, [employee, projects, salaryRules.cutoffTime]);

  const weeklyOffDays: number[] = useMemo(() => {
    return activeWorkCalendar?.weeklyOffDays || [0, 6]; // Default: Minggu (0) & Sabtu (6)
  }, [activeWorkCalendar]);

  const nationalHolidays = useMemo(() => {
    return getNationalHolidays(selectedYear);
  }, [selectedYear]);

  // Employee personal attendances & approvals
  const empAttendances = useMemo(() => {
    return attendances.filter(a => {
      const idMatch = a.employeeId === employee.id;
      const nikMatch = Boolean(employee.nik && a.employeeNik === employee.nik);
      const nameMatch = Boolean(a.employeeName && employee.name && a.employeeName.trim().toLowerCase() === employee.name.trim().toLowerCase());
      return idMatch || nikMatch || nameMatch;
    });
  }, [attendances, employee]);

  const empApprovals = useMemo(() => {
    return approvals.filter(a => {
      const idMatch = a.employeeId === employee.id;
      const nikMatch = Boolean(employee.nik && a.employeeNik === employee.nik);
      const nameMatch = Boolean(a.employeeName && employee.name && a.employeeName.trim().toLowerCase() === employee.name.trim().toLowerCase());
      return idMatch || nikMatch || nameMatch;
    });
  }, [approvals, employee]);

  // Calculate days for the selected month
  const calendarDays: CalendarDayItem[] = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth;

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Minggu
    // Convert to Monday = 0 format (0=Senin, 1=Selasa, ..., 6=Minggu)
    const mondayFirstCol = (firstDayIndex + 6) % 7;
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const result: CalendarDayItem[] = [];

    // Preceding blank cells
    for (let i = 0; i < mondayFirstCol; i++) {
      result.push({
        blank: true,
        key: `blank-${i}`,
        dateStr: '',
        dayNumber: 0,
        dayOfWeek: -1,
        dayName: '',
        isToday: false,
        isPast: false,
        isFuture: false,
        isWorkDay: false,
        isWeeklyOff: false,
        isNationalHoliday: false,
        status: 'MENDATANG',
        statusLabel: '',
        statusColor: 'slate'
      });
    }

    // Days in Month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.getDay();
      const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dayOfWeek];

      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;
      const isFuture = dateStr > todayStr;

      const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
      const holidayName = nationalHolidays[dateStr];
      const isNationalHoliday = Boolean(holidayName);
      const isWorkDay = !isWeeklyOff && !isNationalHoliday;

      // Find attendance record
      const att = empAttendances.find(a => (a.date || '').slice(0, 10) === dateStr);

      // Find approved leave/permit/sick request
      const approvedLeave = empApprovals.find(app => {
        if (app.status !== 'APPROVED') return false;
        const start = app.startDate?.slice(0, 10);
        const end = (app.endDate || app.startDate)?.slice(0, 10);
        return dateStr >= start && dateStr <= end;
      });

      // Parse check-in and check-out
      const hasIn = Boolean(att?.checkInTime && att.checkInTime.trim() !== '' && att.checkInTime !== '-');
      const hasOut = Boolean(
        att?.checkOutTime &&
        att.checkOutTime.trim() !== '' &&
        att.checkOutTime !== '-' &&
        att.checkOutTime.toLowerCase() !== 'belum pulang'
      );

      // Determine day status
      let status: DayAttendanceStatus = 'MENDATANG';
      let statusLabel = 'Mendatang';
      let statusColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'cyan' = 'slate';

      if (att) {
        if (hasIn && hasOut) {
          status = 'HADIR_LENGKAP';
          statusLabel = att.isLate ? `Hadir (Terlambat ${att.lateMinutes}m)` : 'Hadir Lengkap (Tepat Waktu)';
          statusColor = 'emerald';
        } else if (hasIn && !hasOut) {
          if (isToday) {
            status = 'SEDANG_BEKERJA';
            statusLabel = 'Sedang Bekerja (Belum Pulang)';
            statusColor = 'cyan';
          } else {
            status = 'LUPA_PULANG';
            statusLabel = '⚠️ Lupa Absen Pulang';
            statusColor = 'amber';
          }
        } else if (!hasIn && hasOut) {
          status = 'LUPA_MASUK';
          statusLabel = '⚠️ Lupa Absen Masuk';
          statusColor = 'amber';
        } else {
          status = isPast ? 'ALPA' : 'BELUM_PRESENSI';
          statusLabel = isPast ? '❌ Alpa / Tidak Hadir' : 'Belum Presensi';
          statusColor = isPast ? 'rose' : 'slate';
        }
      } else if (approvedLeave) {
        status = 'CUTI_IZIN';
        const leaveLabel = approvedLeave.leaveType === 'CUTI_SAKIT'
          ? 'Cuti Sakit'
          : approvedLeave.type === 'LEAVE'
          ? 'Cuti Kerja'
          : 'Izin Resmi';
        statusLabel = `📋 ${leaveLabel}`;
        statusColor = 'blue';
      } else if (!isWorkDay) {
        status = 'LIBUR';
        statusLabel = isNationalHoliday ? `🏖️ Libur: ${holidayName}` : '☕ Libur Mingguan (HR)';
        statusColor = 'slate';
      } else if (isPast) {
        status = 'ALPA';
        statusLabel = '❌ Alpa / Tidak Hadir';
        statusColor = 'rose';
      } else if (isToday) {
        status = 'BELUM_PRESENSI';
        statusLabel = 'Belum Melakukan Presensi Hari Ini';
        statusColor = 'slate';
      } else {
        status = 'MENDATANG';
        statusLabel = 'Hari Kerja Mendatang';
        statusColor = 'slate';
      }

      // Calculate work duration if both times exist
      let workDurationStr = undefined;
      if (att && hasIn && hasOut && att.checkInTime && att.checkOutTime) {
        const inMatch = att.checkInTime.match(/(\d{1,2}):(\d{2})/);
        const outMatch = att.checkOutTime.match(/(\d{1,2}):(\d{2})/);
        if (inMatch && outMatch) {
          const inMins = parseInt(inMatch[1], 10) * 60 + parseInt(inMatch[2], 10);
          const outMins = parseInt(outMatch[1], 10) * 60 + parseInt(outMatch[2], 10);
          const diff = outMins - inMins;
          if (diff > 0) {
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            workDurationStr = `${h}j ${m}m`;
          }
        }
      }

      result.push({
        blank: false,
        key: `day-${d}`,
        dateStr,
        dayNumber: d,
        dayOfWeek,
        dayName,
        isToday,
        isPast,
        isFuture,
        isWorkDay,
        isWeeklyOff,
        isNationalHoliday,
        holidayName,
        attendance: att,
        approvedLeave,
        status,
        statusLabel,
        statusColor,
        checkInTime: hasIn ? att?.checkInTime : undefined,
        checkOutTime: hasOut ? att?.checkOutTime : undefined,
        workDurationStr,
        isLate: att?.isLate,
        lateMinutes: att?.lateMinutes,
        isEarlyCheckOut: att?.isEarlyCheckOut,
        earlyCheckOutMinutes: att?.earlyCheckOutMinutes
      });
    }

    return result;
  }, [selectedYear, selectedMonth, weeklyOffDays, nationalHolidays, empAttendances, empApprovals, todayStr]);

  // Selected Day detailed inspection object
  const selectedDayItem = useMemo(() => {
    if (!selectedDateStr) return null;
    return calendarDays.find(d => !d.blank && d.dateStr === selectedDateStr) || null;
  }, [calendarDays, selectedDateStr]);

  // Monthly KPI Summary Counters
  const summary = useMemo(() => {
    let effectiveWorkDays = 0;
    let completePresentDays = 0;
    let forgotCheckOutDays = 0;
    let forgotCheckInDays = 0;
    let alphaDays = 0;
    let leaveDays = 0;
    let offDays = 0;
    let lateDays = 0;

    for (const d of calendarDays) {
      if (d.blank) continue;
      if (d.isWorkDay) effectiveWorkDays++;
      if (d.status === 'HADIR_LENGKAP') {
        completePresentDays++;
        if (d.isLate) lateDays++;
      } else if (d.status === 'LUPA_PULANG') {
        forgotCheckOutDays++;
        if (d.isLate) lateDays++;
      } else if (d.status === 'LUPA_MASUK') {
        forgotCheckInDays++;
      } else if (d.status === 'ALPA') {
        alphaDays++;
      } else if (d.status === 'CUTI_IZIN') {
        leaveDays++;
      } else if (d.status === 'LIBUR') {
        offDays++;
      } else if (d.status === 'SEDANG_BEKERJA') {
        completePresentDays++; // counting as present for today
        if (d.isLate) lateDays++;
      }
    }

    return {
      effectiveWorkDays,
      completePresentDays,
      forgotCheckOutDays,
      forgotCheckInDays,
      alphaDays,
      leaveDays,
      offDays,
      lateDays
    };
  }, [calendarDays]);

  // Filtered days based on user statusFilter
  const filteredDays = useMemo(() => {
    return calendarDays.filter(d => {
      if (d.blank) return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'HADIR') return d.status === 'HADIR_LENGKAP' || d.status === 'SEDANG_BEKERJA';
      if (statusFilter === 'ANOMALI') return d.status === 'LUPA_PULANG' || d.status === 'LUPA_MASUK';
      if (statusFilter === 'ALPA') return d.status === 'ALPA';
      if (statusFilter === 'LEAVE') return d.status === 'CUTI_IZIN';
      if (statusFilter === 'OFF') return d.status === 'LIBUR';
      return true;
    });
  }, [calendarDays, statusFilter]);

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setSelectedDateStr(todayStr);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 relative my-auto max-h-[94vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Kalender Presensi & Verifikasi Kehadiran Kerja
                </h2>
                <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {employee.name} ({employee.loginId || employee.id})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Jadwal HR: <b>{effectiveSchedule.checkInTime} - {effectiveSchedule.checkOutTime} WIB</b> (Cutoff <b>{effectiveSchedule.cutoffTime} WIB</b>)</span>
                <span>•</span>
                <span>Proyek: <b>{effectiveSchedule.projectName}</b></span>
                <span>•</span>
                <span>Hari Kerja: <b>{7 - weeklyOffDays.length} Hari/Minggu</b></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Tutup Kalender"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto custom-scrollbar flex-1 py-4 space-y-4">
          
          {/* Top Month Navigation & View Mode Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            {/* Month & Year Stepper */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer shadow-2xs focus:outline-none"
                >
                  {MONTH_NAMES_ID.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer shadow-2xs focus:outline-none"
                >
                  {[2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {(selectedYear !== now.getFullYear() || selectedMonth !== now.getMonth()) && (
                <button
                  onClick={handleResetToCurrentMonth}
                  className="px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  Bulan Ini
                </button>
              )}
            </div>

            {/* View Mode Toggle (Grid vs List) */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <div className="flex items-center p-0.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <button
                  onClick={() => setViewMode('GRID')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'GRID'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Kalender</span>
                </button>
                <button
                  onClick={() => setViewMode('LIST')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'LIST'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Daftar Log</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Hari Kerja HR */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-mono-code uppercase font-bold text-slate-500 block">
                Hari Kerja HR
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono-code mt-0.5">
                {summary.effectiveWorkDays} <span className="text-xs font-normal text-slate-500">Hari</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sesuai Kalender HR</span>
            </div>

            {/* Hadir Lengkap */}
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-code uppercase font-bold text-emerald-800 dark:text-emerald-300">
                  Hadir Lengkap
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono-code mt-0.5">
                {summary.completePresentDays} <span className="text-xs font-normal text-emerald-600">Hari</span>
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mt-0.5">
                {summary.lateDays > 0 ? `${summary.lateDays}x Terlambat` : '100% Tepat Waktu'}
              </span>
            </div>

            {/* Lupa Pulang */}
            <div className={`p-3 rounded-2xl border ${
              summary.forgotCheckOutDays > 0
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-code uppercase font-bold">
                  Lupa Pulang
                </span>
                <AlertTriangle className={`w-3.5 h-3.5 ${summary.forgotCheckOutDays > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-xl font-black font-mono-code mt-0.5">
                {summary.forgotCheckOutDays} <span className="text-xs font-normal">Hari</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">Hanya Absen Masuk</span>
            </div>

            {/* Lupa Masuk */}
            <div className={`p-3 rounded-2xl border ${
              summary.forgotCheckInDays > 0
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-code uppercase font-bold">
                  Lupa Masuk
                </span>
                <AlertTriangle className={`w-3.5 h-3.5 ${summary.forgotCheckInDays > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-xl font-black font-mono-code mt-0.5">
                {summary.forgotCheckInDays} <span className="text-xs font-normal">Hari</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">Hanya Absen Pulang</span>
            </div>

            {/* Alpa / Tidak Hadir */}
            <div className={`p-3 rounded-2xl border ${
              summary.alphaDays > 0
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700/60 text-rose-900 dark:text-rose-200'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-code uppercase font-bold">
                  Alpa / Absen
                </span>
                <XCircle className={`w-3.5 h-3.5 ${summary.alphaDays > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-xl font-black font-mono-code mt-0.5">
                {summary.alphaDays} <span className="text-xs font-normal">Hari</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">Tanpa Keterangan</span>
            </div>

            {/* Cuti / Izin */}
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-code uppercase font-bold text-blue-800 dark:text-blue-300">
                  Cuti / Izin
                </span>
                <Palmtree className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 dark:text-blue-400 font-mono-code mt-0.5">
                {summary.leaveDays} <span className="text-xs font-normal text-blue-600">Hari</span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">Disetujui HR</span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-bold text-[10.5px] uppercase font-mono-code mr-1">Filter:</span>
            {[
              { id: 'ALL', label: 'Semua Hari', count: calendarDays.filter(d => !d.blank).length },
              { id: 'HADIR', label: 'Hadir Lengkap', count: summary.completePresentDays },
              { id: 'ANOMALI', label: '⚠️ Lupa Pulang/Masuk', count: summary.forgotCheckOutDays + summary.forgotCheckInDays },
              { id: 'ALPA', label: '❌ Alpa', count: summary.alphaDays },
              { id: 'LEAVE', label: 'Cuti / Izin', count: summary.leaveDays },
              { id: 'OFF', label: 'Libur', count: summary.offDays }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Main Content Area: Grid or List View + Detail Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Calendar Grid / List (8 or 12 cols depending on selection) */}
            <div className="lg:col-span-8 space-y-2">
              {viewMode === 'GRID' ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                  {/* Day Names Header */}
                  <div className="grid grid-cols-7 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-center py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider font-mono-code">
                    {DAY_NAMES_HEADER.map((d, i) => (
                      <div key={d} className={i >= 5 ? 'text-rose-500 font-black' : ''}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days Matrix */}
                  <div className="grid grid-cols-7 gap-1 p-2 bg-slate-50/50 dark:bg-slate-900/50">
                    {calendarDays.map((d, idx) => {
                      if (d.blank) {
                        return (
                          <div
                            key={`blank-${idx}`}
                            className="h-20 sm:h-24 rounded-xl bg-transparent border border-transparent opacity-20"
                          />
                        );
                      }

                      const isSelected = selectedDateStr === d.dateStr;

                      // Cell background styling based on status
                      let cellBg = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';
                      let statusBadge = null;

                      if (d.status === 'HADIR_LENGKAP') {
                        cellBg = 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 hover:border-emerald-500';
                        statusBadge = (
                          <div className="text-[10px] font-mono-code space-y-0.5 mt-1">
                            <div className="text-emerald-700 dark:text-emerald-400 font-semibold truncate flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              <span>In: {d.checkInTime?.slice(0, 5)}</span>
                            </div>
                            <div className="text-emerald-700 dark:text-emerald-400 font-semibold truncate flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                              <span>Out: {d.checkOutTime?.slice(0, 5)}</span>
                            </div>
                          </div>
                        );
                      } else if (d.status === 'SEDANG_BEKERJA') {
                        cellBg = 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800 animate-pulse';
                        statusBadge = (
                          <div className="text-[10px] font-mono-code space-y-0.5 mt-1">
                            <div className="text-cyan-700 font-bold truncate">In: {d.checkInTime?.slice(0, 5)}</div>
                            <div className="text-cyan-600 text-[9px] font-semibold">Sedang Kerja</div>
                          </div>
                        );
                      } else if (d.status === 'LUPA_PULANG') {
                        cellBg = 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700 hover:border-amber-500';
                        statusBadge = (
                          <div className="text-[9.5px] font-mono-code space-y-0.5 mt-1 text-amber-800 dark:text-amber-300">
                            <div className="font-semibold">In: {d.checkInTime?.slice(0, 5)}</div>
                            <div className="font-black text-rose-600 flex items-center gap-0.5">
                              <span>⚠️ Lupa Out</span>
                            </div>
                          </div>
                        );
                      } else if (d.status === 'LUPA_MASUK') {
                        cellBg = 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700 hover:border-amber-500';
                        statusBadge = (
                          <div className="text-[9.5px] font-mono-code space-y-0.5 mt-1 text-amber-800 dark:text-amber-300">
                            <div className="font-black text-rose-600 flex items-center gap-0.5">
                              <span>⚠️ Lupa In</span>
                            </div>
                            <div className="font-semibold">Out: {d.checkOutTime?.slice(0, 5)}</div>
                          </div>
                        );
                      } else if (d.status === 'ALPA') {
                        cellBg = 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 hover:border-rose-500';
                        statusBadge = (
                          <div className="mt-1">
                            <span className="text-[9.5px] font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded font-mono-code block text-center">
                              ❌ ALPA
                            </span>
                          </div>
                        );
                      } else if (d.status === 'CUTI_IZIN') {
                        cellBg = 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800';
                        statusBadge = (
                          <div className="mt-1">
                            <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 truncate block">
                              🌴 {d.approvedLeave?.leaveType === 'CUTI_SAKIT' ? 'Sakit' : 'Cuti'}
                            </span>
                          </div>
                        );
                      } else if (d.status === 'LIBUR') {
                        cellBg = 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70';
                        statusBadge = (
                          <div className="mt-1">
                            <span className="text-[9px] text-slate-400 font-mono-code truncate block">
                              {d.isNationalHoliday ? '🏖️ Libur' : 'Off'}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={d.key}
                          onClick={() => setSelectedDateStr(d.dateStr)}
                          className={`h-20 sm:h-24 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none relative ${cellBg} ${
                            isSelected ? 'ring-2 ring-[#FF6B00] shadow-md scale-[1.02] z-10' : ''
                          }`}
                        >
                          {/* Date Number Header */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-mono-code font-bold ${
                              d.isToday
                                ? 'w-5 h-5 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-black shadow-xs'
                                : d.dayOfWeek === 0 || d.dayOfWeek === 6
                                ? 'text-rose-500'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {d.dayNumber}
                            </span>

                            {d.isToday && (
                              <span className="text-[8px] font-bold uppercase text-[#FF6B00] font-mono-code">
                                Hari Ini
                              </span>
                            )}
                          </div>

                          {/* Status Pill Badge */}
                          <div className="flex-1 flex flex-col justify-center">
                            {statusBadge}
                          </div>

                          {/* Footer mini info */}
                          {d.workDurationStr && (
                            <div className="text-[8.5px] font-mono-code text-slate-400 text-right">
                              {d.workDurationStr}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* List View / Chronological Table */
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10.5px] font-mono-code uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Tanggal & Hari</th>
                          <th className="py-2.5 px-3">Status Kehadiran</th>
                          <th className="py-2.5 px-3">Jam Masuk</th>
                          <th className="py-2.5 px-3">Jam Pulang</th>
                          <th className="py-2.5 px-3">Durasi</th>
                          <th className="py-2.5 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredDays.map(d => {
                          const isSelected = selectedDateStr === d.dateStr;
                          return (
                            <tr
                              key={d.key}
                              onClick={() => setSelectedDateStr(d.dateStr)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-orange-50/60 dark:bg-orange-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-2 px-3 whitespace-nowrap font-mono-code">
                                <span className="font-bold text-slate-900 dark:text-white">{d.dateStr}</span>
                                <span className="text-slate-400 text-[10px] block">{d.dayName}</span>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono-code ${
                                  d.statusColor === 'emerald'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : d.statusColor === 'amber'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : d.statusColor === 'rose'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : d.statusColor === 'blue'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {d.statusLabel}
                                </span>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap font-mono-code">
                                {d.checkInTime ? (
                                  <span className={d.isLate ? 'text-amber-600 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                                    {d.checkInTime}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">- Kosong -</span>
                                )}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap font-mono-code">
                                {d.checkOutTime ? (
                                  <span className={d.isEarlyCheckOut ? 'text-amber-600 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                                    {d.checkOutTime}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">- Kosong -</span>
                                )}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap font-mono-code text-slate-600 dark:text-slate-400">
                                {d.workDurationStr || '-'}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDateStr(d.dateStr);
                                  }}
                                  className="text-[11px] font-bold text-[#FF6B00] hover:underline"
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Legend Bar */}
              <div className="flex items-center gap-3 flex-wrap text-[11px] p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <span className="font-bold font-mono-code uppercase text-[10px] text-slate-400">Keterangan:</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Hadir Lengkap
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Lupa Pulang/Masuk
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Alpa (Tidak Hadir)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Cuti / Izin
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Libur Mingguan/HR
                </span>
              </div>
            </div>

            {/* Selected Date Detail Inspector (Side Panel 4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              {selectedDayItem ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5 sticky top-0">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-mono-code uppercase font-bold text-slate-400 block">
                        Detail Verifikasi Tanggal
                      </span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white font-mono-code">
                        {selectedDayItem.dayName}, {selectedDayItem.dateStr}
                      </h3>
                    </div>
                    {selectedDayItem.isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] text-[10px] font-black uppercase font-mono-code">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  {/* Status Banner */}
                  <div className={`p-3 rounded-xl border ${
                    selectedDayItem.statusColor === 'emerald'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : selectedDayItem.statusColor === 'amber'
                      ? 'bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200'
                      : selectedDayItem.statusColor === 'rose'
                      ? 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200'
                      : selectedDayItem.statusColor === 'blue'
                      ? 'bg-blue-50 text-blue-950 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200'
                      : 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectedDayItem.statusColor === 'emerald' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {selectedDayItem.statusColor === 'amber' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                      {selectedDayItem.statusColor === 'rose' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      {selectedDayItem.statusColor === 'blue' && <Palmtree className="w-4 h-4 text-blue-600 shrink-0" />}
                      {selectedDayItem.statusColor === 'slate' && <Coffee className="w-4 h-4 text-slate-500 shrink-0" />}
                      <span className="text-xs font-bold font-mono-code">
                        {selectedDayItem.statusLabel}
                      </span>
                    </div>

                    {selectedDayItem.isWorkDay ? (
                      <span className="text-[10px] opacity-80 block mt-1">
                        Hari ini terdaftar sebagai <b>Hari Kerja Resmi HR</b>.
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-80 block mt-1">
                        Hari ini adalah <b>Hari Libur Operasional</b> (tidak wajib hadir).
                      </span>
                    )}
                  </div>

                  {/* Absen Masuk Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono-code uppercase font-bold">
                      <span>Absen Masuk (Check-In)</span>
                      <span>Target: {effectiveSchedule.checkInTime} WIB</span>
                    </div>
                    {selectedDayItem.checkInTime ? (
                      <div>
                        <div className="text-base font-black font-mono-code text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{selectedDayItem.checkInTime}</span>
                          {selectedDayItem.isLate ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                              Terlambat {selectedDayItem.lateMinutes}m
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              Tepat Waktu
                            </span>
                          )}
                        </div>
                        {selectedDayItem.attendance?.location?.address && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                            <MapPin className="w-3 h-3 text-[#FF6B00] shrink-0" />
                            <span className="truncate">{selectedDayItem.attendance.location.address}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="py-1 text-slate-400 italic text-xs">
                        Tidak ada rekaman Absen Masuk.
                      </div>
                    )}
                  </div>

                  {/* Absen Pulang Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono-code uppercase font-bold">
                      <span>Absen Pulang (Check-Out)</span>
                      <span>Jadwal: {effectiveSchedule.checkOutTime} WIB</span>
                    </div>
                    {selectedDayItem.checkOutTime ? (
                      <div>
                        <div className="text-base font-black font-mono-code text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{selectedDayItem.checkOutTime}</span>
                          {selectedDayItem.isEarlyCheckOut ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                              Pulang Awal {selectedDayItem.earlyCheckOutMinutes}m
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              Normal
                            </span>
                          )}
                        </div>
                        {selectedDayItem.workDurationStr && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-mono-code font-semibold">
                            Total Jam Kerja: <b>{selectedDayItem.workDurationStr}</b>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="py-1 text-slate-400 italic text-xs">
                        {selectedDayItem.status === 'LUPA_PULANG' ? (
                          <span className="text-amber-600 font-bold">⚠️ Belum melakukan Absen Pulang (Lupa Pulang).</span>
                        ) : selectedDayItem.isToday ? (
                          <span className="text-cyan-600 font-bold">Sedang bekerja / belum jam pulang.</span>
                        ) : (
                          'Tidak ada rekaman Absen Pulang.'
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Button: Correction / Adjustment */}
                  {(selectedDayItem.status === 'LUPA_PULANG' ||
                    selectedDayItem.status === 'LUPA_MASUK' ||
                    selectedDayItem.status === 'ALPA') && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-900 dark:text-amber-300 text-[11px]">
                        <b>⚠️ Butuh Koreksi Absensi?</b>
                        <p className="text-[10.5px] mt-0.5 opacity-90 leading-tight">
                          Jika Anda sebenarnya hadir atau lupa menekan tombol kamera, ajukan tiket Koreksi Absensi Mandiri untuk tanggal ini agar tidak memotong payroll.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          if (onNavigateToTab) {
                            onNavigateToTab('approvals', 'new-correction');
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ajukan Koreksi Absen ({selectedDayItem.dateStr})</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
                  Pilih salah satu tanggal di kalender untuk melihat detail jam masuk dan pulang.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-mono-code text-[11px]">
            Prime HRIS Enterprise • Sinkronisasi Kalender Kerja HR & Telemetri Biometrik
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
