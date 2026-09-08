# Dogfood register — agent-side friction observed while building CuckCode

Status: **Observational evidence. Approves nothing and amends no requirement.**

## Purpose

CuckCode is a product about human–agent collaboration, built through human–agent collaboration.
The development process is therefore a live instance of the problem the product claims to solve,
and D-26 (reciprocal usability) can be tested against it continuously and for free.

Each entry records a point where an agent contributing to CuckCode encountered avoidable
friction: context reconstruction, missing structured handoff, ambiguous authority, unactionable
error, or a repeated request for information already present and current.

D-26's acceptance gate states that a feature is incomplete if its agent-facing contract forces
avoidable guessing, repetition, context reconstruction, or unstructured recovery. These entries
are that same test applied to CuckCode's own workflow. They are not defects in the product's
code; they are evidence about the agent-facing surface the product intends to specify.

Entries are evidence, not requirements. Promotion into the MDD requires owner approval like any
other change.

## Entries

### DF-001 — Session start requires full context reconstruction from primary sources

- Observed: 2026-08-18, Claude (Cowork) session start.
- D-26 clause implicated: "Handoffs transfer structured work state, decisions, open questions,
  artifacts, evidence, and known uncertainty instead of requiring transcript reconstruction."

To determine what to work on, the agent read `README.md`, `AGENTS.md`, `docs/master-design-
document-v0.1.md`, `tasks/phase-4-plan.md`, `tasks/phase-4-todo.md`, `.ui-craft/decisions.md`,
`docs/evidence/phase-4/red-green-log.md`, and 30 commits of `git log`, then inferred current
position from the fact that the newest commit had no corresponding red-green log entry.

Current position was never stated anywhere as a single canonical fact. It was derived.

