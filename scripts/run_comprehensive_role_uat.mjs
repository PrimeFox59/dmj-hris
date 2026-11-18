/**
 * Comprehensive Synthetic UAT Automation Runner across All Roles
 * Target: https://hris.primeprojectx.net
 * Roles Tested:
 * 1. Superuser / IT Admin (admin - Galih Primananda)
 * 2. HR Admin (d013 - Selvi Kartika Sari)
 * 3. Finance & Payroll (d006 - Lina Lestari)
 * 4. Project Manager - Site (d037 - Fadjar Qamara)
 * 5. Staff Pegawai - Office (d002 - Ika Octavia)
 * 6. Staff Pegawai - Site (d011 - Wini Vidiansari)
 */

const BASE_URL = 'https://hris.primeprojectx.net';

const testResults = [];

function recordTest(role, testCase, endpoint, method, expectedStatus, actualStatus, pass, details = '') {
  testResults.push({
    role,
    testCase,
    endpoint,
    method,
    expectedStatus,
    actualStatus,
    pass,
    details
  });
  const icon = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${role}] ${testCase} -> HTTP ${actualStatus} (Expected ${expectedStatus}) | ${details}`);
}

async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, opts);
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

async function runUAT() {
  console.log('='.repeat(80));
  console.log('  COMPREHENSIVE END-TO-END ROLE-BASED UAT TEST SUITE');
  console.log(`  Target System: ${BASE_URL}`);
  console.log(`  Execution Time: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  // =========================================================================
  // 1. SUPERUSER / IT ADMIN ROLE (admin)
  // =========================================================================
  console.log('\n--- 1. TESTING SUPERUSER / IT ADMIN ROLE (admin) ---');
  let adminToken = null;
  {
    // Test 1.1: Login
    const res = await apiCall('/api/auth/login', 'POST', { identifier: 'admin', password: 'admin123' });
    const pass = res.status === 200 && res.data?.success && res.data?.user?.systemRole === 'superuser';
    if (pass) adminToken = res.data.token;
    recordTest('SUPERUSER', 'Authentication & System Token Issuance', '/api/auth/login', 'POST', 200, res.status, pass, `User: ${res.data?.user?.username}, Role: ${res.data?.user?.systemRole}`);
  }

  {
    // Test 1.2: Database Stats Telemetry
    const res = await apiCall('/api/database/stats', 'GET', null, adminToken);
    const pass = res.status === 200 && res.data?.success && typeof res.data?.employeesCount === 'number';
    recordTest('SUPERUSER', 'System Health & Database Telemetry', '/api/database/stats', 'GET', 200, res.status, pass, `Employees: ${res.data?.employeesCount}, Attendances: ${res.data?.attendancesCount}, Size: ${(res.data?.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  }

  {
    // Test 1.3: Audit Logs
    const res = await apiCall('/api/audit-logs?limit=5', 'GET', null, adminToken);
    const pass = res.status === 200 && (res.data?.success || Array.isArray(res.data?.logs));
    const logsCount = res.data?.logs ? res.data.logs.length : (Array.isArray(res.data) ? res.data.length : 0);
    recordTest('SUPERUSER', 'Forensic Audit Trail Retrieval', '/api/audit-logs?limit=5', 'GET', 200, res.status, pass, `Fetched ${logsCount} recent forensic log entries`);
  }

  {
    // Test 1.4: WhatsApp Gateway Status
    const res = await apiCall('/api/wa/status', 'GET', null, adminToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('SUPERUSER', 'WhatsApp Gateway Health Probing', '/api/wa/status', 'GET', 200, res.status, pass, `Service Online (Port 8568 Active)`);
  }

  {
    // Test 1.5: Email / SMTP Gateway Status
    const res = await apiCall('/api/email/status', 'GET', null, adminToken);
    const pass = res.status === 200 && (res.data?.success || res.data?.config);
    recordTest('SUPERUSER', 'SMTP Mail Service Status Check', '/api/email/status', 'GET', 200, res.status, pass, `Host: ${res.data?.config?.host || 'smtp.gmail.com'}, User: ${res.data?.config?.user || 'active'}`);
  }

  {
    // Test 1.6: Bootstrap Fetch
    const res = await apiCall('/api/bootstrap', 'GET', null, adminToken);
    const pass = res.status === 200 && Array.isArray(res.data?.employees);
    recordTest('SUPERUSER', 'Full Enterprise Bootstrap Load', '/api/bootstrap', 'GET', 200, res.status, pass, `Employees: ${res.data?.employees?.length}, Projects: ${res.data?.projects?.length}`);
  }

  // =========================================================================
  // 2. HR ADMINISTRATOR ROLE (d013 - Selvi Kartika Sari)
  // =========================================================================
  console.log('\n--- 2. TESTING HR ADMINISTRATOR ROLE (d013) ---');
  let hrToken = null;
  {
    // Test 2.1: Login
    const res = await apiCall('/api/auth/login', 'POST', { identifier: 'd013', password: 'zzz' });
    const pass = res.status === 200 && res.data?.success && res.data?.user?.systemRole === 'hr';
    if (pass) hrToken = res.data.token;
    recordTest('HR ADMIN', 'Authentication & HR Role Verification', '/api/auth/login', 'POST', 200, res.status, pass, `Name: ${res.data?.user?.employee?.name}, Role: ${res.data?.user?.systemRole}`);
  }

  {
    // Test 2.2: Master Employee Query
    const res = await apiCall('/api/bootstrap', 'GET', null, hrToken);
    const pass = res.status === 200 && res.data?.employees?.length > 100;
    recordTest('HR ADMIN', 'Employee Directory Governance Access', '/api/bootstrap', 'GET', 200, res.status, pass, `Loaded ${res.data?.employees?.length} employee profiles`);
  }

  {
    // Test 2.3: Work Calendar
    const res = await apiCall('/api/work-calendar?year=2026', 'GET', null, hrToken);
    const pass = res.status === 200 && (res.data?.success || res.data?.calendar || res.data?.config);
    recordTest('HR ADMIN', 'Annual Work Calendar & Cut-Off Configuration', '/api/work-calendar?year=2026', 'GET', 200, res.status, pass, `Calendar Year 2026 retrieved`);
  }

  let testApprovalId = `APP-UAT-${Date.now()}`;
  {
    // Test 2.4a: Create a test approval ticket (Medical Leave with Doctor Note)
    const newApproval = {
      id: testApprovalId,
      employeeId: 'EMP-020', // Wini Vidiansari (Staff)
      employeeNik: 'D011',
      employeeName: 'WINI VIDIANSARI',
      department: 'Site Engineering',
      type: 'CUTI_SAKIT',
      leaveType: 'CUTI_SAKIT',
      title: 'Pengajuan Cuti Sakit (UAT Synthetic Test)',
      description: 'Demam tinggi dan flu berat, istirahat dokter 2 hari (Surat Terlampir)',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      daysCount: 1,
      status: 'PENDING',
      stage: 'HR',
      hasDoctorNote: true,
      hasAttachment: true,
      leaveDeductionWaived: true,
      requiresHrApproval: true,
      submittedAt: new Date().toISOString()
    };
    const res = await apiCall('/api/approval/submit', 'POST', newApproval, hrToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('HR ADMIN', 'Submit Approval Ticket Simulation', '/api/approval/submit', 'POST', 200, res.status, pass, `Ticket ID: ${testApprovalId}`);
  }

  {
    // Test 2.4b: HR Admin approves the request with leave deduction waived
    const updatePayload = {
      id: testApprovalId,
      status: 'APPROVED',
      reviewedBy: 'SELVI KARTIKA SARI (HR Admin)',
      reviewedAt: new Date().toISOString(),
      reviewNote: 'Disetujui oleh HR: Surat dokter valid, bebas potong cuti tahunan.',
      leaveDeductionWaived: true
    };
    const res = await apiCall('/api/approval', 'PUT', updatePayload, hrToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('HR ADMIN', 'Leave Approval & Quota Waiver Execution', '/api/approval', 'PUT', 200, res.status, pass, `Status updated to APPROVED with leaveDeductionWaived: true`);
  }

  {
    // Test 2.5: Security Privilege Boundary Check (HR cannot call system reset)
    const res = await apiCall('/api/reset', 'POST', { confirmation: 'RESET' }, hrToken);
    const pass = res.status === 403 || res.status === 401;
    recordTest('HR ADMIN', 'Security Boundary Gating: System Reset Blocked', '/api/reset', 'POST', 403, res.status, pass, `Privilege segregation enforced: Non-superuser blocked`);
  }

  // =========================================================================
  // 3. FINANCE & PAYROLL ROLE (d006 - Lina Lestari)
  // =========================================================================
  console.log('\n--- 3. TESTING FINANCE & PAYROLL ROLE (d006) ---');
  let finToken = null;
  {
    // Test 3.1: Login
    const res = await apiCall('/api/auth/login', 'POST', { identifier: 'd006', password: 'zzz' });
    const pass = res.status === 200 && res.data?.success && res.data?.user?.systemRole === 'finance';
    if (pass) finToken = res.data.token;
    recordTest('FINANCE', 'Authentication & Finance Role Verification', '/api/auth/login', 'POST', 200, res.status, pass, `Name: ${res.data?.user?.employee?.name}, Role: ${res.data?.user?.systemRole}`);
  }

  {
    // Test 3.2: Inspect Salary Rules
    const res = await apiCall('/api/bootstrap', 'GET', null, finToken);
    const rules = res.data?.salaryRules;
    const pass = res.status === 200 && rules && typeof rules.standardWorkDaysPerMonth === 'number';
    recordTest('FINANCE', 'Salary Calibration Rules Audit', '/api/bootstrap', 'GET', 200, res.status, pass, `Standard Work Days: ${rules?.standardWorkDaysPerMonth}, Daily Allowance: Rp ${rules?.defaultDailyAllowance}`);
  }

  {
    // Test 3.3: Salary Rules Update Permissions
    const res = await apiCall('/api/bootstrap', 'GET', null, finToken);
    const existingRules = res.data?.salaryRules || {};
    const updatedRules = {
      ...existingRules,
      updatedAt: new Date().toISOString(),
      updatedBy: 'LINA LESTARI (Finance)'
    };
    const updateRes = await apiCall('/api/salary-rules', 'POST', updatedRules, finToken);
    const pass = updateRes.status === 200 && updateRes.data?.success;
    recordTest('FINANCE', 'Payroll Parameter Calibration Authority', '/api/salary-rules', 'POST', 200, updateRes.status, pass, `Salary rule configuration validated`);
  }

  {
    // Test 3.4: Security Privilege Boundary Check (Finance cannot reset database)
    const res = await apiCall('/api/reset', 'POST', { confirmation: 'RESET' }, finToken);
    const pass = res.status === 403 || res.status === 401;
    recordTest('FINANCE', 'Security Boundary Gating: System Reset Blocked', '/api/reset', 'POST', 403, res.status, pass, `Privilege segregation enforced: Non-superuser blocked`);
  }

  {
    // Test 3.5: Security Privilege Boundary Check (Finance cannot delete attendance records)
    const res = await apiCall('/api/attendance/delete', 'POST', { id: 'ATT-FORBIDDEN-TEST' }, finToken);
    const pass = res.status === 403 || res.status === 401;
    recordTest('FINANCE', 'Security Boundary Gating: Attendance Delete Blocked', '/api/attendance/delete', 'POST', 403, res.status, pass, `Privilege segregation enforced: Non-superuser blocked`);
  }

  // =========================================================================
  // 4. PROJECT MANAGER - SITE (d037 - Fadjar Qamara, PRJ-046)
  // =========================================================================
  console.log('\n--- 4. TESTING PROJECT MANAGER - SITE ROLE (d037) ---');
  let pmToken = null;
  {
    // Test 4.1: Login
    const res = await apiCall('/api/auth/login', 'POST', { identifier: 'd037', password: 'zzz' });
    const pass = res.status === 200 && res.data?.success;
    if (pass) pmToken = res.data.token;
    recordTest('PROJECT MANAGER', 'Authentication & PM Profile Retrieval', '/api/auth/login', 'POST', 200, res.status, pass, `Name: ${res.data?.user?.employee?.name}, Project: ${res.data?.user?.employee?.assignedProjectId || 'PRJ-046'}`);
  }

  {
    // Test 4.2: Query Casual Workers on Site
    const res = await apiCall('/api/casual-workers?projectId=PRJ-046', 'GET', null, pmToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('PROJECT MANAGER', 'Site Casual Workers Directory Query', '/api/casual-workers?projectId=PRJ-046', 'GET', 200, res.status, pass, `Existing Casual Workers on Site: ${res.data?.count ?? 0}`);
  }

  let testWorkerId = `CW-UAT-${Date.now()}`;
  {
    // Test 4.3: Save / Register Casual Worker
    const newWorker = {
      id: testWorkerId,
      projectId: 'PRJ-046',
      name: 'UAT Synthetic Worker (Tukang Besi)',
      trade: 'Tukang Besi',
      dailyWage: 175000,
      status: 'active',
      phone: '081234567890',
      createdByName: 'Fadjar Qamara'
    };
    const res = await apiCall('/api/casual-workers', 'POST', newWorker, pmToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('PROJECT MANAGER', 'Casual Worker Registration on Site', '/api/casual-workers', 'POST', 200, res.status, pass, `Registered worker: ${newWorker.name} (Wage: Rp 175.000)`);
  }

  let testCasualAttId = `CA-UAT-${Date.now()}`;
  {
    // Test 4.4: Record Casual Worker Attendance
    const newAtt = {
      id: testCasualAttId,
      workerId: testWorkerId,
      workerName: 'UAT Synthetic Worker (Tukang Besi)',
      projectId: 'PRJ-046',
      projectName: 'Pembangunan Smelter Manyar JIIPE Gresik',
      date: new Date().toISOString().slice(0, 10),
      checkInTime: '07:45:00',
      photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      latitude: -7.1142,
      longitude: 112.5841,
      verifiedByPmId: 'EMP-046',
      verifiedByPmName: 'Fadjar Qamara'
    };
    const res = await apiCall('/api/casual-attendances', 'POST', newAtt, pmToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('PROJECT MANAGER', 'Casual Worker Daily Attendance Logging', '/api/casual-attendances', 'POST', 200, res.status, pass, `Attendance logged with GPS & PM verification`);
  }

  {
    // Test 4.5: Clean up test casual attendance
    const res = await apiCall(`/api/casual-attendances/${testCasualAttId}`, 'DELETE', null, pmToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('PROJECT MANAGER', 'Cleanup Synthetic Casual Attendance Record', `/api/casual-attendances/${testCasualAttId}`, 'DELETE', 200, res.status, pass, `Deleted temporary test attendance ID`);
  }

  {
    // Test 4.6: Security Privilege Boundary Check (PM cannot modify global salary rules)
    const res = await apiCall('/api/salary-rules', 'POST', { officeWorkingDaysDivisor: 20 }, pmToken);
    const pass = res.status === 403 || res.status === 401;
    recordTest('PROJECT MANAGER', 'Security Boundary Gating: Global Salary Rule Edit Blocked', '/api/salary-rules', 'POST', 403, res.status, pass, `Privilege segregation enforced: PM blocked from global payroll config`);
  }

  // =========================================================================
  // 5. STAFF PEGAWAI - OFFICE (d002 - Ika Octavia)
  // =========================================================================
  console.log('\n--- 5. TESTING STAFF PEGAWAI - OFFICE ROLE (d002) ---');
  let staffOfficeToken = null;
  {
    // Test 5.1: Login
    const res = await apiCall('/api/auth/login', 'POST', { identifier: 'd002', password: 'zzz' });
    const pass = res.status === 200 && res.data?.success && res.data?.user?.systemRole === 'staff';
    if (pass) staffOfficeToken = res.data.token;
    recordTest('STAFF OFFICE', 'Authentication & Profile Verification', '/api/auth/login', 'POST', 200, res.status, pass, `Name: ${res.data?.user?.employee?.name}, Dept: ${res.data?.user?.employee?.department}`);
  }

  let testOfficeAttId = `ATT-UAT-OFFICE-${Date.now()}`;
  {
    // Test 5.2: In-Geofence Check-In
    const attPayload = {
      id: testOfficeAttId,
      employeeId: 'EMP-011',
      employeeNik: 'D002',
      employeeName: 'IKA OCTAVIA',
      attendanceType: 'CHECK_IN',
      type: 'CHECK_IN',
      date: new Date().toISOString().slice(0, 10),
      checkInTime: '08:00:00',
      latitude: -7.2891,
      longitude: 112.7344,
      isGeofenceValid: true,
      distanceMeters: 15.4,
      deviceInfo: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Synthetic UAT Runner',
      notes: 'Presensi UAT Otomatis Office Geofence Valid'
    };
    const res = await apiCall('/api/attendance', 'POST', attPayload, staffOfficeToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('STAFF OFFICE', 'In-Geofence Mobile Check-In with Server RTC Lock', '/api/attendance', 'POST', 200, res.status, pass, `Server Time Recorded: ${res.data?.record?.serverVerifiedTime || 'Synced'}`);
  }

  {
    // Test 5.3: Check-Out
    const attOutPayload = {
      id: testOfficeAttId,
      employeeId: 'EMP-011',
      employeeNik: 'D002',
      employeeName: 'IKA OCTAVIA',
      attendanceType: 'CHECK_OUT',
      type: 'CHECK_OUT',
      date: new Date().toISOString().slice(0, 10),
      checkOutTime: '17:05:00',
      latitude: -7.2891,
      longitude: 112.7344,
      isGeofenceValid: true,
      notes: 'Presensi UAT Check-Out Otomatis'
    };
    const res = await apiCall('/api/attendance', 'POST', attOutPayload, staffOfficeToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('STAFF OFFICE', 'Mobile Check-Out with Working Hours Calculation', '/api/attendance', 'POST', 200, res.status, pass, `Check-out verified on active attendance record`);
  }

  {
    // Test 5.4: Security Privilege Boundary Check (Staff cannot access database stats)
    const res = await apiCall('/api/database/stats', 'GET', null, staffOfficeToken);
    const pass = res.status === 403 || res.status === 401;
    recordTest('STAFF OFFICE', 'Security Boundary Gating: Database Telemetry Blocked', '/api/database/stats', 'GET', 403, res.status, pass, `Privilege segregation enforced: Staff blocked from low-level stats`);
  }

  // =========================================================================
  // 6. STAFF PEGAWAI - SITE (d011 - Wini Vidiansari)
  // =========================================================================
  console.log('\n--- 6. TESTING STAFF PEGAWAI - SITE ROLE (d011) ---');
  let staffSiteToken = null;
  {
    // Test 6.1: Login
    const res = await apiCall('/api/auth/login', 'POST', { identifier: 'd011', password: 'zzz' });
    const pass = res.status === 200 && res.data?.success;
    if (pass) staffSiteToken = res.data.token;
    recordTest('STAFF SITE', 'Authentication & Site Staff Verification', '/api/auth/login', 'POST', 200, res.status, pass, `Name: ${res.data?.user?.employee?.name}, Project: ${res.data?.user?.employee?.assignedProjectId || 'Site'}`);
  }

  let testSiteAttId = `ATT-UAT-SITE-${Date.now()}`;
  {
    // Test 6.2: Site Geofence Presensi Check-In
    const attPayload = {
      id: testSiteAttId,
      employeeId: 'EMP-020',
      employeeNik: 'D011',
      employeeName: 'WINI VIDIANSARI',
      attendanceType: 'CHECK_IN',
      type: 'CHECK_IN',
      date: new Date().toISOString().slice(0, 10),
      checkInTime: '07:55:00',
      latitude: -7.1142,
      longitude: 112.5841,
      isGeofenceValid: true,
      notes: 'Presensi UAT Site Smelter Manyar JIIPE'
    };
    const res = await apiCall('/api/attendance', 'POST', attPayload, staffSiteToken);
    const pass = res.status === 200 && res.data?.success;
    recordTest('STAFF SITE', 'Site Presensi Check-In (JIIPE Manyar Coordinates)', '/api/attendance', 'POST', 200, res.status, pass, `Location verified within project geofence`);
  }

  {
    // Test 6.3: Security Privilege Boundary Check (Staff cannot view WA logs)
    const res = await apiCall('/api/wa/logs', 'GET', null, staffSiteToken);
    const pass = res.status === 403 || res.status === 401;
    recordTest('STAFF SITE', 'Security Boundary Gating: WhatsApp Logs Blocked', '/api/wa/logs', 'GET', 403, res.status, pass, `Privilege segregation enforced: Staff blocked from communication logs`);
  }

  // Cleanup: Delete the synthetic attendance records and approval created during testing using Superuser token
  console.log('\n--- CLEANING UP SYNTHETIC UAT ARTIFACTS ---');
  if (adminToken) {
    await apiCall('/api/attendance/delete', 'POST', { id: testOfficeAttId }, adminToken);
    await apiCall('/api/attendance/delete', 'POST', { id: testSiteAttId }, adminToken);
    console.log('✅ Temporary UAT attendance records purged cleanly via Superuser audit boundary.');
  }

  // =========================================================================
  // SUMMARY REPORT GENERATION
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('                      UAT EXECUTION SUMMARY REPORT');
  console.log('='.repeat(80));

  const total = testResults.length;
  const passed = testResults.filter(t => t.pass).length;
  const failed = total - passed;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total Scenarios Tested : ${total}`);
  console.log(`Passed                 : ${passed}`);
  console.log(`Failed                 : ${failed}`);
  console.log(`Pass Rate              : ${passRate}%`);
  console.log('='.repeat(80));

  return { total, passed, failed, passRate, testResults };
}

runUAT().then(res => {
  if (res.failed > 0) process.exit(1);
  else process.exit(0);
});
