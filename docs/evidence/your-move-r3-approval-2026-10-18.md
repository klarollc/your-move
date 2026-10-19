# Your Move R3 approval — 2026-10-18

Nate approved the R3 phase (live execution loop) on 2026-10-18, including the
amended scope: R3 ships a v1 tool suite (read-only web fetch, GitHub read,
GitHub propose-write with lamp-gated server-side apply). This supersedes the
earlier tool-less v1 scope.

Scope boundaries (Nate): no shell, local-file, or code-execution tools; no
MCP-client adapter (interface shaped for it; adapter later); no Gmail or other
send-capable integrations (named next); hosted /api/events WebSocket deferred
to R4; lamp verdicts and utterance capture deferred to R4.

Branch: feature/your-move-r3-live-execution off main (edefd23).
Build: Hermes, from Cinder's R3 build brief v3.
Gate: Cinder conformance review before merge. Only Nate pushes to origin.
