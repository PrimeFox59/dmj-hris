import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  INITIAL_EMPLOYEES,
  INITIAL_PROJECTS,
  INITIAL_ATTENDANCE,
  INITIAL_APPROVALS,
  INITIAL_SALARY_RULES
} from '../src/data/mockData.ts';
import type {
  Employee,
  Project,
  AttendanceRecord,
  ApprovalItem,
  SalaryRuleConfig
} from '../src/types/index.ts';

// Determine root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'hris.sqlite');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
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

function initializeSchema(db: DatabaseSync) {
  // Enterprise SQLite configuration
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Employees Table
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

  // 2. Projects Table
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

  // 3. Attendances Table
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Approvals Table
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

  // 5. Salary Rules Config Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_rules (
      id TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Audit Logs Table
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
  `);

  // Ensure audit_logs columns exist (backward-compatible schema migration)
  try {
    const existingAuditCols = (db.prepare('PRAGMA table_info(audit_logs);').all() as any[]).map(c => c.name);
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

  // Auto-seed if database is new or empty
  const empCount = (db.prepare('SELECT count(*) as count FROM employees;').get() as any)?.count || 0;
  if (empCount === 0) {
    seedInitialData(db);
  }
  const logCount = (db.prepare('SELECT count(*) as count FROM audit_logs;').get() as any)?.count || 0;
  if (logCount < 10) {
    seedRealisticAuditLogs(db);
  }
}

export function seedInitialData(db: DatabaseSync) {
  console.log('[SQLite] Inisialisasi awal & seeding database hris.sqlite...');

  // 1. Seed Employees
  const insertEmp = db.prepare(`
    INSERT OR REPLACE INTO employees (
      id, nik, name, email, phone, role, department, position,
      employmentType, joinDate, assignedProjectId, baseSalary,
      fixedAllowance, dailyAllowance, leaveQuota, usedLeave,
      bankAccount, avatar, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const emp of INITIAL_EMPLOYEES) {
    insertEmp.run(
      emp.id,
      emp.nik,
      emp.name,
      emp.email,
      emp.phone,
      emp.role,
      emp.department,
      emp.position,
      emp.employmentType,
      emp.joinDate,
      emp.assignedProjectId,
      emp.baseSalary,
      emp.fixedAllowance,
      emp.dailyAllowance,
      emp.leaveQuota,
      emp.usedLeave,
      JSON.stringify(emp.bankAccount),
      emp.avatar,
      JSON.stringify(emp)
    );
  }

  // 2. Seed Projects
  const insertProj = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, code, name, client, location, status, startDate,
      targetEndDate, allocatedBudget, actualLaborCost, projectedLaborCost,
      totalEstimatedHours, actualHoursSpent, hourlyRateMultiplier, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const proj of INITIAL_PROJECTS) {
    insertProj.run(
      proj.id,
      proj.code,
      proj.name,
      proj.client,
      proj.location,
      proj.status,
      proj.startDate,
      proj.targetEndDate,
      proj.allocatedBudget,
      proj.actualLaborCost,
      proj.projectedLaborCost,
      proj.totalEstimatedHours,
      proj.actualHoursSpent,
      proj.hourlyRateMultiplier,
      JSON.stringify(proj)
    );
  }

  // 3. Seed Attendances
  const insertAtt = db.prepare(`
    INSERT OR REPLACE INTO attendances (
      id, employeeId, employeeName, employeeNik, department,
      date, checkInTime, checkOutTime, mode, status,
      photoUrl, isLate, lateMinutes, lateReason,
      approvalStatus, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const att of INITIAL_ATTENDANCE) {
    insertAtt.run(
      att.id,
      att.employeeId,
      att.employeeName,
      att.employeeNik,
      att.department,
      att.date,
      att.checkInTime || null,
      att.checkOutTime || null,
      att.mode,
      att.status,
      att.photoUrl,
      att.isLate ? 1 : 0,
      att.lateMinutes,
      att.lateReason || null,
      att.approvalStatus,
      JSON.stringify(att)
    );
  }

  // 4. Seed Approvals
  const insertAppr = db.prepare(`
    INSERT OR REPLACE INTO approvals (
      id, type, employeeId, employeeName, employeeNik, department,
      title, description, startDate, endDate, daysCount, lateMinutes,
      status, submittedAt, reviewedBy, reviewedAt, reviewNote, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const appr of INITIAL_APPROVALS) {
    insertAppr.run(
      appr.id,
      appr.type,
      appr.employeeId,
      appr.employeeName,
      appr.employeeNik,
      appr.department,
      appr.title,
      appr.description,
      appr.startDate,
      appr.endDate || null,
      appr.daysCount || null,
      appr.lateMinutes || null,
      appr.status,
      appr.submittedAt,
      appr.reviewedBy || null,
      appr.reviewedAt || null,
      appr.reviewNote || null,
      JSON.stringify(appr)
    );
  }

  // 5. Seed Salary Rules
  const insertRules = db.prepare(`
    INSERT OR REPLACE INTO salary_rules (id, config_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `);
  insertRules.run('default', JSON.stringify(INITIAL_SALARY_RULES));

  // Log to audit trail
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `);
  insertLog.run(
    'INIT_DATABASE',
    'DATABASE',
    'hris.sqlite',
    'Initial database seeding executed successfully for PRIME HRIS Enterprise'
  );

  console.log('[SQLite] Seeding selesai! Database hris.sqlite siap digunakan.');
}

// ==========================================
// CRUD Query Functions
// ==========================================

export function getAllData() {
  const db = getDatabase();

  const employees: Employee[] = (db.prepare('SELECT data_json FROM employees ORDER BY name ASC;').all() as any[])
    .map(row => {
      const emp = JSON.parse(row.data_json);
      if (emp.biometric && emp.biometric.samples) {
        const { samples, ...cleanBiometric } = emp.biometric;
        emp.biometric = { ...cleanBiometric, hasSamples: true };
      }
      return emp;
    });

  const projects: Project[] = (db.prepare('SELECT data_json FROM projects ORDER BY code ASC;').all() as any[])
    .map(row => JSON.parse(row.data_json));

  const attendances: AttendanceRecord[] = (db.prepare('SELECT id, data_json FROM attendances ORDER BY date DESC, checkInTime DESC LIMIT 200;').all() as any[])
    .map(row => {
      const item = JSON.parse(row.data_json);
      if (item.photoUrl && item.photoUrl.startsWith('data:image')) {
        item.photoUrl = `/api/attendance/${item.id || row.id}/photo`;
      }
      return item;
    });

  const approvals: ApprovalItem[] = (db.prepare('SELECT id, data_json FROM approvals ORDER BY submittedAt DESC LIMIT 300;').all() as any[])
    .map(row => {
      const item = JSON.parse(row.data_json);
      if (item.proofAttachment && item.proofAttachment.startsWith('data:image')) {
        item.hasAttachment = true;
        delete item.proofAttachment;
      }
      return item;
    });

  const rulesRow = db.prepare('SELECT config_json FROM salary_rules WHERE id = ?;').get('default') as any;
  const salaryRules: SalaryRuleConfig = rulesRow ? JSON.parse(rulesRow.config_json) : INITIAL_SALARY_RULES;

  return {
    employees,
    projects,
    attendances,
    approvals,
    salaryRules,
    dbInfo: getDbInfo()
  };
}

export function getAttendancePhoto(id: string): string | null {
  const db = getDatabase();
  try {
    const row = db.prepare('SELECT data_json FROM attendances WHERE id = ?').get(id) as any;
    if (!row) return null;
    const item = JSON.parse(row.data_json);
    return item.photoUrl || null;
  } catch (e) {
    return null;
  }
}

export function saveAttendance(record: AttendanceRecord): { success: boolean; record: AttendanceRecord } {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO attendances (
      id, employeeId, employeeName, employeeNik, department,
      date, checkInTime, checkOutTime, mode, status,
      photoUrl, isLate, lateMinutes, lateReason,
      approvalStatus, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  insert.run(
    record.id,
    record.employeeId,
    record.employeeName,
    record.employeeNik,
    record.department,
    record.date,
    record.checkInTime || null,
    record.checkOutTime || null,
    record.mode,
    record.status,
    record.photoUrl,
    record.isLate ? 1 : 0,
    record.lateMinutes,
    record.lateReason || null,
    record.approvalStatus,
    JSON.stringify(record)
  );

  // If this attendance needs approval (Dinas Luar or Late), create approval item in SQLite
  if (record.approvalStatus === 'PENDING' && record.attendanceType !== 'CHECK_OUT') {
    const isDinasLuar = record.mode === 'DINAS_LUAR';
    const approvalId = `APPR-${record.id}`;
    const approvalItem: ApprovalItem = {
      id: approvalId,
      type: isDinasLuar ? 'DINAS_LUAR' : 'LATE_JUSTIFICATION',
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      employeeNik: record.employeeNik,
      department: record.department,
      title: isDinasLuar
        ? `Pengajuan Dinas Luar Mendadak: ${record.dinasLuarDetails?.clientName || 'Klien Luar'}`
        : `Justifikasi Keterlambatan (${record.lateMinutes} Menit)`,
      description: isDinasLuar
        ? `Tujuan: ${record.dinasLuarDetails?.destination} | Alasan: ${record.dinasLuarDetails?.purpose}`
        : `Alasan Keterlambatan: ${record.lateReason}`,
      startDate: record.date,
      lateMinutes: record.lateMinutes,
      attendanceRecordId: record.id,
      proofAttachment: record.photoUrl,
      status: 'PENDING',
      submittedAt: `${record.date} ${record.checkInTime}`
    };

    const insertAppr = db.prepare(`
      INSERT OR REPLACE INTO approvals (
        id, type, employeeId, employeeName, employeeNik, department,
        title, description, startDate, endDate, daysCount, lateMinutes,
        status, submittedAt, reviewedBy, reviewedAt, reviewNote, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);
    insertAppr.run(
      approvalItem.id,
      approvalItem.type,
      approvalItem.employeeId,
      approvalItem.employeeName,
      approvalItem.employeeNik,
      approvalItem.department,
      approvalItem.title,
      approvalItem.description,
      approvalItem.startDate,
      null,
      null,
      approvalItem.lateMinutes || null,
      approvalItem.status,
      approvalItem.submittedAt,
      null,
      null,
      null,
      JSON.stringify(approvalItem)
    );
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `).run('INSERT_ATTENDANCE', 'attendances', record.id, `Presensi ${record.employeeName} (${record.mode}) berhasil disimpan ke SQLite`);

  return { success: true, record };
}

export function updateApproval(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reviewNote?: string,
  reviewedBy: string = 'Direksi / HR Lead'
) {
  const db = getDatabase();
  const row = db.prepare('SELECT data_json FROM approvals WHERE id = ?;').get(id) as any;
  if (!row) {
    throw new Error(`Approval item with ID ${id} not found in SQLite database`);
  }

  const item: ApprovalItem = JSON.parse(row.data_json);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  item.status = status;
  item.reviewNote = reviewNote;
  item.reviewedBy = reviewedBy;
  item.reviewedAt = now;

  db.prepare(`
    UPDATE approvals
    SET status = ?, reviewedBy = ?, reviewedAt = ?, reviewNote = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `).run(status, reviewedBy, now, reviewNote || null, JSON.stringify(item), id);

  // If tied to attendance record, update that attendance record too
  if (item.attendanceRecordId) {
    const attRow = db.prepare('SELECT data_json FROM attendances WHERE id = ?;').get(item.attendanceRecordId) as any;
    if (attRow) {
      const attRecord: AttendanceRecord = JSON.parse(attRow.data_json);
      attRecord.approvalStatus = status;
      attRecord.approvedBy = reviewedBy;
      attRecord.approvalDate = now;
      attRecord.approvalNote = reviewNote;

      if (status === 'APPROVED' && attRecord.status === 'LATE') {
        attRecord.status = 'ON_TIME'; // forgiven
      }

      db.prepare(`
        UPDATE attendances
        SET approvalStatus = ?, status = ?, data_json = ?
        WHERE id = ?;
      `).run(status, attRecord.status, JSON.stringify(attRecord), item.attendanceRecordId);
    }
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `).run('UPDATE_APPROVAL', 'approvals', id, `Approval ${id} diubah ke status ${status} oleh ${reviewedBy}`);

  return { success: true, item };
}

