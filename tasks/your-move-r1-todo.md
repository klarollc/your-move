# Your Move R1 — Hosted foundation + provider connections

Authority: `docs/your-move-redesign-build-plan-2026-10-18.md` and owner authorization `docs/evidence/your-move-r1-authorization-2026-10-18.md`. R1 only; R2–R5 remain unapproved.

- [ ] Task 1 — Create a hosted-only Fastify entry point without changing local-loopback behavior.
- [ ] Task 2 — Protect the public provider-management API with the single-owner session boundary.
- [ ] Task 3 — Persist provider connections separately from the canonical event log; encrypt credential material at rest.
- [ ] Task 4 — Validate OpenAI keys at connect time and expose provider model IDs without exposing credentials.
- [ ] Task 5 — Validate Anthropic keys at connect time and expose provider model IDs without exposing credentials.
- [ ] Task 6 — Implement immediate disconnect, needs-reauth, and reconnect that preserves model preference and unrelated work state.
- [ ] Task 7 — Add the minimal provider/model-selection UI: automatic by default, specific model override.
- [ ] Task 8 — Add the Railway Docker build/health endpoint and document required environment variables and one-time project settings.
- [ ] Task 9 — Verify invalid-key failure paths, HTTP-mocked success paths, secret non-disclosure, and lifecycle/model persistence.
- [ ] Task 10 — Run focused and regression checks; audit the final diff against R1 exclusions.
