import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCircle2,
  XCircle,
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
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  MessageSquare,
  Shield,
  Banknote,
  Check,
  ChevronRight,
  User,
  Info,
  Plane,
  Zap,
  Crown,
  Building2,
  MapPin
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Employee, ApprovalItem, LeaveType, SystemRole, getEffectiveSystemRole, Project } from '../types';

interface NotificationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  approvals: ApprovalItem[];
  employees: Employee[];
  projects?: Project[];
  currentUser: Employee;
  onApprove: (id: string, reviewerNote?: string) => void;
  onReject: (id: string, reviewerNote?: string) => void;
  onRequestRevision: (id: string, reviewerNote?: string) => void;
  onSubmitNewLeaveRequest: (item: ApprovalItem) => void;
  onNavigateToTab?: (tabId: string) => void;
}

export const NotificationApprovalModal: React.FC<NotificationApprovalModalProps> = ({
  isOpen,
  onClose,
  approvals,
  employees,
  projects = [],
  currentUser,
  onApprove,
  onReject,
  onRequestRevision,
  onSubmitNewLeaveRequest,
  onNavigateToTab
}) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isHrManager = Boolean(
    currentRole === 'hr' || 
    currentUser.role === 'HR_Manager' || 
    (currentUser.position && /HR|HRD|Human Resources/i.test(currentUser.position)) || 
    (currentUser.department && /HR|HRD|Human Resources/i.test(currentUser.department))
  );

  const managedProjects = React.useMemo(() => {
    return (projects || []).filter(p => p.projectManagerId === currentUser.id);
  }, [projects, currentUser.id]);

  const isProjectManager = managedProjects.length > 0 || currentUser.role === 'Project_Manager';

  const managedProjectIds = React.useMemo(() => {
    return new Set(managedProjects.map(p => p.id));
  }, [managedProjects]);

  const isStaff = currentRole === 'staff' && !isHrManager && !isProjectManager;
  const isApprover = (currentRole === 'superuser' || currentRole === 'admin' || currentRole === 'hr' || isHrManager || isProjectManager) && !isStaff;

  const canUserApproveItem = React.useCallback((item: ApprovalItem): boolean => {
    if (item.employeeId === currentUser.id) return false;
    if (currentRole === 'superuser' || currentRole === 'admin' || isHrManager) return true;
    if (item.type === 'LEAVE' && !isHrManager) return false;

    const applicantProj = (projects || []).find(p => 
      p.id === item.projectId || 
      p.code === item.projectCode ||
      p.id === employees.find(e => e.id === item.employeeId)?.assignedProjectId
    );

    if (!applicantProj || !applicantProj.projectManagerId) {
      return isHrManager;
    }

    if (applicantProj.projectManagerId === currentUser.id) {
      return true;
    }

    return false;
  }, [currentUser.id, currentRole, isHrManager, projects, employees]);

  // Modal active tab: 'reviews' | 'notifications' | 'new_request'
  const [activeTab, setActiveTab] = useState<'reviews' | 'notifications' | 'new_request'>('reviews');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Review confirmation / note state
  const [activeReviewAction, setActiveReviewAction] = useState<{
    item: ApprovalItem;
    action: 'APPROVE' | 'REJECT' | 'REVISE';
  } | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');

  // Perhitungan Hak & Saldo Cuti Karyawan
  const annualLeaveQuota = typeof currentUser.leaveQuota === 'number' ? currentUser.leaveQuota : 12;
  const annualLeaveUsed = typeof currentUser.usedLeave === 'number' ? currentUser.usedLeave : 0;

  const pendingAnnualLeaveDays = React.useMemo(() => {
    return approvals
      .filter(a => a.employeeId === currentUser.id && a.type === 'LEAVE' && a.status === 'PENDING' && (a.leaveType === 'CUTI_TAHUNAN' || !a.leaveType))
      .reduce((sum, a) => sum + (a.daysCount || 0), 0);
  }, [approvals, currentUser.id]);

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
  // Submit Leave Request State
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

  const currentUserProject = React.useMemo(() => {
    return (projects || []).find(p => 
      p.id === currentUser.assignedProjectId || 
      p.code === currentUser.assignedProjectId ||
      (p.assignedEmployeeIds && p.assignedEmployeeIds.includes(currentUser.id))
    );
  }, [projects, currentUser]);

  const currentUserProjectManager = React.useMemo(() => {
    if (!currentUserProject?.projectManagerId) return null;
    return employees.find(e => e.id === currentUserProject.projectManagerId);
  }, [currentUserProject, employees]);

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

  // Submit Disabled Guard
  const isSubmitDisabled = 
    newRequestType === 'ATTENDANCE_CORRECTION'
      ? (!correctionDate || !targetCheckInTime || !newDescription.trim())
      : ((isOverQuota && !agreeUnpaidDeduction) ||
         (isOffSchedule && !offScheduleReason.trim()) ||
         (isEarlySubmission && !earlyReason.trim()));

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Filtered approvals based on role (Must be called unconditionally to obey React Rules of Hooks):
  // - HR / Superuser / Admin: Melihat seluruh pengajuan
  // - PM: Melihat pengajuan miliknya + pengajuan staf dari proyek yang dipimpinnya
  // - Staff: Melihat HANYA pengajuan miliknya sendiri
  const relevantApprovals = React.useMemo(() => {
    if (currentRole === 'superuser' || currentRole === 'admin' || isHrManager) {
      return approvals || [];
    }
    if (isProjectManager) {
      return (approvals || []).filter(item => {
        if (item.employeeId === currentUser.id) return true;
        if (item.projectId && managedProjectIds.has(item.projectId)) return true;
        const applicantEmp = (employees || []).find(e => e.id === item.employeeId);
        if (applicantEmp?.assignedProjectId && managedProjectIds.has(applicantEmp.assignedProjectId)) return true;
        return false;
      });
    }
    return (approvals || []).filter(item => item.employeeId === currentUser.id);
  }, [approvals, currentRole, isHrManager, isProjectManager, currentUser.id, managedProjectIds, employees]);

  const pendingApprovals = relevantApprovals.filter(a => a.status === 'PENDING');
  const historyApprovals = relevantApprovals.filter(a => a.status !== 'PENDING');
  const pendingCount = pendingApprovals.length;

  if (!isOpen || typeof document === 'undefined') return null;

  // Handle Review Execution
  const executeReviewAction = () => {
    if (!activeReviewAction) return;
    const { item, action } = activeReviewAction;

    if (action === 'APPROVE') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      onApprove(item.id, reviewerNote || 'Disetujui.');
    } else if (action === 'REJECT') {
      onReject(item.id, reviewerNote || 'Ditolak.');
    } else {
      onRequestRevision(item.id, reviewerNote || 'Mohon revisi data pendukung.');
    }

    setActiveReviewAction(null);
    setReviewerNote('');
  };

  // Handle New Request Submit
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
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 }
      });

      setActiveTab('reviews');
      setNewDescription('');
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
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.7 }
    });

    setActiveTab('reviews');
    // Reset form
    setNewTitle('Permohonan Cuti Tahunan');
    setNewDescription('');
  };

  // Notification Feed Generator based on system events
  const generateNotifications = () => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      time: string;
      type: 'success' | 'warning' | 'info' | 'error';
      icon: any;
      unread: boolean;
    }> = [];

    // Notifications from approvals
    relevantApprovals.forEach(app => {
      if (app.status === 'APPROVED') {
        list.push({
          id: `notif-app-${app.id}`,
          title: `Pengajuan Disetujui: ${app.title}`,
          desc: `${app.employeeName}  Ditinjau oleh ${app.reviewedBy || 'Manajemen'} pada ${app.reviewedAt || 'hari ini'}. ${app.reviewNote ? `Catatan: "${app.reviewNote}"` : ''}`,
          time: app.reviewedAt || app.submittedAt,
          type: 'success',
          icon: CheckCircle2,
          unread: false
        });
      } else if (app.status === 'REJECTED') {
        list.push({
          id: `notif-rej-${app.id}`,
          title: `Pengajuan Ditolak: ${app.title}`,
          desc: `${app.employeeName}  Alasan: "${app.reviewNote || 'Ditolak oleh manajemen.'}"`,
          time: app.reviewedAt || app.submittedAt,
          type: 'error',
          icon: XCircle,
          unread: true
        });
      } else if (app.status === 'REVISION_REQUESTED') {
        list.push({
          id: `notif-rev-${app.id}`,
          title: `Perlu Revisi: ${app.title}`,
          desc: `Catatan Reviewer: "${app.reviewNote || 'Mohon melengkapi lampiran berkas.'}"`,
          time: app.reviewedAt || app.submittedAt,
          type: 'warning',
          icon: AlertTriangle,
          unread: true
        });
      } else if (app.status === 'PENDING' && isApprover) {
        list.push({
          id: `notif-pend-${app.id}`,
          title: `Tiket Baru Butuh Review: ${app.title}`,
          desc: `${app.employeeName} (${app.department}) mengajukan permohonan baru dan menunggu persetujuan Anda.`,
          time: app.submittedAt,
          type: 'info',
          icon: Clock,
          unread: true
        });
      }
    });

    // General Corporate Notifications
    list.push({
      id: 'notif-payroll-sep',
      title: 'Slip Gaji Periode September 2026 Siap Diterbitkan',
      desc: 'Perhitungan tunjangan site proyek telah disinkronisasikan.',
      time: 'Hari ini, 07:00 WIB',
      type: 'info',
      icon: Banknote,
      unread: false
    });

    list.push({
      id: 'notif-sys-policy',
      title: 'Sistem Kebijakan Absensi & Shift On-Site PRIME Enterprise',
      desc: 'Batas masuk shift normal pukul 08:00 WIB dengan toleransi keterlambatan 15 menit.',
      time: 'Kemarin, 16:30 WIB',
      type: 'info',
      icon: Shield,
      unread: false
    });

    return list;
  };

  const notificationFeed = generateNotifications();

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Modal Top Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-orange-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00] shadow-xs">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-mono-code">
                  Pusat Notifikasi & Approval
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono-code bg-orange-100 text-[#FF6B00]">
                  PRIME Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isApprover
                  ? 'Review pengajuan cuti, izin sakit, justifikasi telat & linimasa aktivitas tim'
                  : 'Status pengajuan pribadi, persetujuan cuti & notifikasi aktivitas kerja Anda'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Tabs Switcher */}
        <div className="px-5 sm:px-6 pt-3 pb-2 bg-slate-50/70 border-b border-slate-200/70 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setActiveTab('reviews'); setActiveReviewAction(null); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isApprover ? 'Butuh Review' : 'Pengajuan Saya'}</span>
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'reviews' ? 'bg-white text-[#FF6B00]' : 'bg-[#FF6B00] text-white'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('notifications'); setActiveReviewAction(null); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Aktivitas & Notifikasi</span>
            </button>

            <button
              onClick={() => { setActiveTab('new_request'); setActiveReviewAction(null); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'new_request'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ajukan Cuti / Izin</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono-code text-slate-500">
            <span>Role:</span>
            <span className="font-bold text-slate-800 uppercase">{currentRole}</span>
          </div>
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* TAB 1: BUTUH REVIEW (APPROVAL & STATUS TIKET) */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              
              {/* Filter Pills for Review items */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['ALL', 'LEAVE', 'ATTENDANCE_CORRECTION', 'LATE_JUSTIFICATION', 'OUT_OF_GEOFENCE', 'DINAS_LUAR'].map(ft => (
                    <button
                      key={ft}
                      onClick={() => setFilterType(ft)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        filterType === ft
                          ? 'bg-slate-900 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {ft === 'ALL'
                        ? 'Semua Tipe'
                        : ft === 'LEAVE'
                        ? 'Cuti & Izin'
                        : ft === 'ATTENDANCE_CORRECTION'
                        ? 'Koreksi Absensi'
                        : ft === 'LATE_JUSTIFICATION'
                        ? 'Keterlambatan'
                        : ft === 'OUT_OF_GEOFENCE'
                        ? 'Luar Geofence'
                        : 'Dinas Luar'}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-slate-500 font-mono-code">
                  {pendingCount} Tiket Menunggu Tindakan
                </span>
              </div>

              {/* Action Form Confirmation Popup (Inline within modal) */}
              {activeReviewAction && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-amber-900 font-mono-code uppercase">
                        Konfirmasi: {activeReviewAction.action === 'APPROVE' ? 'Setujui Permohonan' : activeReviewAction.action === 'REJECT' ? 'Tolak Permohonan' : 'Minta Revisi Berkas'}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveReviewAction(null)}
                      className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700">
                    Pemohon: <strong>{activeReviewAction.item.employeeName}</strong> - <em>"{activeReviewAction.item.title}"</em>
                  </p>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Catatan Reviewer / Alasan (Opsional):
                    </label>
                    <input
                      type="text"
                      value={reviewerNote}
                      onChange={e => setReviewerNote(e.target.value)}
                      placeholder={
                        activeReviewAction.action === 'APPROVE'
                          ? 'Contoh: Disetujui, absensi disahkan.'
                          : activeReviewAction.action === 'REJECT'
                          ? 'Contoh: Kuota cuti tidak mencukupi / jadwal proyek mendesak.'
                          : 'Contoh: Mohon lampirkan surat dokter / bukti dinas.'
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveReviewAction(null)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={executeReviewAction}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer ${
                        activeReviewAction.action === 'APPROVE'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : activeReviewAction.action === 'REJECT'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      Eksekusi Keputusan
                    </button>
                  </div>
                </div>
              )}

              {/* Pending Approvals List */}
              {pendingApprovals.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 font-mono-code">
                    Semua Pengajuan Telah Selesai!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {isApprover
                      ? 'Tidak ada tiket persetujuan yang menunggu tindakan Anda saat ini.'
                      : 'Semua pengajuan cuti dan permohonan Anda telah diproses oleh manajemen.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals
                    .filter(item => filterType === 'ALL' || item.type === filterType)
                    .map(item => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 transition-all shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                              {(item.employeeName || 'K').charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 font-mono-code">
                                  {item.employeeName || 'Karyawan'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono-code">
                                    {item.employeeNik || '-'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">{item.department || '-'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-code font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              {item.type === 'ATTENDANCE_CORRECTION'
                                ? 'Koreksi Absensi'
                                : item.type === 'LEAVE'
                                ? 'Cuti / Izin'
                                : item.type === 'LATE_JUSTIFICATION'
                                ? 'Keterlambatan'
                                : item.type === 'OUT_OF_GEOFENCE'
                                ? 'Luar Geofence'
                                : 'Dinas Luar'}
                            </span>
                            {item.leaveType === 'CUTI_ROSTER_NON_LOKAL' && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono-code font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                ✈️ ROSTER NON-LOKAL
                              </span>
                            )}
                            {(item.isOverQuota || (item.unpaidLeaveDays && item.unpaidLeaveDays > 0)) && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono-code font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                ⚠️ POTONG GAJI ({item.unpaidLeaveDays} HARI)
                              </span>
                            )}
                            {item.isOffSchedule && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono-code font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                📅 DI LUAR JADWAL
                              </span>
                            )}
                            {(item.type === 'ATTENDANCE_CORRECTION' || item.type === 'OUT_OF_GEOFENCE') && item.targetApproverRole === 'PM' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-code font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                PM APPROVAL
                              </span>
                            )}
                            {(item.requiresHrApproval || item.targetApproverRole === 'HR') && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-code font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                HR APPROVAL
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100">
                            {item.description}
                          </p>
                          {item.offScheduleReason && (
                            <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                              <b>Alasan di Luar Jadwal:</b> {item.offScheduleReason}
                            </div>
                          )}
                        </div>

                        {/* Detail Khusus Koreksi Absensi */}
                        {item.type === 'ATTENDANCE_CORRECTION' && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-orange-50/70 border border-orange-200 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-mono-code font-bold">Jam Masuk Target</span>
                              <span className="font-mono-code font-bold text-slate-900">{item.targetCheckInTime || '-'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-mono-code font-bold">Jam Pulang Target</span>
                              <span className="font-mono-code font-bold text-slate-900">{item.targetCheckOutTime || '-'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-mono-code font-bold">Target Status</span>
                              <span className="font-mono-code font-bold text-orange-700">{item.targetStatus || 'ON_TIME'}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-3 pt-1 border-t border-orange-200/60 flex items-center justify-between text-[11px] flex-wrap gap-1">
                              <span className="text-slate-600">
                                Rute Persetujuan: <b>{item.targetApproverRole === 'PM' ? `Project Manager (${item.projectManagerName || 'PM Proyek'})` : 'HR Manager Saja (Tanpa Proyek)'}</b>
                              </span>
                              {item.projectName && (
                                <span className="text-slate-500 font-mono-code">Proyek: {item.projectName}</span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-code pt-1 border-t border-slate-100 flex-wrap gap-1">
                          <span>Periode: <strong>{item.startDate} {item.endDate ? `s/d ${item.endDate}` : ''}</strong></span>
                          {item.coveredByQuotaDays !== undefined && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                              Kuota: <b>{item.coveredByQuotaDays} Hr</b>
                              {item.unpaidLeaveDays ? <b className="text-rose-600"> • Potong: {item.unpaidLeaveDays} Hr</b> : null}
                            </span>
                          )}
                          <span>Diajukan: {item.submittedAt}</span>
                        </div>

                        {/* Approver Action Buttons */}
                        {isApprover && canUserApproveItem(item) ? (
                          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReviewAction({ item, action: 'REVISE' });
                                setReviewerNote('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Minta Revisi</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveReviewAction({ item, action: 'REJECT' });
                                setReviewerNote('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveReviewAction({ item, action: 'APPROVE' });
                                setReviewerNote('');
                              }}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Setujui</span>
                            </button>
                          </div>
                        ) : isApprover && !canUserApproveItem(item) ? (
                          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5" />
                              {item.targetApproverRole === 'HR' || (!item.projectId && !employees.find(e => e.id === item.employeeId)?.assignedProjectId)
                                ? 'Menunggu Persetujuan Eksklusif HR Manager (Tanpa Proyek)'
                                : `Menunggu Persetujuan PM: ${item.projectManagerName || 'Project Manager Terkait'}`}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                </div>
              )}

              {/* History / Processed Approvals */}
              {historyApprovals.length > 0 && (
                <div className="pt-3 border-t border-slate-200/70">
                  <h4 className="text-xs font-bold text-slate-700 font-mono-code uppercase mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Riwayat Tiket yang Telah Diproses ({historyApprovals.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {historyApprovals.slice(0, 5).map(h => (
                      <div key={h.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-800">{h.title || 'Pengajuan'} - <span className="text-slate-500 font-normal">{h.employeeName || 'Karyawan'}</span></p>
                          <p className="text-[11px] text-slate-400 font-mono-code">{h.reviewedAt || h.submittedAt} {h.reviewedBy ? ` Oleh ${h.reviewedBy}` : ''}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-code uppercase shrink-0 ${
                          h.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : h.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {h.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: AKTIVITAS & NOTIFIKASI REALTIME */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-700 font-mono-code uppercase">
                  Linimasa Aktivitas & Info Kerja
                </span>
                <span className="text-[11px] text-slate-500 font-mono-code">
                  {notificationFeed.length} Pembaruan
                </span>
              </div>

              <div className="space-y-2.5">
                {notificationFeed.map(nt => {
                  const Icon = nt.icon;
                  return (
                    <div
                      key={nt.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        nt.unread
                          ? 'bg-orange-50/40 border-orange-200 shadow-2xs'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${
                        nt.type === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : nt.type === 'error'
                          ? 'bg-rose-100 text-rose-700'
                          : nt.type === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">
                            {nt.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono-code whitespace-nowrap shrink-0">
                            {nt.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {nt.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FORM AJUKAN CUTI / IZIN CEPAT */}
          {activeTab === 'new_request' && (
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Pengajuan yang dibuat akan langsung masuk ke antrean persetujuan HRD dan Direksi PRIME Enterprise.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Jenis Pengajuan</label>
                  <select
                    value={newRequestType}
                    onChange={e => {
                      const val = e.target.value as any;
                      setNewRequestType(val);
                      if (val === 'LEAVE') setNewTitle('Permohonan Cuti Tahunan');
                      else if (val === 'PERMIT') setNewTitle('Permohonan Izin / Sakit');
                      else if (val === 'ATTENDANCE_CORRECTION') setNewTitle('Pengajuan Koreksi Absensi Mandiri');
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                  >
                    <option value="LEAVE">Cuti Karyawan</option>
                    <option value="PERMIT">Izin Tidak Masuk / Sakit</option>
                    <option value="ATTENDANCE_CORRECTION">📝 Koreksi Absensi Mandiri</option>
                  </select>
                </div>

                {newRequestType === 'LEAVE' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Kategori Cuti</label>
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
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-xs"
                    >
                      <option value="CUTI_TAHUNAN">Cuti Tahunan (Potong Jatah)</option>
                      <option value="CUTI_ROSTER_NON_LOKAL">✈️ Cuti Roster Non-Lokal (Jatah Tiap 3 Bulan)</option>
                      <option value="CUTI_BESAR">Cuti Besar</option>
                      <option value="CUTI_MELAHIRKAN">Cuti Melahirkan</option>
                    </select>
                  </div>
                )}
              </div>

              {/* BANNER KHUSUS KOREKSI ABSENSI MANDIRI */}
              {newRequestType === 'ATTENDANCE_CORRECTION' && (
                <div className="p-4 rounded-2xl bg-orange-50/90 border border-orange-200 text-slate-800 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-orange-950 font-mono-code">
                      <Clock className="w-4 h-4 text-[#FF6B00]" />
                      Pengajuan Koreksi Absensi Mandiri
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono-code bg-orange-100 text-[#FF6B00] border border-orange-300">
                      PRESENSI
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/90 border border-orange-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium">Status Penugasan Karyawan:</span>
                      <span className="font-mono-code font-bold text-slate-900">
                        {currentUserProject ? `${currentUserProject.name} (${currentUserProject.code})` : 'Kantor Pusat / Staf Non-Proyek'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-slate-700">
                      <span className="font-medium">Otoritas Persetujuan Sah:</span>
                      <span className="font-mono-code font-bold text-orange-700">
                        {currentUserProjectManager 
                          ? `Project Manager: ${currentUserProjectManager.name}` 
                          : 'HR Manager Saja (Karyawan Tanpa Proyek)'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Gunakan fitur ini jika lupa tapping/selfie, gangguan sinyal di site proyek, atau tugas mendadak di luar area geofence.
                  </p>
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

              {/* Informative Banner for Non-Annual Leave Types */}
              {newRequestType === 'LEAVE' && newLeaveType !== 'CUTI_TAHUNAN' && newLeaveType !== 'CUTI_ROSTER_NON_LOKAL' && (
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-blue-900">Kategori Cuti Khusus</b>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Jenis permohonan ini tidak memotong kuota Cuti Tahunan reguler. Tetap memerlukan persetujuan dari HR Manager serta kelengkapan berkas pendukung.
                    </p>
                  </div>
                </div>
              )}

              {newRequestType === 'PERMIT' && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-slate-900">Permohonan Izin Tidak Masuk / Sakit</b>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Permohonan izin dispensasi kehadiran tidak memotong kuota cuti tahunan karyawan.
                    </p>
                  </div>
                </div>
              )}

              {newRequestType === 'ATTENDANCE_CORRECTION' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal Absensi Dikoreksi</label>
                      <input
                        type="date"
                        value={correctionDate}
                        onChange={e => setCorrectionDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono-code font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Jam Masuk Target (WIB)</label>
                      <input
                        type="time"
                        step="1"
                        value={targetCheckInTime}
                        onChange={e => setTargetCheckInTime(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono-code font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Jam Pulang Target (Opsional)</label>
                      <input
                        type="time"
                        step="1"
                        value={targetCheckOutTime}
                        onChange={e => setTargetCheckOutTime(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono-code font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Target Status Kehadiran</label>
                      <select
                        value={targetAttendanceStatus}
                        onChange={e => setTargetAttendanceStatus(e.target.value as any)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-bold"
                      >
                        <option value="ON_TIME">Tepat Waktu (08:00 WIB)</option>
                        <option value="LATE">Terlambat Sah (Izin Resmi)</option>
                        <option value="DINAS_LUAR">Dinas Luar / Penugasan Site</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Kategori Alasan Koreksi</label>
                      <select
                        value={correctionReasonPreset}
                        onChange={e => setCorrectionReasonPreset(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                      >
                        <option value="Lupa Check-In Saat Tiba di Lokasi">Lupa Check-In Saat Tiba di Lokasi</option>
                        <option value="Kamera Selfie Eror / Perangkat Hang">Kamera Selfie Eror / Perangkat Hang</option>
                        <option value="Kendala Sinyal / Jaringan di Site Proyek">Kendala Sinyal / Jaringan di Site Proyek</option>
                        <option value="Check-In Terlewat karena Tugas Lapangan Mendesak">Check-In Terlewat karena Tugas Lapangan Mendesak</option>
                        <option value="Perbaikan Jam Pulang (Lupa Tap Checkout)">Perbaikan Jam Pulang (Lupa Tap Checkout)</option>
                        <option value="Lainnya">Lainnya (Tuliskan di Keterangan)</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Keterangan / Kronologi Lengkap (Wajib)</label>
                    <textarea
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                      placeholder="Jelaskan detail aktivitas kerja dan alasan kendala presensi pada tanggal tersebut..."
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal Mulai</label>
                      <input
                        type="date"
                        value={newStartDate}
                        onChange={e => handleStartDateChange(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono-code font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal Selesai</label>
                      <input
                        type="date"
                        value={newEndDate}
                        onChange={e => handleEndDateChange(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono-code font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Total Hari</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={newDaysCount}
                        onChange={e => handleDaysCountChange(Number(e.target.value))}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono-code font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Judul Ringkas</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-bold"
                      required
                    />
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Alasan / Keterangan Lengkap</label>
                    <textarea
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                      placeholder="Jelaskan kebutuhan pengajuan atau pendelegasian tugas selama berhalangan hadir..."
                      required
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isSubmitDisabled
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                      : 'btn-orange text-white cursor-pointer active:scale-95 shadow-md'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isOverQuota && !agreeUnpaidDeduction
                      ? 'Centang Konfirmasi Potong Gaji'
                      : isOffSchedule && !offScheduleReason.trim()
                      ? 'Lengkapi Alasan Di Luar Jadwal'
                      : isEarlySubmission && !earlyReason.trim()
                      ? 'Lengkapi Alasan Lebih Awal'
                      : isOverQuota
                      ? `Kirimkan Permohonan (${unpaidLeaveDays} Hr Potong Gaji)`
                      : 'Kirimkan Permohonan'}
                  </span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-mono-code shrink-0">
          <span>PRIME Enterprise  Workflow Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Tutup Jendela (Esc)
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