export function saveEmployee(emp: Employee) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO employees (
      id, nik, name, email, phone, role, department, position,
      employmentType, joinDate, assignedProjectId, baseSalary,
      fixedAllowance, dailyAllowance, leaveQuota, usedLeave,
      bankAccount, avatar, data_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `);

  insert.run(
    emp.id,
    emp.nik,
    emp.name,
    emp.email,
    emp.phone,
    emp.role,
    emp.department,
    emp.position,
    emp.employmentType,
    emp.joinDate,
    emp.assignedProjectId,
    emp.baseSalary,
    emp.fixedAllowance,
    emp.dailyAllowance,
    emp.leaveQuota,
    emp.usedLeave,
    JSON.stringify(emp.bankAccount),
    emp.avatar,
    JSON.stringify(emp)
  );

  // Synchronize active/inactive status and system_role/role to user_accounts
  const userAccountStatus = emp.status === 'INACTIVE' ? 'inactive' : 'active';
  const targetSysRole = emp.id === 'EMP-001' ? 'superuser' : (emp.systemRole === 'admin' ? 'hr' : emp.systemRole || 'staff');
  const targetRole = emp.role || 'Employee';

  try {
    db.prepare(`
      UPDATE user_accounts 
      SET system_role = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE employee_id = ?;
    `).run(targetSysRole, targetRole, userAccountStatus, emp.id);
  } catch (err) {
    console.error('Error syncing user_accounts status & system_role for employee', emp.id, err);
  }

  db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `).run('SAVE_EMPLOYEE', 'employees', emp.id, `Karyawan ${emp.name} (${emp.nik}) disimpan ke SQLite`);

  return { success: true, employee: emp };
}

