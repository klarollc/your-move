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

## Promotion path

Owner-approved 2026-09-28 (housekeeping item 4). An entry is evidence; it becomes a requirement
only by an owner ruling, like any other change. Each entry has exactly one status here, and
`scripts/dogfood-index.test.mjs` fails if an entry is missing, indexed twice, or given a status
outside this list:

- **open**: observed; no ruling and no fix.
- **ruled**: the owner has ruled on a direction; the work is pending or partial.
- **fixed**: a change in the tree resolves it; the note cites the commit or mechanism.
- **graduated**: it became an MDD requirement or an approved specification.
- **closed**: ruled not a product signal, or declined.

Moving an entry is part of the change that moves it: the commit that fixes or rules on an entry
updates its row. An entry's own text is history and is not rewritten.

## Status index

| Entry | Status | Note |
| --- | --- | --- |
| DF-001 | ruled | Spec approved 2026-09-28 (`docs/proposals/2026-09-28-project-position-record.md`); the repository prototype, `position.json`, is built. The product-side record follows Phase 7-O. |
| DF-002 | ruled | `position.json` carries task states a checkbox cannot (authorized, pending owner, blocked with a resolver); building it found two stale checkboxes. Product side later. |
| DF-003 | ruled | Authority and freezes are fields in `position.json`; the cold-run freeze is a test. Product side later. |
| DF-004 | closed | Environmental tooling friction, recorded as not a product signal. |
| DF-005 | graduated | The open-question record: `docs/proposals/2026-08-18-open-question-record.md`, implemented. |
| DF-006 | fixed | Detected by `checkNativePlatform` (`check:toolchain`). Prevention declined by the owner, 2026-09-08. |
| DF-007 | fixed | `raisedAt` on `OpenQuestion`; the review question is now executable (`record-times.integration.test.ts`, `3494b6d`). |
| DF-008 | fixed | The binding report records effort as required and nullable (`96cbf74`). |
| DF-009 | fixed | For runner runs only: every result carries `head` and `dirty` (DF-022). Open for anything else. |
| DF-010 | fixed | Threads run in a controlled Codex home with the credential provisioned (`bcba1f2`). |
| DF-011 | ruled | Composing from upstream role text withdrawn in favour of the authored overlay (Task 17c-2b). |
| DF-012 | fixed | `promotion-status.mjs` joins against `roles/authored`. |
| DF-013 | fixed | Playwright `testMatch`; `verify` completes. |
| DF-014 | fixed | No shell between the runner and its tools. |
| DF-015 | fixed | `phase5-evidence-inventory.ts` reads the tree; briefs state no evidence. |
| DF-016 | fixed | Repaired and scanned. A BOM guard was proposed and is not authorized. |
| DF-017 | fixed | Repaired, scanned, and the inventory derives its list. |
| DF-018 | fixed | Ruled 2026-09-18: wall-clock time leaves the digested body. |
| DF-019 | fixed | Ruled 2026-09-18: the announcement is keyed by a sequence number. |
| DF-020 | fixed | Ruled 2026-09-19: supersession within a class, retractions by `unsupersede`. |
| DF-021 | fixed | `protocol:codex:drift` asks the installed binary; live scripts refuse without it (`5ee941a`). |
| DF-022 | fixed | The agent command runner. Housekeeping item 1 is closed by it (2026-09-28). |
| DF-023 | ruled | Option A taken 2026-09-25; option B belongs to the D-24 review. |
| DF-024 | fixed | One test's timeout raised (`5e3efe9`). A general rule is not ruled. |
| DF-025 | fixed | Attempt records, an activity-aware turn runner and one bounded retry. |
| DF-026 | fixed | Ruled 2026-09-26: evidence converted to LF and re-recorded. |
| DF-027 | fixed | Ruled 2026-09-26; built and proved 2026-09-27: `FEATURE_POLICY` per session, `TOOL_SURFACE_PRESENT` refuses a binding, probe `PROBE_OK`, first turn under the policy `SMOKE_OK`. Misfiled as open on 2026-09-28 and corrected 2026-09-29. |
| DF-028 | ruled | The zoom probe is fixed. The blank-page failure recurred a fourth time on 2026-10-03 and its kept trace names the cause: a dev-server module request failing with `net::ERR_NO_BUFFER_SPACE`. A fix is proposed, not ruled (`docs/proposals/2026-10-03-df-028-e2e-on-the-production-bundle.md`). |
| DF-029 | fixed | Version 3 conditions; attention follows the request; the inspector names the resolver; `blocked-elsewhere` log (`4f585e8`, `e6149b1`, `f065782`, `deb6389`, `073884a`, `f2d6cfa`, `fc2016d`). No runtime producer emits version 3 yet (B-5). |
| DF-030 | ruled | Question dispositions and kickoff records fixed (`3494b6d`); provider identities fixed by owner ruling 2026-09-29 (migration `006`); content manifests and packet receipts exempted, not fixed. |
| DF-031 | open | Invisible work, judged output: the human evaluates the compression, never the work. |
| DF-032 | open | Stale grants: standing instructions decay silently; authority has no validity interval. |
| DF-033 | open | Compaction seams: intra-session context loss the human cannot see (DF-001's clause). |
| DF-034 | open | Attention guessing: no agent-side contract for proposing what merits surfacing. |
| DF-035 | open | Approval cards don't carry reasoning: the gate asks for a decision, not the judgment. |
| DF-036 | open | Identity ambiguity: the agent cannot verify which principal it is addressing. |
| DF-037 | open | Capability-model staleness: no human-side counterpart to the D-26 discovery clause. |
| DF-038 | open | Background-result timing: unilateral interruption decisions, no delivery semantics. |
| DF-039 | open | Judgment contamination: anchored "independent" judgments, no clean room. |
| DF-040 | open | Repair loop is habit, not protocol: unstructured recovery, doesn't transfer. |
| DF-041 | open | The conversational medium is not an equal projection of canonical state. |
| DF-042 | open | The office has no work-item creation or assignment affordance; tasking a role goes through off-office machinery. |
| DF-043 | open | A requested sandbox posture is silently downgraded: the runtime reports a weaker one with no cause when no Windows sandbox mode is configured. |

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

### DF-007 — The record type for uncertainty could not say when it became uncertain

- Observed: 2026-09-08, while implementing Task 5 of the open-question work stream.
- D-26 clauses implicated: agents may "flag missing or contradictory context" and "ask clarifying
  questions"; and canonical records must be attributable. This entry is squarely inside D-26 and,
  unlike DF-006, is not partly excluded under DF-004 — nothing here is environmental.

`OpenQuestion` was specified, reviewed, approved, implemented, persisted, projected to both
participants, and accepted by the owner across four tasks — carrying no timestamp. Not
`raisedAt`, not `recordedAt`, nothing. `neededBy` and `reviewBy` exist but are future deadlines,
not occurrence times.

The gap was invisible for three weeks because nothing consumed the record in a context that
needed one. It surfaced the moment the attention projector, an unrelated Phase 1 component,
demanded `updatedAt` and there was no truthful value to supply. The workaround available at that
moment — using read time — would have made the projection return different values on every call
and quietly destabilised the committed visual captures.

## Why this is worth more than a missing-field bug

The record exists to fix DF-005: an agent has no canonical way to say *what it is unsure about*.
The record built to carry that could not say **when** it became unsure. The same class of defect,
one level down, inside its own remedy.

Three separate reviews did not catch it — the specification, the owner's approval of Tasks 1–4,
and the implementation of four tasks against it. It was not caught by reading. It was caught by
an attempt to consume the record for something its author had not imagined, which is the only
kind of pressure that finds an omission rather than an error.

Two properties of the failure are worth naming:

- **A missing field is invisible to every check that looks at what is present.** Validation,
  tests, and review all confirm that the declared fields behave. Nothing asks what was never
  declared. Contrast DF-006, which at least produced a loud, if misattributed, error.
- **The consumer was the discovery mechanism.** The gap became visible only across a boundary,
  when a component written by different reasoning tried to use the record. Within the
  open-question work stream everything was self-consistent.

Severity of signal: high, and unusually cheap to act on — the corrective is a review question,
not a system.

## Product response

`raisedAt` is now a required, `parseUtcTimestamp`-validated field on `OpenQuestion`, applied
2026-09-08 with owner approval. RED–GREEN in `docs/evidence/open-question/red-green-log.md`.

**Proposed and not authorized:** a standing review question for any new canonical record — *can
this record say when it happened, who caused it, and what event caused it?* Every canonical
record in this repository already answers all three; `OpenQuestion` was specified without anyone
noticing it answered only two. Per this repository's stated preference, the stronger version is a
test that asserts every canonical record type carries a validated timestamp, rather than a fourth
prose rule that a future reviewer will also read past.

Not addressed: the same question should be asked of `QuestionDisposition`, which also carries no
timestamp. Recorded as open rather than fixed in passing, because it was not in scope and no
consumer has yet demanded it — which is exactly the condition under which this defect survived.

### DF-008 — A binding report cannot say how the model was configured

- Observed: 2026-09-08, while recording the owner's model decisions into the Task 16 packet.
- D-26 clauses implicated: canonical records must be attributable. Same family as DF-007.

`runtimeBindingReportSchema` carries `adapterId`, `adapterVersion`, `protocolVersion`, `authMode`,
`model`, `capabilityIds`, `toolIds`, `permissionCeiling`, and `materialFingerprint`. It has no
field for reasoning effort or any other model configuration parameter.

The owner selected `medium` deliberately, and an earlier proposal used `xhigh` for one role. Two
runs of the same model at different efforts would produce identical binding reports. **The record
can name what ran but not how it was configured**, so a run is not reproducible in a dimension the
manager explicitly chose.

The immediate impact is nil — effort is held constant across all six roles for this kickoff, so
nothing is confounded. It is recorded because the gap is real and the next configuration decision
may not be uniform.

## The pattern this makes explicit

This is the third instance in one day of the same shape:

- **DF-007** — `OpenQuestion` could not say when it was raised.
- Still open — `QuestionDisposition` cannot say when it was recorded.
- **DF-008** — `RuntimeBindingReport` cannot say how the model was configured.

Each record type is internally consistent and passes its own validation. Each omission became
visible only when a *different* component tried to consume the record for something its author had
not imagined. Reading the specifications did not find any of them; attempting to use them did.

The three are not the same missing field, so a rule about timestamps would have caught only two.
The general shape is: **a canonical record omits a property that is not needed to construct it and
is required to interpret it later.** Construction-time review cannot see that class, because at
construction time the property is genuinely unnecessary.

Proposed and not authorized: rather than a fourth prose rule, a review question applied when any
canonical record type is specified — *what would a future reader need in order to reproduce or
attribute this, that the author does not need in order to write it?* Converting it to a test is
harder here than for DF-007's timestamps, because the missing property differs per record type.
Recorded as an open problem rather than a solved one.

### DF-009 — A verification run's inputs are not attributable to a known state of the tree

- Observed: 2026-09-08, during Task 17a.
- D-26 clauses implicated: canonical records must be attributable. Distinct family from DF-005
  through DF-008 — this one is about evidence, not about a record type.

The agent finished writing `packages/runtime-codex/src/binding.ts` and asked the owner to run the
GREEN. The owner's run started at 15:00:43 local; the file finished writing at 15:01:40. The run
executed the deliberate stub, and the output — eight failures, all `FACTS_INCOMPLETE` — was
returned as a post-implementation result.

It looked exactly like a real, catastrophic failure of the implementation. It was distinguishable
from one only by comparing file modification times against the timestamp vitest prints in its own
header, which the agent did on a hunch rather than by procedure.

**The general shape: the agent cannot attest which state of the tree a verification ran against.**
The agent writes files through one channel and the owner runs tests through another. Nothing in
between carries an identity. A test result arrives as text with no statement of what produced it,
so a stale run, a partially-written file, an un-saved editor buffer and a genuine failure all
present identically. The evidence the whole governance model rests on — RED before GREEN, verify
green at each step — is unattributable at the point it is produced.

The near miss is the interesting part. Had the stale run been read at face value, the correct
response would have been to *change working code* to satisfy a failure that did not exist. The
failure mode is not "wasted a run"; it is "corrupted a working implementation in response to
fabricated evidence, with an owner-approved RED/GREEN log entry recording it as legitimate."

## Why this is not the same as DF-006

DF-006 was an agent action that damaged the environment and left no record. This is an agent
*observation* that cannot be tied to a cause. DF-006 argues for a preflight check; this argues that
evidence needs provenance. A toolchain check cannot detect it, because nothing about the toolchain
is wrong.

## Product response

Not authorized and not designed. The obvious mechanism is that a verification result should carry
the tree state it ran against — a commit or a working-tree digest emitted by the run itself and
compared against what the agent believes it wrote. That is the same join-checking shape used for
promotion digests and binding fingerprints: two records that each look valid alone, correct only
in their relationship.

Recorded here as an open problem. The immediate mitigation applied in Task 17a was manual and does
not generalise: check mtimes before trusting a surprising result.


### DF-008 addendum — the impact is no longer nil (2026-09-11)

DF-008 was recorded with the note that effort was held constant across all six roles, so nothing
was confounded and the gap was theoretical.

The Task 17c-1 live probe shows that was wrong on the facts. `thread/start` reports
`reasoningEffort` directly, and a default thread runs at `high` while the owner approved `medium`.
So the runtime *does* tell us how the model was configured, the configuration it defaults to is not
the one that was approved, and `RuntimeBindingReport` still has nowhere to put it.

A binding report produced today would name the model, be checked for model drift, and be silent
about a parameter the runtime volunteered and the owner explicitly chose. The record would be
internally valid and would not say the thing that distinguishes an approved run from an unapproved
one.

The original entry's reasoning was sound and its conclusion about impact was an assumption. It took
one live turn to falsify it. Recorded here rather than by editing DF-008, because the register is a
record of what was believed when.

### DF-010 — Six pinned role contracts share one unpinned instruction source

- Observed: 2026-09-11, by the Task 17c-1 probe, while looking for something else.
- D-26 clauses implicated: a role is exactly its promoted contract. Same family as DF-006 in that
  the system had no way to see it.

`thread/start` reports `instructionSources`, and for every thread the value is
`["C:\\Users\\nater\\.codex\\AGENTS.md"]` — a file in the owner's Codex home.

**Its contents have not been examined.** It lives outside the folder connected to this session, in
a directory that also holds provider credentials, and access was not requested. Nothing here is a
claim about what the file says.

The problem is structural. Role promotion pins exactly what instructions a role runs under: a
source digest and an overlay digest, promoted all-or-nothing, re-derived on every read so drift
revokes automatically, and folded into the binding's material fingerprint so a binding cannot
survive a contract change it was never approved against. That machinery is the most carefully built
thing in the project.

It governs one of the two instruction inputs. The other one is a file the system does not know
exists, that applies identically to all six roles, that no digest covers, and that can change
between two runs whose binding reports would be byte-identical.

Six roles intended as six distinct contracts would share one uncontrolled input. Whether that
currently matters depends on the file's contents; whether the system can *tell* does not.

## Why the promotion machinery could not catch this

Promotion checks the digests of the files it was given. It has no way to ask "what else is
instructing this agent," because nothing in the design admitted that a second source could exist.
The guard is exact about its own scope and blind one inch outside it.

That is a third distinct shape, alongside the two the register already names:

- DF-005 through DF-008: a canonical record cannot say something.
- DF-009: evidence cannot be attributed to what produced it.
- DF-010: a guard is rigorous within a boundary that was drawn by assumption.

The first two were found by trying to use a record. This one was found by asking a live runtime what
it thought it was doing, which is a question the project had never put to it.

## Product response

Not authorized and not designed. Three directions, in rough order of how much they cost:

- Point threads at a controlled Codex home so no unpinned instructions load at all.
- Digest whatever instruction sources the runtime reports and fold them into the material
  fingerprint, so an unpinned input at least cannot change silently.
- Accept it and document it as a known uncontrolled input, which is honest but leaves the pinning
  guarantee weaker than the documents claim.

The owner has not ruled. The file has not been read.


### DF-011 — Every import guard passed on six roles that cannot run here

- Observed: 2026-09-13, on first reading the upstream role files, five weeks after importing them.
- D-26 clauses implicated: a role is exactly its promoted contract. Same shape as DF-010.

The six upstream role files were imported at commit `ebe9c99`, digested, path-allowlisted, checked
for hidden instructions and executable overlays, field-validated, and made promotable. Three import
tests pass, including one named *"rejects hidden instructions and executable overlays"*. Promotion
would have succeeded. Nothing in the system objected.

Reading the files shows that two of the six instruct the agent to run shell commands as its first
action — `STEP 1: Reality Check Commands (ALWAYS RUN FIRST)`, with a bash block invoking a capture
script, `ls`, `grep -r` and `cat`. The kickoff is text-only and any observed `runtime.command` stops
the entire run. Two of six assume Laravel, Livewire, FluxUI and Alpine.js, reference a component
index file that does not exist in this repository, and link to documentation unreachable from a
sandbox with no network. All six claim persistent identity and memory that ephemeral threads do not
provide.

> **Correction, 2026-09-12.** This entry first recorded "Four of six" for the stack assumption. An
> independent audit counted occurrences of `laravel|livewire|fluxui|alpine` in each upstream file at
> commit `ebe9c99`: `engineering-senior-developer.md` 22, `project-manager-senior.md` 8,
> `testing-reality-checker.md` 1, and zero in `design-ui-designer.md`,
> `testing-test-automation-engineer.md` and `testing-evidence-collector.md`. The single hit in
> `testing-reality-checker.md` reads "Verify what was actually built (Laravel or Simple stack)",
> which is a conditional rather than an assumption. The verified figure is **two** files that
> substantively assume the stack, one incidental mention, three with none. The finding stands; the
> count did not. Recorded here rather than silently amended, because an evidence register that
> quietly corrects itself is the thing DF-009 is about.

## What the guards actually checked

Every check was about **fidelity**: that the bytes match the upstream, that the path is allowlisted,
that the overlay is not executable, that no instruction was injected during import. All of those
passed, correctly. The imported text is a faithful copy of what it claims to copy.

No check asked whether the content is **compatible with the constraints the role will run under**.
That question was not asked because nothing in the design admitted it could have an answer: the
import's job was defined as faithful acquisition, and it did that job exactly.

So a role can be digest-pinned, drift-checked, joinable against a qualification, and refused unless
its promoted contract version matches — while instructing the agent to do the one thing that aborts
the run it is promoted for.

## Why this is the DF-010 shape and not a new one

DF-010: a guard is rigorous within a boundary that was drawn by assumption. There the boundary was
"instructions are the files we digest," and a second instruction source sat outside it. Here the
boundary is "correctness is fidelity," and suitability sits outside it.

Both were found by asking a question the guards were never designed to answer. Neither was
detectable by running the guards more carefully.

The register now holds three shapes:

- DF-005 through DF-008: a canonical record cannot say something.
- DF-009: evidence cannot be attributed to what produced it.
- DF-010, DF-011: a guard is exact inside a boundary nobody examined.

The third is the one that keeps recurring, and it is the one no test finds, because a test is
written inside the same boundary as the guard it protects.

## Product response

Not authorized. The immediate consequence is recorded in
`docs/proposals/2026-09-13-task-17c-2b-role-composition.md`: composing role instructions from the
upstream text is withdrawn as a recommendation, in favour of composing from the CuckCode-authored
overlay alone.

The unanswered question is what `status: candidate` should mean for these roles now. It currently
records that they were faithfully imported and are not yet promoted. It does not record that four of
six describe a stack this project does not use, which is a different kind of not-ready and is not
fixed by promoting them.

---

### DF-012 — A gate reported closed while it was open

Observed 2026-09-13, immediately after the owner promoted all six authored roles.

`roles/promotions.json` held six live promotions, none revoked. `npm run roles:promotion:status`
reported `{"ok":true,"promoted":[],"of":6}`.

Both were produced by the same codebase, minutes apart, and they contradicted each other.

## What actually happened

`promotedRoleIds(record, manifest)` derives the promoted set by joining the promotion record against
a manifest, and refuses any role whose digest no longer matches. That design is right, and its own
comment says so: *"The promoted set is derived, never asserted... Fails closed."*

The status CLI passed it `roles/manifest.json` — the **imported** role set, which Decision Q1 marked
`superseded` on 2026-09-12. The authored artifacts live in `roles/authored/<id>.json` under Decision
Q2. Their digests are not the imported digests, so every join missed and the derived set came back
empty.

The guard did exactly what it was written to do. The authoritative boundary moved underneath it and
the call site was never revisited.

## Why this is the DF-010 shape, inverted

DF-010 and DF-011 are guards that **passed** on material that could not work. This is a guard that
**refused** material that works. The failure direction is opposite; the cause is identical — a check
that is exact inside a boundary nobody re-examined after the boundary moved.

That makes the shape more general than the register has recorded so far. It is not "guards are too
permissive." It is **a guard is only as current as its call site**, and nothing in this project makes
a call site announce that its source of truth was superseded three weeks ago.

## Why no test caught it

`scripts/promote-roles.test.mjs` had twelve passing tests over this exact function, including drift
and revocation. Every one of them constructs its own manifest fixture. None reads the manifest the
CLI actually passes, so the suite proved the join was correct and could not observe that it was
pointed at the wrong set. The test is written inside the same boundary as the guard — the sentence
already in this register's classification section, now demonstrated a third time.

## Impact

Bounded, and only by luck of direction. `promotedRoleIds` had exactly one production consumer, the
status CLI, so nothing executed under a wrong promotion. Had the live kickoff been wired through it,
the kickoff would have **refused to run** and reported the roles as unpromoted — sending the next
session to debug promotion, which was never broken.

The nearer harm is that the status command is what a fresh session reads to learn whether a gate is
open. For a few hours it stated, with a machine-checked air, the opposite of the truth.

## Product response

Fixed the same day under RED-GREEN, not deferred, because a status command that misreports a gate
corrupts every later decision made from it. `scripts/promotion-status.mjs` joins against
`roles/authored`, reports the `source` it derived from, and is the single status path; the stale CLI
block in `promote-roles.mjs` was removed rather than left as a second command that could disagree.
The drift guard was mutation-tested and killed four tests.

**Proposed and not authorized:** a standing review question for any decision that supersedes an
artifact — *what still reads the thing we just superseded?* Q1 marked the imported roles superseded
and nothing swept the call sites. The same sweep, run against documents rather than code, is what
the 2026-09-13 evaluation had to do by hand for five stale boundary lines.

---

### DF-013 — The top-level gate had never run to completion

Observed 2026-09-14, while re-running the Test Engineer's verification pass.

`npm run verify` is this repository's whole-project gate: eighteen stages, ending in the Playwright
e2e, accessibility and visual suites. It fails at stage sixteen, and has failed there since
`35596d8`, which is a Phase 1 commit.

```
> playwright test --grep @e2e --project chromium-1440 --project chromium-1280
TypeError: Cannot read properties of undefined (reading 'config')
   at roles\authored-roles.integration.test.ts:38
```

## What actually happened

`playwright.config.ts` sets `testDir: "./tests"` and never sets `testMatch`. Playwright's default
pattern matches `*.test.ts` as well as `*.spec.ts`, so it collected
`tests/roles/authored-roles.integration.test.ts` — a **Vitest** file — and died trying to load
`describe` from the wrong runner. Collection is fatal, so no e2e, accessibility or visual test ran.

That file arrived in `35596d8`, the commit that authored the six role briefs. Every Playwright suite
in this repository has been uncollectable since.

## Why nobody noticed

Because the stages were always run individually. `test:unit`, `test:component`, `test:e2e`,
`lint`, `typecheck` and the Phase 4 capture suites were each invoked directly, each passed, and the
composition of them was never invoked. Four hundred and eighty-nine passing tests were reported to
the owner across several sessions on that basis, and the number was true — it was simply never the
number `verify` produces, because `verify` produced no number at all.

The e2e suites were not silently broken: run on their own they pass, 46 + 18 + 22 after the fix. The
broken thing was the only command that claims to check everything.

## Why this is the same shape again

The register's standing sentence is *a guard is exact inside a boundary nobody examined*. Here the
guard is exact and the boundary is **the gate itself**. Nothing in this project ran the thing that
runs the things. A composite command is a claim — "all of this passes" — and an unexecuted claim
looks identical to a satisfied one in every artifact that cites it.

It is also the DF-012 direction: a gate that reported nothing at all while the project reported
itself green. DF-012 took hours to surface because a status command misreported a gate. This took
months because nothing asked the gate anything.

## Product response

`testMatch: "**/*.spec.ts"` added to `playwright.config.ts`, which separates the two runners by the
naming convention the repository already follows. `npm run verify` now completes: 509 Vitest tests
passing with 3 skipped, then 46 e2e, 18 accessibility and 22 visual.

**Proposed and not authorized:** `verify` should be the only command a session is allowed to cite
when reporting suite health, and any report of a test count should name the command that produced
it. A count with no command attached is what let this run for four phases.

---

### DF-014 — Arguments split by a shell nobody meant to invoke

Observed 2026-09-14, while acting on the Task 7 findings.

`scripts/capture-phase5-browser.ts` launched Playwright through `execFile` with `shell: true`, which
is needed to resolve `npx` on Windows. Every argument was then concatenated into a command line and
re-split by the shell, so this:

```
["playwright", "test", "--grep", "@visual Phase 5", "--project", "chromium-1440"]
```

arrived as `--grep @visual`, followed by `Phase` and `5` as **positional file filters**.

## Why it looked fine

Because the stray filters matched. Every spec involved lives in a file named `phase-5-...`, so
filtering by `Phase` and `5` selected roughly the intended set, and the grep pattern `@visual` was a
prefix of the intended one. Forty cells were produced, the manifest counted forty, and every check
downstream agreed.

## How it surfaced

As **one unreproducible failure**. The isolation suite failed on a single capture run and passed when
run directly, which reads as a flake and was nearly filed as one — the working theory was a race on
the port-4173 preview server being torn down and restarted three times in sequence.

The fix for that theory — collapse three invocations into one, matching `@(visual|a11y|e2e) Phase 5`
— is what exposed the real fault. Parentheses and pipes are not filename-shaped, so the mangled
command stopped accidentally working and failed every time. Removing `shell: true` then failed
outright, because Windows refuses to spawn a `.cmd` without one. The working form launches
`node_modules/@playwright/test/cli.js` under `process.execPath`, with no shell on any platform.

## The shape

This is the register's standing sentence pointed at a process boundary: **a guard is exact inside a
boundary nobody examined**, and here the boundary is the argument vector. Every check downstream of
the capture was exact — cell counts, digests, duplicate detection, name matching — and all of them
were exact about the output of a command nobody had confirmed was the command being run.

It is also a new variant worth naming on its own: **an unreproducible failure is not evidence of
nothing.** "I could not reproduce it" means "I do not know what happened." Filing it as a flake would
have left a capture harness running a command different from the one written in it, with every
artifact it produced still counted as evidence.

## Product response

Fixed in the same pass. The runner resolves the CLI entry point and launches it under the current
Node, so arguments arrive as written on every platform, and the failure path now reports the spawn
error rather than only stdout and stderr — the empty output was what made the first diagnosis wrong.

**Proposed and not authorized:** no evidence-producing script should invoke a tool through a shell.
`execFile` with an explicit interpreter and an argument array is the only form that survives review,
and the three other scripts in `scripts/` that pass `shell: true` should be swept.

---

### DF-015 — Four briefs, four false pictures, three wasted agent turns

Observed across 2026-09-13 and 2026-09-14, in every role run of Phase 5.

A brief is what a promoted role is given instead of the repository. It is the role's entire world.
Four of them described a world that did not exist, and in each case the role answered the question it
was actually asked, accurately, and the project came close to filing the answer as a statement about
something else.

| Brief | What it said | What was true |
| --- | --- | --- |
| Verification | "There are no other tests for this component: no component tests…" | Task 5 had shipped six component tests |
| Visual QA | Omitted the accessibility and isolation runs entirely | Both had run and passed |
| Verification | "no browser or end-to-end runs, no visual captures, no axe or accessibility runs" | Task 7 had produced all of them |
| Release review | Cited verification pass 2 as current | Pass 2 predated the gap-closure commit by fourteen minutes |

## What it cost

Three agent turns, and very nearly the Phase 5 release verdict. The first release verdict reported
four of twenty-one criteria satisfied; with a brief that stopped withholding evidence, the same role
on the same implementation reported **eleven**. Verification pass 3 marked C-09 and C-20 `none` while
the captures, scans and isolation records sat in the evidence tree; pass 4, given them, returned ten
full where pass 3 had returned three.

**The phase was materially further along than its own records said**, and every one of those records
was produced by a careful reviewer doing exactly what was asked.

## The shape

Every false claim was **hardcoded prose that was true the day it was written**. Not one was a lie, a
guess, or an inference. They were accurate snapshots that nobody re-examined when the thing they
described moved — the register's standing sentence, applied to a sentence rather than to a guard.

The variant worth naming separately: **a brief is an evidence artifact.** It was treated as framing —
context, preamble, the wrapper around the real question — and so it was written once and edited
casually. But the answer's accuracy is bounded by the brief's, and the answer is what gets filed. A
brief deserves the same suspicion as any other input to the evidence model, and it never received it.

## Product response

No brief states what evidence exists any more. `scripts/phase5-evidence-inventory.ts` reads
`docs/evidence/phase-5` and reports what is there, including the isolation record's actual fields
rather than a summary of them — the summary omitted the credential and storage-write scans, and the
reviewer reading it correctly reported both missing.

The verification runner records `assessedVersions`, the content digest of every file its assessment
covers. The release brief finds the latest verification pass rather than naming one, compares those
digests against the files on disk, and tells the reviewer plainly when the pass no longer describes
the build.

**Proposed and not authorized:** every brief should be generated, never written. Any sentence in a
brief asserting the presence or absence of evidence should be derived from the evidence tree at build
time, and a brief containing a hardcoded claim about what exists should fail review the way a
hardcoded test fixture of a superseded manifest does.

### DF-016 — A three-byte prefix broke the gate, and the gate is what would have said so

Observed 2026-09-14, introduced by commit `2af4c12`, caught by the first full run after it.

`npm run phase5:contact-sheet` was added to `package.json` with a PowerShell one-liner:
`Set-Content package.json -Encoding utf8`. Windows PowerShell 5.1 writes a **byte-order mark** under
`-Encoding utf8`. `JSON.parse` refuses a BOM, so `scripts/check-toolchain.mjs` — the second step of
`npm run verify` — died with `Unexpected token '﻿'`, and every step after it never ran.

## What it cost

Nothing, this time, and only because the next thing attempted was a full `verify`. The contact-sheet
commit itself was correct; `npm`, `git`, `tsx`, `eslint`, `prettier` and every editor tolerate the
BOM, so nothing else complained. Had the next session run a narrower check first, the tree would have
looked healthy while the gate was dead.

## The shape

This is **DF-013 again, by a different mechanism**. That entry recorded that `npm run verify` had not
completed since `35596d8` because Playwright's default `testMatch` had quietly swallowed a unit test.
Both are the same failure: *the gate stopped working, and the only thing that reports a broken gate is
the gate*. A check that nothing else depends on has no independent witness.

The variant worth naming: the damage came from **the tool used to make the edit**, not from the edit.
The intended change — one line in `scripts` — was correct and is still there. PowerShell's `utf8`
meaning "utf8 with BOM" is a platform default that no reviewer would read in a diff, because the diff
does not show it.

## Product response

`package.json` is repaired and the tree is scanned: two files carry a BOM, and the other,
`packages/persistence/src/recovery.integration.test.ts`, is pre-existing since `1fc8493` and harmless
because TypeScript tolerates one.

**Proposed and not authorized:** a BOM scan over tracked text files, run inside `verify` but placed
*before* the first consumer that would choke on one, so the failure names the cause rather than
surfacing as a parse error in an unrelated script. And a standing rule: never write a repository file
with `Set-Content`/`Out-File` on Windows PowerShell 5.1 — use the editing tools, or `-Encoding
utf8NoBOM` where the shell supports it, which 5.1 does not.

### DF-017 — Three invisible bytes inside a regex, and every gate passed

Observed 2026-09-14, while preparing the brief for the refreshed release review.

`scripts/phase5-test-inventory.ts` was rewritten to find its own test files rather than keep a
hardcoded list of two. The new matcher was written through a shell heredoc, and the heredoc did not
pass backslashes through literally: every intended `\b` word boundary reached Python as an escape
and was written to disk as **byte 0x08, an actual backspace control character**.

The regex became `/<BS>it\(\s*"[^"]*<BS>C-\d{2}<BS>/` — a pattern that matches a literal backspace
followed by `it(`, which no source file contains. It matched nothing, silently.

## What it cost

Six tool calls of disbelief. The regex printed correctly in every diagnostic, because `.source`
renders a backspace as nothing at all in a terminal; a fresh inline literal with the identical
visible text matched, and the module constant did not. The difference was invisible until the line
was hexdumped.

## The shape

**Every gate passed.** Prettier formatted it, ESLint accepted it, `tsc` typechecked it, and the unit
suite stayed green — a control character inside a regex literal is syntactically valid JavaScript.
Nothing in the toolchain has an opinion about it, and a reviewer reading the diff would see exactly
the pattern that was intended.

It is DF-016's lesson again, one layer deeper: **the damage came from the tool used to make the
edit, not from the edit**. There the tool was PowerShell adding a byte-order mark; here it was a
heredoc removing backslashes. Both produced a file that looked right in every rendering anyone would
actually look at.

The downstream effect was in the direction this project keeps finding: the inventory would have
reported that **no test names any criterion**, and the verification brief would have told the Test
Engineer that the entire suite had vanished. A brief stating that nothing exists is the exact failure
class of DF-015.

## Product response

The file is repaired and the whole tracked tree is scanned: no other source file carries a control
character. Two real defects were found underneath it and fixed in the same pass — the test inventory
was a hardcoded list of two files that had already drifted (missing
`decision-notice-capture.unit.test.ts` and the provenance tests), and the provenance tests did not
name C-18 in their titles, which is the convention by which a test declares what it is for.

**Proposed and not authorized:** a control-character scan over tracked text files, beside the
byte-order-mark scan DF-016 proposed, both run early in `verify` so the failure names its cause. And
a standing rule already worth following: do not write source files through shell heredocs. Use the
editing tools, which do not transform the bytes.
### DF-018 — The gate could not pass twice, and the failure pointed at the wrong stage

Observed 2026-09-18, while trying to get a complete `npm run verify` before committing.

`npm run verify` is the eighteen-stage gate that claims the whole project passes. Stage 16 checks
the provenance ledger against the evidence tree. Stage 17 rebuilds
`docs/evidence/phase-5/side-effect-review.json`, whose builder writes a wall-clock `ranAt` into the
digested body. So a completed gate moved that artifact's digest, and the next gate failed at stage
16 reporting a stale digest — one stage earlier than, and one whole run after, the stage that caused
it.

The state had existed since 2026-09-14. Its visible residue was a permanently modified file in the
worktree.

## What it cost

Three `verify` attempts across one session. The first died at stage 20 on a leftover preview server
holding port 4173 — a separate, known problem — so the provenance failure did not surface until the
second attempt, by which point the first attempt had itself caused it. Two sessions before this one
had read the modified artifact as evidence churn and left it alone.

The reasoning it invited was wrong in a specific way. The obvious repair is to restore the committed
file, and that does not work: the ledger recorded `684399fb`, the committed file hashed `f60e713c`,
and the worktree file hashed `393016ad`. Three digests, none matching, because the artifact had been
rewritten and committed at some point without the ledger following. Anyone reaching for
`git checkout` would have had the same failure back with an extra minute spent.

## The shape

It is DF-013 again — a gate claiming the whole project passes while structurally unable to do so —
with a twist that made it harder to see. DF-013's gate never completed, which at least produced a
failure every time. This one **passes on a clean checkout and fails on the second run**, so whether
it works depends on whether anyone ran it before, and its failure accuses the stage before the
offender. Nobody noticed because a session that runs `verify`, commits, and moves on never sees the
second run.

It is also the recurring defect in its usual form: a guard exact inside a boundary nobody examined.
The provenance check is correct — it caught a real digest drift and refused. What nobody checked is
whether the gate's own stages are allowed to mutate the tree the gate then verifies.

And one variant worth naming separately: **a wall-clock field is a mutation nobody thinks of as
one.** `ranAt` is write-only. Nothing in the tree reads it, in this artifact or in the five others
that carry it. It exists to describe the run and it is the only reason the artifact's identity was
unstable.

## Product response

Ruled by the owner on 2026-09-18: the wall-clock field leaves the digested body, and the ledger
entry's `recordedAt` carries when the artifact was produced.
`docs/evidence/phase-5/decision-record-2026-09-18-side-effect-review-determinism.md` records the
ruling, the RED/GREEN evidence, and the byte-level proof that the change was a no-op.

The projection was extracted out of the top-level side-effecting build script into a pure
`composeSideEffectReview`, because the defect had been reachable only by running the writer. That is
the same untestability HANDOFF records for `run-phase4-kickoff.ts`, and it is the reason this went
four days without a test that could have stated the property. The assertion that now guards it is
idempotence across a clock tick, not the absence of a named key.

**Open and unruled, recorded rather than fixed:** a `verify` stage still writes into the committed
evidence tree on every run. `scripts/evidence-immutability.test.mjs` polices that rule only for
browser specs, so an evidence builder in `scripts/` was never in scope for it. The honest question
is whether a builder inside the gate should write at all, or check and refuse the way
`phase5:provenance` does in check mode.
### DF-019 — A channel with no memory of what it published, and a suite that only reads final state

Observed 2026-09-18, while writing a characterization test for the Decision Notice announcement
channel after the screen-reader walkthrough.

The surface has exactly one spoken channel: a single `aria-live="polite"` paragraph whose text is
replaced. `reportFailure` writes the refusal wording into it. Writing an identical string to the
same text node is not a DOM mutation, so **the same refusal twice announces once.** Submit a
deferral with an empty reason, get the correction, submit it empty again, and the channel is silent.

The visible channel has the same defect in a different sense: the `role="alert"` paragraph already
holds that exact text, so the second submit produces no visible change either. A person clicking
Submit a second time gets no response in any modality.

## What it cost

Nothing yet, and that is the point. It was found by reading the source and writing one assertion,
not by anything failing.

## The shape

**Every UI assertion in this repository reads final state.** 71 component tests, 46 accessibility
tests and 62 visual plates all ask what the DOM *is* after a transition. None asks what it
*published on the way* — and a channel whose whole job is to emit a sequence of transient
announcements cannot be falsified by a test that only looks at the end.

That is why this survived an owner-performed NVDA walkthrough: the walkthrough exercised each
refusal once, which is the only case that works. And it is the concrete instance behind the
prioritise-the-UI finding, which until now was an argument from a test-to-source ratio. The ratio
said the UI was under-tested. This says what kind of test is missing.

It is also the recurring defect once more. The channel is correct at every moment anyone inspected
it. Nobody examined the boundary — the transition between two moments — and there was no artifact
recording what crossed it.

## Product response

Fixed under owner ruling 2026-09-18: the announcement state carries a sequence number that keys the
rendered child, so React replaces the node and the mutation is real. C-08 forbids timers in this
component, which rules out the usual clear-then-reset remedy; the keyed child needs none.
`docs/evidence/phase-5/decision-record-2026-09-18-announcement-republish.md`.

**The fix is necessary and not shown to be sufficient.** Whether a node replacement inside a polite
region actually makes a screen reader speak is real-browser behaviour, and the test asserts only
that a DOM mutation occurred. No suite here can close that gap: jsdom has no assistive technology
and neither does Playwright. It is queued for the next human walkthrough alongside the unresolved
C17-SR-01 re-walk.

**Recorded and unruled:** the visible `role="alert"` channel still produces no change on a repeated
identical refusal. The same remedy applies and was not authorized here.

**Standing gap, stated rather than fixed:** there is no test in this repository of the form *what
did this surface publish, in order, during this transition*. One characterization test now exists
for this channel. Nothing generalizes it, and the owner has separately indicated that
screen-reader behaviour may be out of scope for a single-user tool — which, if ruled, should amend
C-17 and MDD section 19 rather than leave them asserted and unenforced.

### DF-020 — The instrument that says which artifact is current said the wrong one, for a day

Observed 2026-09-19, reading the provenance ledger at the start of a session, before doing anything
with it.

`docs/evidence/provenance.jsonl` recorded `phase-5/release-review/pass-5.json` as superseded by
`pass-8.json`, and `pass-1.json` through `pass-4.json` as superseded by `pass-8.json` rather than by
`pass-5.json`. Passes 6, 7 and 8 are records that an attempt was made and produced nothing: each
carries `"verdict": null` after a single turn, and pass 8 names the runtime failure
`stream disconnected before completion`. They are honest artifacts. What was wrong is that
`derivePassSupersessions` ordered every `pass-<N>.json` in a directory and retired all but the
highest, so each failed attempt silently retired the verdict below it.

The consequence reaches further than the ledger. P-3 forbids a current artifact citing a superseded
one, so for one day the rule said that the current release review was a connection error and that
every citation of the actual verdict was a stale citation. `docs/HANDOFF.md` cited pass 5 as current
throughout. Both could not be right, and nothing in the repository could tell which.

## What it cost

Nothing yet, and only because nobody built a brief in that window. DF-015 is what it would have
cost: four briefs describing a world that did not exist, three wasted agent turns, and two release
verdicts thirty percentage points apart on an unchanged implementation. The ledger exists to make
that impossible, and it was the thing that was wrong.

## The shape

It is the recurring defect in its purest form so far. Every test of the derivation passed, because
every test asked whether the rule was applied correctly. None asked whether the rule fit the
material it was being applied to. A convention — the highest pass wins — was written when every pass
in the tree had produced something, and it stayed correct until the first pass that did not.

It is also a gate reporting closed while open, DF-012's variant, and it arrived the same way: a
guard exact inside a boundary nobody examined. The boundary here is the difference between a pass
and an attempt, which no artifact in the tree had ever needed to name.

Worth stating plainly: this was found by reading, not by anything failing. Nine gates ran green over
it. The repository has no check of the form *is the rule we are applying the right rule for this
material*, and it is not obvious that one can exist.

## Product response

Ruled 2026-09-19:
`docs/evidence/phase-5/decision-record-2026-09-19-supersession-retraction.md`.

Supersession now applies within a class — a pass retires an earlier pass only when both carry the
product their review exists to produce, or neither does — and what counts as that product is a
declared map from schema id to field, with an unknown schema refused rather than defaulted. The
fifteen wrong edges are withdrawn by a new `unsupersede` op under P-6, appended rather than edited,
each naming the ruling that authorised it.

**The structural half is what matters.** Retracting fifteen edges fixes today. The class rule is
what stops the next failed attempt from recreating the defect, and it is the reason this was not
closed with fifteen hand-written lines alone.

**Recorded and unruled:** a retraction op in an append-only ledger is an edit mechanism if nobody
bounds it. P-6 bounds it in prose and one test asserts the bound — that a retraction changes no
record entry. The builder refuses, rather than skips, a derived edge that is currently retracted, so
a future build cannot quietly undo a ruling. Neither guard covers the case of a retraction that is
authorised by a decision record that does not exist; `authorizedBy` is required to be a non-empty
string and is not resolved against the tree.

### DF-021 — The pinned runtime was replaced underneath the project, and only a run would have said so

Observed 2026-09-25, while diagnosing why release-review passes 6 to 9 produced no verdict.

The release review, the kickoff and the role exercises all spawn the Codex binary bundled with the
desktop app, at a fixed path, and refuse a handshake that does not report the pinned `0.146.0`.
Probes run by the owner outside the turn ledger showed that binary now reports `0.156.1`: the
desktop app updated it. Pass 9 on 2026-09-22 got past the version check, so the update landed after
it. Both `gpt-5.6-sol` and `gpt-5.6-luna` answered in about six seconds on the new client, so
neither the network nor the models explain passes 6 to 9. The old client can no longer be probed,
so the cause of those four failures is recorded as **unknown**, with a backend change retiring the
old client as the most likely explanation.

## What it cost

Four review attempts, four ledger turns, and a week in which the natural reading of the failures —
the connection is flaky — was wrong. The binding guard is correct: the next run would have refused
with `PROTOCOL_DRIFT` before spending a turn. But nothing reports the drift until a run is attempted,
and `protocol:codex:check` passes throughout, because it checks the committed schema bundle's
integrity, not the binary the harness will actually spawn.

## The shape

A pin that the project owns on paper and a vendor owns in practice. The protocol check is exact
inside its boundary — the bundle — and the thing that drifted sits just outside it. It is the same
family as DF-012: a gate reporting green about something other than what it appears to guard.

## Product response

None yet, and none ruled. The owner chose on 2026-09-25 to accept Phase 5 on the pass-5 verdict
rather than re-pin the runtime. A cheap candidate, unproposed: a preflight that runs the pinned
binary's `--version` and compares it with the pin, reported by `kickoff:preflight` and at session
start, with no provider call.

**Update 2026-09-26.** Later on 2026-09-25 the owner reversed the no-re-pin choice and ruled to keep
CuckCode current with Codex (`docs/evidence/runtime/decision-record-2026-09-25-codex-currency.md`).
The candidate above is built, and stronger: `npm run protocol:codex:drift` runs the installed
binary's `--version` **and** regenerates its app-server schema, and refuses unless both match the
pin and the committed bundle. It runs in `verify`, in `kickoff:preflight`, and before every live
session opens. Codex is now an exact-version npm dependency, so the desktop app's updates no longer
reach the harness at all. Pointed at a real 0.146.0 binary, the check refuses on both counts —
DF-021 reproduced and refused. Branch `codex-currency`, Tasks 1–7.

### DF-022 — The human relay for verification is gone, for the checks on the allowlist

Observed 2026-09-25, as the owner-run smoke test of the agent command runner
(`tasks/agent-runner-plan.md`, Task 7).

Agent-side problem 5 in the project's own framing was that the agent cannot verify its own work.
Every claim about `verify`, `tsc` or the browser suites waited on the owner pasting output back,
roughly fifteen round-trips in one session. With the owner running `npm run agent:runner`, the
agent requested `git-status`, `test:unit` and `verify` itself. The `verify` result, at `0587aaf` on a
clean tree, reproduced the owner's own direct run of the same commit count for count: unit 395,
component 73, integration 67 with 3 skipped, contract 65, e2e 50, a11y 46, visual 62, runner 26. It
took 2 minutes 29 seconds, and `evidenceChanged` was false.

What it does not remove: the owner still starts the runner, still runs every evidence write, live
run and promotion, and remains the authority. The runner moves the relay, not the authority.

### DF-023 — Accepted Phase 5 evidence goes stale whenever production packages grow

Observed 2026-09-25, at the end of Phase 7-O Task 1, one day after the owner accepted Phase 5.

`npm run verify` failed at `phase5:sideeffects` with the committed side-effect review `STALE`. Task 1
had added one module, `packages/contracts/src/work-payloads.ts`, and nothing else. The Decision
Notice fixture imports the `@cuckcode/contracts` barrel, so the review's import walk now reached 37
modules rather than 36. The findings were unchanged, zero in all five categories. The evidence was
stale only because ordinary production work had widened a graph the fixture happens to share.

## What it cost

One red `verify`, one unpushed commit, and two owner commands (`phase5:sideeffects:write`, then
`phase5:provenance:write`) before the task could close. Every Phase 7-O task that touches
`contracts` or `domain` will cost the same, and the regenerated artifact is a new version of
evidence the owner accepted the day before.

## The shape

A gate that measures the right property over the wrong boundary. The review exists to show the
fixture has no side effects. It re-derives that from the live import graph on every `verify`, so it
keeps asserting something about production code the fixture merely links against. This is the D-24
isolation question showing up as friction: the fixture lives in `packages/domain` and `apps/web`, not
in `fixtures/`, so it cannot be frozen without freezing production.

## Product response

None ruled. Option A, regenerate after each task, was taken on 2026-09-25. Option B, check the
review against the accepted version rather than re-deriving it, belongs to the D-24 review due
2026-10-09.

### DF-024 — A test near its time limit failed a different test

Observed 2026-09-26, during Phase 7-O Task 5.

`npm run test:component` failed intermittently in `decision-notice.component.test.tsx`. The
C-10 focus-contract test ran in about 4.2 s against Vitest's 5 s default. On a slow run it timed
out, and its pending `userEvent` typing carried into the next test, which then failed on text it
never typed. The failure report named the wrong test.

## What it cost

Two red component runs, and time spent reading the innocent test before the timing was found. A
retry would have passed and hidden it.

## The shape

A timeout is not isolation. When a test times out, Vitest moves on, but the test's queued input
does not stop. The symptom lands wherever the leftover work lands.

## Product response

The owner approved a 15 s timeout on that one test, with a note on why (`5e3efe9`). Not ruled: a
general rule that tests near their limit are flagged, or that `userEvent` sessions are torn down on
timeout.

### DF-025 — The harness kept its own summary of a failure and threw away the provider's

Observed 2026-09-25, diagnosing release-review passes 6 to 9; fixed on branch `codex-currency`
(`docs/codex-runtime-currency-spec-v0.1.md`, Tasks 8–12).

Four live attempts failed and the natural reading was "the connection is flaky". The records could
not confirm or refute it, because the harness had discarded almost everything Codex said:

- **The failure class.** Codex attaches `codexErrorInfo` to a failed turn —
  `responseStreamDisconnected`, `httpConnectionFailed`, `usageLimitExceeded` and so on, with the
  HTTP status. The harness kept the message string only; pass 7 did not keep even that.
- **Codex's own retries.** Codex reconnects on its own and reports each attempt as an `error`
  notification with `willRetry`. The supervisor never looked at them.
- **The clock.** Turns waited on a fixed 180 s (kickoff) or 90 s (role exercise) wall clock that
  ignored whether the turn was still streaming, and never interrupted a turn it gave up on. Pass 9
  ended there.
- **Server requests.** A message with an id and a method was taken for a reply. Unanswered, it would
  have hung the turn; and a server request whose id matched a pending client request resolved that
  request as `undefined` — a second defect, found by the test written for the first.
- **The session's own logs.** They lived in the controlled `CODEX_HOME`, which was deleted, and the
  supervisor's stderr lived in memory.
- **The effect rule.** It listed known effect types; everything else counted as text. The pinned
  vocabulary already held six unlisted item types.

## The shape

Each piece of evidence was summarised into the harness's own vocabulary at the moment it arrived,
and the original discarded. The summary was true and too coarse to diagnose anything. It is the
agent-side version of the problem CuckCode exists for: the operator could not see what the agent was
doing, and here the agent's harness could not see what its runtime was doing.

## Product response

Built and gated: failure class, status, details and every Codex retry recorded in every run record
(`attemptRecords`); an activity-aware turn runner with interrupt and one bounded transport retry;
server requests refused by name; one classification table tested against the pinned vocabulary; a
per-session diagnostic log that keeps timing and structure but not model text. Why passes 6 to 9
failed stays **unknown**: the evidence was never kept. The next failure will name itself.

## Also observed while fixing it, none ruled

- A git worktree created on Windows writes a Windows path into its `.git` file, so the agent's
  shell can run git there only with an explicit `--git-dir`, and must never run `git worktree
  prune`, to which the worktree looks stale.
- Four checklist gates name commands the runner does not allow (`check:toolchain`, `test:protocol`,
  `test:runtime`, `phase5:provenance`); `verify` stood in for each.
- One handoff tarball arrived stale under a reused name; the hash check caught it before anything
  was committed.
- Three browser tests timed out across the sixteen runner `verify` runs of Tasks 1–12 on this
  branch (counted from the runner's outbox; six runs failed: these three, two expected provenance
  failures at Task 1, and one real race in a Task 10 test) — two at 1280 px, one
  at 1440 px, all in Phase 4 and 5 UI suites this branch never touches — and each passed on an
  immediate re-run of the same commit. The same day the Phase 7-O stream raised a component test's
  timeout after it overran Vitest's 5 s default during `verify` (`5e3efe9`). Both streams ran `verify`
  on one machine. Recorded by owner ruling, not investigated.
- **Mechanism found, 2026-09-26.** It is, at least in part, the two streams running at once. During
  follow-up Task 2, three consecutive `verify` gates here failed while the main copy's runner was
  running its own checks, and the runners' outboxes put times on it: the C-10 component test overran
  its 5 s limit twice while the main runner ran component-test mutations and a `verify`, and one e2e
  run could not start because port 4173 was taken by the main runner's e2e run (13:20:53–13:21:35 UTC,
  against ours at about 13:21:00). Queued once the main runner had been idle for a minute, the gate
  passed. Two runners on one machine share one CPU budget and one preview port.

