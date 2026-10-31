import nodemailer from 'nodemailer';
import {
  saveEmailNotificationLog,
  getEmailNotificationLogs,
  hasSentTodayEmailReminder,
  getDatabase,
  getEmployeeProjectSchedule,
  getEmployeeByIdentifier
} from './db.js';

/**
 * Standardize and clean email configuration
 */
export function getSmtpConfig(customConfig = null) {
  const db = getDatabase();
  let dbRules = null;
  try {
    const row = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
    if (row) dbRules = JSON.parse(row.config_json);
  } catch (e) {}

  const dbSmtp = dbRules?.smtpConfig || {};

  const host = (customConfig?.host || dbSmtp.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(customConfig?.port || dbSmtp.port || process.env.SMTP_PORT || 465);
  const secure = customConfig?.secure !== undefined
    ? Boolean(customConfig.secure)
    : (dbSmtp.secure !== undefined ? Boolean(dbSmtp.secure) : (port === 465));

  const rawUser = (customConfig?.user || dbSmtp.user || process.env.SMTP_USER || '').trim();
  const rawPass = (customConfig?.pass || dbSmtp.pass || process.env.SMTP_PASS || '').trim();

  // Strip spaces from Gmail 16-character App Passwords (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  const cleanPass = rawPass.replace(/\s+/g, '');

  const fromName = (customConfig?.fromName || dbSmtp.fromName || process.env.SMTP_FROM_NAME || 'DMJ HRIS Enterprise').trim();
  const fromEmail = (customConfig?.fromEmail || dbSmtp.fromEmail || rawUser || process.env.SMTP_FROM_EMAIL || 'noreply@primeprojectx.net').trim();

  return {
    enabled: customConfig?.enabled !== undefined ? Boolean(customConfig.enabled) : Boolean(dbSmtp.enabled),
    host,
    port,
    secure,
    user: rawUser,
    pass: cleanPass,
    fromName,
    fromEmail,
    notifyAttendanceSuccess: customConfig?.notifyAttendanceSuccess !== undefined
      ? Boolean(customConfig.notifyAttendanceSuccess)
      : (dbSmtp.notifyAttendanceSuccess !== false),
    notifyAttendanceLate: customConfig?.notifyAttendanceLate !== undefined
      ? Boolean(customConfig.notifyAttendanceLate)
      : (dbSmtp.notifyAttendanceLate !== false),
    notifyApprovalSubmitted: customConfig?.notifyApprovalSubmitted !== undefined
      ? Boolean(customConfig.notifyApprovalSubmitted)
      : (dbSmtp.notifyApprovalSubmitted !== false),
    notifyApprovalUpdates: customConfig?.notifyApprovalUpdates !== undefined
      ? Boolean(customConfig.notifyApprovalUpdates)
      : (dbSmtp.notifyApprovalUpdates !== false),
    notifyMorningReminder: customConfig?.notifyMorningReminder !== undefined
      ? Boolean(customConfig.notifyMorningReminder)
      : Boolean(dbSmtp.notifyMorningReminder),
    morningReminderTime: customConfig?.morningReminderTime || dbSmtp.morningReminderTime || '07:30'
  };
}

/**
 * Create nodemailer transporter instance
 */
export function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Verify SMTP connection & authentication
 */
export async function verifySmtp(customConfig = null) {
  const config = getSmtpConfig(customConfig);
  if (!config.user || !config.pass) {
    return {
      success: false,
      error: 'Akun Gmail (user) dan App Password (16 digit) wajib diisi'
    };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return {
      success: true,
      message: `Koneksi SMTP ke ${config.host}:${config.port} (${config.user}) berhasil diverifikasi!`,
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        enabled: config.enabled
      }
    };
  } catch (err) {
    let msg = err.message || 'Gagal memverifikasi koneksi SMTP';
    if (msg.includes('535') || msg.includes('Username and Password not accepted') || msg.includes('BadCredentials')) {
      msg = 'Autentikasi Gmail ditolak (535): Pastikan menggunakan 16-digit App Password Gmail, bukan password akun Google biasa.';
    } else if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKETTIMEDOUT')) {
      msg = `Koneksi timeout ke ${config.host}:${config.port}. Periksa koneksi internet atau coba port alternatif (465 SSL vs 587 TLS).`;
    }
    return {
      success: false,
      error: msg
    };
  }
}

