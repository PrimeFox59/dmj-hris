import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const targetDb = process.argv[2] || 'data/hris.sqlite';
const db = new DatabaseSync(targetDb);

const p = db.prepare('SELECT data_json FROM projects WHERE code = ? OR id = ?').get('PRJ-001', 'PRJ-001');
if (p) {
  const json = JSON.parse(p.data_json);
  json.isHeadOffice = true;
  db.prepare('UPDATE projects SET data_json = ? WHERE code = ? OR id = ?').run(JSON.stringify(json), 'PRJ-001', 'PRJ-001');
  console.log(`[SUCCESS] Updated ${targetDb}: PRJ-001 marked as isHeadOffice = true`);
} else {
  console.warn(`[WARN] PRJ-001 not found in ${targetDb}`);
}

const r = db.prepare('SELECT config_json FROM salary_rules WHERE id = ?').get('default');
if (r) {
  const json = JSON.parse(r.config_json);
  json.officeLatePenaltyPerHour = 50000;
  db.prepare('UPDATE salary_rules SET config_json = ? WHERE id = ?').run(JSON.stringify(json), 'default');
  console.log(`[SUCCESS] Updated ${targetDb}: salary_rules officeLatePenaltyPerHour = 50000`);
}

