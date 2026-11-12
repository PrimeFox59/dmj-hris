export type UserRole = 'Employee' | 'HR_Manager' | 'Project_Manager' | 'Director' | 'Finance';

export type SystemRole = 'superuser' | 'finance' | 'admin' | 'hr' | 'staff';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  systemRole: SystemRole;
  status: 'active' | 'suspended';
  employeeId?: string;
  lastLogin?: string;
  employee?: Employee | null;
}

export function getEffectiveSystemRole(emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string; id?: string } | null): SystemRole {
  if (!emp) return 'staff';

  // 1. Superuser Master Safeguard (EMP-001 always superuser)
  if (emp.id === 'EMP-001') {
    return 'superuser';
  }

  const sysRoleStr = String(emp.systemRole || '').toLowerCase().trim();

  // 2. Explicit systemRole has highest precedence if set
  if (sysRoleStr === 'superuser') return 'superuser';
  if (sysRoleStr === 'admin' || sysRoleStr === 'hr') return 'hr';
  if (sysRoleStr === 'finance') return 'finance';
  if (sysRoleStr === 'staff') return 'staff';

  // 3. Fallback Heuristics only if systemRole is missing or not set:
  const pos = (emp.position || '').toUpperCase();
  const dept = (emp.department || '').toUpperCase();
  const roleStr = String(emp.role || '').toUpperCase();

  if (
    roleStr === 'DIRECTOR' ||
    pos.includes('DIREKSI') ||
    pos.includes('TECHNICAL DIRECTOR')
  ) {
    return 'superuser';
  }

  if (
    roleStr === 'HR_MANAGER' ||
    pos.includes('HR') ||
    pos.includes('HRD') ||
    dept.includes('HR') ||
    dept.includes('HRD')
  ) {
    return 'hr';
  }

  if (
    roleStr === 'FINANCE' ||
    pos.includes('FINANCE') ||
    pos.includes('ACCOUNTING') ||
    pos.includes('PAJAK') ||
    pos.includes('TAX') ||
    pos.includes('FAT') ||
    dept.includes('FINANCE') ||
    dept.includes('ACCOUNTING') ||
    dept.includes('FAT')
  ) {
    return 'finance';
  }

  return 'staff';
}

export function isHrEmployee(emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string; id?: string } | null): boolean {
  if (!emp) return false;
  if (emp.id === 'EMP-022') return true;
  const eff = getEffectiveSystemRole(emp);
  return eff === 'hr' || String(emp.role || '').toUpperCase() === 'HR_MANAGER';
}

export function isFinanceEmployee(emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string; id?: string } | null): boolean {
  if (!emp) return false;
  if (emp.id === 'EMP-015' || emp.id === 'EMP-045') return true;
  const eff = getEffectiveSystemRole(emp);
  return eff === 'finance' || String(emp.role || '').toUpperCase() === 'FINANCE';
}

export function isProjectManager(
  emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string; id?: string; name?: string } | null,
  projects?: Array<{ projectManagerId?: string; projectManagerName?: string }>
): boolean {
  if (!emp) return false;
  const pos = (emp.position || '').toUpperCase();
  const roleStr = String(emp.role || '').toUpperCase();
  const sysRoleStr = String(emp.systemRole || '').toLowerCase();

  // 1. Direct role check
  if (
    roleStr === 'PROJECT_MANAGER' || 
    roleStr.includes('PM') || 
    roleStr.includes('PROJECT MANAGER') ||
    roleStr === 'MANAGER' ||
    sysRoleStr === 'pm'
  ) {
    return true;
  }

  // 2. Position heuristics (PM, Project Manager, Site Manager, Manager, Management, Kepala Proyek, Site Engineer)
  if (
    pos.includes('PROJECT MANAGER') || 
    pos.includes('SITE MANAGER') || 
    pos.includes('KEPALA PROYEK') ||
    pos.includes('KA. PROYEK') ||
    pos === 'PM' || 
    pos.startsWith('PM ') || 
    pos.includes(' PM') ||
    pos.includes('SITE ENG') ||
    pos.includes('MANAGER') ||
    pos.includes('MANAGEMENT')
  ) {
    return true;
  }

  // 3. Project assignment check (emp is assigned as Leader/PM on any project)
  if (projects && Array.isArray(projects)) {
    const isAssigned = projects.some(p => 
      (emp.id && p.projectManagerId === emp.id) ||
      (emp.name && p.projectManagerName && p.projectManagerName.toLowerCase().trim() === emp.name.toLowerCase().trim())
    );
    if (isAssigned) return true;
  }

  return false;
}

