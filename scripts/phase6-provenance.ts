/**
 * The provenance and originality register for the three Phase 6 candidates.
 *
 * The brief requires, for every reference: source URL or file, creator where known, licence or
 * usage basis, retrieval date, and the specific abstract quality referenced. It also forbids two
 * things by name — imitating a named living artist, and reproducing a commercial product's
 * distinctive visual identity.
 *
 * This register is small, and that is the finding rather than a shortcut. The candidates were
 * derived entirely from the project's own approved documents and from geometry authored in-tree.
 * No architectural, material, ergonomic, photographic or historical reference was consulted, even
 * though the brief permits them. That is maximal originality and minimal research at the same time,
 * and §gaps records it as an open question for the owner rather than letting an empty external
 * section read as a clean bill of health.
 */

export const CANDIDATE_IDS = [
  "candidate-a-architectural-clarity",
  "candidate-b-human-studio-warmth",
  "candidate-c-miniature-craft-precision",
] as const;

export type ProvenanceReference = {
  id: string;
  kind: "in-tree" | "external-normative" | "typeface-by-name";
  source: string;
  creator: string;
  licenceBasis: string;
  retrievedAt: string;
  qualityReferenced: string;
  appliesTo: string[];
  /**
   * Typeface references only. Naming a family in a stack distributes nothing, but the distinction
   * has to be a field rather than a sentence: a guard that greps prose passes on whatever phrasing
   * it happens to be given.
   */
  embedding?: {
    embeddedInRepository: false;
    redistributed: false;
    embeddingWouldRequireLicenceReview: boolean;
  };
};

const ALL = [...CANDIDATE_IDS];
const REVIEWED = "2026-09-13";

export const PROVENANCE_REFERENCES: ProvenanceReference[] = [
  {
    id: "visual-reference-brief",
    kind: "in-tree",
    source: "docs/visual-reference-production-brief-v0.1.md",
    creator: "CuckCode project owner, approved as written 2026-09-13",
    licenceBasis: "Project-internal artifact. No third-party licence applies.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "Visual thesis, the three comparative emphases, the controlled comparison frame, the twelve-item candidate board, the avatar contract, and the review rubric.",
    appliesTo: ALL,
  },
  {
    id: "ui-craft-tokens",
    kind: "in-tree",
    source: ".ui-craft/tokens.md",
    creator: "CuckCode project owner",
    licenceBasis: "Project-internal artifact. No third-party licence applies.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "Material family (light wood, off-white plaster, charcoal metal, muted textile, restrained greenery), the single reserved amber accent and its prohibitions, motion durations and easing character, and the WCAG 2.2 AA contrast floor.",
    appliesTo: ALL,
  },
  {
    id: "ui-craft-brief",
    kind: "in-tree",
    source: ".ui-craft/brief.md",
    creator: "CuckCode project owner",
    licenceBasis: "Project-internal artifact. No third-party licence applies.",
    retrievedAt: REVIEWED,
    qualityReferenced: "Product and design intent: office before dashboard, calm over spectacle.",
    appliesTo: ALL,
  },
  {
    id: "master-design-document",
    kind: "in-tree",
    source: "docs/master-design-document-v0.1.md",
    creator: "CuckCode project owner",
    licenceBasis: "Project-internal artifact. No third-party licence applies.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "D-02 approved spatial model and required functional zones, D-08 visual thesis, D-21 graybox-to-fidelity gate, D-22 reference-board candidate process, and the truthfulness invariant that forbids motion without canonical state.",
    appliesTo: ALL,
  },
  {
    id: "comparison-geometry",
    kind: "in-tree",
    source: "scripts/phase6-candidate-geometry.ts",
    creator: "Authored in-tree for this project, 2026-09-13",
    licenceBasis: "Original work in this repository. No third-party licence applies.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "Fixed three-quarter isometric camera, floor plan, zone rectangles, agent placement, prop list, and painter's-algorithm depth ordering — shared unchanged by all three candidates.",
    appliesTo: ALL,
  },
  {
    id: "frozen-comparison-fixture",
    kind: "in-tree",
    source: "docs/evidence/phase-6/comparison-fixture.json",
    creator: "Authored in-tree for this project, 2026-09-13",
    licenceBasis: "Original work in this repository. No third-party licence applies.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "The canonical state every candidate renders: six connected agents, one active priority, no escalation, and the declared view state.",
    appliesTo: ALL,
  },
  {
    id: "wcag-22",
    kind: "external-normative",
    source: "https://www.w3.org/TR/WCAG22/",
    creator: "World Wide Web Consortium (W3C)",
    licenceBasis:
      "W3C Document License. Cited as a normative standard; no text or asset is copied into this repository.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "Relative-luminance formula, SC 1.4.3 contrast minimum of 4.5:1 for text, and SC 1.4.11 non-text contrast minimum of 3:1 for the graphical attention marker.",
    appliesTo: ALL,
  },
  {
    id: "typeface-display-stack",
    kind: "typeface-by-name",
    source:
      "CSS font stack in scripts/phase6-candidate-styles.ts: Iowan Old Style, Palatino Linotype, Segoe UI, system-ui",
    creator:
      "Iowan Old Style — John Downer for Bitstream; Palatino Linotype — Hermann Zapf for Linotype; Segoe UI — Steve Matteson for Microsoft",
    licenceBasis:
      "Referenced by family name only and resolved from the viewer's installed fonts. No font file is embedded, converted or redistributed by this repository, so no font licence is exercised. Embedding any of these in Phase 7 would require a separate licence review.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "Warm humanist letterforms for management language, per the approved typography direction. The stack ends in system-ui so no single proprietary face is required for the candidate to read correctly.",
    appliesTo: ALL,
    embedding: {
      embeddedInRepository: false,
      redistributed: false,
      embeddingWouldRequireLicenceReview: true,
    },
  },
  {
    id: "typeface-mono-stack",
    kind: "typeface-by-name",
    source:
      "CSS font stack in scripts/phase6-candidate-styles.ts: Cascadia Mono, Consolas, SF Mono, ui-monospace",
    creator:
      "Cascadia Mono — Aaron Bell for Microsoft; Consolas — Luc(as) de Groot for Microsoft; SF Mono — Apple",
    licenceBasis:
      "Referenced by family name only and resolved from the viewer's installed fonts; not embedded or redistributed. Cascadia Mono is additionally available under the SIL Open Font License 1.1, which would permit embedding if Phase 7 needs it; the other two would not.",
    retrievedAt: REVIEWED,
    qualityReferenced:
      "Restrained monospace for technical evidence and identifiers only, never for management language.",
    appliesTo: ALL,
    embedding: {
      embeddedInRepository: false,
      redistributed: false,
      embeddingWouldRequireLicenceReview: true,
    },
  },
];