The agent's remedy was to hand-write a persistent project memory note capturing repo state,
governance rules, current task, and open items. That note is a hand-rolled, lower-fidelity
version of the context packet CuckCode already specifies in MDD §15 ("deterministic context
assembly") — assembled by the agent for itself, because no canonical handoff object exists.

Product signal: the canonical work state needs a single addressable "where things stand" object
that a joining agent reads once, rather than a set of documents from which position must be
inferred. CuckCode specifies this for its own agents; its development workflow does not have it.

Severity of signal: high. This is the most common agent-side cost in the project so far, it
recurs at every session boundary, and it is precisely the friction D-26 names.

### DF-002 — Task completion state is inferable only by cross-referencing three artifacts

- Observed: 2026-08-18.
- D-26 clause implicated: "Agents can discover their effective tools, limits, budgets, role
  contract, runtime health, and current authority without inferring them from failures."

`tasks/phase-4-todo.md` showed Task 13 checked and Task 14 unchecked. The most recent commit had
already delivered the first slice of Task 14. The red-green log's last entry was Task 13. Actual
position — "Task 14 started, one slice landed, undocumented" — existed in none of the three and
had to be assembled from all three plus file inspection.

Product signal: completion, in-progress, and authorized-but-unstarted are three distinct states
that a checkbox cannot express. This is the same distinction the product must draw in the office
between completed and approved (MDD §9), applied to its own task tracking. The product's own
insight is not applied to the workflow that builds it.

### DF-003 — Authority boundaries are stated in prose across multiple documents

- Observed: 2026-08-18.
- D-26 clause implicated: bounded work contracts with "outcome, exclusions, acceptance criteria,
  dependencies, evidence obligations, permission ceiling, stop conditions, and definition of
  done."

Determining what the agent was permitted to do required reading the AGENTS.md "Current boundary"
paragraph, the todo's approval line, the plan's separate-approval-boundary section, and the
spec's closing scope paragraph. These agree, which is good, but agreement had to be verified by
reading four prose statements rather than one machine-readable authority record.

Product signal: the permission ceiling and stop conditions CuckCode specifies as structured
fields for its agents are, in its own repository, unstructured prose repeated in four places.
Repetition across documents is how they eventually disagree.

Mitigating note: the redundancy is deliberate and the documents currently do agree. This is a
scaling observation, not a present defect.

### DF-004 — Tooling friction is environmental, not a product signal

- Observed: 2026-08-18. Recorded for completeness and explicitly excluded from D-26 evidence.

The Cowork session cannot execute this repository (win32 `node_modules`, Node 22 against a
`>=24.18.0` engine pin), cannot delete files across the device bridge, and leaves stale
`.git/index.lock` files. These are properties of the bridge between this agent and this machine.
They say nothing about CuckCode's agent-facing design and must not be cited as D-26 evidence.

Recorded so that later readers do not mistake environment limits for product findings.

### DF-005 — No canonical record type for agent-held uncertainty

- Observed: 2026-08-18, while investigating two modified Phase 0 evidence files.
- D-26 clauses implicated: agents may "ask clarifying questions, flag missing or contradictory
  context"; and "manager feedback, review findings, scope changes, declines, approvals, and
  rejections return as attributable, versioned events that agents can act upon" — the reverse
  direction has no equivalent.

The agent found two evidence files whose bytes had changed with no recorded cause, formed a
medium-confidence hypothesis about the cause, and had no canonical place to put it. Canonical
state can express what happened, what is known, what was produced, and what was decided. It
cannot express what a participant is unsure about.

Two structural confirmations in the current codebase:

- `KickoffContribution.uncertainties` and `.disagreements` are free-text `string[]` inside a
  kickoff contribution. They cannot be addressed, assigned, tracked, referenced, or
  dispositioned, and they do not exist outside a kickoff.
- `ManagerAttentionItem["reason"]` is the closed union
  `blocked | waiting_input | failed | review_requested | approval_required`. A question fits none
  of them. An agent wanting to raise a doubt must escalate it as a blocker it is not, bury it in
  a deliverable as prose, or drop it.

The finding survived this session only because a human was in the conversation to receive prose.
Running unattended, the same finding becomes a unilateral action or nothing. That is the failure
mode: uncertainty that cannot be recorded is resolved by guessing or by silence, and both are
indistinguishable afterward from having had no doubt at all.

Severity of signal: high, and unusually actionable — it names a missing domain object rather than
a process complaint.

Product response: `docs/proposals/2026-08-18-open-question-record.md` proposes a canonical
`OpenQuestion` record. Proposed, not authorized.

### DF-006 — An agent action damaged the owner's environment with no record anywhere

- Observed: 2026-08-25, when `npm run dev:web` failed at the start of a gated study.
- Cause dated: 2026-08-22 03:54 UTC, three seconds of filesystem writes.
- D-26 clauses implicated: see the classification note below. This entry is **partly** in the
  DF-004 excluded class and says so rather than claiming more than it earns.

An install run from a Linux shell against the mounted Windows working copy replaced three
platform-optional packages in place — `@rolldown/binding-win32-x64-msvc`, `@esbuild/win32-x64`,
and `lightningcss-win32-x64-msvc` — with their `linux-x64` equivalents. The owner's development
server could not start from that moment. Nothing recorded that this had happened.

Four properties made it worse than the damage itself:

- **Invisible to canonical state.** `node_modules` is gitignored, so `git status` was clean
  throughout. The repository reported a healthy tree for three days.
- **Invisible to the gate.** `npm run check:toolchain` — added on 2026-08-21 for exactly this
  class of problem — compared two version strings and printed `Toolchain OK`. It would have
  passed the corrupted tree every time it ran.
- **Misattributed by the tool that failed.** Rolldown reported "npm has a bug related to
  optional dependencies" and recommended deleting `package-lock.json`. The cause was not npm and
  the recommended repair would have modified a tracked file without fixing anything.
- **Latent across a boundary the owner cannot see.** The damage was done by an agent's shell,
  discovered by the owner, and diagnosable only by reading modification timestamps inside
  `node_modules`.

## Classification

The corruption itself is environmental — a property of the bridge between this agent and this
machine — and under DF-004 it is **not** D-26 evidence. That exclusion is correct and is not
being relitigated here.

What is not excluded is the shape. An actor took a consequential action; the action left no
attributable record; canonical state continued to report health; the failure surfaced days later
to a different actor, at the worst available moment, wearing someone else's name. CuckCode's
entire thesis is that a manager should be able to read real state and never be shown a healthy
office over stopped work. This is that failure, executed against the owner, by the development
process, and it went undetected for three days.

Severity of signal: medium. The environmental half is excluded. The half that remains is a
concrete instance of the failure mode the product exists to prevent, which is worth more than
another process complaint.

## Product response

Two changes, both executable rather than prose:

- `checkNativePlatform` and `readInstalledPackageNames` in `scripts/check-toolchain.mjs` now
  assert that every family of platform-tagged packages in `node_modules` contains a build that
  can run on the host, and name what is installed when one cannot. Seven tests in
  `scripts/check-toolchain.test.mjs`, one of which reconstructs the 2026-08-22 tree by name.
- `scripts/check-toolchain.test.mjs` was not executed by any script in the repository. It is now
  `npm run test:toolchain`, and `verify` runs it before `check:toolchain` — a check whose own
  tests never run is the same category of claim as the one this entry records.

Not addressed: nothing prevents the next cross-platform install. The check reports the damage
after the fact; it does not stop it. Recorded as open.
