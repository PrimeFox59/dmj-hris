import { ApprovalItem, Employee, Project } from '../types';

export function isHrEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  const dept = (emp.department || '').toLowerCase();
  const pos = (emp.position || '').toLowerCase();
  const role = (emp.role || '').toLowerCase();
  return (
    dept.includes('hr') ||
    dept.includes('human resource') ||
    pos.includes('hr') ||
    pos.includes('human resource') ||
    role === 'hr' ||
    emp.id === 'EMP-022' ||
    emp.loginId === 'hr'
  );
}

export function isFinanceEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  const dept = (emp.department || '').toLowerCase();
  const pos = (emp.position || '').toLowerCase();
  const role = (emp.role || '').toLowerCase();
  return (
    dept.includes('finance') ||
    dept.includes('keuangan') ||
    dept.includes('accounting') ||
    pos.includes('finance') ||
    pos.includes('keuangan') ||
    pos.includes('accounting') ||
    role === 'finance' ||
    emp.id === 'EMP-015' ||
    emp.id === 'EMP-045' ||
    emp.loginId === 'finance' ||
    emp.loginId === 'linalestari'
  );
}

export function isHrManager(user?: Employee | null, currentRole?: string): boolean {
  if (!user) return false;
  const role = currentRole || (user.role || '').toLowerCase();
  return Boolean(
    role === 'hr' ||
    user.role === 'HR_Manager' ||
    (user.position && /HR|HRD|Human Resources/i.test(user.position)) ||
    (user.department && /HR|HRD|Human Resources/i.test(user.department)) ||
    user.id === 'EMP-022' ||
    user.loginId === 'hr'
  );
}

export interface UserAuthorityContext {
  currentUser: Employee;
  currentRole: string; // 'superuser' | 'admin' | 'hr' | 'finance' | 'staff'
  isHrManager: boolean;
  isFinance: boolean;
  isProjectManager: boolean;
  managedProjectIds: Set<string>;
  adminProjectIds: Set<string>;
  employees: Employee[];
  projects: Project[];
}

/**
 * Memeriksa apakah user saat ini memiliki wewenang aktif untuk MENG-APPROVE / MENOLAK pengajuan.
 */
export function canUserApproveItem(
  item: ApprovalItem,
  context: UserAuthorityContext
): boolean {
  const { currentUser, currentRole, isHrManager, employees, projects } = context;

  // 1. Conflict of interest: pengaju tidak boleh menyetujui pengajuannya sendiri (kecuali superuser)
  if (item.employeeId === currentUser.id && currentRole !== 'superuser') return false;

  // 2. Item yang sudah final tidak perlu diproses lagi
  if (item.status === 'APPROVED' || item.status === 'REJECTED') return false;

  // 3. Superuser memegang hak override darurat tertinggi
  if (currentRole === 'superuser') return true;

  // Identifikasi Profil Pengaju & User yang sedang login
  const applicant = employees.find(e => e.id === item.employeeId);
  const applicantIsHr = isHrEmployee(applicant) || item.employeeId === 'EMP-022';
  const applicantIsFinance = isFinanceEmployee(applicant) || item.employeeId === 'EMP-015' || item.employeeId === 'EMP-045';

  const userIsHr = isHrManager || currentRole === 'hr' || currentRole === 'admin' || isHrEmployee(currentUser);
  const userIsFinance = currentRole === 'finance' || currentUser.role === 'Finance' || isFinanceEmployee(currentUser);

  // 3b. Khusus Izin Akses Buka Slip Gaji & Kasbon (Finansial)
  if (item.type === 'SLIP_ACCESS' || item.type === 'KASBON' || item.targetApproverRole === 'FINANCE' || item.stage === 'FINANCE') {
    if (applicantIsFinance) {
      // Jika akun Finance yang mengajukan, otorisasi silang dialihkan ke HR Manager
      return userIsHr;
    }
    // Pengajuan finansial dari staf selain Finance wajib di-ACC oleh Divisi Finance
    return userIsFinance;
  }

  // 4. Cari proyek pengaju, PM proyek terkait, dan Admin Proyek
  const applicantProj = (projects || []).find(p =>
    p.id === item.projectId ||
    p.code === item.projectCode ||
    p.id === employees.find(e => e.id === item.employeeId)?.assignedProjectId
  );
  const pmId = item.projectManagerId || applicantProj?.projectManagerId;
  const isApplicantThePm = Boolean(pmId && pmId === item.employeeId);
  const hasProjectPm = Boolean(pmId && !isApplicantThePm);

  const projectAdminIds = item.projectAdminIds || applicantProj?.projectAdminIds || [];
  const isUserProjectAdmin = projectAdminIds.includes(currentUser.id);
  const hasProjectAdmins = projectAdminIds.filter(id => id !== item.employeeId).length > 0;

  // Tentukan tahap saat ini:
  // Menunggu PM / Admin Proyek: jika memiliki PM proyek atau Admin Proyek dan belum disetujui PM (dan targetApproverRole === 'PM' || stage === 'PM' || !item.stage)
  const isWaitingForPmOrAdmin = (hasProjectPm || hasProjectAdmins) && !item.pmApprovedBy && (item.targetApproverRole === 'PM' || item.stage === 'PM' || !item.stage);

  if (isWaitingForPmOrAdmin) {
    // TAHAP 1: WAJIB ke PM terkait atau Admin Proyek terlebih dahulu!
    if (pmId === currentUser.id || applicantProj?.projectManagerId === currentUser.id || isUserProjectAdmin) {
      return true;
    }
    return false;
  }

  // TAHAP 2: Otorisasi Akhir Berjenjang / Otorisasi Silang (Cross-Approval)
  // ATURAN 1: Jika pengaju adalah HR Manager / Tim HR, yang berhak approve adalah FINANCE MANAGER!
  if (applicantIsHr) {
    return userIsFinance;
  }

  // ATURAN 2: Jika pengaju adalah Finance Manager / Tim Finance, yang berhak approve adalah HR MANAGER!
  if (applicantIsFinance) {
    return userIsHr;
  }

  // ATURAN 3: Karyawan / Staf umum lainnya disetujui oleh HR Manager
  return userIsHr;
}

