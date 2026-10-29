import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Users,
  Banknote,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Search,
  Filter,
  ShieldCheck,
  MapPin,
  TrendingUp,
  BarChart3,
  Activity,
  Download,
  FileText,
  Briefcase,
  Award,
  Sparkles,
  Layers,
  DollarSign,
  PieChart,
  Star,
  Printer,
  UserCheck,
  Eye,
  X,
  Sliders,
  Check,
  ChevronDown,
  Crown,
  EyeOff
} from 'lucide-react';
import { Project, Employee, AttendanceRecord, ApprovalItem, SalaryRuleConfig, SystemRole, getEffectiveSystemRole } from '../types';
import { HrisTimelineChart } from './HrisTimelineChart';
import { formatSalaryDisplay } from '../utils/payrollCalculator';

interface ProjectDashboardTabProps {
  project: Project;
  allProjects: Project[];
  employees: Employee[];
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  salaryRules?: SalaryRuleConfig;
  currentUser: Employee;
  onSelectProject: (projectId: string) => void;
  onBackToProjects: () => void;
  onNavigateToTab: (tabId: string, projectId?: string) => void;
  onUpdateEmployee?: (emp: Employee) => void;
}

export const ProjectDashboardTab: React.FC<ProjectDashboardTabProps> = ({
  project,
  allProjects,
  employees,
  attendances,
  approvals,
  salaryRules,
  currentUser,
  onSelectProject,
  onBackToProjects,
  onNavigateToTab,
  onUpdateEmployee
}) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isProjectManager = Boolean(project.projectManagerId && project.projectManagerId === currentUser.id);
  const canViewFinancials = currentRole === 'admin' || currentRole === 'hr' || currentRole === 'finance' || currentRole === 'superuser' || isProjectManager;
  const canManageProject = currentRole === 'admin' || currentRole === 'hr' || currentRole === 'superuser' || isProjectManager;
  const isStaff = !canViewFinancials;
  const pmEmployee = project.projectManagerId ? employees.find(e => e.id === project.projectManagerId) : null;

  const [activeSubView, setActiveSubView] = useState<'overview' | 'roster' | 'attendance' | 'schedule'>('overview');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterRoleFilter, setRosterRoleFilter] = useState('ALL');
  const [selectedMember, setSelectedMember] = useState<Employee | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Lock body scroll when slip modal is open to keep viewport steady
  useEffect(() => {
    if (isSlipModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isSlipModalOpen]);

  const [showProjectNominal, setShowProjectNominal] = useState<boolean>(false);
  const formatIDR = (val: number) => formatSalaryDisplay(val, showProjectNominal);

  // Filter assigned personnel for this specific project
  const assignedEmployees = useMemo(() => {
    const assignedIds = new Set(project.assignedEmployeeIds || []);
    if (project.projectManagerId) {
      assignedIds.add(project.projectManagerId);
    }
    return employees.filter(e => assignedIds.has(e.id) || e.assignedProjectId === project.id);
  }, [employees, project]);

  // Scoped attendances strictly for this project's personnel
  const assignedEmpIds = useMemo(() => new Set(assignedEmployees.map(e => e.id)), [assignedEmployees]);
  const scopedAttendances = useMemo(() => {
    return attendances.filter(a => assignedEmpIds.has(a.employeeId));
  }, [attendances, assignedEmpIds]);

  // Today attendance calculations
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const todayAttendances = useMemo(() => {
    return scopedAttendances.filter(a => a.date === todayStr);
  }, [scopedAttendances, todayStr]);

  const onTimeToday = useMemo(() => {
    return todayAttendances.filter(a => !a.isLate && a.status === 'ON_TIME').length;
  }, [todayAttendances]);

  const lateToday = useMemo(() => {
    return todayAttendances.filter(a => a.isLate || a.status === 'LATE').length;
  }, [todayAttendances]);

  const geofenceCompliant = useMemo(() => {
    return todayAttendances.filter(a => a.location?.inGeofence !== false).length;
  }, [todayAttendances]);

  // Financial & Budgeting Realization Calculations
  const totalAllocatedBudget = project.allocatedBudget || 0;

  const totalBaseSalary = useMemo(() => {
    return assignedEmployees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);
  }, [assignedEmployees]);

  const totalSiteAllowance = useMemo(() => {
    const daily = project.customRules?.allowance?.dailySiteAllowance || 0;
    const monthlyRemote = project.customRules?.allowance?.monthlyRemoteAllowance || 0;
    // Estimate monthly allowance based on 22 work days + remote
    return assignedEmployees.length * (daily * 22 + monthlyRemote);
  }, [assignedEmployees, project]);

  const totalOvertimeCost = useMemo(() => {
    return scopedAttendances.reduce((sum, a) => {
      if (a.checkOutTime) {
        const hour = parseInt(a.checkOutTime.split(':')[0], 10);
        if (hour > 17) {
          return sum + (hour - 17) * 35000;
        }
      }
      return sum;
    }, 0);
  }, [scopedAttendances]);

  const actualLaborCost = useMemo(() => {
    if (project.actualLaborCost && project.actualLaborCost > 0) {
      return project.actualLaborCost;
    }
    return totalBaseSalary + totalSiteAllowance + totalOvertimeCost;
  }, [project.actualLaborCost, totalBaseSalary, totalSiteAllowance, totalOvertimeCost]);

  const remainingBudget = Math.max(0, totalAllocatedBudget - actualLaborCost);
  const burnRatePercent = totalAllocatedBudget > 0
    ? Math.min(100, Math.round((actualLaborCost / totalAllocatedBudget) * 100))
    : 0;

  // Filtered roster for search & role filter
  const filteredRoster = useMemo(() => {
    return assignedEmployees.filter(emp => {
      const matchSearch =
        emp.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        emp.nik.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        emp.position.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(rosterSearch.toLowerCase());
      const matchRole = rosterRoleFilter === 'ALL' || emp.role === rosterRoleFilter || emp.department === rosterRoleFilter;
      return matchSearch && matchRole;
    });
  }, [assignedEmployees, rosterSearch, rosterRoleFilter]);

  // Available roles/departments in this project
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    assignedEmployees.forEach(e => {
      if (e.role) set.add(e.role);
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [assignedEmployees]);

  // Project custom rules
  const customSchedule = project.customRules?.workSchedule;
  const customLeave = project.customRules?.leavePolicy;
  const customAllowance = project.customRules?.allowance;
  const customGeofence = project.customRules?.geofence;

  return (
    <div className="w-full space-y-6 motion-fade-in-up pb-12">
      
      {/* =========================================================================
          TOP COMMAND BAR & PROJECT IDENTIFICATION
         ========================================================================= */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 p-5 sm:p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Back affordance + Title Cluster */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={onBackToProjects}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 border border-white/15"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Daftar Proyek</span>
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/40 text-xs font-black font-mono-code">
                {project.code}
              </span>

              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                project.status === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : project.status === 'PLANNING'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {project.status === 'ACTIVE' ? 'BERJALAN / AKTIF' : project.status === 'PLANNING' ? 'PERENCANAAN' : 'SELESAI'}
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#FF6B00]" />
                {project.location || 'SURABAYA'}
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 font-mono-code">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>PM: {pmEmployee ? pmEmployee.name : 'Belum Ditugaskan'}</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{project.name}</span>
            </h1>

            <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">{project.client || 'PT Prime Infinity Systems'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{assignedEmployees.length} Personel Bertugas</span>
              <span>•</span>
              <span className="text-slate-400 font-mono-code">Periode: {project.startDate || '01/01/2026'} s/d {project.targetEndDate || '31/12/2026'}</span>
            </p>
          </div>

          {/* Right: Fast Project Switcher + Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {canViewFinancials && (
              <button
                onClick={() => setShowProjectNominal(prev => !prev)}
                className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showProjectNominal
                    ? 'bg-orange-500/20 text-orange-200 border-orange-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Toggle sensor nilai pagu anggaran & gaji (default: sensor)"
              >
                {showProjectNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
                <span>{showProjectNominal ? 'Sembunyikan Nilai' : 'Tampilkan Nilai'}</span>
              </button>
            )}

            <div className="relative">
              <select
                value={project.id}
                onChange={(e) => onSelectProject(e.target.value)}
                className="appearance-none bg-slate-800/90 hover:bg-slate-800 text-white text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-700 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                title="Pilih proyek lain untuk diinspeksi"
              >
                {allProjects.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.code} • {p.name.length > 36 ? p.name.substring(0, 36) + '...' : p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {canManageProject && onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('projects', project.id)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white text-xs font-bold border border-amber-500/40 shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                title="Kelola pengaturan aturan dan penugasan personel proyek ini"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-300" />
                <span>Kelola Proyek & Personel</span>
              </button>
            )}

            {canViewFinancials && (
              <button
                onClick={() => onNavigateToTab('payroll', project.id)}
                className="px-3.5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Payroll Site</span>
              </button>
            )}
          </div>

        </div>

        {/* Project Manager Active Supervisory Notice */}
        {isProjectManager && (
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/50">
                <Crown className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <p className="font-bold text-amber-200">
                  👑 Akses Supervisi Project Manager Aktif
                </p>
                <p className="text-slate-300 text-[11px]">
                  Anda memimpin proyek ini sebagai Project Manager resmi. Anda memiliki wewenang penuh meninjau anggaran, realisasi biaya upah, dan mengatur operasional tim di site.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono-code font-black px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase shrink-0 hidden sm:inline">
              Supervisi Penuh
            </span>
          </div>
        )}

        {/* Unified Sub-View Switcher Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubView('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubView === 'overview'
                ? 'bg-[#FF6B00] text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{canViewFinancials ? 'Overview & Finansial' : 'Ringkasan & Aturan Operasional'}</span>
          </button>

          <button
            onClick={() => setActiveSubView('roster')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubView === 'roster'
                ? 'bg-[#FF6B00] text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kinerja Tim & Roster ({assignedEmployees.length})</span>
          </button>

          <button
            onClick={() => setActiveSubView('attendance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubView === 'attendance'
                ? 'bg-[#FF6B00] text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Presensi Site & Timeline</span>
          </button>

          <button
            onClick={() => setActiveSubView('schedule')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubView === 'schedule'
                ? 'bg-[#FF6B00] text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Aturan & Jadwal Site</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          KEY EXECUTIVE METRIC CARDS (UNIFIED 4-CARD / 5-CARD ROW)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canViewFinancials ? (
          <>
            {/* Metric 1: Pagu Anggaran Disetujui */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Pagu Anggaran Disetujui
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code">
                {totalAllocatedBudget > 0 ? formatIDR(totalAllocatedBudget) : 'Belum Ditentukan'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Alokasi plafon biaya operasional proyek
              </p>
            </div>

            {/* Metric 2: Realisasi Biaya Tenaga Kerja */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Realisasi Biaya Kerja
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code">
                {formatIDR(actualLaborCost)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono-code">
                <span>Burn:</span>
                <strong className={`${burnRatePercent > 90 ? 'text-rose-600' : burnRatePercent > 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {burnRatePercent}%
                </strong>
                <span>dari pagu</span>
              </div>
            </div>

            {/* Metric 3: Sisa Anggaran / Margin */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Sisa Anggaran Proyek
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono-code">
                {formatIDR(remainingBudget)}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    burnRatePercent > 90 ? 'bg-rose-500' : burnRatePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, burnRatePercent)}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Operational Metric 1: Lokasi & Radius Geofence */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Lokasi Presensi Site
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code truncate">
                {customGeofence?.siteName || project.location || 'Site Lapangan'}
              </div>
              <p className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1 font-mono-code">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Radius Sah: {customGeofence?.radiusMeters || 350}m GPS</span>
              </p>
            </div>

            {/* Operational Metric 2: Jam Kerja & Toleransi Shift */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Jam Kerja Shift Site
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code">
                {customSchedule?.checkInTime || '07:30'} - {customSchedule?.checkOutTime || '16:30'}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700 font-mono-code">
                <span>Toleransi:</span>
                <strong>{customSchedule?.lateGraceMinutes || 15} Menit</strong>
              </div>
            </div>

            {/* Operational Metric 3: Pola Roster & Cuti Proyek */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Pola Roster & Cuti
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-900 font-mono-code">
                {customLeave?.enabled
                  ? (customLeave.rosterPattern === '6_ON_2_OFF' ? '6:2 On/Off' : customLeave.rosterPattern === '10_ON_2_OFF' ? '10:2 On/Off' : customLeave.rosterPattern.replace(/_/g, ' '))
                  : 'Reguler'}
              </div>
              <div className="mt-1 text-[11px] text-purple-700 font-semibold truncate">
                {customLeave?.extraRemoteLeaveDays ? `+${customLeave.extraRemoteLeaveDays} Hari Kompensasi Remote` : 'Standar Cuti Tahunan'}
              </div>
            </div>
          </>
        )}

        {/* Metric 4: Kehadiran Tim Site Hari Ini */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
              Kehadiran Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code">
            {todayAttendances.length} / {assignedEmployees.length}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-emerald-700 font-semibold font-mono-code">
            <span>{onTimeToday} Tepat Waktu</span>
            <span>•</span>
            <span className="text-amber-600">{lateToday} Telat</span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SUB-VIEW 1: OVERVIEW & FINANSIAL (BUDGETING COMMAND)
         ========================================================================= */}
      {activeSubView === 'overview' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Financial Realization Breakdown OR Operational Site Rules (for staff) */}
            {canViewFinancials ? (
              <div className="lg:col-span-2 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-[#FF6B00]" />
                      <span>Rincian Realisasi Finansial Tenaga Kerja</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Alokasi biaya gaji pokok, tunjangan site & lembur untuk {assignedEmployees.length} staf aktif
                    </p>
                  </div>
                  <span className="text-xs font-mono-code font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-[#FF6B00] border border-orange-200">
                    {project.code}
                  </span>
                </div>

                {/* Cost Rows */}
                <div className="space-y-3 font-mono-code">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Gaji Pokok Kumulatif Tim</p>
                      <p className="text-[11px] text-slate-500 font-sans">Total base salary seluruh {assignedEmployees.length} personel di site</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{formatIDR(totalBaseSalary)}</div>
                      <div className="text-[10px] text-slate-400">Per Bulan</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Tunjangan Penugasan Site / Remote</p>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {customAllowance?.enabled
                          ? `Uang Harian: ${formatIDR(customAllowance.dailySiteAllowance)} / hari + Remote: ${formatIDR(customAllowance.monthlyRemoteAllowance)}`
                          : 'Standar Proyek (Mengikuti Kebijakan Operasional PRIME)'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-blue-700">{formatIDR(totalSiteAllowance)}</div>
                      <div className="text-[10px] text-slate-400">Estimasi / Bulan</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Biaya Upah Lembur (Overtime)</p>
                      <p className="text-[11px] text-slate-500 font-sans">Realisasi lembur shift kerja site berdasarkan presensi tervalidasi</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-amber-700">{formatIDR(totalOvertimeCost)}</div>
                      <div className="text-[10px] text-slate-400">Total Akumulasi</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-orange-950 uppercase tracking-wide">Total Estimasi Beban Kerja Proyek</p>
                      <p className="text-[11px] text-orange-800 font-sans">Beban payroll netto yang dibebankan pada rekening proyek ini</p>
                    </div>
                    <div className="text-right">
                      <div className="text-base sm:text-lg font-black text-[#FF6B00]">{formatIDR(actualLaborCost)}</div>
                      <div className="text-[10px] text-orange-700 font-sans">Rata-rata: {formatIDR(actualLaborCost / Math.max(1, assignedEmployees.length))} / org</div>
                    </div>
                  </div>
                </div>

                {/* Burn Rate Bar */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Tingkat Penyerapan Anggaran (Burn Rate)</span>
                    <span className="font-mono-code font-black text-slate-900">{burnRatePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        burnRatePercent > 90 ? 'bg-rose-500' : burnRatePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, burnRatePercent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400 pt-1">
                    <span>0% (Awal)</span>
                    <span>70% (Waspada)</span>
                    <span>100% (Batas Pagu: {formatIDR(totalAllocatedBudget)})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-2 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Pedoman & Aturan Operasional Site</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Standar kepatuhan presensi, shift kerja, dan tata tertib penugasan proyek {project.name}
                    </p>
                  </div>
                  <span className="text-xs font-mono-code font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {project.code}
                  </span>
                </div>

                {/* Operational Guideline Cards for Staff */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Presensi Geofence GPS</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Radius validasi: <strong className="text-slate-800">{customGeofence?.radiusMeters || 350} Meter</strong> dari titik koordinat resmi site.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Pastikan izin GPS perangkat aktif saat melakukan clock-in dan clock-out harian.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Jadwal & Shift Kerja</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Shift: <strong className="text-slate-800">{customSchedule?.checkInTime || '07:30'} - {customSchedule?.checkOutTime || '16:30'} WIB</strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Toleransi keterlambatan maksimal {customSchedule?.lateGraceMinutes || 15} menit sebelum tercatat late penalty.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <span>Pola Roster & Hak Libur</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Roster: <strong className="text-slate-800">{customLeave?.enabled ? customLeave.rosterPattern.replace(/_/g, ' ') : 'Standar Kerja (6 Hari Kerja)'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Pengajuan izin cuti terencana wajib didaftarkan minimal H-3 melalui modul Permohonan Cuti.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>Keselamatan K3 & Laporan</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Wajib menerapkan standar APD dan protokol K3 selama berada di perimeter proyek.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Laporan aktivitas kerja dan serah terima shift diselesaikan sebelum melakukan absensi kepulangan.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">Status Penugasan Anda di Proyek</p>
                      <p className="text-[11px] text-emerald-800">
                        {assignedEmployees.some(e => e.id === currentUser.id)
                          ? 'Anda terdaftar aktif sebagai personel resmi pada proyek ini.'
                          : 'Anda memiliki akses peninjauan aturan operasional proyek ini.'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono-code font-black text-emerald-700 bg-white px-3 py-1 rounded-xl border border-emerald-200">
                    Aktif
                  </span>
                </div>
              </div>
            )}

            {/* Right 1 Col: Site Rules & Info Card */}
            <div className="space-y-4">
              
              <div className="glass-card rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#FF6B00]" />
                  <span>Parameter Aturan Site</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code font-bold">Jam Kerja Shift</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {customSchedule?.enabled
                        ? `${customSchedule.checkInTime} - ${customSchedule.checkOutTime} (${customSchedule.workDays} Hari/Minggu)`
                        : '07:30 - 16:30 (Standar)'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Toleransi keterlambatan: {customSchedule?.lateGraceMinutes || 15} Menit
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code font-bold">Kebijakan Cuti & Roster</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {customLeave?.enabled
                        ? `Pola Roster: ${customLeave.rosterPattern.replace(/_/g, ' ')}`
                        : 'Standar Tahunan (12 Hari Cuti Resmi)'}
                    </div>
                    {customLeave?.extraRemoteLeaveDays ? (
                      <div className="text-[11px] text-emerald-600 mt-0.5 font-semibold">
                        +{customLeave.extraRemoteLeaveDays} Hari Kompensasi Remote
                      </div>
                    ) : null}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code font-bold">Geofence Lokasi Site</div>
                    <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{project.location || 'Site Resmi'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Radius validasi presensi: {customGeofence?.radiusMeters || 350} Meter
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveSubView('schedule')}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-center cursor-pointer block"
                >
                  Lihat Detail Jadwal Lengkap
                </button>
              </div>

              {/* Quick Project Team Preview */}
              <div className="glass-card rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Komposisi Tim ({assignedEmployees.length})</span>
                  </h3>
                  <button
                    onClick={() => setActiveSubView('roster')}
                    className="text-[11px] font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Buka Roster
                  </button>
                </div>

                <div className="space-y-1.5">
                  {assignedEmployees.slice(0, 4).map(emp => {
                    const canViewThisMember = canViewFinancials || emp.id === currentUser.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          if (canViewThisMember) {
                            setSelectedMember(emp);
                            setIsSlipModalOpen(true);
                          }
                        }}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          canViewThisMember
                            ? 'bg-slate-50 hover:bg-orange-50 border-slate-200/70 hover:border-orange-200 cursor-pointer'
                            : 'bg-slate-50/60 border-slate-200/50 cursor-default'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{emp.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                          </div>
                        </div>
                        {canViewThisMember && (
                          <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-[#FF6B00] shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {assignedEmployees.length > 4 && (
                    <p className="text-center text-[11px] text-slate-400 pt-1 font-mono-code">
                      +{assignedEmployees.length - 4} personel lainnya bertugas
                    </p>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          SUB-VIEW 2: KINERJA TIM & ROSTER PERSONEL (USER PERFORMANCE PER PROJECT)
         ========================================================================= */}
      {activeSubView === 'roster' && (
        <div className="space-y-5">
          
          {/* Roster Filter & Search Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan, NIK, atau posisi kerja..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                />
              </div>

              <div className="relative">
                <select
                  value={rosterRoleFilter}
                  onChange={(e) => setRosterRoleFilter(e.target.value)}
                  className="appearance-none bg-slate-50 text-slate-700 text-xs font-semibold pl-3 pr-8 py-2 rounded-xl border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                >
                  <option value="ALL">Semua Jabatan ({assignedEmployees.length})</option>
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono-code text-slate-500 shrink-0">
              <span>Menampilkan:</span>
              <strong className="text-slate-900">{filteredRoster.length}</strong>
              <span>dari</span>
              <strong className="text-slate-900">{assignedEmployees.length} Personel</strong>
            </div>
          </div>

          {/* Roster Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoster.map(emp => {
              // Personnel monthly stats
              const empAtts = scopedAttendances.filter(a => a.employeeId === emp.id);
              const presentCount = empAtts.filter(a => a.status === 'ON_TIME' || a.status === 'LATE' || !a.isLate).length;
              const lateCount = empAtts.filter(a => a.isLate).length;
              const attendanceRate = empAtts.length > 0 ? Math.round((presentCount / empAtts.length) * 100) : 100;

              return (
                <div
                  key={emp.id}
                  className="rounded-2xl bg-white border border-slate-200/80 p-4 hover:shadow-lg hover:border-[#FF6B00]/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Card Top: Avatar + Name + NIK */}
                    <div className="flex items-start gap-3 mb-3">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100 shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-[#FF6B00] transition-colors">
                          {emp.name}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">{emp.position}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {emp.nik}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono-code">
                            {emp.employmentType}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics Pills */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 text-center font-mono-code">
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Hadir</div>
                        <div className="text-xs font-black text-emerald-700">{presentCount} Hari</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Telat</div>
                        <div className="text-xs font-black text-amber-700">{lateCount} Kali</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Disiplin</div>
                        <div className="text-xs font-black text-blue-700">{attendanceRate}%</div>
                      </div>
                    </div>

                    {/* Financial or department details */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono-code">
                      {canViewFinancials ? (
                        <>
                          <span className="text-slate-400 text-[11px] font-sans">Gaji Pokok:</span>
                          <span className="font-black text-slate-800">{formatIDR(emp.baseSalary)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-400 text-[11px] font-sans">Divisi / Dept:</span>
                          <span className="font-bold text-slate-700 font-sans">{emp.department || 'Operasional Site'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#FF6B00]" />
                      <span>{project.location || 'Site Surabaya'}</span>
                    </span>

                    {(canViewFinancials || emp.id === currentUser.id) && (
                      <button
                        onClick={() => {
                          setSelectedMember(emp);
                          setIsSlipModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{emp.id === currentUser.id && isStaff ? 'Slip Saya' : 'Performa & Slip'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRoster.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Tidak ada personel ditemukan dengan kata kunci "{rosterSearch}"</p>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          SUB-VIEW 3: PRESENSI SITE & TIMELINE (SCOPED EXCLUSIVELY TO THIS PROJECT)
         ========================================================================= */}
      {activeSubView === 'attendance' && (
        <div className="space-y-6">
          
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-black text-emerald-950">
                  Monitoring Presensi Khusus Site: {project.name}
                </p>
                <p className="text-emerald-800 text-[11px]">
                  Menampilkan timeline presensi dan jam kedatangan secara eksklusif untuk {assignedEmployees.length} staf terdaftar di proyek ini.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono-code font-bold text-emerald-900 shrink-0">
              <span>Hadir Hari Ini:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">{todayAttendances.length} / {assignedEmployees.length}</span>
            </div>
          </div>

          {/* Scoped Timeline Component */}
          <HrisTimelineChart
            employees={assignedEmployees}
            projects={[project]}
            salaryRules={salaryRules}
            attendances={scopedAttendances}
            approvals={approvals}
            onNavigateToTab={onNavigateToTab}
          />

        </div>
      )}

      {/* =========================================================================
          SUB-VIEW 4: ATURAN & JADWAL KERJA SITE
         ========================================================================= */}
      {activeSubView === 'schedule' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Work Schedule Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF6B00]" />
              <span>Shift & Jadwal Kerja Site</span>
            </h3>

            <div className="space-y-3 text-xs font-mono-code">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Hari Kerja Efektif:</span>
                <span className="font-black text-slate-900">
                  {customSchedule?.workDays || 6} Hari / Minggu
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Jam Masuk (Check-In):</span>
                <span className="font-black text-emerald-700">
                  {customSchedule?.checkInTime || '07:30'} WIB
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Jam Pulang (Check-Out):</span>
                <span className="font-black text-slate-900">
                  {customSchedule?.checkOutTime || '16:30'} WIB
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Toleransi Keterlambatan:</span>
                <span className="font-black text-amber-700">
                  {customSchedule?.lateGraceMinutes || 15} Menit
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Aturan Kerja Hari Sabtu:</span>
                <span className="font-black text-slate-900">
                  {customSchedule?.saturdayWork
                    ? `${customSchedule.saturdayCheckIn || '07:30'} - ${customSchedule.saturdayCheckOut || '12:30'}`
                    : 'Libur Operasional'}
                </span>
              </div>
            </div>
          </div>

          {/* Geofence & Location Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF6B00]" />
              <span>Lokasi & Validasi Geofence Site</span>
            </h3>

            <div className="space-y-3 text-xs font-mono-code">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Nama Site / Lokasi:</span>
                <span className="font-black text-slate-900">
                  {customGeofence?.siteName || project.location || 'Site Surabaya'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Radius Presensi Sah:</span>
                <span className="font-black text-teal-700">
                  {customGeofence?.radiusMeters || 350} Meter
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Status Validasi Satelit:</span>
                <span className="font-black text-emerald-700">
                  GPS Geofence Aktif
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-sans">Koordinat Pusat GPS:</span>
                <span className="font-black text-slate-600 text-[11px]">
                  {customGeofence?.latitude ? `${customGeofence.latitude}, ${customGeofence.longitude}` : '-7.395625, 112.717574'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-900">
                <span className="font-sans font-semibold">Tingkat Kepatuhan Geofence:</span>
                <span className="font-black text-sm">
                  {todayAttendances.length > 0 ? Math.round((geofenceCompliant / todayAttendances.length) * 100) : 100}%
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          PERSONNEL DETAIL & PAY SLIP MODAL (Portal to document.body)
         ========================================================================= */}
      {isSlipModalOpen && selectedMember && (canViewFinancials || selectedMember.id === currentUser.id) && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print overflow-y-auto"
          onClick={() => setIsSlipModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar modal-dialog-animate"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedMember.avatar}
                  alt={selectedMember.name}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100 shadow-xs"
                />
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedMember.name}</h3>
                  <p className="text-xs text-slate-500">{selectedMember.position} • {selectedMember.nik}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSlipModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Performance Indicators */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code">
                Skor Kinerja & Kedisiplinan Proyek
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono-code">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Kehadiran</div>
                  <div className="text-sm font-black text-emerald-700">98%</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Ketepatan</div>
                  <div className="text-sm font-black text-blue-700">95%</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Produktivitas</div>
                  <div className="text-sm font-black text-orange-600">A+</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Sisa Cuti</div>
                  <div className="text-sm font-black text-slate-900">
                    {(selectedMember.leaveQuota || 12) - (selectedMember.usedLeave || 0)} Hari
                  </div>
                </div>
              </div>
            </div>

            {/* Estimasi Slip Gaji Proyek */}
            <div className="space-y-3 font-mono-code">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Estimasi Slip Gaji Bulan Ini ({project.code})
              </h4>
              
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Gaji Pokok:</span>
                  <span className="font-bold text-slate-800">{formatIDR(selectedMember.baseSalary)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Tunjangan Jabatan:</span>
                  <span className="font-bold text-slate-800">{formatIDR(selectedMember.fixedAllowance || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Tunjangan Penugasan Site:</span>
                  <span className="font-bold text-blue-700">
                    {formatIDR((project.customRules?.allowance?.dailySiteAllowance || 0) * 22)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="font-black text-slate-900 font-sans">Estimasi Take-Home Pay:</span>
                  <span className="font-black text-emerald-700">
                    {formatIDR((selectedMember.baseSalary || 0) + (selectedMember.fixedAllowance || 0) + ((project.customRules?.allowance?.dailySiteAllowance || 0) * 22))}
                  </span>
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-500">
                <p className="font-semibold text-slate-700">{selectedMember.bankAccount?.bankName || 'BCA'}</p>
                <p>No: {selectedMember.bankAccount?.accountNumber || '-'}</p>
                <p>A.n: {selectedMember.bankAccount?.accountHolder || selectedMember.name}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsSlipModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Slip</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
