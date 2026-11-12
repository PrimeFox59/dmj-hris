import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Determine root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'hris.sqlite');
const seedPath = path.join(dataDir, 'seedData.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Persistent Auth Secret for HMAC Signatures
const secretPath = path.join(dataDir, 'auth.secret');
let AUTH_SECRET = '';
if (fs.existsSync(secretPath)) {
  AUTH_SECRET = fs.readFileSync(secretPath, 'utf-8').trim();
} else {
  AUTH_SECRET = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, AUTH_SECRET, 'utf-8');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  try {
    const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
  } catch (e) {
    return false;
  }
}

export function generateToken(user) {
  const payload = {
    userId: user.id,
    employeeId: user.employee_id || user.employeeId,
    role: user.role,
    systemRole: user.system_role || user.systemRole,
    username: user.username,
    email: user.email,
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days persistent session
  };
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(json).digest('base64url');
  return `${json}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [json, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(json).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    // Mandatory High-Performance PRAGMAs (Per-Connection)
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA temp_store = MEMORY;');
    dbInstance.exec('PRAGMA cache_size = -32000;');
    dbInstance.exec('PRAGMA mmap_size = 268435456;');
    dbInstance.exec('PRAGMA busy_timeout = 5000;');
    dbInstance.exec('PRAGMA wal_autocheckpoint = 1000;');
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

export function getDbInfo() {
  let sizeBytes = 0;
  if (fs.existsSync(dbPath)) {
    sizeBytes = fs.statSync(dbPath).size;
  }
  return {
    engine: 'SQLite 3 (Native node:sqlite)',
    journalMode: 'WAL (Write-Ahead Logging)',
    dbPath,
    sizeBytes,
    sizeKb: Math.round(sizeBytes / 1024 * 10) / 10
  };
}

function initializeSchema(db) {

  db.exec(`
    CREATE TABLE IF NOT EXISTS casual_workers (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdBy TEXT,
      createdByName TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS casual_worker_attendances (
      id TEXT PRIMARY KEY,
      workerId TEXT NOT NULL,
      workerName TEXT NOT NULL,
      projectId TEXT NOT NULL,
      date TEXT NOT NULL,
      checkInTime TEXT NOT NULL,
      photoUrl TEXT,
      latitude REAL,
      longitude REAL,
      address TEXT,
      notes TEXT,
      verifiedByPmId TEXT NOT NULL,
      verifiedByPmName TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cwa_proj_date ON casual_worker_attendances (projectId, date);
    CREATE INDEX IF NOT EXISTS idx_cw_proj ON casual_workers (projectId);
  `);

  try {
    db.exec('ALTER TABLE approvals ADD COLUMN attendanceRecordId TEXT;');
  } catch (e) {}
try {
    db.exec('ALTER TABLE attendances ADD COLUMN updated_at TEXT;');
  } catch (e) {}

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA cache_size = -32000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      nik TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      department TEXT,
      position TEXT,
      employmentType TEXT,
      joinDate TEXT,
      assignedProjectId TEXT,
      baseSalary REAL,
      fixedAllowance REAL,
      dailyAllowance REAL,
      leaveQuota INTEGER,
      usedLeave INTEGER,
      bankAccount TEXT,
      avatar TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      client TEXT,
      location TEXT,
      status TEXT,
      startDate TEXT,
      targetEndDate TEXT,
      allocatedBudget REAL,
      actualLaborCost REAL,
      projectedLaborCost REAL,
      totalEstimatedHours REAL,
      actualHoursSpent REAL,
      hourlyRateMultiplier REAL,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      employeeNik TEXT NOT NULL,
      department TEXT,
      date TEXT NOT NULL,
      checkInTime TEXT NOT NULL,
      checkOutTime TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      photoUrl TEXT,
      isLate INTEGER DEFAULT 0,
      lateMinutes INTEGER DEFAULT 0,
      lateReason TEXT,
      approvalStatus TEXT DEFAULT 'NOT_REQUIRED',
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      employeeNik TEXT NOT NULL,
      department TEXT,
      title TEXT NOT NULL,
      description TEXT,
      startDate TEXT,
      endDate TEXT,
      daysCount INTEGER,
      lateMinutes INTEGER,
      status TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      reviewedBy TEXT,
      reviewedAt TEXT,
      reviewNote TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_rules (
      id TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS annual_work_calendar (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      weeklyOffDays TEXT NOT NULL,
      defaultCutoffStartDay INTEGER DEFAULT 21,
      defaultCutoffEndDay INTEGER DEFAULT 20,
      defaultPaydayDate INTEGER DEFAULT 25,
      periods_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS reimbursements (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      employeeNik TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      receiptAttachment TEXT,
      projectId TEXT,
      projectName TEXT,
      status TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      reviewedBy TEXT,
      reviewedAt TEXT,
      rejectReason TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT,
      details TEXT,
      userName TEXT DEFAULT 'System',
      userNik TEXT,
      userLoginId TEXT,
      userRole TEXT DEFAULT 'system',
      module TEXT DEFAULT 'SYSTEM',
      ipAddress TEXT DEFAULT '127.0.0.1',
      status TEXT DEFAULT 'SUCCESS',
      metadata TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure audit_logs columns exist (backward-compatible schema migration)
  try {
    const existingAuditCols = db.prepare('PRAGMA table_info(audit_logs);').all().map(c => c.name);
    const newAuditCols = [
      { name: 'userName', def: "TEXT DEFAULT 'System'" },
      { name: 'userNik', def: "TEXT" },
      { name: 'userLoginId', def: "TEXT" },
      { name: 'userRole', def: "TEXT DEFAULT 'system'" },
      { name: 'module', def: "TEXT DEFAULT 'SYSTEM'" },
      { name: 'ipAddress', def: "TEXT DEFAULT '127.0.0.1'" },
      { name: 'status', def: "TEXT DEFAULT 'SUCCESS'" },
      { name: 'metadata', def: "TEXT" }
    ];
    for (const col of newAuditCols) {
      if (!existingAuditCols.includes(col.name)) {
        try {
          db.exec(`ALTER TABLE audit_logs ADD COLUMN ${col.name} ${col.def};`);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Ensure attendances columns exist (backward-compatible schema migration)
  try {
    const existingAttCols = db.prepare('PRAGMA table_info(attendances);').all().map(c => c.name);
    if (!existingAttCols.includes('attendanceType')) {
      try {
        db.exec('ALTER TABLE attendances ADD COLUMN attendanceType TEXT DEFAULT "CHECK_IN";');
      } catch (e) {}
    }
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL,
      system_role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wa_notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT,
      recipient_name TEXT,
      recipient_phone TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'SENT',
      error_msg TEXT,
      metadata TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wa_opt_ins (
      phone TEXT PRIMARY KEY,
      employee_id TEXT,
      employee_name TEXT,
      first_message TEXT,
      first_message_at TEXT,
      last_message TEXT,
      last_message_at TEXT,
      message_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      manual_override INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT,
      recipient_name TEXT,
      recipient_email TEXT NOT NULL,
      event_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT,
      text_body TEXT,
      status TEXT DEFAULT 'SENT',
      error_msg TEXT,
      metadata TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema migration & purge synthetic opt-in rows in wa_opt_ins
  try {
    const waCols = db.prepare("PRAGMA table_info(wa_opt_ins);").all();
    const colNames = waCols.map(c => c.name);
    if (!colNames.includes('is_active')) {
      db.exec("ALTER TABLE wa_opt_ins ADD COLUMN is_active INTEGER DEFAULT 0;");
    }
    if (!colNames.includes('manual_override')) {
      db.exec("ALTER TABLE wa_opt_ins ADD COLUMN manual_override INTEGER DEFAULT 0;");
    }

    // Purge fake synthetic opt-in entries previously generated from Master Data
    db.exec(`
      DELETE FROM wa_opt_ins 
      WHERE first_message LIKE '%Master Data%' 
         OR first_message LIKE '%Terverifikasi%'
         OR (message_count = 1 AND first_message = last_message AND first_message IS NOT NULL);
    `);
  } catch (errMigWa) {
    console.warn('[DB Migration] wa_opt_ins migration notice:', errMigWa.message);
  }

  // Synchronize and heal any obsolete or timestamp-based employeeLoginId in attendances from Master Karyawan (SSOT)
  try {
    const empList = db.prepare('SELECT id, nik, name, data_json FROM employees;').all();
    const empLoginMap = new Map();
    for (const e of empList) {
      try {
        const d = JSON.parse(e.data_json);
        const lId = d.loginId || (e.id === 'EMP-001' ? 'admin' : null);
        if (lId) {
          if (e.id) empLoginMap.set(e.id, lId);
          if (e.nik) empLoginMap.set(e.nik, lId);
          if (e.name) empLoginMap.set(e.name.toLowerCase().trim(), lId);
        }
      } catch (errParse) {}
    }

    const atts = db.prepare('SELECT id, employeeId, employeeNik, employeeName, data_json FROM attendances;').all();
    const updateAttStmt = db.prepare('UPDATE attendances SET data_json = ? WHERE id = ?;');
    for (const att of atts) {
      try {
        const d = JSON.parse(att.data_json);
        const canonical = empLoginMap.get(att.employeeId) || 
                          (att.employeeNik && empLoginMap.get(att.employeeNik)) || 
                          (att.employeeName && empLoginMap.get(att.employeeName.toLowerCase().trim()));
        if (canonical && d.employeeLoginId !== canonical) {
          d.employeeLoginId = canonical;
          updateAttStmt.run(JSON.stringify(d), att.id);
        }
      } catch (errAtt) {}
    }
  } catch (errSyncAtt) {
    console.warn('[DB Migration] attendance loginId sync notice:', errSyncAtt.message);
  }

  // Ensure systemRole is populated & normalized in existing employees data_json
  try {
    const rows = db.prepare('SELECT id, data_json FROM employees;').all();
    const updateEmpStmt = db.prepare('UPDATE employees SET data_json = ? WHERE id = ?;');
    for (const r of rows) {
      let parsed = JSON.parse(r.data_json);
      if (!parsed.systemRole || parsed.systemRole === 'manager') {
        const pos = (parsed.position || '').toUpperCase();
        const dept = (parsed.department || '').toUpperCase();
        if (parsed.id === 'EMP-001') {
          parsed.systemRole = 'superuser';
        } else if (pos.includes('HR') || pos.includes('HRD') || dept.includes('HR') || dept.includes('HRD')) {
          parsed.systemRole = 'hr';
        } else if (
          pos.includes('FINANCE') || pos.includes('ACCOUNTING') || pos.includes('PAJAK') || pos.includes('TAX') || pos.includes('FAT') ||
          dept.includes('FINANCE') || dept.includes('ACCOUNTING') || dept.includes('FAT')
        ) {
          parsed.systemRole = 'finance';
        } else {
          parsed.systemRole = 'staff';
        }
        updateEmpStmt.run(JSON.stringify(parsed), r.id);
      }
    }
    // Synchronize user_accounts.system_role from employee's canonical systemRole
    db.prepare(`
      UPDATE user_accounts 
      SET system_role = (
        SELECT json_extract(e.data_json, '$.systemRole')
        FROM employees e 
        WHERE e.id = user_accounts.employee_id
      )
      WHERE employee_id IS NOT NULL 
        AND employee_id != 'EMP-001'
        AND EXISTS (
          SELECT 1 FROM employees e 
          WHERE e.id = user_accounts.employee_id 
            AND json_extract(e.data_json, '$.systemRole') IS NOT NULL
        );
    `).run();
    db.prepare("UPDATE user_accounts SET system_role = 'superuser' WHERE employee_id = 'EMP-001' OR username IN ('admin', 'galih');").run();
  } catch (e) {
    console.warn('[SQLite] Failed migration of systemRole in employees', e);
  }

  // Ensure maritalStatus and ptkpStatus (PPh 21) are populated and normalized in existing employees data_json
  try {
    const rows = db.prepare('SELECT id, data_json FROM employees;').all();
    const updateEmpStmt = db.prepare('UPDATE employees SET data_json = ? WHERE id = ?;');
    for (const r of rows) {
      let parsed = JSON.parse(r.data_json);
      let changed = false;

      // Normalize maritalStatus
      let rawMs = String(parsed.maritalStatus || '').trim().toUpperCase();
      let normMs = 'TK';
      if (rawMs === 'K/I' || rawMs.includes('ISTRI') || rawMs.includes('GABUNG')) {
        normMs = 'K/I';
      } else if (rawMs === 'K' || rawMs === 'KAWIN' || rawMs === 'MENIKAH' || rawMs === 'MARRIED') {
        normMs = 'K';
      } else {
        normMs = 'TK';
      }

      if (parsed.maritalStatus !== normMs) {
        parsed.maritalStatus = normMs;
        changed = true;
      }

      if (parsed.dependents === undefined || parsed.dependents === null || isNaN(Number(parsed.dependents))) {
        parsed.dependents = 0;
        changed = true;
      } else {
        parsed.dependents = Math.min(3, Math.max(0, parseInt(parsed.dependents, 10) || 0));
      }

      const expectedPtkp = `${normMs}/${parsed.dependents}`;
      if (!parsed.ptkpStatus || parsed.ptkpStatus !== expectedPtkp) {
        parsed.ptkpStatus = expectedPtkp;
        changed = true;
      }

      if (changed) {
        updateEmpStmt.run(JSON.stringify(parsed), r.id);
      }
    }
  } catch (errPtkpSync) {
    console.warn('[SQLite] Failed migration of maritalStatus / ptkpStatus in employees:', errPtkpSync.message);
  }

  const empCount = db.prepare('SELECT count(*) as count FROM employees;').get()?.count || 0;
  if (empCount === 0) {
    seedInitialData(db);
  }

  const userCount = db.prepare('SELECT count(*) as count FROM user_accounts;').get()?.count || 0;
  if (userCount === 0) {
    seedDefaultUsers(db);
  }

  const logCount = db.prepare('SELECT count(*) as count FROM audit_logs;').get()?.count || 0;
  if (logCount < 10) {
    seedRealisticAuditLogs(db);
  }

  // -------------------------------------------------------------
  // HIGH-PERFORMANCE COVERING & COMPOSITE INDEXES
  // -------------------------------------------------------------
  db.exec(`
    -- Attendances High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_att_date_time ON attendances (date DESC, checkInTime DESC);
    CREATE INDEX IF NOT EXISTS idx_att_date_latest ON attendances (date DESC, COALESCE(checkOutTime, checkInTime) DESC, checkInTime DESC);
    CREATE INDEX IF NOT EXISTS idx_att_emp_date ON attendances (employeeId, date DESC);
    CREATE INDEX IF NOT EXISTS idx_att_nik ON attendances (employeeNik);
    CREATE INDEX IF NOT EXISTS idx_att_status ON attendances (status, date DESC);

    -- Audit Logs High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity, entityId);
    CREATE INDEX IF NOT EXISTS idx_audit_login_user ON audit_logs (userLoginId, timestamp DESC);

    -- Approvals High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_app_emp_submitted ON approvals (employeeId, submittedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_app_status_submitted ON approvals (status, submittedAt DESC);

    -- Employees High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_emp_nik ON employees (nik);
    CREATE INDEX IF NOT EXISTS idx_emp_dept ON employees (department);
    CREATE INDEX IF NOT EXISTS idx_emp_proj ON employees (assignedProjectId);

    -- User Accounts Index
    CREATE INDEX IF NOT EXISTS idx_ua_emp_id ON user_accounts (employee_id);

    -- Reimbursements High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_reimb_emp_date ON reimbursements (employeeId, date DESC);
    CREATE INDEX IF NOT EXISTS idx_reimb_status ON reimbursements (status, date DESC);

    -- Notifications High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_wan_phone_sent ON wa_notifications (recipient_phone, sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wan_sent ON wa_notifications (sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_recipient_sent ON email_notifications (recipient_email, sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_sent ON email_notifications (sent_at DESC);

    -- WhatsApp Opt-Ins High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_wa_opt_emp ON wa_opt_ins (employee_id);
    CREATE INDEX IF NOT EXISTS idx_wa_opt_active ON wa_opt_ins (is_active, message_count);
  `);

  // Query Planner Optimization
  try {
    db.exec('PRAGMA optimize;');
  } catch (eOpt) {}

  // Automatically deduplicate any historical attendance records or pending attendance approvals
  cleanupDuplicateAttendanceAndApprovals(db);
}

/**
 * Automatically deduplicate any historical attendance records or pending attendance approvals
 * Ensures strictly 1 attendance record per employee per date and at most 1 pending approval per category.
 */
export function cleanupDuplicateAttendanceAndApprovals(db) {
  try {
    // 1. Clean duplicate attendance rows (keep latest by id)
    const attDups = db.prepare(`
      SELECT employeeId, date, count(1) as cnt 
      FROM attendances 
      GROUP BY employeeId, date 
      HAVING count(1) > 1;
    `).all();

    for (const dup of attDups) {
      const rows = db.prepare(`
        SELECT id, checkInTime, checkOutTime, photoUrl, photoOutUrl, data_json 
        FROM attendances 
        WHERE employeeId = ? AND date = ? 
        ORDER BY id DESC;
      `).all(dup.employeeId, dup.date);
      // Keep rows[0], delete rows[1..]
      for (let i = 1; i < rows.length; i++) {
        db.prepare('DELETE FROM attendances WHERE id = ?;').run(rows[i].id);
      }
    }

    // 2. Clean duplicate pending attendance approvals
    const apprDups = db.prepare(`
      SELECT employeeId, startDate, count(1) as cnt 
      FROM approvals 
      WHERE status = 'PENDING' 
        AND type IN ('LATE_JUSTIFICATION', 'OUT_OF_GEOFENCE', 'DINAS_LUAR', 'ATTENDANCE_CORRECTION', 'EARLY_CHECKOUT') 
      GROUP BY employeeId, startDate 
      HAVING count(1) > 1;
    `).all();

    for (const dup of apprDups) {
      const pendingApps = db.prepare(`
        SELECT id, type, submittedAt, data_json 
        FROM approvals 
        WHERE employeeId = ? AND startDate = ? AND status = 'PENDING'
          AND type IN ('LATE_JUSTIFICATION', 'OUT_OF_GEOFENCE', 'DINAS_LUAR', 'ATTENDANCE_CORRECTION', 'EARLY_CHECKOUT')
        ORDER BY submittedAt DESC, id DESC;
      `).all(dup.employeeId, dup.startDate);

      let keptCheckIn = null;
      let keptEarly = null;

      // Check if employee has an on-time attendance for that date
      const attRow = db.prepare(`
        SELECT id, status, isLate, approvalStatus 
        FROM attendances 
        WHERE employeeId = ? AND date = ?;
      `).get(dup.employeeId, dup.startDate);

      const isAttApprovedOnTime = attRow && (attRow.status === 'ON_TIME' && !attRow.isLate && attRow.approvalStatus === 'APPROVED');

      for (const app of pendingApps) {
        if (app.type === 'EARLY_CHECKOUT') {
          if (!keptEarly) {
            keptEarly = app;
          } else {
            db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
          }
        } else {
          // If the actual attendance record is ON_TIME and APPROVED, delete orphaned pending check-in approvals
          if (isAttApprovedOnTime) {
            db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
            continue;
          }

          if (!keptCheckIn) {
            // Prefer canonical APPR- prefix if available
            const canonical = pendingApps.find(a => a.type !== 'EARLY_CHECKOUT' && a.id.startsWith('APPR-'));
            keptCheckIn = canonical || app;
            if (app.id !== keptCheckIn.id) {
              db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
            }
          } else if (app.id !== keptCheckIn.id) {
            db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CLEANUP_DUPLICATE_ATTENDANCE_WARN]', err.message);
  }
}

export function seedInitialData(db) {
  console.log('[SQLite] Inisialisasi & Seeding data awal Prime HRIS Enterprise...');
  if (!fs.existsSync(seedPath)) {
    console.warn('[SQLite] seedData.json tidak ditemukan di:', seedPath);
    return;
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  // 1. Employees
  const insertEmp = db.prepare(`
    INSERT OR REPLACE INTO employees (
      id, nik, name, email, phone, role, department, position,
      employmentType, joinDate, assignedProjectId, baseSalary,
      fixedAllowance, dailyAllowance, leaveQuota, usedLeave,
      bankAccount, avatar, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const emp of seed.INITIAL_EMPLOYEES || []) {
    insertEmp.run(
      emp.id, emp.nik, emp.name, emp.email, emp.phone, emp.role,
      emp.department, emp.position, emp.employmentType, emp.joinDate,
      emp.assignedProjectId, emp.baseSalary, emp.fixedAllowance,
      emp.dailyAllowance, emp.leaveQuota, emp.usedLeave,
      JSON.stringify(emp.bankAccount), emp.avatar, JSON.stringify(emp)
    );
  }

  // 2. Projects
  const insertProj = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, code, name, client, location, status, startDate,
      targetEndDate, allocatedBudget, actualLaborCost, projectedLaborCost,
      totalEstimatedHours, actualHoursSpent, hourlyRateMultiplier, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const proj of seed.INITIAL_PROJECTS || []) {
    insertProj.run(
      proj.id, proj.code, proj.name, proj.client, proj.location,
      proj.status, proj.startDate, proj.targetEndDate, proj.allocatedBudget,
      proj.actualLaborCost, proj.projectedLaborCost, proj.totalEstimatedHours,
      proj.actualHoursSpent, proj.hourlyRateMultiplier, JSON.stringify(proj)
    );
  }

  // 3. Attendances
  const insertAtt = db.prepare(`
    INSERT OR REPLACE INTO attendances (
      id, employeeId, employeeName, employeeNik, department,
      date, checkInTime, checkOutTime, mode, status,
      photoUrl, isLate, lateMinutes, lateReason,
      approvalStatus, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const att of seed.INITIAL_ATTENDANCE || []) {
    insertAtt.run(
      att.id, att.employeeId, att.employeeName, att.employeeNik,
      att.department, att.date, att.checkInTime, att.checkOutTime || null,
      att.mode, att.status, att.photoUrl, att.isLate ? 1 : 0,
      att.lateMinutes, att.lateReason || null, att.approvalStatus,
      JSON.stringify(att)
    );
  }

  // 4. Approvals
  const insertAppr = db.prepare(`
    INSERT OR REPLACE INTO approvals (
      id, type, employeeId, employeeName, employeeNik, department,
      title, description, startDate, endDate, daysCount, lateMinutes,
      status, submittedAt, reviewedBy, reviewedAt, reviewNote, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const appr of seed.INITIAL_APPROVALS || []) {
    insertAppr.run(
      appr.id, appr.type, appr.employeeId, appr.employeeName,
      appr.employeeNik, appr.department, appr.title, appr.description,
      appr.startDate, appr.endDate || null, appr.daysCount || null,
      appr.lateMinutes || null, appr.status, appr.submittedAt,
      appr.reviewedBy || null, appr.reviewedAt || null, appr.reviewNote || null,
      JSON.stringify(appr)
    );
  }

  // 5. Salary Rules
  if (seed.INITIAL_SALARY_RULES) {
    db.prepare(`
      INSERT OR REPLACE INTO salary_rules (id, config_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP);
    `).run('default', JSON.stringify(seed.INITIAL_SALARY_RULES));
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `).run('INIT_DATABASE', 'DATABASE', 'hris.sqlite', 'Initial database seeding executed successfully');

  console.log('[SQLite] Seeding selesai!');
}

export function getAllData() {
  const db = getDatabase();
  const userMap = new Map();
  const userRoleMap = new Map();
  try {
    const userRows = db.prepare('SELECT employee_id, username, system_role, role FROM user_accounts;').all();
    for (const u of userRows) {
      if (u.employee_id && !userMap.has(u.employee_id)) {
        userMap.set(u.employee_id, u.username);
        userRoleMap.set(u.employee_id, { systemRole: u.system_role, role: u.role });
      }
    }
  } catch (e) {}

  const employees = db.prepare('SELECT id, assignedProjectId, data_json FROM employees ORDER BY name ASC;').all().map(r => {
    let emp = {};
    try { emp = JSON.parse(r.data_json); } catch (e) {}
    if (r.assignedProjectId && (!emp.assignedProjectId || emp.assignedProjectId !== r.assignedProjectId)) {
      emp.assignedProjectId = r.assignedProjectId;
    }
    if (userRoleMap.has(r.id)) {
      const uInfo = userRoleMap.get(r.id);
      if (uInfo.systemRole) emp.systemRole = uInfo.systemRole;
      if (uInfo.role) emp.role = uInfo.role;
    }
    if (emp.systemRole === 'superuser') {
      emp.role = 'Director';
    }
    if (!emp.loginId) {
      if (emp.id === 'EMP-001') emp.loginId = 'admin';
      else if (userMap.has(emp.id)) emp.loginId = userMap.get(emp.id);
      else {
        const m = emp.id.match(/^EMP-(\d{1,4})$/i);
        if (m && Number(m[1]) < 1000) {
          emp.loginId = `d${String(m[1]).padStart(3, '0')}`;
        } else {
          const nikDigits = String(emp.nik || '').replace(/\D/g, '');
          const fallbackNum = nikDigits.slice(-3) || '001';
          emp.loginId = `d${fallbackNum.padStart(3, '0')}`;
        }
      }
    }
    // REA Optimization: Strip heavy 4-pose base64 biometric samples from general bootstrap
    // Keep enrollment status and quality score. Samples are fetched on-demand via gallery API.
    if (emp.biometric && emp.biometric.samples) {
      const { samples, ...cleanBiometric } = emp.biometric;
      emp.biometric = {
        ...cleanBiometric,
        hasSamples: true
      };
    }
    return emp;
  });
  const projects = db.prepare('SELECT data_json FROM projects ORDER BY code ASC;').all().map(r => JSON.parse(r.data_json));

  const empLoginMap = new Map();
  for (const emp of employees) {
    if (emp.id && emp.loginId) empLoginMap.set(emp.id, emp.loginId);
    if (emp.nik && emp.loginId) empLoginMap.set(emp.nik, emp.loginId);
    if (emp.name && emp.loginId) empLoginMap.set(emp.name.toLowerCase().trim(), emp.loginId);
  }

  // REA Optimization: Streamline attendances and convert inline base64 to /api/attendance/:id/photo
  const attendances = db.prepare('SELECT id, data_json FROM attendances ORDER BY date DESC, COALESCE(checkOutTime, checkInTime) DESC, checkInTime DESC LIMIT 200;').all().map(r => {
    let item = {};
    try { item = JSON.parse(r.data_json); } catch (e) {}

    const isCheckoutWithoutIn = 
      item.attendanceType === 'CHECK_OUT' && 
      (!item.checkInTime || (item.note && item.note.toLowerCase().includes('tanpa absen masuk')));

    if (isCheckoutWithoutIn) {
      if (!item.photoOutUrl && item.photoUrl) {
        item.photoOutUrl = item.photoUrl;
      }
      if (!item.checkOutPhotoUrl && item.photoOutUrl) {
        item.checkOutPhotoUrl = item.photoOutUrl;
      }
      item.checkInPhotoUrl = null;
      item.photoUrl = null;
    } else {
      const outP = item.photoOutUrl || item.checkOutPhotoUrl;
      if (outP && item.photoUrl === outP && item.attendanceType === 'CHECK_OUT') {
        item.photoUrl = null;
        item.checkInPhotoUrl = null;
      }
    }

    if (item.photoUrl && item.photoUrl.startsWith('data:image')) {
      item.photoUrl = `/api/attendance/${item.id || r.id}/photo`;
    }
    if (item.photoOutUrl && item.photoOutUrl.startsWith('data:image')) {
      item.photoOutUrl = `/api/attendance/${item.id || r.id}/photo-out`;
    }
    if (item.checkInPhotoUrl && item.checkInPhotoUrl.startsWith('data:image')) {
      item.checkInPhotoUrl = `/api/attendance/${item.id || r.id}/photo`;
    }
    if (item.checkOutPhotoUrl && item.checkOutPhotoUrl.startsWith('data:image')) {
      item.checkOutPhotoUrl = `/api/attendance/${item.id || r.id}/photo-out`;
    }
    // Canonical Login ID resolution from Master Data (SSOT)
    const canonicalLoginId = (item.employeeId === 'EMP-001')
      ? 'admin'
      : (empLoginMap.get(item.employeeId) || 
         (item.employeeNik && empLoginMap.get(item.employeeNik)) || 
         (item.employeeName && empLoginMap.get(item.employeeName.toLowerCase().trim())) || 
         userMap.get(item.employeeId));

    if (canonicalLoginId) {
      item.employeeLoginId = canonicalLoginId;
    } else if (!item.employeeLoginId) {
      item.employeeLoginId = item.employeeId || '-';
    }
    return item;
  });

  // REA Optimization: Strip heavy base64 proof attachments from historical approvals
  const approvals = db.prepare('SELECT id, data_json FROM approvals ORDER BY submittedAt DESC LIMIT 300;').all().map(r => {
    let item = {};
    try { item = JSON.parse(r.data_json); } catch (e) {}
    if (item.proofAttachment && item.proofAttachment.startsWith('data:image')) {
      item.hasAttachment = true;
      delete item.proofAttachment;
    }
    // Canonical Login ID resolution from Master Data (SSOT)
    const canonicalLoginId = (item.employeeId === 'EMP-001')
      ? 'admin'
      : (empLoginMap.get(item.employeeId) || 
         (item.employeeNik && empLoginMap.get(item.employeeNik)) || 
         (item.employeeName && empLoginMap.get(item.employeeName.toLowerCase().trim())) || 
         userMap.get(item.employeeId));

    if (canonicalLoginId) {
      item.employeeLoginId = canonicalLoginId;
    } else if (!item.employeeLoginId) {
      item.employeeLoginId = item.employeeId || '-';
    }
    return item;
  });
  const rulesRow = db.prepare('SELECT config_json FROM salary_rules WHERE id = ?;').get('default');
  const salaryRules = rulesRow ? JSON.parse(rulesRow.config_json) : null;

  const currentYear = new Date().getFullYear();
  const workCalendar = getWorkCalendarConfig(currentYear);

  return {
    employees,
    projects,
    attendances,
    approvals,
    salaryRules,
    workCalendar,
    dbInfo: getDbInfo()
  };
}

export function getAttendancePhoto(id) {
  const db = getDatabase();
  try {
    const row = db.prepare('SELECT data_json FROM attendances WHERE id = ?').get(id);
    if (!row) return null;
    const item = JSON.parse(row.data_json);
    const isCheckoutWithoutIn = 
      item.attendanceType === 'CHECK_OUT' && 
      (!item.checkInTime || (item.note && item.note.toLowerCase().includes('tanpa absen masuk')));
    if (isCheckoutWithoutIn) {
      return item.checkInPhotoUrl || null;
    }
    if (item.checkInPhotoUrl) {
      return item.checkInPhotoUrl;
    }
    const outPhoto = item.checkOutPhotoUrl || item.photoOutUrl;
    if (outPhoto && item.photoUrl === outPhoto && item.attendanceType === 'CHECK_OUT') {
      return null;
    }
    return item.photoUrl || null;
  } catch (e) {
    return null;
  }
}

export function getAttendancePhotoOut(id) {
  const db = getDatabase();
  try {
    const row = db.prepare('SELECT data_json FROM attendances WHERE id = ?').get(id);
    if (!row) return null;
    const item = JSON.parse(row.data_json);
    return item.photoOutUrl || item.checkOutPhotoUrl || (item.attendanceType === 'CHECK_OUT' ? item.photoUrl : null);
  } catch (e) {
    return null;
  }
}

/**
 * Resolve an employee's assigned project and designated Project Manager (PM)
 */
export function resolveEmployeeProjectAndPm(employeeId) {
  const db = getDatabase();
  if (!employeeId) return null;

  const empRow = db.prepare('SELECT id, name, assignedProjectId, data_json FROM employees WHERE id = ? OR nik = ? LIMIT 1;').get(employeeId, employeeId);
  if (!empRow) return null;

  let assignedProjId = empRow.assignedProjectId;
  try {
    const empData = JSON.parse(empRow.data_json);
    if (!assignedProjId) assignedProjId = empData.assignedProjectId;
  } catch (e) {}

  let projRow = null;
  if (assignedProjId) {
    projRow = db.prepare('SELECT id, code, name, data_json FROM projects WHERE id = ? OR code = ? LIMIT 1;').get(assignedProjId, assignedProjId);
  }

  if (!projRow) {
    const allProjects = db.prepare('SELECT id, code, name, data_json FROM projects;').all();
    for (const p of allProjects) {
      try {
        const pObj = JSON.parse(p.data_json);
        const pPersonnel = pObj.assignedPersonnelIds || pObj.assignedEmployeeIds || [];
        if (Array.isArray(pPersonnel) && (pPersonnel.includes(empRow.id) || pPersonnel.includes(employeeId))) {
          projRow = p;
          break;
        }
      } catch (pe) {}
    }
  }

  if (!projRow) return null;

  let projData = {};
  try {
    projData = JSON.parse(projRow.data_json);
  } catch (e) {}

  const pmId = projData.projectManagerId;
  let pmName = null;
  if (pmId) {
    const pmEmp = db.prepare('SELECT id, name FROM employees WHERE id = ? OR nik = ? LIMIT 1;').get(pmId, pmId);
    if (pmEmp) pmName = pmEmp.name;
  }

  const projectAdminIds = Array.isArray(projData.projectAdminIds) ? projData.projectAdminIds : [];
  const projectAdminNames = Array.isArray(projData.projectAdminNames) ? projData.projectAdminNames : [];

  return {
    projectId: projRow.id,
    projectCode: projRow.code,
    projectName: projRow.name,
    projectManagerId: pmId || null,
    projectManagerName: pmName || null,
    projectAdminIds,
    projectAdminNames,
    isEmployeeThePm: Boolean(pmId && (pmId === empRow.id || pmId === employeeId)),
    isEmployeeProjectAdmin: projectAdminIds.includes(empRow.id) || projectAdminIds.includes(employeeId)
  };
}

export function saveAttendance(record) {
  const db = getDatabase();

  if (record.checkInTime) record.checkInTime = record.checkInTime.replace(/\./g, ':');
  if (record.checkOutTime) record.checkOutTime = record.checkOutTime.replace(/\./g, ':');

  const attType = record.attendanceType || (record.checkOutTime && !record.checkInTime ? 'CHECK_OUT' : 'CHECK_IN');

  // Strict Single Attendance Record per Employee per Date:
  // Query all existing rows for this employee on this date
  const existingRows = db.prepare(`
    SELECT id, data_json, checkInTime, checkOutTime, isLate, lateMinutes, status, approvalStatus 
    FROM attendances 
    WHERE employeeId = ? AND date = ? 
    ORDER BY id ASC;
  `).all(record.employeeId, record.date);

  const existing = existingRows[0] || null;
  // If there were duplicate rows from earlier versions, purge extras
  if (existingRows.length > 1) {
    for (let i = 1; i < existingRows.length; i++) {
      db.prepare('DELETE FROM attendances WHERE id = ?;').run(existingRows[i].id);
    }
  }

  const targetId = existing ? existing.id : (record.id || `ATT-${Date.now()}`);
  let prevData = {};
  if (existing) {
    try { prevData = JSON.parse(existing.data_json); } catch (e) {}
  }

  let finalCheckIn = null;
  let finalCheckOut = null;
  let finalStatus = 'ON_TIME';
  let finalIsLate = 0;
  let finalLateMinutes = 0;
  let finalLateReason = null;
  let finalApprovalStatus = 'APPROVED';
  let mergedData = {};

  let employeeLoginId = record.employeeLoginId;
  if (!employeeLoginId) {
    if (record.employeeId === 'EMP-001') {
      employeeLoginId = 'admin';
    } else {
      try {
        const u = db.prepare('SELECT username FROM user_accounts WHERE employee_id = ?;').get(record.employeeId);
        if (u && u.username) {
          employeeLoginId = u.username;
        } else {
          const empRow = db.prepare('SELECT data_json FROM employees WHERE id = ?;').get(record.employeeId);
          if (empRow && empRow.data_json) {
            employeeLoginId = JSON.parse(empRow.data_json).loginId;
          }
        }
      } catch (e) {}
    }
  }

  const sched = getEmployeeProjectSchedule(record.employeeId);

  if (attType === 'CHECK_IN') {
    // ==========================================
    // MODE PRESENSI MASUK (OR RE-CHECK-IN)
    // Sifatnya REPLACE data sebelumnya:
    // Waktu masuk baru, foto selfie baru, lokasi baru, evaluasi keterlambatan baru
    // ==========================================
    finalCheckIn = record.checkInTime ? record.checkInTime.replace(/\./g, ':') : (existing?.checkInTime || null);
    // Presensi masuk TIDAK PERNAH mengeset jam pulang baru, tetapi mempertahankan jam pulang jika sudah ada sebelumnya
    finalCheckOut = existing?.checkOutTime ? existing.checkOutTime.replace(/\./g, ':') : null;

    // Evaluasi batas waktu keterlambatan terhadap jadwal proyek/kantor
    if (finalCheckIn) {
      const [inH, inM] = finalCheckIn.split(':').map(Number);
      const [cutH, cutM] = (sched.cutoffTime || '08:15').split(':').map(Number);
      const inMins = (inH || 0) * 60 + (inM || 0);
      const cutMins = (cutH || 0) * 60 + (cutM || 0);

      if (inMins > cutMins) {
        finalIsLate = 1;
        finalLateMinutes = inMins - cutMins;
      }
    }

    if (record.mode === 'DINAS_LUAR') {
      finalStatus = 'DINAS_LUAR';
    } else if (record.status === 'OUT_OF_GEOFENCE' || (record.location && record.location.inGeofence === false && record.mode === 'WFO')) {
      finalStatus = 'OUT_OF_GEOFENCE';
    } else if (finalIsLate === 1) {
      finalStatus = 'LATE';
    } else {
      finalStatus = 'ON_TIME';
    }

    finalLateReason = finalIsLate ? (record.lateReason || null) : null;
    const checkInNeedsApproval = Boolean(record.mode === 'DINAS_LUAR' || finalStatus === 'OUT_OF_GEOFENCE' || finalIsLate === 1);
    finalApprovalStatus = checkInNeedsApproval ? 'PENDING' : 'APPROVED';

    const checkInPhoto = record.checkInPhotoUrl || record.photoUrl || prevData.checkInPhotoUrl || prevData.photoUrl || null;
    const checkOutPhoto = prevData.checkOutPhotoUrl || prevData.photoOutUrl || null;

    mergedData = {
      ...prevData,
      ...record,
      id: targetId,
      employeeLoginId: employeeLoginId || prevData.employeeLoginId,
      attendanceType: 'CHECK_IN',
      checkInTime: finalCheckIn || undefined,
      checkOutTime: finalCheckOut || undefined,
      mode: record.mode || prevData.mode || 'WFO',
      status: finalStatus,
      isLate: Boolean(finalIsLate),
      lateMinutes: finalLateMinutes,
      lateReason: finalLateReason,
      approvalStatus: finalApprovalStatus,
      photoUrl: checkInPhoto,
      checkInPhotoUrl: checkInPhoto,
      photoOutUrl: checkOutPhoto,
      checkOutPhotoUrl: checkOutPhoto,
      location: record.location || prevData.location,
      checkInLocation: record.checkInLocation || record.location || prevData.checkInLocation || prevData.location,
      checkOutLocation: prevData.checkOutLocation || null,
      note: record.note || prevData.note || 'Presensi Masuk (Dalam Area Kerja)',
      checkInNote: record.checkInNote || record.note || prevData.checkInNote || prevData.note || 'Presensi Masuk (Dalam Area Kerja)',
      checkOutNote: prevData.checkOutNote || null,
      biometricVerification: record.biometricVerification || prevData.biometricVerification,
      checkInBiometric: record.checkInBiometric || record.biometricVerification || prevData.checkInBiometric || prevData.biometricVerification,
      checkOutBiometric: prevData.checkOutBiometric || null
    };
  } else {
    // ==========================================
    // MODE PRESENSI PULANG (CHECK-OUT)
    // Mengisi jam pulang, foto kepulangan, lokasi pulang
    // ==========================================
    finalCheckIn = existing?.checkInTime || record.checkInTime || null;
    if (finalCheckIn) finalCheckIn = finalCheckIn.replace(/\./g, ':');
    finalCheckOut = (record.checkOutTime || record.checkInTime || '').replace(/\./g, ':') || null;

    // Evaluasi Pulang Lebih Awal (sebelum jam selesai operasional proyek / kantor)
    const [outH, outM] = (finalCheckOut || '').replace(/\./g, ':').split(':').map(Number);
    const [schedOutH, schedOutM] = (sched.checkOutTime || '17:00').replace(/\./g, ':').split(':').map(Number);
    const outMins = (outH || 0) * 60 + (outM || 0);
    const schedOutMins = (schedOutH || 0) * 60 + (schedOutM || 0);

    let isEarlyOut = false;
    let earlyOutMins = 0;
    if (finalCheckOut && !isNaN(outH) && outMins < schedOutMins) {
      isEarlyOut = true;
      earlyOutMins = Math.max(1, schedOutMins - outMins);
    }

    if (!finalCheckIn) {
      // Tidak pernah absen masuk: Status Alpa & butuh approval koreksi presensi
      finalStatus = 'ALPA';
      finalApprovalStatus = 'PENDING';
    } else if (isEarlyOut) {
      finalStatus = existing?.status || 'ON_TIME';
      finalApprovalStatus = 'PENDING';
    } else {
      finalStatus = existing?.status || 'ON_TIME';
      finalApprovalStatus = existing?.approvalStatus || 'APPROVED';
    }

    finalIsLate = existing?.isLate !== undefined ? existing.isLate : 0;
    finalLateMinutes = existing?.lateMinutes !== undefined ? existing.lateMinutes : 0;
    finalLateReason = existing?.lateReason || null;

    // Foto Masuk hanya ada jika karyawan sebelumnya pernah melakukan presensi masuk secara riil
    const isClockOutWithoutCheckIn = !finalCheckIn || !prevData.checkInTime || Boolean(record.note && record.note.toLowerCase().includes('tanpa absen masuk'));
    let checkInPhoto = null;
    if (!isClockOutWithoutCheckIn) {
      checkInPhoto = prevData.checkInPhotoUrl || (prevData.photoUrl && prevData.photoUrl !== record.photoUrl ? prevData.photoUrl : null);
    }

    const checkOutPhoto = record.photoOutUrl || record.checkOutPhotoUrl || record.photoUrl || null;

    mergedData = {
      ...prevData,
      ...record,
      id: targetId,
      employeeLoginId: employeeLoginId || prevData.employeeLoginId,
      attendanceType: 'CHECK_OUT',
      checkInTime: finalCheckIn || undefined,
      checkOutTime: finalCheckOut,
      status: finalStatus,
      isLate: Boolean(finalIsLate),
      lateMinutes: finalLateMinutes,
      lateReason: finalLateReason,
      isEarlyCheckOut: isEarlyOut,
      earlyCheckOutMinutes: earlyOutMins,
      earlyCheckOutReason: isEarlyOut ? (record.earlyCheckOutReason || record.note || prevData.earlyCheckOutReason || 'Izin pulang lebih awal sebelum jam selesai kerja') : null,
      scheduledCheckOutTime: sched.checkOutTime || '17:00',
      approvalStatus: finalApprovalStatus,
      photoUrl: checkInPhoto || null,
      checkInPhotoUrl: checkInPhoto || null,
      photoOutUrl: checkOutPhoto,
      checkOutPhotoUrl: checkOutPhoto,
      checkInLocation: prevData.checkInLocation || prevData.location || record.checkInLocation || null,
      checkOutLocation: record.checkOutLocation || record.location || prevData.checkOutLocation || null,
      checkInNote: prevData.checkInNote || (prevData.attendanceType === 'CHECK_IN' ? prevData.note : null) || record.checkInNote || null,
      checkOutNote: record.checkOutNote || (record.attendanceType === 'CHECK_OUT' ? record.note : null) || (record.earlyCheckOutReason ? `[Pulang Lebih Awal]: ${record.earlyCheckOutReason}` : null) || prevData.checkOutNote || null,
      checkInBiometric: prevData.checkInBiometric || prevData.biometricVerification || record.checkInBiometric || null,
      checkOutBiometric: record.checkOutBiometric || record.biometricVerification || prevData.checkOutBiometric || null
    };
  }

  // 1. Simpan / Replace data tunggal ke tabel attendances
  db.prepare(`
    INSERT OR REPLACE INTO attendances (
      id, employeeId, employeeName, employeeNik, department,
      date, checkInTime, checkOutTime, mode, status,
      photoUrl, isLate, lateMinutes, lateReason,
      approvalStatus, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    targetId,
    record.employeeId,
    record.employeeName,
    record.employeeNik,
    record.department || 'Engineering',
    record.date,
    finalCheckIn || '',
    finalCheckOut || null,
    mergedData.mode || record.mode || 'WFO',
    finalStatus || 'ON_TIME',
    mergedData.photoUrl || record.photoUrl || null,
    finalIsLate ? 1 : 0,
    finalLateMinutes || 0,
    finalLateReason || null,
    finalApprovalStatus || 'APPROVED',
    JSON.stringify(mergedData)
  );

  // Sync return values back to record object
  record.id = targetId;
  record.employeeLoginId = employeeLoginId || prevData?.employeeLoginId;
  record.attendanceType = attType;
  record.checkInTime = finalCheckIn || undefined;
  record.checkOutTime = finalCheckOut || undefined;
  record.status = finalStatus;
  record.isLate = Boolean(finalIsLate);
  record.lateMinutes = finalLateMinutes;
  record.approvalStatus = finalApprovalStatus;
  record.photoUrl = mergedData.photoUrl || record.photoUrl;
  record.photoOutUrl = mergedData.photoOutUrl || record.photoOutUrl;
  if (attType === 'CHECK_OUT') {
    record.isEarlyCheckOut = mergedData.isEarlyCheckOut;
    record.earlyCheckOutMinutes = mergedData.earlyCheckOutMinutes;
    record.earlyCheckOutReason = mergedData.earlyCheckOutReason;
    record.scheduledCheckOutTime = mergedData.scheduledCheckOutTime;
  }

  // ==========================================
  // APPROVAL CLEANUP & REPLACEMENT ENGINE
  // ==========================================
  const removedApprovalIds = [];
  let approvalItem = null;

  // Cari seluruh pending approval terkait presensi pada tanggal ini untuk karyawan ini
  const existingPendingApprovals = db.prepare(`
    SELECT id, type, data_json FROM approvals 
    WHERE employeeId = ? 
      AND startDate = ? 
      AND status = 'PENDING' 
      AND type IN ('LATE_JUSTIFICATION', 'OUT_OF_GEOFENCE', 'DINAS_LUAR', 'ATTENDANCE_CORRECTION', 'EARLY_CHECKOUT');
  `).all(record.employeeId, record.date);

  if (attType === 'CHECK_IN') {
    const checkInNeedsApproval = Boolean(record.mode === 'DINAS_LUAR' || finalStatus === 'OUT_OF_GEOFENCE' || finalIsLate === 1);

    if (!checkInNeedsApproval) {
      // Presensi sekarang VALID & TEPAT WAKTU:
      // Hapus otomatis SEMUA permohonan approval check-in sebelumnya (hilang tanpa sisa)
      for (const app of existingPendingApprovals) {
        if (app.type !== 'EARLY_CHECKOUT') {
          db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
          removedApprovalIds.push(app.id);
        }
      }
    } else {
      // Presensi butuh persetujuan:
      // Replace approval lama dengan 1 single canonical approval baru
      const approvalId = `APPR-${targetId}`;

      for (const app of existingPendingApprovals) {
        if (app.type !== 'EARLY_CHECKOUT' && app.id !== approvalId) {
          db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
          removedApprovalIds.push(app.id);
        }
      }

      const isDinasLuar = record.mode === 'DINAS_LUAR';
      const isOutOfGeofence = finalStatus === 'OUT_OF_GEOFENCE';
      const approvalType = isDinasLuar ? 'DINAS_LUAR' : (isOutOfGeofence ? 'OUT_OF_GEOFENCE' : 'LATE_JUSTIFICATION');

      const distText = record.location?.distanceMeters ? ` (${record.location.distanceMeters >= 1000 ? (record.location.distanceMeters / 1000).toFixed(1) + ' km' : record.location.distanceMeters + 'm'})` : '';
      const approvalTitle = isDinasLuar
        ? `Pengajuan Dinas Luar Mendadak: ${record.dinasLuarDetails?.clientName || 'Klien Luar'}`
        : isOutOfGeofence
        ? `Persetujuan Presensi Luar Area${distText}`
        : `Justifikasi Keterlambatan (${finalLateMinutes} Menit)`;

      const approvalDesc = isDinasLuar
        ? `Tujuan: ${record.dinasLuarDetails?.destination} | Alasan: ${record.dinasLuarDetails?.purpose}`
        : isOutOfGeofence
        ? `Catatan Luar Area${distText}: ${record.outOfRangeReason || record.note || 'Presensi di luar radius resmi'}`
        : `Alasan Keterlambatan: ${finalLateReason || 'Keterlambatan operasional'}`;

      const projInfo = resolveEmployeeProjectAndPm(record.employeeId);
      const hasPm = Boolean(projInfo?.projectManagerId && !projInfo.isEmployeeThePm);
      const hasAdmin = Boolean(projInfo?.projectAdminIds && projInfo.projectAdminIds.length > 0);

      const applicant = getEmployeeByIdentifier(record.employeeId);
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
        applicant.role === 'Finance_Manager' ||
        (applicant.position && applicant.position.toLowerCase().includes('finance')) ||
        (applicant.department && applicant.department.toLowerCase().includes('finance')) ||
        applicant.id === 'EMP-015' ||
        applicant.id === 'EMP-045'
      );

      let targetRole = (hasPm || hasAdmin) ? 'PM' : (isApplicantHr ? 'FINANCE' : (isApplicantFinance ? 'HR' : 'HR'));

      approvalItem = {
        id: approvalId,
        type: approvalType,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        employeeNik: record.employeeNik,
        department: record.department,
        title: approvalTitle,
        description: approvalDesc,
        startDate: record.date,
        lateMinutes: isOutOfGeofence ? 0 : finalLateMinutes,
        targetCheckInTime: finalCheckIn || undefined,
        targetCheckOutTime: finalCheckOut || undefined,
        targetStatus: isOutOfGeofence ? 'OUT_OF_GEOFENCE' : finalStatus,
        attendanceRecordId: targetId,
        proofAttachment: record.photoUrl,
        status: 'PENDING',
        submittedAt: `${record.date} ${finalCheckIn || ''}`,
        projectId: projInfo?.projectId || record.projectId || null,
        projectCode: projInfo?.projectCode || record.projectCode || null,
        projectName: projInfo?.projectName || record.projectName || null,
        projectManagerId: projInfo?.projectManagerId || null,
        projectManagerName: projInfo?.projectManagerName || null,
        projectAdminIds: projInfo?.projectAdminIds || [],
        projectAdminNames: projInfo?.projectAdminNames || [],
        targetApproverRole: targetRole,
        stage: (hasPm || hasAdmin) ? 'PM' : targetRole,
        requiresHrApproval: !isApplicantHr,
        requiresFinanceApproval: isApplicantHr
      };

      db.prepare(`
        INSERT OR REPLACE INTO approvals (
          id, type, employeeId, employeeName, employeeNik, department,
          title, description, startDate, endDate, daysCount, lateMinutes,
          status, submittedAt, reviewedBy, reviewedAt, reviewNote, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `).run(
        approvalItem.id, approvalItem.type, approvalItem.employeeId,
        approvalItem.employeeName, approvalItem.employeeNik, approvalItem.department,
        approvalItem.title, approvalItem.description, approvalItem.startDate,
        null, null, approvalItem.lateMinutes || null, approvalItem.status,
        approvalItem.submittedAt, null, null, null, JSON.stringify(approvalItem)
      );
    }
  } else {
    // attType === 'CHECK_OUT'
    const isEarlyCheckOut = Boolean(mergedData.isEarlyCheckOut);
    const isMissingCheckIn = !finalCheckIn && Boolean(finalCheckOut);
    const checkOutNeedsApproval = isEarlyCheckOut || isMissingCheckIn;

    if (!checkOutNeedsApproval) {
      // Kepulangan normal (tepat jam operasional & ada absen masuk):
      // Bersihkan pengajuan EARLY_CHECKOUT / ATTENDANCE_CORRECTION lama jika ada
      for (const app of existingPendingApprovals) {
        if (app.type === 'EARLY_CHECKOUT' || app.type === 'ATTENDANCE_CORRECTION') {
          db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
          removedApprovalIds.push(app.id);
        }
      }
    } else {
      const approvalId = isEarlyCheckOut ? `APPR-EARLY-${targetId}` : `APPR-${targetId}`;

      for (const app of existingPendingApprovals) {
        if ((app.type === 'EARLY_CHECKOUT' || app.type === 'ATTENDANCE_CORRECTION') && app.id !== approvalId) {
          db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
          removedApprovalIds.push(app.id);
        }
      }

      const approvalType = isEarlyCheckOut ? 'EARLY_CHECKOUT' : 'ATTENDANCE_CORRECTION';
      const earlyMins = mergedData.earlyCheckOutMinutes || 0;
      const schedOut = mergedData.scheduledCheckOutTime || sched.checkOutTime || '17:00';

      const approvalTitle = isEarlyCheckOut
        ? `Persetujuan Pulang Lebih Awal (${earlyMins} Menit Sebelum ${schedOut} WIB) - ${record.employeeName}`
        : `Persetujuan Presensi Tanpa Absen Masuk - ${record.employeeName}`;

      const approvalDesc = isEarlyCheckOut
        ? `Karyawan melakukan Absen Pulang pukul ${finalCheckOut} WIB sebelum jam selesai operasional (${schedOut} WIB, selisih ${earlyMins} menit). Alasan: ${mergedData.earlyCheckOutReason || 'Izin pulang mendahului jam operasional proyek/kantor'}. Memerlukan persetujuan berjenjang PKM dan HR.`
        : `Karyawan melakukan Absen Pulang pukul ${finalCheckOut} WIB tanpa rekam Absen Masuk pada tanggal ${record.date}. Status saat ini Tidak Absen (Alpa) dan memerlukan peninjauan kehadiran oleh PM terkait kemudian HR Manager.`;

      const projInfo = resolveEmployeeProjectAndPm(record.employeeId);
      const hasPm = Boolean(projInfo?.projectManagerId && !projInfo.isEmployeeThePm);
      const hasAdmin = Boolean(projInfo?.projectAdminIds && projInfo.projectAdminIds.length > 0);

      const applicant = getEmployeeByIdentifier(record.employeeId);
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
        applicant.role === 'Finance_Manager' ||
        (applicant.position && applicant.position.toLowerCase().includes('finance')) ||
        (applicant.department && applicant.department.toLowerCase().includes('finance')) ||
        applicant.id === 'EMP-015' ||
        applicant.id === 'EMP-045'
      );
      let targetRole = (hasPm || hasAdmin) ? 'PM' : (isApplicantHr ? 'FINANCE' : (isApplicantFinance ? 'HR' : 'HR'));

      approvalItem = {
        id: approvalId,
        type: approvalType,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        employeeNik: record.employeeNik,
        department: record.department,
        title: approvalTitle,
        description: approvalDesc,
        startDate: record.date,
        lateMinutes: 0,
        earlyCheckOutMinutes: isEarlyCheckOut ? earlyMins : undefined,
        scheduledCheckOutTime: isEarlyCheckOut ? schedOut : undefined,
        targetCheckInTime: finalCheckIn || undefined,
        targetCheckOutTime: finalCheckOut || undefined,
        targetStatus: isMissingCheckIn ? 'ALPA' : (finalStatus || 'ON_TIME'),
        attendanceRecordId: targetId,
        proofAttachment: record.photoOutUrl || record.photoUrl,
        status: 'PENDING',
        submittedAt: `${record.date} ${finalCheckOut || ''}`,
        projectId: projInfo?.projectId || record.projectId || null,
        projectCode: projInfo?.projectCode || record.projectCode || null,
        projectName: projInfo?.projectName || record.projectName || null,
        projectManagerId: projInfo?.projectManagerId || null,
        projectManagerName: projInfo?.projectManagerName || null,
        projectAdminIds: projInfo?.projectAdminIds || [],
        projectAdminNames: projInfo?.projectAdminNames || [],
        targetApproverRole: targetRole,
        stage: (hasPm || hasAdmin) ? 'PM' : targetRole,
        requiresHrApproval: !isApplicantHr,
        requiresFinanceApproval: isApplicantHr
      };

      db.prepare(`
        INSERT OR REPLACE INTO approvals (
          id, type, employeeId, employeeName, employeeNik, department,
          title, description, startDate, endDate, daysCount, lateMinutes,
          status, submittedAt, reviewedBy, reviewedAt, reviewNote, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `).run(
        approvalItem.id, approvalItem.type, approvalItem.employeeId,
        approvalItem.employeeName, approvalItem.employeeNik, approvalItem.department,
        approvalItem.title, approvalItem.description, approvalItem.startDate,
        null, null, approvalItem.lateMinutes || null, approvalItem.status,
        approvalItem.submittedAt, null, null, null, JSON.stringify(approvalItem)
      );
    }
  }

  const isCheckOut = attType === 'CHECK_OUT';
  const attAction = isCheckOut
    ? (record.mode === 'DINAS_LUAR' ? 'CHECKOUT_DINAS_LUAR' : 'CHECKOUT_PULANG')
    : (record.mode === 'DINAS_LUAR' ? 'CHECKIN_DINAS_LUAR' : 'CHECKIN_WFO');

  addAuditLog({
    action: attAction,
    entity: 'attendances',
    entityId: targetId,
    userName: record.employeeName,
    userNik: record.employeeNik,
    userRole: 'staff',
    module: 'ATTENDANCE',
    ipAddress: record.ipAddress || '103.31.205.218',
    status: record.isLate && !isCheckOut ? 'WARNING' : 'SUCCESS',
    details: isCheckOut
      ? `Presensi Pulang (Check-Out) ${record.mode || 'WFO'} ${record.employeeName} (${record.employeeNik}) berhasil dicatat pada ${finalCheckOut}.`
      : `Presensi Masuk (Check-In) ${record.mode || 'WFO'} ${record.employeeName} (${record.employeeNik}) berhasil dicatat. Status: ${finalStatus}, Terlambat: ${finalLateMinutes} menit.`,
    metadata: {
      location: record.location,
      checkInTime: finalCheckIn,
      checkOutTime: finalCheckOut,
      networkAudit: record.networkAudit,
      hasPhoto: Boolean(record.photoUrl)
    }
  });

  return { success: true, record, approvalItem, removedApprovalIds };
}

export function deleteAttendance(id, operatorUser = null) {
  const db = getDatabase();
  let existing = db.prepare('SELECT id, employeeId, employeeName, employeeNik, date, data_json FROM attendances WHERE id = ?;').get(id);
  if (!existing) {
    // Resilient fallback: match by json_extract or partial id
    existing = db.prepare("SELECT id, employeeId, employeeName, employeeNik, date, data_json FROM attendances WHERE json_extract(data_json, '$.id') = ? OR id LIKE ?;").get(id, `%${id}%`);
  }
  if (!existing) {
    return { success: false, error: 'Rekaman presensi tidak ditemukan di basis data' };
  }

  const targetId = existing.id;

  // 1. Delete attendance record
  db.prepare('DELETE FROM attendances WHERE id = ?;').run(targetId);

  // 2. Also delete any linked approvals for this attendance record
  let linkedApprovals = [];
  try {
    linkedApprovals = db.prepare(`
      SELECT id FROM approvals 
      WHERE id = ? 
         OR id = ? 
         OR id = ? 
         OR json_extract(data_json, '$.attendanceRecordId') = ?
         OR json_extract(data_json, '$.attendanceRecordId') = ?;
    `).all(id, `APPR-${id}`, `APP-GEO-${id}`, id, targetId);
    for (const app of linkedApprovals) {
      db.prepare('DELETE FROM approvals WHERE id = ?;').run(app.id);
    }
  } catch (e) {
    console.warn('[DELETE_ATTENDANCE_APPROVALS_WARN]', e.message);
  }

  // 3. Add audit log
  const operatorLogin = operatorUser?.username || operatorUser?.loginId || 'admin';
  addAuditLog({
    action: 'ATTENDANCE_DELETED',
    entity: 'attendances',
    entityId: targetId,
    userName: operatorUser?.name || operatorLogin,
    userNik: null,
    userLoginId: operatorLogin,
    userRole: operatorUser?.systemRole || operatorUser?.role || 'superuser',
    module: 'ATTENDANCE',
    ipAddress: operatorUser?.clientIp || '127.0.0.1',
    status: 'SUCCESS',
    details: `Presensi ${existing.employeeName} tanggal ${existing.date} ID ${targetId} berhasil dihapus oleh ${operatorLogin}.`
  });

  return {
    success: true,
    id: targetId,
    employeeId: existing.employeeId,
    date: existing.date,
    linkedApprovalIds: linkedApprovals.map(a => a.id)
  };
}

export function updateApproval(id, status, reviewNote, reviewedBy = 'Direksi / HR Lead', options = {}) {
  const db = getDatabase();
  const row = db.prepare('SELECT data_json FROM approvals WHERE id = ?;').get(id);
  if (!row) throw new Error(`Approval item with ID ${id} not found`);

  const item = JSON.parse(row.data_json);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Periksa profil pengaju (Applicant) untuk aturan Otorisasi Silang (Cross-Approval)
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

  // 2-STAGE APPROVAL WORKFLOW GATEKEEPER:
  // If item is currently at Stage 1 (PM / Admin Proyek review) and action is 'APPROVED':
  // Record PM / Admin recommendation/approval and shift to Stage 2 (HR Manager / Finance Manager Otorisasi Silang)
  // Note: SLIP_ACCESS and KASBON are handled by Finance directly (or HR if applicant is Finance).
  const isPmStage = item.type !== 'SLIP_ACCESS' && item.type !== 'KASBON' && (item.targetApproverRole === 'PM' || item.stage === 'PM' || !item.stage) && !item.pmApprovedBy && (Boolean(item.projectManagerId) || Boolean(item.projectAdminIds && item.projectAdminIds.length > 0));

  if (status === 'APPROVED' && isPmStage) {
    const nextTargetRole = isApplicantHr ? 'FINANCE' : 'HR';
    item.pmApprovedBy = reviewedBy;
    item.pmApprovedAt = now;
    item.pmReviewNote = reviewNote || null;
    item.targetApproverRole = nextTargetRole;
    item.stage = nextTargetRole;
    item.status = 'PENDING'; // Retains PENDING status until final Stage 2 approval!
    item.requiresHrApproval = !isApplicantHr;
    item.requiresFinanceApproval = isApplicantHr;

    db.prepare(`
      UPDATE approvals
      SET status = ?, reviewedBy = ?, reviewedAt = ?, reviewNote = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `).run('PENDING', reviewedBy, now, reviewNote || null, JSON.stringify(item), id);

    addAuditLog({
      action: 'APPROVAL_PM_RECOMMENDED',
      entity: 'approvals',
      entityId: id,
      userName: reviewedBy || 'Project Manager',
      userRole: 'pm',
      module: 'APPROVALS',
      status: 'SUCCESS',
      details: `Pengajuan [${item.type}] untuk ${item.employeeName} (${item.employeeNik}) telah disetujui Tahap 1 oleh PM ${reviewedBy}. Diteruskan ke ${isApplicantHr ? 'Finance Manager (Otorisasi Silang HR ➔ Finance)' : 'HR Manager'} untuk otorisasi akhir.${reviewNote ? ` Catatan PM: "${reviewNote}"` : ''}`
    });

    return {
      success: true,
      item,
      updatedAttendance: null,
      updatedEmployee: null,
      isIntermediatePmApproval: true
    };
  }

  // Final Decision (Stage 2 Approval, or Rejection by either PM / Final Approver)
  item.status = status;
  item.reviewNote = reviewNote;
  item.reviewedBy = reviewedBy;
  item.reviewedAt = now;

  const isLateType = item.type === 'LATE_JUSTIFICATION' || (item.lateMinutes && item.lateMinutes > 0);
  let isWaived = undefined;
  if (options && options.waiveLateDeduction !== undefined) {
    isWaived = Boolean(options.waiveLateDeduction);
  } else if (options && options.deductionWaived !== undefined) {
    isWaived = Boolean(options.deductionWaived);
  } else if (isLateType) {
    isWaived = true;
  }

  if (status === 'APPROVED') {
    if (isWaived !== undefined) {
      item.deductionWaived = isWaived;
      item.waiveLateDeduction = isWaived;
    }
    if (isApplicantHr) {
      item.financeApprovedBy = reviewedBy;
      item.financeApprovedAt = now;
      item.financeReviewNote = reviewNote || null;
    } else {
      item.hrApprovedBy = reviewedBy;
      item.hrApprovedAt = now;
      item.hrReviewNote = reviewNote || null;
    }
    item.stage = 'FINAL';

    // If SLIP_ACCESS: calculate exact 10 minutes (600s) active window
    if (item.type === 'SLIP_ACCESS') {
      item.slipAccessExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      item.financeApprovedBy = reviewedBy;
      item.financeApprovedAt = now;
      item.targetApproverRole = 'FINANCE';
    }
  } else {
    if (isPmStage) {
      item.pmReviewNote = reviewNote || null;
    } else {
      if (isApplicantHr) {
        item.financeReviewNote = reviewNote || null;
      } else {
        item.hrReviewNote = reviewNote || null;
      }
    }
  }

  let updatedAttendance = null;
  let updatedEmployee = null;

  db.prepare(`
    UPDATE approvals
    SET status = ?, reviewedBy = ?, reviewedAt = ?, reviewNote = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `).run(status, reviewedBy, now, reviewNote || null, JSON.stringify(item), id);

  if (item.attendanceRecordId) {
    const attRow = db.prepare('SELECT data_json FROM attendances WHERE id = ?;').get(item.attendanceRecordId);
    if (attRow) {
      const attRecord = JSON.parse(attRow.data_json);
      attRecord.approvalStatus = status;
      attRecord.approvedBy = reviewedBy;
      attRecord.approvalDate = now;
      attRecord.approvalNote = reviewNote;
      // Status keterlambatan tetap dipertahankan (LATE), approval hanya mencatat persetujuan dispensasi/justifikasi
      if (status === 'APPROVED' && attRecord.isLate) {
        attRecord.approvalStatus = 'APPROVED';
        if (isWaived !== undefined) {
          attRecord.deductionWaived = isWaived;
          attRecord.isLateDeductionWaived = isWaived;
        }
      }
      if (status === 'APPROVED' && item.type === 'EARLY_CHECKOUT') {
        attRecord.isEarlyCheckOutApproved = true;
      }
      db.prepare(`UPDATE attendances SET approvalStatus = ?, status = ?, data_json = ? WHERE id = ?;`)
        .run(status, attRecord.status, JSON.stringify(attRecord), item.attendanceRecordId);
      updatedAttendance = attRecord;
    }
  }

  // Real-time Attendance Record Synchronization for Approved Attendance Correction
  if (item.type === 'ATTENDANCE_CORRECTION' && status === 'APPROVED' && item.employeeId) {
    const targetDate = item.startDate;
    const existingAtt = db.prepare('SELECT id, data_json FROM attendances WHERE employeeId = ? AND date = ?;').get(item.employeeId, targetDate);

    let attRecord = {};
    let attId = existingAtt ? existingAtt.id : `ATT-CORR-${item.employeeId}-${targetDate}`;
    if (existingAtt) {
      try { attRecord = JSON.parse(existingAtt.data_json); } catch (e) {}
    } else {
      attRecord = {
        id: attId,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeNik: item.employeeNik,
        department: item.department,
        date: targetDate,
        mode: 'WFO',
        location: {
          lat: -7.293144,
          lng: 112.775337,
          accuracy: 10,
          address: 'Koreksi Absensi Resmi Disetujui (' + (item.projectName || 'Pusat') + ')',
          inGeofence: true,
          distanceMeters: 0
        }
      };
    }

    const checkIn = (item.targetCheckInTime || attRecord.checkInTime || '08:00:00').replace(/\./g, ':');
    const checkOut = item.targetCheckOutTime ? item.targetCheckOutTime.replace(/\./g, ':') : (attRecord.checkOutTime || null);
    const attStatus = item.targetStatus || 'ON_TIME';

    attRecord.id = attId;
    attRecord.checkInTime = checkIn;
    attRecord.checkOutTime = checkOut;
    attRecord.status = attStatus;
    attRecord.isLate = attStatus === 'LATE';
    attRecord.lateMinutes = attStatus === 'LATE' ? (item.lateMinutes || 15) : 0;
    attRecord.approvalStatus = 'APPROVED';
    attRecord.approvedBy = reviewedBy;
    attRecord.approvalDate = now;
    attRecord.approvalNote = reviewNote;
    attRecord.isHrCorrected = true;
    attRecord.hrCorrectedBy = reviewedBy;
    attRecord.hrCorrectedAt = now;
    attRecord.hrCorrectionNotes = `Koreksi mandiri disetujui: ${item.description || ''}${reviewNote ? ` (Catatan: ${reviewNote})` : ''}`;

    db.prepare(`
      INSERT OR REPLACE INTO attendances (
        id, employeeId, employeeName, employeeNik, department,
        date, checkInTime, checkOutTime, mode, status,
        photoUrl, isLate, lateMinutes, lateReason,
        approvalStatus, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    `).run(
      attId, item.employeeId, item.employeeName, item.employeeNik, item.department,
      targetDate, checkIn, checkOut,
      attRecord.mode || 'WFO', attStatus, attRecord.photoUrl || null,
      attRecord.isLate ? 1 : 0, attRecord.lateMinutes || 0, attRecord.lateReason || null,
      'APPROVED', JSON.stringify(attRecord)
    );
    updatedAttendance = attRecord;
  }

  // Automatic quota deduction, unpaid leave recording & roster schedule update for approved leave requests
  if (item.type === 'LEAVE' && status === 'APPROVED' && item.employeeId) {
    const empRow = db.prepare('SELECT data_json FROM employees WHERE id = ?;').get(item.employeeId);
    if (empRow) {
      try {
        const emp = JSON.parse(empRow.data_json);
        const days = Number(item.daysCount) || 1;
        const coveredDays = typeof item.coveredByQuotaDays === 'number' ? item.coveredByQuotaDays : days;
        const unpaidDays = typeof item.unpaidLeaveDays === 'number' ? item.unpaidLeaveDays : 0;

        if (item.leaveType === 'CUTI_ROSTER_NON_LOKAL' && emp.nonLokalLeaveConfig) {
          emp.nonLokalLeaveConfig.usedPeriodLeave = (emp.nonLokalLeaveConfig.usedPeriodLeave || 0) + coveredDays;
          emp.nonLokalLeaveConfig.lastLeaveDate = item.startDate || new Date().toISOString().split('T')[0];
          try {
            const [y, m, d] = emp.nonLokalLeaveConfig.lastLeaveDate.split('-').map(Number);
            let nextM = m + (emp.nonLokalLeaveConfig.rosterCycleMonths || 3);
            let nextY = y;
            if (nextM > 12) {
              nextY += Math.floor((nextM - 1) / 12);
              nextM = ((nextM - 1) % 12) + 1;
            }
            emp.nonLokalLeaveConfig.nextEligibleLeaveDate = `${nextY}-${String(nextM).padStart(2, '0')}-${String(Math.min(d, 28)).padStart(2, '0')}`;
          } catch (e) {}
        } else if (item.leaveType === 'CUTI_TAHUNAN' || !item.leaveType) {
          emp.usedLeave = Math.min(emp.leaveQuota || 12, (emp.usedLeave || 0) + coveredDays);
        }

        // Record unpaid leave days for salary deduction if over quota
        if (unpaidDays > 0) {
          emp.unpaidLeaveDaysTotal = (emp.unpaidLeaveDaysTotal || 0) + unpaidDays;
        }

        db.prepare('UPDATE employees SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;').run(JSON.stringify(emp), item.employeeId);
        updatedEmployee = emp;
      } catch (err) {
        console.warn('[SQLite] Failed updating employee leave quota on approval:', err);
      }
    }
  }

  let modeDetails = '';
  if (status === 'APPROVED' && isLateType && isWaived !== undefined) {
    modeDetails = isWaived ? ' [Mode: Bebas Denda (Tanpa Potongan Gaji, Keterlambatan Tetap Dicatat)]' : ' [Mode: Tetap Dipotong Denda Keterlambatan Sesuai Jam]';
  }

  addAuditLog({
    action: status === 'APPROVED' ? 'APPROVAL_APPROVED' : status === 'REJECTED' ? 'APPROVAL_REJECTED' : 'UPDATE_APPROVAL',
    entity: 'approvals',
    entityId: id,
    userName: reviewedBy || 'Direksi / HR Lead',
    userRole: 'admin',
    module: 'APPROVALS',
    status: status === 'REJECTED' ? 'WARNING' : 'SUCCESS',
    details: `Pengajuan [${item.type}] untuk ${item.employeeName} (${item.employeeNik}) diputuskan "${status}" oleh ${reviewedBy}.${modeDetails}${reviewNote ? ` Catatan: "${reviewNote}"` : ''}`
  });

  return { success: true, item, updatedAttendance, updatedEmployee };
}

export function saveApproval(item) {
  const db = getDatabase();

  // Smart Leave Quota & Over-Quota Unpaid Leave Gatekeeper
  if (item.type === 'LEAVE') {
    const empRow = db.prepare('SELECT data_json FROM employees WHERE id = ?').get(item.employeeId);
    if (empRow) {
      try {
        const empData = JSON.parse(empRow.data_json);
        const requested = Number(item.daysCount) || 1;
        let remaining = 12;

        if (item.leaveType === 'CUTI_ROSTER_NON_LOKAL') {
          const cfg = empData.nonLokalLeaveConfig || {};
          const baseQuota = typeof cfg.leaveQuotaPerPeriod === 'number' ? cfg.leaveQuotaPerPeriod : 9;
          const accumulated = typeof cfg.accumulatedLeaveDays === 'number' ? cfg.accumulatedLeaveDays : 0;
          const effectiveQuota = baseQuota + accumulated;
          const used = typeof cfg.usedPeriodLeave === 'number' ? cfg.usedPeriodLeave : 0;
          remaining = Math.max(0, effectiveQuota - used);

          // Check if off-schedule compared to nextEligibleLeaveDate
          if (cfg.nextEligibleLeaveDate && item.startDate && item.startDate !== cfg.nextEligibleLeaveDate) {
            item.isOffSchedule = true;
            item.requiresHrApproval = true;
          }
        } else if (item.leaveType === 'CUTI_TAHUNAN' || !item.leaveType) {
          const quota = typeof empData.leaveQuota === 'number' ? empData.leaveQuota : 12;
          const used = typeof empData.usedLeave === 'number' ? empData.usedLeave : 0;
          remaining = Math.max(0, quota - used);
        }

        if (item.leaveType === 'CUTI_ROSTER_NON_LOKAL' || item.leaveType === 'CUTI_TAHUNAN' || !item.leaveType) {
          if (requested > remaining) {
            // Over-quota condition: auto-split into covered quota and unpaid leave days with salary deduction condition
            item.coveredByQuotaDays = remaining;
            item.unpaidLeaveDays = requested - remaining;
            item.isOverQuota = true;
            item.requiresHrApproval = true;
            if (!item.title.includes('Potong Gaji')) {
              item.title = `${item.title} (Over-Quota: ${item.unpaidLeaveDays} Hari Potong Gaji)`;
            }
          } else {
            item.coveredByQuotaDays = requested;
            item.unpaidLeaveDays = 0;
            item.isOverQuota = false;
          }
        } else {
          item.coveredByQuotaDays = requested;
          item.unpaidLeaveDays = 0;
        }
      } catch (err) {
        console.error('[BACKEND SAVE_APPROVAL ERROR]', err);
      }
    }
  }

  // Multi-Stage Project & PM / Admin Routing Gatekeeper for ALL approval types (Late, Leave, Permit, Correction, Geofence)
  const projInfo = resolveEmployeeProjectAndPm(item.employeeId);
  const hasPm = Boolean(projInfo?.projectManagerId && !projInfo.isEmployeeThePm);
  const hasAdmin = Boolean(projInfo?.projectAdminIds && projInfo.projectAdminIds.length > 0);

  if (!item.projectId && projInfo?.projectId) item.projectId = projInfo.projectId;
  if (!item.projectCode && projInfo?.projectCode) item.projectCode = projInfo.projectCode;
  if (!item.projectName && projInfo?.projectName) item.projectName = projInfo.projectName;
  if (!item.projectManagerId && projInfo?.projectManagerId) item.projectManagerId = projInfo.projectManagerId;
  if (!item.projectManagerName && projInfo?.projectManagerName) item.projectManagerName = projInfo.projectManagerName;
  if (!item.projectAdminIds && projInfo?.projectAdminIds) item.projectAdminIds = projInfo.projectAdminIds;
  if (!item.projectAdminNames && projInfo?.projectAdminNames) item.projectAdminNames = projInfo.projectAdminNames;

  const applicant = getEmployeeByIdentifier(item.employeeId);
  const isApplicantHr = applicant && (
    applicant.systemRole === 'hr' || 
    applicant.systemRole === 'admin' || 
    applicant.role === 'HR_Manager' ||
    (applicant.position && applicant.position.toLowerCase().includes('hr')) ||
    applicant.id === 'EMP-022'
  );
  const defaultStage2 = isApplicantHr ? 'FINANCE' : 'HR';

  if (!item.targetApproverRole) {
    item.targetApproverRole = (hasPm || hasAdmin) ? 'PM' : defaultStage2;
  }
  if (!item.stage) {
    item.stage = (hasPm || hasAdmin) ? 'PM' : defaultStage2;
  }
  item.requiresHrApproval = !isApplicantHr;
  item.requiresFinanceApproval = isApplicantHr;

  db.prepare(`
    INSERT OR REPLACE INTO approvals (
      id, type, employeeId, employeeName, employeeNik, department,
      title, description, startDate, endDate, daysCount, lateMinutes,
      status, submittedAt, reviewedBy, reviewedAt, reviewNote, data_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `).run(
    item.id, item.type, item.employeeId, item.employeeName, item.employeeNik,
    item.department, item.title, item.description, item.startDate,
    item.endDate || null, item.daysCount || null, item.lateMinutes || null,
    item.status || 'PENDING', item.submittedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
    item.reviewedBy || null, item.reviewedAt || null, item.reviewNote || null,
    JSON.stringify(item)
  );

  addAuditLog({
    action: 'SUBMIT_APPROVAL',
    entity: 'approvals',
    entityId: item.id,
    userName: item.employeeName,
    userNik: item.employeeNik,
    userRole: 'staff',
    module: 'APPROVALS',
    status: 'SUCCESS',
    details: `Pengajuan ${item.type} (${item.title}) diajukan oleh ${item.employeeName} (${item.employeeNik}).`
  });

  return { success: true, item };
}

/**
 * Universal Employee Resolver by Any Identifier
 * Resolves an employee whether passed:
 * - Internal ID: 'EMP-001'
 * - Account Login ID: 'admin', 'd005', 'd072'
 * - Official NIK: 'DMJ-2024-001', '3325122909920001'
 * - Email: 'primetroyxs@gmail.com'
 * - Phone: '6289524257778'
 */
export function getEmployeeByIdentifier(identifier) {
  if (!identifier) return null;
  const db = getDatabase();
  const clean = String(identifier).trim();
  const lower = clean.toLowerCase();

  // 1. Direct query on employees table by id or nik
  let row = db.prepare('SELECT data_json FROM employees WHERE id = ? OR LOWER(nik) = ? LIMIT 1;').get(clean, lower);
  if (row) {
    try {
      const parsed = JSON.parse(row.data_json);
      if (parsed) return parsed;
    } catch (e) {}
  }

  // 2. Query user_accounts by username (loginId) or email
  const uRow = db.prepare('SELECT employee_id FROM user_accounts WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1;').get(lower, lower);
  if (uRow && uRow.employee_id) {
    row = db.prepare('SELECT data_json FROM employees WHERE id = ? LIMIT 1;').get(uRow.employee_id);
    if (row) {
      try {
        const parsed = JSON.parse(row.data_json);
        if (parsed) return parsed;
      } catch (e) {}
    }
  }

  // 3. Scan all employees data_json for loginId, email, or normalized phone
  const cleanDigits = clean.replace(/\D+/g, '');
  let normPhone = cleanDigits;
  if (normPhone.startsWith('0')) normPhone = '62' + normPhone.slice(1);
  else if (normPhone.startsWith('8')) normPhone = '62' + normPhone;

  const allRows = db.prepare('SELECT data_json FROM employees;').all();
  for (const r of allRows) {
    try {
      const emp = JSON.parse(r.data_json);
      if (!emp) continue;
      if (emp.loginId && emp.loginId.toLowerCase() === lower) return emp;
      if (emp.email && emp.email.toLowerCase() === lower) return emp;
      if (normPhone && emp.phone) {
        let eDigits = String(emp.phone).replace(/\D+/g, '');
        if (eDigits.startsWith('0')) eDigits = '62' + eDigits.slice(1);
        else if (eDigits.startsWith('8')) eDigits = '62' + eDigits;
        if (eDigits === normPhone) return emp;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Resolves project-specific work schedule for an employee (checkIn, checkOut, cutoffTime, lateGraceMinutes, projectName).
 * Strictly guarantees that notifications and late thresholds follow the assigned project's unique rules.
 */
export function getEmployeeProjectSchedule(employeeOrId, fallbackRules = null) {
  let emp = typeof employeeOrId === 'object' && employeeOrId !== null
    ? employeeOrId
    : getEmployeeByIdentifier(employeeOrId);

  const fallbackCutoff = fallbackRules?.cutoffTime || '08:15';
  const fallbackCheckIn = fallbackRules?.standardCheckInTime || '08:00';
  const fallbackCheckOut = fallbackRules?.standardCheckOutTime || '17:00';
  const fallbackGrace = Number(fallbackRules?.lateGracePeriodMinutes ?? 15);

  if (!emp) {
    return {
      checkInTime: fallbackCheckIn,
      checkOutTime: fallbackCheckOut,
      cutoffTime: fallbackCutoff,
      lateGraceMinutes: fallbackGrace,
      projectName: 'Kantor Pusat / Operasional PRIME',
      projectCode: 'PRJ-001',
      projectId: 'PRJ-001',
      isCustom: false
    };
  }

  const assignedId = (emp.assignedProjectId || '').trim();
  const db = getDatabase();
  let matchedProject = null;

  if (assignedId) {
    const pRow = db.prepare('SELECT data_json FROM projects WHERE id = ? OR code = ? LIMIT 1;').get(assignedId, assignedId);
    if (pRow) {
      try { matchedProject = JSON.parse(pRow.data_json); } catch (e) {}
    } else {
      const altId = assignedId.startsWith('DMJ-') ? assignedId.replace(/^DMJ-/i, 'PRIME-') : assignedId.replace(/^PRIME-/i, 'DMJ-');
      const altRow = db.prepare('SELECT data_json FROM projects WHERE id = ? OR code = ? LIMIT 1;').get(altId, altId);
      if (altRow) {
        try { matchedProject = JSON.parse(altRow.data_json); } catch (e) {}
      }
    }
  }

  const customSched = matchedProject?.customRules?.workSchedule;
  if (customSched && customSched.enabled && customSched.checkInTime) {
    const checkIn = customSched.checkInTime; // e.g. "08:00"
    const checkOut = customSched.checkOutTime || '17:00';
    const grace = typeof customSched.lateGraceMinutes === 'number' ? customSched.lateGraceMinutes : 15;
    
    // Calculate cutoffTime = checkIn + grace minutes
    const [h, m] = checkIn.split(':').map(Number);
    const totalMins = (h || 0) * 60 + (m || 0) + grace;
    const newH = Math.floor(totalMins / 60) % 24;
    const newM = totalMins % 60;
    const cutoffTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

    return {
      checkInTime: checkIn,
      checkOutTime: checkOut,
      cutoffTime,
      lateGraceMinutes: grace,
      projectName: matchedProject?.name || 'Proyek Lapangan Penugasan',
      projectCode: matchedProject?.code || matchedProject?.id || assignedId,
      projectId: matchedProject?.id || assignedId,
      isCustom: true
    };
  }

  return {
    checkInTime: fallbackCheckIn,
    checkOutTime: fallbackCheckOut,
    cutoffTime: fallbackCutoff,
    lateGraceMinutes: fallbackGrace,
    projectName: matchedProject?.name || 'Kantor Pusat / Proyek Terkait',
    projectCode: matchedProject?.code || matchedProject?.id || (assignedId || 'PRJ-001'),
    projectId: matchedProject?.id || assignedId || 'PRJ-001',
    isCustom: false
  };
}

export function saveEmployee(emp, operatorUser = null) {
  const db = getDatabase();

  // If this is a self-update by non-privileged user, safeguard administrative fields
  if (operatorUser && !['admin', 'superuser', 'hr'].includes(operatorUser.systemRole)) {
    const existing = db.prepare('SELECT role, department, position, assignedProjectId, baseSalary, fixedAllowance, dailyAllowance, leaveQuota, usedLeave, data_json FROM employees WHERE id = ?;').get(emp.id);
    if (existing) {
      let ex = {};
      try { ex = JSON.parse(existing.data_json); } catch (e) {}
      emp.role = ex.role || existing.role || emp.role;
      emp.systemRole = ex.systemRole || emp.systemRole;
      emp.baseSalary = ex.baseSalary !== undefined ? ex.baseSalary : existing.baseSalary;
      emp.fixedAllowance = ex.fixedAllowance !== undefined ? ex.fixedAllowance : existing.fixedAllowance;
      emp.dailyAllowance = ex.dailyAllowance !== undefined ? ex.dailyAllowance : existing.dailyAllowance;
      emp.leaveQuota = ex.leaveQuota !== undefined ? ex.leaveQuota : existing.leaveQuota;
      emp.usedLeave = ex.usedLeave !== undefined ? ex.usedLeave : existing.usedLeave;
      emp.assignedProjectId = ex.assignedProjectId || existing.assignedProjectId;
      emp.status = ex.status || 'ACTIVE';
      if (emp.maritalStatus === undefined && ex.maritalStatus !== undefined) emp.maritalStatus = ex.maritalStatus;
      if (emp.dependents === undefined && ex.dependents !== undefined) emp.dependents = ex.dependents;
      if (emp.ptkpStatus === undefined && ex.ptkpStatus !== undefined) emp.ptkpStatus = ex.ptkpStatus;
      if (emp.npwpNumber === undefined && ex.npwpNumber !== undefined) emp.npwpNumber = ex.npwpNumber;
    }
  }

  // Normalize maritalStatus and ptkpStatus (PPh 21)
  let rawMs = String(emp.maritalStatus || 'TK').trim().toUpperCase();
  if (rawMs === 'K/I' || rawMs.includes('ISTRI') || rawMs.includes('GABUNG')) emp.maritalStatus = 'K/I';
  else if (rawMs === 'K' || rawMs === 'KAWIN' || rawMs === 'MENIKAH' || rawMs === 'MARRIED') emp.maritalStatus = 'K';
  else emp.maritalStatus = 'TK';
  emp.dependents = Math.min(3, Math.max(0, parseInt(emp.dependents, 10) || 0));
  if (!emp.ptkpStatus) {
    emp.ptkpStatus = `${emp.maritalStatus}/${emp.dependents}`;
  }

  // Synchronize active/inactive status and system_role/role to user_accounts
  const userAccountStatus = emp.status === 'INACTIVE' ? 'inactive' : 'active';
  const targetSysRole = emp.id === 'EMP-001' ? 'superuser' : (emp.systemRole === 'admin' ? 'hr' : emp.systemRole || 'staff');
  let targetRole = emp.role || 'Employee';
  if (targetSysRole === 'superuser') {
    targetRole = 'Director';
    emp.role = 'Director';
  } else if (targetSysRole === 'hr' && (targetRole === 'Employee' || targetRole === 'Staff')) {
    targetRole = 'HR_Manager';
    emp.role = 'HR_Manager';
  } else if (targetSysRole === 'finance' && (targetRole === 'Employee' || targetRole === 'Staff')) {
    targetRole = 'Finance';
    emp.role = 'Finance';
  }
  emp.systemRole = targetSysRole;

  // Validate Custom Login ID & Enforce Global Uniqueness
  const cleanLoginId = emp.loginId ? String(emp.loginId).trim().toLowerCase() : null;
  if (cleanLoginId) {
    const existingUser = db.prepare(`
      SELECT id, employee_id, username 
      FROM user_accounts 
      WHERE LOWER(username) = ? AND employee_id != ? AND id != ?
      LIMIT 1;
    `).get(cleanLoginId, emp.id, emp.id);

    if (existingUser) {
      return {
        success: false,
        error: `ID Login '${emp.loginId}' sudah terdaftar untuk pengguna lain di sistem. Silakan gunakan ID lain.`
      };
    }

    const allEmpRows = db.prepare('SELECT id, data_json FROM employees WHERE id != ?;').all(emp.id);
    for (const er of allEmpRows) {
      try {
        const parsed = JSON.parse(er.data_json);
        if (parsed.loginId && String(parsed.loginId).trim().toLowerCase() === cleanLoginId) {
          return {
            success: false,
            error: `ID Login '${emp.loginId}' sudah terdaftar untuk karyawan lain di sistem. Silakan gunakan ID lain.`
          };
        }
      } catch (e) {}
    }

    emp.loginId = cleanLoginId;
  }

  db.prepare(`
    INSERT OR REPLACE INTO employees (
      id, nik, name, email, phone, role, department, position,
      employmentType, joinDate, assignedProjectId, baseSalary,
      fixedAllowance, dailyAllowance, leaveQuota, usedLeave,
      bankAccount, avatar, data_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `).run(
    emp.id, emp.nik, emp.name, emp.email || null, emp.phone || null, targetRole,
    emp.department || null, emp.position || null, emp.employmentType || 'TETAP', emp.joinDate || null,
    emp.assignedProjectId || null, emp.baseSalary ?? 0, emp.fixedAllowance ?? 0,
    emp.dailyAllowance ?? 0, emp.leaveQuota ?? 12, emp.usedLeave ?? 0,
    emp.bankAccount ? JSON.stringify(emp.bankAccount) : null, emp.avatar || null, JSON.stringify(emp)
  );

  try {
    const res = db.prepare(`
      UPDATE user_accounts 
      SET username = COALESCE(?, username), email = COALESCE(?, email), system_role = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE employee_id = ? OR id = ?;
    `).run(cleanLoginId || null, emp.email || null, targetSysRole, targetRole, userAccountStatus, emp.id, emp.id);

    // Auto-cascade updated loginId, name, and NIK to attendances table (SSOT)
    if (cleanLoginId || emp.name) {
      try {
        const attRows = db.prepare('SELECT id, data_json FROM attendances WHERE employeeId = ? OR employeeNik = ?;').all(emp.id, emp.nik || emp.id);
        const updateAttStmt = db.prepare('UPDATE attendances SET employeeName = ?, employeeNik = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;');
        for (const ar of attRows) {
          try {
            const parsed = JSON.parse(ar.data_json);
            if (cleanLoginId) parsed.employeeLoginId = cleanLoginId;
            parsed.employeeName = emp.name;
            if (emp.nik) parsed.employeeNik = emp.nik;
            updateAttStmt.run(emp.name, emp.nik || parsed.employeeNik || null, JSON.stringify(parsed), ar.id);
          } catch (eParsed) {}
        }
      } catch (eAttSync) {
        console.warn('Error cascading employee update to attendances:', eAttSync.message);
      }

      // Auto-cascade updated loginId, name, and NIK to approvals table (SSOT)
      try {
        const apprRows = db.prepare('SELECT id, data_json FROM approvals WHERE employeeId = ?;').all(emp.id);
        const updateApprStmt = db.prepare('UPDATE approvals SET employeeName = ?, employeeNik = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;');
        for (const ap of apprRows) {
          try {
            const parsed = JSON.parse(ap.data_json);
            if (cleanLoginId) parsed.employeeLoginId = cleanLoginId;
            parsed.employeeName = emp.name;
            if (emp.nik !== undefined) parsed.employeeNik = emp.nik || '';
            updateApprStmt.run(emp.name, emp.nik || '', JSON.stringify(parsed), ap.id);
          } catch (eApprParsed) {}
        }
      } catch (eApprSync) {
        console.warn('Error cascading employee update to approvals:', eApprSync.message);
      }
    }

    // Sync project manager name across projects if this employee is a PM
    try {
      db.prepare(`
        UPDATE projects 
        SET projectManagerName = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE projectManagerId = ?;
      `).run(emp.name, emp.id);
    } catch (ePm) {}

    // Auto-sync employee phone mapping into wa_opt_ins (without fake messages; default is_active = 0)
    if (emp.phone) {
      let eDigits = String(emp.phone).replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = '62' + eDigits.slice(1);
      else if (eDigits.startsWith('8')) eDigits = '62' + eDigits;
      else if (eDigits.startsWith('620')) eDigits = '62' + eDigits.slice(3);
      if (eDigits.startsWith('62') && eDigits.length >= 10) {
        try {
          db.prepare(`
            INSERT INTO wa_opt_ins (phone, employee_id, employee_name, is_active, manual_override, message_count)
            VALUES (?, ?, ?, 0, 0, 0)
            ON CONFLICT(phone) DO UPDATE SET employee_id = excluded.employee_id, employee_name = excluded.employee_name;
          `).run(eDigits, emp.id, emp.name);
        } catch (errOpt) {}
      }
    }

    // If no user account existed yet for this employee, create it
    if (res.changes === 0 && emp.id !== 'EMP-001') {
      const loginId = emp.loginId || emp.id;
      const email = emp.email || `${loginId}@primeprojectx.net`;
      const { hash, salt } = hashPassword('zzz');
      db.prepare(`
        INSERT INTO user_accounts (
          id, employee_id, email, username, password_hash, salt, role, system_role, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `).run(`USR-${emp.id}`, emp.id, email, loginId, hash, salt, targetRole, targetSysRole, userAccountStatus);
    }
  } catch (err) {
    console.error('Error syncing user_accounts status & system_role for employee', emp.id, err);
  }

  addAuditLog({
    action: 'SAVE_EMPLOYEE',
    entity: 'employees',
    entityId: emp.id,
    userName: operatorUser?.name || 'Admin HR',
    userLoginId: operatorUser?.loginId || operatorUser?.username || 'admin',
    userRole: operatorUser?.systemRole || 'admin',
    userIp: operatorUser?.clientIp || '127.0.0.1',
    module: 'EMPLOYEES',
    status: 'SUCCESS',
    details: `Data master karyawan ${emp.name} (ID: ${emp.loginId || emp.nik}) - Jabatan ${emp.position} di departemen ${emp.department} diperbarui (Status: ${emp.status || 'ACTIVE'}).`
  });

  return { success: true, employee: emp };
}

export function updateUserProfile(profileData, operatorUser = null) {
  const db = getDatabase();
  const empId = profileData.id || profileData.employeeId;
  if (!empId) {
    return { success: false, error: 'Employee ID is required' };
  }

  const existingRow = db.prepare('SELECT id, nik, name, email, phone, role, department, position, data_json FROM employees WHERE id = ? OR nik = ?;').get(empId, empId);
  if (!existingRow) {
    return { success: false, error: 'Data karyawan tidak ditemukan di database' };
  }

  let emp = {};
  try {
    emp = JSON.parse(existingRow.data_json);
  } catch (e) {}

  // Update personal allowed fields
  if (profileData.name && String(profileData.name).trim()) {
    emp.name = String(profileData.name).trim();
  }
  if (profileData.phone !== undefined) {
    emp.phone = String(profileData.phone).trim();
  }
  if (profileData.email !== undefined) {
    emp.email = String(profileData.email).trim();
  }
  if (profileData.bankAccount) {
    emp.bankAccount = {
      bankName: profileData.bankAccount.bankName || emp.bankAccount?.bankName || 'BCA',
      accountNumber: String(profileData.bankAccount.accountNumber || '').trim(),
      accountHolder: String(profileData.bankAccount.accountHolder || emp.name).trim()
    };
  }
  if (profileData.avatar) {
    emp.avatar = profileData.avatar;
  }
  if (profileData.maritalStatus !== undefined) {
    let raw = String(profileData.maritalStatus).trim().toUpperCase();
    if (raw === 'K/I' || raw.includes('ISTRI') || raw.includes('GABUNG')) emp.maritalStatus = 'K/I';
    else if (raw === 'K' || raw === 'KAWIN' || raw === 'MENIKAH' || raw === 'MARRIED') emp.maritalStatus = 'K';
    else emp.maritalStatus = 'TK';
  }
  if (profileData.dependents !== undefined) {
    emp.dependents = Math.min(3, Math.max(0, parseInt(profileData.dependents, 10) || 0));
  }
  if (profileData.ptkpStatus !== undefined) {
    emp.ptkpStatus = String(profileData.ptkpStatus).trim().toUpperCase();
  } else if (profileData.maritalStatus !== undefined || profileData.dependents !== undefined) {
    emp.ptkpStatus = `${emp.maritalStatus || 'TK'}/${emp.dependents || 0}`;
  }
  if (profileData.npwpNumber !== undefined) {
    emp.npwpNumber = String(profileData.npwpNumber).trim();
  }

  // Preserve ID and NIK
  emp.id = existingRow.id;
  emp.nik = existingRow.nik;

  // Update employees table
  db.prepare(`
    UPDATE employees
    SET name = ?, email = ?, phone = ?, bankAccount = ?, avatar = COALESCE(?, avatar), data_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `).run(
    emp.name,
    emp.email || null,
    emp.phone || null,
    emp.bankAccount ? JSON.stringify(emp.bankAccount) : null,
    profileData.avatar || null,
    JSON.stringify(emp),
    emp.id
  );

  // Update user_accounts table (email and sync name in audit)
  try {
    db.prepare(`
      UPDATE user_accounts
      SET email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = ? OR id = ?;
    `).run(emp.email || null, emp.id, emp.id);
  } catch (errUa) {}

  // Sync phone mapping to wa_opt_ins (without fake messages; default is_active = 0)
  if (emp.phone) {
    let eDigits = String(emp.phone).replace(/\D+/g, '');
    if (eDigits.startsWith('0')) eDigits = '62' + eDigits.slice(1);
    else if (eDigits.startsWith('8')) eDigits = '62' + eDigits;
    else if (eDigits.startsWith('620')) eDigits = '62' + eDigits.slice(3);
    if (eDigits.startsWith('62') && eDigits.length >= 10) {
      try {
        db.prepare(`
          INSERT INTO wa_opt_ins (phone, employee_id, employee_name, is_active, manual_override, message_count)
          VALUES (?, ?, ?, 0, 0, 0)
          ON CONFLICT(phone) DO UPDATE SET employee_id = excluded.employee_id, employee_name = excluded.employee_name;
        `).run(eDigits, emp.id, emp.name);
      } catch (errOpt) {}
    }
  }

  // Add audit log
  const operatorLogin = operatorUser?.username || operatorUser?.loginId || emp.loginId || (emp.id === 'EMP-001' ? 'admin' : emp.id);
  addAuditLog({
    action: 'UPDATE_PROFILE',
    entity: 'employees',
    entityId: emp.id,
    userName: operatorUser?.name || emp.name,
    userNik: null,
    userLoginId: operatorLogin,
    userRole: operatorUser?.systemRole || emp.systemRole || 'staff',
    module: 'MASTER_DATA',
    ipAddress: operatorUser?.clientIp || '127.0.0.1',
    status: 'SUCCESS',
    details: `Profil mandiri karyawan ${emp.name} (ID Login: ${operatorLogin}) berhasil diperbarui (No HP: ${emp.phone || '-'}, Rekening: ${emp.bankAccount?.bankName || '-'} ${emp.bankAccount?.accountNumber || '-'}).`
  });

  return { success: true, message: 'Profil mandiri berhasil disimpan ke database', employee: emp };
}

export function deleteEmployee(employeeId, operatorUser = null) {
  const db = getDatabase();
  const cleanId = String(employeeId || '').trim();
  if (!cleanId) return { success: false, error: 'Employee ID is required' };
  if (cleanId === 'EMP-001') {
    return { success: false, error: 'Akun Master Superuser (EMP-001) dilindungi dan tidak dapat dihapus' };
  }

  const empRow = db.prepare('SELECT id, nik, name FROM employees WHERE id = ? OR nik = ? LIMIT 1;').get(cleanId, cleanId);
  const targetId = empRow?.id || cleanId;
  const targetNik = empRow?.nik || cleanId;
  const targetName = empRow?.name || cleanId;

  // 1. Delete from user_accounts
  try {
    db.prepare('DELETE FROM user_accounts WHERE employee_id = ? OR id = ? OR username = ?;').run(targetId, `USR-${targetId}`, targetNik);
  } catch (err) {
    console.error('[SQLite] Failed to delete user_accounts for employee', cleanId, err);
  }

  // 2. Delete from wa_opt_ins
  try {
    db.prepare('DELETE FROM wa_opt_ins WHERE employee_id = ?;').run(targetId);
  } catch (err) {}

  // 3. Remove from assignedPersonnelIds in projects data_json if present
  try {
    const projRows = db.prepare('SELECT id, data_json FROM projects;').all();
    const updateProjStmt = db.prepare('UPDATE projects SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;');
    for (const pRow of projRows) {
      if (!pRow.data_json) continue;
      try {
        const pObj = JSON.parse(pRow.data_json);
        if (Array.isArray(pObj.assignedPersonnelIds) && pObj.assignedPersonnelIds.includes(targetId)) {
          pObj.assignedPersonnelIds = pObj.assignedPersonnelIds.filter(id => id !== targetId);
          updateProjStmt.run(JSON.stringify(pObj), pRow.id);
        }
      } catch (pe) {}
    }
  } catch (err) {
    console.warn('[SQLite] Warning cleaning up project assigned personnel for employee', cleanId, err);
  }

  // 4. Clean up related attendances and approvals to avoid orphaned records
  try {
    db.prepare('DELETE FROM attendances WHERE employeeId = ? OR employeeNik = ?;').run(targetId, targetNik);
  } catch (err) {}
  try {
    db.prepare('DELETE FROM approvals WHERE employeeId = ? OR employeeNik = ?;').run(targetId, targetNik);
  } catch (err) {}

  // 5. Delete from employees
  const res = db.prepare('DELETE FROM employees WHERE id = ? OR nik = ?;').run(targetId, targetNik);

  const operatorLogin = operatorUser?.username || operatorUser?.loginId || (operatorUser?.systemRole === 'superuser' ? 'admin' : 'Admin HR');
  addAuditLog({
    action: 'DELETE_EMPLOYEE',
    entity: 'employees',
    entityId: targetId,
    userName: operatorUser?.name || operatorLogin,
    userNik: null,
    userLoginId: operatorLogin,
    userRole: operatorUser?.systemRole || operatorUser?.role || 'admin',
    module: 'EMPLOYEES',
    ipAddress: operatorUser?.clientIp || '127.0.0.1',
    status: 'SUCCESS',
    details: `Data master karyawan ${targetName} (ID: ${cleanId}) berhasil dihapus permanen oleh ${operatorLogin}.`
  });

  return { success: true, id: targetId, name: targetName };
}

/**
 * Public Kiosk Safe Directory
 * Returns minimal employee data needed for quick attendance kiosk without exposing salary or bank data.
 */
/**
 * Ultra-Fast Enrolled Biometric Gallery Directory
 * Returns ONLY employees who have completed biometric enrollment, with minimal payload (under 80 KB).
 */
export function getEnrolledBiometricGallery() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT 
      e.id, 
      e.nik, 
      e.name, 
      e.role, 
      e.department, 
      e.position, 
      e.data_json,
      MIN(u.username) AS loginUsername
    FROM employees e
    LEFT JOIN user_accounts u ON u.employee_id = e.id
    WHERE e.data_json LIKE '%"isEnrolled":true%'
    GROUP BY e.id
    ORDER BY e.name ASC;
  `).all();

  const enrolled = [];
  for (const r of rows) {
    let data = {};
    try {
      data = JSON.parse(r.data_json);
    } catch (e) {}

    const bio = data.biometric || null;
    if (bio && bio.isEnrolled && bio.samples && (bio.samples.front || bio.samples.smile || bio.samples.right || bio.samples.left)) {
      if (data.status !== 'INACTIVE') {
        enrolled.push({
          id: r.id,
          nik: r.nik,
          name: r.name,
          role: r.role,
          department: r.department,
          position: r.position,
          loginUsername: r.loginUsername || data.loginUsername || null,
          hasBiometric: true,
          biometric: {
            isEnrolled: true,
            samples: bio.samples
          }
        });
      }
    }
  }

  return enrolled;
}

/**
 * Public Kiosk Safe Directory
 * Returns minimal employee data needed for quick attendance kiosk without exposing salary or bank data.
 */
export function getPublicKioskEmployees() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT 
      e.id, 
      e.nik, 
      e.name, 
      e.role, 
      e.department, 
      e.position, 
      e.assignedProjectId,
      e.avatar, 
      e.data_json,
      MIN(u.username) AS loginUsername
    FROM employees e
    LEFT JOIN user_accounts u ON u.employee_id = e.id
    GROUP BY e.id
    ORDER BY e.name ASC;
  `).all();

  const projectRows = db.prepare('SELECT data_json FROM projects ORDER BY code ASC;').all();
  const projects = projectRows.map(r => {
    let p = {};
    try { p = JSON.parse(r.data_json); } catch (e) {}
    const locLower = (p.location || '').toLowerCase();
    const geofence = p.customRules?.geofence || (
      locLower.includes('pomalaa') || p.name?.toLowerCase().includes('pomalaa') ? {
        name: 'Site Pomalaa Kolaka',
        lat: -4.1812,
        lng: 121.6111,
        radiusMeters: 500
      } : locLower.includes('palembang') || p.name?.toLowerCase().includes('palembang') || p.name?.toLowerCase().includes('gani') ? {
        name: 'Site RS AK Gani Palembang',
        lat: -2.991240,
        lng: 104.757310,
        radiusMeters: 350
      } : locLower.includes('ciremai') || p.name?.toLowerCase().includes('ciremai') ? {
        name: 'Site RS Ciremai Cirebon',
        lat: -6.737150,
        lng: 108.552860,
        radiusMeters: 350
      } : {
        name: 'PT Dwi Martha Jaya - Kantor Pusat & Workshop Terpadu',
        lat: -7.293144,
        lng: 112.775337,
        radiusMeters: 350
      }
    );
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      location: p.location,
      geofence
    };
  });

  const rulesRow = db.prepare('SELECT config_json FROM salary_rules WHERE id = ?;').get('default');
  const salaryRules = rulesRow ? JSON.parse(rulesRow.config_json) : null;
  const officeGeofence = salaryRules?.officeGeofence || {
    name: 'PT Dwi Martha Jaya - Kantor Pusat & Workshop Terpadu',
    lat: -7.293144,
    lng: 112.775337,
    radiusMeters: 350,
    address: 'Jl. Klampis Anom No. 35 D-11, Wisma Mukti, Klampis Ngasem, Sukolilo, Surabaya'
  };

  const employees = rows
    .map(r => {
      let data = {};
      try {
        data = JSON.parse(r.data_json);
      } catch (e) {}

      const bio = data.biometric || null;
      const hasBiometric = Boolean(bio && bio.isEnrolled && bio.samples);

      return {
        id: r.id,
        nik: r.nik,
        name: r.name,
        role: r.role,
        department: r.department,
        position: r.position,
        assignedProjectId: r.assignedProjectId || data.assignedProjectId || null,
        avatar: r.avatar || null,
        loginUsername: r.loginUsername || data.loginUsername || null,
        hasBiometric,
        biometric: bio,
        status: data.status || 'ACTIVE'
      };
    })
    .filter(e => e.status !== 'INACTIVE');

  const todayWib = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const todayRows = db.prepare('SELECT id, employeeId, date, checkInTime, checkOutTime, status, isLate, lateMinutes FROM attendances WHERE date = ?;').all(todayWib);
  const todayAttendances = {};
  for (const att of todayRows) {
    todayAttendances[att.employeeId] = att;
  }

  return {
    employees,
    projects,
    officeGeofence,
    todayAttendances
  };
}

export function saveProject(proj) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, code, name, client, location, status,
      startDate, targetEndDate, allocatedBudget, actualLaborCost,
      projectedLaborCost, totalEstimatedHours, actualHoursSpent,
      hourlyRateMultiplier, data_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `).run(
    proj.id,
    proj.code,
    proj.name,
    proj.client || null,
    proj.location || null,
    proj.status || 'ACTIVE',
    proj.startDate || null,
    proj.targetEndDate || null,
    proj.allocatedBudget || 0,
    proj.actualLaborCost || 0,
    proj.projectedLaborCost || 0,
    proj.totalEstimatedHours || 0,
    proj.actualHoursSpent || 0,
    proj.hourlyRateMultiplier || 1.0,
    JSON.stringify(proj)
  );

  addAuditLog({
    action: 'SAVE_PROJECT',
    entity: 'projects',
    entityId: proj.id,
    userName: 'Direksi / Project Lead',
    userRole: 'admin',
    module: 'PROJECTS',
    status: 'SUCCESS',
    details: `Data proyek [${proj.code}] ${proj.name} (Klien: ${proj.client || '-'}) berhasil diperbarui. Pengaturan khusus: ${proj.customRules?.workSchedule?.enabled ? `Jam Site ${proj.customRules.workSchedule.checkInTime}-${proj.customRules.workSchedule.checkOutTime}` : 'Jam Standar'}, ${proj.customRules?.leavePolicy?.enabled ? `Roster ${proj.customRules.leavePolicy.rosterPattern}` : 'Cuti Standar'}.`
  });

  return { success: true, project: proj };
}

export function saveSalaryRules(rules) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO salary_rules (id, config_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `).run('default', JSON.stringify(rules));

  addAuditLog({
    action: 'UPDATE_SALARY_RULES',
    entity: 'salary_rules',
    entityId: 'default',
    userName: 'Direksi / Superuser',
    userRole: 'superuser',
    module: 'HR_RULES',
    status: 'SUCCESS',
    details: `Konfigurasi kebijakan gaji & geofence kantor (${rules.officeGeofence?.name || 'Kantor Pusat'}, radius ${rules.officeGeofence?.radiusMeters}m) diperbarui.`
  });

  return { success: true, rules };
}

export function resetDatabase() {
  const db = getDatabase();
  db.exec('DELETE FROM employees;');
  db.exec('DELETE FROM projects;');
  db.exec('DELETE FROM attendances;');
  db.exec('DELETE FROM approvals;');
  db.exec('DELETE FROM salary_rules;');
  db.exec('DELETE FROM audit_logs;');
  db.exec('DELETE FROM user_accounts;');
  seedInitialData(db);
  seedDefaultUsers(db);
  return getAllData();
}

export function seedDefaultUsers(db) {
  console.log('[SQLite] Seeding akun pengguna default Prime HRIS...');
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO user_accounts (
      id, employee_id, email, username, password_hash, salt, role, system_role, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const defaults = [
    {
      id: 'USR-001',
      employee_id: 'EMP-001',
      email: 'admin@primeprojectx.net',
      username: 'admin',
      pass: 'admin123',
      role: 'Director',
      system_role: 'superuser'
    }
  ];

  for (const u of defaults) {
    const { hash, salt } = hashPassword(u.pass);
    insertUser.run(
      u.id, u.employee_id, u.email, u.username, hash, salt, u.role, u.system_role, 'active'
    );
  }
  // Ensure legacy USR-002 (galih) is purged
  db.prepare("DELETE FROM user_accounts WHERE username = 'galih' OR id = 'USR-002';").run();
  console.log('[SQLite] Akun Galih Primananda (Superuser Admin) berhasil di-seed.');
}

export function authenticateUser(identifier, password, ipAddress = '127.0.0.1') {
  const db = getDatabase();
  const trimmed = (identifier || '').trim().toLowerCase();
  const candidates = db.prepare(`
    SELECT u.* FROM user_accounts u
    WHERE LOWER(u.email) = ? OR LOWER(u.username) = ?;
  `).all(trimmed, trimmed);

  if (!candidates || candidates.length === 0) {
    addAuditLog({
      action: 'AUTH_LOGIN_FAILED',
      entity: 'user_accounts',
      entityId: null,
      userName: identifier || 'Unknown',
      userRole: 'guest',
      module: 'AUTH',
      ipAddress,
      status: 'FAILED',
      details: `Percobaan login gagal: Kredensial "${identifier}" tidak terdaftar dalam sistem.`
    });
    return { success: false, error: 'ID Login Akun atau Email tidak terdaftar' };
  }

  let user = null;
  let hasInactive = false;

  for (const cand of candidates) {
    if (verifyPassword(password, cand.password_hash, cand.salt)) {
      if (cand.status === 'active') {
        user = cand;
        break;
      } else {
        hasInactive = true;
      }
    }
  }

  if (!user) {
    if (hasInactive) {
      addAuditLog({
        action: 'AUTH_LOGIN_BLOCKED',
        entity: 'user_accounts',
        entityId: candidates[0]?.id || null,
        userName: candidates[0]?.username || identifier,
        userRole: candidates[0]?.system_role || 'staff',
        module: 'AUTH',
        ipAddress,
        status: 'WARNING',
        details: `Percobaan login ditolak: Akun "${identifier}" sedang berstatus non-aktif.`
      });
      return { success: false, error: 'Akun Anda sedang dinonaktifkan. Hubungi Administrator.' };
    }
    addAuditLog({
      action: 'AUTH_LOGIN_FAILED',
      entity: 'user_accounts',
      entityId: candidates[0]?.id || null,
      userName: candidates[0]?.username || identifier,
      userRole: candidates[0]?.system_role || 'staff',
      module: 'AUTH',
      ipAddress,
      status: 'FAILED',
      details: `Percobaan login gagal untuk user "${identifier}": Password yang dimasukkan salah.`
    });
    return { success: false, error: 'Password yang Anda masukkan salah' };
  }

  // Update last_login
  const now = new Date().toISOString();
  db.prepare('UPDATE user_accounts SET last_login = ? WHERE id = ?;').run(now, user.id);

  // Get Employee profile if linked
  let employee = null;
  if (user.employee_id) {
    const empRow = db.prepare('SELECT data_json FROM employees WHERE id = ?;').get(user.employee_id);
    if (empRow) {
      try { employee = JSON.parse(empRow.data_json); } catch (e) {}
    }
  }

  if (employee && employee.status === 'INACTIVE') {
    return {
      success: false,
      error: 'Akun Anda telah dinonaktifkan (Status: Non-Aktif / Resign). Hubungi HRD atau Administrator.'
    };
  }

  const token = generateToken(user);

  addAuditLog({
    action: 'AUTH_LOGIN',
    entity: 'user_accounts',
    entityId: user.id,
    userName: employee?.name || user.username,
    userNik: null,
    userLoginId: user.username,
    userRole: user.system_role,
    module: 'AUTH',
    ipAddress,
    status: 'SUCCESS',
    details: `Pengguna ${user.username} (${user.role} / ${user.system_role}) berhasil login ke sistem PRIME HRIS.`
  });

  const canonicalSystemRole = employee?.systemRole || user.system_role || 'staff';

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      systemRole: canonicalSystemRole,
      status: user.status,
      employeeId: user.employee_id,
      lastLogin: now,
      employee
    }
  };
}

export function authenticateByBiometric(employeeId, biometricVerification = {}) {
  const db = getDatabase();
  if (!employeeId) return { success: false, error: 'ID Karyawan tidak valid' };

  const cleanId = String(employeeId).trim();

  // 1. Cari akun user yang terhubung ke employeeId ini
  let user = db.prepare("SELECT * FROM user_accounts WHERE (employee_id = ? OR id = ?) AND status = 'active';").get(cleanId, cleanId);

  // Fallback untuk EMP-001 (Galih Primananda / Superuser)
  if (!user && (cleanId === 'EMP-001' || cleanId.toLowerCase() === 'admin' || cleanId === 'DMJ-2024-001')) {
    user = db.prepare("SELECT * FROM user_accounts WHERE username = 'admin';").get();
  }

  // Fallback pencarian fleksibel via tabel employees (NIK / ID)
  if (!user) {
    user = db.prepare(`
      SELECT u.* FROM user_accounts u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE (e.id = ? OR e.nik = ? OR u.username = ?) AND u.status = 'active';
    `).get(cleanId, cleanId, cleanId);
  }

  // Auto-provision user account jika employee terdaftar tapi user_accounts belum ada
  if (!user) {
    const empRow = db.prepare('SELECT id, nik, name, role, email, data_json FROM employees WHERE id = ? OR nik = ?;').get(cleanId, cleanId);
    if (empRow) {
      let parsedEmp = {};
      try { parsedEmp = JSON.parse(empRow.data_json); } catch (e) {}
      const loginId = parsedEmp.loginId || (empRow.id === 'EMP-001' ? 'admin' : empRow.id);
      const email = parsedEmp.email || empRow.email || `${loginId}@primeprojectx.net`;
      const role = parsedEmp.role || empRow.role || 'Employee';
      const systemRole = empRow.id === 'EMP-001' ? 'superuser' : (parsedEmp.systemRole === 'admin' ? 'hr' : parsedEmp.systemRole || 'staff');
      const { hash, salt } = hashPassword('zzz');
      const userId = `USR-${empRow.id}`;
      db.prepare(`
        INSERT OR REPLACE INTO user_accounts (
          id, employee_id, email, username, password_hash, salt, role, system_role, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `).run(userId, empRow.id, email, loginId, hash, salt, role, systemRole);
      user = db.prepare("SELECT * FROM user_accounts WHERE id = ?;").get(userId);
    }
  }

  if (!user) {
    return { success: false, error: 'Akun login untuk karyawan ini belum aktif atau belum terdaftar di sistem.' };
  }

  // 2. Ambil data profil karyawan
  let employee = null;
  const empRow = db.prepare('SELECT id, nik, name, data_json FROM employees WHERE id = ?;').get(employeeId);
  if (empRow) {
    try { employee = JSON.parse(empRow.data_json); } catch (e) {}
  }

  if (employee && employee.status === 'INACTIVE') {
    return {
      success: false,
      error: 'Akun karyawan Anda telah dinonaktifkan (Status: Non-Aktif / Resign). Hubungi HRD atau Administrator.'
    };
  }

  // 3. Perbarui last_login
  const now = new Date().toISOString();
  db.prepare('UPDATE user_accounts SET last_login = ? WHERE id = ?;').run(now, user.id);

  const token = generateToken(user);

  addAuditLog({
    action: 'AUTH_BIOMETRIC_LOGIN',
    entity: 'user_accounts',
    entityId: user.id,
    userName: employee?.name || user.username,
    userNik: employee?.nik || empRow?.nik,
    userRole: user.system_role,
    module: 'AUTH_BIOMETRIC',
    status: 'SUCCESS',
    details: `Login Biometrik Wajah 1:N Berhasil untuk ${employee?.name || user.username} (${user.role} / ${user.system_role}) - Skor Kemiripan: ${biometricVerification?.matchScore || 0}%`
  });

  const canonicalSystemRole = employee?.systemRole || user.system_role || 'staff';

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      systemRole: canonicalSystemRole,
      status: user.status,
      employeeId: user.employee_id,
      lastLogin: now,
      employee
    }
  };
}

