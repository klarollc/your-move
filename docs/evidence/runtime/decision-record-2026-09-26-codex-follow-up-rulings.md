# Codex currency follow-ups: four owner rulings

Date: 2026-09-26
Source: the owner's in-session answers to four decisions left open after Task 14 of
`tasks/codex-currency-todo.md`, each chosen as recommended.

| Item | Ruling | What it means |
| --- | --- | --- |
| DF-027 — default-on tool surface beside text-only roles | **Disable, report, prove.** | Every CuckCode session passes a `thread/start` `config` that turns off the pinned Codex's default-on tool features. The binding report records the tool surface Codex actually starts. The owner runs one authenticated probe with no model turn to prove `codex_apps` no longer starts. |
| DF-026 — ledger digests over working-copy CRLF bytes | **LF bytes, re-record, guard.** | The twelve Phases 0–3 artifacts in the main copy are converted to LF (content otherwise identical, checked), one owner-run `phase5:provenance:write` appends twelve re-records, and a test fails if any evidence file contains a CR byte. |
| Session-log identifiers | **Redact, then commit.** | Session logs drop the parameters of `account/*` and `remoteControl/*` notifications, keeping method and timing, and replace the user-home prefix in every string with `~`. Logs are committed as planned. The held smoke log gets a redacted copy committed; the original stays local. |
| Runner allowlist | **Add read-only checks.** | `check:toolchain`, `test:toolchain`, `test:protocol`, `protocol:codex:check`, `protocol:codex:drift` and `test:runtime` join the allowlist, each checked by the runner's own test. A commit's gate stays a full `verify` on a clean tree. |

## Facts established before ruling, with no provider call

- `codex features list` for the pinned 0.157.1 shows these enabled by default: `apps`, `shell_tool`,
  `unified_exec`, `browser_use`, `browser_use_external`, `browser_use_full_cdp_access`,
  `computer_use`, `image_generation`, `view_image`, `multi_agent`, `plugins`, `remote_plugin`,
  `skill_mcp_dependency_install`, `tool_suggest`, `sleep_tool`, among others. It also shows
  `unbounded_connection_retries` enabled, which bears on how long Codex keeps a failing connection
  alive before a turn fails.
- `codex -c features.apps=false -c features.browser_use=false features list` reports both off, so
  the overrides are accepted. `ThreadStartParams.config` accepts arbitrary keys.
- Without a credential, `codex_apps` does not start with or without the override, so its absence
  cannot be proved offline. That is why the ruling includes an authenticated, turn-free probe.
- `phase5:provenance` was already on the runner allowlist; an earlier statement that it was not was
  wrong.

## Authority

Rulings only. Per `AGENTS.md`, implementation follows a specification, a plan and a task list,
each approved separately. The recommended next artifact is one small specification covering all
four.
