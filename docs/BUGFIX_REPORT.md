# Bug report: what was wrong in the uploaded repository, and what changed

The team uploaded `Spot-the-Scam-main` and `ScamM_db-main`. This is what was found, measured, and fixed.

## Critical: claims the code did not support

| # | Finding | Fix |
|---|---|---|
| 1 | The database file says `total_scenarios: 1543`, the UI and README said "1,543+ database entries". The file holds **42** rows, and only **15 distinct patterns** once numbers and bank names are ignored (27 near-copies). | Rebuilt as v3.0.0 with 91 unique rows. `total_scenarios` equals the real count, the UI shows the real count, and a test enforces it. Making inflated claims breaks the competition's rule against misrepresenting a project. |
| 2 | The README said the Qwen model runs through Transformers.js, but **no code loaded any model**. There was no AI in the app. | Added `ai.js` (real Transformers.js integration), retrieval from the database, an opt-in "Turn on AI" button, a pluggable backend for tests, and `eval.html` to measure it. |
| 3 | `game.js` was a 15-line stub that only switched screens. No cards, scoring, timer, rules or stats. `data.js` had 2 cards. | Restored the full game: 38 cards, scoring, streak multipliers, 7 levels, daily challenge, Endless mode, results, rules, stats, offline timer pause. |

## Checker quality (measured)

`checker.js` used unbounded keyword matches such as `/(pin|otp|bvn|password)/` and `/(fee|charge|payment)/`.

| Set | Old accuracy | Genuine messages called scam | Scams called genuine | New accuracy | Scams called genuine (new) |
|---|---|---|---|---|---|
| Game cards (38) | 60.5% | 4 of 13 | 11 | 100% | 0 |
| Held-out (40) | 70% | 6 of 18 | 6 | 92.5% (7.5% not sure) | 0 |
| Stress (30) | 33.3% | 7 of 14 | 13 | 40% (60% not sure) | 0 |

Examples of the old behaviour: a genuine OTP message ("Never share this code") was called a scam, a school fees receipt was called a scam, and even "Thanks for shopping with us" was called a scam (the word "shopping" contains "pin"). It also ignored negation and always showed high confidence.

Fix: new rules engine with word boundaries, negation handling, hard versus soft versus trust signals, and a safety rule (see `EVALUATION.md`).

## Database connection

| # | Finding | Fix |
|---|---|---|
| 4 | The DB repo has no `Access-Control-Allow-Origin` header, so the browser blocks the app from reading it. The app silently showed the offline fallback. | Added `db-repo/vercel.json` with CORS headers. **Redeploy the DB repo with this file.** |
| 5 | `sw.js` called `cache.addAll([... , 'https://scam-db-five.vercel.app/scam-db.json'])`. If that one cross-origin request fails (which it would, see #4), **the whole service worker install fails and nothing works offline**. | Files are cached one by one, the remote DB is not in the precache, and the bundled copy `data/scam-db.json` is. |
| 6 | The lookup matched only if the user's text contained the first 25 characters of a database row. Real messages almost never match. | Replaced with normalised similarity search (numbers, links and brand names removed, word and word-pair overlap), used both for the "similar known cases" list and to pick examples for the model. |
| 7 | Database fields were put into the page with `innerHTML`. If the remote file were ever edited by someone else, it could inject script into your site. | All dynamic text uses `textContent`. Remote rows are validated. A test feeds a hostile database and confirms nothing executes. |
| 8 | No timeout, no validation, no version check on the remote database. | 5-second timeout, schema validation, size limits, semantic version comparison (never downgrade), last good copy kept in `localStorage`. |

## Offline and install

| # | Finding | Fix |
|---|---|---|
| 9 | On any failed request, the old service worker returned `index.html`, even for JSON. The app would then try to parse a web page as JSON. | Fallback only for the app shell; data requests fail cleanly and the app uses its bundled copy. |
| 10 | `manifest.json` had no icons, so the app was not installable. | Added the team's icons to the manifest. |

Added to support the new features (not bugs in the old code): a runtime cache for the AI library files from jsDelivr, while Hugging Face model files are left to Transformers.js's own cache; and a single service-worker registration (the old `index.html` registered it inline).

## Interface

| # | Finding | Fix |
|---|---|---|
| 13 | Three buttons in a two-column grid left an orphan. | New layout with a Scam Checker tile. |
| 14 | `scan.js` toggled screens by hand, bypassing the router, and used `alert()`. | Uses the shared router and toasts. |
| 15 | README had unclosed code fences and headings inside code blocks, so it rendered badly on GitHub. | Rewritten. |

## Bugs I found in my own new code while testing

| Bug | How it was found | Fix |
|---|---|---|
| The AI explanation crashed (`reading 'concat'`) because the wrong object was passed to the prompt builder. | Test with a mocked AI model | `explainMessages` accepts a full result. Regression test added. |
| Text like `not a url !!` was accepted as a link and reported "no red flags". | Browser test | Host must be a valid dotted name. Regression test added. |
| The rules called 10 paraphrased scams "genuine". | Stress set | Safety rule: "genuine" needs positive evidence. |
| The official domain `korabank.com/login` was flagged because of the word "login". | Manual check | No keyword penalty on a brand's own domain. |
| The AI status chip did not refresh after a backend was attached. | Browser test | Chip refreshes at the start of each check. |

## Not fixed (needs the team)

- Run `eval.html` and fill in the AI results.
- Redeploy the DB repo with `vercel.json`.
- Put real team names, links and the live URL into the README and `SUBMISSION.md`.
- Native-speaker review of the Pidgin text.
- A real-phone test on a low-end Android phone.
