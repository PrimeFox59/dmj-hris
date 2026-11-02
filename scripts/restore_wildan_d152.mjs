import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.argv[2] || path.join(process.cwd(), 'data', 'hris.sqlite');
const backupPath = `${dbPath}.bak_pre_restore_wildan_d152_${Date.now()}`;

console.log(`[RESTORE WILDAN D152] Target Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`[ERROR] Database not found at ${dbPath}`);
  process.exit(1);
}

// 1. Create safety backup
fs.copyFileSync(dbPath, backupPath);
console.log(`[BACKUP] Safety copy created at: ${backupPath}`);

const db = new DatabaseSync(dbPath);

// 2. Execute Transaction
db.exec('BEGIN TRANSACTION;');
try {
  // Update user_accounts
  const userStmt = db.prepare(`
    UPDATE user_accounts 
    SET username = 'd152', updated_at = CURRENT_TIMESTAMP 
    WHERE id = 'USR-EMP-161' AND employee_id = 'EMP-161';
  `);
  const userResult = userStmt.run();
  console.log(`[UPDATED] user_accounts modified: ${userResult.changes} row(s)`);

  // Update employees data_json
  const empRow = db.prepare("SELECT data_json FROM employees WHERE id = 'EMP-161';").get();
  if (empRow) {
    const d = JSON.parse(empRow.data_json);
    d.loginId = 'd152';
    const empStmt = db.prepare("UPDATE employees SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'EMP-161';");
    empStmt.run(JSON.stringify(d));
    console.log("[UPDATED] employees.data_json updated with loginId: 'd152'");
  }

  // Record audit log
  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, details, timestamp, userName, userNik, userRole, module, ipAddress, status)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?, ?, ?);
  `);
  auditStmt.run(
    'ACCOUNT_ID_RESTORED',
    'user_accounts',
    'USR-EMP-161',
    "Perbaikan ID login akun WILDAN RAMDANI AHMAD dari 'iqlima' dikembalikan ke kredensial standar 'd152'.",
    'Mr Prime (System Administrator)',
    'SUPERUSER',
    'superuser',
    'AUTH',
    '127.0.0.1',
    'SUCCESS'
  );
  console.log('[AUDIT] Audit log entry created.');

  db.exec('COMMIT;');
  console.log('[SUCCESS] Database transaction committed successfully.');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('[ERROR] Transaction failed, rolled back:', err);
  process.exit(1);
}

// 3. Post-execution Verifications
const verifiedUser = db.prepare("SELECT id, employee_id, username, email FROM user_accounts WHERE id = 'USR-EMP-161';").get();
console.log('[VERIFIED USER]:', verifiedUser);

const verifiedEmp = db.prepare("SELECT id, name, data_json FROM employees WHERE id = 'EMP-161';").get();
const empData = JSON.parse(verifiedEmp.data_json);
console.log('[VERIFIED EMP]:', { id: verifiedEmp.id, name: verifiedEmp.name, loginId: empData.loginId });

const integrity = db.prepare('PRAGMA integrity_check;').all();
console.log('[INTEGRITY CHECK]:', integrity);
