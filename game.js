/* ==========================================================================
   game.js  |  SPOT THE SCAM
   Modes:  classic (10 cards) | daily (8 seeded cards) | endless (3 lives)
   Scoring: 100 per correct answer + up to 50 speed bonus, times a streak
            multiplier (x1.5 at 3, x2 at 6, x3 at 9).
   Saves everything to localStorage. Works offline via sw.js.
   ========================================================================== */
(() => {
  'use strict';

  const { SCENARIOS, CATS, TYPE_LABEL, LEVELS, RULES } = window.SpotData;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TIME_LIMIT = 20;       // seconds per card when the timer is on
  const CLASSIC_COUNT = 10;
  const DAILY_COUNT = 8;
  const DAILY_BONUS_XP = 150;

  /* ------------------------------------------------------------------------
     SAVE DATA
     ------------------------------------------------------------------------ */
  const KEY = 'spotscam:v1';
  const defaults = () => ({
    xp: 0,
    best: { classic: 0, daily: 0, endless: 0 },
    stats: { answered: 0, correct: 0, bestStreak: 0, runs: 0, missedScam: 0, falseAlarm: 0, cat: {} },
    streak: { count: 0, last: null },
    daily: { date: null, score: 0, done: false },
    settings: { timer: true, sound: true },
  });

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = { ...base };
    for (const k of Object.keys(saved)) {
      out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], saved[k]) : saved[k];
    }
    return out;
  }

  let memory = null;
  function load() {
    try {
      const raw = localStorage.getItem(KEY) || memory;
      return raw ? merge(defaults(), JSON.parse(raw)) : defaults();
    } catch (e) { return defaults(); }
  }
  let S = load();
  function save() {
    const str = JSON.stringify(S);
    try { localStorage.setItem(KEY, str); } catch (e) { memory = str; }
  }

  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dayDiff = (a, b) => {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  };

  /* ------------------------------------------------------------------------
     HELPERS: level, seeded random, deck building
     ------------------------------------------------------------------------ */
  function levelInfo(xp) {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].t) i++;
    const cur = LEVELS[i], next = LEVELS[i + 1];
    return { i, name: cur.name, next, pct: next ? (xp - cur.t) / (next.t - cur.t) : 1 };
  }

  function seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let k = 0; k < str.length; k++) { h = Math.imul(h ^ str.charCodeAt(k), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function mulberry(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng = Math.random) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /** Picks n cards, favouring the difficulty that fits the player's level. */
  function weightedPick(pool, n, levelIdx, rng = Math.random) {
    const target = 1 + levelIdx * 0.4;               // 1.0 ... 3.4
    const left = [...pool];
    const out = [];
    while (out.length < n && left.length) {
      const w = left.map((c) => Math.exp(-Math.abs(c.lvl - target)));
      const sum = w.reduce((a, b) => a + b, 0);
      let r = rng() * sum, k = 0;
      while (k < w.length - 1 && (r -= w[k]) > 0) k++;
      out.push(left.splice(k, 1)[0]);
    }
    return out;
  }

  const scams = SCENARIOS.filter((c) => c.verdict === 'scam');
  const reals = SCENARIOS.filter((c) => c.verdict === 'real');

  function buildClassic() {
    const li = levelInfo(S.xp).i;
    return shuffle([...weightedPick(scams, 6, li), ...weightedPick(reals, 4, li)]);
  }

  function buildDaily() {
    const rng = mulberry(seedFrom('spotthescam-' + today()));
    const picked = [...shuffle(scams, rng).slice(0, 5), ...shuffle(reals, rng).slice(0, 3)];
    // easy warm-up first, trickier cards last, same for everyone today
    return picked.map((c) => ({ c, r: rng() })).sort((a, b) => a.c.lvl - b.c.lvl || a.r - b.r).map((x) => x.c);
  }

  function makeEndless() {
    const li = levelInfo(S.xp).i;
    let bag = [];
    return () => {
      if (!bag.length) bag = shuffle(SCENARIOS);
      // mostly scams, but keep real ones coming so "always scam" never wins
      const wantReal = Math.random() < 0.4;
      let idx = bag.findIndex((c) => (c.verdict === 'real') === wantReal);
      if (idx < 0) idx = 0;
      const c = bag.splice(idx, 1)[0];
      return c;
    };
  }

  /* ------------------------------------------------------------------------
     SOUND (tiny synthesised beeps, no files)
     ------------------------------------------------------------------------ */
  let ac = null;
  function beep(freq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0) {
    if (!S.settings.sound) return;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }
  const sfx = {
    good() { beep(660, 0.1, 'sine', 0.12); beep(990, 0.16, 'sine', 0.12, 0.08); },
    bad() { beep(180, 0.28, 'sawtooth', 0.1); },
    up() { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.13, i * 0.09)); },
  };
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* ignore */ } };

  /* ------------------------------------------------------------------------
     SCREENS
     ------------------------------------------------------------------------ */
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'home') renderHome();
    if (id === 'rules') renderRules();
    if (id === 'stats') renderStats();
    if (id === 'scan' && window.ScanUI) window.ScanUI.onShow();
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- home ---------- */
  function renderHome() {
    const L = levelInfo(S.xp);
    $('#home-level').textContent = `Lv ${L.i + 1} ${L.name}`;
    $('#home-xp').textContent = L.next ? `${fmt(S.xp)} / ${fmt(L.next.t)} XP` : `${fmt(S.xp)} XP, max level`;
    $('#home-xpbar').style.width = clamp(L.pct, 0, 1) * 100 + '%';

    const d = S.daily;
    const doneToday = d.date === today() && d.done;
    $('#daily-sub').textContent = doneToday
      ? `Done today: ${fmt(d.score)} pts. Replay for practice.`
      : S.streak.count > 1 ? `${S.streak.count} day streak. Keep it going.` : '8 messages, same for everyone';
    $('#opt-timer').checked = S.settings.timer;
    $('#opt-sound').checked = S.settings.sound;
  }

  /* ---------- rules ---------- */
  function renderRules() {
    $('#rules-list').innerHTML = RULES.map(([h, b]) => `<li><b>${esc(h)}</b><span>${esc(b)}</span></li>`).join('');
  }

  /* ---------- stats ---------- */
  function renderStats() {
    const st = S.stats;
    const acc = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
    const catRows = Object.entries(st.cat).sort((a, b) => b[1] - a[1]);
    const max = catRows.length ? catRows[0][1] : 1;
    $('#stats-body').innerHTML = `
      <div class="grid3">
        <div class="stat"><b>${acc}%</b><span>accuracy</span></div>
        <div class="stat"><b>${fmt(st.answered)}</b><span>answered</span></div>
        <div class="stat"><b>${st.bestStreak}</b><span>best streak</span></div>
        <div class="stat"><b>${st.runs}</b><span>games</span></div>
        <div class="stat"><b>${st.missedScam}</b><span>scams missed</span></div>
        <div class="stat"><b>${st.falseAlarm}</b><span>false alarms</span></div>
      </div>
      <div class="note" style="margin-top:12px"><b>Best scores</b><br>
        Classic ${fmt(S.best.classic)}, Daily ${fmt(S.best.daily)}, Endless ${fmt(S.best.endless)}<br>
        Day streak ${S.streak.count}</div>
      <div class="note" style="margin-top:12px"><h3>Where you slip up</h3>
        ${catRows.length ? catRows.map(([k, n]) => `<div class="bar-row"><span>${esc(CATS[k] ? CATS[k].label : k)}</span><b>${n}</b><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></div>`).join('') : '<span class="dim">No mistakes recorded yet. Play a few rounds.</span>'}
      </div>
      <button id="btn-reset" class="btn ghost" style="margin-top:12px">Reset all progress</button>`;
    $('#btn-reset').addEventListener('click', () => {
      if (confirm('Delete all your progress on this device?')) { S = defaults(); save(); show('home'); toast('Progress reset'); }
    });
  }

  /* ------------------------------------------------------------------------
     CARD RENDERING
     ------------------------------------------------------------------------ */
  /** Escapes text, then turns [[clue]] into <mark>. Clues stay plain until revealed. */
  function markup(text, verdict) {
    return esc(text).replace(/\[\[(.+?)\]\]/g, (m, t) => `<mark class="${verdict}">${t}</mark>`).replace(/\n/g, '<br>');
  }

  function cardHTML(sc) {
    const body = markup(sc.body, sc.verdict);
    const from = esc(sc.from || '');
    const time = esc(sc.time || '');
    const rawFrom = sc.from || '';
    const initial = /^[A-Za-z]/.test(rawFrom) ? esc(rawFrom.charAt(0).toUpperCase()) : '?';
    const tag = `<div class="c-tag">${esc(TYPE_LABEL[sc.type] || 'Message')}</div>`;
    let inner;
    switch (sc.type) {
      case 'sms':
        inner = `<div class="card sms"><div class="c-head"><div class="avatar">${initial}</div><div><b>${from}</b><small>${time}</small></div></div><div class="bubble">${body}</div></div>`;
        break;
      case 'whatsapp':
        inner = `<div class="card whatsapp"><div class="c-head"><div class="avatar">${initial}</div><div><b>${from}</b><small>${esc(sc.sub || '')} ${time}</small></div></div><div class="bubble">${body}</div></div>`;
        break;
      case 'email':
        inner = `<div class="card email"><div class="meta">From: ${from}<b>${esc(sc.sub || '')}</b></div><div class="c-body">${body}</div></div>`;
        break;
      case 'notif':
        inner = `<div class="card notif"><div class="c-head"><div class="avatar">${initial}</div><div><b>${from}</b><small>${time}</small></div></div><div class="c-body">${body}</div></div>`;
        break;
      case 'pos':
        inner = `<div class="card pos"><div class="slip">${body}</div></div>`;
        break;
      case 'call':
        inner = `<div class="card call"><div class="ring">${time}</div><div class="caller">${from}</div><div class="c-body">${body}</div></div>`;
        break;
      default:
        inner = `<div class="card story"><div class="c-head"><div class="avatar">!</div><div><b>${from}</b></div></div><div class="c-body">${body}</div></div>`;
    }
    return tag + inner;
  }

  /* ------------------------------------------------------------------------
     GAME RUN
     ------------------------------------------------------------------------ */
  let run = null;
  let backTarget = null;     // where the Back button goes (default: home)
  let timerId = null, deadline = 0, pausedLeft = null;

  const streakMult = (s) => (s >= 9 ? 3 : s >= 6 ? 2 : s >= 3 ? 1.5 : 1);

  function startRun(mode) {
    let deck = null, next = null;
    if (mode === 'classic') deck = buildClassic();
    else if (mode === 'daily') deck = buildDaily();
    else next = makeEndless();

    run = {
      mode, deck, next, i: 0, score: 0, streak: 0, bestStreak: 0, correct: 0,
      lives: 3, answers: [], locked: false, card: null, startXp: S.xp,
    };
    $('#hud-lives').hidden = mode !== 'endless';
    show('play');
    nextCard();
  }

  function nextCard() {
    $('#play').classList.remove('answered');
    $('#sheet').hidden = true;
    run.locked = false;
    run.card = run.mode === 'endless' ? run.next() : run.deck[run.i];

    $('#stage').innerHTML = cardHTML(run.card);
    updateHud();
    startTimer();
  }

  function updateHud() {
    $('#hud-count').textContent = run.mode === 'endless' ? `Card ${run.i + 1}` : `${run.i + 1} / ${run.deck.length}`;
    $('#hud-score').textContent = fmt(run.score);
    const sEl = $('#hud-streak');
    sEl.hidden = run.streak < 2;
    sEl.textContent = `Streak ${run.streak}`;
    const m = streakMult(run.streak);
    const mEl = $('#hud-mult');
    mEl.hidden = m <= 1;
    mEl.textContent = `x${m}`;
    if (run.mode === 'endless') {
      $('#hud-lives').innerHTML = [0, 1, 2].map((k) => `<span class="${k < run.lives ? '' : 'off'}">&#9829;</span>`).join('');
    }
  }

  /* ---------- timer ---------- */
  function startTimer() {
    stopTimer();
    const el = $('#timer');
    if (!S.settings.timer) { el.hidden = true; return; }
    el.hidden = false;
    deadline = performance.now() + TIME_LIMIT * 1000;
    timerId = setInterval(tickTimer, 100);
    tickTimer();
  }
  function stopTimer() { clearInterval(timerId); timerId = null; }
  function secondsLeft() { return Math.max(0, (deadline - performance.now()) / 1000); }
  function tickTimer() {
    const left = secondsLeft();
    $('#timer-bar').style.width = (left / TIME_LIMIT) * 100 + '%';
    const t = $('#timer');
    t.classList.toggle('warn', left <= 8 && left > 4);
    t.classList.toggle('danger', left <= 4);
    if (left <= 0) answer(null);
  }

  /* ---------- answering ---------- */
  function answer(choice) {
    if (!run || run.locked) return;
    run.locked = true;
    const left = S.settings.timer ? secondsLeft() : 0;
    stopTimer();

    const sc = run.card;
    const timedOut = choice === null;
    const correct = !timedOut && choice === sc.verdict;
    const st = S.stats;

    st.answered++;
    let gainText = '';

    if (correct) {
      st.correct++;
      run.correct++;
      run.streak++;
      run.bestStreak = Math.max(run.bestStreak, run.streak);
      st.bestStreak = Math.max(st.bestStreak, run.streak);
      const speed = S.settings.timer ? Math.round(50 * (left / TIME_LIMIT)) : 0;
      const mult = streakMult(run.streak);
      const pts = Math.round((100 + speed) * mult);
      run.score += pts;
      gainText = `+${pts} points` + (speed ? ` (speed +${speed})` : '') + (mult > 1 ? `  x${mult} streak` : '');
      sfx.good();
    } else {
      run.streak = 0;
      if (run.mode === 'endless') run.lives--;
      const miss = sc.verdict === 'scam' ? 'missedScam' : 'falseAlarm';
      st[miss]++;
      const catKey = sc.verdict === 'scam' ? sc.cat : 'safe';
      st.cat[catKey] = (st.cat[catKey] || 0) + 1;
      gainText = run.mode === 'endless' ? `${Math.max(0, run.lives)} ${run.lives === 1 ? 'life' : 'lives'} left` : 'Streak reset';
      sfx.bad();
      buzz([70, 40, 70]);
      const cardEl = $('.card', $('#stage'));
      if (cardEl) { cardEl.classList.remove('shake'); void cardEl.offsetWidth; cardEl.classList.add('shake'); }
    }

    run.answers.push({ sc, choice, correct, timedOut });

    // reveal clues, show explanation
    const cardEl = $('.card', $('#stage'));
    if (cardEl) cardEl.classList.add('revealed');
    const verdictWord = sc.verdict === 'scam' ? 'a scam' : 'real';
    const v = $('#sheet-verdict');
    v.className = 'verdict ' + (correct ? 'good' : 'bad');
    v.textContent = correct
      ? (sc.verdict === 'scam' ? '✓ Correct. It\'s a scam.' : '✓ Correct. It\'s real.')
      : (timedOut ? `✕ Time's up. This one was ${verdictWord}.` : `✕ Not quite. This one was ${verdictWord}.`);
    $('#sheet-why').textContent = sc.why;
    $('#sheet-gain').textContent = gainText;

    const last = run.mode === 'endless' ? run.lives <= 0 : run.i + 1 >= run.deck.length;
    $('#btn-next').textContent = last ? 'See results' : 'Next';
    $('#play').classList.add('answered');
    $('#sheet').hidden = false;
    updateHud();
    save();
    $('#btn-next').focus({ preventScroll: true });
    $('#sheet').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function advance() {
    if (!run || !run.locked) return;
    const over = run.mode === 'endless' ? run.lives <= 0 : run.i + 1 >= run.deck.length;
    if (over) { endRun(); return; }
    run.i++;
    nextCard();
  }

  /* ---------- results ---------- */
  function endRun() {
    stopTimer();
    const r = run;
    const answered = r.answers.length;
    const acc = answered ? Math.round((r.correct / answered) * 100) : 0;

    const before = levelInfo(S.xp).i;
    let xp = r.score;
    let dailyNote = '';
    if (r.mode === 'daily') {
      const firstToday = !(S.daily.date === today() && S.daily.done);
      S.daily = { date: today(), score: firstToday ? r.score : Math.max(S.daily.score, r.score), done: true };
      if (firstToday) { xp += DAILY_BONUS_XP; dailyNote = `Daily bonus +${DAILY_BONUS_XP} XP`; }
      else dailyNote = 'Bonus XP is paid once per day';
    }
    S.xp += xp;
    S.best[r.mode] = Math.max(S.best[r.mode], r.score);
    S.stats.runs++;

    // day streak counts any finished game
    const t = today();
    if (S.streak.last !== t) {
      S.streak.count = S.streak.last && dayDiff(S.streak.last, t) === 1 ? S.streak.count + 1 : 1;
      S.streak.last = t;
    }
    save();

    const after = levelInfo(S.xp);
    const leveled = after.i > before;
    if (leveled) sfx.up();

    // weakest area this run
    const missByCat = {};
    r.answers.filter((a) => !a.correct).forEach((a) => {
      const k = a.sc.verdict === 'scam' ? a.sc.cat : 'safe';
      missByCat[k] = (missByCat[k] || 0) + 1;
    });
    const weak = Object.entries(missByCat).sort((a, b) => b[1] - a[1])[0];

    const rank = acc >= 90 ? 'Fraud-proof' : acc >= 70 ? 'Sharp eyes' : acc >= 50 ? 'Getting there' : 'Easy target, for now';
    const wrong = r.answers.filter((a) => !a.correct);

    const mode = { classic: 'Classic', daily: 'Daily challenge', endless: 'Endless' }[r.mode];
    $('#result').innerHTML = `
      <div class="res-head">
        <div class="dim">${mode}</div>
        <div class="big-score">${fmt(r.score)}</div>
        <div class="rank">${rank}</div>
        <div class="dim">Scam IQ ${acc}%</div>
      </div>
      ${leveled ? `<div class="levelup">Level up! Lv ${after.i + 1} ${esc(after.name)}</div>` : ''}
      <div class="grid3">
        <div class="stat"><b>${r.correct}/${answered}</b><span>correct</span></div>
        <div class="stat"><b>${r.bestStreak}</b><span>best streak</span></div>
        <div class="stat"><b>+${fmt(xp)}</b><span>XP earned</span></div>
      </div>
      ${dailyNote ? `<div class="note">${esc(dailyNote)}</div>` : ''}
      ${weak ? `<div class="note"><b>Watch out for: ${esc(CATS[weak[0]].label)}</b><br>${esc(CATS[weak[0]].tip)}</div>` : '<div class="note"><b>Clean sheet.</b> You caught every one. Try a higher level or Endless.</div>'}
      ${wrong.length ? `<div class="review"><h3>What you missed</h3>${wrong.map((a) => `
        <details><summary><span class="rv-tag ${a.sc.verdict}">${a.sc.verdict === 'scam' ? 'scam' : 'real'}</span>${esc(a.sc.from || TYPE_LABEL[a.sc.type])}</summary>
          <p class="rv-msg">${esc(a.sc.body.replace(/\[\[|\]\]/g, ''))}</p><p>${esc(a.sc.why)}</p></details>`).join('')}</div>` : ''}
      <div class="actions">
        <button id="btn-again" class="btn primary big">Play again</button>
        <button id="btn-share" class="btn">Share my score</button>
        <button id="btn-res-home" class="btn ghost">Home</button>
      </div>`;
    $('#btn-again').addEventListener('click', () => startRun(r.mode));
    $('#btn-share').addEventListener('click', () => share(r, acc));
    $('#btn-res-home').addEventListener('click', () => show('home'));
    show('result');
  }

  function share(r, acc) {
    const url = location.href.split('?')[0];
    const text = `I scored ${fmt(r.score)} on Spot the Scam (Scam IQ ${acc}%). Can you spot fake bank alerts better than me? ${url}`;
    if (navigator.share) navigator.share({ title: 'Spot the Scam', text, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied. Paste it anywhere.'), () => toast(text));
    else toast(text);
  }

  /* ------------------------------------------------------------------------
     WIRING
     ------------------------------------------------------------------------ */
  function bind() {
    $('#btn-classic').addEventListener('click', () => startRun('classic'));
    $('#btn-daily').addEventListener('click', () => startRun('daily'));
    $('#btn-endless').addEventListener('click', () => startRun('endless'));
    $('#btn-rules').addEventListener('click', () => show('rules'));
    $('#btn-stats').addEventListener('click', () => show('stats'));
    $$('[data-home]').forEach((b) => b.addEventListener('click', () => { const to = backTarget || 'home'; backTarget = null; show(to); }));
    $('#btn-scan-tab').addEventListener('click', () => show('scan'));
    $('#btn-check-card').addEventListener('click', () => {
      if (!run || !run.card || !window.ScanUI) return;
      const c = run.card;
      const body = c.body.replace(/\[\[|\]\]/g, '');
      backTarget = 'play';                       // come back to the same card afterwards
      window.ScanUI.openWithText(c.type === 'email' ? `From: ${c.from}\nSubject: ${c.sub || ''}\n\n${body}` : body);
    });

    $('#btn-scam').addEventListener('click', () => answer('scam'));
    $('#btn-real').addEventListener('click', () => answer('real'));
    $('#btn-next').addEventListener('click', advance);
    $('#btn-quit').addEventListener('click', () => {
      if (confirm('Quit this game? Your score for it will be lost.')) { stopTimer(); run = null; show('home'); }
    });

    $('#opt-timer').addEventListener('change', (e) => { S.settings.timer = e.target.checked; save(); });
    $('#opt-sound').addEventListener('change', (e) => { S.settings.sound = e.target.checked; save(); if (e.target.checked) sfx.good(); });

    window.addEventListener('keydown', (e) => {
      if (!$('#play').classList.contains('active') || !run || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (!run.locked) {
        if (k === 's') answer('scam');
        else if (k === 'r') answer('real');
      }
    });

    // pause the card timer while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (!run || run.locked || !S.settings.timer) return;
      if (document.hidden) { pausedLeft = secondsLeft(); stopTimer(); }
      else if (pausedLeft !== null) { deadline = performance.now() + pausedLeft * 1000; pausedLeft = null; timerId = setInterval(tickTimer, 100); }
    });
  }

  /* ---------- offline + install ---------- */
  function setupNetwork() {
    const pill = $('#net-pill');
    const update = () => {
      const on = navigator.onLine;
      pill.textContent = on ? 'online' : 'offline mode';
      pill.className = 'pill ' + (on ? 'online' : 'offline');
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw] registration failed', e));
      navigator.serviceWorker.ready.then(() => { $('#offline-ready').hidden = false; });
    }

    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      $('#btn-install').hidden = false;
    });
    $('#btn-install').addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      $('#btn-install').hidden = true;
    });
    window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; toast('Installed. Find it on your home screen.'); });
  }

  bind();
  setupNetwork();
  renderHome();

  // Lets scan.js navigate and show toasts
  window.SpotApp = { show, toast };

  // Small handle for tests and the console
  window.SpotDebug = {
    get run() { return run; }, S: () => S, answer, advance, startRun,
    preview(id) { const c = SCENARIOS.find((x) => x.id === id); run.card = c; run.locked = false; $('#play').classList.remove('answered'); $('#sheet').hidden = true; $('#stage').innerHTML = cardHTML(c); },
  };
})();
