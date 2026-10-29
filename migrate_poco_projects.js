import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const scratchDir = 'C:/Users/PRIMA/.gemini/antigravity-cli/brain/98fe2df0-d23d-47ef-a9d7-c45f4893fd58/scratch';
const projectsJson = fs.readFileSync(path.join(scratchDir, 'new_master_projects.json'), 'utf8');
const employeesJson = fs.readFileSync(path.join(scratchDir, 'new_assigned_employees.json'), 'utf8');
const migrationScript = fs.readFileSync(path.join(scratchDir, 'execute_project_migration.js'), 'utf8');

const payload = JSON.stringify({
  projectsJson,
  employeesJson,
  migrationScript
});

const b64Data = Buffer.from(payload).toString('base64');
console.log(`[MC18] Prepared migration payload: ${b64Data.length} chars`);

const receiver = `
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

let b64 = '';
process.stdin.on('data', chunk => { b64 += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(Buffer.from(b64.trim(), 'base64').toString('utf8'));
    const workDir = '/data/data/com.termux/files/home/prime-hris';
    const projPath = path.join(workDir, 'temp_projects.json');
    const empPath = path.join(workDir, 'temp_employees.json');
    const migPath = path.join(workDir, 'temp_migrate.cjs');
    const dbPath = path.join(workDir, 'data', 'hris.sqlite');

    fs.writeFileSync(projPath, data.projectsJson, 'utf8');
    fs.writeFileSync(empPath, data.employeesJson, 'utf8');
    fs.writeFileSync(migPath, data.migrationScript, 'utf8');

    console.log('[POCO] Running migration script...');
    execSync('node "' + migPath + '" "' + dbPath + '" "' + projPath + '" "' + empPath + '"', { stdio: 'inherit' });

    // Cleanup temp files
    fs.unlinkSync(projPath);
    fs.unlinkSync(empPath);
    fs.unlinkSync(migPath);

    console.log('[POCO] Restarting PM2 process: prime-hris...');
    execSync('pm2 restart prime-hris', { stdio: 'inherit' });
    console.log('[POCO] Migration and restart completed successfully!');
  } catch (err) {
    console.error('[POCO ERROR]', err);
    process.exit(1);
  }
});
`;

const receiverB64 = Buffer.from(receiver).toString('base64');
const remoteCommand = `node -e "eval(Buffer.from('${receiverB64}', 'base64').toString('utf8'))"`;

console.log('[MC18] Streaming migration to POCO via SSH...');
const proc = spawn('ssh', ['poco', remoteCommand], {
  stdio: ['pipe', 'inherit', 'inherit']
});

proc.stdin.write(b64Data);
proc.stdin.end();

proc.on('close', code => {
  console.log('[MC18] Migration pipeline exited with code:', code);
});