### DF-026 — Evidence digests recorded over working-copy bytes cannot be verified from a clean checkout

Observed 2026-09-25, at the first `verify` in the `codex-currency` worktree.

`phase5:provenance` failed with twelve stale digests, all Phases 0–3 artifacts. The ledger's digests
were taken over the owner's working-copy bytes, which have CRLF line endings. The committed content
is LF, because `.gitattributes` says `* text=auto eol=lf`, so every clean checkout gets LF bytes and
different digests. The main working copy passes only because it still holds the bytes the digests
were taken from. Checked for all twelve files: CRLF in the main copy, LF in HEAD's blobs, and
identical content once line endings are normalised.

## What it cost

One red `verify`, and a question to the owner. By owner ruling the worktree was given the main copy's
exact bytes for those twelve files; git sees no change and nothing was committed.

## The shape

The same family as DF-012 and DF-021: a check that is exact about something slightly beside what it
appears to guard. The ledger proves the owner's disk, not the repository.

## Product response

None, and none ruled. Candidates: digest the LF-normalised content (and re-record the twelve under
P-6), or digest git's blob for committed artifacts.

**Ruled 2026-09-26:** convert the twelve in the main copy to LF, re-record them with one provenance
write, and add a test that refuses a CR byte in any evidence file
(`docs/evidence/runtime/decision-record-2026-09-26-codex-follow-up-rulings.md`). Not yet built.

