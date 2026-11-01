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

/**
 * Cek apakah karyawan bertugas di Kantor Pusat (Office).
 * Sesuai aturan:
 * - Karyawan Office: Denda keterlambatan Rp 50.000 / jam
 * - Selain Office (Site Proyek Lapangan): Bebas denda keterlambatan (Rp 0)
 */
export function isEmployeeInOffice(employee: Employee, projects: Project[] = []): boolean {
  if (!employee) return false;

  const assignedProj = projects?.find(p => p.id === employee.assignedProjectId || p.code === employee.assignedProjectId);
  if (assignedProj) {
    if (
      assignedProj.isHeadOffice ||
      assignedProj.code === 'PRJ-001' ||
      assignedProj.id === 'PRJ-001' ||
      (assignedProj.name && assignedProj.name.toUpperCase().includes('KANTOR PUSAT'))
    ) {
      return true;
    }
    return false;
  }

  const pid = String(employee.assignedProjectId || '').toUpperCase();
  if (pid === 'PRJ-001' || pid.includes('HEAD_OFFICE') || pid === 'OFFICE') {
    return true;
  }

  const dept = String(employee.department || '').toUpperCase();
  if (
    dept.includes('HEAD OFFICE') || 
    dept.includes('MANAGEMENT SUPPORT') ||
    dept.includes('DIREKSI') ||
    dept.includes('FINANCE') ||
    dept.includes('ACCOUNTING') ||
    dept.includes('HR')
  ) {
    return true;
  }

  return false;
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
    const idMatch = a.employeeId === employee.id;
    const nikMatch = Boolean(employee.nik && a.employeeNik === employee.nik);
    const nameMatch = Boolean(a.employeeName && employee.name && a.employeeName.trim().toLowerCase() === employee.name.trim().toLowerCase());
    if (!idMatch && !nikMatch && !nameMatch) return false;
    if (startDate && a.date < startDate) return false;
    if (endDate && a.date > endDate) return false;
    return true;
  });

  const workingDays = customWorkingDays || rules.standardWorkDaysPerMonth || 22;

  // Actual count: STRICTLY REAL ATTENDANCES (NO DUMMY FALLBACK)
  const actualPresentDays = empAttendances.length;

  const presentDays = auditOverride?.presentDays !== undefined 
    ? auditOverride.presentDays 
    : actualPresentDays;

  // Leave in this specific cutoff period (defaults to 0 unless audited/approved for this period)
  const leaveDays = auditOverride?.leaveDays !== undefined 
    ? auditOverride.leaveDays 
    : 0;

  const unpaidLeaveDays = auditOverride?.unpaidLeaveDays !== undefined 
    ? auditOverride.unpaidLeaveDays 
    : 0;

  // Gaji Pokok Harian (Ditentukan Finance atau Otomatis Gaji Pokok / Hari Kerja)
  const defaultDailyBase = Math.round(employee.baseSalary / Math.max(1, workingDays));
  const dailyBaseSalary = (auditOverride?.customDailyRate !== undefined && auditOverride.customDailyRate > 0)
    ? auditOverride.customDailyRate
    : defaultDailyBase;

  // Alpha / Mangkir (Hari Kerja - Hadir - Cuti)
  const calculatedAlphaDays = Math.max(0, workingDays - presentDays - leaveDays - unpaidLeaveDays);
  const alphaDays = auditOverride?.alphaDays !== undefined
    ? auditOverride.alphaDays
    : calculatedAlphaDays;

  const alphaDeduction = alphaDays * dailyBaseSalary;
  const unpaidLeaveDeduction = (unpaidLeaveDays * dailyBaseSalary) + alphaDeduction;

  // Calculate late statistics & deductions
  const unapprovedLates = empAttendances.filter(a => a.isLate && a.approvalStatus !== 'APPROVED');
  const approvedLates = empAttendances.filter(a => a.isLate && a.approvalStatus === 'APPROVED');
  const allLates = empAttendances.filter(a => a.isLate);
  const lateDays = auditOverride?.lateDays !== undefined ? auditOverride.lateDays : allLates.length;

  let totalLateMinutes = 0;
  let unapprovedLateMinutes = 0;
  allLates.forEach(late => {
    totalLateMinutes += (late.lateMinutes || 0);
  });
  unapprovedLates.forEach(late => {
    unapprovedLateMinutes += (late.lateMinutes || 0);
  });

  if (auditOverride?.lateMinutes !== undefined) {
    totalLateMinutes = auditOverride.lateMinutes;
    unapprovedLateMinutes = auditOverride.lateMinutes;
  }

  // Aturan Pemotongan Keterlambatan DMJ HRIS:
  // - Karyawan di Office / Kantor Pusat: Denda keterlambatan Rp 50.000 / jam
  // - Selain Office (Site Proyek Lapangan): Bebas potongan jika terlambat (Rp 0)
  const isOffice = isEmployeeInOffice(employee, projects);
  const officeHourlyPenalty = rules.officeLatePenaltyPerHour || 50000;
  const gracePeriod = rules.lateGracePeriodMinutes ?? 15;

  let unapprovedLateDeduction = 0;
  let lateHours = 0;
  let lateDeductionNote = '';

  if (isOffice) {
    if (auditOverride?.isLatePenaltyWaived) {
      unapprovedLateDeduction = 0;
      lateDeductionNote = 'Dispensasi HR Manager (Denda Dibebaskan)';
    } else if (auditOverride?.customLatePenaltyAmount !== undefined) {
      unapprovedLateDeduction = Math.max(0, auditOverride.customLatePenaltyAmount);
      lateHours = Math.ceil(unapprovedLateDeduction / officeHourlyPenalty);
      lateDeductionNote = `${lateHours} Jam Terlambat (@ Rp ${officeHourlyPenalty.toLocaleString('id-ID')}/jam)`;
    } else if (auditOverride?.lateMinutes !== undefined) {
      const effectiveMinutes = Math.max(0, auditOverride.lateMinutes - gracePeriod);
      lateHours = Math.ceil(effectiveMinutes / 60);
      unapprovedLateDeduction = lateHours * officeHourlyPenalty;
      lateDeductionNote = `${lateHours} Jam Terlambat (${auditOverride.lateMinutes} mnt) @ Rp ${officeHourlyPenalty.toLocaleString('id-ID')}/jam`;
    } else {
      unapprovedLates.forEach(late => {
        const effectiveMinutes = Math.max(0, (late.lateMinutes || 0) - gracePeriod);
        if (effectiveMinutes > 0) {
          const hours = Math.ceil(effectiveMinutes / 60);
          lateHours += hours;
          unapprovedLateDeduction += hours * officeHourlyPenalty;
        }
      });
      if (unapprovedLateDeduction > 0) {
        lateDeductionNote = `${lateHours} Jam Terlambat (${unapprovedLateMinutes} mnt, ${unapprovedLates.length} hari) @ Rp ${officeHourlyPenalty.toLocaleString('id-ID')}/jam`;
      } else if (approvedLates.length > 0) {
        lateDeductionNote = `${approvedLates.length}x Terlambat (${totalLateMinutes} mnt) — Dispensasi PM/HR Disetujui`;
      } else if (totalLateMinutes > 0 && totalLateMinutes <= gracePeriod) {
        lateDeductionNote = `Terlambat ${totalLateMinutes} mnt (Toleransi ${gracePeriod} mnt)`;
      } else {
        lateDeductionNote = 'Tepat Waktu (0 Menit Terlambat)';
      }
    }
  } else {
    // Selain office (Site Lapangan) bebas potongan keterlambatan
    unapprovedLateDeduction = 0;
    if (allLates.length > 0) {
      lateDeductionNote = `${allLates.length}x Terlambat (${totalLateMinutes} mnt) • Bebas Potongan Denda Site`;
    } else {
      lateDeductionNote = 'Bebas Potongan Denda Site (Nihil)';
    }
  }

  // Calculate Overtime: STRICTLY 0 UNLESS AUDITED/APPROVED (NO DUMMY 16 HOURS!)
  const hourlyBaseRate = Math.round(employee.baseSalary / rules.overtimeFormula.hourlyRateDivisor);
  const overtimeHours = auditOverride?.overtimeHours !== undefined 
    ? auditOverride.overtimeHours 
    : 0;
  const overtimePay = Math.round(
    overtimeHours * (rules.overtimeFormula.subsequentHourRateMultiplier * hourlyBaseRate)
  );

  // Allowances (Daily allowance strictly paid for actual days present!)
  const dailyAllowanceTotal = presentDays * (employee.dailyAllowance || rules.defaultDailyAllowance);
  const isRemoteSite = employee.assignedProjectId !== 'PRJ-HQ-04' && employee.workLocationType === 'NON_LOKAL';
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
        allocatedHours: Math.round(presentDays * 8 * 0.75),
        allocatedCost: Math.round(grossSalary * 0.75),
        percentage: 75
      });
      projectAllocations.push({
        projectId: secondaryProject.id,
        projectCode: secondaryProject.code || secondaryProject.id,
        projectName: secondaryProject.name,
        allocatedHours: Math.round(presentDays * 8 * 0.25),
        allocatedCost: Math.round(grossSalary * 0.25),
        percentage: 25
      });
    } else {
      projectAllocations.push({
        projectId: primaryProject.id,
        projectCode: primaryProject.code || primaryProject.id,
        projectName: primaryProject.name,
        allocatedHours: presentDays * 8,
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
    lateMinutes: totalLateMinutes,
    lateHours,
    isOfficeEmployee: isOffice,
    lateDeductionRate: officeHourlyPenalty,
    lateDeductionNote,
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
