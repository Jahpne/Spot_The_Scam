// Run with:  node tests/run-tests.mjs      (or: npm test)
// No dependencies. Tests the rules engine, link checker, APK assessment and database,
// then prints the measured accuracy of the RULES-ONLY baseline on every labelled set.
// The AI model itself is measured in the browser: open eval.html.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require('../data.js');
const Checker = require('../checker.js');
const DB = require('../db.js');
const Apk = require('../apk.js');

const root = new URL('..', import.meta.url).pathname;
const read = (p) => JSON.parse(fs.readFileSync(root + p, 'utf8'));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message.split('\n')[0]); }
}
const v = (t) => Checker.analyzeRules(t).verdict;

console.log('\nRules engine');
test('asking for an OTP is a hard scam', () => assert.equal(v('Please send the 6-digit code we just texted you'), 'scam'));
test('"never share this code" is NOT treated as a request', () => assert.notEqual(v('Your OTP is 482913. Never share this code with anyone.'), 'scam'));
test('fee to receive money is a hard scam', () => assert.equal(v('Pay a ₦15,000 processing fee to claim your prize'), 'scam'));
test('real debit alert with balance + official channel is real', () => assert.equal(v('Debit Alert: Acct 2***4567 Amt: NGN 5,000.00 Bal: NGN 42,310.55. Call the number on the back of your card.'), 'real'));
test('no signals at all is "unsure", never "real"', () => assert.equal(v('Hello please help me confirm a number, tell me the digits'), 'unsure'));
test('lookalike link is a hard scam', () => assert.equal(v('Update at kora-bvn-update.co/verify'), 'scam'));
test('email sender address is not counted as a body link', () => assert.equal(Checker.analyzeRules('From: Bank <no-reply@korabank.com>\nHello').signals.some((s) => s.id === 'link_present'), false));
test('combine: hard rule beats a wrong model answer', () => assert.equal(Checker.combine(Checker.analyzeRules('send your PIN'), 'real').verdict, 'scam'));
test('combine: model resolves an unsure rules result', () => assert.equal(Checker.combine(Checker.analyzeRules('hello there'), 'scam').verdict, 'scam'));
test('combine: strong trust + model scam stays unsure', () => {
  const r = Checker.analyzeRules('Debit Alert: Acct 2***4567 Bal: NGN 42,310.55. Call the number on the back of your card.');
  assert.equal(Checker.combine(r, 'scam').verdict, 'unsure');
});
test('parseVerdict reads SCAM / REAL / garbage', () => {
  assert.equal(Checker.parseVerdict('SCAM'), 'scam');
  assert.equal(Checker.parseVerdict('Real.'), 'real');
  assert.equal(Checker.parseVerdict('hmm not sure'), 'unsure');
  assert.equal(Checker.parseVerdict(undefined), 'unsure');
});
test('explainMessages accepts a full check() result (regression)', () => {
  assert.doesNotThrow(() => Checker.explainMessages('x', Checker.check('send your PIN', 'scam'), 'en'));
});
test('classifyMessages uses supplied examples', () => {
  const m = Checker.classifyMessages('hi', [['a scam text', 'SCAM'], ['a real text', 'REAL']]);
  assert.equal(m.length, 1 + 4 + 1);
});

console.log('\nLink checker');
test('garbage is not a valid link (regression)', () => assert.equal(Checker.analyzeUrl('not a url !!').valid, false));
test('shortener is flagged', () => assert.ok(['unsure', 'scam'].includes(Checker.analyzeUrl('bit.ly/abc').verdict)));
test('fake brand domain is a hard scam', () => assert.equal(Checker.analyzeUrl('kora-secure-login.info').verdict, 'scam'));
test('official brand domain with /login is clear', () => assert.equal(Checker.analyzeUrl('https://korabank.com/login').verdict, 'clear'));
test('brand hidden in subdomain of evil site is a scam', () => assert.equal(Checker.analyzeUrl('https://secure.korabank.com.evil.xyz/login').verdict, 'scam'));
test('IP address host is a scam', () => assert.equal(Checker.analyzeUrl('http://192.168.1.5/bank').verdict, 'scam'));
test('user@host trick is a scam', () => assert.equal(Checker.analyzeUrl('http://korabank.com@evil.top').verdict, 'scam'));