export function getCurrentUserFromToken(token) {
  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM user_accounts WHERE id = ?;').get(payload.userId);
  if (!user || user.status !== 'active') return null;

  let employee = null;
  if (user.employee_id) {
    const empRow = db.prepare('SELECT data_json FROM employees WHERE id = ?;').get(user.employee_id);
    if (empRow) {
      try { employee = JSON.parse(empRow.data_json); } catch (e) {}
    }
  }

  if (employee && employee.status === 'INACTIVE') return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    systemRole: user.system_role,
    status: user.status,
    employeeId: user.employee_id,
    lastLogin: user.last_login,
    employee
  };
}

export function changeUserPassword(userId, oldPassword, newPassword, clientIp = '127.0.0.1', operatorUser = null) {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM user_accounts WHERE id = ?;').get(userId);
  if (!user) return { success: false, error: 'User tidak ditemukan' };

  if (oldPassword) {
    const isValid = verifyPassword(oldPassword, user.password_hash, user.salt);
    if (!isValid) return { success: false, error: 'Password lama salah' };
  }

  if (!newPassword || newPassword.length < 3) {
    return { success: false, error: 'Password baru minimal 3 karakter' };
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE user_accounts SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
    .run(hash, salt, userId);

  addAuditLog({
    action: 'PASSWORD_CHANGE',
    entity: 'user_accounts',
    entityId: userId,
    userName: user.username,
    userLoginId: user.username,
    userRole: user.system_role,
    module: 'AUTH',
    ipAddress: clientIp || operatorUser?.clientIp || '127.0.0.1',
    status: 'SUCCESS',
    details: `Password akun pengguna ${user.username} berhasil diubah.`
  });

  return { success: true };
}

export function resetEmployeePassword(employeeId, newPassword = 'zzz', operatorUser = null, clientIp = '127.0.0.1') {
  const db = getDatabase();
  const empRow = db.prepare('SELECT id, nik, name, data_json FROM employees WHERE id = ?;').get(employeeId);
  if (!empRow) {
    return { success: false, error: 'Karyawan tidak ditemukan di database' };
  }

  // Strict safeguard: EMP-001 (Galih Primananda) cannot be reset via bulk employee action
  if (employeeId === 'EMP-001') {
    if (!operatorUser || (operatorUser.employeeId !== 'EMP-001' && operatorUser.username !== 'admin')) {
      return { success: false, error: 'Proteksi Keamanan: Akun Superuser Direktur (Galih Primananda) tidak dapat di-reset oleh pihak lain.' };
    }
  }

  if (!newPassword || newPassword.length < 3) {
    return { success: false, error: 'Password baru minimal 3 karakter' };
  }

  let parsedEmp = {};
  try { parsedEmp = JSON.parse(empRow.data_json); } catch (e) {}

  let user = db.prepare('SELECT * FROM user_accounts WHERE employee_id = ?;').get(employeeId);
  const loginId = parsedEmp.loginId || user?.username || (employeeId === 'EMP-001' ? 'admin' : `d${String(employeeId.replace(/\\D/g, '')).padStart(3, '0')}`);

  const { hash, salt } = hashPassword(newPassword);

  if (!user) {
    const userId = `USR-${employeeId}`;
    const email = parsedEmp.email || `${loginId}@primeprojectx.net`;
    const role = parsedEmp.role || 'Employee';
    const systemRole = parsedEmp.systemRole || 'staff';
    db.prepare(`
      INSERT INTO user_accounts (id, employee_id, email, username, password_hash, salt, role, system_role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `).run(userId, employeeId, email, loginId, hash, salt, role, systemRole);
    user = { id: userId, username: loginId };
  } else {
    db.prepare('UPDATE user_accounts SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
      .run(hash, salt, user.id);
  }

  // Sync back loginId to data_json if missing
  if (!parsedEmp.loginId) {
    parsedEmp.loginId = user.username || loginId;
    db.prepare('UPDATE employees SET data_json = ? WHERE id = ?;').run(JSON.stringify(parsedEmp), employeeId);
  }

  const operatorLogin = operatorUser?.username || operatorUser?.loginId || 'admin';
  addAuditLog({
    action: 'RESET_PASSWORD',
    entity: 'user_accounts',
    entityId: user.id,
    userName: operatorUser?.name || operatorLogin,
    userNik: null,
    userLoginId: operatorLogin,
    userRole: operatorUser?.systemRole || 'admin',
    module: 'AUTH',
    ipAddress: operatorUser?.clientIp || clientIp || '127.0.0.1',
    status: 'SUCCESS',
    details: `Password akun untuk ${empRow.name} (ID Login: ${user.username || loginId}) berhasil di-reset menjadi default '${newPassword}'.`
  });

  return {
    success: true,
    message: `Password untuk ${empRow.name} (${user.username || loginId}) berhasil di-reset ke: ${newPassword}`,
    loginId: user.username || loginId,
    defaultPassword: newPassword
  };
}

function cleanDigits(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D+/g, '');
}

function cleanPhoneMatch(a, b) {
  const d1 = cleanDigits(a);
  const d2 = cleanDigits(b);
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  const s1 = d1.startsWith('62') ? d1.slice(2) : (d1.startsWith('0') ? d1.slice(1) : d1);
  const s2 = d2.startsWith('62') ? d2.slice(2) : (d2.startsWith('0') ? d2.slice(1) : d2);
  return s1 === s2 || (s1.length >= 8 && s2.length >= 8 && (s1.endsWith(s2) || s2.endsWith(s1)));
}

export function generateTemporaryPassword(rawIdentifier) {
  const db = getDatabase();
  const input = String(rawIdentifier || '').trim();
  if (!input) {
    return { success: false, error: 'Nomor HP, Email, atau ID/Username wajib diisi' };
  }

  const lowerInput = input.toLowerCase();
  const digits = cleanDigits(input);

  let targetUser = null;
  let targetEmployee = null;

  // 1. Direct query in user_accounts (username, email, or linked employee NIK / ID)
  const candUsers = db.prepare(`
    SELECT u.*, e.id AS emp_id, e.name AS emp_name, e.email AS emp_email, e.phone AS emp_phone, e.nik AS emp_nik, e.data_json
    FROM user_accounts u
    LEFT JOIN employees e ON u.employee_id = e.id
    WHERE LOWER(u.username) = ? OR LOWER(u.email) = ? OR LOWER(e.nik) = ? OR LOWER(e.id) = ?;
  `).all(lowerInput, lowerInput, lowerInput, lowerInput);

  if (candUsers && candUsers.length > 0) {
    targetUser = candUsers.find(u => u.status === 'active') || candUsers[0];
    if (targetUser.emp_id) {
      targetEmployee = {
        id: targetUser.emp_id,
        name: targetUser.emp_name,
        email: targetUser.emp_email || targetUser.email,
        phone: targetUser.emp_phone,
        nik: targetUser.emp_nik,
        data_json: targetUser.data_json
      };
    }
  }

  // 2. Direct query in employees (email, nik, id, name)
  if (!targetUser && !targetEmployee) {
    const candEmps = db.prepare(`
      SELECT e.*, u.id AS u_id, u.username AS u_username, u.email AS u_email, u.status AS u_status
      FROM employees e
      LEFT JOIN user_accounts u ON (u.employee_id = e.id OR LOWER(u.username) = LOWER(e.nik))
      WHERE LOWER(e.email) = ? OR LOWER(e.nik) = ? OR LOWER(e.id) = ? OR LOWER(e.name) = ?;
    `).all(lowerInput, lowerInput, lowerInput, lowerInput);

    if (candEmps && candEmps.length > 0) {
      const e = candEmps[0];
      targetEmployee = e;
      if (e.u_id) {
        targetUser = db.prepare('SELECT * FROM user_accounts WHERE id = ?;').get(e.u_id);
      }
    }
  }

  // 3. Search by Phone Number across employees if input contains digits
  if (!targetEmployee && digits.length >= 8) {
    const allEmps = db.prepare('SELECT id, nik, name, email, phone, data_json FROM employees;').all();
    for (const e of allEmps) {
      if (cleanPhoneMatch(e.phone, input)) {
        targetEmployee = e;
        targetUser = db.prepare('SELECT * FROM user_accounts WHERE employee_id = ?;').get(e.id);
        break;
      }
    }
  }

  if (!targetUser && !targetEmployee) {
    return {
      success: false,
      error: 'Data pengguna tidak ditemukan. Pastikan Nomor HP, Email, atau Username/NIK yang Anda masukkan sudah terdaftar di sistem.'
    };
  }

  // Determine IDs & Display Info
  const empId = targetEmployee?.id || targetUser?.employee_id;
  const displayName = targetEmployee?.name || targetUser?.username || 'Karyawan';
  const targetEmail = targetUser?.email || targetEmployee?.email;
  const targetPhone = targetEmployee?.phone;
  let username = targetUser?.username;

  if (!username) {
    username = targetEmployee?.loginId || (empId === 'EMP-001' ? 'admin' : empId);
  }

  // Generate Temporary Password (Readable & Secure PIN)
  const randomPin = Math.floor(1000 + Math.random() * 9000);
  const tempPassword = `PRIME-${randomPin}`;
  const { hash, salt } = hashPassword(tempPassword);

  // Update or insert into user_accounts
  if (targetUser) {
    db.prepare('UPDATE user_accounts SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
      .run(hash, salt, targetUser.id);
  } else if (empId) {
    const userId = `USR-${empId}`;
    const userRole = targetEmployee?.role || 'Employee';
    const userSysRole = targetEmployee?.systemRole || 'staff';
    db.prepare(`
      INSERT OR REPLACE INTO user_accounts (id, employee_id, email, username, password_hash, salt, role, system_role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `).run(userId, empId, targetEmail || `${username}@primeprojectx.net`, username, hash, salt, userRole, userSysRole);
  }

  // Audit Log
  addAuditLog({
    action: 'FORGOT_PASSWORD_RESET',
    entity: 'user_accounts',
    entityId: targetUser?.id || empId,
    userName: displayName,
    userNik: targetEmployee?.nik || 'N/A',
    userRole: targetUser?.system_role || 'staff',
    module: 'AUTH',
    status: 'SUCCESS',
    details: `Password sementara berhasil digenerate untuk pengguna ${username} (${displayName}).`
  });

  return {
    success: true,
    tempPassword,
    username,
    displayName,
    targetPhone,
    targetEmail,
    employeeId: empId
  };
}

export function saveEmployeeBiometric(employeeId, biometricProfile, updateAvatarAsWell = false, operatorUser = null) {
  const db = getDatabase();
  const empRow = db.prepare('SELECT id, nik, name, avatar, data_json FROM employees WHERE id = ?;').get(employeeId);
  if (!empRow) {
    return { success: false, error: 'Karyawan tidak ditemukan di database' };
  }

  let parsedEmp = {};
  try { parsedEmp = JSON.parse(empRow.data_json); } catch (e) {}

  parsedEmp.biometric = biometricProfile;

  if (updateAvatarAsWell && biometricProfile.samples?.front) {
    parsedEmp.avatar = biometricProfile.samples.front;
    db.prepare('UPDATE employees SET avatar = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
      .run(parsedEmp.avatar, JSON.stringify(parsedEmp), employeeId);
  } else {
    db.prepare('UPDATE employees SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
      .run(JSON.stringify(parsedEmp), employeeId);
  }

  addAuditLog({
    action: 'BIOMETRIC_ENROLLED',
    entity: 'employees',
    entityId: employeeId,
    userName: operatorUser?.name || operatorUser?.username || 'Sistem HRIS',
    userNik: operatorUser?.nik || 'SYSTEM',
    userRole: operatorUser?.systemRole || 'staff',
    module: 'BIOMETRIC',
    status: 'SUCCESS',
    details: `Profil biometrik wajah 4 pose (Depan, Kanan, Kiri, Senyum) untuk ${empRow.name} (${empRow.nik}) berhasil didaftarkan.`
  });

  return {
    success: true,
    message: `Profil biometrik wajah untuk ${empRow.name} berhasil disimpan.`,
    employee: parsedEmp
  };
}

export function deleteEmployeeBiometric(employeeId, operatorUser = null) {
  const db = getDatabase();
  const empRow = db.prepare('SELECT id, nik, name, data_json FROM employees WHERE id = ?;').get(employeeId);
  if (!empRow) {
    return { success: false, error: 'Karyawan tidak ditemukan' };
  }

  let parsedEmp = {};
  try { parsedEmp = JSON.parse(empRow.data_json); } catch (e) {}

  delete parsedEmp.biometric;

  db.prepare('UPDATE employees SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
    .run(JSON.stringify(parsedEmp), employeeId);

  addAuditLog({
    action: 'BIOMETRIC_DELETED',
    entity: 'employees',
    entityId: employeeId,
    userName: operatorUser?.name || operatorUser?.username || 'Admin HR',
    userNik: operatorUser?.nik || 'ADMIN',
    userRole: operatorUser?.systemRole || 'admin',
    module: 'BIOMETRIC',
    status: 'SUCCESS',
    details: `Profil biometrik wajah untuk ${empRow.name} (${empRow.nik}) telah di-reset/dihapus.`
  });

  return { success: true, message: `Profil biometrik untuk ${empRow.name} berhasil di-reset.`, employee: parsedEmp };
}

export function listUserAccounts() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, employee_id, email, username, role, system_role, status, last_login, created_at 
    FROM user_accounts 
    ORDER BY created_at ASC;
  `).all();
}


export function seedRealisticAuditLogs(db) {
  const seedItems = [
    {
      timestamp: '2026-09-06 08:00:00',
      userName: 'System Initialization',
      userNik: 'SYS-INIT',
      userRole: 'system',
      action: 'INIT_DATABASE',
      module: 'SYSTEM',
      entity: 'database',
      entityId: 'hris.sqlite',
      details: 'Inisialisasi awal database SQLite hris.sqlite untuk PRIME HRIS Enterprise.',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      metadata: JSON.stringify({ version: '1.0.0', platform: 'PRIME HRIS Enterprise' })
    },
    {
      timestamp: '2026-09-07 08:15:30',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260907-001',
      details: 'Presensi On-Site WFO shift pagi berhasil diverifikasi di kantor pusat.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ locationMode: 'OFFICE_GEOFENCE' })
    },
    {
      timestamp: '2026-09-07 09:00:15',
      userName: 'Direksi PT Prime',
      userNik: 'PRIME-2021-001',
      userRole: 'superuser',
      action: 'AUTH_LOGIN',
      module: 'AUTH',
      entity: 'user_accounts',
      entityId: 'USR-004',
      details: 'Login superuser (Direksi) dari IP terpercaya Gateway Utama.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ role: 'Director', systemRole: 'superuser' })
    },
    {
      timestamp: '2026-09-07 16:45:00',
      userName: 'System Backup Daemon',
      userNik: 'SYS-DAEMON',
      userRole: 'system',
      action: 'DATABASE_BACKUP',
      module: 'SYSTEM',
      entity: 'database',
      entityId: 'hris.sqlite',
      details: 'Snapshot harian database hris.sqlite berhasil disimpan ke direktori backup DEV20.',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      metadata: JSON.stringify({ destination: 'D:/0 Running apps/dev20-db-backup/snapshots' })
    },
    {
      timestamp: '2026-09-08 08:20:10',
      userName: 'Ahmad Fauzi',
      userNik: 'PRIME-2022-003',
      userRole: 'staff',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260908-002',
      details: 'Presensi selfie WFO berhasil dicatat tepat waktu pukul 08:20 WIB.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ checkInTime: '08:20:10', onTime: true })
    },
    {
      timestamp: '2026-09-08 10:30:00',
      userName: 'Siti Nurhaliza',
      userNik: 'PRIME-2022-002',
      userRole: 'admin',
      action: 'SIMULATE_PAYROLL',
      module: 'PAYROLL',
      entity: 'payroll',
      entityId: 'SIM-001',
      details: 'Menjalankan simulasi interim formula lembur Depnaker 1/173 untuk 8 karyawan aktif.',
      ipAddress: '192.168.3.122',
      status: 'SUCCESS',
      metadata: JSON.stringify({ formula: '1/173 * Upah Pokok', activeEmployees: 8 })
    },
    {
      timestamp: '2026-09-08 14:00:25',
      userName: 'Budi Santoso',
      userNik: 'PRIME-2022-005',
      userRole: 'admin',
      action: 'APPROVAL_REJECTED',
      module: 'APPROVALS',
      entity: 'approvals',
      entityId: 'JUSTIF-9021',
      details: 'Menolak justifikasi keterlambatan JUSTIF-9021. Alasan: Bukti kendala di perjalanan tidak disertai dokumentasi valid.',
      ipAddress: '103.31.205.218',
      status: 'FAILED',
      metadata: JSON.stringify({ reason: 'Bukti kendala di perjalanan tidak valid', lateMinutes: 45 })
    },
    {
      timestamp: '2026-09-08 17:10:00',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'PAYSLIP_PRINTED',
      module: 'PAYROLL',
      entity: 'payroll',
      entityId: 'SLIP-001',
      details: 'Mencetak Slip Gaji Resmi digital periode September 2026 ber-QR code validasi Direksi.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ period: 'September 2026', employeeNik: 'PRIME-2022-001' })
    },
    {
      timestamp: '2026-09-09 08:15:00',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260909-001',
      details: 'Presensi On-Site WFO berhasil divalidasi. Kamera cerdas mendeteksi wajah dengan rasio 1:1.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ distanceMeters: 14, geofenceStatus: 'VALID' })
    },
    {
      timestamp: '2026-09-09 08:35:12',
      userName: 'Doni Prasetyo',
      userNik: 'PRIME-2023-012',
      userRole: 'staff',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260909-006',
      details: 'Presensi terlambat 5 menit. Alasan: Kemacetan perlintasan jalur logistik industri Sidoarjo.',
      ipAddress: '103.31.205.218',
      status: 'WARNING',
      metadata: JSON.stringify({ lateMinutes: 5, reason: 'Kemacetan perlintasan jalur logistik industri Sidoarjo' })
    },
    {
      timestamp: '2026-09-09 10:05:18',
      userName: 'Direksi PT Prime',
      userNik: 'PRIME-2021-001',
      userRole: 'superuser',
      action: 'GEOFENCE_UPDATE',
      module: 'HR_RULES',
      entity: 'salary_rules',
      entityId: 'default',
      details: 'Pembaruan titik koordinat Geofence: Lat -7.293144, Lng 112.775337, radius 350 meter (Kawasan Kantor Pusat & Hub PRIME).',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ lat: -7.293144, lng: 112.775337, radiusMeters: 350 })
    },
    {
      timestamp: '2026-09-09 11:20:45',
      userName: 'System Watchdog',
      userNik: 'SYS-DAEMON',
      userRole: 'system',
      action: 'INTEGRITY_CHECK',
      module: 'SYSTEM',
      entity: 'database',
      entityId: 'hris.sqlite',
      details: 'Pemeriksaan integritas basis data SQLite hris.sqlite: WAL mode aktif, zero corrupted pages terdeteksi.',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      metadata: JSON.stringify({ journalMode: 'wal', integrity: 'ok', sizeKb: 145 })
    },
    {
      timestamp: '2026-09-09 14:15:05',
      userName: 'Siti Nurhaliza',
      userNik: 'PRIME-2022-002',
      userRole: 'admin',
      action: 'APPROVAL_APPROVED',
      module: 'APPROVALS',
      entity: 'approvals',
      entityId: 'APPR-002',
      details: 'Menyetujui permohonan lembur shift malam proyek PT Freeport Indonesia durasi 4 jam.',
      ipAddress: '192.168.3.122',
      status: 'SUCCESS',
      metadata: JSON.stringify({ overtimeHours: 4, project: 'PT Freeport Indonesia' })
    },
    {
      timestamp: '2026-09-09 15:40:22',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'SAVE_EMPLOYEE',
      module: 'EMPLOYEES',
      entity: 'employees',
      entityId: 'EMP-007',
      details: 'Pembaruan nomor rekening bank & verifikasi biometrik wajah untuk karyawan Doni Prasetyo.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ employeeId: 'EMP-007', biometricStatus: 'VERIFIED' })
    },
    {
      timestamp: '2026-09-09 16:30:00',
      userName: 'Rahmat Hidayat',
      userNik: 'PRIME-2023-014',
      userRole: 'staff',
      action: 'SUBMIT_LEAVE',
      module: 'APPROVALS',
      entity: 'approvals',
      entityId: 'LEAVE-4412',
      details: 'Mengajukan cuti tahunan: "Urusan Keluarga & Mudik" durasi 2 hari kerja.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ days: 2, leaveType: 'ANNUAL_LEAVE' })
    },
    {
      timestamp: '2026-09-09 17:05:12',
      userName: 'Budi Santoso',
      userNik: 'PRIME-2022-005',
      userRole: 'admin',
      action: 'CHECKOUT_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260909-002',
      details: 'Check-out kepulangan shift reguler berhasil dicatat. Total durasi kerja efektif: 8 jam 50 menit.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ durationHours: 8.83, workTime: '08:15 - 17:05' })
    },
    {
      timestamp: '2026-09-10 07:55:18',
      userName: 'Hendra Wijaya',
      userNik: 'PRIME-2023-009',
      userRole: 'staff',
      action: 'CHECKIN_DINAS_LUAR',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260910-005',
      details: 'Presensi Dinas Luar Mendadak diajukan: PT Vale Indonesia Sorowako Mill Site. Disposisi diajukan ke manajer.',
      ipAddress: '114.122.45.89',
      status: 'SUCCESS',
      metadata: JSON.stringify({ client: 'PT Vale Indonesia Tbk', destination: 'Sorowako Mill Site' })
    },
    {
      timestamp: '2026-09-10 08:12:30',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260910-001',
      details: 'Presensi On-Site WFO berhasil divalidasi melalui Gateway Utama PRIME. Koordinat GPS akurat (akurasi 5.2m).',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ distanceMeters: 15, geofenceStatus: 'VALID', auditHash: '#901233' })
    },
    {
      timestamp: '2026-09-10 08:18:02',
      userName: 'Budi Santoso',
      userNik: 'PRIME-2022-005',
      userRole: 'admin',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260910-002',
      details: 'Presensi selfie WFO berhasil diverifikasi. Watermark audit hash #789211 terekam dalam database.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ distanceMeters: 28, geofenceStatus: 'VALID', auditHash: '#789211' })
    },
    {
      timestamp: '2026-09-10 08:25:44',
      userName: 'Ahmad Fauzi',
      userNik: 'PRIME-2022-003',
      userRole: 'staff',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260910-003',
      details: 'Presensi selfie WFO berhasil diverifikasi. Jarak GPS: 42 meter dari pusat Geofence kantor.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ distanceMeters: 42, geofenceStatus: 'VALID', auditHash: '#892144' })
    },
    {
      timestamp: '2026-09-10 08:32:10',
      userName: 'Rahmat Hidayat',
      userNik: 'PRIME-2023-014',
      userRole: 'staff',
      action: 'CHECKIN_WFO',
      module: 'ATTENDANCE',
      entity: 'attendances',
      entityId: 'ATT-20260910-004',
      details: 'Presensi WFO tercatat pukul 08:32 WIB (Terlambat 2 menit di luar batas toleransi 08:30 WIB). Disposisi justifikasi otomatis dibuat.',
      ipAddress: '103.31.205.218',
      status: 'WARNING',
      metadata: JSON.stringify({ checkInTime: '08:32:10', lateMinutes: 2, tolerance: '08:30' })
    },
    {
      timestamp: '2026-09-10 09:15:40',
      userName: 'Siti Nurhaliza',
      userNik: 'PRIME-2022-002',
      userRole: 'admin',
      action: 'EXPORT_PAYROLL',
      module: 'PAYROLL',
      entity: 'payroll',
      entityId: 'PAY-SEP-2026',
      details: 'Ekspor berkas konsolidasi payroll periode September 2026 ke format CSV untuk audit perbankan.',
      ipAddress: '192.168.3.122',
      status: 'SUCCESS',
      metadata: JSON.stringify({ format: 'CSV', recordCount: 8, totalDisbursement: 61850000 })
    },
    {
      timestamp: '2026-09-10 10:30:15',
      userName: 'Direksi PT Prime',
      userNik: 'PRIME-2021-001',
      userRole: 'superuser',
      action: 'UPDATE_SALARY_RULES',
      module: 'HR_RULES',
      entity: 'salary_rules',
      entityId: 'default',
      details: 'Pembaruan toleransi keterlambatan 15 menit dan verifikasi subnet Gateway Utama PRIME (103.31.205.0/24).',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ gracePeriod: 15, subnet: '103.31.205.0/24' })
    },
    {
      timestamp: '2026-09-10 11:45:10',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'APPROVAL_APPROVED',
      module: 'APPROVALS',
      entity: 'approvals',
      entityId: 'APPR-001',
      details: 'Menyetujui pengajuan Cuti Tahunan untuk Ahmad Fauzi (3 hari kerja). Catatan: Disetujui, pekerjaan telah di-handover.',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ applicant: 'Ahmad Fauzi', days: 3, category: 'CUTI_TAHUNAN' })
    },
    {
      timestamp: '2026-09-10 12:15:22',
      userName: 'Galih Primananda',
      userNik: 'PRIME-2022-001',
      userRole: 'admin',
      action: 'AUTH_LOGIN',
      module: 'AUTH',
      entity: 'user_accounts',
      entityId: 'USR-001',
      details: 'Login berhasil ke sesi HRIS Enterprise melalui Google Chrome (WFO Terverifikasi).',
      ipAddress: '103.31.205.218',
      status: 'SUCCESS',
      metadata: JSON.stringify({ browser: 'Chrome 128', platform: 'Windows 11 NT' })
    }
  ];

  const insert = db.prepare(`
    INSERT INTO audit_logs (
      action, entity, entityId, details,
      userName, userNik, userRole, module,
      ipAddress, status, metadata, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (const item of seedItems) {
    insert.run(
      item.action,
      item.entity,
      item.entityId,
      item.details,
      item.userName,
      item.userNik,
      item.userRole,
      item.module,
      item.ipAddress,
      item.status,
      item.metadata,
      item.timestamp
    );
  }
  console.log('[SQLite] 25 rekaman audit log awal berhasil di-seed.');
}

export function addAuditLog(entry) {
  const db = getDatabase();
  const pad = n => String(n).padStart(2, '0');
  const d = new Date();
  const localNow = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const now = entry.timestamp || localNow;
  const metaStr = entry.metadata ? (typeof entry.metadata === 'string' ? entry.metadata : JSON.stringify(entry.metadata)) : null;

  // Resolve userLoginId if not explicitly provided
  let loginId = entry.userLoginId || null;
  if (!loginId) {
    if (entry.userName === 'admin' || entry.userNik === 'DMJ-2024-001' || (entry.userName && entry.userName.toLowerCase().includes('galih primananda'))) {
      loginId = 'admin';
    } else if (entry.userNik) {
      try {
        const u = db.prepare('SELECT u.username FROM user_accounts u JOIN employees e ON u.employee_id = e.id WHERE e.nik = ? OR e.id = ? LIMIT 1;').get(entry.userNik, entry.userNik);
        if (u?.username) loginId = u.username;
      } catch (e) {}
    }
    if (!loginId && entry.userName) {
      try {
        const u = db.prepare('SELECT username FROM user_accounts WHERE LOWER(username) = ? LIMIT 1;').get(entry.userName.toLowerCase());
        if (u?.username) loginId = u.username;
      } catch (e) {}
    }
    if (!loginId) {
      loginId = entry.userName?.toLowerCase()?.includes('system') ? 'system' : (entry.userName || 'admin');
    }
  }

  // Strip raw NIK from details to ensure complete privacy & prevent leaking NIK
  let sanitizedDetails = entry.details || '';
  if (entry.userNik && sanitizedDetails.includes(entry.userNik)) {
    sanitizedDetails = sanitizedDetails.replace(new RegExp(`\\(?${entry.userNik}\\)?`, 'g'), `(ID: ${loginId})`).replace(/\s+/g, ' ');
  }

  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      action, entity, entityId, details,
      userName, userNik, userLoginId, userRole, module,
      ipAddress, status, metadata, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run(
    entry.action || 'ACTIVITY',
    entry.entity || 'SYSTEM',
    entry.entityId || null,
    sanitizedDetails,
    entry.userName || 'System',
    entry.userNik || null,
    loginId,
    entry.userRole || 'system',
    entry.module || 'SYSTEM',
    entry.ipAddress || '127.0.0.1',
    entry.status || 'SUCCESS',
    metaStr,
    now
  );
}

export function getAuditLogsPaginated({
  page = 1,
  limit = 10,
  search = '',
  module = '',
  role = '',
  status = '',
  startDate = '',
  endDate = ''
} = {}) {
  const db = getDatabase();
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = [];
  let params = [];

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(details) LIKE ? OR
      LOWER(userName) LIKE ? OR
      LOWER(COALESCE(userLoginId, '')) LIKE ? OR
      LOWER(COALESCE(userNik, '')) LIKE ? OR
      LOWER(action) LIKE ? OR
      LOWER(COALESCE(ipAddress, '')) LIKE ?
    )`);
    params.push(term, term, term, term, term, term);
  }

  if (module && module !== 'ALL') {
    if (module === 'AUTH') {
      whereClauses.push(`(module IN ('AUTH', 'AUTH_BIOMETRIC', 'AUTH_SECURITY') OR action LIKE 'AUTH_%' OR action LIKE 'LOGIN_%')`);
    } else if (module === 'ATTENDANCE') {
      whereClauses.push(`(module IN ('ATTENDANCE', 'ATTENDANCE_KIOSK', 'CASUAL_ATTENDANCE') OR action LIKE 'CHECKIN_%' OR action LIKE 'CHECKOUT_%' OR action LIKE '%ATTENDANCE%')`);
    } else if (module === 'APPROVALS' || module === 'APPROVAL') {
      whereClauses.push(`(module IN ('APPROVAL', 'APPROVALS') OR action LIKE '%APPROVAL%')`);
    } else if (module === 'EMPLOYEES') {
      whereClauses.push(`(module IN ('EMPLOYEES', 'BIOMETRIC') OR action LIKE '%EMPLOYEE%' OR action LIKE '%BIOMETRIC%' OR action LIKE '%CASUAL_WORKER%')`);
    } else if (module === 'PROJECTS') {
      whereClauses.push(`(module = 'PROJECTS' OR action LIKE '%PROJECT%')`);
    } else if (module === 'PAYROLL') {
      whereClauses.push(`(module = 'PAYROLL' OR action LIKE '%PAYROLL%')`);
    } else if (module === 'HR_RULES') {
      whereClauses.push(`(module IN ('HR_RULES', 'HRIS_CALENDAR') OR action LIKE '%RULES%' OR action LIKE '%CALENDAR%')`);
    } else {
      whereClauses.push(`module = ?`);
      params.push(module);
    }
  }

  if (role && role !== 'ALL') {
    whereClauses.push(`LOWER(userRole) = ?`);
    params.push(role.toLowerCase());
  }

  if (startDate && startDate.trim()) {
    whereClauses.push(`substr(timestamp, 1, 10) >= ?`);
    params.push(startDate.trim());
  }

  if (endDate && endDate.trim()) {
    whereClauses.push(`substr(timestamp, 1, 10) <= ?`);
    params.push(endDate.trim());
  }

  if (status && status !== 'ALL') {
    whereClauses.push(`status = ?`);
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereSql};`).get(...params);
  const totalRows = countRow?.total || 0;
  const totalPages = Math.ceil(totalRows / safeLimit) || 1;

  // Global aggregate metrics across all audit logs
  let stats = {
    total: 0,
    auth: 0,
    attendance: 0,
    approvals: 0,
    employees: 0,
    projects: 0,
    payroll: 0,
    rules: 0,
    success: 0,
    warning: 0,
    danger: 0
  };

  try {
    const statRow = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN module IN ('AUTH', 'AUTH_BIOMETRIC', 'AUTH_SECURITY') OR action LIKE 'AUTH_%' OR action LIKE 'LOGIN_%' THEN 1 ELSE 0 END) as authCount,
        SUM(CASE WHEN module IN ('ATTENDANCE', 'ATTENDANCE_KIOSK', 'CASUAL_ATTENDANCE') OR action LIKE 'CHECKIN_%' OR action LIKE 'CHECKOUT_%' OR action LIKE '%ATTENDANCE%' THEN 1 ELSE 0 END) as attendanceCount,
        SUM(CASE WHEN module IN ('APPROVAL', 'APPROVALS') OR action LIKE '%APPROVAL%' THEN 1 ELSE 0 END) as approvalCount,
        SUM(CASE WHEN module IN ('EMPLOYEES', 'BIOMETRIC') OR action LIKE '%EMPLOYEE%' OR action LIKE '%BIOMETRIC%' OR action LIKE '%CASUAL_WORKER%' THEN 1 ELSE 0 END) as employeeCount,
        SUM(CASE WHEN module = 'PROJECTS' OR action LIKE '%PROJECT%' THEN 1 ELSE 0 END) as projectCount,
        SUM(CASE WHEN module = 'PAYROLL' OR action LIKE '%PAYROLL%' THEN 1 ELSE 0 END) as payrollCount,
        SUM(CASE WHEN module IN ('HR_RULES', 'HRIS_CALENDAR') OR action LIKE '%RULES%' OR action LIKE '%CALENDAR%' THEN 1 ELSE 0 END) as rulesCount,
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN status = 'WARNING' THEN 1 ELSE 0 END) as warningCount,
        SUM(CASE WHEN status IN ('FAILED', 'DANGER', 'ERROR') THEN 1 ELSE 0 END) as dangerCount
      FROM audit_logs;
    `).get();

    if (statRow) {
      stats = {
        total: statRow.total || 0,
        auth: statRow.authCount || 0,
        attendance: statRow.attendanceCount || 0,
        approvals: statRow.approvalCount || 0,
        employees: statRow.employeeCount || 0,
        projects: statRow.projectCount || 0,
        payroll: statRow.payrollCount || 0,
        rules: statRow.rulesCount || 0,
        success: statRow.successCount || 0,
        warning: statRow.warningCount || 0,
        danger: statRow.dangerCount || 0
      };
    }
  } catch (err) {
    console.warn('[SQLite] Error computing audit log stats:', err.message);
  }

  const rows = db.prepare(`
    SELECT * FROM audit_logs
    ${whereSql}
    ORDER BY timestamp DESC, id DESC
    LIMIT ? OFFSET ?;
  `).all(...params, safeLimit, offset);

  const mappedRows = rows.map(r => {
    let loginId = r.userLoginId;
    if (!loginId) {
      if (r.userName === 'admin' || r.userNik === 'DMJ-2024-001' || (r.userName && r.userName.toLowerCase().includes('galih primananda'))) {
        loginId = 'admin';
      } else if (r.userNik) {
        try {
          const u = db.prepare('SELECT u.username FROM user_accounts u JOIN employees e ON u.employee_id = e.id WHERE e.nik = ? OR e.id = ? LIMIT 1;').get(r.userNik, r.userNik);
          if (u?.username) loginId = u.username;
        } catch (e) {}
      }
      if (!loginId && r.userName) {
        try {
          const u = db.prepare('SELECT username FROM user_accounts WHERE LOWER(username) = ? LIMIT 1;').get(r.userName.toLowerCase());
          if (u?.username) loginId = u.username;
        } catch (e) {}
      }
      if (!loginId) {
        loginId = r.userName?.toLowerCase()?.includes('system') ? 'system' : (r.userName || 'admin');
      }
    }

    let sanitizedDetails = r.details || '';
    if (r.userNik && sanitizedDetails.includes(r.userNik)) {
      sanitizedDetails = sanitizedDetails.replace(new RegExp(`\\(?${r.userNik}\\)?`, 'g'), `(ID: ${loginId})`).replace(/\s+/g, ' ');
    }

    return {
      ...r,
      userLoginId: loginId,
      details: sanitizedDetails
    };
  });

  return {
    logs: mappedRows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalRows,
      totalPages,
      hasMore: safePage < totalPages
    },
    stats
  };
}

export function saveWaNotificationLog(log) {
  const db = getDatabase();
  const id = log.id || `WA-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    db.prepare(`
      INSERT INTO wa_notifications (id, recipient_id, recipient_name, recipient_phone, event_type, title, message, status, error_msg, metadata, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      id,
      log.recipientId || null,
      log.recipientName || null,
      log.recipientPhone,
      log.eventType,
      log.title || null,
      log.message,
      log.status || 'SENT',
      log.errorMsg || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.sentAt || new Date().toISOString()
    );
  } catch (err) {
    console.warn('[SQLite] saveWaNotificationLog error:', err.message);
  }
  return { id, ...log };
}

export function getWaNotificationLogs(limit = 100) {
  const db = getDatabase();
  try {
    return db.prepare('SELECT * FROM wa_notifications ORDER BY sent_at DESC LIMIT ?;').all(limit);
  } catch (err) {
    console.warn('[SQLite] getWaNotificationLogs error:', err.message);
    return [];
  }
}

export function hasSentTodayWaReminder(employeeId, eventType, dateStr) {
  const db = getDatabase();
  try {
    const prefix = `${dateStr}%`;
    const row = db.prepare(`
      SELECT count(*) as count FROM wa_notifications
      WHERE recipient_id = ? AND event_type = ? AND sent_at LIKE ? AND status = 'SENT';
    `).get(employeeId, eventType, prefix);
    return (row?.count || 0) > 0;
  } catch (err) {
    return false;
  }
}

export function saveEmailNotificationLog(log) {
  const db = getDatabase();
  const id = log.id || `EMAIL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    db.prepare(`
      INSERT INTO email_notifications (id, recipient_id, recipient_name, recipient_email, event_type, subject, html_body, text_body, status, error_msg, metadata, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      id,
      log.recipientId || null,
      log.recipientName || null,
      log.recipientEmail,
      log.eventType,
      log.subject,
      log.htmlBody || null,
      log.textBody || null,
      log.status || 'SENT',
      log.errorMsg || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.sentAt || new Date().toISOString()
    );
  } catch (err) {
    console.warn('[SQLite] saveEmailNotificationLog error:', err.message);
  }
  return { id, ...log };
}

export function getEmailNotificationLogs(limit = 100) {
  const db = getDatabase();
  try {
    return db.prepare('SELECT * FROM email_notifications ORDER BY sent_at DESC LIMIT ?;').all(limit);
  } catch (err) {
    console.warn('[SQLite] getEmailNotificationLogs error:', err.message);
    return [];
  }
}

export function hasSentTodayEmailReminder(employeeId, eventType, dateStr) {
  const db = getDatabase();
  try {
    const prefix = `${dateStr}%`;
    const row = db.prepare(`
      SELECT count(*) as count FROM email_notifications
      WHERE recipient_id = ? AND event_type = ? AND sent_at LIKE ? AND status = 'SENT';
    `).get(employeeId, eventType, prefix);
    return (row?.count || 0) > 0;
  } catch (err) {
    return false;
  }
}

export function generateDefaultAnnualPeriods(year, cutoffStart = 21, cutoffEnd = 20, payday = 25, weeklyOffDays = [0, 6]) {
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const nationalHolidays = {
    [`${year}-01-01`]: 'Tahun Baru Masehi',
    [`${year}-01-29`]: 'Tahun Baru Imlek 2577 Kongzili',
    [`${year}-03-20`]: 'Hari Raya Nyepi Tahun Baru Saka 1948',
    [`${year}-03-21`]: 'Hari Raya Idul Fitri (Hari 1)',
    [`${year}-03-22`]: 'Hari Raya Idul Fitri (Hari 2)',
    [`${year}-04-03`]: 'Wafat Yesus Kristus',
    [`${year}-05-01`]: 'Hari Buruh Internasional',
    [`${year}-05-14`]: 'Kenaikan Yesus Kristus',
    [`${year}-05-31`]: 'Hari Raya Waisak 2570 BE',
    [`${year}-06-01`]: 'Hari Lahir Pancasila',
    [`${year}-06-27`]: 'Hari Raya Idul Adha',
    [`${year}-07-16`]: 'Tahun Baru Islam',
    [`${year}-08-17`]: 'Hari Kemerdekaan Republik Indonesia',
    [`${year}-09-25`]: 'Maulid Nabi Muhammad SAW',
    [`${year}-12-25`]: 'Hari Raya Natal'
  };

  const periods = [];

  for (let m = 0; m < 12; m++) {
    const startYear = m === 0 ? year - 1 : year;
    const startMonth = m === 0 ? 12 : m;
    const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(cutoffStart).padStart(2, '0')}`;
    const endDateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(cutoffEnd).padStart(2, '0')}`;
    const paydayStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(payday).padStart(2, '0')}`;

    let effectiveWorkDays = 0;
    let weeklyOffDaysCount = 0;
    let holidaysCount = 0;

    let curr = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T00:00:00`);

    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      const y = curr.getFullYear();
      const mo = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const curStr = `${y}-${mo}-${d}`;

      const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
      const isNationalHoliday = Boolean(nationalHolidays[curStr]);

      if (isWeeklyOff) {
        weeklyOffDaysCount++;
      } else if (isNationalHoliday) {
        holidaysCount++;
      } else {
        effectiveWorkDays++;
      }

      curr.setDate(curr.getDate() + 1);
    }

    const todayYMD = new Date().toISOString().substring(0, 10);
    const isOpen = todayYMD >= startDateStr && todayYMD <= endDateStr;
    const isPast = todayYMD > endDateStr;

    periods.push({
      periodId: `PERIOD-${year}-${String(m + 1).padStart(2, '0')}`,
      monthIndex: m,
      periodName: `Periode ${monthNames[m]} ${year}`,
      startDate: startDateStr,
      endDate: endDateStr,
      paydayDate: paydayStr,
      attendanceOpen: isPast ? false : true,
      payrollStatus: isPast ? 'PAID' : (isOpen ? 'OPEN' : 'DRAFT'),
      totalCalendarDays: effectiveWorkDays + weeklyOffDaysCount + holidaysCount,
      effectiveWorkDays,
      weeklyOffDaysCount,
      holidaysCount,
      notes: `Siklus Presensi & Payroll ${monthNames[m]} ${year}`
    });
  }

  return periods;
}

export function getWorkCalendarConfig(year = 2026) {
  const db = getDatabase();
  const targetYear = Number(year) || 2026;
  const configId = `CALENDAR_${targetYear}`;

  try {
    const row = db.prepare('SELECT * FROM annual_work_calendar WHERE id = ?;').get(configId);
    if (row) {
      return {
        id: row.id,
        year: row.year,
        weeklyOffDays: JSON.parse(row.weeklyOffDays || '[0, 6]'),
        defaultCutoffStartDay: row.defaultCutoffStartDay || 21,
        defaultCutoffEndDay: row.defaultCutoffEndDay || 20,
        defaultPaydayDate: row.defaultPaydayDate || 25,
        periods: JSON.parse(row.periods_json || '[]'),
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      };
    }
  } catch (e) {
    console.warn('[DB getWorkCalendarConfig warning]', e.message);
  }

  const defaultPeriods = generateDefaultAnnualPeriods(targetYear, 21, 20, 25, [0, 6]);
  return {
    id: configId,
    year: targetYear,
    weeklyOffDays: [0, 6],
    defaultCutoffStartDay: 21,
    defaultCutoffEndDay: 20,
    defaultPaydayDate: 25,
    periods: defaultPeriods,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Default'
  };
}

export function saveWorkCalendarConfig(config, user = null) {
  const db = getDatabase();
  const targetYear = Number(config.year) || 2026;
  const configId = `CALENDAR_${targetYear}`;
  const weeklyOffDaysJson = JSON.stringify(config.weeklyOffDays || [0, 6]);
  const periodsJson = JSON.stringify(config.periods || []);
  const now = new Date().toISOString();
  const userName = user?.name || user?.username || 'HR Administrator';

  db.prepare(`
    INSERT INTO annual_work_calendar (
      id, year, weeklyOffDays, defaultCutoffStartDay, defaultCutoffEndDay, defaultPaydayDate, periods_json, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      weeklyOffDays = excluded.weeklyOffDays,
      defaultCutoffStartDay = excluded.defaultCutoffStartDay,
      defaultCutoffEndDay = excluded.defaultCutoffEndDay,
      defaultPaydayDate = excluded.defaultPaydayDate,
      periods_json = excluded.periods_json,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  `).run(
    configId,
    targetYear,
    weeklyOffDaysJson,
    Number(config.defaultCutoffStartDay) || 21,
    Number(config.defaultCutoffEndDay) || 20,
    Number(config.defaultPaydayDate) || 25,
    periodsJson,
    now,
    userName
  );

  addAuditLog({
    action: 'SAVE_ANNUAL_WORK_CALENDAR',
    entity: 'WORK_CALENDAR',
    entityId: configId,
    details: `Konfigurasi kalender kerja tahun ${targetYear} & cut-off presensi diperbarui oleh ${userName}.`,
    userName: userName,
    userRole: user?.role || 'admin',
    module: 'HRIS_CALENDAR'
  });

  return getWorkCalendarConfig(targetYear);
}





// =============================================================================
// CASUAL FIELD WORKER ATTENDANCE (PRESENSI TUKANG LAPANGAN)
// =============================================================================
export function getCasualWorkers(projectId = null) {
  const db = getDatabase();
  if (projectId) {
    return db.prepare(`SELECT * FROM casual_workers WHERE projectId = ? AND status = 'active' ORDER BY name ASC;`).all(projectId);
  }
  return db.prepare(`SELECT * FROM casual_workers WHERE status = 'active' ORDER BY name ASC;`).all();
}

export function saveCasualWorker(worker) {
  const db = getDatabase();
  const id = worker.id || `CW-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM casual_workers WHERE id = ?;').get(id);

  if (existing) {
    db.prepare(`
      UPDATE casual_workers
      SET projectId = ?, name = ?, status = ?, updatedAt = ?
      WHERE id = ?;
    `).run(worker.projectId, worker.name.trim(), worker.status || 'active', now, id);
  } else {
    db.prepare(`
      INSERT INTO casual_workers (id, projectId, name, status, createdBy, createdByName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `).run(id, worker.projectId, worker.name.trim(), worker.status || 'active', worker.createdBy || null, worker.createdByName || null, now, now);
  }

  addAuditLog({
    action: existing ? 'UPDATE_CASUAL_WORKER' : 'CREATE_CASUAL_WORKER',
    entity: 'casual_workers',
    entityId: id,
    userName: worker.createdByName || 'Project Manager',
    userRole: 'admin',
    module: 'EMPLOYEES',
    status: 'SUCCESS',
    details: `Data pekerja lapangan "${worker.name.trim()}" (Proyek: ${worker.projectId}) berhasil ${existing ? 'diperbarui' : 'didaftarkan'}.`
  });

  return db.prepare('SELECT * FROM casual_workers WHERE id = ?;').get(id);
}

export function getCasualAttendances(filters = {}) {
  const db = getDatabase();
  let query = 'SELECT a.*, p.name as projectName FROM casual_worker_attendances a LEFT JOIN projects p ON a.projectId = p.id WHERE 1=1';
  const params = [];

  if (filters.projectId) {
    query += ' AND a.projectId = ?';
    params.push(filters.projectId);
  }
  if (filters.date) {
    query += ' AND a.date = ?';
    params.push(filters.date);
  }
  if (filters.startDate) {
    query += ' AND a.date >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND a.date <= ?';
    params.push(filters.endDate);
  }

  query += ' ORDER BY a.date DESC, a.checkInTime DESC';
  if (filters.limit) {
    query += ` LIMIT ${Math.max(1, parseInt(filters.limit, 10) || 200)}`;
  }

  return db.prepare(query).all(...params);
}

export function saveCasualAttendance(record) {
  const db = getDatabase();
  const now = new Date();
  const wibTime = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\./g, ':');
  const wibDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  const id = record.id || `CWA-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const date = record.date || wibDate;
  const checkInTime = record.checkInTime ? record.checkInTime.replace(/\./g, ':') : wibTime;

  // Check if attendance already recorded today for this worker and project
  const existing = db.prepare('SELECT id FROM casual_worker_attendances WHERE workerId = ? AND projectId = ? AND date = ?;').get(record.workerId, record.projectId, date);

  if (existing) {
    db.prepare(`
      UPDATE casual_worker_attendances
      SET checkInTime = ?, photoUrl = ?, latitude = ?, longitude = ?, address = ?, notes = ?, verifiedByPmId = ?, verifiedByPmName = ?
      WHERE id = ?;
    `).run(
      checkInTime,
      record.photoUrl || null,
      record.latitude || null,
      record.longitude || null,
      record.address || null,
      record.notes || null,
      record.verifiedByPmId,
      record.verifiedByPmName,
      existing.id
    );
    return db.prepare('SELECT * FROM casual_worker_attendances WHERE id = ?;').get(existing.id);
  } else {
    db.prepare(`
      INSERT INTO casual_worker_attendances (
        id, workerId, workerName, projectId, date, checkInTime,
        photoUrl, latitude, longitude, address, notes,
        verifiedByPmId, verifiedByPmName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      id,
      record.workerId,
      record.workerName,
      record.projectId,
      date,
      checkInTime,
      record.photoUrl || null,
      record.latitude || null,
      record.longitude || null,
      record.address || null,
      record.notes || null,
      record.verifiedByPmId,
      record.verifiedByPmName
    );
    return db.prepare('SELECT * FROM casual_worker_attendances WHERE id = ?;').get(id);
  }
}

export function deleteCasualAttendance(id, operatorUser = null) {
  const db = getDatabase();
  const existing = db.prepare('SELECT workerName, date, projectId FROM casual_worker_attendances WHERE id = ?;').get(id);
  const result = db.prepare('DELETE FROM casual_worker_attendances WHERE id = ?;').run(id);
  if (existing) {
    addAuditLog({
      action: 'DELETE_CASUAL_ATTENDANCE',
      entity: 'casual_worker_attendances',
      entityId: id,
      userName: operatorUser?.name || operatorUser?.username || 'Project Lead',
      userRole: operatorUser?.systemRole || 'admin',
      module: 'ATTENDANCE',
      status: 'WARNING',
      details: `Presensi pekerja lapangan "${existing.workerName}" tanggal ${existing.date} di proyek ${existing.projectId} berhasil dihapus.`
    });
  }
  return result;
}

export function isWaOptedIn(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D+/g, '');
  let norm = digits;
  if (norm.startsWith('0')) norm = `62${norm.slice(1)}`;
  else if (norm.startsWith('8')) norm = `62${norm}`;
  else if (norm.startsWith('620')) norm = `62${norm.slice(3)}`;
  if (!norm.startsWith('62') || norm.length < 10) return false;

  const db = getDatabase();
  try {
    const row = db.prepare('SELECT phone, is_active, manual_override, message_count, first_message FROM wa_opt_ins WHERE phone = ?;').get(norm);
    if (!row) return false;
    // Syarat 1: Toggle preferensi notifikasi WA wajib ON (is_active === 1; default adalah 0 / OFF)
    if (row.is_active !== 1) return false;
    // Syarat 2: User wajib pernah mengetik minimal 1 pesan masuk ATAU telah diotorisasi manual oleh Admin/HR
    const hasRealChat = row.message_count > 0 && row.first_message && !row.first_message.includes('Master Data');
    return Boolean(hasRealChat || row.manual_override === 1);
  } catch (e) {
    return false;
  }
}

export function recordWaOptIn(phone, messageText = '', pushName = '') {
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, '');
  let norm = digits;
  if (norm.startsWith('0')) norm = `62${norm.slice(1)}`;
  else if (norm.startsWith('8')) norm = `62${norm}`;
  else if (norm.startsWith('620')) norm = `62${norm.slice(3)}`;
  if (!norm.startsWith('62') || norm.length < 10) return null;

  const db = getDatabase();
  const now = new Date().toISOString();

  let matchedEmpId = null;
  let matchedEmpName = null;
  try {
    const empRows = db.prepare('SELECT id, name, phone, data_json FROM employees;').all();
    for (const emp of empRows) {
      const lowerMsg = (messageText || '').toLowerCase();
      if (lowerMsg && (
        lowerMsg.includes(emp.id.toLowerCase()) ||
        (emp.id === 'EMP-001' && (lowerMsg.includes('admin') || lowerMsg.includes('galih'))) ||
        (emp.name && lowerMsg.includes(emp.name.toLowerCase()))
      )) {
        matchedEmpId = emp.id;
        matchedEmpName = emp.name;
        break;
      }
      let eDigits = String(emp.phone || '').replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = `62${eDigits.slice(1)}`;
      else if (eDigits.startsWith('8')) eDigits = `62${eDigits}`;
      if (eDigits === norm) {
        matchedEmpId = emp.id;
        matchedEmpName = emp.name;
        break;
      }
    }
  } catch (e) {}

  try {
    db.prepare(`
      INSERT INTO wa_opt_ins (phone, employee_id, employee_name, first_message, first_message_at, last_message, last_message_at, message_count, is_active, manual_override)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0)
      ON CONFLICT(phone) DO UPDATE SET
        first_message = COALESCE(wa_opt_ins.first_message, excluded.first_message),
        first_message_at = COALESCE(wa_opt_ins.first_message_at, excluded.first_message_at),
        last_message = excluded.last_message,
        last_message_at = excluded.last_message_at,
        message_count = wa_opt_ins.message_count + 1,
        employee_id = COALESCE(excluded.employee_id, wa_opt_ins.employee_id),
        employee_name = COALESCE(excluded.employee_name, wa_opt_ins.employee_name);
    `).run(norm, matchedEmpId, matchedEmpName, messageText, now, messageText, now);

    addAuditLog({
      action: 'WA_OPT_IN_RECORDED',
      entity: 'wa_opt_ins',
      entityId: norm,
      userName: matchedEmpName || pushName || 'User Tamu',
      userRole: 'user',
      module: 'NOTIFICATION',
      status: 'SUCCESS',
      details: `Pesan masuk asli diterima dari +${norm} (${matchedEmpName || pushName || 'Tamu'}): "${messageText}".`
    });
  } catch (err) {
    console.warn('[SQLite] recordWaOptIn error:', err.message);
  }

  return {
    phone: norm,
    employeeId: matchedEmpId,
    employeeName: matchedEmpName,
    messageCount: 1,
    lastMessage: messageText,
    lastMessageAt: now
  };
}