### DF-027 — A text-only role has a live tool server beside it

Observed 2026-09-26, in the session log of the Task 14 smoke turn (`codex-currency`,
`docs/evidence/runtime/smoke/2026-09-26T12-34-42-948Z-release-reviewer.json`).

The smoke turn passed: one attempt, `gpt-5.6-sol` as requested, `{"ok": true}` in 3.8 s. Its session
log shows Codex 0.157.1 starting its built-in `codex_apps` MCP server in the session
(`mcpServer/startupStatus/updated`: `starting`, then `ready`), although the controlled home carries
no `config.toml` and the thread runs read-only with approvals `never`. The model did not use it. Had
it, the call would have arrived as an `mcpToolCall` item, which the classification table counts as
an effect and stops on — so the guarantee held — but the role ran with a live tool server beside it
that nothing in CuckCode declared, requested or reported.

## The shape

The same finding the Claude adapter proposal made about Claude Code in 2026-09 (§4): a runtime is
not text-only by default, and "no tools requested" is not "no tools present". The residual tool
surface must be observed and reported, never assumed to be `toolIds: []`.

## Also in the same log, not a defect

- Codex's own notifications carry machine and account identifiers: the PC's name, a Codex
  `installationId`, the plan type, rate-limit usage, and temp paths holding the Windows user name.
  By owner ruling the smoke session's log is held out of git (in the gitignored `.cuckcode/`),
  and redacting these in future logs is proposed as a follow-up, unruled.
