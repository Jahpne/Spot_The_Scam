# Limitations and ethics

## Who this is for, and the risk of getting it wrong

People who may lose money to scams. The worst failure is telling someone a scam is genuine. We designed against that on purpose:

- A hard rule overrides the AI.
- "Genuine" requires positive evidence. Finding no red flags gives "not sure".
- Disagreement between rules and AI gives "not sure".
- Every screen reminds users that a verdict is not a guarantee and to check in their own banking app.

Even so, **the checker will sometimes be wrong**. It is an awareness aid, not a security product.

## What we claim and do not claim

We claim: the rules catch the obvious scam patterns we tested, never called a scam genuine on our three test sets, and the app works offline.

We do not claim: any accuracy on real-world messages, any AI accuracy (not yet measured), that links or APKs are "safe", or that this replaces a bank's fraud team.

## Honest limits of the checks

- **Links:** address only. No certificate, no domain age, no page content.
- **APK:** permission names only. Not antivirus. A clean list is not a guarantee.
- **Messages:** keyword and pattern rules plus a 0.5B model. New wording gets "not sure" at best.
- **Language:** English, with templated Pidgin output. No Yoruba, Igbo or Hausa yet.
- **Data:** 91 database rows and 108 test messages, all written by the team. No real victim data.

## Privacy

- Messages, links and APK files are processed on the device. Nothing is sent to a server.
- The only network calls are: loading the app, optionally fetching the remote database file, and (once, on request) downloading the AI model and library from Hugging Face and jsDelivr. None include user content.
- Progress is stored in the browser's `localStorage`. There are no accounts and no analytics.
- The "Warn a friend" button uses the phone's share sheet or the clipboard. The user decides what to send.

## Responsible use of the model

- The AI is opt-in and clearly labelled "can be wrong".
- The explanation is grounded in the red flags the rules found, to reduce invented details.
- The model can not unlock any action; it only adds an opinion.

## Fair use of brand names

The game and database use **fictional** banks and companies, so we never claim a real institution sent a scam or is unsafe. The link checker's brand list (`BRANDS` in `checker.js`) lets a team add real banks, but only with **verified** official domains. Do not add a domain you have not verified.

## What could go wrong, and how we handle it

| Risk | Handling |
|---|---|
| A scam is called genuine | Safety rules above. Disagreement gives "not sure" |
| A genuine message is called a scam | "Why" shows the exact phrases, so the user can judge. Advice is to check inside the bank app |
| Scammers read the rules and avoid them | The AI and database cover paraphrases. Rules can be updated. We say plainly that this is an arms race |
| Remote database is tampered with | Validation, size limits, text-only rendering, bundled copy as fallback |
| Big download on mobile data | AI is opt-in with a size warning and Wi-Fi advice |
| Over-trust in the tool | Repeated "not a guarantee" notes, "never share your PIN or OTP" in shared warnings |

## Before real-world release

1. Test the AI on real, consented messages from the community and publish the results.
2. Have native speakers review the Pidgin text and add Yoruba, Igbo and Hausa.
3. Partner with banks or regulators for verified brand domains and fresh scam reports.
4. Test on low-end phones.
5. Add a way to report new scams back to the database.
