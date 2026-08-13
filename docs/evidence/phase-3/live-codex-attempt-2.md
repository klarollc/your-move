# Live Codex Contract Attempt 2

Date: 2026-08-13
Command: `$env:CUCKCODE_LIVE_CODEX='1'; npm.cmd run test:live:codex`
Process: local direct-spawn Codex App Server stdio, installed version 0.146.0
Result: **PASS**

Owner authorization:

- exactly one corrective rerun;
- same bounded, read-only conditions as attempt 1;
- no task tools, connectors, subagents, approvals, or external effects.

Verified:

- exact 0.146.0 initialize response;
- existing Codex-managed authentication present;
- ephemeral synthetic root with read-only sandbox and `approvalPolicy: never`;
- one bounded `thread/start` and `turn/start`;
- terminal thread/turn correlation and completed status;
- response marker `CUCKCODE_LIVE_OK`;
- no command, file-change, MCP, dynamic-tool, collaboration, web-search, or image-generation item;
- no unredacted credential-shaped stderr record;
- graceful/bounded supervisor shutdown and successful temporary-root cleanup.

Machine result: 1 test file passed, 1 test passed, exit code 0. Vitest duration 11.87 seconds; test duration 11.51 seconds.

Disposition: Task 12 complete. This passing result does not establish UI, visual QA, production readiness, or Phase 4 scope.