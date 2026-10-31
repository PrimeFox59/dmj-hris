import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  Printer,
  Download,
  CheckCircle2,
  Calendar,
  Eye,
  EyeOff,
  X,
  CreditCard,
  Building,
  Shield,
  QrCode,
  Briefcase,
  TrendingUp,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Edit3,
  ArrowRight,
  RotateCcw,
  Calculator,
  Check,
  Send,
  Search,
  MoreVertical,
  Lock,
  Unlock,
  FileText
} from 'lucide-react';
import { Employee, PayrollRecord, Project, SalaryRuleConfig, AttendanceRecord, SystemRole, getEffectiveSystemRole, AnnualWorkCalendarConfig, WorkPeriodItem } from '../types';
import { api } from '../services/api';
import { rtcService } from '../services/rtcService';
import { formatSalaryDisplay, calculateEmployeePayroll, EmployeeAuditOverride } from '../utils/payrollCalculator';
import { EmployeeTimesheetDetailModal } from './EmployeeTimesheetDetailModal';

interface PayrollTabProps {
  currentUser?: Employee;
  employees: Employee[];
  projects: Project[];
  attendances: AttendanceRecord[];
  salaryRules: SalaryRuleConfig;
  workCalendar?: AnnualWorkCalendarConfig | null;
  selectedProjectId?: string;
  onSelectProjectId?: (projectId: string) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  onUpdateAttendance?: (record: AttendanceRecord) => void;
}

