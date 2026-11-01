import { DatabaseSync } from 'node:sqlite';

const targetDb = process.argv[2] || 'data/hris.sqlite';
const db = new DatabaseSync(targetDb);

console.log(`[MIGRATE_APPROVALS] Running migration on ${targetDb}...`);

const empRows = db.prepare('SELECT id, name, assignedProjectId, data_json FROM employees;').all();
const empMap = new Map();
empRows.forEach(e => {
  let projId = e.assignedProjectId;
  try {
    const d = JSON.parse(e.data_json);
    if (!projId) projId = d.assignedProjectId;
  } catch (err) {}
  empMap.set(e.id, { id: e.id, name: e.name, assignedProjectId: projId });
});

const projRows = db.prepare('SELECT id, code, name, data_json FROM projects;').all();
const projMap = new Map();
projRows.forEach(p => {
  let pmId = null;
  let personnel = [];
  try {
    const d = JSON.parse(p.data_json);
    pmId = d.projectManagerId || null;
    personnel = d.assignedPersonnelIds || d.assignedEmployeeIds || [];
  } catch (err) {}

  let pmName = null;
  if (pmId && empMap.has(pmId)) {
    pmName = empMap.get(pmId).name;
  }

  const pData = {
    id: p.id,
    code: p.code,
    name: p.name,
    projectManagerId: pmId,
    projectManagerName: pmName,
    personnel
  };
  projMap.set(p.id, pData);
  projMap.set(p.code, pData);
});

function resolveProjectForEmp(empId) {
  const emp = empMap.get(empId);
  if (!emp) return null;

  if (emp.assignedProjectId && projMap.has(emp.assignedProjectId)) {
    return projMap.get(emp.assignedProjectId);
  }

  for (const [, p] of projMap.entries()) {
    if (Array.isArray(p.personnel) && p.personnel.includes(empId)) {
      return p;
    }
  }

  return null;
}

const approvals = db.prepare('SELECT id, type, employeeId, employeeName, status, data_json FROM approvals;').all();
console.log(`[MIGRATE_APPROVALS] Total approvals found: ${approvals.length}`);

let updatedCount = 0;
const updateStmt = db.prepare('UPDATE approvals SET data_json = ? WHERE id = ?;');

for (const a of approvals) {
  let item = {};
  try {
    item = JSON.parse(a.data_json);
  } catch (e) {
    continue;
  }

  const proj = resolveProjectForEmp(a.employeeId);
  const pmId = proj?.projectManagerId || item.projectManagerId || null;
  const pmName = proj?.projectManagerName || item.projectManagerName || null;
  const isEmpThePm = pmId && (pmId === a.employeeId || pmId === item.employeeId);
  const hasPm = Boolean(pmId && !isEmpThePm);

  if (proj) {
    item.projectId = proj.id;
    item.projectCode = proj.code;
    item.projectName = proj.name;
  }

  if (hasPm) {
    item.projectManagerId = pmId;
    item.projectManagerName = pmName;
    if (item.status === 'PENDING') {
      if (!item.pmApprovedBy) {
        item.targetApproverRole = 'PM';
        item.stage = 'PM';
      } else {
        item.targetApproverRole = 'HR';
        item.stage = 'HR';
      }
    } else {
      item.stage = 'FINAL';
      item.targetApproverRole = item.pmApprovedBy ? 'HR' : 'PM';
    }
  } else {
    item.targetApproverRole = 'HR';
    item.stage = item.status === 'PENDING' ? 'HR' : 'FINAL';
  }

  item.requiresHrApproval = true;

  updateStmt.run(JSON.stringify(item), a.id);
  updatedCount++;
}

console.log(`[MIGRATE_APPROVALS] Successfully updated ${updatedCount} approvals with 2-stage PM ➔ HR routing.`);
