# Codex currency follow-ups: rulings made while building Tasks 4 to 6

Date: 2026-09-27 (the first ruling was given 2026-09-26)
Source: the owner's in-session answers, each chosen as recommended, during follow-up Tasks 4 and 6
of `tasks/codex-follow-ups-todo.md`. They supplement, and do not change, the four rulings in
`decision-record-2026-09-26-codex-follow-up-rulings.md`.

| Item | Ruling | What it means |
| --- | --- | --- |
| `secret_auth_storage` — default-on for win32-x64 only in 0.157.1, and not on FU-1's keep list | **Disable; prove with the probe.** (2026-09-26) | FU-1 applies as ruled: the feature is off in every session. A failure to see the login reopens it as a keep. |
| `features.json` differs by platform | **Record the platform.** (2026-09-26) | `features.json` names the binary it describes (`win32-x64`); the owner reran the upgrade once to write it. |
| The probe record's 427 `codex_apps` tool names show which apps the account has connected | **Hold; commit a redacted copy, counts only.** | The committed record keeps each server's name and status, its tool count and its connector count. The capture with names stays in `.cuckcode/held-session-logs/run-codex-probe-surface/`. A first option that kept counts per connector was withdrawn before the ruling because it still named the connectors. |
| `secret_auth_storage` after the probe | **Leave open until the next real turn.** | The probe cannot settle it: `account/read` runs once per process, before any thread applies the policy. The next turn under the policy (smoke, kickoff or exercise) settles it; an authentication failure there reopens it as a keep. |

## Erratum to the follow-ups specification

`docs/codex-follow-ups-spec-v0.1.md` counts "52 default-on in all" and 43 not `removed`. Both were
counted on the linux-x64 binary in the container mirror. The pinned binary on the owner's platform
(win32-x64) reports 53 default-on; the difference is `secret_auth_storage`.

## Authority

Rulings only, inside the approved follow-ups specification, plan and task list.