export function getWaOptIns() {
  const db = getDatabase();
  try {
    // 1. Ambil seluruh karyawan terdaftar
    const employees = db.prepare('SELECT id, name, phone, department, position, data_json FROM employees;').all();
    
    // 2. Ambil seluruh rekaman opt-in / preferensi yang ada di wa_opt_ins
    const optInRows = db.prepare('SELECT * FROM wa_opt_ins;').all();
    const optInMap = new Map();
    for (const row of optInRows) {
      if (row.phone) optInMap.set(row.phone, row);
    }

    const result = [];
    const processedPhones = new Set();

    // 3. Gabungkan kontak karyawan dengan status opt-in asli (default is_active = 0 / OFF)
    for (const emp of employees) {
      if (!emp.phone) continue;
      let eDigits = String(emp.phone).replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = `62${eDigits.slice(1)}`;
      else if (eDigits.startsWith('8')) eDigits = `62${eDigits}`;
      else if (eDigits.startsWith('620')) eDigits = `62${eDigits.slice(3)}`;
      if (!eDigits.startsWith('62') || eDigits.length < 10) continue;

      processedPhones.add(eDigits);
      const rec = optInMap.get(eDigits);

      const hasChatted = Boolean(rec && rec.message_count > 0 && rec.first_message && !rec.first_message.includes('Master Data'));
      const isActive = rec ? (rec.is_active === 1) : false; // Default OFF!
      const manualOverride = rec ? (rec.manual_override === 1) : false;

      let empLoginId = emp.id;
      try {
        const p = JSON.parse(emp.data_json || '{}');
        empLoginId = p.loginId || (emp.id === 'EMP-001' ? 'admin' : emp.id);
      } catch (e) {}

      result.push({
        phone: eDigits,
        employee_id: emp.id,
        employee_login_id: empLoginId,
        employee_name: emp.name,
        department: emp.department || '-',
        position: emp.position || '-',
        first_message: hasChatted ? rec.first_message : null,
        first_message_at: hasChatted ? rec.first_message_at : null,
        last_message: hasChatted ? rec.last_message : null,
        last_message_at: hasChatted ? rec.last_message_at : null,
        message_count: hasChatted ? rec.message_count : 0,
        is_active: isActive ? 1 : 0,
        manual_override: manualOverride ? 1 : 0,
        has_chatted: hasChatted
      });
    }

    // 4. Sertakan juga nomor telepon eksternal yang pernah mengirim chat ke bot (jika ada)
    for (const [phone, row] of optInMap.entries()) {
      if (!processedPhones.has(phone)) {
        const hasChatted = Boolean(row.message_count > 0 && row.first_message && !row.first_message.includes('Master Data'));
        result.push({
          phone: row.phone,
          employee_id: row.employee_id || null,
          employee_name: row.employee_name || 'Tamu / Eksternal',
          department: '-',
          position: '-',
          first_message: hasChatted ? row.first_message : null,
          first_message_at: hasChatted ? row.first_message_at : null,
          last_message: hasChatted ? row.last_message : null,
          last_message_at: hasChatted ? row.last_message_at : null,
          message_count: hasChatted ? row.message_count : 0,
          is_active: row.is_active === 1 ? 1 : 0,
          manual_override: row.manual_override === 1 ? 1 : 0,
          has_chatted: hasChatted
        });
      }
    }

    // Urutkan: Yang aktif (ON) lebih dulu, lalu karyawan berdasarkan nama
    return result.sort((a, b) => {
      if (b.is_active !== a.is_active) return b.is_active - a.is_active;
      if (b.has_chatted !== a.has_chatted) return (b.has_chatted ? 1 : 0) - (a.has_chatted ? 1 : 0);
      return (a.employee_name || '').localeCompare(b.employee_name || '');
    });
  } catch (e) {
    console.error('[DB] getWaOptIns error:', e);
    return [];
  }
}

