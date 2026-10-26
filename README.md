# Spot the Scam

**A scam-awareness game and an offline-first Scam Checker for Nigerians.** Players learn to tell fake bank alerts, phishing texts and POS tricks from genuine messages. The checker lets anyone paste a suspicious message, link or APK file and get an explanation in plain English or Nigerian Pidgin.

Built for **OPEN//BUILD 2026** (Open Source Community Africa, Ile-Ife).

- Live demo: `<paste your Vercel link here>`
- Message database repo: `<paste your ScamM_db GitHub link here>`
- Team: `<Member 1, University>` and `<Member 2, University>`

---

## The problem

Fake credit alerts, "your account will be blocked" texts, fake POS agents and fake job or loan offers cost ordinary Nigerians real money every day. The people most at risk (students, traders, POS agents, parents) often have limited data, cheap phones, and nobody to ask. Existing tools assume good internet and an English-fluent, security-aware user.

## The solution

One small web app, no sign-up, that works offline after the first visit:

| Part | What it does |
|---|---|
| **Game** | 38 realistic messages. Tap Real or Scam, then see the red flags light up with a plain-language reason. Points, streaks, 7 levels, a daily challenge, Endless mode, and a stats page that shows your weak spots. |
| **Scam Checker: Message** | Paste any message. Rules and a message database answer instantly. An optional **open-weight AI model** gives a second opinion and a short explanation. Results can be shown in Nigerian Pidgin. |
| **Scam Checker: Link** | Checks the address for shortened links, cheap look-alike domains, fake brand names and hidden "@" tricks. Fully offline. |
| **Scam Checker: APK file** | Reads an app file on your phone and lists risky permissions (read SMS, watch the screen). Nothing is uploaded. |
| **Warn a friend** | One tap makes a short warning to share on WhatsApp. |

## The AI model

