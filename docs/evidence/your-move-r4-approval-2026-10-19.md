# Your Move R4 approval — 2026-10-19

Nate approved the R4 phase (lamp on hosted) on 2026-10-19.

Scope: port the T3/T4 lamp to the hosted architecture — utterance capture on
the hosted runner, live verdict feed over the hosted /api/events WebSocket,
triage UI against the hosted feed in the Lit Windows identity with the Paper
Boats unfold interaction. No redesign of the lamp itself.

Plus: (1) shared working context — work_materials stored on the draft revision
(pasted text, URLs, repo paths), injected into the execution system prompt as a
Materials section at run start, read-only to the agent; (2) owner triage for
parked runs — reply-and-resume and close-as-done, so a run never has zero
available actions; (3) provider auth — "Continue with ChatGPT" (Sign in with
ChatGPT, self-serve for open-source) as an alternative to the pasted API key
for the agent loop, plus an owner-provided Ollama endpoint for the lamp
classifier (preserves the v2 lock). Together: loop on the subscription, lamp
on Ollama, owner's marginal inference cost ~zero.

Scope boundaries (Nate): single-user self-deploy; keep the build
service-compatible (scriptable provisioning, painless updates); multi-user
stays open. No MCP-client adapter (the interface stays shaped for it); no new
agent tools; projection-only discipline holds (verdicts never enter the
canonical log).

Branch: feature/your-move-r4-lamp-hosted off main (7d3edc7).
Build: Hermes, from Cinder's R4 build brief (spike map first, then build brief).
Gate: Cinder conformance review before merge. Only Nate pushes to origin.

Amendment 2026-10-19 (Nate): the "Continue with ChatGPT" sign-in cannot complete on the hosted server — OpenAI requires the OAuth callback at the owner's localhost (http://127.0.0.1:<port>/auth/callback). Design changed to: `npm run siwc:login` on the owner's machine performs the sign-in; the hosted connect UI imports the credential (stored encrypted; the server refreshes tokens itself). In-use label follows OpenAI: "Using ChatGPT plan".
