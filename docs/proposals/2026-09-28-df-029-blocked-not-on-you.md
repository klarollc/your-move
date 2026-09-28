# DF-029 amendment: blocked, but not on you

**Status: PROPOSED 2026-09-28, awaiting owner decisions B-1 to B-5.** Drafting authorized by the
owner 2026-09-28. **Implementation is not authorized** and, by the owner's ruling on DF-029, follows
Phase 7-O acceptance (Task 12): it changes what the office shows, so it cannot land during the
Task 11 cold-run interval.

Author: agent. Source finding: DF-029 in `docs/evidence/dogfood-register.md`.

Governing plate: **AR-03**, column 1 ("Sam · Blocked" in neutral; "Waiting for the source document.
Ari needs to provide the document."). Constitution **rule 4**: "A blocker does not necessarily need
manager action. Show the reason and who can resolve it. Reserve manager-question language for
actual questions attributed to the requesting agent." Rule 5: the bar separates obligations.

## 1. The problem, in the model

An agent can report _that_ it is blocked, but not that someone other than the manager can clear it.

- **Contract.** A version-2 `WorkCondition` requires `requestedAction` on every attention-raising
  transition (`packages/contracts/src/work-payloads.ts`). A blocker therefore always carries a
  request, and the request has no addressee: the model assumes it is the manager's.
- **Domain.** `projectManagerAttention` (`packages/domain/src/attention.ts`) makes every `blocked`,
  `failed` and `waiting_input` work item a manager attention item, whatever `waitingOn` names.
- **Web.** `needsManager` is `person.attention.length > 0`, so every blocked person reads amber
  "Needs you", and the bar counts every blocker (P-4).

`waitingOn` already names the resolver (`manager`, `agent`, `external`, `evidence`). Nothing reads it
to decide whether the manager is needed.

This is an agent-side problem, the kind the dogfood register exists for: an agent blocked on another
agent can only reach the manager's attention, so every blocker costs the manager a look, and the
manager cannot tell "I must act" from "I can watch".

## 2. Proposed rule

**A condition says who can resolve it (`waitingOn`), and separately whether the manager is asked
to act (`requestedAction`, now optional). Manager attention is raised by the request, not by the
state.**

| Condition                                                    | Attention item | Scene and outline                        | Inspector "What needs you"             |
| ------------------------------------------------------------ | -------------- | ---------------------------------------- | -------------------------------------- |
| `requestedAction` present (any `waitingOn`)                  | yes            | "{state} · Needs you", amber             | the request                            |
| `requestedAction` absent, `waitingOn` agent/evidence/external | **no**         | "{state}", neutral, plus who can resolve | "Nothing needs you. {resolver} can resolve it." |
| No condition recorded (version-1 payloads)                   | yes, as today  | as today                                 | "No requested action recorded"          |

The last row keeps today's conservative behaviour for recorded logs: absence of a condition is
unknown, not "not on you".

`waitingOn: { kind: "manager" }` with no request is refused at validation: the manager cannot be
the resolver of something nobody asked them to do.

## 3. Decisions needed

- **B-1, contract version.** (a) **Recommended:** `payloadVersion: 3`, where `requestedAction` is
  optional under the rule above; versions 1 and 2 keep their exact meaning, so every recorded log
  replays unchanged. (b) Loosen version 2 in place. Rejected: version 2's recorded meaning is
  "the manager is asked", and changing it silently re-reads accepted evidence.
- **B-2, resolver text.** "Who can resolve it" is derived, never free text: an agent id resolves
  through staffing to its role name ("Implementation Engineer can resolve it"); an evidence id to
  its kind and version ("Waiting for Browser evidence, version 2"); `external` reads "an external
  dependency". An id that does not resolve reads "Who can resolve it: not recorded", never a guess.
  Recommendation: yes.
- **B-3, the bar count (revisits P-4).** Only attention items are counted, so a blocker that is not
  on you drops out of the bar by construction. The P-4 groups stay (questions, reviews, blocked).
  Recommendation: yes. Alternative: also rename the "blocked" group to "decision", since every
  remaining counted blocker now carries a request; this changes more copy.
- **B-4, fixtures.** Add one named log, `blocked-elsewhere`, for AR-03 column 1: the Test Engineer
  blocked, waiting on the Implementation Engineer, no request. The default office does not change,
  so the Phase 7-O comprehension key and captures stay valid. Recommendation: yes.
- **B-5, what agents emit.** Today the only producers of version-2 conditions are the fixtures.
  Whether the live runtime path (the Codex normalizer, role briefs) should emit version 3 is out of
  scope here and recorded as a follow-on, so the amendment is not mistaken for a runtime change.
  Recommendation: yes.

## 4. Specification changes (Phase 7-O spec, as a successor section)

- §3.2: version 3 and the rule in §2.
- §6: "If an open rail item relates to the selected entity…" is unchanged; add that a blocked item
  without a request shows its resolver and "Nothing needs you".
- §7, a ninth adversarial class: **a blocker without a request, waiting on an agent** — never
  "Needs you", never counted, never in the rail; the inspector names the resolver.
- §8.4 (R-2): unchanged for attention items. Add: for every blocked item that is not an attention
  item, the inspector resolves the reason and the resolver.

## 5. Method, when authorized

Test first in order: contract (version 3 validation and the manager-without-request refusal),
domain (attention raised by the request; the version-1 row unchanged), web (label, rail, bar,
inspector), then the `blocked-elsewhere` log and its e2e. One mutation per guard. The Phase 6 v1
digest reduction proof and the Phase 7-O comprehension key spec must still pass unchanged; if
either moves, work stops for a ruling.

## 6. Not in this amendment

- Rendering of the resolver in the scene beyond the text label (Phase 7).
- Answer choices for questions (AR-02 frame 4; `OpenQuestion` has no choices field).
- "See dependency" navigation (AR-03 column 1's link), which needs a navigable dependency record.
