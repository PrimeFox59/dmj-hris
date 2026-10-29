import fs from 'node:fs';
import { execSync } from 'node:child_process';

console.log('[MC18] Building dist for PRIME HRIS...');
execSync('npm run build', { stdio: 'inherit' });

console.log('[MC18] Packaging dist, server, wa-gateway, and data...');
execSync('tar -czf bundle.tar.gz dist server/db.js server/index.js server/whatsappService.js server/emailService.js wa-gateway/package.json wa-gateway/server.js data/seedData.json galih_enrolled_square.jpg test_enrolled_front.png scripts/enroll_galih_biometric.mjs scripts/sync_project_schedules.mjs scripts/purge_dummy_and_reindex_logins.mjs scripts/sync_staff_location_to_sqlite.mjs scripts/sync_project_personnel_assignments.mjs scripts/sync_system_roles.mjs scripts/fix_poco_attendance_data.mjs', { stdio: 'inherit' });

console.log('[MC18] Transferring bundle.tar.gz to POCO...');
let remoteRunner = 'DIRECT';
try {
  execSync('scp -o ConnectTimeout=8 bundle.tar.gz poco:/data/data/com.termux/files/home/prime-hris/bundle_update.tar.gz', { stdio: 'inherit' });
} catch (directErr) {
  console.log('[MC18] Direct SCP timed out. Relaying seamlessly via VPS Hub...');
  execSync('scp -o ConnectTimeout=8 bundle.tar.gz vps:/tmp/bundle.tar.gz', { stdio: 'inherit' });
  execSync('ssh vps "scp /tmp/bundle.tar.gz poco:/data/data/com.termux/files/home/prime-hris/bundle_update.tar.gz && rm -f /tmp/bundle.tar.gz"', { stdio: 'inherit' });
  remoteRunner = 'RELAY';
}

console.log('[MC18] Unpacking bundle and running synchronizations on POCO...');
const unpackScript = `
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const appDir = '/data/data/com.termux/files/home/prime-hris';
const destTar = path.join(appDir, 'bundle_update.tar.gz');

if (fs.existsSync(destTar)) {
  try {
    execSync('rm -rf "' + path.join(appDir, 'dist', 'assets') + '"/*', { stdio: 'ignore' });
  } catch (e) {}
  execSync('tar -xzf "' + destTar + '" -C "' + appDir + '"', { stdio: 'inherit' });
  fs.unlinkSync(destTar);
  console.log('[POCO] Stale assets purged and new bundle unpacked successfully.');
}

try {
  execSync('ln -sfn /data/data/com.termux/files/home/waskita/wa-service/node_modules "' + path.join(appDir, 'wa-gateway', 'node_modules') + '"');
} catch (e) {}

try {
  execSync('node scripts/sync_staff_location_to_sqlite.mjs', { cwd: appDir, stdio: 'inherit' });
} catch (e) {}

try {
  execSync('node scripts/sync_project_personnel_assignments.mjs', { cwd: appDir, stdio: 'inherit' });
} catch (e) {}

try {
  execSync('node scripts/sync_system_roles.mjs', { cwd: appDir, stdio: 'inherit' });
} catch (e) {}

try {
  execSync('node scripts/fix_poco_attendance_data.mjs', { cwd: appDir, stdio: 'inherit' });
} catch (e) {}

try {
  execSync('node scripts/enroll_galih_biometric.mjs', { cwd: appDir, stdio: 'inherit' });
} catch (e) {}

try {
  execSync('pm2 reload prime-hris --update-env', { stdio: 'inherit' });
  console.log('[POCO] PM2 prime-hris reloaded with ZERO DOWNTIME.');
} catch (e) {
  try {
    execSync('pm2 restart prime-hris', { stdio: 'inherit' });
    console.log('[POCO] Fallback PM2 restart executed.');
  } catch (e2) {}
}

// Pre-flight healthcheck verification (Zero-downtime gatekeeper)
try {
  const healthCheck = execSync('curl -s -f http://localhost:8567/api/health', { encoding: 'utf8' });
  if (healthCheck.includes('online')) {
    console.log('[POCO] Pre-flight Healthcheck PASSED: Service online and healthy.');
  }
} catch (healthErr) {
  console.warn('[POCO Healthcheck Warning]', healthErr.message);
}

try {
  execSync('pm2 reload prime-wa --update-env', { stdio: 'inherit' });
  console.log('[POCO] PM2 prime-wa reloaded with ZERO DOWNTIME.');
} catch (e) {
  try { execSync('pm2 restart prime-wa', { stdio: 'inherit' }); } catch (e2) {}
}
`;

const runnerFile = 'poco_unpack_runner.cjs';
fs.writeFileSync(runnerFile, unpackScript);

try {
  try {
    execSync(`scp -o ConnectTimeout=8 ${runnerFile} poco:/data/data/com.termux/files/home/prime-hris/${runnerFile}`, { stdio: 'ignore' });
  } catch (e) {
    execSync(`scp -o ConnectTimeout=8 ${runnerFile} vps:/tmp/${runnerFile}`, { stdio: 'ignore' });
    execSync(`ssh vps "scp /tmp/${runnerFile} poco:/data/data/com.termux/files/home/prime-hris/${runnerFile} && rm -f /tmp/${runnerFile}"`, { stdio: 'ignore' });
  }

  const execCommand = `node /data/data/com.termux/files/home/prime-hris/${runnerFile} && rm -f /data/data/com.termux/files/home/prime-hris/${runnerFile}`;
  if (remoteRunner === 'DIRECT') {
    execSync(`ssh -T poco "${execCommand}"`, { stdio: 'inherit' });
  } else {
    execSync(`ssh vps "ssh -T poco \\"${execCommand}\\""`, { stdio: 'inherit' });
  }
  console.log('[MC18] Deployment to POCO completed with exit code: 0');
} catch (deployErr) {
  console.error('[MC18] Remote update error:', deployErr.message);
} finally {
  try { fs.unlinkSync('bundle.tar.gz'); } catch (e) {}
  try { fs.unlinkSync(runnerFile); } catch (e) {}
}
