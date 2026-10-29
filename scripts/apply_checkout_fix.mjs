import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

// --- 1. Patch src/components/PresensiCameraTab.tsx ---
const presensiPath = path.join(projectRoot, 'src/components/PresensiCameraTab.tsx');
let presensiCode = fs.readFileSync(presensiPath, 'utf8');

// 1a. Patch checkLateStatus & add handleToggleAttendanceAction
const oldCheckLate = `  // Cutoff calculation
  useEffect(() => {
    const checkLateStatus = () => {
      const now = new Date();
      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffH, cutoffM, 0, 0);

      if (now > cutoffDate) {
        const diffMs = now.getTime() - cutoffDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        setIsLate(true);
        setLateMinutes(diffMins);
      } else {
        setIsLate(false);
        setLateMinutes(0);
      }
    };
    checkLateStatus();
    const timer = setInterval(checkLateStatus, 30000);
    return () => clearInterval(timer);
  }, [userSchedule.cutoffTime]);`;

const newCheckLate = `  // Cutoff calculation: status keterlambatan hanya berlaku untuk Absen Masuk (CHECK_IN)
  useEffect(() => {
    const checkLateStatus = () => {
      // Absen Pulang (CHECK_OUT) TIDAK PERNAH dianggap terlambat
      if (attendanceAction === 'CHECK_OUT') {
        setIsLate(false);
        setLateMinutes(0);
        return;
      }

      const now = new Date();
      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffH, cutoffM, 0, 0);

      if (now > cutoffDate) {
        const diffMs = now.getTime() - cutoffDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        setIsLate(true);
        setLateMinutes(diffMins);
      } else {
        setIsLate(false);
        setLateMinutes(0);
      }
    };
    checkLateStatus();
    const timer = setInterval(checkLateStatus, 30000);
    return () => clearInterval(timer);
  }, [userSchedule.cutoffTime, attendanceAction]);

  // Handler toggle jenis presensi Masuk / Pulang dengan auto-clear keterlambatan
  const handleToggleAttendanceAction = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    setAttendanceAction(action);
    if (action === 'CHECK_OUT') {
      setIsLate(false);
      setLateMinutes(0);
      setLateReason('');
    } else {
      const now = new Date();
      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffH, cutoffM, 0, 0);
      if (now > cutoffDate) {
        const diffMs = now.getTime() - cutoffDate.getTime();
        setIsLate(true);
        setLateMinutes(Math.floor(diffMs / 60000));
      } else {
        setIsLate(false);
        setLateMinutes(0);
      }
    }
  };`;

if (presensiCode.includes(oldCheckLate)) {
  presensiCode = presensiCode.replace(oldCheckLate, newCheckLate);
  console.log('✓ Patched checkLateStatus in PresensiCameraTab.tsx');
} else {
  // Normalize CRLF
  const normOld = oldCheckLate.replace(/\r\n/g, '\n');
  const normPresensi = presensiCode.replace(/\r\n/g, '\n');
  if (normPresensi.includes(normOld)) {
    presensiCode = normPresensi.replace(normOld, newCheckLate.replace(/\r\n/g, '\n'));
    console.log('✓ Patched checkLateStatus in PresensiCameraTab.tsx (normalized CRLF)');
  } else {
    console.warn('⚠️ Could not find oldCheckLate block in PresensiCameraTab.tsx');
  }
}

// 1b. Replace onClick={() => setAttendanceAction('CHECK_IN')} with handleToggleAttendanceAction
presensiCode = presensiCode.replaceAll(
  "onClick={() => setAttendanceAction('CHECK_IN')}",
  "onClick={() => handleToggleAttendanceAction('CHECK_IN')}"
);
presensiCode = presensiCode.replaceAll(
  "onClick={() => setAttendanceAction('CHECK_OUT')}",
  "onClick={() => handleToggleAttendanceAction('CHECK_OUT')}"
);
console.log('✓ Replaced setAttendanceAction click handlers with handleToggleAttendanceAction');

// 1c. Patch handleCaptureAndSubmit validation & record creation
const oldLateValidation = `    // Validasi Wajib Isi: Presensi Terlambat (Tetap Diterima tapi Wajib Alasan)
    if (isLate) {
      if (!lateReason.trim()) {
        playDeniedChime();
        alert(\`? Presensi Terlambat: Anda terdeteksi terlambat (\${lateMinutes} menit).\\n\\nSistem tetap menerima presensi Anda, tetapi Anda WAJIB mengisi alasan keterlambatan.\`);
        return;
      }
    }`;