export function isProjectAdmin(
  emp?: { id?: string; name?: string } | null,
  projects?: Array<{ projectAdminIds?: string[]; projectAdminNames?: string[] }>
): boolean {
  if (!emp || !projects || !Array.isArray(projects)) return false;
  return projects.some(p =>
    (emp.id && p.projectAdminIds?.includes(emp.id)) ||
    (emp.name && p.projectAdminNames?.some(n => n.toLowerCase().trim() === emp.name?.toLowerCase().trim()))
  );
}

export function canAccessProjectModule(
  emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string; id?: string; name?: string } | null,
  projects?: Array<{ projectManagerId?: string; projectManagerName?: string; projectAdminIds?: string[]; projectAdminNames?: string[] }>
): boolean {
  if (!emp) return false;
  const sysRole = getEffectiveSystemRole(emp);
  const isHR = sysRole === 'hr' || sysRole === 'admin' || emp.role === 'HR_Manager';
  const isFinance = sysRole === 'finance' || emp.role === 'Finance';
  const isSuper = sysRole === 'superuser' || emp.role === 'Director';
  const isPM = isProjectManager(emp, projects);
  const isPAdmin = isProjectAdmin(emp, projects);
  // Akses modul proyek terbuka untuk Finance, HR, Superuser, Project Manager (PM), dan Admin Proyek
  return isFinance || isHR || isSuper || isPM || isPAdmin;
}

export function getEmployeeAssignedProjects<T extends { id: string; code?: string; name: string; assignedEmployeeIds?: string[]; projectManagerId?: string; projectAdminIds?: string[]; isHeadOffice?: boolean }>(
  employee?: { id?: string; name?: string; assignedProjectId?: string; assignedProjectIds?: string[] } | null,
  projects?: T[]
): T[] {
  if (!employee || !projects || !Array.isArray(projects)) return [];
  const assignedMap = new Map<string, T>();

  // 1. Projects where employee ID is in assignedEmployeeIds or is PM/Admin
  projects.forEach(p => {
    const list = p.assignedEmployeeIds || [];
    if (
      (employee.id && list.includes(employee.id)) ||
      (employee.id && p.projectManagerId === employee.id) ||
      (employee.id && p.projectAdminIds && p.projectAdminIds.includes(employee.id))
    ) {
      assignedMap.set(p.id, p);
    }
  });

  // 2. Direct employee assignment field
  if (employee.assignedProjectId) {
    const p = projects.find(prj => prj.id === employee.assignedProjectId || prj.code === employee.assignedProjectId);
    if (p) assignedMap.set(p.id, p);
  }
  if (Array.isArray(employee.assignedProjectIds)) {
    employee.assignedProjectIds.forEach(pid => {
      const p = projects.find(prj => prj.id === pid || prj.code === pid);
      if (p) assignedMap.set(p.id, p);
    });
  }

  // Fallback: if completely unassigned, fallback to head office or first project
  if (assignedMap.size === 0 && projects.length > 0) {
    const headOffice = projects.find(p => p.isHeadOffice || p.code === 'PRJ-001') || projects[0];
    assignedMap.set(headOffice.id, headOffice);
  }

  return Array.from(assignedMap.values());
}

