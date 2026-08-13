# CuckCode design tokens

Status: **Direction approved; numeric values and promotion remain unapproved**

The project has an approved material and palette direction, but no approved numeric token values. Do not silently default to blue, Inter, rounded cards, glassmorphism, a dark neon interface, or a generic dashboard system.

Approved direction:

- neutral-dominant warm matte office;
- light wood, off-white plaster, charcoal metal, muted textiles, and restrained greenery;
- one warm amber primary accent reserved for manager attention, focus, and primary action;
- role identity and workflow severity must not reuse the amber accent as decoration;
- warm humanist sans-serif for management language;
- restrained monospace only for technical evidence and syntax;
- motion durations: feedback 100–150 ms, small surfaces 150–200 ms, inspectors/modals 200–300 ms;
- calm non-bouncy scene easing, faster exits, deterministic clocks, and no travel/parallax/ambient loops in reduced-motion mode;
- fixed soft-daylight scene lighting, subordinate warm practicals, restrained contact shadows, and no status-dependent global lighting.

## Required token layers after art-direction approval

1. **Primitive:** neutral ramp, one primary accent, semantic colors, type families and scale, spacing, radii, shadows, motion durations, easing curves, z-depth.
2. **Semantic:** scene ground, room surface, furniture, avatar, focus, selection, attention, blocked, waiting, active, complete, failed, offline, evidence, approval.
3. **Component:** office object, avatar marker, conversation cue, manager request, artifact tray, inspector, modal, button, input, focus ring, tooltip.

## Constraints already approved

- Status cannot rely on color alone.
- Accent is reserved for focus, selection, and manager attention; it cannot decorate every active agent.
- Semantic severity colors cannot be used as division/role branding.
- Motion must distinguish state change from ambient life.
- Reduced-motion mode must preserve state comprehension without avatar travel animations.
- Typography and contrast must support WCAG 2.2 AA at minimum; final perceptual contrast targets will be defined with the approved palette.