// Notice in file it may have warning emoji or ?
const normPres = presensiCode.replace(/\r\n/g, '\n');
const lateValRegex = /\/\/\s*Validasi Wajib Isi:\s*Presensi Terlambat[\s\S]*?if\s*\(\s*isLate\s*\)\s*\{[\s\S]*?if\s*\(!lateReason\.trim\(\)\)\s*\{[\s\S]*?return;\s*\}\s*\}/;

const newLateValidation = `    // Validasi Wajib Isi: Presensi Terlambat HANYA saat ABSEN MASUK (CHECK_IN)
    const isCheckIn = attendanceAction === 'CHECK_IN';
    const effectiveIsLate = isCheckIn && isLate;
    const effectiveLateMinutes = effectiveIsLate ? lateMinutes : 0;
    if (effectiveIsLate) {
      if (!lateReason.trim()) {
        playDeniedChime();
        alert(\`⚠️ Presensi Terlambat: Anda terdeteksi terlambat (\${lateMinutes} menit).\\n\\nSistem tetap menerima presensi Anda, tetapi Anda WAJIB mengisi alasan keterlambatan.\`);
        return;
      }
    }`;

if (lateValRegex.test(normPres)) {
  presensiCode = normPres.replace(lateValRegex, newLateValidation);
  console.log('✓ Patched late validation regex in PresensiCameraTab.tsx');
} else {
  console.warn('⚠️ Could not find lateValRegex in PresensiCameraTab.tsx');
}

// 1d. Patch record payload creation in handleCaptureAndSubmit
const oldLateReasonToUse = `    const lateReasonToUse = isLate ? lateReason.trim() : undefined;`;
const newLateReasonToUse = `    const lateReasonToUse = effectiveIsLate ? lateReason.trim() : undefined;`;
presensiCode = presensiCode.replace(oldLateReasonToUse, newLateReasonToUse);

const oldRecordDef = `    const isCheckIn = attendanceAction === 'CHECK_IN';

    const newRecord: AttendanceRecord = {
      id: \`ATT-\${Date.now()}\`,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      employeeNik: currentUser.nik,
      department: currentUser.department,
      date: dateStr,
      checkInTime: timeStr,
      checkOutTime: isCheckIn ? undefined : timeStr,
      attendanceType: attendanceAction,
      mode: mode,
      status: mode === 'DINAS_LUAR' ? 'DINAS_LUAR_PENDING' : !isWithinAnyAuthorizedGeofence ? 'OUT_OF_GEOFENCE' : isLate ? 'LATE' : 'ON_TIME',
      photoUrl: photoToUse,
      location: {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        address: coords.address,
        inGeofence: mode === 'WFO' ? isWithinAnyAuthorizedGeofence : false,
        distanceMeters: isInProjectGeofence && assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance
      },
      networkAudit: {
        ipAddress: activeIp,
        connectionType: isInOfficeGeofence || isInProjectGeofence ? 'Geofence Valid' : 'GPS Mobile'
      },
      note: noteToUse,
      isLate: isLate,
      lateMinutes: lateMinutes,
      lateReason: lateReasonToUse,
      outOfRangeReason: !isWithinAnyAuthorizedGeofence ? outOfRangeReason.trim() : undefined,
      dinasLuarDetails: mode === 'DINAS_LUAR' ? {
        destination,
        clientName,
        projectCode,
        purpose: dinasPurpose,
        isSudden: true
      } : undefined,
      approvalStatus: (mode === 'DINAS_LUAR' || isLate || !isWithinAnyAuthorizedGeofence) ? 'PENDING' : 'NOT_REQUIRED',`;

