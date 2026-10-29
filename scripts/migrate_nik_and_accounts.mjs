import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const targetDbPath = process.argv[2] || 'data/hris.sqlite';
const seedJsonPath = 'data/seedData.json';

console.log(`[MIGRATION] Starting NIK & User Account migration on: ${targetDbPath}`);

if (!fs.existsSync(targetDbPath)) {
  console.error(`[MIGRATION ERROR] Database file not found: ${targetDbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(targetDbPath);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

// 1. Verify Galih Primananda (EMP-001)
const galih = db.prepare('SELECT id, nik, name FROM employees WHERE id = ?;').get('EMP-001');
if (!galih) {
  console.error('[MIGRATION ERROR] EMP-001 (Galih Primananda) not found in database!');
  process.exit(1);
}
console.log(`[MIGRATION] STRICT CHECK: EMP-001 (${galih.name}) found with NIK: ${galih.nik}. WILL REMAIN UNTOUCHED.`);

// 2. Fetch all other employees ordered naturally by numeric ID
const otherEmployees = db.prepare(`
  SELECT id, nik, name, email, role, data_json 
  FROM employees 
  WHERE id != 'EMP-001' 
  ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;
`).all();

console.log(`[MIGRATION] Found ${otherEmployees.length} employees to update to 4-character NIK (D001..D${String(otherEmployees.length).padStart(3, '0')})...`);

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

// Pre-calculate hash for default password 'zzz'
const defaultPass = 'zzz';
const { hash: zzzHash, salt: zzzSalt } = hashPassword(defaultPass);

// Fetch existing user accounts
const existingUsers = db.prepare('SELECT id, employee_id, username, email FROM user_accounts;').all();
const usedEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
const usedUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));

console.log(`[MIGRATION] Existing user_accounts: ${existingUsers.length}. Presets & Galih accounts will be preserved.`);

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

let updatedEmployeesCount = 0;
let updatedAccountsCount = 0;

for (let i = 0; i < otherEmployees.length; i++) {
  const emp = otherEmployees[i];
  const newNik = `D${String(i + 1).padStart(3, '0')}`;
  const oldNik = emp.nik;

  // 1. Update data_json preserving old NIK in ktpNumber
  let d = {};
  try {
    d = JSON.parse(emp.data_json);
  } catch (e) {
    d = {};
  }
  if (!d.ktpNumber) {
    d.ktpNumber = oldNik;
  }
  d.nik = newNik;
  const updatedJson = JSON.stringify(d);

  // 2. Update employees table
  updateEmpStmt.run(newNik, updatedJson, emp.id);

  // 3. Update related transaction tables
  updateAttStmt.run(newNik, emp.id);
  updateAppStmt.run(newNik, emp.id);

  updatedEmployeesCount++;

  // 4. Create or update user account for this employee
  const username = newNik.toLowerCase(); // e.g. d001, d002
  const accountId = `USR-${emp.id}`;

  let emailToUse = '';
  const candidateEmail = emp.email ? emp.email.trim().toLowerCase() : '';
  
  // If candidate email is available and not already held by another account (or belongs to this account)
  const existingAccForEmp = existingUsers.find(u => u.employee_id === emp.id || u.id === accountId);
  if (candidateEmail && (!usedEmails.has(candidateEmail) || (existingAccForEmp && existingAccForEmp.email.toLowerCase() === candidateEmail))) {
    emailToUse = candidateEmail;
  } else {
    emailToUse = `${username}@primeprojectx.net`;
  }
  usedEmails.add(emailToUse.toLowerCase());

  // Generate individual salt and hash for each user account using default 'zzz'
  const { hash, salt } = hashPassword(defaultPass);

  upsertUserStmt.run(
    accountId,
    emp.id,
    emailToUse,
    username,
    hash,
    salt,
    emp.role || 'Employee',
    d.systemRole || 'staff'
  );

  updatedAccountsCount++;
}

console.log(`[MIGRATION SUCCESS] Updated ${updatedEmployeesCount} employees to NIK format D001..D${String(otherEmployees.length).padStart(3, '0')}.`);
console.log(`[MIGRATION SUCCESS] Created/Updated ${updatedAccountsCount} user accounts with default password 'zzz'.`);

// 3. Double-check EMP-001 (Galih) is intact
const galihAfter = db.prepare('SELECT id, nik, name FROM employees WHERE id = ?;').get('EMP-001');
console.log(`[MIGRATION AUDIT] EMP-001 Verify: id=${galihAfter.id}, nik=${galihAfter.nik}, name=${galihAfter.name}`);

// 4. Sync seedData.json if it exists
if (fs.existsSync(seedJsonPath)) {
  try {
    const seedContent = JSON.parse(fs.readFileSync(seedJsonPath, 'utf8'));
    const allEmpsInDb = db.prepare(`
      SELECT data_json FROM employees ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;
    `).all();
    
    seedContent.INITIAL_EMPLOYEES = allEmpsInDb.map(row => JSON.parse(row.data_json));
    fs.writeFileSync(seedJsonPath, JSON.stringify(seedContent, null, 2), 'utf8');
    console.log(`[MIGRATION] Successfully updated ${seedJsonPath} with all ${allEmpsInDb.length} employees.`);
  } catch (err) {
    console.warn(`[MIGRATION WARNING] Failed to sync seedData.json:`, err.message);
  }
}

console.log('[MIGRATION COMPLETED SUCCESSFULLY]');
