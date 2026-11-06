/* eslint-disable react-hooks/rules-of-hooks */
require('dotenv').config();

const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const port = parseInt(process.env.WA_SERVICE_PORT || process.env.PORT || '9008', 10);
const authPath = process.env.WA_AUTH_PATH || path.join(__dirname, '.prime_wa_auth');

let sock = null;
let isInitializing = false;
let initPromise = null;
let initStartedAt = null;
let currentState = 'idle';
let lastError = null;
let lastQr = null;
let lastQrDataUrl = null;
let clientInfo = null;
let isClientReady = false;
let lastEventAt = null;
const serviceStartedAt = new Date().toISOString();

// Anti-Spam state variables
let lastSendTime = 0;

const logger = pino({ level: 'warn' });

function stampEvent() {
  lastEventAt = new Date().toISOString();
}

function setState(nextState, errorMessage = null) {
  currentState = nextState;
  lastError = errorMessage;
  stampEvent();
}

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`[PRIME WA] Sesi auth dihapus: ${folderPath}`);
    } catch (err) {
      console.error(`[PRIME WA] Gagal menghapus auth folder ${folderPath}:`, err.message);
    }
  }
}

function normalizePhone(raw) {
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

function normalizeJid(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.endsWith('@c.us')) return raw.replace('@c.us', '@s.whatsapp.net');
  if (raw.endsWith('@s.whatsapp.net')) return raw;
  if (raw.endsWith('@g.us')) return raw;

  const digits = raw.replace(/\D+/g, '');
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
  return `${normalized}@s.whatsapp.net`;
}

// =============================================================================
// MANDATORY OPT-IN REGISTRY
// User harus minimal mengetik 1 pesan ke nomor bot agar bot diizinkan mengirim notifikasi.
// =============================================================================
const optInsFile = path.join(__dirname, 'opt_ins.json');
let optInsCache = {};

function loadOptIns() {
  try {
    if (fs.existsSync(optInsFile)) {
      optInsCache = JSON.parse(fs.readFileSync(optInsFile, 'utf8'));
    }
  } catch (e) {
    optInsCache = {};
  }
}
loadOptIns();

function saveOptInsToFile() {
  try {
    fs.writeFileSync(optInsFile, JSON.stringify(optInsCache, null, 2), 'utf8');
  } catch (e) {
    console.error('[PRIME WA] Error saving opt_ins.json:', e.message);
  }
}

let gatewayDbInstance = null;
function getGatewayDb() {
  if (!gatewayDbInstance) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const sqlitePath = path.join(__dirname, '..', 'data', 'hris.sqlite');
      if (fs.existsSync(sqlitePath)) {
        gatewayDbInstance = new DatabaseSync(sqlitePath);
        gatewayDbInstance.exec('PRAGMA journal_mode = WAL;');
        gatewayDbInstance.exec('PRAGMA synchronous = NORMAL;');
        gatewayDbInstance.exec('PRAGMA busy_timeout = 5000;');
      }
    } catch (e) {
      console.warn('[PRIME WA] Error initializing gateway DB connection:', e.message);
    }
  }
  return gatewayDbInstance;
}

function hasOptedIn(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return false;

  // Check persistent SQLite database
  try {
    const db = getGatewayDb();
    if (db) {
      const row = db.prepare('SELECT is_active, manual_override, message_count, first_message FROM wa_opt_ins WHERE phone = ?;').get(norm);
      if (row) {
        // Syarat 1: Preferensi wajib aktif (is_active === 1; default adalah 0 / OFF)
        if (row.is_active !== 1) return false;
        // Syarat 2: Wajib telah mengirim minimal 1 pesan masuk ATAU otorisasi manual
        const hasRealChat = row.message_count > 0 && row.first_message && !row.first_message.includes('Master Data');
        return Boolean(hasRealChat || row.manual_override === 1);
      }
    }
  } catch (e) {}

  return false;
}

