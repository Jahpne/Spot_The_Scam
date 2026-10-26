# AI assistance disclosure

OPEN//BUILD asks teams to disclose significant AI-assisted work and to be able to explain everything they submit.

## Tools used

- **Claude (Anthropic)**, a general-purpose AI assistant, used through the Claude app.
- **Qwen2.5-0.5B-Instruct** is inside the product as the open-weight model (see `MODEL_CARD.md`). That is a product component, not a development aid.

## What Claude helped with

| Area | Help given |
|---|---|
| Code | First drafts of the game, the rules engine, the database loader, the link and APK checkers, the Scam Checker screen, the AI loader, the service worker, the benchmark page and the tests |
| Review and bug-fixing | Reading the team's earlier repository and database, listing bugs (see `BUGFIX_REPORT.md`), writing fixes |
| Data | Drafting the example messages in `data.js`, `scam-db.json`, `heldout.json` and `stress.json` (all fictional) |
| Documentation | README, model card, dataset notes, evaluation notes, architecture and ethics notes, demo script, submission answers |
| Design | Screen layout, colour palette, pitch deck |
| Pidgin text | Draft Nigerian Pidgin strings (**not yet reviewed by a native speaker**) |

## What was not AI-generated

- The decision to build a scam-awareness project for Nigerian users and the choice of the hackathon topic.
- The idea of a separately hosted message database (`ScamM_db`) and the repository structure the team created.
- Running the application, deploying it, and (still to do) running `eval.html` with the real model and recording the results.

## Checks the team must do before submitting

- [ ] Read every file well enough to explain it (see `EXPLAIN_THE_CODE.md`).
- [ ] Run `npm test` and the app yourself.
- [ ] Run `eval.html` and paste real results into `EVALUATION.md`.
- [ ] Check the model and library licences on their pages.
- [ ] Have a native speaker review the Pidgin strings.
- [ ] Replace the team and link placeholders.

## Honest statements about the data and numbers

- All test messages were written by the team with AI help. They are synthetic.
- The rules were developed while looking at the game cards, so those results are not independent.
- No accuracy figure for the AI model has been invented. The AI table in `EVALUATION.md` is empty until the team measures it.

## Reused code and resources

No third-party code is copied into the repository. The app loads **Transformers.js** and **ONNX Runtime Web** from a CDN at run time, and the model weights from Hugging Face. See the README for licences.