const newRecordDef = `    const newRecord: AttendanceRecord = {
      id: \`ATT-\${Date.now()}\`,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      employeeNik: currentUser.nik,
      department: currentUser.department,
      date: dateStr,
      checkInTime: timeStr,
      checkOutTime: isCheckIn ? undefined : timeStr,
      attendanceType: attendanceAction,
      mode: mode,
      status: mode === 'DINAS_LUAR' ? 'DINAS_LUAR_PENDING' : !isWithinAnyAuthorizedGeofence ? 'OUT_OF_GEOFENCE' : effectiveIsLate ? 'LATE' : 'ON_TIME',
      photoUrl: photoToUse,
      location: {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        address: coords.address,
        inGeofence: mode === 'WFO' ? isWithinAnyAuthorizedGeofence : false,
        distanceMeters: isInProjectGeofence && assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance
      },
      networkAudit: {
        ipAddress: activeIp,
        connectionType: isInOfficeGeofence || isInProjectGeofence ? 'Geofence Valid' : 'GPS Mobile'
      },
      note: noteToUse,
      isLate: effectiveIsLate,
      lateMinutes: effectiveLateMinutes,
      lateReason: lateReasonToUse,
      outOfRangeReason: !isWithinAnyAuthorizedGeofence ? outOfRangeReason.trim() : undefined,
      dinasLuarDetails: mode === 'DINAS_LUAR' ? {
        destination,
        clientName,
        projectCode,
        purpose: dinasPurpose,
        isSudden: true
      } : undefined,
      approvalStatus: (mode === 'DINAS_LUAR' || effectiveIsLate || !isWithinAnyAuthorizedGeofence) ? 'PENDING' : 'NOT_REQUIRED',`;

if (presensiCode.includes(oldRecordDef)) {
  presensiCode = presensiCode.replace(oldRecordDef, newRecordDef);
  console.log('✓ Patched newRecord in PresensiCameraTab.tsx');
} else {
  const normOldRec = oldRecordDef.replace(/\r\n/g, '\n');
  const normP = presensiCode.replace(/\r\n/g, '\n');
  if (normP.includes(normOldRec)) {
    presensiCode = normP.replace(normOldRec, newRecordDef.replace(/\r\n/g, '\n'));
    console.log('✓ Patched newRecord in PresensiCameraTab.tsx (normalized CRLF)');
  } else {
    console.warn('⚠️ Could not find oldRecordDef in PresensiCameraTab.tsx');
  }
}

// 1e. Patch Header Status Chip (lines 1173-1190)
const oldHeaderChip = `          {/* Status Chip */}
          {isLate ? (
            <div className="px-3 py-1.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 flex items-center gap-1.5 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">Terlambat</p>
                <p className="text-xs font-bold font-mono-code">{lateMinutes}m</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">Tepat Waktu</p>
                <p className="text-xs font-bold font-mono-code">Sesuai Jadwal</p>
              </div>
            </div>
          )}`;

const newHeaderChip = `          {/* Status Chip */}
          {attendanceAction === 'CHECK_IN' && isLate ? (
            <div className="px-3 py-1.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 flex items-center gap-1.5 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">Terlambat</p>
                <p className="text-xs font-bold font-mono-code">{lateMinutes}m</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">{attendanceAction === 'CHECK_OUT' ? 'Absen Pulang' : 'Tepat Waktu'}</p>
                <p className="text-xs font-bold font-mono-code">{attendanceAction === 'CHECK_OUT' ? 'Siap Checkout' : 'Sesuai Jadwal'}</p>
              </div>
            </div>
          )}`;

const normH = presensiCode.replace(/\r\n/g, '\n');
const normOldH = oldHeaderChip.replace(/\r\n/g, '\n');
if (normH.includes(normOldH)) {
  presensiCode = normH.replace(normOldH, newHeaderChip.replace(/\r\n/g, '\n'));
  console.log('✓ Patched Header Status Chip in PresensiCameraTab.tsx');
} else {
  console.warn('⚠️ Could not find oldHeaderChip in PresensiCameraTab.tsx');
}

// 1f. Patch Alasan Keterlambatan Modal block (line 1702)
const oldModalLateBlock = `{/* 3. ALASAN KETERLAMBATAN (JIKA TERLAMBAT) */}
              {isLate && (`;
const newModalLateBlock = `{/* 3. ALASAN KETERLAMBATAN (HANYA JIKA ABSEN MASUK & TERLAMBAT) */}
              {attendanceAction === 'CHECK_IN' && isLate && (`;
presensiCode = presensiCode.replace(oldModalLateBlock, newModalLateBlock);
console.log('✓ Patched Alasan Keterlambatan Modal block');

