/* Online backup of the SQLite database using better-sqlite3's backup API (safe while the server is running).
   Usage:  npm run backup                (writes backups/dsa-log-YYYYMMDD-HHMMSS.db, keeps the newest 7)
           DB_PATH=/var/data/dsa-log.db BACKUP_DIR=/var/data/backups KEEP=14 node scripts/backup.js */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './data/dsa-log.db';
const dir = process.env.BACKUP_DIR || './backups';
const keep = Number(process.env.KEEP) || 7;

async function main() {
  if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // 20261002-153045
  const dest = path.join(dir, `dsa-log-${stamp}.db`);

  const db = new Database(dbPath, { readonly: true });
  try { await db.backup(dest); } finally { db.close(); }

  // sanity check: open the copy and confirm SQLite considers it healthy
  const copy = new Database(dest, { readonly: true });
  const ok = copy.pragma('integrity_check', { simple: true });
  const users = copy.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  copy.close();
  if (ok !== 'ok') throw new Error(`Backup failed the integrity check: ${ok}`);
  console.log(`Backup written: ${dest} (integrity ok, ${users} users)`);

  // retention: delete all but the newest `keep` backups
  const old = fs.readdirSync(dir).filter(f => /^dsa-log-\d{8}-\d{6}\.db$/.test(f)).sort().slice(0, -keep);
  for (const f of old) { fs.unlinkSync(path.join(dir, f)); console.log(`Removed old backup: ${f}`); }
}

main().catch(err => { console.error(`Backup failed: ${err.message}`); process.exit(1); });