export type AttendanceMode = 'WFO' | 'DINAS_LUAR' | 'WFH';

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'DINAS_LUAR' | 'DINAS_LUAR_PENDING' | 'WFH_APPROVED' | 'LEAVE' | 'SICK' | 'PERMIT' | 'ALPA' | 'OUT_OF_GEOFENCE';

export type BiometricPoseKey = 'front' | 'right' | 'left' | 'smile';

export interface BiometricProfile {
  isEnrolled: boolean;
  enrolledAt: string; // ISO String
  enrolledBy?: string;
  qualityScore: number; // e.g. 96.5%
  samples: {
    front: string; // base64 dataUrl
    right: string; // base64 dataUrl
    left: string;  // base64 dataUrl
    smile: string; // base64 dataUrl
  };
  features?: {
    avgBrightness?: number;
    contrastScore?: number;
    livenessScore?: number;
    samplesCount?: number;
  };
}

export interface BiometricVerificationResult {
  isVerified: boolean;
  matchScore: number; // 0 - 100
  matchedPose?: BiometricPoseKey;
  livenessPassed: boolean;
  details?: string;
}

export interface Employee {
  id: string;
  nik: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: UserRole;
  systemRole?: SystemRole; // RBAC: superuser | admin | staff
  department: string;
  position: string;
  employmentType: 'TETAP' | 'KONTRAK' | 'PROJECT_HIRE';
  joinDate: string;
  assignedProjectId: string;
  assignedProjectIds?: string[];
  baseSalary: number;
  fixedAllowance: number;
  dailyAllowance: number;
  leaveQuota: number;
  usedLeave: number;
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  loginId?: string;
  ktpNumber?: string;
  maritalStatus?: string; // 'TK' | 'K' | 'K/I' (Tidak Kawin / Kawin / Kawin Istri Gabung)
  dependents?: number; // 0, 1, 2, 3 (Tanggungan anak/keluarga fiskal)
  ptkpStatus?: string; // e.g. 'TK/0', 'K/1', 'K/2', etc. (Sesuai PPh 21)
  npwpNumber?: string; // Nomor Pokok Wajib Pajak (15/16 digit)
  biometric?: BiometricProfile;
  workLocationType?: WorkLocationType;
  nonLokalLeaveConfig?: NonLokalLeaveConfig;
  status?: 'ACTIVE' | 'INACTIVE';
  inactiveReason?: string;
  unpaidLeaveDaysTotal?: number;
}

export type WorkLocationType = 'LOKAL' | 'NON_LOKAL';

export interface NonLokalLeaveConfig {
  rosterCycleMonths: number; // e.g. 3 bulan
  leaveQuotaPerPeriod: number; // e.g. 8 - 12 hari per periode
  usedPeriodLeave: number;
  lastLeaveDate?: string; // YYYY-MM-DD
  nextEligibleLeaveDate?: string; // YYYY-MM-DD
  allowEarlyLeave?: boolean; // default true
  allowAccumulation?: boolean; // Fleksibel akumulasi ke roster berikutnya
  accumulatedLeaveDays?: number; // Hari akumulasi yang disetujui HR Manager
  accumulationApprovedBy?: string; // e.g. "HR Manager"
  accumulationApprovalDate?: string; // YYYY-MM-DD
  accumulationNotes?: string; // Catatan persetujuan akumulasi dari HR Manager
  notes?: string;
  scheduledLeaveHistory?: {
    startDate: string;
    endDate: string;
    days: number;
    status?: string;
  }[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeLoginId?: string; // Canonical Login ID badge (e.g. 'd014', 'd025', 'admin') matching Master Karyawan
  employeeName: string;
  employeeNik: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string;
  attendanceType?: 'CHECK_IN' | 'CHECK_OUT';
  mode: AttendanceMode;
  status: AttendanceStatus;
  photoUrl?: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
    inGeofence: boolean;
    distanceMeters: number;
  };
  networkAudit?: {
    ipAddress: string;
    connectionType?: string;
  };
  note: string;
  isLate: boolean;
  lateMinutes: number;
  lateReason?: string;
  outOfRangeReason?: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  dinasLuarDetails?: {
    destination: string;
    clientName: string;
    projectCode: string;
    purpose: string;
    isSudden: boolean;
  };
  approvalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvalDate?: string;
  approvalNote?: string;
  deductionWaived?: boolean; // True jika disetujui HR tanpa potongan denda (tetap dihitung terlambat)
  isLateDeductionWaived?: boolean;
  isEarlyCheckOut?: boolean;
  earlyCheckOutMinutes?: number;
  earlyCheckOutReason?: string;
  scheduledCheckOutTime?: string;
  isEarlyCheckOutApproved?: boolean;
  biometricVerification?: BiometricVerificationResult;
  photoOutUrl?: string;
  checkInPhotoUrl?: string;
  checkOutPhotoUrl?: string;
  checkInLocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
    inGeofence: boolean;
    distanceMeters: number;
  };
  checkOutLocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
    inGeofence: boolean;
    distanceMeters: number;
  };
  checkInNote?: string;
  checkOutNote?: string;
  checkInBiometric?: BiometricVerificationResult;
  checkOutBiometric?: BiometricVerificationResult;
  isHrCorrected?: boolean;
  hrCorrectionNotes?: string;
  hrCorrectedBy?: string;
  hrCorrectedAt?: string;
  originalStatus?: string;
}

