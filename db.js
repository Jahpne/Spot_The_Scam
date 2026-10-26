/* ==========================================================================
   db.js  |  SPOT THE SCAM  |  Scam knowledge base
   Labelled example messages (scam / real) used for two things:
     1. "Similar known cases" shown under every check
     2. Retrieval: the closest examples become the few-shot examples the
        open-weight model sees (retrieval-augmented classification)

   Loading order (so the app always works offline):
     bundled  data/scam-db.json   precached by the service worker
     remote   REMOTE_DB_URL       optional, newer version wins
     cached   last good remote copy in localStorage

   Everything loaded from a remote source is validated and only ever shown
   with textContent, never as HTML.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The remote copy lives in its own repo (ScamM_db). It must send
  // "Access-Control-Allow-Origin: *" (see db-repo/vercel.json) or browsers block it.
  const REMOTE_DB_URL = 'https://scam-db-five.vercel.app/scam-db.json';
  const BUNDLED_URL = 'data/scam-db.json';
  const CACHE_KEY = 'spotscam:db-remote';
  const MAX_ENTRIES = 5000;
  const MAX_TEXT = 1200;

  const BRANDS = /\b(?:kora|savanna|plume|orbit|ziva|powerco|shopnaija|lakeview)\b/g;

  /** Strips the details that change between messages so patterns can be compared. */
  function normalize(text) {
    return String(text || '').toLowerCase()
      .replace(/https?:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?/g, ' url ')
      .replace(BRANDS, ' brand ')
      .replace(/₦|\bngn\b/g, ' naira ')
      .replace(/\d[\d,.]*/g, ' num ')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function features(text) {
    const words = normalize(text).split(' ').filter(Boolean);
    const uni = new Set(words);
    const bi = new Set();
    for (let i = 0; i < words.length - 1; i++) bi.add(words[i] + ' ' + words[i + 1]);
    return { uni, bi, key: words.join(' ') };
  }

  const jaccard = (a, b) => {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
  };

  function similarity(fa, fb) {
    return 0.5 * jaccard(fa.uni, fb.uni) + 0.5 * jaccard(fa.bi, fb.bi);
  }

  const semver = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
  function newer(a, b) {
    const x = semver(a), y = semver(b);
    for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
    return false;
  }

  /** Accepts only well-formed entries. Anything odd is dropped silently. */
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenarios)) return null;
    const entries = [];
    for (const s of raw.scenarios.slice(0, MAX_ENTRIES)) {
      if (!s || typeof s.text !== 'string' || (s.label !== 'scam' && s.label !== 'real')) continue;
      const text = s.text.slice(0, MAX_TEXT);
      if (!text.trim()) continue;
      entries.push({
        id: String(s.id || 'x' + entries.length).slice(0, 40),
        text,
        label: s.label,
        category: typeof s.category === 'string' ? s.category.slice(0, 40) : 'general',
        reason: typeof s.reason === 'string' ? s.reason.slice(0, 400) : '',
        f: features(text),
      });
    }
    return entries.length ? { version: String(raw.version || '0.0.0'), entries } : null;
  }

  const DB = {
    entries: [],
    status: { version: null, count: 0, source: 'none', remote: 'not tried', note: '' },

    normalize, similarity, features, validate, newer,

    /** Install a database object (used by tests and by load()). */
    use(raw, source) {
      const v = validate(raw);
      if (!v) return false;
      this.entries = v.entries;
      this.status.version = v.version;
      this.status.count = v.entries.length;
      this.status.source = source;
      return true;
    },

    /** Closest labelled examples to `text`, best first. */
    nearest(text, k = 3, minSim = 0.3) {
      const f = features(text);
      return this.entries
        .map((e) => ({ e, sim: similarity(f, e.f) }))
        .filter((x) => x.sim >= minSim)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, k)
        .map((x) => ({ id: x.e.id, text: x.e.text, label: x.e.label, category: x.e.category, reason: x.e.reason, sim: Math.round(x.sim * 100) / 100 }));
    },

    /** Few-shot pairs for the model: most similar example last (closest to the question). */
    examplesFor(text, k = 4) {
      const hits = this.nearest(text, k, 0.1);
      if (hits.length < 2) return [];
      return hits.reverse().map((h) => [h.text, h.label === 'scam' ? 'SCAM' : 'REAL']);
    },

    /** Bundled copy first (works offline), then try to upgrade from the remote DB. */
    async load({ remote = true, timeoutMs = 5000 } = {}) {
      try {
        const res = await fetch(BUNDLED_URL, { cache: 'no-cache' });
        if (res.ok) this.use(await res.json(), 'bundled');
      } catch (e) { this.status.note = 'bundled copy unavailable'; }

      // last good remote copy
      try {
        const cached = typeof localStorage !== 'undefined' && localStorage.getItem(CACHE_KEY);
        if (cached) {
          const raw = JSON.parse(cached);
          if (!this.status.version || newer(raw.version, this.status.version)) this.use(raw, 'cached remote');
        }
      } catch (e) { /* ignore corrupt cache */ }

      if (remote && typeof fetch === 'function' && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
        try {
          const res = await fetch(REMOTE_DB_URL, { mode: 'cors', cache: 'no-cache', signal: ctl && ctl.signal });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const raw = await res.json();
          const ok = validate(raw);
          if (!ok) throw new Error('invalid database format');
          this.status.remote = 'ok (v' + ok.version + ')';
          if (!this.status.version || newer(ok.version, this.status.version)) {
            this.use(raw, 'remote');
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch (e) { /* storage full */ }
          }
        } catch (e) {
          this.status.remote = 'unavailable (' + (e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'blocked') + ')';
        } finally { if (timer) clearTimeout(timer); }
      } else if (remote) {
        this.status.remote = 'offline';
      }
      return this.status;
    },
  };

  return DB;
});
