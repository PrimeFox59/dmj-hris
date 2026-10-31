import http from 'http';
import https from 'https';
import { URL } from 'url';
import {
  saveWaNotificationLog,
  getWaNotificationLogs,
  hasSentTodayWaReminder,
  getDatabase,
  isWaOptedIn,
  recordWaOptIn,
  getWaOptIns,
  getEmployeeProjectSchedule,
  getEmployeeByIdentifier
} from './db.js';

// Configuration: Dedicated PRIME HRIS WhatsApp Gateway (Port 9008)
// Strictly bound to the system's own Baileys session (.prime_wa_auth).
// ZERO external VPS routing and ZERO cross-project gateway usage.
const GATEWAY_URL = process.env.WA_GATEWAY_URL || 'http://127.0.0.1:9008';

/**
 * Standardize Indonesian phone numbers to 628xxx format
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = `62${normalized.slice(1)}`;
  } else if (normalized.startsWith('8')) {
    normalized = `62${normalized}`;
  } else if (normalized.startsWith('620')) {
    normalized = `62${normalized.slice(3)}`;
  }

  if (!normalized.startsWith('62') || normalized.length < 10) return null;
  return normalized;
}

/**
 * Low-level HTTP POST dispatcher to Baileys Gateway
 */
async function postJson(targetUrl, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(targetUrl);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;
      const data = JSON.stringify(payload);

      const req = lib.request({
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300 && parsed.success !== false) {
              resolve({ ok: true, data: parsed, statusCode: res.statusCode });
            } else {
              resolve({ ok: false, error: parsed.message || parsed.error || `HTTP ${res.statusCode}`, data: parsed, statusCode: res.statusCode });
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true, data: { raw: body }, statusCode: res.statusCode });
            } else {
              resolve({ ok: false, error: `Invalid JSON response: ${body.substring(0, 100)}`, statusCode: res.statusCode });
            }
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Gateway request timeout (10s)'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Check Baileys Gateway Live Connection Status
 */
export async function getGatewayStatus() {
  return new Promise((resolve) => {
    try {
      const u = new URL(`${GATEWAY_URL}/status`);
      const req = http.get(u, { timeout: 4000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({
              online: parsed.isReady || parsed.status === 'ready' || parsed.clientState === 'connected',
              gatewayUrl: GATEWAY_URL,
              clientInfo: parsed.clientInfo || null,
              clientState: parsed.clientState || parsed.status || 'unknown',
              hasQr: Boolean(parsed.hasQr),
              qrDataUrl: parsed.qrDataUrl || null,
              raw: parsed
            });
          } catch (e) {
            resolve({ online: false, gatewayUrl: GATEWAY_URL, error: 'Non-JSON gateway response' });
          }
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ online: false, gatewayUrl: GATEWAY_URL, error: 'Connection timeout (4s)' });
      });
      req.on('error', (err) => {
        resolve({ online: false, gatewayUrl: GATEWAY_URL, error: err.message });
      });
    } catch (err) {
      resolve({ online: false, gatewayUrl: GATEWAY_URL, error: err.message });
    }
  });
}

export async function restartGatewayClient() {
  return postJson(`${GATEWAY_URL}/restart`, {});
}

export async function logoutGatewayClient() {
  return postJson(`${GATEWAY_URL}/logout`, {});
}

/**
 * Core WhatsApp message sender with auto-retry & SQLite logging
 */
