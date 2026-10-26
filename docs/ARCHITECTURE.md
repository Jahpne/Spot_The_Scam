# Architecture and technical decisions

## Shape of the system

A static website. No server, no build step, no framework, no account. Everything runs in the browser.

```
index.html ─ screens (home, play, result, rules, stats, scan)
 ├─ game.js     game logic, scoring, saving, router
 ├─ data.js     38 game cards
 ├─ checker.js  RULES + link check + prompts + combine()  (pure, also runs in Node)
 ├─ db.js       knowledge base: load, validate, similarity search
 ├─ ai.js       Qwen2.5-0.5B via Transformers.js (pluggable backend)
 ├─ apk.js      APK permission reader (pure zip parser + DecompressionStream)
 ├─ scan.js     Scam Checker UI
 └─ sw.js       offline: precache + runtime cache
```

## Decisions and why

| Decision | Reason | Cost |
|---|---|---|
| **Static site, vanilla JS** | Opens fast on cheap phones, free to host, easy for judges to run, nothing to install | No server-side checks (SSL, domain age, WHOIS) |
| **Model in the browser** | Private messages never leave the phone. No API key to leak. Works offline once cached | 0.5 to 0.8 GB first download, slow on weak phones |
| **AI is opt-in** | Data is expensive. Nobody should burn 786 MB by accident | One more tap |
| **Rules first, AI second** | Instant answer, explainable evidence, safe fallback if the model fails | Rules need maintenance |
| **Hard rules beat the model** | Asking for a PIN or OTP is a scam however it is worded. A 0.5B model can be talked out of it | Rare false alarms on odd genuine messages |
| **"Genuine" needs positive evidence** | The stress test showed "no red flags" is not proof. v1 called 10 scams genuine | More "not sure" answers |
| **Retrieval-augmented examples** | Shows the model cases close to the message instead of 4 fixed ones | Only as good as the 91 rows |
| **Combine = average + disagreement means "not sure"** | Simple, explainable, safe | Not tuned. A learned weighting needs more labelled data |
| **Bundled DB first, remote DB optional** | Always works offline. A remote copy lets the team update without redeploying | Two copies to keep in sync (`npm run build-db` writes both) |
| **Validate and sanitise remote data** | The remote file is outside our control. Only `textContent`, never `innerHTML` | A little more code |
| **Link and APK checks are offline and honest** | We only claim what a phone can verify | No SSL or domain-age checks |
| **Pidgin is templated, not model-generated** | A 0.5B model is not reliable in Pidgin | Fewer sentences, needs native review |
| **Service worker precaches file by file** | One failed file no longer breaks the whole install | None |
| **Pinned library version (3.7.6)** | Reproducible. A new major version could change the API | Must update by hand |

## The checker pipeline

1. `Checker.analyzeRules(text)` runs about 25 signals. Each is a hard risk, a soft risk, or a trust signal. Hard risks include asking for secrets, fees to receive money, "safe account", refund traps, impersonation with a money request, changed account numbers, and look-alike links. Negation ("never share this code") is handled so genuine warnings are not mistaken for requests.
2. `DB.nearest(text)` finds the closest labelled messages. Text is normalised first (numbers, links and brand names removed) and compared by word and word-pair overlap.
3. If the AI is on: `AI.classify(text, DB.examplesFor(text))` returns SCAM, REAL or unsure.
4. `Checker.combine(rules, model)` produces the verdict. Rule-only mode skips step 3.
5. `AI.explain(...)` writes two sentences from the red flags found. It never changes the verdict.
6. `scan.js` renders everything with DOM nodes and `textContent`.

## Offline design

- `sw.js` precaches 15 files including `data/scam-db.json`.
- jsDelivr files (Transformers.js and the ONNX runtime) are cached on first AI use.
- Hugging Face model files are stored by Transformers.js itself in Cache Storage (`transformers-cache`). The service worker deliberately does not touch them.
- The scan screen only auto-starts the AI if that cache already exists, so it never starts a surprise big download.
- `navigator.storage.persist()` is requested after the model loads, to lower the chance the browser clears it.

## Security

- Remote database rows are validated (label, type, length limits) and invalid rows are dropped.
- All dynamic text is inserted with `textContent` or text nodes. A test feeds a hostile remote database containing `<img onerror>` and `<script>` and confirms nothing runs.
- The APK file is read locally and never uploaded.
- No secrets, keys or credentials exist in the repo. The app calls no paid API.

## Testing

- `npm test`: 34 Node checks (rules, link checker, APK logic, database, test-set integrity, and the "never call a scam genuine" safety property).
- End-to-end browser tests (Playwright, 36 checks) covered: the checker, Pidgin, a mocked AI path and its failure path, link and APK tabs with real zip files, a hostile remote database, an older remote database, the game, going back from the checker to the same card, service-worker precache, and offline reload.
- The mocked AI tests found two real bugs before they reached users (see `BUGFIX_REPORT.md`).
- The real model could not be run in the build environment, so model behaviour is verified only through `eval.html`, which the team runs.

## Known technical limits

- WebGPU variants (`q4f16`) depend on the device. The loader falls back automatically to other variants and to WebAssembly.
- Heavy use of regular expressions: new scam wording needs new rules. The AI and database are the answer to that, not endless rules.
- `localStorage` holds progress. Clearing browser data resets it.
