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
  "work.question_asked",
  "work.rescope_proposed",
  "work.rescope_declined",
  "work.send_back_disputed",
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
const actorSchema = z.discriminatedUnion("actorType", [
  z.object({
    actorType: z.literal("manager"),
    actorId: z.string().regex(/^manager_[A-Za-z0-9][A-Za-z0-9._-]*$/),
  }),
  z.object({
    actorType: z.literal("agent"),
    actorId: z.string().regex(/^agent_[A-Za-z0-9][A-Za-z0-9._-]*$/),
  }),
]);
const projectEventSchema = z
  .object({
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
    actor: actorSchema.optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .superRefine((event, context) => {
    const agentSpeechAct =
      event.kind === "work.question_asked" ||
      event.kind === "work.rescope_proposed" ||
      event.kind === "work.send_back_disputed";
    const linkedApproval = event.kind === "work.rescoped" && event.payload.proposalId !== undefined;
    const managerSpeechAct = event.kind === "work.rescope_declined" || linkedApproval;

    if (agentSpeechAct) {
      if (event.actor?.actorType !== "agent") {
        context.addIssue({
          code: "custom",
          path: ["actor"],
          message: "agent attribution is required",
        });
      }
      if (event.source !== "adapter" || event.trust !== "reported") {
        context.addIssue({
          code: "custom",
          path: ["source"],
          message: "agent speech acts are reported adapter content",
        });
      }
      if (!event.roleAssignmentId) {
        context.addIssue({
          code: "custom",
          path: ["roleAssignmentId"],
          message: "agent speech acts require their role assignment",
        });
      }
    }

    if (managerSpeechAct) {
      if (event.actor?.actorType !== "manager") {
        context.addIssue({
          code: "custom",
          path: ["actor"],
          message: "manager attribution is required",
        });
      }
      if (event.source !== "manager" || event.trust !== "verified") {
        context.addIssue({
          code: "custom",
          path: ["source"],
          message: "manager decisions require verified manager source",
        });
      }
    }

    if ((agentSpeechAct || managerSpeechAct) && event.payload.workItemId !== event.workItemId) {
      context.addIssue({
        code: "custom",
        path: ["payload", "workItemId"],
        message: "payload workItemId must match the event envelope",
      });
    }
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