/**
 * Memeriksa apakah suatu pengajuan berada dalam RUANG LINGKUP OTORITAS / WEWENANG user.
 * Digunakan untuk memfilter daftar pengajuan, tabel rekap, dan hitungan badge.
 */
export function isItemWithinUserAuthority(
  item: ApprovalItem,
  context: UserAuthorityContext
): boolean {
  const { currentUser, currentRole, isHrManager, isFinance, isProjectManager, managedProjectIds, adminProjectIds, employees, projects } = context;

  // 1. Pengajuan milik user sendiri SELALU boleh dilihat (agar pemohon bisa pantau statusnya)
  if (item.employeeId === currentUser.id) return true;

  // 2. Superuser / Direktur / Master Admin memegang wewenang pengawasan seluruh enterprise
  if (
    currentRole === 'superuser' ||
    currentRole === 'admin' ||
    currentUser.id === 'EMP-001' ||
    currentUser.loginId === 'admin' ||
    currentUser.role === 'Director'
  ) {
    return true;
  }

  const applicant = employees.find(e => e.id === item.employeeId);
  const applicantIsHr = isHrEmployee(applicant) || item.employeeId === 'EMP-022';
  const applicantIsFinance = isFinanceEmployee(applicant) || item.employeeId === 'EMP-015' || item.employeeId === 'EMP-045';
  const isFinanceType = item.type === 'SLIP_ACCESS' || item.type === 'KASBON' || item.targetApproverRole === 'FINANCE' || item.stage === 'FINANCE';

  // 3. User ber-role FINANCE
  if (isFinance) {
    // Finance berwenang atas pengajuan finansial (SLIP_ACCESS, KASBON, FINANCE) KECUALI jika pengaju adalah Finance sendiri (karena disilang ke HR)
    if (isFinanceType && !applicantIsFinance) return true;

    // Finance juga berwenang atas otorisasi silang dari HR Manager (ketika pemohon adalah tim HR di Tahap 2)
    if (applicantIsHr) return true;

    // Selain itu, bukan wewenang Finance (Cuti/Izin/Keterlambatan staf umum adalah milik HR/PM)
    return false;
  }

  // 4. User ber-role PROJECT MANAGER / ADMIN PROYEK
  if (isProjectManager || adminProjectIds.size > 0) {
    const applicantProj = (projects || []).find(p =>
      p.id === item.projectId ||
      p.code === item.projectCode ||
      p.id === applicant?.assignedProjectId
    );
    const itemProjId = item.projectId || applicantProj?.id;
    const isUnderMyProject = Boolean(
      (itemProjId && (managedProjectIds.has(itemProjId) || adminProjectIds.has(itemProjId))) ||
      item.projectManagerId === currentUser.id ||
      (item.projectAdminIds && item.projectAdminIds.includes(currentUser.id)) ||
      (applicant?.assignedProjectId && (managedProjectIds.has(applicant.assignedProjectId) || adminProjectIds.has(applicant.assignedProjectId)))
    );

    // Pengajuan non-finansial di bawah proyeknya adalah wewenang PM / Admin Proyek
    if (isUnderMyProject && !isFinanceType) {
      return true;
    }
  }

  // 5. User ber-role HR MANAGER / TIM HR
  if (isHrManager || currentRole === 'hr') {
    // HR berwenang atas seluruh pengajuan SDM operasional (Cuti, Izin, Sakit, Keterlambatan, Koreksi, Pulang Cepat, Dinas Luar, Presensi Luar)
    if (!isFinanceType) {
      return true;
    }

    // Untuk pengajuan tipe Finansial (SLIP_ACCESS, KASBON), HR HANYA berwenang jika pemohon adalah tim Finance (Otorisasi Silang Finance ➔ HR)
    if (isFinanceType && applicantIsFinance) {
      return true;
    }

    // SLIP_ACCESS / KASBON staf umum BUKAN wewenang HR (mutlak wewenang Finance)
    return false;
  }

  // 6. Karyawan / Staf Biasa (non-approver)
  // Hanya melihat pengajuan miliknya sendiri (sudah tercover di aturan #1)
  return false;
}

