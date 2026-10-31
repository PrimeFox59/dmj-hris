import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Users,
  Briefcase,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  ChevronRight,
  Calendar,
  ShieldCheck,
  Banknote,
  FileCheck2,
  Sparkles,
  PieChart,
  DollarSign,
  Layers,
  ArrowRight,
  Activity,
  FileSpreadsheet,
  Eye,
  EyeOff
} from 'lucide-react';
import { Employee, Project, AttendanceRecord, ApprovalItem, SalaryRuleConfig, getEffectiveSystemRole } from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';
import { HrisTimelineChart } from './HrisTimelineChart';
import { FinanceTimelineChart } from './FinanceTimelineChart';
import { UserPerformanceTab } from './UserPerformanceTab';

interface DashboardTabProps {
  currentUser: Employee;
  employees: Employee[];
  projects: Project[];
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  salaryRules: SalaryRuleConfig;
  onSubmitNewLeaveRequest: (item: ApprovalItem) => void;
  onNavigateToTab: (tabId: string, projectIdFilter?: string) => void;
  initialSubView?: 'hris' | 'finance' | 'performance';
  selectedProjectId?: string;
  onSelectProjectId?: (projectId: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  currentUser,
  employees,
  projects,
  attendances,
  approvals,
  salaryRules,
  onSubmitNewLeaveRequest,
  onNavigateToTab,
  initialSubView = 'hris',
  selectedProjectId,
  onSelectProjectId
}) => {
  const currentRole = getEffectiveSystemRole(currentUser);
  const isStaff = currentRole === 'staff';
  const isFinance = currentRole === 'finance';
  const isFinanceOrSuper = isFinance || currentRole === 'superuser';

  const defaultSubView = isStaff ? 'performance' : isFinance ? 'finance' : (initialSubView === 'finance' && !isFinanceOrSuper ? 'hris' : initialSubView);
  const [subView, setSubView] = useState<'hris' | 'finance' | 'performance'>(defaultSubView);
  const [showFinanceNominal, setShowFinanceNominal] = useState<boolean>(false);

  useEffect(() => {
    if (isStaff) {
      setSubView('performance');
    } else if (isFinance && !initialSubView) {
      setSubView('finance');
    } else if (initialSubView) {
      if (initialSubView === 'finance' && !isFinanceOrSuper) {
        setSubView('hris');
      } else {
        setSubView(initialSubView);
      }
    }
  }, [initialSubView, isStaff, isFinance, isFinanceOrSuper]);

  // Today date string in local timezone (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING');

  // Active Project Scoping (When navigated from Project Card)
  const activeSelectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === 'ALL') return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const scopedEmployees = useMemo(() => {
    if (!activeSelectedProject) return employees;
    return employees.filter(e => e.assignedProjectId === activeSelectedProject.id);
  }, [employees, activeSelectedProject]);

  const scopedEmployeeIds = useMemo(() => {
    return new Set(scopedEmployees.map(e => e.id));
  }, [scopedEmployees]);

  const scopedAttendances = useMemo(() => {
    if (!activeSelectedProject) return attendances;
    return attendances.filter(a => scopedEmployeeIds.has(a.employeeId));
  }, [attendances, scopedEmployeeIds, activeSelectedProject]);

  const scopedProjects = useMemo(() => {
    if (!activeSelectedProject) return projects;
    return [activeSelectedProject];
  }, [projects, activeSelectedProject]);
  
  // Daily attendances for the selected date
  const dailyAttendances = useMemo(() => {
    return scopedAttendances.filter(a => a.date === selectedDate);
  }, [scopedAttendances, selectedDate]);

  const todayAttendances = dailyAttendances.slice(0, 4);

  // Financial aggregates
  const totalAllocatedBudget = scopedProjects.reduce((acc, p) => acc + (p.allocatedBudget || 0), 0);
  const totalActualLaborCost = scopedProjects.reduce((acc, p) => acc + (p.actualLaborCost || 0), 0);
  const overallBurnPercentage = totalAllocatedBudget > 0 ? Math.round((totalActualLaborCost / totalAllocatedBudget) * 100) : 0;

  // HR aggregates for selected date (default: today)
  const onTimeCount = dailyAttendances.filter(a => !a.isLate && a.mode === 'WFO').length;
  const lateCount = dailyAttendances.filter(a => a.isLate).length;
  const dinasCount = dailyAttendances.filter(a => a.mode === 'DINAS_LUAR').length;
  const inGeofenceCount = dailyAttendances.filter(a => a.location?.inGeofence).length;

  // Monthly payroll estimate
  const totalBaseSalary = scopedEmployees.reduce((acc, e) => acc + e.baseSalary, 0);
  const totalAllowances = scopedEmployees.reduce((acc, e) => acc + e.fixedAllowance + (e.dailyAllowance * 22), 0);
  const totalOvertimeEst = 0;
  const totalGrossPayroll = totalBaseSalary + totalAllowances;
  const totalNetPayrollDisbursement = Math.round(totalGrossPayroll * 0.91);

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      
      {/* Active Project Filter Capsule (When Navigated from Project Card) */}
      {activeSelectedProject && (
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border border-orange-300/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs motion-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase font-mono-code px-2 py-0.5 rounded-md bg-[#FF6B00] text-white">
                  {activeSelectedProject.code}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {activeSelectedProject.name}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  • {activeSelectedProject.client || 'PT Dwi Martha Jaya'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Menampilkan telemetri presensi & analitik kerja untuk <strong>{scopedEmployees.length} personel</strong> bertugas di site {activeSelectedProject.location || 'Lapangan'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => onNavigateToTab('project_dashboard', activeSelectedProject.id)}
              className="px-3.5 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Buka Dashboard Khusus Proyek</span>
            </button>
            <button
              onClick={() => onNavigateToTab('projects')}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              Kembali ke Proyek
            </button>
            <button
              onClick={() => {
                if (onSelectProjectId) onSelectProjectId('ALL');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-[#FF6B00] text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Tampilkan seluruh proyek perusahaan"
            >
              <span>✕ Semua Proyek</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Dual Dashboard Segmented Switcher Header */}
      {/* Perspective Switcher */}
      {!isStaff && (
        <div className="bg-white/90 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-slate-200/80 shadow-xs motion-fade-in-down w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono-code">Workspace Portal</span>
            </div>

            <div
              id="tour-dashboard-subview"
              className={`grid ${isFinanceOrSuper ? 'grid-cols-3' : 'grid-cols-2'} sm:flex sm:items-center gap-1 sm:gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 w-full sm:w-auto min-w-0`}
            >
              {/* Button 1: Operasional SDM */}
              <button
                onClick={() => setSubView('hris')}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-center ${
                  subView === 'hris'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  <span className="inline sm:hidden">SDM</span>
                  <span className="hidden sm:inline">Operasional SDM</span>
                </span>
              </button>

              {/* Button 2: Finance & Payroll (Only for Finance & Superuser) */}
              {isFinanceOrSuper && (
                <button
                  onClick={() => setSubView('finance')}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-center ${
                    subView === 'finance'
                      ? 'bg-[#FF6B00] text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="inline sm:hidden">Finance</span>
                    <span className="hidden sm:inline">Finance & Payroll</span>
                  </span>
                </button>
              )}

              {/* Button 3: Kinerja Saya (MENONJOL DENGAN AKSEN BIRU) */}
              <button
                onClick={() => setSubView('performance')}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-center ${
                  subView === 'performance'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-blue-700 bg-blue-50/90 hover:bg-blue-100 border border-blue-200/80 shadow-2xs hover:text-blue-900 font-extrabold'
                }`}
                title="Buka Portal Kinerja Saya"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Kinerja Saya</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: DASHBOARD HRIS & OPERASIONAL SDM
         ========================================================================= */}
      {!isStaff && subView === 'hris' && (
        <div className="space-y-5 motion-fade-in-up">
          
          {/* Compact HRIS Action Bar */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 px-5 py-3.5 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight">
                  Monitoring Operasional SDM
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Presensi: {dailyAttendances.length} dari {employees.length} staf hadir {selectedDate === todayStr ? 'hari ini' : `(${selectedDate})`}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateToTab('attendance')}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Presensi Kamera</span>
              </button>
              <button
                onClick={() => onNavigateToTab('approvals')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#00E2B0]" />
                <span>Approval ({pendingApprovals.length})</span>
              </button>
            </div>
          </div>

          {/* 4 HRIS KPI Cards */}
          <div id="tour-dashboard-metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Total Karyawan */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Total Tenaga Kerja
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-code">
                {employees.length} <span className="text-xs font-normal text-slate-500">Personel</span>
              </div>
            </div>

            {/* Metric 2: Kehadiran Hari Ini */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Kehadiran Terlapor
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-code">
                {dailyAttendances.length} / {employees.length}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                <span>{onTimeCount} Tepat Waktu</span>
                <span>•</span>
                <span className="text-blue-700">{dinasCount} Dinas Luar</span>
              </div>
            </div>

            {/* Metric 3: Kepatuhan Lokasi & Geofence */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Kepatuhan Lokasi
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-teal-700 font-mono-code">
                {dailyAttendances.length > 0 ? Math.round((inGeofenceCount / dailyAttendances.length) * 100) : 100}%
              </div>
            </div>

            {/* Metric 4: Antrean Approval */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Persetujuan Pending
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-orange-600 font-mono-code">
                {pendingApprovals.length} <span className="text-xs font-normal text-slate-500">Berkas</span>
              </div>
            </div>

          </div>

          {/* INTERACTIVE TIMELINE CHART FOR HRIS */}
          <div id="tour-dashboard-charts">
            <HrisTimelineChart
              employees={employees}
              projects={projects}
              salaryRules={salaryRules}
              attendances={attendances}
              approvals={approvals}
              onNavigateToTab={onNavigateToTab}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          {/* Operational Feeds: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Sebaran Tenaga Kerja per Divisi & Proyek */}
            <div className="lg:col-span-2 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#FF6B00]" />
                    Penugasan Tim & Karyawan
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateToTab('users')}
                  className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer flex items-center gap-1"
                >
                  Buka User Management <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {employees.slice(0, 6).map((emp) => {
                  const assignedProj = projects.find(p => p.id === emp.assignedProjectId);
                  return (
                    <div
                      key={emp.id}
                      className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 transition-all flex items-center gap-3 card-interactive"
                    >
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-black text-slate-900 truncate">{emp.name}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 font-mono-code shrink-0">
                            {emp.employmentType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{emp.position}</p>
                        <p className="text-[10px] text-orange-600 font-mono-code font-bold truncate mt-0.5">
                          ⚡ {assignedProj ? assignedProj.name : 'Workshop HQ'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Summary & Link to User Management */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-mono-code text-[11px]">
                  Menampilkan 3 baris ({Math.min(6, employees.length)} dari {employees.length} staf)
                </span>
                <button
                  onClick={() => onNavigateToTab('users')}
                  className="font-bold text-[#FF6B00] hover:underline cursor-pointer flex items-center gap-1"
                >
                  Lihat Semua Karyawan ({employees.length}) <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Right 1 Col: Antrean Approval & Presensi Feed */}
            <div className="space-y-4">
              
              {/* Approval Quick Queue */}
              <div className="glass-card rounded-2xl p-5 border border-slate-200/80 space-y-3 card-interactive">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Antrean Approval Cepat
                  </h3>
                  <button
                    onClick={() => onNavigateToTab('approvals')}
                    className="text-[11px] font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Buka Hub
                  </button>
                </div>

                {pendingApprovals.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                    Tidak ada permohonan pending saat ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingApprovals.slice(0, 2).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onNavigateToTab('approvals')}
                        className="p-3 rounded-xl bg-slate-50 hover:bg-orange-50/60 border border-slate-200/60 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-mono-code">
                            {item.type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono-code">{item.startDate}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 truncate">{item.employeeName}</p>
                        <p className="text-[11px] text-slate-600 line-clamp-1">{item.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feed Presensi Hari Ini */}
              <div className="glass-card rounded-2xl p-5 border border-slate-200/80 space-y-3 card-interactive">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#FF6B00]" />
                    Feed Presensi Kamera Live
                  </h3>
                  <button
                    onClick={() => onNavigateToTab('attendance')}
                    className="text-[11px] font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Kamera
                  </button>
                </div>

                <div className="space-y-2.5">
                  {todayAttendances.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-2.5"
                    >
                      <img
                        src={item.photoUrl}
                        alt="Check In"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-300 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.employeeName}</p>
                          <span className="text-[10px] font-mono-code font-bold text-emerald-600">
                            {item.checkInTime}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#FF6B00]" />
                          {typeof item.location.distanceMeters === 'number' && !isNaN(item.location.distanceMeters) ? `${item.location.distanceMeters}m Geofence` : 'Geofence Valid'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 2: DASHBOARD FINANCE & AKUNTANSI PROYEK
         ========================================================================= */}
      {!isStaff && subView === 'finance' && isFinanceOrSuper && (
        <div className="space-y-6 motion-fade-in-up">
          
          {/* Executive Compact Action Bar for Finance */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white shadow-md border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                <Banknote className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Finance & Payroll Proyek
                  <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Live
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  Estimasi THP & realisasi anggaran proyek
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowFinanceNominal(prev => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                  showFinanceNominal
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                }`}
                title="Toggle visibilitas angka nominal finansial (default: sensor)"
              >
                {showFinanceNominal ? <EyeOff className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5 text-[#00E2B0]" />}
                <span>{showFinanceNominal ? 'Sembunyikan Nominal' : 'Tampilkan Nominal'}</span>
              </button>

              <button
                onClick={() => onNavigateToTab('payroll')}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Banknote className="w-3.5 h-3.5" />
                Payroll Hub
              </button>
              <button
                onClick={() => onNavigateToTab('projects')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#00E2B0]" />
                Biaya Proyek
              </button>
            </div>
          </div>

          {/* 4 Finance KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Estimasi Pengeluaran Payroll Bersih (THP) */}
            <div className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Estimasi Payroll Bersih (THP)
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono-code">
                {formatSalaryDisplay(totalNetPayrollDisbursement, showFinanceNominal)}
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Jadwal transfer: 25 September 2026</span>
              </div>
            </div>

            {/* Metric 2: Akumulasi Lembur Depnaker */}
            <div className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Tunjangan & Operasional
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 font-mono-code">
                {formatSalaryDisplay(totalAllowances, showFinanceNominal)}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Tunjangan Tetap, Jabatan & Uang Harian
              </div>
            </div>

            {/* Metric 3: Total Budget Tenaga Kerja Proyek */}
            <div className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Total Budget Labor Proyek
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code">
                {totalAllocatedBudget > 0 ? formatSalaryDisplay(totalAllocatedBudget, showFinanceNominal) : 'Belum Ditentukan (TBD)'}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Terbagi ke {projects.length} Proyek Operasional Aktif
              </div>
            </div>

            {/* Metric 4: Burn Rate Anggaran Proyek */}
            <div className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all border border-slate-200/80 card-interactive">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                  Burn Rate Keseluruhan
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#FF6B00] font-mono-code">
                {totalAllocatedBudget > 0 ? `${overallBurnPercentage}%` : '0% (TBD)'}
              </div>
              <div className="mt-2 text-xs text-slate-500 font-semibold">
                {totalAllocatedBudget > 0
                  ? `Sisa Cadangan: ${formatSalaryDisplay(totalAllocatedBudget - totalActualLaborCost, showFinanceNominal)}`
                  : 'Sisa Cadangan: Menunggu Penetapan Nilai Kontrak'}
              </div>
            </div>

          </div>

          {/* INTERACTIVE TIMELINE CHART FOR FINANCE */}
          <FinanceTimelineChart
            projects={projects}
            employees={employees}
            salaryRules={salaryRules}
            onNavigateToTab={onNavigateToTab}
          />

          {/* Project Cost Allocation Table & Budget Burn Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Project EAC & Budget Status */}
            <div className="lg:col-span-2 glass-card rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#FF6B00]" />
                    Status Anggaran Proyek
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateToTab('payroll')}
                  className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer flex items-center gap-1"
                >
                  Buka Payroll <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((proj) => {
                  const hasBudget = (proj.allocatedBudget || 0) > 0;
                  const burn = hasBudget ? Math.round((proj.actualLaborCost / proj.allocatedBudget) * 100) : 0;
                  const isOverrunRisk = hasBudget && proj.projectedLaborCost > proj.allocatedBudget;

                  return (
                    <div
                      key={proj.id}
                      className="p-4 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all space-y-3 card-interactive"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[#FF6B00] text-[10px] font-black uppercase font-mono-code">
                          {proj.code}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          !hasBudget
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : isOverrunRisk
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {!hasBudget ? 'Pagu TBD' : isOverrunRisk ? 'Risiko Overrun' : 'On Track'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{proj.name}</h4>

                      <div className="space-y-1.5 pt-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Budget Awal:</span>
                          <span className="font-bold text-slate-800 font-mono-code">
                            {hasBudget ? formatSalaryDisplay(proj.allocatedBudget, showFinanceNominal) : <span className="text-slate-400 font-sans italic text-[11px]">Belum Ditentukan (TBD)</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Realisasi Saat Ini:</span>
                          <span className="font-black text-emerald-700 font-mono-code">{formatSalaryDisplay(proj.actualLaborCost, showFinanceNominal)}</span>
                        </div>
                      </div>

                      {/* Burn Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] font-mono-code text-slate-500">
                          <span>Burn Rate Anggaran</span>
                          <span className="font-bold text-slate-800">{hasBudget ? `${burn}%` : 'TBD'}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              burn > 85 ? 'bg-rose-500' : burn > 60 ? 'bg-amber-500' : 'bg-[#00E2B0]'
                            }`}
                            style={{ width: `${hasBudget ? Math.min(burn, 100) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex justify-end">
                        <button
                          onClick={() => onNavigateToTab('payroll', proj.id)}
                          className="text-[11px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Filter Gaji Proyek Ini <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 1 Col: Komposisi Beban Payroll & Aksi Cepat */}
            <div className="space-y-4">
              
              {/* Komposisi Komponen Payroll */}
              <div className="glass-card rounded-2xl p-5 border border-slate-200/80 space-y-3 card-interactive">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-emerald-600" />
                  Komposisi Komponen Biaya Gaji
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600">Gaji Pokok Karyawan</span>
                    <span className="font-bold text-slate-900 font-mono-code">{formatSalaryDisplay(totalBaseSalary, showFinanceNominal)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600">Tunjangan Tetap & Jabatan</span>
                    <span className="font-bold text-slate-900 font-mono-code">{formatSalaryDisplay(employees.reduce((acc, e) => acc + e.fixedAllowance, 0), showFinanceNominal)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600">Uang Makan / Harian</span>
                    <span className="font-bold text-slate-900 font-mono-code">{formatSalaryDisplay(employees.reduce((acc, e) => acc + (e.dailyAllowance * 22), 0), showFinanceNominal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1.5 font-black text-slate-900 text-xs">
                    <span>Total Beban Bruto</span>
                    <span className="font-mono-code">{formatSalaryDisplay(totalGrossPayroll, showFinanceNominal)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Action Finance */}
              <div className="glass-card rounded-2xl p-5 border border-slate-200/80 space-y-3 card-interactive">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#FF6B00]" />
                  Aksi Laporan Finansial
                </h3>

                <div className="space-y-2">
                  <button
                    onClick={() => onNavigateToTab('payroll')}
                    className="w-full px-4 py-2.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white font-bold text-xs transition-all flex items-center justify-between cursor-pointer shadow-xs"
                  >
                    <span>Cetak Rekap Gaji & Slip</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onNavigateToTab('payroll')}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span>Atur Gaji Karyawan & Cutoff</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 3: DASHBOARD USER PERFORMANCE & PORTAL KARYAWAN
         ========================================================================= */}
      {(isStaff || subView === 'performance') && (
        <UserPerformanceTab
          currentUser={currentUser}
          employees={isStaff ? [currentUser] : scopedEmployees}
          allEmployees={isStaff ? [currentUser] : employees}
          projects={projects}
          attendances={isStaff ? scopedAttendances.filter(a => a.employeeId === currentUser.id) : scopedAttendances}
          approvals={isStaff ? approvals.filter(a => a.employeeId === currentUser.id) : approvals}
          salaryRules={salaryRules}
          onSubmitNewLeaveRequest={onSubmitNewLeaveRequest}
          onNavigateToTab={onNavigateToTab}
          selectedProjectId={selectedProjectId}
        />
      )}

    </div>
  );
};
