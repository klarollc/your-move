# Phase 1 invariant matrix

Status: **Machine-verified and owner-accepted on 2026-08-13**

| Invariant | Evidence | Result |
| --- | --- | --- |
| Stable IDs, timestamps, injected clock and IDs | `primitives.unit.test.ts` | Pass |
| Canonical JSON is byte-stable and rejects unsupported values | `canonical-json.unit.test.ts` | Pass |
| Unsupported or malformed events cannot enter truth | `events.unit.test.ts`, `event-order.unit.test.ts` | Pass |
| Duplicate events are idempotent; conflicting duplicates are quarantined | `event-order.unit.test.ts`, `replay.unit.test.ts` | Pass |
| Input order does not change canonical replay bytes | `replay.unit.test.ts`, `determinism-hashes.json` | Pass |
| Invalid or stale transitions cannot invent progress | `work-truth.unit.test.ts`, `replay.unit.test.ts` | Pass |
| Completion requires verification and does not imply approval | `work-truth.unit.test.ts`, `office-scene.unit.test.ts` | Pass |
| Only explicit manager events create version-bound approval | `work-truth.unit.test.ts` | Pass |
| One role per identity, six identities, and hard capability gates | `staffing.unit.test.ts`, `staffing-truth.unit.test.ts` | Pass |
| Mandatory qualification failures cannot be waived | `staffing.unit.test.ts` | Pass |
| Disconnected or stale agents cannot appear active or qualified | `staffing-truth.unit.test.ts`, `office-scene.unit.test.ts` | Pass |
| Agent findings cannot self-promote; unusable knowledge stays non-current | `knowledge.unit.test.ts`, `knowledge-truth.unit.test.ts` | Pass |
| Human and agent commands share authority and permissions | `collaboration.contract.test.ts`, `collaboration-policy.unit.test.ts` | Pass |
| Handoffs and errors preserve actionable recovery state | `collaboration.contract.test.ts` | Pass |
| No semantic work motion without canonical active state | `office-scene.unit.test.ts` | Pass |
| No collaboration scene without an active collaboration or handoff record | `office-scene.unit.test.ts` | Pass |
| Attention ordering is deterministic and completion requests approval | `attention.unit.test.ts` | Pass |
| Human outline and agent projection share byte-equivalent action state | `accessible-outline.unit.test.ts`, `agent-projection.unit.test.ts`, `determinism-hashes.json` | Pass |
| Ten simulator scenarios are schema-valid and byte-deterministic | `simulator.contract.test.ts`, `determinism-hashes.json` | Pass |
| Pure boundary excludes wall-clock reads, randomness, provider/network, Node process, React, PixiJS, DOM, and canvas | recorded source scans in `red-green-log.md` | Pass |

The browser and axe results in the full gate exercise the unchanged Phase 0 scaffold only. They are regression evidence, not Phase 1 rendered or visual acceptance evidence.