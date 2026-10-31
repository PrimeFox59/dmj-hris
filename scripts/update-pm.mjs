import { getDatabase } from '../server/db.js';

const db = getDatabase();

const emp = db.prepare('SELECT id, data_json FROM employees WHERE name LIKE ?').get('%WAHYUNING%');
if (emp) {
  const d = JSON.parse(emp.data_json);
  d.role = 'Project_Manager';
  db.prepare('UPDATE employees SET role = ?, data_json = ? WHERE id = ?').run('Project_Manager', JSON.stringify(d), emp.id);
  console.log('Successfully updated Wahyuning Wulandari (EMP-160) role to Project_Manager');
} else {
  console.log('Employee Wahyuning not found');
}

const prj = db.prepare('SELECT id, data_json FROM projects WHERE code = ?').get('PRJ-001');
if (prj) {
  const pd = JSON.parse(prj.data_json);
  pd.projectManagerId = 'EMP-160';
  pd.projectManagerName = 'WAHYUNING WULANDARI';
  db.prepare('UPDATE projects SET data_json = ? WHERE id = ?').run(JSON.stringify(pd), prj.id);
  console.log('Successfully updated PRJ-001 PM assignment to EMP-160 / WAHYUNING WULANDARI');
} else {
  console.log('Project PRJ-001 not found');
}

const checkEmp = db.prepare('SELECT id, name, role FROM employees WHERE name LIKE ?').get('%WAHYUNING%');
console.log('Current DB State for Wahyuning:', checkEmp);

const checkPrj = db.prepare('SELECT code, name, data_json FROM projects WHERE code = ?').get('PRJ-001');
const pData = JSON.parse(checkPrj.data_json);
console.log('Current DB State for PRJ-001 PM:', { pmId: pData.projectManagerId, pmName: pData.projectManagerName });