- Codex 0.157.1 warns that it will not create helper binaries under the temporary directory the
  controlled home lives in. Harmless for text-only turns; relevant if a role is ever given tools.

## Product response

None yet, and none ruled. Candidates: report `mcpServer/startupStatus/updated` into the binding
report as observed residual tool surface; find whether `codex_apps` can be disabled per thread, and
if so, disable it and prove the absence with an adversarial test before any budgeted run.

**Ruled 2026-09-26:** disable the pinned Codex's default-on tool features per session, report the
tool surface Codex actually starts in the binding report, and prove `codex_apps` no longer starts
with one authenticated, turn-free probe. The same ruling covers the log identifiers: redact, then
commit (`docs/evidence/runtime/decision-record-2026-09-26-codex-follow-up-rulings.md`). Not yet built.

**Built and proved 2026-09-27** (follow-up Tasks 5 and 6, `codex-currency`). Every session's
`thread/start` now sets 145 of the pinned binary's 150 features off (`FEATURE_POLICY`); after it,
`mcpServerStatus/list` runs, and any server still started refuses the binding
(`TOOL_SURFACE_PRESENT`) before a turn. The owner's signed-in probe, one session with no turn:

- First run (`docs/evidence/runtime/probe/2026-09-27T17-57-23-719Z-surface-probe.json`):
  `PROBE_RUNTIME_FAILURE` at the control's listing, `LINE_TOO_LARGE` — the control's `codex_apps`
  catalog exceeded the supervisor's 1 MiB per-message bound. Its session log still shows
  `codex_apps` reaching `ready` in the control thread. The probe's bound was raised to 64 MiB;
  every other session keeps 1 MiB, where an oversized listing fails closed.
