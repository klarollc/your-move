# Your Move R4 — evidence

Branch `feature/your-move-r4-lamp-hosted`, captured 2026-10-19.

## Browser (Track E triage surface, AGENTS.md UI gate)

`browser/chromium-1440/` and `browser/chromium-1280/` hold the current production build
(`npm run build --workspace @cuckcode/web`) served by the real hosted app with fake provider
and GitHub upstreams, so every run state appears at once. The fake lamp lights replies that ask
the owner something. The demo harness was a local scratch script and is not committed.

| File                                 | State                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `01-street-unfolded.png`             | The street on load: the first lit window is unfolded beside the house               |
| `02-proposal-go-ahead-and-send.png`  | A proposed file change: "Go ahead and send", "Nothing goes out until you say so"    |
| `03-reply-lamp-lit.png`              | The agent asked something and the lamp lit on it; reply box, "Draw the curtain"     |
| `04-paused-restart.png`              | Provider unreachable: Restart or Draw the curtain                                   |
| `05-working-close-only.png`          | Working: the only action is Draw the curtain                                        |
| `06-done-pick-up-again.png`          | Done: Pick it up again                                                              |
| `07-see-it-as-a-list.png`            | The list escape hatch                                                               |
| `08-connections-plan-and-lamp.png`   | Connections: Continue with ChatGPT (import) and the lamp's Ollama address and token |
| `09-keyboard-opened.png`             | Keyboard: Tab reaches the lit windows first; Enter unfolds the focused one          |

`browser/checks.json` records, per viewport: no console errors, no 4xx/5xx responses, the
`/api/events` WebSocket open, the Tab order, the window Enter opened, the unfold animation
present normally and `none` under `prefers-reduced-motion: reduce` (curtain transition `0s`).

## Lamp latency (Track A #5)

`lamp-latency.json` is written by `npx tsx scripts/verify-r4-lamp-latency.ts`: the hosted app,
real execution loop, real lamp pipeline, real `classifyLampV2` (qwen3:8b, prompt v2, locked)
against the owner's Ollama, and a real WebSocket subscriber on `/api/events`. Agent replies are
replayed from `docs/evidence/phase-4/live-kickoff/task-17-run/run-attempt-2.json`, one at a time.
`server` is observe → verdict published; `client` is provider reply returned → verdict received.
The model's cold start is measured once and kept out of the samples.
