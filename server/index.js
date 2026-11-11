// Production Standalone Server for Prime HRIS SQLite API with RTC & Real-Time Sync
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import XLSX from 'xlsx';
import {
  getAllData,
  saveAttendance,
  updateApproval,
  saveApproval,
  saveEmployee,
  deleteEmployee,
  saveProject,
  saveSalaryRules,
  resetDatabase,
  getDbInfo,
  getDatabaseStats,
  vacuumDatabase,
  getAttendancesForExport,
  getEmployeesForExport,
  getProjectsForExport,
  importAttendancesBatch,
  authenticateUser,
  generateTemporaryPassword,
  getCurrentUserFromToken,
  generateToken,
  changeUserPassword,
  resetEmployeePassword,
  saveEmployeeBiometric,
  deleteEmployeeBiometric,
  listUserAccounts,
  verifyToken,
  addAuditLog,
  getAuditLogsPaginated,
  getPublicKioskEmployees,
  getEnrolledBiometricGallery,
  authenticateByBiometric,
  getWaNotificationLogs,
  getWaOptIns,
  toggleWaOptIn,
  bulkToggleWaOptIns,
  recordWaOptIn,
  getEmailNotificationLogs,
  getWorkCalendarConfig,
  saveWorkCalendarConfig,
  getDatabase,
  getCasualWorkers,
  saveCasualWorker,
  getCasualAttendances,
  saveCasualAttendance,
  deleteCasualAttendance,
  deleteAttendance,
  getAttendancePhoto,
  getAttendancePhotoOut,
  getEmployeeByIdentifier,
  getEmployeeProjectSchedule,
  updateUserProfile
} from './db.js';
import {
  getGatewayStatus,
  sendWhatsAppMessage,
  notifyAttendanceSuccess,
  notifyAttendanceLate,
  notifyApprovalSubmitted,
  notifyApprovalDecision,
  blastUnrecordedEmployees,
  blastUnrecordedCheckOut,
  notifyOverdueCheckIn,
  notifyCheckOutReminder,
  startWaBackgroundScheduler,
  restartGatewayClient,
  logoutGatewayClient
} from './whatsappService.js';
import {
  getSmtpConfig,
  verifySmtp,
  sendEmailNotification,
  notifyAttendanceSuccessEmail,
  notifyAttendanceLateEmail,
  notifyApprovalSubmittedEmail,
  notifyApprovalDecisionEmail,
  sendTestEmail,
  blastUnrecordedEmployeesEmail
} from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'data', 'hris.sqlite');
const distPath = path.join(projectRoot, 'dist');
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

export function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();
  const xReal = req.headers['x-real-ip'];
  if (xReal) return String(xReal).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// ==========================================
// REAL-TIME COMMUNICATION (WEBSOCKET & SSE ENGINE)
// ==========================================
const sseClients = new Set();
const wsClients = new Set();