/**
 * Menghitung jumlah pengajuan yang membutuhkan tindakan (Actionable Notification Count) untuk user saat ini.
 */
export function getActionablePendingCount(
  approvals: ApprovalItem[],
  context: UserAuthorityContext
): number {
  const isStaff = !context.isHrManager && !context.isFinance && !context.isProjectManager && context.adminProjectIds.size === 0 && context.currentRole !== 'superuser' && context.currentRole !== 'admin';

  if (isStaff) {
    // Karyawan biasa: pengajuan miliknya yang sedang diproses atau perlu revisi
    return approvals.filter(
      a => a.employeeId === context.currentUser.id &&
      (a.status === 'PENDING' || a.status === 'REVISION_REQUESTED')
    ).length;
  }

  // Approver: HANYA pengajuan yang pending dan user saat ini MEMILIKI HAK untuk meng-approve
  return approvals.filter(item => item.status === 'PENDING' && canUserApproveItem(item, context)).length;
}

/**
 * Otorisasi Akses Menu Database & Sinkronisasi Excel
 * HANYA dapat diakses oleh:
 * 1. Superuser / Master Admin
 * 2. HR Manager
 * 3. Finance
 */
export function canAccessDatabaseModule(
  user?: Employee | null,
  currentRole?: string
): boolean {
  if (!user) return false;

  const roleStr = String(currentRole || user.systemRole || user.role || '').toLowerCase();

  // 1. Superuser / Master Admin
  if (
    roleStr === 'superuser' ||
    user.id === 'EMP-001' ||
    user.role === 'Director' ||
    user.loginId === 'admin' ||
    user.loginId === 'galih' ||
    (user as any).username === 'admin' ||
    (user as any).username === 'galih'
  ) {
    return true;
  }

  // 2. HR Manager
  if (
    isHrManager(user, currentRole) ||
    user.role === 'HR_Manager' ||
    user.id === 'EMP-022' ||
    user.loginId === 'hr' ||
    (user.position && /HR\s*MANAGER|MANAGER\s*HRD/i.test(user.position))
  ) {
    return true;
  }

  // 3. Finance
  if (
    roleStr === 'finance' ||
    user.role === 'Finance' ||
    isFinanceEmployee(user)
  ) {
    return true;
  }

  return false;
}