export const PayrollTab: React.FC<PayrollTabProps> = ({
  currentUser,
  employees,
  projects,
  attendances,
  salaryRules,
  workCalendar,
  selectedProjectId = 'ALL',
  onSelectProjectId,
  onUpdateEmployee,
  onUpdateAttendance
}) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isSuperuser = currentRole === 'superuser';
  const isFinance = currentRole === 'finance';
  const isHR = currentRole === 'admin' || currentRole === 'hr' || currentUser?.role === 'HR_Manager';
  const isStaff = currentRole === 'staff';
  
  // Permissions: HR Manager, Finance, and Superuser can prepare and manage payroll
  const canManagePayroll = isHR || isFinance || isSuperuser;
  const isSelfOnly = !canManagePayroll;
  const isHRManagerOrSuper = isHR || isSuperuser;
  const isFinanceOrSuper = isFinance || isSuperuser;

  // Selected Period & Project Filter
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    return localStorage.getItem('prime_payroll_selected_period') || 'Periode Oktober 2026';
  });
  const [currentProjectFilter, setCurrentProjectFilter] = useState<string>(selectedProjectId);
  const [activeSubView, setActiveSubView] = useState<'REKAP_GAJI' | 'ALOKASI_PROYEK' | 'PROYEKSI_EAC'>('REKAP_GAJI');
  const [searchQuery, setSearchQuery] = useState('');
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'PENDING' | 'VALIDATED'>('ALL');

  // =========================================================================
  // RANGE DATE OF WORKING DAY & CUTOFF STATE
  // =========================================================================
  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem('prime_payroll_start_date') || '2026-08-21';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return localStorage.getItem('prime_payroll_end_date') || '2026-09-20';
  });
  const [customWorkingDays, setCustomWorkingDays] = useState<number>(() => {
    const saved = localStorage.getItem('prime_payroll_working_days');
    return saved ? Number(saved) : 22;
  });

  // =========================================================================
  // 2-STAGE PAYROLLING WORKFLOW STATE (HR Manager -> Finance)
  // =========================================================================
  const [batchStatus, setBatchStatus] = useState<'DRAFT_HR' | 'SUBMITTED_TO_FINANCE' | 'PROCESSED_BY_FINANCE'>(() => {
    return (localStorage.getItem('prime_payroll_batch_status') as any) || 'DRAFT_HR';
  });
  const [submittedAt, setSubmittedAt] = useState<string | null>(() => {
    return localStorage.getItem('prime_payroll_submitted_at') || null;
  });
  const [processedAt, setProcessedAt] = useState<string | null>(() => {
    return localStorage.getItem('prime_payroll_processed_at') || null;
  });

  // =========================================================================
  // HR MANAGER AUDIT OVERRIDES PER USER (Presensi, Cuti, Telat, Lembur)
  // =========================================================================
  const [auditOverrides, setAuditOverrides] = useState<Record<string, EmployeeAuditOverride>>(() => {
    try {
      const saved = localStorage.getItem('prime_payroll_audit_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // =========================================================================
  // PRIVACY NOMINAL MASKING STATE (Default: HIDE / Sensor)
  // =========================================================================
  const [showPayrollNominal, setShowPayrollNominal] = useState<boolean>(false);

  // =========================================================================
  // MODALS STATE
  // =========================================================================
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);
  const [editingSalaryEmp, setEditingSalaryEmp] = useState<Employee | null>(null);
  const [auditingEmployee, setAuditingEmployee] = useState<{ employee: Employee; record: PayrollRecord } | null>(null);
  const [viewingTimesheetEmp, setViewingTimesheetEmp] = useState<Employee | null>(null);

  // Re-active attendance state synced with prop
  const [localAttendances, setLocalAttendances] = useState<AttendanceRecord[]>(attendances);
  useEffect(() => {
    setLocalAttendances(attendances);
  }, [attendances]);

  // Lock subview to personal slip for staff
  useEffect(() => {
    if (!canManagePayroll && activeSubView !== 'REKAP_GAJI') {
      setActiveSubView('REKAP_GAJI');
    }
  }, [canManagePayroll, activeSubView]);

  const handleSaveTimesheetCorrection = (updatedRecord: AttendanceRecord, reason: string) => {
    setLocalAttendances(prev => {
      const idx = prev.findIndex(a => a.id === updatedRecord.id || (a.employeeId === updatedRecord.employeeId && a.date === updatedRecord.date));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedRecord;
        return next;
      }
      return [updatedRecord, ...prev];
    });

    if (onUpdateAttendance) {
      onUpdateAttendance(updatedRecord);
    }
  };

  // Form states for "Atur Gaji Karyawan" Modal
  const [salaryFormBase, setSalaryFormBase] = useState<number>(0);
  const [salaryFormFixed, setSalaryFormFixed] = useState<number>(0);
  const [salaryFormDaily, setSalaryFormDaily] = useState<number>(0);
  const [salaryFormBankName, setSalaryFormBankName] = useState<string>('');
  const [salaryFormBankAcc, setSalaryFormBankAcc] = useState<string>('');
  const [salaryFormBankHolder, setSalaryFormBankHolder] = useState<string>('');
  const [salaryFormEmpType, setSalaryFormEmpType] = useState<'TETAP' | 'KONTRAK' | 'PROJECT_HIRE'>('TETAP');

  // Form states for "Audit & Validasi HR Manager" Modal
  const [auditFormPresentDays, setAuditFormPresentDays] = useState<number>(22);
  const [auditFormLeaveDays, setAuditFormLeaveDays] = useState<number>(0);
  const [auditFormUnpaidLeaveDays, setAuditFormUnpaidLeaveDays] = useState<number>(0);
  const [auditFormLateDays, setAuditFormLateDays] = useState<number>(0);
  const [auditFormLateMinutes, setAuditFormLateMinutes] = useState<number>(0);
  const [auditFormWaiveLate, setAuditFormWaiveLate] = useState<boolean>(false);
  const [auditFormLateMode, setAuditFormLateMode] = useState<'AUTO' | 'MANUAL_RP' | 'WAIVED'>('AUTO');
  const [auditFormCustomLatePenalty, setAuditFormCustomLatePenalty] = useState<number>(0);
  const [auditFormCustomDailyRate, setAuditFormCustomDailyRate] = useState<number>(0);
  const [auditFormAlphaDays, setAuditFormAlphaDays] = useState<number>(0);
  const [auditFormOvertimeHours, setAuditFormOvertimeHours] = useState<number>(16);
  const [auditFormNotes, setAuditFormNotes] = useState<string>('');
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  // Close floating action menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveActionMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Sync external project selection if prop changes
  useEffect(() => {
    if (selectedProjectId) {
      setCurrentProjectFilter(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Lock body scroll when any modal is opened to ensure viewport stability
  useEffect(() => {
    if (selectedSlip || editingSalaryEmp || auditingEmployee || viewingTimesheetEmp) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedSlip, editingSalaryEmp, auditingEmployee, viewingTimesheetEmp]);

  const handleFilterChange = (projId: string) => {
    setCurrentProjectFilter(projId);
    if (onSelectProjectId) {
      onSelectProjectId(projId);
    }
  };

  
  // Master Work Calendar State (Synchronized with prop and SQLite backend)
  const [selectedPayrollYear, setSelectedPayrollYear] = useState<number>(() => {
    return workCalendar?.year || new Date().getFullYear() || 2026;
  });

  const [activeWorkCalendar, setActiveWorkCalendar] = useState<AnnualWorkCalendarConfig | null>(workCalendar || null);

  const payrollAvailableYears = useMemo(() => {
    const minYear = Math.min(2024, selectedPayrollYear - 2);
    const maxYear = Math.max(2045, selectedPayrollYear + 10);
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    if (!list.includes(selectedPayrollYear)) {
      list.push(selectedPayrollYear);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [selectedPayrollYear]);

  useEffect(() => {
    api.getWorkCalendar(selectedPayrollYear).then(res => {
      const cal = res?.calendar || res?.config;
      if (cal) setActiveWorkCalendar(cal);
    }).catch(err => console.warn('[PayrollTab] Could not load work calendar', err));
  }, [selectedPayrollYear, workCalendar]);

  useEffect(() => {
    const unsub = rtcService.subscribe('WORK_CALENDAR_UPDATED', (packet) => {
      if (packet.payload) {
        setActiveWorkCalendar(packet.payload);
      }
    });
    return () => unsub();
  }, []);

  // Derived active calendar periods from activeWorkCalendar
  const calendarPeriods: WorkPeriodItem[] = useMemo(() => {
    if (activeWorkCalendar?.periods && activeWorkCalendar.periods.length > 0) {
      return activeWorkCalendar.periods;
    }
    return [];
  }, [activeWorkCalendar]);

  const findMatchingPeriod = useCallback((nameOrId?: string | null): WorkPeriodItem | null => {
    if (!calendarPeriods.length || !nameOrId) return null;
    const clean = nameOrId.toLowerCase().trim();
    return calendarPeriods.find(p => 
      p.periodName.toLowerCase() === clean ||
      p.periodId.toLowerCase() === clean ||
      p.periodName.toLowerCase().replace('periode ', '') === clean.replace('periode ', '') ||
      p.periodName.toLowerCase().includes(clean) ||
      clean.includes(p.periodName.toLowerCase())
    ) || null;
  }, [calendarPeriods]);

  // Active Period Object based on selection or current month
  const currentPeriodObj = useMemo(() => {
    if (!calendarPeriods.length) return null;
    const matched = findMatchingPeriod(selectedPeriod);
    if (matched) return matched;
    const currentMonthIndex = new Date().getMonth();
    return calendarPeriods.find(p => p.monthIndex === currentMonthIndex) || calendarPeriods[0];
  }, [calendarPeriods, selectedPeriod, findMatchingPeriod]);

  const handleSelectPeriod = (target: WorkPeriodItem) => {
    if (!target) return;
    setSelectedPeriod(target.periodName);
    setStartDate(target.startDate);
    setEndDate(target.endDate);
    setCustomWorkingDays(target.effectiveWorkDays || 22);
    try {
      localStorage.setItem('prime_payroll_selected_period', target.periodName);
      localStorage.setItem('prime_payroll_start_date', target.startDate);
      localStorage.setItem('prime_payroll_end_date', target.endDate);
      localStorage.setItem('prime_payroll_working_days', String(target.effectiveWorkDays || 22));
    } catch (e) {}
  };

  // Auto-sync payroll period, cutoff dates, and working days with active calendar
  useEffect(() => {
    if (calendarPeriods.length > 0) {
      const savedPeriod = localStorage.getItem('prime_payroll_selected_period');
      const target = findMatchingPeriod(savedPeriod) || findMatchingPeriod(selectedPeriod) || calendarPeriods.find(p => p.monthIndex === new Date().getMonth()) || calendarPeriods[0];
      if (target) {
        setSelectedPeriod(target.periodName);
        setStartDate(target.startDate);
        setEndDate(target.endDate);
        setCustomWorkingDays(target.effectiveWorkDays || 22);
        try {
          localStorage.setItem('prime_payroll_selected_period', target.periodName);
          localStorage.setItem('prime_payroll_start_date', target.startDate);
          localStorage.setItem('prime_payroll_end_date', target.endDate);
          localStorage.setItem('prime_payroll_working_days', String(target.effectiveWorkDays || 22));
        } catch (e) {}
      }
    }
  }, [calendarPeriods, findMatchingPeriod]);

  const handleSyncFromCalendar = () => {
    if (currentPeriodObj) {
      handleSelectPeriod(currentPeriodObj);
    }
  };

  // Helper to set preset cutoff date ranges
  const handleSetPresetCutoff = (preset: 'STANDARD' | 'FULL_MONTH' | 'MONTH_END') => {
    if (preset === 'STANDARD') {
      if (currentPeriodObj) {
        handleSelectPeriod(currentPeriodObj);
        return;
      }
      setStartDate('2026-09-21');
      setEndDate('2026-10-20');
      setCustomWorkingDays(25);
      return;
    }

    if (preset === 'FULL_MONTH') {
      const monthIdx = currentPeriodObj?.monthIndex !== undefined ? currentPeriodObj.monthIndex : (new Date().getMonth());
      const yr = activeWorkCalendar?.year || 2026;
      const start = `${yr}-${String(monthIdx + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(yr, monthIdx + 1, 0).getDate();
      const end = `${yr}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(start);
      setEndDate(end);
      setCustomWorkingDays(currentPeriodObj?.effectiveWorkDays || 22);
      try {
        localStorage.setItem('prime_payroll_start_date', start);
        localStorage.setItem('prime_payroll_end_date', end);
        localStorage.setItem('prime_payroll_working_days', String(currentPeriodObj?.effectiveWorkDays || 22));
      } catch (e) {}
      return;
    }

    if (preset === 'MONTH_END') {
      const monthIdx = currentPeriodObj?.monthIndex !== undefined ? currentPeriodObj.monthIndex : (new Date().getMonth());
      const yr = activeWorkCalendar?.year || 2026;
      const prevMonth = monthIdx === 0 ? 12 : monthIdx;
      const prevYear = monthIdx === 0 ? yr - 1 : yr;
      const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
      const end = `${yr}-${String(monthIdx + 1).padStart(2, '0')}-25`;
      setStartDate(start);
      setEndDate(end);
      setCustomWorkingDays(currentPeriodObj?.effectiveWorkDays || 22);
      try {
        localStorage.setItem('prime_payroll_start_date', start);
        localStorage.setItem('prime_payroll_end_date', end);
        localStorage.setItem('prime_payroll_working_days', String(currentPeriodObj?.effectiveWorkDays || 22));
      } catch (e) {}
      return;
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    localStorage.setItem('prime_payroll_start_date', val);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    localStorage.setItem('prime_payroll_end_date', val);
  };

  const handleWorkingDaysChange = (val: number) => {
    const clamped = Math.max(1, Math.min(31, val || 22));
    setCustomWorkingDays(clamped);
    localStorage.setItem('prime_payroll_working_days', String(clamped));
  };

  // =========================================================================
  // WORKFLOW ACTION HANDLERS
  // =========================================================================
  const handleSubmitToFinance = () => {
    if (!isHRManagerOrSuper) {
      alert('Hanya HR Manager atau Direksi yang berwenang mengajukan data payroll ke Finance.');
      return;
    }
    const unvalidatedCount = allPayrollRecords.filter(r => r.hrValidationStatus !== 'VALIDATED_BY_HR').length;
    const confirmMsg = unvalidatedCount > 0
      ? `Terdapat ${unvalidatedCount} karyawan yang belum divalidasi audit presensinya secara individual. Lanjutkan pengajuan seluruh data ke Finance?`
      : 'Seluruh karyawan telah divalidasi oleh HR Manager. Lanjutkan pengajuan data ke Finance?';

    if (window.confirm(confirmMsg)) {
      const now = new Date().toISOString();
      setBatchStatus('SUBMITTED_TO_FINANCE');
      setSubmittedAt(now);
      localStorage.setItem('prime_payroll_batch_status', 'SUBMITTED_TO_FINANCE');
      localStorage.setItem('prime_payroll_submitted_at', now);
    }
  };

  const handleProcessByFinance = () => {
    if (!isFinanceOrSuper) {
      alert('Hanya Divisi Finance atau Superuser yang berwenang mengotorisasi perhitungan payroll final.');
      return;
    }
    if (window.confirm('Otorisasi dan eksekusi perhitungan gaji akhir periode ini? Seluruh potongan cuti, keterlambatan, BPJS, dan PPh 21 akan dibukukan secara resmi.')) {
      const now = new Date().toISOString();
      setBatchStatus('PROCESSED_BY_FINANCE');
      setProcessedAt(now);
      localStorage.setItem('prime_payroll_batch_status', 'PROCESSED_BY_FINANCE');
      localStorage.setItem('prime_payroll_processed_at', now);
    }
  };

  const handleRevertToDraft = () => {
    if (window.confirm('Kembalikan status ke Draf Persiapan HR Manager untuk dilakukan penyesuaian audit ulang?')) {
      setBatchStatus('DRAFT_HR');
      localStorage.setItem('prime_payroll_batch_status', 'DRAFT_HR');
    }
  };

  // =========================================================================
  // MODAL TRIGGER HANDLERS
  // =========================================================================
  const handleOpenSalaryModal = (emp: Employee) => {
    setEditingSalaryEmp(emp);
    setSalaryFormBase(emp.baseSalary || 0);
    setSalaryFormFixed(emp.fixedAllowance || 0);
    setSalaryFormDaily(emp.dailyAllowance || 0);
    setSalaryFormBankName(emp.bankAccount?.bankName || 'BCA');
    setSalaryFormBankAcc(emp.bankAccount?.accountNumber || '');
    setSalaryFormBankHolder(emp.bankAccount?.accountHolder || emp.name);
    setSalaryFormEmpType(emp.employmentType || 'TETAP');
  };

  const handleSaveSalaryModal = () => {
    if (!editingSalaryEmp) return;
    const updated: Employee = {
      ...editingSalaryEmp,
      baseSalary: Number(salaryFormBase) || 0,
      fixedAllowance: Number(salaryFormFixed) || 0,
      dailyAllowance: Number(salaryFormDaily) || 0,
      employmentType: salaryFormEmpType,
      bankAccount: {
        bankName: salaryFormBankName,
        accountNumber: salaryFormBankAcc,
        accountHolder: salaryFormBankHolder
      }
    };

    if (onUpdateEmployee) {
      onUpdateEmployee(updated);
    }
    setEditingSalaryEmp(null);
  };

  const handleOpenAuditModal = (emp: Employee, rec: PayrollRecord) => {
    const existingOverride = auditOverrides[emp.id];
    setAuditingEmployee({ employee: emp, record: rec });
    setAuditFormPresentDays(existingOverride?.presentDays !== undefined ? existingOverride.presentDays : rec.presentDays);
    setAuditFormLeaveDays(existingOverride?.leaveDays !== undefined ? existingOverride.leaveDays : rec.leaveDays);
    setAuditFormUnpaidLeaveDays(existingOverride?.unpaidLeaveDays !== undefined ? existingOverride.unpaidLeaveDays : rec.unpaidLeaveDays);
    setAuditFormLateDays(existingOverride?.lateDays !== undefined ? existingOverride.lateDays : rec.lateDays);
    setAuditFormLateMinutes(existingOverride?.lateMinutes !== undefined ? existingOverride.lateMinutes : 0);
    setAuditFormWaiveLate(existingOverride?.isLatePenaltyWaived || false);
    setAuditFormOvertimeHours(existingOverride?.overtimeHours !== undefined ? existingOverride.overtimeHours : rec.overtimeHours);
    const defaultDaily = Math.round(emp.baseSalary / customWorkingDays);
    setAuditFormCustomDailyRate(existingOverride?.customDailyRate !== undefined ? existingOverride.customDailyRate : defaultDaily);
    setAuditFormAlphaDays(existingOverride?.alphaDays !== undefined ? existingOverride.alphaDays : (rec.alphaDays || 0));
    setAuditFormCustomLatePenalty(existingOverride?.customLatePenaltyAmount !== undefined ? existingOverride.customLatePenaltyAmount : (rec.unapprovedLateDeduction || 0));
    setAuditFormNotes(existingOverride?.notes || rec.validationNotes || '');
  };

  const handleSaveAuditModal = (validated: boolean) => {
    if (!auditingEmployee) return;
    const empId = auditingEmployee.employee.id;

    const newOverride: EmployeeAuditOverride = {
      presentDays: Number(auditFormPresentDays),
      leaveDays: Number(auditFormLeaveDays),
      unpaidLeaveDays: Number(auditFormUnpaidLeaveDays),
      alphaDays: Number(auditFormAlphaDays),
      customDailyRate: Number(auditFormCustomDailyRate) > 0 ? Number(auditFormCustomDailyRate) : undefined,
      customLatePenaltyAmount: auditFormWaiveLate ? 0 : (auditFormLateMode === 'MANUAL_RP' ? Number(auditFormCustomLatePenalty) : undefined),
      lateDays: Number(auditFormLateDays),
      lateMinutes: Number(auditFormLateMinutes),
      isLatePenaltyWaived: auditFormWaiveLate,
      overtimeHours: Number(auditFormOvertimeHours),
      validated: validated,
      notes: auditFormNotes
    };

    const nextOverrides = {
      ...auditOverrides,
      [empId]: newOverride
    };

    setAuditOverrides(nextOverrides);
    localStorage.setItem('prime_payroll_audit_overrides', JSON.stringify(nextOverrides));
    setAuditingEmployee(null);
  };

  // =========================================================================
  // CALCULATE FULL PAYROLL RECORDS WITH AUDIT OVERRIDES & CUTOFF RANGE
  // =========================================================================
  const allPayrollRecords: PayrollRecord[] = employees.map(emp =>
    calculateEmployeePayroll(
      emp,
      localAttendances,
      projects,
      salaryRules,
      selectedPeriod,
      startDate,
      endDate,
      customWorkingDays,
      auditOverrides[emp.id]
    )
  );

  // For staff and regular employees, strictly limit to their own payroll record
  const basePayrollRecords = isSelfOnly
    ? allPayrollRecords.filter(p => p.employeeId === currentUser?.id)
    : allPayrollRecords;

  // Filter records based on selected project, search, & validation status
  const filteredRecords = basePayrollRecords.filter(p => {
    const matchesSearch =
      p.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (validationFilter === 'PENDING' && p.hrValidationStatus === 'VALIDATED_BY_HR') return false;
    if (validationFilter === 'VALIDATED' && p.hrValidationStatus !== 'VALIDATED_BY_HR') return false;

    if (isSelfOnly) return true;
    if (currentProjectFilter === 'ALL') return true;

    const emp = employees.find(e => e.id === p.employeeId);
    const isAssigned = emp?.assignedProjectId === currentProjectFilter;
    const hasAllocation = p.projectAllocations.some(a => a.projectId === currentProjectFilter);

    return isAssigned || hasAllocation;
  });

  const [payrollDisplayLimit, setPayrollDisplayLimit] = useState(15);
  const visiblePayrollRecords = useMemo(() => {
    return filteredRecords.slice(0, payrollDisplayLimit);
  }, [filteredRecords, payrollDisplayLimit]);
  const hasMorePayroll = payrollDisplayLimit < filteredRecords.length;

  useEffect(() => {
    setPayrollDisplayLimit(15);
  }, [searchQuery, currentProjectFilter, validationFilter]);

  const selectedProjectObj = projects.find(p => p.id === currentProjectFilter);

  // Aggregated totals
  const totalPayrollBudget = filteredRecords.reduce((acc, p) => acc + p.netSalary, 0);
  const totalOvertimeSpent = filteredRecords.reduce((acc, p) => acc + p.overtimePay, 0);
  const totalLateDeductions = filteredRecords.reduce((acc, p) => acc + p.unapprovedLateDeduction, 0);
  const totalUnpaidDeductions = filteredRecords.reduce((acc, p) => acc + p.unpaidLeaveDeduction, 0);

  // Validation statistics
  const totalRecordsCount = allPayrollRecords.length;
  const validatedRecordsCount = allPayrollRecords.filter(r => r.hrValidationStatus === 'VALIDATED_BY_HR').length;
  const pendingRecordsCount = totalRecordsCount - validatedRecordsCount;

  // Total allocated cost specifically for selected project
  const projectSpecificCost = currentProjectFilter === 'ALL'
    ? totalPayrollBudget
    : filteredRecords.reduce((acc, p) => {
        const alloc = p.projectAllocations.find(a => a.projectId === currentProjectFilter);
        return acc + (alloc ? alloc.allocatedCost : 0);
      }, 0);

  const exportCSV = () => {
    const headers = [
      'NIK', 'Nama', 'Departemen', 'Posisi', 'Proyek Utama', 'Hari Kerja', 'Hadir', 'Cuti', 'Unpaid',
      'Gaji Pokok', 'Tunjangan Tetap', 'Uang Harian', 'Tunjangan Proyek', 'Lembur', 'Potongan Unpaid', 'Potongan Terlambat',
      'BPJS Ketenagakerjaan', 'BPJS Kesehatan', 'PPh 21', 'Gaji Bersih (THP)', 'Status Validasi HR'
    ];

    const rows = filteredRecords.map(p => {
      const emp = employees.find(e => e.id === p.employeeId);
      const proj = projects.find(prj => prj.id === emp?.assignedProjectId);
      return [
        p.nik,
        `"${p.employeeName}"`,
        `"${p.department}"`,
        `"${p.position}"`,
        `"${proj?.name || '-'}"`,
        p.workingDays,
        p.presentDays,
        p.leaveDays,
        p.unpaidLeaveDays,
        p.baseSalary,
        p.fixedAllowance,
        p.dailyAllowanceTotal,
        p.projectAllowance,
        p.overtimePay,
        p.unpaidLeaveDeduction,
        p.unapprovedLateDeduction,
        p.bpjsKetenagakerjaan,
        p.bpjsKesehatan,
        p.pph21,
        p.netSalary,
        `"${p.hrValidationStatus}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payroll_PRIME_${currentProjectFilter}_${selectedPeriod.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. MASTER PAYROLL EXECUTIVE COCKPIT (Clean, Compact Header + Workflow)     */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        {/* Top Header Row with Direct Action Triggers */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="bg-[#FF6B00] text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code rounded">
                {isStaff ? 'SLIP GAJI PERSONAL' : 'PAYROLL & COST ACCOUNTING'}
              </span>
              <span className="text-xs font-bold text-slate-500">PRIME ENTERPRISE</span>
              <div className="relative inline-flex items-center">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200/90 text-slate-800 text-xs font-mono-code font-bold transition-all shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Periode:</span>
                  {calendarPeriods.length > 0 ? (
                    <select
                      value={currentPeriodObj?.periodName || selectedPeriod}
                      onChange={e => {
                        const target = calendarPeriods.find(p => p.periodName === e.target.value);
                        if (target) handleSelectPeriod(target);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-900 border-none outline-none cursor-pointer pr-1"
                      aria-label="Pilih Periode Penggajian"
                    >
                      {calendarPeriods.map(p => (
                        <option key={p.periodId || p.periodName} value={p.periodName} className="text-slate-900 bg-white">
                          {p.periodName} ({p.effectiveWorkDays || 22} Hari Kerja • Cutoff {p.startDate} s/d {p.endDate})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-bold text-slate-900">{selectedPeriod}</span>
                  )}
                </div>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isSelfOnly ? 'Rincian Slip Gaji & Penerimaan Saya' : 'Penggajian Karyawan & Alokasi Anggaran Proyek'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSelfOnly
                ? 'Rincian resmi kalkulasi upah pokok, tunjangan kerja, upah lembur, potongan BPJS & THP Anda.'
                : 'Workflow penggajian 2 tahap: Audit presensi & cuti oleh HR Manager disusul kalkulasi dan otorisasi disbursement Finance.'}
            </p>
          </div>

          {/* Action Cluster in Header (Button Icons Only, Clean & Tidy) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Privacy Nominal Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPayrollNominal(prev => !prev)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs ${
                showPayrollNominal
                  ? 'bg-orange-50 text-[#FF6B00] border-orange-200 hover:bg-orange-100'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={showPayrollNominal ? 'Sembunyikan Nominal (Sensor Aktif)' : 'Tampilkan Nominal Gaji'}
            >
              {showPayrollNominal ? <EyeOff className="w-4 h-4 text-[#FF6B00]" /> : <Eye className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Export CSV Button */}
            {canManagePayroll && (
              <button
                type="button"
                onClick={exportCSV}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="Export Data Payroll ke CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Print Laporan Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title={`Cetak ${isSelfOnly ? 'Slip Gaji' : 'Laporan Rekapitulasi Payroll'}`}
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Workflow CTA Buttons (Icon Only) */}
            {canManagePayroll && batchStatus === 'DRAFT_HR' && (
              <button
                type="button"
                onClick={handleSubmitToFinance}
                disabled={!isHRManagerOrSuper}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs ${
                  isHRManagerOrSuper
                    ? 'bg-gradient-to-r from-orange-500 to-[#FF6B00] hover:from-orange-600 hover:to-[#e56000] text-white shadow-orange-500/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
                title={isHRManagerOrSuper ? 'Ajukan Data ke Finance (Audit HR Selesai)' : 'Hanya HR Manager / Superuser yang berwenang mengajukan'}
              >
                <Send className="w-4 h-4" />
              </button>
            )}

            {canManagePayroll && batchStatus === 'SUBMITTED_TO_FINANCE' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRevertToDraft}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Koreksi HR (Kembalikan ke Status Draf)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleProcessByFinance}
                  disabled={!isFinanceOrSuper}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md ${
                    isFinanceOrSuper
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white shadow-blue-500/25'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                  title={isFinanceOrSuper ? 'Otorisasi Payroll (Finance Disbursement)' : 'Hanya Divisi Finance yang berwenang mengotorisasi'}
                >
                  <Calculator className="w-4 h-4" />
                </button>
              </div>
            )}

            {canManagePayroll && batchStatus === 'PROCESSED_BY_FINANCE' && (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shadow-2xs"
                  title="Payroll Disbursed (Telah Diotorisasi Resmi oleh Finance)"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                {isSuperuser && (
                  <button
                    type="button"
                    onClick={handleRevertToDraft}
                    className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 shadow-2xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    title="Buka Ulang Audit (Superuser)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Middle Row: Integrated Stepper & Slim KPI Tiles */}
        {canManagePayroll && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
            {/* Integrated 2-Stage Progress Stepper (5 Cols) */}
            <div className="md:col-span-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-3 flex items-center justify-between gap-2">
              {/* Step 1: HR Audit */}
              <div className={`flex items-center gap-2.5 ${batchStatus === 'DRAFT_HR' ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  batchStatus === 'DRAFT_HR' ? 'bg-[#FF6B00] text-white shadow-xs' : 'bg-emerald-600 text-white'
                }`}>
                  {batchStatus === 'DRAFT_HR' ? '1' : '✓'}
                </div>
                <div className="leading-tight">
                  <span className="text-[11px] block font-semibold">1. Audit Presensi HR</span>
                  <span className="text-[10px] font-mono-code text-slate-400">
                    <strong className="text-emerald-700">{validatedRecordsCount}</strong> / {totalRecordsCount} Valid
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />

              {/* Step 2: Finance Execution */}
              <div className={`flex items-center gap-2.5 ${batchStatus !== 'DRAFT_HR' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  batchStatus === 'PROCESSED_BY_FINANCE'
                    ? 'bg-emerald-600 text-white'
                    : batchStatus === 'SUBMITTED_TO_FINANCE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {batchStatus === 'PROCESSED_BY_FINANCE' ? '✓' : '2'}
                </div>
                <div className="leading-tight">
                  <span className="text-[11px] block font-semibold">2. Otorisasi Finance</span>
                  <span className="text-[10px] font-mono-code text-slate-400">
                    {batchStatus === 'PROCESSED_BY_FINANCE' ? 'Final Disbursed' : batchStatus === 'SUBMITTED_TO_FINANCE' ? 'Reviewing' : 'Menunggu HR'}
                  </span>
                </div>
              </div>
            </div>

            {/* Slim KPI Metric Tiles (7 Cols) */}
            <div className="md:col-span-7 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-slate-50/80 border border-slate-200/80 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono-code block">
                  Total THP (Gaji Bersih)
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 font-mono-code block truncate">
                  {formatSalaryDisplay(projectSpecificCost, showPayrollNominal)}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {filteredRecords.length} Karyawan
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50/80 border border-slate-200/80 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono-code block">
                  Upah Lembur Depnaker
                </span>
                <span className="text-sm sm:text-base font-black text-orange-600 font-mono-code block truncate">
                  {formatSalaryDisplay(totalOvertimeSpent, showPayrollNominal)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Formula 1/173
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50/80 border border-slate-200/80 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono-code block">
                  Potongan Telat & Unpaid
                </span>
                <span className="text-sm sm:text-base font-black text-rose-600 font-mono-code block truncate">
                  {formatSalaryDisplay(totalLateDeductions + totalUnpaidDeductions, showPayrollNominal)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate block">
                  {totalUnpaidDeductions > 0 ? `Unpaid: ${formatSalaryDisplay(totalUnpaidDeductions, showPayrollNominal)}` : 'Disiplin Terjaga'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Row: Direct Monthly Work Calendar Selector & Cutoff Range */}
        {canManagePayroll && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
            {/* Pilihan Langsung 12 Bulan / Periode Sesuai Kalender Kerja Resmi */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] text-slate-400 font-mono-code uppercase font-bold shrink-0 mr-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#FF6B00]" />
                Periode:
              </span>

              {/* Year Selector Stepper */}
              <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 shrink-0 mr-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedPayrollYear((prev) => Math.max(2020, prev - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                  title="Tahun Sebelumnya"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <select
                  value={selectedPayrollYear}
                  onChange={(e) => setSelectedPayrollYear(Number(e.target.value))}
                  className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer px-1 py-0.5 font-mono-code"
                >
                  {payrollAvailableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedPayrollYear((prev) => prev + 1)}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                  title="Tahun Berikutnya"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {(calendarPeriods.length > 0 ? calendarPeriods : Array.from({ length: 12 }, (_, i) => ({
                periodId: `PER-${selectedPayrollYear}-${String(i + 1).padStart(2, '0')}`,
                monthIndex: i,
                periodName: `Periode ${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][i]} ${selectedPayrollYear}`,
                startDate: i === 0 ? `${selectedPayrollYear - 1}-12-21` : `${selectedPayrollYear}-${String(i).padStart(2, '0')}-21`,
                endDate: `${selectedPayrollYear}-${String(i + 1).padStart(2, '0')}-20`,
                paydayDate: `${selectedPayrollYear}-${String(i + 1).padStart(2, '0')}-25`,
                attendanceOpen: i === 9,
                payrollStatus: i < 9 ? 'CUTOFF_LOCKED' : (i === 9 ? 'OPEN' : 'DRAFT'),
                effectiveWorkDays: i === 9 ? 25 : 22,
                totalCalendarDays: 30,
                weeklyOffDaysCount: 4,
                holidaysCount: 1
              }))).map((p: any) => {
                const isSelected = p.periodName === selectedPeriod || currentPeriodObj?.periodId === p.periodId || (currentPeriodObj?.monthIndex === p.monthIndex && selectedPeriod.includes(p.periodName.replace('Periode ', '')));
                const isOpen = p.attendanceOpen;
                const isLocked = p.payrollStatus === 'CUTOFF_LOCKED' || (!isOpen && p.monthIndex < (currentPeriodObj?.monthIndex ?? 9));
                const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][p.monthIndex];

                return (
                  <button
                    key={p.periodId || p.monthIndex}
                    type="button"
                    onClick={() => handleSelectPeriod(p)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-sm ring-2 ring-[#FF6B00]'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                    title={`${p.periodName}: ${p.startDate} s/d ${p.endDate} (${p.effectiveWorkDays} Hari Kerja) • Status: ${isOpen ? 'DIBUKA (OPEN)' : (isLocked ? 'CUTOFF DITUTUP' : 'DRAF')}`}
                  >
                    <span className="font-mono-code font-bold">{monthShort}</span>
                    <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500 ring-2 ring-emerald-200' : (isLocked ? 'bg-slate-400' : 'bg-amber-400')}`} />
                    <span className={`text-[10px] font-mono-code ${isSelected ? 'text-orange-300' : 'text-slate-400'}`}>
                      {p.effectiveWorkDays}HK
                    </span>
                    {isLocked && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                  </button>
                );
              })}
            </div>

            {/* Cutoff Controls & Active Status Banner */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <span className="text-[11px] font-mono-code uppercase">Cutoff Rentang:</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDateChange(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-slate-800 font-mono-code focus:outline-none cursor-pointer"
                  />
                  <span className="text-slate-400 font-mono-code">s/d</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => handleEndDateChange(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-slate-800 font-mono-code focus:outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                  <span className="text-[11px] text-slate-500 font-medium">Hari Kerja:</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={customWorkingDays}
                    onChange={e => handleWorkingDaysChange(Number(e.target.value))}
                    className="w-12 bg-white border border-slate-200 rounded-md px-1 py-0.5 text-xs font-black text-slate-900 font-mono-code text-center focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  />
                  <span className="text-[11px] text-slate-500 font-semibold">Hari</span>
                </div>

                {/* Period Status Indicator */}
                {currentPeriodObj && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono-code border ${
                    currentPeriodObj.attendanceOpen
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${currentPeriodObj.attendanceOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {currentPeriodObj.attendanceOpen ? 'OPEN (PRESENSI AKTIF)' : 'CUTOFF DITUTUP'}
                  </span>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentPeriodObj && (
                  <button
                    type="button"
                    onClick={handleSyncFromCalendar}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer flex items-center gap-1"
                    title="Sinkronkan dengan Kalender Kerja Tahunan"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Kalender ({currentPeriodObj.effectiveWorkDays} HK)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSetPresetCutoff('FULL_MONTH')}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  Bulan Penuh (1-30)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Access Notice for Staff Only */}
      {!canManagePayroll && (
        <div className="rounded-2xl p-4 border border-amber-200 bg-amber-50/70 flex items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Portal Slip Gaji Mandiri Karyawan</p>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Anda hanya dapat meninjau rincian gaji dan mengunduh / mencetak slip gaji pribadi Anda.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono-code font-bold px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-900 uppercase shrink-0 border border-amber-300">
            👤 AKSES PRIBADI
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DATA WORKSPACE (INTEGRATED SUBVIEW TABS + FILTERS + TABLE)              */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Top Control Bar: Segmented Switcher & Search Filters */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 space-y-2.5 bg-slate-50/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Subview Segmented Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl w-fit">
              {[
                { id: 'REKAP_GAJI', label: 'Rekap Gaji & Slip', icon: Banknote },
                ...(canManagePayroll ? [
                  { id: 'ALOKASI_PROYEK', label: 'Alokasi Proyek', icon: Briefcase },
                  { id: 'PROYEKSI_EAC', label: 'Proyeksi EAC', icon: TrendingUp }
                ] : [])
              ].map(view => {
                const Icon = view.icon;
                const isActive = activeSubView === view.id;
                return (
                  <button
                    key={view.id}
                    onClick={() => setActiveSubView(view.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {view.label}
                  </button>
                );
              })}
            </div>

            {/* Right Command Cluster (Project select, Audit select, Search input) */}
            <div className="flex flex-wrap items-center gap-2">
              {canManagePayroll && (
                <>
                  {/* Project Selector */}
                  <select
                    value={currentProjectFilter}
                    onChange={e => handleFilterChange(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="ALL">Semua Proyek (Konsolidasi)</option>
                    {projects.map(prj => (
                      <option key={prj.id} value={prj.id}>
                        [{prj.code}] {prj.name}
                      </option>
                    ))}
                  </select>

                  {/* Validation Filter */}
                  <select
                    value={validationFilter}
                    onChange={e => setValidationFilter(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer"
                  >
                    <option value="ALL">Semua Audit ({totalRecordsCount})</option>
                    <option value="PENDING">⏳ Menunggu ({pendingRecordsCount})</option>
                    <option value="VALIDATED">✓ Valid ({validatedRecordsCount})</option>
                  </select>
                </>
              )}

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama, NIK, divisi..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 w-40 sm:w-52"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>
          </div>

          {/* Selected Project Quick Chip (only if project is selected) */}
          {canManagePayroll && selectedProjectObj && currentProjectFilter !== 'ALL' && (
            <div className="p-2.5 rounded-xl bg-orange-50/80 border border-orange-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#FF6B00] text-white text-[10px] font-black uppercase font-mono-code">
                  {selectedProjectObj.code}
                </span>
                <span className="font-bold text-slate-900">{selectedProjectObj.name}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">{selectedProjectObj.client}</span>
              </div>
              <div className="flex items-center gap-3 font-mono-code text-[11px]">
                <span>Budget Labor: <strong>{formatSalaryDisplay(selectedProjectObj.allocatedBudget || 0, showPayrollNominal)}</strong></span>
                <span>Realisasi: <strong className="text-emerald-700">{formatSalaryDisplay(selectedProjectObj.actualLaborCost || 0, showPayrollNominal)}</strong></span>
                <button
                  onClick={() => handleFilterChange('ALL')}
                  className="text-xs text-[#FF6B00] hover:underline font-bold font-sans cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SUBVIEW 1: REKAP GAJI & SLIP GAJI TABLE                                   */}
        {/* ========================================================================= */}
        {activeSubView === 'REKAP_GAJI' && (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-mono-code text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-2.5 py-2.5 sm:px-3">NIK & Karyawan</th>
                  <th className="px-2.5 py-2.5 sm:px-3">Departemen & Posisi</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">Presensi & Cuti</th>
                  <th className="px-2 py-2.5 sm:px-2.5 text-right whitespace-nowrap">Gaji Pokok & Tunjangan</th>
                  <th className="px-2 py-2.5 sm:px-2.5 text-right whitespace-nowrap">Lembur Depnaker</th>
                  <th className="px-2 py-2.5 sm:px-2.5 text-right whitespace-nowrap">Potongan</th>
                  <th className="px-2 py-2.5 sm:px-2.5 text-right font-bold text-slate-900 whitespace-nowrap">Gaji Bersih (THP)</th>
                  <th className="px-1.5 py-2.5 text-center whitespace-nowrap">Status HR</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada karyawan yang sesuai dengan kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  visiblePayrollRecords.map((item: any, idx: number) => {
                    const emp = employees.find(e => e.id === item.employeeId);
                    const totalTunjangan = item.fixedAllowance + item.dailyAllowanceTotal + item.projectAllowance;
                    const isValidatedHR = item.hrValidationStatus === 'VALIDATED_BY_HR';

                    return (
                      <tr
                        key={item.id}
                        style={{ animationDelay: `${(idx + 1) * 30}ms` }}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* 1. NIK & Karyawan (Klik untuk Buka Timesheet & Foto) */}
                        <td
                          className="px-2.5 py-2.5 sm:px-3 cursor-pointer group"
                          onClick={() => emp && setViewingTimesheetEmp(emp)}
                          title="Klik untuk Buka Detail Kalender Presensi & Verifikasi Foto Biometrik"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF6B00] to-[#FF8533] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs group-hover:ring-2 group-hover:ring-[#FF6B00]/40 transition-all">
                              {item.employeeName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 leading-tight truncate group-hover:text-[#FF6B00] transition-colors">
                                {item.employeeName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-mono-code text-slate-500">{item.nik}</span>
                                {emp?.employmentType && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono-code">
                                    {emp.employmentType}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Posisi & Departemen */}
                        <td className="px-2.5 py-2.5 sm:px-3">
                          <p className="text-slate-800 font-semibold truncate text-[11px] leading-tight">{item.position}</p>
                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">{item.department}</span>
                        </td>

                        {/* 3. Presensi & Cuti (Klik untuk Buka Timesheet & Foto) */}
                        <td
                          className="px-2 py-2.5 text-center whitespace-nowrap cursor-pointer group hover:bg-orange-50/60 transition-colors rounded-lg"
                          onClick={() => emp && setViewingTimesheetEmp(emp)}
                          title="Klik untuk Buka Detail Kalender Presensi & Verifikasi Foto Biometrik"
                        >
                          <div className="inline-flex flex-col items-center">
                            <span className="font-mono-code font-bold text-slate-800 group-hover:text-[#FF6B00] transition-colors">
                              {item.presentDays}/{item.workingDays} Hadir
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <span>Cuti: {item.leaveDays}h</span>
                              {item.unpaidLeaveDays > 0 && (
                                <span className="text-rose-600 font-bold">
                                  • Unpaid: {item.unpaidLeaveDays}h
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 4. Gaji Pokok & Tunjangan */}
                        <td className="px-2 py-2.5 sm:px-2.5 text-right font-mono-code text-slate-700 whitespace-nowrap">
                          <span className="font-bold">{formatSalaryDisplay(item.baseSalary, showPayrollNominal)}</span>
                          <span className="block text-[10px] text-slate-400">
                            +{formatSalaryDisplay(totalTunjangan, showPayrollNominal)}
                          </span>
                        </td>

                        {/* 5. Lembur Depnaker */}
                        <td className="px-2 py-2.5 sm:px-2.5 text-right font-mono-code text-orange-600 font-semibold whitespace-nowrap">
                          +{formatSalaryDisplay(item.overtimePay, showPayrollNominal)}
                          <span className="block text-[9px] text-slate-400 font-normal">
                            ({item.overtimeHours} Jam)
                          </span>
                        </td>

                        {/* 6. Potongan */}
                        <td className="px-2 py-2.5 sm:px-2.5 text-right font-mono-code text-rose-600 whitespace-nowrap">
                          <span>-{formatSalaryDisplay(item.totalDeductions, showPayrollNominal)}</span>
                          {(item.unapprovedLateDeduction > 0 || item.unpaidLeaveDeduction > 0) && (
                            <span className="block text-[9px] text-rose-500">
                              {item.unpaidLeaveDeduction > 0 ? `Unpaid: -${formatSalaryDisplay(item.unpaidLeaveDeduction, showPayrollNominal)} ` : ''}
                              {item.unapprovedLateDeduction > 0 ? `Telat: -${formatSalaryDisplay(item.unapprovedLateDeduction, showPayrollNominal)}` : ''}
                            </span>
                          )}
                        </td>

                        {/* 7. Gaji Bersih (THP) */}
                        <td className="px-2 py-2.5 sm:px-2.5 text-right font-mono-code font-black text-emerald-600 text-xs sm:text-sm whitespace-nowrap">
                          {formatSalaryDisplay(item.netSalary, showPayrollNominal)}
                        </td>

                        {/* 8. Status Audit HR */}
                        <td className="px-1.5 py-2.5 text-center whitespace-nowrap">
                          {isValidatedHR ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono-code">
                              <CheckCircle2 className="w-3 h-3" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono-code">
                              <Clock className="w-3 h-3" />
                              Audit
                            </span>
                          )}
                        </td>

                        {/* 9. Aksi Buttons (Tidy, Clean, Never Truncated) */}
                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1">
                            {/* Kalender & Foto Presensi (Excel Timesheet) Button */}
                            {emp && (
                              <button
                                onClick={() => setViewingTimesheetEmp(emp)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white transition-all cursor-pointer shadow-2xs"
                                title="Buka Kalender Presensi & Verifikasi Foto Biometrik (Excel Timesheet)"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* HR Audit Button */}
                            {canManagePayroll && emp && (
                              <button
                                onClick={() => handleOpenAuditModal(emp, item)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 transition-all cursor-pointer shadow-2xs"
                                title="Audit Presensi & Cuti (HR Manager)"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Set Salary Per User Button */}
                            {canManagePayroll && emp && (
                              <button
                                onClick={() => handleOpenSalaryModal(emp)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-800 transition-all cursor-pointer shadow-2xs"
                                title="Atur Gaji Karyawan"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Cetak Slip Button */}
                            <button
                              onClick={() => setSelectedSlip(item)}
                              className="px-2 py-1 rounded-lg bg-[#FF6B00] hover:bg-[#e56000] text-white text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                              title="Cetak Slip Gaji Resmi"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Slip</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredRecords.length > 15 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-t border-slate-200/70 text-xs">
              <span className="text-slate-500 font-mono-code text-[11px]">
                Menampilkan <span className="font-bold text-slate-800">{Math.min(payrollDisplayLimit, filteredRecords.length)}</span> dari <span className="font-bold text-slate-800">{filteredRecords.length}</span> rekaman penggajian
              </span>
              <div className="flex items-center gap-2">
                {hasMorePayroll ? (
                  <button
                    type="button"
                    onClick={() => setPayrollDisplayLimit(prev => Math.min(prev + 15, filteredRecords.length))}
                    className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-orange-200 hover:border-[#FF6B00] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Muat 15 Karyawan Lagi ({filteredRecords.length - payrollDisplayLimit} Tersisa)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPayrollDisplayLimit(15)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ciutkan (Tampilkan 15)</span>
                  </button>
                )}
                {hasMorePayroll && (
                  <button
                    type="button"
                    onClick={() => setPayrollDisplayLimit(filteredRecords.length)}
                    className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold text-xs transition-all cursor-pointer"
                  >
                    Tampilkan Semua
                  </button>
                )}
              </div>
            </div>
          )}
          </>
        )}

        {/* ========================================================================= */}
        {/* SUBVIEW 2: ALOKASI JAM & BIAYA PROYEK                                     */}
        {/* ========================================================================= */}
        {canManagePayroll && activeSubView === 'ALOKASI_PROYEK' && (
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#FF6B00]" />
                Alokasi Biaya Tenaga Kerja Antar-Proyek (Cost Accounting)
              </h2>
              <p className="text-xs text-slate-500">
                Rincian jam kerja operasional dan pembagian proporsi gaji yang dibebankan langsung ke anggaran proyek PRIME Enterprise.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-mono-code text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Nama Karyawan & NIK</th>
                    <th className="px-4 py-2.5">Kode & Nama Proyek</th>
                    <th className="px-4 py-2.5 text-right">Jam Terlapor</th>
                    <th className="px-4 py-2.5 text-right">Persentase</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-900">Beban Biaya Proyek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRecords.flatMap(rec =>
                    rec.projectAllocations
                      .filter(alloc => currentProjectFilter === 'ALL' || alloc.projectId === currentProjectFilter)
                      .map((alloc, idx) => (
                        <tr key={`${rec.id}-${alloc.projectId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{rec.employeeName}</p>
                            <span className="text-[10px] font-mono-code text-slate-400">{rec.nik}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[#FF6B00] text-[10px] font-mono-code font-bold mr-1.5">
                              {alloc.projectCode}
                            </span>
                            <span className="text-slate-800">{alloc.projectName}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono-code font-bold text-slate-800">
                            {alloc.allocatedHours} Jam
                          </td>
                          <td className="px-4 py-3 text-right font-mono-code text-slate-600">
                            {alloc.percentage}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono-code font-black text-emerald-700">
                            {formatSalaryDisplay(alloc.allocatedCost, showPayrollNominal)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBVIEW 3: PROYEKSI ANGGARAN & EAC                                        */}
        {/* ========================================================================= */}
        {canManagePayroll && activeSubView === 'PROYEKSI_EAC' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                Proyeksi Anggaran & Estimate at Completion (EAC) Proyek Operasional
              </h2>
              <p className="text-xs text-slate-500">
                Model estimasi biaya tenaga kerja hingga proyek selesai, monitoring burn-rate, dan deteksi dini risiko pembengkakan anggaran.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(currentProjectFilter === 'ALL' ? projects : projects.filter(p => p.id === currentProjectFilter)).map(proj => {
                const hasBudget = (proj.allocatedBudget || 0) > 0;
                const variance = hasBudget ? proj.allocatedBudget - proj.projectedLaborCost : 0;
                const isOverBudget = hasBudget && variance < 0;
                const burnPercentage = hasBudget ? Math.round((proj.actualLaborCost / proj.allocatedBudget) * 100) : 0;

                return (
                  <div key={proj.id} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[#FF6B00] text-[10px] font-black uppercase font-mono-code">
                        {proj.code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        !hasBudget
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : isOverBudget
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {!hasBudget ? 'Pagu TBD' : isOverBudget ? 'Risiko Overrun' : 'On Track'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{proj.name}</h3>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-mono-code">Anggaran Awal:</span>
                        <span className="font-bold text-slate-800 font-mono-code">
                          {hasBudget ? formatSalaryDisplay(proj.allocatedBudget, showPayrollNominal) : <span className="text-slate-400 font-sans italic text-[11px]">TBD</span>}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-mono-code">Proyeksi EAC:</span>
                        <span className="font-bold text-slate-800 font-mono-code">{formatSalaryDisplay(proj.projectedLaborCost, showPayrollNominal)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono-code">
                        <span className="text-slate-500">Burn Rate Jam: {proj.actualHoursSpent} / {proj.totalEstimatedHours} Jam</span>
                        <span className="font-bold text-slate-800">{hasBudget ? `${burnPercentage}%` : 'TBD'}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            burnPercentage > 85 ? 'bg-rose-500' : burnPercentage > 60 ? 'bg-amber-500' : 'bg-[#00E2B0]'
                          }`}
                          style={{ width: `${hasBudget ? Math.min(burnPercentage, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ATUR GAJI KARYAWAN (SET SALARY PER USER)                          */}
      {/* ========================================================================= */}
      {editingSalaryEmp && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto"
          onClick={() => setEditingSalaryEmp(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-auto modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setEditingSalaryEmp(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Atur Struktur Gaji Karyawan
                </h3>
                <p className="text-xs text-slate-500">
                  {editingSalaryEmp.name} • NIK: {editingSalaryEmp.nik}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Gaji Pokok */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Gaji Pokok (Base Salary) / Bulan:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold font-mono-code text-xs">Rp</span>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={salaryFormBase}
                    onChange={e => setSalaryFormBase(Number(e.target.value))}
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#FF6B00] rounded-xl pl-9 pr-3 py-2 font-mono-code font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono-code mt-0.5 block">
                  Terbaca: {formatSalaryDisplay(salaryFormBase, showPayrollNominal)}
                </span>
              </div>

              {/* Tunjangan Tetap */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Tunjangan Tetap / Jabatan / Bulan:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold font-mono-code text-xs">Rp</span>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={salaryFormFixed}
                    onChange={e => setSalaryFormFixed(Number(e.target.value))}
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#FF6B00] rounded-xl pl-9 pr-3 py-2 font-mono-code font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono-code mt-0.5 block">
                  Terbaca: {formatSalaryDisplay(salaryFormFixed, showPayrollNominal)}
                </span>
              </div>

              {/* Uang Makan / Harian per kehadiran */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Uang Makan / Harian (per Hari Hadir):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold font-mono-code text-xs">Rp</span>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={salaryFormDaily}
                    onChange={e => setSalaryFormDaily(Number(e.target.value))}
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#FF6B00] rounded-xl pl-9 pr-3 py-2 font-mono-code font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono-code mt-0.5 block">
                  Terbaca: {formatSalaryDisplay(salaryFormDaily, showPayrollNominal)} / hari hadir kerja
                </span>
              </div>

              {/* Tipe Kepegawaian */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Tipe Hubungan Kepegawaian:
                </label>
                <select
                  value={salaryFormEmpType}
                  onChange={e => setSalaryFormEmpType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
                >
                  <option value="TETAP">Karyawan Tetap (PKWTT)</option>
                  <option value="KONTRAK">Karyawan Kontrak (PKWT)</option>
                  <option value="PROJECT_HIRE">Project Hire (Tenaga Lepas Proyek)</option>
                </select>
              </div>

              {/* Rekening Bank */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 font-mono-code block">
                  Data Rekening Payroll Karyawan
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Nama Bank:</label>
                    <input
                      type="text"
                      value={salaryFormBankName}
                      onChange={e => setSalaryFormBankName(e.target.value)}
                      placeholder="e.g. BCA / Mandiri / BNI"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Nomor Rekening:</label>
                    <input
                      type="text"
                      value={salaryFormBankAcc}
                      onChange={e => setSalaryFormBankAcc(e.target.value)}
                      placeholder="e.g. 1234567890"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono-code font-bold text-slate-800 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Atas Nama Rekening:</label>
                  <input
                    type="text"
                    value={salaryFormBankHolder}
                    onChange={e => setSalaryFormBankHolder(e.target.value)}
                    placeholder="Nama sesuai buku tabungan"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setEditingSalaryEmp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSalaryModal}
                className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Simpan Struktur Gaji
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: AUDIT & VALIDASI PRESENSI HR MANAGER                              */}
      {/* ========================================================================= */}
      {auditingEmployee && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto"
          onClick={() => setAuditingEmployee(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-auto modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setAuditingEmployee(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Audit Presensi, Cuti & Lembur (HR Manager)
                </h3>
                <p className="text-xs text-slate-500">
                  {auditingEmployee.employee.name} • {auditingEmployee.employee.position} ({auditingEmployee.employee.department})
                </p>
              </div>
            </div>

            {/* Quick Status Pill with Finance Daily Rate Adjustment */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-mono-code">Gaji Pokok Karyawan:</span>
                <span className="font-bold text-slate-800 font-mono-code text-sm">
                  {formatSalaryDisplay(auditingEmployee.employee.baseSalary, showPayrollNominal)}
                </span>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block font-mono-code font-bold">
                  Gaji Per Hari (Daily Rate Finance):
                </label>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono-code text-slate-400 text-xs">Rp</span>
                  <input
                    type="number"
                    min={0}
                    value={auditFormCustomDailyRate}
                    onChange={e => setAuditFormCustomDailyRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold font-mono-code text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    title="Finance dapat menentukan tarif upah harian karyawan secara khusus atau menggunakan default (Gaji Pokok / Hari Kerja)"
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-mono-code">Hari Kerja Periode:</span>
                <span className="font-bold text-slate-800 font-mono-code text-sm">{customWorkingDays} Hari</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Hari Hadir & Cuti */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Hari Hadir Efektif:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={customWorkingDays}
                    value={auditFormPresentDays}
                    onChange={e => setAuditFormPresentDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold font-mono-code text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Mendapat uang makan</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Cuti Resmi (Paid):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={auditFormLeaveDays}
                    onChange={e => setAuditFormLeaveDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold font-mono-code text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
                  />
                  <span className="text-[9px] text-emerald-600 mt-0.5 block">Gaji pokok utuh</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Cuti Unpaid (Izin):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={auditFormUnpaidLeaveDays}
                    onChange={e => setAuditFormUnpaidLeaveDays(Number(e.target.value))}
                    className="w-full bg-rose-50 border border-rose-300 rounded-xl px-3 py-1.5 font-bold font-mono-code text-rose-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <span className="text-[9px] text-rose-600 mt-0.5 block">Potong gaji harian</span>
                </div>
              </div>

              {/* Input Alpha (Mangkir) & Potongan Rekap */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200">
                  <label className="block text-red-900 font-bold mb-1">
                    Hari Alpha (Mangkir Tanpa Keterangan):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={customWorkingDays}
                    value={auditFormAlphaDays}
                    onChange={e => setAuditFormAlphaDays(Number(e.target.value))}
                    className="w-full bg-white border border-red-300 rounded-xl px-3 py-1.5 font-bold font-mono-code text-red-950 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <span className="text-[9px] text-red-700 mt-0.5 block">
                    Memotong gaji: -{formatSalaryDisplay(auditFormAlphaDays * (auditFormCustomDailyRate || Math.round(auditingEmployee.employee.baseSalary / customWorkingDays)), showPayrollNominal)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Hari Kerja:</span>
                    <span className="font-mono-code font-bold">{customWorkingDays} Hari</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Potongan Kehadiran:</span>
                    <span className="font-mono-code font-bold text-rose-600">
                      -{formatSalaryDisplay((auditFormUnpaidLeaveDays + auditFormAlphaDays) * (auditFormCustomDailyRate || Math.round(auditingEmployee.employee.baseSalary / customWorkingDays)), showPayrollNominal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Unpaid Leave Deduction Preview */}
              {auditFormUnpaidLeaveDays > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between text-xs">
                  <span className="font-semibold">Beban Potongan Cuti Tanpa Upah (Unpaid):</span>
                  <span className="font-mono-code font-black text-rose-700">
                    -{formatSalaryDisplay(auditFormUnpaidLeaveDays * Math.round(auditingEmployee.employee.baseSalary / customWorkingDays), showPayrollNominal)}
                  </span>
                </div>
              )}

              {/* Late Check-in & Penalties */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Audit Keterlambatan Absensi:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={auditFormWaiveLate}
                      onChange={e => setAuditFormWaiveLate(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF6B00] focus:ring-[#FF6B00]"
                    />
                    <span className="text-[11px] font-bold text-emerald-700">
                      Dispensasi HR (Bebaskan Denda)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Frekuensi Terlambat (Kali):</label>
                    <input
                      type="number"
                      min={0}
                      value={auditFormLateDays}
                      onChange={e => setAuditFormLateDays(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono-code text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Total Menit Terlambat:</label>
                    <input
                      type="number"
                      min={0}
                      value={auditFormLateMinutes}
                      onChange={e => setAuditFormLateMinutes(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono-code text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Nominal Denda (Finance):</label>
                    <input
                      type="number"
                      min={0}
                      value={auditFormCustomLatePenalty}
                      onChange={e => {
                        setAuditFormCustomLatePenalty(Number(e.target.value));
                        setAuditFormLateMode('MANUAL_RP');
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono-code text-rose-600"
                      placeholder="Rp..."
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  {auditFormWaiveLate
                    ? '✓ HR Manager menyetujui dispensasi tugas luar / izin khusus: Denda keterlambatan diset Rp 0.'
                    : `Denda dihitung per kelipatan 15 menit melewati grace period 15 menit (${formatSalaryDisplay(salaryRules.latePenaltyPerBlock, showPayrollNominal)}/blok).`}
                </p>
              </div>

              {/* Lembur Depnaker */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Jam Lembur Disetujui (Depnaker Overtime Hours):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={auditFormOvertimeHours}
                    onChange={e => setAuditFormOvertimeHours(Number(e.target.value))}
                    className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold font-mono-code text-orange-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    Estimasi Upah Lembur: <strong>{formatSalaryDisplay(Math.round(auditFormOvertimeHours * (salaryRules.overtimeFormula.subsequentHourRateMultiplier * (auditingEmployee.employee.baseSalary / salaryRules.overtimeFormula.hourlyRateDivisor))), showPayrollNominal)}</strong>
                  </span>
                </div>
              </div>

              {/* Catatan Verifikasi HR */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Catatan Justifikasi & Verifikasi HR:
                </label>
                <textarea
                  rows={2}
                  value={auditFormNotes}
                  onChange={e => setAuditFormNotes(e.target.value)}
                  placeholder="e.g. Presensi dan cuti telah diverifikasi sesuai kartu absensi fingerprint & SPT dinas luar."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setAuditingEmployee(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleSaveAuditModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                Simpan Draf
              </button>
              <button
                onClick={() => handleSaveAuditModal(true)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Validasi & Verifikasi Sah (HR)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: OFFICIAL SLIP GAJI FOR PRIME ENTERPRISE                           */}
      {/* ========================================================================= */}
      {selectedSlip && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto"
          onClick={() => setSelectedSlip(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-auto modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedSlip(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer no-print"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Official Letterhead - PRIME HRIS Enterprise */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8533] text-white flex items-center justify-center font-mono-code font-black text-sm tracking-tighter shadow-sm shadow-orange-500/30">
                      PRIME
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 font-mono-code leading-none">
                        PRIME HRIS ENTERPRISE
                      </h2>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                        PT Prime Infinity Systems • Advanced HR & Payroll Engineering Platform
                      </p>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-mono-code">
                    NPWP: 01.892.411.2-054.000 • Komp. Perkantoran & Innovation Hub • Email: payroll@primeprojectx.net
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPayrollNominal(prev => !prev)}
                      className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-bold flex items-center gap-1 transition-all no-print cursor-pointer"
                      title="Buka / Tutup sensor nominal"
                    >
                      {showPayrollNominal ? <EyeOff className="w-3 h-3 text-slate-400" /> : <Eye className="w-3 h-3 text-[#FF6B00]" />}
                      <span>{showPayrollNominal ? 'Sensor Nilai' : 'Buka Nilai'}</span>
                    </button>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase font-mono-code">
                      SLIP GAJI RESMI
                    </span>
                  </div>
                  <p className="text-[10px] font-mono-code text-slate-500 mt-0.5">Periode: {selectedSlip.period}</p>
                </div>
              </div>
            </div>

            {/* Employee Information */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Nama Karyawan</span>
                <span className="font-bold text-slate-900">{selectedSlip.employeeName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Nomor Induk (NIK)</span>
                <span className="font-bold text-slate-900 font-mono-code">{selectedSlip.nik}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Departemen</span>
                <span className="font-semibold text-slate-700">{selectedSlip.department}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-code uppercase block">Jabatan / Posisi</span>
                <span className="font-semibold text-slate-700">{selectedSlip.position}</span>
              </div>
            </div>

            {/* Attendance & Audit Info Box */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-200/70 mb-4 flex flex-wrap items-center justify-between text-[11px] gap-2">
              <span className="text-slate-600 font-medium">
                Presensi: <strong>{selectedSlip.presentDays}</strong> Hadir / <strong>{selectedSlip.workingDays}</strong> Hari Kerja • Cuti: {selectedSlip.leaveDays}h {selectedSlip.unpaidLeaveDays > 0 ? `• Unpaid: ${selectedSlip.unpaidLeaveDays}h` : ''}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-code ${
                selectedSlip.hrValidationStatus === 'VALIDATED_BY_HR'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {selectedSlip.hrValidationStatus === 'VALIDATED_BY_HR' ? '✓ DIVERIFIKASI HR MANAGER' : '⏳ DRAF AUDIT'}
              </span>
            </div>

            {/* Earnings and Deductions Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-xs">
              {/* Penerimaan */}
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider font-mono-code border-b border-emerald-200 pb-1">
                  A. PENERIMAAN / PENGHASILAN
                </h4>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Gaji Pokok:</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(selectedSlip.baseSalary, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Tunjangan Tetap / Jabatan:</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(selectedSlip.fixedAllowance, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Uang Makan / Harian ({selectedSlip.presentDays} Hari):</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(selectedSlip.dailyAllowanceTotal, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Tunjangan Penugasan Proyek:</span>
                  <span className="font-mono-code font-semibold">{formatSalaryDisplay(selectedSlip.projectAllowance, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-orange-700 font-medium">
                  <span>Upah Lembur ({selectedSlip.overtimeHours} Jam Depnaker):</span>
                  <span className="font-mono-code font-bold">+{formatSalaryDisplay(selectedSlip.overtimePay, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>Total Penghasilan Bruto:</span>
                  <span className="font-mono-code">{formatSalaryDisplay(selectedSlip.grossSalary, showPayrollNominal)}</span>
                </div>
              </div>

              {/* Potongan */}
              <div className="space-y-2">
                <h4 className="font-bold text-rose-800 text-[11px] uppercase tracking-wider font-mono-code border-b border-rose-200 pb-1">
                  B. POTONGAN / DEDUCTIONS
                </h4>
                {selectedSlip.unpaidLeaveDeduction > 0 && (
                  <div className="flex justify-between py-0.5 text-rose-700 font-medium">
                    <span>Potongan Cuti Unpaid ({selectedSlip.unpaidLeaveDays} Hari):</span>
                    <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(selectedSlip.unpaidLeaveDeduction, showPayrollNominal)}</span>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">BPJS Ketenagakerjaan (3%):</span>
                  <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(selectedSlip.bpjsKetenagakerjaan, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">BPJS Kesehatan (1%):</span>
                  <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(selectedSlip.bpjsKesehatan, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Estimasi Pajak PPh 21:</span>
                  <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(selectedSlip.pph21, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Potongan Keterlambatan:</span>
                  <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(selectedSlip.unapprovedLateDeduction, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>Total Potongan:</span>
                  <span className="font-mono-code text-rose-600">-{formatSalaryDisplay(selectedSlip.totalDeductions, showPayrollNominal)}</span>
                </div>
              </div>
            </div>

            {/* Net Salary Highlight */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 font-mono-code">
                  TOTAL GAJI BERSIH DITERIMA (TAKE HOME PAY)
                </span>
                <p className="text-xs text-emerald-700">Ditransfer ke rekening resmi payroll karyawan</p>
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-800 font-mono-code">
                {formatSalaryDisplay(selectedSlip.netSalary, showPayrollNominal)}
              </span>
            </div>

            {/* Footer with QR and Signatures */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-slate-300 p-1 bg-white flex items-center justify-center shrink-0">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 font-mono-code block">DIGITAL VERIFICATION CODE</span>
                  <span className="text-[10px] font-mono-code font-bold text-slate-700">PRIME-VERIFIED-2026-PAYROLL</span>
                  <p className="text-[9px] text-slate-500 mt-0.5">Sistem Dokumen Sah PRIME HRIS Enterprise</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-mono-code">Surabaya, 08 September 2026</p>
                <p className="text-xs font-bold text-slate-800 mt-4">Direksi & Finance PT Prime Infinity Systems</p>
                <span className="text-[9px] text-emerald-600 font-semibold font-mono-code">✓ Digitally Signed & Stamped</span>
              </div>
            </div>

            {/* Print button on modal */}
            <div className="mt-5 flex items-center justify-between gap-2 no-print">
              <button
                onClick={() => setShowPayrollNominal(prev => !prev)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {showPayrollNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
                <span>{showPayrollNominal ? 'Sensor Nominal' : 'Buka Nominal'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSlip(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={handlePrint}
                  className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Slip Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EMPLOYEE TIMESHEET & BIOMETRIC PHOTO VERIFICATION MATRIX         */}
      {/* ========================================================================= */}
      {viewingTimesheetEmp && (
        <EmployeeTimesheetDetailModal
          isOpen={!!viewingTimesheetEmp}
          onClose={() => setViewingTimesheetEmp(null)}
          employee={viewingTimesheetEmp}
          project={projects.find(p => p.id === viewingTimesheetEmp.assignedProjectId)}
          attendances={localAttendances}
          startDate={startDate}
          endDate={endDate}
          currentUser={currentUser || employees[0]}
          canManagePayroll={canManagePayroll}
          onSaveCorrection={handleSaveTimesheetCorrection}
          salaryRules={salaryRules}
        />
      )}
    </div>
  );
};