function recordOptIn(phone, messageText = '', pushName = '') {
  const norm = normalizePhone(phone);
  if (!norm) return null;

  const now = new Date().toISOString();
  const existing = optInsCache[norm];
  if (existing) {
    existing.messageCount = (existing.messageCount || 1) + 1;
    existing.lastMessage = messageText;
    existing.lastMessageAt = now;
    if (pushName) existing.pushName = pushName;
  } else {
    optInsCache[norm] = {
      phone: norm,
      pushName: pushName || '',
      firstMessage: messageText,
      firstMessageAt: now,
      lastMessage: messageText,
      lastMessageAt: now,
      messageCount: 1,
      optedIn: true
    };
  }

  saveOptInsToFile();

  // Sync to main SQLite database
  try {
    const db = getGatewayDb();
    if (db) {
      // Match employee by ID in message text or by phone number (token-efficient scan without heavy data_json)
      let matchedEmpId = null;
      let matchedEmpName = null;
      try {
        const empRows = db.prepare('SELECT id, nik, name, phone FROM employees;').all();
        for (const emp of empRows) {
          if (messageText && (messageText.toUpperCase().includes(emp.id) || (emp.nik && messageText.includes(emp.nik)))) {
            matchedEmpId = emp.id;
            matchedEmpName = emp.name;
            break;
          }
          const empDigits = String(emp.phone || '').replace(/\D+/g, '');
          let empNorm = empDigits;
          if (empNorm.startsWith('0')) empNorm = `62${empNorm.slice(1)}`;
          else if (empNorm.startsWith('8')) empNorm = `62${empNorm}`;
          if (empNorm === norm) {
            matchedEmpId = emp.id;
            matchedEmpName = emp.name;
            break;
          }
        }
      } catch (e) {}

      db.prepare(`
        INSERT INTO wa_opt_ins (phone, employee_id, employee_name, first_message, first_message_at, last_message, last_message_at, message_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(phone) DO UPDATE SET
          last_message = excluded.last_message,
          last_message_at = excluded.last_message_at,
          message_count = wa_opt_ins.message_count + 1,
          employee_id = COALESCE(excluded.employee_id, wa_opt_ins.employee_id),
          employee_name = COALESCE(excluded.employee_name, wa_opt_ins.employee_name);
      `).run(norm, matchedEmpId, matchedEmpName, messageText, now, messageText, now);
    }
  } catch (err) {
    console.warn('[PRIME WA] Error syncing opt-in to SQLite:', err.message);
  }

  return optInsCache[norm];
}

