import { Employee, Project, PayrollRecord, SalaryRuleConfig, AttendanceRecord, ProjectPayrollAllocation, getEmployeeAssignedProjects, KasbonRecord } from '../types';

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
  customKasbonDeduction?: number;
  customKasbonNote?: string;
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
  auditOverride?: EmployeeAuditOverride,
  activeKasbonRecords?: KasbonRecord[]
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
  // Keterlambatan dianggap bebas denda (waived) jika disetujui HR tanpa potongan (deductionWaived === true),
  // namun TETAP dihitung terlambat di statistik hari/menit keterlambatan (allLates).
  const isLateWaived = (a: AttendanceRecord) => {
    if (a.deductionWaived === true || a.isLateDeductionWaived === true) return true;
    if (a.deductionWaived === false || a.isLateDeductionWaived === false) return false;
    return a.approvalStatus === 'APPROVED';
  };

  const allLates = empAttendances.filter(a => a.isLate);
  const waivedLates = empAttendances.filter(a => a.isLate && isLateWaived(a));
  const penalizedLates = empAttendances.filter(a => a.isLate && !isLateWaived(a));
  const lateDays = auditOverride?.lateDays !== undefined ? auditOverride.lateDays : allLates.length;

  let totalLateMinutes = 0;
  let penalizedLateMinutes = 0;
  allLates.forEach(late => {
    totalLateMinutes += (late.lateMinutes || 0);
  });
  penalizedLates.forEach(late => {
    penalizedLateMinutes += (late.lateMinutes || 0);
  });

  if (auditOverride?.lateMinutes !== undefined) {
    totalLateMinutes = auditOverride.lateMinutes;
    penalizedLateMinutes = auditOverride.lateMinutes;
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
      penalizedLates.forEach(late => {
        const effectiveMinutes = Math.max(0, (late.lateMinutes || 0) - gracePeriod);
        if (effectiveMinutes > 0) {
          const hours = Math.ceil(effectiveMinutes / 60);
          lateHours += hours;
          unapprovedLateDeduction += hours * officeHourlyPenalty;
        }
      });
      if (unapprovedLateDeduction > 0) {
        lateDeductionNote = `${lateHours} Jam Terlambat (${penalizedLateMinutes} mnt, ${penalizedLates.length} hari) @ Rp ${officeHourlyPenalty.toLocaleString('id-ID')}/jam${waivedLates.length > 0 ? ` • ${waivedLates.length}x Bebas Denda` : ''}`;
      } else if (waivedLates.length > 0) {
        lateDeductionNote = `${waivedLates.length}x Terlambat (${totalLateMinutes} mnt) — Disetujui HR Bebas Denda`;
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

  // Kasbon Pribadi & Cicilan Pinjaman Karyawan
  let kasbonDeduction = 0;
  let kasbonDeductionNote = '';
  let kasbonRemainingBalance = 0;
  let kasbonRecordId = '';

  if (auditOverride?.customKasbonDeduction !== undefined) {
    kasbonDeduction = auditOverride.customKasbonDeduction;
    kasbonDeductionNote = auditOverride.customKasbonNote || `Potongan Kasbon Disesuaikan Manual: Rp ${kasbonDeduction.toLocaleString('id-ID')}`;
  } else if (Array.isArray(activeKasbonRecords) && activeKasbonRecords.length > 0) {
    const empKasbons = activeKasbonRecords.filter(k =>
      (k.employeeId === employee.id || (employee.nik && k.employeeNik === employee.nik)) &&
      (k.status === 'APPROVED' || k.status === 'DISBURSED' || (k as any).status === 'ACTIVE') &&
      k.remainingBalance > 0
    );

    empKasbons.forEach(k => {
      // Periksa apakah jadwal cicilan kasbon ini jatuh tempo pada periode ini
      const matchingSchedule = Array.isArray(k.installments)
        ? k.installments.find(inst => inst.period.toLowerCase().trim() === periodStr.toLowerCase().trim())
        : undefined;

      if (matchingSchedule && !matchingSchedule.isDeducted) {
        const dueAmount = Math.min(k.remainingBalance, matchingSchedule.amount);
        kasbonDeduction += dueAmount;
        kasbonRecordId = k.id;
        const remainingAfter = Math.max(0, k.remainingBalance - dueAmount);
        kasbonRemainingBalance += remainingAfter;

        if (k.repaymentType === 'TOTAL_BULANAN') {
          kasbonDeductionNote = `Pelunasan Kasbon Sekaligus (Lunas)`;
        } else {
          kasbonDeductionNote = `Cicilan Kasbon Ke-${matchingSchedule.installmentNumber} dari ${k.totalInstallments} Bulan (Sisa Pokok: Rp ${remainingAfter.toLocaleString('id-ID')})`;
        }
      } else if (!matchingSchedule && k.startPeriod && k.startPeriod.toLowerCase().trim() === periodStr.toLowerCase().trim()) {
        const dueAmount = k.repaymentType === 'TOTAL_BULANAN'
          ? Math.min(k.remainingBalance, k.amount)
          : Math.min(k.remainingBalance, k.monthlyDeduction);
        kasbonDeduction += dueAmount;
        kasbonRecordId = k.id;
        const remainingAfter = Math.max(0, k.remainingBalance - dueAmount);
        kasbonRemainingBalance += remainingAfter;

        if (k.repaymentType === 'TOTAL_BULANAN') {
          kasbonDeductionNote = `Pelunasan Kasbon Sekaligus (Lunas)`;
        } else {
          kasbonDeductionNote = `Cicilan Kasbon Ke-1 dari ${k.totalInstallments} Bulan (Sisa Pokok: Rp ${remainingAfter.toLocaleString('id-ID')})`;
        }
      }
    });
  }

  const totalDeductions = unapprovedLateDeduction + unpaidLeaveDeduction + bpjsKetenagakerjaan + bpjsKesehatan + pph21 + kasbonDeduction;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  // Proportional Multi-Project Payroll Allocation
  // Jika 1 user terlibat banyak proyek (misal 3 proyek), maka beban gaji & biaya tenaga kerja
  // dibagi rata ke seluruh proyek tersebut (1/N porsi tiap proyek).
  // Total akumulasi di resume konsolidasi enterprise tetap 100% akurat sesuai data aktual tanpa duplikasi.
  const assignedProjects = getEmployeeAssignedProjects(employee, projects);
  const numProjects = Math.max(1, assignedProjects.length);

  const projectAllocations: ProjectPayrollAllocation[] = [];
  const baseCostPerProject = Math.floor(grossSalary / numProjects);
  const remainderCost = grossSalary - (baseCostPerProject * numProjects);

  const baseHoursPerProject = Math.floor((presentDays * 8) / numProjects);
  const remainderHours = (presentDays * 8) - (baseHoursPerProject * numProjects);

  const basePercentage = Math.floor(100 / numProjects);
  const remainderPercentage = 100 - (basePercentage * numProjects);

  assignedProjects.forEach((proj, idx) => {
    const allocatedCost = idx === 0 ? baseCostPerProject + remainderCost : baseCostPerProject;
    const allocatedHours = idx === 0 ? baseHoursPerProject + remainderHours : baseHoursPerProject;
    const percentage = idx === 0 ? basePercentage + remainderPercentage : basePercentage;

    const otherProjects = assignedProjects.filter(p => p.id !== proj.id);
    const otherProjectCodes = otherProjects.map(p => p.code || p.id);
    const otherProjectNames = otherProjects.map(p => p.name);
    const allAssignedProjectCodes = assignedProjects.map(p => p.code || p.id);
    const allAssignedProjectNames = assignedProjects.map(p => p.name);

    const note = numProjects > 1
      ? `Terlibat di ${numProjects} Proyek: ${assignedProjects.map(p => `[${p.code || p.id}] ${p.name}`).join(', ')} (Alokasi 1/${numProjects} Beban Gaji)`
      : 'Penugasan Penuh Proyek Tunggal (100%)';

    projectAllocations.push({
      projectId: proj.id,
      projectCode: proj.code || proj.id,
      projectName: proj.name,
      allocatedHours,
      allocatedCost,
      percentage,
      totalProjectsCount: numProjects,
      otherProjectCodes,
      otherProjectNames,
      allAssignedProjectCodes,
      allAssignedProjectNames,
      note
    });
  });

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
    kasbonDeduction,
    kasbonDeductionNote,
    kasbonRemainingBalance,
    kasbonRecordId,
    totalDeductions,
    netSalary,
    projectAllocations,
    status: 'APPROVED',
    paymentDate: '2026-09-25'
  };
}
