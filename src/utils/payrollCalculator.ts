import { Employee, Project, PayrollRecord, SalaryRuleConfig, AttendanceRecord, ProjectPayrollAllocation } from '../types';

export function formatIDR(amount: number, isMasked: boolean = false): string {
  if (isMasked) {
    return 'Rp ••••••••';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatSalaryDisplay(amount: number, isVisible: boolean = false): string {
  if (!isVisible) {
    return 'Rp ••••••••';
  }
  return formatIDR(amount);
}

export interface EmployeeAuditOverride {
  customLatePenaltyAmount?: number;
  customDailyRate?: number;
  presentDays?: number;
  leaveDays?: number;
  unpaidLeaveDays?: number;
  alphaDays?: number;
  lateDays?: number;
  lateMinutes?: number;
  overtimeHours?: number;
  isLatePenaltyWaived?: boolean;
  validated?: boolean;
  notes?: string;
}

export function calculateEmployeePayroll(
  employee: Employee,
  attendances: AttendanceRecord[],
  projects: Project[],
  rules: SalaryRuleConfig,
  periodStr: string = "September 2026",
  startDate?: string,
  endDate?: string,
  customWorkingDays?: number,
  auditOverride?: EmployeeAuditOverride
): PayrollRecord {
  // Filter attendance records by employee and optional date range [startDate, endDate]
  const empAttendances = attendances.filter(a => {
    if (a.employeeId !== employee.id) return false;
    if (startDate && a.date < startDate) return false;
    if (endDate && a.date > endDate) return false;
    return true;
  });

  const workingDays = customWorkingDays || rules.standardWorkDaysPerMonth || 22;

  // Actual count or overridden by HR
  const initialLeaveDays = employee.usedLeave || 0;
  const initialPresentDays = empAttendances.length;

  const presentDays = auditOverride?.presentDays !== undefined 
    ? auditOverride.presentDays 
    : (initialPresentDays > 0 ? initialPresentDays : Math.max(1, workingDays - initialLeaveDays));

  const leaveDays = auditOverride?.leaveDays !== undefined 
    ? auditOverride.leaveDays 
    : initialLeaveDays;

  const unpaidLeaveDays = auditOverride?.unpaidLeaveDays !== undefined 
    ? auditOverride.unpaidLeaveDays 
    : (employee.unpaidLeaveDaysTotal || 0);

  // Gaji Pokok Harian (Ditentukan Finance atau Otomatis Gaji Pokok / Hari Kerja)
  const defaultDailyBase = Math.round(employee.baseSalary / Math.max(1, workingDays));
  const dailyBaseSalary = (auditOverride?.customDailyRate !== undefined && auditOverride.customDailyRate > 0)
    ? auditOverride.customDailyRate
    : defaultDailyBase;

  // Alpha / Mangkir (Hari Kerja - Hadir - Cuti)
  const calculatedAlphaDays = Math.max(0, workingDays - presentDays - leaveDays - unpaidLeaveDays);
  const alphaDays = auditOverride?.alphaDays !== undefined
    ? auditOverride.alphaDays
    : (initialPresentDays > 0 ? calculatedAlphaDays : 0);

  const alphaDeduction = alphaDays * dailyBaseSalary;
  const unpaidLeaveDeduction = (unpaidLeaveDays * dailyBaseSalary) + alphaDeduction;

  // Calculate unapproved late deductions
  const unapprovedLates = empAttendances.filter(a => a.isLate && a.approvalStatus !== 'APPROVED');
  const lateDays = auditOverride?.lateDays !== undefined ? auditOverride.lateDays : unapprovedLates.length;

  let unapprovedLateDeduction = 0;
  if (!auditOverride?.isLatePenaltyWaived) {
    if (auditOverride?.customLatePenaltyAmount !== undefined) {
      unapprovedLateDeduction = Math.max(0, auditOverride.customLatePenaltyAmount);
    } else 
    if (auditOverride?.lateMinutes !== undefined) {
      const blocks = Math.ceil(Math.max(0, auditOverride.lateMinutes - rules.lateGracePeriodMinutes) / 15);
      unapprovedLateDeduction = blocks * rules.latePenaltyPerBlock;
    } else {
      unapprovedLates.forEach(late => {
        const blocks = Math.ceil(Math.max(0, late.lateMinutes - rules.lateGracePeriodMinutes) / 15);
        unapprovedLateDeduction += blocks * rules.latePenaltyPerBlock;
      });
    }
  }

  // Calculate Overtime
  const hourlyBaseRate = Math.round(employee.baseSalary / rules.overtimeFormula.hourlyRateDivisor);
  const overtimeHours = auditOverride?.overtimeHours !== undefined 
    ? auditOverride.overtimeHours 
    : (employee.role === 'Director' ? 0 : 16);
  const overtimePay = Math.round(
    overtimeHours * (rules.overtimeFormula.subsequentHourRateMultiplier * hourlyBaseRate)
  );

  // Allowances
  const dailyAllowanceTotal = presentDays * (employee.dailyAllowance || rules.defaultDailyAllowance);
  const isRemoteSite = employee.assignedProjectId !== 'PRJ-HQ-04';
  const projectAllowance = isRemoteSite ? rules.remoteProjectAllowance : 0;
  const grossSalary = employee.baseSalary + employee.fixedAllowance + dailyAllowanceTotal + projectAllowance + overtimePay;

  // Deductions
  const bpjsKetenagakerjaan = Math.round(employee.baseSalary * rules.bpjsKetenagakerjaanRate);
  const bpjsKesehatan = Math.round(employee.baseSalary * rules.bpjsKesehatanRate);
  
  // Tax PPh 21 estimation (progressive basic tier 5% on taxable income after PTKP)
  const annualGross = grossSalary * 12;
  const ptkp = 54000000; // PTKP Single
  const taxableAnnual = Math.max(0, annualGross - ptkp - (bpjsKetenagakerjaan * 12));
  const pph21 = Math.round((taxableAnnual * 0.05) / 12);

  const totalDeductions = unapprovedLateDeduction + unpaidLeaveDeduction + bpjsKetenagakerjaan + bpjsKesehatan + pph21;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  // Project Allocation:
  const primaryProject = projects.find(p => p.id === employee.assignedProjectId) || projects[0];
  const secondaryProject = projects.find(p => p.id !== employee.assignedProjectId && p.id !== primaryProject?.id) || (projects.length > 1 ? projects[1] : undefined);

  const projectAllocations: ProjectPayrollAllocation[] = [];
  if (primaryProject) {
    if (secondaryProject) {
      projectAllocations.push({
        projectId: primaryProject.id,
        projectCode: primaryProject.code || primaryProject.id,
        projectName: primaryProject.name,
        allocatedHours: 125,
        allocatedCost: Math.round(grossSalary * 0.75),
        percentage: 75
      });
      projectAllocations.push({
        projectId: secondaryProject.id,
        projectCode: secondaryProject.code || secondaryProject.id,
        projectName: secondaryProject.name,
        allocatedHours: 42,
        allocatedCost: Math.round(grossSalary * 0.25),
        percentage: 25
      });
    } else {
      projectAllocations.push({
        projectId: primaryProject.id,
        projectCode: primaryProject.code || primaryProject.id,
        projectName: primaryProject.name,
        allocatedHours: 167,
        allocatedCost: grossSalary,
        percentage: 100
      });
    }
  }

  return {
    id: `PAY-${employee.id}-${periodStr.replace(/\s+/g, '')}`,
    employeeId: employee.id,
    employeeName: employee.name,
    nik: employee.nik,
    department: employee.department,
    position: employee.position,
    period: periodStr,
    workingDays,
    presentDays,
    lateDays,
    unapprovedLateDeduction,
    overtimeHours,
    overtimePay,
    leaveDays,
    unpaidLeaveDays,
    unpaidLeaveDeduction,
    alphaDays,
    alphaDeduction,
    dailyRate: dailyBaseSalary,
    hrValidationStatus: auditOverride?.validated ? 'VALIDATED_BY_HR' : 'PENDING_VALIDATION',
    validationNotes: auditOverride?.notes,
    baseSalary: employee.baseSalary,
    fixedAllowance: employee.fixedAllowance,
    dailyAllowanceTotal,
    projectAllowance,
    grossSalary,
    bpjsKetenagakerjaan,
    bpjsKesehatan,
    pph21,
    totalDeductions,
    netSalary,
    projectAllocations,
    status: 'APPROVED',
    paymentDate: '2026-09-25'
  };
}
