/* eval.js | benchmark of Rules vs AI vs AI+DB vs Hybrid on the labelled sets.
   Run from a local server (python3 -m http.server) and open /eval.html in Chrome. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const strip = (t) => t.replace(/\[\[|\]\]/g, '');
  const status = (t) => { $('#status').textContent = t; };
  let sets = null;
  let results = null;

  async function loadSets() {
    if (sets) return sets;
    await DB.load({ remote: false });
    const dev = window.SpotData.SCENARIOS.map((s) => ({ id: s.id, label: s.verdict, text: (s.type === 'email' ? `From: ${s.from}\nSubject: ${s.sub}\n\n` : '') + strip(s.body) }));
    const [heldout, stress] = await Promise.all([fetch('data/heldout.json').then((r) => r.json()), fetch('data/stress.json').then((r) => r.json())]);
    sets = [['Game cards (not independent)', dev], ['Held-out', heldout], ['Stress', stress]];
    return sets;
  }

  /** Examples retrieved from the DB, skipping near-identical rows so the test cannot leak. */
  function leakSafeExamples(text) {
    const hits = DB.nearest(text, 8, 0.1).filter((h) => h.sim < 0.95).slice(0, 4);
    return hits.length >= 2 ? hits.reverse().map((h) => [h.text, h.label === 'scam' ? 'SCAM' : 'REAL']) : undefined;
  }

  function table(title, rows) {
    const wrap = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = title; wrap.append(h);
    const t = document.createElement('table');
    const head = ['Method', 'Accuracy %', 'Accuracy when decided %', 'Unsure %', 'Scam recall %', 'Scams called real', 'False alarms', 'ms / message'];
    t.innerHTML = '<thead><tr>' + head.map((x) => `<th>${x}</th>`).join('') + '</tr></thead>';
    const tb = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      [r.name, r.accuracy, r.decidedAccuracy, r.unsureRate, r.scamRecall, r.scamCalledReal, r.falseAlarms, r.ms ?? '-'].forEach((c) => { const td = document.createElement('td'); td.textContent = c ?? '-'; tr.append(td); });
      tb.append(tr);
    }
    t.append(tb); wrap.append(t);
    return wrap;
  }

  async function run(withAI) {
    const S = await loadSets();
    const out = $('#out'); out.replaceChildren();
    results = { model: AI.MODEL_ID, device: AI.device, dtype: AI.dtype, date: new Date().toISOString(), withAI, sets: {} };
    for (const [name, items] of S) {
      const labels = items.map((x) => x.label);
      const preds = { rules: [], ai: [], aidb: [], hybrid: [] };
      const raw = [];
      let tAi = 0, tDb = 0;
      for (let i = 0; i < items.length; i++) {
        status(`${name}: ${i + 1}/${items.length}`);
        const x = items[i];
        const rules = Checker.analyzeRules(x.text);
        preds.rules.push(rules.verdict);
        if (withAI) {
          let t0 = performance.now();
          const a = await AI.classify(x.text, undefined);
          tAi += performance.now() - t0;
          t0 = performance.now();
          const b = await AI.classify(x.text, leakSafeExamples(x.text));
          tDb += performance.now() - t0;
          preds.ai.push(a.verdict); preds.aidb.push(b.verdict);
          preds.hybrid.push(Checker.combine(rules, b.verdict).verdict);
          raw.push({ id: x.id, label: x.label, rules: rules.verdict, ai: a.verdict, aiRaw: a.raw, aidb: b.verdict, aidbRaw: b.raw });
        }
      }
      const calledReal = (p) => p.filter((v, i) => v === 'real' && labels[i] === 'scam').length;
      const row = (key, label, ms) => ({ name: label, ...Checker.metrics(preds[key], labels), scamCalledReal: calledReal(preds[key]), ms });
      const rows = [row('rules', 'Rules only')];
      if (withAI) {
        rows.push(row('ai', 'AI (fixed examples)', Math.round(tAi / items.length)));
        rows.push(row('aidb', 'AI + database examples', Math.round(tDb / items.length)));
        rows.push(row('hybrid', 'Hybrid (rules + AI + DB)', Math.round(tDb / items.length)));
      }
      results.sets[name] = { n: items.length, rows, raw };
      out.append(table(`${name} (n = ${items.length})`, rows));
    }
    status('Done. Download results.json or copy the markdown table below into docs/EVALUATION.md.');
    $('#export').hidden = false;
    $('#md').hidden = false;
    $('#md').textContent = toMarkdown();
  }

  function toMarkdown() {
    let md = `Model: ${results.model} (${results.device || 'no model loaded'}${results.dtype ? ', ' + results.dtype : ''}), measured ${results.date.slice(0, 10)}\n\n`;
    for (const [name, s] of Object.entries(results.sets)) {
      md += `**${name}** (n = ${s.n})\n\n| Method | Accuracy % | Accuracy when decided % | Unsure % | Scam recall % | Scams called real | False alarms | ms/message |\n|---|---|---|---|---|---|---|---|\n`;
      for (const r of s.rows) md += `| ${r.name} | ${r.accuracy} | ${r.decidedAccuracy ?? '-'} | ${r.unsureRate} | ${r.scamRecall} | ${r.scamCalledReal} | ${r.falseAlarms} | ${r.ms ?? '-'} |\n`;
      md += '\n';
    }
    return md;
  }

  $('#btn-rules').addEventListener('click', () => run(false));
  $('#btn-run').addEventListener('click', () => run(true));
  $('#btn-load').addEventListener('click', async () => {
    $('#meter').hidden = false;
    try {
      await AI.load((p) => { $('#bar').style.width = (p.pct || 0) + '%'; status(p.totalMB ? `Downloading ${p.loadedMB} of ${p.totalMB} MB` : p.text || ''); });
      status(`Model ready (${AI.device}, ${AI.dtype}). Now run the full benchmark.`);
      $('#btn-run').disabled = false;
    } catch (e) { status('Model failed to load: ' + e.message); }
    $('#meter').hidden = true;
  });
  $('#btn-json').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }));
    a.download = 'results.json'; a.click();
  });
  $('#btn-md').addEventListener('click', () => navigator.clipboard.writeText(toMarkdown()).then(() => status('Markdown copied.')));
})();
