# Your Move design decisions (historical office surface)

## 2026-08-13 — Phase 4 graybox office measurements

Status: **Approved for graybox renderer implementation only; not art tokens or high-fidelity direction**

The controlled 1440×900 and 1280×800 trials select these deterministic measurements:

- fixed 2:1 isometric projection: 64×32 CSS-pixel base tile, 24-pixel elevation step;
- authored office footprint: 18×12 grid units with 128 projected pixels reserved above the floor for objects;
- functional footprints: reception `(0.5,1,3,3)`, team `(4,1,13.5,4)`, library `(1,6,4,3)`, collaboration `(6,6,5,3)`, review `(12,6,4.5,3)`, manager `(1,10,6,2)`, delivery `(13,10,4,2)`;
- role anchors: Delivery Lead `(4.75,2.5)`, Product Designer `(7.25,2.5)`, Implementation Engineer `(9.75,2.5)`, Test Engineer `(12.25,2.5)`, Visual QA Reviewer `(14.75,2.5)`, Release Reviewer `(17.25,2.5)`;
- project bar 56px, attention rail 280px, inspector 320px, scene padding 24px;
- discrete zoom stops: `0.625`, `0.75`, `0.875`, `1`, `1.125`, `1.25`;
- canonical reset zooms: 1.25 at 1440×900 and 1.125 at 1280×800; both-overlay zooms: 0.75 and 0.625 respectively;
- pan clamps retain a 96px recoverable office edge; reset rotation is always zero;
- minimum interaction region: 44×44 CSS pixels;
- deterministic cutaway candidate: occluders at least 64px high reveal to alpha 0.16 only for selected or attention-critical content.

Rationale: the 2:1 projection and footprint keep all seven authored regions and six roles visible at both approved viewports, including the worst-case 680×744 scene remaining after both overlays at 1280×800. Compact role codes at anchors plus full names in the DOM outline avoid label collisions without hiding identity.

These values are layout policy. They do not approve palette, typography, material, lighting, avatar, prop, motion, or final asset-scale tokens. The V1 graybox collision between the team-zone label and central role anchors was corrected before sign-off by moving zone labels to the upper interior edge.
