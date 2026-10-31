import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  Sliders,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  DollarSign,
  Flag,
  Layers,
  Info,
  Check,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Employee, AnnualWorkCalendarConfig, WorkPeriodItem, SystemRole, getEffectiveSystemRole } from '../types';
import { api } from '../services/api';
import { rtcService } from '../services/rtcService';

interface AnnualWorkCalendarTabProps {
  currentUser?: Employee;
  onUpdateCalendar?: (cal: AnnualWorkCalendarConfig) => void;
}

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


const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const AnnualWorkCalendarTab: React.FC<AnnualWorkCalendarTabProps> = ({ currentUser, onUpdateCalendar }) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isHrOrAdmin = ['admin', 'superuser', 'hr'].includes(currentRole);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear() || 2026;
  });

  const nationalHolidays = useMemo(() => getNationalHolidays(selectedYear), [selectedYear]);

  // Dynamic flexible year options up to decades into the future
  const availableYears = useMemo(() => {
    const minYear = Math.min(2024, selectedYear - 2);
    const maxYear = Math.max(2045, selectedYear + 10);
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    if (!list.includes(selectedYear)) {
      list.push(selectedYear);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [selectedYear]);

  const [isManualYearInput, setIsManualYearInput] = useState<boolean>(false);
  const [manualYearInputVal, setManualYearInputVal] = useState<string>(String(selectedYear));
  const [calendarConfig, setCalendarConfig] = useState<AnnualWorkCalendarConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active visualized month (0 = Januari, ..., 11 = Desember)
  const [activeMonthIndex, setActiveMonthIndex] = useState<number>(() => {
    const currentMonth = new Date().getMonth();
    return currentMonth;
  });

  // Global settings state
  const [cutoffStartDay, setCutoffStartDay] = useState<number>(21);
  const [cutoffEndDay, setCutoffEndDay] = useState<number>(20);
  const [paydayDate, setPaydayDate] = useState<number>(25);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([0, 6]); // Default: Minggu (0) & Sabtu (6)

  // Load calendar config from API
  const fetchCalendar = async (year: number) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getWorkCalendar(year);
      const cal = res?.calendar || res?.config;
      if (cal) {
        setCalendarConfig(cal);
        setCutoffStartDay(cal.defaultCutoffStartDay || 21);
        setCutoffEndDay(cal.defaultCutoffEndDay || 20);
        setPaydayDate(cal.defaultPaydayDate || 25);
        setWeeklyOffDays(cal.weeklyOffDays || [0, 6]);
      }
    } catch (err: any) {
      console.error('[AnnualWorkCalendarTab] Error fetching calendar', err);
      setErrorMessage(err?.message || 'Gagal memuat konfigurasi kalender kerja tahunan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar(selectedYear);
  }, [selectedYear]);

  // Realtime subscription via rtcService
  useEffect(() => {
    const unsubscribeUpdated = rtcService.subscribe('WORK_CALENDAR_UPDATED', (packet) => {
      if (packet.payload) {
        setCalendarConfig(packet.payload);
        if (onUpdateCalendar) onUpdateCalendar(packet.payload);
      }
    });

    const unsubscribeToggled = rtcService.subscribe('WORK_CALENDAR_PERIOD_TOGGLED', (packet) => {
      const { periodId, isOpen } = packet.payload || {};
      if (periodId && calendarConfig) {
        setCalendarConfig((prev) => {
          if (!prev) return prev;
          const updatedPeriods = prev.periods.map((p) => {
            const currentId = p.periodId || (p as any).id;
            if (currentId === periodId) {
              return { ...p, attendanceOpen: isOpen, status: isOpen ? 'OPEN' : 'LOCKED' } as any;
            }
            return p;
          });
          return { ...prev, periods: updatedPeriods };
        });
      }
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeToggled();
    };
  }, [calendarConfig]);

  // Handle Weekly Off-Day Toggle
  const toggleWeeklyOffDay = (dayIndex: number) => {
    if (!isHrOrAdmin) return;
    setWeeklyOffDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  };

  // Preset Handlers
  const applyPreset = (preset: '5_DAYS' | '6_DAYS') => {
    if (!isHrOrAdmin) return;
    if (preset === '5_DAYS') {
      setWeeklyOffDays([0, 6]); // Sabtu & Minggu libur
    } else if (preset === '6_DAYS') {
      setWeeklyOffDays([0]); // Hanya Minggu libur
    }
  };

  // Re-generate all 12 periods based on current settings
  const handleApplyGlobalFormula = () => {
    if (!isHrOrAdmin) return;
    const year = selectedYear;
    const newPeriods: WorkPeriodItem[] = [];

    for (let m = 0; m < 12; m++) {
      const startYear = m === 0 ? year - 1 : year;
      const startMonth = m === 0 ? 12 : m;
      const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(cutoffStartDay).padStart(2, '0')}`;
      const endDateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(cutoffEndDay).padStart(2, '0')}`;
      const paydayStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(paydayDate).padStart(2, '0')}`;

      let effectiveWorkDays = 0;
      let weeklyOffDaysCount = 0;
      let holidaysCount = 0;

      const curr = new Date(`${startDateStr}T00:00:00`);
      const end = new Date(`${endDateStr}T00:00:00`);

      while (curr <= end) {
        const dayOfWeek = curr.getDay();
        const y = curr.getFullYear();
        const mo = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const curStr = `${y}-${mo}-${d}`;

        const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
        const isNationalHoliday = Boolean(nationalHolidays[curStr]);

        if (isWeeklyOff) {
          weeklyOffDaysCount++;
        } else if (isNationalHoliday) {
          holidaysCount++;
        } else {
          effectiveWorkDays++;
        }

        curr.setDate(curr.getDate() + 1);
      }

      const todayYMD = new Date().toISOString().substring(0, 10);
      const isPast = todayYMD > endDateStr;
      const existingPeriod = calendarConfig?.periods?.find((p) => p.monthIndex === m);

      newPeriods.push({
        periodId: existingPeriod?.periodId || `PERIOD-${year}-${String(m + 1).padStart(2, '0')}`,
        monthIndex: m,
        periodName: `Periode ${MONTH_NAMES[m]} ${year}`,
        startDate: startDateStr,
        endDate: endDateStr,
        paydayDate: paydayStr,
        attendanceOpen: existingPeriod !== undefined ? existingPeriod.attendanceOpen : (isPast ? false : true),
        payrollStatus: isPast ? 'PAID' : (existingPeriod?.payrollStatus || 'OPEN'),
        totalCalendarDays: effectiveWorkDays + weeklyOffDaysCount + holidaysCount,
        effectiveWorkDays,
        weeklyOffDaysCount,
        holidaysCount,
        notes: `Siklus Presensi & Penggajian ${MONTH_NAMES[m]} ${year}`
      });
    }

    const updatedConfig: AnnualWorkCalendarConfig = {
      id: `CALENDAR_${year}`,
      year,
      weeklyOffDays,
      defaultCutoffStartDay: cutoffStartDay,
      defaultCutoffEndDay: cutoffEndDay,
      defaultPaydayDate: paydayDate,
      periods: newPeriods,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'HR Administrator'
    };

    setCalendarConfig(updatedConfig);
    setSaveSuccessMessage('Formula cut-off berhasil dihitung dan diterapkan ke 12 periode. Klik "Simpan Konfigurasi" untuk menyimpan.');
    setTimeout(() => setSaveSuccessMessage(null), 5000);
  };

  // Toggle Attendance Open/Close per Period
  const handleToggleAttendance = async (periodId: string, currentStatus: boolean) => {
    if (!isHrOrAdmin) return;
    const nextStatus = !currentStatus;

    // Optimistic UI update
    if (calendarConfig) {
      const updatedPeriods = calendarConfig.periods.map((p) => {
        const id = p.periodId || (p as any).id;
        if (id === periodId) {
          return { ...p, attendanceOpen: nextStatus };
        }
        return p;
      });
      setCalendarConfig({ ...calendarConfig, periods: updatedPeriods });
    }

    try {
      await api.toggleWorkPeriodAttendance(periodId, nextStatus);
    } catch (err: any) {
      console.error('[AnnualWorkCalendarTab] Error toggling attendance', err);
      // Revert on error
      fetchCalendar(selectedYear);
    }
  };

  // Save Calendar Configuration to Backend
  const handleSaveConfig = async () => {
    if (!calendarConfig || !isHrOrAdmin) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      const configToSave: AnnualWorkCalendarConfig = {
        ...calendarConfig,
        year: selectedYear,
        weeklyOffDays,
        defaultCutoffStartDay: cutoffStartDay,
        defaultCutoffEndDay: cutoffEndDay,
        defaultPaydayDate: paydayDate,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || 'HR Administrator'
      };

      const res = await api.saveWorkCalendar(configToSave);
      const cal = res?.calendar || res?.config;
      if (cal) {
        setCalendarConfig(cal);
        if (onUpdateCalendar) onUpdateCalendar(cal);
        setSaveSuccessMessage('Konfigurasi kalender kerja tahunan dan periode cut-off berhasil disimpan.');
      } else {
        setSaveSuccessMessage('Pengaturan berhasil diperbarui secara live.');
      }
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('[AnnualWorkCalendarTab] Save error', err);
      setErrorMessage(err?.message || 'Gagal menyimpan konfigurasi kalender kerja.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calendar Visualizer calculations for active month
  const activePeriod = useMemo(() => {
    if (!calendarConfig || !calendarConfig.periods) return null;
    return calendarConfig.periods.find((p) => p.monthIndex === activeMonthIndex) || null;
  }, [calendarConfig, activeMonthIndex]);

  // Days matrix for the calendar month visualizer
  const calendarDaysMatrix = useMemo(() => {
    const year = selectedYear;
    const month = activeMonthIndex; // 0 to 11
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Blank cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ blank: true, key: `blank-${i}` });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();

      const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
      const holidayName = nationalHolidays[dateStr];
      const isNationalHoliday = Boolean(holidayName);

      // Check cut-off markers based on activePeriod
      const isCutoffStart = activePeriod?.startDate === dateStr;
      const isCutoffEnd = activePeriod?.endDate === dateStr;
      const isPayday = activePeriod?.paydayDate === dateStr;

      // In-range check
      let isInCurrentCutoff = false;
      if (activePeriod) {
        isInCurrentCutoff = dateStr >= activePeriod.startDate && dateStr <= activePeriod.endDate;
      }

      days.push({
        blank: false,
        dateNumber: d,
        dateStr,
        dayOfWeek,
        isWeeklyOff,
        isNationalHoliday,
        holidayName,
        isCutoffStart,
        isCutoffEnd,
        isPayday,
        isInCurrentCutoff
      });
    }

    return days;
  }, [selectedYear, activeMonthIndex, weeklyOffDays, activePeriod]);

  // Total working days in the entire year
  const totalAnnualStats = useMemo(() => {
    if (!calendarConfig || !calendarConfig.periods) return { effective: 0, off: 0, holidays: 0 };
    return calendarConfig.periods.reduce(
      (acc, p) => ({
        effective: acc.effective + (p.effectiveWorkDays || 0),
        off: acc.off + (p.weeklyOffDaysCount || 0),
        holidays: acc.holidays + (p.holidaysCount || 0)
      }),
      { effective: 0, off: 0, holidays: 0 }
    );
  }, [calendarConfig]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Kalender Kerja Tahunan & Siklus Cut-Off Penggajian
                </h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Realtime Sync Aktif
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Atur formula rentang kerja 1 tahun, hari libur mingguan (weekly off-days), hari libur nasional, dan kontrol buka/tutup presensi per periode penggajian.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 self-end lg:self-center">
            <button
              onClick={() => fetchCalendar(selectedYear)}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white bg-slate-800/80 transition-all flex items-center gap-2 text-sm cursor-pointer disabled:opacity-50"
              title="Segarkan data dari server"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {isHrOrAdmin && (
              <button
                onClick={handleSaveConfig}
                disabled={isSaving || isLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 text-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Success / Error Alerts */}
        {saveSuccessMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Global Formula & Weekly Off-Days Settings Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cut-off parameters and Weekly Off Config */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">Parameter Siklus Kerja & Cut-Off</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Tahun:</span>

              {isManualYearInput ? (
                <div className="flex items-center gap-1.5 bg-slate-800 border border-indigo-500 rounded-lg p-1 shadow-inner">
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={manualYearInputVal}
                    onChange={(e) => setManualYearInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const yr = parseInt(manualYearInputVal, 10);
                        if (!isNaN(yr) && yr >= 2000 && yr <= 2100) {
                          setSelectedYear(yr);
                          setIsManualYearInput(false);
                        }
                      } else if (e.key === 'Escape') {
                        setIsManualYearInput(false);
                      }
                    }}
                    placeholder="20xx"
                    className="w-16 bg-transparent text-white font-bold text-sm text-center focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const yr = parseInt(manualYearInputVal, 10);
                      if (!isNaN(yr) && yr >= 2000 && yr <= 2100) {
                        setSelectedYear(yr);
                      }
                      setIsManualYearInput(false);
                    }}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition cursor-pointer"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualYearInput(false)}
                    className="px-1.5 py-0.5 text-slate-400 hover:text-white text-xs transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedYear((prev) => Math.max(2000, prev - 1))}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                    title="Tahun Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setManualYearInputVal(String(selectedYear));
                        setIsManualYearInput(true);
                      } else {
                        setSelectedYear(Number(e.target.value));
                      }
                    }}
                    className="bg-transparent text-white font-bold text-xs px-1.5 py-1 focus:outline-none cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr} className="bg-slate-800 text-white font-medium">
                        {yr}
                      </option>
                    ))}
                    <option value="custom" className="bg-indigo-900 text-indigo-200 font-bold">
                      ✏️ Ketik Tahun Lain...
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSelectedYear((prev) => prev + 1)}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                    title="Tahun Berikutnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Off Days Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <span>Hari Libur Mingguan (Weekly Off-Days)</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {weeklyOffDays.length} Hari Libur
                </span>
              </label>

              {/* Presets */}
              {isHrOrAdmin && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => applyPreset('5_DAYS')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition cursor-pointer"
                  >
                    5 Hari Kerja (Sab-Min Libur)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('6_DAYS')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    6 Hari Kerja (Min Libur)
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Pilih hari-hari libur mingguan perusahaan. Tanggal yang bertepatan dengan hari ini otomatis dikecualikan dari hari kerja efektif.
            </p>

            <div className="grid grid-cols-7 gap-2">
              {DAY_NAMES.map((name, idx) => {
                const isSelected = weeklyOffDays.includes(idx);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleWeeklyOffDay(idx)}
                    disabled={!isHrOrAdmin}
                    className={`py-2.5 px-1 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm shadow-rose-950'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{name.substring(0, 3)}</span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                      isSelected ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-700/60 text-slate-400'
                    }`}>
                      {isSelected ? 'Libur' : 'Kerja'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cut-off Start, End, and Payday Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tanggal Buka Cut-Off (Bulan Sebelumnya)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cutoffStartDay}
                  onChange={(e) => setCutoffStartDay(Number(e.target.value))}
                  disabled={!isHrOrAdmin}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-indigo-500 text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">Tgl</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default: Tgl 21</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tanggal Tutup Cut-Off (Bulan Berjalan)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cutoffEndDay}
                  onChange={(e) => setCutoffEndDay(Number(e.target.value))}
                  disabled={!isHrOrAdmin}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-indigo-500 text-sm"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">Tgl</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default: Tgl 20</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tanggal Penggajian (Payday)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={paydayDate}
                  onChange={(e) => setPaydayDate(Number(e.target.value))}
                  disabled={!isHrOrAdmin}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-semibold focus:outline-none focus:border-emerald-500 text-sm text-emerald-400"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">Tgl</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default: Tgl 25</p>
            </div>
          </div>

          {/* Formula Execution Button */}
          {isHrOrAdmin && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Kalkulasi otomatis jumlah hari kerja efektif, libur, dan cut-off 12 bulan.</span>
              </div>
              <button
                type="button"
                onClick={handleApplyGlobalFormula}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-slate-600"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Terapkan ke 12 Periode</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Year 2026 Executive Summary & Metrics */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4 mb-4">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Ringkasan Kalender {selectedYear}</h2>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <p className="text-xs text-slate-400">Total Hari Kerja Efektif</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {totalAnnualStats.effective} <span className="text-xs text-slate-400 font-normal">Hari</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Rata-rata ~{Math.round(totalAnnualStats.effective / 12)} hari/bln</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <p className="text-xs text-slate-400">Libur Mingguan (Off)</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">
                  {totalAnnualStats.off} <span className="text-xs text-slate-400 font-normal">Hari</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{weeklyOffDays.length} hari per minggu</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <p className="text-xs text-slate-400">Libur Nasional RI</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {totalAnnualStats.holidays} <span className="text-xs text-slate-400 font-normal">Hari</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">15 Hari Libur Resmi RI</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <p className="text-xs text-slate-400">Total Periode Payroll</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">
                  12 <span className="text-xs text-slate-400 font-normal">Siklus</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Cut-Off Tgl {cutoffStartDay} - {cutoffEndDay}</p>
              </div>
            </div>
          </div>

          {/* Visual Legend */}
          <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-300">Keterangan Penanda Warna:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/50" />
                <span>Hari Kerja Efektif</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-md bg-rose-500/20 border border-rose-500/50" />
                <span>Libur Mingguan</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-md bg-amber-500/20 border border-amber-500/50" />
                <span>Libur Nasional RI</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-md bg-indigo-500/20 border border-indigo-500/50" />
                <span>Siklus Cut-Off Aktif</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Monthly Calendar Visualizer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Visualisasi Kalender: {MONTH_NAMES[activeMonthIndex]} {selectedYear}
              </h2>
              <p className="text-xs text-slate-400">
                Rentang Cut-Off: <span className="text-indigo-300 font-medium">{activePeriod?.startDate || '-'}</span> s/d <span className="text-indigo-300 font-medium">{activePeriod?.endDate || '-'}</span> • Penggajian: <span className="text-emerald-400 font-medium">{activePeriod?.paydayDate || '-'}</span>
              </p>
            </div>
          </div>

          {/* Month Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => {
                if (activeMonthIndex > 0) {
                  setActiveMonthIndex(activeMonthIndex - 1);
                } else {
                  setActiveMonthIndex(11);
                  setSelectedYear((prev) => prev - 1);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {MONTH_NAMES.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setActiveMonthIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeMonthIndex === idx
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.substring(0, 3)}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (activeMonthIndex < 11) {
                  setActiveMonthIndex(activeMonthIndex + 1);
                } else {
                  setActiveMonthIndex(0);
                  setSelectedYear((prev) => prev + 1);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Period Metrics Bar */}
        {activePeriod && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800 text-center">
            <div>
              <p className="text-[11px] text-slate-400">Status Presensi</p>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activePeriod.attendanceOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span className={`text-xs font-bold ${activePeriod.attendanceOpen ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activePeriod.attendanceOpen ? 'DIBUKA' : 'TERKUNCI'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Total Hari Periode</p>
              <p className="text-sm font-bold text-white mt-1">{activePeriod.totalCalendarDays} Hari</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Hari Kerja Efektif</p>
              <p className="text-sm font-bold text-emerald-400 mt-1">{activePeriod.effectiveWorkDays} Hari</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Libur Mingguan</p>
              <p className="text-sm font-bold text-rose-400 mt-1">{activePeriod.weeklyOffDaysCount} Hari</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] text-slate-400">Hari Libur Nasional</p>
              <p className="text-sm font-bold text-amber-400 mt-1">{activePeriod.holidaysCount} Hari</p>
            </div>
          </div>
        )}

        {/* Calendar Grid View */}
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
              {DAY_NAMES.map((name, idx) => (
                <div
                  key={name}
                  className={`py-2 text-xs font-bold rounded-lg ${
                    weeklyOffDays.includes(idx) ? 'text-rose-400 bg-rose-500/10' : 'text-slate-300 bg-slate-800/40'
                  }`}
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDaysMatrix.map((day: any) => {
                if (day.blank) {
                  return <div key={day.key} className="h-24 rounded-xl bg-slate-900/40 border border-dashed border-slate-800/40" />;
                }

                // Determine border and background styling
                let bgClass = 'bg-slate-800/40 border-slate-700/60';
                if (day.isCutoffStart || day.isCutoffEnd) {
                  bgClass = 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40';
                } else if (day.isPayday) {
                  bgClass = 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/40';
                } else if (day.isNationalHoliday) {
                  bgClass = 'bg-amber-950/30 border-amber-500/50';
                } else if (day.isWeeklyOff) {
                  bgClass = 'bg-rose-950/20 border-rose-900/40 text-slate-400';
                } else if (day.isInCurrentCutoff) {
                  bgClass = 'bg-slate-800/70 border-slate-700';
                }

                return (
                  <div
                    key={day.dateStr}
                    className={`h-24 p-2 rounded-xl border flex flex-col justify-between transition hover:border-slate-500 relative overflow-hidden ${bgClass}`}
                  >
                    {/* Top Row: Date Number and Status Dots */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${
                        day.isPayday
                          ? 'text-emerald-400'
                          : day.isNationalHoliday
                          ? 'text-amber-400'
                          : day.isWeeklyOff
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}>
                        {day.dateNumber}
                      </span>

                      {/* Small Indicator Badge */}
                      {day.isPayday && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-0.5 border border-emerald-500/30">
                          <DollarSign className="w-2.5 h-2.5" />
                          Gaji
                        </span>
                      )}
                      {day.isCutoffStart && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                          Buka
                        </span>
                      )}
                      {day.isCutoffEnd && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                          Tutup
                        </span>
                      )}
                    </div>

                    {/* Middle: Holiday or Cut-off Label */}
                    <div className="text-[10px] leading-tight">
                      {day.holidayName ? (
                        <p className="text-amber-300 font-semibold line-clamp-2" title={day.holidayName}>
                          🎉 {day.holidayName}
                        </p>
                      ) : day.isPayday ? (
                        <p className="text-emerald-300 font-semibold">
                          💰 Siklus Penggajian
                        </p>
                      ) : day.isCutoffStart ? (
                        <p className="text-indigo-300 font-medium">
                          🚩 Awal Cut-Off
                        </p>
                      ) : day.isCutoffEnd ? (
                        <p className="text-rose-300 font-medium">
                          🔒 Akhir Cut-Off
                        </p>
                      ) : day.isWeeklyOff ? (
                        <span className="text-slate-500 italic">Libur Mingguan</span>
                      ) : (
                        <span className="text-emerald-400/80 font-medium">● Hari Kerja</span>
                      )}
                    </div>

                    {/* Bottom: Date format */}
                    <div className="text-[9px] text-slate-500 text-right">
                      {day.dateStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Table of 12 Annual Periods & Attendance Lock Toggle */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Daftar 12 Periode Kerja & Kontrol Buka/Tutup Presensi
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola status izin presensi untuk setiap bulan. Presensi yang terkunci tidak mengizinkan pengisian presensi baru tanpa persetujuan HR.
            </p>
          </div>

          <div className="text-xs text-slate-400">
            Tahun: <span className="font-bold text-white">{selectedYear}</span>
          </div>
        </div>

        {/* Periods Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/60">
              <tr>
                <th className="py-3 px-4">Nama Periode</th>
                <th className="py-3 px-4">Rentang Cut-Off Presensi</th>
                <th className="py-3 px-4">Tanggal Penggajian</th>
                <th className="py-3 px-4 text-center">Hari Efektif</th>
                <th className="py-3 px-4 text-center">Libur / Cuti</th>
                <th className="py-3 px-4 text-center">Status Presensi</th>
                <th className="py-3 px-4 text-right">Kontrol Presensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {calendarConfig?.periods?.map((period, idx) => {
                const periodId = period.periodId || (period as any).id;
                const isOpen = period.attendanceOpen;
                const isSelectedForView = activeMonthIndex === period.monthIndex;

                return (
                  <tr
                    key={periodId || idx}
                    className={`hover:bg-slate-800/40 transition ${
                      isSelectedForView ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    {/* Periode Name */}
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveMonthIndex(period.monthIndex)}
                          className="hover:text-indigo-400 transition cursor-pointer text-left"
                          title="Lihat di kalender visual"
                        >
                          {period.periodName}
                        </button>
                        {isSelectedForView && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Aktif
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rentang Cut-Off */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <span>{period.startDate}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span>{period.endDate}</span>
                      </div>
                    </td>

                    {/* Payday */}
                    <td className="py-3 px-4 font-semibold text-emerald-400">
                      💰 {period.paydayDate}
                    </td>

                    {/* Hari Efektif */}
                    <td className="py-3 px-4 text-center font-bold text-white">
                      {period.effectiveWorkDays} <span className="text-slate-400 font-normal">Hari</span>
                    </td>

                    {/* Libur Mingguan + Libur Nasional */}
                    <td className="py-3 px-4 text-center text-slate-400">
                      {period.weeklyOffDaysCount} Off + {period.holidaysCount} Libur
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        isOpen
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        {isOpen ? 'PRESENSI DIBUKA' : 'TERKUNCI / TUTUP'}
                      </span>
                    </td>

                    {/* Action Toggle */}
                    <td className="py-3 px-4 text-right">
                      {isHrOrAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAttendance(periodId, isOpen)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ml-auto ${
                            isOpen
                              ? 'bg-rose-600/20 border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white'
                              : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          {isOpen ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Kunci Presensi</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Buka Presensi</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Hanya HR</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
