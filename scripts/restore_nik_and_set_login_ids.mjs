import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';

const targetDbPath = process.argv[2] || 'data/hris.sqlite';
const seedJsonPath = 'data/seedData.json';

console.log(`[RESTORE NIK & SET LOGIN IDS] Starting on: ${targetDbPath}`);

if (!fs.existsSync(targetDbPath)) {
  console.error(`[ERROR] Database file not found: ${targetDbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(targetDbPath);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

// 1. Check Galih Primananda (EMP-001)
const galih = db.prepare('SELECT id, nik, name FROM employees WHERE id = ?;').get('EMP-001');
if (!galih) {
  console.error('[ERROR] EMP-001 (Galih Primananda) not found in database!');
  process.exit(1);
}
console.log(`[RESTORE] STRICT CHECK: EMP-001 (${galih.name}) found with NIK: ${galih.nik}. WILL REMAIN UNTOUCHED.`);

// 2. Fetch all other employees ordered naturally by numeric ID
const otherEmployees = db.prepare(`
  SELECT id, nik, name, email, role, data_json 
  FROM employees 
  WHERE id != 'EMP-001' 
  ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;
`).all();

console.log(`[RESTORE] Found ${otherEmployees.length} employees to restore official NIK & verify login ID...`);

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
let restoredCount = 0;
let userAccountsSynced = 0;

// Track emails to prevent duplicate email constraint failure
const usedEmails = new Set();
const existingUsers = db.prepare('SELECT id, employee_id, email FROM user_accounts;').all();
for (const u of existingUsers) {
  if (u.employee_id === 'EMP-001' || ['USR-001', 'USR-002', 'USR-003', 'USR-004', 'USR-005', 'USR-006'].includes(u.id)) {
    if (u.email) usedEmails.add(u.email.toLowerCase());
  }
}

for (let i = 0; i < otherEmployees.length; i++) {
  const emp = otherEmployees[i];
  const loginId = `d${String(i + 1).padStart(3, '0')}`; // e.g. d001, d002, ... d157

  // Parse data_json
  let d = {};
  try {
    d = JSON.parse(emp.data_json);
  } catch (e) {
    d = {};
  }

  // Retrieve original NIK (stored in d.ktpNumber, or if starts with D0.., keep ktpNumber)
  let officialNik = d.ktpNumber || emp.nik;
  if (officialNik.startsWith('D') && officialNik.length === 4 && d.ktpNumber && !d.ktpNumber.startsWith('D')) {
    officialNik = d.ktpNumber;
  }

  // Set official NIK in data_json and keep loginId in data_json for convenience
  d.nik = officialNik;
  d.loginId = loginId;
  const updatedJson = JSON.stringify(d);

  // 1. Restore official NIK in employees table
  updateEmpStmt.run(officialNik, updatedJson, emp.id);

  // 2. Update related tables with official NIK
  updateAttStmt.run(officialNik, emp.id);
  updateAppStmt.run(officialNik, emp.id);
  updateReimbStmt.run(officialNik, emp.id);

  restoredCount++;

  // 3. Ensure user account has username = loginId (d001, d002, etc.) and password = zzz
  const accountId = `USR-${emp.id}`;
  const candidateEmail = emp.email ? emp.email.trim().toLowerCase() : '';
  let emailToUse = '';
  if (candidateEmail && !usedEmails.has(candidateEmail)) {
    emailToUse = candidateEmail;
  } else {
    emailToUse = `${loginId}@primeprojectx.net`;
  }
  usedEmails.add(emailToUse.toLowerCase());

  const { hash, salt } = hashPassword(defaultPass);

  const existingAcc = db.prepare('SELECT id FROM user_accounts WHERE username = ? OR id = ?;').get(loginId, accountId);
  if (existingAcc) {
    db.prepare(`
      UPDATE user_accounts 
      SET employee_id = ?, email = ?, username = ?, password_hash = ?, salt = ?, role = ?, system_role = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `).run(emp.id, emailToUse, loginId, hash, salt, emp.role || 'Employee', d.systemRole || 'staff', existingAcc.id);
  } else {
    db.prepare(`
      INSERT INTO user_accounts (
        id, employee_id, email, username, password_hash, salt, role, system_role, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `).run(accountId, emp.id, emailToUse, loginId, hash, salt, emp.role || 'Employee', d.systemRole || 'staff');
  }

  userAccountsSynced++;
}

console.log(`[RESTORE SUCCESS] Restored ${restoredCount} employees to official NIKs from migration data.`);
console.log(`[RESTORE SUCCESS] Verified ${userAccountsSynced} user accounts with login ID format d001..d${String(otherEmployees.length).padStart(3, '0')} and default password 'zzz'.`);

// Double-check EMP-001 (Galih) is intact
const galihAfter = db.prepare('SELECT id, nik, name FROM employees WHERE id = ?;').get('EMP-001');
console.log(`[AUDIT] EMP-001 Check: id=${galihAfter.id}, nik=${galihAfter.nik}, name=${galihAfter.name}`);

// Sync seedData.json if exists
if (fs.existsSync(seedJsonPath)) {
  try {
    const seedContent = JSON.parse(fs.readFileSync(seedJsonPath, 'utf8'));
    const allEmpsInDb = db.prepare(`
      SELECT data_json FROM employees ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;
    `).all();
    
    seedContent.INITIAL_EMPLOYEES = allEmpsInDb.map(row => JSON.parse(row.data_json));
    fs.writeFileSync(seedJsonPath, JSON.stringify(seedContent, null, 2), 'utf8');
    console.log(`[SYNC] Successfully synced seedData.json with ${allEmpsInDb.length} employees.`);
  } catch (err) {
    console.warn(`[SYNC WARNING] Failed to sync seedData.json:`, err.message);
  }
}

console.log('[RESTORE & SYNC COMPLETED SUCCESSFULLY]');
