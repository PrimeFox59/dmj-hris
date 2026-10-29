import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const scratchDir = 'C:/Users/PRIMA/.gemini/antigravity-cli/brain/98fe2df0-d23d-47ef-a9d7-c45f4893fd58/scratch';
const projFile = path.join(scratchDir, 'new_master_projects.json');

if (!fs.existsSync(projFile)) {
  console.error('[ERROR] File not found:', projFile);
  process.exit(1);
}

const projs = JSON.parse(fs.readFileSync(projFile, 'utf8'));
const targetDb = process.argv[2] || 'data/hris.sqlite';
const db = new DatabaseSync(targetDb);

db.exec('DELETE FROM projects;');

const insert = db.prepare(`
  INSERT INTO projects (
    id, code, name, client, location, status,
    startDate, targetEndDate, allocatedBudget, actualLaborCost,
    projectedLaborCost, totalEstimatedHours, actualHoursSpent,
    hourlyRateMultiplier, data_json, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
`);

for (const proj of projs) {
  insert.run(
    proj.id, proj.code, proj.name, proj.client || 'PT Prime Infinity Systems', proj.location || 'Site Lapangan', proj.status || 'ACTIVE',
    proj.startDate || '2024-01-01', proj.targetEndDate || '2027-12-31',
    proj.allocatedBudget || 0, proj.actualLaborCost || 0, proj.projectedLaborCost || 0,
    proj.totalEstimatedHours || 0, proj.actualHoursSpent || 0, proj.hourlyRateMultiplier || 1,
    JSON.stringify(proj)
  );
}

console.log(`[SUCCESS] Inserted ${projs.length} projects into ${targetDb}.`);