export async function sendWhatsAppMessage(phone, message, meta = {}) {
  // Selalu ikuti data nomor WhatsApp resmi dari ID karyawan jika recipientId tersedia
  let targetPhone = phone;
  let targetName = meta.recipientName || 'Karyawan';
  let targetEmp = null;

  if (meta.recipientId) {
    targetEmp = getEmployeeByIdentifier(meta.recipientId);
    if (targetEmp) {
      if (targetEmp.phone) targetPhone = targetEmp.phone;
      if (targetEmp.name) targetName = targetEmp.name;
    }
  }

  const normPhone = normalizePhone(targetPhone);
  if (!normPhone) {
    const err = `Nomor telepon tidak valid: ${targetPhone}`;
    console.warn(`[WA Gateway] ${err}`);
    return { success: false, error: err };
  }

  const logEntry = {
    recipientId: meta.recipientId || (targetEmp ? targetEmp.id : null),
    recipientName: targetName,
    recipientPhone: normPhone,
    eventType: meta.eventType || 'GENERAL_NOTIFICATION',
    title: meta.title || 'Notifikasi PRIME HRIS',
    message: String(message).trim(),
    metadata: meta,
    sentAt: new Date().toISOString()
  };

  // Seluruh ID karyawan terdaftar di sistem HRIS dianggap TERVERIFIKASI secara otomatis
  const isOptedIn = meta.force || Boolean(targetEmp) || isWaOptedIn(normPhone);
  if (!isOptedIn) {
    const errMsg = `Penerima (+${normPhone} - ${targetName}) belum terdaftar di database HRIS atau belum pernah mengetik pesan ke bot WhatsApp.`;
    console.warn(`[WA Gateway Opt-In Gate] 🚫 ${errMsg}`);

    logEntry.status = 'OPT_IN_REQUIRED';
    logEntry.errorMsg = errMsg;
    saveWaNotificationLog(logEntry);

    return {
      success: false,
      optInRequired: true,
      error: errMsg,
      phone: normPhone
    };
  }

  try {
    const primaryRes = await postJson(`${GATEWAY_URL}/send`, {
      phone: normPhone,
      message: logEntry.message,
      force: Boolean(meta.force)
    }).catch(err => ({ ok: false, error: err.message }));

    if (primaryRes.ok) {
      logEntry.status = 'SENT';
      logEntry.errorMsg = null;
      saveWaNotificationLog(logEntry);
      console.log(`[WA Gateway] ✅ Sent via dedicated system gateway (${GATEWAY_URL}) to ${normPhone} (${logEntry.recipientName}) - [${logEntry.eventType}]`);
      return { success: true, via: `baileys_${GATEWAY_URL}`, phone: normPhone };
    }

    // Strictly isolated: NO fallback to VPS. Only use dedicated system gateway.
    logEntry.status = 'FAILED';
    logEntry.errorMsg = primaryRes.error || 'WhatsApp gateway sistem belum terhubung atau QR code belum di-scan';
    saveWaNotificationLog(logEntry);
    console.warn(`[WA Gateway] ⚠️ Pesan tidak dikirim ke ${normPhone}: Gateway sistem (${GATEWAY_URL}) offline / belum di-scan QR.`);
    return { success: false, error: logEntry.errorMsg };
  } catch (err) {
    logEntry.status = 'FAILED';
    logEntry.errorMsg = err.message;
    saveWaNotificationLog(logEntry);
    console.error(`[WA Gateway] ❌ Exception sending to ${normPhone}:`, err);
    return { success: false, error: err.message };
  }
}

// =============================================================================
// DOMAIN-SPECIFIC NOTIFICATION DISPATCHERS
// =============================================================================

/**
 * 1. Notification: Clock-in Successful (Tepat Waktu / WFO / Dinas Luar)
 */
export async function notifyAttendanceSuccess(employee, record) {
  if (!employee || !employee.phone) return null;

  const isCheckOut = record.attendanceType === 'CHECK_OUT' || (record.checkOutTime && !record.checkInTime);
  const timeStr = isCheckOut ? (record.checkOutTime || record.checkInTime || '17:00:00') : (record.checkInTime || '08:00:00');
  const typeLabel = isCheckOut ? 'Absen Pulang (Check-Out)' : 'Absen Masuk (Check-In)';
  const timeLabel = isCheckOut ? 'Waktu Pulang' : 'Waktu Masuk';
  const dateStr = record.date || new Date().toISOString().substring(0, 10);
  const modeStr = record.mode === 'DINAS_LUAR' ? 'Dinas Luar Lapangan' : 'Work From Office (WFO)';
  const locationStr = record.location?.address || 'Kantor Pusat & Site Proyek PRIME';
  const bioScore = record.biometricVerification?.matchScore
    ? `Biometrik Wajah Valid (${record.biometricVerification.matchScore}%)`
    : 'Presensi Kamera Digital Valid';

  const msg = 
`✅ *KONFIRMASI PRESENSI RESMI - PRIME HRIS*
Halo *${employee.name}* (ID: ${employee.loginId || (employee.id === "EMP-001" ? "admin" : employee.id)}),

Presensi kehadiran Anda (*${typeLabel}*) telah berhasil dicatat ke sistem:
📅 *Tanggal:* ${dateStr}
⏰ *${timeLabel}:* ${timeStr} WIB
📍 *Mode:* ${modeStr}
🏢 *Site / Lokasi:* ${locationStr}
📸 *Verifikasi:* ${bioScore}

Terima kasih atas kedisiplinan Anda. ${isCheckOut ? 'Hati-hati di jalan dan selamat beristirahat!' : 'Semangat beraktivitas hari ini!'}

_Sistem HRIS Otomatis PT Prime Infinity Systems_
🌐 https://hris.primeprojectx.net`;

  return sendWhatsAppMessage(employee.phone, msg, {
    recipientId: employee.id,
    recipientName: employee.name,
    eventType: 'ATTENDANCE_SUCCESS',
    title: isCheckOut ? 'Konfirmasi Presensi Pulang Berhasil' : 'Konfirmasi Presensi Masuk Berhasil',
    attendanceId: record.id
  });
}