/**
 * Wrap HTML content inside executive responsive template
 */
function wrapHtmlEmailTemplate(contentHtml, title = 'Notifikasi DMJ HRIS') {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <!-- HEADER -->
    <tr>
      <td style="background: linear-gradient(135deg, #18345E 0%, #0d1e37 100%); padding: 24px 28px; border-bottom: 3px solid #FF6B00;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size: 10px; font-weight: 800; color: #FF8533; letter-spacing: 1.5px; text-transform: uppercase;">DMJ HRIS ENTERPRISE</div>
              <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 4px;">PT Prime Infinity Systems</div>
            </td>
            <td align="right">
              <span style="display: inline-block; background: rgba(255,255,255,0.12); color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);">Official Notice</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="padding: 28px; color: #1e293b; font-size: 14px; line-height: 1.6;">
        ${contentHtml}
      </td>
    </tr>

    <!-- ACTION BUTTON / PORTAL LINK -->
    <tr>
      <td style="padding: 0 28px 24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 14px;">
          <tr>
            <td style="font-size: 12px; color: #64748b;">
              Akses portal presensi, modul cuti & slip gaji melalui tautan resmi:
            </td>
            <td align="right">
              <a href="https://hris.primeprojectx.net" style="display: inline-block; background-color: #18345E; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 8px 16px; border-radius: 8px; border: 1px solid #0d1e37;">
                Buka HRIS Portal &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
        <p style="margin: 0 0 6px 0;">Notifikasi ini dikirimkan secara otomatis oleh sistem notifikasi server <strong>DMJ HRIS</strong>.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} PT Prime Infinity Systems &bull; <a href="https://hris.primeprojectx.net" style="color: #18345E; text-decoration: underline;">hris.primeprojectx.net</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Core Email Dispatcher with SQLite Logging
 */
