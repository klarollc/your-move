# Task 9g: plain rail controls and a plain evidence heading

**Status: PROPOSED 2026-09-28, awaiting owner approval.**

Author: agent. Owner instruction, 2026-09-28: "Small 9g, then Task 10", then "Record it, 9g stays
small" for the rule 4 gap (DF-029).

Governing plates: **AR-03** column 3 (several requests: one short card in plain words) and
**AR-04** "Badges and technical noise everywhere" (rejected), with constitution rules 2 and 10.
Pack hashes re-checked 2026-09-28 against `docs/art-reference-approval-2026-09-27.md`: match.

## 1. Why

In the 9f re-capture (`0807363`), two surfaces still lead with repeated or technical text:

- **The attention rail.** Each item's three controls repeat its title as visible text: "Locate
  Provide current browser evidence: blocked", "Respond to Provide current browser evidence:
  blocked", "Dismiss Provide current browser evidence: blocked". Each wraps to two lines at
  280 px, and together they are most of the card.
- **An opened evidence record.** Its heading is the identifier `evidence_browser v1`, and the
  plain sentence sits under it. Rule 10 puts identifiers behind the drill-down.

Both are wording and structure. No rendering, contract or domain change.

## 2. Decisions needed

- **G-1, short visible labels, full accessible names.** The rail's controls read `Show in office`,
  `Respond` and `Dismiss`. Their accessible names stay "Locate {item}", "Respond to {item}" and
  "Dismiss {item}". WCAG 2.5.3 (label in name) needs the visible text inside the accessible name:
  "Respond" and "Dismiss" are; "Show in office" is not inside "Locate {item}", so the accessible
  name becomes "Show {item} in office". Alternative: keep "Locate" as the visible word
  ("Locate", "Respond", "Dismiss"), which needs no rename. A grep finds 34 test references to
  "Locate {item}" across component and e2e tests; the rename moves all of them under P-4.
  Recommendation: **the alternative**. "Locate" is plain enough, and the churn buys one word.
- **G-2, the evidence record leads with its finding.** The record's heading becomes the plain
  sentence ("Browser evidence, version 1: failed. No summary recorded."). The kind line and the
  `evidence_browser v1` identifier move under `Detailed evidence`. The dialog's accessible name,
  "Evidence: evidence_browser v1", is unchanged, so tests and assistive technology still find the
  record by its identity. Recommendation: yes.

## 3. Not in 9g

- **Rule 4, blocked versus needs you.** Recorded as DF-029 and a named finding. It needs a
  contract, domain and specification amendment, and follows Phase 7-O.
- **The project name** ("truthful graybox office"). Ruling 9f-1a: the logs record no project name,
  so none is invented.
- **Rendering.** Deferred to Phase 7 under P-0 (owner disposition 2026-09-28).
- The bar count (P-4) is unchanged.

## 4. Method

RED first for each decision: a component test asserting the visible text and the accessible name
(G-1), and a component test asserting the record's heading is the plain sentence and the
identifier is not visible until `Detailed evidence` is opened (G-2). One mutation each. `verify`
on a clean tree through the runner. Then the owner re-captures the Task 9 evidence and records
provenance.

## 5. What moves (P-4 rule), to be listed at the time

- Tests that click `Locate {item}` by accessible name: G-1 renames that name to
  "Show {item} in office".
- Tests reading `evidence_browser v1` as visible heading text move to `Detailed evidence`.
- The Task 9 capture spec's evidence journey assertion, if it reads the heading.
