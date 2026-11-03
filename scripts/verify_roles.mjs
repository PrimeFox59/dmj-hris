import { DatabaseSync } from 'node:sqlite';

const dbPath = process.argv[2] || 'data/hris.sqlite';
const db = new DatabaseSync(dbPath);

const users = db.prepare("SELECT employee_id, username, system_role, role, status FROM user_accounts WHERE employee_id IN ('EMP-037', 'EMP-160');").all();
console.log('USER ACCOUNTS:', users);

const emps = db.prepare("SELECT id, name, role, data_json FROM employees WHERE id IN ('EMP-037', 'EMP-160');").all();
for (const e of emps) {
  const d = JSON.parse(e.data_json);
  console.log(`EMP: ${e.id} | ${e.name} | colRole: ${e.role} | jsonSysRole: ${d.systemRole} | jsonRole: ${d.role}`);
}
