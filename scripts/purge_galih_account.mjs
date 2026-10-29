import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const targetDb = process.argv[2] || 'data/hris.sqlite';
console.log(`[PURGE GALIH] Opening database: ${targetDb}`);

if (!fs.existsSync(targetDb)) {
  console.error(`Database not found: ${targetDb}`);
  process.exit(1);
}

const db = new DatabaseSync(targetDb);
const res = db.prepare("DELETE FROM user_accounts WHERE username = 'galih' OR id = 'USR-002';").run();
console.log(`[PURGE GALIH] Deleted rows: ${res.changes}`);

const count = db.prepare("SELECT count(*) as c FROM user_accounts;").get().c;
console.log(`[PURGE GALIH] Total remaining user accounts: ${count}`);

const superusers = db.prepare("SELECT id, username, system_role FROM user_accounts WHERE system_role = 'superuser' OR username IN ('admin', 'galih');").all();
console.log('[PURGE GALIH] Active superuser accounts:', superusers);