function broadcastRealtimeEvent(type, payload) {
  const packetObj = {
    type,
    payload,
    serverTimeMs: Date.now(),
    serverTimestamp: new Date().toISOString()
  };
  const packetStr = JSON.stringify(packetObj);

  // 1. Broadcast to WebSocket Clients
  for (const client of wsClients) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(packetStr);
      }
    } catch (err) {
      wsClients.delete(client);
    }
  }

  // 2. Broadcast to SSE Clients
  const sseMessage = `event: message\ndata: ${packetStr}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(sseMessage);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Keep-alive heartbeat ping every 25 seconds for Cloudflare Tunnel / proxies / WS
setInterval(() => {
  // SSE Ping
  for (const client of sseClients) {
    try {
      client.write(':ping\n\n');
    } catch (err) {
      sseClients.delete(client);
    }
  }

  // WebSocket Heartbeat Ping
  const pingStr = JSON.stringify({ type: 'HEARTBEAT_PING', serverTimeMs: Date.now() });
  for (const client of wsClients) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(pingStr);
      }
    } catch (err) {
      wsClients.delete(client);
    }
  }
}, 25000);

// ==========================================
// WHATSAPP BAILEYS EVENT TRIGGER HOOKS
// ==========================================
async function triggerAttendanceWaNotification(attendanceRecord) {
  try {
    if (!attendanceRecord) return;
    const empId = attendanceRecord.employeeId || attendanceRecord.employeeNik;
    if (!empId) return;
    const emp = getEmployeeByIdentifier(empId);
    if (!emp || !emp.phone) return;

    const db = getDatabase();
    let salaryRules = null;
    try {
      const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
      if (rulesRow) salaryRules = JSON.parse(rulesRow.config_json);
    } catch (e) {}

    const waConfig = salaryRules?.waConfig || salaryRules?.whatsappConfig;
    if (waConfig && waConfig.enabled === false) return;

    // Resolve employee's project-specific schedule
    const projectSchedule = getEmployeeProjectSchedule(emp, salaryRules);

    const isCheckOut = attendanceRecord.attendanceType === 'CHECK_OUT';
    const isLate = !isCheckOut && (attendanceRecord.status === 'LATE' || (attendanceRecord.lateMinutes && attendanceRecord.lateMinutes > 0));
    if (isLate && (waConfig?.notifyAttendanceLate !== false)) {
      await notifyAttendanceLate(emp, attendanceRecord, salaryRules, projectSchedule);
    } else if (!isLate && (waConfig?.notifyAttendanceSuccess !== false)) {
      await notifyAttendanceSuccess(emp, attendanceRecord);
    }
  } catch (err) {
    console.error('[WA Trigger Attendance Error]', err);
  }
}

async function triggerApprovalSubmitWaNotification(approvalItem) {
  try {
    if (!approvalItem) return;
    const db = getDatabase();
    const emp = getEmployeeByIdentifier(approvalItem.employeeId || approvalItem.employeeNik);
    if (!emp) return;

    let targetApprover = null;
    const approverId = approvalItem.targetApproverId || approvalItem.projectManagerId;
    if (approverId) {
      targetApprover = getEmployeeByIdentifier(approverId);
    }

    if (!targetApprover && approvalItem.projectId) {
      try {
        const projRow = db.prepare("SELECT data_json FROM projects WHERE id = ?").get(approvalItem.projectId);
        if (projRow) {
          const proj = JSON.parse(projRow.data_json);
          if (proj.projectManagerId) {
            const pmRow = db.prepare("SELECT data_json FROM employees WHERE id = ?").get(proj.projectManagerId);
            if (pmRow) targetApprover = JSON.parse(pmRow.data_json);
          }
        }
      } catch (e) {}
    }

    if (!targetApprover) {
      try {
        const hrRow = db.prepare("SELECT data_json FROM employees WHERE role = 'hr' OR role = 'HR' OR position LIKE '%HR%' LIMIT 1").get();
        if (hrRow) targetApprover = JSON.parse(hrRow.data_json);
      } catch (e) {}
    }

    await notifyApprovalSubmitted(approvalItem, emp, targetApprover);
  } catch (err) {
    console.error('[WA Trigger Approval Submit Error]', err);
  }
}

async function triggerApprovalDecisionWaNotification(approvalId, status, reviewNote, reviewedBy) {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT data_json FROM approvals WHERE id = ?").get(approvalId);
    if (!row) return;
    const item = JSON.parse(row.data_json);
    if (!item) return;

    const emp = getEmployeeByIdentifier(item.employeeId || item.employeeNik);
    if (!emp || !emp.phone) return;

    let salaryRules = null;
    try {
      const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
      if (rulesRow) salaryRules = JSON.parse(rulesRow.config_json);
    } catch (e) {}

    const waConfig = salaryRules?.waConfig || salaryRules?.whatsappConfig;
    if (waConfig && (waConfig.enabled === false || waConfig.notifyApprovalUpdates === false)) return;

    const mergedItem = {
      ...item,
      status: status || item.status,
      reviewNote: reviewNote || item.reviewNote,
      reviewedBy: reviewedBy || item.reviewedBy
    };

    await notifyApprovalDecision(mergedItem, emp);
  } catch (err) {
    console.error('[WA Trigger Approval Decision Error]', err);
  }
}

// ==========================================
// EMAIL SMTP (GMAIL) EVENT TRIGGER HOOKS
// ==========================================
async function triggerAttendanceEmailNotification(attendanceRecord) {
  try {
    if (!attendanceRecord) return;
    const empId = attendanceRecord.employeeId || attendanceRecord.employeeNik;
    if (!empId) return;
    const emp = getEmployeeByIdentifier(empId);
    if (!emp || !emp.email) return;

    const db = getDatabase();
    let salaryRules = null;
    try {
      const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
      if (rulesRow) salaryRules = JSON.parse(rulesRow.config_json);
    } catch (e) {}

    const smtpConfig = salaryRules?.smtpConfig;
    if (!smtpConfig || smtpConfig.enabled === false) return;

    // Resolve employee's project-specific schedule
    const projectSchedule = getEmployeeProjectSchedule(emp, salaryRules);

    const isCheckOut = attendanceRecord.attendanceType === 'CHECK_OUT';
    const isLate = !isCheckOut && (attendanceRecord.status === 'LATE' || (attendanceRecord.lateMinutes && attendanceRecord.lateMinutes > 0));
    if (isLate && (smtpConfig.notifyAttendanceLate !== false)) {
      await notifyAttendanceLateEmail(emp, attendanceRecord, salaryRules, projectSchedule);
    } else if (!isLate && (smtpConfig.notifyAttendanceSuccess !== false)) {
      await notifyAttendanceSuccessEmail(emp, attendanceRecord);
    }
  } catch (err) {
    console.error('[Email Trigger Attendance Error]', err);
  }
}

async function triggerApprovalSubmitEmailNotification(approvalItem) {
  try {
    if (!approvalItem) return;
    const db = getDatabase();
    const emp = getEmployeeByIdentifier(approvalItem.employeeId || approvalItem.employeeNik);
    if (!emp) return;

    let targetApprover = null;
    const approverId = approvalItem.targetApproverId || approvalItem.projectManagerId;
    if (approverId) {
      targetApprover = getEmployeeByIdentifier(approverId);
    }

    if (!targetApprover && approvalItem.projectId) {
      try {
        const projRow = db.prepare("SELECT data_json FROM projects WHERE id = ?").get(approvalItem.projectId);
        if (projRow) {
          const proj = JSON.parse(projRow.data_json);
          if (proj.projectManagerId) {
            const pmRow = db.prepare("SELECT data_json FROM employees WHERE id = ?").get(proj.projectManagerId);
            if (pmRow) targetApprover = JSON.parse(pmRow.data_json);
          }
        }
      } catch (e) {}
    }

    if (!targetApprover) {
      try {
        const hrRow = db.prepare("SELECT data_json FROM employees WHERE role = 'hr' OR role = 'HR' OR position LIKE '%HR%' LIMIT 1").get();
        if (hrRow) targetApprover = JSON.parse(hrRow.data_json);
      } catch (e) {}
    }

    let salaryRules = null;
    try {
      const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
      if (rulesRow) salaryRules = JSON.parse(rulesRow.config_json);
    } catch (e) {}

    const smtpConfig = salaryRules?.smtpConfig;
    if (!smtpConfig || smtpConfig.enabled === false) return;

    await notifyApprovalSubmittedEmail(approvalItem, emp, targetApprover);
  } catch (err) {
    console.error('[Email Trigger Approval Submit Error]', err);
  }
}

async function triggerApprovalDecisionEmailNotification(approvalId, status, reviewNote, reviewedBy) {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT data_json FROM approvals WHERE id = ?").get(approvalId);
    if (!row) return;
    const item = JSON.parse(row.data_json);
    if (!item) return;

    const emp = getEmployeeByIdentifier(item.employeeId || item.employeeNik);
    if (!emp || !emp.email) return;

    let salaryRules = null;
    try {
      const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
      if (rulesRow) salaryRules = JSON.parse(rulesRow.config_json);
    } catch (e) {}

    const smtpConfig = salaryRules?.smtpConfig;
    if (!smtpConfig || smtpConfig.enabled === false) return;
    if (smtpConfig.notifyApprovalUpdates === false) return;

    const mergedItem = {
      ...item,
      status: status || item.status,
      reviewNote: reviewNote || item.reviewNote,
      reviewedBy: reviewedBy || item.reviewedBy
    };

    await notifyApprovalDecisionEmail(mergedItem, emp);
  } catch (err) {
    console.error('[Email Trigger Approval Decision Error]', err);
  }
}

// ==========================================
// BACKGROUND BIOMETRIC FACE VERIFICATION ENGINE
// Asynchronous face scanning against Central VPS Face Engine (YuNet + SFace)
// Ensures zero latency/blocking on attendance submission.
// ==========================================
async function triggerBiometricBackgroundScan(attendanceRecord) {
  try {
    if (!attendanceRecord || !attendanceRecord.id) return;
    const photo = attendanceRecord.photoUrl || attendanceRecord.photoOutUrl || attendanceRecord.checkInPhotoUrl;
    if (!photo || typeof photo !== 'string' || !photo.startsWith('data:image/')) return;

    // Verify employee has actually registered biometric samples before running background scan
    const db = getDatabase();
    const empRow = db.prepare('SELECT data_json FROM employees WHERE id = ? OR nik = ?;').get(attendanceRecord.employeeId || '', attendanceRecord.employeeNik || '');
    let empHasBio = false;
    if (empRow && empRow.data_json) {
      try {
        const empData = JSON.parse(empRow.data_json);
        empHasBio = Boolean(empData.biometric?.isEnrolled || empData.hasBiometric || (empData.biometric?.samples && (empData.biometric.samples.front || empData.biometric.samples.smile)));
      } catch (e) {}
    }

    if (!empHasBio) {
      // Employee has not registered face biometrics: do not run verification or assign false mismatch
      return;
    }

    const resp = await fetch('http://103.31.205.218:8599/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: photo }),
      signal: AbortSignal.timeout(6000)
    }).then(r => r.json()).catch(() => null);

    let bioResult = null;
    if (resp) {
      if (resp.status === 'NO_FACE') {
        bioResult = {
          isVerified: false,
          matchScore: 0,
          livenessPassed: false,
          details: 'Wajah tidak terdeteksi pada foto presensi (kamera tertutup/gelap)'
        };
      } else if (resp.status === 'OCCLUDED') {
        bioResult = {
          isVerified: false,
          matchScore: 30,
          livenessPassed: false,
          details: resp.message || 'Wajah terhalang tangan/masker/objek'
        };
      } else if (resp.matched && resp.employeeId) {
        const isSame = resp.employeeId === attendanceRecord.employeeId;
        const actualScore = resp.score !== undefined ? resp.score : 0;
        bioResult = {
          isVerified: isSame && actualScore >= 60,
          matchScore: isSame ? actualScore : 35,
          matchedPose: 'front',
          livenessPassed: true,
          details: isSame
            ? `Wajah terverifikasi cocok (${actualScore}%)`
            : `Wajah terdeteksi milik karyawan lain (${resp.employeeName || resp.employeeId})`
        };
      } else if (resp.score !== undefined) {
        const passed = resp.score >= 60;
        bioResult = {
          isVerified: passed,
          matchScore: resp.score,
          matchedPose: 'front',
          livenessPassed: true,
          details: passed
            ? `Wajah terverifikasi (${resp.score}%)`
            : `Tingkat kemiripan wajah rendah (${resp.score}% < 60%)`
        };
      }
    }

    if (bioResult) {
      const db = getDatabase();
      const row = db.prepare('SELECT data_json, attendanceType FROM attendances WHERE id = ?;').get(attendanceRecord.id);
      if (row && row.data_json) {
        const d = JSON.parse(row.data_json);
        d.biometricVerification = bioResult;
        if (attendanceRecord.attendanceType === 'CHECK_IN' || row.attendanceType === 'CHECK_IN') {
          d.checkInBiometric = bioResult;
        } else {
          d.checkOutBiometric = bioResult;
        }
        db.prepare('UPDATE attendances SET data_json = ? WHERE id = ?;').run(JSON.stringify(d), attendanceRecord.id);

        const updatedRecord = { ...attendanceRecord, biometricVerification: bioResult };
        broadcastRealtimeEvent('ATTENDANCE_SAVED', updatedRecord);
        console.log(`[BIOMETRIC BG SCAN] Record ${attendanceRecord.id} (${attendanceRecord.employeeName}) verified: ${bioResult.matchScore}% - ${bioResult.details}`);
      }
    }
  } catch (err) {
    console.error('[triggerBiometricBackgroundScan Error]', err);
  }
}

// ==========================================
// ENTERPRISE POLICY: ZERO PAYROLL / SLIP BROADCAST VIA WHATSAPP & EMAIL
// Under direct executive instruction of Mr Prime, salary slip (slip gaji)
// notifications MUST NEVER be dispatched via WhatsApp or Email.
// ==========================================

const server = http.createServer(async (req, res) => {
  const url = req.url || '';
  const cleanUrl = url.split('?')[0];
  const method = req.method?.toUpperCase() || 'GET';

  // Helper for JSON with Automatic GZIP Compression
  const sendJson = (status, data) => {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Vary': 'Accept-Encoding'
    };

    if (acceptEncoding.includes('gzip') && jsonStr.length > 1024) {
      try {
        const gzipped = zlib.gzipSync(Buffer.from(jsonStr));
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = gzipped.length;
        res.writeHead(status, headers);
        return res.end(gzipped);
      } catch (err) {
        // Fallback to uncompressed if gzip encounters an issue
      }
    }

    headers['Content-Length'] = Buffer.byteLength(jsonStr);
    res.writeHead(status, headers);
    res.end(jsonStr);
  };

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Parse JSON Body
  const readBody = () => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  };

  const getAuthToken = () => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      return parsedUrl.searchParams.get('token');
    } catch (e) {
      return null;
    }
  };

  // API Routes
  if (cleanUrl.startsWith('/api/')) {
    try {
      // 0. Auth Routes
      if (cleanUrl === '/api/auth/login' && method === 'POST') {
        const body = await readBody();
        const clientIp = req.headers['cf-connecting-ip'] || 
                         req.headers['x-real-ip'] || 
                         (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                         req.socket.remoteAddress || 
                         '127.0.0.1';
        const result = authenticateUser(body.identifier || body.username || body.email, body.password, clientIp);
        if (!result.success) {
          return sendJson(401, result);
        }
        return sendJson(200, result);
      }

      // 0-forgot. Forgot Password Notification Dispatcher (HP / Email / Username)
      if (cleanUrl === '/api/auth/forgot-password' && method === 'POST') {
        const body = await readBody();
        const identifier = body.identifier || body.username || body.email || body.phone;
        if (!identifier || !String(identifier).trim()) {
          return sendJson(400, { success: false, error: 'Nomor HP, Email, atau ID/Username wajib diisi' });
        }

        const resetRes = generateTemporaryPassword(identifier);
        if (!resetRes.success) {
          return sendJson(400, resetRes);
        }

        const { tempPassword, username, displayName, targetPhone, targetEmail, employeeId } = resetRes;

        const maskPhone = (p) => {
          if (!p) return null;
          const clean = String(p).trim();
          if (clean.length < 8) return clean;
          return clean.slice(0, 4) + '****' + clean.slice(-4);
        };

        const maskEmail = (em) => {
          if (!em || !em.includes('@')) return null;
          const [n, dom] = em.split('@');
          if (n.length <= 2) return `${n}***@${dom}`;
          return `${n.slice(0, 2)}***@${dom}`;
        };

        let waSent = false;
        let emailSent = false;
        let waError = null;
        let emailError = null;

        // 1. WhatsApp Notification
        if (targetPhone) {
          const waMessage = `*🔐 KATA SANDI SEMENTARA - PRIME HRIS*\n\nHalo *${displayName}*,\nPermintaan reset kata sandi akun PRIME HRIS Anda telah berhasil diproses.\n\nBerikut kredensial login sementara Anda:\n👤 *ID / Username:* \`${username}\`\n🔑 *Password Sementara:* \`${tempPassword}\`\n🌐 *Portal Login:* https://hris.primeprojectx.net\n\n⚠️ *Penting:* Demi keamanan data akun, segera ubah kata sandi ini setelah berhasil masuk.\n\n_Pesan otomatis • Security Gateway PRIME HRIS_`;
          try {
            const wRes = await sendWhatsAppMessage(targetPhone, waMessage, {
              recipientId: employeeId,
              recipientName: displayName,
              eventType: 'PASSWORD_RESET_NOTIFICATION',
              title: 'Reset Password Akun'
            });
            waSent = wRes?.success === true;
            if (!waSent) waError = wRes?.error;
          } catch (we) {
            waError = we.message;
          }
        }

        // 2. Email Notification
        if (targetEmail && targetEmail.includes('@')) {
          const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #1e3a8a; margin: 0 0 6px 0; font-size: 20px;">PRIME HRIS ENTERPRISE</h2>
                <p style="color: #64748b; font-size: 13px; margin: 0;">Sistem Manajemen SDM & Penggajian Terpadu</p>
              </div>

              <div style="background: #f8fafc; border-left: 4px solid #0066FF; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 15px;">Permintaan Pemulihan Kata Sandi</h3>
                <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5;">
                  Halo <strong>${displayName}</strong>, sistem telah menerbitkan kata sandi sementara untuk akun Anda.
                </p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 10px 12px; background: #f1f5f9; color: #475569; font-size: 13px; font-weight: bold; width: 40%; border-radius: 6px 0 0 6px;">ID / Username:</td>
                  <td style="padding: 10px 12px; background: #f8fafc; color: #0f172a; font-size: 14px; font-family: monospace; font-weight: bold; border-radius: 0 6px 6px 0;">${username}</td>
                </tr>
                <tr><td colspan="2" style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px; background: #eff6ff; color: #1e40af; font-size: 13px; font-weight: bold; border-radius: 6px 0 0 6px;">Password Sementara:</td>
                  <td style="padding: 12px; background: #dbeafe; color: #1d4ed8; font-size: 17px; font-family: monospace; font-weight: 800; letter-spacing: 1px; border-radius: 0 6px 6px 0;">${tempPassword}</td>
                </tr>
              </table>

              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://hris.primeprojectx.net" style="display: inline-block; padding: 12px 28px; background: #0066FF; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 8px;">Buka Halaman Login</a>
              </div>

              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
                <p style="margin: 0 0 4px 0;"><strong>Catatan Keamanan:</strong></p>
                <p style="margin: 0;">Demi keamanan data akun, segera ubah kata sandi ini setelah login melalui menu pengaturan profil.</p>
              </div>
            </div>
          `;

          try {
            const emRes = await sendEmailNotification({
              to: targetEmail,
              toName: displayName,
              subject: `🔐 Password Sementara Akun PRIME HRIS - ${username}`,
              html: emailHtml,
              text: `Password sementara untuk ${username} adalah: ${tempPassword}. Silakan login di https://hris.primeprojectx.net`,
              eventType: 'PASSWORD_RESET_NOTIFICATION',
              recipientId: employeeId,
              bypassEnabledCheck: true
            });
            emailSent = emRes?.success === true;
            if (!emailSent) emailError = emRes?.error;
          } catch (eme) {
            emailError = eme.message;
          }
        }

        return sendJson(200, {
          success: true,
          message: 'Kata sandi sementara telah berhasil dikirimkan.',
          username,
          displayName,
          targetPhone: maskPhone(targetPhone),
          targetEmail: maskEmail(targetEmail),
          channels: {
            whatsapp: waSent,
            email: emailSent
          },
          tempPassword: (!waSent && !emailSent) ? tempPassword : undefined
        });
      }

      // 0a. Native Server Biometric Frame Verification (Ultra-Fast YuNet + SFace on Central VPS)
      if (cleanUrl === '/api/auth/biometric-verify' && method === 'POST') {
        const body = await readBody();
        const { image } = body || {};
        if (!image) {
          return sendJson(400, { success: false, error: 'image base64 diperlukan' });
        }

        try {
          const resp = await fetch('http://103.31.205.218:8599/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image })
          });
          const data = await resp.json();

          if (data.matched && data.employeeId && data.score >= 70) {
            // Dapatkan data profil karyawan dari SQLite
            let emp = null;
            try {
              const db = getDatabase();
              const row = db.prepare('SELECT data_json FROM employees WHERE id = ?;').get(data.employeeId);
              if (row && row.data_json) {
                emp = JSON.parse(row.data_json);
              }
            } catch (e) {}

            const authResult = authenticateByBiometric(data.employeeId, {
              matchScore: data.score,
              matchedPose: 'front',
              cosineSimilarity: data.cosine_similarity
            });

            if (!authResult.success || !authResult.token || !authResult.user) {
              return sendJson(200, {
                success: false,
                matched: false,
                status: 'AUTH_FAILED',
                score: data.score,
                message: authResult.error || 'Akun karyawan tidak aktif atau belum terdaftar di sistem',
                proc_time_ms: data.proc_time_ms
              });
            }

            const finalEmployee = authResult.user?.employee || emp || authResult.employee;

            return sendJson(200, {
              success: true,
              matched: true,
              status: 'MATCHED',
              score: data.score,
              cosineSimilarity: data.cosine_similarity,
              proc_time_ms: data.proc_time_ms,
              message: data.message,
              employee: finalEmployee,
              user: authResult.user,
              token: authResult.token
            });
          } else {
            return sendJson(200, {
              success: false,
              matched: false,
              status: data.status || 'DENIED',
              score: data.score || 0,
              confidenceMargin: data.confidence_margin,
              secondEmployeeName: data.secondEmployeeName,
              message: data.message || 'Wajah tidak dikenali di sistem',
              proc_time_ms: data.proc_time_ms
            });
          }
        } catch (err) {
          console.error('[NATIVE FACE ENGINE ERROR]', err.message);
          return sendJson(500, { success: false, error: 'Gagal menghubungi Native Face Engine: ' + err.message });
        }
      }

      // 0b. Biometric 1:N Facial Recognition Login
      if (cleanUrl === '/api/auth/biometric-login' && method === 'POST') {
        const body = await readBody();
        const { employeeId, biometricVerification } = body || {};
        if (!employeeId) {
          return sendJson(400, { success: false, error: 'employeeId diperlukan' });
        }
        const result = authenticateByBiometric(employeeId, biometricVerification);
        if (!result.success) {
          return sendJson(401, result);
        }
        return sendJson(200, result);
      }

      // 0c. Ultra-Fast Enrolled Biometric Gallery Directory (< 80 KB)
      if ((cleanUrl === '/api/biometric/gallery' || cleanUrl === '/api/auth/biometric/gallery') && method === 'GET') {
        const gallery = getEnrolledBiometricGallery();
        return sendJson(200, {
          success: true,
          employees: gallery,
          count: gallery.length
        });
      }

      if (cleanUrl === '/api/auth/me' && method === 'GET') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized or session expired' });
        }
        // Sliding session: return renewed token with fresh 30 days expiration window
        const renewedToken = generateToken(user);
        return sendJson(200, { success: true, user, token: renewedToken });
      }

      if (cleanUrl === '/api/auth/logout' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        const clientIp = req.headers['cf-connecting-ip'] || 
                         req.headers['x-real-ip'] || 
                         (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                         req.socket.remoteAddress || 
                         '127.0.0.1';
        if (user) {
          addAuditLog({
            action: 'AUTH_LOGOUT',
            entity: 'user_accounts',
            entityId: user.id,
            userName: user.employee?.name || user.username,
            userNik: null,
            userLoginId: user.username,
            userRole: user.systemRole,
            module: 'AUTH',
            ipAddress: clientIp,
            status: 'SUCCESS',
            details: `Pengguna ${user.username} (${user.role} / ${user.systemRole}) keluar dari sistem PRIME HRIS.`
          });
        }
        return sendJson(200, { success: true, message: 'Berhasil logout' });
      }

      if (cleanUrl === '/api/auth/change-password' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized' });
        }
        const body = await readBody();
        const clientIp = getClientIp(req);
        const result = changeUserPassword(user.id, body.oldPassword, body.newPassword, clientIp, user);
        return sendJson(result.success ? 200 : 400, result);
      }

      if (cleanUrl === '/api/auth/accounts' && method === 'GET') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || user.systemRole !== 'superuser') {
          return sendJson(403, { success: false, error: 'Forbidden: Superuser access required' });
        }
        return sendJson(200, { success: true, accounts: listUserAccounts() });
      }

      if ((cleanUrl === '/api/auth/reset-employee-password' || cleanUrl.match(/^\/api\/employees\/([^\/]+)\/reset-password$/)) && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || (user.systemRole !== 'admin' && user.systemRole !== 'superuser')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Admin atau Superuser diperlukan' });
        }
        const body = await readBody();
        const match = cleanUrl.match(/^\/api\/employees\/([^\/]+)\/reset-password$/);
        const employeeId = match ? match[1] : body.employeeId;
        const newPassword = body.newPassword || 'zzz';
        const clientIp = getClientIp(req);
        const result = resetEmployeePassword(employeeId, newPassword, { ...user, clientIp }, clientIp);
        return sendJson(result.success ? 200 : 400, result);
      }

      if (cleanUrl.match(/^\/api\/employees\/([^\/]+)\/biometric$/) && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        const match = cleanUrl.match(/^\/api\/employees\/([^\/]+)\/biometric$/);
        const employeeId = match ? match[1] : null;

        const isSelf = user && (user.employeeId === employeeId || user.id === employeeId);
        const isPrivileged = user && (user.systemRole === 'admin' || user.systemRole === 'superuser');
        if (!isSelf && !isPrivileged) {
          return sendJson(403, { success: false, error: 'Unauthorized: Hanya karyawan bersangkutan atau HR Admin yang dapat mendaftarkan biometrik' });
        }

        const body = await readBody();
        const result = saveEmployeeBiometric(employeeId, body.biometric, body.updateAvatarAsWell, user);
        if (result.success) {
          broadcastRealtimeEvent('EMPLOYEE_UPDATED', result.employee);
          // Auto-sinkronisasi ke Native Face Engine VPS
          try {
            const samples = body.biometric?.samples || {};
            const sampleImages = [samples.front, samples.smile, samples.right, samples.left].filter(Boolean);
            if (sampleImages.length > 0) {
              fetch('http://103.31.205.218:8599/enroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employeeId: employeeId,
                  name: result.employee?.name || employeeId,
                  images: sampleImages
                })
              }).catch(err => console.warn('[VPS AUTO-ENROLL WARN]', err.message));
            }
          } catch (e) {}
        }
        return sendJson(result.success ? 200 : 400, result);
      }

      if (cleanUrl.match(/^\/api\/employees\/([^\/]+)\/biometric$/) && method === 'DELETE') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        const match = cleanUrl.match(/^\/api\/employees\/([^\/]+)\/biometric$/);
        const employeeId = match ? match[1] : null;

        const isSelf = user && (user.employeeId === employeeId || user.id === employeeId);
        const isPrivileged = user && (user.systemRole === 'admin' || user.systemRole === 'superuser');
        if (!isSelf && !isPrivileged) {
          return sendJson(403, { success: false, error: 'Unauthorized' });
        }

        const result = deleteEmployeeBiometric(employeeId, user);
        if (result.success && result.employee) {
          broadcastRealtimeEvent('EMPLOYEE_UPDATED', result.employee);
        }
        return sendJson(result.success ? 200 : 400, result);
      }

      // 1. Health check
      if (cleanUrl === '/api/health' && (method === 'GET' || method === 'HEAD')) {
        if (method === 'HEAD') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end();
        }
        return sendJson(200, {
          status: 'online',
          rtcLiveConnectedClients: wsClients.size + sseClients.size,
          wsClientsCount: wsClients.size,
          sseClientsCount: sseClients.size,
          ...getDbInfo()
        });
      }

      // 2. Real-Time Communication (SSE Live Stream)
      if (cleanUrl === '/api/realtime/stream' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        const initialPayload = JSON.stringify({
          connected: true,
          clientsCount: sseClients.size + 1,
          serverTimeMs: Date.now(),
          serverTimestamp: new Date().toISOString(),
          timeZone: 'Asia/Jakarta (WIB)'
        });
        res.write(`event: connected\ndata: ${initialPayload}\n\n`);
        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // 3. RTC Authoritative Server Time Lock (Anti-Tamper NTP Clock)
      if (cleanUrl === '/api/server-time' && method === 'GET') {
        const now = new Date();
        const timeZone = 'Asia/Jakarta';
        const wibTime = now.toLocaleTimeString('id-ID', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' WIB';
        const wibDate = now.toLocaleDateString('en-CA', { timeZone });
        return sendJson(200, {
          serverTimeMs: now.getTime(),
          serverTimestamp: now.toISOString(),
          serverWibTime: wibTime,
          serverDate: wibDate,
          timeZone: 'Asia/Jakarta (UTC+7)',
          isNtpAuthoritative: true
        });
      }

      // 4. Client Network Gateway
      if (cleanUrl === '/api/my-network' && method === 'GET') {
        const clientIp = req.headers['cf-connecting-ip'] || 
                         req.headers['x-real-ip'] || 
                         (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                         req.socket.remoteAddress || 
                         '127.0.0.1';
        return sendJson(200, {
          ip: clientIp,
          country: req.headers['cf-ipcountry'] || 'ID',
          city: req.headers['cf-ipcity'] || null,
          serverTimeMs: Date.now(),
          serverTimestamp: new Date().toISOString()
        });
      }

      // 5. Bootstrap all data from SQLite (Authenticated Session Required)
      if (cleanUrl === '/api/bootstrap' && method === 'GET') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
        }
        let data = getAllData();
        if (user && user.systemRole === 'staff' && user.employeeId) {
          const userEmpId = user.employeeId || user.id;
          const userEmpName = (user.employee?.name || user.name || user.username || '').toLowerCase().trim();
          const userPos = (user.employee?.position || user.position || '').toLowerCase();
          const userRole = (user.role || '').toLowerCase();

          // Check if user is a PM or Project Admin of any project
          const managedProjectIds = (data.projects || []).filter(p => {
            const isPm = p.projectManagerId === userEmpId ||
                         (p.projectManagerName && userEmpName && p.projectManagerName.toLowerCase().trim() === userEmpName) ||
                         userPos.includes('project manager') || userPos.includes('site manager') || userRole.includes('pm') || userRole.includes('project_manager');
            const isPAdmin = (Array.isArray(p.projectAdminIds) && p.projectAdminIds.includes(userEmpId)) ||
                             (Array.isArray(p.projectAdminNames) && userEmpName && p.projectAdminNames.some(n => n.toLowerCase().trim() === userEmpName));
            return isPm || isPAdmin;
          }).map(p => p.id);

          const isPmOrAdmin = managedProjectIds.length > 0;
          if (isPmOrAdmin) {
            // Keep projects & employees intact so PMs/Project Admins can view project rosters and assign personnel!
            // Filter attendances to their own OR members of their managed projects
            data.attendances = (data.attendances || []).filter(a =>
              a.employeeId === userEmpId || (a.projectId && managedProjectIds.includes(a.projectId))
            );
            // Filter approvals to their own OR approvals targeting their projects or where they are the assigned reviewer
            data.approvals = (data.approvals || []).filter(a =>
              a.employeeId === userEmpId ||
              (a.projectId && managedProjectIds.includes(a.projectId)) ||
              (a.projectManagerId && a.projectManagerId === userEmpId) ||
              (Array.isArray(a.projectAdminIds) && a.projectAdminIds.includes(userEmpId))
            );
          } else {
            data.employees = (data.employees || []).filter(e => e.id === userEmpId);
            data.attendances = (data.attendances || []).filter(a => a.employeeId === userEmpId);
            data.approvals = (data.approvals || []).filter(a => a.employeeId === userEmpId);
          }
        }
        return sendJson(200, data);
      }

      // 5b. Public Kiosk Safe Directory (Tanpa Login)
      if (cleanUrl === '/api/public-kiosk/employees' && method === 'GET') {
        const kioskData = getPublicKioskEmployees();
        return sendJson(200, {
          success: true,
          employees: kioskData.employees,
          projects: kioskData.projects,
          officeGeofence: kioskData.officeGeofence,
          todayAttendances: kioskData.todayAttendances
        });
      }

      // 6. Save Attendance with Server RTC Time Lock & Instant Broadcast (Auth / Normal)
      if (cleanUrl === '/api/attendance' && method === 'POST') {
        try {
          const body = await readBody();
          const serverNow = new Date();
          const serverWibTime = serverNow.toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(/\./g, ':');
          const serverDate = serverNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

          // Enforce Server RTC Authoritative Time (Anti-Tamper)
          body.serverVerifiedTime = serverWibTime;
          body.serverVerifiedDate = serverDate;
          body.serverTimeMs = serverNow.getTime();
          if (body.checkInTime) body.checkInTime = body.checkInTime.replace(/\./g, ':');
          if (body.checkOutTime) body.checkOutTime = body.checkOutTime.replace(/\./g, ':');

          const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '103.31.205.218';
          body.ipAddress = clientIp;

          const result = saveAttendance(body);
          const savedRecord = result.record || body;

          // Broadcast approval cleanup & replacement
          if (result.removedApprovalIds && result.removedApprovalIds.length > 0) {
            broadcastRealtimeEvent('APPROVAL_DELETED_BATCH', {
              ids: result.removedApprovalIds,
              employeeId: savedRecord.employeeId,
              date: savedRecord.date
            });
          }
          if (result.approvalItem) {
            broadcastRealtimeEvent('APPROVAL_SUBMITTED', result.approvalItem);
            triggerApprovalSubmitWaNotification(result.approvalItem).catch(err => console.error('[WA Trigger Approval Submit Error]', err));
            triggerApprovalSubmitEmailNotification(result.approvalItem).catch(err => console.error('[Email Trigger Approval Submit Error]', err));
          }

          broadcastRealtimeEvent('ATTENDANCE_SAVED', savedRecord);
          triggerAttendanceWaNotification(savedRecord).catch(err => console.error('[WA Trigger Attendance Error]', err));
          triggerAttendanceEmailNotification(savedRecord).catch(err => console.error('[Email Trigger Attendance Error]', err));
          setImmediate(() => triggerBiometricBackgroundScan(savedRecord));
          return sendJson(200, result);
        } catch (err) {
          console.error('[SERVER ERROR /api/attendance]', err);
          return sendJson(500, { success: false, error: err.message || 'Internal Server Error' });
        }
      }

      // 6b. Public Kiosk Direct Attendance (Tanpa Login)
      if (cleanUrl === '/api/public-attendance' && method === 'POST') {
        try {
          const body = await readBody();
          const serverNow = new Date();
          const serverWibTime = serverNow.toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(/\./g, ':');
          const serverDate = serverNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

          // Enforce Server RTC Authoritative Time
          body.serverVerifiedTime = serverWibTime;
          body.serverVerifiedDate = serverDate;
          body.serverTimeMs = serverNow.getTime();
          if (body.checkInTime) body.checkInTime = body.checkInTime.replace(/\./g, ':');
          if (body.checkOutTime) body.checkOutTime = body.checkOutTime.replace(/\./g, ':');

        const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        body.ipAddress = clientIp;

        const result = saveAttendance(body);
        const savedRecord = result.record || body;

        // Audit Trail khusus presensi cepat Kiosk
        addAuditLog({
          action: 'PUBLIC_KIOSK_ATTENDANCE',
          entity: 'attendances',
          entityId: body.id,
          userName: body.employeeName,
          userNik: body.employeeNik,
          userRole: 'staff',
          module: 'ATTENDANCE_KIOSK',
          ipAddress: clientIp,
          status: 'SUCCESS',
          details: `Presensi Kiosk Publik (Zero-Login) untuk ${body.employeeName} (${body.employeeNik}) berhasil dicatat. Biometrik: ${body.biometricVerification?.matchScore ? body.biometricVerification.matchScore + '%' : 'Manual'}.`
        });

        // Broadcast approval cleanup & replacement for kiosk
        if (result.removedApprovalIds && result.removedApprovalIds.length > 0) {
          broadcastRealtimeEvent('APPROVAL_DELETED_BATCH', {
            ids: result.removedApprovalIds,
            employeeId: savedRecord.employeeId,
            date: savedRecord.date
          });
        }
        if (result.approvalItem) {
          broadcastRealtimeEvent('APPROVAL_SUBMITTED', result.approvalItem);
          triggerApprovalSubmitWaNotification(result.approvalItem).catch(err => console.error('[WA Trigger Approval Submit Error]', err));
          triggerApprovalSubmitEmailNotification(result.approvalItem).catch(err => console.error('[Email Trigger Approval Submit Error]', err));
        }

        broadcastRealtimeEvent('ATTENDANCE_SAVED', savedRecord);
        triggerAttendanceWaNotification(savedRecord).catch(err => console.error('[WA Trigger Attendance Error]', err));
        triggerAttendanceEmailNotification(savedRecord).catch(err => console.error('[Email Trigger Attendance Error]', err));
        setImmediate(() => triggerBiometricBackgroundScan(savedRecord));
        return sendJson(200, result);
      } catch (err) {
        console.error('[SERVER ERROR /api/public-attendance]', err);
        return sendJson(500, { success: false, error: err.message || 'Internal Server Error' });
      }
    }

      // 6c. Delete Attendance Record (Superuser Direct Deletion for Testing / Trial)
      if ((cleanUrl.match(/^\/api\/attendance\/([^\/]+)$/) && method === 'DELETE') || (cleanUrl === '/api/attendance/delete' && method === 'POST')) {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || (user.systemRole !== 'superuser' && user.role !== 'SUPERUSER' && user.role !== 'Director')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hanya Superuser yang dapat menghapus data presensi' });
        }
        let id = null;
        if (method === 'POST') {
          const body = await readBody();
          id = body?.id;
        } else {
          const match = cleanUrl.match(/^\/api\/attendance\/([^\/]+)$/);
          id = match ? decodeURIComponent(match[1]) : null;
        }
        if (!id) return sendJson(400, { success: false, error: 'ID presensi tidak valid' });

        try {
          const clientIp = getClientIp(req);
          const result = deleteAttendance(id, { ...user, clientIp });
          if (result.success) {
            broadcastRealtimeEvent('ATTENDANCE_DELETED', { id: result.id || id, linkedApprovalIds: result.linkedApprovalIds });
          }
          return sendJson(result.success ? 200 : 400, result);
        } catch (err) {
          console.error('[DELETE_ATTENDANCE_ERROR]', err);
          return sendJson(500, { success: false, error: err.message || 'Gagal memproses penghapusan presensi' });
        }
      }

      // 6d. Stream Attendance Photo Binary with Instant Cache (Zero-lag Hydration)
      const photoMatch = cleanUrl.match(/^\/api\/attendance\/([^\/]+)\/photo$/);
      if (photoMatch && method === 'GET') {
        const id = decodeURIComponent(photoMatch[1]);
        const photoUrl = getAttendancePhoto(id);
        if (photoUrl) {
          if (photoUrl.startsWith('data:image/')) {
            const matches = photoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': '*'
              });
              return res.end(buffer);
            }
          } else if (photoUrl.startsWith('http')) {
            res.writeHead(302, { Location: photoUrl, 'Access-Control-Allow-Origin': '*' });
            return res.end();
          }
        }
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'Photo not found' }));
      }

      // 6e. Stream Check-Out Attendance Photo Binary with Instant Cache (Zero-lag Hydration)
      const photoOutMatch = cleanUrl.match(/^\/api\/attendance\/([^\/]+)\/photo-out$/);
      if (photoOutMatch && method === 'GET') {
        const id = decodeURIComponent(photoOutMatch[1]);
        const photoUrl = getAttendancePhotoOut(id);
        if (photoUrl) {
          if (photoUrl.startsWith('data:image/')) {
            const matches = photoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': '*'
              });
              return res.end(buffer);
            }
          } else if (photoUrl.startsWith('http')) {
            res.writeHead(302, { Location: photoUrl, 'Access-Control-Allow-Origin': '*' });
            return res.end();
          }
        }
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'Photo not found' }));
      }

      // 7. Update Approval with Instant Broadcast (Supports Admin, HR, Superuser, Finance & PM Stage 1)
      if (cleanUrl === '/api/approval' && (method === 'PUT' || method === 'POST')) {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir' });
        }
        const body = await readBody();
        if (!body?.id) {
          return sendJson(400, { success: false, error: 'Bad Request: ID pengajuan persetujuan wajib disertakan' });
        }

        const db = getDatabase();
        const row = db.prepare('SELECT data_json FROM approvals WHERE id = ?;').get(body.id);
        if (!row) {
          return sendJson(404, { success: false, error: 'Not Found: Pengajuan persetujuan tidak ditemukan' });
        }

        const item = JSON.parse(row.data_json);
        const userEmpId = user.employeeId || user.id;
        const isSuperuser = user.systemRole === 'superuser' || user.role === 'Director';

        // 1. PENCEGAHAN SELF-APPROVAL (Segregation of Duties)
        if (userEmpId === item.employeeId && !isSuperuser) {
          return sendJson(403, {
            success: false,
            error: 'Forbidden: Anda tidak dapat menyetujui pengajuan milik sendiri demi integritas audit dan kepatuhan sistem.'
          });
        }

        const userName = (user.employee?.name || user.name || user.username || '').toLowerCase().trim();
        const userPos = (user.employee?.position || user.position || '').toLowerCase();
        const userRole = (user.role || '').toLowerCase();

        // 2. CEK TAHAP PERSETUJUAN (Tahap 1 PM atau Tahap 2 Otorisasi Akhir)
        const isPmStage = item.type !== 'SLIP_ACCESS' && item.type !== 'KASBON' &&
                          (item.targetApproverRole === 'PM' || item.stage === 'PM' || !item.stage) &&
                          !item.pmApprovedBy &&
                          (Boolean(item.projectManagerId) || Boolean(item.projectAdminIds && item.projectAdminIds.length > 0));

        if (isPmStage) {
          const isPm = (item.projectManagerId && item.projectManagerId === userEmpId) ||
                       (item.projectManagerName && userName && item.projectManagerName.toLowerCase().trim() === userName) ||
                       userPos.includes('project manager') || userPos.includes('site manager') || userRole.includes('pm');
          const isPAdmin = (Array.isArray(item.projectAdminIds) && item.projectAdminIds.includes(userEmpId)) ||
                           (Array.isArray(item.projectAdminNames) && userName && item.projectAdminNames.some(n => n.toLowerCase().trim() === userName));
          if (!isSuperuser && !isPm && !isPAdmin) {
            return sendJson(403, {
              success: false,
              error: 'Forbidden: Tahap 1 wajib direkomendasikan oleh Project Manager atau Admin Proyek terkait.'
            });
          }
        } else {
          // Tahap 2: Otorisasi Akhir / Level 2 (Aturan Otorisasi Silang HR ⇄ Finance)
          const applicant = getEmployeeByIdentifier(item.employeeId);
          const isApplicantHr = applicant && (
            applicant.systemRole === 'hr' || 
            applicant.systemRole === 'admin' || 
            applicant.role === 'HR_Manager' ||
            (applicant.position && applicant.position.toLowerCase().includes('hr')) ||
            applicant.id === 'EMP-022'
          );
          const isApplicantFinance = applicant && (
            applicant.systemRole === 'finance' ||
            applicant.role === 'Finance' ||
            (applicant.position && applicant.position.toLowerCase().includes('finance')) ||
            (applicant.department && applicant.department.toLowerCase().includes('finance')) ||
            applicant.id === 'EMP-015' ||
            applicant.id === 'EMP-045'
          );

          const isUserFinance = user.systemRole === 'finance' || user.role === 'Finance';
          const isUserHr = ['hr', 'admin'].includes(user.systemRole) || user.role === 'HR_Manager';

          // ATURAN 1: Pengajuan dari HR Manager WAJIB disetujui oleh Finance Manager!
          if (isApplicantHr) {
            if (!isUserFinance && !isSuperuser) {
              return sendJson(403, {
                success: false,
                error: 'Forbidden: Pengajuan dari HR Manager wajib disetujui oleh Finance Manager (Otorisasi Silang HR ➔ Finance).'
              });
            }
          } else if (isApplicantFinance) {
            // ATURAN 2: Pengajuan dari Finance Manager WAJIB disetujui oleh HR Manager!
            if (!isUserHr && !isSuperuser) {
              return sendJson(403, {
                success: false,
                error: 'Forbidden: Pengajuan dari Finance Manager wajib disetujui oleh HR Manager (Otorisasi Silang Finance ➔ HR).'
              });
            }
          } else if (item.type === 'SLIP_ACCESS' || item.type === 'KASBON') {
            if (!isUserFinance && !isSuperuser) {
              return sendJson(403, {
                success: false,
                error: 'Forbidden: Pengajuan Slip Gaji / Kasbon wajib diotorisasi oleh Finance Manager.'
              });
            }
          } else {
            // Karyawan biasa / staf umum
            if (!isUserHr && !isSuperuser) {
              return sendJson(403, {
                success: false,
                error: 'Forbidden: Anda tidak memiliki wewenang untuk menyetujui pengajuan ini (Wewenang HR Manager).'
              });
            }
          }
        }
        const reviewerTitle = body.reviewedBy || user.employee?.name || user.name || user.username || 'Direksi / HR Lead';
        const approvalOptions = {
          waiveLateDeduction: body.waiveLateDeduction,
          deductionWaived: body.deductionWaived !== undefined ? body.deductionWaived : body.waiveLateDeduction
        };
        const result = updateApproval(body.id, body.status, body.reviewNote, reviewerTitle, approvalOptions);
        broadcastRealtimeEvent('APPROVAL_UPDATED', {
          id: body.id,
          status: body.status,
          reviewNote: body.reviewNote,
          reviewedBy: body.reviewedBy,
          item: result.item
        });
        if (result.updatedAttendance) {
          broadcastRealtimeEvent('ATTENDANCE_SAVED', result.updatedAttendance);
        }
        if (result.updatedEmployee) {
          broadcastRealtimeEvent('EMPLOYEE_UPDATED', result.updatedEmployee);
        }
        triggerApprovalDecisionWaNotification(body.id, body.status, body.reviewNote, body.reviewedBy).catch(err => console.error('[WA Trigger Approval Decision Error]', err));
        triggerApprovalDecisionEmailNotification(body.id, body.status, body.reviewNote, body.reviewedBy).catch(err => console.error('[Email Trigger Approval Decision Error]', err));
        return sendJson(200, result);
      }

      // 7b. Submit New Approval Request (Leave, Permit, etc.)
      if (cleanUrl === '/api/approval/submit' && method === 'POST') {
        const body = await readBody();
        const result = saveApproval(body);
        const savedItem = result.item || body;
        broadcastRealtimeEvent('APPROVAL_SUBMITTED', savedItem);
        triggerApprovalSubmitWaNotification(savedItem).catch(err => console.error('[WA Trigger Approval Submit Error]', err));
        triggerApprovalSubmitEmailNotification(savedItem).catch(err => console.error('[Email Trigger Approval Submit Error]', err));
        return sendJson(200, result);
      }

      // 8-profile. Dedicated Self-Profile Update Endpoint (Lightweight, Anti-Socket-Reset, Resilient)
      if ((cleanUrl === '/api/user/profile' || cleanUrl === '/api/profile') && method === 'POST') {
        const body = await readBody(); // ALWAYS drain body first to prevent TCP socket resets
        const token = getAuthToken() || body?._authToken || body?.token;
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
        }
        const sysRole = String(user?.systemRole || '').toLowerCase();
        const uRole = String(user?.role || '').toLowerCase();
        const isPrivileged = ['admin', 'superuser', 'hr'].includes(sysRole) || uRole.includes('director') || uRole.includes('hr');
        const isSelf = Boolean(
          (user.employeeId && user.employeeId === body?.id) ||
          (user.id && user.id === body?.id) ||
          (user.username && body?.loginId === user.username) ||
          (user.username && body?.nik === user.username) ||
          (user.employee && user.employee.nik && body?.nik && user.employee.nik === body.nik) ||
          (user.email && body?.email && user.email.toLowerCase() === body.email.toLowerCase())
        );
        if (!isPrivileged && !isSelf) {
          return sendJson(403, { success: false, error: 'Forbidden: Anda hanya berwenang memperbarui profil akun Anda sendiri' });
        }
        const clientIp = getClientIp(req);
        const result = updateUserProfile(body, { ...user, clientIp });
        if (result.success && result.employee) {
          broadcastRealtimeEvent('EMPLOYEE_SAVED', result.employee);
        }
        return sendJson(200, result);
      }

      // 8. Save Employee with Broadcast (Permits Admin/HR/Superuser OR self-identity profile update)
      if (cleanUrl === '/api/employee' && method === 'POST') {
        const body = await readBody(); // ALWAYS drain body first
        const token = getAuthToken() || body?._authToken || body?.token;
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
        }
        const sysRole = String(user?.systemRole || '').toLowerCase();
        const uRole = String(user?.role || '').toLowerCase();
        const isPrivileged = ['admin', 'superuser', 'hr'].includes(sysRole) || uRole.includes('director') || uRole.includes('hr');
        const isSelf = Boolean(
          (user.employeeId && user.employeeId === body?.id) ||
          (user.id && user.id === body?.id) ||
          (user.username && body?.loginId === user.username) ||
          (user.username && body?.nik === user.username) ||
          (user.employee && user.employee.nik && body?.nik && user.employee.nik === body.nik) ||
          (user.email && body?.email && user.email.toLowerCase() === body.email.toLowerCase())
        );
        if (!isPrivileged && !isSelf) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Admin, HR, atau Superuser diperlukan' });
        }
        const clientIp = getClientIp(req);
        const result = saveEmployee(body, { ...user, clientIp });
        if (!result || result.success === false) {
          return sendJson(400, result || { success: false, error: 'Gagal menyimpan data karyawan' });
        }
        broadcastRealtimeEvent('EMPLOYEE_SAVED', result.employee || body);
        return sendJson(200, result);
      }

      // 8a. Delete Employee with Broadcast
      const empDeleteMatch = cleanUrl.match(/^\/api\/employee\/([^\/]+)$/);
      if ((empDeleteMatch && method === 'DELETE') || (cleanUrl === '/api/employee/delete' && method === 'POST')) {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        const sysRole = String(user?.systemRole || '').toLowerCase();
        const uRole = String(user?.role || '').toLowerCase();
        const isAuthorized = ['admin', 'superuser', 'hr'].includes(sysRole) || uRole.includes('hr') || uRole.includes('director');
        if (!user || !isAuthorized) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Admin, HR, atau Superuser diperlukan untuk menghapus data karyawan' });
        }

        let id;
        if (empDeleteMatch) {
          id = decodeURIComponent(empDeleteMatch[1]);
        } else {
          const body = await readBody();
          id = body?.id;
        }
        if (!id) return sendJson(400, { success: false, error: 'ID karyawan tidak valid' });

        if (id === 'EMP-001') {
          return sendJson(400, { success: false, error: 'Akun Master Superuser (EMP-001) dilindungi dan tidak dapat dihapus' });
        }

        try {
          const clientIp = getClientIp(req);
          const result = deleteEmployee(id, { ...user, clientIp });
          if (result.success) {
            broadcastRealtimeEvent('EMPLOYEE_DELETED', { id: result.id || id });
          }
          return sendJson(result.success ? 200 : 400, result);
        } catch (err) {
          console.error('[DELETE_EMPLOYEE_ERROR]', err);
          return sendJson(500, { success: false, error: err.message || 'Gagal memproses penghapusan karyawan' });
        }
      }

      // 8b. Save Project with Broadcast (Supports Admin, HR, Superuser, PM, and Project Admin)
      if (cleanUrl === '/api/project' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user) {
          return sendJson(401, { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir' });
        }
        const body = await readBody();
        const isPrivileged = ['admin', 'superuser', 'hr'].includes(user.systemRole) || user.role === 'Director';
        const userEmpId = user.employeeId || user.id;
        const userName = (user.employee?.name || user.name || user.username || '').toLowerCase().trim();
        const userPos = (user.employee?.position || user.position || '').toLowerCase();
        const userRole = (user.role || '').toLowerCase();

        const isPmOrAdmin = isPrivileged ||
          userPos.includes('project manager') ||
          userPos.includes('site manager') ||
          userRole.includes('pm') ||
          body?.projectManagerId === userEmpId ||
          (body?.projectManagerName && userName && body.projectManagerName.toLowerCase().trim() === userName) ||
          (Array.isArray(body?.projectAdminIds) && body.projectAdminIds.includes(userEmpId)) ||
          (Array.isArray(body?.projectAdminNames) && userName && body.projectAdminNames.some(n => n.toLowerCase().trim() === userName));

        if (!isPmOrAdmin) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Manajemen Proyek, HR, atau Admin diperlukan' });
        }
        const result = saveProject(body);
        broadcastRealtimeEvent('PROJECT_SAVED', result.project || body);
        return sendJson(200, result);
      }

      // 10. Update Salary Rules with Broadcast
      if (cleanUrl === '/api/salary-rules' && (method === 'PUT' || method === 'POST')) {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'finance', 'hr'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Finance, HR, atau Admin diperlukan' });
        }
        const body = await readBody();
        const result = saveSalaryRules(body);
        broadcastRealtimeEvent('SALARY_RULES_UPDATED', body);
        return sendJson(200, result);
      }

      // 10b. Work Calendar & Annual Cut-Off Settings
      if (cleanUrl === '/api/work-calendar' && method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const year = parseInt(urlObj.searchParams.get('year') || String(new Date().getFullYear()), 10);
        const calendar = getWorkCalendarConfig(year);
        return sendJson(200, { success: true, calendar });
      }

      if (cleanUrl === '/api/work-calendar' && (method === 'POST' || method === 'PUT')) {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin atau HR diperlukan untuk mengatur kalender kerja' });
        }
        const body = await readBody();
        const calendar = saveWorkCalendarConfig(body, user);
        broadcastRealtimeEvent('WORK_CALENDAR_UPDATED', calendar);
        return sendJson(200, { success: true, calendar });
      }

      if (cleanUrl.match(/^\/api\/work-calendar\/period\/([^\/]+)\/toggle$/) && (method === 'PUT' || method === 'POST')) {
        const match = cleanUrl.match(/^\/api\/work-calendar\/period\/([^\/]+)\/toggle$/);
        const periodId = match ? match[1] : null;
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin atau HR diperlukan untuk mengubah status cut-off presensi' });
        }
        const body = await readBody();
        const isOpen = body.isOpen !== undefined ? Boolean(body.isOpen) : true;
        const currentYear = new Date().getFullYear();
        const current = getWorkCalendarConfig(currentYear);
        const updatedPeriods = (current.periods || []).map(p => {
          if (p.id === periodId) {
            return { ...p, isAttendanceOpen: isOpen, status: isOpen ? 'OPEN' : 'LOCKED' };
          }
          return p;
        });
        const updatedConfig = { ...current, periods: updatedPeriods };
        const saved = saveWorkCalendarConfig(updatedConfig, user);
        broadcastRealtimeEvent('WORK_CALENDAR_PERIOD_TOGGLED', { periodId, isOpen });
        return sendJson(200, { success: true, periodId, isOpen, calendar: saved });
      }


      // =======================================================================
      // CASUAL FIELD WORKER ATTENDANCE (PRESENSI TUKANG LAPANGAN)
      // =======================================================================
      if (cleanUrl === '/api/casual-workers' && method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let projectId = urlObj.searchParams.get('projectId');
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;

        // PM SCOPING: Fallback to assigned project only if no projectId requested
        if (!projectId && user && user.systemRole === 'staff') {
          const userProj = user.employee?.assignedProjectId || user.assignedProjectId;
          if (userProj) {
            projectId = userProj;
          }
        }

        const workers = getCasualWorkers(projectId);
        return sendJson(200, { success: true, workers, count: workers.length, projectId });
      }

      if (cleanUrl === '/api/casual-workers' && method === 'POST') {
        const body = await readBody();
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;

        // PM Scoping: Fallback to assigned project only if body.projectId was not explicitly supplied
        if (!body.projectId && user && user.systemRole === 'staff') {
          const userProj = user.employee?.assignedProjectId || user.assignedProjectId;
          if (userProj) {
            body.projectId = userProj;
          }
        }

        if (!body.name || !body.projectId) {
          return sendJson(400, { success: false, error: 'Nama tukang dan projectId wajib diisi' });
        }

        if (user) {
          body.createdBy = user.id;
          body.createdByName = user.employee?.name || user.username;
        }

        const savedWorker = saveCasualWorker(body);
        broadcastRealtimeEvent('CASUAL_WORKER_SAVED', savedWorker);
        return sendJson(200, { success: true, worker: savedWorker });
      }

      if (cleanUrl === '/api/casual-attendances' && method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let projectId = urlObj.searchParams.get('projectId');
        const date = urlObj.searchParams.get('date');
        const startDate = urlObj.searchParams.get('startDate');
        const endDate = urlObj.searchParams.get('endDate');
        const limit = urlObj.searchParams.get('limit') || 200;

        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;

        // PM SCOPING: Fallback to assigned project only if no projectId requested
        if (!projectId && user && user.systemRole === 'staff') {
          const userProj = user.employee?.assignedProjectId || user.assignedProjectId;
          if (userProj) {
            projectId = userProj;
          }
        }

        const attendances = getCasualAttendances({ projectId, date, startDate, endDate, limit });
        return sendJson(200, { success: true, attendances, count: attendances.length, projectId });
      }

      if (cleanUrl === '/api/casual-attendances' && method === 'POST') {
        const body = await readBody();
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;

        // PM Scoping: Fallback to assigned project only if body.projectId was not explicitly supplied
        if (!body.projectId && user && user.systemRole === 'staff') {
          const userProj = user.employee?.assignedProjectId || user.assignedProjectId;
          if (userProj) {
            body.projectId = userProj;
          }
        }

        if (!body.workerName || !body.projectId || !body.photoUrl) {
          return sendJson(400, { success: false, error: 'workerName, projectId, dan photoUrl wajib disertakan' });
        }

        body.verifiedByPmId = user?.id || 'PM-SYS';
        body.verifiedByPmName = user?.employee?.name || user?.username || 'Project Manager';

        const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const saved = saveCasualAttendance(body);

        // Audit Trail
        addAuditLog({
          action: 'CASUAL_ATTENDANCE_RECORDED',
          entity: 'casual_worker_attendances',
          entityId: saved.id,
          userName: body.verifiedByPmName,
          userRole: user?.systemRole || 'staff',
          module: 'CASUAL_ATTENDANCE',
          ipAddress: clientIp,
          status: 'SUCCESS',
          details: `Presensi Tukang "${body.workerName}" di Proyek ${body.projectId} diverifikasi oleh PM ${body.verifiedByPmName}.`
        });

        // Broadcast to live connected clients
        broadcastRealtimeEvent('CASUAL_ATTENDANCE_RECORDED', saved);

        return sendJson(200, { success: true, attendance: saved });
      }

      if ((cleanUrl.match(/^\/api\/casual-attendances\/([^\/]+)$/) && method === 'DELETE') || (cleanUrl === '/api/casual-attendances/delete' && method === 'POST')) {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'hr', 'pm', 'lead', 'staff'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Sesi autentikasi PM / Admin diperlukan' });
        }
        let id = null;
        if (method === 'POST') {
          const body = await readBody();
          id = body?.id;
        } else {
          const match = cleanUrl.match(/^\/api\/casual-attendances\/([^\/]+)$/);
          id = match ? decodeURIComponent(match[1]) : null;
        }
        if (!id) return sendJson(400, { success: false, error: 'ID presensi tukang tidak valid' });
        deleteCasualAttendance(id, user);
        broadcastRealtimeEvent('CASUAL_ATTENDANCE_DELETED', { id });
        return sendJson(200, { success: true, message: 'Presensi tukang berhasil dihapus' });
      }

      // 11. Audit Logs (Paginated & Filterable with 10-Item Load)
      if (cleanUrl === '/api/audit-logs' && method === 'GET') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Admin, HR, Finance, atau Superuser diperlukan untuk melihat log audit' });
        }
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
        const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);
        const search = urlObj.searchParams.get('search') || '';
        const module = urlObj.searchParams.get('module') || '';
        const role = urlObj.searchParams.get('role') || '';
        const status = urlObj.searchParams.get('status') || '';

        const startDate = urlObj.searchParams.get('startDate') || '';
        const endDate = urlObj.searchParams.get('endDate') || '';
        const result = getAuditLogsPaginated({ page, limit, search, module, role, status, startDate, endDate });
        return sendJson(200, result);
      }

      if (cleanUrl === '/api/audit-logs' && method === 'POST') {
        const body = await readBody();
        const clientIp = req.headers['cf-connecting-ip'] || 
                         req.headers['x-real-ip'] || 
                         (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                         req.socket.remoteAddress || 
                         '127.0.0.1';
        addAuditLog({
          ...body,
          ipAddress: body.ipAddress || clientIp
        });
        broadcastRealtimeEvent('AUDIT_LOG_ADDED', body);
        return sendJson(200, { success: true });
      }

      // 11b. WhatsApp Baileys Gateway & Control Endpoints
      if (cleanUrl === '/api/wa/status' && method === 'GET') {
        const status = await getGatewayStatus();
        return sendJson(200, { success: true, ...status });
      }

      if (cleanUrl === '/api/wa/logs' && method === 'GET') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden' });
        }
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
        const logs = getWaNotificationLogs(limit);
        return sendJson(200, { success: true, logs });
      }

      // WhatsApp Opt-In / Active Contacts Registry
      if (cleanUrl === '/api/wa/opt-ins' && method === 'GET') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden' });
        }
        const optIns = getWaOptIns();
        return sendJson(200, { success: true, optIns, count: optIns.length });
      }

      // Toggle Single User WA Notification Preference
      if (cleanUrl === '/api/wa/opt-ins/toggle' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden' });
        }
        const body = await readBody();
        if (!body.phone) {
          return sendJson(400, { success: false, error: 'Nomor telepon wajib disertakan' });
        }
        const result = toggleWaOptIn(body.phone, body.isActive, body.manualOverride);
        addAuditLog({
          action: 'WA_OPT_IN_TOGGLED',
          entity: 'wa_opt_ins',
          entityId: body.phone,
          userName: user?.name || user?.username || 'Admin HR',
          userRole: user?.systemRole || 'admin',
          module: 'SYSTEM',
          status: 'SUCCESS',
          details: `Preferensi notifikasi WhatsApp untuk +${body.phone} diubah menjadi: ${body.isActive ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}.`
        });
        return sendJson(200, { success: true, result });
      }

      // Bulk Toggle WA Notification Preferences (Mass Actions)
      if (cleanUrl === '/api/wa/opt-ins/bulk-toggle' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden' });
        }
        const body = await readBody();
        const result = bulkToggleWaOptIns(body.phones, body.isActive, body.manualOverride);
        addAuditLog({
          action: 'WA_OPT_IN_BULK_TOGGLED',
          entity: 'wa_opt_ins',
          entityId: 'BULK',
          userName: user?.name || user?.username || 'Admin HR',
          userRole: user?.systemRole || 'admin',
          module: 'SYSTEM',
          status: 'SUCCESS',
          details: `Preferensi notifikasi WhatsApp masal (${result.count} kontak) diubah menjadi: ${body.isActive ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}.`
        });
        return sendJson(200, { success: true, result });
      }

      // Webhook for incoming WhatsApp message from gateway
      if (cleanUrl === '/api/wa/incoming' && method === 'POST') {
        const internalSecret = req.headers['x-internal-secret'] || '';
        const expectedSecret = process.env.INTERNAL_WA_SECRET || 'prime-internal-wa-2026';
        if (internalSecret !== expectedSecret) {
          return sendJson(403, { success: false, error: 'Forbidden: Secret webhook tidak valid' });
        }
        const body = await readBody();
        const result = recordWaOptIn(body.phone, body.message, body.pushName);
        if (result) {
          broadcastRealtimeEvent('WA_OPT_IN_RECEIVED', result);
        }
        return sendJson(200, { success: true, result });
      }

      if (cleanUrl === '/api/wa/test' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const body = await readBody();
        if (!body.phone) {
          return sendJson(400, { success: false, error: 'Nomor telepon penerima wajib diisi' });
        }
        const testMsg = body.message || `*TES NOTIFIKASI WHATSAPP - PRIME HRIS*\nKoneksi bot WhatsApp Baileys Gateway berhasil terhubung secara real-time!\nWaktu: ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
        const resWa = await sendWhatsAppMessage(body.phone, testMsg, {
          eventType: 'TEST_MANUAL',
          title: 'Uji Coba Pesan Manual HR',
          recipientName: body.recipientName || user.name || 'Tester',
          force: Boolean(body.force)
        });

        addAuditLog({
          action: 'WA_TEST_SENT',
          entity: 'notifications_wa',
          entityId: body.phone,
          userName: user?.name || user?.username || 'Admin HR',
          userRole: user?.systemRole || 'admin',
          module: 'SYSTEM',
          status: resWa.success ? 'SUCCESS' : 'WARNING',
          details: `Uji coba pesan WhatsApp ke ${body.phone} (${body.recipientName || 'Penerima'}): ${resWa.success ? 'Berhasil Terkirim' : 'Gagal'}.`
        });

        return sendJson(resWa.success ? 200 : 500, resWa);
      }

      if (cleanUrl === '/api/wa/blast-unrecorded' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const body = await readBody();
        const result = await blastUnrecordedEmployees(body.date);

        addAuditLog({
          action: 'WA_BLAST_REMINDER',
          entity: 'notifications_wa',
          entityId: body.date || 'today',
          userName: user?.name || user?.username || 'Admin HR',
          userRole: user?.systemRole || 'admin',
          module: 'SYSTEM',
          status: 'SUCCESS',
          details: `Blast WhatsApp pengingat presensi untuk tanggal ${body.date || 'hari ini'} selesai. Terkirim: ${result.sentCount || 0}, Gagal: ${result.failedCount || 0}.`
        });

        return sendJson(200, { success: true, ...result });
      }

      if (cleanUrl === '/api/wa/restart' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const resRestart = await restartGatewayClient();
        return sendJson(resRestart.ok ? 200 : 500, resRestart.data || { success: resRestart.ok, error: resRestart.error });
      }

      if (cleanUrl === '/api/wa/logout' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const resLogout = await logoutGatewayClient();
        return sendJson(resLogout.ok ? 200 : 500, resLogout.data || { success: resLogout.ok, error: resLogout.error });
      }

      // 11c. Email SMTP (Gmail) Configuration, Test & Log Endpoints
      if (cleanUrl === '/api/email/status' && method === 'GET') {
        const config = getSmtpConfig();
        const verification = await verifySmtp(config);
        return sendJson(200, {
          success: true,
          enabled: config.enabled,
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.user,
          fromName: config.fromName,
          fromEmail: config.fromEmail,
          verified: verification.success,
          statusMessage: verification.message || verification.error
        });
      }

      if (cleanUrl === '/api/email/verify' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const body = await readBody();
        const resVerify = await verifySmtp(body);
        return sendJson(resVerify.success ? 200 : 400, resVerify);
      }

      if (cleanUrl === '/api/email/test' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const body = await readBody();
        const targetEmail = body.to || user.email || body.email;
        if (!targetEmail) {
          return sendJson(400, { success: false, error: 'Alamat email penerima uji coba wajib diisi' });
        }
        const resTest = await sendTestEmail(targetEmail, body.customConfig || null);

        addAuditLog({
          action: 'EMAIL_TEST_SENT',
          entity: 'notifications_email',
          entityId: targetEmail,
          userName: user?.name || user?.username || 'Admin HR',
          userRole: user?.systemRole || 'admin',
          module: 'SYSTEM',
          status: resTest.success ? 'SUCCESS' : 'WARNING',
          details: `Uji coba kirim email SMTP ke ${targetEmail}: ${resTest.success ? 'Berhasil Terkirim' : 'Gagal'}.`
        });

        return sendJson(resTest.success ? 200 : 500, resTest);
      }

      if (cleanUrl === '/api/email/logs' && method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
        const logs = getEmailNotificationLogs(limit);
        return sendJson(200, { success: true, logs });
      }

      if (cleanUrl === '/api/email/blast-unrecorded' && method === 'POST') {
        const token = getAuthToken();
        const user = getCurrentUserFromToken(token);
        if (!user || !['admin', 'superuser', 'hr', 'finance'].includes(user.systemRole)) {
          return sendJson(403, { success: false, error: 'Forbidden: Admin, HR, Finance, atau Superuser diperlukan' });
        }
        const body = await readBody();
        const result = await blastUnrecordedEmployeesEmail(body.date);

        addAuditLog({
          action: 'EMAIL_BLAST_REMINDER',
          entity: 'notifications_email',
          entityId: body.date || 'today',
          userName: user?.name || user?.username || 'Admin HR',
          userRole: user?.systemRole || 'admin',
          module: 'SYSTEM',
          status: 'SUCCESS',
          details: `Blast email pengingat presensi untuk tanggal ${body.date || 'hari ini'} selesai. Terkirim: ${result.sentCount || 0}, Gagal: ${result.failedCount || 0}.`
        });

        return sendJson(200, { success: true, ...result });
      }

      // 12. Reset Database with Broadcast (Superuser Only)
      if (cleanUrl === '/api/reset' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || user.systemRole !== 'superuser') {
          return sendJson(403, { success: false, error: 'Forbidden: Hanya Superuser yang memiliki izin reset database' });
        }
        const result = resetDatabase();
        addAuditLog({
          action: 'DATABASE_RESET',
          entity: 'SYSTEM',
          entityId: 'all_tables',
          userName: user?.name || user?.username || 'Superuser',
          userRole: user?.systemRole || 'superuser',
          module: 'SYSTEM',
          status: 'WARNING',
          details: 'Seluruh basis data sistem PRIME HRIS di-reset ke konfigurasi awal pabrik oleh Superuser.'
        });
        broadcastRealtimeEvent('DATABASE_RESET', {});
        return sendJson(200, { success: true, ...result });
      }

      // 12b. Download DB (Superuser Only)
      if (cleanUrl === '/api/download-db' && method === 'GET') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || user.systemRole !== 'superuser') {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses Superuser diperlukan' });
        }
        if (!fs.existsSync(dbPath)) return sendJson(404, { error: 'Database not found' });
        res.writeHead(200, {
          'Content-Type': 'application/x-sqlite3',
          'Content-Disposition': 'attachment; filename="prime_hris.sqlite"'
        });
        return fs.createReadStream(dbPath).pipe(res);
      }

      // 12c. Database Statistics
      if (cleanUrl === '/api/database/stats' && method === 'GET') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || (user.systemRole !== 'superuser' && user.systemRole !== 'admin' && user.systemRole !== 'hr' && user.systemRole !== 'finance')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses tidak mencukupi' });
        }
        const stats = getDatabaseStats();
        return sendJson(200, { success: true, ...stats });
      }

      // 12d. Vacuum Database (Optimize Storage & Shrink SQLite)
      if (cleanUrl === '/api/database/vacuum' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || (user.systemRole !== 'superuser' && user.systemRole !== 'admin' && user.systemRole !== 'hr')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses tidak mencukupi' });
        }
        const resVacuum = vacuumDatabase();
        addAuditLog({
          action: 'DATABASE_VACUUM',
          entity: 'system',
          entityId: 'SQLITE_VACUUM',
          userName: user.name || user.username,
          userLoginId: user.username,
          userRole: user.systemRole || user.role,
          module: 'DATABASE',
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
          status: 'SUCCESS',
          details: `Vacuum database berhasil dijalankan oleh ${user.username}. Menghemat ${resVacuum.savedKb} KB.`
        });
        return sendJson(200, { success: true, ...resVacuum });
      }

      // 12e. Export Data to JSON (Client-Side Flexible Processing)
      if (cleanUrl === '/api/database/export-data' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || (user.systemRole !== 'superuser' && user.systemRole !== 'admin' && user.systemRole !== 'hr' && user.systemRole !== 'finance')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses tidak mencukupi' });
        }
        const body = await readBody();
        const table = body.table || 'attendances';
        let rows = [];
        if (table === 'attendances') {
          rows = getAttendancesForExport(body);
        } else if (table === 'employees') {
          rows = getEmployeesForExport(user);
        } else if (table === 'projects') {
          rows = getProjectsForExport();
        }
        return sendJson(200, { success: true, table, count: rows.length, rows });
      }

      // 12f. Direct Server-Side Excel File Generation (.xlsx stream)
      if (cleanUrl === '/api/database/export-excel' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || (user.systemRole !== 'superuser' && user.systemRole !== 'admin' && user.systemRole !== 'hr' && user.systemRole !== 'finance')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses tidak mencukupi' });
        }
        const body = await readBody();
        const table = body.table || 'attendances';
        const wb = XLSX.utils.book_new();

        if (table === 'attendances' || table === 'all') {
          const attRows = getAttendancesForExport(body);
          const cleanAtt = attRows.map(r => {
            const { id, date, loginId, employeeId, nik, name, department, projectCode, projectName, checkInTime, checkOutTime, mode, status, approvalStatus, lateMinutes, note, ...displayOnly } = r;
            return displayOnly;
          });
          const wsAtt = XLSX.utils.json_to_sheet(cleanAtt.length > 0 ? cleanAtt : [{ 'Keterangan': 'Tidak ada data presensi pada rentang tanggal yang dipilih' }]);
          XLSX.utils.book_append_sheet(wb, wsAtt, 'Log Presensi');
        }

        if (table === 'employees' || table === 'all') {
          const empRows = getEmployeesForExport(user);
          const wsEmp = XLSX.utils.json_to_sheet(empRows);
          XLSX.utils.book_append_sheet(wb, wsEmp, 'Master Karyawan');
        }

        if (table === 'projects' || table === 'all') {
          const projRows = getProjectsForExport();
          const wsProj = XLSX.utils.json_to_sheet(projRows);
          XLSX.utils.book_append_sheet(wb, wsProj, 'Master Proyek');
        }

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const nowStr = new Date().toISOString().slice(0, 10);
        const filename = `DMJ_HRIS_${table.toUpperCase()}_${nowStr}.xlsx`;

        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length,
          'Cache-Control': 'no-cache'
        });
        return res.end(buffer);
      }

      // 12g. Batch Import from Excel (Replace or Add mode)
      if (cleanUrl === '/api/database/import-excel' && method === 'POST') {
        const token = getAuthToken();
        const user = token ? getCurrentUserFromToken(token) : null;
        if (!user || (user.systemRole !== 'superuser' && user.systemRole !== 'admin' && user.systemRole !== 'hr')) {
          return sendJson(403, { success: false, error: 'Forbidden: Hak akses tidak mencukupi untuk impor database' });
        }
        const body = await readBody();
        const table = body.table || 'attendances';
        const mode = body.mode || 'replace';
        const rows = body.rows || [];

        if (!Array.isArray(rows) || rows.length === 0) {
          return sendJson(400, { success: false, error: 'Format data kosong atau tidak valid' });
        }

        let result;
        if (table === 'attendances') {
          result = importAttendancesBatch(rows, mode, {
            ...user,
            clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
          });
        } else {
          return sendJson(400, { success: false, error: `Tabel ${table} belum mendukung impor batch saat ini` });
        }

        broadcastRealtimeEvent('DATABASE_SYNCED', {
          table,
          mode,
          updatedCount: result.summary.updated,
          insertedCount: result.summary.inserted,
          message: `Database berhasil disinkronisasi via Excel (${result.summary.updated} diperbarui, ${result.summary.inserted} ditambahkan)`
        });

        return sendJson(200, result);
      }
      return sendJson(404, { error: 'Not found' });
    } catch (err) {
      console.error(err);
      return sendJson(500, { error: err.message });
    }
  }

  // Static File Serving (from dist/) with Path Traversal Protection (CWE-22)
  const resolvedDist = path.resolve(distPath);
  let safeSubPath = cleanUrl === '/' ? '/index.html' : decodeURIComponent(cleanUrl);
  let filePath = path.resolve(resolvedDist, '.' + safeSubPath);

  // Security guard against directory traversal
  if (!filePath.startsWith(resolvedDist)) {
    return sendJson(403, { error: 'Forbidden' });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(resolvedDist, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Video Streaming with HTTP 206 Partial Content (Range requests)
  if (ext === '.mp4' || ext === '.webm') {
    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        fileStream.pipe(res);
        return;
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    } catch (err) {
      res.writeHead(500);
      res.end('Server Error streaming media');
      return;
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error loading asset');
      return;
    }
    const headers = { 'Content-Type': contentType };
    if (ext === '.html' || cleanUrl === '/sw.js' || cleanUrl.endsWith('.webmanifest') || cleanUrl.endsWith('manifest.json')) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    const acceptEncoding = req.headers['accept-encoding'] || '';
    const compressible = ['.js', '.css', '.html', '.json', '.svg', '.map'].includes(ext);

    if (compressible && acceptEncoding.includes('gzip') && content.length > 1024) {
      try {
        const gzipped = zlib.gzipSync(content);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = gzipped.length;
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        return res.end(gzipped);
      } catch (gzipErr) {}
    }

    headers['Content-Length'] = content.length;
    res.writeHead(200, headers);
    res.end(content);
  });
});

// ==========================================
// NATIVE WEBSOCKET SERVER ATTACHMENT
// ==========================================
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  wsClients.add(ws);
  const clientIp = req.headers['cf-connecting-ip'] || 
                   req.headers['x-real-ip'] || 
                   (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                   req.socket.remoteAddress || 
                   '127.0.0.1';

  console.log(`[WebSocket] Client connected from ${clientIp}. Total active WS: ${wsClients.size}`);

  const welcomePacket = JSON.stringify({
    type: 'CONNECTED',
    payload: {
      connected: true,
      protocol: 'websocket',
      clientsCount: wsClients.size,
      serverTimeMs: Date.now(),
      serverTimestamp: new Date().toISOString(),
      timeZone: 'Asia/Jakarta (WIB)'
    }
  });
  ws.send(welcomePacket);

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', serverTimeMs: Date.now() }));
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WebSocket] Client disconnected. Remaining WS: ${wsClients.size}`);
  });

  ws.on('error', (err) => {
    wsClients.delete(ws);
    console.warn(`[WebSocket Client Error]`, err?.message);
  });
});

server.listen(PORT, () => {
  console.log(`[Prime HRIS SQLite Server] Berjalan di http://localhost:${PORT}`);
  console.log(`[Database] File: ${dbPath}`);
  console.log(`[Realtime Engine] WebSocket & SSE aktif`);
  startWaBackgroundScheduler();
});