export function toggleWaOptIn(phone, isActive, manualOverride = null) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, '');
  let norm = digits;
  if (norm.startsWith('0')) norm = `62${norm.slice(1)}`;
  else if (norm.startsWith('8')) norm = `62${norm}`;
  else if (norm.startsWith('620')) norm = `62${norm.slice(3)}`;
  if (!norm.startsWith('62') || norm.length < 10) return null;

  const db = getDatabase();
  const valActive = isActive ? 1 : 0;
  const valOverride = manualOverride !== null ? (manualOverride ? 1 : 0) : (valActive ? 1 : 0);

  // Cocokkan data karyawan jika ada
  let empId = null;
  let empName = null;
  try {
    const empRows = db.prepare('SELECT id, name, phone FROM employees;').all();
    for (const emp of empRows) {
      if (!emp.phone) continue;
      let eDigits = String(emp.phone).replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = `62${eDigits.slice(1)}`;
      else if (eDigits.startsWith('8')) eDigits = `62${eDigits}`;
      if (eDigits === norm) {
        empId = emp.id;
        empName = emp.name;
        break;
      }
    }
  } catch (e) {}

  db.prepare(`
    INSERT INTO wa_opt_ins (phone, employee_id, employee_name, is_active, manual_override, message_count)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(phone) DO UPDATE SET
      is_active = excluded.is_active,
      manual_override = excluded.manual_override,
      employee_id = COALESCE(excluded.employee_id, wa_opt_ins.employee_id),
      employee_name = COALESCE(excluded.employee_name, wa_opt_ins.employee_name);
  `).run(norm, empId, empName, valActive, valOverride);

  return { phone: norm, is_active: valActive, manual_override: valOverride };
}

