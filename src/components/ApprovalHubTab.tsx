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
  ChevronUp,
  Check,
  CheckCheck,
  Eye,
  Paperclip,
  ExternalLink,
  HardHat,
  Shield,
  ShieldCheck,
  CreditCard,
  Lock,
  LogOut
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Employee, ApprovalItem, LeaveType, SystemRole, getEffectiveSystemRole, Project } from '../types';
import { 
  isHrEmployee, 
  isFinanceEmployee, 
  isHrManager as checkIsHrManager, 
  isItemWithinUserAuthority, 
  canUserApproveItem as checkUserCanApprove, 
  UserAuthorityContext 
} from '../utils/approvalAuthorityHelper';
import { LeaveGanttChartTab } from './LeaveGanttChartTab';

interface ApprovalHubTabProps {
  approvals: ApprovalItem[];
  employees: Employee[];
  projects?: Project[];
  currentUser: Employee;
  onApprove: (id: string, reviewerNote?: string, options?: { waiveLateDeduction?: boolean; deductionWaived?: boolean }) => void;
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
  const isHrManager = checkIsHrManager(currentUser, currentRole);
  const isFinance = currentRole === 'finance' || currentUser.role === 'Finance' || isFinanceEmployee(currentUser as any);

  // Proyek & Project Manager / Project Admin Detection
  const managedProjects = React.useMemo(() => {
    return (projects || []).filter(p => p.projectManagerId === currentUser.id);
  }, [projects, currentUser.id]);

  const isProjectManager = managedProjects.length > 0 || currentUser.role === 'Project_Manager';

  const managedProjectIds = React.useMemo(() => {
    return new Set(managedProjects.map(p => p.id));
  }, [managedProjects]);

  const adminProjects = React.useMemo(() => {
    return (projects || []).filter(p => p.projectAdminIds && p.projectAdminIds.includes(currentUser.id));
  }, [projects, currentUser.id]);

  const adminProjectIds = React.useMemo(() => {
    return new Set(adminProjects.map(p => p.id));
  }, [adminProjects]);

  const isStaff = !isHrManager && !isFinance && !isProjectManager && adminProjectIds.size === 0 && currentRole !== 'superuser' && currentRole !== 'admin';
  const isApprover = !isStaff;

  // Authority Context SSOT
  const authorityContext: UserAuthorityContext = React.useMemo(() => {
    return {
      currentUser,
      currentRole,
      isHrManager,
      isFinance,
      isProjectManager,
      managedProjectIds,
      adminProjectIds,
      employees,
      projects
    };
  }, [currentUser, currentRole, isHrManager, isFinance, isProjectManager, managedProjectIds, adminProjectIds, employees, projects]);

  // Hak Akses Persetujuan Item (Otoritas Validasi Alur 2-Tahap: PM Proyek ➔ HR Manager / Otorisasi Silang HR ⇄ Finance)
  const canUserApproveItem = React.useCallback((item: ApprovalItem): boolean => {
    return checkUserCanApprove(item, authorityContext);
  }, [authorityContext]);

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
  const [waiveLateDeduction, setWaiveLateDeduction] = useState<boolean>(true);

