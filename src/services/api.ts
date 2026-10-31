import {
  Employee,
  Project,
  AttendanceRecord,
  ApprovalItem,
  SalaryRuleConfig,
  AuthUser,
  AuditLogItem,
  PaginatedAuditLogs,
  BiometricProfile,
  WaNotificationLog,
  WaOptInRecord,
  SmtpConfig,
  EmailNotificationLog,
  AnnualWorkCalendarConfig,
  CasualWorker,
  CasualWorkerAttendance
} from '../types';

export interface BootstrapResponse {
  employees: Employee[];
  projects: Project[];
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  salaryRules: SalaryRuleConfig;
  workCalendar?: AnnualWorkCalendarConfig;
  dbInfo: {
    engine: string;
    journalMode: string;
    dbPath: string;
    sizeBytes: number;
    sizeKb: number;
  };
}

let currentAuthToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('prime_hris_token') : null;

export const api = {
  setAuthToken(token: string | null) {
    currentAuthToken = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('prime_hris_token', token);
      else localStorage.removeItem('prime_hris_token');
    }
  },

  getAuthToken(): string | null {
    return currentAuthToken;
  },

  getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (currentAuthToken) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }
    return headers;
  },

  // 0. Auth Endpoints
  async login(identifier: string, password: string): Promise<{ success: boolean; token: string; user: AuthUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal login. Periksa kembali email/username dan password.');
    }
    api.setAuthToken(data.token);
    return data;
  },

  async requestForgotPassword(identifier: string): Promise<{
    success: boolean;
    message: string;
    username?: string;
    displayName?: string;
    targetPhone?: string | null;
    targetEmail?: string | null;
    channels?: { whatsapp: boolean; email: boolean };
    tempPassword?: string;
    error?: string;
  }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal memproses pemulihan kata sandi. Pastikan data yang dimasukkan benar.');
    }
    return data;
  },

  async loginWithBiometric(employeeId: string, biometricVerification: any): Promise<{ success: boolean; token: string; user: AuthUser }> {
    const res = await fetch('/api/auth/biometric-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, biometricVerification })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Autentikasi biometrik wajah gagal');
    }
    if (data.token) {
      api.setAuthToken(data.token);
    }
    return data;
  },

  async getMe(): Promise<{ success: boolean; user: AuthUser; token?: string; offline?: boolean }> {
    if (!currentAuthToken) {
      throw new Error('No auth token');
    }
    const res = await fetch('/api/auth/me', {
      headers: api.getAuthHeaders()
    });
    if (!res.ok) {
      // Hanya hapus token jika server eksplisit mengembalikan 401 Unauthorized
      if (res.status === 401) {
        api.setAuthToken(null);
        throw new Error('Sesi telah berakhir atau tidak valid (401)');
      }
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data.offline) {
      return { success: true, user: null as any, offline: true };
    }
    if (data.token) {
      api.setAuthToken(data.token);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: api.getAuthHeaders()
      });
    } catch (e) {}
    api.setAuthToken(null);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengubah password');
    return data;
  },

  async resetEmployeePassword(employeeId: string, newPassword: string = 'zzz'): Promise<{ success: boolean; message: string; loginId: string; defaultPassword?: string }> {
    const res = await fetch(`/api/employees/${employeeId}/reset-password`, {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ employeeId, newPassword })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mereset password karyawan');
    }
    return data;
  },

  async saveBiometricProfile(employeeId: string, biometric: BiometricProfile, updateAvatarAsWell: boolean = false): Promise<{ success: boolean; message: string; employee: Employee }> {
    const res = await fetch(`/api/employees/${employeeId}/biometric`, {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ biometric, updateAvatarAsWell })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal menyimpan profil biometrik');
    }
    return data;
  },

  async deleteBiometricProfile(employeeId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/employees/${employeeId}/biometric`, {
      method: 'DELETE',
      headers: api.getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mereset biometrik karyawan');
    }
    return data;
  },

  async getAccounts(): Promise<{ success: boolean; accounts: any[] }> {
    const res = await fetch('/api/auth/accounts', {
      headers: api.getAuthHeaders()
    });
    if (!res.ok) throw new Error('Gagal memuat akun pengguna');
    return res.json();
  },

  // 1. Load all data from SQLite
  async getBootstrapData(): Promise<BootstrapResponse> {
    const res = await fetch('/api/bootstrap', {
      headers: api.getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error(`Gagal memuat data dari SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 2. Health & DB Info
  async getDatabaseInfo(): Promise<any> {
    const res = await fetch('/api/health');
    if (!res.ok) {
      throw new Error(`Gagal membaca status SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 3. Save Attendance Record to SQLite
  async saveAttendance(record: AttendanceRecord): Promise<{ success: boolean; record: AttendanceRecord }> {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      throw new Error(`Gagal menyimpan presensi ke SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 3b. Delete Attendance Record from SQLite (Superuser Testing / Trial)
  async deleteAttendance(id: string): Promise<{ success: boolean; id?: string; error?: string }> {
    let res = await fetch(`/api/attendance/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders()
    });
    if (!res.ok) {
      // Fallback via POST in case DELETE method is blocked by reverse proxy
      res = await fetch('/api/attendance/delete', {
        method: 'POST',
        headers: api.getAuthHeaders(),
        body: JSON.stringify({ id })
      });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMsg = data?.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}: Gagal menghapus data presensi`;
      throw new Error(errorMsg);
    }
    return data || { success: true, id };
  },

  // 4. Update Approval in SQLite
  async updateApproval(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED',
    reviewNote?: string,
    reviewedBy: string = 'Direksi / HR Lead'
  ): Promise<{ success: boolean; item: ApprovalItem }> {
    const res = await fetch('/api/approval', {
      method: 'PUT',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ id, status, reviewNote, reviewedBy })
    });
    if (!res.ok) {
      throw new Error(`Gagal memperbarui status approval di SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 4b. Submit New Approval Request (Leave, Permit, etc.) to SQLite
  async submitApproval(item: ApprovalItem): Promise<{ success: boolean; item: ApprovalItem }> {
    const res = await fetch('/api/approval/submit', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      throw new Error(`Gagal mengirim pengajuan ke server: ${res.statusText}`);
    }
    return res.json();
  },

  // 5. Save/Update Employee in SQLite
  async saveEmployee(emp: Employee): Promise<{ success: boolean; employee: Employee }> {
    const res = await fetch('/api/employee', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(emp)
    });
    if (!res.ok) {
      throw new Error(`Gagal menyimpan data karyawan ke SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 5b. Save/Update Project in SQLite
  async saveProject(project: Project): Promise<{ success: boolean; project: Project }> {
    const res = await fetch('/api/project', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(project)
    });
    if (!res.ok) {
      throw new Error(`Gagal menyimpan data proyek ke SQLite: ${res.statusText}`);
    }
    return res.json();
  },


  // 7. Save Salary Rules in SQLite
  async saveSalaryRules(rules: SalaryRuleConfig): Promise<{ success: boolean; rules: SalaryRuleConfig }> {
    const res = await fetch('/api/salary-rules', {
      method: 'PUT',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(rules)
    });
    if (!res.ok) {
      throw new Error(`Gagal memperbarui aturan gaji di SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 8. Reset SQLite database to default initial state
  async resetDatabase(): Promise<BootstrapResponse> {
    const res = await fetch('/api/reset', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Gagal me-reset database SQLite: ${res.statusText}`);
    }
    return res.json();
  },

  // 9. Download link for SQLite file
  getDownloadDbUrl(): string {
    return '/api/download-db';
  },

  // 10. Audit Logs with 10-Item Infinite Scroll Pagination
  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    search?: string;
    module?: string;
    role?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<PaginatedAuditLogs> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    query.set('limit', String(params.limit || 10)); // Default 10 per request
    if (params.search) query.set('search', params.search);
    if (params.module && params.module !== 'ALL') query.set('module', params.module);
    if (params.role && params.role !== 'ALL') query.set('role', params.role);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);

    const res = await fetch(`/api/audit-logs?${query.toString()}`, {
      headers: api.getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error(`Gagal memuat audit log: ${res.statusText}`);
    }
    return res.json();
  },

  // 11. Client Activity Logger
  async logActivity(entry: {
    action: string;
    entity?: string;
    entityId?: string;
    details: string;
    userName?: string;
    userNik?: string;
    userRole?: string;
    module?: string;
    ipAddress?: string;
    status?: 'SUCCESS' | 'WARNING' | 'FAILED';
    metadata?: any;
  }): Promise<{ success: boolean }> {
    try {
      const res = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: api.getAuthHeaders(),
        body: JSON.stringify(entry)
      });
      return res.json();
    } catch (e) {
      console.warn('[Audit Logger Warning]', e);
      return { success: false };
    }
  },

  // 12. Public Kiosk Directory (Tanpa Login)
  async getPublicKioskEmployees(): Promise<{
    success: boolean;
    employees: any[];
    projects?: any[];
    officeGeofence?: { name: string; lat: number; lng: number; radiusMeters: number; address?: string };
    todayAttendances?: Record<string, any>;
  }> {
    const res = await fetch('/api/public-kiosk/employees');
    if (!res.ok) {
      throw new Error(`Gagal memuat direktori karyawan kiosk: ${res.statusText}`);
    }
    return res.json();
  },

  // 12b. Fast Enrolled Biometric Gallery (< 80 KB payload)
  async getEnrolledBiometricGallery(): Promise<{
    success: boolean;
    employees: any[];
    count: number;
  }> {
    try {
      const res = await fetch('/api/biometric/gallery');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.employees)) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Fast biometric gallery endpoint failed, using fallback:', e);
    }
    // Fallback if needed
    const fallback = await api.getPublicKioskEmployees();
    const enrolledOnly = (fallback.employees || []).filter((e: any) => e.hasBiometric || e.biometric?.isEnrolled);
    return {
      success: true,
      employees: enrolledOnly,
      count: enrolledOnly.length
    };
  },

  // 13. Public Kiosk Attendance Submission (Tanpa Login)
  async submitPublicAttendance(record: AttendanceRecord): Promise<{ success: boolean; record: AttendanceRecord }> {
    const res = await fetch('/api/public-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const errJson = await res.json();
        if (errJson && (errJson.error || errJson.message)) {
          errMsg = errJson.error || errJson.message;
        }
      } catch (e) {}
      throw new Error(`Gagal mengirim presensi kiosk: ${errMsg || `Status ${res.status}`}`);
    }
    return res.json();
  },

  // 14. WhatsApp Baileys Gateway & Logs
  async getWaStatus(): Promise<{
    success: boolean;
    online: boolean;
    gatewayUrl?: string;
    clientInfo?: { pushname?: string; phone?: string } | null;
    clientState?: string;
    hasQr?: boolean;
    qrDataUrl?: string | null;
    error?: string;
  }> {
    const res = await fetch('/api/wa/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat status WhatsApp`);
    return res.json();
  },

  async restartWaGateway(): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/wa/restart', {
      method: 'POST',
      headers: api.getAuthHeaders()
    });
    return res.json();
  },

  async logoutWaGateway(): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/wa/logout', {
      method: 'POST',
      headers: api.getAuthHeaders()
    });
    return res.json();
  },

  async getWaLogs(limit: number = 30): Promise<{ success: boolean; logs: WaNotificationLog[] }> {
    const res = await fetch(`/api/wa/logs?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat riwayat notifikasi`);
    return res.json();
  },

  async getWaOptIns(): Promise<{ success: boolean; optIns: WaOptInRecord[]; count: number }> {
    const res = await fetch('/api/wa/opt-ins', {
      headers: api.getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat daftar nomor WA terverifikasi`);
    return res.json();
  },

  async sendTestWa(phone: string, message?: string, force?: boolean): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/wa/test', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ phone, message, force })
    });
    return res.json();
  },

  async blastUnrecordedWa(date?: string): Promise<{
    success: boolean;
    targetDate: string;
    totalTargeted: number;
    sentCount: number;
    failedCount: number;
    details: Array<{ id: string; name: string; phone: string; status: string; error?: string }>;
  }> {
    const res = await fetch('/api/wa/blast-unrecorded', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ date })
    });
    return res.json();
  },

  // 15. Email SMTP (Gmail) Configuration, Test & Logs
  async getEmailStatus(): Promise<{
    success: boolean;
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromName: string;
    fromEmail: string;
    verified: boolean;
    statusMessage?: string;
  }> {
    const res = await fetch('/api/email/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal membaca status SMTP`);
    return res.json();
  },

  async verifySmtp(config: Partial<SmtpConfig>): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/email/verify', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(config)
    });
    return res.json();
  },

  async sendTestEmail(to: string, customConfig?: Partial<SmtpConfig>): Promise<{ success: boolean; message?: string; error?: string; messageId?: string }> {
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ to, customConfig })
    });
    return res.json();
  },

  async getEmailLogs(limit: number = 30): Promise<{ success: boolean; logs: EmailNotificationLog[] }> {
    const res = await fetch(`/api/email/logs?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat riwayat email`);
    return res.json();
  },

  async blastUnrecordedEmail(date?: string): Promise<{
    success: boolean;
    targetDate: string;
    totalTargeted: number;
    sentCount: number;
    failedCount: number;
    details: Array<{ id: string; name: string; email: string; status: string; error?: string }>;
  }> {
    const res = await fetch('/api/email/blast-unrecorded', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ date })
    });
    return res.json();
  },

  async getWorkCalendar(year: number = 2026): Promise<{ success: boolean; calendar?: AnnualWorkCalendarConfig; config?: AnnualWorkCalendarConfig }> {
    const res = await fetch(`/api/work-calendar?year=${year}`, {
      headers: api.getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat kalender kerja`);
    return res.json();
  },

  async saveWorkCalendar(config: AnnualWorkCalendarConfig): Promise<{ success: boolean; calendar?: AnnualWorkCalendarConfig; config?: AnnualWorkCalendarConfig }> {
    const res = await fetch('/api/work-calendar', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal menyimpan kalender kerja`);
    return res.json();
  },

  async toggleWorkPeriodAttendance(periodId: string, open: boolean): Promise<{ success: boolean; calendar?: AnnualWorkCalendarConfig; config?: AnnualWorkCalendarConfig }> {
    const res = await fetch(`/api/work-calendar/period/${encodeURIComponent(periodId)}/toggle`, {
      method: 'PUT',
      headers: api.getAuthHeaders(),
      body: JSON.stringify({ open })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal mengubah status periode presensi`);
    return res.json();
  },

  // =========================================================================
  // CASUAL WORKER ATTENDANCE (PRESENSI TUKANG LAPANGAN)
  // =========================================================================
  async getCasualWorkers(projectId?: string): Promise<{ success: boolean; workers: CasualWorker[]; count: number }> {
    const url = projectId ? `/api/casual-workers?projectId=${encodeURIComponent(projectId)}` : '/api/casual-workers';
    const res = await fetch(url, { headers: api.getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat daftar tukang proyek`);
    return res.json();
  },

  async saveCasualWorker(worker: Partial<CasualWorker>): Promise<{ success: boolean; worker?: CasualWorker; error?: string }> {
    const res = await fetch('/api/casual-workers', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(worker)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal menyimpan data tukang`);
    return res.json();
  },

  async getCasualAttendances(params?: { projectId?: string; date?: string; startDate?: string; endDate?: string }): Promise<{ success: boolean; attendances: CasualWorkerAttendance[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.projectId) searchParams.set('projectId', params.projectId);
    if (params?.date) searchParams.set('date', params.date);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetch(`/api/casual-attendances${queryStr}`, { headers: api.getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat riwayat presensi tukang`);
    return res.json();
  },

  async saveCasualAttendance(record: Partial<CasualWorkerAttendance>): Promise<{ success: boolean; attendance?: CasualWorkerAttendance; error?: string }> {
    const res = await fetch('/api/casual-attendances', {
      method: 'POST',
      headers: api.getAuthHeaders(),
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal menyimpan presensi tukang`);
    return res.json();
  },

  async deleteCasualAttendance(id: string): Promise<{ success: boolean }> {
    let res = await fetch(`/api/casual-attendances/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: api.getAuthHeaders()
    });
    if (!res.ok) {
      res = await fetch('/api/casual-attendances/delete', {
        method: 'POST',
        headers: api.getAuthHeaders(),
        body: JSON.stringify({ id })
      });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMsg = data?.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}: Gagal menghapus presensi tukang`;
      throw new Error(errorMsg);
    }
    return data || { success: true };
  }
};
