# Codex currency follow-ups — specification v0.1

**Status: OWNER-APPROVED 2026-09-26, with FU-1 to FU-4 as recommended.** Authority:
`docs/evidence/runtime/decision-record-2026-09-26-codex-follow-up-rulings.md` (four rulings, each as
recommended) and the owner's approval of "one small specification covering all four". Approval
authorizes a plan only; the plan and its task list each need approval before any code changes.

Branch: `codex-currency`, before its merge into `main`. One step (F2.4) runs on `main` immediately
after the merge.

## F1 — The tool surface beside text-only roles (DF-027)

### Facts, established without a provider call

- The pinned 0.157.1 enables, by default, features that give the model tools or external effects:
  `apps` (the `codex_apps` MCP server), `shell_tool`, `unified_exec`, `unified_exec_tty`,
  `browser_use`, `browser_use_external`, `browser_use_full_cdp_access`, `computer_use`,
  `image_generation`, `view_image`, `multi_agent`, `plugins`, `remote_plugin`, `plugin_sharing`,
  `skill_mcp_dependency_install`, `skill_search`, `tool_suggest`, `tool_call_mcp_elicitation`,
  `sleep_tool`, `in_app_browser`, `in_app_local_automation`, `hooks`, `workspace_dependencies` and
  `worktrees`, among the 43 default-on features whose stage is not `removed` (52 default-on in all, counted from
  `codex features list`).
- `-c features.<name>=false` is accepted, and `thread/start` takes a free-form `config`, which
  CuckCode already uses for `model_reasoning_effort`.
- `mcpServerStatus/list` (read-only) enumerates MCP servers **with their tools**. The protocol has no
  call that enumerates native tools such as the shell or the browser.
- Without a credential `codex_apps` never starts, so whether the override stops it can only be
  proved in a signed-in session.

### Requirements

- **F1.1 Feature policy, deny by default.** One table in `@cuckcode/runtime-codex`,
  `FEATURE_POLICY`, names every feature the pinned binary reports as `keep` or `disable`. Every
  session's `thread/start` `config` disables every default-on feature not marked `keep`, through the
  single place that builds those params (`exerciseThreadStartParams`), so the kickoff session, role
  exercises and every live script inherit it. `CODEX_ARGS` and the spawn-argument guard are unchanged.
