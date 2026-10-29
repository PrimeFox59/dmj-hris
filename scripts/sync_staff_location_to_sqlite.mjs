import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.argv[2] || 'data/hris.sqlite';
const seedPath = process.argv[3] || 'data/seedData.json';

console.log(`[SYNC LOCATION & LEAVE] Target DB: ${dbPath}`);
console.log(`[SYNC LOCATION & LEAVE] Seed JSON: ${seedPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`[ERROR] Database file not found at: ${dbPath}`);
  process.exit(1);
}

if (!fs.existsSync(seedPath)) {
  console.error(`[ERROR] Seed file not found at: ${seedPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

const updateStmt = db.prepare(`
  UPDATE employees 
  SET data_json = ?, updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?;
`);

const getStmt = db.prepare('SELECT data_json, avatar FROM employees WHERE id = ?');

let updatedNonLokal = 0;
let updatedLokal = 0;

for (const emp of seed.INITIAL_EMPLOYEES || []) {
  if (emp.workLocationType === 'NON_LOKAL') {
    updatedNonLokal++;
  } else {
    updatedLokal++;
  }
  
  let merged = { ...emp };
  const existingRow = getStmt.get(emp.id);
  if (existingRow) {
    try {
      const existingData = JSON.parse(existingRow.data_json);
      if (existingData.biometric) {
        merged.biometric = existingData.biometric;
        merged.hasBiometric = true;
      }
      if (existingData.avatar && !merged.avatar) {
        merged.avatar = existingData.avatar;
      }
    } catch (e) {}
  }

  updateStmt.run(JSON.stringify(merged), emp.id);
}

console.log(`[SUCCESS] Database updated successfully from seed:`);
console.log(`  - Non-Lokal Staff: ${updatedNonLokal}`);
console.log(`  - Lokal Staff: ${updatedLokal}`);