/**
 * 2. Notification: Late Clock-in Alert & Justification Form Prompt
 */
export async function notifyAttendanceLate(employee, record, salaryRules = null, projectSchedule = null) {
  if (!employee || !employee.phone) return null;

  const sched = projectSchedule || getEmployeeProjectSchedule(employee, salaryRules);
  const timeStr = record.checkInTime || '08:45:00';
  const cutoffStr = sched.cutoffTime || salaryRules?.cutoffTime || '08:30';
  const lateMins = record.lateMinutes || 15;
  const dateStr = record.date || new Date().toISOString().substring(0, 10);
  const projectName = sched.projectName ? (sched.projectName + ' (' + sched.projectCode + ')') : 'Site Operasional PRIME';

  const msg = 
'⚠️ *PEMBERITAHUAN KETERLAMBATAN KERJA - PRIME HRIS*\n' +
'Halo *' + employee.name + '* (' + employee.id + '),\n\n' +
'Sistem mencatat presensi masuk Anda melebihi batas cutoff jadwal proyek:\n' +
'📅 *Tanggal:* ' + dateStr + '\n' +
'🏢 *Proyek Penugasan:* ' + projectName + '\n' +
'⏰ *Shift Kerja Proyek:* ' + sched.checkInTime + ' - ' + sched.checkOutTime + ' WIB\n' +
'⏰ *Waktu Check-In:* ' + timeStr + ' WIB (Cutoff Proyek: ' + cutoffStr + ' WIB)\n' +
'⏳ *Keterlambatan:* *' + lateMins + ' Menit*\n' +
'📉 *Status:* Terlambat Masuk Shift\n\n' +
'📌 *Tindakan Diperlukan:*\n' +
'Jika keterlambatan disebabkan kendala lalu lintas darurat, tugas operasional mendadak di lapangan, atau kerusakan armada, Anda berhak mengajukan *Formulir Justifikasi Keterlambatan* pada menu Pengajuan:\n' +
'🌐 https://hris.primeprojectx.net\n\n' +
'Pengajuan yang disetujui Project Manager / HR Manager akan membebaskan Anda dari pemotongan tunjangan kedisiplinan.\n\n' +
'_HR & Operational Control PT Prime Infinity Systems_';

  return sendWhatsAppMessage(employee.phone, msg, {
    recipientId: employee.id,
    recipientName: employee.name,
    eventType: 'ATTENDANCE_LATE',
    title: 'Peringatan Keterlambatan (' + lateMins + ' Menit) - ' + sched.projectCode,
    attendanceId: record.id,
    lateMinutes: lateMins
  });
}

/**
 * 3. Notification: Morning Shift Clock-In Reminder
 */
