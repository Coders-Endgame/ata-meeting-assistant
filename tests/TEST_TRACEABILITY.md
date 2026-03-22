# Test Plan Traceability

| Test ID | Status | Test File(s) | Scope |
| --- | --- | --- | --- |
| TC-01 | Partial | `tests/e2e/auth.spec.js` | Real browser sign-up submission against configured Supabase auth; the default suite accepts either confirmation or the provider's email rate-limit response. |
| TC-02 | Automated | `tests/e2e/auth.spec.js` | Real browser valid-login flow with seeded user. |
| TC-03 | Automated | `tests/e2e/auth.spec.js` | Real browser invalid-login error handling. |
| TC-04 | Automated | `tests/integration/api.test.mjs` | Live API `/health` contract. |
| TC-05 | Automated | `tests/integration/api.test.mjs` | `/api/summarize` request validation. |
| TC-06 | Automated | `tests/integration/api.test.mjs` | `/api/transcribe` request validation. |
| TC-07 | Automated | `tests/integration/api.test.mjs` | `/api/chat` request validation. |
| TC-08 | Automated | `tests/integration/api.test.mjs` | `/api/bot/start` request validation. |
| TC-09 | Partial | `services/summarizer/tests/test_transcriber.py` | Real model accuracy is manual; pytest covers pipeline behavior with deterministic Whisper output. |
| TC-10 | Automated | `services/summarizer/tests/test_summarizer.py` | LLM JSON parsing helper. |
| TC-11 | Automated | `tests/e2e/offline-flow.spec.js` | Real browser upload to configured storage and session creation. |
| TC-12 | Automated | `tests/e2e/offline-flow.spec.js` | Real offline pipeline from upload to persisted transcripts and summary. |
| TC-13 | Automated | `tests/integration/api.test.mjs` | Live `/api/summarize` forwarding to the running summarizer. |
| TC-14 | Automated | `tests/integration/api.test.mjs`, `services/summarizer/tests/test_summarizer.py` | Real DB persistence plus deterministic storage assertions. |
| TC-15 | Automated | `tests/integration/api.test.mjs`, `tests/e2e/settings.spec.js` | Live preference save/load through API, DB, and browser UI. |
| TC-16 | Partial | `tests/integration/api.test.mjs` | Bot status/orchestration coverage only; no default live Zoom meeting harness. |
| TC-17 | Automated | `tests/e2e/offline-flow.spec.js` | Real browser offline flow end to end. |
| TC-18 | Partial/manual | `tests/e2e/settings.spec.js` | Language preference persistence is automated; offline preferred-language behavior is not implemented in production. |
| TC-19 | Automated | `tests/e2e/dashboard.spec.js` | Recent sessions list and navigation. |
| TC-20 | Automated | `tests/e2e/session.spec.js` | Transcript TXT export content. |
| TC-21 | Automated | `tests/e2e/session.spec.js` | Summary JSON export content. |
| TC-22 | Manual | This document | Real-time transcription latency depends on live meeting/audio environment. |
| TC-23 | Manual | This document | Summary latency depends on local Ollama model and hardware. |
| TC-24 | Manual | This document | English WER requires a curated evaluation corpus and scoring harness. |
| TC-25 | Manual | This document | Turkish WER requires a curated evaluation corpus and scoring harness. |
| TC-26 | Automated | `tests/integration/load.test.mjs` | Five concurrent summarize requests against the live stack; no brittle time threshold. |
| TC-27 | Partial | `tests/e2e/auth.spec.js`, `tests/e2e/offline-flow.spec.js` | First-session path is automated; live sign-up confirmation is still subject to auth-provider email throttling. |
| TC-28 | Partial | `tests/e2e/dashboard.spec.js`, `tests/integration/api.test.mjs` | Local UI/API orchestration only; no external Zoom meeting automation. |
| TC-29 | Automated | `tests/e2e/offline-flow.spec.js` | Upload usability via real browser flow. |
| TC-30 | Automated | `tests/e2e/session.spec.js` | Action item viewing and completion toggle. |

## Additional Coverage

- `tests/integration/api.test.mjs` also covers `/api/config`, `/api/models`, and idle bot status/list responses.
- `services/summarizer/tests/test_main_api.py` covers FastAPI `/health`, `/models`, `/summarize`, `/transcribe`, and `/chat` behavior in-process.
- The suite intentionally tests current implementation behavior, including the extra `timestamp` field on `/health` and the fact that preferred model persistence does not yet affect summarize/chat requests.
- Browser-based cases depend on Playwright Chromium being installed with its host OS libraries; `npm run test:e2e` now fails fast with a dedicated preflight message if that machine-level dependency is missing.
