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

export function isProjectManager(emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string } | null): boolean {
  if (!emp) return false;
  const pos = (emp.position || '').toUpperCase();
  const roleStr = String(emp.role || '').toUpperCase();
  return (
    pos.includes('PROJECT MANAGER') || 
    pos.includes('SITE MANAGER') || 
    pos === 'PM' || 
    pos.startsWith('PM ') || 
    pos.includes(' PM') ||
    roleStr === 'PROJECT_MANAGER'
  );
}

export function canAccessProjectModule(emp?: { role?: UserRole | string; systemRole?: SystemRole | string; position?: string; department?: string; id?: string } | null): boolean {
  if (!emp) return false;
  const sysRole = getEffectiveSystemRole(emp);
  const isHR = sysRole === 'hr' || sysRole === 'admin' || emp.role === 'HR_Manager';
  const isFinance = sysRole === 'finance' || emp.role === 'Finance';
  const isSuper = sysRole === 'superuser' || emp.role === 'Director';
  // Modul proyek HANYA untuk Finance, HR, dan Superuser (Direksi)
  return isFinance || isHR || isSuper;
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
  employeeName: string;
  employeeNik: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string;
  attendanceType?: 'CHECK_IN' | 'CHECK_OUT';
  mode: AttendanceMode;
  status: AttendanceStatus;
  photoUrl: string;
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
  biometricVerification?: BiometricVerificationResult;
  photoOutUrl?: string;
  isHrCorrected?: boolean;
  hrCorrectionNotes?: string;
  hrCorrectedBy?: string;
  hrCorrectedAt?: string;
  originalStatus?: string;
}

export type LeaveType = 'CUTI_TAHUNAN' | 'CUTI_ROSTER_NON_LOKAL' | 'CUTI_SAKIT' | 'CUTI_MELAHIRKAN' | 'CUTI_MENIKAH' | 'IZIN_KEPERLUAN_PRIBADI' | 'IZIN_DUKA';

export interface ApprovalItem {
  id: string;
  type: 'LEAVE' | 'PERMIT' | 'LATE_JUSTIFICATION' | 'DINAS_LUAR' | 'ATTENDANCE_CORRECTION' | 'OUT_OF_GEOFENCE';
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  department: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  daysCount?: number;
  lateMinutes?: number;
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
  targetStatus?: 'ON_TIME' | 'LATE' | 'DINAS_LUAR';
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  targetApproverRole?: 'PM' | 'HR';
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
  assignedEmployeeIds?: string[];
  customRules?: ProjectCustomRules;
}

export interface ProjectPayrollAllocation {
  projectId: string;
  projectCode: string;
  projectName: string;
  allocatedHours: number;
  allocatedCost: number;
  percentage: number;
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
}

export interface SmtpConfig {
  enabled: boolean;
  host: string; // e.g. "smtp.gmail.com"
  port: number; // e.g. 465 (SSL) or 587 (TLS)
  secure: boolean; // true for 465, false for 587
  user: string; // e.g. "hris.notification@gmail.com"
  pass: string; // 16-character Gmail App Password
  fromName: string; // e.g. "PRIME HRIS Enterprise"
  fromEmail: string; // e.g. "hris.notification@gmail.com"
  notifyAttendanceSuccess: boolean;
  notifyAttendanceLate: boolean;
  notifyApprovalSubmitted: boolean;
  notifyApprovalUpdates: boolean;
  notifyMorningReminder: boolean;
  morningReminderTime: string; // e.g. "07:30"
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
  employee_name?: string | null;
  first_message?: string;
  first_message_at?: string;
  last_message?: string;
  last_message_at?: string;
  message_count: number;
}