export async function notifyMorningReminder(employee, projectScheduleOrRules = null, dateStr = null) {
  if (!employee || !employee.phone) return null;

  const sched = projectScheduleOrRules && projectScheduleOrRules.checkInTime && projectScheduleOrRules.cutoffTime
    ? projectScheduleOrRules
    : getEmployeeProjectSchedule(employee, projectScheduleOrRules);

  const todayStr = dateStr || new Date().toISOString().substring(0, 10);
  const cutoffStr = sched.cutoffTime || '08:30';
  const projectName = sched.projectName ? (sched.projectName + ' (' + sched.projectCode + ')') : 'Site Penugasan Proyek';

  const msg = 
'🌅 *PENGINGAT PRESENSI PAGI - PRIME HRIS*\n' +
'Selamat pagi, *' + employee.name + '* (' + employee.id + ')!\n\n' +
'Mengingatkan untuk segera melakukan presensi kehadiran hari ini:\n' +
'📅 *Tanggal:* ' + todayStr + '\n' +
'🏢 *Proyek Penugasan:* ' + projectName + '\n' +
'⏰ *Shift Kerja Proyek:* ' + sched.checkInTime + ' - ' + sched.checkOutTime + ' WIB\n' +
'⏳ *Batas Cutoff Masuk:* *' + cutoffStr + ' WIB* (Toleransi: ' + sched.lateGraceMinutes + ' menit)\n' +
'📍 *Portal Presensi:* https://hris.primeprojectx.net\n\n' +
'Pastikan GPS perangkat Anda aktif dan Anda telah berada di dalam geofence site penugasan. Selamat bekerja dan semoga hari Anda produktif!\n\n' +
'_Departemen Sumber Daya Manusia PT Prime Infinity Systems_';

  return sendWhatsAppMessage(employee.phone, msg, {
    recipientId: employee.id,
    recipientName: employee.name,
    eventType: 'MORNING_REMINDER',
    title: 'Pengingat Presensi Pagi - ' + sched.projectCode,
    date: todayStr
  });
}

/**
 * 4. Notification: Urgent Warning - Approaching Cutoff & Not Clocked In Yet
 */
export async function notifyApproachingCutoff(employee, projectScheduleOrCutoff = null, dateStr = null) {
  if (!employee || !employee.phone) return null;

  const sched = typeof projectScheduleOrCutoff === 'object' && projectScheduleOrCutoff !== null
    ? projectScheduleOrCutoff
    : getEmployeeProjectSchedule(employee);

  const todayStr = dateStr || new Date().toISOString().substring(0, 10);
  const nowWib = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\./g, ':');
  const cutoffStr = sched.cutoffTime || (typeof projectScheduleOrCutoff === 'string' ? projectScheduleOrCutoff : '08:30');
  const projectName = sched.projectName ? (sched.projectName + ' (' + sched.projectCode + ')') : 'Site Penugasan Proyek';

  const msg = 
'⏰ *PERINGATAN: ANDA BELUM MELAKUKAN PRESENSI HARI INI!*\n' +
'Halo *' + employee.name + '* (' + employee.id + '),\n\n' +
'Hingga pukul *' + nowWib + ' WIB*, sistem mencatat Anda *BELUM* melakukan check-in presensi masuk hari ini (' + todayStr + ').\n\n' +
'🏢 *Proyek Penugasan:* ' + projectName + '\n' +
'⏰ *Shift Kerja Proyek:* ' + sched.checkInTime + ' - ' + sched.checkOutTime + ' WIB\n' +
'⚠️ *Batas toleransi cutoff jadwal proyek Anda adalah pukul ' + cutoffStr + ' WIB.*\n\n' +
'Segera buka portal presensi kamera sebelum terhitung terlambat atau mangkir (Alpha):\n' +
'🌐 https://hris.primeprojectx.net\n\n' +
'_Abaikan pesan ini jika Anda sedang dalam status Cuti Tahunan / Izin Sakit yang telah disetujui HRD._\n\n' +
'_Manajemen Operasional PT Prime Infinity Systems_';

  return sendWhatsAppMessage(employee.phone, msg, {
    recipientId: employee.id,
    recipientName: employee.name,
    eventType: 'CUTOFF_WARNING',
    title: 'Peringatan Belum Presensi Masuk - ' + sched.projectCode,
    date: todayStr
  });
}

/**
 * 5. Notification: Leave / Attendance Correction Request Submitted
 */
