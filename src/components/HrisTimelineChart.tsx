import { createPortal } from 'react-dom';
import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MapPin,
  Briefcase,
  Sparkles,
  Info,
  X,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { Employee, AttendanceRecord, ApprovalItem, Project, SalaryRuleConfig } from '../types';
import { getEmployeeProjectSchedule, parseTimeToDecimal, EffectiveSchedule } from '../utils/scheduleHelper';

interface HrisTimelineChartProps {
  employees: Employee[];
  projects?: Project[];
  salaryRules?: SalaryRuleConfig;
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  onNavigateToTab: (tabId: string) => void;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export const HrisTimelineChart: React.FC<HrisTimelineChartProps> = ({
  employees,
  projects = [],
  salaryRules,
  attendances,
  approvals,
  onNavigateToTab,
  selectedDate,
  onDateChange
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ON_TIME' | 'LATE' | 'DINAS_LUAR'>('ALL');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [activeShiftFilter, setActiveShiftFilter] = useState<'ALL' | 'PAGI' | 'LEMBUR'>('ALL');

  // Today date string in local timezone (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [internalDate, setInternalDate] = useState<string>(todayStr);
  const activeDate = selectedDate || internalDate;

  const handleDateChange = (date: string) => {
    if (onDateChange) {
      onDateChange(date);
    } else {
      setInternalDate(date);
    }
  };

  const handlePrevDay = () => {
    const d = new Date(activeDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    handleDateChange(`${yyyy}-${mm}-${dd}`);
  };

  const handleNextDay = () => {
    const d = new Date(activeDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    handleDateChange(`${yyyy}-${mm}-${dd}`);
  };

  const isToday = activeDate === todayStr;

  const formattedDateDisplay = useMemo(() => {
    try {
      const d = new Date(activeDate + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return activeDate;
    }
  }, [activeDate]);

  // Timeline hours from 06:00 to 20:00 (14 hours)
  const startHour = 6;
  const endHour = 20;
  const totalHours = endHour - startHour;

  // Hourly slots array
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  // Active selected project schedule (if filtered to a specific project)
  const activeSelectedSched = useMemo(() => {
    if (selectedProjectId === 'ALL') return null;
    return getEmployeeProjectSchedule({ assignedProjectId: selectedProjectId } as any, projects, salaryRules?.cutoffTime || '08:30');
  }, [selectedProjectId, projects, salaryRules]);

  // Map employee with their attendance status strictly for activeDate and their project schedule
  const employeeTimelineData = useMemo(() => {
    return employees.map(emp => {
      const att = attendances.find(a => a.employeeId === emp.id && a.date === activeDate);
      const decTime = att ? parseTimeToDecimal(att.checkInTime) : null;
      const approval = approvals.find(ap => ap.employeeId === emp.id && ap.status === 'PENDING');
      const schedule = getEmployeeProjectSchedule(emp, projects, salaryRules?.cutoffTime || '08:30');
      
      let status: 'ON_TIME' | 'LATE' | 'DINAS_LUAR' | 'ABSENT' = 'ABSENT';
      if (att) {
        if (att.mode === 'DINAS_LUAR') {
          status = 'DINAS_LUAR';
        } else if (decTime !== null) {
          // Dynamic evaluation against specific project cutoff
          status = decTime > schedule.cutoffDecimal ? 'LATE' : 'ON_TIME';
        } else {
          status = att.isLate ? 'LATE' : 'ON_TIME';
        }
      }

      return {
        employee: emp,
        attendance: att,
        decimalTime: decTime,
        status,
        approval,
        schedule
      };
    });
  }, [employees, attendances, approvals, activeDate, projects, salaryRules]);

  // Filtered list with Project and Shift filters (Karyawan yang sudah presensi otomatis tampil di atas berurutan)
  const filteredData = useMemo(() => {
    const list = employeeTimelineData.filter(item => {
      if (selectedProjectId !== 'ALL') {
        const pMatch = item.schedule.projectId === selectedProjectId || 
                       item.employee.assignedProjectId === selectedProjectId ||
                       item.schedule.projectCode === selectedProjectId ||
                       item.employee.assignedProjectId?.replace(/^DMJ-/i, 'PRIME-') === selectedProjectId?.replace(/^DMJ-/i, 'PRIME-');
        if (!pMatch) return false;
      }
      if (selectedFilter !== 'ALL' && item.status !== selectedFilter) return false;
      if (activeShiftFilter === 'PAGI' && item.decimalTime && item.decimalTime >= 15) return false;
      if (activeShiftFilter === 'LEMBUR' && item.decimalTime && item.decimalTime < 15) return false;
      return true;
    });

    return list.sort((a, b) => {
      const aHasAtt = Boolean(a.attendance && a.attendance.checkInTime);
      const bHasAtt = Boolean(b.attendance && b.attendance.checkInTime);

      // 1. Karyawan yang sudah presensi selalu tampil di atas
      if (aHasAtt && !bHasAtt) return -1;
      if (!aHasAtt && bHasAtt) return 1;

      // 2. Jika keduanya sudah presensi, urutkan berdasarkan waktu kedatangan (earliest check-in first)
      if (aHasAtt && bHasAtt) {
        const aTime = a.decimalTime ?? (parseTimeToDecimal(a.attendance?.checkInTime) ?? 999);
        const bTime = b.decimalTime ?? (parseTimeToDecimal(b.attendance?.checkInTime) ?? 999);
        if (aTime !== bTime) return aTime - bTime;
      }

      // 3. Fallback: urutkan alfabetis nama
      return a.employee.name.localeCompare(b.employee.name);
    });
  }, [employeeTimelineData, selectedProjectId, selectedFilter, activeShiftFilter]);

  // Punctuality stats
  const onTimeCount = employeeTimelineData.filter(d => d.status === 'ON_TIME').length;
  const lateCount = employeeTimelineData.filter(d => d.status === 'LATE').length;
  const dinasLuarCount = employeeTimelineData.filter(d => d.status === 'DINAS_LUAR').length;
  const totalPresent = onTimeCount + lateCount + dinasLuarCount;
  const punctualityRate = totalPresent > 0 ? Math.round((onTimeCount / totalPresent) * 100) : null;

  // Real average check-in time for activeDate
  const avgCheckInDisplay = useMemo(() => {
    const presentItems = employeeTimelineData.filter(d => d.decimalTime !== null);
    if (presentItems.length === 0) return null;
    const sum = presentItems.reduce((acc, d) => acc + (d.decimalTime || 0), 0);
    const avg = sum / presentItems.length;
    const hoursVal = Math.floor(avg);
    const minutesVal = Math.round((avg - hoursVal) * 60);
    return `${String(hoursVal).padStart(2, '0')}:${String(minutesVal).padStart(2, '0')} WIB`;
  }, [employeeTimelineData]);

  // Calculate position percentage on timeline
  const getPositionPercent = (decHour: number) => {
    const clamped = Math.max(startHour, Math.min(endHour, decHour));
    return ((clamped - startHour) / totalHours) * 100;
  };

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-md space-y-5 motion-fade-in-up w-full max-w-full min-w-0 overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-2 rounded-xl bg-orange-50 text-[#FF6B00] shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Timeline Presensi {isToday ? 'Hari Ini' : ''}
              </h2>
              {isToday ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono-code">
                  Hari Ini
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold font-mono-code">
                  {formattedDateDisplay}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Monitoring kedatangan & aktivitas shift karyawan • <span className="font-semibold text-slate-700">{formattedDateDisplay}</span>
            </p>
          </div>
        </div>

        {/* Controls: Date Picker + Filter Pills (Strictly Single Row) */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar shrink-0 py-0.5">
          
          {/* 1. Interactive Date Filter Control Bar */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0">
            <button
              onClick={handlePrevDay}
              title="Hari Sebelumnya (Kemarin)"
              className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer text-xs"
            >
              ◀
            </button>

            <div className="relative flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white text-slate-800 border border-slate-200/60 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <input
                type="date"
                value={activeDate}
                onChange={e => e.target.value && handleDateChange(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer font-mono-code"
              />
            </div>

            <button
              onClick={handleNextDay}
              title="Hari Berikutnya (Besok)"
              className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer text-xs"
            >
              ▶
            </button>

            {!isToday && (
              <button
                onClick={() => handleDateChange(todayStr)}
                title="Kembali ke Hari Ini"
                className="px-2 py-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold shadow-xs transition-all cursor-pointer"
              >
                Hari Ini
              </button>
            )}
          </div>

          {/* 2. Project Site Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-xs shrink-0 max-w-[200px] sm:max-w-[230px]">
            <Briefcase className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer pr-1 text-xs truncate w-full"
            >
              <option value="ALL">Semua Proyek ({employees.length})</option>
              {projects.map(p => {
                const pSched = getEmployeeProjectSchedule({ assignedProjectId: p.id } as any, [p]);
                const count = employeeTimelineData.filter(d => 
                  d.schedule.projectId === p.id || 
                  d.employee.assignedProjectId === p.id ||
                  d.employee.assignedProjectId?.replace(/^DMJ-/i, 'PRIME-') === p.id.replace(/^DMJ-/i, 'PRIME-')
                ).length;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name.length > 22 ? p.name.slice(0, 22) + '...' : p.name} ({count} org)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Compact Status Icon Filter Bar (Tidy & In-line) */}
          <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/70 shadow-2xs shrink-0">
            {/* 1. Semua Karyawan */}
            <button
              onClick={() => setSelectedFilter('ALL')}
              title={`Semua Karyawan: ${employees.length} orang`}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                selectedFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className={`text-[10px] font-mono-code px-1.5 py-0.2 rounded-full font-bold ${
                selectedFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}>
                {employees.length}
              </span>
            </button>

            {/* 2. Tepat Waktu */}
            <button
              onClick={() => setSelectedFilter('ON_TIME')}
              title={`Tepat Waktu: ${onTimeCount} karyawan`}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                selectedFilter === 'ON_TIME'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50/80'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className={`text-[10px] font-mono-code px-1.5 py-0.2 rounded-full font-bold ${
                selectedFilter === 'ON_TIME'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {onTimeCount}
              </span>
            </button>

            {/* 3. Terlambat */}
            <button
              onClick={() => setSelectedFilter('LATE')}
              title={`Terlambat: ${lateCount} karyawan`}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                selectedFilter === 'LATE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50/80'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className={`text-[10px] font-mono-code px-1.5 py-0.2 rounded-full font-bold ${
                selectedFilter === 'LATE'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {lateCount}
              </span>
            </button>

            {/* 4. Dinas Luar */}
            <button
              onClick={() => setSelectedFilter('DINAS_LUAR')}
              title={`Dinas Luar: ${dinasLuarCount} karyawan`}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                selectedFilter === 'DINAS_LUAR'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 hover:bg-blue-50/80'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className={`text-[10px] font-mono-code px-1.5 py-0.2 rounded-full font-bold ${
                selectedFilter === 'DINAS_LUAR'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {dinasLuarCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Mini Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3 rounded-2xl border transition-all ${
          punctualityRate !== null
            ? 'bg-emerald-50/60 border-emerald-200/50'
            : 'bg-slate-50/80 border-slate-200/60'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider font-mono-code block ${
            punctualityRate !== null ? 'text-emerald-800' : 'text-slate-500'
          }`}>
            Kedisiplinan
          </span>
          <div className={`text-lg font-black font-mono-code mt-0.5 ${
            punctualityRate !== null ? 'text-emerald-900' : 'text-slate-400'
          }`}>
            {punctualityRate !== null ? `${punctualityRate}%` : '-'}
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-0.5">
            {punctualityRate !== null ? `${onTimeCount} tepat waktu` : 'Belum ada kehadiran'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-orange-50/60 border border-orange-200/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B00] font-mono-code block">
            Puncak Masuk
          </span>
          <div className="text-lg font-black text-slate-900 font-mono-code mt-0.5">
            07:45 – 08:15
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-0.5">
            Rentang kedatangan utama
          </span>
        </div>

        <div className={`p-3 rounded-2xl border transition-all ${
          avgCheckInDisplay
            ? 'bg-blue-50/60 border-blue-200/50'
            : 'bg-slate-50/80 border-slate-200/60'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider font-mono-code block ${
            avgCheckInDisplay ? 'text-blue-800' : 'text-slate-500'
          }`}>
            Rata-rata Check-In
          </span>
          <div className={`text-lg font-black font-mono-code mt-0.5 ${
            avgCheckInDisplay ? 'text-blue-900' : 'text-slate-400'
          }`}>
            {avgCheckInDisplay || '-'}
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-0.5">
            {avgCheckInDisplay ? `${totalPresent} presensi tercatat` : 'Belum ada check-in'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 font-mono-code block">
              Batas Cutoff
            </span>
            <span className={`text-[9px] font-mono-code font-bold px-1.5 py-0.2 rounded-full ${
              activeSelectedSched ? 'bg-rose-200 text-rose-950 font-black' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {activeSelectedSched ? activeSelectedSched.projectCode : 'Otomatis Site'}
            </span>
          </div>
          <div className="text-lg font-black text-rose-600 font-mono-code mt-0.5">
            {activeSelectedSched ? `${activeSelectedSched.cutoffTime} WIB` : '06:40 – 08:30 WIB'}
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-medium">
            {activeSelectedSched 
              ? `Masuk: ${activeSelectedSched.checkInTime} (Toleransi ${activeSelectedSched.lateGraceMinutes}m)` 
              : 'Mengikuti jam shift masing-masing proyek'}
          </span>
        </div>
      </div>

      {/* Interactive Timeline Canvas / Swimlane */}
      <div className="relative pt-5 pb-4 bg-slate-900/5 rounded-3xl p-4 sm:p-5 border border-slate-200 overflow-x-auto">
        
        {/* Timeline Horizontal Axis with Zones */}
        <div className="min-w-[680px]">
          {/* Shift Zones Background Banner */}
          <div className="relative h-8 rounded-xl overflow-hidden mb-3 border border-slate-200/80 bg-white flex text-[10.5px] font-mono-code font-bold shadow-2xs">
            {activeSelectedSched ? (
              <>
                {/* Early / Prep Zone */}
                <div
                  style={{ width: `${Math.max(4, ((activeSelectedSched.startDecimal - 6) / totalHours) * 100)}%` }}
                  className="bg-slate-100 text-slate-500 flex items-center justify-center border-r border-slate-200 truncate px-1.5 whitespace-nowrap"
                  title={`06:00 - ${activeSelectedSched.checkInTime}: Persiapan Site`}
                >
                  06:00 - {activeSelectedSched.checkInTime}
                </div>

                {/* On-Time Zone */}
                <div
                  style={{ width: `${Math.max(6, ((activeSelectedSched.cutoffDecimal - activeSelectedSched.startDecimal) / totalHours) * 100)}%` }}
                  className="bg-emerald-100/90 text-emerald-800 flex items-center justify-center border-r-2 border-dashed border-rose-400 relative px-1.5 whitespace-nowrap"
                  title={`${activeSelectedSched.checkInTime} - ${activeSelectedSched.cutoffTime}: Tepat Waktu (Site ${activeSelectedSched.projectCode})`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="truncate">Tepat Waktu</span>
                  </span>
                </div>

                {/* Late Zone */}
                <div
                  style={{ width: `${Math.max(5, ((12 - activeSelectedSched.cutoffDecimal) / totalHours) * 100)}%` }}
                  className="bg-rose-50/80 text-rose-700 flex items-center justify-center border-r border-slate-200 truncate px-1.5 whitespace-nowrap"
                  title={`${activeSelectedSched.cutoffTime}+: Terlambat`}
                >
                  Terlambat ({activeSelectedSched.cutoffTime}+)
                </div>

                {/* Lunch: 12:00 - 13:00 */}
                <div
                  style={{ width: `${(1 / totalHours) * 100}%` }}
                  className="bg-amber-100/80 text-amber-800 flex items-center justify-center border-r border-slate-200 truncate px-1 whitespace-nowrap"
                  title="12:00 - 13:00: Istirahat Site"
                >
                  Istirahat
                </div>

                {/* Regular Shift Work */}
                <div
                  style={{ width: `${Math.max(5, ((activeSelectedSched.endDecimal - 13) / totalHours) * 100)}%` }}
                  className="bg-slate-50 text-slate-600 flex items-center justify-center border-r border-slate-200 truncate px-1.5 whitespace-nowrap"
                  title={`13:00 - ${activeSelectedSched.checkOutTime}: Jam Reguler Site`}
                >
                  Reguler s/d {activeSelectedSched.checkOutTime}
                </div>

                {/* Overtime Zone */}
                <div
                  style={{ width: `${Math.max(5, ((20 - activeSelectedSched.endDecimal) / totalHours) * 100)}%` }}
                  className="bg-orange-100/90 text-[#FF6B00] flex items-center justify-center font-black truncate px-1.5 whitespace-nowrap gap-1"
                  title={`${activeSelectedSched.checkOutTime} - 20:00: Lembur Site`}
                >
                  <Zap className="w-3 h-3 text-[#FF6B00] inline-block shrink-0 fill-amber-400" />
                  <span>Lembur ({activeSelectedSched.checkOutTime}+)</span>
                </div>
              </>
            ) : (
              <>
                {/* Early / Prep Zone */}
                <div
                  style={{ width: `${((7 - 6) / totalHours) * 100}%` }}
                  className="bg-slate-100 text-slate-500 flex items-center justify-center border-r border-slate-200 truncate px-1.5 whitespace-nowrap"
                  title="06:00 - 07:00: Persiapan Shift Awal"
                >
                  06:00 - 07:00
                </div>

                {/* On-Time Multi-Site Zone: 06:30 - 08:30 */}
                <div
                  style={{ width: `${((8.5 - 7) / totalHours) * 100}%` }}
                  className="bg-emerald-100/90 text-emerald-800 flex items-center justify-center border-r-2 border-dashed border-rose-400 relative px-1.5 whitespace-nowrap"
                  title="Rentang Tepat Waktu: 06:30 - 08:30 WIB (Sesuai Shift Tiap Proyek)"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="truncate">Tepat Waktu</span>
                  </span>
                </div>

                {/* Late Zone */}
                <div
                  style={{ width: `${((12 - 8.5) / totalHours) * 100}%` }}
                  className="bg-rose-50/80 text-rose-700 flex items-center justify-center border-r border-slate-200 truncate px-1.5 whitespace-nowrap"
                  title="Lewat batas toleransi proyek: Terlambat"
                >
                  Terlambat
                </div>

                {/* Lunch: 12:00 - 13:00 */}
                <div
                  style={{ width: `${(1 / totalHours) * 100}%` }}
                  className="bg-amber-100/80 text-amber-800 flex items-center justify-center border-r border-slate-200 truncate px-1 whitespace-nowrap"
                  title="12:00 - 13:00: Istirahat"
                >
                  Istirahat
                </div>

                {/* Normal Work: 13:00 - 16:30 */}
                <div
                  style={{ width: `${(3.5 / totalHours) * 100}%` }}
                  className="bg-slate-50 text-slate-600 flex items-center justify-center border-r border-slate-200 truncate px-1.5 whitespace-nowrap"
                  title="13:00 - 16:30: Reguler Site & Kantor"
                >
                  Reguler
                </div>

                {/* Overtime Zone: 16:30 - 20:00 */}
                <div
                  style={{ width: `${(3.5 / totalHours) * 100}%` }}
                  className="bg-orange-100/90 text-[#FF6B00] flex items-center justify-center font-black truncate px-1.5 whitespace-nowrap gap-1"
                  title="16:30 - 20:00: Lembur"
                >
                  <Zap className="w-3 h-3 text-[#FF6B00] inline-block shrink-0 fill-amber-400" />
                  <span>Lembur Site (16:30+)</span>
                </div>
              </>
            )}
          </div>

          {/* Time Ticks */}
          <div className="relative h-6 flex justify-between text-[11px] font-mono-code font-bold text-slate-400 select-none border-b border-slate-200 mb-6 pb-1">
            {hours.map(hr => (
              <div
                key={hr}
                onMouseEnter={() => setHoveredHour(hr)}
                onMouseLeave={() => setHoveredHour(null)}
                className={`flex flex-col items-center cursor-pointer transition-colors ${
                  hoveredHour === hr ? 'text-[#FF6B00] scale-110 font-black' : ''
                }`}
              >
                <span>{String(hr).padStart(2, '0')}:00</span>
                <span className="w-0.5 h-1.5 bg-slate-300 mt-0.5"></span>
              </div>
            ))}

            {/* Cutoff Indicator Pin (Positioned cleanly below ruler ticks to prevent collision with Shift Zones Banner) */}
            <div
              style={{ left: `${getPositionPercent(activeSelectedSched ? activeSelectedSched.cutoffDecimal : 8.5)}%` }}
              className="absolute top-5 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 transition-all duration-300"
            >
              <div className="w-0.5 h-1.5 bg-rose-500"></div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase font-mono-code shadow-xs whitespace-nowrap">
                {activeSelectedSched 
                  ? `Cutoff ${activeSelectedSched.cutoffTime} (${activeSelectedSched.projectCode})` 
                  : 'Cutoff Site 06:40 - 08:30'}
              </span>
            </div>
          </div>

          {/* Employee Swimlanes */}
          <div className="space-y-3 max-h-[390px] overflow-y-auto pr-1.5 custom-scrollbar">
            {filteredData.map((item, idx) => {
              const { employee, attendance, decimalTime, status } = item;
              const effectiveDecimal = decimalTime !== null ? decimalTime : (attendance?.checkInTime ? parseTimeToDecimal(attendance.checkInTime) : null);
              const hasCheckIn = Boolean(attendance && attendance.checkInTime);
              const position = effectiveDecimal !== null ? getPositionPercent(effectiveDecimal) : (hasCheckIn ? 5 : null);

              return (
                <div
                  key={employee.id}
                  style={{ animationDelay: `${(idx + 1) * 60}ms` }}
                  className="group relative bg-white/90 hover:bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex items-center gap-3"
                >
                  {/* Left: Employee Info */}
                  <div className="w-56 shrink-0 flex items-center gap-2.5">
                    <img
                      src={employee.avatar}
                      alt={employee.name}
                      className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                    />
                    <div className="min-w-0 flex-1 truncate">
                      <p className="text-xs font-black text-slate-900 truncate leading-tight group-hover:text-[#FF6B00] transition-colors">
                        {employee.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono-code mt-0.5">
                        <span className="font-bold text-[#0066FF] bg-blue-50 px-1 py-0.2 rounded border border-blue-200/60">
                          {employee.nik}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold truncate max-w-[130px] ${
                          item.schedule.isCustom 
                            ? 'bg-amber-50 text-amber-900 border border-amber-200/80' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`} title={`Jadwal Site: ${item.schedule.checkInTime} - ${item.schedule.checkOutTime} WIB (Batas Cutoff: ${item.schedule.cutoffTime})`}>
                          {item.schedule.isCustom ? `${item.schedule.projectCode} • ${item.schedule.checkInTime}` : 'Kantor 08:30'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Timeline Track */}
                  <div className="flex-1 relative h-10 bg-slate-50 rounded-xl border border-slate-200/60 overflow-hidden flex items-center px-2">
                    
                    {/* Shift Guide Grid lines */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-30">
                      {hours.map(h => (
                        <div key={h} className="w-px h-full bg-slate-300" />
                      ))}
                    </div>

                    {/* Dynamic Cutoff Vertical Line for THIS Employee */}
                    <div
                      style={{ left: `${getPositionPercent(item.schedule.cutoffDecimal)}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-400 border-l border-dashed border-rose-500 z-10 pointer-events-none group-hover:w-1 group-hover:bg-rose-500 transition-all"
                      title={`Batas Cutoff ${item.schedule.projectCode}: ${item.schedule.cutoffTime} WIB (Toleransi ${item.schedule.lateGraceMinutes}m)`}
                    >
                      <div className="hidden group-hover:block absolute -top-3 -translate-x-1/2 bg-rose-600 text-white text-[8px] font-mono-code font-black px-1 rounded-full whitespace-nowrap shadow-xs">
                        {item.schedule.cutoffTime}
                      </div>
                    </div>

                    {/* Check-In Marker Point */}
                    {hasCheckIn && position !== null && (
                      <div
                        style={{ left: `${position}%` }}
                        onClick={() => attendance && setSelectedRecord(attendance)}
                        className="absolute -translate-x-1/2 flex items-center gap-1.5 cursor-pointer z-20 group/pin"
                      >
                        {/* Interactive Pin Bubble */}
                        <div
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black font-mono-code text-white shadow-md flex items-center gap-1 transition-all group-hover/pin:scale-110 active:scale-95 ${
                            status === 'ON_TIME'
                              ? 'bg-emerald-600 ring-2 ring-emerald-300'
                              : status === 'LATE'
                              ? 'bg-rose-600 ring-2 ring-rose-300 animate-pulse'
                              : 'bg-blue-600 ring-2 ring-blue-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{attendance?.checkInTime}</span>
                        </div>

                        {/* Tag details on hover */}
                        <div className="hidden group-hover/pin:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-950 text-white rounded-xl p-2.5 text-[10px] font-medium shadow-xl whitespace-nowrap z-50 pointer-events-none">
                          <p className="font-bold text-[#FF6B00]">{employee.name} ({employee.nik})</p>
                          <p className="text-slate-300">Proyek: <span className="font-bold text-white">{item.schedule.projectName}</span></p>
                          <p>Masuk: <span className="font-bold">{attendance?.checkInTime} WIB</span> ({status === 'ON_TIME' ? 'Tepat Waktu' : status === 'LATE' ? `Terlambat (Batas: ${item.schedule.cutoffTime})` : status})</p>
                          <p className="text-slate-400">Jadwal Shift: {item.schedule.checkInTime} - {item.schedule.checkOutTime} WIB</p>
                          {typeof attendance?.location?.distanceMeters === 'number' && !isNaN(attendance.location.distanceMeters) && <p className="text-slate-400">Geofence: {attendance.location.distanceMeters}m</p>}
                        </div>
                      </div>
                    )}

                    {/* Active Work Span Bar (from check-in to end of regular shift or current time) */}
                    {hasCheckIn && position !== null && (
                      <div
                        style={{
                          left: `${position}%`,
                          width: `${Math.max(8, getPositionPercent(item.schedule.endDecimal) - position)}%`
                        }}
                        className={`h-2 rounded-full opacity-60 ${
                          status === 'ON_TIME'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : status === 'LATE'
                            ? 'bg-gradient-to-r from-rose-500 to-amber-400'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-400'
                        }`}
                        title={`Masuk: ${attendance?.checkInTime} WIB | Target Pulang: ${item.schedule.checkOutTime} WIB`}
                      />
                    )}

                    {!hasCheckIn && (
                      <span className="text-[10px] font-mono-code text-slate-400 italic mx-auto">
                        Belum melakukan presensi hari ini / Sedang cuti resmi
                      </span>
                    )}
                  </div>

                  {/* Far Right: Status Pill & Action */}
                  <div className="w-36 shrink-0 flex items-center justify-end gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono-code ${
                        status === 'ON_TIME'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'LATE'
                          ? 'bg-rose-100 text-rose-800'
                          : status === 'DINAS_LUAR'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {status === 'ON_TIME'
                        ? 'Tepat Waktu'
                        : status === 'LATE'
                        ? `Telat ${attendance?.lateMinutes}m`
                        : status === 'DINAS_LUAR'
                        ? 'Dinas Luar'
                        : 'Belum Masuk'}
                    </span>

                    {attendance && (
                      <button
                        onClick={() => setSelectedRecord(attendance)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#FF6B00] text-slate-600 hover:text-white transition-all cursor-pointer"
                        title="Lihat Detail Selfie & Verifikasi"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredData.length > 5 && (
            <div className="pt-2.5 text-center text-[11px] text-slate-400 font-mono-code flex items-center justify-center gap-1.5 select-none">
              <span>↕ Gulir ke bawah untuk melihat {filteredData.length - 5} karyawan lainnya</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail Rekaman Presensi (Portal to document.body for guaranteed viewport centering) */}
      {selectedRecord && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setSelectedRecord(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative modal-dialog-animate my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FF6B00] text-white text-[10px] font-black uppercase font-mono-code">
                DETAIL PRESENSI LIVE
              </span>
              <span className="text-xs font-mono-code text-slate-500">
                ID: {selectedRecord.id}
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4">
              <img
                src={selectedRecord.photoUrl}
                alt="Selfie Presensi"
                className="w-16 h-16 rounded-xl object-cover border-2 border-[#FF6B00] shadow-xs shrink-0"
              />
              <div>
                <h3 className="text-base font-black text-slate-900">{selectedRecord.employeeName}</h3>
                <p className="text-xs text-slate-500 font-mono-code">{selectedRecord.employeeNik ? selectedRecord.employeeNik.replace(/^DMJ-/i, 'PRIME-') : ''}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedRecord.department}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Waktu Presensi Kamera:</span>
                <span className="font-mono-code font-bold text-slate-900">
                  {selectedRecord.date} • {selectedRecord.checkInTime} WIB
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Status Validasi:</span>
                <span
                  className={`font-mono-code font-bold px-2 py-0.5 rounded-md ${
                    selectedRecord.isLate
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedRecord.isLate ? `Terlambat ${selectedRecord.lateMinutes} Menit` : 'Tepat Waktu (On-Time)'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Radius & Geofence:</span>
                <span className="font-mono-code font-semibold text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                  {typeof selectedRecord.location.distanceMeters === 'number' && !isNaN(selectedRecord.location.distanceMeters) ? `${selectedRecord.location.distanceMeters}m` : '0m'} ({selectedRecord.location.inGeofence ? 'Area Resmi Valid' : 'Di Luar Geofence'})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Geolokasi Terdeteksi:</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 text-right max-w-xs truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {selectedRecord.location.address}
                </span>
              </div>

              {selectedRecord.lateReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <span className="font-bold block text-[11px] uppercase font-mono-code">Alasan Keterlambatan:</span>
                  <p className="mt-0.5">{selectedRecord.lateReason}</p>
                </div>
              )}

              {selectedRecord.dinasLuarDetails && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                  <span className="font-bold block text-[11px] uppercase font-mono-code">Detail Penugasan Dinas:</span>
                  <p className="mt-0.5"><strong>Tujuan:</strong> {selectedRecord.dinasLuarDetails.destination}</p>
                  <p><strong>Proyek:</strong> {selectedRecord.dinasLuarDetails.projectCode}</p>
                  <p><strong>Keperluan:</strong> {selectedRecord.dinasLuarDetails.purpose}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  onNavigateToTab('approvals');
                }}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Buka di Pusat Approval</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