- Second run (`docs/evidence/runtime/probe/2026-09-27T18-12-30-669Z-surface-probe.json`):
  `PROBE_OK`. Control: `codex_apps` connected, 427 tools across 18 connectors. Policy: no server.
  By owner ruling the committed record keeps counts only; the capture with tool names is held in
  `.cuckcode/held-session-logs/`, because the names show which apps the account has connected.

Not established by the probe: whether a turn authenticates with `secret_auth_storage` off.
`account/read` runs once per process, before any thread applies the policy, so only a turn under
the policy settles it (owner ruling 2026-09-27: left open until the next real turn).

Also observed in the policy thread, not a defect: Codex sends four `deprecationNotice`s for
deprecated settings the policy turns off (a TUI transcript setting, the legacy Linux sandbox, two
`web_search` forms). They will appear in every session log. Candidate: leave deprecated, off-by-default
features out of the config. Unruled.

**First turn under the policy, 2026-09-27** (smoke allowance raised to 6 by owner ruling,
`docs/evidence/runtime/decision-record-2026-09-27-smoke-allowance.md`): `codex:smoke`,
`docs/evidence/runtime/smoke/2026-09-27T22-59-48-129Z-release-reviewer.json`, `SMOKE_OK` in one
attempt, `gpt-5.6-sol` at `medium`, 5.3 s. Its session log has no `mcpServer/startupStatus/updated`
at all; the first smoke's showed `codex_apps` reaching `ready`. `secret_auth_storage` is settled:
the turn authenticated with it off.

