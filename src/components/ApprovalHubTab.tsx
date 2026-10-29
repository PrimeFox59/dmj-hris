import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Briefcase,
  Calendar,
  FileText,
  Filter,
  Plus,
  Search,
  Sparkles,
  Send,
  X,
  Plane,
  Zap,
  Info,
  AlertTriangle,
  Crown,
  Building2,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Employee, ApprovalItem, LeaveType, SystemRole, getEffectiveSystemRole, Project } from '../types';
import { LeaveGanttChartTab } from './LeaveGanttChartTab';

interface ApprovalHubTabProps {
  approvals: ApprovalItem[];
  employees: Employee[];
  projects?: Project[];
  currentUser: Employee;
  onApprove: (id: string, reviewerNote?: string) => void;
  onReject: (id: string, reviewerNote?: string) => void;
  onRequestRevision: (id: string, reviewerNote?: string) => void;
  onSubmitNewLeaveRequest: (item: ApprovalItem) => void;
  initialOpenNewRequest?: boolean;
  onNavigateToTab?: (tabId: string, projectId?: string) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  initialSubTab?: 'list' | 'gantt';
}

export const ApprovalHubTab: React.FC<ApprovalHubTabProps> = ({
  approvals,
  employees,
  projects = [],
  currentUser,
  onApprove,
  onReject,
  onRequestRevision,
  onSubmitNewLeaveRequest,
  initialOpenNewRequest = false,
  onNavigateToTab,
  onUpdateEmployee,
  initialSubTab = 'list'
}) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isHrManager = Boolean(
    currentRole === 'hr' || 
    currentUser.role === 'HR_Manager' || 
    (currentUser.position && /HR|HRD|Human Resources/i.test(currentUser.position)) || 
    (currentUser.department && /HR|HRD|Human Resources/i.test(currentUser.department))
  );

  // Proyek & Project Manager Detection
  const managedProjects = React.useMemo(() => {
    return (projects || []).filter(p => p.projectManagerId === currentUser.id);
  }, [projects, currentUser.id]);

  const isProjectManager = managedProjects.length > 0 || currentUser.role === 'Project_Manager';

  const managedProjectIds = React.useMemo(() => {
    return new Set(managedProjects.map(p => p.id));
  }, [managedProjects]);

  const isStaff = currentRole === 'staff' && !isHrManager && !isProjectManager;
  const isApprover = (currentRole === 'superuser' || currentRole === 'admin' || currentRole === 'hr' || isHrManager || isProjectManager) && !isStaff;

  // Helper untuk mencari proyek karyawan
  const getEmployeeProject = React.useCallback((empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return null;
    return (projects || []).find(p => 
      p.id === emp.assignedProjectId || 
      p.code === emp.assignedProjectId ||
      (p.assignedEmployeeIds && p.assignedEmployeeIds.includes(emp.id))
    );
  }, [employees, projects]);

  const currentUserProject = React.useMemo(() => {
    return getEmployeeProject(currentUser.id);
  }, [getEmployeeProject, currentUser.id]);

  const currentUserProjectManager = React.useMemo(() => {
    if (!currentUserProject?.projectManagerId) return null;
    return employees.find(e => e.id === currentUserProject.projectManagerId);
  }, [currentUserProject, employees]);

  // Hak Akses Persetujuan Item (Otoritas Validasi PM vs HR)
  const canUserApproveItem = React.useCallback((item: ApprovalItem): boolean => {
    // Tidak bisa menyetujui pengajuan milik sendiri
    if (item.employeeId === currentUser.id) return false;

    // Superuser, Admin, HR Manager memiliki hak persetujuan universal
    if (currentRole === 'superuser' || currentRole === 'admin' || isHrManager) {
      return true;
    }

    // Untuk cuti reguler: HR Manager memegang otoritas utama
    if (item.type === 'LEAVE' && !isHrManager) {
      return false;
    }

    // Jika pengajuan berasal dari staf proyek:
    const applicantProj = (projects || []).find(p => 
      p.id === item.projectId || 
      p.code === item.projectCode ||
      p.id === employees.find(e => e.id === item.employeeId)?.assignedProjectId
    );

    // Karyawan Tanpa Proyek: Secara default HANYA HR Manager yang berhak approve
    if (!applicantProj || !applicantProj.projectManagerId) {
      return isHrManager;
    }

    // Karyawan Dengan Proyek: PM proyek tersebut berhak approve
    if (applicantProj.projectManagerId === currentUser.id) {
      return true;
    }

    return false;
  }, [currentUser.id, currentRole, isHrManager, projects, employees]);

  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'gantt'>(initialSubTab || 'list');

  // Review Modal State
  const [reviewModalItem, setReviewModalItem] = useState<{
    item: ApprovalItem;
    action: 'APPROVE' | 'REJECT' | 'REVISE';
  } | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');

  // Submit Leave Request Modal State
  const [showNewRequestModal, setShowNewRequestModal] = useState(initialOpenNewRequest || false);

  // Background Scroll Lock saat modal terbuka agar viewport tetap terkunci di layar aktif
  useEffect(() => {
    if (showNewRequestModal || reviewModalItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showNewRequestModal, reviewModalItem]);

  // Perhitungan Hak & Saldo Cuti Karyawan
  const annualLeaveQuota = typeof currentUser.leaveQuota === 'number' ? currentUser.leaveQuota : 12;
  const annualLeaveUsed = typeof currentUser.usedLeave === 'number' ? currentUser.usedLeave : 0;

  // Hitung cuti tahunan yang masih PENDING milik karyawan ini
  const pendingAnnualLeaveDays = React.useMemo(() => {
    return approvals
      .filter(a => a.employeeId === currentUser.id && a.type === 'LEAVE' && a.status === 'PENDING' && (a.leaveType === 'CUTI_TAHUNAN' || !a.leaveType))
      .reduce((sum, a) => sum + (a.daysCount || 0), 0);
  }, [approvals, currentUser.id]);

  // Sisa kuota bersih yang benar-benar bisa diajukan
  const currentRemainingLeave = Math.max(0, annualLeaveQuota - annualLeaveUsed - pendingAnnualLeaveDays);

  // Date helper functions
  const calculateDaysDiff = (startDateStr: string, endDateStr: string): number => {
    if (!startDateStr || !endDateStr) return 1;
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    if (end < start) return 1;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  const addDaysToDate = (startDateStr: string, days: number): string => {
    if (!startDateStr) return '';
    const d = new Date(startDateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return startDateStr;
    d.setDate(d.getDate() + Math.max(0, days - 1));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatIndonesianDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const todayWib = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [newRequestType, setNewRequestType] = useState<'LEAVE' | 'PERMIT' | 'ATTENDANCE_CORRECTION'>('LEAVE');
  const [newLeaveType, setNewLeaveType] = useState<LeaveType>('CUTI_TAHUNAN');
  const [newStartDate, setNewStartDate] = useState(todayWib || '2026-10-10');
  const [newEndDate, setNewEndDate] = useState(todayWib || '2026-10-10');
  const [newDaysCount, setNewDaysCount] = useState(1);
  const [newTitle, setNewTitle] = useState('Permohonan Cuti Tahunan');
  const [newDescription, setNewDescription] = useState('Keperluan keluarga di luar kota.');
  const [isEarlySubmission, setIsEarlySubmission] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [agreeUnpaidDeduction, setAgreeUnpaidDeduction] = useState(false);
  const [offScheduleReason, setOffScheduleReason] = useState('');

  // State Khusus Koreksi Absensi Mandiri
  const [correctionDate, setCorrectionDate] = useState(todayWib || '2026-10-12');
  const [targetCheckInTime, setTargetCheckInTime] = useState('08:00:00');
  const [targetCheckOutTime, setTargetCheckOutTime] = useState('17:00:00');
  const [targetAttendanceStatus, setTargetAttendanceStatus] = useState<'ON_TIME' | 'LATE' | 'DINAS_LUAR'>('ON_TIME');
  const [correctionReasonPreset, setCorrectionReasonPreset] = useState('Lupa Check-In Saat Tiba di Lokasi');

  // Bi-directional Date & Days Sync Handlers
  const handleStartDateChange = (val: string) => {
    setNewStartDate(val);
    if (!newEndDate || newEndDate < val) {
      setNewEndDate(val);
      setNewDaysCount(1);
    } else {
      const days = calculateDaysDiff(val, newEndDate);
      setNewDaysCount(days);
    }
  };

  const handleEndDateChange = (val: string) => {
    if (val < newStartDate) {
      setNewStartDate(val);
      setNewEndDate(val);
      setNewDaysCount(1);
    } else {
      setNewEndDate(val);
      const days = calculateDaysDiff(newStartDate, val);
      setNewDaysCount(days);
    }
  };

  const handleDaysCountChange = (days: number) => {
    const clamped = Math.max(1, Math.min(60, days));
    setNewDaysCount(clamped);
    if (newStartDate) {
      const calculatedEnd = addDaysToDate(newStartDate, clamped);
      setNewEndDate(calculatedEnd);
    }
  };

  // Validation States
  const selectedCalendarYear = newStartDate ? new Date(newStartDate + 'T00:00:00').getFullYear() : 2026;
  const isAnnualLeave = newRequestType === 'LEAVE' && newLeaveType === 'CUTI_TAHUNAN';
  const isAnnualZero = currentRemainingLeave <= 0;

  // Cuti Roster Non-Lokal Validation & Calculation
  const isRosterLeave = newRequestType === 'LEAVE' && newLeaveType === 'CUTI_ROSTER_NON_LOKAL';
  const rosterBaseQuota = currentUser.nonLokalLeaveConfig?.leaveQuotaPerPeriod || 9;
  const rosterAccumulatedDays = currentUser.nonLokalLeaveConfig?.accumulatedLeaveDays || 0;
  const rosterEffectiveQuota = rosterBaseQuota + rosterAccumulatedDays;
  const rosterUsed = currentUser.nonLokalLeaveConfig?.usedPeriodLeave || 0;
  const pendingRosterLeaveDays = React.useMemo(() => {
    return approvals
      .filter(a => a.employeeId === currentUser.id && a.type === 'LEAVE' && a.status === 'PENDING' && a.leaveType === 'CUTI_ROSTER_NON_LOKAL')
      .reduce((sum, a) => sum + (a.coveredByQuotaDays !== undefined ? a.coveredByQuotaDays : (a.daysCount || 0)), 0);
  }, [approvals, currentUser.id]);
  const rosterRemaining = Math.max(0, rosterEffectiveQuota - rosterUsed - pendingRosterLeaveDays);

  // Relevant remaining quota for currently selected leave type
  const relevantRemainingQuota = isRosterLeave ? rosterRemaining : isAnnualLeave ? currentRemainingLeave : Infinity;
  const isOverQuota = (isAnnualLeave || isRosterLeave) && newDaysCount > relevantRemainingQuota;
  const coveredByQuotaDays = Math.min(newDaysCount, relevantRemainingQuota);
  const unpaidLeaveDays = Math.max(0, newDaysCount - relevantRemainingQuota);
  const annualDeficit = unpaidLeaveDays;
  const projectedRemainingLeave = isAnnualLeave ? currentRemainingLeave - newDaysCount : isRosterLeave ? rosterRemaining - newDaysCount : 0;

  // Off-Schedule Detection for Roster Leave
  const rosterScheduledDate = currentUser.nonLokalLeaveConfig?.nextEligibleLeaveDate;
  const isOffSchedule = isRosterLeave && Boolean(rosterScheduledDate && newStartDate !== rosterScheduledDate);

  // Submit Disabled Guard:
  // - If Attendance Correction: Must provide date, time, and description
  // - If over quota: Must check agreeUnpaidDeduction
  // - If off schedule: Must provide offScheduleReason
  // - If early submission: Must provide earlyReason
  const isSubmitDisabled = 
    newRequestType === 'ATTENDANCE_CORRECTION'
      ? (!correctionDate || !targetCheckInTime || !newDescription.trim())
      : ((isOverQuota && !agreeUnpaidDeduction) ||
         (isOffSchedule && !offScheduleReason.trim()) ||
         (isEarlySubmission && !earlyReason.trim()));

  const handleActionClick = (item: ApprovalItem, action: 'APPROVE' | 'REJECT' | 'REVISE') => {
    setReviewModalItem({ item, action });
    setReviewerNote('');
  };

  const confirmAction = () => {
    if (!reviewModalItem) return;
    const { item, action } = reviewModalItem;

    if (action === 'APPROVE') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      onApprove(item.id, reviewerNote);
    } else if (action === 'REJECT') {
      onReject(item.id, reviewerNote);
    } else {
      onRequestRevision(item.id, reviewerNote);
    }

    setReviewModalItem(null);
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (newRequestType === 'ATTENDANCE_CORRECTION') {
      const targetProj = currentUserProject;
      const pmEmp = currentUserProjectManager;
      const approverRole: 'PM' | 'HR' = (targetProj && pmEmp) ? 'PM' : 'HR';

      const newItem: ApprovalItem = {
        id: `APP-CORR-${Date.now()}`,
        type: 'ATTENDANCE_CORRECTION',
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        employeeNik: currentUser.nik,
        department: currentUser.department,
        title: `Koreksi Absensi: ${formatIndonesianDateDisplay(correctionDate)} (${targetAttendanceStatus === 'ON_TIME' ? 'Tepat Waktu' : targetAttendanceStatus === 'LATE' ? 'Terlambat' : 'Dinas Luar'})`,
        description: `[Alasan: ${correctionReasonPreset}] ${newDescription}`,
        startDate: correctionDate,
        endDate: correctionDate,
        daysCount: 1,
        targetCheckInTime,
        targetCheckOutTime: targetCheckOutTime || undefined,
        targetStatus: targetAttendanceStatus,
        projectId: targetProj?.id,
        projectCode: targetProj?.code,
        projectName: targetProj?.name,
        projectManagerId: pmEmp?.id,
        projectManagerName: pmEmp?.name,
        targetApproverRole: approverRole,
        requiresHrApproval: approverRole === 'HR',
        status: 'PENDING',
        submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      onSubmitNewLeaveRequest(newItem);
      setShowNewRequestModal(false);
      return;
    }

    if (isOverQuota && !agreeUnpaidDeduction) {
      alert(`Permohonan melebihi jatah sah (${relevantRemainingQuota} hari). Harap centang persetujuan Pemotongan Gaji untuk kelebihan ${unpaidLeaveDays} hari.`);
      return;
    }

    if (isOffSchedule && !offScheduleReason.trim()) {
      alert(`Permohonan di luar jadwal roster (${rosterScheduledDate}). Harap lengkapi alasan pengajuan.`);
      return;
    }

    const newItem: ApprovalItem = {
      id: `APP-${Date.now()}`,
      type: newRequestType,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      employeeNik: currentUser.nik,
      department: currentUser.department,
      title: isOverQuota && unpaidLeaveDays > 0 
        ? `${newTitle} (${unpaidLeaveDays} Hr Potong Gaji)` 
        : newTitle,
      description: newDescription,
      startDate: newStartDate,
      endDate: (newStartDate && newDaysCount) ? addDaysToDate(newStartDate, newDaysCount) : newEndDate,
      daysCount: newDaysCount,
      leaveType: newRequestType === 'LEAVE' ? newLeaveType : undefined,
      coveredByQuotaDays: (isAnnualLeave || isRosterLeave) ? coveredByQuotaDays : newDaysCount,
      unpaidLeaveDays: (isAnnualLeave || isRosterLeave) ? unpaidLeaveDays : 0,
      isOverQuota: unpaidLeaveDays > 0,
      isOffSchedule,
      offScheduleReason: isOffSchedule ? offScheduleReason : undefined,
      requiresHrApproval: unpaidLeaveDays > 0 || isOffSchedule,
      isEarlySubmission: isRosterLeave ? isEarlySubmission : undefined,
      earlyReason: isRosterLeave && isEarlySubmission ? earlyReason : undefined,
      status: 'PENDING',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    onSubmitNewLeaveRequest(newItem);
    setShowNewRequestModal(false);
  };

  // Filter base approvals berdasarkan role:
  // - HR / Superuser / Admin: Melihat seluruh pengajuan
  // - PM: Melihat pengajuan miliknya + pengajuan staf dari proyek yang dipimpinnya
  // - Staff: Melihat HANYA pengajuan miliknya sendiri
  const baseApprovals = React.useMemo(() => {
    if (currentRole === 'superuser' || currentRole === 'admin' || isHrManager) {
      return approvals;
    }

    if (isProjectManager) {
      return approvals.filter(item => {
        if (item.employeeId === currentUser.id) return true;
        if (item.projectId && managedProjectIds.has(item.projectId)) return true;
        const applicantEmp = employees.find(e => e.id === item.employeeId);
        if (applicantEmp?.assignedProjectId && managedProjectIds.has(applicantEmp.assignedProjectId)) return true;
        return false;
      });
    }

    return approvals.filter(item => item.employeeId === currentUser.id);
  }, [approvals, currentRole, isHrManager, isProjectManager, currentUser.id, managedProjectIds, employees]);

  const [approvalStartDate, setApprovalStartDate] = useState<string>('');
  const [approvalEndDate, setApprovalEndDate] = useState<string>('');
  const [approvalDatePreset, setApprovalDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH'>('ALL');

  const filteredApprovals = baseApprovals.filter(item => {
    const matchType = filterType === 'ALL' || item.type === filterType;
    const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
    const matchSearch =
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeNik.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchDate = true;
    const itemDate = item.startDate ? item.startDate.slice(0, 10) : item.submittedAt ? item.submittedAt.slice(0, 10) : '';
    if (approvalStartDate && itemDate && itemDate < approvalStartDate) matchDate = false;
    if (approvalEndDate && itemDate && itemDate > approvalEndDate) matchDate = false;

    return matchType && matchStatus && matchSearch && matchDate;
  });

  const [approvalDisplayLimit, setApprovalDisplayLimit] = useState(10);
  const visibleApprovals = React.useMemo(() => {
    return filteredApprovals.slice(0, approvalDisplayLimit);
  }, [filteredApprovals, approvalDisplayLimit]);
  const hasMoreApprovals = approvalDisplayLimit < filteredApprovals.length;

  useEffect(() => {
    setApprovalDisplayLimit(10);
  }, [filterType, filterStatus, searchTerm, approvalStartDate, approvalEndDate]);

  const applyApprovalPreset = (preset: 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH') => {
    setApprovalDatePreset(preset);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (preset === 'ALL') {
      setApprovalStartDate('');
      setApprovalEndDate('');
    } else if (preset === 'TODAY') {
      setApprovalStartDate(todayStr);
      setApprovalEndDate(todayStr);
    } else if (preset === 'LAST_7') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setApprovalStartDate(startStr);
      setApprovalEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setApprovalStartDate(startStr);
      setApprovalEndDate(endStr);
    }
  };

  const pendingCount = baseApprovals.filter(a => a.status === 'PENDING').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 motion-fade-in-down">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="prime-cut-corner bg-[#FF6B00] text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code">
              {isStaff ? 'PORTAL PENGAJUAN SAYA' : isHrManager ? 'PUSAT APPROVAL HR MANAGER' : 'MULTI-TIER APPROVAL SYSTEM'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {isStaff ? 'Status Pengajuan Izin / Cuti Pribadi' : isHrManager ? 'Mode Reviewer (HR Lead & Otorisasi Cuti)' : isApprover ? 'Mode Reviewer (Direksi & HR)' : 'Mode Akses Terbatas'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isStaff ? 'Pengajuan & Status Persetujuan Saya' : 'Pusat Persetujuan Izin, Cuti, Telat & Dinas Luar'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {isStaff
              ? 'Pantau status permohonan dispensasi kehadiran, sisa saldo cuti tahunan, dan justifikasi keterlambatan kerja Anda.'
              : 'Otorisasi berjenjang dengan audit trail digital, pemotongan kuota cuti otomatis, dan mitigasi penalti gaji.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="px-4 py-2 rounded-2xl bg-orange-50 border border-orange-200 text-right">
            <p className="text-[10px] uppercase font-bold text-orange-600">{isStaff ? 'Pengajuan Aktif' : 'Menunggu Persetujuan'}</p>
            <p className="text-xl font-black text-[#FF6B00] font-mono-code">{pendingCount} Pengajuan</p>
          </div>

          <button
            onClick={() => setShowNewRequestModal(true)}
            className="px-5 py-2.5 rounded-2xl btn-orange font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Cuti / Izin / Koreksi</span>
          </button>
        </div>
      </div>

      {/* View Switcher: Daftar Pengajuan vs Gantt Chart Jadwal Cuti */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
        <button
          onClick={() => setActiveSubTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'list'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-[#FF6B00]" />
          <span>Daftar Pengajuan & Otorisasi</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gantt')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'gantt'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-[#FF6B00]" />
          <span>Gantt Chart Jadwal Cuti (Plan vs Aktual)</span>
          <span className="px-1.5 py-0.2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black rounded-md font-mono-code uppercase">
            Roster & Lokal
          </span>
        </button>
      </div>

      {activeSubTab === 'gantt' ? (
        <LeaveGanttChartTab
          employees={employees}
          approvals={approvals}
          projects={projects}
          currentUser={currentUser}
          onNavigateToTab={onNavigateToTab}
          onUpdateEmployee={onUpdateEmployee}
          onSubmitNewLeaveRequest={onSubmitNewLeaveRequest}
          isEmbedded={true}
        />
      ) : (
        <>
          {/* Filter & Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 motion-fade-in-up stagger-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Semua Kategori' },
            { id: 'LEAVE', label: 'Cuti Tahunan & Roster' },
            { id: 'PERMIT', label: 'Izin Sakit / Pribadi' },
            { id: 'ATTENDANCE_CORRECTION', label: 'Koreksi Absensi Mandiri' },
            { id: 'LATE_JUSTIFICATION', label: 'Keterlambatan' },
            { id: 'OUT_OF_GEOFENCE', label: 'Presensi Luar Area' },
            { id: 'DINAS_LUAR', label: 'Dinas Luar Mendadak' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/80 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="glass-input rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Status</option>
            <option value="PENDING">Menunggu Persetujuan</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
            <option value="REVISION_REQUESTED">Minta Revisi</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari karyawan / NIK..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 w-44 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="glass-card rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs motion-fade-in-up">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700 flex items-center gap-1 font-mono-code text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
            Rentang Tanggal Pengajuan:
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={approvalStartDate}
              onChange={e => {
                setApprovalStartDate(e.target.value);
                setApprovalDatePreset('ALL');
              }}
              className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-[#FF6B00]"
              title="Tanggal Mulai"
            />
            <span className="text-slate-400 text-xs font-mono-code">s/d</span>
            <input
              type="date"
              value={approvalEndDate}
              onChange={e => {
                setApprovalEndDate(e.target.value);
                setApprovalDatePreset('ALL');
              }}
              className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-[#FF6B00]"
              title="Tanggal Akhir"
            />
          </div>
          {(approvalStartDate || approvalEndDate) && (
            <button
              type="button"
              onClick={() => applyApprovalPreset('ALL')}
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
              onClick={() => applyApprovalPreset(p.id as any)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono-code transition-all cursor-pointer ${
                approvalDatePreset === p.id && (!approvalStartDate || p.id !== 'ALL')
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Approval Cards List */}
      <div className="space-y-4">
        {filteredApprovals.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Tidak Ada Pengajuan Menunggu</h3>
            <p className="text-xs text-slate-500">Semua pengajuan cuti, izin, dan keterlambatan telah diproses.</p>
          </div>
        ) : (
          visibleApprovals.map((item, idx) => {
            const emp = employees.find(e => e.id === item.employeeId);
            const isPending = item.status === 'PENDING';

            return (
              <div
                key={item.id}
                style={{ animationDelay: `${(idx + 1) * 60}ms` }}
                className="glass-card rounded-3xl p-5 sm:p-6 transition-all hover:shadow-lg border border-white/90 space-y-4 motion-fade-in-up card-interactive"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                      {emp?.avatar ? (
                        <img src={emp.avatar} alt={item.employeeName} className="w-full h-full object-cover" />
                      ) : (
                        item.employeeName.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.employeeName}</span>
                        <span className="text-[11px] font-mono-code text-slate-400">({item.employeeNik})</span>
                      </div>
                      <p className="text-xs text-slate-500">{item.department}  {emp?.position}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code ${
                      item.type === 'OUT_OF_GEOFENCE'
                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                        : item.type === 'DINAS_LUAR'
                        ? 'bg-amber-100 text-amber-800'
                        : item.type === 'LATE_JUSTIFICATION'
                        ? 'bg-rose-100 text-rose-800'
                        : item.type === 'LEAVE'
                        ? 'bg-blue-100 text-blue-800'
                        : item.type === 'ATTENDANCE_CORRECTION'
                        ? 'bg-teal-100 text-teal-800 border border-teal-300'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.type === 'OUT_OF_GEOFENCE' ? 'LUAR GEOFENCE' : item.type === 'ATTENDANCE_CORRECTION' ? 'KOREKSI ABSENSI' : item.type.replace('_', ' ')}
                    </span>

                    {(item.type === 'ATTENDANCE_CORRECTION' || item.type === 'OUT_OF_GEOFENCE') && (
                      item.targetApproverRole === 'PM' && item.projectManagerName ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>PM: {item.projectManagerName} ({item.projectCode || 'SITE'})</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-indigo-50 text-indigo-900 border border-indigo-200 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-600" />
                          <span>HR APPROVAL ONLY (TANPA PROYEK)</span>
                        </span>
                      )
                    )}

                    {item.leaveType === 'CUTI_ROSTER_NON_LOKAL' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-purple-100 text-purple-800 flex items-center gap-1">
                        <Plane className="w-3 h-3 text-purple-600" />
                        <span>ROSTER NON-LOKAL</span>
                      </span>
                    )}

                    {(item.isOverQuota || (item.unpaidLeaveDays && item.unpaidLeaveDays > 0)) && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-rose-100 text-rose-800 flex items-center gap-1 border border-rose-300 shadow-2xs">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>POTONG GAJI ({item.unpaidLeaveDays} HARI)</span>
                      </span>
                    )}

                    {item.isOffSchedule && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-300">
                        <Calendar className="w-3 h-3 text-amber-600" />
                        <span>DI LUAR JADWAL ROSTER</span>
                      </span>
                    )}

                    {item.requiresHrApproval && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono-code bg-indigo-50 text-indigo-700 border border-indigo-200">
                        HR APPROVAL
                      </span>
                    )}

                    {item.isEarlySubmission && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-300">
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>AJUKAN LEBIH AWAL</span>
                      </span>
                    )}

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item.status === 'PENDING'
                        ? 'bg-orange-100 text-orange-800 animate-pulse'
                        : item.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                  <div className="md:col-span-8 space-y-2">
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                      {item.description}
                    </p>

                    {(item.type === 'ATTENDANCE_CORRECTION' || item.type === 'OUT_OF_GEOFENCE') && (
                      <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 text-teal-950 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold border-b border-teal-200/60 pb-1.5">
                          <span className="flex items-center gap-1.5 text-teal-900 font-mono-code">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            Koreksi Presensi Tanggal: {formatIndonesianDateDisplay(item.startDate)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-bold ${
                            item.targetStatus === 'ON_TIME'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.targetStatus === 'LATE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.targetStatus === 'ON_TIME' ? 'Tepat Waktu' : item.targetStatus === 'LATE' ? 'Terlambat' : 'Dinas Luar'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
                          <div className="p-2 rounded-xl bg-white border border-teal-100">
                            <span className="text-[10px] text-slate-400 block uppercase">Jam Masuk (Check-In)</span>
                            <b className="text-teal-900 text-xs">{item.targetCheckInTime || '-'} WIB</b>
                          </div>
                          <div className="p-2 rounded-xl bg-white border border-teal-100">
                            <span className="text-[10px] text-slate-400 block uppercase">Jam Pulang (Check-Out)</span>
                            <b className="text-teal-900 text-xs">{item.targetCheckOutTime ? `${item.targetCheckOutTime} WIB` : '-'}</b>
                          </div>
                        </div>
                        <div className="text-[11px] pt-1 text-slate-700 flex items-center justify-between flex-wrap gap-1">
                          {item.projectName ? (
                            <span className="flex items-center gap-1 text-amber-900 font-medium">
                              <Crown className="w-3.5 h-3.5 text-amber-600" />
                              <span>Proyek: <b>{item.projectName}</b> ({item.projectCode}) • PM: <b>{item.projectManagerName || 'Belum Ditugaskan'}</b></span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-indigo-900 font-medium">
                              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Staf Kantor Pusat (Tanpa Penugasan Proyek)</span>
                            </span>
                          )}
                          <span className="text-[10px] font-mono-code text-slate-500 bg-white px-2 py-0.5 rounded border border-teal-100">
                            Rute: <b>{item.targetApproverRole === 'PM' ? `PM (${item.projectManagerName || 'Site'}) / HR` : 'HR Manager Saja'}</b>
                          </span>
                        </div>
                      </div>
                    )}

                    {item.earlyReason && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                        <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <b className="font-bold text-amber-900">Alasan Khusus Pengajuan Cuti Lebih Awal:</b>
                          <p className="text-[11.5px] text-amber-800 mt-0.5">{item.earlyReason}</p>
                        </div>
                      </div>
                    )}

                    {item.offScheduleReason && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <b className="font-bold text-amber-900">Alasan Pengajuan di Luar Jadwal Roster:</b>
                          <p className="text-[11.5px] text-amber-800 mt-0.5">{item.offScheduleReason}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px] pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mulai: <b className="text-slate-800">{item.startDate}</b></span>
                      </span>
                      {item.endDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Sampai: <b className="text-slate-800">{item.endDate}</b> ({item.daysCount} hari)</span>
                        </span>
                      )}
                      {item.coveredByQuotaDays !== undefined && (
                        <span className="font-mono-code text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          Tertutup Kuota: <b>{item.coveredByQuotaDays} Hr</b>
                          {item.unpaidLeaveDays ? <b className="text-rose-600"> • Potong Gaji: {item.unpaidLeaveDays} Hr</b> : null}
                        </span>
                      )}
                      {item.lateMinutes && (
                        <span className="flex items-center gap-1 text-rose-600 font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Keterlambatan: {item.lateMinutes} Menit</span>
                        </span>
                      )}
                      {item.leaveType && (
                        <span className="font-mono-code font-bold text-slate-700">
                          Tipe Cuti: {item.leaveType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quota & Review History */}
                  <div className="md:col-span-4 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 flex flex-col justify-between">
                    <div>
                      {item.type === 'ATTENDANCE_CORRECTION' ? (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-teal-800 uppercase font-mono-code flex items-center gap-1">
                            <Clock className="w-3 h-3 text-teal-600" />
                            Validasi Koreksi Absensi
                          </p>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between text-slate-600">
                              <span>Status Proyek:</span>
                              <b className="text-slate-800">{item.projectName || 'Pusat / Non-Site'}</b>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Leader / PM:</span>
                              <b className="text-slate-800">{item.projectManagerName || 'HR Manager'}</b>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Penegakan Hak:</span>
                              <span className="text-[10.5px] font-bold text-teal-700">
                                {item.targetApproverRole === 'PM' ? 'PM Proyek / HR' : 'HR Manager Saja'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Status Saldo Cuti</p>
                          {emp ? (
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span className="text-slate-600">Jatah Tahunan:</span>
                              <span className="font-bold text-slate-900">{emp.leaveQuota} Hari</span>
                            </div>
                          ) : null}
                          {emp ? (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Sisa Kuota:</span>
                              <span className="font-black text-emerald-600">{emp.leaveQuota - emp.usedLeave} Hari</span>
                            </div>
                          ) : null}

                          {emp?.workLocationType === 'NON_LOKAL' && emp.nonLokalLeaveConfig && (
                            <div className="mt-2 pt-2 border-t border-purple-200/70 space-y-1">
                              <p className="text-[10px] font-bold text-purple-800 uppercase flex items-center gap-1 font-mono-code">
                                <Plane className="w-3 h-3 text-purple-600" />
                                Cuti Roster Non-Lokal (3 Bln)
                              </p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600">Jatah Pokok / Periode:</span>
                                <span className="font-bold text-purple-900">{emp.nonLokalLeaveConfig.leaveQuotaPerPeriod} Hari</span>
                              </div>
                              {emp.nonLokalLeaveConfig.accumulatedLeaveDays ? (
                                <div className="flex items-center justify-between text-xs text-amber-800">
                                <span>+ Akumulasi HR:</span>
                                <span className="font-bold font-mono-code">+{emp.nonLokalLeaveConfig.accumulatedLeaveDays} Hari</span>
                              </div>
                            ) : null}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Terpakai Periode Ini:</span>
                              <span className="font-bold text-slate-800">{emp.nonLokalLeaveConfig.usedPeriodLeave || 0} Hari</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-semibold text-purple-950">
                              <span>Sisa Roster Sah:</span>
                              <span className="font-bold font-mono-code">
                                {Math.max(0, (emp.nonLokalLeaveConfig.leaveQuotaPerPeriod + (emp.nonLokalLeaveConfig.accumulatedLeaveDays || 0)) - (emp.nonLokalLeaveConfig.usedPeriodLeave || 0))} Hari
                              </span>
                            </div>
                            {emp.nonLokalLeaveConfig.nextEligibleLeaveDate && (
                              <div className="text-[10px] text-purple-700 font-mono-code">
                                Jadwal Berikutnya: {emp.nonLokalLeaveConfig.nextEligibleLeaveDate}
                              </div>
                            )}
                          </div>
                        )}

                        {typeof emp?.unpaidLeaveDaysTotal === 'number' && emp.unpaidLeaveDaysTotal > 0 && (
                          <div className="mt-2 pt-2 border-t border-rose-200 text-[10.5px] font-mono-code text-rose-700 flex items-center justify-between">
                            <span>Akumulasi Potong Gaji:</span>
                            <span className="font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">
                              {emp.unpaidLeaveDaysTotal} Hari
                            </span>
                          </div>
                        )}
                        </>
                      )}
                    </div>

                    {item.reviewedBy && (
                      <div className="pt-2 border-t border-slate-200/70 text-[11px]">
                        <p className="text-slate-500">Direview oleh: <b className="text-slate-800">{item.reviewedBy}</b></p>
                        {item.reviewNote && (
                          <p className="text-slate-600 italic mt-0.5">"{item.reviewNote}"</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Bar for Approver */}
                {isPending && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      {item.type === 'LEAVE' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono-code bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                          <span>{isHrManager ? 'Otorisasi HR Manager Aktif' : 'Otorisasi Persetujuan Cuti: HR Manager'}</span>
                        </span>
                      )}
                      {(item.type === 'ATTENDANCE_CORRECTION' || item.type === 'OUT_OF_GEOFENCE') && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono-code bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>
                            {item.targetApproverRole === 'PM' && item.projectManagerName
                              ? `Persetujuan: PM ${item.projectManagerName} / HR Manager`
                              : 'Persetujuan: HR Manager Saja (Staf Tanpa Proyek)'}
                          </span>
                        </span>
                      )}
                    </div>
                    {canUserApproveItem(item) ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleActionClick(item, 'REVISE')}
                          className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Minta Revisi
                        </button>
                        <button
                          onClick={() => handleActionClick(item, 'REJECT')}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                        <button
                          onClick={() => handleActionClick(item, 'APPROVE')}
                          className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui (Approve)</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-800 font-medium bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                        {item.type === 'ATTENDANCE_CORRECTION'
                          ? (item.targetApproverRole === 'PM' && item.projectManagerName
                              ? `Menunggu persetujuan PM (${item.projectManagerName}) / HR Manager`
                              : 'Menunggu persetujuan HR Manager (Staf Tanpa Proyek)')
                          : item.type === 'LEAVE'
                          ? 'Permohonan Cuti sedang menunggu persetujuan HR Manager'
                          : 'Menunggu review atasan berwenang'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {filteredApprovals.length > 10 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 text-xs motion-fade-in-up">
            <span className="text-slate-500 font-mono-code text-[11px]">
              Menampilkan <span className="font-bold text-slate-800">{Math.min(approvalDisplayLimit, filteredApprovals.length)}</span> dari <span className="font-bold text-slate-800">{filteredApprovals.length}</span> pengajuan
            </span>
            <div className="flex items-center gap-2">
              {hasMoreApprovals ? (
                <button
                  type="button"
                  onClick={() => setApprovalDisplayLimit(prev => Math.min(prev + 10, filteredApprovals.length))}
                  className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-orange-200 hover:border-[#FF6B00] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Muat 10 Pengajuan Lagi ({filteredApprovals.length - approvalDisplayLimit} Tersisa)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setApprovalDisplayLimit(10)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ciutkan (Tampilkan 10)</span>
                </button>
              )}
              {hasMoreApprovals && (
                <button
                  type="button"
                  onClick={() => setApprovalDisplayLimit(filteredApprovals.length)}
                  className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold text-xs transition-all cursor-pointer"
                >
                  Tampilkan Semua
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Review Action Confirmation Modal (Portal to document.body for guaranteed viewport centering) */}
      {reviewModalItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setReviewModalItem(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 modal-dialog-animate my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                Konfirmasi {reviewModalItem.action === 'APPROVE' ? 'Persetujuan' : reviewModalItem.action === 'REJECT' ? 'Penolakan' : 'Permintaan Revisi'}
              </h3>
              <button
                onClick={() => setReviewModalItem(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin memproses pengajuan <b>{reviewModalItem.item.title}</b> dari <b>{reviewModalItem.item.employeeName}</b>?
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Catatan Reviewer / Alasan (Opsional)</label>
              <textarea
                rows={3}
                value={reviewerNote}
                onChange={e => setReviewerNote(e.target.value)}
                placeholder="Tuliskan alasan persetujuan, penolakan, atau poin yang perlu direvisi..."
                className="w-full glass-input rounded-2xl p-3 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewModalItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmAction}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer ${
                  reviewModalItem.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : reviewModalItem.action === 'REJECT'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Konfirmasi Sekarang
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Form Submission Modal for New Leave / Permit (Portal to document.body for guaranteed viewport centering) */}
      {showNewRequestModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setShowNewRequestModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 modal-dialog-animate my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Formulir Permohonan Cuti / Izin</h3>
                <p className="text-xs text-slate-500">Pemohon: {currentUser.name} ({currentUser.nik})</p>
              </div>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Kategori Permohonan</label>
                  <select
                    value={newRequestType}
                    onChange={e => {
                      const val = e.target.value as 'LEAVE' | 'PERMIT' | 'ATTENDANCE_CORRECTION';
                      setNewRequestType(val);
                      if (val === 'ATTENDANCE_CORRECTION') {
                        setNewTitle(`Koreksi Absensi: ${formatIndonesianDateDisplay(correctionDate)}`);
                      } else if (val === 'LEAVE') {
                        setNewTitle(newLeaveType === 'CUTI_ROSTER_NON_LOKAL' ? 'Permohonan Cuti Roster' : 'Permohonan Cuti Tahunan');
                      } else {
                        setNewTitle('Permohonan Izin Resmi');
                      }
                    }}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="LEAVE">Cuti Kerja (Tahunan & Roster)</option>
                    <option value="PERMIT">Izin Resmi / Sakit / Pribadi</option>
                    <option value="ATTENDANCE_CORRECTION">📝 Koreksi Absensi Mandiri (Lupa / Kendala Site)</option>
                  </select>
                </div>
                {newRequestType !== 'ATTENDANCE_CORRECTION' ? (
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Jenis Cuti / Izin</label>
                    <select
                      value={newLeaveType}
                      onChange={e => {
                        const val = e.target.value as LeaveType;
                        setNewLeaveType(val);
                        if (val === 'CUTI_ROSTER_NON_LOKAL') {
                          setNewTitle('Permohonan Cuti Roster (Non-Lokal)');
                          const defDays = rosterRemaining > 0 ? rosterRemaining : (currentUser.nonLokalLeaveConfig?.leaveQuotaPerPeriod || 9);
                          setNewDaysCount(defDays);
                          if (newStartDate) {
                            setNewEndDate(addDaysToDate(newStartDate, defDays));
                          }
                        } else if (val === 'CUTI_TAHUNAN') {
                          setNewTitle('Permohonan Cuti Tahunan');
                        }
                      }}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800"
                    >
                      <option value="CUTI_TAHUNAN">Cuti Tahunan (Potong Jatah)</option>
                      <option value="CUTI_ROSTER_NON_LOKAL">✈️ Cuti Roster Non-Lokal (Jatah Tiap 3 Bulan)</option>
                      <option value="CUTI_SAKIT">Cuti Sakit</option>
                      <option value="CUTI_MELAHIRKAN">Cuti Melahirkan</option>
                      <option value="CUTI_MENIKAH">Cuti Menikah</option>
                      <option value="IZIN_KEPERLUAN_PRIBADI">Izin Pribadi</option>
                      <option value="IZIN_DUKA">Izin Duka Cita</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-teal-800 uppercase">Rute Approver Sistem</label>
                    <div className="w-full rounded-xl px-3 py-2 text-xs font-mono-code bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center gap-1.5 truncate">
                      {currentUserProject && currentUserProjectManager ? (
                        <>
                          <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">PM: {currentUserProjectManager.name} ({currentUserProject.code})</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">HR Manager Saja (Tanpa Proyek)</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION KHUSUS KOREKSI ABSENSI MANDIRI */}
              {newRequestType === 'ATTENDANCE_CORRECTION' && (
                <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-teal-200/80">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-teal-950 font-mono-code">
                      <Clock className="w-4 h-4 text-teal-600" />
                      Detail Koreksi Absensi Mandiri
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-code bg-white text-teal-800 border border-teal-200">
                      APPROVAL PM / HR
                    </span>
                  </div>

                  {/* Routing & Assignment Info Banner */}
                  <div className="p-3 rounded-xl bg-white border border-teal-100 text-xs space-y-1.5 shadow-2xs">
                    {currentUserProject && currentUserProjectManager ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11.5px]">
                          <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Rute Persetujuan: Project Manager ({currentUserProjectManager.name}) & HR Manager</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Anda ditugaskan di proyek <b>{currentUserProject.name}</b> ({currentUserProject.code}). Pengajuan ini akan diteruskan ke Project Manager <b>{currentUserProjectManager.name}</b> untuk validasi operasional, atau HR Manager.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[11.5px]">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>Rute Persetujuan: Langsung HR Manager Saja (Staf Tanpa Proyek)</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Anda terdaftar sebagai karyawan tanpa penugasan proyek lapangan. Pengajuan koreksi ini <b>secara default langsung diajukan hanya kepada HR Manager</b>.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                        Tanggal Absensi yang Dikoreksi
                      </label>
                      <input
                        type="date"
                        value={correctionDate}
                        onChange={e => {
                          setCorrectionDate(e.target.value);
                          setNewTitle(`Koreksi Absensi: ${formatIndonesianDateDisplay(e.target.value)}`);
                        }}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                        Status Kehadiran yang Diajukan
                      </label>
                      <select
                        value={targetAttendanceStatus}
                        onChange={e => setTargetAttendanceStatus(e.target.value as any)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 bg-white"
                      >
                        <option value="ON_TIME">Tepat Waktu (Hadir WFO / Site)</option>
                        <option value="LATE">Terlambat Masuk Shift</option>
                        <option value="DINAS_LUAR">Dinas Luar Lapangan</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                        Jam Masuk (Check-In)
                      </label>
                      <input
                        type="time"
                        step="1"
                        value={targetCheckInTime}
                        onChange={e => setTargetCheckInTime(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 font-mono-code bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                        Jam Pulang (Check-Out)
                      </label>
                      <input
                        type="time"
                        step="1"
                        value={targetCheckOutTime}
                        onChange={e => setTargetCheckOutTime(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 font-mono-code bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                      Kategori Alasan Koreksi
                    </label>
                    <select
                      value={correctionReasonPreset}
                      onChange={e => setCorrectionReasonPreset(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 bg-white"
                    >
                      <option value="Lupa Check-In Saat Tiba di Lokasi Proyek">Lupa Check-In Saat Tiba di Lokasi Proyek</option>
                      <option value="Terkendala Sinyal / Jaringan Seluler di Site">Terkendala Sinyal / Jaringan Seluler di Site</option>
                      <option value="Kendala GPS Geofence Lokasi Lapangan">Kendala GPS Geofence Lokasi Lapangan</option>
                      <option value="Perangkat HP Baterai Habis / Rusak">Perangkat HP Baterai Habis / Rusak</option>
                      <option value="Tugas Lapangan Mendadak / Tanggap Darurat">Tugas Lapangan Mendadak / Tanggap Darurat</option>
                      <option value="Lainnya">Alasan Lainnya (Jelaskan di Catatan)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* INDIKATOR SALDO CUTI DINAMIS (MENGARAHKAN LANGSUNG KE TANGGAL & KUOTA) */}
              {newRequestType === 'LEAVE' && newLeaveType === 'CUTI_TAHUNAN' && (
                <div className={`p-4 rounded-2xl border transition-all ${
                  isAnnualZero
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                    : isOverQuota
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between pb-2.5 border-b border-black/5">
                    <span className="font-bold flex items-center gap-1.5 text-xs font-mono-code">
                      <Calendar className={`w-4 h-4 ${isAnnualZero ? 'text-rose-600' : isOverQuota ? 'text-amber-600' : 'text-emerald-600'}`} />
                      Indikator Saldo Cuti Tahunan ({selectedCalendarYear})
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono-code ${
                      isAnnualZero
                        ? 'bg-rose-200/80 text-rose-800 border border-rose-300'
                        : isOverQuota
                        ? 'bg-amber-200/80 text-amber-800 border border-amber-300'
                        : 'bg-emerald-200/80 text-emerald-800 border border-emerald-300'
                    }`}>
                      {isAnnualZero ? '⚠️ Saldo Habis' : isOverQuota ? `⚠️ Defisit ${unpaidLeaveDays} Hari` : '✓ Kuota Tersedia'}
                    </span>
                  </div>

                  {/* 3-Kolom Metric Cards */}
                  <div className="grid grid-cols-3 gap-2 py-3 text-center text-xs">
                    <div className="p-2 bg-white/90 rounded-xl border border-black/5 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Hak Cuti</span>
                      <span className="font-black text-slate-900 font-mono-code text-sm">
                        {annualLeaveQuota} Hari
                      </span>
                    </div>
                    <div className="p-2 bg-white/90 rounded-xl border border-black/5 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Terpakai</span>
                      <span className="font-black text-slate-700 font-mono-code text-sm">
                        {annualLeaveUsed} Hari
                        {pendingAnnualLeaveDays > 0 && (
                          <span className="text-[9.5px] font-normal text-amber-600 block">(+{pendingAnnualLeaveDays} Pending)</span>
                        )}
                      </span>
                    </div>
                    <div className={`p-2 rounded-xl border shadow-2xs ${
                      isAnnualZero
                        ? 'bg-rose-100/60 border-rose-200 text-rose-900'
                        : isOverQuota
                        ? 'bg-amber-100/60 border-amber-200 text-amber-900'
                        : 'bg-emerald-100/60 border-emerald-200 text-emerald-900'
                    }`}>
                      <span className="text-[10px] uppercase font-bold block">Sisa Saldo Kuota</span>
                      <span className="font-black font-mono-code text-sm">
                        {currentRemainingLeave} Hari
                      </span>
                    </div>
                  </div>

                  {/* Real-Time Date Range & Sisa Simulation Bar */}
                  <div className="bg-white/80 p-2.5 rounded-xl border border-black/5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Rentang Pengajuan:</span>
                      <span className="font-bold font-mono-code text-slate-900">
                        {formatIndonesianDateDisplay(newStartDate)} s/d {formatIndonesianDateDisplay(newEndDate)} ({newDaysCount} Hari)
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>Estimasi Saldo Setelah Cuti:</span>
                      <span className={`font-black font-mono-code ${
                        projectedRemainingLeave < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {projectedRemainingLeave < 0 ? `Defisit ${Math.abs(projectedRemainingLeave)} Hari (Kondisi Potong Gaji)` : `${projectedRemainingLeave} Hari Tersisa`}
                      </span>
                    </div>
                  </div>

                  {/* Warning / Error / Success Alert Messages */}
                  {isOverQuota && (
                    <div className="mt-2.5 p-3 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-950 text-[11px] space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Pengajuan Melebihi Kuota Sah: {unpaidLeaveDays} Hari Potong Gaji</span>
                      </div>
                      <p className="text-[10.5px] text-rose-800">
                        Sisa kuota tahunan Anda adalah <b>{currentRemainingLeave} hari</b>. Pengajuan sebesar <b>{newDaysCount} hari</b> memiliki kelebihan <b>{unpaidLeaveDays} hari</b> yang akan diproses sebagai <b>Cuti di Luar Jatah (Kondisi Potong Gaji)</b> dan memerlukan persetujuan langsung HR Manager.
                      </p>
                      <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-rose-200">
                        <input
                          type="checkbox"
                          checked={agreeUnpaidDeduction}
                          onChange={e => setAgreeUnpaidDeduction(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded cursor-pointer mt-0.5 shrink-0"
                          required
                        />
                        <span className="text-[10.5px] font-semibold text-rose-900 leading-tight">
                          Saya memahami dan menyetujui pemotongan gaji pro-rata sebesar {unpaidLeaveDays} hari kelebihan cuti di luar kuota sah ini.
                        </span>
                      </label>
                    </div>
                  )}

                  {!isOverQuota && (
                    <div className="mt-2.5 p-2 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-950 text-[11px] flex items-center gap-1.5 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Sisa kuota cuti Anda mencukupi untuk durasi {newDaysCount} hari ini.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Informative Banner for Non-Annual Leave Types */}
              {newRequestType === 'LEAVE' && newLeaveType !== 'CUTI_TAHUNAN' && newLeaveType !== 'CUTI_ROSTER_NON_LOKAL' && (
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-blue-900">Kategori Izin Resmi / Khusus</b>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Jenis permohonan ini tidak memotong kuota Cuti Tahunan reguler. Tetap memerlukan persetujuan dari HR Manager serta kelengkapan berkas pendukung (surat dokter / surat keterangan).
                    </p>
                  </div>
                </div>
              )}

              {newRequestType === 'PERMIT' && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-slate-900">Permohonan Izin Resmi / Dispensasi</b>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Permohonan izin dispensasi kehadiran atau urusan kedinasan. Tidak memotong kuota cuti tahunan karyawan.
                    </p>
                  </div>
                </div>
              )}

              {/* Roster Leave Status & Early/Off-Schedule Submission Section */}
              {newRequestType === 'LEAVE' && newLeaveType === 'CUTI_ROSTER_NON_LOKAL' && (
                <div className="p-4 rounded-2xl bg-purple-50/90 border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-purple-200/80">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5 font-mono-code text-[11px]">
                      <Plane className="w-3.5 h-3.5 text-purple-600" />
                      Status Jatah Cuti Roster Non-Lokal
                    </span>
                    <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200 font-mono-code">
                      ROSTER DMJ
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-xl border border-purple-100 shadow-2xs">
                      <span className="text-[9.5px] text-slate-400 block font-bold uppercase">Jatah Pokok</span>
                      <span className="font-black text-purple-900 font-mono-code text-sm">
                        {rosterBaseQuota} Hari
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-purple-100 shadow-2xs">
                      <span className="text-[9.5px] text-slate-400 block font-bold uppercase">+ Akumulasi HR</span>
                      <span className="font-black text-amber-700 font-mono-code text-sm">
                        +{rosterAccumulatedDays} Hari
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-purple-100 shadow-2xs">
                      <span className="text-[9.5px] text-slate-400 block font-bold uppercase">Total Sah</span>
                      <span className="font-black text-purple-950 font-mono-code text-sm">
                        {rosterEffectiveQuota} Hari
                      </span>
                    </div>
                    <div className="p-2 bg-purple-100/70 rounded-xl border border-purple-200 shadow-2xs">
                      <span className="text-[9.5px] text-purple-800 block font-bold uppercase">Sisa Kuota</span>
                      <span className="font-black text-purple-900 font-mono-code text-sm">
                        {rosterRemaining} Hari
                      </span>
                    </div>
                  </div>

                  {/* Real-time simulation */}
                  <div className="bg-white/90 p-2.5 rounded-xl border border-purple-100 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Jadwal Resmi Roster:</span>
                      <span className="font-bold font-mono-code text-purple-900">
                        {rosterScheduledDate || 'Sesuai Jadwal'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Rentang Pengajuan:</span>
                      <span className="font-bold font-mono-code text-slate-900">
                        {formatIndonesianDateDisplay(newStartDate)} s/d {formatIndonesianDateDisplay(newEndDate)} ({newDaysCount} Hari)
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>Status Tertutup Kuota:</span>
                      <span className={`font-black font-mono-code ${unpaidLeaveDays > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {unpaidLeaveDays > 0 
                          ? `${coveredByQuotaDays} Hari Kuota + ${unpaidLeaveDays} Hari Potong Gaji` 
                          : `${newDaysCount} Hari Ditutup Kuota Sah Penuh`}
                      </span>
                    </div>
                  </div>

                  {/* Off-Schedule Warning & Mandatory Reason */}
                  {isOffSchedule && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Pengajuan di Luar Jadwal Roster Terjadwal ({rosterScheduledDate})</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Anda mengajukan cuti roster pada tanggal <b>{newStartDate}</b>. Karena berada di luar periode jadwal resmi, permohonan memerlukan alasan justifikasi dan persetujuan khusus Manager / HR Manager.
                      </p>
                      <div>
                        <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                          Alasan Pengajuan di Luar Jadwal (Wajib Diisi):
                        </label>
                        <input
                          type="text"
                          value={offScheduleReason}
                          onChange={e => setOffScheduleReason(e.target.value)}
                          placeholder="Contoh: Tiket pesawat rotasi dimajukan / kebutuhan keluarga mendesak..."
                          className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 border-amber-300"
                          required={isOffSchedule}
                        />
                      </div>
                    </div>
                  )}

                  {/* Over-Quota Potong Gaji Warning & Confirmation Checkbox */}
                  {isOverQuota && unpaidLeaveDays > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 space-y-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Kelebihan {unpaidLeaveDays} Hari di Luar Jatah Roster (Kondisi Potong Gaji)</span>
                      </div>
                      <p className="text-[11px] text-rose-800 leading-snug">
                        Sisa kuota roster sah Anda adalah <b>{rosterRemaining} hari</b>. Kelebihan <b>{unpaidLeaveDays} hari</b> akan diproses sebagai <b>Cuti di Luar Jatah (Kondisi Potong Gaji pro-rata)</b> dan memerlukan persetujuan langsung HR Manager.
                      </p>
                      <label className="flex items-start gap-2 cursor-pointer pt-1.5 border-t border-rose-200 select-none">
                        <input
                          type="checkbox"
                          checked={agreeUnpaidDeduction}
                          onChange={e => setAgreeUnpaidDeduction(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded cursor-pointer mt-0.5 shrink-0"
                          required
                        />
                        <span className="text-[10.5px] font-semibold text-rose-900 leading-tight">
                          Saya memahami dan menyetujui pemotongan gaji pro-rata sebesar <b>{unpaidLeaveDays} hari</b> cuti di luar kuota sah roster ini.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Early Leave Checkbox & Reason */}
                  <div className="p-3 rounded-xl bg-white border border-purple-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isEarlySubmission}
                        onChange={e => setIsEarlySubmission(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Ajukan Cuti Lebih Awal dari Jadwal Roster
                      </span>
                    </label>
                    <p className="text-[10.5px] text-slate-500">
                      Centang jika jadwal penerbangan/dandori dimajukan atau ada keperluan mendesak. Pengajuan ini memerlukan approval khusus HR Manager.
                    </p>

                    {isEarlySubmission && (
                      <div className="pt-2">
                        <label className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                          Alasan Pengajuan Cuti Lebih Awal (Wajib Diisi):
                        </label>
                        <input
                          type="text"
                          value={earlyReason}
                          onChange={e => setEarlyReason(e.target.value)}
                          placeholder="Contoh: Tiket pesawat telah direservasi / kebutuhan keluarga mendesak..."
                          className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 border-amber-300"
                          required={isEarlySubmission}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Judul Pengajuan</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800"
                  required
                />
              </div>

              {newRequestType !== 'ATTENDANCE_CORRECTION' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal Mulai</label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="w-full glass-input rounded-xl px-2 py-1.5 text-xs text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal Akhir</label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={e => handleEndDateChange(e.target.value)}
                      className="w-full glass-input rounded-xl px-2 py-1.5 text-xs text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Jumlah Hari</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={newDaysCount}
                      onChange={e => handleDaysCountChange(Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-2 py-1.5 text-xs text-slate-800 font-mono-code font-bold"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">
                  {newRequestType === 'ATTENDANCE_CORRECTION' ? 'Keterangan Tambahan / Kronologi Kendala' : 'Alasan & Penjelasan Detail'}
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 text-xs text-slate-800"
                  placeholder={newRequestType === 'ATTENDANCE_CORRECTION' ? 'Jelaskan kronologi kendala atau alasan koreksi kehadiran...' : 'Jelaskan kebutuhan izin atau cuti ini...'}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                    isSubmitDisabled
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                      : 'btn-orange text-white cursor-pointer active:scale-95 shadow-md'
                  }`}
                >
                  {newRequestType === 'ATTENDANCE_CORRECTION'
                    ? (!correctionDate ? 'Pilih Tanggal Presensi' : !targetCheckInTime ? 'Tentukan Jam Masuk' : !newDescription.trim() ? 'Isi Alasan Koreksi' : 'Kirim Pengajuan Koreksi Absensi')
                    : isOverQuota && !agreeUnpaidDeduction
                    ? 'Centang Konfirmasi Potong Gaji'
                    : isOffSchedule && !offScheduleReason.trim()
                    ? 'Lengkapi Alasan Di Luar Jadwal'
                    : isEarlySubmission && !earlyReason.trim()
                    ? 'Lengkapi Alasan Lebih Awal'
                    : isOverQuota
                    ? `Kirim Permohonan (${unpaidLeaveDays} Hr Potong Gaji)`
                    : 'Kirim Permohonan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
