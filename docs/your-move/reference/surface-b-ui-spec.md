# Your Move UI Build Spec — "The Lamp" (Dusk palette)

**Status:** approved by owner 2026-10-04
**Product name:** Your Move (decided 2026-10-04; replaces the "Surface B" working title and the briefly-considered "Handoff" — dropped over the Apple Handoff trademark collision; "CuckCode" remains the repo/codename)
**Reference mockup:** `studio-mockup.html` (Dusk palette) — same folder
**Working prototype:** `surface-b-app.html` — same folder. A functional event-sourced implementation of this spec (in-memory log; UI renders as a projection of it). Implements rounds 2b–7: calm screen, deterministic ordering + collapse + filtering, failure drills (disconnect/verification/turn-budget/log gap), escalation detail panel, master lamp + log time-travel + two-sided journey, ruling session, away digest, nudge-the-quiet-ones, 60s ruling undo, attested acceptance, assignee lens, ruling receipts. Open in a desktop browser; chat previews block scripting.
**Handoff package (current choice for building agents, noted 2026-10-04):** this spec + `surface-b-app.html` + the round mocks (`yourmove-round2-empty.html`, `yourmove-round2b-calm.html`, `yourmove-round3-scale.html`, `yourmove-round4-failure.html`, `yourmove-round5-escalation.html`, `yourmove-round6-character.html`, `yourmove-round7-pain.html`).
**Supersedes:** all earlier Surface B mockup directions (five-theme edition, Ledger concept)

## 1. Concept

**The lamp: light means it's your move.** The UI rests in calm deep ink. A periwinkle glow marks exactly the items where the manager's action is needed — nothing else. One signal color, one meaning: periwinkle never appears except as "your move." This is the product's distinctive element, derived from its own thesis (reciprocal usability: the whole interface answers *whose turn is it?*).

A continuous "revision spine" thread was prototyped on the work list and **rejected by the owner**: drawing one line through status-grouped entries implies a temporal sequence that doesn't exist — theater, not truth. It was placed instead in the Log view, the one place it is honest, because the log genuinely is in revision order, newest first. Revision honesty elsewhere is carried per-entry (quiet `rNNN` labels; see §5).

## 2. Palette — Dusk (exact tokens)

| Token | Value | Use |
|---|---|---|
| `--plaster` | `#11162E` | Page background |
| `--card` | `#1A2140` | Cards, rail, panels |
| `--ink` | `#ECEFF8` | Primary text |
| `--muted` | `#98A1C6` | Secondary text |
| `--line` | `#2B3560` | Borders, hairlines |
| `--signal` | `#A3B2EA` | **"Your move" glow — this and only this** |
| `--signal-deep` | `#C6D1F2` | Signal text on dark |
| `--signal-soft` | `rgba(163,178,234,.14)` | Glow fill |
| `--glow` | `rgba(163,178,234,.5)` | Glow halo |
| `--terra` | `#C07A5E` | Blockers only |
| `--moss` | `#7FA98B` | Verified states only |
| `--char` | `#0B0F26` | Topbar chrome |
| Primary button | bg `#ECEFF8`, fg `#11162E` | |

**Type:** humanist sans (Inter / system) for management language; serif (Fraunces) sparingly for display headings; monospace (IBM Plex Mono) *restrained* — revisions, hashes, technical figures only.
**Explicit rejection (owner direction 2026-10-04):** the warm amber/plaster palette mandated by the original design documents does not work for this owner. Do not use high-saturation amber anywhere.

## 3. Layout and views

- **Chrome:** dark topbar — brand, quiet `as of rNNN` indicator, `+ New work`.
- **Three views:** Today (status-grouped work list: *Your move* / *In progress* / *Done*), New work (3-step create), Log (read-only event log).
- **Attention rail, omnipresent, titled "Your move."** Persistent until dispositioned — see §5.
- **Detail** opens as one focused panel, never a dashboard: plain-words state → the agreement → evidence with verification states → technical detail (hashes, worktrees, revisions) one deliberate drill-down deep.

## 4. The six approved UI decisions