  // Batch Selection & Batch Review Modal State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModal, setBatchModal] = useState<{
    isOpen: boolean;
    action: 'APPROVE' | 'REJECT';
    targetItems: ApprovalItem[];
    title: string;
    note: string;
  } | null>(null);

  // Detail Modal State (Untuk melihat rincian komprehensif baris)
  const [detailModalItem, setDetailModalItem] = useState<ApprovalItem | null>(null);

  // Submit Leave Request Modal State
  const [showNewRequestModal, setShowNewRequestModal] = useState(initialOpenNewRequest || false);

  // Background Scroll Lock saat modal terbuka agar viewport tetap terkunci di layar aktif
  useEffect(() => {
    if (showNewRequestModal || reviewModalItem || batchModal || detailModalItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showNewRequestModal, reviewModalItem, batchModal, detailModalItem]);

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
    setWaiveLateDeduction(true);
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
      const isLateItem = item.type === 'LATE_JUSTIFICATION' || (item.lateMinutes && item.lateMinutes > 0);
      onApprove(item.id, reviewerNote, isLateItem ? { waiveLateDeduction, deductionWaived: waiveLateDeduction } : undefined);
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

    const targetProj = currentUserProject;
    const pmEmp = currentUserProjectManager;
    const hasPm = Boolean(targetProj && pmEmp && pmEmp.id !== currentUser.id);
    const approverRole: 'PM' | 'HR' = hasPm ? 'PM' : 'HR';

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
      projectId: targetProj?.id,
      projectCode: targetProj?.code,
      projectName: targetProj?.name,
      projectManagerId: pmEmp?.id,
      projectManagerName: pmEmp?.name,
      targetApproverRole: approverRole,
      stage: approverRole,
      requiresHrApproval: true,
      isEarlySubmission: isRosterLeave ? isEarlySubmission : undefined,
      earlyReason: isRosterLeave && isEarlySubmission ? earlyReason : undefined,
      status: 'PENDING',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    onSubmitNewLeaveRequest(newItem);
    setShowNewRequestModal(false);
  };

  // Filter base approvals HANYA yang sesuai dengan authority wewenang user untuk approve:
  // - Superuser / Admin: Melihat seluruh pengajuan enterprise
  // - Finance: Melihat HANYA pengajuan finansial (Slip Access, Kasbon), cross-approval dari HR, dan pengajuan miliknya
  // - PM / Admin Proyek: Melihat HANYA pengajuan staf di bawah proyeknya dan pengajuan miliknya
  // - HR Manager: Melihat pengajuan operasional SDM, cross-approval dari Finance, dan pengajuan miliknya
  // - Staff Biasa: Melihat HANYA pengajuan miliknya sendiri
  const baseApprovals = React.useMemo(() => {
    return (approvals || []).filter(item => isItemWithinUserAuthority(item, authorityContext));
  }, [approvals, authorityContext]);

  const [approvalStartDate, setApprovalStartDate] = useState<string>('');
  const [approvalEndDate, setApprovalEndDate] = useState<string>('');
  const [approvalDatePreset, setApprovalDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH'>('ALL');

  const filteredApprovals = baseApprovals.filter(item => {
    const matchType = filterType === 'ALL' || item.type === filterType;
    const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
    const matchSearch =
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Boolean(item.employeeLoginId) && item.employeeLoginId!.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (Boolean(item.employeeNik) && item.employeeNik!.toLowerCase().includes(searchTerm.toLowerCase()));
    
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

  // Filtered pending items that the current user has permission to approve
  const approvableFilteredPending = React.useMemo(() => {
    return filteredApprovals.filter(item => item.status === 'PENDING' && canUserApproveItem(item));
  }, [filteredApprovals, canUserApproveItem]);

  // Visible pending items that the current user has permission to approve
  const approvableVisiblePending = React.useMemo(() => {
    return visibleApprovals.filter(item => item.status === 'PENDING' && canUserApproveItem(item));
  }, [visibleApprovals, canUserApproveItem]);

  const isAllVisibleSelected =
    approvableVisiblePending.length > 0 &&
    approvableVisiblePending.every(item => selectedIds.has(item.id));

  const isSomeVisibleSelected =
    approvableVisiblePending.some(item => selectedIds.has(item.id)) && !isAllVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        approvableVisiblePending.forEach(i => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        approvableVisiblePending.forEach(i => next.add(i.id));
        return next;
      });
    }
  };

  const handleToggleRowSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleTriggerBatchSelected = (action: 'APPROVE' | 'REJECT') => {
    const targets = filteredApprovals.filter(
      item => selectedIds.has(item.id) && item.status === 'PENDING' && canUserApproveItem(item)
    );
    if (targets.length === 0) return;
    setBatchModal({
      isOpen: true,
      action,
      targetItems: targets,
      title: `${action === 'APPROVE' ? 'Setujui' : 'Tolak'} ${targets.length} Pengajuan Terpilih`,
      note: ''
    });
  };

  const handleTriggerApproveAllFiltered = () => {
    if (approvableFilteredPending.length === 0) return;
    setBatchModal({
      isOpen: true,
      action: 'APPROVE',
      targetItems: approvableFilteredPending,
      title: `Setujui Seluruh ${approvableFilteredPending.length} Pengajuan Sesuai Filter`,
      note: ''
    });
  };

  const executeBatchAction = () => {
    if (!batchModal) return;
    const { action, targetItems, note } = batchModal;

    targetItems.forEach(item => {
      if (action === 'APPROVE') {
        onApprove(item.id, note || 'Disetujui secara massal');
      } else {
        onReject(item.id, note || 'Ditolak secara massal');
      }
    });

    if (action === 'APPROVE') {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 }
      });
    }

    setSelectedIds(prev => {
      const next = new Set(prev);
      targetItems.forEach(i => next.delete(i.id));
      return next;
    });

    setBatchModal(null);
  };

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
              {isStaff
                ? 'PORTAL PENGAJUAN SAYA'
                : isHrManager
                ? 'PUSAT APPROVAL HR MANAGER'
                : isFinance
                ? 'PUSAT APPROVAL DIVISI FINANCE'
                : isProjectManager || adminProjectIds.size > 0
                ? 'PUSAT APPROVAL PROYEK'
                : 'MULTI-TIER APPROVAL SYSTEM'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {isStaff
                ? 'Status Pengajuan Izin / Cuti Pribadi'
                : isHrManager
                ? 'Mode Reviewer (HR Lead & Otorisasi Cuti)'
                : isFinance
                ? 'Mode Reviewer Finansial (Izin Buka Slip & Kasbon)'
                : isProjectManager || adminProjectIds.size > 0
                ? 'Mode Reviewer Proyek (PM & Site)'
                : isApprover
                ? 'Mode Reviewer (Direksi & Superuser)'
                : 'Mode Akses Terbatas'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isStaff
              ? 'Pengajuan & Status Persetujuan Saya'
              : isFinance
              ? 'Pusat Persetujuan Finansial & Buka Slip Gaji'
              : isProjectManager || adminProjectIds.size > 0
              ? 'Pusat Persetujuan Kehadiran & Izin Proyek'
              : 'Pusat Persetujuan Izin, Cuti, Telat & Dinas Luar'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {isStaff
              ? 'Pantau status permohonan dispensasi kehadiran, sisa saldo cuti tahunan, dan justifikasi keterlambatan kerja Anda.'
              : isFinance
              ? 'Otorisasi berjenjang pengajuan kasbon dan izin akses buka rincian slip gaji (10 menit) khusus kewenangan Divisi Finance.'
              : isProjectManager || adminProjectIds.size > 0
              ? 'Otorisasi rekomendasi awal kehadiran personil lapangan, dispensasi roster, dan penugasan proyek.'
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

      {/* View Switcher: Daftar Pengajuan vs Gantt Chart Jadwal Cuti (Icon Buttons) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
        <button
          onClick={() => setActiveSubTab('list')}
          title="Daftar Pengajuan & Otorisasi"
          className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
            activeSubTab === 'list'
              ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <FileText className="w-4 h-4 text-[#FF6B00]" />
        </button>

        <button
          onClick={() => setActiveSubTab('gantt')}
          title="Gantt Chart Jadwal Cuti (Plan vs Aktual) - Roster & Lokal"
          className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
            activeSubTab === 'gantt'
              ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Layers className="w-4 h-4 text-[#FF6B00]" />
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
        {/* Category Pills (Button Icons Tanpa Teks) */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Semua Kategori', icon: Filter },
            { id: 'LEAVE', label: 'Cuti Tahunan & Roster', icon: Plane },
            { id: 'PERMIT', label: 'Izin Sakit / Pribadi', icon: FileText },
            { id: 'ATTENDANCE_CORRECTION', label: 'Koreksi Absensi Mandiri', icon: CheckSquare },
            { id: 'LATE_JUSTIFICATION', label: 'Keterlambatan', icon: Clock },
            { id: 'EARLY_CHECKOUT', label: 'Pulang Lebih Awal', icon: LogOut },
            { id: 'OUT_OF_GEOFENCE', label: 'Presensi Luar Area', icon: MapPin },
            { id: 'DINAS_LUAR', label: 'Dinas Luar Mendadak', icon: Briefcase },
            { id: 'KASBON', label: 'Kasbon Pribadi', icon: CreditCard },
            { id: 'SLIP_ACCESS', label: 'Izin Buka Slip (10 Mnt)', icon: Lock }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                title={tab.label}
                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-700'
                    : 'bg-white/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          {/* Active Category Indicator Label */}
          {filterType !== 'ALL' && (
            <span className="text-[11px] font-mono-code font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap ml-1 animate-in fade-in">
              {
                [
                  { id: 'LEAVE', label: 'Cuti Tahunan & Roster' },
                  { id: 'PERMIT', label: 'Izin Sakit / Pribadi' },
                  { id: 'ATTENDANCE_CORRECTION', label: 'Koreksi Absensi' },
                  { id: 'LATE_JUSTIFICATION', label: 'Keterlambatan' },
                  { id: 'EARLY_CHECKOUT', label: 'Pulang Lebih Awal' },
                  { id: 'OUT_OF_GEOFENCE', label: 'Presensi Luar Area' },
                  { id: 'DINAS_LUAR', label: 'Dinas Luar' },
                  { id: 'KASBON', label: 'Kasbon' },
                  { id: 'SLIP_ACCESS', label: 'Buka Slip' }
                ].find(t => t.id === filterType)?.label
              }
            </span>
          )}
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

      {/* Batch Action Toolbar & Table Container */}
      <div className="space-y-3">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-800">
              Daftar Baris Pengajuan ({filteredApprovals.length})
            </span>
            {selectedIds.size > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] font-bold font-mono-code text-[11px] border border-orange-200">
                {selectedIds.size} baris dipilih
              </span>
            )}
            {approvableFilteredPending.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium font-mono-code text-[11px] border border-amber-200">
                {approvableFilteredPending.length} menunggu otorisasi Anda
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                Reset Pilihan
              </button>
            )}

            {approvableFilteredPending.length > 0 && (isHrManager || isProjectManager || currentRole === 'superuser' || currentRole === 'admin' || currentRole === 'finance' || currentUser.role === 'Finance' || isFinanceEmployee(currentUser as any)) && (
              <button
                type="button"
                onClick={handleTriggerApproveAllFiltered}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer active:scale-95"
                title="Langsung setujui semua pengajuan yang sedang tampil sesuai filter aktif saat ini"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Setujui Semua Hasil Filter ({approvableFilteredPending.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Data Table */}
        {filteredApprovals.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Tidak Ada Pengajuan Menunggu</h3>
            <p className="text-xs text-slate-500">Semua pengajuan cuti, izin, dan keterlambatan telah diproses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm motion-fade-in-up">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wider font-mono-code select-none">
                  <th className="py-3 px-3 text-center w-10 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      ref={el => {
                        if (el) el.indeterminate = isSomeVisibleSelected;
                      }}
                      onChange={handleToggleSelectAllVisible}
                      disabled={approvableVisiblePending.length === 0}
                      className="w-4 h-4 rounded border-slate-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={approvableVisiblePending.length === 0 ? "Tidak ada pengajuan yang dapat dipilih pada halaman ini" : "Pilih Semua yang Menunggu Otorisasi"}
                    />
                  </th>
                  <th className="py-3 px-3 min-w-[190px] max-w-[220px] whitespace-nowrap">Pemohon & Proyek</th>
                  <th className="py-3 px-3 text-center w-24 whitespace-nowrap">Tipe & Rute</th>
                  <th className="py-3 px-3 min-w-[200px] max-w-[240px] whitespace-nowrap">Detail Pengajuan</th>
                  <th className="py-3 px-3 text-center w-28 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-3 text-center w-24 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 text-center w-36 whitespace-nowrap sticky right-0 bg-slate-50/95 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] z-10">Aksi Otorisasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleApprovals.map((item, idx) => {
                  const emp = employees.find(e => e.id === item.employeeId);
                  const isPending = item.status === 'PENDING';
                  const canApprove = canUserApproveItem(item);
                  const isSelected = selectedIds.has(item.id);
                  const isApplicantHr = isHrEmployee(emp) || item.employeeId === 'EMP-022';
                  const isApplicantFinance = isFinanceEmployee(emp) || item.employeeId === 'EMP-015' || item.employeeId === 'EMP-045';
                  const isFinanceItem = item.type === 'SLIP_ACCESS' || item.type === 'KASBON' || item.targetApproverRole === 'FINANCE';

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isSelected ? 'bg-orange-50/50' : idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                    >
                      {/* Checkbox Kolom */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRowSelect(item.id)}
                          disabled={!isPending || !canApprove}
                          className={`w-4 h-4 rounded border-slate-300 text-[#FF6B00] focus:ring-[#FF6B00] ${
                            isPending && canApprove
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed opacity-20'
                          }`}
                          title={
                            !isPending
                              ? 'Pengajuan sudah diproses'
                              : !canApprove
                              ? 'Anda tidak memiliki hak otorisasi untuk pengajuan ini'
                              : 'Pilih untuk batch otorisasi'
                          }
                        />
                      </td>

                      {/* Karyawan & Proyek */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5 max-w-[210px]">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 shadow-2xs">
                            {emp?.avatar ? (
                              <img src={emp.avatar} alt={item.employeeName} className="w-full h-full object-cover" />
                            ) : (
                              item.employeeName.charAt(0)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            {(() => {
                              const loginBadge = emp?.loginId || item.employeeLoginId || (item.employeeId === 'EMP-001' ? 'admin' : '');
                              return (
                                <div className="font-bold text-slate-900 truncate flex items-center gap-1.5" title={`${item.employeeName}${loginBadge ? ` (${loginBadge})` : ''}`}>
                                  <span className="truncate">{item.employeeName}</span>
                                  {loginBadge && (
                                    <span className="text-[10px] font-mono-code font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded shrink-0">
                                      {loginBadge}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            <p className="text-[11px] text-slate-500 truncate" title={`${item.department} • ${emp?.position || '-'}`}>
                              {item.department} • {emp?.position || '-'}
                            </p>
                            {item.projectName ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[9.5px] font-mono-code bg-amber-50 text-amber-900 border border-amber-200/70 px-1.5 py-0.2 rounded font-semibold truncate max-w-[170px]" title={`${item.projectName} (${item.projectCode})`}>
                                  🏗️ {item.projectName}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Tipe & Rute (Icon Only Sesuai Permintaan Mr Prime) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {/* Type Icon Badge */}
                          {item.type === 'OUT_OF_GEOFENCE' ? (
                            <div
                              title="Tipe: Luar Geofence (Presensi di luar radius site resmi)"
                              className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 border border-orange-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <MapPin className="w-3.5 h-3.5 text-orange-600" />
                            </div>
                          ) : item.type === 'LATE_JUSTIFICATION' ? (
                            <div
                              title={`Tipe: Justifikasi Keterlambatan (${item.lateMinutes || 0} Menit)`}
                              className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 border border-rose-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Clock className="w-3.5 h-3.5 text-rose-600" />
                            </div>
                          ) : item.type === 'EARLY_CHECKOUT' ? (
                            <div
                              title={`Tipe: Pulang Lebih Awal (${item.earlyCheckOutMinutes || 0} Menit)`}
                              className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <LogOut className="w-3.5 h-3.5 text-amber-700" />
                            </div>
                          ) : item.type === 'LEAVE' ? (
                            <div
                              title={`Tipe: Pengajuan Cuti / Izin (${item.daysCount || 1} Hari)`}
                              className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 border border-blue-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                          ) : item.type === 'DINAS_LUAR' ? (
                            <div
                              title="Tipe: Surat Perjalanan Dinas Luar (DL)"
                              className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 border border-amber-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Briefcase className="w-3.5 h-3.5 text-amber-700" />
                            </div>
                          ) : item.type === 'ATTENDANCE_CORRECTION' ? (
                            <div
                              title="Tipe: Koreksi Manual Absensi Kepegawaian"
                              className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 border border-teal-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                            </div>
                          ) : item.type === 'KASBON' ? (
                            <div
                              title={`Tipe: Pengajuan Kasbon Pribadi • ${item.title}`}
                              className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 border border-purple-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                            </div>
                          ) : item.type === 'SLIP_ACCESS' ? (
                            <div
                              title={`Tipe: Izin Buka Slip Gaji (10 Menit) • ${item.title}`}
                              className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Lock className="w-3.5 h-3.5 text-emerald-700" />
                            </div>
                          ) : (
                            <div
                              title={`Tipe: ${item.type}`}
                              className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                          )}

                          {/* Route Icon Badge */}
                          {item.pmApprovedBy ? (
                            <div
                              title={`Tahap 1: Disetujui PM (${item.pmApprovedBy}) • Tahap 2: Menunggu Otorisasi Akhir ${
                                isFinanceItem
                                  ? (isApplicantFinance ? 'HR Manager (Otorisasi Silang Finance ➔ HR)' : 'Finance Manager (Divisi Finance)')
                                  : isApplicantHr
                                  ? 'Finance Manager (Otorisasi Silang HR ➔ Finance)'
                                  : isApplicantFinance
                                  ? 'HR Manager (Otorisasi Silang Finance ➔ HR)'
                                  : 'HR Manager'
                              }`}
                              className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                          ) : isFinanceItem ? (
                            <div
                              title={
                                isApplicantFinance
                                  ? "Rute Otorisasi: HR Manager Saja (Otorisasi Silang Finance ➔ HR)"
                                  : "Rute Otorisasi: Divisi Finance (Approval Finansial & Slip Gaji)"
                              }
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help ${
                                isApplicantFinance
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/90'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/90'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                          ) : item.targetApproverRole === 'PM' || (!item.pmApprovedBy && item.projectManagerId) ? (
                            <div
                              title={item.projectManagerName ? `Tahap 1/2: Menunggu Otorisasi PM (${item.projectManagerName})` : 'Tahap 1/2: Menunggu Otorisasi Project Manager'}
                              className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 border border-amber-300/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <HardHat className="w-3.5 h-3.5 text-amber-700" />
                            </div>
                          ) : isApplicantHr ? (
                            <div
                              title="Rute Otorisasi: Finance Manager Saja (Otorisasi Silang HR ➔ Finance)"
                              className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Shield className="w-3.5 h-3.5 text-purple-600" />
                            </div>
                          ) : isApplicantFinance ? (
                            <div
                              title="Rute Otorisasi: HR Manager Saja (Otorisasi Silang Finance ➔ HR)"
                              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                          ) : (
                            <div
                              title="Rute Otorisasi: HR Manager Saja (Tanpa PM Proyek)"
                              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/90 flex items-center justify-center shadow-2xs hover:scale-110 transition-transform cursor-help"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                          )}

                          {/* Roster Non-Lokal Badge */}
                          {item.leaveType === 'CUTI_ROSTER_NON_LOKAL' && (
                            <div
                              title="Kategori Khusus: Roster Non-Lokal (Tiket Pesawat)"
                              className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shadow-2xs text-[10px]"
                            >
                              ✈️
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Detail Pengajuan (Ringkas dengan ...) */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5 max-w-[230px]">
                          <div className="font-bold text-slate-900 text-xs truncate" title={item.title}>
                            {item.title}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate" title={item.description}>
                            {item.description}
                          </p>

                          {item.type === 'ATTENDANCE_CORRECTION' && (
                            <div className="text-[10px] font-mono-code text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded truncate max-w-[220px] border border-teal-200" title={`Target: ${item.targetCheckInTime || '(Tanpa Absen Masuk)'} s/d ${item.targetCheckOutTime || '-'}`}>
                              Target: <b>{item.targetCheckInTime || '(Tanpa Absen Masuk)'}</b> s/d <b>{item.targetCheckOutTime || '-'}</b>
                            </div>
                          )}

                          {item.type === 'KASBON' && item.kasbonData && (
                            <div className="text-[10px] font-mono-code text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200" title={`Nominal Kasbon: Rp ${item.kasbonData.amount.toLocaleString('id-ID')} (${item.kasbonData.repaymentType === 'TOTAL_BULANAN' ? 'Lunas Sekaligus' : `Cicilan ${item.kasbonData.totalInstallments} Bulan`})`}>
                              Nominal: <b>Rp {item.kasbonData.amount.toLocaleString('id-ID')}</b> • {item.kasbonData.repaymentType === 'TOTAL_BULANAN' ? 'Lunas 1 Bln' : `Cicilan ${item.kasbonData.totalInstallments}x (Rp ${item.kasbonData.monthlyDeduction.toLocaleString('id-ID')}/bln)`}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.lateMinutes ? (
                              <span className="inline-block text-[10px] font-bold text-rose-600 font-mono-code">
                                Terlambat: {item.lateMinutes} Menit
                              </span>
                            ) : null}

                            {(item.isOverQuota || (item.unpaidLeaveDays && item.unpaidLeaveDays > 0)) && (
                              <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 font-mono-code">
                                ⚠️ Potong Gaji ({item.unpaidLeaveDays} Hr)
                              </span>
                            )}

                            {item.proofAttachment && (
                              <a
                                href={item.proofAttachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.2 rounded border border-indigo-200 transition-colors"
                                title="Buka Dokumen Bukti Lampiran"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span>Lampiran</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tanggal & Durasi */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="text-[11px] font-mono-code text-slate-700 space-y-0.5">
                          <div className="font-semibold">{formatIndonesianDateDisplay(item.startDate)}</div>
                          {item.endDate && item.endDate !== item.startDate && (
                            <div className="text-slate-400 text-[10px]">s/d {formatIndonesianDateDisplay(item.endDate)}</div>
                          )}
                          {item.daysCount ? (
                            <span className="inline-block px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {item.daysCount} Hari
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Status Pengajuan */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className={`inline-block px-2.5 py-0.8 rounded-full text-[10.5px] font-bold ${
                            item.status === 'PENDING'
                              ? 'bg-orange-100 text-orange-800 animate-pulse'
                              : item.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status === 'PENDING' ? 'Menunggu' : item.status === 'APPROVED' ? 'Disetujui' : item.status === 'REJECTED' ? 'Ditolak' : 'Minta Revisi'}
                          </span>
                          {/* Khusus pengajuan keterlambatan disetujui, tampilkan badge mode denda */}
                          {item.status === 'APPROVED' && (item.type === 'LATE_JUSTIFICATION' || (item.lateMinutes && item.lateMinutes > 0)) && (
                            <div className="pt-0.5">
                              {item.deductionWaived !== false && item.waiveLateDeduction !== false ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Bebas Denda Gaji (Tetap Terhitung Terlambat)">
                                  Bebas Denda
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Disetujui Alasan (Denda Tetap Dipotong dari Payroll)">
                                  Potong Denda
                                </span>
                              )}
                            </div>
                          )}
                          {item.reviewedBy && (
                            <div className="text-[9.5px] text-slate-400 font-mono-code truncate max-w-[100px] mx-auto" title={`Reviewer: ${item.reviewedBy}`}>
                              by {item.reviewedBy}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kolom Aksi (Sticky Right Agar Selalu Terlihat Penuh Tanpa Terpotong) */}
                      <td className={`py-3 px-3 text-center whitespace-nowrap sticky right-0 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] ${
                        isSelected ? 'bg-orange-50/95' : idx % 2 === 1 ? 'bg-slate-50/95' : 'bg-white/95'
                      }`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {isPending && canApprove ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleActionClick(item, 'APPROVE')}
                                title={
                                  !isFinanceItem && (item.targetApproverRole === 'PM' || (!item.pmApprovedBy && item.projectManagerId))
                                    ? "Setujui Tahap 1 (Rekomendasi PM)"
                                    : isFinanceItem
                                    ? (isApplicantFinance ? "Setujui Otorisasi Akhir (HR Manager - Otorisasi Silang)" : item.type === 'SLIP_ACCESS' ? "Setujui Izin Buka Slip (Divisi Finance - Akses 10 Menit)" : "Setujui Otorisasi (Divisi Finance)")
                                    : isApplicantHr
                                    ? "Setujui Otorisasi Akhir (Finance Manager - Otorisasi Silang)"
                                    : isApplicantFinance
                                    ? "Setujui Otorisasi Akhir (HR Manager - Otorisasi Silang)"
                                    : "Setujui Otorisasi Akhir (HR Manager)"
                                }
                                className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow active:scale-90 shrink-0"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleActionClick(item, 'REJECT')}
                                title="Tolak (Reject)"
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-500 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90 shrink-0"
                              >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleActionClick(item, 'REVISE')}
                                title="Minta Revisi"
                                className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white border border-amber-200 hover:border-amber-500 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90 shrink-0"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : isPending && !canApprove ? (
                            <div
                              className={`text-[10px] px-2 py-0.8 rounded-lg font-medium inline-flex items-center gap-1 max-w-[130px] truncate ${
                                isFinanceItem && !isApplicantFinance
                                  ? 'text-emerald-700 bg-emerald-50/90 border border-emerald-200/80'
                                  : 'text-amber-700 bg-amber-50/90 border border-amber-200/80'
                              }`}
                              title={
                                !isFinanceItem && (item.targetApproverRole === 'PM' || (!item.pmApprovedBy && item.projectManagerId))
                                  ? `Menunggu Otorisasi PM Terkait: ${item.projectManagerName || 'Project Manager'}`
                                  : item.pmApprovedBy
                                  ? (isFinanceItem
                                      ? (isApplicantFinance ? 'Disetujui PM • Menunggu Otorisasi Akhir HR Manager (Otorisasi Silang)' : 'Disetujui PM • Menunggu Otorisasi Akhir Finance Manager')
                                      : isApplicantHr
                                      ? 'Disetujui PM • Menunggu Otorisasi Akhir Finance Manager (Otorisasi Silang)'
                                      : isApplicantFinance
                                      ? 'Disetujui PM • Menunggu Otorisasi Akhir HR Manager (Otorisasi Silang)'
                                      : 'Disetujui PM • Menunggu Otorisasi Akhir HR Manager')
                                  : isFinanceItem
                                  ? (isApplicantFinance ? 'Menunggu Otorisasi HR Manager (Otorisasi Silang Finance ➔ HR)' : 'Menunggu Otorisasi Divisi Finance (Approval Finansial & Slip Gaji)')
                                  : isApplicantHr
                                  ? 'Menunggu Otorisasi Finance Manager (Otorisasi Silang HR ➔ Finance)'
                                  : isApplicantFinance
                                  ? 'Menunggu Otorisasi HR Manager (Otorisasi Silang Finance ➔ HR)'
                                  : 'Menunggu Otorisasi HR Manager'
                              }
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-ping ${
                                isFinanceItem && !isApplicantFinance ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}></span>
                              <span className="truncate">
                                {!isFinanceItem && (item.targetApproverRole === 'PM' || (!item.pmApprovedBy && item.projectManagerId))
                                  ? 'Tunggu PM'
                                  : isFinanceItem
                                  ? (isApplicantFinance ? 'Menunggu HR' : 'Menunggu Finance')
                                  : item.pmApprovedBy
                                  ? (isApplicantHr ? 'Menunggu Finance' : 'Menunggu HR')
                                  : isApplicantHr
                                  ? 'Menunggu Finance'
                                  : 'Menunggu HR'}
                              </span>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setDetailModalItem(item)}
                            title="Lihat Detail Lengkap"
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-800 text-slate-600 hover:text-white border border-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90 shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

            {/* Opsi Pemilihan Denda Keterlambatan khusus Persetujuan Keterlambatan */}
            {reviewModalItem.action === 'APPROVE' && (reviewModalItem.item.type === 'LATE_JUSTIFICATION' || (reviewModalItem.item.lateMinutes && reviewModalItem.item.lateMinutes > 0)) && (
              <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Kebijakan Denda ({reviewModalItem.item.lateMinutes || 0} Menit Terlambat)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-200/60 text-amber-800">
                    Wewenang HR
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setWaiveLateDeduction(true)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      waiveLateDeduction
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        waiveLateDeduction ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                      }`}>
                        {waiveLateDeduction && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span>Tanpa Potongan</span>
                    </div>
                    <p className="text-[10px] text-emerald-700/90 mt-1 leading-snug">
                      Bebas denda gaji (Rp 0). <b>Tetap tercatat terlambat</b> di presensi & performa.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaiveLateDeduction(false)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      !waiveLateDeduction
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        !waiveLateDeduction ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'
                      }`}>
                        {!waiveLateDeduction && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span>Dengan Potongan</span>
                    </div>
                    <p className="text-[10px] text-amber-800/90 mt-1 leading-snug">
                      Alasan diterima, denda keterlambatan <b>tetap dipotong</b> di payroll.
                    </p>
                  </button>
                </div>
              </div>
            )}

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
                <p className="text-xs text-slate-500">
                  Pemohon: <span className="font-semibold text-slate-800">{currentUser.name}</span> • <span className="font-mono-code font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded text-[11px]">{currentUser.loginId || (currentUser.id === 'EMP-001' ? 'admin' : currentUser.id)}</span>
                  {currentUser.nik && currentUser.nik.trim() && currentUser.nik !== '-' && !currentUser.nik.startsWith('PRIME-') ? (
                    <span className="text-slate-400 font-mono-code ml-1.5">({currentUser.nik})</span>
                  ) : null}
                </p>
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

      {/* Sticky Floating Action Bar untuk Multi-Select Approval (Portal to document.body) */}
      {selectedIds.size > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom duration-300">
          <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl px-5 py-3 shadow-2xl border border-slate-700/80 flex items-center gap-4 flex-wrap max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-xs font-mono-code">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold">Pengajuan Terpilih</span>
            </div>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleTriggerBatchSelected('APPROVE')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Setujui Terpilih ({selectedIds.size})</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerBatchSelected('REJECT')}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak Terpilih ({selectedIds.size})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Batch Action Confirmation Modal */}
      {batchModal && batchModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setBatchModal(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 modal-dialog-animate my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white ${
                  batchModal.action === 'APPROVE' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  {batchModal.action === 'APPROVE' ? <CheckCheck className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{batchModal.title}</h3>
                  <p className="text-[11px] text-slate-500">Konfirmasi eksekusi batch approval untuk {batchModal.targetItems.length} permohonan</p>
                </div>
              </div>
              <button
                onClick={() => setBatchModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              <span className="text-[11px] font-bold text-slate-600 block uppercase font-mono-code">Daftar Pengajuan:</span>
              {batchModal.targetItems.map(item => (
                <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-900 block truncate">{item.employeeName}</span>
                    <span className="text-[11px] text-slate-500 block truncate">{item.title}</span>
                  </div>
                  <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shrink-0">
                    {item.type}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Catatan Reviewer Bersama (Opsional)</label>
              <textarea
                rows={2}
                value={batchModal.note}
                onChange={e => setBatchModal({ ...batchModal, note: e.target.value })}
                placeholder="Tuliskan catatan otorisasi massal..."
                className="w-full glass-input rounded-2xl p-3 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBatchModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeBatchAction}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer transition-all active:scale-95 ${
                  batchModal.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {batchModal.action === 'APPROVE' ? `Setujui Semua (${batchModal.targetItems.length})` : `Tolak Semua (${batchModal.targetItems.length})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Detail Inspection Modal (Untuk tombol 'Eye' pada tabel) */}
      {detailModalItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setDetailModalItem(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 modal-dialog-animate my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base overflow-hidden shrink-0 shadow-sm">
                  {employees.find(e => e.id === detailModalItem.employeeId)?.avatar ? (
                    <img src={employees.find(e => e.id === detailModalItem.employeeId)?.avatar} alt={detailModalItem.employeeName} className="w-full h-full object-cover" />
                  ) : (
                    detailModalItem.employeeName.charAt(0)
                  )}
                </div>
                <div>
                  {(() => {
                    const detailEmp = employees.find(e => e.id === detailModalItem.employeeId);
                    const detailLoginId = detailEmp?.loginId || detailModalItem.employeeLoginId || (detailModalItem.employeeId === 'EMP-001' ? 'admin' : '');
                    const hasRealNik = Boolean(detailModalItem.employeeNik && detailModalItem.employeeNik.trim() && detailModalItem.employeeNik !== '-' && !detailModalItem.employeeNik.startsWith('PRIME-'));

                    return (
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{detailModalItem.employeeName}</h3>
                        {detailLoginId && (
                          <span className="text-[10px] font-mono-code font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                            {detailLoginId}
                          </span>
                        )}
                        {hasRealNik ? (
                          <span className="text-[11px] font-mono-code text-slate-400">({detailModalItem.employeeNik})</span>
                        ) : null}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-slate-500">
                    {detailModalItem.department} • {employees.find(e => e.id === detailModalItem.employeeId)?.position || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code ${
                detailModalItem.type === 'EARLY_CHECKOUT'
                  ? 'bg-amber-100 text-amber-900 border border-amber-400 font-bold'
                  : detailModalItem.type === 'OUT_OF_GEOFENCE'
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : detailModalItem.type === 'DINAS_LUAR'
                  ? 'bg-amber-100 text-amber-800'
                  : detailModalItem.type === 'LATE_JUSTIFICATION'
                  ? 'bg-rose-100 text-rose-800'
                  : detailModalItem.type === 'LEAVE'
                  ? 'bg-blue-100 text-blue-800'
                  : detailModalItem.type === 'ATTENDANCE_CORRECTION'
                  ? 'bg-teal-100 text-teal-800 border border-teal-300'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {detailModalItem.type === 'EARLY_CHECKOUT' ? 'PULANG LEBIH AWAL' : detailModalItem.type.replace('_', ' ')}
              </span>

              {detailModalItem.leaveType === 'CUTI_ROSTER_NON_LOKAL' && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-purple-100 text-purple-800 flex items-center gap-1">
                  <Plane className="w-3 h-3 text-purple-600" />
                  <span>ROSTER NON-LOKAL</span>
                </span>
              )}

              {detailModalItem.projectName && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono-code bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600" />
                  <span>Proyek: {detailModalItem.projectName} ({detailModalItem.projectCode || 'SITE'})</span>
                </span>
              )}

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                detailModalItem.status === 'PENDING'
                  ? 'bg-orange-100 text-orange-800 animate-pulse'
                  : detailModalItem.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : detailModalItem.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                STATUS: {detailModalItem.status}
              </span>
            </div>

            {/* Description & Subject */}
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">{detailModalItem.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                {detailModalItem.description}
              </p>
            </div>

            {/* Detail Spesifik Presensi Luar Radius / Geofence */}
            {detailModalItem.type === 'OUT_OF_GEOFENCE' && (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-amber-200/80 pb-2">
                  <span className="flex items-center gap-1.5 text-amber-900 font-mono-code">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    Presensi Luar Radius Tanggal: {formatIndonesianDateDisplay(detailModalItem.startDate)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-mono-code font-bold bg-amber-200 text-amber-900 border border-amber-300">
                    Luar Radius / Geofence
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono-code">
                  <div className="p-2.5 rounded-xl bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Jam Masuk (Check-In)</span>
                    <b className="text-amber-900 text-sm">
                      {detailModalItem.targetCheckInTime
                        ? `${detailModalItem.targetCheckInTime} WIB`
                        : (detailModalItem.submittedAt ? `${detailModalItem.submittedAt.split(' ')[1] || ''} WIB` : '-')}
                    </b>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Status Lokasi</span>
                    <b className="text-amber-900 text-sm">{detailModalItem.projectCode || detailModalItem.projectName || 'Luar Area Proyek'}</b>
                  </div>
                </div>
                <div className="text-xs pt-1 text-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    Rute Otorisasi: <b>{detailModalItem.targetApproverRole === 'PM' ? `PM (${detailModalItem.projectManagerName || 'Site'}) / HR Manager` : 'HR Manager Saja'}</b>
                  </span>
                </div>
              </div>
            )}

            {/* Detail Spesifik Koreksi Absensi Mandiri */}
            {detailModalItem.type === 'ATTENDANCE_CORRECTION' && (
              <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 text-teal-950 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-teal-200/60 pb-2">
                  <span className="flex items-center gap-1.5 text-teal-900 font-mono-code">
                    <Clock className="w-4 h-4 text-teal-600" />
                    Koreksi Presensi Tanggal: {formatIndonesianDateDisplay(detailModalItem.startDate)}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-mono-code font-bold ${
                    detailModalItem.targetStatus === 'ON_TIME'
                      ? 'bg-emerald-100 text-emerald-800'
                      : detailModalItem.targetStatus === 'LATE'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {detailModalItem.targetStatus === 'ON_TIME' ? 'Tepat Waktu' : detailModalItem.targetStatus === 'LATE' ? 'Terlambat' : 'Koreksi Absensi'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono-code">
                  <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Jam Masuk (Check-In)</span>
                    <b className="text-teal-900 text-sm">{detailModalItem.targetCheckInTime ? `${detailModalItem.targetCheckInTime} WIB` : '(Tanpa Absen Masuk)'}</b>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Jam Pulang (Check-Out)</span>
                    <b className="text-teal-900 text-sm">{detailModalItem.targetCheckOutTime ? `${detailModalItem.targetCheckOutTime} WIB` : '-'}</b>
                  </div>
                </div>
                <div className="text-xs pt-1 text-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    Rute Otorisasi: <b>{detailModalItem.targetApproverRole === 'PM' ? `PM (${detailModalItem.projectManagerName || 'Site'}) / HR Manager` : 'HR Manager Saja'}</b>
                  </span>
                </div>
              </div>
            )}

            {/* Detail Spesifik Pulang Lebih Awal */}
            {detailModalItem.type === 'EARLY_CHECKOUT' && (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-amber-200/80 pb-2">
                  <span className="flex items-center gap-1.5 text-amber-900 font-mono-code">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Presensi Tanggal: {formatIndonesianDateDisplay(detailModalItem.startDate)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-mono-code font-bold bg-amber-200 text-amber-900 border border-amber-300">
                    Pulang {detailModalItem.earlyCheckOutMinutes || 0} Menit Lebih Awal
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono-code">
                  <div className="p-2.5 rounded-xl bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Jam Pulang Aktual</span>
                    <b className="text-amber-900 text-sm">{detailModalItem.targetCheckOutTime ? `${detailModalItem.targetCheckOutTime} WIB` : '-'}</b>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-amber-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Jadwal Selesai Shift</span>
                    <b className="text-slate-800 text-sm">{detailModalItem.scheduledCheckOutTime ? `${detailModalItem.scheduledCheckOutTime} WIB` : '17:00 WIB'}</b>
                  </div>
                </div>
                <div className="text-xs pt-1 text-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    Rute Otorisasi: <b>{detailModalItem.targetApproverRole === 'PM' ? `Tahap 1: PKM (${detailModalItem.projectManagerName || 'Site'}) ➔ Tahap 2: HR Manager` : 'HR Manager'}</b>
                  </span>
                </div>
              </div>
            )}

            {/* Detail Spesifik Izin Akses Buka Slip Gaji */}
            {detailModalItem.type === 'SLIP_ACCESS' && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold border-b border-emerald-200/60 pb-2">
                  <span className="flex items-center gap-1.5 text-emerald-900 font-mono-code">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    Permohonan Buka Slip Gaji: {detailModalItem.slipPeriod || 'Periode Terpilih'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-mono-code font-bold bg-emerald-100 text-emerald-800">
                    Akses 10 Menit
                  </span>
                </div>
                <p className="text-xs text-emerald-800">
                  Setelah disetujui Finance, rincian slip gaji karyawan akan terbuka otomatis selama 10 menit dan terkunci kembali setelah waktu berakhir.
                </p>
                {detailModalItem.slipAccessExpiresAt && (
                  <div className="text-xs font-mono-code pt-1 text-slate-700">
                    Batas Waktu Akses: <b>{new Date(detailModalItem.slipAccessExpiresAt).toLocaleTimeString('id-ID')} WIB</b>
                  </div>
                )}
                <div className="text-xs pt-1 text-slate-700 flex items-center justify-between flex-wrap gap-2 border-t border-emerald-200/50">
                  <span>
                    Rute Otorisasi: <b>Divisi Finance (Approval Finansial & Akses Slip Gaji)</b>
                  </span>
                </div>
              </div>
            )}

            {/* Durasi & Saldo Cuti */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Calendar className="w-4 h-4 text-[#FF6B00]" />
                  <span>Periode: <b>{formatIndonesianDateDisplay(detailModalItem.startDate)}</b> {detailModalItem.endDate && detailModalItem.endDate !== detailModalItem.startDate ? `s/d ${formatIndonesianDateDisplay(detailModalItem.endDate)}` : ''}</span>
                </span>
                {detailModalItem.daysCount && (
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold font-mono-code text-slate-800">
                    {detailModalItem.daysCount} Hari
                  </span>
                )}
              </div>

              {detailModalItem.proofAttachment && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Dokumen Bukti Lampiran:</span>
                  <a
                    href={detailModalItem.proofAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200 cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Lihat / Unduh Dokumen</span>
                  </a>
                </div>
              )}

              {detailModalItem.reviewedBy && (
                <div className="pt-2 border-t border-slate-200/60 text-[11.5px] text-slate-600">
                  <span>Direview oleh: <b className="text-slate-900">{detailModalItem.reviewedBy}</b></span>
                  {detailModalItem.reviewNote && (
                    <p className="italic text-slate-700 mt-0.5">"{detailModalItem.reviewNote}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Alur Persetujuan Bertingkat (PM Proyek Terkait ➔ HR / Finance Manager [Otorisasi Silang]) */}
            {(() => {
              const detailApplicant = employees.find(e => e.id === detailModalItem.employeeId);
              const isDetailApplicantHr = isHrEmployee(detailApplicant) || detailModalItem.employeeId === 'EMP-022';
              const isDetailApplicantFinance = isFinanceEmployee(detailApplicant) || detailModalItem.employeeId === 'EMP-015' || detailModalItem.employeeId === 'EMP-045';
              const isDetailFinanceItem = detailModalItem.type === 'SLIP_ACCESS' || detailModalItem.type === 'KASBON' || detailModalItem.targetApproverRole === 'FINANCE';

              const finalRoleLabel = isDetailFinanceItem
                ? (isDetailApplicantFinance ? 'HR Manager [Otorisasi Silang Finance ➔ HR]' : 'Finance Manager')
                : isDetailApplicantHr
                ? 'Finance Manager [Otorisasi Silang HR ➔ Finance]'
                : isDetailApplicantFinance
                ? 'HR Manager [Otorisasi Silang Finance ➔ HR]'
                : 'HR Manager';

              return (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>{isDetailFinanceItem ? `Alur Otorisasi Finansial (${finalRoleLabel})` : `Alur Otorisasi Bertingkat (PM Terkait ➔ ${finalRoleLabel})`}</span>
                    </span>
                    <span className="text-[10px] font-mono-code text-slate-500">
                      {isDetailFinanceItem ? 'Otorisasi Finansial' : detailModalItem.projectName ? `Proyek: ${detailModalItem.projectName}` : 'Kantor Pusat / Non-Proyek'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className={`p-2.5 rounded-xl border ${detailModalItem.pmApprovedBy ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : isDetailFinanceItem ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : (!isDetailFinanceItem && (detailModalItem.targetApproverRole === 'PM' || !detailModalItem.pmApprovedBy) && (detailModalItem.projectManagerId || (detailModalItem.projectAdminIds && detailModalItem.projectAdminIds.length > 0))) ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold ring-2 ring-amber-400/30' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                      <div className="text-[9.5px] uppercase font-mono-code tracking-wider text-slate-400">
                        {isDetailFinanceItem ? 'Tahap 1: Verifikasi Sistem' : 'Tahap 1: Otorisasi PM / Admin Proyek'}
                      </div>
                      <div className="font-bold truncate mt-0.5">
                        {isDetailFinanceItem ? 'Langsung Divisi Finance' : detailModalItem.projectManagerName ? `PM: ${detailModalItem.projectManagerName}` : 'Tidak Ada PM'}
                        {!isDetailFinanceItem && detailModalItem.projectAdminNames && detailModalItem.projectAdminNames.length > 0 ? ` (Admin: ${detailModalItem.projectAdminNames.join(', ')})` : ''}
                      </div>
                      <div className="text-[10px] mt-1">
                        {isDetailFinanceItem ? (
                          <span className="text-emerald-700 font-medium">✓ Verifikasi Parameter Slip Valid (Tanpa PM Proyek)</span>
                        ) : detailModalItem.pmApprovedBy ? (
                          <span className="text-emerald-700 font-medium">✓ Disetujui ({detailModalItem.pmApprovedBy})</span>
                        ) : (detailModalItem.projectManagerId || (detailModalItem.projectAdminIds && detailModalItem.projectAdminIds.length > 0)) ? (
                          <span className="text-amber-800 font-medium">⏳ Menunggu Persetujuan PM / Admin Proyek</span>
                        ) : (
                          <span className="text-slate-400">Langsung ke {finalRoleLabel}</span>
                        )}
                      </div>
                      {detailModalItem.pmReviewNote && (
                        <div className="text-[9.5px] italic text-emerald-800 mt-1">"{detailModalItem.pmReviewNote}"</div>
                      )}
                    </div>

                    <div className={`p-2.5 rounded-xl border ${detailModalItem.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : (isDetailFinanceItem || detailModalItem.targetApproverRole === 'HR' || detailModalItem.targetApproverRole === 'FINANCE' || detailModalItem.pmApprovedBy || !detailModalItem.projectManagerId) && detailModalItem.status === 'PENDING' ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold ring-2 ring-indigo-400/30' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      <div className="text-[9.5px] uppercase font-mono-code tracking-wider text-slate-400">
                        Tahap 2: {isDetailFinanceItem ? (isDetailApplicantFinance ? 'Otorisasi HR (Cross-Approval)' : 'Otorisasi Finance') : isDetailApplicantHr ? 'Otorisasi Finance (Cross-Approval)' : 'Otorisasi HR'}
                      </div>
                      <div className="font-bold truncate mt-0.5">{finalRoleLabel}</div>
                      <div className="text-[10px] mt-1">
                        {detailModalItem.status === 'APPROVED' ? (
                          <span className="text-emerald-700 font-medium">✓ Disetujui Final ({(isDetailFinanceItem || isDetailApplicantHr ? detailModalItem.financeApprovedBy : detailModalItem.hrApprovedBy) || detailModalItem.reviewedBy || (isDetailFinanceItem ? 'Finance' : 'HR')})</span>
                        ) : (isDetailFinanceItem || detailModalItem.targetApproverRole === 'HR' || detailModalItem.targetApproverRole === 'FINANCE' || detailModalItem.pmApprovedBy || !detailModalItem.projectManagerId) ? (
                          <span className="text-indigo-700 font-medium">⏳ Siap Diotorisasi {finalRoleLabel}</span>
                        ) : (
                          <span className="text-slate-400">🔒 Terkunci (Tunggu PM)</span>
                        )}
                      </div>
                      {((isDetailFinanceItem || isDetailApplicantHr ? detailModalItem.financeReviewNote : detailModalItem.hrReviewNote) || detailModalItem.reviewNote) && (
                        <div className="text-[9.5px] italic text-indigo-800 mt-1">"{(isDetailFinanceItem || isDetailApplicantHr ? detailModalItem.financeReviewNote : detailModalItem.hrReviewNote) || detailModalItem.reviewNote}"</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>

              {detailModalItem.status === 'PENDING' && canUserApproveItem(detailModalItem) ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const itm = detailModalItem;
                      setDetailModalItem(null);
                      handleActionClick(itm, 'REVISE');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 cursor-pointer transition-colors"
                  >
                    Minta Revisi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const itm = detailModalItem;
                      setDetailModalItem(null);
                      handleActionClick(itm, 'REJECT');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 cursor-pointer transition-colors"
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const itm = detailModalItem;
                      setDetailModalItem(null);
                      handleActionClick(itm, 'APPROVE');
                    }}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white text-xs font-bold cursor-pointer transition-all shadow-xs"
                  >
                    {(() => {
                      const detailApp = employees.find(e => e.id === detailModalItem.employeeId);
                      const isDetailAppHr = isHrEmployee(detailApp) || detailModalItem.employeeId === 'EMP-022';
                      const isDetailAppFin = isFinanceEmployee(detailApp) || detailModalItem.employeeId === 'EMP-015' || detailModalItem.employeeId === 'EMP-045';
                      const isDetailFin = detailModalItem.type === 'SLIP_ACCESS' || detailModalItem.type === 'KASBON' || detailModalItem.targetApproverRole === 'FINANCE';

                      if (!isDetailFin && (detailModalItem.targetApproverRole === 'PM' || (!detailModalItem.pmApprovedBy && (detailModalItem.projectManagerId || (detailModalItem.projectAdminIds && detailModalItem.projectAdminIds.length > 0))))) {
                        return 'Setujui Tahap 1 (Rekomendasi PM / Admin Proyek)';
                      }
                      if (isDetailFin) {
                        return isDetailAppFin ? 'Setujui Akhir (Otorisasi HR)' : detailModalItem.type === 'SLIP_ACCESS' ? 'Setujui Izin Buka Slip (Otorisasi Finance)' : 'Setujui Akhir (Otorisasi Finance)';
                      }
                      return isDetailAppHr ? 'Setujui Akhir (Otorisasi Finance)' : 'Setujui Akhir (Otorisasi HR)';
                    })()}
                  </button>
                </div>
              ) : detailModalItem.status === 'PENDING' && !canUserApproveItem(detailModalItem) ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {(() => {
                      const dApplicant = employees.find(e => e.id === detailModalItem.employeeId);
                      const isDHr = isHrEmployee(dApplicant) || detailModalItem.employeeId === 'EMP-022';
                      const isDFin = isFinanceEmployee(dApplicant) || detailModalItem.employeeId === 'EMP-015' || detailModalItem.employeeId === 'EMP-045';
                      const isDFinanceItem = detailModalItem.type === 'SLIP_ACCESS' || detailModalItem.type === 'KASBON' || detailModalItem.targetApproverRole === 'FINANCE';

                      if (isDFinanceItem) {
                        return isDFin
                          ? 'Menunggu Otorisasi HR Manager (Otorisasi Silang Finance ➔ HR).'
                          : 'Menunggu Otorisasi Divisi Finance (Approval Finansial & Slip Gaji).';
                      }

                      if (!detailModalItem.pmApprovedBy && (detailModalItem.projectManagerId || (detailModalItem.projectAdminIds && detailModalItem.projectAdminIds.length > 0))) {
                        return `Menunggu Otorisasi PM Terkait (${detailModalItem.projectManagerName || 'Project Manager'}) atau Admin Proyek sebelum dapat diproses oleh ${isDHr ? 'Finance Manager' : 'HR Manager'}.`;
                      }
                      return `Telah direkomendasikan PM / Langsung. Menunggu Otorisasi Akhir dari ${isDHr ? 'Finance Manager (Otorisasi Silang HR ➔ Finance)' : isDFin ? 'HR Manager (Otorisasi Silang Finance ➔ HR)' : 'HR Manager'}.`;
                    })()}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}


    </div>
  );
};