export const ORIGINALITY = {
  imitatesNamedLivingArtist: false,
  reproducesCommercialVisualIdentity: false,
  attestation:
    "Every mark in all three candidates is generated by code authored in this repository from the project's own approved documents. No image was traced, sampled, generated by a model, or copied from any external source; no external asset is fetched at build time, and the only external URL in the candidate sources is the SVG XML namespace. No named living artist's style was sought or imitated, and no commercial product's distinctive visual identity — palette, iconography, layout signature or avatar system — was reproduced. The isometric projection is standard trigonometry and carries no authorship claim.",
};

export const PROVENANCE_GAPS = [
  {
    id: "no-external-visual-reference",
    finding:
      "Zero architectural, material, ergonomic, photographic or historical references were consulted, although the brief expressly permits them to establish general qualities. The candidates are original because nothing external informed them, which is not the same as being well researched.",
    disposition:
      "Recorded as open for the owner at Task 8. It does not block Tasks 2-4, whose acceptance is the twelve board deliverables against the frozen frame. If the owner wants a candidate grounded in observed studio architecture or real material behaviour, that is a bounded addition to the selected candidate in Task 9, not a reason to reject the set.",
  },
  {
    id: "generated-half-unexercised",
    finding:
      "Decision 6-C approved a hybrid medium, but no generated raster exploration was produced. Each manifest records generatedExploration as null rather than implying coverage.",
    disposition:
      "Open. An image model cannot render six specific agents at declared work areas with one active work item, so the generated half can only ever supply material and mood plates, never board item 1. The owner may decide the remaining value does not justify the provenance burden, since generated assets are the one category whose training provenance this register cannot enumerate.",
  },
  {
    id: "typeface-embedding-deferred",
    finding:
      "Two of the six named typefaces are proprietary system faces that cannot be embedded. Today this costs nothing, because the candidates only name them in a fallback stack.",
    disposition:
      "Deferred to Phase 7 with a named trigger: the moment any candidate's type is embedded rather than system-resolved, a licence review is required. Cascadia Mono under SIL OFL 1.1 is the only named face that would survive that review unchanged.",
  },
];
