import { z } from "zod";

import { parseUtcTimestamp } from "./primitives.js";
import { validateWorkflowCoreEventPayload } from "./work-contract-events.js";

export const eventKinds = [
  "project.created",
  "work.created",
  "work.transitioned",
  "work.assigned",
  "work.released",
  "evidence.recorded",
  "posture.recorded",
  "approval.recorded",
  "work.turns_granted",
  "work.rescoped",
  "work.closed_incomplete",
  "work.ruling_recorded",
  "work.nudged",
  "work.nudge_suppressed",
  "ruling.withdrawn",
  "agent.registered",
  "agent.presence_changed",
  "role.assigned",
  "role.released",
  "role.offer_recorded",
  "role.response_recorded",
  "role.assignment_decided",
  "qualification.recorded",
  "knowledge.recorded",
  "knowledge.status_changed",
  "collaboration.recorded",
  "collaboration.closed",
  "handoff.recorded",
  "manager.feedback_recorded",
] as const;

export type EventKind = (typeof eventKinds)[number];

const timestampSchema = z.string().refine((value) => parseUtcTimestamp(value).ok);
const projectEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().regex(/^event_[A-Za-z0-9][A-Za-z0-9._-]*$/),
  projectId: z.string().regex(/^project_[A-Za-z0-9][A-Za-z0-9._-]*$/),
  workItemId: z
    .string()
    .regex(/^work_[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .optional(),
  roleAssignmentId: z
    .string()
    .regex(/^role-assignment_[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .optional(),
  providerRunId: z.string().min(1).optional(),
  kind: z.enum(eventKinds),
  occurredAt: timestampSchema,
  receivedAt: timestampSchema,
  source: z.enum(["manager", "adapter", "system", "reviewer"]),
  trust: z.enum(["verified", "reported", "inferred"]),
  payload: z.record(z.string(), z.unknown()),
});

export type ProjectEvent = z.infer<typeof projectEventSchema>;
export type EventParseError = {
  code: "MALFORMED_EVENT";
  reason: "unsupported_schema_version" | "unsupported_event_kind" | "invalid_envelope";
  details: string[];
};

export type EventParseResult =
  { ok: true; value: ProjectEvent } | { ok: false; error: EventParseError };

export function parseProjectEvent(input: unknown): EventParseResult {
  if (typeof input === "object" && input !== null) {
    const candidate = input as Record<string, unknown>;
    if (candidate.schemaVersion !== 1) {
      return malformed("unsupported_schema_version", ["schemaVersion must equal 1"]);
    }
    if (typeof candidate.kind !== "string" || !eventKinds.includes(candidate.kind as EventKind)) {
      return malformed("unsupported_event_kind", ["kind is not supported"]);
    }
  }

  const parsed = projectEventSchema.safeParse(input);
  if (!parsed.success) {
    return malformed(
      "invalid_envelope",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).sort(),
    );
  }
  const payload = validateWorkflowCoreEventPayload(parsed.data.kind, parsed.data.payload);
  if (!payload.ok) return malformed("invalid_envelope", payload.issues);
  return { ok: true, value: parsed.data };
}

function malformed(reason: EventParseError["reason"], details: string[]): EventParseResult {
  return { ok: false, error: { code: "MALFORMED_EVENT", reason, details } };
}
