import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.argv[2] || path.join(process.cwd(), 'data', 'hris.sqlite');
console.log(`[SYNC ROLES] Target Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

function determineSystemRole(emp) {
  if (!emp) return 'staff';
  const pos = (emp.position || '').toUpperCase();
  const dept = (emp.department || '').toUpperCase();
  const roleStr = String(emp.role || '').toUpperCase();
  const idStr = String(emp.id || '');

  // 1. Superuser
  if (roleStr === 'DIRECTOR' || pos.includes('DIREKSI') || pos.includes('TECHNICAL DIRECTOR') || idStr === 'EMP-001') {
    return 'superuser';
  }

  // 2. HR / HRD
  if (roleStr === 'HR_MANAGER' || pos.includes('HR') || pos.includes('HRD') || dept.includes('HR') || dept.includes('HRD')) {
    return 'hr';
  }

  // 3. Finance
  if (
    roleStr === 'FINANCE' || pos.includes('FINANCE') || pos.includes('ACCOUNTING') || 
    pos.includes('PAJAK') || pos.includes('TAX') || pos.includes('FAT') ||
    dept.includes('FINANCE') || dept.includes('ACCOUNTING') || dept.includes('FAT')
  ) {
    return 'finance';
  }

  return 'staff';
}

const employees = db.prepare('SELECT id, data_json FROM employees;').all();
let updatedEmpCount = 0;
let updatedUserCount = 0;

const updateEmpStmt = db.prepare('UPDATE employees SET data_json = ? WHERE id = ?;');
const updateUserStmt = db.prepare('UPDATE user_accounts SET system_role = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?;');

for (const empRow of employees) {
  try {
    const data = JSON.parse(empRow.data_json);
    const targetRole = determineSystemRole(data);

    if (data.systemRole !== targetRole) {
      data.systemRole = targetRole;
      updateEmpStmt.run(JSON.stringify(data), empRow.id);
      updatedEmpCount++;
    }

    if (empRow.id !== 'EMP-001') {
      const res = updateUserStmt.run(targetRole, empRow.id);
      if (res.changes > 0) updatedUserCount++;
    }
  } catch (err) {
    console.warn(`Failed updating ${empRow.id}:`, err.message);
  }
}

// Special case: Ensure EMP-001 accounts (admin and galih) remain superuser
db.prepare("UPDATE user_accounts SET system_role = 'superuser' WHERE employee_id = 'EMP-001' OR username IN ('admin', 'galih');").run();

console.log(`[SYNC ROLES SUCCESS] Updated ${updatedEmpCount} employees and ${updatedUserCount} user accounts.`);

// Verification summary
const roleCounts = db.prepare('SELECT system_role, count(*) as count FROM user_accounts GROUP BY system_role;').all();
console.log('[SYNC ROLES VERIFIED ROLES DISTRIBUTION]:', roleCounts);