// Anti-Spam rate-limiting delay
async function throttle() {
  const now = Date.now();
  const minInterval = 2000 + Math.random() * 1500; // 2.0 to 3.5 seconds
  const timeSinceLastSend = now - lastSendTime;
  if (timeSinceLastSend < minInterval) {
    const delayMs = Math.round(minInterval - timeSinceLastSend);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  lastSendTime = Date.now();
}

async function buildClient() {
  isClientReady = false;
  clientInfo = null;

  console.log(`[PRIME WA] Menginisialisasi Baileys client mandiri di: ${authPath}`);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  let version = [2, 3000, 1017000000];
  try {
    const { version: latestVersion } = await fetchLatestBaileysVersion();
    version = latestVersion;
    console.log(`[PRIME WA] Menggunakan versi Baileys: ${version.join('.')}`);
  } catch (err) {
    console.warn('[PRIME WA] Menggunakan fallback versi Baileys:', err.message);
  }

  const instance = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    defaultQueryTimeoutMs: undefined
  });

  instance.ev.on('creds.update', saveCreds);

  instance.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      lastQr = qr;
      try {
        lastQrDataUrl = await qrcode.toDataURL(qr, { scale: 8, margin: 2 });
      } catch (err) {
        lastQrDataUrl = null;
        lastError = `Gagal membuat QR gambar: ${err.message}`;
      }
      setState('qr_required');
      console.log('[PRIME WA] QR Code baru siap di-scan untuk PRIME HRIS.');
    }

    if (connection === 'connecting') {
      isClientReady = false;
      setState('initializing');
      console.log('[PRIME WA] Menghubungkan ke server WhatsApp...');
    }

    if (connection === 'open') {
      isClientReady = true;
      const user = instance.user;
      clientInfo = {
        pushname: user.name || 'PRIME HRIS Bot',
        wid: user.id || null,
        phone: (user.id || '').split(':')[0] || null,
        platform: 'baileys-prime-hris'
      };
      lastQr = null;
      lastQrDataUrl = null;
      setState('ready');
      console.log(`[PRIME WA] ✅ Bot WhatsApp TERHUBUNG! Akun: +${clientInfo.phone} (${clientInfo.pushname})`);
    }

    if (connection === 'close') {
      isClientReady = false;
      clientInfo = null;

      let statusCode = null;
      try {
        const { Boom } = require('@hapi/boom');
        statusCode = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : null;
      } catch (e) {
        statusCode = lastDisconnect?.error?.output?.statusCode || null;
      }

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[PRIME WA] Koneksi terputus. Status code: ${statusCode}, auto-reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        setState('disconnected', lastDisconnect?.error?.message || 'Koneksi terputus');
        if (sock === instance) sock = null;
        setTimeout(() => {
          ensureClientStarted().catch(err => console.error('[PRIME WA] Gagal auto-reconnect:', err.message));
        }, 3000);
      } else {
        setState('logged_out', 'Perangkat diputuskan / logout oleh pengguna.');
        if (sock === instance) sock = null;
        deleteFolderRecursive(authPath);
      }
    }
  });

  // Listener Pesan Masuk (Incoming Messages) untuk Registrasi Mandatory Opt-In
  instance.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !Array.isArray(messages)) return;
    for (const msg of messages) {
      if (msg.key?.fromMe) continue; // Jangan proses pesan yang dikirim oleh bot sendiri
      const remoteJid = msg.key?.remoteJid;
      if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) continue; // Abaikan grup dan status broadcast

      const rawDigits = remoteJid.replace('@s.whatsapp.net', '').replace(/\D+/g, '');
      const normPhone = normalizePhone(rawDigits);
      if (!normPhone) continue;

      const text = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        ''
      ).trim();

      const pushName = msg.pushName || '';
      const isNewUser = !hasOptedIn(normPhone);

      // Catat opt-in ke memori lokal & basis data SQLite
      const rec = recordOptIn(normPhone, text, pushName);
      console.log(`[PRIME WA INCOMING] 📥 Pesan masuk dari +${normPhone} (${pushName || 'Tamu'}): "${text}". Status Opt-In Baru: ${isNewUser}`);

      // Auto-reply konfirmasi sambutan aktivasi untuk pengirim baru
      if (isNewUser) {
        try {
          const matchedName = rec?.employeeName || pushName || 'Rekan Karyawan';
          const replyText =
`*🤖 BOT NOTIFIKASI RESMI - PRIME HRIS*

Halo *${matchedName}*! 👋
Nomor WhatsApp Anda (*+${normPhone}*) telah *BERHASIL TERHUBUNG & TERVERIFIKASI* di sistem notifikasi otomatis PRIME HRIS.

Mulai sekarang, bot ini diizinkan untuk mengirimkan:
✅ Notifikasi Presensi Kehadiran (Masuk & Pulang)
✅ Konfirmasi Pengajuan Cuti, Izin, Lembur & Dinas Luar
✅ Update Status Persetujuan & Peringatan Keterlambatan
✅ Slip Gaji Digital Bulanan & Kredensial Akun

_Terima kasih telah melakukan aktivasi notifikasi. Selamat beraktivitas!_
🌐 https://hris.primeprojectx.net`;

          await throttle();
          await instance.sendMessage(remoteJid, { text: replyText });
          console.log(`[PRIME WA AUTO-REPLY] ✅ Konfirmasi aktivasi terkirim ke +${normPhone}`);
        } catch (err) {
          console.error(`[PRIME WA AUTO-REPLY ERROR] Gagal mengirim balasan ke +${normPhone}:`, err.message);
        }
      }
    }
  });

  return instance;
}

async function ensureClientStarted() {
  if (sock && isClientReady) return sock;
  if (initPromise) return initPromise;

  isInitializing = true;
  initStartedAt = new Date().toISOString();
  setState('initializing');

  initPromise = buildClient()
    .then((instance) => {
      sock = instance;
      return sock;
    })
    .catch((err) => {
      isClientReady = false;
      setState('error', err.message);
      throw err;
    })
    .finally(() => {
      isInitializing = false;
      initPromise = null;
    });

  return initPromise;
}

async function destroyClient({ logout = false } = {}) {
  if (!sock) return;

  const instance = sock;
  sock = null;
  initPromise = null;
  isInitializing = false;
  isClientReady = false;
  clientInfo = null;
  lastQr = null;
  lastQrDataUrl = null;

  try {
    if (logout) await instance.logout();
  } catch (err) {
    console.error('[PRIME WA] Error saat logout:', err.message);
  }

  try {
    instance.end();
  } catch (err) {
    console.error('[PRIME WA] Error saat menutup koneksi:', err.message);
  }

  if (logout) {
    deleteFolderRecursive(authPath);
  }
}

function getStatusPayload() {
  return {
    success: true,
    service: 'PRIME HRIS Dedicated WhatsApp Gateway',
    port,
    status: currentState,
    serviceStartedAt,
    processId: process.pid,
    initStartedAt,
    isInitializing,
    isReady: isClientReady,
    hasQr: Boolean(lastQrDataUrl),
    qrDataUrl: lastQrDataUrl,
    clientInfo,
    clientState: isClientReady ? 'connected' : (currentState === 'initializing' ? 'connecting' : 'disconnected'),
    lastError,
    lastEventAt
  };
}

