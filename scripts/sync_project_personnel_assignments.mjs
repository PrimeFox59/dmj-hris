import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const targetDbPath = process.argv[2] || 'data/hris.sqlite';
console.log(`[SYNC PERSONNEL] Target DB: ${targetDbPath}`);

if (!fs.existsSync(targetDbPath)) {
  console.error(`[ERROR] DB not found: ${targetDbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(targetDbPath);

// 1. Get all projects
const projects = db.prepare('SELECT id, code, name, data_json FROM projects;').all();
console.log(`[SYNC PERSONNEL] Found ${projects.length} projects.`);

const empProjectMap = new Map(); // empId -> projectId

for (const p of projects) {
  let d = {};
  try { d = JSON.parse(p.data_json); } catch (e) {}
  const list = d.assignedEmployeeIds || [];
  for (const empId of list) {
    if (!empProjectMap.has(empId)) {
      empProjectMap.set(empId, p.id);
    }
  }
}

console.log(`[SYNC PERSONNEL] Mapped ${empProjectMap.size} employees from project assignedEmployeeIds.`);

// 2. Fetch all employees
const employees = db.prepare('SELECT id, nik, name, assignedProjectId, data_json FROM employees;').all();
console.log(`[SYNC PERSONNEL] Total employees in DB: ${employees.length}`);

const updateStmt = db.prepare(`
  UPDATE employees
  SET assignedProjectId = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?;
`);

let updatedCount = 0;
const defaultProjId = 'PRJ-001';

for (const emp of employees) {
  let targetProjId = empProjectMap.get(emp.id) || defaultProjId;

  let d = {};
  try { d = JSON.parse(emp.data_json); } catch (e) {}

  const currentColProj = emp.assignedProjectId;
  const currentJsonProj = d.assignedProjectId;

  if (currentColProj !== targetProjId || currentJsonProj !== targetProjId) {
    d.assignedProjectId = targetProjId;
    const newJson = JSON.stringify(d);
    updateStmt.run(targetProjId, newJson, emp.id);
    updatedCount++;
  }
}

console.log(`[SYNC PERSONNEL] Updated ${updatedCount} employees to their exact project IDs.`);

// Verify distribution
const verifiedEmps = db.prepare('SELECT id, assignedProjectId, data_json FROM employees;').all();
const distMap = {};
for (const e of verifiedEmps) {
  const p = e.assignedProjectId;
  distMap[p] = (distMap[p] || 0) + 1;
}
console.log('[SYNC PERSONNEL] Verified distribution per project (top 10):', Object.entries(distMap).slice(0, 10));
console.log(`[SYNC PERSONNEL] Total employees verified: ${verifiedEmps.length}`);