export type LeaveType = 'CUTI_TAHUNAN' | 'CUTI_ROSTER_NON_LOKAL' | 'CUTI_SAKIT' | 'CUTI_MELAHIRKAN' | 'CUTI_MENIKAH' | 'IZIN_KEPERLUAN_PRIBADI' | 'IZIN_DUKA';

export type KasbonRepaymentType = 'TOTAL_BULANAN' | 'CICILAN';
export type KasbonStatus = 'PENDING' | 'APPROVED' | 'DISBURSED' | 'REJECTED' | 'COMPLETED';

export interface KasbonInstallmentSchedule {
  installmentNumber: number;
  period: string; // e.g. "Oktober 2026"
  amount: number;
  isDeducted: boolean;
  deductedAt?: string;
  payrollRecordId?: string;
}

export interface KasbonRecord {
  id: string; // e.g. "KSB-202611-001"
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  department: string;
  position: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  amount: number;
  reason: string;
  repaymentType: KasbonRepaymentType; // 'TOTAL_BULANAN' (Lunas Sekaligus) | 'CICILAN'
  totalInstallments: number; // 1 jika TOTAL_BULANAN, atau 2, 3, 6, 10, 12 jika CICILAN
  monthlyDeduction: number;
  startPeriod: string; // e.g. "Oktober 2026"
  disbursementBankName?: string;
  disbursementAccountNumber?: string;
  disbursementAccountHolder?: string;
  status: KasbonStatus;
  submittedAt: string;
  pmApprovedBy?: string;
  pmApprovedAt?: string;
  pmReviewNote?: string;
  hrApprovedBy?: string;
  hrApprovedAt?: string;
  hrReviewNote?: string;
  disbursedBy?: string;
  disbursedAt?: string;
  totalPaid: number;
  remainingBalance: number;
  installments: KasbonInstallmentSchedule[];
  notes?: string;
}

