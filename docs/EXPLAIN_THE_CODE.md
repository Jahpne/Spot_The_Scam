# Explain the code: a tour for both team members

The rules say both teammates must understand the work and be able to explain it. Read this, then open each file next to it.

## The one-sentence version

The app takes a message, runs it through rules and a database, optionally asks a small AI model, combines the answers into one verdict, and shows why.

## Follow one message through the code

You paste: *"Dear customer, your account will be blocked in 24 hours. Verify your BVN at kora-verify.top now."*

1. **`scan.js` -> `checkMessage()`** reads the text box.
2. **`checker.js` -> `analyzeRules(text)`** runs about 25 small detectors (`SIGNALS`). Here:
   - `secret_request`: the pattern "verify ... BVN" (an action word followed within 45 characters by a secret word).
   - `link_suspicious`: `findDomains()` finds `kora-verify.top`. A cheap ending (`.top`) and a hyphenated brand-like name make it suspicious.
   - `urgency` ("in 24 hours") and `threat` ("blocked").
   Any **hard** signal makes the verdict `scam` at once.
3. **`db.js` -> `DB.nearest(text)`** turns the text into word sets (numbers, links and brand names removed) and finds the closest rows in `scam-db.json`. These appear as "Similar known cases".
4. If the AI is on: **`ai.js` -> `AI.classify()`** builds a chat prompt with `Checker.classifyMessages(text, examples)` and runs Qwen. The reply is one word, read by `Checker.parseVerdict()`.
5. **`checker.js` -> `combine(rules, model)`**: a hard rule wins; otherwise the two beliefs are averaged; disagreement gives "not sure".
6. **`AI.explain()`** writes two sentences from the red flags found.
7. **`scan.js` -> `renderMessage()`** builds the result using DOM nodes and `textContent` (never `innerHTML`).

## File by file

| File | What it owns | Read first |
|---|---|---|
| `checker.js` | All detection logic. No page code, so Node can test it | `SIGNALS`, `analyzeRules`, `combine` |
| `db.js` | Loading the database (bundled, remote, cached), checking it is valid, finding similar messages | `normalize`, `nearest`, `load` |
| `ai.js` | Downloading and running the model, with fallbacks (WebGPU then WebAssembly, several file variants) | `load`, `generate` |
| `apk.js` | Opening an APK (a zip file) in the browser and listing permissions | `readEntries`, `findPermissions`, `assess` |
| `scan.js` | The checker screen: tabs, buttons, drawing results | `checkMessage`, `renderMessage` |
| `game.js` | The game: decks, scoring, levels, saving | `answer`, `endRun`, `levelInfo` |
| `data.js` | The 38 game messages and the rules text | `SCENARIOS` |
| `sw.js` | Offline: what is cached and how | `ASSETS`, the `fetch` handler |
| `eval.js` | Measures the methods against the test sets | `run` |
| `tests/run-tests.mjs` | The 34 checks | all of it |

## Ideas you should be able to explain

- **Hard versus soft versus trust signals.** Hard signals (asking for a PIN, a fee to receive money) are scams alone. Soft ones (urgency, threats) add up. Trust signals (a balance, "use the official app") subtract.
- **Negation.** "Never share this code" contains the words "share" and "code" but is a warning, not a request. `negated()` looks just before the match for words like "never" and "do not".
- **Why "genuine" needs positive evidence.** The stress set showed "no red flags" is not proof. v1 called 10 scams genuine. Now no evidence gives "not sure".
- **Retrieval-augmented examples.** Instead of always showing the model the same four examples, we show it the four most similar labelled messages from the database.
- **Why the model is opt-in.** Its file is 0.5 to 0.8 GB.
- **Why on-device.** Privacy. No messages sent to a server, no API key.
- **How offline works.** The service worker saves the files on first visit. The model files are saved separately by Transformers.js.
- **Why the test sets are separate from the database.** If a test message were in the database, retrieval would just look up the answer. `npm test` checks for leaks.
- **Why we report "scams called real" separately.** It is the dangerous mistake.

## Try these to learn

1. In `checker.js`, add a new signal for a scam phrase you invented. Add a test in `tests/run-tests.mjs`. Run `npm test`.
2. In `scan.js`, change the text of an example button. Reload.
3. In `data/scam-db.json`, add a row, bump `version` and `total_scenarios`, and watch the "Similar known cases" list change.
4. In `eval.html`, run the rules-only benchmark and compare with `docs/EVALUATION.md`.

## Questions to practise answering

- What is the difference between a hard rule and the AI model?
- What happens if the model fails to load?
- Why did we write a stress set?
- What does "accuracy when it decides" mean, and why show it?
- Where do the licences come from, and what must we keep when we share the model?
- What is the biggest weakness of this project? (Be honest: small hand-written data, a weak 0.5B model, rules that scammers can learn.)