export async function notifyApprovalSubmitted(approvalItem, employee, targetApprover = null) {
  if (!employee) return null;

  const typeLabels = {
    OUT_OF_GEOFENCE: '📍 Persetujuan Presensi Luar Radius',
    LATE_JUSTIFICATION: '⏰ Justifikasi Keterlambatan',
    DINAS_LUAR: '🚗 Persetujuan Dinas Luar Mendadak',
    ATTENDANCE_CORRECTION: '📝 Koreksi Absensi Mandiri',
    LEAVE: '🌴 Pengajuan Cuti',
    PERMIT: '📄 Pengajuan Izin'
  };
  const typeDisplay = typeLabels[approvalItem.type] || approvalItem.type;

  // Notice to Applicant
  if (employee.phone) {
    const applicantMsg = 
`📋 *PENGAJUAN BERHASIL DISERAHKAN - PRIME HRIS*
Halo *${employee.name}*,

Permohonan Anda telah berhasil terdaftar ke sistem:
🆔 *ID Permohonan:* ${approvalItem.id}
📌 *Tipe:* ${typeDisplay}
📝 *Judul:* ${approvalItem.title}
⏳ *Durasi / Waktu:* ${approvalItem.startDate} ${approvalItem.endDate && approvalItem.endDate !== approvalItem.startDate ? 's/d ' + approvalItem.endDate : ''}
👤 *Approver Tujuan:* ${approvalItem.targetApproverRole || 'Project Manager / HR'}

Mohon menunggu proses review dan persetujuan dari pimpinan terkait.
Pantau status di: https://hris.primeprojectx.net`;

    sendWhatsAppMessage(employee.phone, applicantMsg, {
      recipientId: employee.id,
      recipientName: employee.name,
      eventType: 'APPROVAL_SUBMITTED_APPLICANT',
      title: `Pengajuan ${typeDisplay} Terkirim`,
      approvalId: approvalItem.id
    }).catch(() => {});
  }

  // Notice to Approver (if known)
  if (targetApprover && targetApprover.phone) {
    const approverMsg = 
`🔔 *PERMOHONAN BUTUH PERSETUJUAN ANDA - PRIME HRIS*
Halo *${targetApprover.name}*,

Terdapat permohonan baru dari staf membutuhkan review dan persetujuan Anda:
👤 *Pemohon:* ${employee.name} (${employee.id} • ${employee.position || 'Staff'})
📌 *Tipe:* ${typeDisplay}
📝 *Keterangan:* ${approvalItem.title} - ${approvalItem.description || '-'}
📅 *Tanggal:* ${approvalItem.startDate}

Silakan buka Portal Approval untuk menyetujui atau menolak permohonan:
🌐 https://hris.primeprojectx.net

_Sistem Notifikasi PRIME HRIS Enterprise_`;

    sendWhatsAppMessage(targetApprover.phone, approverMsg, {
      recipientId: targetApprover.id,
      recipientName: targetApprover.name,
      eventType: 'APPROVAL_PENDING_ACTION',
      title: `Permohonan Baru dari ${employee.name}`,
      approvalId: approvalItem.id
    }).catch(() => {});
  }
}

/**
 * 6. Notification: Leave / Correction Request Decision (Approved / Rejected / Revision)
 */
export async function notifyApprovalDecision(approvalItem, employee) {
  if (!employee || !employee.phone) return null;

  const statusIcons = {
    APPROVED: '✅ *DISETUJUI (APPROVED)*',
    REJECTED: '❌ *DITOLAK (REJECTED)*',
    REVISION_REQUESTED: '⚠️ *PERMINTAAN REVISI (REVISION REQUIRED)*'
  };

  const statusBadge = statusIcons[approvalItem.status] || ('*' + approvalItem.status + '*');
  const title = approvalItem.title || approvalItem.type || 'Permohonan Kepegawaian';
  const reviewer = approvalItem.reviewedBy || 'Direksi / HR Lead';
  const note = approvalItem.reviewNote || (approvalItem.status === 'APPROVED' ? 'Disetujui.' : (approvalItem.status === 'REVISION_REQUESTED' ? 'Mohon melengkapi berkas pendukung.' : 'Ditolak.'));

  const msg = 
'📢 *UPDATE STATUS PERMOHONAN - PRIME HRIS*\n' +
'Halo *' + employee.name + '*,\n\n' +
'Permohonan Anda telah selesai ditinjau oleh pimpinan:\n' +
'📌 *Judul:* ' + title + '\n' +
'📊 *Status Hasil:* ' + statusBadge + '\n' +
'👤 *Ditinjau Oleh:* ' + reviewer + '\n' +
'💬 *Catatan Review:* "' + note + '"\n\n' +
'Detail lengkap dapat dilihat pada Portal Kinerja & Approval:\n' +
'🌐 https://hris.primeprojectx.net\n\n' +
'_Departemen HRD PT Prime Infinity Systems_';

  return sendWhatsAppMessage(employee.phone, msg, {
    recipientId: employee.id,
    recipientName: employee.name,
    eventType: 'APPROVAL_' + approvalItem.status,
    title: 'Keputusan Permohonan: ' + approvalItem.status,
    approvalId: approvalItem.id
  });
}