console.log('\nAPK assessment');
test('SMS reading + accessibility = banking-trojan pattern', () => assert.equal(Apk.assess(['android.permission.READ_SMS', 'android.permission.BIND_ACCESSIBILITY_SERVICE'], 'a.apk').verdict, 'scam'));
test('harmless permissions are clear', () => assert.equal(Apk.assess(['android.permission.INTERNET'], 'notes.apk').verdict, 'clear'));
test('findPermissions reads UTF-16 strings', () => {
  const b = Buffer.concat([Buffer.from([3, 0, 8, 0]), Buffer.from('android.permission.READ_SMS', 'utf16le')]);
  assert.deepEqual(Apk.findPermissions(new Uint8Array(b)), ['android.permission.READ_SMS']);
});

console.log('\nDatabase');
const dbJson = read('data/scam-db.json');
test('total_scenarios equals real row count (no fake counts)', () => assert.equal(dbJson.total_scenarios, dbJson.scenarios.length));
test('every row has text and a valid label', () => assert.ok(dbJson.scenarios.every((s) => s.text && (s.label === 'scam' || s.label === 'real'))));
test('no duplicate templates', () => {
  const keys = dbJson.scenarios.map((s) => DB.normalize(s.text));
  assert.equal(new Set(keys).size, keys.length);
});
test('db-repo copy matches bundled copy', () => assert.equal(fs.readFileSync(root + 'db-repo/scam-db.json', 'utf8'), fs.readFileSync(root + 'data/scam-db.json', 'utf8')));
test('validate drops malformed rows', () => {
  const ok = DB.validate({ version: '1.0.0', scenarios: [{ text: 'a', label: 'scam' }, { text: 'b', label: 'maybe' }, { text: 5, label: 'real' }, null] });
  assert.equal(ok.entries.length, 1);
});
test('newer() compares versions', () => { assert.ok(DB.newer('3.0.0', '2.9.9')); assert.ok(!DB.newer('1.0.0', '1.0.0')); });
DB.use(dbJson, 'bundled');
test('nearest finds a similar OTP-theft example', () => assert.equal(DB.nearest('Please read out the 6-digit code sent to your phone', 1, 0.1)[0].label, 'scam'));

console.log('\nTest-set integrity (no leakage)');
const strip = (t) => t.replace(/\[\[|\]\]/g, '');
const dev = window.SpotData.SCENARIOS.map((s) => ({ id: s.id, label: s.verdict, text: (s.type === 'email' ? `From: ${s.from}\nSubject: ${s.sub}\n\n` : '') + strip(s.body) }));
const heldout = read('data/heldout.json');
const stress = read('data/stress.json');
const dbKeys = new Set(dbJson.scenarios.map((s) => DB.normalize(s.text)));
test('held-out set is not inside the database', () => assert.ok(heldout.every((h) => !dbKeys.has(DB.normalize(h.text)))));
test('stress set is not inside the database', () => assert.ok(stress.every((h) => !dbKeys.has(DB.normalize(h.text)))));
test('no near-duplicates (>=0.8) between test sets and database', () => {
  for (const h of heldout.concat(stress)) assert.ok((DB.nearest(h.text, 1, 0)[0] || { sim: 0 }).sim < 0.8, h.id);
});

console.log('\nRules-only baseline (measured)');
const sets = [
  ['Game cards (38) - used to build the rules, NOT independent', dev],
  ['Held-out (40) - written before the rules', heldout],
  ['Stress (30) - written to break the rules', stress],
];
const results = {};
for (const [name, set] of sets) {
  const preds = set.map((x) => v(x.text));
  const m = Checker.metrics(preds, set.map((x) => x.label));
  const scamCalledReal = preds.filter((p, i) => p === 'real' && set[i].label === 'scam').length;
  results[name] = { ...m, scamCalledReal };
  console.log(`  ${name}\n     accuracy ${m.accuracy}% | unsure ${m.unsureRate}% | accuracy when decided ${m.decidedAccuracy}% | scam recall ${m.scamRecall}% | scams called "real": ${scamCalledReal} | false alarms: ${m.falseAlarms}`);
}
test('rules never call a scam "real" on any labelled set (safety property)', () => {
  for (const r of Object.values(results)) assert.equal(r.scamCalledReal, 0);
});
fs.writeFileSync(root + 'docs/results-rules-only.json', JSON.stringify({ measured: new Date().toISOString().slice(0, 10), results }, null, 2));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
