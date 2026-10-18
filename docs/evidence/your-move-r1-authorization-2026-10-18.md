# Owner authorization — Your Move R1

**Date:** 2026-10-18
**Status:** Approved for R1 implementation only.

The owner instructed “R1 build” against the R1 section of the Your Move redesign plan. After the attached plan revealed its draft/no-build header, the owner explicitly confirmed that the earlier directive is approval for R1 only and authorized the necessary design/position-record updates before implementation.

## Approved scope

- Railway-ready hosted Fastify server and a minimal provider-management surface.
- OpenAI and Anthropic only; Hermes is excluded.
- Connect by entering a key; validate with the provider before persisting.
- Encrypt keys at rest; never return keys through API/UI.
- Immediate disconnect; reconnect updates credentials without resetting model preference or unrelated work state.
- Automatic model choice by default and a specific-model override.
- Explicit `needs_reauth` state after a provider rejects a stored key, with reconnect requiring opening the reconnect form and submitting a replacement key.
- Single-owner authentication for the public service; this is not multi-user support.
- Use mock HTTP-boundary success tests and invalid dummy keys for rejection tests. Do not use real provider credentials.

## Exclusions and external-effect boundary

No Hermes provider, multi-user support, billing, local-loopback behavior changes, lamp/T3/T4 changes, canonical event-log changes, R2–R5 implementation, Railway account/API actions, repository push, or deployment. The supplied Railway project ID is `265f5b22-b4c3-46ae-90b0-32fec7893e04`.

OpenAI ChatGPT-plan OAuth is not enabled for this Railway build: the current official guide is for open-source and locally hosted apps and directs remotely hosted apps to an interest request. No eligibility or client approval was supplied. The allowed paste-key fallback is therefore used; Anthropic likewise uses its API-key connection path. See the deployment guide for the recorded integration choice.