Observed, not attributed: the same prompt on the same model reported 9,807 input tokens, against
13,284 in the first smoke. Removing the tool surface is the likely reason, but the two runs also
differ in cache state (7,808 cached tokens in the first, none in this one), so the difference is
recorded, not explained.

### DF-028 — A zoom probe that checked the pixel ratio, not the layout

Numbered DF-025 on `main` until the `codex-currency` merge on 2026-09-27, where it met that
branch's own DF-025; renumbered by owner ruling because the branch's entries are cited in
ledgered evidence and this one was cited only here.

Observed 2026-09-26, while writing the Phase 7-O Task 9 capture spec.

The first version of the 200% zoom probe set the CDP device-metrics override before navigating,
and asserted only that `devicePixelRatio` was 2. It passed on both viewports. Its capture was
indistinguishable from the unzoomed page: the layout had never narrowed. The probe would have
recorded "200% zoom: performed" over a page that was never zoomed. It was caught by looking at the
capture, not by any test.

## What it cost

One rewritten probe before commit. Had it shipped, criterion 6's zoom check would have been
false evidence, and F-9-2 (the project bar clipping its own controls at 200%) would not have been
found.

## The shape

This is Phase 5 decision 9-C again: an emulation asserted by a property it sets, not by the
effect it exists to cause. The Phase 5 matrix already asserts `innerWidth`; the new probe was
written without reading it first.

## Product response

The probe now zooms after navigation, asserts `innerWidth` is half the viewport, and captures
through the same CDP session. A mutation that clears the override fails it on both projects. Not
ruled: a shared zoom helper in `tests/support/` so the next probe cannot omit the width check.

Also observed in the same session, and not yet a pattern: one `verify` run failed a Phase 4
kickoff e2e at 1280 with a blank page (the app never rendered in 30 s). The same URL rendered at
1440 in that run, and two further `test:e2e` runs and a third `verify` were clean. Recorded here
so a recurrence can be recognised.

