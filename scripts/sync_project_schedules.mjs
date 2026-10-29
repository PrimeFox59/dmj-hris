import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const targetDbPath = process.argv[2] || 'data/hris.sqlite';
const seedJsonPath = 'data/seedData.json';

console.log(`[PROJECT SYNC] Updating project schedules on: ${targetDbPath}`);

if (!fs.existsSync(targetDbPath)) {
  console.error(`[PROJECT SYNC ERROR] Database file not found: ${targetDbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(targetDbPath);

// Defined project schedules
const PROJECT_RULES = {
  'PRIME-ENG-01': {
    name: 'Konstruksi Pabrik & Instalasi Mekanikal Smelter',
    client: 'PT Freeport Indonesia (Smelter Manyar)',
    location: 'Kawasan Industri Terpadu Manyar, Gresik',
    workSchedule: {
      enabled: true,
      workDays: 6,
      checkInTime: '07:00',
      checkOutTime: '16:30',
      lateGraceMinutes: 15,
      saturdayWork: true,
      saturdayCheckIn: '07:00',
      saturdayCheckOut: '12:00',
      allowFlexibleHours: false
    }
  },
  'PRIME-MINING-02': {
    name: 'Overhaul & Maintenance Alat Berat Tambang Pomalaa',
    client: 'PT Vale Indonesia Tbk (Mining Service)',
    location: 'Site Pomalaa, Kolaka, Sulawesi Tenggara',
    workSchedule: {
      enabled: true,
      workDays: 6,
      checkInTime: '06:30',
      checkOutTime: '16:00',
      lateGraceMinutes: 10,
      saturdayWork: true,
      saturdayCheckIn: '06:30',
      saturdayCheckOut: '11:30',
      allowFlexibleHours: false
    }
  },
  'PRIME-CIVIL-03': {
    name: 'Pembangunan Pergudangan & Workshop Logistik PRIME',
    client: 'PT Pakarti Riken Indonesia (Expansion)',
    location: 'Kawasan Workshop Utama PRIME, Jawa Timur',
    workSchedule: {
      enabled: true,
      workDays: 6,
      checkInTime: '07:30',
      checkOutTime: '16:30',
      lateGraceMinutes: 15,
      saturdayWork: true,
      saturdayCheckIn: '07:30',
      saturdayCheckOut: '12:30',
      allowFlexibleHours: false
    }
  },
  'PRIME-PLANT-04': {
    name: 'Fabrikasi Struktur Baja & Piping System Pabrik PRIME',
    client: 'PRIME Enterprise (Divisi Industrial Plant)',
    location: 'Workshop Fabrikasi Pusat PRIME',
    workSchedule: {
      enabled: true,
      workDays: 5,
      checkInTime: '08:00',
      checkOutTime: '17:00',
      lateGraceMinutes: 15,
      saturdayWork: false,
      allowFlexibleHours: false
    }
  }
};

// 1. Update projects table
const existingProjects = db.prepare('SELECT id, data_json FROM projects;').all();
const updateProjStmt = db.prepare('UPDATE projects SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;');

for (const p of existingProjects) {
  const rule = PROJECT_RULES[p.id];
  let d = {};
  try { d = JSON.parse(p.data_json); } catch (e) { d = {}; }
  if (rule) {
    d.name = rule.name;
    d.client = rule.client;
    d.location = rule.location;
    d.customRules = {
      ...d.customRules,
      workSchedule: rule.workSchedule
    };
    updateProjStmt.run(JSON.stringify(d), p.id);
    console.log(`[PROJECT SYNC] Updated workSchedule for ${p.id}: In=${rule.workSchedule.checkInTime}, Out=${rule.workSchedule.checkOutTime}, Grace=${rule.workSchedule.lateGraceMinutes}m`);
  }
}

// 2. Normalize assignedProjectId in employees table
const empRows = db.prepare('SELECT id, assignedProjectId, data_json FROM employees;').all();
const updateEmpProjStmt = db.prepare('UPDATE employees SET assignedProjectId = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;');

let normalizedCount = 0;
for (const emp of empRows) {
  let pid = (emp.assignedProjectId || '').trim();
  let changed = false;

  if (pid.startsWith('DMJ-ENG-01') || pid === 'PRJ-001') {
    pid = 'PRIME-ENG-01';
    changed = true;
  } else if (pid.startsWith('DMJ-MINING-02')) {
    pid = 'PRIME-MINING-02';
    changed = true;
  } else if (pid.startsWith('DMJ-CIVIL-03')) {
    pid = 'PRIME-CIVIL-03';
    changed = true;
  } else if (pid.startsWith('DMJ-PLANT-04')) {
    pid = 'PRIME-PLANT-04';
    changed = true;
  }

  if (changed || pid !== emp.assignedProjectId) {
    let d = {};
    try { d = JSON.parse(emp.data_json); } catch (e) { d = {}; }
    d.assignedProjectId = pid;
    updateEmpProjStmt.run(pid, JSON.stringify(d), emp.id);
    normalizedCount++;
  }
}

console.log(`[PROJECT SYNC] Normalized assignedProjectId for ${normalizedCount} employees.`);

// 3. Update seedData.json if exists
if (fs.existsSync(seedJsonPath)) {
  try {
    const seed = JSON.parse(fs.readFileSync(seedJsonPath, 'utf8'));
    const allProjsInDb = db.prepare('SELECT data_json FROM projects;').all();
    seed.INITIAL_PROJECTS = allProjsInDb.map(p => JSON.parse(p.data_json));
    
    const allEmpsInDb = db.prepare('SELECT data_json FROM employees ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) ASC;').all();
    seed.INITIAL_EMPLOYEES = allEmpsInDb.map(e => JSON.parse(e.data_json));

    fs.writeFileSync(seedJsonPath, JSON.stringify(seed, null, 2), 'utf8');
    console.log(`[PROJECT SYNC] Successfully synced seedData.json.`);
  } catch (err) {
    console.warn(`[PROJECT SYNC WARNING] Failed to sync seedData.json:`, err.message);
  }
}

console.log('[PROJECT SYNC COMPLETED SUCCESSFULLY]');