export interface ApprovalItem {
  id: string;
  type: 'LEAVE' | 'PERMIT' | 'LATE_JUSTIFICATION' | 'DINAS_LUAR' | 'ATTENDANCE_CORRECTION' | 'OUT_OF_GEOFENCE' | 'KASBON' | 'SLIP_ACCESS' | 'EARLY_CHECKOUT';
  employeeId: string;
  employeeLoginId?: string; // Canonical Login ID badge (e.g. 'd014', 'd025', 'admin') matching Master Karyawan
  employeeName: string;
  employeeNik?: string;
  department: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  daysCount?: number;
  lateMinutes?: number;
  earlyCheckOutMinutes?: number;
  scheduledCheckOutTime?: string;
  leaveType?: LeaveType;
  isEarlySubmission?: boolean;
  earlyReason?: string;
  proofAttachment?: string;
  attendanceRecordId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  deductionWaived?: boolean; // Pilihan persetujuan keterlambatan: true = tanpa potongan denda, false = tetap dipotong
  waiveLateDeduction?: boolean;
  coveredByQuotaDays?: number;
  unpaidLeaveDays?: number;
  isOverQuota?: boolean;
  isOffSchedule?: boolean;
  offScheduleReason?: string;
  requiresHrApproval?: boolean;
  isAccumulationRequest?: boolean;
  accumulationDaysRequested?: number;
  // Metadata Koreksi Absensi Mandiri & Penugasan Proyek
  targetCheckInTime?: string;
  targetCheckOutTime?: string;
  targetStatus?: 'ON_TIME' | 'LATE' | 'DINAS_LUAR' | 'OUT_OF_GEOFENCE' | AttendanceStatus;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  projectAdminIds?: string[];
  projectAdminNames?: string[];
  targetApproverRole?: 'PM' | 'HR' | 'FINANCE';
  stage?: 'PM' | 'HR' | 'FINANCE' | 'FINAL';
  pmApprovedBy?: string;
  pmApprovedAt?: string;
  pmReviewNote?: string;
  hrApprovedBy?: string;
  hrApprovedAt?: string;
  hrReviewNote?: string;
  kasbonData?: KasbonRecord;
  // Metadata Request Buka Slip Gaji (Visible 10 Menit by Finance Approval)
  slipPeriod?: string;
  slipAccessExpiresAt?: string;
  financeApprovedBy?: string;
  financeApprovedAt?: string;
  financeReviewNote?: string;
  requiresFinanceApproval?: boolean;
  crossApprovalReason?: string;
}

export interface ProjectWorkSchedule {
  enabled: boolean;
  workDays: number; // 5 or 6 days/week
  checkInTime: string; // e.g. "07:30"
  checkOutTime: string; // e.g. "16:30"
  lateGraceMinutes: number; // e.g. 15
  saturdayWork: boolean;
  saturdayCheckIn?: string; // e.g. "07:30"
  saturdayCheckOut?: string; // e.g. "12:30"
  allowFlexibleHours?: boolean;
}

export interface ProjectLeavePolicy {
  enabled: boolean;
  rosterPattern: 'NORMAL' | '6_ON_2_OFF' | '10_ON_2_OFF' | '14_ON_14_OFF' | 'CUSTOM';
  customRosterDesc?: string;
  extraRemoteLeaveDays: number; // e.g. 2 compensatory days
  minimumNoticeDays: number; // e.g. 7 days notice
  requiresHandover: boolean;
  blackoutPeriodStart?: string;
  blackoutPeriodEnd?: string;
  customLeaveNotes?: string;
}

export interface ProjectAllowanceRule {
  enabled: boolean;
  dailySiteAllowance: number; // in IDR
  monthlyRemoteAllowance: number; // in IDR
}

export interface ProjectGeofenceRule {
  enabled: boolean;
  siteName?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}

export interface ProjectCustomRules {
  workSchedule?: ProjectWorkSchedule;
  leavePolicy?: ProjectLeavePolicy;
  allowance?: ProjectAllowanceRule;
  geofence?: ProjectGeofenceRule;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  status: 'ACTIVE' | 'PLANNING' | 'COMPLETED';
  startDate: string;
  targetEndDate: string;
  allocatedBudget: number; // in IDR
  actualLaborCost: number; // in IDR
  projectedLaborCost: number; // in IDR
  totalEstimatedHours: number;
  actualHoursSpent: number;
  hourlyRateMultiplier: number;
  description?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  projectAdminIds?: string[];
  projectAdminNames?: string[];
  assignedEmployeeIds?: string[];
  customRules?: ProjectCustomRules;
  isHeadOffice?: boolean;
}