// REST Endpoints
app.get('/status', async (_req, res) => {
  res.json(getStatusPayload());
});

app.post('/connect', async (_req, res) => {
  try {
    ensureClientStarted().catch(err => console.error('[PRIME WA] Gagal inisialisasi:', err.message));
    res.json({
      success: true,
      message: 'PRIME WhatsApp Gateway initialization started.',
      ...getStatusPayload()
    });
  } catch (err) {
    setState('error', err.message);
    res.status(500).json({ success: false, message: err.message, ...getStatusPayload() });
  }
});

app.post('/restart', async (_req, res) => {
  try {
    await destroyClient();
    setState('restarting');
    ensureClientStarted().catch(err => console.error('[PRIME WA] Gagal restart:', err.message));
    res.json({
      success: true,
      message: 'PRIME WhatsApp Gateway restarted.',
      ...getStatusPayload()
    });
  } catch (err) {
    setState('error', err.message);
    res.status(500).json({ success: false, message: err.message, ...getStatusPayload() });
  }
});

app.post('/logout', async (_req, res) => {
  try {
    await destroyClient({ logout: true });
    setState('logged_out');
    res.json({
      success: true,
      message: 'Bot WhatsApp berhasil diputuskan (logout). Sesi mandiri dibersihkan.',
      ...getStatusPayload()
    });
  } catch (err) {
    setState('error', err.message);
    res.status(500).json({ success: false, message: err.message, ...getStatusPayload() });
  }
});

app.get('/opt-ins', (_req, res) => {
  res.json({
    success: true,
    count: Object.keys(optInsCache).length,
    optIns: Object.values(optInsCache)
  });
});

app.get('/check-opt-in/:phone', (req, res) => {
  const phone = req.params.phone;
  const optedIn = hasOptedIn(phone);
  res.json({
    success: true,
    phone,
    optedIn,
    info: optInsCache[normalizePhone(phone)] || null
  });
});

