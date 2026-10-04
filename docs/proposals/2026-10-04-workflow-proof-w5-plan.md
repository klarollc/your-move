# Workflow-proof W5 — task plan, DRAFT (2026-10-04)

**Status: draft for owner approval. Authorizes nothing until approved.** Implements plan task W5 (`2026-10-03-workflow-proof-plan.md`). Facts below were read from the repo on 2026-10-04 unless marked **[unverified]**.

## 1. Why W5 changes from the approved wording

The approved P-2 data path was an append-only JSONL log read into the loopback server's `eventHistory`. The code shows that path cannot meet pass criterion (b), assignment from a surface:

- `GET /api/workspace` returns one static, seeded `readModel` object.
- `POST /api/commands` validates a command and returns a receipt. It applies nothing and changes no state.
- `eventHistory` is a websocket replay of `{revision, eventId, type, payload}`, not a `ProjectEvent`.
- `apps/web` does not call the server. The only mention is an error string in `office-shell.tsx`.
- `apps/server` depends only on `contracts`. It has no dependency on `domain` or `application`.

**Owner ruling (2026-10-04): the server applies commands to the log.** This goes beyond the approved P-2 wording and is recorded here as an amendment to it.

## 2. Design

- **Log.** One append-only JSONL file of `ProjectEvent` records, one per line. The file is the source of truth. A revision is the count of events in the log (the W3 convention). A truncated final line is reported as partial, never dropped silently.
- **Server read.** `GET /api/workspace` reads the log, replays it with `replayProject`, and returns the projected read model on each request. No cached state.
- **Server write.** `POST /api/commands` maps a create or assign command to `executeWorkCommand` (W3), checks the revision against the log, and appends the resulting events. Writes are serialised. A stale revision returns the existing 409. A refused command returns the W3 code and appends nothing.
- **Runner.** The runner appends events to the same log: posture, per-turn records, evidence, and transitions. It calls the W4 rules: `checkReadiness` before turn 1, `reconcileRecords` after each turn, `judgeDoneClaim` before a review or verified transition. `TRACER_RESULT` no longer drives transitions.
- **Failure behaviour.** If a rule refuses, the runner appends the blocking transition and stops. It never proceeds past a hard stop.

## 3. Steps (each starts RED against a stub)

- **W5a. Log module** in `apps/server` (not `packages/persistence`, whose index pulls in `better-sqlite3`, which runs only on Windows). Append, read, partial detection. RED: replaying the log reproduces the in-memory reduced state; a truncated log is reported partial; an unparseable line is reported, not skipped.
- **W5b. Workspace command intents** for create and assign. RED: a command carrying a contract and an assign request validates; an agent actor is refused; a payload containing a secret is refused. This is a **contract change**.
- **W5c. Server apply path.** RED, over HTTP with the server in-process: a create command then GET shows the item; assign moves it to `assigned`; a stale revision gets 409; two simultaneous commands do not both succeed. Needs `apps/server` to depend on `domain` and `application`, a `package.json` and lockfile change that must be made by `npm install` on Windows (**owner-run**).
- **W5d. Runner bridge.** Turn records, posture and evidence appended as events; W4 rules called at the three points above. RED against a fake runtime: a blocked-before-turn-1 run appends a `blocked` transition and no turn; a mismatch appends a hard stop.
- **W5e. Rehearsal fixture** reading the whole loop back from the log. Feeds W10.

## 4. Things this plan does not solve, stated plainly

1. **No event kind exists for posture or turn records.** `eventKinds` is a closed list. Without a ruling, posture and turn records ride as `evidence.recorded` payload fields. The reducer stores only id, kind, version and result, so the surface cannot show requested, granted and declared posture until W6 extends the read model. **[OWNER]** to rule at W6: add event kinds (contract change) or carry posture in evidence payloads.
2. **The server becomes a writer.** It has a session id and a CSRF token and binds to 127.0.0.1. That is the existing posture and I have not changed it, but a server that mutates the log needs a security read before W5c ships. I will include that read in the W5c findings.
3. **Single writer assumption.** The runner and the server both append to one file. Safe appends need either one process holding a lock or an append-with-revision check. W5c tests the server side; the runner side is covered in W5d. A third writer is out of scope.
4. **Container limits.** The server tests run in-process in my container. A real two-process race on Windows is only observable on the owner's machine.
5. **Contract changes in W5b** need a full verify and a provenance check.

## 5. Decisions requested

1. Approve this plan, or amend it.
2. Is a lockfile change for `apps/server` (new workspace dependencies) acceptable? If not, W5c needs a different shape.
3. Confirm the single-file, single-writer assumption for the proof (one manager, one runner).