export interface ProjectPayrollAllocation {
  projectId: string;
  projectCode: string;
  projectName: string;
  allocatedHours: number;
  allocatedCost: number;
  percentage: number;
  totalProjectsCount?: number;
  otherProjectCodes?: string[];
  otherProjectNames?: string[];
  allAssignedProjectCodes?: string[];
  allAssignedProjectNames?: string[];
  note?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  nik: string;
  department: string;
  position: string;
  period: string; // e.g. "September 2026"
  workingDays: number;
  presentDays: number;
  lateDays: number;
  lateMinutes?: number;
  lateHours?: number;
  isOfficeEmployee?: boolean;
  lateDeductionRate?: number;
  lateDeductionNote?: string;
  unapprovedLateDeduction: number;
  overtimeHours: number;
  overtimePay: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  alphaDays?: number;
  alphaDeduction?: number;
  dailyRate?: number;
  customLatePenaltyAmount?: number;
  hrValidationStatus: 'PENDING_VALIDATION' | 'VALIDATED_BY_HR' | 'SUBMITTED_TO_FINANCE' | 'PROCESSED_BY_FINANCE';
  validatedBy?: string;
  validatedAt?: string;
  validationNotes?: string;
  financeApprovedBy?: string;
  financeApprovedAt?: string;
  baseSalary: number;
  fixedAllowance: number;
  dailyAllowanceTotal: number;
  projectAllowance: number;
  grossSalary: number;
  bpjsKetenagakerjaan: number;
  bpjsKesehatan: number;
  pph21: number;
  ptkpStatus?: string;
  ptkpAnnual?: number;
  terCategory?: string;
  kasbonDeduction?: number;
  kasbonDeductionNote?: string;
  kasbonRemainingBalance?: number;
  kasbonRecordId?: string;
  totalDeductions: number;
  netSalary: number;
  projectAllocations: ProjectPayrollAllocation[];
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paymentDate?: string;
}

export interface SalaryRuleConfig {
  standardWorkDaysPerMonth: number;
  standardHoursPerDay: number;
  cutoffTime: string; // e.g. "08:30"
  lateGracePeriodMinutes: number; // e.g. 15 mins
  latePenaltyPerBlock: number; // IDR per 15 min if unapproved
  officeLatePenaltyPerHour?: number; // Rp 50.000 / jam (khusus Office / Kantor Pusat)
  overtimeFormula: {
    firstHourRateMultiplier: number; // e.g. 1.5
    subsequentHourRateMultiplier: number; // e.g. 2.0
    holidayRateMultiplier: number; // e.g. 2.0 - 3.0
    hourlyRateDivisor: number; // 173 as per Depnaker
  };
  bpjsKetenagakerjaanRate: number; // 3%
  bpjsKesehatanRate: number; // 1%
  defaultDailyAllowance: number; // IDR 50,000 / day
  remoteProjectAllowance: number; // IDR 1,500,000 / month
  authorizedIpNetworks?: Array<{
    ipOrSubnet: string;
    label: string;
    isp: string;
    isRegisteredOffice: boolean;
  }>;
  officeGeofence: {
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    address: string;
  };
  whatsappConfig?: WhatsAppConfig;
  smtpConfig?: SmtpConfig;
}

export interface WhatsAppConfig {
  enabled: boolean;
  gatewayUrl?: string;
  senderPhone?: string;
  notifyAttendanceSuccess: boolean;
  notifyAttendanceLate: boolean;
  notifyMorningReminder: boolean;
  morningReminderTime: string; // e.g. "07:30"
  notifyApproachingCutoff: boolean;
  approachingCutoffMinutesBefore: number; // e.g. 15
  notifyApprovalUpdates: boolean;
  notifyOverdueCheckIn?: boolean;
  notifyCheckOutReminder?: boolean;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string; // e.g. "smtp.gmail.com"
  port: number; // e.g. 465 (SSL) or 587 (TLS)
  secure: boolean; // true for 465, false for 587
  user: string; // e.g. "hris.notification@gmail.com"
  pass: string; // 16-character Gmail App Password
  fromName: string; // e.g. "DMJ HRIS Enterprise"
  fromEmail: string; // e.g. "hris.notification@gmail.com"
  notifyAttendanceSuccess: boolean;
  notifyAttendanceLate: boolean;
  notifyApprovalSubmitted: boolean;
  notifyApprovalUpdates: boolean;
  notifyMorningReminder: boolean;
  morningReminderTime: string; // e.g. "07:30"
  notifyOverdueCheckIn?: boolean;
  notifyCheckOutReminder?: boolean;
}