export function saveProject(proj: Project) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, code, name, client, location, status,
      startDate, targetEndDate, allocatedBudget, actualLaborCost,
      projectedLaborCost, totalEstimatedHours, actualHoursSpent,
      hourlyRateMultiplier, data_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `);

  insert.run(
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

  db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `).run('SAVE_PROJECT', 'projects', proj.id, `Data proyek [${proj.code}] ${proj.name} disimpan ke SQLite`);

  return { success: true, project: proj };
}

export function saveSalaryRules(rules: SalaryRuleConfig) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO salary_rules (id, config_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `).run('default', JSON.stringify(rules));

  db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details)
    VALUES (?, ?, ?, ?);
  `).run('SAVE_SALARY_RULES', 'salary_rules', 'default', 'Aturan gaji & IP Gateway diperbarui di SQLite');

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
  seedInitialData(db);
  return getAllData();
}

export interface AuditLogRecord {
  id: number;
  timestamp: string;
  userName: string;
  userNik?: string;
  userRole: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  metadata?: string;
}

export function seedRealisticAuditLogs(db: DatabaseSync) {
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
}

export function addAuditLog(entry: {
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
  timestamp?: string;
}) {
  const db = getDatabase();
  const pad = (n: number) => String(n).padStart(2, '0');
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
  status = ''
}: {
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
  role?: string;
  status?: string;
} = {}) {
  const db = getDatabase();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses: string[] = [];
  let params: any[] = [];

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
    whereClauses.push(`module = ?`);
    params.push(module);
  }

  if (role && role !== 'ALL') {
    whereClauses.push(`LOWER(userRole) = ?`);
    params.push(role.toLowerCase());
  }

  if (status && status !== 'ALL') {
    whereClauses.push(`status = ?`);
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereSql};`).get(...params) as any;
  const totalRows = countRow?.total || 0;
  const totalPages = Math.ceil(totalRows / safeLimit) || 1;

  const rows = db.prepare(`
    SELECT * FROM audit_logs
    ${whereSql}
    ORDER BY timestamp DESC, id DESC
    LIMIT ? OFFSET ?;
  `).all(...params, safeLimit, offset) as any[];

  return {
    logs: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalRows,
      totalPages,
      hasMore: safePage < totalPages
    }
  };
}
