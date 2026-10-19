# Your Move UI revision — design record (2026-10-19)

## Approval and scope

This record implements the owner-supplied **Your Move UI revision — implementation brief (2026-10-19)**. It applies only to the hosted Your Move work surface and Connections page. It supersedes the R4 Lit Windows and R3-era provider-page presentation on those surfaces; it does not replace project-wide art direction or authorize unrelated work.

This is a presentation revision. Do not change the backend, API contracts, agent loop, tools, credential handling, persistence, provider semantics, or canonical state. Preserve the existing R4 reply-and-resume, close-as-done, proposal decisions, work materials, live lamp feed, and no-zero-actions behavior.

The approved written design source is the local package `output/your-move-design-2026-10-19-v3/`. Its prose specifications govern; generated images are conceptual references, not pixel evidence. The package is local-only and remains excluded from Git.

## Palette decision — sage/oat daylight

The owner's October 19 decision selects sage/oat daylight, not Midnight or ivory. These surface tokens are authoritative for this revision:

| Role | Value |
| --- | --- |
| canvas | `#CAD3C4` |
| canvas-text / paper-text | `#27352F` |
| canvas-muted / paper-muted | `#4E5C51` |
| paper | `#E3D3B5` |
| paper-rule | `#A99B80` |
| architecture fill | `#B9C5B2` |
| architecture linework | `#34483E` |
| window-lit | `#DDA64C` |
| window-frame | `#70501E` |
| window-unused | `#A9B6A2` |
| editorial accent / active nav / focus | `#234AC4` |
| selected row | `#D5C5A8` |
| input boundary | `#6B715E` |

Shared rules: no construction lines; optional 1–2% grain only away from text; paper fold at most 16px; spacing 4/8/12/16/24/32/48/64px; minimum 44×44px targets; 2px focus outlines; 0–2px corners; no pill containers.

Typography candidates are Literata 500 for brand/headings/sheet headings and Commissioner 400/500/600 for body, controls, and metadata. Package licensed font assets and verify the rendered faces before adopting them; do not silently fall back to system fonts. If sourcing or licensing blocks either face, document the verified substitute and reason.

## Work surface and window truthfulness

The paper queue is the source of truth; the townhouse illustration is redundant. One lit window represents one distinct work item with an explicitly recorded unresolved owner action. Never light a window for an agent, classifier verdict, or execution progress. Multiple unresolved requests on one item still produce one light. Questions, permission requests, and reviews qualify only when recorded. Waiting on another agent or provider does not qualify without an owner action.

Use the recorded request time, oldest first; stable work ID breaks ties. Undated requests follow dated requests, ordered by ID. A house is a credible three-storey townhouse with exactly five addressable work windows: two upper, two middle, and one ground-floor window beside a paneled door. Within a house the order is upper-left, upper-right, middle-left, middle-right, ground-left; houses read left-to-right. Slot position is not identity: every lit window resolves to a stable work ID. Dark windows are unused capacity, never completed work.

Build the townhouse as a hand-crafted SVG with individually addressable windows; do not use a generated PNG as a background or overlay. Confirmed state updates change the text and semantic indicator together, immediately and without animated reordering. Unknown or stale data must neutralize amber and say “Status unavailable”; it must not be represented as zero.

Street paging shows at most three complete houses / 15 windows per page. The list queue has 10 rows per page, independently paged, and shares the same owner-action items, ordering, stable selection, and detail panel with Street. Required density states: zero waiting items (one unlit house and “Nothing needs you”), five (one house), fifteen (three houses), and thirty (six houses across two street pages; queue pages independently). Opening a window and the row's Open action resolve to the same item. Enter and Space work; focus reveals the title and requested action with an outline, never extra brightness. Opening does not approve or acknowledge work.

Keep the paper detail beside the work surface, never in a modal. Preserve the existing R4 actions and live lamp feed; lamp verdicts remain separate from window lighting. If an open item resolves, retain its detail and updated state until the owner closes it. Restore focus to the originating window or row on return, or to the queue heading if it no longer exists. Live updates never steal focus.

## Connections

Use a left directory and one selected configuration sheet. Directory groups: **Work providers** (Anthropic; OpenAI / ChatGPT plan) and **Lamp service** (Ollama). Selecting an entry replaces the one sheet; it must not append another form. Preserve the existing API-key validation, ChatGPT plan import/activation, and Ollama endpoint plus optional bearer-token flows exactly as they are. Never reveal saved secrets or fabricate masked suffixes, endpoints, or timestamps.

Keep the existing GitHub repository-tool connection reachable in a separate **Repository tools** directory group so the presentation change does not remove an existing connection flow. Do not alter its backend or credential semantics.

## Motion and evidence

Entrance motion is at most 300ms and runs only on initial document entry. The paper-open transition is restrained and state-explanatory; live work/provider/lamp updates, polling, and route/navigation changes do not replay entrances or animate semantic state. Reduced motion renders the final arrangement immediately with zero animation/transition duration and preserves focus/selection visibility.

Capture the implemented 1440px and 1280px states in `docs/evidence/`. Verify Street/List density and independent paging, correct window-to-item mapping, keyboard open/return, preserved R4 actions/feed, all connection flows, reduced motion, and clean browser console/network behavior. A passing test or conceptual PNG is not visual evidence.

## Data boundary

The existing hosted response already includes execution `createdAt` / `updatedAt` and proposal `createdAt`; the frontend may consume these existing fields to order recorded owner actions. Do not add a route, response field, database column, or state transition for this UI revision.
