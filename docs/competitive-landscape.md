# Competitive landscape register

Checked: 2026-08-18
Status: **Informational register. Approves nothing and amends no requirement.**

## Why this document exists

The master design document and `docs/sources.md` record upstream role content, stack references,
and verification references. Neither records comparable products. As of 2026-08-18 the
"agents rendered as office workers" concept is no longer novel; it is a small but real category
with at least one widely adopted entrant. Product decisions that assume novelty in the metaphor
are unsupported.

Method note: star counts and reception figures below were retrieved on 2026-08-18 through web
retrieval and summarization, not by direct repository inspection. Treat them as approximate and
re-check before citing externally.

## Category entrants

### Pixel Agents — `pixel-agents-hq/pixel-agents`

- Approximately **8.9k GitHub stars**. The category leader by adoption.
- Renders Claude Code sessions as pixel-art characters in an office; characters walk, sit, type,
  and read.
- **Event-driven, not decorative.** Consumes Claude hooks (`SessionStart`, `PreToolUse`,
  `PermissionRequest`) with a transcript-scanning heuristic fallback.
- Target user: developers using Claude Code, in VS Code or terminal environments.

### Munder Difflin — `chaitanyagiri/munder-difflin`

- 9 GitHub stars, but 197 Product Hunt upvotes, 335 followers, #5 of the day.
- Electron desktop app. Pixi.js office floor, xterm.js real PTY terminals, *The Office* themed
  cast, a supervisory "GOD orchestrator" agent that routes work and handles escalations.
- Self-described status: working prototype.
- Art assets are licensed from LimeZu; the README states commercial use requires a paid license.

### Agents in the Office — `gukosowa/agents-in-the-office`

- 2 stars, 1 fork. Claude Code and Gemini CLI, file-watching hooks driving NPC behavior.
- Self-described as "completely vibe coded." Some macOS-only functionality.

### Not assessed

`fakeou/agent-office` and `booya1986/The-Office` were observed in the same category but not
examined. Assess before making any completeness claim about this register.

## Findings that bear on CuckCode requirements

### F-1 — The office metaphor is validated for appeal, and is now commodity

Roughly 8.9k stars for Pixel Agents, plus Munder Difflin's Product Hunt reception, establish that
representing agents as office workers is legible and wanted. CuckCode does not need to prove this
and is not first to it.

Consequence: the MDD §2 Outcome sentence — "present real agent work as a familiar, interactive
office environment" — now describes an existing widely adopted product rather than CuckCode's
distinguishing claim. See `docs/proposals/2026-08-18-mdd-amendments.md`.

### F-2 — Every observed entrant is a viewer, not a control surface

All observed products render what agents are doing. None makes the office the surface through
which a manager assigns outcomes, answers escalations, inspects evidence, and approves or
redirects deliverables. CuckCode's core management loop (MDD §2) is therefore **not** validated
by this category's adoption. High adoption of observation tells us nothing about whether a
non-technical manager can *operate* from a spatial scene.

This is the distinction the §20 comprehension study exists to test, and it remains untested.

### F-3 — The category's leading themed entrant ships the exact behavior CuckCode forbids

Munder Difflin's README states that wiring avatar movement to real Claude Code tool events is the
"headline next milestone," and that today it "falls back to a synthetic event loop where hooks
aren't attached." Avatar movement not backed by a real event is theater. Under CuckCode's
semantic behavior map and binding constraint (MDD §2, §9) this is a V0 truthfulness violation.

Consequence: truthfulness is a live differentiator, not a hygiene requirement. A competitor with
far greater adoption is currently shipping simulated motion.

### F-4 — Independent user evidence that the category fails the completed-versus-real distinction

A Product Hunt commenter on Munder Difflin reported being unable to distinguish incomplete or
abandoned work from real results, noting that "64.9% of the spend in its abandoned bucket" looked
indistinguishable from successful runs.

This is the strongest external evidence available for CuckCode's thesis: a real user of a
competing product, failing the precise criterion in MDD §20 ("distinguish completed from
approved") and the precise forbidden implication in §9 ("completed → artifact placed in delivery
area; forbidden: owner approval or production readiness").

It is evidence *for* running the comprehension study, not against it. It shows the category
clears the appeal bar while failing the operability bar.

### F-5 — Licensed art assets are a constraint competitors carry and CuckCode does not

Munder Difflin's assets are licensed from a third party with commercial-use restrictions.
CuckCode's D-22 already requires three original art-direction candidates. That requirement was
made for originality and coherence reasons; it also happens to avoid a commercial constraint
that at least one competitor carries.

## What this register does not establish

- It does not establish that CuckCode's spatial scene is operable by a non-technical manager.
- It does not supply comprehension evidence, and does not satisfy or reduce any part of MDD §20.
- It does not rank or score competitors on quality, and no product here was installed or used.
- It does not authorize any scope, positioning, or requirement change. Amendments are proposed
  separately and require owner approval.