export function bulkToggleWaOptIns(phones, isActive, manualOverride = null) {
  const db = getDatabase();
  const valActive = isActive ? 1 : 0;
  const valOverride = manualOverride !== null ? (manualOverride ? 1 : 0) : (valActive ? 1 : 0);

  let targetPhones = [];
  if (!phones || phones.length === 0 || phones === 'ALL') {
    const empRows = db.prepare('SELECT phone FROM employees WHERE phone IS NOT NULL AND phone != "";').all();
    targetPhones = empRows.map(r => {
      let d = String(r.phone).replace(/\D+/g, '');
      if (d.startsWith('0')) d = `62${d.slice(1)}`;
      else if (d.startsWith('8')) d = `62${d}`;
      return d;
    }).filter(d => d.startsWith('62') && d.length >= 10);
  } else {
    targetPhones = (Array.isArray(phones) ? phones : [phones]).map(p => {
      let d = String(p).replace(/\D+/g, '');
      if (d.startsWith('0')) d = `62${d.slice(1)}`;
      else if (d.startsWith('8')) d = `62${d}`;
      return d;
    }).filter(d => d.startsWith('62') && d.length >= 10);
  }

  const uniquePhones = [...new Set(targetPhones)];
  for (const p of uniquePhones) {
    toggleWaOptIn(p, valActive, valOverride);
  }

  return { success: true, count: uniquePhones.length, is_active: valActive };
}

