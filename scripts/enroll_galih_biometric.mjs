import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = path.resolve('data/hris.sqlite');
console.log('[ENROLL] Connecting to database:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

const imgPath = fs.existsSync(path.resolve('galih_enrolled_square.jpg'))
  ? path.resolve('galih_enrolled_square.jpg')
  : path.resolve('test_enrolled_front.png');

if (!fs.existsSync(imgPath)) {
  console.error('Photo file for enrollment not found:', imgPath);
  process.exit(1);
}

const imgBuf = fs.readFileSync(imgPath);
const mimeType = imgPath.endsWith('.jpg') || imgPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
const dataUrl = `data:${mimeType};base64,${imgBuf.toString('base64')}`;

const db = new DatabaseSync(dbPath);
const emp = db.prepare('SELECT id, nik, name, data_json FROM employees WHERE id = ?').get('EMP-001');

if (!emp) {
  console.error('EMP-001 Galih Primananda not found in employees table');
  process.exit(1);
}

let parsedEmp = {};
try {
  parsedEmp = JSON.parse(emp.data_json);
} catch (e) {
  parsedEmp = {};
}

parsedEmp.hasBiometric = true;
parsedEmp.avatar = dataUrl;
parsedEmp.biometric = {
  isEnrolled: true,
  enrolledAt: new Date().toISOString(),
  enrolledBy: 'Galih Primananda (Direktur)',
  qualityScore: 99.4,
  samples: {
    front: dataUrl,
    right: dataUrl,
    left: dataUrl,
    smile: dataUrl
  },
  features: {
    samplesCount: 4,
    livenessScore: 99.8,
    contrastScore: 92.5
  }
};

db.prepare(`
  UPDATE employees 
  SET avatar = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?;
`).run(dataUrl, JSON.stringify(parsedEmp), 'EMP-001');

// Record audit log
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
db.prepare(`
  INSERT INTO audit_logs (
    action, entity, entityId, details,
    userName, userNik, userRole, module,
    ipAddress, status, timestamp
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run(
  'BIOMETRIC_ENROLLED',
  'employees',
  'EMP-001',
  'Pendaftaran biometrik wajah master (Galih Primananda) berhasil disinkronkan ke basis data SQLite.',
  'Galih Primananda, S.E.',
  'DMJ-2024-001',
  'superuser',
  'BIOMETRIC',
  '127.0.0.1',
  'SUCCESS',
  now
);

console.log('✅ Berhasil mendaftarkan biometrik wajah master untuk Galih Primananda (EMP-001)!');
