# Railway deployment — R1

This deploys only the hosted Fastify entry point in `apps/server`. It does not change the local-loopback launcher. The owner supplied Railway project ID `265f5b22-b4c3-46ae-90b0-32fec7893e04`; no Railway account, project, variables, domain, or deployment was modified by this build.

## Git-push deployment

1. In the supplied Railway project, create/connect a service to the repository and the feature branch `feature/your-move-r1-hosted-providers` for verification. Keep the service build root at the repository root; Railway detects and uses the root `Dockerfile`. Enable GitHub-triggered deployments only when the owner is ready; a Git push is not itself approval to deploy.
2. Attach a Railway Volume to the service at `/data`. Keep one replica: the R1 SQLite vault uses a single persistent volume.
3. Set the required service variables below. Generate the public domain, then set `APP_ORIGIN` to that exact HTTPS origin.
4. Configure Railway's healthcheck path as `/health` and expose the service with a Railway-generated or custom HTTPS domain.
5. After the owner connects the repo, enables/approves GitHub deployments, and explicitly approves a deployment, pushes to the selected branch build with the root Dockerfile. Railway may queue a deployment for owner approval when the person pushing the repository is not linked to the Railway account.

The root Dockerfile is the deploy configuration. No `railway.json` is added: Railway currently marks Config as Code deprecated, with existing legacy files scheduled to stop working after 2026-12-01. Keep volume, healthcheck, domain, environment variables, and deploy approvals in the owner-managed service settings unless the project later migrates to Railway's Infrastructure as Code workflow.

Railway injects `PORT`; the hosted server binds to `0.0.0.0:$PORT`. The attached volume provides `RAILWAY_VOLUME_MOUNT_PATH`; the app stores only encrypted provider credentials and model preferences under that mount. Railway mounts volumes as root. This Dockerfile leaves the runtime user at root so it can write to `/data`; if the image later switches to a non-root user, explicitly configure and verify Railway's volume UID handling before deployment.

## Required runtime variables

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact public HTTPS origin, e.g. `https://<railway-domain>`; used for same-origin/CSRF checks. |
| `APP_ACCESS_PASSWORD` | Single owner's login password; store only in Railway Variables, never source control. |
| `SESSION_SIGNING_KEY` | Random, persistent secret used to sign the HttpOnly session cookie. |
| `CREDENTIAL_ENCRYPTION_KEY` | Random 32-byte base64 key for AES-256-GCM encryption of provider keys. Preserve it across redeploys/backups or stored credentials cannot be decrypted. |
| `RAILWAY_VOLUME_MOUNT_PATH` | Automatically injected when the `/data` volume is attached; required in hosted production. |
| `PORT` | Automatically injected by Railway; the app reads it at startup. |

Generate unique secrets locally, then paste them directly into Railway's variable UI; never put their values into chat, source, logs, or this document. Example commands (run locally, not in a tracked file):

```sh
openssl rand -base64 32  # SESSION_SIGNING_KEY
openssl rand -base64 32  # CREDENTIAL_ENCRYPTION_KEY
openssl rand -base64 32  # APP_ACCESS_PASSWORD (use a password manager)
```

Provider keys are entered through the authenticated UI; do not set them as Railway variables. Provider validation uses each provider's documented model-list endpoint before connection is saved. OpenAI's ChatGPT-plan OAuth is not used for this remotely hosted service absent OpenAI's separate eligibility approval; R1 uses the approved paste-key fallback.

## Persistence and operations

- Do not run more than one replica with the R1 SQLite volume.
- Keep the volume and `CREDENTIAL_ENCRYPTION_KEY` together in the backup/restore plan. A volume backup without the encryption key cannot recover credentials; the key without its volume cannot recover the connection state.
- `/health` is a readiness endpoint and does not disclose provider state or secrets.
- The connection UI exposes only `disconnected`, `connected`, or `needs reauth`; it never returns a key, prefix, suffix, ciphertext, or encryption metadata.
- No production provider credentials, Railway variables, or deployment are part of automated tests.