// ==========================================
// DATABASE MANAGEMENT: STATS, VACUUM, EXPORT & IMPORT
// ==========================================

export function getDatabaseStats() {
  const db = getDatabase();
  const info = getDbInfo();

  let attendancesCount = 0;
  let employeesCount = 0;
  let projectsCount = 0;
  let approvalsCount = 0;
  let casualCount = 0;
  let casualAttCount = 0;

  try { attendancesCount = db.prepare('SELECT count(*) as c FROM attendances;').get().c; } catch (e) {}
  try { employeesCount = db.prepare('SELECT count(*) as c FROM employees;').get().c; } catch (e) {}
  try { projectsCount = db.prepare('SELECT count(*) as c FROM projects;').get().c; } catch (e) {}
  try { approvalsCount = db.prepare('SELECT count(*) as c FROM approvals;').get().c; } catch (e) {}
  try { casualCount = db.prepare('SELECT count(*) as c FROM casual_workers;').get().c; } catch (e) {}
  try { casualAttCount = db.prepare('SELECT count(*) as c FROM casual_worker_attendances;').get().c; } catch (e) {}

  return {
    ...info,
    attendancesCount,
    employeesCount,
    projectsCount,
    approvalsCount,
    casualCount,
    casualAttCount
  };
}

export function vacuumDatabase() {
  const db = getDatabase();
  const before = getDbInfo();
  try {
    db.exec('VACUUM;');
  } catch (err) {
    console.error('[VACUUM ERROR]', err);
    throw err;
  }
  const after = getDbInfo();
  return {
    success: true,
    beforeSizeBytes: before.sizeBytes,
    beforeSizeKb: before.sizeKb,
    afterSizeBytes: after.sizeBytes,
    afterSizeKb: after.sizeKb,
    savedBytes: Math.max(0, before.sizeBytes - after.sizeBytes),
    savedKb: Math.max(0, Math.round((before.sizeBytes - after.sizeBytes) / 1024 * 10) / 10)
  };
}