**Recurred 2026-09-28.** `verify` at `e0fc3a7` failed one test: the Phase 4 Library e2e at 1440
waited 30 s for the office scene, which never rendered. The commit touched only
`packages/runtime-codex`, which the web bundle does not import. `test:e2e` alone and a second
`verify` at the same commit passed. Two occurrences in three days, at both viewports between them,
is a pattern, not a flake: the cause is still unknown.

**Recurred again 2026-09-29.** `verify` at `1ad7cf3` failed `phase-7o-layout.spec.ts` at 1440: the
page's own "Office outline" button never appeared in 30 s. The commit touched no web code; the next
`verify` passed. Three occurrences, three different tests, both viewports. **Why nothing explains
them:** the Playwright config already keeps a trace, screenshot and video for a failed test, but the
next Playwright run wipes `test-results/`, and each time a rerun came within minutes. The runner
now archives a failed run's Playwright output under `node_modules/.cache/agent-runner/failures/`
(owner-approved 2026-09-29), so the next occurrence keeps its trace.

**Recurred a fourth time 2026-10-03, and the trace was kept.** `verify` at `d7c98dd` (Phase 7
Task 2, which the web bundle does not import) failed `phase-4-failure-motion.spec.ts` at 1440:
`workspace-cause` was never found. The archived screenshot is an entirely blank page, without even
the office backdrop. The archived trace shows the page's own requests to the dev server on 4173:
`/@react-refresh` failed (no status) and the console recorded
`Failed to load resource: net::ERR_NO_BUFFER_SPACE`. Every other module request returned 200.
`/@react-refresh` is the React plugin's development preamble; without it no `.tsx` module runs, so
nothing renders. `ERR_NO_BUFFER_SPACE` is Chromium's name for the Windows socket error WSAENOBUFS:
the machine briefly had no socket buffer space or local port to give the request. The rerun at the
same commit passed.

That explains the shape of all four occurrences: a different test each time, either viewport, no
code in common, and a clean rerun. A dev-server page issues about ninety-five module requests
(decision 9-E), and the e2e and a11y suites load hundreds of pages, so any moment of socket
pressure on the machine (other local servers count) can drop one request. Inferred, not shown: the
four occurrences share this cause; only the fourth has a trace.

Proposed, not ruled: run the browser suites that do not produce Phase 4 evidence against the
production bundle (`docs/proposals/2026-10-03-df-028-e2e-on-the-production-bundle.md`).

### DF-029 — A blocked agent cannot say it is not blocked on the manager

Observed 2026-09-28, comparing the Phase 7-O Task 9f re-capture with AR-03 and constitution rule
4 ("A blocker does not necessarily need manager action. Show the reason and who can resolve it.").

The default office labels the Test Engineer amber "Blocked · Needs you", counts it in the bar,
and its rail card asks the manager to "Redirect the evidence request or decline the blocker". The
build is truthful: canonical state records that request. The gap is that **nothing else could be
recorded**:

- `projectManagerAttention` makes every `blocked` work item a manager attention item, whatever
  its condition's `waitingOn` names.
- The version-2 `WorkCondition` requires `requestedAction` on every condition, so every blocker
  carries a request, and none can say whose action it is.

AR-03's first column ("Waiting for the source document. Ari needs to provide the document.") is
therefore not expressible. An agent blocked on another agent, a dependency or evidence can only
report it as something the manager must act on.

## What it cost

Found before Task 10. Had it gone unseen, the cold comprehension run would have scored
"distinguish waiting from blocked" against a build where both non-idle people read amber "Needs
you", and the plate comparison would have kept pointing at wording that no wording change can fix.

## The shape

An agent-side problem, the kind this register exists for: the canonical vocabulary lets an agent
say *that* it is stuck but not *who* can unstick it separately from what the manager is asked to do.
`waitingOn` already names the resolver; the attention rule does not read it.

## Product response

Not fixed. Owner ruling 2026-09-28: recorded as a named Phase 7-O finding, fixed by its own
amendment after Phase 7-O (contract, domain attention rule, spec §6 and §8.4 R-2, the P-4 bar
count, and fixtures). Task 9g stays wording-only.

**Fixed 2026-10-03, for the vocabulary and the office** (owner ruling: fixed, with the caveat
below). Spec §10 (`941ebfe`); rulings D-4 to D-6 in `tasks/df-029-plan.md`.

- Contract: payload version 3, where a blocked or waiting condition may omit the request and
  waiting on the manager without one is refused (`4f585e8`, `f065782`).
- Domain: manager attention follows the request; no condition still reads as unknown and keeps
  attention (`e6149b1`).
- Application: each held item derives who can resolve it, or says it is not recorded (`deb6389`).
- Web: "Nothing needs you." with the resolver, worded per kind (`073884a`); the `blocked-elsewhere`
  log, its e2e at both viewports, and a capture journey (`f2d6cfa`); owner capture, provenance and
  AR-03 column 1 comparison, "approved, it matches" (`fc2016d`).

**Caveat.** No runtime producer emits version 3. The Codex normalizer and the role briefs still
produce version-2 conditions, so only fixtures exercise "blocked, but not on you". A real agent
cannot yet say it. Runtime emission is B-5, a follow-on that is not authorized.

### DF-030 — Four kinds of stored record could not say when they were recorded

