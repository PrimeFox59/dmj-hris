import { getDatabase } from '../server/db.js';

const db = getDatabase();
const recs = db.prepare("SELECT id, employeeId, date, checkInTime, checkOutTime, status, isLate, lateMinutes, lateReason FROM attendances WHERE employeeId IN ('EMP-160', 'EMP-025');").all();
console.table(recs);

const apprs = db.prepare("SELECT id, type, employeeId, title, status FROM approvals WHERE employeeId IN ('EMP-160', 'EMP-025');").all();
console.table(apprs);
