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
      first_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_message TEXT,
      last_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
      message_count INTEGER DEFAULT 1
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
      if (uInfo.role && (!emp.role || emp.role === 'Employee')) emp.role = uInfo.role;
    }
    if (!emp.loginId) {
      if (emp.id === 'EMP-001') emp.loginId = 'admin';
      else if (userMap.has(emp.id)) emp.loginId = userMap.get(emp.id);
      else emp.loginId = `d${String(emp.id.replace(/\D/g, '')).padStart(3, '0')}`;
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

  // REA Optimization: Streamline attendances and convert inline base64 to /api/attendance/:id/photo
  const attendances = db.prepare('SELECT id, data_json FROM attendances ORDER BY date DESC, COALESCE(checkOutTime, checkInTime) DESC, checkInTime DESC LIMIT 200;').all().map(r => {
    let item = {};
    try { item = JSON.parse(r.data_json); } catch (e) {}
    if (item.photoUrl && item.photoUrl.startsWith('data:image')) {
      item.photoUrl = `/api/attendance/${item.id || r.id}/photo`;
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
    return item.photoUrl || null;
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

  // Smart Attendance Merge: Cek apakah karyawan sudah memiliki presensi pada tanggal yang sama
  const existing = db.prepare('SELECT id, data_json, checkInTime, checkOutTime, isLate, lateMinutes, status, approvalStatus FROM attendances WHERE employeeId = ? AND date = ?;').get(record.employeeId, record.date);

  const attType = record.attendanceType || (record.checkOutTime ? 'CHECK_OUT' : 'CHECK_IN');

  let targetId = record.id || `ATT-${Date.now()}`;
  let finalCheckIn = record.checkInTime ? record.checkInTime.replace(/\./g, ':') : null;
  let finalCheckOut = record.checkOutTime ? record.checkOutTime.replace(/\./g, ':') : null;
  let finalStatus = record.status || (finalCheckOut && !finalCheckIn ? 'ALPA' : 'ON_TIME');
  let finalIsLate = record.isLate ? 1 : 0;
  let finalLateMinutes = record.lateMinutes || 0;
  let finalLateReason = record.lateReason || null;
  let finalApprovalStatus = record.approvalStatus || (finalCheckOut && !finalCheckIn ? 'PENDING' : 'APPROVED');
  let mergedData = { ...record };

  if (existing) {
    targetId = existing.id;
    let prevData = {};
    try { prevData = JSON.parse(existing.data_json); } catch (e) {}

    if (attType === 'CHECK_IN') {
      // MODE PRESENSI MASUK: Hanya set/perbarui jam masuk, jangan pernah set jam pulang
      finalCheckIn = (record.checkInTime || existing.checkInTime || '').replace(/\./g, ':') || null;
      finalCheckOut = existing.checkOutTime ? existing.checkOutTime.replace(/\./g, ':') : null;
      finalStatus = record.status || existing.status;
      finalIsLate = record.isLate !== undefined ? (record.isLate ? 1 : 0) : existing.isLate;
      finalLateMinutes = record.lateMinutes !== undefined ? record.lateMinutes : (existing.lateMinutes || 0);
      finalLateReason = record.lateReason || existing.lateReason || null;
      finalApprovalStatus = record.approvalStatus || existing.approvalStatus || 'APPROVED';

      mergedData = {
        ...prevData,
        ...record,
        id: targetId,
        checkInTime: finalCheckIn || undefined,
        checkOutTime: finalCheckOut,
        status: finalStatus,
        isLate: Boolean(finalIsLate),
        lateMinutes: finalLateMinutes,
        lateReason: finalLateReason,
        approvalStatus: finalApprovalStatus,
        photoUrl: record.photoUrl || prevData.photoUrl
      };
    } else {
      // MODE PRESENSI PULANG: Pertahankan jam masuk awal JIKA ADA.
      // JIKA TIDAK PERNAH ABSEN MASUK: Biarkan finalCheckIn = NULL, status = ALPA, butuh approval PM -> HR!
      finalCheckIn = (existing.checkInTime || record.checkInTime || null);
      if (finalCheckIn) finalCheckIn = finalCheckIn.replace(/\./g, ':');
      finalCheckOut = (record.checkOutTime || record.checkInTime || '').replace(/\./g, ':') || null;

      if (!finalCheckIn) {
        finalStatus = 'ALPA';
        finalApprovalStatus = 'PENDING';
      } else {
        finalStatus = existing.status || (record.status === 'LATE' ? 'ON_TIME' : record.status);
        finalApprovalStatus = existing.approvalStatus || record.approvalStatus || 'APPROVED';
      }
      finalIsLate = existing.isLate !== undefined ? existing.isLate : 0;
      finalLateMinutes = existing.lateMinutes !== undefined ? existing.lateMinutes : 0;
      finalLateReason = existing.lateReason || null;

      mergedData = {
        ...prevData,
        ...record,
        id: targetId,
        checkInTime: finalCheckIn || undefined,
        checkOutTime: finalCheckOut,
        status: finalStatus,
        isLate: Boolean(finalIsLate),
        lateMinutes: finalLateMinutes,
        lateReason: finalLateReason,
        approvalStatus: finalApprovalStatus,
        photoUrl: prevData.photoUrl || prevData.checkInPhotoUrl || record.photoUrl,
        checkInPhotoUrl: prevData.photoUrl || prevData.checkInPhotoUrl,
        photoOutUrl: record.photoOutUrl || record.photoUrl,
        checkOutPhotoUrl: record.photoOutUrl || record.photoUrl,
        checkOutLocation: record.location,
        checkOutBiometric: record.biometricVerification
      };
    }
  }

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
    record.mode || 'WFO',
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
  record.checkInTime = finalCheckIn || undefined;
  record.checkOutTime = finalCheckOut || undefined;
  record.status = finalStatus;
  record.isLate = Boolean(finalIsLate);
  record.lateMinutes = finalLateMinutes;
  record.approvalStatus = finalApprovalStatus;
  record.photoUrl = mergedData.photoUrl || record.photoUrl;
  record.photoOutUrl = mergedData.photoOutUrl || record.photoOutUrl;

  if (record.approvalStatus === 'PENDING') {
    const isMissingCheckIn = !record.checkInTime && Boolean(record.checkOutTime);
    const isDinasLuar = record.mode === 'DINAS_LUAR';
    const isOutOfGeofence = record.status === 'OUT_OF_GEOFENCE';
    // Absen Pulang (CHECK_OUT) hanya skip jika itu adalah keterlambatan biasa
    if (!isDinasLuar && !isOutOfGeofence && !isMissingCheckIn && attType === 'CHECK_OUT') {
      // Skip late justification approval saat absen pulang normal
    } else {
    const approvalId = `APPR-${record.id}`;
    const approvalType = isMissingCheckIn
      ? 'ATTENDANCE_CORRECTION'
      : isDinasLuar
      ? 'DINAS_LUAR'
      : isOutOfGeofence
      ? 'OUT_OF_GEOFENCE'
      : 'LATE_JUSTIFICATION';
    const distText = record.location?.distanceMeters ? ` (${record.location.distanceMeters >= 1000 ? (record.location.distanceMeters / 1000).toFixed(1) + ' km' : record.location.distanceMeters + 'm'})` : '';
    const approvalTitle = isMissingCheckIn
      ? `Persetujuan Presensi Tanpa Absen Masuk - ${record.employeeName}`
      : isDinasLuar
      ? `Pengajuan Dinas Luar Mendadak: ${record.dinasLuarDetails?.clientName || 'Klien Luar'}`
      : isOutOfGeofence
      ? `Persetujuan Presensi Luar Area${distText}`
      : `Justifikasi Keterlambatan (${record.lateMinutes} Menit)`;
    const approvalDesc = isMissingCheckIn
      ? `Karyawan melakukan Absen Pulang pukul ${record.checkOutTime} WIB tanpa rekam Absen Masuk pada tanggal ${record.date}. Status saat ini Tidak Absen (Alpa) dan memerlukan peninjauan kehadiran oleh PM terkait kemudian HR Manager.`
      : isDinasLuar
      ? `Tujuan: ${record.dinasLuarDetails?.destination} | Alasan: ${record.dinasLuarDetails?.purpose}`
      : isOutOfGeofence
      ? `Catatan Luar Area${distText}: ${record.outOfRangeReason || record.note || 'Presensi di luar radius resmi'}`
      : `Alasan Keterlambatan: ${record.lateReason || 'Keterlambatan operasional'}`;

    const projInfo = resolveEmployeeProjectAndPm(record.employeeId);
    const hasPm = Boolean(projInfo?.projectManagerId && !projInfo.isEmployeeThePm);
    const hasAdmin = Boolean(projInfo?.projectAdminIds && projInfo.projectAdminIds.length > 0);

    const approvalItem = {
      id: approvalId,
      type: approvalType,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      employeeNik: record.employeeNik,
      department: record.department,
      title: approvalTitle,
      description: approvalDesc,
      startDate: record.date,
      lateMinutes: isOutOfGeofence ? 0 : (record.lateMinutes || 0),
      attendanceRecordId: record.id,
      proofAttachment: record.photoUrl,
      status: 'PENDING',
      submittedAt: `${record.date} ${record.checkInTime}`,
      projectId: projInfo?.projectId || record.projectId || null,
      projectCode: projInfo?.projectCode || record.projectCode || null,
      projectName: projInfo?.projectName || record.projectName || null,
      projectManagerId: projInfo?.projectManagerId || null,
      projectManagerName: projInfo?.projectManagerName || null,
      projectAdminIds: projInfo?.projectAdminIds || [],
      projectAdminNames: projInfo?.projectAdminNames || [],
      targetApproverRole: (hasPm || hasAdmin) ? 'PM' : 'HR',
      stage: (hasPm || hasAdmin) ? 'PM' : 'HR',
      requiresHrApproval: true
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

  const isCheckOut = attType === 'CHECK_OUT' || Boolean(record.checkOutTime && !record.checkInTime);
  const attAction = isCheckOut
    ? (record.mode === 'DINAS_LUAR' ? 'CHECKOUT_DINAS_LUAR' : 'CHECKOUT_PULANG')
    : (record.mode === 'DINAS_LUAR' ? 'CHECKIN_DINAS_LUAR' : 'CHECKIN_WFO');

  addAuditLog({
    action: attAction,
    entity: 'attendances',
    entityId: record.id,
    userName: record.employeeName,
    userNik: record.employeeNik,
    userRole: 'staff',
    module: 'ATTENDANCE',
    ipAddress: record.ipAddress || '103.31.205.218',
    status: record.isLate && !isCheckOut ? 'WARNING' : 'SUCCESS',
    details: isCheckOut
      ? `Presensi Pulang (Check-Out) ${record.mode} ${record.employeeName} (${record.employeeNik}) berhasil dicatat pada ${finalCheckOut}.`
      : `Presensi Masuk (Check-In) ${record.mode} ${record.employeeName} (${record.employeeNik}) berhasil dicatat. Status: ${record.status}, Terlambat: ${record.lateMinutes} menit.`,
    metadata: {
      location: record.location,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      networkAudit: record.networkAudit,
      hasPhoto: Boolean(record.photoUrl)
    }
  });

  return { success: true, record };
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
  addAuditLog({
    action: 'ATTENDANCE_DELETED',
    entity: 'attendances',
    entityId: targetId,
    userName: operatorUser?.name || operatorUser?.username || 'Superuser',
    userNik: operatorUser?.nik || 'SUPERUSER',
    userRole: operatorUser?.systemRole || operatorUser?.role || 'superuser',
    module: 'ATTENDANCE',
    status: 'SUCCESS',
    details: `Presensi ${existing.employeeName} (${existing.employeeNik}) tanggal ${existing.date} ID ${targetId} berhasil dihapus oleh Superuser.`
  });

  return {
    success: true,
    id: targetId,
    employeeId: existing.employeeId,
    date: existing.date,
    linkedApprovalIds: linkedApprovals.map(a => a.id)
  };
}

export function updateApproval(id, status, reviewNote, reviewedBy = 'Direksi / HR Lead') {
  const db = getDatabase();
  const row = db.prepare('SELECT data_json FROM approvals WHERE id = ?;').get(id);
  if (!row) throw new Error(`Approval item with ID ${id} not found`);

  const item = JSON.parse(row.data_json);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 2-STAGE APPROVAL WORKFLOW GATEKEEPER:
  // If item is currently at Stage 1 (PM / Admin Proyek review) and action is 'APPROVED':
  // Record PM / Admin recommendation/approval and shift to Stage 2 (HR Manager)
  // Note: SLIP_ACCESS and KASBON are handled by Finance directly.
  const isPmStage = item.type !== 'SLIP_ACCESS' && item.type !== 'KASBON' && (item.targetApproverRole === 'PM' || item.stage === 'PM' || !item.stage) && !item.pmApprovedBy && (Boolean(item.projectManagerId) || Boolean(item.projectAdminIds && item.projectAdminIds.length > 0));

  if (status === 'APPROVED' && isPmStage) {
    item.pmApprovedBy = reviewedBy;
    item.pmApprovedAt = now;
    item.pmReviewNote = reviewNote || null;
    item.targetApproverRole = 'HR';
    item.stage = 'HR';
    item.status = 'PENDING'; // Retains PENDING status until final HR approval!
    item.requiresHrApproval = true;

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
      details: `Pengajuan [${item.type}] untuk ${item.employeeName} (${item.employeeNik}) telah disetujui Tahap 1 oleh PM ${reviewedBy}. Diteruskan ke HR Manager untuk otorisasi akhir.${reviewNote ? ` Catatan PM: "${reviewNote}"` : ''}`
    });

    return {
      success: true,
      item,
      updatedAttendance: null,
      updatedEmployee: null,
      isIntermediatePmApproval: true
    };
  }

  // Final Decision (Stage 2 HR Approval, or Rejection by either PM / HR)
  item.status = status;
  item.reviewNote = reviewNote;
  item.reviewedBy = reviewedBy;
  item.reviewedAt = now;

  if (status === 'APPROVED') {
    item.hrApprovedBy = reviewedBy;
    item.hrApprovedAt = now;
    item.hrReviewNote = reviewNote || null;
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
      item.hrReviewNote = reviewNote || null;
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
      if (status === 'APPROVED' && attRecord.status === 'LATE') {
        attRecord.status = 'ON_TIME';
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

  addAuditLog({
    action: status === 'APPROVED' ? 'APPROVAL_APPROVED' : status === 'REJECTED' ? 'APPROVAL_REJECTED' : 'UPDATE_APPROVAL',
    entity: 'approvals',
    entityId: id,
    userName: reviewedBy || 'Direksi / HR Lead',
    userRole: 'admin',
    module: 'APPROVALS',
    status: status === 'REJECTED' ? 'WARNING' : 'SUCCESS',
    details: `Pengajuan [${item.type}] untuk ${item.employeeName} (${item.employeeNik}) diputuskan "${status}" oleh ${reviewedBy}.${reviewNote ? ` Catatan: "${reviewNote}"` : ''}`
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

  if (!item.targetApproverRole) {
    item.targetApproverRole = (hasPm || hasAdmin) ? 'PM' : 'HR';
  }
  if (!item.stage) {
    item.stage = (hasPm || hasAdmin) ? 'PM' : 'HR';
  }
  item.requiresHrApproval = true;

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

  const fallbackCutoff = fallbackRules?.cutoffTime || '08:30';
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
    }
  }

  db.prepare(`
    INSERT OR REPLACE INTO employees (
      id, nik, name, email, phone, role, department, position,
      employmentType, joinDate, assignedProjectId, baseSalary,
      fixedAllowance, dailyAllowance, leaveQuota, usedLeave,
      bankAccount, avatar, data_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `).run(
    emp.id, emp.nik, emp.name, emp.email || null, emp.phone || null, emp.role || 'Employee',
    emp.department || null, emp.position || null, emp.employmentType || 'TETAP', emp.joinDate || null,
    emp.assignedProjectId || null, emp.baseSalary ?? 0, emp.fixedAllowance ?? 0,
    emp.dailyAllowance ?? 0, emp.leaveQuota ?? 12, emp.usedLeave ?? 0,
    emp.bankAccount ? JSON.stringify(emp.bankAccount) : null, emp.avatar || null, JSON.stringify(emp)
  );

  // Synchronize active/inactive status and system_role/role to user_accounts
  const userAccountStatus = emp.status === 'INACTIVE' ? 'inactive' : 'active';
  const targetSysRole = emp.id === 'EMP-001' ? 'superuser' : (emp.systemRole === 'admin' ? 'hr' : emp.systemRole || 'staff');
  const targetRole = emp.role || 'Employee';

  try {
    const res = db.prepare(`
      UPDATE user_accounts 
      SET email = COALESCE(?, email), system_role = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE employee_id = ? OR id = ?;
    `).run(emp.email || null, targetSysRole, targetRole, userAccountStatus, emp.id, emp.id);

    // Sync project manager name across projects if this employee is a PM
    try {
      db.prepare(`
        UPDATE projects 
        SET projectManagerName = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE projectManagerId = ?;
      `).run(emp.name, emp.id);
    } catch (ePm) {}

    // Auto-sync employee phone into wa_opt_ins (enterprise ID contacts are pre-verified)
    if (emp.phone) {
      let eDigits = String(emp.phone).replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = '62' + eDigits.slice(1);
      else if (eDigits.startsWith('8')) eDigits = '62' + eDigits;
      else if (eDigits.startsWith('620')) eDigits = '62' + eDigits.slice(3);
      if (eDigits.startsWith('62') && eDigits.length >= 10) {
        try {
          db.prepare(`
            INSERT INTO wa_opt_ins (phone, employee_id, employee_name, first_message, first_message_at, last_message, last_message_at, message_count)
            VALUES (?, ?, ?, 'Terverifikasi dari ID Master Data', CURRENT_TIMESTAMP, 'Sinkronisasi Profil ID', CURRENT_TIMESTAMP, 1)
            ON CONFLICT(phone) DO UPDATE SET employee_id = excluded.employee_id, employee_name = excluded.employee_name, last_message_at = CURRENT_TIMESTAMP;
          `).run(eDigits, emp.id, emp.name);
        } catch (errOpt) {}
      }
    }

    // If no user account existed yet for this employee, create it
    if (res.changes === 0 && emp.id !== 'EMP-001') {
      const loginId = emp.loginId || `d${String(emp.id.replace(/\D/g, '')).padStart(3, '0')}`;
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
    userName: 'Admin HR',
    userRole: 'admin',
    module: 'EMPLOYEES',
    status: 'SUCCESS',
    details: `Data master karyawan ${emp.name} (${emp.nik}) - Jabatan ${emp.position} di departemen ${emp.department} diperbarui (Status: ${emp.status || 'ACTIVE'}).`
  });

  return { success: true, employee: emp };
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

  addAuditLog({
    action: 'DELETE_EMPLOYEE',
    entity: 'employees',
    entityId: targetId,
    userName: operatorUser?.name || operatorUser?.username || 'Admin HR',
    userNik: operatorUser?.nik || operatorUser?.userNik || null,
    userRole: operatorUser?.systemRole || operatorUser?.role || 'admin',
    module: 'EMPLOYEES',
    status: 'SUCCESS',
    details: `Data master karyawan ${targetName} (${targetNik}) berhasil dihapus permanen oleh ${operatorUser?.name || operatorUser?.username || 'Admin HR'}.`
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
    userNik: employee?.nik,
    userRole: user.system_role,
    module: 'AUTH',
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
      const loginId = parsedEmp.loginId || (empRow.id === 'EMP-001' ? 'admin' : `d${String(empRow.id.replace(/\D/g, '')).padStart(3, '0')}`);
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

export function changeUserPassword(userId, oldPassword, newPassword) {
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
    userRole: user.system_role,
    module: 'AUTH',
    status: 'SUCCESS',
    details: `Password akun pengguna ${user.username} berhasil diubah.`
  });

  return { success: true };
}

export function resetEmployeePassword(employeeId, newPassword = 'zzz', operatorUser = null) {
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

  addAuditLog({
    action: 'RESET_PASSWORD',
    entity: 'user_accounts',
    entityId: user.id,
    userName: operatorUser?.name || operatorUser?.username || 'Admin HR',
    userNik: operatorUser?.nik || 'ADMIN',
    userRole: operatorUser?.systemRole || 'admin',
    module: 'AUTH',
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
    username = targetEmployee?.loginId || (empId === 'EMP-001' ? 'admin' : `d${String(empId.replace(/\D/g, '')).padStart(3, '0')}`);
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

  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      action, entity, entityId, details,
      userName, userNik, userRole, module,
      ipAddress, status, metadata, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run(
    entry.action || 'ACTIVITY',
    entry.entity || 'SYSTEM',
    entry.entityId || null,
    entry.details || '',
    entry.userName || 'System',
    entry.userNik || null,
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
      LOWER(COALESCE(userNik, '')) LIKE ? OR
      LOWER(action) LIKE ? OR
      LOWER(COALESCE(ipAddress, '')) LIKE ?
    )`);
    params.push(term, term, term, term, term);
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

  return {
    logs: rows,
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
    // 1. Cek langsung di tabel wa_opt_ins
    const row = db.prepare('SELECT phone FROM wa_opt_ins WHERE phone = ?;').get(norm);
    if (row) return true;

    // 2. Cek apakah nomor ini terdaftar di master data ID karyawan aktif
    const empRows = db.prepare('SELECT id, name, phone, data_json FROM employees;').all();
    for (const emp of empRows) {
      if (!emp.phone) continue;
      let eDigits = String(emp.phone).replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = `62${eDigits.slice(1)}`;
      else if (eDigits.startsWith('8')) eDigits = `62${eDigits}`;
      else if (eDigits.startsWith('620')) eDigits = `62${eDigits.slice(3)}`;
      if (eDigits === norm) {
        try {
          db.prepare(`
            INSERT INTO wa_opt_ins (phone, employee_id, employee_name, first_message, first_message_at, last_message, last_message_at, message_count)
            VALUES (?, ?, ?, 'Terverifikasi Otomatis dari ID Master Data', CURRENT_TIMESTAMP, 'Sinkronisasi Otomatis ID', CURRENT_TIMESTAMP, 1)
            ON CONFLICT(phone) DO UPDATE SET employee_id = excluded.employee_id, employee_name = excluded.employee_name;
          `).run(norm, emp.id, emp.name);
        } catch (e) {}
        return true;
      }
    }
    return false;
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
      INSERT INTO wa_opt_ins (phone, employee_id, employee_name, first_message, first_message_at, last_message, last_message_at, message_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(phone) DO UPDATE SET
        last_message = excluded.last_message,
        last_message_at = excluded.last_message_at,
        message_count = wa_opt_ins.message_count + 1,
        employee_id = COALESCE(excluded.employee_id, wa_opt_ins.employee_id),
        employee_name = COALESCE(excluded.employee_name, wa_opt_ins.employee_name);
    `).run(norm, matchedEmpId, matchedEmpName, messageText, now, messageText, now);

    addAuditLog('WA_OPT_IN_RECORDED', 'wa_opt_ins', norm, `User +${norm} (${matchedEmpName || pushName || 'Tamu'}) mengetik pesan ke bot WhatsApp dan berhasil terverifikasi untuk notifikasi.`);
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
    // Pastikan seluruh karyawan yang memiliki nomor telepon terdaftar ke wa_opt_ins
    const employees = db.prepare('SELECT id, name, phone, data_json FROM employees;').all();
    for (const emp of employees) {
      if (!emp.phone) continue;
      let eDigits = String(emp.phone).replace(/\D+/g, '');
      if (eDigits.startsWith('0')) eDigits = `62${eDigits.slice(1)}`;
      else if (eDigits.startsWith('8')) eDigits = `62${eDigits}`;
      else if (eDigits.startsWith('620')) eDigits = `62${eDigits.slice(3)}`;
      if (eDigits.startsWith('62') && eDigits.length >= 10) {
        try {
          db.prepare(`
            INSERT INTO wa_opt_ins (phone, employee_id, employee_name, first_message, first_message_at, last_message, last_message_at, message_count)
            VALUES (?, ?, ?, 'Terverifikasi dari ID Master Data', CURRENT_TIMESTAMP, 'Terkoneksi ke Master Data HRIS', CURRENT_TIMESTAMP, 1)
            ON CONFLICT(phone) DO UPDATE SET employee_id = excluded.employee_id, employee_name = excluded.employee_name;
          `).run(eDigits, emp.id, emp.name);
        } catch (e) {}
      }
    }
    return db.prepare('SELECT * FROM wa_opt_ins ORDER BY last_message_at DESC;').all();
  } catch (e) {
    return [];
  }
}

