/* ==========================================================================
   ai.js  |  SPOT THE SCAM  |  Open-weight model, running in the browser
   Model:    Qwen2.5-0.5B-Instruct (Alibaba Cloud / Qwen team), Apache-2.0
   Weights:  onnx-community/Qwen2.5-0.5B-Instruct on Hugging Face (ONNX build)
   Runtime:  Transformers.js (Hugging Face), pinned to 3.7.6, via jsDelivr

   The message never leaves the device. The model files (~0.5-0.8 GB) are
   downloaded once, after the user taps "Turn on AI", then cached by the browser.

   The backend is pluggable: AI.setBackend({ generate(messages, opts) }) lets
   tests (or another runtime) replace the model without touching the app.
   ========================================================================== */
(function (root) {
  'use strict';

  const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
  const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';

  const AI = {
    MODEL_ID, LIB_URL,
    state: 'off',            // off | loading | ready | error
    device: null,
    dtype: null,
    error: null,
    backend: null,           // custom backend, if any
    _pipe: null,
    _loading: null,

    supported() {
      return typeof WebAssembly === 'object';
    },

    setBackend(b) {
      this.backend = b;
      this.state = 'ready';
      this.device = 'custom';
      this.dtype = '-';
    },

    /**
     * Downloads and starts the model. onProgress({ pct, loadedMB, totalMB, file, text })
     * Tries WebGPU first (fast) and falls back to WASM (works almost everywhere).
     */
    async load(onProgress = () => {}) {
      if (this.state === 'ready') return;
      if (this._loading) return this._loading;
      this.state = 'loading';
      this.error = null;

      this._loading = (async () => {
        const tf = await import(LIB_URL);
        tf.env.allowLocalModels = false;
        const files = {};
        const progress = (p) => {
          if (p.status === 'progress' && p.total) {
            files[p.file] = { loaded: p.loaded, total: p.total };
            const L = Object.values(files).reduce((a, f) => a + f.loaded, 0);
            const T = Object.values(files).reduce((a, f) => a + f.total, 0);
            onProgress({ pct: Math.min(99, Math.round((L / T) * 100)), loadedMB: Math.round(L / 1048576), totalMB: Math.round(T / 1048576), file: p.file, text: 'downloading model' });
          } else if (p.status === 'ready') {
            onProgress({ pct: 100, text: 'starting model' });
          }
        };

        // Variants tried in order. A 404 for one dtype just moves on to the next.
        const attempts = (typeof navigator !== 'undefined' && navigator.gpu)
          ? [{ device: 'webgpu', dtype: 'q4f16' }, { device: 'webgpu', dtype: 'q4' }, { device: 'wasm', dtype: 'q4' }]
          : [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'q4' }];

        let last;
        for (const a of attempts) {
          try {
            onProgress({ pct: 0, text: `loading ${a.dtype} on ${a.device}` });
            this._pipe = await tf.pipeline('text-generation', MODEL_ID, { ...a, progress_callback: progress });
            this.device = a.device;
            this.dtype = a.dtype;
            this.state = 'ready';
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
            return;
          } catch (e) {
            last = e;
            console.warn('[ai] variant failed', a, e);
          }
        }
        throw last || new Error('model could not be loaded');
      })();

      try {
        await this._loading;
      } catch (e) {
        this.state = 'error';
        this.error = (e && e.message) || String(e);
        throw e;
      } finally {
        this._loading = null;
      }
    },

    /** Runs the chat model and returns the assistant's text. */
    async generate(messages, { maxNewTokens = 8 } = {}) {
      if (this.backend) return this.backend.generate(messages, { maxNewTokens });
      if (this.state !== 'ready' || !this._pipe) throw new Error('AI is not loaded');
      const out = await this._pipe(messages, { max_new_tokens: maxNewTokens, do_sample: false });
      return String(out[0].generated_text.at(-1).content || '').trim();
    },

    /** One-word verdict: 'scam' | 'real' | 'unsure'. `examples` = retrieved few-shot pairs. */
    async classify(text, examples) {
      const reply = await this.generate(root.Checker.classifyMessages(text, examples), { maxNewTokens: 4 });
      return { verdict: root.Checker.parseVerdict(reply), raw: reply };
    },

    /** Short plain-language explanation grounded in the rule signals. */
    async explain(text, result, lang) {
      return this.generate(root.Checker.explainMessages(text, result, lang), { maxNewTokens: 90 });
    },
  };

  root.AI = AI;
})(typeof self !== 'undefined' ? self : this);