export function getAttendancesForExport(filters = {}) {
  const db = getDatabase();
  let query = 'SELECT id, employeeId, employeeName, employeeNik, department, date, checkInTime, checkOutTime, mode, status, approvalStatus, isLate, lateMinutes, lateReason, data_json FROM attendances WHERE 1=1';
  const params = [];

  if (filters.startDate) {
    query += ' AND date >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND date <= ?';
    params.push(filters.endDate);
  }
  if (filters.projectId) {
    query += " AND (json_extract(data_json, '$.projectId') = ? OR json_extract(data_json, '$.projectCode') = ?)";
    params.push(filters.projectId, filters.projectId);
  }
  if (filters.department && filters.department !== 'ALL') {
    query += ' AND department = ?';
    params.push(filters.department);
  }

  query += ' ORDER BY date DESC, COALESCE(checkOutTime, checkInTime) DESC, checkInTime DESC';
  
  const rows = db.prepare(query).all(...params);
  
  // Resolve canonical loginId map from employees
  const employees = db.prepare('SELECT id, nik, name, data_json FROM employees').all();
  const empMap = new Map();
  for (const emp of employees) {
    let d = {};
    try { d = JSON.parse(emp.data_json); } catch (e) {}
    const loginId = d.loginId || (emp.id === 'EMP-001' ? 'admin' : null);
    if (loginId) {
      empMap.set(emp.id, loginId);
      empMap.set(emp.nik, loginId);
      empMap.set(emp.name.toLowerCase().trim(), loginId);
    }
  }

  return rows.map(r => {
    let d = {};
    try { d = JSON.parse(r.data_json); } catch (e) {}
    const loginId = d.employeeLoginId || empMap.get(r.employeeId) || empMap.get(r.employeeNik) || empMap.get(r.employeeName.toLowerCase().trim()) || '';
    const scoreIn = d.checkInBiometric?.matchScore ?? d.biometricVerification?.matchScore ?? '';
    const scoreOut = d.checkOutBiometric?.matchScore ?? '';
    const addrIn = d.checkInLocation?.address || d.location?.address || '';
    const addrOut = d.checkOutLocation?.address || '';

    return {
      'ID Absensi': r.id,
      'Tanggal': r.date,
      'ID Login': loginId,
      'NIK': r.employeeNik || '',
      'Nama Karyawan': r.employeeName || '',
      'Departemen': r.department || '',
      'Kode Proyek': d.projectCode || '',
      'Nama Proyek': d.projectName || '',
      'Jam Masuk': r.checkInTime || '',
      'Jam Pulang': r.checkOutTime || '',
      'Tipe Mode': r.mode || 'WFO',
      'Status Kehadiran': r.status || 'ON_TIME',
      'Status Approval': r.approvalStatus || 'APPROVED',
      'Terlambat (Menit)': r.lateMinutes || 0,
      'Skor Wajah Masuk': scoreIn ? `${scoreIn}%` : '',
      'Skor Wajah Pulang': scoreOut ? `${scoreOut}%` : '',
      'Alasan / Catatan': d.note || r.lateReason || '',
      'Lokasi Masuk': addrIn,
      'Lokasi Pulang': addrOut,
      // Raw metadata
      id: r.id,
      date: r.date,
      loginId,
      employeeId: r.employeeId,
      nik: r.employeeNik || '',
      name: r.employeeName || '',
      department: r.department || '',
      projectCode: d.projectCode || '',
      projectName: d.projectName || '',
      checkInTime: r.checkInTime || '',
      checkOutTime: r.checkOutTime || '',
      mode: r.mode || 'WFO',
      status: r.status || 'ON_TIME',
      approvalStatus: r.approvalStatus || 'APPROVED',
      lateMinutes: r.lateMinutes || 0,
      note: d.note || r.lateReason || ''
    };
  });
}

