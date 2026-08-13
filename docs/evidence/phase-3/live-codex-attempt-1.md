# Live Codex Contract Attempt 1

Date: 2026-08-13
Command: `$env:CUCKCODE_LIVE_CODEX='1'; npm.cmd run test:live:codex`
Process: local direct-spawn Codex App Server stdio, installed version 0.146.0
Result: **Partial protocol pass; command failed cleanup**

Passed before cleanup:

- exact 0.146.0 initialize response;
- existing Codex-managed authentication present;
- ephemeral synthetic root with read-only sandbox and `approvalPolicy: never`;
- one bounded `thread/start` and `turn/start`;
- terminal thread/turn correlation and completed status;
- response marker `CUCKCODE_LIVE_OK`;
- no command, file-change, MCP, dynamic-tool, collaboration, web-search, or image-generation item;
- no unredacted credential-shaped stderr record.

Failure:

- Windows returned `EPERM` while deleting the temporary root immediately after shutdown.
- Vitest: 1 test failed at the cleanup line after 9.119 seconds.

Correction without another provider call:

- shutdown now waits for child exit, then uses bounded forced termination if necessary;
- temporary-root cleanup retries bounded handle release;
- 4 fake-process supervisor integration tests, opt-in skip, lint, and typecheck passed;
- the exact attempt root was removed afterward.

Disposition: Task 12 remains open. A second provider call requires explicit owner authorization because the approved live allowance was one attempt.