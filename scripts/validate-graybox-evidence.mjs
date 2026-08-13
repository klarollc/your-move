const requiredKeys = [
  "schemaVersion",
  "phase",
  "evidenceClass",
  "fidelity",
  "promotionStatus",
  "ownerDecision",
  "fixtureId",
  "viewport",
];
const allowedKeys = new Set(requiredKeys);

export function validateGrayboxEvidenceManifest(input) {
  if (!isRecord(input) || Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return invalid("GRAYBOX_MANIFEST_INVALID");
  }
  if (requiredKeys.some((key) => !(key in input))) return invalid("GRAYBOX_MANIFEST_INVALID");
  if (
    input.promotionStatus === "active" ||
    input.fidelity === "high_fidelity" ||
    input.evidenceClass === "golden_state" ||
    input.ownerDecision === "art_direction_approved"
  ) {
    return invalid("GRAYBOX_PROMOTION_FORBIDDEN");
  }
  if (
    input.schemaVersion !== 1 ||
    input.phase !== 4 ||
    input.evidenceClass !== "rendered_graybox" ||
    input.fidelity !== "graybox" ||
    input.promotionStatus !== "candidate" ||
    input.ownerDecision !== "pending_graybox_review" ||
    typeof input.fixtureId !== "string" ||
    input.fixtureId.length === 0 ||
    !validViewport(input.viewport)
  ) {
    return invalid("GRAYBOX_MANIFEST_INVALID");
  }
  return { ok: true, value: input };
}

function validViewport(value) {
  return (
    isRecord(value) &&
    Number.isInteger(value.width) &&
    value.width > 0 &&
    Number.isInteger(value.height) &&
    value.height > 0 &&
    value.deviceScaleFactor === 1 &&
    Object.keys(value).every((key) => ["width", "height", "deviceScaleFactor"].includes(key))
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(code) {
  return { ok: false, code };
}
