/* ==========================================================================
   scan.js  |  SPOT THE SCAM  |  Scam Checker screen
   Three tabs: Message, Link, APK file.

   Message flow (progressive, so the user never waits on the AI):
     1. rules + database answer instantly
     2. if the AI is on: retrieve similar cases from the database, ask the
        model for a one-word verdict, combine it with the rules
     3. then the model writes a short plain-language explanation

   Security: all dynamic text (including anything from the remote database)
   is inserted with textContent / text nodes. Never innerHTML.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const PREF_KEY = 'spotscam:scan';

  const EXAMPLES = [
    'KORA-BANK: Dear customer, your account will be blocked in 24 hours. Verify your BVN at kora-verify.top now.',
    'Debit Alert: Acct 3***8821 Amt: NGN 5,000.00 Desc: POS purchase Bal: NGN 42,310.55. If you did not make this transaction, call the number on the back of your card.',
    "Good afternoon sir, we are updating our customer records. Kindly reply with your date of birth, mother's maiden name and account number.",
  ];

  /* ---------- tiny helpers ---------- */
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const kid of kids) if (kid) n.append(kid);
    return n;
  }

  let prefs = { lang: 'en' };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch (e) { /* ignore */ }
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
  const S = () => Checker.STR[prefs.lang] || Checker.STR.en;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function banner(kind, title, sub) {
    return el('div', { class: 'banner v-' + kind }, el('div', { class: 'b-title', text: title }), sub ? el('div', { class: 'b-sub', text: sub }) : null);
  }
  function list(items, cls) {
    const ul = el('ul', { class: 'why-list ' + (cls || '') });
    items.forEach((t) => ul.append(el('li', { text: t })));
    return ul;
  }
  function section(title, ...kids) {
    return el('div', { class: 'res-sec' }, el('h4', { text: title }), ...kids);
  }

  /** Original text with the matched phrases highlighted. */
  function highlighted(text, ranges, kind) {
    const box = el('div', { class: 'msg-hl' });
    let pos = 0;
    for (const [a, b] of ranges) {
      if (a > pos) box.append(document.createTextNode(text.slice(pos, a)));
      box.append(el('mark', { class: kind === 'real' ? 'real' : 'scam', text: text.slice(a, b) }));
      pos = b;
    }
    if (pos < text.length) box.append(document.createTextNode(text.slice(pos)));
    return box;
  }

  function shareText(text) {
    if (navigator.share) navigator.share({ title: 'Spot the Scam', text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied. Paste it anywhere.'), () => toast(text));
    else toast(text);
  }

  /* ---------- status chips ---------- */
  function updateChips() {
    const d = DB.status;
    const dbChip = $('#db-chip');
    dbChip.textContent = d.count ? `Database v${d.version}: ${d.count} entries (${d.source})` : 'Database: loading';
    dbChip.title = 'Remote database: ' + d.remote;

    const a = AI;
    const aiChip = $('#ai-chip');
    aiChip.className = 'chip ' + (a.state === 'ready' ? 'on' : '');
    aiChip.textContent = a.state === 'ready' ? `AI: on (${a.device}${a.dtype && a.dtype !== '-' ? ', ' + a.dtype : ''})` : a.state === 'loading' ? 'AI: loading' : a.state === 'error' ? 'AI: failed' : 'AI: off';
    $('#btn-ai-on').hidden = a.state === 'ready' || a.state === 'loading';
  }

  /* ---------- MESSAGE TAB ---------- */
  let runId = 0;

  function renderMessage(text, res, near, ai) {
    const L = S();
    const v = res.verdict;
    const subBits = [L.conf[res.confidence], res.source];
    const out = $('#scan-result');
    out.replaceChildren();

    out.append(banner(v, L.verdict[v], subBits.join(' | ')));
    if (res.source === 'hard rule') out.append(el('p', { class: 'fine dim', text: 'Caught by a hard rule: this pattern is a scam however the message is worded.' }));

    out.append(highlighted(text, res.ranges, v));

    const why = [];
    const risks = res.rules.risk.map((s) => L.signals[s.id]).filter(Boolean);
    const trusts = res.rules.trust.map((s) => L.signals[s.id]).filter(Boolean);
    if (v === 'real') why.push(...trusts);
    else why.push(...risks);
    if (v === 'unsure') why.push(...trusts);
    if (why.length) out.append(section(v === 'real' ? 'Why it looks genuine' : 'Why', list(why, v === 'real' ? 'good' : 'bad')));
    else out.append(section('Why', el('p', { class: 'dim', text: 'No clear red flags, but nothing here proves the message is genuine either. When in doubt, check with your bank on a number you already trust.' })));

    out.append(section('What to do', el('p', { text: L.advice[v] })));

    // database neighbours
    if (near.length) {
      const wrap = el('div', { class: 'near' });
      near.forEach((n) => wrap.append(el('div', { class: 'near-item' },
        el('span', { class: 'tag ' + n.label, text: n.label + ' ' + Math.round(n.sim * 100) + '% similar' }),
        el('div', { class: 'near-text', text: n.text.length > 160 ? n.text.slice(0, 160) + '...' : n.text }),
        n.reason ? el('div', { class: 'fine dim', text: n.reason }) : null)));
      out.append(section('Similar known cases in the database', wrap));
    }

    // AI block
    const box = el('div', { class: 'ai-block' });
    if (ai.state === 'idle') {
      box.append(el('p', { class: 'dim', text: 'Turn on the AI (above) for a second opinion and a plain-language explanation. Without it, the checker uses rules and the database only.' }));
    } else if (ai.state === 'thinking') {
      box.append(el('p', { class: 'dim', text: 'The AI is reading the message...' }));
    } else if (ai.state === 'error') {
      box.append(el('p', { class: 'dim', text: 'The AI could not answer (' + ai.error + '). Showing rules and database only.' }));
    } else {
      box.append(el('p', { class: 'ai-verdict', text: 'AI second opinion: ' + (ai.verdict === 'unsure' ? 'not sure' : ai.verdict.toUpperCase()) }));
      box.append(el('p', { class: 'dim', text: ai.explanation ? '' : 'The AI is writing an explanation...' }));
      if (ai.explanation) { box.lastChild.remove(); box.append(el('p', { class: 'fine dim', text: L.aiNote }), el('p', { text: ai.explanation })); }
    }
    out.append(section('AI', box));

    const flags = (v === 'real' ? trusts : risks).slice(0, 2);
    out.append(el('div', { class: 'row-btns' },
      el('button', { class: 'btn', id: 'btn-warn', text: 'Warn a friend' }),
      el('button', { class: 'btn ghost', id: 'btn-clear', text: 'Clear' })));
    $('#btn-warn').addEventListener('click', () => shareText(L.warn(v, flags)));
    $('#btn-clear').addEventListener('click', () => { out.replaceChildren(); $('#scan-input').value = ''; });
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function checkMessage() {
    const text = $('#scan-input').value.trim();
    if (!text) { toast('Paste a message first'); return; }
    const id = ++runId;
    updateChips();
    const near = DB.entries.length ? DB.nearest(text, 2, 0.3) : [];
    let res = Checker.check(text, null);

    if (AI.state !== 'ready') { renderMessage(text, res, near, { state: 'idle' }); return; }

    renderMessage(text, res, near, { state: 'thinking' });
    try {
      const { verdict } = await AI.classify(text, DB.examplesFor(text, 4));
      if (id !== runId) return;
      res = Checker.check(text, verdict);
      renderMessage(text, res, near, { state: 'done', verdict, explanation: '' });
      const explanation = await AI.explain(text, res, prefs.lang);
      if (id !== runId) return;
      renderMessage(text, res, near, { state: 'done', verdict, explanation });
    } catch (e) {
      if (id !== runId) return;
      console.warn('[ai]', e);
      renderMessage(text, res, near, { state: 'error', error: (e && e.message) || 'unknown error' });
    }
  }

  /* ---------- LINK TAB ---------- */
  function checkLink() {
    const raw = $('#url-input').value.trim();
    const out = $('#scan-result');
    out.replaceChildren();
    if (!raw) { toast('Paste a link first'); return; }
    const r = Checker.analyzeUrl(raw);
    if (!r.valid) { out.append(banner('unsure', 'That does not look like a web address', 'Check the spelling and try again.')); return; }
    const L = S();
    out.append(banner(r.verdict, L.urlVerdict[r.verdict], 'Website: ' + r.host));
    const items = r.signals.map((s) => L.urlSignals[s.id]).filter(Boolean);
    if (items.length) out.append(section('Why', list(items, 'bad')));
    out.append(section('What to do', el('p', { text: L.urlAdvice[r.verdict] })));
    out.append(el('p', { class: 'fine dim', text: 'Offline address check only. It cannot see the website, its security certificate, or how old the site is.' }));
  }

  /* ---------- APK TAB ---------- */
  async function checkApk() {
    const file = $('#apk-input').files[0];
    const out = $('#scan-result');
    out.replaceChildren();
    if (!file) { toast('Choose an APK file first'); return; }
    out.append(el('p', { class: 'dim', text: 'Reading file on your device...' }));
    const r = await Apk.inspect(file);
    out.replaceChildren();
    if (!r.ok) { out.append(banner('unsure', 'Could not check this file', r.error)); return; }

    const titles = { scam: 'Very risky app', unsure: 'Be careful with this app', clear: 'No high-risk permissions found' };
    const adv = {
      scam: 'Do not install it. Real banks never send app files on WhatsApp, text or email. Get apps only from the Play Store or the link on your bank\'s official website.',
      unsure: 'Only install it if you got it from the Play Store or a source you trust completely, and the permissions make sense for what the app does.',
      clear: 'That is only a permission check, not antivirus. Install apps from the Play Store or your bank\'s official page only.',
    };
    out.append(banner(r.verdict, titles[r.verdict], `${r.name} (${(r.size / 1048576).toFixed(1)} MB, ${r.signed ? 'signed' : 'not signed'}, ${r.dex} code file${r.dex === 1 ? '' : 's'})`));
    if (r.trojanCombo) out.append(el('p', { class: 'fine dim', text: 'This app can read your SMS and also watch your screen or notifications. That combination is how banking trojans steal OTPs.' }));
    if (r.risky.length) out.append(section('Risky permissions', list(r.risky.map((x) => x.perm.replace('android.permission.', '') + ': ' + x.why), 'bad')));
    else out.append(section('Risky permissions', el('p', { class: 'dim', text: 'None of the high-risk permissions we look for.' })));
    const d = el('details', { class: 'perm-all' }, el('summary', { text: `All ${r.perms.length} permissions found` }), list(r.perms.map((p) => p.replace('android.permission.', '')), ''));
    out.append(d);
    out.append(section('What to do', el('p', { text: adv[r.verdict] })));
    out.append(el('p', { class: 'fine dim', text: 'The file was read on your phone and not uploaded. This checks permissions only. It does not scan the code.' }));
  }

  /* ---------- AI box ---------- */
  async function turnOnAI() {
    if (!AI.supported()) { toast('This browser cannot run the AI model'); return; }
    const bar = $('#ai-bar'), wrap = $('#ai-progress'), st = $('#ai-status');
    wrap.hidden = false;
    st.textContent = 'Starting...';
    updateChips();
    try {
      await AI.load((p) => {
        bar.style.width = (p.pct || 0) + '%';
        st.textContent = p.totalMB ? `Downloading model: ${p.loadedMB} of ${p.totalMB} MB (${p.pct}%)` : p.text || '';
      });
      st.textContent = 'AI is ready. It now runs on your device.';
      try { prefs.ai = true; savePrefs(); } catch (e) { /* ignore */ }
    } catch (e) {
      st.textContent = 'The AI could not start: ' + ((e && e.message) || 'unknown error') + '. The checker still works with rules and the database.';
    }
    wrap.hidden = AI.state === 'ready';
    updateChips();
  }

  /** If the model files are already cached, start quietly. Never starts a fresh big download by itself. */
  async function maybeWarmStart() {
    try {
      if (!prefs.ai || !('caches' in window) || !(await caches.has('transformers-cache'))) return;
      await AI.load(() => {});
      $('#ai-status').textContent = 'AI is ready. It runs on your device.';
    } catch (e) { /* user can tap the button */ }
    updateChips();
  }

  /* ---------- tabs ---------- */
  function setTab(name) {
    for (const t of ['msg', 'url', 'apk']) {
      $('#pane-' + t).hidden = t !== name;
      const b = $('#tab-' + t);
      b.classList.toggle('active', t === name);
      b.setAttribute('aria-selected', String(t === name));
    }
    $('#scan-result').replaceChildren();
  }

  function onShow() { updateChips(); }

  /** Open the checker with a message already filled in (used by the game). */
  function openWithText(text) {
    setTab('msg');
    $('#scan-input').value = text;
    window.SpotApp.show('scan');
    checkMessage();
  }

  function init() {
    $('#tab-msg').addEventListener('click', () => setTab('msg'));
    $('#tab-url').addEventListener('click', () => setTab('url'));
    $('#tab-apk').addEventListener('click', () => setTab('apk'));
    $('#btn-check-msg').addEventListener('click', checkMessage);
    $('#btn-check-url').addEventListener('click', checkLink);
    $('#btn-check-apk').addEventListener('click', checkApk);
    $('#btn-ai-on').addEventListener('click', turnOnAI);
    $('#scan-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) checkMessage(); });
    $('#url-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkLink(); });
    document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => { $('#scan-input').value = EXAMPLES[Number(b.dataset.example)]; checkMessage(); }));

    const pcm = $('#opt-pcm');
    pcm.checked = prefs.lang === 'pcm';
    pcm.addEventListener('change', () => { prefs.lang = pcm.checked ? 'pcm' : 'en'; savePrefs(); });

    updateChips();
    DB.load().then(updateChips).catch(() => updateChips());
    maybeWarmStart();
  }

  window.ScanUI = { onShow, openWithText, checkMessage, setTab };
  window.addEventListener('DOMContentLoaded', init);
})();
