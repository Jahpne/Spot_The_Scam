/* ==========================================================================
   checker.js  |  SPOT THE SCAM  |  Scam Checker engine
   Pure logic: no DOM, no network. Runs in the browser and in Node (tests).

   Three parts
     1. RULES   transparent red-flag detector (instant, works offline)
     2. PROMPTS what we ask the open-weight model (Qwen2.5-0.5B-Instruct)
     3. HYBRID  how the rules and the model's answer are combined

   The model never gets the final say alone: a "hard" rule (asking for a PIN,
   OTP, BVN, a fee to receive money, a lookalike website...) always wins,
   because those patterns are scams no matter how the message is worded.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Checker = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. RULES
     ------------------------------------------------------------------------ */
  const MONEY = '(?:₦|ngn)\\s?\\d[\\d,]*';

  // What counts as a "secret" nobody legitimate should ever ask you for
  const SECRET = '(?:pin|otp|one[- ]time (?:password|code)|password|passcode|cvv|cvc|bvn|nin|' +
    'card (?:number|details)|expiry(?: date)?|verification code|security code|' +
    '(?:\\d|six|6)[- ]?digit code|the code|your code|this code|token)';
  const ASK_VERB = '(?:send|share|give|read|tell|provide|enter|submit|confirm|verify|update|reply with|forward)';

  const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rb.gy', 'goo.gl', 'ow.ly', 'is.gd', 'shorturl.at'];
  const CHEAP_TLDS = ['xyz', 'top', 'click', 'info', 'link', 'vip', 'cc', 'biz', 'site', 'online', 'icu', 'tk', 'ml', 'ga', 'cf', 'gq', 'ws'];
  const TLDS = ['com', 'net', 'org', 'co', 'ng', 'me', 'ly', 'io', 'app', 'live', 'club', 'shop', 'gov', 'edu', ...CHEAP_TLDS];
  const LOOKALIKE_WORDS = /(bank|secure|verify|update|support|login|account|bvn|nin|refund|claim|pay|gift|free|payroll|helpdesk|service|alert|mail|security|official|registry|office|gov|tax|track|parcel|parcel|renew|link)/;

  /** All matches of a regex as {start, end, text}. */
  function all(text, re) {
    const out = [];
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = r.exec(text))) {
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      if (m[0].length === 0) r.lastIndex++;
    }
    return out;
  }

  /** True if a negation ("never", "do not"...) sits just before position `start`. */
  function negated(text, start) {
    const before = text.slice(Math.max(0, start - 40), start);
    return /\b(?:never|do not|don't|dont|won't|will not|cannot|can't|should not|shouldn't|not)\b(?:\s+\w+){0,3}\s*$/i.test(before);
  }

  /** Finds web and email domains and classifies them. */
  function findDomains(text) {
    const tld = TLDS.join('|');
    const re = new RegExp(`(@)?((?:[a-z0-9][a-z0-9-]*\\.)+(?:${tld}))(?![a-z0-9-])(?::\\d+)?(\\/[^\\s)]*)?`, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(text))) {
      const domain = m[2].toLowerCase();
      const label = domain.split('.').slice(0, -1).join('.');
      const ext = domain.split('.').pop();
      const hyphens = (label.match(/-/g) || []).length;
      const reasons = [];
      if (SHORTENERS.includes(domain)) reasons.push('shortener');
      if (CHEAP_TLDS.includes(ext)) reasons.push('cheap-tld');
      if ((hyphens >= 1 && LOOKALIKE_WORDS.test(label)) || hyphens >= 2) reasons.push('lookalike');
      out.push({ start: m.index + (m[1] ? 1 : 0), end: m.index + m[0].length, text: m[0].replace(/^@/, ''), domain, isEmail: !!m[1], suspicious: reasons.length > 0, reasons });
    }
    return out;
  }

  /**
   * Each signal: { id, kind: 'risk'|'trust', hard, w, find(text) -> [{start,end,text}] }
   * `hard` risk signals are scams on their own. `w` is the weight otherwise.
   */
  const SIGNALS = [
    // ----- hard risk: scams no matter what else the message says -----
    { id: 'secret_request', kind: 'risk', hard: true, w: 1, find(t) {
      const hits = all(t, new RegExp(`\\b${ASK_VERB}\\b[^.!?\\n]{0,45}?\\b${SECRET}\\b`, 'i')).filter((h) => !negated(t, h.start));
      return hits.concat(all(t, new RegExp(`\\bhave your\\b[^.!?\\n]{0,40}\\b(?:pin|card number|expiry)\\b`, 'i')));
    } },
    { id: 'pay_fee', kind: 'risk', hard: true, w: 1, find(t) {
      return [
        ...all(t, /\b(?:processing|registration|clearance|insurance|activation|release|administration|admin|claim|shipping|delivery|training|document|verification|application|handling|customs)\s+(?:fee|charge|payment)\b/i),
        ...all(t, /\b(?:pay|send)\b[^.!?\n]{0,35}\bfor (?:shipping|delivery|clearance|registration|processing|activation|training|insurance)\b/i),
        ...all(t, /\bpay\b[^.!?\n]{0,30}\b(?:to (?:claim|receive|get|collect|activate)|first)\b/i),
        ...all(t, new RegExp(`\\b(?:send|pay|transfer|deposit)\\b[^.!?\\n]{0,20}${MONEY}[^.!?\\n]{0,60}\\b(?:to start|to begin|to receive|to claim|to release|to activate)\\b`, 'i')),
      ];
    } },
    { id: 'safe_account', kind: 'risk', hard: true, w: 1, find(t) {
      return [
        ...all(t, /\b(?:safe|secure|temporary|holding)\s+account\b/i),
        ...all(t, /\b(?:transfer|move|send)\b[^.!?\n]{0,30}\byour (?:money|balance|funds|savings)\b/i),
      ];
    } },
    { id: 'refund_trap', kind: 'risk', hard: true, w: 1, find(t) {
      const a = all(t, /\b(?:by (?:mistake|error)|mistaken(?:ly)?|wrong (?:number|account|transfer))\b/i);
      const b = all(t, /\b(?:return|refund|send (?:it )?back|pay (?:it )?back)\b/i);
      return a.length && b.length ? a.concat(b) : [];
    } },
    { id: 'impersonation', kind: 'risk', hard: true, w: 1, find(t) {
      const a = all(t, /\b(?:new number|lost my phone|changed my number|my old number)\b/i);
      const b = all(t, new RegExp(`\\b(?:send|transfer|lend|help me with)\\b[^.!?\\n]{0,25}${MONEY}`, 'i'));
      return a.length && b.length ? a.concat(b) : [];
    } },
    { id: 'changed_account', kind: 'risk', hard: true, w: 1, find(t) {
      return [
        ...all(t, /\b(?:new|different) account number\b/i),
        ...all(t, /\binstead of (?:the )?(?:school|company|official|usual|normal)\b/i),
      ];
    } },
    { id: 'link_suspicious', kind: 'risk', hard: true, w: 1, find(t) {
      return findDomains(t).filter((d) => d.suspicious).map(({ start, end, text }) => ({ start, end, text }));
    } },

    // ----- soft risk: add up -----
    { id: 'link_present', kind: 'risk', w: 0.25, find(t) {
      return findDomains(t).filter((d) => !d.isEmail).map(({ start, end, text }) => ({ start, end, text }));
    } },
    { id: 'urgency', kind: 'risk', w: 0.3, find(t) {
      return all(t, /\bwithin\s+(?:\d+|one|two|three|a few)\s*(?:hours?|hrs?|minutes?|mins?|days?)\b|\b(?:immediately|urgent(?:ly)?|right now|asap|hurry|last chance|expires? today|today only|act now|do not ignore|tonight|by evening|quickly)\b/i);
    } },
    { id: 'threat', kind: 'risk', w: 0.3, find(t) {
      return all(t, /\b(?:blocked|suspended|restricted|frozen|freeze|deactivated|disconnected|disconnection|permanently closed|closed permanently|will be closed|lose access|cancelled|account deletion|flagged)\b/i);
    } },
    { id: 'prize', kind: 'risk', w: 0.4, find(t) {
      return all(t, /\b(?:congratulations|you (?:have )?won|winner|selected for|lucky|cash reward|mega draw|free (?:\d+ ?gb|data|airtime|money)|giveaway|jackpot)\b/i);
    } },
    { id: 'too_good', kind: 'risk', w: 0.6, find(t) {
      return [
        ...all(t, /\b(?:guaranteed|risk[- ]free|zero risk|no risk|no loss|double your money|pre-approved|no experience needed)\b/i),
        ...all(t, /\b0% interest\b/i),
        ...all(t, new RegExp(`\\b(?:earn|make|get)\\s+(?:up to\\s+)?${MONEY}\\s*(?:naira)?\\s*(?:daily|weekly|monthly|per (?:day|week))`, 'i')),
        ...all(t, new RegExp(`\\bwithdraw\\s+${MONEY}\\s+(?:next|tomorrow)`, 'i')),
      ];
    } },
    { id: 'secrecy', kind: 'risk', w: 0.5, find(t) {
      return all(t, /\b(?:do not|don't|dont) (?:tell|call|talk)\b|\bkeep (?:this|it) (?:secret|private)\b|\bstay on the line\b|\b(?:do not|don't) hang up\b/i);
    } },
    { id: 'screenshot', kind: 'risk', w: 0.4, find(t) {
      return all(t, /\bscreenshot\b|\btransfer successful\b/i);
    } },
    { id: 'stall', kind: 'risk', w: 0.5, find(t) {
      return all(t, /\bwill (?:be )?revers(?:e|ed)\b|\bonly a test\b/i);
    } },
    { id: 'personal_account', kind: 'risk', w: 0.35, find(t) {
      return all(t, /\bpersonal account\b/i);
    } },
    { id: 'forward_chain', kind: 'risk', w: 0.5, find(t) {
      return all(t, /\bforward\b[^.!?\n]{0,25}\b\d+ (?:groups|friends|people|contacts)\b|\bshare with \d+ friends\b/i);
    } },
    { id: 'advance_fee', kind: 'risk', w: 0.5, find(t) {
      return all(t, /\b(?:box of money|inheritance|next of kin|unclaimed funds|peacekeeping|diplomat)\b/i);
    } },
    { id: 'attachment', kind: 'risk', w: 0.4, find(t) {
      return all(t, /\.(?:zip|exe|apk|scr)\b|\battached file\b/i);
    } },
    { id: 'new_number', kind: 'risk', w: 0.3, find(t) {
      return all(t, /\b(?:new number|lost my phone|changed my number)\b/i);
    } },

    // ----- trust: things real messages do (they lower the risk) -----
    { id: 'never_share', kind: 'trust', w: 0.35, find(t) {
      return all(t, /\bnever\s+(?:share|give|disclose|reveal|tell)\b|\bdo not share\b|\bwe (?:will )?never ask\b|\bnever ask\b/i);
    } },
    { id: 'official_channel', kind: 'trust', w: 0.35, find(t) {
      return all(t, /\bnumber on the back of your card\b|\b(?:open|log in to|login to|use) the [a-z ]{0,15}app\b|\bin the [a-z ]{0,15}app\b|\byour usual ussd\b|\bvisit a branch\b|\bnormally use\b|\b(?:number|clinic number) you have on file\b/i);
    } },
    { id: 'has_reference', kind: 'trust', w: 0.3, find(t) {
      return all(t, /\bref(?:erence)?(?: no| number)?[:.\s]*[a-z0-9/-]{5,}|\brrn[:\s]*\d{6,}|\breceipt no[:.\s]*[a-z0-9/-]+|\bterminal(?: id)?[:\s]|\bbal(?:ance)?[:\s]*(?:ngn|₦)\s?\d/i);
    } },
    { id: 'masked_account', kind: 'trust', w: 0.2, find(t) {
      return all(t, /(?:acct|account|card)[^.\n]{0,10}(?:\*{2,}|x{2,})\d{3,4}|\*{4}\s?\d{4}|\bending \d{4}\b/i);
    } },
    { id: 'no_action', kind: 'trust', w: 0.25, find(t) {
      return all(t, /\bno action (?:is )?(?:needed|required)\b|\bnothing urgent\b/i);
    } },
  ];

  /** Decision thresholds on net = risk - trust. */
  const T_SCAM = 0.55;
  const T_REAL = 0.2;

  function analyzeRules(text) {
    text = String(text || '');
    const found = [];
    for (const s of SIGNALS) {
      const hits = s.find(text);
      if (hits.length) found.push({ id: s.id, kind: s.kind, hard: !!s.hard, w: s.w, hits });
    }
    const risk = found.filter((f) => f.kind === 'risk');
    const trust = found.filter((f) => f.kind === 'trust');
    const hard = risk.some((f) => f.hard);
    const net = risk.reduce((a, f) => a + (f.hard ? 0.6 : f.w), 0) - trust.reduce((a, f) => a + f.w, 0);

    let verdict, confidence;
    if (hard) { verdict = 'scam'; confidence = 'high'; }
    else if (net >= T_SCAM) { verdict = 'scam'; confidence = net >= 0.9 ? 'high' : 'medium'; }
    else if (net <= T_REAL && trust.length > 0) { verdict = 'real'; confidence = net <= -0.3 ? 'medium' : 'low'; }
    // Safety rule (v1.1): finding no red flags is NOT evidence that a message is genuine.
    // The rules only say "real" when they see positive evidence (balance, reference, official channel).
    else { verdict = 'unsure'; confidence = 'low'; }

    return { verdict, confidence, hard, net: Math.round(net * 100) / 100, signals: found, risk, trust, text };
  }

  /* ------------------------------------------------------------------------
     1b. LINK CHECK (offline, no network)
     Looks only at the address itself. It cannot see the website, its
     certificate or how old the domain is, so it never says a link is "safe".
     ------------------------------------------------------------------------ */
  // Brand word -> official domains. The brands here are the game's fictional ones.
  // To protect a real bank, add its name and its VERIFIED official domain.
  const BRANDS = {
    kora: ['korabank.com'], savanna: ['savannabank.com'], plume: ['plumemfb.com'],
    orbit: ['orbitbank.com'], ziva: ['ziva.com'], powerco: ['powerco.com'],
  };

  function analyzeUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) return { valid: false, error: 'empty' };
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    let u;
    try { u = new URL(hasScheme ? raw : 'http://' + raw); } catch (e) { return { valid: false, error: 'invalid' }; }
    if (!/^https?:$/.test(u.protocol)) return { valid: true, host: u.protocol, signals: [{ id: 'bad_scheme', hard: true, w: 1 }], net: 1.6, verdict: 'scam' };

    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    // A real web address has dots and only letters, digits and hyphens. Anything else is not a link.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return { valid: false, error: 'invalid' };
    const parts = host.split('.');
    const ext = parts[parts.length - 1];
    const label = parts.slice(0, -1).join('.');
    const hyphens = (label.match(/-/g) || []).length;
    const signals = [];
    const add = (id, hard, w) => signals.push({ id, hard, w });

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add('ip_host', true, 1);
    if (u.username || u.password) add('at_symbol', true, 1);
    if (host.includes('xn--')) add('punycode', true, 1);
    for (const [brand, domains] of Object.entries(BRANDS)) {
      if (host.includes(brand) && !domains.some((d) => host === d || host.endsWith('.' + d))) { add('brand_impersonation', true, 1); break; }
    }
    if (SHORTENERS.includes(host)) add('shortener', false, 0.5);
    if (CHEAP_TLDS.includes(ext)) add('cheap_tld', false, 0.45);
    if ((hyphens >= 1 && LOOKALIKE_WORDS.test(label)) || hyphens >= 2) add('lookalike', false, 0.5);
    if (parts.length >= 5) add('many_subdomains', false, 0.3);
    if (hasScheme && u.protocol === 'http:') add('no_https', false, 0.3);
    const official = Object.values(BRANDS).some((ds) => ds.some((d) => host === d || host.endsWith('.' + d)));
    if (!official && /(login|signin|verify|update|secure|otp|bvn|claim|bonus|gift|free|reward)/i.test(u.pathname + u.search)) add('keyword_path', false, 0.3);
    if (raw.length > 80) add('long_url', false, 0.15);

    const hard = signals.some((s) => s.hard);
    const net = signals.reduce((a, s) => a + (s.hard ? 0.6 : s.w), 0);
    // 'clear' means "no red flags found offline". It does not mean safe.
    const verdict = hard || net >= 0.7 ? 'scam' : net >= 0.3 ? 'unsure' : 'clear';
    return { valid: true, host, signals, net: Math.round(net * 100) / 100, verdict };
  }

  /* ------------------------------------------------------------------------
     2. PROMPTS FOR THE OPEN-WEIGHT MODEL
     ------------------------------------------------------------------------ */
  const SYSTEM_CLASSIFY =
    'You are a fraud-awareness assistant for people in Nigeria. Decide whether a message is a SCAM or REAL (a genuine, legitimate message). ' +
    'Scam signs: asking for a PIN, OTP, password, BVN or card details; asking you to pay a fee before you receive money; fake prizes, loans or jobs; ' +
    'threats and urgent deadlines; links to strange websites; strangers asking for money or to send money back. ' +
    'Real messages are calm, may show balances or reference numbers, never ask for secrets, and tell you to use the official app or the number on your card. ' +
    'Answer with exactly one word: SCAM or REAL.';

  // Three tiny examples, written separately from the game cards and the test set.
  const FEWSHOT = [
    ['DEAR CUSTOMER: your Orbit Bank account is on hold. Send your PIN to 08001112222 to unlock it today.', 'SCAM'],
    ['Orbit Bank: Debit NGN 2,500.00 at CITY MART. Bal NGN 18,200.00. Questions? Call the number on the back of your card.', 'REAL'],
    ['You have been chosen to receive a ₦500,000 grant. Pay ₦4,000 registration fee to claim.', 'SCAM'],
    ['Hi, running late. See you at 6.', 'REAL'],
  ];

  const clip = (t, n = 900) => (t.length > n ? t.slice(0, n) + ' ...' : t);
  const wrap = (t) => `Message:\n"""\n${clip(String(t).trim())}\n"""\nIs this SCAM or REAL?`;

  /** Chat messages for the one-word classification. */
  function classifyMessages(text, examples) {
    const msgs = [{ role: 'system', content: SYSTEM_CLASSIFY }];
    for (const [ex, label] of (examples && examples.length ? examples : FEWSHOT)) {
      msgs.push({ role: 'user', content: wrap(ex) });
      msgs.push({ role: 'assistant', content: label });
    }
    msgs.push({ role: 'user', content: wrap(text) });
    return msgs;
  }

  /** Reads the model's reply. Anything unclear becomes "unsure". */
  function parseVerdict(reply) {
    const m = /\b(scam|real)\b/i.exec(String(reply || ''));
    return m ? m[1].toLowerCase() : 'unsure';
  }

  /** Chat messages for the short plain-language explanation. */
  function explainMessages(text, result, lang) {
    const r = result.rules || result;   // accepts a full check() result or a raw rules result
    const signs = r.risk.concat(r.trust).map((s) => STR.en.signals[s.id]).filter(Boolean);
    const verdict = result.verdict === 'scam' ? 'SCAM' : result.verdict === 'real' ? 'REAL' : 'UNSURE';
    return [
      { role: 'system', content: 'You explain scams to ordinary people in Nigeria in very simple English. Use at most two short sentences. Use only the facts you are given. Never invent facts, names or numbers.' },
      { role: 'user', content: `${wrap(text).replace('Is this SCAM or REAL?', '')}Verdict: ${verdict}\nSigns found: ${signs.length ? signs.join('; ') : 'none'}\nExplain simply why, then say what the person should do.` },
    ];
  }

  /* ------------------------------------------------------------------------
     3. HYBRID: rules + model
     ------------------------------------------------------------------------ */
  /**
   * rules: result of analyzeRules.  model: 'scam' | 'real' | 'unsure' | null (not loaded).
   * Returns { verdict, confidence, source }.
   */
  function combine(rules, model) {
    if (rules.hard) return { verdict: 'scam', confidence: 'high', source: 'hard rule' };
    if (!model) return { verdict: rules.verdict, confidence: rules.confidence, source: 'rules only' };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pr = clamp(0.5 + rules.net * 0.9, 0.05, 0.95);          // rules' belief it is a scam
    const pm = model === 'scam' ? 0.8 : model === 'real' ? 0.2 : 0.5; // model's belief
    const p = 0.5 * pr + 0.5 * pm;
    const verdict = p >= 0.6 ? 'scam' : p <= 0.4 ? 'real' : 'unsure';
    const agree = model === rules.verdict;
    return { verdict, confidence: agree && verdict !== 'unsure' ? 'medium' : 'low', source: 'rules + AI', p: Math.round(p * 100) / 100 };
  }

  /* ------------------------------------------------------------------------
     TEXT: English and Nigerian Pidgin
     Pidgin lines were written by the project's AI assistant and should be
     reviewed by a native speaker before wide release.
     ------------------------------------------------------------------------ */
  const STR = {
    en: {
      verdict: { scam: 'This looks like a SCAM', real: 'This looks genuine', unsure: 'Not sure. Be careful' },
      advice: {
        scam: 'Do not reply, tap links, or send money or codes. If it claims to be your bank, call the number on the back of your card.',
        real: 'Nothing here looks like a trick, but still check your own banking app before you act.',
        unsure: 'Do not rush. Check with your bank or the person using a number you already trust.',
      },
      conf: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
      urlVerdict: { scam: 'This link looks fake', unsure: 'This link looks suspicious', clear: 'No red flags found in the address' },
      urlAdvice: {
        scam: 'Do not open it. If it claims to be your bank, type the bank\'s website yourself or use its app.',
        unsure: 'Be careful. Do not enter any password, PIN or card details. Open the official app or website yourself instead.',
        clear: 'This only checks the address. It cannot prove the website is safe. Never enter your PIN or OTP on a site you reached from a message.',
      },
      urlSignals: {
        bad_scheme: 'This is not a normal web address.',
        ip_host: 'Uses a number address instead of a real website name.',
        at_symbol: 'Hides the real website behind an "@" trick.',
        punycode: 'Uses look-alike foreign characters to imitate a real site.',
        brand_impersonation: 'Uses a bank or company name but is not that company\'s official website.',
        shortener: 'A shortened link hides where it really goes.',
        cheap_tld: 'Ends in a cheap address type often used for scam sites.',
        lookalike: 'Looks like a made-up website with hyphens and security words.',
        many_subdomains: 'Has a long chain of sub-addresses, a common disguise.',
        no_https: 'Not using HTTPS, so nothing you type is protected.',
        keyword_path: 'The address asks you to login, verify or claim something.',
        long_url: 'Unusually long address.',
      },
      aiNote: 'AI explanation (small model, can be wrong)',
      signals: {
        secret_request: 'Asks for your PIN, OTP, password, BVN or card details. Real banks never do.',
        pay_fee: 'Asks you to pay a fee before you receive money, a job, a loan or a prize.',
        safe_account: 'Tells you to move your money to a "safe" or "temporary" account. No such thing exists.',
        refund_trap: 'Says money came "by mistake" and asks you to send it back. Check your own banking app first.',
        impersonation: 'Claims to be a friend on a new number and asks for money. Call the old number first.',
        changed_account: 'Gives a new account number to pay. Confirm it in person or on a number you trust.',
        link_suspicious: 'Contains a link or sender address that is not the real website.',
        link_present: 'Contains a link. Never tap links about money.',
        urgency: 'Rushes you with a deadline so you will not think.',
        threat: 'Threatens to block, close or cut off something.',
        prize: 'Promises a prize or free gift you never signed up for.',
        too_good: 'Promises guaranteed or unrealistic money.',
        secrecy: 'Tells you not to tell anyone, or not to hang up.',
        screenshot: 'Relies on a screenshot as proof of payment. Screenshots can be faked.',
        stall: 'Says a wrong charge "will reverse", a common stalling trick.',
        personal_account: 'Asks you to pay into a personal account.',
        forward_chain: 'Asks you to forward the message to many people.',
        advance_fee: 'Classic "advance fee" story: a big reward if you pay a small fee.',
        attachment: 'Pushes you to open an unexpected attachment.',
        new_number: 'Says it is a new number. Verify before you trust it.',
        never_share: 'Warns you never to share your codes. Genuine messages do this.',
        official_channel: 'Sends you to the official app or the number on your card.',
        has_reference: 'Has proper details like a balance or reference number.',
        masked_account: 'Shows only the last digits of your account or card.',
        no_action: 'Asks you to do nothing.',
      },
      warn: (v, flags) => `Careful! I checked this message with the Spot the Scam checker and it ${v === 'scam' ? 'looks like a SCAM' : v === 'real' ? 'looks genuine' : 'is not clear'}.${flags.length ? ' Reasons: ' + flags.join(' ') : ''} Never share your PIN or OTP with anyone.`,
    },
    pcm: {
      verdict: { scam: 'Dis one na SCAM', real: 'Dis one look like say e real', unsure: 'I no too sure. Make you carry eye' },
      advice: {
        scam: 'No reply, no click link, no send money or code. If dem say na your bank, call the number wey dey back of your card.',
        real: 'Nothing for here look like wahala, but still check your bank app yourself before you do anything.',
        unsure: 'No rush. Check with your bank or the person for another way wey you trust.',
      },
      conf: { high: 'I sure well well', medium: 'I fairly sure', low: 'I no too sure' },
      urlVerdict: { scam: 'Dis link look like fake', unsure: 'Dis link dey suspicious', clear: 'I no see wahala for the address' },
      urlAdvice: {
        scam: 'No open am. If dem say na your bank, type the bank website yourself or use the bank app.',
        unsure: 'Carry eye. No put password, PIN or card details. Open the official app or website yourself.',
        clear: 'Na only the address I check. E no mean say the website safe. No ever put PIN or OTP for site wey message carry you go.',
      },
      urlSignals: {
        bad_scheme: 'Dis one no be normal web address.',
        ip_host: 'E use number instead of real website name.',
        at_symbol: 'E dey hide the real website with "@" trick.',
        punycode: 'E use strange letters wey look like real ones.',
        brand_impersonation: 'E carry bank or company name but no be dia official website.',
        shortener: 'Short link dey hide where e really dey go.',
        cheap_tld: 'E end with cheap address type wey scam sites like.',
        lookalike: 'E look like fake website wey get hyphen and security words.',
        many_subdomains: 'E get long chain of sub-address. Na disguise.',
        no_https: 'No HTTPS, so anything you type no protected.',
        keyword_path: 'The address dey tell you make you login, verify or claim something.',
        long_url: 'Address too long.',
      },
      aiNote: 'AI explanation (small model, e fit wrong)',
      signals: {
        secret_request: 'Dem dey ask for your PIN, OTP, password or BVN. Bank no dey ever ask for dat one.',
        pay_fee: 'Dem say make you pay money first before you collect money, job, loan or prize. Na scam style.',
        safe_account: 'Dem say make you move your money enter "safe account". No such thing dey.',
        refund_trap: 'Dem say money enter by mistake and make you send am back. Check your bank app first.',
        impersonation: 'Person dey claim say na im new number and dey beg for money. Call the old number first.',
        changed_account: 'Dem give you new account number to pay. Confirm am face to face or with number wey you trust.',
        link_suspicious: 'Link or sender address no be the real website.',
        link_present: 'Link dey inside. No click link wey concern money.',
        urgency: 'Dem dey rush you make you no think.',
        threat: 'Dem dey threaten say dem go block or close something.',
        prize: 'Prize or free gift wey you no apply for? Na bait.',
        too_good: 'Dem promise money wey too sweet. Nobody fit guarantee dat kind thing.',
        secrecy: 'Dem say make you no tell anybody or make you no drop call.',
        screenshot: 'Dem use screenshot as proof of payment. Screenshot fit be fake.',
        stall: 'Dem say wrong charge "go reverse". Na stall.',
        personal_account: 'Dem want make you pay enter personal account.',
        forward_chain: 'Dem say make you forward am to plenty people.',
        advance_fee: 'Old "advance fee" story: big money if you pay small money first.',
        attachment: 'Dem dey push you to open file wey you no expect.',
        new_number: 'Dem say na new number. Verify before you trust.',
        never_share: 'E warn you say make you no share your code. Correct messages dey do dat.',
        official_channel: 'E tell you to use official app or the number for your card.',
        has_reference: 'E get correct details like balance or reference number.',
        masked_account: 'E show only the last digits of your account or card.',
        no_action: 'E no ask you to do anything.',
      },
      warn: (v, flags) => `Oya carry eye! I check dis message with Spot the Scam checker and e ${v === 'scam' ? 'look like SCAM' : v === 'real' ? 'look like say e real' : 'no clear'}.${flags.length ? ' Why: ' + flags.join(' ') : ''} No ever share your PIN or OTP with anybody.`,
    },
  };

  /** Sorted list of signal ids that explain the verdict (risk for scam, trust for real). */
  function evidence(rules, verdict) {
    const list = verdict === 'real' ? rules.trust : rules.risk;
    return [...list].sort((a, b) => (b.hard - a.hard) || (b.w - a.w));
  }

  /** Merged highlight ranges for the original text. */
  function highlights(rules, verdict) {
    const kind = verdict === 'real' ? 'trust' : 'risk';
    const ranges = [];
    for (const s of rules.signals.filter((x) => x.kind === kind)) {
      for (const h of s.hits) ranges.push([h.start, h.end]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([...r]);
    }
    return merged;
  }

  /** Full checker result from the rules and (optionally) a model verdict. */
  function check(text, model) {
    const rules = analyzeRules(text);
    const final = combine(rules, model || null);
    return { ...final, rules, model: model || null, evidence: evidence(rules, final.verdict), ranges: highlights(rules, final.verdict) };
  }

  /* ------------------------------------------------------------------------
     METRICS (used by tests and by eval.html)
     ------------------------------------------------------------------------ */
  /**
   * preds/labels: arrays of 'scam' | 'real' | 'unsure'.
   * Positive class = scam. "unsure" counts as wrong in `accuracy`.
   */
  function metrics(preds, labels) {
    const n = labels.length;
    let correct = 0, decided = 0, decidedCorrect = 0, tp = 0, fp = 0, fn = 0, tn = 0, unsure = 0;
    for (let i = 0; i < n; i++) {
      const p = preds[i], y = labels[i];
      if (p === 'unsure' || p == null) { unsure++; if (y === 'scam') fn++; else fp += 0; continue; }
      decided++;
      if (p === y) { correct++; decidedCorrect++; }
      if (y === 'scam' && p === 'scam') tp++;
      else if (y === 'scam' && p === 'real') fn++;
      else if (y === 'real' && p === 'scam') fp++;
      else tn++;
    }
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    return {
      n, accuracy: pct(correct, n), decidedAccuracy: pct(decidedCorrect, decided), unsureRate: pct(unsure, n),
      scamRecall: pct(tp, labels.filter((y) => y === 'scam').length),
      scamPrecision: pct(tp, tp + fp),
      falseAlarms: fp, missedScams: fn, confusion: { tp, fp, fn, tn, unsure },
    };
  }

  return {
    SIGNALS, STR, FEWSHOT, SYSTEM_CLASSIFY, T_SCAM, T_REAL,
    analyzeRules, analyzeUrl, BRANDS, classifyMessages, explainMessages, parseVerdict, combine, check, evidence, highlights, metrics, findDomains,
  };
});