export function getEmployeesForExport(requestingUser = null) {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, nik, name, email, phone, role, department, position, employmentType, joinDate, assignedProjectId, baseSalary, fixedAllowance, dailyAllowance, leaveQuota, usedLeave, bankAccount, data_json FROM employees ORDER BY name ASC;').all();

  // Strict RBAC: Check whether requesting user is authorized for financial & compensation data
  const userSystemRole = String(requestingUser?.systemRole || '').toLowerCase().trim();
  const userRole = String(requestingUser?.role || '').toUpperCase().trim();
  const username = String(requestingUser?.username || '').toLowerCase().trim();

  const isFinanceOrSuper = (
    userSystemRole === 'finance' ||
    userSystemRole === 'superuser' ||
    userRole === 'FINANCE' ||
    userRole === 'DIRECTOR' ||
    username === 'admin' ||
    username === 'galih'
  );

  return rows.map(r => {
    let d = {};
    try { d = JSON.parse(r.data_json); } catch (e) {}
    
    const empExport = {
      'ID Karyawan': r.id,
      'NIK': r.nik || '',
      'ID Login': d.loginId || (r.id === 'EMP-001' ? 'admin' : ''),
      'Nama Lengkap': r.name || '',
      'Email': r.email || '',
      'No WhatsApp / Telepon': r.phone || '',
      'Departemen': r.department || '',
      'Jabatan': r.position || r.role || '',
      'Status Kerja': r.employmentType || 'TETAP',
      'Tanggal Bergabung': r.joinDate || '',
      'Kuota Cuti': r.leaveQuota ?? 12,
      'Cuti Terpakai': r.usedLeave ?? 0
    };

    // PRIVACY & COMPLIANCE GUARD:
    // Kolom Gaji Pokok, Tunjangan Tetap, Tunjangan Harian, dan Rekening Bank
    // HANYA dimunculkan jika user adalah Finance atau Superuser!
    // Untuk user HR/Admin/Staff, kolom-kolom ini MUTLAK DIHILANGKAN (Zero Leak).
    if (isFinanceOrSuper) {
      empExport['Gaji Pokok (Rp)'] = r.baseSalary || 0;
      empExport['Tunjangan Tetap (Rp)'] = r.fixedAllowance || 0;
      empExport['Tunjangan Harian (Rp)'] = r.dailyAllowance || 0;
      empExport['Nomor Rekening'] = r.bankAccount || '';
      empExport['Nama Bank'] = d.bankName || 'BCA';
    }

    return empExport;
  });
}

export function getProjectsForExport() {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, code, name, client, location, status, startDate, targetEndDate, allocatedBudget, data_json FROM projects ORDER BY code ASC;').all();
  return rows.map(r => {
    let d = {};
    try { d = JSON.parse(r.data_json); } catch (e) {}
    return {
      'ID Proyek': r.id,
      'Kode Proyek': r.code || '',
      'Nama Proyek': r.name || '',
      'Nama Klien': r.client || '',
      'Lokasi': r.location || '',
      'Status Proyek': r.status || 'ACTIVE',
      'Tanggal Mulai': r.startDate || '',
      'Target Selesai': r.targetEndDate || '',
      'Anggaran Biaya (Rp)': r.allocatedBudget || 0,
      'Project Manager': d.projectManagerName || ''
    };
  });
}

export function importAttendancesBatch(rows, mode = 'replace', operatorUser = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'Tidak ada data baris yang diimpor', summary: { total: 0, inserted: 0, updated: 0, skipped: 0, errors: [] } };
  }

  const db = getDatabase();

  // 1. Create safety backup snapshot before import
  try {
    const backupDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 15);
    const snapPath = path.join(backupDir, `hris_auto_backup_pre_import_${ts}.sqlite`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, snapPath);
    }
  } catch (err) {
    console.warn('[Auto Backup Warn]', err);
  }

  // 2. Build fast lookup maps for employees and projects
  const empRows = db.prepare('SELECT id, nik, name, department, assignedProjectId, data_json FROM employees;').all();
  const empById = new Map();
  const empByLogin = new Map();
  const empByNik = new Map();
  const empByNikDigits = new Map();
  const empByName = new Map();

  for (const emp of empRows) {
    let d = {};
    try { d = JSON.parse(emp.data_json); } catch (e) {}
    const empData = {
      id: emp.id,
      nik: emp.nik,
      name: emp.name,
      department: emp.department,
      assignedProjectId: emp.assignedProjectId,
      loginId: d.loginId || (emp.id === 'EMP-001' ? 'admin' : null),
      ...d
    };

    empById.set(emp.id, empData);
    if (emp.nik) {
      const cleanNik = String(emp.nik).trim();
      empByNik.set(cleanNik, empData);
      const digitsNoZeroes = cleanNik.replace(/\D/g, '').replace(/^0+/, '');
      if (digitsNoZeroes) {
        empByNikDigits.set(digitsNoZeroes, empData);
      }
    }
    if (empData.loginId) {
      empByLogin.set(String(empData.loginId).toLowerCase().trim(), empData);
    }
    if (emp.name) {
      empByName.set(String(emp.name).toLowerCase().trim(), empData);
    }
  }

  const projRows = db.prepare('SELECT id, code, name, data_json FROM projects;').all();
  const projByCode = new Map();
  const projById = new Map();
  const projByName = new Map();

  for (const p of projRows) {
    let d = {};
    try { d = JSON.parse(p.data_json); } catch (e) {}
    projById.set(p.id, { id: p.id, code: p.code, name: p.name, ...d });
    if (p.code) projByCode.set(String(p.code).toUpperCase().trim(), { id: p.id, code: p.code, name: p.name, ...d });
    if (p.name) projByName.set(String(p.name).toLowerCase().trim(), { id: p.id, code: p.code, name: p.name, ...d });
  }

  let salaryRules = null;
  try {
    const rulesRow = db.prepare("SELECT config_json FROM salary_rules WHERE id = 'default'").get();
    if (rulesRow) salaryRules = JSON.parse(rulesRow.config_json);
  } catch (e) {}

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Helper to extract values by multiple possible column aliases (case and whitespace-insensitive)
  const getVal = (row, aliases) => {
    if (!row || typeof row !== 'object') return null;
    for (const k of Object.keys(row)) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const a of aliases) {
        if (cleanK === a.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const v = row[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
      }
    }
    return null;
  };

  const normalizeDate = (raw) => {
    if (!raw && raw !== 0) return null;
    if (raw instanceof Date) return raw.toISOString().split('T')[0];
    if (typeof raw === 'number') {
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{4}[\/.]\d{1,2}[\/.]\d{1,2}$/.test(str)) {
      const p = str.split(/[\/.]/);
      return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
    }
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}$/.test(str)) {
      const p = str.split(/[\/\-.]/);
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return null;
  };

  const normalizeTime = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') {
      const totalSeconds = Math.round(raw * 86400);
      const h = Math.floor(totalSeconds / 3600) % 24;
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const str = String(raw).trim();
    const lower = str.toLowerCase();
    if (lower.includes('belum') || lower === '-' || lower === 'null' || lower === 'undefined') return null;
    const match = str.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
    if (match) {
      const h = String(parseInt(match[1], 10)).padStart(2, '0');
      const m = String(parseInt(match[2], 10)).padStart(2, '0');
      const s = match[3] ? String(parseInt(match[3], 10)).padStart(2, '0') : '00';
      return `${h}:${m}:${s}`;
    }
    return null;
  };

  db.exec('BEGIN TRANSACTION;');

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extract values via flexible multi-language aliases
      const rawId = getVal(row, ['id absensi', 'id', 'attendance id']);
      const rawDate = getVal(row, ['tanggal', 'date', 'tgl', 'tanggal absen']);
      const rawLogin = getVal(row, ['id login', 'login id', 'username', 'login', 'employee login id']);
      const rawNik = getVal(row, ['nik', 'no nik', 'employee nik']);
      const rawName = getVal(row, ['nama karyawan', 'nama', 'name', 'nama lengkap', 'employee name']);
      const rawDept = getVal(row, ['departemen', 'dept', 'department']);
      const rawProjCode = getVal(row, ['kode proyek', 'project code', 'kode prj']);
      const rawProjName = getVal(row, ['nama proyek', 'project name', 'proyek', 'project']);
      const rawIn = getVal(row, ['jam masuk', 'absen masuk', 'masuk', 'check in', 'check in time', 'in']);
      const rawOut = getVal(row, ['jam pulang', 'absen pulang', 'pulang', 'check out', 'check out time', 'out']);
      const rawMode = getVal(row, ['tipe mode', 'mode', 'attendance mode']) || 'WFO';
      const rawStatus = getVal(row, ['status kehadiran', 'status', 'attendance status']);
      const rawAppr = getVal(row, ['status approval', 'status verifikasi', 'approval status']) || 'APPROVED';
      const rawLateMins = getVal(row, ['terlambat menit', 'menit terlambat', 'terlambat', 'late minutes', 'late']);
      const rawNote = getVal(row, ['alasan catatan', 'alasan', 'catatan', 'note', 'notes']) || '';
      const rawScoreIn = getVal(row, ['skor wajah masuk', 'skor masuk', 'score in']);
      const rawScoreOut = getVal(row, ['skor wajah pulang', 'skor pulang', 'score out']);
      const rawLocIn = getVal(row, ['lokasi masuk', 'lokasi', 'alamat']);

      // 1. Skip completely empty rows silently
      const isRowEmpty = !rawDate && !rawLogin && !rawNik && !rawName && !rawIn && !rawOut && !rawId;
      if (isRowEmpty) continue;

      const normDate = normalizeDate(rawDate);
      if (!normDate) {
        errors.push(`Baris ${rowNum}: Format tanggal tidak valid (${rawDate || 'kosong'})`);
        continue;
      }

      // 2. Resolve Employee (LoginId -> NIK -> NIK digits -> ID -> Name)
      let emp = null;
      if (rawLogin) emp = empByLogin.get(String(rawLogin).toLowerCase().trim());
      if (!emp && rawNik) {
        const cleanNik = String(rawNik).trim();
        emp = empByNik.get(cleanNik);
        if (!emp) {
          const digitsOnly = cleanNik.replace(/\D/g, '').replace(/^0+/, '');
          if (digitsOnly && empByNikDigits.has(digitsOnly)) {
            emp = empByNikDigits.get(digitsOnly);
          }
        }
      }
      if (!emp && rawId && row['employeeId'] && empById.has(row['employeeId'])) {
        emp = empById.get(row['employeeId']);
      }
      if (!emp && rawName) {
        emp = empByName.get(String(rawName).toLowerCase().trim());
      }

      if (!emp) {
        errors.push(`Baris ${rowNum}: Karyawan tidak terdaftar di sistem (Login: ${rawLogin || '-'}, NIK: ${rawNik || '-'}, Nama: ${rawName || '-'})`);
        continue;
      }

      // 3. Resolve Project
      let proj = null;
      if (rawProjCode) proj = projByCode.get(String(rawProjCode).toUpperCase().trim());
      if (!proj && rawProjName) proj = projByName.get(String(rawProjName).toLowerCase().trim());
      if (!proj && emp.assignedProjectId) proj = projById.get(emp.assignedProjectId);

      // 4. Check existing attendance in DB
      let existing = null;
      if (rawId) {
        existing = db.prepare('SELECT id, data_json, checkInTime, checkOutTime, photoUrl FROM attendances WHERE id = ?').get(rawId);
      }
      if (!existing) {
        existing = db.prepare('SELECT id, data_json, checkInTime, checkOutTime, photoUrl FROM attendances WHERE employeeId = ? AND date = ?').get(emp.id, normDate);
      }

      const normIn = normalizeTime(rawIn);
      const normOut = normalizeTime(rawOut);

      // Mode ADD: Skip if already exists
      if (mode === 'add' && existing) {
        skipped++;
        continue;
      }

      let prevData = {};
      if (existing && existing.data_json) {
        try { prevData = JSON.parse(existing.data_json); } catch (e) {}
      }

      const finalId = existing ? existing.id : (rawId && String(rawId).startsWith('ATT-') ? rawId : `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
      
      const projSched = proj?.workingHoursSchedule || salaryRules?.officeWorkingHours || { checkInCutoff: '08:15', checkOutTime: '17:00' };
      const cutoffTime = projSched.checkInCutoff || '08:15';
      
      let isLate = 0;
      let lateMinutes = 0;
      if (rawLateMins !== null && rawLateMins !== '' && !isNaN(Number(rawLateMins))) {
        lateMinutes = Math.max(0, parseInt(rawLateMins, 10));
        isLate = lateMinutes > 0 ? 1 : 0;
      } else if (normIn) {
        const [inH, inM] = normIn.split(':').map(Number);
        const [cutH, cutM] = cutoffTime.split(':').map(Number);
        const inMins = (inH || 0) * 60 + (inM || 0);
        const cutMins = (cutH || 0) * 60 + (cutM || 0);
        if (inMins > cutMins) {
          isLate = 1;
          lateMinutes = inMins - cutMins;
        }
      }

      let finalStatus = rawStatus;
      if (!finalStatus) {
        if (isLate === 1) finalStatus = 'LATE';
        else if (normIn) finalStatus = 'ON_TIME';
        else finalStatus = prevData.status || 'ON_TIME';
      }

      // Preserve existing photos and biometrics (ZERO data loss)
      const photoUrl = existing?.photoUrl || prevData.photoUrl || null;
      const checkInPhotoUrl = prevData.checkInPhotoUrl || photoUrl || null;
      const checkOutPhotoUrl = prevData.checkOutPhotoUrl || prevData.photoOutUrl || null;

      const cleanScoreIn = rawScoreIn ? parseInt(String(rawScoreIn).replace(/\D/g, ''), 10) : (prevData.checkInBiometric?.matchScore ?? prevData.biometricVerification?.matchScore ?? null);
      const cleanScoreOut = rawScoreOut ? parseInt(String(rawScoreOut).replace(/\D/g, ''), 10) : (prevData.checkOutBiometric?.matchScore ?? null);

      const existingBioIn = prevData.checkInBiometric || prevData.biometricVerification;
      const finalBioIn = (cleanScoreIn !== null && cleanScoreIn !== undefined) ? {
        isVerified: cleanScoreIn >= 60,
        matchScore: cleanScoreIn,
        livenessPassed: true,
        details: existingBioIn?.details || (cleanScoreIn >= 60 ? 'Biometrik terverifikasi valid' : 'Biometrik di bawah ambang batas')
      } : (existingBioIn || null);

      const existingBioOut = prevData.checkOutBiometric;
      const finalBioOut = (cleanScoreOut !== null && cleanScoreOut !== undefined) ? {
        isVerified: cleanScoreOut >= 60,
        matchScore: cleanScoreOut,
        livenessPassed: true,
        details: existingBioOut?.details || (cleanScoreOut >= 60 ? 'Biometrik pulang valid' : 'Biometrik di bawah ambang batas')
      } : (existingBioOut || null);

      const mergedData = {
        ...prevData,
        id: finalId,
        employeeId: emp.id,
        employeeLoginId: emp.loginId || rawLogin || prevData.employeeLoginId,
        employeeName: emp.name,
        employeeNik: emp.nik,
        department: rawDept || emp.department || prevData.department,
        date: normDate,
        checkInTime: normIn || prevData.checkInTime || undefined,
        checkOutTime: normOut || prevData.checkOutTime || undefined,
        attendanceType: normOut && !normIn ? 'CHECK_OUT' : 'CHECK_IN',
        mode: rawMode || prevData.mode || 'WFO',
        status: finalStatus,
        isLate: Boolean(isLate),
        lateMinutes,
        lateReason: isLate ? (rawNote || prevData.lateReason || 'Terlambat') : null,
        approvalStatus: rawAppr || prevData.approvalStatus || 'APPROVED',
        photoUrl,
        checkInPhotoUrl,
        checkOutPhotoUrl,
        photoOutUrl: checkOutPhotoUrl,
        location: prevData.location || {
          lat: -7.2974,
          lng: 112.8041,
          accuracy: 5,
          address: rawLocIn || 'Office / Project Site',
          inGeofence: true,
          distanceMeters: 50
        },
        projectId: proj?.id || emp.assignedProjectId || prevData.projectId || '',
        projectCode: proj?.code || prevData.projectCode || '',
        projectName: proj?.name || prevData.projectName || '',
        note: rawNote || prevData.note || '',
        biometricVerification: finalBioIn,
        checkInBiometric: finalBioIn,
        checkOutBiometric: finalBioOut,
        updated_at: new Date().toISOString()
      };

      try {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO attendances (
            id, employeeId, employeeName, employeeNik, department,
            date, checkInTime, checkOutTime, mode, status,
            photoUrl, isLate, lateMinutes, lateReason,
            approvalStatus, data_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `);

        stmt.run(
          finalId,
          emp.id,
          emp.name,
          emp.nik,
          mergedData.department || '',
          normDate,
          mergedData.checkInTime || null,
          mergedData.checkOutTime || null,
          mergedData.mode || 'WFO',
          mergedData.status || 'ON_TIME',
          photoUrl,
          isLate,
          lateMinutes,
          mergedData.lateReason || null,
          mergedData.approvalStatus || 'APPROVED',
          JSON.stringify(mergedData),
          new Date().toISOString()
        );

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      } catch (rowErr) {
        errors.push(`Baris ${rowNum} (${emp.name}): Gagal menyimpan ke SQLite (${rowErr.message})`);
      }
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[IMPORT_EXCEL_BATCH_ERROR]', err);
    throw err;
  }

  const operatorLogin = operatorUser?.username || operatorUser?.loginId || 'admin';
  addAuditLog({
    action: 'DATABASE_EXCEL_IMPORTED',
    entity: 'attendances',
    entityId: `BATCH-${Date.now()}`,
    userName: operatorUser?.name || operatorLogin,
    userNik: null,
    userLoginId: operatorLogin,
    userRole: operatorUser?.systemRole || operatorUser?.role || 'superuser',
    module: 'DATABASE',
    ipAddress: operatorUser?.clientIp || '127.0.0.1',
    status: 'SUCCESS',
    details: `Impor Excel (${mode.toUpperCase()}): Total ${rows.length} baris diproses (${updated} diperbarui, ${inserted} ditambahkan, ${skipped} dilewati, ${errors.length} error) oleh ${operatorLogin}.`
  });

  return {
    success: true,
    summary: {
      total: rows.length,
      inserted,
      updated,
      skipped,
      errorsCount: errors.length,
      errors
    }
  };
}


