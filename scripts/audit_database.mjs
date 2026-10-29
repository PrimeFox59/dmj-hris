import { getDatabase } from '../server/db.js';

const db = getDatabase();

console.log('=== DATABASE INTEGRITY AUDIT ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
console.log('Tables in hris.sqlite:', tables.map(t => t.name));

const integrity = db.prepare('PRAGMA integrity_check;').all();
console.log('SQLite Integrity Check:', integrity);

const attendances = db.prepare('SELECT id, employeeName, date, data_json FROM attendances').all();
console.log(`Total Attendance Records: ${attendances.length}`);
attendances.forEach(att => {
  try {
    const data = JSON.parse(att.data_json);
    if (!data.location || data.location.distanceMeters === null || data.location.distanceMeters === undefined || isNaN(data.location.distanceMeters)) {
      console.log(`[ATTENDANCE NULL DISTANCE] ID: ${att.id}, Name: ${att.employeeName}, Date: ${att.date}`);
    }
  } catch(e) {}
});

const approvals = db.prepare('SELECT id, type, employeeName, startDate, endDate, daysCount FROM approvals').all();
console.log(`Total Approvals: ${approvals.length}`);

const employees = db.prepare('SELECT id, name, nik, role FROM employees').all();
console.log(`Total Employees: ${employees.length}`);

const projects = db.prepare('SELECT id, name, code FROM projects').all();
console.log(`Total Projects: ${projects.length}`);

console.log('=== AUDIT COMPLETE ===');
