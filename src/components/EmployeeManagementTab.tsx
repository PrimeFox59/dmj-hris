import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CreditCard,
  Calendar,
  DollarSign,
  Edit2,
  Trash2,
  CheckCircle2,
  Briefcase,
  X,
  Lock,
  ShieldCheck,
  UserCheck,
  Shield,
  Crown,
  ArrowDown,
  Banknote,
  KeyRound,
  RotateCcw,
  Copy,
  Check,
  Camera,
  Sparkles,
  Plane,
  MapPin,
  CalendarClock,
  MoreVertical,
  Power,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Employee, Project, SystemRole, UserRole, getEffectiveSystemRole, BiometricProfile, WorkLocationType, NonLokalLeaveConfig } from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';
import { api } from '../services/api';
import { BiometricEnrollmentModal } from './BiometricEnrollmentModal';

interface EmployeeManagementTabProps {
  currentUser?: Employee;
  employees: Employee[];
  projects: Project[];
  onAddEmployee: (emp: Employee) => void | Promise<any>;
  onUpdateEmployee: (emp: Employee) => void | Promise<any>;
  onDeleteEmployee: (id: string) => void;
  onImpersonateEmployee?: (emp: Employee) => void;
}

function computeNextSequentialLoginId(empList: Employee[]): string {
  let maxD = 0;
  for (const emp of empList) {
    const rawId = emp.loginId || '';
    const match = rawId.match(/^d(\d{1,4})$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxD && num < 1000) {
        maxD = num;
      }
    }
    const matchEmp = emp.id.match(/^EMP-(\d{1,4})$/i);
    if (matchEmp) {
      const numEmp = parseInt(matchEmp[1], 10);
      if (!isNaN(numEmp) && numEmp > maxD && numEmp < 1000) {
        maxD = numEmp;
      }
    }
  }
  const nextNum = maxD > 0 ? maxD + 1 : 1;
  return `d${String(nextNum).padStart(3, '0')}`;
}

