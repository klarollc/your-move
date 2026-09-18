# C-17 manual screen-reader walkthrough — Decision Notice

Status: **human walkthrough performed; criterion not claimed as met**

This record captures the bounded walkthrough performed by the owner/user with NVDA against the
current Decision Notice build. It is human evidence, not an accessibility-tree or automated-test
substitute. Findings are recorded as observed; provisional severity labels remain subject to the
independent review required by the phase gate.

## Environment

```text
Screen reader and version: NonVisual Desktop Access (NVDA) 2026.2.0.57664
Browser and version: Codex In-app Browser, Chromium-based; version not captured
Viewport: unknown; remote laptop-to-PC session, neither 1440x900 nor 1280x800 verified
Build: c1cfe0143431eb61cd2787e3c7344048b36aa324
Build serving method: loopback Vite dev server at http://127.0.0.1:4173
Date: 2026-09-18
Worktree note: one unrelated pre-existing modification in docs/evidence/phase-5/side-effect-review.json
```

## Rule applied

The record reports what NVDA announced or failed to announce. Visible text and automated
accessibility artifacts were not treated as spoken output. No code was changed during the run.

## Journeys and states exercised

| Journey/state | Human observation |
| --- | --- |
| Pending baseline | General text and actions were announced. The Missing report and External report rows, including their disabled controls, were initially reported silent. |
| Defer — empty reason | Invalid alert announced “Reason required”; instruction to add a short explanation; focus returned to the reason box. |
| Defer — overlong reason | Error announced “Reason too long”; instruction to shorten the explanation; focus returned to the edit box. |
| Defer — invalid/absent review date | Review-date error announced; instruction to choose a future date; focus moved to the date box. |
| Defer success | Decision deferred, next review date, and reason announced; focus moved to Undo latest decision change. |
| Undo deferral | Decision restored to pending; status pending announced; focus returned to the Acknowledge/Defer action area. |
| Acknowledge success, first run | Decision acknowledged and Undo available announced; focus landed on the current acknowledged status. |
| Resolved evidence inspection | Four-item evidence list announced; Preflight packet button activated; local-fixture availability announced; focus stayed on that button. |
| Save failure | Save failed announced; input preservation and retry instruction announced; focus landed on the save-failed status. |
| Disabled state | Disabled state and resolved evidence controls announced. Acknowledge was not activatable. Defer was also reported neither spoken nor activatable. |
| Overdue read-only | Main landmark, overdue status, significant severity, October 1, 2026 due date, evidence controls, and both actions announced. Focus landed on Decision loaded text. |
| Unknown severity | Unknown severity and source value blocker announced. Preflight and Round were spoken/inspectable; the other evidence items were unavailable. Actions remained reachable. |
| Critical severity | Critical severity announced; 2 of 5 evidence buttons and both action buttons active. Initial and final focus were reported at Decision notice loaded. |
| Routine severity | Routine severity announced; all actions reachable. Initial and final focus were reported as CuckCode — Graybox Office. |
| Malformed date | Due date unavailable: malformed and raw value `2026-13-45T99:99:99Z` announced. Evidence/actions reachable. Focus was reported as CuckCode — Graybox Office. |
| Invalid evidence state | Evidence missing, Evidence reference invalid, and Evidence unavailable were reported. Preflight and Round were available/spoken; the remaining evidence content/buttons were not spoken. Actions remained reachable. |
| Saving transition, second run | Saving was heard, but the run appeared stuck in Saving; no settled acknowledged or save-failed state was heard. Reload returned to pending. |

## Findings

| ID | Step/state | Severity | What was announced or observed | What should have been announced/occurred |
| --- | --- | --- | --- | --- |
| C17-SR-01 | Acknowledge, second run | **V0 Critical — provisional** | NVDA announced Saving and the interface remained there; no settled success or failure state was announced. | The action should settle deterministically in acknowledged or save-failed, with a usable next action. |
| C17-SR-02 | Save failure | **V1 High — provisional** | Save failure and retry instruction were announced, but focus landed on the save-failed status rather than Retry. | Focus should move to the Retry control while preserving the input. |
| C17-SR-03 | Disabled state | **V1 High — provisional** | Defer was reported neither spoken nor activatable. | The disabled Defer control and its explanation should be exposed to the screen reader while remaining non-activatable. |
| C17-SR-04 | Evidence states | **V1 High — provisional** | The initial pending run reported the Missing and External rows and disabled controls silent. A later invalid-link run reported the three state labels but not the remaining evidence content/buttons. The exact row-versus-control boundary was not resolved during the run. | Every evidence row must expose its artifact name, state, and disabled/inspectable semantics consistently. |
| C17-SR-05 | Direct state/reload focus | **V1 High — provisional** | Several direct states reported initial/final focus on page or “Decision notice loaded” text rather than the named status target. | Focus should land on the contract-specified status/action target after mount or state transition. |

## Confirmed expected outcomes

- Empty, overlong, and invalid-date deferral paths identified the relevant error and returned focus
  to the field requiring correction.
- Valid deferral announced the deferred state, date, and reason, and exposed Undo.
- Undo restored pending and returned the user to the action context.
- Resolved evidence inspection stayed within the local fixture and retained focus on the control.
- Disabled Acknowledge did not activate.
- Unknown, critical, routine, overdue, and malformed-date text states were distinguishable when
  reached.

## Omissions and limits

- Browser version was not captured.
- The approved 1440x900 or 1280x800 viewport was not verified because the user was remote and could
  not determine the PC viewport.
- No human reduced-motion setting walkthrough was performed.
- No human 200% browser-zoom walkthrough was performed.
- Only NVDA was exercised; Narrator, JAWS, and other screen readers were not exercised.
- Missing and unavailable evidence routes were not separately replayed after the initial silent-row
  observation; the invalid-link state exposed an unresolved wording boundary noted above.
- No separate visual acceptance, owner art-direction approval, or independent release review was
  performed by this record.
- No claim is made that C-17 is satisfied. This record only documents the bounded human run and its
  shortfalls.

## Disposition

`INCOMPLETE — human walkthrough record exists, but C-17 is not claimed as met. The run produced one
provisional V0 finding, multiple provisional V1 findings, and explicit environment/coverage
omissions. Independent review and any owner disposition remain separate gates.`

## Owner disposition addendum — 2026-09-18

The owner subsequently ruled C-17 **met** on the basis that this bounded NVDA run is a genuine full
screen-reader walkthrough for the Decision Notice surface. The original disposition above is
preserved as the state before that ruling; it is not rewritten. The findings and omissions remain
current and are not closed by the criterion disposition.

See `docs/evidence/phase-5/decision-record-2026-09-18-c-17-owner-disposition.md` and
`docs/evidence/phase-5/c-17-owner-acceptance.json`.
