import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const targetDb = process.argv[2] || 'data/hris.sqlite';
const db = new DatabaseSync(targetDb);

const rows = db.prepare("SELECT id, nik, name FROM employees WHERE name LIKE '%aaaa%' OR nik LIKE '%1793419723991%' OR id LIKE '%1793419723991%'").all();

console.log(`[DELETE_TEST_USER] Found ${rows.length} matching rows in ${targetDb}:`, rows);

for (const r of rows) {
  console.log(`Deleting employee ${r.name} (${r.id} / ${r.nik})...`);
  db.prepare('DELETE FROM employees WHERE id = ? OR nik = ?').run(r.id, r.nik);
  db.prepare('DELETE FROM user_accounts WHERE employee_id = ? OR id = ? OR username = ?').run(r.id, `USR-${r.id}`, r.nik);
  db.prepare('DELETE FROM wa_opt_ins WHERE employee_id = ?').run(r.id);
  console.log(`Deleted employee ${r.id} successfully.`);
}

console.log('[DELETE_TEST_USER] Completed cleanup.');

