import type { OfficeRegistryEntry } from "@cuckcode/application";

/**
 * Who and where the office shows: ids, labels, relationships and each person's agent id. Layout
 * only. Nothing here states what anyone is doing; that comes from the canonical log through
 * `projectOfficeReadModel` (Phase 7-O spec §4).
 */
export const OFFICE_REGISTRY: readonly OfficeRegistryEntry[] = Object.freeze([
  { entityId: "zone_reception", kind: "zone", label: "Reception" },
  { entityId: "zone_team", kind: "zone", label: "Team work area" },
  {
    entityId: "agent_delivery_lead",
    kind: "person",
    label: "Delivery Lead",
    agentId: "agent_delivery_lead",
    relationship: "Coordinates the office team",
  },
  {
    entityId: "agent_product_designer",
    kind: "person",
    label: "Product Designer",
    agentId: "agent_product_designer",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_implementation_engineer",
    kind: "person",
    label: "Implementation Engineer",
    agentId: "agent_implementation_engineer",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_test_engineer",
    kind: "person",
    label: "Test Engineer",
    agentId: "agent_test_engineer",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_visual_qa_reviewer",
    kind: "person",
    label: "Visual QA Reviewer",
    agentId: "agent_visual_qa_reviewer",
    relationship: "Reports to Delivery Lead",
  },
  {
    entityId: "agent_release_reviewer",
    kind: "person",
    label: "Release Reviewer",
    agentId: "agent_release_reviewer",
    relationship: "Reports to Delivery Lead",
  },
  { entityId: "zone_library", kind: "zone", label: "Project Library" },
  { entityId: "zone_collaboration", kind: "zone", label: "Collaboration table" },
  { entityId: "zone_review", kind: "zone", label: "Review station" },
  { entityId: "zone_manager", kind: "zone", label: "Manager desk" },
  { entityId: "zone_delivery", kind: "zone", label: "Delivery area" },
]);
