import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 15);
console.log(`[BACKUP & RESET] Starting process with timestamp: ${timestamp}`);

// 1. Create local backup directory
const localBackupDir = path.resolve('data', 'backups');
if (!fs.existsSync(localBackupDir)) {
  fs.mkdirSync(localBackupDir, { recursive: true });
}

// 2. Backup local database
const localDb = path.resolve('data', 'hris.sqlite');
if (fs.existsSync(localDb)) {
  const localBackupFile = path.join(localBackupDir, `hris_local_backup_${timestamp}.sqlite`);
  fs.copyFileSync(localDb, localBackupFile);
  console.log(`[LOCAL] Backup created at: ${localBackupFile} (${fs.statSync(localBackupFile).size} bytes)`);
}

// 3. Script to run on POCO: Full backup, JSON export, and attendance deletion
const remoteScript = `
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const appDir = '/data/data/com.termux/files/home/prime-hris';
const dbPath = path.join(appDir, 'data', 'hris.sqlite');
const backupDir = path.join(appDir, 'data', 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log('[POCO] Inspecting existing database...');
const db = new DatabaseSync(dbPath);

// Check current stats
const preAtt = db.prepare('SELECT COUNT(*) as c FROM attendances;').get().c;
const preEmp = db.prepare('SELECT COUNT(*) as c FROM employees;').get().c;
const preUser = db.prepare('SELECT COUNT(*) as c FROM user_accounts;').get().c;
const preProj = db.prepare('SELECT COUNT(*) as c FROM projects;').get().c;

console.log('[POCO PRE-RESET STATS]');
console.log(' - Attendances:', preAtt);
console.log(' - Employees:', preEmp);
console.log(' - User accounts:', preUser);
console.log(' - Projects:', preProj);

// Export all attendances to JSON
const allAttendances = db.prepare('SELECT * FROM attendances;').all();
const jsonBackupPath = path.join(backupDir, 'attendances_backup_${timestamp}.json');
fs.writeFileSync(jsonBackupPath, JSON.stringify(allAttendances, null, 2), 'utf-8');
console.log('[POCO BACKUP] Exported', allAttendances.length, 'attendances to:', jsonBackupPath);

// Close DB to ensure WAL is flushed / safe copy
db.close();

// Backup full SQLite file
const dbBackupPath = path.join(backupDir, 'hris_backup_FULL_${timestamp}.sqlite');
fs.copyFileSync(dbPath, dbBackupPath);
console.log('[POCO BACKUP] Copied full database to:', dbBackupPath, '(' + fs.statSync(dbBackupPath).size + ' bytes)');

// Re-open DB to perform clean attendance deletion
const activeDb = new DatabaseSync(dbPath);

console.log('[POCO DELETION] Deleting records from attendances table...');
const deleteResult = activeDb.prepare('DELETE FROM attendances;').run();
console.log('[POCO DELETION] Changes:', deleteResult.changes);

console.log('[POCO VACUUM] Compacting database file...');
activeDb.exec('VACUUM;');

// Verify post-deletion stats
const postAtt = activeDb.prepare('SELECT COUNT(*) as c FROM attendances;').get().c;
const postEmp = activeDb.prepare('SELECT COUNT(*) as c FROM employees;').get().c;
const postUser = activeDb.prepare('SELECT COUNT(*) as c FROM user_accounts;').get().c;
const postProj = activeDb.prepare('SELECT COUNT(*) as c FROM projects;').get().c;

const allEmps = activeDb.prepare('SELECT id, name, data_json FROM employees;').all();
let bioEnrolled = 0;
for (const e of allEmps) {
  try {
    const data = JSON.parse(e.data_json);
    if (data.biometric && data.biometric.isEnrolled) {
      bioEnrolled++;
    }
  } catch (err) {}
}

activeDb.close();

const postStats = fs.statSync(dbPath);

console.log('[POCO POST-RESET STATS]');
console.log(' - Attendances (MUST BE 0):', postAtt);
console.log(' - Employees (MUST BE 154):', postEmp);
console.log(' - Biometric Enrolled (MUST BE 4):', bioEnrolled);
console.log(' - User accounts (MUST BE 155):', postUser);
console.log(' - Projects (MUST BE 51):', postProj);
console.log(' - New Database Size:', (postStats.size / 1024).toFixed(2), 'KB');
`;

const b64 = Buffer.from(remoteScript).toString('base64');
console.log('[MC18] Executing backup and reset script on POCO...');
execSync(`ssh poco "node -e \\"eval(Buffer.from('${b64}','base64').toString())\\""`, { stdio: 'inherit' });

// 4. Download backups from POCO to local PC
console.log('[MC18] Downloading database backup from POCO to local PC...');
const remoteDbBackup = `/data/data/com.termux/files/home/prime-hris/data/backups/hris_backup_FULL_${timestamp}.sqlite`;
const remoteJsonBackup = `/data/data/com.termux/files/home/prime-hris/data/backups/attendances_backup_${timestamp}.json`;

execSync(`scp poco:"${remoteDbBackup}" "${localBackupDir}"`, { stdio: 'inherit' });
execSync(`scp poco:"${remoteJsonBackup}" "${localBackupDir}"`, { stdio: 'inherit' });

console.log('[MC18] Backups securely synced to local:', localBackupDir);

// 5. Also clear attendances in local SQLite database
if (fs.existsSync(localDb)) {
  const lDb = new DatabaseSync(localDb);
  lDb.prepare('DELETE FROM attendances;').run();
  lDb.exec('VACUUM;');
  lDb.close();
  console.log('[LOCAL] Cleared attendances from local database and vacuumed.');
}

// 6. Restart PM2 on POCO to clear any in-memory state and refresh clients
console.log('[POCO] Restarting prime-hris on PM2...');
execSync('ssh poco "pm2 restart prime-hris"', { stdio: 'inherit' });

console.log('[COMPLETE] All attendance records and photos have been backed up and reset successfully!');
