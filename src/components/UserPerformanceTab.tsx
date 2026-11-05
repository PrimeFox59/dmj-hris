import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Banknote,
  Clock,
  Calendar,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sliders,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Building,
  DollarSign,
  X,
  CreditCard,
  Briefcase
} from 'lucide-react';
import {
  Employee,
  Project,
  AttendanceRecord,
  ApprovalItem,
  SalaryRuleConfig,
  getEffectiveSystemRole
} from '../types';
import { calculateEmployeePayroll, formatSalaryDisplay } from '../utils/payrollCalculator';

interface UserPerformanceTabProps {
  currentUser: Employee;
  employees: Employee[];
  allEmployees?: Employee[];
  projects: Project[];
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  salaryRules: SalaryRuleConfig;
  onSubmitNewLeaveRequest: (item: ApprovalItem) => void;
  onNavigateToTab: (tabId: string, subView?: string) => void;
  selectedProjectId?: string;
}

export const UserPerformanceTab: React.FC<UserPerformanceTabProps> = ({
  currentUser,
  employees,
  allEmployees,
  projects,
  attendances,
  approvals,
  salaryRules,
  onSubmitNewLeaveRequest,
  onNavigateToTab,
  selectedProjectId
}) => {
  const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'PROJECTS' | 'SALARY' | 'ATTENDANCE' | 'LEAVE' | 'PROJECTION'>('OVERVIEW');
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [simulatedOtHours, setSimulatedOtHours] = useState<number>(10);

  // Pengaturan Visibilitas Gaji & Masking Default:
  // Default HIDE (false) per regulasi: "pastikan nominal nya dimanapaun itu default nya hide"
  const [showSalaryNominal, setShowSalaryNominal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('prime_hris_show_salary_nominal');
      return stored === 'true'; // Defaults to false!
    }
    return false;
  });

  const toggleSalaryNominal = () => {
    setShowSalaryNominal(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('prime_hris_show_salary_nominal', String(next));
      }
      return next;
    });
  };

  // Visibilitas Rincian Komponen Gaji (Rinci vs Ringkas)
  const [showSalaryComponents, setShowSalaryComponents] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('prime_hris_show_salary_components');
      return stored !== 'false';
    }
    return true;
  });

  const toggleSalaryComponents = () => {
    setShowSalaryComponents(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('prime_hris_show_salary_components', String(next));
      }
      return next;
    });
  };

  const currentRole = getEffectiveSystemRole(currentUser);
  const isStaff = currentRole === 'staff';

  // Selected employee state when reviewing team members
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(currentUser.id);

  // If staff, always lock selectedEmployeeId strictly to currentUser.id
  useEffect(() => {
    if (isStaff && selectedEmployeeId !== currentUser.id) {
      setSelectedEmployeeId(currentUser.id);
    }
  }, [isStaff, currentUser.id, selectedEmployeeId]);

  // If selectedProjectId is active, ensure selectedEmployee belongs to that project if available
  useEffect(() => {
    if (!isStaff && selectedProjectId && selectedProjectId !== 'ALL' && employees.length > 0) {
      if (!employees.some(e => e.id === selectedEmployeeId)) {
        setSelectedEmployeeId(employees[0].id);
      }
    }
  }, [isStaff, selectedProjectId, employees, selectedEmployeeId]);

  // Lock body scroll when modals are open
  useEffect(() => {
    if (isSlipModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isSlipModalOpen]);

  const activeEmployee = useMemo(() => {
    if (isStaff) return currentUser;
    return employees.find(e => e.id === selectedEmployeeId) || currentUser;
  }, [isStaff, employees, selectedEmployeeId, currentUser]);

  // Filter personal data for activeEmployee
  const personalAttendances = useMemo(() => {
    return attendances.filter(a => a.employeeId === activeEmployee.id);
  }, [attendances, activeEmployee.id]);

  const [attStartDate, setAttStartDate] = useState<string>('');
  const [attEndDate, setAttEndDate] = useState<string>('');
  const [attDatePreset, setAttDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH'>('ALL');

  const filteredPersonalAttendances = useMemo(() => {
    return personalAttendances.filter(a => {
      const d = (a.date || '').slice(0, 10);
      if (attStartDate && d < attStartDate) return false;
      if (attEndDate && d > attEndDate) return false;
      return true;
    });
  }, [personalAttendances, attStartDate, attEndDate]);

  const [attendanceDisplayLimit, setAttendanceDisplayLimit] = useState(5);
  const visiblePersonalAttendances = useMemo(() => {
    return filteredPersonalAttendances.slice(0, attendanceDisplayLimit);
  }, [filteredPersonalAttendances, attendanceDisplayLimit]);
  const hasMoreAttendances = attendanceDisplayLimit < filteredPersonalAttendances.length;

  useEffect(() => {
    setAttendanceDisplayLimit(5);
  }, [attStartDate, attEndDate]);

  const applyAttPreset = (preset: 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH') => {
    setAttDatePreset(preset);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (preset === 'ALL') {
      setAttStartDate('');
      setAttEndDate('');
    } else if (preset === 'TODAY') {
      setAttStartDate(todayStr);
      setAttEndDate(todayStr);
    } else if (preset === 'LAST_7') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setAttStartDate(startStr);
      setAttEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setAttStartDate(startStr);
      setAttEndDate(endStr);
    }
  };

  const todayAttendance = personalAttendances[0] || null;

  const personalApprovals = useMemo(() => {
    return approvals.filter(a => a.employeeId === activeEmployee.id);
  }, [approvals, activeEmployee.id]);

  // Calculate current official payroll for activeEmployee
  const personalPayroll = useMemo(() => {
    return calculateEmployeePayroll(activeEmployee, attendances, projects, salaryRules, "September 2026");
  }, [activeEmployee, attendances, projects, salaryRules]);

  // Assigned Project
  const assignedProject = projects.find(p => p.id === activeEmployee.assignedProjectId || p.code === activeEmployee.assignedProjectId);

  // Daftar seluruh proyek yang melibatkan akun karyawan ini (penempatan utama, tim proyek, atau PM)
  const myAssignedProjects = useMemo(() => {
    return projects.filter(p => {
      const isAssignedMain = p.id === activeEmployee.assignedProjectId || p.code === activeEmployee.assignedProjectId;
      const isMember = Array.isArray(p.assignedEmployeeIds) && p.assignedEmployeeIds.includes(activeEmployee.id);
      const isPm = p.projectManagerId === activeEmployee.id;
      return isAssignedMain || isMember || isPm;
    });
  }, [projects, activeEmployee]);

  // Leave stats
  const remainingLeave = Math.max(0, activeEmployee.leaveQuota - activeEmployee.usedLeave);
  const leavePercentage = Math.round((activeEmployee.usedLeave / activeEmployee.leaveQuota) * 100);

  // Attendance rate
  const totalCheckIns = personalAttendances.length;
  const onTimeCheckIns = personalAttendances.filter(a => !a.isLate && a.mode === 'WFO').length;
  const lateCheckIns = personalAttendances.filter(a => a.isLate).length;
  const dinasCheckIns = personalAttendances.filter(a => a.mode === 'DINAS_LUAR').length;

  // Salary Projection calculations
  const hourlyBaseRate = Math.round(activeEmployee.baseSalary / salaryRules.overtimeFormula.hourlyRateDivisor);
  const currentOtPay = personalPayroll.overtimePay;
  const simulatedAdditionalOtPay = Math.round(
    simulatedOtHours * (salaryRules.overtimeFormula.subsequentHourRateMultiplier * hourlyBaseRate)
  );
  const projectedNetSalary = personalPayroll.netSalary + simulatedAdditionalOtPay;

  return (
    <div className="space-y-6 motion-fade-in-up">
      
      {/* 1. Header Profile Banner for Active Employee */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#FF6B00]/20 to-[#00E2B0]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        {/* Personnel Selector Bar when reviewing team/project members (Hidden for Staff) */}
        {!isStaff && employees.length > 1 && (
          <div className="relative z-20 mb-6 pb-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-300">
                Pilih Personel ({employees.length} Orang Terdaftar):
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-[#FF6B00] shadow-sm cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.position} ({emp.loginId || emp.id})
                  </option>
                ))}
              </select>

              {selectedEmployeeId !== currentUser.id && (
                <button
                  onClick={() => setSelectedEmployeeId(currentUser.id)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-slate-200 hover:text-white font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs"
                  title="Kembali ke profil saya sendiri"
                >
                  Profil Saya
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={activeEmployee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeEmployee.name)}&background=random`}
                alt={activeEmployee.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#FF6B00] shadow-lg"
              />
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase font-mono-code shadow-xs">
                ONLINE
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="prime-cut-corner bg-[#FF6B00] text-white text-[10px] font-black px-2 py-0.5 tracking-wider uppercase font-mono-code">
                  {selectedEmployeeId === currentUser.id ? 'PORTAL PERSONAL KARYAWAN' : 'TINJAUAN KINERJA PERSONEL'}
                </span>
                <span className="text-xs font-mono-code text-slate-400 font-bold">
                  {activeEmployee.loginId || (activeEmployee.id === 'EMP-001' ? 'admin' : activeEmployee.id)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono-code">
                  Status: {activeEmployee.employmentType}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {activeEmployee.name}
              </h1>

              <p className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                <span>{activeEmployee.position}</span>
                <span></span>
                <span className="text-slate-400">{activeEmployee.department}</span>
                <span></span>
                <span className="text-[#FF8533] font-mono-code font-semibold">
                  ? {assignedProject ? assignedProject.code : 'Workshop Pusat'}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsSlipModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#00E2B0]" />
              Cetak Slip Gaji
            </button>
          </div>
        </div>

        {/* Status Strip */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-mono-code text-slate-400 block uppercase">Presensi Hari Ini:</span>
            <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
              {todayAttendance ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{todayAttendance.checkInTime} WIB ({todayAttendance.status})</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Belum Check-In Hari Ini</span>
                </>
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono-code text-slate-400 block uppercase">Sisa Kuota Cuti 2026:</span>
            <span className="font-bold text-emerald-400 font-mono-code text-sm mt-0.5">
              {remainingLeave} Hari <span className="text-[10px] text-slate-400 font-normal">/ {activeEmployee.leaveQuota} Hari</span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono-code text-slate-400 block uppercase">Take Home Pay Terkini:</span>
              <button
                type="button"
                onClick={toggleSalaryNominal}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded hover:bg-white/10"
                title={showSalaryNominal ? "Sembunyikan Nominal (Privasi)" : "Tampilkan Nominal"}
              >
                {showSalaryNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-300" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>
            <span className="font-black text-[#FF8533] font-mono-code text-sm mt-0.5">
              {formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono-code text-slate-400 block uppercase">Rekening Payroll:</span>
            <span className="font-semibold text-slate-300 truncate block mt-0.5">
              {activeEmployee.bankAccount?.bankName || 'BCA'} ({activeEmployee.bankAccount?.accountNumber || '-'})
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs for User Performance */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 overflow-x-auto">
        {[
          { id: 'OVERVIEW', label: 'Ringkasan Kinerja', icon: User },
          { id: 'PROJECTS', label: `Proyek Saya (${myAssignedProjects.length})`, icon: Briefcase },
          { id: 'SALARY', label: 'Cek Gaji & Slip', icon: Banknote },
          { id: 'ATTENDANCE', label: 'Presensi & Jam Kerja', icon: Clock },
          { id: 'LEAVE', label: `Sisa Cuti (${remainingLeave} Hari)`, icon: Calendar },
          
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FF6B00] text-white shadow-xs scale-[1.02]'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB CONTENT 1: OVERVIEW (RINGKASAN CEPAT)
         ========================================================================= */}
      {activeSection === 'OVERVIEW' && (
        <div className="space-y-6 motion-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="glass-card rounded-2xl p-5 border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono-code block">
                  Take Home Pay Bulan Ini
                </span>
                <button
                  type="button"
                  onClick={toggleSalaryNominal}
                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title={showSalaryNominal ? "Sembunyikan Nominal (Sensor Default)" : "Tampilkan Nominal"}
                >
                  {showSalaryNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
                </button>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code mt-1">
                {formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}
              </div>
              <button
                onClick={() => setActiveSection('SALARY')}
                className="mt-2 text-xs font-bold text-[#FF6B00] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Rincian Slip Gaji <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* KPI 2 */}
            <div className="glass-card rounded-2xl p-5 border border-slate-200/80 card-interactive">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono-code block">
                Kehadiran & Disiplin Masuk
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono-code mt-1">
                {personalPayroll.presentDays} / 22 Hari
              </div>
              <span className="mt-2 text-xs text-slate-500 block">
                {lateCheckIns > 0 ? `${lateCheckIns}x Terlambat` : '100% Tepat Waktu'}
              </span>
            </div>

            {/* KPI 3 */}
            <div className="glass-card rounded-2xl p-5 border border-slate-200/80 card-interactive">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono-code block">
                Saldo Cuti Tersisa
              </span>
              <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono-code mt-1">
                {remainingLeave} Hari
              </div>
              <button
                onClick={() => setActiveSection('LEAVE')}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ajukan Cuti Baru <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* KPI 4: Penugasan Proyek Aktif */}
            <div className="glass-card rounded-2xl p-5 border border-slate-200/80 card-interactive">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono-code block">
                Penugasan Proyek Aktif
              </span>
              <div className="text-xl sm:text-2xl font-black text-orange-600 font-mono-code mt-1 truncate">
                {assignedProject?.code || 'PRJ-PUSAT'}
              </div>
              <p className="mt-1 text-xs text-slate-600 font-semibold truncate" title={assignedProject?.name || 'Kantor Pusat & Operasional'}>
                {assignedProject?.name || 'Kantor Pusat & Workshop'}
              </p>
              <button
                onClick={() => setActiveSection('PROJECTS')}
                className="mt-2 text-xs font-bold text-[#FF6B00] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Lihat {myAssignedProjects.length} Proyek Saya <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Quick 2 Col Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Presensi Terkini */}
            <div className="glass-card rounded-3xl p-5 border border-slate-200/80 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FF6B00]" />
                  Presensi Kamera Hari Ini
                </h3>
                <button
                  onClick={() => onNavigateToTab('attendance')}
                  className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                >
                  Buka Kamera
                </button>
              </div>

              {todayAttendance ? (
                <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <img
                    src={todayAttendance.photoUrl}
                    alt="Selfie Presensi"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
                  />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-slate-900">
                      Waktu Masuk: <span className="font-mono-code text-emerald-700">{todayAttendance.checkInTime} WIB</span>
                    </p>
                    <p className="text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                      Lokasi: <span className="font-semibold text-slate-800">{todayAttendance.location.address || 'Site Proyek'}</span>
                    </p>
                    <p className="text-slate-500 truncate flex items-center gap-1">
                      <span className="font-mono-code text-[11px] text-slate-400">Jarak: {typeof todayAttendance.location.distanceMeters === 'number' && !isNaN(todayAttendance.location.distanceMeters) ? `${(todayAttendance.location.distanceMeters / 1000).toFixed(1)} km` : '0.0 km'} ({todayAttendance.mode})</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center text-xs space-y-2">
                  <p className="font-bold text-amber-900">Anda belum melakukan presensi kamera hari ini.</p>
                  <p className="text-amber-700">Pastikan berada di dalam radius geofence resmi sebelum melakukan selfie check-in.</p>
                  <button
                    onClick={() => onNavigateToTab('attendance')}
                    className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    Buka Presensi Kamera
                  </button>
                </div>
              )}
            </div>

            {/* Proyeksi Gaji Singkat */}
            <div className="glass-card rounded-3xl p-5 border border-slate-200/80 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Proyeksi Gaji Periode Ini
                </h3>
                <button
                  onClick={() => setActiveSection('PROJECTION')}
                  className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                >
                  Simulasi Lembur
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Estimasi Bersih (THP):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code font-black text-base text-slate-900">{formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}</span>
                    <button
                      onClick={() => setShowSalaryNominal(prev => !prev)}
                      className="p-1 rounded-lg hover:bg-orange-100 text-slate-400 hover:text-[#FF6B00] transition-colors cursor-pointer"
                      title={showSalaryNominal ? "Sembunyikan Nominal" : "Tampilkan Nominal"}
                    >
                      {showSalaryNominal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Jadwal Pencairan Kas:</span>
                  <span className="font-bold text-slate-800">25 September 2026</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Alokasi Beban Proyek:</span>
                  <span className="font-mono-code text-orange-700 font-bold">{assignedProject?.code || 'PRIME-ENG-01'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: PROYEK SAYA (PENUGASAN PROYEK & SITE LAPANGAN)
         ========================================================================= */}
      {activeSection === 'PROJECTS' && (
        <div className="space-y-6 motion-fade-in-up">
          {/* Header Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#FF6B00]" />
                Daftar Penugasan Proyek & Site Lapangan
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Seluruh proyek, fasilitas site konstruksi, dan penugasan operasional di mana akun Anda terdaftar sebagai personel aktif.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-black font-mono-code flex items-center gap-1.5 shadow-2xs">
                <Building className="w-3.5 h-3.5" />
                <span>{myAssignedProjects.length} Proyek Terdaftar</span>
              </span>
            </div>
          </div>

          {/* Project Cards List */}
          {myAssignedProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-5">
              {myAssignedProjects.map(proj => {
                const isPrimary = proj.id === activeEmployee.assignedProjectId || proj.code === activeEmployee.assignedProjectId;
                const isPm = proj.projectManagerId === activeEmployee.id;
                const pmEmployee = (allEmployees || employees).find(e => e.id === proj.projectManagerId);
                const hasGeofence = Boolean(proj.customRules?.geofence?.enabled);
                const geoRadius = proj.customRules?.geofence?.radiusMeters || 350;
                const totalTeam = proj.assignedEmployeeIds?.length || 1;
                const schedule = proj.customRules?.workSchedule;

                return (
                  <div
                    key={proj.id}
                    className={`glass-card rounded-3xl p-6 border transition-all shadow-sm hover:shadow-md ${
                      isPrimary
                        ? 'border-orange-300 ring-2 ring-orange-500/10 bg-gradient-to-br from-white via-orange-50/20 to-white'
                        : 'border-slate-200/80 bg-white'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono-code font-black text-xs tracking-wider">
                            {proj.code}
                          </span>
                          {isPrimary && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black font-mono-code uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>PROYEK UTAMA (DEFAULT SITE)</span>
                            </span>
                          )}
                          {isPm && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-black font-mono-code uppercase">
                              PROJECT MANAGER (PM)
                            </span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono-code uppercase ${
                            proj.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : proj.status === 'PLANNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {proj.status === 'ACTIVE' ? 'STATUS: AKTIF BERJALAN' : proj.status === 'PLANNING' ? 'STATUS: PERENCANAAN' : 'STATUS: SELESAI'}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                          {proj.name}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            Klien: {proj.client || 'PT Dwi Martha Jaya'}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-[#FF6B00]">
                            <MapPin className="w-3.5 h-3.5" />
                            Lokasi Site: {proj.location || 'Surabaya / Lapangan'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Attendance Navigation */}
                      <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                        <button
                          onClick={() => {
                            try {
                              localStorage.setItem('prime_active_presensi_project_id', proj.id);
                            } catch (e) {}
                            onNavigateToTab('attendance', proj.id);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#ff7d1a] text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Buka Presensi Site</span>
                        </button>
                      </div>
                    </div>

                    {/* Project Specifications Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 text-xs">
                      {/* Jadwal Jam Kerja */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] font-mono-code text-slate-400 uppercase font-black block">
                          Jadwal Jam Kerja (Shift)
                        </span>
                        <p className="font-bold text-slate-900 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-orange-600" />
                          {schedule?.checkInTime || '08:00'} - {schedule?.checkOutTime || '17:00'} WIB
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {schedule?.workDays || 5} Hari Kerja {schedule?.saturdayWork ? '(Sabtu Masuk)' : '(Senin - Jumat)'}
                        </p>
                        <p className="text-[10px] font-mono-code text-slate-400">
                          Toleransi Telat: {schedule?.lateGraceMinutes || 15} Menit
                        </p>
                      </div>

                      {/* Geofence & Koordinat Area */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] font-mono-code text-slate-400 uppercase font-black block">
                          Geofence Radius Presensi
                        </span>
                        <p className="font-bold text-slate-900 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          {hasGeofence ? `Radius ${geoRadius} Meter` : 'Radius Terpusat (350m)'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {hasGeofence
                            ? `Lat: ${proj.customRules?.geofence?.latitude?.toFixed(4)}, Lng: ${proj.customRules?.geofence?.longitude?.toFixed(4)}`
                            : 'Mengikuti koordinat Kantor Pusat / Site'}
                        </p>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[9.5px] font-black font-mono-code uppercase ${
                          hasGeofence ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {hasGeofence ? 'SITE GEOFENCE AKTIF' : 'DEFAULT GEOFENCE'}
                        </span>
                      </div>

                      {/* Periode & Target Waktu */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] font-mono-code text-slate-400 uppercase font-black block">
                          Periode Kontrak Proyek
                        </span>
                        <p className="font-bold text-slate-900 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {proj.startDate || '2024-01-01'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          s/d {proj.targetEndDate || '2027-12-31'}
                        </p>
                        <span className="text-[10px] font-mono-code text-emerald-700 font-bold block">
                          Proyek Berkelanjutan
                        </span>
                      </div>

                      {/* Manajer Proyek & Personel */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] font-mono-code text-slate-400 uppercase font-black block">
                          PIC & Kekuatan Tim
                        </span>
                        <p className="font-bold text-slate-900 truncate">
                          PM: {pmEmployee ? pmEmployee.name : (proj.client || 'Direksi Teknik')}
                        </p>
                        <p className="text-[11px] text-slate-600 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{totalTeam} Personel Terdaftar</span>
                        </p>
                        <span className="text-[10px] font-mono-code text-slate-500 block">
                          Divisi: {activeEmployee.department || 'Operasional'}
                        </span>
                      </div>
                    </div>

                    {/* Deskripsi Proyek Singkat */}
                    {proj.description && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{proj.description}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-8 border border-slate-200/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF6B00] flex items-center justify-center mx-auto">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                Belum Terdaftar di Proyek Khusus
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Akun Anda saat ini belum dialokasikan ke proyek site khusus. Seluruh aktivitas operasional dan presensi mengacu pada Kantor Pusat & Workshop Terpadu.
              </p>
              <button
                onClick={() => onNavigateToTab('attendance')}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white font-bold text-xs shadow-md cursor-pointer inline-flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Buka Presensi Kamera</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT 2: CEK GAJI & SLIP GAJI
         ========================================================================= */}
      {activeSection === 'SALARY' && (
        <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-5 motion-fade-in-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#FF6B00]" />
                Rincian Penghasilan & Slip Gaji Karyawan
              </h2>
              <p className="text-xs text-slate-500">
                Periode: <strong>September 2026</strong> • Berdasarkan regulasi ketenagakerjaan Depnaker RI & SOP PT Prime Infinity Systems.
              </p>
            </div>

            {/* Privacy & View Controls Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowSalaryNominal(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showSalaryNominal 
                    ? 'border-orange-300 bg-orange-50 text-[#FF6B00]' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="Toggle visibilitas angka nominal gaji (default: sensor)"
              >
                {showSalaryNominal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
                <span>{showSalaryNominal ? 'Sembunyikan Nominal' : 'Tampilkan Nominal'}</span>
              </button>

              <button
                onClick={() => setShowSalaryComponents(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showSalaryComponents
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="Toggle mode rincian komponen vs ringkasan kompak"
              >
                <span>{showSalaryComponents ? '🎛️ Komponen: Rinci' : '🎛️ Komponen: Ringkas'}</span>
              </button>

              <button
                onClick={() => setIsSlipModalOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white text-xs font-bold shadow-md shadow-orange-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Slip Gaji
              </button>
            </div>
          </div>

          {/* Mode Ringkas / Compact Summary View */}
          {!showSalaryComponents ? (
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Ringkasan Penghasilan (Mode Kompak)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Rincian komponen disembunyikan untuk menjaga privasi di tempat kerja.</p>
                </div>
                <button
                  onClick={() => setShowSalaryComponents(true)}
                  className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                >
                  Buka Rincian Komponen ↗
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                  <span className="text-[10px] font-mono-code font-bold uppercase text-slate-400 block">Total Bruto (Kompensasi)</span>
                  <span className="text-base font-black text-emerald-700 font-mono-code mt-1 block">
                    {formatSalaryDisplay(personalPayroll.grossSalary, showSalaryNominal)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-center">
                  <span className="text-[10px] font-mono-code font-bold uppercase text-slate-400 block">Total Potongan Resmi</span>
                  <span className="text-base font-black text-rose-600 font-mono-code mt-1 block">
                    -{formatSalaryDisplay(personalPayroll.totalDeductions, showSalaryNominal)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[10px] font-mono-code font-bold uppercase text-emerald-800 block">Gaji Bersih (THP)</span>
                  <span className="text-lg font-black text-emerald-800 font-mono-code mt-1 block">
                    {formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Mode Rinci / Detailed Salary Component Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Penerimaan */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-wider font-mono-code border-b border-emerald-200 pb-1.5 flex items-center justify-between">
                  <span>A. Penerimaan / Kompensasi</span>
                  <span className="text-[10px] font-normal text-emerald-600">Hak Karyawan</span>
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Gaji Pokok:</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.baseSalary, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Tunjangan Tetap & Jabatan:</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.fixedAllowance, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Uang Makan ({personalPayroll.presentDays} Hari Hadir):</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.dailyAllowanceTotal, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Tunjangan Penugasan Proyek Site:</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.projectAllowance, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-orange-700 font-semibold">
                    <span>Upah Lembur ({personalPayroll.overtimeHours} Jam Depnaker):</span>
                    <span className="font-mono-code font-bold">+{formatSalaryDisplay(personalPayroll.overtimePay, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-black text-slate-900 text-sm">
                    <span>Total Penghasilan Bruto:</span>
                    <span className="font-mono-code text-emerald-700">{formatSalaryDisplay(personalPayroll.grossSalary, showSalaryNominal)}</span>
                  </div>
                </div>
              </div>

              {/* Potongan */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                <h4 className="font-bold text-rose-800 text-xs uppercase tracking-wider font-mono-code border-b border-rose-200 pb-1.5 flex items-center justify-between">
                  <span>B. Potongan & Kewajiban</span>
                  <span className="text-[10px] font-normal text-rose-600">Pajak & Jamsostek</span>
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">BPJS Ketenagakerjaan (3% JHT/JKK):</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.bpjsKetenagakerjaan, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">BPJS Kesehatan (1%):</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.bpjsKesehatan, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Estimasi PPh 21 Pasal 21:</span>
                    <span className="font-mono-code font-bold text-slate-900">{formatSalaryDisplay(personalPayroll.pph21, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                    <span>Denda Keterlambatan Tanpa Izin:</span>
                    <span className="font-mono-code font-bold">-{formatSalaryDisplay(personalPayroll.unapprovedLateDeduction, showSalaryNominal)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-black text-slate-900 text-sm">
                    <span>Total Potongan:</span>
                    <span className="font-mono-code text-rose-700">-{formatSalaryDisplay(personalPayroll.totalDeductions, showSalaryNominal)}</span>
                  </div>
                </div>

                {/* THP Final Box */}
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono-code uppercase font-bold text-emerald-800">GAJI BERSIH (TAKE HOME PAY):</span>
                    <div className="text-lg sm:text-xl font-black text-emerald-800 font-mono-code">
                      {formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold font-mono-code">
                    Siap Ditransfer
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT 3: PRESENSI & JAM KERJA
         ========================================================================= */}
      {activeSection === 'ATTENDANCE' && (
        <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-5 motion-fade-in-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF6B00]" />
                Log Riwayat Presensi & Verifikasi Kehadiran
              </h2>
              <p className="text-xs text-slate-500">
                Data sinkronisasi kamera selfie dan koordinat GPS Geofence.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onNavigateToTab('approvals', 'new-correction')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border border-amber-200 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ajukan Koreksi Absensi Mandiri</span>
              </button>
              <button
                onClick={() => onNavigateToTab('attendance')}
                className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white font-bold text-xs transition-all cursor-pointer"
              >
                Buka Kamera Presensi
              </button>
            </div>
          </div>

          {/* Date Range Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1 font-mono-code text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                Filter Rentang Waktu:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={attStartDate}
                  onChange={e => {
                    setAttStartDate(e.target.value);
                    setAttDatePreset('ALL');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-[#FF6B00]"
                  title="Tanggal Mulai"
                />
                <span className="text-slate-400 text-xs font-mono-code">s/d</span>
                <input
                  type="date"
                  value={attEndDate}
                  onChange={e => {
                    setAttEndDate(e.target.value);
                    setAttDatePreset('ALL');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-[#FF6B00]"
                  title="Tanggal Akhir"
                />
              </div>
              {(attStartDate || attEndDate) && (
                <button
                  type="button"
                  onClick={() => applyAttPreset('ALL')}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/60 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'TODAY', label: 'Hari Ini' },
                { id: 'LAST_7', label: '7 Hari Terakhir' },
                { id: 'THIS_MONTH', label: 'Bulan Ini' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyAttPreset(p.id as any)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono-code transition-all cursor-pointer ${
                    attDatePreset === p.id && (!attStartDate || p.id !== 'ALL')
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-mono-code text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tanggal & Waktu</th>
                  <th className="px-4 py-3">Mode & Status</th>
                  <th className="px-4 py-3">Jarak & Geofence</th>
                  <th className="px-4 py-3">Geolokasi Terdeteksi</th>
                  <th className="px-4 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {visiblePersonalAttendances.map(att => (
                  <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{att.date}</p>
                      <span className="text-[10px] font-mono-code text-slate-500">{att.checkInTime} WIB</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono-code ${
                            att.status === 'ON_TIME'
                              ? 'bg-emerald-100 text-emerald-800'
                              : att.status === 'LATE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {att.status === 'ON_TIME' ? 'Tepat Waktu' : att.status === 'LATE' ? `Telat ${att.lateMinutes}m` : 'Dinas Luar'}
                        </span>
                        {att.isHrCorrected && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono-code font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            ✨ Terkoreksi ({att.hrCorrectedBy || 'Approval'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono-code flex items-center gap-1 text-slate-700">
                        <MapPin className="w-3 h-3 text-[#FF6B00]" />
                        {typeof att.location.distanceMeters === 'number' && !isNaN(att.location.distanceMeters) ? `${(att.location.distanceMeters / 1000).toFixed(1)} km` : '0.0 km'} ({att.mode})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600 truncate max-w-xs block">
                        {att.location.address}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      <div>{att.note || '-'}</div>
                      {att.hrCorrectionNotes && (
                        <div className="text-[10px] text-amber-700 italic mt-0.5 font-medium">
                          Catatan Koreksi: {att.hrCorrectionNotes}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPersonalAttendances.length > 5 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-t border-slate-200/70 text-xs">
              <span className="text-slate-500 font-mono-code text-[11px]">
                Menampilkan <span className="font-bold text-slate-800">{Math.min(attendanceDisplayLimit, filteredPersonalAttendances.length)}</span> dari <span className="font-bold text-slate-800">{filteredPersonalAttendances.length}</span> rekaman presensi
                {(attStartDate || attEndDate) && (
                  <span className="text-slate-400 ml-1.5">(Rentang: {attStartDate || 'Awal'} s/d {attEndDate || 'Kini'})</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {hasMoreAttendances ? (
                  <button
                    type="button"
                    onClick={() => setAttendanceDisplayLimit(prev => Math.min(prev + 5, filteredPersonalAttendances.length))}
                    className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-orange-200 hover:border-[#FF6B00] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Muat 5 Rekaman Lagi ({filteredPersonalAttendances.length - attendanceDisplayLimit} Tersisa)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAttendanceDisplayLimit(5)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ciutkan (Tampilkan 5)</span>
                  </button>
                )}
                {hasMoreAttendances && (
                  <button
                    type="button"
                    onClick={() => setAttendanceDisplayLimit(filteredPersonalAttendances.length)}
                    className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold text-xs transition-all cursor-pointer"
                  >
                    Tampilkan Semua
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT 4: SISA CUTI & PENGAJUAN
         ========================================================================= */}
      {activeSection === 'LEAVE' && (
        <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-5 motion-fade-in-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Manajemen Saldo Cuti & Izin Karyawan
              </h2>
              <p className="text-xs text-slate-500">
                Hak cuti tahunan PT Prime Infinity Systems tahun kalender 2026.
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('approvals', 'new-leave')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{remainingLeave <= 0 ? 'Ajukan Permohonan Izin / Cuti' : 'Ajukan Permohonan Cuti'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center">
              <span className="text-[10px] font-mono-code font-bold uppercase text-blue-700 block">Total Hak Cuti Tahunan</span>
              <span className="text-2xl font-black text-blue-900 font-mono-code">{activeEmployee.leaveQuota} Hari</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] font-mono-code font-bold uppercase text-slate-500 block">Cuti Sudah Digunakan</span>
              <span className="text-2xl font-black text-slate-800 font-mono-code">{activeEmployee.usedLeave} Hari</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] font-mono-code font-bold uppercase text-emerald-700 block">Sisa Saldo Cuti Tersedia</span>
              <span className="text-2xl font-black text-emerald-800 font-mono-code">{remainingLeave} Hari</span>
            </div>
          </div>
        </div>
      )}



      {/* =========================================================================
          TAB CONTENT 6: PROYEKSI GAJI & SIMULASI LEMBUR
         ========================================================================= */}
      {activeSection === 'PROJECTION' && (
        <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-6 motion-fade-in-up">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Simulator & Proyeksi Penghasilan Bersih (THP)
            </h2>
            <p className="text-xs text-slate-500">
              Kalkulasi peramalan gaji akhir bulan jika menambah jam lembur resmi atau penugasan site luar kota.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono-code text-slate-400 uppercase">Simulasi Tambahan Jam Lembur:</span>
                <div className="text-2xl font-black text-[#FF6B00] font-mono-code mt-0.5">
                  +{simulatedOtHours} Jam Kerja Lembur
                </div>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={simulatedOtHours}
                  onChange={e => setSimulatedOtHours(parseInt(e.target.value, 10))}
                  className="w-full accent-[#FF6B00] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono-code text-slate-400 mt-1">
                  <span>+0 Jam</span>
                  <span>+20 Jam</span>
                  <span>+40 Jam</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="p-3 rounded-2xl bg-slate-850">
                <span className="text-[10px] text-slate-400 block font-mono-code">Estimasi Tambahan Upah Lembur:</span>
                <span className="text-base font-black text-[#00E2B0] font-mono-code mt-0.5 block">
                  +{formatSalaryDisplay(simulatedAdditionalOtPay, showSalaryNominal)}
                </span>
                <span className="text-[9px] text-slate-500">Formula Depnaker 1/173 Upah Pokok</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-850">
                <span className="text-[10px] text-slate-400 block font-mono-code">Gaji Bersih Saat Ini:</span>
                <span className="text-base font-black text-slate-300 font-mono-code mt-0.5 block">
                  {formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}
                </span>
                <span className="text-[9px] text-slate-500">Periode berjalan</span>
              </div>

              <div className="p-3 rounded-2xl bg-orange-950/60 border border-orange-500/40">
                <span className="text-[10px] text-[#FF8533] block font-mono-code font-bold uppercase">PROYEKSI GAJI BERSIH BARU:</span>
                <span className="text-lg font-black text-[#FF6B00] font-mono-code mt-0.5 block">
                  {formatSalaryDisplay(projectedNetSalary, showSalaryNominal)}
                </span>
                <span className="text-[9px] text-emerald-400 font-semibold">
                  Potensi kenaikan +{Math.round((simulatedAdditionalOtPay / personalPayroll.netSalary) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* =========================================================================
          MODAL: CETAK SLIP GAJI RESMI PRIME
         ========================================================================= */}
      {isSlipModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setIsSlipModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-auto modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setIsSlipModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer no-print"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Slip Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 sm:h-11 px-2 py-0.5 rounded-xl bg-[#233360] border border-[#2e427b] shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src="/dmj-logo.png"
                        alt="PT Dwi Martha Jaya"
                        className="h-full w-auto object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 font-mono-code leading-none">
                        PT DWI MARTHA JAYA
                      </h2>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                        Contractor & Supplier • Sistem Penggajian DMJ HRIS
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSalaryNominal(prev => !prev)}
                      className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-bold flex items-center gap-1 transition-all no-print cursor-pointer"
                      title="Buka / Tutup sensor nominal"
                    >
                      {showSalaryNominal ? <EyeOff className="w-3 h-3 text-slate-400" /> : <Eye className="w-3 h-3 text-[#FF6B00]" />}
                      <span>{showSalaryNominal ? 'Sensor Nilai' : 'Buka Nilai'}</span>
                    </button>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase font-mono-code">
                      SLIP GAJI RESMI
                    </span>
                  </div>
                  <p className="text-[10px] font-mono-code text-slate-500">
                    Periode: September 2026
                  </p>
                </div>
              </div>
            </div>

            {/* Employee ID details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Nama Karyawan</span>
                <span className="font-bold text-slate-900">{activeEmployee.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">ID Login Akun</span>
                <span className="font-bold text-slate-900 font-mono-code">{activeEmployee.loginId || (activeEmployee.id === 'EMP-001' ? 'admin' : activeEmployee.id)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Departemen</span>
                <span className="font-semibold text-slate-700">{activeEmployee.department}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Jabatan / Posisi</span>
                <span className="font-semibold text-slate-700">{activeEmployee.position}</span>
              </div>
            </div>

            {/* Salary Breakdown 2 Cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-xs">
              {/* Penerimaan */}
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider font-mono-code border-b border-emerald-200 pb-1">
                  A. PENERIMAAN / PENGHASILAN
                </h4>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Gaji Pokok:</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.baseSalary, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Tunjangan Tetap / Jabatan:</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.fixedAllowance, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Uang Makan ({personalPayroll.presentDays} Hari):</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.dailyAllowanceTotal, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Tunjangan Penugasan Proyek:</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.projectAllowance, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-orange-700 font-medium">
                  <span>Upah Lembur ({personalPayroll.overtimeHours} Jam Depnaker):</span>
                  <span className="font-mono-code font-bold">+{formatSalaryDisplay(personalPayroll.overtimePay, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>Total Penghasilan Bruto:</span>
                  <span className="font-mono-code">{formatSalaryDisplay(personalPayroll.grossSalary, showSalaryNominal)}</span>
                </div>
              </div>

              {/* Potongan */}
              <div className="space-y-2">
                <h4 className="font-bold text-rose-800 text-[11px] uppercase tracking-wider font-mono-code border-b border-rose-200 pb-1">
                  B. POTONGAN
                </h4>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">BPJS Ketenagakerjaan (3%):</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.bpjsKetenagakerjaan, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">BPJS Kesehatan (1%):</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.bpjsKesehatan, showSalaryNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Pajak Penghasilan (PPh 21):</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(personalPayroll.pph21, showSalaryNominal)}</span>
                </div>
                {personalPayroll.unapprovedLateDeduction > 0 && (
                  <div className="flex justify-between py-0.5 text-rose-600">
                    <span>Sanksi Keterlambatan ({personalPayroll.lateDays} Hari):</span>
                    <span className="font-mono-code font-semibold">-{formatSalaryDisplay(personalPayroll.unapprovedLateDeduction, showSalaryNominal)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>Total Potongan:</span>
                  <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(personalPayroll.totalDeductions, showSalaryNominal)}</span>
                </div>
              </div>
            </div>

            {/* Net Total Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 font-mono-code block">
                  PENGHASILAN BERSIH DITERIMA (TAKE HOME PAY)
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 font-mono-code">
                  {formatSalaryDisplay(personalPayroll.netSalary, showSalaryNominal)}
                </div>
              </div>
              <div className="text-right text-[11px] font-mono-code text-slate-500">
                <p className="font-semibold text-slate-700">{activeEmployee.bankAccount?.bankName || currentUser.bankAccount?.bankName || 'BCA'}</p>
                <p>No: {activeEmployee.bankAccount?.accountNumber || currentUser.bankAccount?.accountNumber || '-'}</p>
                <p>A.n: {activeEmployee.bankAccount?.accountHolder || activeEmployee.name}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 no-print">
              <button
                onClick={() => setShowSalaryNominal(prev => !prev)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {showSalaryNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
                <span>{showSalaryNominal ? 'Sensor Nominal' : 'Buka Nominal'}</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsSlipModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white text-xs font-bold shadow-md shadow-orange-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Slip Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