// 1g. Patch Success Modal status text (line 2095)
const oldSuccessStatus = `{submittedRecord.status === 'ON_TIME'
                    ? 'TEPAT WAKTU (ON TIME)'
                    : \`TERLAMBAT (\${submittedRecord.lateMinutes}m - PENGAJUAN DIAJUKAN KE HR)\`}`;
const newSuccessStatus = `{submittedRecord.attendanceType === 'CHECK_OUT'
                    ? 'ABSEN PULANG (BERHASIL)'
                    : submittedRecord.status === 'ON_TIME'
                    ? 'TEPAT WAKTU (ON TIME)'
                    : submittedRecord.status === 'LATE'
                    ? \`TERLAMBAT (\${submittedRecord.lateMinutes}m - PENGAJUAN DIAJUKAN KE HR)\`
                    : submittedRecord.status}`;
presensiCode = presensiCode.replace(oldSuccessStatus, newSuccessStatus);

// 1h. Patch History Table row late display (line 1968)
const oldHistLate = `{item.isLate && (
                        <span className="text-[10px] text-rose-600 font-semibold block">
                          Terlambat {item.lateMinutes}m ({item.lateReason})
                        </span>
                      )}`;
const newHistLate = `{item.attendanceType !== 'CHECK_OUT' && item.isLate && (
                        <span className="text-[10px] text-rose-600 font-semibold block">
                          Terlambat {item.lateMinutes}m ({item.lateReason})
                        </span>
                      )}`;
const normHL = presensiCode.replace(/\r\n/g, '\n');
if (normHL.includes(oldHistLate.replace(/\r\n/g, '\n'))) {
  presensiCode = normHL.replace(oldHistLate.replace(/\r\n/g, '\n'), newHistLate.replace(/\r\n/g, '\n'));
  console.log('✓ Patched History Table late display');
}

fs.writeFileSync(presensiPath, presensiCode, 'utf8');


// --- 2. Patch src/App.tsx ---
const appPath = path.join(projectRoot, 'src/App.tsx');
let appCode = fs.readFileSync(appPath, 'utf8');

const oldAppLate = `    // 2. Late Justification Approval
    if (record.isLate) {`;
const newAppLate = `    // 2. Late Justification Approval: HANYA untuk Absen Masuk (CHECK_IN) yang terlambat
    if (record.isLate && record.attendanceType !== 'CHECK_OUT') {`;

if (appCode.includes(oldAppLate)) {
  appCode = appCode.replace(oldAppLate, newAppLate);
  console.log('✓ Patched Late Justification in App.tsx');
} else {
  const normApp = appCode.replace(/\r\n/g, '\n');
  if (normApp.includes(oldAppLate.replace(/\r\n/g, '\n'))) {
    appCode = normApp.replace(oldAppLate.replace(/\r\n/g, '\n'), newAppLate.replace(/\r\n/g, '\n'));
    console.log('✓ Patched Late Justification in App.tsx (normalized CRLF)');
  }
}
fs.writeFileSync(appPath, appCode, 'utf8');


// --- 3. Patch server/db.js ---
const dbJsPath = path.join(projectRoot, 'server/db.js');
let dbJsCode = fs.readFileSync(dbJsPath, 'utf8');

const oldDbSaveAtt = `    } else {
      // MODE PRESENSI PULANG: Pertahankan jam masuk awal, set jam pulang ke waktu sekarang
      finalCheckIn = (existing.checkInTime || record.checkInTime || '08:00:00').replace(/\\./g, ':');
      finalCheckOut = (record.checkOutTime || record.checkInTime || '').replace(/\\./g, ':');
      finalStatus = existing.status || record.status;
      finalIsLate = existing.isLate !== undefined ? existing.isLate : (record.isLate ? 1 : 0);
      finalLateMinutes = existing.lateMinutes !== undefined ? existing.lateMinutes : (record.lateMinutes || 0);
      finalLateReason = existing.lateReason || record.lateReason || null;
      finalApprovalStatus = existing.approvalStatus || record.approvalStatus || 'APPROVED';`;

const newDbSaveAtt = `    } else {
      // MODE PRESENSI PULANG: Pertahankan jam masuk awal, set jam pulang ke waktu sekarang
      finalCheckIn = (existing.checkInTime || record.checkInTime || '08:00:00').replace(/\\./g, ':');
      finalCheckOut = (record.checkOutTime || record.checkInTime || '').replace(/\\./g, ':');
      finalStatus = existing.status || (record.status === 'LATE' ? 'ON_TIME' : record.status);
      finalIsLate = existing.isLate !== undefined ? existing.isLate : 0;
      finalLateMinutes = existing.lateMinutes !== undefined ? existing.lateMinutes : 0;
      finalLateReason = existing.lateReason || null;
      finalApprovalStatus = existing.approvalStatus || record.approvalStatus || 'APPROVED';`;

