# Model card: Qwen2.5-0.5B-Instruct in Spot the Scam

This answers the OPEN//BUILD "Model information" requirement: the model used, its role, why it was selected, and its limitations.

## Model used

| | |
|---|---|
| Name | Qwen2.5-0.5B-Instruct |
| Developer | Qwen team, Alibaba Cloud |
| Base repository | https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct |
| Weights loaded by the app | https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct (ONNX conversion for Transformers.js) |
| Size | about 0.5 billion parameters. Browser download: the `q4` variant is 786 MB (verified on its file page). Other variants (`q4f16`, `q8`) may be smaller; the app tries them in order. |
| Licence | Apache-2.0, as stated on the base model repository. **Open weights do not automatically mean fully open source**, so the team must read the LICENSE on both pages and keep a copy of the licence text with any redistribution. |
| Runtime | Transformers.js 3.7.6 (Hugging Face), loaded from jsDelivr. WebGPU first, WebAssembly as fallback. |
| Where it runs | In the user's browser. No server, no API key, no message leaves the device. |

## Role in the project

The model is one of three evidence sources, never the only one.

1. **Second opinion.** The message plus up to four retrieved examples are sent as a chat prompt. The model answers one word: SCAM or REAL. The prompt and the parsing are in `checker.js` (`classifyMessages`, `parseVerdict`).
2. **Retrieval-augmented examples.** `db.js` finds the most similar labelled messages in the database. They become the few-shot examples the model sees, so it reasons from cases close to the one being asked about.
3. **Plain-language explanation.** A second short prompt asks for two sentences, using only the red flags the rules found (`explainMessages`). This grounds the text in facts, which reduces invented details.

The final verdict comes from `combine()` in `checker.js`: hard rules win; otherwise rule belief and model belief are averaged; disagreement gives "not sure".

## Why this model

- **Small enough for on-device use.** Messages about money are private. Running in the browser means no server and no data leaving the phone.
- **Open weights with a permissive licence** and an official browser-ready conversion.
- **Instruction-tuned**, so a simple one-word-answer prompt works.
- **Right size for the audience.** A larger model would be too big a download for users on limited data. The AI is also opt-in and optional: the whole app works without it.

Alternatives considered (verify licences before relying on them): other small instruction models under permissive licences, larger models that are too big for a phone browser, and hosted APIs that would send private messages to a server and need keys and internet. We chose on-device privacy and offline use over raw accuracy.

## Intended use

Helping an ordinary person decide whether to trust a message, learn the warning signs, and warn others. It is an awareness aid.

## Not intended for

Automatic blocking, legal or financial decisions, evidence in a dispute, or protecting real bank customers without further testing on real, local data.

## Limitations

- **A 0.5B model is weak.** It can misread tone, sarcasm, long messages, mixed English and Pidgin, and unusual scams. It may be confidently wrong.
- **Pidgin and local languages.** The model is not tuned for Nigerian Pidgin, Yoruba, Igbo or Hausa. Pidgin output of the app is **templated**, not model-generated, for this reason.
- **Prompt sensitivity.** Small prompt changes can flip answers. The prompt is fixed and tested only with the evaluation sets in this repo.
- **Possible bias in examples.** Retrieval uses 91 hand-written examples written by the team. They reflect our view of scams and may miss new tricks.
- **No real-world accuracy figure yet.** We measured the rules only. The model's numbers must be produced with `eval.html` (see `EVALUATION.md`). Until that table is filled in, we claim nothing about the model's accuracy.
- **Speed and size.** The download is large and first use can take minutes. On low-end phones inference can take many seconds, or fail. The app then falls back to rules and the database.
- **Hallucination.** The explanation can contain wrong statements. It is labelled "can be wrong" in the interface, and it never changes the verdict by itself.

## Safety design

- A hard rule always overrides the model.
- Rules only say "genuine" with positive evidence.
- If rules and model disagree, the answer is "not sure".
- Users are told never to share a PIN or OTP and to check inside their own banking app.

## Reproducing

```bash
python3 -m http.server 8000      # in the repo folder
# open http://localhost:8000/eval.html in Chrome
# click "Load AI model", then "Run full benchmark"
```