// =============================================================================
// AUTOMATED BACKGROUND REMINDER SCHEDULER
// =============================================================================

let isSchedulerRunning = false;
let schedulerInterval = null;

export function startWaBackgroundScheduler() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  console.log('[WA Scheduler] 🕒 WhatsApp Baileys background reminder scheduler started (checking every 60s)...');

  // Check every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      await evaluateScheduledReminders();
    } catch (err) {
      console.error('[WA Scheduler Error]', err);
    }
  }, 60000);
}

export function stopWaBackgroundScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
  console.log('[WA Scheduler] WhatsApp background scheduler stopped.');
}

async function evaluateScheduledReminders() {
  const now = new Date();
  
  // Format WIB time string (HH:MM)
  const nowWib = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/\./g, ':');

  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' });

  // Skip Sunday unless weekend work is active
  if (dayOfWeek === 'Sun') return;

  const db = getDatabase();
  
  // Get Salary Rules / WA Config
  let rulesConfig = null;
  try {
    const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default';").get();
    if (rulesRow) rulesConfig = JSON.parse(rulesRow.config_json);
  } catch (e) {}

  const waConfig = rulesConfig?.waConfig || rulesConfig?.whatsappConfig || {
    enabled: true,
    notifyMorningReminder: true,
    notifyApproachingCutoff: true,
    approachingCutoffMinutesBefore: 15
  };

  if (waConfig.enabled === false) return;

  const employees = db.prepare("SELECT id, name, nik, data_json FROM employees;").all().map(r => {
    try { return JSON.parse(r.data_json); } catch (e) { return r; }
  });

  const todayAttendances = db.prepare("SELECT employeeId FROM attendances WHERE date = ?;").all(todayStr).map(a => a.employeeId);
  const attendedSet = new Set(todayAttendances);

  // Check approved leaves today
  const approvedLeaves = db.prepare(
    "SELECT employeeId FROM approvals WHERE status = 'APPROVED' AND type = 'LEAVE' AND ? BETWEEN startDate AND endDate;"
  ).all(todayStr).map(l => l.employeeId);
  const leaveSet = new Set(approvedLeaves);

  // Helper to add or subtract minutes from an "HH:MM" string
  const addMins = (timeStr, mins) => {
    const parts = (timeStr || '08:00').split(':').map(Number);
    const total = (parts[0] || 0) * 60 + (parts[1] || 0) + mins;
    const nh = ((Math.floor(total / 60) % 24) + 24) % 24;
    const nm = ((total % 60) + 60) % 60;
    return String(nh).padStart(2, '0') + ':' + String(nm).padStart(2, '0');
  };

  for (const emp of employees) {
    if (emp.status === 'INACTIVE') continue;
    if (attendedSet.has(emp.id)) continue; // Already clocked in
    if (!emp.phone) continue;

    // Strictly resolve each employee's individual project schedule
    const sched = getEmployeeProjectSchedule(emp, rulesConfig);

    // 1. Morning Reminder: evaluated against the employee's project checkInTime (30 mins before project check-in)
    if (waConfig.notifyMorningReminder !== false) {
      const empMorningTarget = addMins(sched.checkInTime, -30);
      if (nowWib === empMorningTarget && !hasSentTodayWaReminder(emp.id, 'MORNING_REMINDER', todayStr)) {
        await notifyMorningReminder(emp, sched, todayStr);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    }

    // 2. Approaching Cutoff Warning: evaluated against the employee's project cutoffTime
    if (waConfig.notifyApproachingCutoff !== false) {
      if (leaveSet.has(emp.id)) continue; // Legitimate approved leave
      const warningMinutes = Number(waConfig.approachingCutoffMinutesBefore ?? 15);
      const empWarningTarget = addMins(sched.cutoffTime, -warningMinutes);
      if (nowWib === empWarningTarget && !hasSentTodayWaReminder(emp.id, 'CUTOFF_WARNING', todayStr)) {
        await notifyApproachingCutoff(emp, sched, todayStr);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

/**
 * Dispatch morning reminders to active employees without attendance today
 */
async function dispatchMorningReminders(todayStr, rulesConfig) {
  const db = getDatabase();
  const employees = db.prepare("SELECT id, name, nik, data_json FROM employees;").all().map(r => {
    try { return JSON.parse(r.data_json); } catch (e) { return r; }
  });

  const todayAttendances = db.prepare("SELECT employeeId FROM attendances WHERE date = ?;").all(todayStr).map(a => a.employeeId);
  const attendedSet = new Set(todayAttendances);

  for (const emp of employees) {
    if (emp.status === 'INACTIVE') continue;
    if (attendedSet.has(emp.id)) continue; // Already clocked in
    if (!emp.phone) continue;

    // Check if already sent today
    if (hasSentTodayWaReminder(emp.id, 'MORNING_REMINDER', todayStr)) continue;

    await notifyMorningReminder(emp, rulesConfig, todayStr);
    // Throttle to respect Baileys rate limiting
    await new Promise(r => setTimeout(r, 2500));
  }
}

/**
 * Dispatch warnings to active employees who STILL haven't clocked in as cutoff nears
 */
async function dispatchCutoffWarnings(todayStr, cutoffTime) {
  const db = getDatabase();
  const employees = db.prepare("SELECT id, name, nik, data_json FROM employees;").all().map(r => {
    try { return JSON.parse(r.data_json); } catch (e) { return r; }
  });

  const todayAttendances = db.prepare("SELECT employeeId FROM attendances WHERE date = ?;").all(todayStr).map(a => a.employeeId);
  const attendedSet = new Set(todayAttendances);

  // Check approved leaves today
  const approvedLeaves = db.prepare(`
    SELECT employeeId FROM approvals
    WHERE status = 'APPROVED' AND type = 'LEAVE' AND ? BETWEEN startDate AND endDate;
  `).all(todayStr).map(l => l.employeeId);
  const leaveSet = new Set(approvedLeaves);

  for (const emp of employees) {
    if (emp.status === 'INACTIVE') continue;
    if (attendedSet.has(emp.id)) continue;
    if (leaveSet.has(emp.id)) continue; // Legitimate approved leave
    if (!emp.phone) continue;

    if (hasSentTodayWaReminder(emp.id, 'CUTOFF_WARNING', todayStr)) continue;

    await notifyApproachingCutoff(emp, cutoffTime, todayStr);
    await new Promise(r => setTimeout(r, 2500));
  }
}

/**
 * Manual Instant Blast to all employees who haven't clocked in today
 */
export async function blastUnrecordedEmployees(targetDate = null) {
  const now = new Date();
  const todayStr = targetDate || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  const db = getDatabase();
  const employees = db.prepare("SELECT id, name, nik, data_json FROM employees;").all().map(r => {
    try { return JSON.parse(r.data_json); } catch (e) { return r; }
  });

  const todayAttendances = db.prepare("SELECT employeeId FROM attendances WHERE date = ?;").all(todayStr).map(a => a.employeeId);
  const attendedSet = new Set(todayAttendances);

  const targets = employees.filter(e => e.status !== 'INACTIVE' && !attendedSet.has(e.id) && Boolean(e.phone));

  let sentCount = 0;
  let failedCount = 0;
  const details = [];

  for (const emp of targets) {
    const res = await notifyApproachingCutoff(emp, '08:30', todayStr);
    if (res?.success) {
      sentCount++;
      details.push({ id: emp.id, name: emp.name, phone: emp.phone, status: 'SUCCESS' });
    } else {
      failedCount++;
      details.push({ id: emp.id, name: emp.name, phone: emp.phone, status: 'FAILED', error: res?.error });
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  return {
    targetDate: todayStr,
    totalTargeted: targets.length,
    sentCount,
    failedCount,
    details
  };
}


export function getWaOptInRegistry() {
  return getWaOptIns();
}