const normDbJs = dbJsCode.replace(/\r\n/g, '\n');
if (normDbJs.includes(oldDbSaveAtt.replace(/\r\n/g, '\n'))) {
  dbJsCode = normDbJs.replace(oldDbSaveAtt.replace(/\r\n/g, '\n'), newDbSaveAtt.replace(/\r\n/g, '\n'));
  console.log('✓ Patched saveAttendance checkout merge in server/db.js');
}

// Also in server/db.js approval check:
const oldApprPending = `  if (record.approvalStatus === 'PENDING') {
    const isDinasLuar = record.mode === 'DINAS_LUAR';
    const approvalId = \`APPR-\${record.id}\`;`;

const newApprPending = `  if (record.approvalStatus === 'PENDING') {
    const isDinasLuar = record.mode === 'DINAS_LUAR';
    const isOutOfGeofence = record.status === 'OUT_OF_GEOFENCE';
    // Absen Pulang (CHECK_OUT) TIDAK PERNAH membuat pengajuan LATE_JUSTIFICATION
    if (!isDinasLuar && !isOutOfGeofence && attType === 'CHECK_OUT') {
      // Skip late approval saat checkout
    } else {
      const approvalId = \`APPR-\${record.id}\`;`;

// Add closing brace for else block
const oldApprEnd = `      approvalItem.title, approvalItem.description, approvalItem.startDate,
      approvalItem.endDate, approvalItem.daysCount, approvalItem.lateMinutes,
      approvalItem.status, approvalItem.submittedAt, approvalItem.reviewedBy,
      approvalItem.reviewedAt, approvalItem.reviewNote, JSON.stringify(approvalItem)
    );
  }`;

const newApprEnd = `      approvalItem.title, approvalItem.description, approvalItem.startDate,
      approvalItem.endDate, approvalItem.daysCount, approvalItem.lateMinutes,
      approvalItem.status, approvalItem.submittedAt, approvalItem.reviewedBy,
      approvalItem.reviewedAt, approvalItem.reviewNote, JSON.stringify(approvalItem)
    );
    }
  }`;

const normDbJs2 = dbJsCode.replace(/\r\n/g, '\n');
if (normDbJs2.includes(oldApprPending.replace(/\r\n/g, '\n')) && normDbJs2.includes(oldApprEnd.replace(/\r\n/g, '\n'))) {
  dbJsCode = normDbJs2
    .replace(oldApprPending.replace(/\r\n/g, '\n'), newApprPending.replace(/\r\n/g, '\n'))
    .replace(oldApprEnd.replace(/\r\n/g, '\n'), newApprEnd.replace(/\r\n/g, '\n'));
  console.log('✓ Patched approval trigger in server/db.js');
}

fs.writeFileSync(dbJsPath, dbJsCode, 'utf8');

// --- 4. Patch server/db.ts ---
const dbTsPath = path.join(projectRoot, 'server/db.ts');
if (fs.existsSync(dbTsPath)) {
  let dbTsCode = fs.readFileSync(dbTsPath, 'utf8');
  const oldTsAppr = `  // If this attendance needs approval (Dinas Luar or Late), create approval item in SQLite
  if (record.approvalStatus === 'PENDING') {`;
  const newTsAppr = `  // If this attendance needs approval (Dinas Luar or Late), create approval item in SQLite
  if (record.approvalStatus === 'PENDING' && record.attendanceType !== 'CHECK_OUT') {`;
  const normTs = dbTsCode.replace(/\r\n/g, '\n');
  if (normTs.includes(oldTsAppr.replace(/\r\n/g, '\n'))) {
    dbTsCode = normTs.replace(oldTsAppr.replace(/\r\n/g, '\n'), newTsAppr.replace(/\r\n/g, '\n'));
    fs.writeFileSync(dbTsPath, dbTsCode, 'utf8');
    console.log('✓ Patched server/db.ts approval check');
  }
}

console.log('ALL PATCHES APPLIED SUCCESSFULLY!');
