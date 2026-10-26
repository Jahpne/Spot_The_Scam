# Dataset: where it comes from, what it contains, its licence

## What we use

| File | Rows | Used for |
|---|---|---|
| `data/scam-db.json` | 91 (61 scam, 30 real) | Similar-case lookup and retrieved examples for the model |
| `data/heldout.json` | 40 (22 scam, 18 real) | Held-out test set, written before the rules |
| `data/stress.json` | 30 (16 scam, 14 real) | Stress test, written to break the rules |
| `data.js` (game cards) | 38 (25 scam, 13 real) | The game, and the set the rules were developed on |

The test sets are **never** part of the database. `npm test` checks that no test message is in the database and that none is a near-duplicate (similarity 0.8 or more).

## Origin

All messages are original, hand-written examples in a Nigerian context, drafted by the team with an AI assistant (Claude). They are modelled on well-known scam patterns: fake alerts, OTP theft, fees to receive money, impersonation, POS and ATM tricks, fake jobs and loans. They are **not** scraped from real victims or real inboxes.

The database was built by `tools/build-db.mjs` from three sources:
1. The team's first database (`tools/source/scam-db-v2-original.json`, 42 rows).
2. The 38 game cards.
3. 38 new entries written for version 3 (`tools/source/db-extra.json`).

Rows that are the same message after removing numbers, brand names and links are dropped. 27 duplicates were removed. The first version claimed 1,543 rows but held 42, and only 15 distinct patterns. `total_scenarios` now always equals the real row count, and a test enforces it.

## Privacy

All names, bank and company names, phone numbers, account numbers and websites are fictional. No real personal data. If you add real examples, remove personal details first.

## Format

```json
{ "id": "db_0007", "category": "otp_theft", "label": "scam",
  "text": "...", "reason": "...", "source": "game-cards" }
```
`label` is `scam` or `real`. The app ignores any row with another label.

## Where to get the database

- Bundled in this repo: `data/scam-db.json`.
- Hosted copy (separate repo `ScamM_db`): `https://scam-db-five.vercel.app/scam-db.json`. It needs the CORS headers in `db-repo/vercel.json`.
- Rebuild it yourself: `npm run build-db`.

## Licence

Apache-2.0 (same as the code). The data is original work by the team.

## Optional public datasets (not used)

The **UCI SMS Spam Collection** (English spam and genuine SMS, licensed CC BY 4.0, Almeida and Hidalgo 2011) is a well-known benchmark. It is mostly UK and Singapore English, not Nigerian, so we did not use it. If you add it to a benchmark, cite it and keep the licence notice.

## Known gaps

- Small and hand-written: 91 rows cannot cover every scam.
- No Pidgin, Yoruba, Igbo or Hausa messages yet.
- Built from the team's knowledge. Real reports from banks, NGOs or regulators would make it better.