app.post('/send', async (req, res) => {
  const { phone, message, force } = req.body || {};
  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'Phone dan message wajib disertakan' });
  }

  const jid = normalizeJid(phone);
  if (!jid) {
    return res.status(400).json({ success: false, error: `Format nomor telepon tidak valid: ${phone}` });
  }

  const rawDigits = jid.replace('@s.whatsapp.net', '').replace(/\D+/g, '');

  // MANDATORY SECURITY GATE:
  // User HARUS minimal mengetik 1 pesan masuk ke nomor BOT dan preferensi ON
  if (!force && !hasOptedIn(rawDigits)) {
    console.warn(`[PRIME WA OPT-IN GATE] 🚫 Pengiriman ke +${rawDigits} ditolak: User belum memenuhi syarat opt-in atau preferensi notifikasi OFF.`);
    return res.status(403).json({
      success: false,
      optInRequired: true,
      error: `Penerima (+${rawDigits}) dinonaktifkan dari notifikasi WhatsApp (Default OFF) atau belum pernah mengetik pesan masuk ke bot. User wajib minimal mengirim 1 pesan masuk terlebih dahulu dan diaktifkan via menu WA.`
    });
  }

  try {
    const client = await ensureClientStarted();
    if (!isClientReady || !client) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp Bot belum siap atau belum di-scan QR.',
        ...getStatusPayload()
      });
    }

    await throttle();
    const sent = await client.sendMessage(jid, { text: String(message).trim() });

    res.json({
      success: true,
      message: 'Pesan berhasil terkirim via PRIME HRIS WhatsApp Gateway.',
      messageId: sent.key?.id || null,
      recipient: jid
    });
  } catch (err) {
    console.error('[PRIME WA] Gagal mengirim pesan ke ' + jid + ':', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Web Pairing Dashboard
app.get('/', (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PRIME HRIS - WhatsApp Gateway Mandiri</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
      body { font-family: 'Plus Jakarta Sans', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center">
        <!-- Glow accents -->
        <div class="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-40 h-40 bg-orange-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Header -->
        <div class="flex items-center justify-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/25">
                <div class="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center text-emerald-400 text-2xl">
                    <i class="bi bi-whatsapp"></i>
                </div>
            </div>
            <div class="text-left">
                <h1 class="text-base font-black text-white tracking-wide">PRIME HRIS WA GATEWAY</h1>
                <p class="text-[11px] font-mono text-emerald-400 font-bold">PORT 9008 • SESI MANDIRI</p>
            </div>
        </div>

        <!-- Status Badge -->
        <div id="statusBadge" class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300 mb-6">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span id="statusText">Memeriksa Status...</span>
        </div>

        <!-- QR Display Box -->
        <div id="qrBox" class="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col items-center justify-center min-h-[280px]">
            <div id="qrSpinner" class="flex flex-col items-center gap-3 text-slate-400">
                <i class="bi bi-arrow-repeat text-3xl animate-spin text-emerald-400"></i>
                <span class="text-xs font-mono">Memuat QR Code...</span>
            </div>
            <img id="qrImage" src="" alt="WhatsApp QR Code" class="hidden w-64 h-64 rounded-xl border border-slate-700 shadow-lg bg-white p-2">
            <div id="connectedBox" class="hidden flex flex-col items-center gap-3 text-emerald-400 py-6">
                <div class="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
                    <i class="bi bi-check-circle-fill text-emerald-400"></i>
                </div>
                <h3 class="text-base font-bold text-white">Bot WhatsApp Terhubung!</h3>
                <p id="connectedPhone" class="text-xs font-mono text-emerald-300 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30">-</p>
                <p class="text-[11px] text-slate-400 max-w-xs mt-1">Layanan siap mengirimkan notifikasi presensi, keterlambatan, dan approval resmi PT Prime Infinity Systems.</p>
            </div>
        </div>

        <!-- Instructions -->
        <div id="qrInstructions" class="text-left bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 mb-6 text-xs text-slate-400 space-y-1.5">
            <p class="font-bold text-slate-300 flex items-center gap-1.5"><i class="bi bi-info-circle text-emerald-400"></i> Cara Menghubungkan:</p>
            <ol class="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                <li>Buka WhatsApp di HP Anda (nomor khusus Bot HRIS).</li>
                <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                <li>Arahkan kamera ke QR Code di atas.</li>
            </ol>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-3">
            <button onclick="restartClient()" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <i class="bi bi-arrow-clockwise"></i> Refresh QR
            </button>
            <button onclick="logoutClient()" class="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-xs font-bold text-rose-300 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <i class="bi bi-box-arrow-right"></i> Putuskan / Logout
            </button>
        </div>
    </div>

    <script>
        async function fetchStatus() {
            try {
                const res = await fetch('/status');
                const data = await res.json();
                updateUI(data);
            } catch (err) {
                console.warn('Status fetch error:', err);
            }
        }

        function updateUI(data) {
            const badge = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            const spinner = document.getElementById('qrSpinner');
            const qrImg = document.getElementById('qrImage');
            const connectedBox = document.getElementById('connectedBox');
            const connectedPhone = document.getElementById('connectedPhone');
            const instr = document.getElementById('qrInstructions');

            if (data.isReady) {
                badge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 mb-6';
                statusText.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> ONLINE • TERHUBUNG';

                spinner.classList.add('hidden');
                qrImg.classList.add('hidden');
                connectedBox.classList.remove('hidden');
                instr.classList.add('hidden');

                if (data.clientInfo && data.clientInfo.phone) {
                    connectedPhone.innerText = '+' + data.clientInfo.phone + ' (' + (data.clientInfo.pushname || 'PRIME Bot') + ')';
                }
            } else if (data.hasQr && data.qrDataUrl) {
                badge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400 mb-6';
                statusText.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> SCAN QR UNTUK LOGIN';

                spinner.classList.add('hidden');
                connectedBox.classList.add('hidden');
                qrImg.src = data.qrDataUrl;
                qrImg.classList.remove('hidden');
                instr.classList.remove('hidden');
            } else {
                badge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300 mb-6';
                statusText.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ' + (data.status || 'Menginisialisasi...');

                spinner.classList.remove('hidden');
                qrImg.classList.add('hidden');
                connectedBox.classList.add('hidden');
            }
        }

        async function restartClient() {
            try {
                await fetch('/restart', { method: 'POST' });
                fetchStatus();
            } catch (err) {
                alert('Gagal restart client: ' + err.message);
            }
        }

        async function logoutClient() {
            if (confirm('Yakin ingin memutuskan koneksi Bot WhatsApp PRIME HRIS ini? Anda harus melakukan scan QR ulang setelahnya.')) {
                try {
                    await fetch('/logout', { method: 'POST' });
                    fetchStatus();
                } catch (err) {
                    alert('Gagal logout: ' + err.message);
                }
            }
        }

        fetchStatus();
        setInterval(fetchStatus, 3000);
    </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.listen(port, async () => {
  console.log(`[PRIME WA] Dedicated Gateway mendengarkan di http://127.0.0.1:${port}`);
  ensureClientStarted().catch(err => {
    setState('error', err.message);
    console.error('[PRIME WA] Gagal auto-start WhatsApp client:', err.message);
  });
});
