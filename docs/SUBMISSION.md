# Submission answers (copy into the OPEN//BUILD form)

Deadline: **Thursday 29 October 2026, 11:59 PM WAT**. Test your links before you submit. Late submissions may be excluded.

Fill in everything in `< >`.

---

**Project name**
Spot the Scam

**Team details** (exactly two members)
- `<Full name 1>`, `<University 1>`
- `<Full name 2>`, `<University 2>`

**Problem statement**
Fake credit alerts, phishing texts, fake POS and ATM helpers, and fake job or loan offers cost ordinary Nigerians money every day. Students, traders, POS agents and parents are most exposed. They often have limited data and cheap phones, and nobody to ask "is this real?". Most security tools assume good internet and an expert user.

**Solution description**
Spot the Scam is a small web app that works offline after the first visit. It has two parts. A game trains people to recognise scam patterns: they judge realistic messages, see the red flags light up, and read a plain-language reason, with points, streaks, levels and a daily challenge. A Scam Checker lets anyone paste a suspicious message, link or APK file. Rules and a message database answer instantly. An optional on-device open-weight AI model (Qwen2.5-0.5B-Instruct) adds a second opinion and a short explanation, in English or Nigerian Pidgin. Nothing leaves the user's phone.

**GitHub repository**
`<https://github.com/your-username/spot-the-scam>`
(Database repo: `<https://github.com/your-username/ScamM_db>`)

**Working demonstration**
Live: `<https://your-app.vercel.app>`
Open the home screen, tap **Scam Checker**, then try the three example buttons. To use the AI, tap **Turn on AI** (about 0.5 to 0.8 GB, one time; use Wi-Fi).
Backup: `<screen-recording link>`

**Model information**
- Model: Qwen2.5-0.5B-Instruct (Qwen team, Alibaba Cloud), Apache-2.0. ONNX weights from `onnx-community/Qwen2.5-0.5B-Instruct`, run in the browser with Transformers.js 3.7.6.
- Role: (1) a one-word SCAM or REAL second opinion, given the most similar labelled examples retrieved from our database; (2) a two-sentence plain-language explanation grounded in the rule-based red flags. It never overrides a hard rule.
- Why selected: small enough to run on the user's device so private messages never reach a server, permissive licence, instruction-tuned, and an official browser-ready conversion.
- Limitations: a 0.5B model can be wrong or confidently wrong, is not tuned for Pidgin or Nigerian languages, needs a large first download, and can be slow on weak phones. Our test sets are small and team-written. See `docs/MODEL_CARD.md`.

**Documentation**
`README.md` (setup, run, test, deploy, results), `docs/MODEL_CARD.md`, `docs/DATASET.md`, `docs/EVALUATION.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS_AND_ETHICS.md`, `docs/AI_DISCLOSURE.md`, `docs/BUGFIX_REPORT.md`.
Reproduce: `python3 -m http.server 8000`, `npm test`, and `eval.html` for the model benchmark.

**Acknowledgements**
- Qwen2.5-0.5B-Instruct, Qwen team, Apache-2.0
- onnx-community conversion of Qwen2.5-0.5B-Instruct (Hugging Face)
- Transformers.js (Hugging Face), Apache-2.0; ONNX Runtime Web (Microsoft), MIT
- jsDelivr (CDN)
- Message database and test sets: original, fictional, written by the team with AI help
- AI-assisted work: code, test data, documentation and pitch deck were drafted with Claude (Anthropic) and reviewed by the team. See `docs/AI_DISCLOSURE.md`.

---

## Final checklist

- [ ] Both team members' names and universities are correct
- [ ] Live link opens on a phone and on a laptop
- [ ] Repository is **public** and the README renders properly
- [ ] `vercel.json` deployed in the DB repo (CORS) and the link in the README is right
- [ ] `npm test` passes
- [ ] `eval.html` run, table pasted into `docs/EVALUATION.md`, `docs/results-model.json` saved
- [ ] Licences of Qwen2.5-0.5B-Instruct and the ONNX conversion read on their pages
- [ ] Offline test done (open link, reload once, airplane mode)
- [ ] No keys or passwords anywhere in the repo
- [ ] Demo rehearsed to 8 minutes
