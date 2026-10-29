import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = path.resolve('data/hris.sqlite');
console.log('[LOCAL ENROLL] Connecting to database:', dbPath);

const imgPath = path.resolve('galih_enrolled_square.jpg');
if (!fs.existsSync(imgPath)) {
  console.error('File galih_enrolled_square.jpg not found');
  process.exit(1);
}

const imgBuf = fs.readFileSync(imgPath);
const dataUrl = `data:image/jpeg;base64,${imgBuf.toString('base64')}`;

const db = new DatabaseSync(dbPath);
const emp = db.prepare('SELECT id, nik, name, data_json FROM employees WHERE id = ?').get('EMP-001');

if (!emp) {
  console.error('EMP-001 not found');
  process.exit(1);
}

let parsed = {};
try { parsed = JSON.parse(emp.data_json); } catch (e) {}

parsed.hasBiometric = true;
parsed.avatar = dataUrl;
parsed.biometric = {
  isEnrolled: true,
  enrolledAt: new Date().toISOString(),
  enrolledBy: 'Galih Primananda (Direktur)',
  qualityScore: 99.8,
  samples: {
    front: dataUrl,
    right: dataUrl,
    left: dataUrl,
    smile: dataUrl
  },
  features: {
    samplesCount: 4,
    livenessScore: 99.9,
    contrastScore: 95.0
  }
};

db.prepare('UPDATE employees SET avatar = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  .run(dataUrl, JSON.stringify(parsed), 'EMP-001');

console.log('✅ Berhasil update master biometric Galih Primananda di local hris.sqlite!');
