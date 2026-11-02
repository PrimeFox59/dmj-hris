import { DatabaseSync } from 'node:sqlite';

const targetDb = process.argv[2] || 'data/hris.sqlite';
const db = new DatabaseSync(targetDb);

console.log(`[FIX_JESSICA] Running fix on ${targetDb}...`);

const row = db.prepare("SELECT id, employeeId, employeeName, employeeNik, department, date, checkInTime, checkOutTime, status, approvalStatus, data_json FROM attendances WHERE employeeName LIKE '%Jessica%' AND date = '2026-11-02';").get();

if (!row) {
  console.log('[FIX_JESSICA] No attendance record found for Jessica on 2026-11-02.');
} else {
  console.log(`[FIX_JESSICA] Found record: ID=${row.id}, checkIn=${row.checkInTime}, checkOut=${row.checkOutTime}, status=${row.status}`);

  let data = {};
  try { data = JSON.parse(row.data_json); } catch (e) {}

  delete data.checkInTime;
  data.status = 'ALPA';
  data.approvalStatus = 'PENDING';
  data.note = 'Presensi Pulang Tanpa Absen Masuk (Memerlukan Approval PM & HR)';

  db.prepare(`
    UPDATE attendances
    SET checkInTime = NULL,
        status = 'ALPA',
        approvalStatus = 'PENDING',
        data_json = ?
    WHERE id = ?;
  `).run(JSON.stringify(data), row.id);

  console.log('[FIX_JESSICA] Updated attendances table: checkInTime set to NULL, status set to ALPA, approvalStatus set to PENDING.');

  // Create or update approval ticket (PM -> HR)
  const appId = `APP-NOIN-JESSICA-${Date.now()}`;
  const approvalObj = {
    id: appId,
    type: 'ATTENDANCE_CORRECTION',
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeNik: row.employeeNik,
    department: row.department,
    title: `Persetujuan Presensi Tanpa Absen Masuk - ${row.employeeName}`,
    description: `Karyawan melakukan Absen Pulang pukul ${row.checkOutTime || '17:00:19'} WIB tanpa rekam Absen Masuk pada tanggal ${row.date}. Status saat ini Tidak Absen (Alpa) dan memerlukan peninjauan kehadiran oleh PM terkait kemudian HR Manager.`,
    startDate: row.date,
    targetCheckOutTime: row.checkOutTime || '17:00:19',
    attendanceRecordId: row.id,
    status: 'PENDING',
    stage: 'PM',
    targetApproverRole: 'PM',
    requiresHrApproval: true,
    submittedAt: `${row.date} ${row.checkOutTime || '17:00:19'}`,
    projectId: 'PRJ-001',
    projectCode: 'PRJ-001',
    projectName: 'KANTOR PUSAT & OPERASIONAL MANAJEMEN',
    projectManagerId: 'EMP-120',
    projectManagerName: 'WAHYUNING WULANDARI',
    projectAdminIds: [],
    projectAdminNames: []
  };

  const existingApp = db.prepare("SELECT id FROM approvals WHERE attendanceRecordId = ? OR (employeeId = ? AND startDate = '2026-11-02' AND type = 'ATTENDANCE_CORRECTION');").get(row.id, row.employeeId);

  if (!existingApp) {
    db.prepare(`
      INSERT INTO approvals (
        id, type, employeeId, employeeName, employeeNik, department,
        title, description, startDate, status, submittedAt, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      appId, approvalObj.type, approvalObj.employeeId, approvalObj.employeeName,
      approvalObj.employeeNik, approvalObj.department, approvalObj.title,
      approvalObj.description, approvalObj.startDate, approvalObj.status,
      approvalObj.submittedAt, JSON.stringify(approvalObj)
    );
    console.log(`[FIX_JESSICA] Created 2-tier approval ticket (PM -> HR): ${appId}`);
  } else {
    console.log(`[FIX_JESSICA] Approval ticket already exists: ${existingApp.id}`);
  }
}

console.log('[FIX_JESSICA] Done.');