export interface EmailNotificationLog {
  id: string;
  recipient_id?: string;
  recipient_name?: string;
  recipient_email: string;
  event_type: string;
  subject: string;
  html_body?: string;
  text_body?: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  error_msg?: string;
  metadata?: any;
  sent_at: string;
}

export interface WaNotificationLog {
  id: number;
  recipientId?: string;
  recipientName: string;
  recipientPhone: string;
  eventType: string;
  title: string;
  message: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  errorMsg?: string;
  sentAt: string;
}

export interface CommercialProposal {
  title: string;
  client: string;
  vendor: string;
  version: string;
  date: string;
  packages: Array<{
    id: string;
    name: string;
    tagline: string;
    price: number;
    period: string;
    isPopular?: boolean;
    features: string[];
  }>;
}

export type AuditModule = 'AUTH' | 'ATTENDANCE' | 'APPROVALS' | 'EMPLOYEES' | 'PAYROLL' | 'HR_RULES' | 'SYSTEM';

export type AuditStatus = 'SUCCESS' | 'WARNING' | 'FAILED';

export interface AuditLogItem {
  id: number;
  timestamp: string;
  userName: string;
  userNik?: string;
  userLoginId?: string;
  userRole: SystemRole | 'system';
  action: string;
  module: AuditModule;
  entity?: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  status: AuditStatus;
  metadata?: string;
}

export interface AuditLogStats {
  total: number;
  auth: number;
  attendance: number;
  approvals: number;
  employees: number;
  projects: number;
  payroll: number;
  rules: number;
  success: number;
  warning: number;
  danger: number;
}

export interface PaginatedAuditLogs {
  logs: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats?: AuditLogStats;
}

export interface WorkPeriodItem {
  periodId: string;
  monthIndex: number;
  periodName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  paydayDate: string; // YYYY-MM-DD
  attendanceOpen: boolean;
  payrollStatus: 'DRAFT' | 'OPEN' | 'CUTOFF_LOCKED' | 'PAID';
  totalCalendarDays: number;
  effectiveWorkDays: number;
  weeklyOffDaysCount: number;
  holidaysCount: number;
  notes?: string;
}

export interface AnnualWorkCalendarConfig {
  id: string;
  year: number;
  weeklyOffDays: number[]; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  defaultCutoffStartDay: number; // e.g. 21
  defaultCutoffEndDay: number; // e.g. 20
  defaultPaydayDate: number; // e.g. 25
  periods: WorkPeriodItem[];
  updatedAt?: string;
  updatedBy?: string;
}



export interface CasualWorker {
  id: string;
  projectId: string;
  name: string;
  status: 'active' | 'inactive';
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CasualWorkerAttendance {
  id: string;
  workerId: string;
  workerName: string;
  projectId: string;
  projectName?: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm:ss
  photoUrl: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  notes?: string;
  verifiedByPmId: string;
  verifiedByPmName: string;
  createdAt?: string;
}

export interface WaOptInRecord {
  phone: string;
  employee_id?: string | null;
  employee_login_id?: string | null;
  employee_name?: string | null;
  department?: string | null;
  position?: string | null;
  first_message?: string | null;
  first_message_at?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  message_count: number;
  is_active?: number | boolean;
  manual_override?: number | boolean;
  has_chatted?: boolean;
}
