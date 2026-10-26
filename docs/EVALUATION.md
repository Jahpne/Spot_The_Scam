# Evaluation

How we measured the project, what the numbers say, and what is still to fill in.

## Test sets

| Set | n | How it was made | Independent? |
|---|---|---|---|
| Game cards | 38 | Written first. The rules were developed while looking at these. | **No** |
| Held-out | 40 | Written before the rules were built, not shown to the database | Mostly (same authors) |
| Stress | 30 | Written afterwards to break the rules: paraphrased scams with no trigger words, and genuine messages that contain scary words | Adversarial by design |

All sets were written by the team with an AI assistant. They are small. They are not real messages from victims.

## Rules-only results (measured, reproducible with `npm test`)

| Set | Accuracy | Not sure | Accuracy when it decides | Scam recall | Scams called "real" | False alarms |
|---|---|---|---|---|---|---|
| Game cards | 100% | 0% | 100% | 100% | 0 | 0 |
| Held-out | 92.5% | 7.5% | 100% | 100% | 0 | 0 |
| Stress | 40% | 60% | 100% | 37.5% | 0 | 0 |

Accuracy counts "not sure" as wrong. "Scams called real" is the dangerous error.

### What happened during development (full honesty)

1. **Version 1 of the rules** scored 100% on the game cards and 100% on the held-out set. That looked too good, so we wrote the stress set.
2. On the stress set, version 1 scored 53.3%, and **it called 10 scams "genuine"** because it treated "no red flags found" as "safe".
3. **Version 1.1** adds a safety rule: the rules say "genuine" only with positive evidence (a balance, a reference number, an instruction to use the official app). Otherwise they say "not sure". Scams called "real" dropped to 0 on every set. Held-out accuracy fell to 92.5% because three plain genuine messages (for example a casual chat message with nothing to confirm it) now get "not sure".
4. We did not tune the keyword lists on the stress set. Because the safety rule was a reaction to the stress results, the stress numbers are no longer a clean, untouched test.

Take-away: the rules are very strong on obvious scams (100% when they decide) but cannot read paraphrased ones. That is the gap the AI is meant to fill.

## The original checker (for comparison)

The keyword checker in the first repo scored 60.5% (game cards), 70% (held-out) and 33.3% (stress). It called genuine messages scams (4 of 13, 6 of 18 and 7 of 14) and called scams genuine (11, 6 and 13). It flagged a real OTP message and a school fees receipt as scams. See `BUGFIX_REPORT.md`.

## Database retrieval alone

Nearest-neighbour by word overlap against the database: on the held-out set it decided only 22.5% of messages (all correct when it decided); on the stress set it decided none. Word overlap is too weak for paraphrases, so the database is used to show similar cases and to give the model examples, not as a classifier.

## AI model results: TO FILL IN

We could not download the model where this code was written, so **no AI accuracy figure is claimed anywhere**. To produce it:

1. `python3 -m http.server 8000` in the repo folder.
2. Open `http://localhost:8000/eval.html` in Chrome (a laptop with decent internet for the first load).
3. **Load AI model**, then **Run full benchmark**.
4. Click **Copy markdown table**, and paste it below. Download `results.json` and save it as `docs/results-model.json`.

The page measures four methods on all three sets: Rules, AI (fixed examples), AI + database examples, and Hybrid. Retrieval skips database rows that are almost identical to the test message (similarity 0.95 or more) so it cannot cheat.

```
<paste the markdown table from eval.html here>
Device used: <laptop model, browser, WebGPU or WASM>
Date measured: <date>
```

## How to report the AI results honestly

- Quote the numbers exactly as the page shows them, with the set sizes.
- Say that the sets are small and written by the team.
- Point out the dangerous error ("scams called real") separately from accuracy.
- If the AI does not help, say so. A clear negative result with a safe fallback is a good result.

## Not yet measured

- Accuracy on real messages from real users.
- Speed and failure rate on low-end phones.
- Pidgin readability with native speakers.
- Whether people make better decisions after using the game or the checker (a small user test would show this).
