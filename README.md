# Your Move

Your Move is a hosted workspace for managing AI-assisted work: create an outcome, guide an agent through execution, review evidence, and explicitly approve or redirect proposed changes.

The hosted application is served by the Railway-ready Fastify service in `apps/server`; browser surfaces are under `apps/web`. The internal workspace package identifiers remain `@cuckcode/*` for compatibility and are not product-facing names.

## Toolchain

Use Node.js `>=24.18.0 <25` and npm `>=11.16.0 <12`. Run `npm run check:toolchain` before project verification.

## Development

- `npm run dev:web` — start the web application.
- `npm run dev:server` — start the local server.
- `npm run verify` — run the complete repository gate.

## Hosted deployment

See [`docs/deployment/railway.md`](docs/deployment/railway.md) for the owner-managed Railway service configuration, required variables, persistence constraints, and deploy approval process. APP_ORIGIN must be the exact deployed HTTPS origin used by origin/CSRF validation. Never add live credentials to source control or deploy without owner approval.

## Product and design references

- [`docs/HANDOFF.md`](docs/HANDOFF.md) — current project status and gated next steps.
- [`docs/master-design-document-v0.1.md`](docs/master-design-document-v0.1.md) — historical office thesis and current amendments.
- [`.ui-craft/brief.md`](.ui-craft/brief.md) — product and design brief.
- [`.ui-craft/tokens.md`](.ui-craft/tokens.md) — design token decisions.
- [`AGENTS.md`](AGENTS.md) — implementation authority and verification rules.
