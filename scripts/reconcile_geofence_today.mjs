import { getDatabase } from '../server/db.js';

const db = getDatabase();

console.log('=== RECONCILING TODAY GEOFENCE ATTENDANCES (2026-11-04) ===');

// 1. Ika Octavia (EMP-011) - Check-in 08:12:30 (Distance 9m to HQ, On Time)
const ikaRow = db.prepare('SELECT data_json FROM attendances WHERE id = ?').get('ATT-1793754750636');
if (ikaRow) {
  const d = JSON.parse(ikaRow.data_json);
  d.status = 'ON_TIME';
  d.approvalStatus = 'NOT_REQUIRED';
  d.note = 'Presensi Masuk (Dalam Area Kerja)';
  delete d.outOfRangeReason;
  if (d.location) {
    d.location.inGeofence = true;
    d.location.distanceMeters = 9;
  }
  db.prepare(`
    UPDATE attendances
    SET status = 'ON_TIME', approvalStatus = 'NOT_REQUIRED', data_json = ?
    WHERE id = ?
  `).run(JSON.stringify(d), 'ATT-1793754750636');
  console.log('[OK] Reconciled Ika Octavia: ON_TIME, Dalam Area Kerja (9m), NOT_REQUIRED');
}

// 2. Wildan Ramdani Ahmad (EMP-161) - Check-in 07:33:34 (Distance 9m to HQ, On Time)
const wildanRow = db.prepare('SELECT data_json FROM attendances WHERE id = ?').get('ATT-1793752414824');
if (wildanRow) {
  const d = JSON.parse(wildanRow.data_json);
  d.status = 'ON_TIME';
  d.approvalStatus = 'NOT_REQUIRED';
  d.note = 'Presensi Masuk (Dalam Area Kerja)';
  delete d.outOfRangeReason;
  if (d.location) {
    d.location.inGeofence = true;
    d.location.distanceMeters = 9;
  }
  db.prepare(`
    UPDATE attendances
    SET status = 'ON_TIME', approvalStatus = 'NOT_REQUIRED', data_json = ?
    WHERE id = ?
  `).run(JSON.stringify(d), 'ATT-1793752414824');
  console.log('[OK] Reconciled Wildan Ramdani Ahmad: ON_TIME, Dalam Area Kerja (9m), NOT_REQUIRED');
}

// 3. Andri Herdiyana (EMP-087) - Check-in 08:48:34 (Distance 2m to HQ, Late 33m)
const andriRow = db.prepare('SELECT data_json FROM attendances WHERE id = ?').get('ATT-1793756914396');
if (andriRow) {
  const d = JSON.parse(andriRow.data_json);
  d.status = 'LATE';
  d.isLate = true;
  d.lateMinutes = 33;
  d.approvalStatus = 'PENDING';
  d.note = '[Terlambat 33m]: Test aplikasi';
  delete d.outOfRangeReason;
  if (d.location) {
    d.location.inGeofence = true;
    d.location.distanceMeters = 2;
  }
  db.prepare(`
    UPDATE attendances
    SET status = 'LATE', isLate = 1, lateMinutes = 33, data_json = ?
    WHERE id = ?
  `).run(JSON.stringify(d), 'ATT-1793756914396');
  console.log('[OK] Reconciled Andri Herdiyana: LATE (33m), Dalam Area Kerja (2m), PENDING Late Justification');
}

// 4. Remove false OUT_OF_GEOFENCE approvals for Ika and Wildan
const delIka = db.prepare('DELETE FROM approvals WHERE attendanceRecordId = ? OR id = ?').run('ATT-1793754750636', 'APPR-ATT-1793754750636');
console.log(`[OK] Deleted Ika false approval item(s): ${delIka.changes}`);

const delWildan = db.prepare('DELETE FROM approvals WHERE attendanceRecordId = ? OR id = ?').run('ATT-1793752414824', 'APPR-ATT-1793752414824');
console.log(`[OK] Deleted Wildan false approval item(s): ${delWildan.changes}`);

// 5. Update Andri's approval to LATE_JUSTIFICATION instead of OUT_OF_GEOFENCE
const andriAppRow = db.prepare('SELECT id, data_json FROM approvals WHERE attendanceRecordId = ? OR id = ?').get('ATT-1793756914396', 'APPR-ATT-1793756914396');
if (andriAppRow) {
  const ap = JSON.parse(andriAppRow.data_json);
  ap.type = 'LATE_JUSTIFICATION';
  ap.title = 'Justifikasi Keterlambatan (33 Menit)';
  ap.description = 'Alasan Keterlambatan: Test aplikasi';
  ap.targetStatus = 'LATE';
  ap.lateMinutes = 33;
  db.prepare(`
    UPDATE approvals
    SET type = 'LATE_JUSTIFICATION', title = ?, description = ?, lateMinutes = 33, data_json = ?
    WHERE id = ?
  `).run(ap.title, ap.description, JSON.stringify(ap), andriAppRow.id);
  console.log('[OK] Updated Andri approval item to LATE_JUSTIFICATION');
}

console.log('=== RECONCILIATION COMPLETE ===');