| | |
|---|---|
| **Model** | [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) (Qwen team, Alibaba Cloud), about 0.5 billion parameters |
| **Weights used** | ONNX build: [`onnx-community/Qwen2.5-0.5B-Instruct`](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct) |
| **Licence** | Apache-2.0 (stated on the base model repository). The ONNX conversion is a derivative of it. Check the licence file on both pages yourself before you rely on this. |
| **Runtime** | [Transformers.js](https://huggingface.co/docs/transformers.js) 3.7.6 in the browser (WebGPU, falling back to WebAssembly) |
| **Download** | One time, about 0.5 to 0.8 GB (the `q4` file is 786 MB). Opt-in only: the user taps "Turn on AI". Cached by the browser afterwards. |
| **Privacy** | The model runs on the user's device. Messages never leave the phone. |

**What the model does.** It does two jobs. (1) It reads the message and answers one word, SCAM or REAL. To help it, we retrieve the most similar examples from our message database and show them to the model as examples (retrieval-augmented classification). (2) It writes a two-sentence plain-language explanation, grounded in the red flags the rules found.

**Why this model.** It is small enough to run in a browser on a laptop or a decent phone, so private messages never need a server. It follows instructions well for its size, and its licence allows reuse. We did not pick a bigger model because the download would be too large for people on limited data.

**What the model does not do.** It does not get the last word. A *hard rule* (asking for a PIN, OTP, BVN or a fee to receive money, a look-alike website, "move your money to a safe account") always wins, because those patterns are scams however they are worded. A model this small makes mistakes, so every AI explanation is labelled "can be wrong". See [docs/MODEL_CARD.md](docs/MODEL_CARD.md).

## How it works

```
 message --> Rules (instant, offline) ---+
        |                                |--> combine --> verdict + why + what to do
        +--> Database: similar cases ----+
        |        |
        |        +--> 4 closest examples --> Qwen2.5-0.5B (optional, in the browser)
        |                                       +--> SCAM / REAL + short explanation
 link --> address checks (offline)
 APK  --> permission reader (offline)
```

The combine step: a hard rule wins. Otherwise rules and model each give a belief and are averaged. If they disagree, the answer is "not sure". The rules only say "genuine" when they find positive evidence (a balance, a reference number, an instruction to use the official app). Finding no red flags is **not** treated as proof. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Measured results

All numbers below were measured by running the code in this repository. Nothing is estimated.

**Rules only** (reproduce with `npm test`):

| Test set | n | Accuracy | Not sure | Accuracy when it decides | Scam recall | Scams called "real" |
|---|---|---|---|---|---|---|
| Game cards (used to build the rules, **not independent**) | 38 | 100% | 0% | 100% | 100% | 0 |
| Held-out (written before the rules) | 40 | 92.5% | 7.5% | 100% | 100% | 0 |
| Stress (written to break the rules) | 30 | 40% | 60% | 100% | 37.5% | 0 |

The stress result is the honest one: the rules never made a dangerous mistake, but on paraphrased scams that avoid trigger words they say "not sure" 60% of the time. That is exactly where the AI model is meant to help.

**AI model, hybrid and database-retrieval results:** run `eval.html` on your own laptop (steps below) and paste the table into [docs/EVALUATION.md](docs/EVALUATION.md). We could not download the model in the environment where the code was written, so we have **not** claimed any model accuracy figure. Filling this table in is the one remaining step before submission.

**Compared with the first version in this repo:** the original keyword checker scored 60.5%, 70% and 33.3% on the same three sets, and wrongly called genuine messages scams (for example, a real OTP message and a school fees receipt). See [docs/BUGFIX_REPORT.md](docs/BUGFIX_REPORT.md).

## Run it

You need only a browser and Python (or any static file server). There is no build step.

```bash
git clone <your repo url>
cd spot-the-scam
python3 -m http.server 8000
# open http://localhost:8000
```

`localhost` counts as a secure context, so the service worker works. Open the Scam Checker from the home screen.

**Turn on the AI:** open Scam Checker, tap **Turn on AI**, and wait for the download (use Wi-Fi). The status chip shows `AI: on (webgpu, q4f16)` or `(wasm, ...)` when ready.

**Run the tests:** `npm test` (Node 18 or newer, no packages to install). 34 checks cover the rules, link checker, APK logic, database and test-set integrity.

**Measure the model:** serve the folder, open `http://localhost:8000/eval.html` in Chrome, click **Load AI model**, then **Run full benchmark**. It compares four methods (Rules, AI, AI + database examples, Hybrid) on all three sets and gives you a markdown table and `results.json`.

**Try the demo fast:** the home screen works with no setup. In the checker, the three "Try" buttons load a fake bank text, a real alert, and a tricky paraphrase.

## Offline use

After a person opens the link once with internet, a service worker (`sw.js`) saves the app and the bundled database. From then on it opens with no data. The AI model files are saved separately by the browser the first time the AI is turned on. Without the model, everything except the AI second opinion still works offline.

Test it: open the live link, reload once, then turn on airplane mode and reopen.

## Deploy (Vercel)

1. Push this folder to GitHub.
2. On vercel.com choose **Add New > Project**, import the repo, framework preset **Other**, no build command, no output directory.
3. Deploy. Share the link.

## The message database

`data/scam-db.json` holds 91 hand-written labelled examples (61 scam, 30 real). A copy lives in its own repository (`db-repo/`) so it can be updated without redeploying the app. The app uses the bundled copy first, then upgrades to the remote copy if it is newer.

The remote repository **must** include the `vercel.json` in `db-repo/` (it adds the `Access-Control-Allow-Origin` header). Without it, browsers block the request and the app quietly uses the bundled copy. See [db-repo/README.md](db-repo/README.md) and [docs/DATASET.md](docs/DATASET.md).

## Repository layout

```
index.html  style.css  game.js  data.js      the game and the screens
checker.js                                   rules engine, link checker, prompts, combine logic
db.js                                        database loader, similarity search, validation
ai.js                                        Qwen2.5-0.5B via Transformers.js
apk.js                                       APK permission reader
scan.js                                      Scam Checker screen
eval.html  eval.js                           model benchmark page
sw.js  manifest.json  vercel.json  icon*     offline + install
data/      scam-db.json  heldout.json  stress.json
db-repo/   the database repo (with the CORS vercel.json)
tools/     build-db.mjs and its source files
tests/     run-tests.mjs
docs/      model card, dataset, evaluation, architecture, ethics, AI disclosure, submission answers, demo script
```

## Limitations (read these)

- The rules and the small model **make mistakes**. A "genuine" verdict is not a guarantee. Always check in your own banking app.
- The rules were written by hand and share vocabulary with our test messages. Real scammers adapt. Treat our numbers as a starting point, not proof of real-world accuracy.
- Test sets are small (38, 40 and 30 messages) and were written by the project team with an AI assistant. They are not real victims' messages.
- The link check looks at the address only. It cannot see the website, its certificate or how old the domain is. The APK check reads permissions only and is not antivirus.
- The first AI download is large (up to about 0.8 GB). On slow phones the model may be slow or fail; the checker then falls back to rules and the database.
- Pidgin text was written with AI help and needs review by a native speaker.
- Brand protection only covers the fictional brands in `BRANDS` (`checker.js`). Add real banks with their **verified** official domains before real use.

More in [docs/LIMITATIONS_AND_ETHICS.md](docs/LIMITATIONS_AND_ETHICS.md).

## Use of AI assistance (disclosure)

Claude (Anthropic) helped write code, test data, documentation and the pitch deck. The team reviewed the work, ran the tests, and is responsible for it. Details: [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md).

## Acknowledgements and licences

| Resource | Licence | Use |
|---|---|---|
| Qwen2.5-0.5B-Instruct, Qwen team | Apache-2.0 | The AI model |
| onnx-community/Qwen2.5-0.5B-Instruct | derived from the above | ONNX weights for the browser |
| Transformers.js, Hugging Face | Apache-2.0 | Runs the model in the browser |
| ONNX Runtime Web, Microsoft | MIT | Used by Transformers.js |
| jsDelivr | free CDN | Serves the library files |

Please verify each licence on its own page. The code and the message database in this repository are released under **Apache-2.0** (see `LICENSE`). The message database is original work: all names, numbers and websites are fictional. A public dataset such as the UCI SMS Spam Collection (CC BY 4.0, English spam, not Nigerian) is a useful optional extra benchmark, but it is **not** used here.