export async function sendEmailNotification(options) {
  const {
    to,
    toName = '',
    subject,
    html,
    text = '',
    eventType = 'GENERAL_NOTIFICATION',
    recipientId = null,
    metadata = {},
    customConfig = null,
    bypassEnabledCheck = false
  } = options;

  // Selalu ikuti data email resmi dari ID karyawan jika recipientId tersedia
  let toEmail = to;
  let toRecipientName = toName;
  let targetEmp = null;
  if (recipientId) {
    targetEmp = getEmployeeByIdentifier(recipientId);
    if (targetEmp) {
      if (targetEmp.email) toEmail = targetEmp.email;
      if (targetEmp.name) toRecipientName = targetEmp.name;
    }
  }

  if (!toEmail || !toEmail.includes('@')) {
    const err = `Alamat email tidak valid: ${toEmail}`;
    console.warn(`[SMTP Service] ${err}`);
    return { success: false, error: err };
  }

  const config = getSmtpConfig(customConfig);

  if (!bypassEnabledCheck && !config.enabled) {
    return { success: false, skipped: true, error: 'Notifikasi SMTP Email sedang dinonaktifkan dalam pengaturan' };
  }

  if (!config.user || !config.pass) {
    const err = 'Konfigurasi SMTP belum lengkap (user/pass belum diatur)';
    console.warn(`[SMTP Service] ${err}`);
    return { success: false, error: err };
  }

  const logEntry = {
    recipientId,
    recipientName: toRecipientName || toEmail,
    recipientEmail: toEmail,
    eventType,
    subject: subject || 'Notifikasi DMJ HRIS',
    htmlBody: html,
    textBody: text,
    metadata,
    sentAt: new Date().toISOString()
  };

  try {
    const transporter = createTransporter(config);
    const fromAddress = config.fromEmail || config.user;
    const fromHeader = `"${config.fromName}" <${fromAddress}>`;
    const toHeader = toRecipientName ? `"${toRecipientName}" <${toEmail}>` : toEmail;

    const fullHtml = wrapHtmlEmailTemplate(html, subject);

    const info = await transporter.sendMail({
      from: fromHeader,
      to: toHeader,
      subject,
      text: text || subject,
      html: fullHtml
    });

    logEntry.status = 'SENT';
    logEntry.errorMsg = null;
    logEntry.metadata = { ...metadata, messageId: info.messageId, response: info.response };
    saveEmailNotificationLog(logEntry);

    console.log(`[SMTP Service] ✅ Email sent to ${to} (${logEntry.recipientName}) - [${eventType}]`);
    return { success: true, messageId: info.messageId, recipient: to };
  } catch (err) {
    logEntry.status = 'FAILED';
    logEntry.errorMsg = err.message || 'Unknown SMTP error';
    saveEmailNotificationLog(logEntry);

    console.error(`[SMTP Service] ❌ Failed sending email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// =============================================================================
// DOMAIN-SPECIFIC EMAIL NOTIFICATION DISPATCHERS
// =============================================================================

/**
 * 1. Notification: Attendance Success (Tepat Waktu / WFO / Dinas Luar)
 */
export async function notifyAttendanceSuccessEmail(employee, record) {
  if (!employee || !employee.email) return null;

  const timeStr = record.checkInTime || '08:00:00';
  const dateStr = record.date || new Date().toISOString().substring(0, 10);
  const modeStr = record.mode === 'DINAS_LUAR' ? 'Dinas Luar Lapangan' : (record.mode === 'WFH' ? 'Work From Home' : 'Work From Office (WFO)');
  const locationStr = record.location?.address || 'Kantor Pusat / Site Proyek PRIME';
  const bioScore = record.biometricVerification?.matchScore
    ? `Biometrik Wajah Valid (${record.biometricVerification.matchScore}%)`
    : 'Presensi Digital Terverifikasi';

  const subject = `[DMJ HRIS] Bukti Kehadiran Resmi - ${dateStr} - ${employee.name}`;

  const html = `
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #a7f3d0;">
        PRESENSI BERHASIL
      </span>
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">
        Konfirmasi Presensi Masuk
      </h2>
      <p style="margin: 0; color: #475569; font-size: 14px;">
        Halo <strong>${employee.name}</strong> (${employee.id}), presensi kehadiran Anda telah resmi tercatat ke dalam sistem database HRIS:
      </p>
    </div>

    <table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; margin-bottom: 20px;">
      <tr>
        <td width="35%" style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Tanggal Presensi</td>
        <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${dateStr}</td>
      </tr>
      <tr>
        <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Waktu Check-In</td>
        <td style="font-weight: 600; color: #047857; border-bottom: 1px solid #e2e8f0;">${timeStr} WIB</td>
      </tr>
      <tr>
        <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Mode Kerja</td>
        <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${modeStr}</td>
      </tr>
      <tr>
        <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Lokasi / Site</td>
        <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${locationStr}</td>
      </tr>
      <tr>
        <td style="color: #64748b;">Metode Verifikasi</td>
        <td style="font-weight: 600; color: #0f172a;">${bioScore}</td>
      </tr>
    </table>

    <p style="margin: 0; color: #475569; font-size: 13px;">
      Terima kasih atas kedisiplinan dan dedikasi Anda. Selamat menjalankan aktivitas kerja hari ini dengan optimal.
    </p>
  `;

  return sendEmailNotification({
    to: employee.email,
    toName: employee.name,
    subject,
    html,
    eventType: 'ATTENDANCE_SUCCESS',
    recipientId: employee.id,
    metadata: { attendanceId: record.id, date: dateStr, checkInTime: timeStr }
  });
}

/**
 * 2. Notification: Late Clock-in Warning & Justification Reminder
 */
export async function notifyAttendanceLateEmail(employee, record, salaryRules = null, projectSchedule = null) {
  if (!employee || !employee.email) return null;

  const sched = projectSchedule || getEmployeeProjectSchedule(employee, salaryRules);
  const timeStr = record.checkInTime || '08:45:00';
  const cutoffStr = sched.cutoffTime || salaryRules?.cutoffTime || '08:30';
  const lateMins = record.lateMinutes || 15;
  const dateStr = record.date || new Date().toISOString().substring(0, 10);
  const penaltyPerBlock = salaryRules?.latePenaltyPerBlock || 25000;
  const estimatedPenalty = Math.ceil(lateMins / 15) * penaltyPerBlock;
  const projectName = sched.projectName ? (sched.projectName + ' (' + sched.projectCode + ')') : 'Site Operasional PRIME';

  const subject = '[DMJ HRIS Peringatan] Keterlambatan Presensi (' + lateMins + ' Menit) - ' + sched.projectCode + ' - ' + dateStr + ' - ' + employee.name;

  const html = 
    '<div style="margin-bottom: 20px;">' +
      '<span style="display: inline-block; background-color: #fff1f2; color: #e11d48; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #fecdd3;">' +
        'PERINGATAN KETERLAMBATAN' +
      '</span>' +
      '<h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">' +
        'Pemberitahuan Presensi Melebihi Batas Cutoff Proyek' +
      '</h2>' +
      '<p style="margin: 0; color: #475569; font-size: 14px;">' +
        'Halo <strong>' + employee.name + '</strong> (' + employee.id + '), sistem mencatat waktu check-in Anda hari ini telah melewati batas cutoff untuk jadwal proyek Anda:' +
      '</p>' +
    '</div>' +

    '<table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #fffbeb; border-radius: 10px; border: 1px solid #fef3c7; font-size: 13px; margin-bottom: 20px;">' +
      '<tr>' +
        '<td width="35%" style="color: #92400e; border-bottom: 1px solid #fef3c7;">Tanggal</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #fef3c7;">' + dateStr + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #92400e; border-bottom: 1px solid #fef3c7;">Proyek Penugasan</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #fef3c7;">' + projectName + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #92400e; border-bottom: 1px solid #fef3c7;">Shift Kerja Proyek</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #fef3c7;">' + sched.checkInTime + ' - ' + sched.checkOutTime + ' WIB</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #92400e; border-bottom: 1px solid #fef3c7;">Waktu Check-In</td>' +
        '<td style="font-weight: 600; color: #b45309; border-bottom: 1px solid #fef3c7;">' + timeStr + ' WIB (Cutoff Proyek: ' + cutoffStr + ' WIB)</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #92400e; border-bottom: 1px solid #fef3c7;">Durasi Terlambat</td>' +
        '<td style="font-weight: 700; color: #b91c1c; border-bottom: 1px solid #fef3c7;">' + lateMins + ' Menit</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #92400e;">Estimasi Penalti Disiplin</td>' +
        '<td style="font-weight: 600; color: #b91c1c;">Rp ' + estimatedPenalty.toLocaleString('id-ID') + ' (sebelum justifikasi disetujui)</td>' +
      '</tr>' +
    '</table>' +

    '<div style="background-color: #f8fafc; border-left: 4px solid #FF6B00; padding: 14px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 13px; color: #334155;">' +
      '<strong>Petunjuk Justifikasi Keterlambatan:</strong><br>' +
      'Jika keterlambatan disebabkan oleh kendala operasional mendadak di lapangan, tugas dinas luar, atau gangguan lalu lintas luar biasa, Anda dapat mengajukan <em>Formulir Justifikasi Keterlambatan</em> melalui menu Pengajuan & Approval pada portal HRIS. Pengajuan yang disetujui oleh Project Manager atau HR akan menghapuskan penyesuaian potongan tunjangan kedisiplinan.' +
    '</div>';

  return sendEmailNotification({
    to: employee.email,
    toName: employee.name,
    subject,
    html,
    eventType: 'ATTENDANCE_LATE',
    recipientId: employee.id,
    metadata: { attendanceId: record.id, lateMinutes: lateMins, date: dateStr, projectId: sched.projectId }
  });
}


/**
 * 2b. Notification: Overdue Check-In Warning (After Cutoff Passed & Still Not Clocked In)
 */
export async function notifyOverdueCheckInEmail(employee, projectSchedule = null, dateStr = null) {
  if (!employee || !employee.email) return null;

  const sched = typeof projectSchedule === 'object' && projectSchedule !== null
    ? projectSchedule
    : getEmployeeProjectSchedule(employee);

  const todayStr = dateStr || new Date().toISOString().substring(0, 10);
  const cutoffStr = sched.cutoffTime || '08:30';
  const projectName = sched.projectName ? (sched.projectName + ' (' + sched.projectCode + ')') : 'Site Penugasan Proyek';

  const subject = '[DMJ HRIS Peringatan] Anda Belum Melakukan Presensi Masuk - ' + sched.projectCode + ' - ' + todayStr;

  const html = 
    '<div style="margin-bottom: 20px;">' +
      '<span style="display: inline-block; background-color: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #fecaca;">' +
        'PERINGATAN BELUM PRESENSI' +
      '</span>' +
      '<h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">' +
        'Batas Toleransi Presensi Masuk Telah Berakhir' +
      '</h2>' +
      '<p style="margin: 0; color: #475569; font-size: 14px;">' +
        'Halo <strong>' + employee.name + '</strong> (' + employee.id + '), sistem mencatat Anda belum melakukan presensi masuk hari ini untuk jadwal proyek penugasan Anda.' +
      '</p>' +
    '</div>' +

    '<table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #fff1f2; border-radius: 10px; border: 1px solid #fecdd3; font-size: 13px; margin-bottom: 20px;">' +
      '<tr>' +
        '<td width="35%" style="color: #9f1239; border-bottom: 1px solid #fecdd3;">Tanggal</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #fecdd3;">' + todayStr + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #9f1239; border-bottom: 1px solid #fecdd3;">Proyek Penugasan</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #fecdd3;">' + projectName + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #9f1239; border-bottom: 1px solid #fecdd3;">Shift Kerja Proyek</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #fecdd3;">' + sched.checkInTime + ' - ' + sched.checkOutTime + ' WIB</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #9f1239;">Batas Cutoff Masuk</td>' +
        '<td style="font-weight: 700; color: #dc2626;">' + cutoffStr + ' WIB</td>' +
      '</tr>' +
    '</table>' +

    '<p style="margin: 0 0 16px 0; color: #334155; font-size: 13px;">' +
      'Harap segera buka portal presensi untuk melakukan check-in dan mengisi form catatan alasan keterlambatan/dispensasi agar tidak tercatat mangkir (Alpha):<br>' +
      '<a href="https://hris.primeprojectx.net" style="color: #FF6B00; font-weight: 700; text-decoration: none;">https://hris.primeprojectx.net</a>' +
    '</p>';

  return sendEmailNotification({
    to: employee.email,
    toName: employee.name,
    subject,
    html,
    eventType: 'OVERDUE_CHECKIN_WARNING',
    recipientId: employee.id,
    metadata: { date: todayStr, projectId: sched.projectId }
  });
}

/**
 * 2c. Notification: Shift Check-Out Reminder (Belum Presensi Pulang)
 */
export async function notifyCheckOutReminderEmail(employee, projectSchedule = null, dateStr = null) {
  if (!employee || !employee.email) return null;

  const sched = typeof projectSchedule === 'object' && projectSchedule !== null
    ? projectSchedule
    : getEmployeeProjectSchedule(employee);

  const todayStr = dateStr || new Date().toISOString().substring(0, 10);
  const projectName = sched.projectName ? (sched.projectName + ' (' + sched.projectCode + ')') : 'Site Penugasan Proyek';

  const subject = '[DMJ HRIS Pengingat] Jangan Lupa Presensi Pulang (Check-Out) - ' + sched.projectCode + ' - ' + todayStr;

  const html = 
    '<div style="margin-bottom: 20px;">' +
      '<span style="display: inline-block; background-color: #f0fdf4; color: #15803d; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #bbf7d0;">' +
        'PENGINGAT PRESENSI PULANG' +
      '</span>' +
      '<h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">' +
        'Jam Shift Kerja Proyek Telah Berakhir' +
      '</h2>' +
      '<p style="margin: 0; color: #475569; font-size: 14px;">' +
        'Halo <strong>' + employee.name + '</strong> (' + employee.id + '), shift operasional proyek Anda telah berakhir pada pukul <strong>' + sched.checkOutTime + ' WIB</strong>.' +
      '</p>' +
    '</div>' +

    '<p style="margin: 0 0 16px 0; color: #334155; font-size: 13px;">' +
      'Sistem mencatat Anda belum melakukan presensi pulang (check-out) hari ini (' + todayStr + '). Silakan segera lakukan check-out melalui portal sebelum meninggalkan site/kantor:<br>' +
      '<a href="https://hris.primeprojectx.net" style="color: #FF6B00; font-weight: 700; text-decoration: none;">https://hris.primeprojectx.net</a>' +
    '</p>' +

    '<p style="margin: 0; color: #64748b; font-size: 12px;">' +
      'Terima kasih atas kedisiplinan dan kerja keras Anda hari ini. Selamat beristirahat dan hati-hati dalam perjalanan pulang!' +
    '</p>';

  return sendEmailNotification({
    to: employee.email,
    toName: employee.name,
    subject,
    html,
    eventType: 'CHECKOUT_REMINDER',
    recipientId: employee.id,
    metadata: { date: todayStr, projectId: sched.projectId }
  });
}

/**
 * 3. Notification: Approval Request Submitted (To Approver & Applicant Confirmation)
 */
export async function notifyApprovalSubmittedEmail(approvalItem, employee, targetApprover = null) {
  if (!employee) return null;

  // 1. Email confirmation to applicant
  if (employee.email) {
    const subjectApplicant = `[DMJ HRIS] Pengajuan ${approvalItem.type} Berhasil Diserahkan - ${approvalItem.id}`;
    const htmlApplicant = `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #cbd5e1;">
          PENGAJUAN TERSERAHKAN
        </span>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">
          Pengajuan Menunggu Persetujuan
        </h2>
        <p style="margin: 0; color: #475569; font-size: 14px;">
          Halo <strong>${employee.name}</strong>, permohonan Anda telah berhasil didaftarkan ke sistem dan saat ini sedang menunggu review atasan:
        </p>
      </div>

      <table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; margin-bottom: 20px;">
        <tr>
          <td width="35%" style="color: #64748b; border-bottom: 1px solid #e2e8f0;">ID Permohonan</td>
          <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${approvalItem.id}</td>
        </tr>
        <tr>
          <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Tipe Pengajuan</td>
          <td style="font-weight: 600; color: #18345E; border-bottom: 1px solid #e2e8f0;">${approvalItem.type}</td>
        </tr>
        <tr>
          <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Judul / Perihal</td>
          <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${approvalItem.title}</td>
        </tr>
        <tr>
          <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Periode Tanggal</td>
          <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${approvalItem.startDate} ${approvalItem.endDate && approvalItem.endDate !== approvalItem.startDate ? 's/d ' + approvalItem.endDate : ''}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Target Reviewer</td>
          <td style="font-weight: 600; color: #0f172a;">${approvalItem.targetApproverRole || 'Project Manager / HRD'}</td>
        </tr>
      </table>

      <p style="margin: 0; color: #64748b; font-size: 13px;">
        Anda akan menerima email notifikasi lanjutan segera setelah atasan memberikan keputusan review.
      </p>
    `;

    sendEmailNotification({
      to: employee.email,
      toName: employee.name,
      subject: subjectApplicant,
      html: htmlApplicant,
      eventType: 'APPROVAL_SUBMITTED_APPLICANT',
      recipientId: employee.id,
      metadata: { approvalId: approvalItem.id, type: approvalItem.type }
    }).catch(e => console.error('[SMTP Applicant Notice Error]', e));
  }

  // 2. Email alert to Approver
  if (targetApprover && targetApprover.email) {
    const subjectApprover = `[DMJ HRIS Action Required] Permohonan Baru: ${approvalItem.type} - ${employee.name}`;
    const htmlApprover = `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #bfdbfe;">
          BUTUH PERSETUJUAN
        </span>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">
          Permohonan Membutuhkan Review Anda
        </h2>
        <p style="margin: 0; color: #475569; font-size: 14px;">
          Halo <strong>${targetApprover.name}</strong>, staf Anda telah mengajukan permohonan yang memerlukan persetujuan:
        </p>
      </div>

      <table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; margin-bottom: 20px;">
        <tr>
          <td width="35%" style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Pemohon</td>
          <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${employee.name} (${employee.id} &bull; ${employee.position || 'Staff'})</td>
        </tr>
        <tr>
          <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Tipe Pengajuan</td>
          <td style="font-weight: 600; color: #18345E; border-bottom: 1px solid #e2e8f0;">${approvalItem.type}</td>
        </tr>
        <tr>
          <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Perihal & Alasan</td>
          <td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${approvalItem.title} - ${approvalItem.description || '-'}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Tanggal / Durasi</td>
          <td style="font-weight: 600; color: #0f172a;">${approvalItem.startDate} ${approvalItem.endDate && approvalItem.endDate !== approvalItem.startDate ? 's/d ' + approvalItem.endDate : ''}</td>
        </tr>
      </table>

      <p style="margin: 0 0 16px 0; color: #475569; font-size: 13px;">
        Silakan buka modul Approval pada portal DMJ HRIS untuk memberikan persetujuan atau catatan perbaikan.
      </p>
    `;

    return sendEmailNotification({
      to: targetApprover.email,
      toName: targetApprover.name,
      subject: subjectApprover,
      html: htmlApprover,
      eventType: 'APPROVAL_PENDING_ACTION',
      recipientId: targetApprover.id,
      metadata: { approvalId: approvalItem.id, applicantId: employee.id, type: approvalItem.type }
    });
  }

  return null;
}

/**
 * 4. Notification: Approval Decision (Approved / Rejected)
 */
export async function notifyApprovalDecisionEmail(approvalItem, employee) {
  if (!employee || !employee.email) return null;

  const isApproved = approvalItem.status === 'APPROVED';
  const isRevision = approvalItem.status === 'REVISION_REQUESTED';
  const statusColor = isApproved ? '#047857' : (isRevision ? '#b45309' : '#b91c1c');
  const statusBg = isApproved ? '#ecfdf5' : (isRevision ? '#fffbeb' : '#fff1f2');
  const statusBorder = isApproved ? '#a7f3d0' : (isRevision ? '#fde68a' : '#fecdd3');
  const statusLabel = isApproved ? 'DISETUJUI (APPROVED)' : (isRevision ? 'PERMINTAAN REVISI (REVISION REQUIRED)' : 'DITOLAK (REJECTED)');

  const title = approvalItem.title || approvalItem.type || 'Permohonan Kepegawaian';
  const subject = '[DMJ HRIS Update] Status Pengajuan ' + (approvalItem.type || 'Kepegawaian') + ': ' + approvalItem.status + ' - ' + approvalItem.id;
  const reviewer = approvalItem.reviewedBy || 'Direksi / HR Lead';
  const note = approvalItem.reviewNote || (isApproved ? 'Disetujui.' : (isRevision ? 'Mohon melengkapi berkas pendukung.' : 'Ditolak.'));

  const html = 
    '<div style="margin-bottom: 20px;">' +
      '<span style="display: inline-block; background-color: ' + statusBg + '; color: ' + statusColor + '; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid ' + statusBorder + ';">' +
        statusLabel +
      '</span>' +
      '<h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">' +
        'Hasil Keputusan Permohonan' +
      '</h2>' +
      '<p style="margin: 0; color: #475569; font-size: 14px;">' +
        'Halo <strong>' + employee.name + '</strong>, permohonan Anda telah selesai ditinjau oleh pimpinan terkait dengan rincian sebagai berikut:' +
      '</p>' +
    '</div>' +

    '<table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; margin-bottom: 20px;">' +
      '<tr>' +
        '<td width="35%" style="color: #64748b; border-bottom: 1px solid #e2e8f0;">ID Permohonan</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">' + approvalItem.id + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Tipe Pengajuan</td>' +
        '<td style="font-weight: 600; color: #18345E; border-bottom: 1px solid #e2e8f0;">' + (approvalItem.type || '-') + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Judul / Perihal</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">' + title + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Status Keputusan</td>' +
        '<td style="font-weight: 700; color: ' + statusColor + '; border-bottom: 1px solid #e2e8f0;">' + statusLabel + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Ditinjau Oleh</td>' +
        '<td style="font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">' + reviewer + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="color: #64748b;">Catatan Review / Alasan</td>' +
        '<td style="font-style: italic; color: #334155;">"' + note + '"</td>' +
      '</tr>' +
    '</table>' +

    '<p style="margin: 0; color: #64748b; font-size: 13px;">' +
      'Informasi lengkap dapat diakses melalui portal resmi DMJ HRIS:<br>' +
      '<a href="https://hris.primeprojectx.net" style="color: #FF6B00; text-decoration: none; font-weight: 600;">https://hris.primeprojectx.net</a>' +
    '</p>';

  return sendEmailNotification({
    to: employee.email,
    toName: employee.name,
    subject,
    html,
    eventType: 'APPROVAL_' + approvalItem.status,
    recipientId: employee.id,
    metadata: { approvalId: approvalItem.id, status: approvalItem.status, type: approvalItem.type }
  });
}

/**
 * 5. Test Email Dispatch
 */
export async function sendTestEmail(targetEmail, customConfig = null) {
  const subject = '[DMJ HRIS Test] Uji Coba Konfigurasi Email Gateway SMTP';
  const html = 
    '<div style="margin-bottom: 20px;">' +
      '<span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #a7f3d0;">' +
        'UJI COBA GATEWAY' +
      '</span>' +
      '<h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">' +
        'Tes Pengiriman Email Berhasil' +
      '</h2>' +
      '<p style="margin: 0; color: #475569; font-size: 14px;">' +
        'Halo! Email ini dikirimkan secara otomatis oleh <strong>DMJ HRIS Email Service</strong> untuk memvalidasi bahwa koneksi kredensial SMTP Gmail perusahaan Anda telah aktif, terhubung, dan siap mengirimkan notifikasi presensi, approval tiket, serta pengingat jam kerja.' +
      '</p>' +
    '</div>' +
    '<div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px 16px; font-size: 12px; color: #64748b; font-family: monospace;">' +
      'Status: SMTP_ONLINE • Gateway: Google Workspace SMTP • Waktu: ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' +
    '</div>';

  return sendEmailNotification({
    to: targetEmail,
    toName: 'HR / System Tester',
    subject,
    html,
    eventType: 'TEST_EMAIL',
    recipientId: 'TEST',
    customConfig,
    bypassEnabledCheck: true
  });
}

/**
 * 6. Blast Overdue Email Reminder to Unrecorded Employees
 */
export async function blastUnrecordedEmployeesEmail(targetDate = null) {
  const now = new Date();
  const todayStr = targetDate || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  const db = getDatabase();
  const employees = db.prepare("SELECT id, name, nik, data_json FROM employees;").all().map(r => {
    try { return JSON.parse(r.data_json); } catch (e) { return r; }
  });

  const todayAttendances = db.prepare("SELECT employeeId FROM attendances WHERE date = ?;").all(todayStr).map(a => a.employeeId);
  const attendedSet = new Set(todayAttendances);

  const targets = employees.filter(e => e.status !== 'INACTIVE' && !attendedSet.has(e.id) && Boolean(e.email));

  let sentCount = 0;
  let failedCount = 0;
  const details = [];

  for (const emp of targets) {
    try {
      const res = await notifyOverdueCheckInEmail(emp, null, todayStr);
      if (res?.success) {
        sentCount++;
        details.push({ id: emp.id, name: emp.name, email: emp.email, status: 'SUCCESS' });
      } else {
        failedCount++;
        details.push({ id: emp.id, name: emp.name, email: emp.email, status: 'FAILED', error: res?.error });
      }
    } catch (err) {
      failedCount++;
      details.push({ id: emp.id, name: emp.name, email: emp.email, status: 'FAILED', error: err.message });
    }
  }

  return {
    targetDate: todayStr,
    totalTargeted: targets.length,
    sentCount,
    failedCount,
    details
  };
}