export const EmployeeManagementTab: React.FC<EmployeeManagementTabProps> = ({
  currentUser,
  employees,
  projects,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onImpersonateEmployee
}) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isStaff = currentRole === 'staff';
  const isSuperuser = currentRole === 'superuser';
  const isFinance = currentRole === 'finance';
  const isFinanceOrSuper = isFinance || isSuperuser;
  const isHR = currentRole === 'hr' || currentRole === 'admin' || isSuperuser;

  // PRIVACY MASKING STATE (Default: HIDE)
  const [showSalaryNominal, setShowSalaryNominal] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'NON_LOKAL' | 'LOKAL'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Non-Lokal / Roster Leave Modal State (HR Manager Control)
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterTargetEmp, setRosterTargetEmp] = useState<Employee | null>(null);
  const [rosterLocationType, setRosterLocationType] = useState<WorkLocationType>('NON_LOKAL');
  const [rosterCycleMonths, setRosterCycleMonths] = useState(3);
  const [rosterQuotaPerPeriod, setRosterQuotaPerPeriod] = useState(9);
  const [rosterUsedPeriodLeave, setRosterUsedPeriodLeave] = useState(0);
  const [rosterLastLeaveDate, setRosterLastLeaveDate] = useState('');
  const [rosterNextEligibleDate, setRosterNextEligibleDate] = useState('');
  const [rosterAllowEarlyLeave, setRosterAllowEarlyLeave] = useState(true);
  const [rosterNotes, setRosterNotes] = useState('');
  // HR-Only Leave Accumulation Fields
  const [rosterAllowAccumulation, setRosterAllowAccumulation] = useState(false);
  const [rosterAccumulatedDays, setRosterAccumulatedDays] = useState(0);
  const [rosterAccumulationNotes, setRosterAccumulationNotes] = useState('');

  const handleOpenRosterModal = (emp: Employee) => {
    setRosterTargetEmp(emp);
    const locType = emp.workLocationType || 'LOKAL';
    setRosterLocationType(locType);
    const cfg = emp.nonLokalLeaveConfig;
    setRosterCycleMonths(cfg?.rosterCycleMonths ?? 3);
    setRosterQuotaPerPeriod(cfg?.leaveQuotaPerPeriod ?? 9);
    setRosterUsedPeriodLeave(cfg?.usedPeriodLeave ?? 0);
    setRosterLastLeaveDate(cfg?.lastLeaveDate || '');
    setRosterNextEligibleDate(cfg?.nextEligibleLeaveDate || '');
    setRosterAllowEarlyLeave(cfg?.allowEarlyLeave !== false);
    setRosterNotes(cfg?.notes || '');
    setRosterAllowAccumulation(cfg?.allowAccumulation || false);
    setRosterAccumulatedDays(cfg?.accumulatedLeaveDays ?? 0);
    setRosterAccumulationNotes(cfg?.accumulationNotes || '');
    setRosterModalOpen(true);
  };

  const handleSaveRosterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rosterTargetEmp) return;

    const isHR = currentRole === 'hr' || currentRole === 'admin' || currentRole === 'superuser';

    const updatedEmp: Employee = {
      ...rosterTargetEmp,
      workLocationType: rosterLocationType,
      nonLokalLeaveConfig: rosterLocationType === 'NON_LOKAL' ? {
        rosterCycleMonths: Number(rosterCycleMonths),
        leaveQuotaPerPeriod: Number(rosterQuotaPerPeriod),
        usedPeriodLeave: Number(rosterUsedPeriodLeave),
        lastLeaveDate: rosterLastLeaveDate || undefined,
        nextEligibleLeaveDate: rosterNextEligibleDate || undefined,
        allowEarlyLeave: rosterAllowEarlyLeave,
        // Akumulasi cuti ke periode berikutnya hanya dapat diset & diotorisasi oleh HR Manager
        allowAccumulation: isHR ? rosterAllowAccumulation : (rosterTargetEmp.nonLokalLeaveConfig?.allowAccumulation || false),
        accumulatedLeaveDays: isHR ? (rosterAllowAccumulation ? Number(rosterAccumulatedDays) : 0) : (rosterTargetEmp.nonLokalLeaveConfig?.accumulatedLeaveDays || 0),
        accumulationApprovedBy: isHR && rosterAllowAccumulation ? (currentUser?.name || 'HR Manager') : rosterTargetEmp.nonLokalLeaveConfig?.accumulationApprovedBy,
        accumulationApprovalDate: isHR && rosterAllowAccumulation ? new Date().toISOString() : rosterTargetEmp.nonLokalLeaveConfig?.accumulationApprovalDate,
        accumulationNotes: isHR ? (rosterAccumulationNotes || undefined) : rosterTargetEmp.nonLokalLeaveConfig?.accumulationNotes,
        notes: rosterNotes || undefined,
        scheduledLeaveHistory: rosterTargetEmp.nonLokalLeaveConfig?.scheduledLeaveHistory
      } : undefined
    };

    onUpdateEmployee(updatedEmp);
    api.saveEmployee(updatedEmp).catch(err => console.error('Failed to update roster config:', err));
    setRosterModalOpen(false);
  };

  // Reset Password & Credential Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetEmployee, setResetTargetEmployee] = useState<Employee | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Biometric Enrollment Modal State
  const [biometricTargetEmployee, setBiometricTargetEmployee] = useState<Employee | null>(null);

  const handleSaveBiometricForEmployee = async (profile: BiometricProfile, updateAvatarAsWell: boolean) => {
    if (!biometricTargetEmployee) return;
    const res = await api.saveBiometricProfile(biometricTargetEmployee.id, profile, updateAvatarAsWell);
    onUpdateEmployee(res.employee);
    setBiometricTargetEmployee(null);
  };

  // Form fields
  const [nik, setNik] = useState('');
  const [loginId, setLoginId] = useState('');
  const [suggestedLoginId, setSuggestedLoginId] = useState('');
  const [loginIdError, setLoginIdError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+62 8');
  const [department, setDepartment] = useState('Engineering & Digital Transformation');
  const [position, setPosition] = useState('Senior Machining Engineer');
  const [role, setRole] = useState<UserRole>('Employee');
  const [systemRole, setSystemRole] = useState<SystemRole>('staff');
  const [employmentType, setEmploymentType] = useState<'TETAP' | 'KONTRAK' | 'PROJECT_HIRE'>('TETAP');
  const [assignedProjectId, setAssignedProjectId] = useState(projects[0]?.id || 'PRJ-FPT-01');
  const [baseSalary, setBaseSalary] = useState(10000000);
  const [fixedAllowance, setFixedAllowance] = useState(2000000);
  const [dailyAllowance, setDailyAllowance] = useState(50000);
  const [leaveQuota, setLeaveQuota] = useState(12);
  const [workLocationTypeForm, setWorkLocationTypeForm] = useState<WorkLocationType>('LOKAL');
  const [rosterCycleMonthsInput, setRosterCycleMonthsInput] = useState(3);
  const [rosterQuotaInput, setRosterQuotaInput] = useState(9);
  const [rosterAllowEarlyInput, setRosterAllowEarlyInput] = useState(true);
  const [rosterNextDateInput, setRosterNextDateInput] = useState('');
  const [bankName, setBankName] = useState('Bank Central Asia (BCA)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [inactiveReason, setInactiveReason] = useState('');

  // Real-time duplicate login ID detection
  const isLoginIdDuplicate = useMemo(() => {
    if (!loginId.trim()) return false;
    const clean = loginId.trim().toLowerCase();
    const currentId = editingEmployee?.id || '';
    return employees.some(e => e.id !== currentId && (e.loginId?.trim().toLowerCase() === clean));
  }, [loginId, editingEmployee, employees]);

  const openAddModal = () => {
    setEditingEmployee(null);
    const nextSuggested = computeNextSequentialLoginId(employees);
    setSuggestedLoginId(nextSuggested);
    setLoginId(nextSuggested);
    setLoginIdError(null);
    setSaveError(null);
    setNik(''); // Jika tidak ada NIK, kosongkan saja
    setName('');
    setEmail('');
    setPhone('+62 8');
    setDepartment('Engineering & Mechanical Services');
    setPosition('Field Machining Specialist');
    setRole('Employee');
    setSystemRole('staff');
    setEmploymentType('TETAP');
    setAssignedProjectId(projects[0]?.id || 'PRIME-ENG-01');
    setBaseSalary(10000000);
    setFixedAllowance(2000000);
    setDailyAllowance(50000);
    setLeaveQuota(12);
    setWorkLocationTypeForm('LOKAL');
    setRosterCycleMonthsInput(3);
    setRosterQuotaInput(9);
    setRosterAllowEarlyInput(true);
    setRosterNextDateInput('');
    setBankName('Bank Central Asia (BCA)');
    setAccountNumber('');
    setAccountHolder('');
    setEmployeeStatus('ACTIVE');
    setInactiveReason('');
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    const nextSuggested = computeNextSequentialLoginId(employees);
    setSuggestedLoginId(nextSuggested);
    let fallbackLoginId = 'd001';
    if (emp.loginId && emp.loginId.match(/^d\d{1,4}$/i)) {
      fallbackLoginId = emp.loginId;
    } else if (emp.loginId) {
      fallbackLoginId = emp.loginId;
    } else if (emp.id === 'EMP-001') {
      fallbackLoginId = 'admin';
    } else {
      const matchEmpNum = emp.id.match(/^EMP-(\d{1,4})$/i);
      if (matchEmpNum && Number(matchEmpNum[1]) < 1000) {
        fallbackLoginId = `d${String(matchEmpNum[1]).padStart(3, '0')}`;
      } else {
        fallbackLoginId = nextSuggested;
      }
    }
    setLoginId(fallbackLoginId);
    setLoginIdError(null);
    setSaveError(null);
    setNik(emp.nik);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone);
    setDepartment(emp.department);
    setPosition(emp.position);
    setRole(emp.role);
    setSystemRole(emp.systemRole || getEffectiveSystemRole(emp));
    setEmploymentType(emp.employmentType);
    setAssignedProjectId(emp.assignedProjectId);
    setBaseSalary(emp.baseSalary);
    setFixedAllowance(emp.fixedAllowance);
    setDailyAllowance(emp.dailyAllowance);
    setLeaveQuota(emp.leaveQuota);
    setWorkLocationTypeForm(emp.workLocationType || 'LOKAL');
    setRosterCycleMonthsInput(emp.nonLokalLeaveConfig?.rosterCycleMonths ?? 3);
    setRosterQuotaInput(emp.nonLokalLeaveConfig?.leaveQuotaPerPeriod ?? 9);
    setRosterAllowEarlyInput(emp.nonLokalLeaveConfig?.allowEarlyLeave !== false);
    setRosterNextDateInput(emp.nonLokalLeaveConfig?.nextEligibleLeaveDate || '');
    setBankName(emp.bankAccount.bankName);
    setAccountNumber(emp.bankAccount.accountNumber);
    setAccountHolder(emp.bankAccount.accountHolder);
    setEmployeeStatus(emp.status || 'ACTIVE');
    setInactiveReason(emp.inactiveReason || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLoginId = loginId.trim().toLowerCase();
    if (!cleanLoginId) {
      setLoginIdError('ID Login wajib diisi.');
      return;
    }
    if (isLoginIdDuplicate) {
      setLoginIdError(`ID Login '${loginId}' sudah terdaftar di sistem. Gunakan ID lain.`);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const numMatch = cleanLoginId.match(/^d(\d{1,4})$/i);
    const newEmpId = numMatch ? `EMP-${String(numMatch[1]).padStart(3, '0')}` : `EMP-${Date.now()}`;

    const empData: Employee = {
      id: editingEmployee ? editingEmployee.id : newEmpId,
      loginId: cleanLoginId,
      nik,
      name,
      email,
      phone,
      avatar: editingEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role,
      systemRole,
      department,
      position,
      employmentType,
      joinDate: editingEmployee ? editingEmployee.joinDate : '2026-09-01',
      assignedProjectId,
      baseSalary: Number(baseSalary),
      fixedAllowance: Number(fixedAllowance),
      dailyAllowance: Number(dailyAllowance),
      leaveQuota: Number(leaveQuota),
      usedLeave: editingEmployee ? editingEmployee.usedLeave : 0,
      workLocationType: workLocationTypeForm,
      status: employeeStatus,
      inactiveReason: employeeStatus === 'INACTIVE' ? inactiveReason : undefined,
      nonLokalLeaveConfig: workLocationTypeForm === 'NON_LOKAL' ? {
        rosterCycleMonths: Number(rosterCycleMonthsInput),
        leaveQuotaPerPeriod: Number(rosterQuotaInput),
        usedPeriodLeave: editingEmployee?.nonLokalLeaveConfig?.usedPeriodLeave || 0,
        lastLeaveDate: editingEmployee?.nonLokalLeaveConfig?.lastLeaveDate,
        nextEligibleLeaveDate: rosterNextDateInput || editingEmployee?.nonLokalLeaveConfig?.nextEligibleLeaveDate,
        allowEarlyLeave: rosterAllowEarlyInput,
        notes: editingEmployee?.nonLokalLeaveConfig?.notes,
        scheduledLeaveHistory: editingEmployee?.nonLokalLeaveConfig?.scheduledLeaveHistory
      } : undefined,
      bankAccount: {
        bankName,
        accountNumber,
        accountHolder: accountHolder || name
      }
    };

    try {
      if (editingEmployee) {
        await onUpdateEmployee(empData);
      } else {
        await onAddEmployee(empData);
      }
      setModalOpen(false);
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan data karyawan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenResetModal = (emp: Employee) => {
    setResetTargetEmployee(emp);
    setCustomPassword('');
    setResetSuccessMessage(null);
    setResetModalOpen(true);
  };

  const handleExecuteResetPassword = async (useDefault = true) => {
    if (!resetTargetEmployee) return;
    const targetPw = useDefault ? 'zzz' : (customPassword.trim() || 'zzz');
    setIsResetting(true);
    try {
      const res = await api.resetEmployeePassword(resetTargetEmployee.id, targetPw);
      setResetSuccessMessage(res.message || `Password untuk ${resetTargetEmployee.name} berhasil di-reset ke: ${targetPw}`);
      if (res.loginId && (!resetTargetEmployee.loginId || resetTargetEmployee.loginId !== res.loginId)) {
        const updated = { ...resetTargetEmployee, loginId: res.loginId };
        onUpdateEmployee(updated);
        setResetTargetEmployee(updated);
      }
    } catch (err: any) {
      alert(`Gagal mereset password: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyWhatsAppFormat = () => {
    if (!resetTargetEmployee) return;
    const loginId = resetTargetEmployee.loginId || (resetTargetEmployee.id === 'EMP-001' ? 'admin' : resetTargetEmployee.id);
    const pw = resetSuccessMessage ? (customPassword.trim() || 'zzz') : 'zzz';
    const nikLine = resetTargetEmployee.nik && resetTargetEmployee.nik.trim() ? `🆔 NIK Resmi: ${resetTargetEmployee.nik}\n` : '';
    const text = `*Kredensial Akses DMJ HRIS Enterprise*\n` +
      `👤 Nama: ${resetTargetEmployee.name}\n` +
      `🔑 ID Login: ${loginId}\n` +
      nikLine +
      `🔒 Password: ${pw}\n` +
      `🌐 Portal: https://hris.primeprojectx.net\n\n` +
      `_Catatan: Harap segera mengganti password setelah berhasil login pada menu profil._`;
    handleCopyText(text, 'whatsapp');
  };

  const handleToggleEmployeeStatus = (emp: Employee) => {
    if (emp.id === 'EMP-001') {
      alert('Akun Superuser (Galih Primananda) adalah akun master sistem dan tidak dapat dinonaktifkan.');
      return;
    }

    const currentStatus = emp.status || 'ACTIVE';
    const newStatus: 'ACTIVE' | 'INACTIVE' = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const empLoginBadge = emp.loginId || (emp.id === 'EMP-001' ? 'admin' : emp.id);

    if (newStatus === 'INACTIVE') {
      const confirmDeactivate = confirm(
        `Nonaktifkan akun karyawan "${emp.name}" (${empLoginBadge})?\n\n` +
        `• Karyawan tidak akan dapat login lagi menggunakan password maupun biometrik.\n` +
        `• Sesi login aktif akan segera dicabut.\n` +
        `• Seluruh data master, riwayat presensi, dan slip gaji tetap tersimpan aman untuk audit.`
      );
      if (!confirmDeactivate) return;
    } else {
      const confirmActivate = confirm(
        `Aktifkan kembali akun karyawan "${emp.name}" (${empLoginBadge})?\n\n` +
        `Karyawan ini akan diizinkan kembali untuk login dan melakukan presensi.`
      );
      if (!confirmActivate) return;
    }

    const updated: Employee = {
      ...emp,
      status: newStatus
    };
    onUpdateEmployee(updated);
  };

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const baseEmployees = isStaff
    ? employees.filter(e => e.id === currentUser?.id)
    : employees;

  const totalEmployeesCount = baseEmployees.length;
  const activeEmployeesCount = baseEmployees.filter(e => (e.status || 'ACTIVE') === 'ACTIVE').length;
  const inactiveEmployeesCount = baseEmployees.filter(e => e.status === 'INACTIVE').length;

  const filteredEmployees = baseEmployees.filter(e => {
    const matchSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Boolean(e.loginId) && e.loginId!.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (Boolean(e.ktpNumber) && e.ktpNumber!.toLowerCase().includes(searchTerm.toLowerCase())) ||
      e.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
    const matchProject = projectFilter === 'ALL' || e.assignedProjectId === projectFilter;
    const eff = getEffectiveSystemRole(e);
    const matchRole = roleFilter === 'ALL' || eff === roleFilter || (roleFilter === 'admin' && eff === 'hr') || (roleFilter === 'hr' && eff === 'admin');
    const matchLocation = locationFilter === 'ALL' || (e.workLocationType || 'LOKAL') === locationFilter;
    const empStatus = e.status || 'ACTIVE';
    const matchStatus = statusFilter === 'ALL' || empStatus === statusFilter;
    return matchSearch && matchDept && matchProject && matchRole && matchLocation && matchStatus;
  });

  // Load More & Infinite Scroll Controller (15 per page)
  const PAGE_SIZE = 15;
  const [displayLimit, setDisplayLimit] = useState<number>(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination limit when search or filters change
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [searchTerm, deptFilter, projectFilter, roleFilter, locationFilter, statusFilter]);

  // Lock body scroll when modal is open to ensure clean focus
  useEffect(() => {
    if (modalOpen || resetModalOpen || rosterModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen, resetModalOpen, rosterModalOpen]);

  // Action Dropdown State (Portal-based to avoid table row CSS stacking context overlap)
  interface DropdownAnchor {
    emp: Employee;
    top?: number;
    bottom?: number;
    right: number;
  }
  const [dropdownAnchor, setDropdownAnchor] = useState<DropdownAnchor | null>(null);

  const handleToggleDropdown = (e: React.MouseEvent<HTMLButtonElement>, emp: Employee) => {
    e.stopPropagation();
    if (dropdownAnchor?.emp.id === emp.id) {
      setDropdownAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    const right = Math.max(12, window.innerWidth - rect.right);

    setDropdownAnchor({
      emp,
      top: openUpwards ? undefined : rect.bottom + 6,
      bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
      right
    });
  };

  useEffect(() => {
    if (!dropdownAnchor) return;

    const handleClose = (e?: Event) => {
      if (e && e.target) {
        const target = e.target as HTMLElement;
        if (target.closest('.action-dropdown-portal') || target.closest('.action-dropdown-trigger')) {
          return;
        }
      }
      setDropdownAnchor(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownAnchor(null);
      }
    };

    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    document.addEventListener('click', handleClose);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      document.removeEventListener('click', handleClose);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownAnchor]);

  const visibleEmployees = filteredEmployees.slice(0, displayLimit);
  const hasMore = displayLimit < filteredEmployees.length;

  // Auto load-more on scroll down using IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => Math.min(prev + PAGE_SIZE, filteredEmployees.length));
        }
      },
      { rootMargin: '300px', threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
    };
  }, [hasMore, filteredEmployees.length]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner */}
      <div id="tour-employee-header" className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 motion-fade-in-down">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="prime-cut-corner bg-[#FF6B00] text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code">
              {isStaff ? 'PROFIL PRIBADI STAF' : 'WORKFORCE REPOSITORY'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {isStaff ? 'Terkunci ke Data Diri Sendiri' : 'Human Resource Master Data'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isStaff ? 'Profil Data Pribadi Karyawan' : 'User Management & Direktori Karyawan PRIME Enterprise'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {isStaff
              ? 'Berikut rincian master profil Anda: NIK resmi, alokasi kuota cuti tahunan, nomor rekening payroll, dan status verifikasi biometrik wajah.'
              : 'Database pengguna resmi, pengaturan struktur gaji, tracking saldo cuti, dan manajemen hak akses RBAC PRIME Enterprise.'}
          </p>
        </div>

        {!isStaff && (
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 rounded-2xl btn-orange font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Karyawan Baru</span>
          </button>
        )}
      </div>

      {/* Filter Bar - Status Pills & Filters */}
      <div id="tour-employee-filters" className="glass-card rounded-2xl p-3 sm:p-3.5 space-y-2.5 motion-fade-in-up stagger-1">
        {/* Top Control Bar: Status Segments & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Status Segmented Buttons */}
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Semua Karyawan</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-code font-bold ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalEmployeesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-2xs shadow-emerald-500/20'
                  : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Aktif</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-code font-bold ${
                statusFilter === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeEmployeesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'INACTIVE'
                  ? 'bg-rose-600 text-white shadow-2xs shadow-rose-500/20'
                  : 'text-rose-700 hover:text-rose-900 hover:bg-rose-50/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Non-Aktif / Resign</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-code font-bold ${
                statusFilter === 'INACTIVE' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {inactiveEmployeesCount}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, NIK, jabatan..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-1 sm:pb-0 scrollbar-none pt-1 border-t border-slate-100">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium shrink-0 max-w-[150px] truncate"
            title="Filter Departemen"
          >
            <option value="ALL">Semua Departemen</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium font-mono-code shrink-0 max-w-[160px] truncate"
            title="Filter Alokasi Proyek"
          >
            <option value="ALL">Semua Proyek</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name.substring(0, 16)}...</option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium font-mono-code shrink-0"
            title="Filter Role Sistem"
          >
            <option value="ALL">Semua Role</option>
            <option value="superuser">👑 Superuser</option>
            <option value="hr">🛡️ HR</option>
            <option value="finance">💰 Finance</option>
            <option value="staff">👤 Staff Biasa</option>
          </select>

          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value as any)}
            className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium font-mono-code shrink-0"
            title="Filter Domisili Kerja"
          >
            <option value="ALL">Semua Domisili</option>
            <option value="NON_LOKAL">✈️ Non-Lokal (Roster)</option>
            <option value="LOKAL">📍 Lokal</option>
          </select>

          {isFinanceOrSuper && (
            <button
              onClick={() => setShowSalaryNominal(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                showSalaryNominal
                  ? 'bg-orange-50 text-[#FF6B00] border-orange-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Toggle sensor angka nominal gaji staf (default: sensor)"
            >
              {showSalaryNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
              <span>{showSalaryNominal ? 'Sembunyikan Gaji' : 'Tampilkan Gaji'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Employees Grid Table */}
      <div id="tour-employee-table" className="glass-card rounded-3xl p-5 sm:p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code">
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3">ID Login Akun</th>
                <th className="py-2.5 px-3">Status Lokal / Non-Lokal</th>
                <th className="py-2.5 px-3">Role & Hak Akses</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Saldo Cuti</th>
                {!isStaff && <th className="py-2.5 px-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleEmployees.map((emp, idx) => {
                const assignedProj = projects.find(p => p.id === emp.assignedProjectId);
                const remainingLeave = emp.leaveQuota - emp.usedLeave;
                const effRole = getEffectiveSystemRole(emp);

                return (
                  <tr
                    key={emp.id}
                    style={{ animationDelay: `${(idx + 1) * 45}ms` }}
                    className={`hover:bg-slate-50/80 transition-colors table-row-animate group ${
                      emp.status === 'INACTIVE' ? 'opacity-75 bg-slate-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp.avatar}
                          alt={emp.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200/90 shadow-2xs shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 leading-tight text-xs sm:text-[13px] truncate">{emp.name}</div>
                          <div className="text-[10.5px] text-slate-500 font-mono-code mt-0.5">
                            {emp.employmentType}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono-code text-xs font-bold shadow-2xs"
                        title="ID Kredensial Login Akun Sistem"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{emp.loginId || (emp.id === 'EMP-001' ? 'admin' : emp.id)}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {emp.workLocationType === 'NON_LOKAL' ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/80 font-mono-code text-xs font-bold shadow-2xs"
                          title="Staf Non-Lokal / Site Luar (Siklus Roster Cuti Berkala)"
                        >
                          <Plane className="w-3.5 h-3.5 text-purple-600" />
                          <span>Non-Lokal</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono-code text-xs font-bold shadow-2xs"
                          title="Staf Domisili Lokal (Kantor Pusat / Surabaya Sekitarnya)"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Lokal</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col items-start gap-0.5">
                        {effRole === 'superuser' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-black text-[9.5px] uppercase font-mono-code shadow-2xs">
                            <Crown className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>SUPERUSER</span>
                          </span>
                        ) : effRole === 'finance' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-300 font-black text-[9.5px] uppercase font-mono-code shadow-2xs">
                            <Banknote className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>FINANCE</span>
                          </span>
                        ) : (effRole === 'admin' || effRole === 'hr') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-300 font-black text-[9.5px] uppercase font-mono-code shadow-2xs">
                            <Shield className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>HR</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[9.5px] uppercase font-mono-code">
                            <UserCheck className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>STAFF BIASA</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono-code capitalize pl-0.5">
                          {effRole === 'superuser' ? 'Direksi / Superuser' : emp.role.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {emp.id === 'EMP-001' ? (
                        <div className="flex items-center gap-1.5" title="Akun Master Administrator">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                          <span className="text-[10px] font-bold font-mono-code text-slate-700">MASTER</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isStaff}
                            onClick={() => handleToggleEmployeeStatus(emp)}
                            title={emp.status === 'INACTIVE' ? 'Status: Non-Aktif (Klik untuk mengaktifkan kembali)' : 'Status: Aktif (Klik untuk menonaktifkan akun)'}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              emp.status === 'INACTIVE' ? 'bg-slate-300 hover:bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600'
                            } ${isStaff ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                emp.status === 'INACTIVE' ? 'translate-x-0' : 'translate-x-4'
                              }`}
                            />
                          </button>
                          {emp.status === 'INACTIVE' && (
                            <span className="text-[9.5px] font-bold font-mono-code uppercase px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              NON-AKTIF
                            </span>
                          )}
                        </div>
                      )}
                    </td>



                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {emp.workLocationType === 'NON_LOKAL' ? (
                          <>
                            {(() => {
                              const baseQuota = emp.nonLokalLeaveConfig?.leaveQuotaPerPeriod || 9;
                              const accDays = emp.nonLokalLeaveConfig?.accumulatedLeaveDays || 0;
                              const effectiveQuota = baseQuota + accDays;
                              const usedDays = emp.nonLokalLeaveConfig?.usedPeriodLeave || 0;
                              const remainingRoster = Math.max(0, effectiveQuota - usedDays);
                              return (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                      Roster: {remainingRoster} Hr Sisa
                                    </span>
                                    <span className="text-[9.5px] text-slate-500 font-mono-code">
                                      ({usedDays}/{effectiveQuota} Terpakai)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[9px] font-mono-code text-purple-700 bg-purple-50/90 border border-purple-200/90 rounded-md px-1.5 py-0.5">
                                    <Plane className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                    <span>Pokok {baseQuota} Hr</span>
                                    {accDays > 0 && (
                                      <span className="bg-amber-100 text-amber-800 px-1 rounded font-bold" title={`Akumulasi disetujui HR: ${accDays} hari`}>
                                        +{accDays} Acc HR
                                      </span>
                                    )}
                                    <span className="text-purple-300">•</span>
                                    <span className="text-slate-600">
                                      {emp.nonLokalLeaveConfig?.nextEligibleLeaveDate 
                                        ? emp.nonLokalLeaveConfig.nextEligibleLeaveDate.replace(/^\d{4}-/, '') 
                                        : 'Siap'}
                                    </span>
                                    {emp.nonLokalLeaveConfig?.allowEarlyLeave && (
                                      <span title="Boleh Pengajuan Cuti Lebih Awal" className="text-amber-600 font-bold ml-auto cursor-help">⚡</span>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                remainingLeave > 4 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                Sisa: {remainingLeave} Hari
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono-code">
                                ({emp.usedLeave}/{emp.leaveQuota} Pakai)
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono-code flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              <span>Lokal: Siklus 12 Bln (12 Hr)</span>
                            </div>
                          </>
                        )}

                        {typeof emp.unpaidLeaveDaysTotal === 'number' && emp.unpaidLeaveDaysTotal > 0 && (
                          <div 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold font-mono-code"
                            title="Total cuti di luar jatah sah yang dipotong gaji pro-rata"
                          >
                            <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                            <span>⚠️ {emp.unpaidLeaveDaysTotal} Hari Potong Gaji</span>
                          </div>
                        )}
                      </div>
                    </td>



                    {!isStaff && (
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => handleToggleDropdown(e, emp)}
                          className={`action-dropdown-trigger p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1 text-xs font-semibold ${
                            dropdownAnchor?.emp.id === emp.id
                              ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90'
                          }`}
                          title="Menu Aksi Karyawan"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Load More & Infinite Scroll Controller */}
        <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="font-mono-code text-[11px] text-slate-500">
            Menampilkan <span className="font-bold text-slate-900">{visibleEmployees.length}</span> dari <span className="font-bold text-slate-900">{filteredEmployees.length}</span> Karyawan
          </div>

          {hasMore ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayLimit(prev => Math.min(prev + PAGE_SIZE, filteredEmployees.length))}
                className="px-4 py-2 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-orange-200 hover:border-[#FF6B00] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                <span>Muat 15 Karyawan Lagi ({filteredEmployees.length - displayLimit} Tersisa)</span>
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-emerald-600 font-mono-code font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Seluruh {filteredEmployees.length} karyawan telah dimuat</span>
            </div>
          )}
        </div>
        <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />
      </div>

      {/* Action Dropdown Menu Portal (Rendered to document.body to guarantee no table-row stacking context overlap) */}
      {dropdownAnchor && typeof document !== 'undefined' && createPortal(
        <div
          className="action-dropdown-portal fixed z-[99999] w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 text-left divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95"
          style={{
            top: dropdownAnchor.top !== undefined ? `${dropdownAnchor.top}px` : undefined,
            bottom: dropdownAnchor.bottom !== undefined ? `${dropdownAnchor.bottom}px` : undefined,
            right: `${dropdownAnchor.right}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 py-2 bg-slate-50/90">
            <p className="font-bold text-slate-900 text-xs truncate">{dropdownAnchor.emp.name}</p>
            <p className="text-[10px] text-slate-500 font-mono-code">{dropdownAnchor.emp.employmentType} • {dropdownAnchor.emp.workLocationType === 'NON_LOKAL' ? '✈️ Non-Lokal' : '📍 Lokal'}</p>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                const emp = dropdownAnchor.emp;
                setDropdownAnchor(null);
                openEditModal(emp);
              }}
              className="w-full px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-xs">Edit Karyawan</div>
                <div className="text-[10px] text-slate-400">Ubah profil, divisi & gaji</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                const emp = dropdownAnchor.emp;
                setDropdownAnchor(null);
                handleOpenRosterModal(emp);
              }}
              className="w-full px-3 py-2 text-slate-700 hover:text-purple-900 hover:bg-purple-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Plane className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-xs flex items-center gap-1">
                  <span>Cuti Roster & Domisili</span>
                  {dropdownAnchor.emp.workLocationType === 'NON_LOKAL' && (
                    <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-full font-bold">Roster</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">Atur jatah & siklus 3 bulanan</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                const emp = dropdownAnchor.emp;
                setDropdownAnchor(null);
                handleOpenResetModal(emp);
              }}
              className="w-full px-3 py-2 text-slate-700 hover:text-amber-900 hover:bg-amber-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-xs">Reset Password & Login</div>
                <div className="text-[10px] text-slate-400">Cek ID login & salin format WA</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                const emp = dropdownAnchor.emp;
                setDropdownAnchor(null);
                setBiometricTargetEmployee(emp);
              }}
              className="w-full px-3 py-2 text-slate-700 hover:text-emerald-900 hover:bg-emerald-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-xs">
                  {dropdownAnchor.emp.biometric?.isEnrolled ? 'Update Biometrik Wajah' : 'Daftarkan Biometrik'}
                </div>
                <div className="text-[10px] text-slate-400">Enrollment 4 pose wajah</div>
              </div>
            </button>
            {isSuperuser && onImpersonateEmployee && (
              <button
                type="button"
                onClick={() => {
                  const emp = dropdownAnchor.emp;
                  setDropdownAnchor(null);
                  onImpersonateEmployee(emp);
                }}
                className="w-full px-3 py-2 text-amber-700 hover:text-amber-950 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-xs">Impersonate Karyawan Ini</div>
                  <div className="text-[10px] text-amber-600/80">Login & tinjau sistem sebagai {dropdownAnchor.emp.name.split(',')[0]}</div>
                </div>
              </button>
            )}

            {!isStaff && dropdownAnchor.emp.id !== 'EMP-001' && (
              <button
                type="button"
                onClick={() => {
                  const emp = dropdownAnchor.emp;
                  setDropdownAnchor(null);
                  handleToggleEmployeeStatus(emp);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 ${
                  dropdownAnchor.emp.status === 'INACTIVE'
                    ? 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50/70'
                    : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50/70'
                }`}
              >
                <Power className={`w-3.5 h-3.5 ${dropdownAnchor.emp.status === 'INACTIVE' ? 'text-emerald-600' : 'text-amber-600'} shrink-0`} />
                <div className="text-left">
                  <div className="font-semibold text-xs">
                    {dropdownAnchor.emp.status === 'INACTIVE' ? 'Aktifkan Akun Karyawan' : 'Nonaktifkan Akun (Resign/Keluar)'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {dropdownAnchor.emp.status === 'INACTIVE' ? 'Buka kembali hak akses login & presensi' : 'Kunci login, data tetap tersimpan untuk audit'}
                  </div>
                </div>
              </button>
            )}
          </div>

          {isHR && dropdownAnchor.emp.id !== 'EMP-001' && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  const emp = dropdownAnchor.emp;
                  setDropdownAnchor(null);
                  if (confirm(`Yakin hapus data karyawan ${emp.name}? Tindakan ini akan menghapus data profil, akun login, dan riwayat presensi secara permanen.`)) {
                    onDeleteEmployee(emp.id);
                  }
                }}
                className="w-full px-3 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-xs">Hapus Karyawan</div>
                  <div className="text-[10px] text-rose-400">Akses HR & Superuser</div>
                </div>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Add / Edit Modal (Portal to document.body for guaranteed viewport centering) */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-auto border border-slate-200 modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingEmployee ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
                </h3>
                <p className="text-xs text-slate-500">Isi parameter gaji, jatah cuti, dan role akun karyawan</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {saveError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{saveError}</span>
                </div>
              )}

              {/* Seksi 1: Data Akun & Profil */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Data Akun & Profil</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Nomor Induk Karyawan (NIK) <span className="text-slate-400 font-normal lowercase">(opsional)</span></label>
                    <input
                      type="text"
                      value={nik}
                      onChange={e => setNik(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-mono-code mt-1 text-slate-900 bg-white border border-slate-200"
                      placeholder="Kosongkan jika belum ada NIK"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">ID Login Akun</label>
                      {suggestedLoginId && (
                        <button
                          type="button"
                          onClick={() => {
                            setLoginId(suggestedLoginId);
                            setLoginIdError(null);
                          }}
                          className="text-[9.5px] font-mono-code font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                          title="Gunakan rekomendasi urutan sistem"
                        >
                          Saran: {suggestedLoginId}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={loginId}
                      onChange={e => {
                        const val = e.target.value.toLowerCase().replace(/\s+/g, '');
                        setLoginId(val);
                        setLoginIdError(null);
                      }}
                      placeholder={suggestedLoginId || 'd154'}
                      className={`w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold text-xs mt-1 bg-white ${
                        isLoginIdDuplicate || loginIdError
                          ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                          : 'border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                      required
                    />
                    {isLoginIdDuplicate && (
                      <span className="text-[9.5px] text-rose-600 font-medium mt-1 block">
                        ❌ ID '{loginId}' sudah terdaftar. Gunakan ID lain.
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-bold mt-1 text-slate-900 bg-white border border-slate-200"
                      placeholder="Nama lengkap"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Nomor WhatsApp / HP</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-mono-code mt-1 text-slate-900 bg-white border border-slate-200"
                      placeholder="+62 8..."
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Email Perusahaan</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 mt-1 text-slate-900 bg-white border border-slate-200"
                      placeholder="nama@primeprojectx.net"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Departemen</label>
                    <input
                      type="text"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 mt-1 bg-white border border-slate-200 text-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 2: Penugasan & Hak Akses */}
              <div className="space-y-2.5 pt-1">
                <div className="text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Penugasan & Hak Akses</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Jabatan / Posisi</label>
                    <input
                      type="text"
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 mt-1 bg-white border border-slate-200 text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Tingkat Akses (RBAC)</label>
                    <select
                      value={systemRole === 'admin' ? 'hr' : systemRole}
                      onChange={e => {
                        const newSysRole = e.target.value as SystemRole;
                        setSystemRole(newSysRole);
                        if (newSysRole === 'superuser') {
                          setRole('Director');
                        } else if (newSysRole === 'finance' && role === 'Employee') {
                          setRole('Finance');
                        } else if (newSysRole === 'hr' && role === 'Employee') {
                          setRole('HR_Manager');
                        }
                      }}
                      className="w-full glass-input rounded-xl px-3 py-2 font-bold text-slate-900 mt-1 bg-white border border-slate-200"
                    >
                      <option value="staff">👤 Staff Biasa</option>
                      <option value="hr">🛡️ HR Manager</option>
                      <option value="finance">💰 Finance & Payroll</option>
                      {(isSuperuser || editingEmployee?.systemRole === 'superuser') && (
                        <option value="superuser">👑 Superuser</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Role Jabatan</label>
                    <select
                      value={role}
                      onChange={e => {
                        const newRole = e.target.value as UserRole;
                        setRole(newRole);
                        if (newRole === 'Director') {
                          setSystemRole('superuser');
                        } else if (newRole === 'Finance' && systemRole === 'staff') {
                          setSystemRole('finance');
                        }
                      }}
                      className="w-full glass-input rounded-xl px-3 py-2 font-bold text-slate-900 mt-1 bg-white border border-slate-200"
                    >
                      <option value="Employee">Employee (Staff)</option>
                      <option value="Finance">Finance Manager</option>
                      <option value="HR_Manager">HR Manager</option>
                      <option value="Project_Manager">Project Manager</option>
                      <option value="Director">Director</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Status Akun</label>
                    <select
                      value={employeeStatus}
                      disabled={editingEmployee?.id === 'EMP-001'}
                      onChange={e => setEmployeeStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                      className="w-full glass-input rounded-xl px-3 py-2 font-bold text-slate-900 mt-1 bg-white border border-slate-200"
                    >
                      <option value="ACTIVE">🟢 Aktif</option>
                      <option value="INACTIVE">🔴 Non-Aktif / Resign</option>
                    </select>
                  </div>
                </div>

                {employeeStatus === 'INACTIVE' && (
                  <div>
                    <label className="text-[10px] font-bold text-rose-700 uppercase">Alasan Non-Aktif</label>
                    <input
                      type="text"
                      placeholder="Contoh: Resign resmi, Habis Kontrak, Mutasi..."
                      value={inactiveReason}
                      onChange={e => setInactiveReason(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 mt-1 bg-white border border-rose-300 text-slate-900"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Tipe Kontrak</label>
                    <select
                      value={employmentType}
                      onChange={e => setEmploymentType(e.target.value as any)}
                      className="w-full glass-input rounded-xl px-3 py-2 mt-1 bg-white border border-slate-200"
                    >
                      <option value="TETAP">Karyawan Tetap (PKWTT)</option>
                      <option value="KONTRAK">Karyawan Kontrak (PKWT)</option>
                      <option value="PROJECT_HIRE">Project-Based Hire</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Alokasi Proyek Utama</label>
                    <select
                      value={assignedProjectId}
                      onChange={e => setAssignedProjectId(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-mono-code mt-1 bg-white border border-slate-200"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name.substring(0, 22)}...</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seksi 3: Kebijakan Cuti & Domisili */}
              <div className="space-y-2.5 pt-1">
                <div className="text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center gap-1.5">
                  <Plane className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kebijakan Cuti & Domisili</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Status Domisili</label>
                    <select
                      value={workLocationTypeForm}
                      onChange={e => setWorkLocationTypeForm(e.target.value as WorkLocationType)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-bold text-slate-800 mt-1 bg-white border border-slate-200"
                    >
                      <option value="LOKAL">📍 Lokal (Cuti Tahunan)</option>
                      <option value="NON_LOKAL">✈️ Non-Lokal (Roster)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Jatah Cuti Tahunan (Hari)</label>
                    <input
                      type="number"
                      value={leaveQuota}
                      onChange={e => setLeaveQuota(Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold mt-1 bg-white border border-slate-200"
                      min={0}
                      max={30}
                      required
                    />
                  </div>
                </div>

                {workLocationTypeForm === 'NON_LOKAL' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Kuota Roster (Hari)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={rosterQuotaInput}
                        onChange={e => setRosterQuotaInput(Number(e.target.value))}
                        className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold mt-1 bg-white border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Siklus Roster (Bulan)</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={rosterCycleMonthsInput}
                        onChange={e => setRosterCycleMonthsInput(Number(e.target.value))}
                        className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold mt-1 bg-white border border-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seksi 4: Rekening & Penggajian */}
              <div className="space-y-2.5 pt-1">
                <div className="text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rekening & Penggajian</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Bank</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 mt-1 bg-white border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Nomor Rekening</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-mono-code mt-1 bg-white border border-slate-200"
                      required
                    />
                  </div>
                </div>

                {isFinanceOrSuper && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Gaji Pokok (IDR)</label>
                        <input
                          type="number"
                          step={500000}
                          value={baseSalary}
                          onChange={e => setBaseSalary(Number(e.target.value))}
                          className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold mt-1 bg-white border border-slate-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tunjangan Tetap (IDR)</label>
                        <input
                          type="number"
                          step={100000}
                          value={fixedAllowance}
                          onChange={e => setFixedAllowance(Number(e.target.value))}
                          className="w-full glass-input rounded-xl px-3 py-2 font-mono-code mt-1 bg-white border border-slate-200"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Uang Harian (IDR)</label>
                        <input
                          type="number"
                          step={5000}
                          value={dailyAllowance}
                          onChange={e => setDailyAllowance(Number(e.target.value))}
                          className="w-full glass-input rounded-xl px-3 py-2 font-mono-code mt-1 bg-white border border-slate-200"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoginIdDuplicate || isSaving}
                  className={`px-6 py-2 rounded-xl text-white text-xs font-bold transition-all ${
                    isLoginIdDuplicate || isSaving
                      ? 'bg-slate-300 cursor-not-allowed opacity-60'
                      : 'btn-orange cursor-pointer'
                  }`}
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Data Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Kredensial Login & Reset Password Karyawan (Centered Viewport Portal) */}
      {resetModalOpen && resetTargetEmployee && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden motion-fade-in-up">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Kredensial & Reset Password</h3>
                  <p className="text-[11px] text-amber-100">Manajemen akses masuk akun karyawan</p>
                </div>
              </div>
              <button
                onClick={() => setResetModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              
              {/* Employee Summary Card */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <img
                  src={resetTargetEmployee.avatar}
                  alt={resetTargetEmployee.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-sm truncate">{resetTargetEmployee.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{resetTargetEmployee.position} • {resetTargetEmployee.department}</div>
                  <div className="text-[10px] text-slate-500 font-mono-code mt-0.5">
                    ID Login Akun: <span className="font-bold text-slate-800 font-mono">{resetTargetEmployee.loginId || (resetTargetEmployee.id === 'EMP-001' ? 'admin' : resetTargetEmployee.id)}</span>
                  </div>
                </div>
              </div>

              {/* Login Credentials Box */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2.5">
                <div className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono-code">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Data Login Akun
                  </span>
                  <span className="text-[9px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                    Aktif
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono-code">ID Login (Username)</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono-code font-black text-indigo-900 text-sm">
                        {resetTargetEmployee.loginId || (resetTargetEmployee.id === 'EMP-001' ? 'admin' : resetTargetEmployee.id)}
                      </span>
                      <button
                        onClick={() => handleCopyText(
                          resetTargetEmployee.loginId || (resetTargetEmployee.id === 'EMP-001' ? 'admin' : resetTargetEmployee.id),
                          'loginId'
                        )}
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        title="Salin ID Login"
                      >
                        {copiedKey === 'loginId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono-code">Password Default</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono-code font-black text-amber-700 text-sm">
                        zzz
                      </span>
                      <button
                        onClick={() => handleCopyText('zzz', 'defaultPw')}
                        className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
                        title="Salin Password Default"
                      >
                        {copiedKey === 'defaultPw' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[10.5px] text-indigo-800/80 leading-relaxed font-mono-code">
                  Karyawan dapat masuk menggunakan <strong className="text-indigo-950 font-bold">ID Login Akun ({resetTargetEmployee.loginId || 'd...'})</strong> atau <strong className="text-indigo-950 font-bold">Email Resmi</strong>.
                </p>
              </div>

              {/* Feedback Success Message */}
              {resetSuccessMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Password Berhasil Di-reset!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-snug">
                    {resetSuccessMessage}
                  </p>
                  <button
                    onClick={handleCopyWhatsAppFormat}
                    className="mt-1 w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    {copiedKey === 'whatsapp' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'whatsapp' ? 'Tersalin!' : 'Salin Format Notifikasi WhatsApp'}</span>
                  </button>
                </div>
              )}

              {/* Reset Action Controls */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => handleExecuteResetPassword(true)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Sedang Memproses...' : '⚡ Reset Cepat ke Default ("zzz")'}</span>
                </button>

                {/* Custom Password Toggle / Input */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Atau Tetapkan Password Kustom Baru (Opsional):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ketik password baru..."
                      value={customPassword}
                      onChange={e => setCustomPassword(e.target.value)}
                      className="flex-1 glass-input rounded-xl px-3 py-1.5 font-mono-code text-xs text-slate-800"
                    />
                    <button
                      type="button"
                      disabled={isResetting || !customPassword.trim()}
                      onClick={() => handleExecuteResetPassword(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs cursor-pointer transition-colors disabled:opacity-40"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyWhatsAppFormat}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3 text-slate-500" />
                <span>Salin Format WA</span>
              </button>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Non-Lokal / Roster Leave Modal (HR Manager Control) */}
      {rosterModalOpen && rosterTargetEmp && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setRosterModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-4 my-auto border border-purple-200 modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                  <Plane className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    Pengaturan Cuti Roster & Domisili
                  </h3>
                  <p className="text-xs text-slate-500">
                    Otorisasi HR Manager untuk jatah cuti khusus staf non-lokal (3 bulanan)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRosterModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Employee Info Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={rosterTargetEmp.avatar}
                  alt={rosterTargetEmp.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-300"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">{rosterTargetEmp.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono-code">
                    {rosterTargetEmp.loginId ? `ID: ${rosterTargetEmp.loginId} • ` : ''}{rosterTargetEmp.nik && rosterTargetEmp.nik.trim() ? `NIK: ${rosterTargetEmp.nik} • ` : ''}{rosterTargetEmp.position}
                  </div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono-code ${
                rosterLocationType === 'NON_LOKAL' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {rosterLocationType === 'NON_LOKAL' ? '✈️ NON-LOKAL' : '📍 LOKAL'}
              </span>
            </div>

            <form onSubmit={handleSaveRosterConfig} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                  Status Domisili / Klasifikasi Kerja
                </label>
                <select
                  value={rosterLocationType}
                  onChange={e => setRosterLocationType(e.target.value as WorkLocationType)}
                  className="w-full glass-input rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="NON_LOKAL">✈️ Non-Lokal (Memperoleh Jatah Cuti Roster Periodik Tiap 3 Bulan)</option>
                  <option value="LOKAL">📍 Lokal (Mengikuti Kebijakan Cuti Tahunan Standar)</option>
                </select>
              </div>

              {rosterLocationType === 'NON_LOKAL' && (
                <div className="space-y-3.5 p-4 rounded-2xl bg-purple-50/60 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5 font-mono-code">
                      <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                      Parameter Cuti Roster 3 Bulanan (HR Policy)
                    </span>
                    <span className="text-[9.5px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-mono-code">
                      KONTROL HR
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">
                        Siklus Roster (Bulan)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={rosterCycleMonths}
                        onChange={e => setRosterCycleMonths(Number(e.target.value))}
                        className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold"
                        required
                      />
                      <span className="text-[9.5px] text-slate-400 mt-0.5 block">Standar DMJ: 3 bulan sekali</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">
                        Jatah Kuota per Periode (Hari)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={rosterQuotaPerPeriod}
                        onChange={e => setRosterQuotaPerPeriod(Number(e.target.value))}
                        className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold text-purple-900"
                        required
                      />
                      <span className="text-[9.5px] text-slate-400 mt-0.5 block">Standar DMJ: 8 – 12 hari</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">
                        Hari Terpakai Periode Ini
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={rosterUsedPeriodLeave}
                        onChange={e => setRosterUsedPeriodLeave(Number(e.target.value))}
                        className="w-full glass-input rounded-xl px-3 py-2 font-mono-code"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">
                        Tanggal Roster Berikutnya
                      </label>
                      <input
                        type="date"
                        value={rosterNextEligibleDate}
                        onChange={e => setRosterNextEligibleDate(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 font-mono-code text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      Tanggal Roster Terakhir
                    </label>
                    <input
                      type="date"
                      value={rosterLastLeaveDate}
                      onChange={e => setRosterLastLeaveDate(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 font-mono-code text-slate-800"
                    />
                  </div>

                  {/* HR Accumulation Policy Card */}
                  <div className="p-3.5 rounded-xl bg-purple-100/50 border border-purple-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Akumulasi Cuti Roster ke Periode Berikutnya</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase font-mono-code px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                        {isHR ? 'Otorisasi HR Aktif' : 'Khusus HR Manager'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-purple-200">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">Izinkan Akumulasi Jatah Cuti</div>
                        <p className="text-[10px] text-slate-500">
                          Jatah cuti periode sebelumnya dapat dialihkan dan diakumulasikan ke roster periode berjalan
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!isHR}
                        checked={rosterAllowAccumulation}
                        onChange={e => setRosterAllowAccumulation(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded cursor-pointer disabled:opacity-50"
                      />
                    </div>

                    {rosterAllowAccumulation && (
                      <div className="space-y-2 pt-1 animate-in fade-in">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-purple-950 uppercase block">
                              Tambahan Hari Akumulasi (Hari)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              disabled={!isHR}
                              value={rosterAccumulatedDays}
                              onChange={e => setRosterAccumulatedDays(Number(e.target.value))}
                              className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold text-purple-900 border-purple-300 disabled:opacity-60"
                              required={rosterAllowAccumulation}
                            />
                            <span className="text-[9.5px] text-purple-700 mt-0.5 block">Disetujui HR Manager</span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-center flex flex-col justify-center">
                            <span className="text-[10px] font-bold uppercase text-purple-800">Total Kuota Sah Aktif</span>
                            <span className="text-base font-black font-mono-code text-purple-900 mt-0.5">
                              {Number(rosterQuotaPerPeriod) + Number(rosterAccumulatedDays)} Hari
                            </span>
                            <span className="text-[9px] text-purple-600 font-mono-code">
                              (Pokok: {rosterQuotaPerPeriod} + Acc: {rosterAccumulatedDays})
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block">
                            Catatan / Justifikasi HR Manager (Akumulasi)
                          </label>
                          <input
                            type="text"
                            disabled={!isHR}
                            value={rosterAccumulationNotes}
                            onChange={e => setRosterAccumulationNotes(e.target.value)}
                            placeholder="Contoh: Pekerjaan shutdown tertunda, sisa roster Q1 diakumulasikan ke Q2..."
                            className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 border-purple-300 disabled:opacity-60"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Early Leave Permission Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-purple-200 shadow-2xs">
                    <div>
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Izinkan Pengajuan Cuti Lebih Awal
                      </div>
                      <p className="text-[10.5px] text-slate-500">
                        Karyawan dapat mengajukan sebelum tanggal jadwal jika ada tiket/keperluan penting
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={rosterAllowEarlyLeave}
                      onChange={e => setRosterAllowEarlyLeave(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      Catatan / Kebijakan Khusus Karyawan Ini
                    </label>
                    <textarea
                      rows={2}
                      value={rosterNotes}
                      onChange={e => setRosterNotes(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-800"
                      placeholder="Contoh: Tiket pesawat PP ditanggung proyek, jadwal dandori rotasi site..."
                    />
                  </div>

                  {/* Excel Schedule History */}
                  {rosterTargetEmp.nonLokalLeaveConfig?.scheduledLeaveHistory && rosterTargetEmp.nonLokalLeaveConfig.scheduledLeaveHistory.length > 0 && (
                    <div className="pt-2 border-t border-purple-200">
                      <div className="text-[10px] font-bold text-purple-900 uppercase mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-600" />
                        Riwayat Jadwal Sheet Excel Proyek DMJ 2025:
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {rosterTargetEmp.nonLokalLeaveConfig.scheduledLeaveHistory.map((sch, i) => (
                          <div key={i} className="text-[10px] font-mono-code p-1.5 rounded-lg bg-white border border-purple-100 flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Periode {i + 1}: {sch.startDate} s/d {sch.endDate}</span>
                            <span className="font-bold text-purple-700">{sch.days} Hari ({sch.status})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CARD KEBIJAKAN CUTI KARYAWAN LOKAL */}
              {rosterLocationType === 'LOKAL' && (
                <div className="space-y-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                    <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 font-mono-code">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Kebijakan Cuti Karyawan Domisili Lokal (Standar DMJ)
                    </span>
                    <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-mono-code">
                      SIKLUS 12 BULAN
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Siklus Periode</span>
                      <span className="text-sm font-black text-slate-900 font-mono-code mt-0.5 block">12 Bulan</span>
                      <span className="text-[9px] text-slate-400">1 Tahun Penuh</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Jatah Cuti Tahunan</span>
                      <span className="text-sm font-black text-emerald-700 font-mono-code mt-0.5 block">{rosterTargetEmp.leaveQuota || 12} Hari</span>
                      <span className="text-[9px] text-slate-400">Hari Kerja</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Sisa Hak Cuti</span>
                      <span className="text-sm font-black text-emerald-800 font-mono-code mt-0.5 block">
                        {(rosterTargetEmp.leaveQuota || 12) - (rosterTargetEmp.usedLeave || 0)} Hari
                      </span>
                      <span className="text-[9px] text-slate-500">({rosterTargetEmp.usedLeave || 0} Terpakai)</span>
                    </div>
                  </div>

                  {typeof rosterTargetEmp.unpaidLeaveDaysTotal === 'number' && rosterTargetEmp.unpaidLeaveDaysTotal > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between font-mono-code">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Akumulasi Cuti di Luar Jatah (Potong Gaji):</span>
                      </span>
                      <span className="font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">
                        {rosterTargetEmp.unpaidLeaveDaysTotal} Hari
                      </span>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-white/80 border border-emerald-200/60 text-[11px] text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Ketentuan Operasional Cuti Lokal:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-slate-600">
                      <li>Pengajuan cuti tahunan memotong saldo hak cuti 12 hari per tahun.</li>
                      <li>Jika durasi melebihi sisa kuota, hari berlebih berstatus <b>Cuti di Luar Jatah (Kondisi Potong Gaji)</b> dan wajib disetujui HR Manager.</li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRosterModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Biometric Enrollment 4-Pose Modal */}
      {biometricTargetEmployee && (
        <BiometricEnrollmentModal
          isOpen={Boolean(biometricTargetEmployee)}
          onClose={() => setBiometricTargetEmployee(null)}
          targetEmployee={biometricTargetEmployee}
          onSaveBiometric={handleSaveBiometricForEmployee}
          operatorName={currentUser?.name || 'HR'}
        />
      )}

    </div>
  );
};