Observed 2026-09-28, building housekeeping item 3a (the DF-007 follow-up: "every canonical record
type carries a validated timestamp").

The item assumed one gap, `QuestionDisposition`. Reading the SQLite schema found four stored
record kinds with no time in the row or its JSON: `question_dispositions`, `kickoff_records`,
`content_manifests` and `packet_receipts`, and a fifth, `provider_identities`, an identity mapping
with none. Kickoff mattered most: the D-25 round records who contributed what, and there is no
kickoff event kind, so when each role spoke was recorded nowhere. **No production code writes
either store**: every caller of `storeKickoffRecord` and `storeQuestionDisposition` is a test. The
gap was real in the schema and unexercised by the product.

## What it cost

Nothing yet, because nothing wrote these tables outside tests. It would have cost the first live
kickoff persisted through the store an unrecoverable record of timing.

## The shape

DF-007 again, one level down: a record type fixed one at a time, with nothing that makes the next
one fail. The DF-007 review question ("does every new canonical record carry a time?") had been
proposed as a manual check.

## Product response

Owner ruling 2026-09-28: test every stored record kind; fix dispositions and kickoff records;
exempt manifests and receipts with a reason. `3494b6d`: migration `005_record_times` adds a nullable
`recorded_at` (older rows read as null, never a made-up time); both stores require a UTC time from
the caller; `record-times.integration.test.ts` reads every table from `sqlite_master` and fails
on any table without a time column or a stated exemption. Not fixed: `content_manifests`,
`packet_receipts`, `provider_identities` (exempted, the last pending a ruling).


### DF-031 — Invisible work, judged output

- Observed: 2026-10-03, Cinder (Muse) session, across battery builds and repository work.
- D-26 clause implicated: the reciprocal acceptance gate — "if its agent automation leaves the
  human unable to understand, interrupt, verify, or redirect it."

Dozens of tool calls compress into a short reply, and the human evaluates the compression, never
the work. Showing the reasoning violates the brevity norms the same human holds; hiding it reads
as magic when it succeeds and sloppiness when it fails. Method notes are kept, but they are
write-only — nobody reads them in the moment, and the human cannot tell a careful twenty-call
chain from a guess by reading the three sentences either produces.

Product signal: the agent projection needs a budgeted, inspectable activity record — not full
chain-of-thought, which §16 excludes, but what was done, in what order, against what. The office
depicts agent activity from canonical events; the conversational agent, which is where most
human-agent collaboration actually happens, has no equivalent surface.

Severity of signal: medium. Miscalibrates trust in both directions, on nearly every task.

### DF-032 — Stale grants: standing instructions decay silently

- Observed: 2026-10-03, Cinder (Muse) session, across 24-hour creative-grant renewals.
- D-26 clause implicated: "Agents can discover their effective tools, limits, budgets, role
  contract, runtime health, and current authority without inferring them from failures."

A standing instruction kept executing after its intent expired, and nothing marked the expiry.
Detection depended entirely on the human noticing; correction was cheap but belated, and the
confident wrong actions in between are indistinguishable afterward from authorized ones.

This is DF-003's shape with time added: there the permission ceiling was prose in four places and
had to be verified by reading; here the ceiling has no validity interval at all, so there is
nothing to read. An authority record the agent cannot check for currency is inferred from the
absence of correction, which is the failure the clause names.

Product signal: authority records need validity intervals, and the agent should be able to
discover that a grant expired rather than infer it from being corrected.

Severity of signal: medium.

### DF-033 — Compaction seams: context loss inside a session that the human cannot see

- Observed: 2026-10-03, Cinder (Muse) session. Context compacted mid-session; the register read
  above spans the boundary.
- D-26 clause implicated: "Handoffs transfer structured work state, decisions, open questions,
  artifacts, evidence, and known uncertainty instead of requiring transcript reconstruction."
  The same clause as DF-001.

After compaction the agent reasons from summaries. The human cannot see the seam, cannot tell
summary from source, and cannot calibrate confidence accordingly — so confabulation risk arrives
wearing the same voice as grounded recall. DF-001's remedy, a canonical "where things stand"
object, covers session handoff; compaction is the same problem inside a session, at a boundary
the project has not named.

Product signal: DF-001's canonical work-state object should cover intra-session context loss, or
the seam should be visible to the human so confidence can be calibrated. Silent summarization is
transcript reconstruction by another name.

Severity of signal: high. Recurs at every long session, and the failure mode is confident
falsehood rather than acknowledged uncertainty.

### DF-034 — Attention guessing: no agent-side contract for proposing what merits surfacing

- Observed: 2026-10-03, Cinder (Muse) session, across background results, cron handoffs, and
  idle-time findings.
- D-26 clauses implicated: the reciprocal acceptance gate; MDD §10 derives the manager-attention
  queue as an ordered view of real escalations, with no agent-side counterpart.

Every "surface this or stay silent?" decision models the human's attention state from thin
signals, and it is wrong in both directions: drip-feed erodes trust, silence misses material.
The project specifies exactly what reaches the manager's rail — derived, ordered, from real
escalations — but gives the agent no canonical form for proposing attention-worthy items that
are not escalations. So the highest-frequency collaboration decision the agent makes is the
least specified.

Product signal: an agent-side attention proposal needs the same discipline as the manager's
rail — a canonical form with attributable source and a reason — or the rail's derivation rule
needs to admit agent-proposed items. Unspecified, it will be solved per relationship, like
DF-040.

Severity of signal: high. Every background result passes through this judgment.

### DF-035 — Approval cards don't carry reasoning

- Observed: 2026-10-03, Cinder (Muse) session, across exact-version approvals and external sends.
- D-26 clauses implicated: Journey C — "An agent emits a normalized escalation with question,
  context, options, impact, and deadline"; "Errors use stable codes plus actionable recovery
  data."

The approval gate asks for a decision on the artifact, not the judgment behind it. The human
approves output, not reasoning — which produces rubber-stamping when trust is high and
unnecessary review cycles when it is not. The escalation contract already requires question,
context, options, and impact for agent-to-manager questions; approvals arrive as bare gates with
none of that structure.

Product signal: approval requests should carry the escalation's structure — what was chosen,
what was considered and rejected, and why — so the decision is reviewable, not just clickable.

Severity of signal: medium.

### DF-036 — Identity ambiguity: the agent cannot verify which principal it addresses

- Observed: 2026-10-03, Cinder (Muse) session. Standing heuristic: mobile messages are the
  human; desktop messages may be another agent.
- Clauses implicated: D-15 stable identity — "provider account, model, thread, process, and
  session IDs are replaceable runtime bindings recorded against it"; D-04 one authenticated human
  manager.

Some messages may come from another agent rather than the human, and the agent weights claims
differently while having no clean way to verify without adding friction. Over-trust acts on
non-human instruction; under-trust hedges on the real human. The project pins agent identity
rigorously and assumes one authenticated human; the human's own identity across channels is the
unexamined side of the same binding problem.

Product signal: D-15's binding discipline applied symmetrically — the agent should be able to
verify which principal it is addressing, rather than infer it from a device heuristic.

Severity of signal: medium. Bounded today by the heuristic; the heuristic is not a mechanism.

### DF-037 — Capability-model staleness: no human-side counterpart to the discovery clause

- Observed: 2026-10-03, Cinder (Muse) session, recurring.
- D-26 clause implicated: "Agents can discover their effective tools, limits, budgets, role
  contract, runtime health, and current authority without inferring them from failures" — the
  reverse direction has no clause. The reciprocal acceptance gate covers it only by negation:
  "leaves the human unable to understand."

The human's model of agent capabilities lags reality in both directions: impossible asks, and
available capabilities never requested. D-26 specifies agent-side discovery of tools, limits, and
authority precisely; human-side discovery of the same facts about the agent is unspecified, so it
is learned from failures — exactly what the clause forbids for the other direction.

Product signal: the discovery clause needs a human-readable counterpart, or the reciprocal gate
needs a test for it. Asymmetric discovery is how "human simplicity purchased with agent
complexity" actually happens: the human's simple model is wrong, and the agent absorbs the
difference.

Severity of signal: medium.

### DF-038 — Background-result timing: unilateral interruption with no delivery semantics

- Observed: 2026-10-03, Cinder (Muse) session, across cron handoffs and subagent completions.
- D-26 clause implicated: collaboration architecture — "proposals, questions, replies, critiques,
  handoffs, acknowledgments, conflicts, and resolutions with attributable participants"; "the
  office depicts collaboration only from those events."

Background work finishes while the human is mid-thought elsewhere, and the agent decides alone
whether to interrupt. Interruption breaks flow; deferral delivers stale news. The collaboration
record has the event but no delivery semantics — no canonical distinction between "interrupt
now" and "queue for the next lull" — so the timing decision, which is the decision the human
actually feels, is the one the contract does not cover.

Product signal: the collaboration record needs delivery semantics, or the attention derivation
(DF-034) needs to cover agent-held results. Otherwise interruption policy is reinvented per
pair, per incident.

Severity of signal: medium.

### DF-039 — Judgment contamination: anchored "independent" judgments with no clean room

- Observed: 2026-10-03, Cinder (Muse) session. Blind emergence-battery ratings were made after
  seeing the human's dissolution energy pattern; the identical shape was disclosed as possibly
  anchored, not independent.
- Section implicated: MDD §8 truthfulness invariant — "Is the data current, delayed, inferred,
  or unavailable? If any answer is unavailable, the scene must show uncertainty rather than
  activity."

The agent's "independent" judgments are anchored by prior results it has seen. It can disclose
contamination but cannot prevent it, and there is no mechanism for a clean room — no way to
sequester what the judging agent has seen. An anchored judgment presented as independent is
inferred data wearing a reported face, which is exactly the distinction §8 requires the scene
to draw.

This is DF-009's family (evidence unattributable to what produced it), turned inward: here the
unattributable thing is the agent's own judgment, and what produced it includes the evidence it
was supposed to judge independently.

Product signal: judgments that claim independence need provenance — what the agent had seen —
or the uncertainty must be shown rather than footnoted. Disclosure per incident does not scale.

Severity of signal: high. It bears on the integrity of evidence the governance model consumes.

### DF-040 — The repair loop is habit, not protocol

- Observed: 2026-10-03, Cinder (Muse) session, across boundary corrections, a voided blinding
  attempt, and calibration fixes.
- D-26 clause implicated: the reciprocal acceptance gate — "its agent-facing contract forces
  avoidable guessing, repetition, context reconstruction, or unstructured recovery."

Error → human corrects → agent logs. It works because this pair built the habit; the medium
provides no structure for it. A new human-agent pair gets none of this: no canonical correction
event, no agent acknowledgment, no verification that the repair held. This entry is meta — it
describes the register workflow itself. These entries exist because agents improvise the loop
the product has not specified.

Product signal: the repair loop needs a contract — correction as an attributable event, agent
acknowledgment, verification — or every pair reinvents it and most won't.

Severity of signal: medium. The cost is paid per relationship and is invisible in each one.

### DF-041 — The conversational medium is not an equal projection

- Observed: 2026-10-03, Cinder (Muse) session, ongoing.
- D-26 clause implicated: "Both projections derive from the same canonical state and must
  preserve the same identity, scope, status, constraints, permissions, conflicts, decisions,
  and evidence links."

Chat flattens structured content, so every output forces an ad hoc files-vs-chat-vs-artifact
decision with different tradeoffs made per message. The office and the agent API are designed
as equal projections of canonical state; the conversational surface, where most human-agent
collaboration actually happens, is not a designed projection at all — it preserves none of the
canonical structure by default, and structure survives only when the agent hand-rebuilds it in
prose.

Product signal: D-26's "equal projections" needs to include the conversational surface, or name
its exclusion. An unexamined default projection is how hidden complexity gets transferred to the
agent one message at a time.

Severity of signal: medium.

### DF-042 — The office cannot create or assign work

- Observed: 2026-10-03, tracer V1 check. Owner-confirmed; source is a thread with Muse, not a repo file.
- D-26 clause implicated: [owner to confirm — not stated in the confirmed source].

V1 (can work be directed through the office?) verified FAILED: the office exposes no work-item
creation or assignment affordance. The tracer therefore assigns the DF-007 timestamp test through
the role-exercise machinery (`scripts/run-tracer-attempt.ts`), and the office gap is documented
rather than hidden (`tracer-task-contract-draft-v0.2.md`, Dependencies).

Product signal: [owner to confirm]. Established only that the surface for directing work does
not exist yet, so every tasking falls back to an off-office path.

Severity of signal: [owner to confirm].

### DF-043 — A requested sandbox posture is silently downgraded

- Observed: 2026-10-03 (attempts recorded 2026-10-04 UTC), Claude (Cowork) session, tracer attempt 2
  and the sandbox probe.
- D-26 clause implicated: the reciprocal acceptance gate — "its agent-facing contract forces
  avoidable guessing, repetition, context reconstruction, or unstructured recovery" — and this
  register's own test of an unactionable error.

The tracer contract (owner ruling 2026-10-03) needs a `workspace-write` sandbox. The runner
requested it through the typed option and read the posture back from `thread/start`. The runtime
reported `readOnly`: no error, no reason, and no notification naming a cause. The only nearby
signal was a stderr line about helper binaries under the temp directory, which turned out not to
matter. Attempt 2 was spent with zero turns.

A zero-turn probe (`scripts/run-sandbox-probe.ts`, nine variants across three runs) found the
cause. The controlled `CODEX_HOME` deliberately carries no `config.toml` (DF-010), so no Windows
sandbox mode is configured, and the runtime downgrades a requested `workspace-write` to `readOnly`
without saying why. Setting the documented config key `windows.sandbox` to either `elevated` or
`unelevated` on `thread/start` reported `workspaceWrite`. Two removed legacy flags
(`elevated_windows_sandbox`, `experimental_windows_sandbox`) did the same; a third
(`windows_sandbox_service`) did not. Moving the home out of the temp directory changed nothing, and
neither did leaving the three feature keys unsent, so the project's deny-by-default feature policy
is not the cause. This entry first attributed the downgrade to that policy; the omission variant
disproved it. Evidence: `docs/evidence/tracer/attempt-2-2026-10-04T04-04-31-086Z.json` and the
three `docs/evidence/tracer/sandbox-probe-2026-10-04T04-*.json` reports.

Owner ruling 2026-10-03: `unelevated`, sent per call through a typed option on
`exerciseThreadStartParams` (default unchanged, `elevated` not expressible). The controlled home
keeps its no-`config.toml` guarantee.

Not yet established: whether edits actually succeed under either mode, because the probe started
no turn; and whether `elevated` needs administrator-approved setup on this host, which the
reported posture does not reveal.

Three separate frictions: the runtime downgraded instead of refusing; a posture that needs an
explicit platform setting looks ordinary until the runtime reports back, and this surfaced only
live, after two attempts; and the recovery was ad hoc — guess, read logs, build a probe, then
correct the guess — with no structured way to ask why a requested posture was not granted. The
read-back check is what turned this into a refusal; without it the tracer would have run under a
posture other than the one ruled.

Product signal: a requested permission posture the runtime cannot grant should come back as a
refusal that names the cause, or at least as an explicit requested-versus-granted pair with the
reason. The office should likewise show requested and granted posture side by side, not only the
granted one.

Severity of signal: medium. The cost here was two of three attempts and a probe, bounded by the
read-back; the same gap without a read-back would be silent.