1. **Primary view:** status-grouped list. No card grids, no metric panels, no chat-first.
2. **Attention:** omnipresent rail, visible from every view — "what needs me" can't depend on navigation.
3. **Escalation:** persistent until dispositioned. Actions: accept / send back / defer-with-reason. Nothing auto-clears, nothing ages out silently. Each matter carries title, action, risk, evidence.
4. **Status honesty (hard rule):** verified / recorded / claimed are visually distinct. "Done" appears only on verified evidence. Claims are shown — hiding them would also lie — but fenced in plain words ("says it's done"), never green.
5. **Create:** manager describes the outcome in plain words → agent drafts the structured contract → manager approves/edits. Nothing is written until approval.
6. **Phone-grade:** the rail must answer "what needs me" on a phone viewport.

## 5. Truthfulness rules (hard requirements)

1. Every figure carries its source revision. The UI never presents timeless facts.
2. Three epistemic states, kept distinct: **checked** / **recorded — not yet checked** / **not recorded yet**.
3. Gaps are shown, never hidden — a missing hash is displayed as missing.
4. No inferred state: report "no signal since rNNN," never relabel silence as "idle."
5. No optimistic UI: the rail updates when the ruling event is appended to the log; show an honest interim ("recording…").
6. Provenance travels with evidence: which run, which worktree, which hash.
7. **The log wins:** if the projection disagrees with the log, the UI announces the disagreement with a banner and offers refresh. (Demo this behavior; don't just handle it.)

## 6. Architecture constraint (non-negotiable)

The UI is a **read-model projection of the event log only**. No new event types, no new commands, no write path that bypasses `executeWorkCommand`. Read models may be invented freely; commands may not. If a design idea needs a new write path, the idea loses.

**Open reconciliation (flagged 2026-10-04):** Round 7 proposes two new event types — `work.nudged` (nudge-the-quiet-ones) and `ruling.withdrawn` (60s ruling undo). These are *proposed*, pending workflow-core ratification: the building agent must map them onto existing canonical commands/events where possible, or obtain an approved workflow-core change. The core's event vocabulary is authoritative; the prototype's names are not.

## 7. Spirit (from the CuckCode design docs; office elements excluded)

- Plain words first; technical truth one deliberate step away.
- One contextual interaction at a time. Calm beats constant motion — the screen should never feel busier than the work is.
- Distinct treatments, per the art direction: blockers (terracotta) vs. questions/reviews (signal glow) vs. unavailable information (gray, dashed, named — never omitted).
- The metaphor may simplify but cannot conceal errors, costs, permissions, or uncertainty.

## 8. Round decisions log

### Round 2/2b — Empty states (approved 2026-10-04; mock `yourmove-round2b-calm.html`)
- Three distinct empty states: **fresh empty** (no work exists), **all clear** (work exists, nothing needs you), **filtered empty** (search/filters hide everything; names the filter and counts hidden items — "5 items exist, none match").
- **The calm screen:** a full-bleed centered visual (unlit lamp, one headline, one button) that obscures the rail entirely. Fresh-empty *is* the calm screen; all-clear lands on it first, with "Show all work" revealing the full view. One component, two copy variants.
- Calm screen appears **every time** the manager lands on an all-clear (not sticky).
- A new your-move event **interrupts** the calm screen immediately — it never sits on top of a lit state.
- The log-empty microcopy ("projection of r000 · log empty") stays on the fresh-empty calm screen.
- Rail is never filtered by list search — your move is global.

### Round 3 — Scale + filtering (approved 2026-10-04; mock `yourmove-round3-scale.html`)
- One deterministic ordering rule per group: your move = longest waiting first; in progress = most recent signal first; queued = oldest first (FIFO); done = most recently verified first. No relevance ranking.
- Groups show counts; long groups auto-collapse past ~8 with a head-item line ("31 items — most recent: …"). Collapse state persists per session.
- Rail at scale: full scroll through **all** your-move matters, oldest first — never a "top 5" sample. Overflow line counts ("+ 4 more") with a "view all in list" link.
- Wait durations in plain words beside the revision ("waiting 3d · r501").
- Filtered views: fractional group counts ("1 of 11"), the showing-line names the filter ("3 of 61 shown · search "budget" · assignee Dana · as of r518"), rail labeled "unfiltered" — filters never masquerade as the world.

### Round 4 — Failure states (approved 2026-10-04; mock `yourmove-round4-failure.html`)
- **Disconnect:** banner ages the truth ("projection of r512 — 4 minutes old"); **writes are disabled while offline** (no outbox — a held ruling would be a claim the log doesn't contain, violating the claimed/recorded split; no reconciliation problem). Disabled buttons say why ("Rulings need the log"). The calm screen may appear under the banner with honest copy ("3 matters need your move, but the log is unreachable").
- **Verification failure:** rendered as a terra **blocker**, not a fourth color. "Accept anyway" is a real ruling with the manager's name on it; provenance (run, worktree, revision) travels with the failure.
- **Turn-budget exhaustion:** states turns used, deliverables verified ("10/10 turns · 3 of 5 deliverables verified"); actions are Grant N more turns (a number, in the log) / Re-scope / Close as incomplete.
- **Damaged log:** banner quantifies the disagreement (projection r512, log r515) with a single Refresh action; unreadable stretches render as named dashed gaps in the Log view ("r513–r514 · unreadable — nothing is inferred across it").

### Round 5 — Escalation detail (approved 2026-10-04; mock `yourmove-round5-escalation.html`)
- Detail panel **replaces the list column**; the rail stays omnipresent and marks the viewed matter ("viewing · r519") — a full-screen takeover would break the rail's visible-from-every-view rule.
- Panel order: plain-words decision → the agreement → evidence in all three epistemic states (verified / recorded-not-checked / claimed) → risk → actions → matter-scoped trail. The Log view stays global.
- **Defer requires a reason + a re-surface point** — a ruling with a fuse, not a dismissal.
- Review and blocker escalations share the panel component; flag and actions differ. Blockers name what they block ("blocks T-118, T-121"); every fork (including "let it lapse") is shown as a real choice that appends an event.

### Round 6 — Character (approved 2026-10-04; mock `yourmove-round6-character.html`)
- **Master lamp:** one lamp in the topbar, visible from every view. Lit + count when anything is your move; click jumps to the your-move view. Hollow with a "N?" count when stale (disconnected/behind) — the projection can't vouch for it.
- **Log time-travel:** revision scrubber on the Log view; the entire projection (list, rail, calm, as-of) re-folds at the visited revision. Signal-colored "viewing the past" banner + Return to present; writes disabled in the past ("You can't rule on the past"). The spine marks "◀ you are here"; later events dim.
- **Two-sided journey:** ghost-flight animation, both directions. Arrival: ghost lifts list → rail as the lamp pulses. Departure: after "recording…" and the log append, ghost flies rail → destination, tinted moss for accepted, plain for sent-back. 550ms, cubic-bezier(.22,.8,.3,1), ghost at 92% scale fading in the last ~150ms. The ghost flies — real cards never move. Never animates on intent; prefers-reduced-motion gets no flight; cancelled on navigate.

### Round 7 — Pain-grounded character (approved 2026-10-04; mock `yourmove-round7-pain.html`)
- **Ruling session:** full-bleed focus mode (rail hidden, like the calm screen) — one matter at a time, longest-waiting first, progress bar, condensed card, Accept/Send back/Defer/Skip. Skip re-queues (twice-skipped stays lit, session moves on). New arrivals join the end quietly. Ends with a tally.
- **While you were away:** first-visit digest from the log (yours → evidence → motion → quiet), each line linking to its matter; "nothing happened" is a valid digest. Replaces the calm screen once, then yields.
- **Nudge the quiet ones:** dashed "Quiet — suggested" matters for work silent >3 days; sending the nudge is a `work.nudged` log event; snooze rests it 2 days; dismissal rests the full threshold. One suggestion per task at a time.
- **Undo a ruling:** 60-second window; `ruling.withdrawn` compensating event restores the pre-ruling snapshot (status, evidence states) — history intact, never rewritten.
- **Attested acceptance:** the Accept area carries the attestation it records, generated from evidence states ("2 of 3 checked; 1 recorded, not checked"); overrides get the longest attestation. Statement, no checkbox.
- **Assignee lens:** "By status | By assignee" toggle on Today; per-worker load lines ("6 underway · 2 need you · quiet 2d"); Unassigned is its own group.
- **Ruling receipts:** confirmations state the effect (who was notified, what resumed/stood) with a 60s Undo; an optional one-line note rides into the ruling event and trail.
