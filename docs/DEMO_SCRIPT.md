# Demo script: 8 minutes (3 minutes slides, 5 minutes live)

## Before the day

- Open the live site on your **laptop in Chrome**, tap **Turn on AI** on Wi-Fi, and wait until the chip says `AI: on`. Do this the day before. The model is then cached.
- Reload once, then check the chip still says `AI: on`.
- Have a **screen recording** of the whole demo ready in case the internet or the model fails.
- Charge your phone and have the live link open on it too.
- Close other tabs. Turn off notifications.

## Slides: 3 minutes (slides 1 to 6 of the deck)

| Time | Slide | Say |
|---|---|---|
| 0:00 | 1 Title | "Spot the Scam teaches Nigerians to spot fake alerts, and checks suspicious messages for them, privately and offline." |
| 0:20 | 2 Problem | "Fake credit alerts, fake POS helpers, fake jobs and loans. The people hit hardest have limited data and nobody to ask." |
| 0:50 | 3 Users | "Students, traders, POS agents and parents on cheap phones with expensive data." |
| 1:15 | 4 Solution | "A game that trains your eyes, and a Scam Checker for messages, links and app files." |
| 1:50 | 5 The AI model | "Qwen2.5-0.5B, Apache-2.0, runs on the phone, so messages never leave the device. It gives a second opinion and an explanation. A hard rule always beats the model, and it can be wrong, so we say so." |
| 2:30 | 6 Honest results | "On messages we wrote to break our rules, the rules were never dangerously wrong but unsure 60% of the time. The AI is for those. Here are the measured results." |

Then say: "Let me show you." and switch to the live demo.

## Live demo: 5 minutes

**1. The game (60 s)**
- Tap **Play**. Answer one card. Show the red flags lighting up and the reason.
- "Every answer teaches something."

**2. Fake message, instant (45 s)**
- Back, **Scam Checker**, tap the **Fake bank text** example.
- Point to: the red banner, "caught by a hard rule", the highlighted phrases, "Similar known cases".
- "It answered instantly, with no AI, and shows exactly why."

**3. Genuine message (30 s)**
- Tap **Real alert**. Green banner. "It also knows what a genuine alert looks like: a balance, no link, and use the number on your card."

**4. The tricky one and the AI (90 s)**
- Tap **Tricky one**. Amber "Not sure". "A paraphrased scam with no trigger words. The rules are honest and say not sure."
- Tap again with the **AI on**. Show "AI second opinion: SCAM" and the explanation.
- "Same message, now resolved. The AI uses similar cases from our database as examples. Everything ran on this laptop."
- Tick **Pidgin** and run again to show the result in Pidgin.

**5. Link and APK (60 s)**
- **Link** tab: paste `secure.korabank.com.evil.xyz/login`. Show "looks fake" and the reasons.
- **APK** tab: choose a test APK. Show "Very risky: reads SMS and watches the screen. That is how banking trojans steal OTPs."
- "No upload. Nothing leaves the phone."

**6. Offline (30 s)**
- On your phone: airplane mode, reopen the app, run a check. "It works with no data."

**7. Close (15 s)**
- "Open source, Apache-2.0, documented, and honest about its limits."

## Questions judges may ask

| Question | Answer |
|---|---|
| Why a tiny model? | Privacy and offline use. Messages about money should not go to a server. It is also opt-in because of the size. |
| How accurate is the AI? | Give the numbers from `EVALUATION.md` exactly. Say the sets are small and team-written. |
| What if the model is wrong? | A hard rule wins, "genuine" needs positive evidence, disagreement gives "not sure", and the text says it can be wrong. |
| Where is the data from? | Hand-written, fictional, Nigerian-context examples. 91 rows. Not scraped from victims. |
| Why a stress set? | Because 100% on our own examples was too good to trust. It found that v1 called 10 scams genuine, and we fixed that. |
| What did the team build and what did AI build? | Be straight: AI-assisted code and data, reviewed by us. See `AI_DISCLOSURE.md`. Then explain one file in detail. |
| Next steps? | Test on real, consented messages, review Pidgin with native speakers, add Yoruba, Igbo and Hausa, partner with banks for verified domains, add a way to report new scams. |

## If something breaks

- Model will not load: say "the checker falls back to rules and the database", and carry on. That fallback is a feature.
- Internet is down: use the offline mode and the recording.
- A check gives a surprising answer: say so, point to the "Why" list, and use it to explain the limitations. Honesty scores well.
