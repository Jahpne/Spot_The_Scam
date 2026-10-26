// Builds data/scam-db.json (and db-repo/scam-db.json) from three sources:
//   1. tools/source/scam-db-v2-original.json   the team's first database (42 rows)
//   2. data.js                                  the 38 game cards
//   3. tools/source/db-extra.json               new entries written for v3
// Duplicates (same text after removing numbers, brands and links) are dropped.
// The held-out and stress test sets are NOT included, so evaluation stays honest.
// Run: node tools/build-db.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require('../data.js');
const DB = require('../db.js');

const root = new URL('..', import.meta.url).pathname;
const read = (p) => JSON.parse(fs.readFileSync(root + p, 'utf8'));
const strip = (t) => t.replace(/\[\[|\]\]/g, '');
const catMap = { link: 'link_scam', secret: 'otp_theft', promise: 'fee_scam', alert: 'fake_alert', imperson: 'impersonation', pos: 'pos_trick', safe: 'safe_notification' };

const rows = [];
for (const s of read('tools/source/scam-db-v2-original.json').scenarios) rows.push({ source: 'team-v2', category: s.category, label: s.label, text: s.text, reason: s.reason });
for (const c of window.SpotData.SCENARIOS) {
  const text = (c.type === 'email' ? `From: ${c.from}\nSubject: ${c.sub}\n\n` : '') + strip(c.body);
  rows.push({ source: 'game-cards', category: catMap[c.cat] || c.cat, label: c.verdict, text, reason: c.why });
}
for (const s of read('tools/source/db-extra.json')) rows.push({ source: 'v3-new', ...s });

const seen = new Set();
const out = [];
let dropped = 0;
for (const r of rows) {
  const key = DB.normalize(r.text);
  if (seen.has(key)) { dropped++; continue; }
  seen.add(key);
  out.push({ id: 'db_' + String(out.length + 1).padStart(4, '0'), category: r.category, label: r.label, text: r.text, reason: r.reason, source: r.source });
}

const db = {
  version: '3.0.0',
  total_scenarios: out.length,
  last_updated: new Date().toISOString().slice(0, 10),
  note: 'Hand-written Nigerian-context examples. Names, numbers and websites are fictional. total_scenarios equals the real number of rows.',
  scenarios: out,
};
const json = JSON.stringify(db, null, 1);
fs.writeFileSync(root + 'data/scam-db.json', json);
fs.mkdirSync(root + 'db-repo', { recursive: true });
fs.writeFileSync(root + 'db-repo/scam-db.json', json);
const by = (k) => out.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
console.log({ rows_in: rows.length, duplicates_dropped: dropped, rows_out: out.length, labels: by('label'), sources: by('source') });
