import { spawn } from 'node:child_process';

const receiverScript = `
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const dbPath = '/data/data/com.termux/files/home/prime-hris/data/hris.sqlite';
  const seedPath = '/data/data/com.termux/files/home/prime-hris/data/seedData.json';

  console.log('[POCO] Opening database at ' + dbPath);
  const db = new DatabaseSync(dbPath);

  // Update projects table column allocatedBudget = 0
  db.exec('UPDATE projects SET allocatedBudget = 0;');

  // Update data_json for each project so JSON payload also reflects allocatedBudget = 0
  const rows = db.prepare('SELECT id, data_json FROM projects').all();
  const updateStmt = db.prepare('UPDATE projects SET data_json = ? WHERE id = ?');
  let updatedJsonCount = 0;
  for (const row of rows) {
    try {
      const obj = JSON.parse(row.data_json);
      obj.allocatedBudget = 0;
      updateStmt.run(JSON.stringify(obj), row.id);
      updatedJsonCount++;
    } catch (e) {
      console.error('Failed to parse data_json for row id:', row.id, e);
    }
  }
  console.log('[POCO] Updated allocatedBudget to 0 for ' + updatedJsonCount + ' projects in hris.sqlite');

  // Verify sample project
  const sample = db.prepare('SELECT id, code, name, allocatedBudget FROM projects LIMIT 2').all();
  console.log('[POCO] Sample projects after update:', JSON.stringify(sample));

  // Update seedData.json if it exists on POCO
  if (fs.existsSync(seedPath)) {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    if (seed.INITIAL_PROJECTS) {
      seed.INITIAL_PROJECTS.forEach(p => { p.allocatedBudget = 0; });
      fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf8');
      console.log('[POCO] Updated ' + seed.INITIAL_PROJECTS.length + ' projects in seedData.json');
    }
  }

  console.log('[POCO] Restarting PM2 process: prime-hris...');
  execSync('pm2 restart prime-hris', { stdio: 'inherit' });
  console.log('[POCO] Update and PM2 restart completed successfully.');
} catch (err) {
  console.error('[POCO ERROR]', err);
  process.exit(1);
}
`;

const receiverB64 = Buffer.from(receiverScript).toString('base64');
const remoteCommand = `node -e "eval(Buffer.from('${receiverB64}', 'base64').toString('utf8'))"`;

console.log('[MC18] Connecting to POCO via SSH to update project budgets to 0...');
const proc = spawn('ssh', ['poco', remoteCommand], {
  stdio: 'inherit'
});

proc.on('close', code => {
  console.log('[MC18] Remote script finished with exit code:', code);
});
