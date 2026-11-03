import { getDatabase, getEmployeeProjectSchedule } from '../server/db.js';

const db = getDatabase();

console.log('--- RE-EVALUATING HISTORICAL ATTENDANCES FOR STRICT LATE POLICY ---');

const atts = db.prepare(`
  SELECT id, employeeId, employeeName, checkInTime, date, status, isLate, lateMinutes, approvalStatus, data_json
  FROM attendances
  WHERE checkInTime IS NOT NULL AND checkInTime != ''
`).all();

let fixedCount = 0;

for (const att of atts) {
  const sched = getEmployeeProjectSchedule(att.employeeId);
  const [inH, inM] = att.checkInTime.split(':').map(Number);
  const [cutH, cutM] = sched.cutoffTime.split(':').map(Number);

  const inMins = inH * 60 + inM;
  const cutMins = cutH * 60 + cutM;

  if (inMins > cutMins) {
    const calculatedLateMinutes = inMins - cutMins;
    const shouldUpdate = att.status !== 'LATE' || att.isLate !== 1 || (att.lateMinutes !== calculatedLateMinutes && att.lateMinutes <= 0);

    if (shouldUpdate) {
      let d = {};
      try { d = JSON.parse(att.data_json); } catch (e) {}

      d.status = 'LATE';
      d.isLate = true;
      d.lateMinutes = Math.max(d.lateMinutes || 0, calculatedLateMinutes);

      db.prepare(`
        UPDATE attendances
        SET status = 'LATE', isLate = 1, lateMinutes = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
      `).run(d.lateMinutes, JSON.stringify(d), att.id);

      fixedCount++;
      console.log(`[FIXED] ${att.employeeName} (${att.checkInTime} > ${sched.cutoffTime}) -> LATE (${d.lateMinutes}m), approvalStatus: ${att.approvalStatus}`);
    }
  }
}

console.log(`--- FINISHED: Re-evaluated and updated ${fixedCount} attendances to strict LATE status. ---`);