- **F1.2 The policy follows the pin.** `protocol:codex:upgrade` also writes
  `protocol/<version>/features.json` (the binary's `features list`: name, stage, default), and the
  surface diff flags any new or changed default-on feature for ruling. A test fails if the pinned
  `features.json` and `FEATURE_POLICY` disagree. A feature nobody has classified is disabled, not
  kept.
- **F1.3 Report what is present.** After `thread/start`, the session calls `mcpServerStatus/list`
  and records every MCP server and its tool names. `mcpServerStatus/list` joins the request
  allow-list; it is read-only. The report lands per FU-3.
- **F1.4 Refuse what should not be there.** A session whose MCP enumeration is not empty after the
  policy is applied refuses to bind (`TOOL_SURFACE_PRESENT`, naming the servers) before any turn.
  This makes the proof run on every session, not once.
- **F1.5 The proof run.** `npm run codex:probe-surface`, owner-run behind `CUCKCODE_LIVE_PROBE=1`:
  one signed-in session, `thread/start` twice — once without the policy as a control, once with it —
  each followed by `mcpServerStatus/list`. **No `turn/start`.** It writes one record and a session
  log (redacted per F3). It spends no turn and touches no ledger.
- **F1.6 Stop condition.** If the policy run still shows `codex_apps`, or the control does not, work
  stops for a ruling. The candidate fallback — writing a controlled `config.toml` into the
  controlled home, which would change DF-010's "exactly two files" guarantee — is not authorized by
  this specification.

### What F1 does not establish

That native tools are absent. The protocol cannot enumerate them. F1 requests their absence
(F1.1) and the effect rule still stops any use (Task 8). An adversarial turn that tries to use a
tool would prove it, but it spends a turn and is out of scope.

## F2 — Evidence digests over committed bytes (DF-026)

- **F2.1 Guard.** A test in `verify` fails if any text file under `docs/evidence/` contains a CR
  byte, naming each file. Binary files (by `.gitattributes` `binary`, and any file containing a NUL
  byte) are skipped.
- **F2.2 Worktree bytes.** The twelve Phases 0–3 artifacts in the worktree are returned to their
  committed LF bytes (the reverse of the 2026-09-25 byte copy). Nothing is committed for them.
- **F2.3 Re-record.** One owner-run `phase5:provenance:write` appends twelve re-records. The old
  digests stay in the ledger, as DF-023's did.
- **F2.4 On `main`, after the merge.** The main copy's twelve files are converted to LF in place,
  after checking each differs only by line endings. No provenance write is needed then: the ledger
  already holds the LF digests.

## F3 — Session-log redaction

- **F3.1** Parameters of every `account/*` and `remoteControl/*` notification are replaced by
  `{ "redacted": "identity" }`; the method, sequence and timing stay.
- **F3.2** In every string, the user-home prefix — matched with any mix of `/`, `\` and doubled
  `\\`, case-insensitively on Windows — becomes `~`.
- **F3.3** The header gains `redaction: "v1"`. Existing redaction (text keys, long strings, deltas)
  is unchanged.
- **F3.4** The held smoke log gets a redacted copy, produced by the same function, committed at its
  planned path with `redactedAfterCapture: true` in its header. The original stays in `.cuckcode/`.
- **F3.5** A test runs the redaction over a fixture shaped like the real smoke log — the PC name,
  an installation id, a plan type, rate limits, and single- and double-backslash home paths — and
  asserts none survives.

## F4 — Runner allowlist

- **F4.1** Add `check:toolchain`, `test:toolchain`, `test:protocol`, `protocol:codex:check`,
  `protocol:codex:drift` and `test:runtime`. `scripts/agent-runner.test.mjs` already checks every
  entry against `package.json` and the no-`CUCKCODE_*`, no-`--write`, no-install rules; each new entry
  must pass it unchanged.
- **F4.2** A commit's gate remains a full `verify` on a clean tree. README and HANDOFF say so beside
  the list.

## Verification

RED–GREEN for every behavioural requirement, container inner loop, runner `verify` on a clean tree
as each task's gate, as in `tasks/codex-currency-todo.md`. The owner runs F1.5 and F2.3.

## Decisions requested

| ID | Question | Recommendation |
| --- | --- | --- |
| FU-1 | Which default-on features does F1.1 keep? | Keep only those that change transport or protocol shape, not what the model can do: `content_item_kinds`, `enable_request_compression`, `system_proxy_fallback`, `fast_mode` (on during the passing smoke turn; turning it off would change the model's serving path), and `unbounded_connection_retries` (FU-2). Disable every other default-on feature. |
| FU-2 | Keep `unbounded_connection_retries`? | **Keep.** It is what lets Codex ride out a dropped connection, the original goal. Each retry is now recorded, and the 900 s hard cap bounds it. Turning it off would surface drops sooner and spend the one harness retry more often. |
| FU-3 | Where does F1.3's report land? The contract's `toolIds` means "the complete tool surface", with `null` for "not enumerated". Codex can enumerate MCP tools but not native ones, so filling `toolIds` would claim a completeness nobody observed. | **Keep `toolIds: null`** and add one field to the strict `RuntimeBindingReport` contract: `observedMcpServers: Array<{ name, status, toolNames }> | null`. The report then says exactly what was observed and no more. It is a contract change, touching contracts, the Codex binding and the persistence trust-store tests. |
| FU-4 | Where does F2's guard run? | In `test:ui-contract`, beside `evidence-immutability.test.mjs`, the existing evidence guard. |
