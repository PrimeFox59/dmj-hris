import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';

const targetDbPath = process.argv[2] || 'data/hris.sqlite';
const seedJsonPath = 'data/seedData.json';

console.log(`[PURGE DUMMY & REINDEX] Starting on: ${targetDbPath}`);

if (!fs.existsSync(targetDbPath)) {
  console.error(`[ERROR] Database file not found: ${targetDbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(targetDbPath);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

// 1. Strict Check: Galih Primananda (EMP-001) MUST REMAIN UNTOUCHED
const galih = db.prepare('SELECT id, nik, name FROM employees WHERE id = ?;').get('EMP-001');
if (!galih) {
  console.error('[ERROR] EMP-001 (Galih Primananda) not found in database!');
  process.exit(1);
}
console.log(`[AUDIT] EMP-001 (Galih Primananda) verified intact with NIK: ${galih.nik}. WILL REMAIN UNTOUCHED.`);

// 2. Identify Dummy IDs to Purge
const dummyIds = ['EMP-002', 'EMP-003', 'EMP-004', 'EMP-005', 'EMP-006'];
const dummyUserIds = ['USR-003', 'USR-004', 'USR-005', 'USR-006'];

console.log('[PURGE] Deleting dummy records across all tables...');

// Delete dummy attendances, approvals, reimbursements
for (const id of dummyIds) {
  db.prepare('DELETE FROM attendances WHERE employeeId = ?;').run(id);
  db.prepare('DELETE FROM approvals WHERE employeeId = ?;').run(id);
  db.prepare('DELETE FROM reimbursements WHERE employeeId = ?;').run(id);
  db.prepare('DELETE FROM employees WHERE id = ?;').run(id);
  db.prepare('DELETE FROM user_accounts WHERE employee_id = ?;').run(id);
}

for (const uid of dummyUserIds) {
  db.prepare('DELETE FROM user_accounts WHERE id = ?;').run(uid);
}

// Clean all non-Galih user accounts so there are zero orphan or conflicting email records
db.prepare("DELETE FROM user_accounts WHERE username = 'galih' OR id = 'USR-002';").run();
db.prepare("DELETE FROM user_accounts WHERE employee_id != 'EMP-001' AND id NOT IN ('USR-001');").run();

console.log('[PURGE] Successfully removed dummy employees and refreshed user accounts.');

// 3. Fetch all remaining real employees (excluding EMP-001)
const realEmployees = db.prepare(`
  SELECT id, nik, name, email, role, data_json 
  FROM employees 
  WHERE id != 'EMP-001' 
  ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;
`).all();

console.log(`[REINDEX] Found ${realEmployees.length} real employees to assign login IDs d001..d${String(realEmployees.length).padStart(3, '0')}...`);

const updateEmpStmt = db.prepare(`
  UPDATE employees 
  SET nik = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?;
`);

const updateAttStmt = db.prepare(`
  UPDATE attendances 
  SET employeeNik = ? 
  WHERE employeeId = ?;
`);

const updateAppStmt = db.prepare(`
  UPDATE approvals 
  SET employeeNik = ? 
  WHERE employeeId = ?;
`);

const updateReimbStmt = db.prepare(`
  UPDATE reimbursements 
  SET employeeNik = ? 
  WHERE employeeId = ?;
`);

const upsertUserStmt = db.prepare(`
  INSERT INTO user_accounts (
    id, employee_id, email, username, password_hash, salt, role, system_role, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET
    employee_id = excluded.employee_id,
    email = excluded.email,
    username = excluded.username,
    password_hash = excluded.password_hash,
    salt = excluded.salt,
    role = excluded.role,
    system_role = excluded.system_role,
    status = 'active',
    updated_at = CURRENT_TIMESTAMP;
`);

const defaultPass = 'zzz';
const usedEmails = new Set();

// Reserve Galih's emails
usedEmails.add('admin@primeprojectx.net');
usedEmails.add('galih@primeprojectx.net');
usedEmails.add('galih@dwimarthajaya.co.id');

for (let i = 0; i < realEmployees.length; i++) {
  const emp = realEmployees[i];
  const loginId = `d${String(i + 1).padStart(3, '0')}`; // d001, d002, ... d154

  let d = {};
  try {
    d = JSON.parse(emp.data_json);
  } catch (e) {
    d = {};
  }

  // Restore official NIK from ktpNumber if present, or keep existing official NIK
  let officialNik = d.ktpNumber || emp.nik;
  if (officialNik.startsWith('D') && officialNik.length === 4 && d.ktpNumber && !d.ktpNumber.startsWith('D')) {
    officialNik = d.ktpNumber;
  }

  d.nik = officialNik;
  d.loginId = loginId;
  const updatedJson = JSON.stringify(d);

  // Update employee record
  updateEmpStmt.run(officialNik, updatedJson, emp.id);
  updateAttStmt.run(officialNik, emp.id);
  updateAppStmt.run(officialNik, emp.id);
  updateReimbStmt.run(officialNik, emp.id);

  // User account setup
  const accountId = `USR-${emp.id}`;
  let emailToUse = emp.email || d.email;
  if (!emailToUse || usedEmails.has(emailToUse.toLowerCase())) {
    emailToUse = `${loginId}@primeprojectx.net`;
  }
  usedEmails.add(emailToUse.toLowerCase());

  const { hash, salt } = hashPassword(defaultPass);
  upsertUserStmt.run(
    accountId,
    emp.id,
    emailToUse,
    loginId,
    hash,
    salt,
    emp.role || 'Employee',
    d.systemRole || 'staff'
  );
}

console.log(`[SUCCESS] Re-indexed all ${realEmployees.length} real employees to login IDs d001..d${String(realEmployees.length).padStart(3, '0')}.`);

// 4. Clean up any orphaned user accounts
const allEmpIds = new Set(db.prepare('SELECT id FROM employees;').all().map(r => r.id));
const allUsers = db.prepare('SELECT id, employee_id, username FROM user_accounts;').all();
for (const u of allUsers) {
  if (u.employee_id && !allEmpIds.has(u.employee_id)) {
    db.prepare('DELETE FROM user_accounts WHERE id = ?;').run(u.id);
    console.log(`[CLEANUP] Deleted orphaned user account: ${u.username} (${u.id})`);
  }
}

// 5. Verify Final Count
const finalEmpCount = db.prepare('SELECT count(*) as c FROM employees;').get().c;
const finalUserCount = db.prepare('SELECT count(*) as c FROM user_accounts;').get().c;
console.log(`[VERIFY] Final Active Employees: ${finalEmpCount} (Galih + ${finalEmpCount - 1} real employees)`);
console.log(`[VERIFY] Final User Accounts: ${finalUserCount}`);

// 6. Sync seedData.json if exists
if (fs.existsSync(seedJsonPath)) {
  try {
    const seed = JSON.parse(fs.readFileSync(seedJsonPath, 'utf8'));
    const allEmpsInDb = db.prepare('SELECT data_json FROM employees ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;').all();
    seed.INITIAL_EMPLOYEES = allEmpsInDb.map(e => JSON.parse(e.data_json));
    
    // Filter out dummy attendances/approvals in seed
    if (seed.INITIAL_ATTENDANCE) {
      seed.INITIAL_ATTENDANCE = seed.INITIAL_ATTENDANCE.filter(a => !dummyIds.includes(a.employeeId));
    }
    if (seed.INITIAL_APPROVALS) {
      seed.INITIAL_APPROVALS = seed.INITIAL_APPROVALS.filter(a => !dummyIds.includes(a.employeeId));
    }
    if (seed.INITIAL_REIMBURSEMENTS) {
      seed.INITIAL_REIMBURSEMENTS = seed.INITIAL_REIMBURSEMENTS.filter(r => !dummyIds.includes(r.employeeId));
    }

    fs.writeFileSync(seedJsonPath, JSON.stringify(seed, null, 2), 'utf8');
    console.log(`[SYNC] seedData.json synced successfully with ${seed.INITIAL_EMPLOYEES.length} employees.`);
  } catch (err) {
    console.warn(`[SYNC WARNING] Failed to sync seedData.json:`, err.message);
  }
}

console.log('[PURGE DUMMY & REINDEX COMPLETED SUCCESSFULLY]');
