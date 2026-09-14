import { describe, expect, it } from "vitest";

import { reduceKnowledgeTruth } from "./knowledge-truth.js";
import {
  detectKnowledgeConflicts,
  openKnowledgeConflicts,
  retrieveKnowledge,
} from "./knowledge-retrieval.js";

/**
 * Phase 5 Task 8 — the retrieval and conflict half of MDD section 15.
 *
 * The contribution half already existed: agent findings enter provisional, manager transitions are
 * authorized, supersession names its replacement. What did not exist is the part the Phase 5 gate
 * actually names — retrieval that reports what it left out, and conflicts that are surfaced rather
 * than merged. A retrieval that silently drops a rejected record and returns the survivor is
 * indistinguishable, to its reader, from a project where the rejected record never existed.
 */

const event = (
  eventId: string,
  kind: string,
  payload: Record<string, unknown>,
  source: "manager" | "adapter" | "system" | "reviewer" = "adapter",
) => ({
  schemaVersion: 1,
  eventId,
  projectId: "project_cuckcode",
  kind,
  occurredAt: `2026-09-14T09:00:${eventId.slice(-2)}.000Z`,
  receivedAt: `2026-09-14T09:00:${eventId.slice(-2)}.000Z`,
  source,
  trust: "verified",
  payload,
});

const contribution = (
  eventId: string,
  knowledgeId: string,
  subject: string,
  statement: string,
  extra: Record<string, unknown> = {},
) =>
  event(eventId, "knowledge.recorded", {
    knowledgeId,
    subject,
    statement,
    provenance: { sourceId: "artifact_acceptance-contract", sourceVersion: 3 },
    requestedStatus: "provisional",
    authorized: true,
    ...extra,
  });

const promote = (eventId: string, knowledgeId: string, fromRevision: number) =>
  event(
    eventId,
    "knowledge.status_changed",
    { knowledgeId, toStatus: "authoritative", fromRevision },
    "manager",
  );

describe("shared knowledge retrieval", () => {
  it("returns each record with its lifecycle label and its source locator", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
    ]);

    const found = retrieveKnowledge(state, { subject: "C-08" });

    expect(found.results).toHaveLength(1);
    expect(found.results[0]).toMatchObject({
      knowledgeId: "knowledge_c08_a",
      status: "provisional",
      provenance: { sourceId: "artifact_acceptance-contract", sourceVersion: 3 },
    });
  });

  it("reports a rejected record as an omission rather than dropping it", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      event(
        "event_02",
        "knowledge.status_changed",
        { knowledgeId: "knowledge_c08_a", toStatus: "rejected", fromRevision: 0 },
        "manager",
      ),
    ]);

    const found = retrieveKnowledge(state, { subject: "C-08" });

    expect(found.results).toEqual([]);
    // Not silently substituted: the reader is told something matched and why it was withheld.
    expect(found.omissions).toEqual([
      {
        knowledgeId: "knowledge_c08_a",
        status: "rejected",
        reason: "a rejected record is retained as an auditable proposal and must not guide work",
      },
    ]);
  });

  it("names the replacement when a superseded record is withheld", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution(
        "event_02",
        "knowledge_c08_b",
        "C-08",
        "C-08 requires a static-reachability scan.",
      ),
      event(
        "event_03",
        "knowledge.status_changed",
        {
          knowledgeId: "knowledge_c08_a",
          toStatus: "superseded",
          fromRevision: 0,
          supersededBy: "knowledge_c08_b",
        },
        "manager",
      ),
    ]);

    const found = retrieveKnowledge(state, { subject: "C-08" });

    expect(found.results.map((record) => record.knowledgeId)).toEqual(["knowledge_c08_b"]);
    expect(found.omissions[0]).toMatchObject({
      knowledgeId: "knowledge_c08_a",
      status: "superseded",
      supersededBy: "knowledge_c08_b",
    });
  });

  it("returns a stale record, labelled, rather than withholding it", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      event(
        "event_02",
        "knowledge.status_changed",
        { knowledgeId: "knowledge_c08_a", toStatus: "stale", fromRevision: 0 },
        "system",
      ),
    ]);

    // Stale is "its source changed", not "it is wrong". Withholding it would hide the revalidation
    // the reader is the one positioned to perform.
    const found = retrieveKnowledge(state, { subject: "C-08" });
    expect(found.results[0]).toMatchObject({ knowledgeId: "knowledge_c08_a", status: "stale" });
    expect(found.omissions).toEqual([]);
  });

  it("retrieves by subject and never returns another subject's records", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution("event_02", "knowledge_c19_a", "C-19", "C-19 needs owner fidelity acceptance."),
    ]);

    expect(
      retrieveKnowledge(state, { subject: "C-19" }).results.map((record) => record.knowledgeId),
    ).toEqual(["knowledge_c19_a"]);
  });
});

describe("shared knowledge conflicts", () => {
  it("surfaces two live records that disagree about the same subject", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution(
        "event_02",
        "knowledge_c08_b",
        "C-08",
        "C-08 requires a static-reachability scan.",
      ),
    ]);

    const conflicts = detectKnowledgeConflicts(state);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      subject: "C-08",
      knowledgeIds: ["knowledge_c08_a", "knowledge_c08_b"],
      resolution: null,
    });
    // Surfaced through retrieval too: a reader asking for the subject is told it is disputed rather
    // than handed one of the two answers.
    expect(retrieveKnowledge(state, { subject: "C-08" }).conflicts).toHaveLength(1);
  });

  it("does not invent a conflict from two records that agree", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution("event_02", "knowledge_c08_b", "C-08", "C-08 is covered by a determinism test."),
    ]);

    expect(detectKnowledgeConflicts(state)).toEqual([]);
  });

  it("retains a resolved conflict, carrying how it was resolved", () => {
    const base = [
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution(
        "event_02",
        "knowledge_c08_b",
        "C-08",
        "C-08 requires a static-reachability scan.",
      ),
    ];

    const superseded = reduceKnowledgeTruth([
      ...base,
      event(
        "event_03",
        "knowledge.status_changed",
        {
          knowledgeId: "knowledge_c08_a",
          toStatus: "superseded",
          fromRevision: 0,
          supersededBy: "knowledge_c08_b",
        },
        "manager",
      ),
    ]);
    // The conflict does not vanish. A subsystem where settled disputes disappear cannot answer the
    // question that matters later: what the project used to believe, and who decided otherwise.
    expect(openKnowledgeConflicts(superseded)).toEqual([]);
    expect(detectKnowledgeConflicts(superseded)[0]).toMatchObject({
      subject: "C-08",
      resolution: {
        survivingKnowledgeId: "knowledge_c08_b",
        disposedOf: [
          {
            knowledgeId: "knowledge_c08_a",
            status: "superseded",
            supersededBy: "knowledge_c08_b",
          },
        ],
      },
    });

    const rejected = reduceKnowledgeTruth([
      ...base,
      event(
        "event_03",
        "knowledge.status_changed",
        { knowledgeId: "knowledge_c08_a", toStatus: "rejected", fromRevision: 0 },
        "manager",
      ),
    ]);
    expect(openKnowledgeConflicts(rejected)).toEqual([]);
    expect(detectKnowledgeConflicts(rejected)[0]?.resolution).toMatchObject({
      survivingKnowledgeId: "knowledge_c08_b",
      disposedOf: [{ knowledgeId: "knowledge_c08_a", status: "rejected" }],
    });
  });

  it("keeps the conflict open when one side is merely promoted over the other", () => {
    // Promotion is not resolution. Marking one record authoritative while a contradicting record is
    // still live is precisely the silent merge MDD section 15 forbids: the loser is still in the
    // project, still retrievable, and now outranked by something that never addressed it.
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution(
        "event_02",
        "knowledge_c08_b",
        "C-08",
        "C-08 requires a static-reachability scan.",
      ),
      promote("event_03", "knowledge_c08_b", 0),
    ]);

    expect(detectKnowledgeConflicts(state)).toMatchObject([{ subject: "C-08", resolution: null }]);
    expect(openKnowledgeConflicts(state)).toHaveLength(1);
  });

  it("a synthesis cites its inputs and does not outrank them", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution(
        "event_02",
        "knowledge_c08_b",
        "C-08",
        "C-08 requires a static-reachability scan.",
      ),
      contribution(
        "event_03",
        "knowledge_c08_s",
        "C-08",
        "C-08 needs both a determinism test and a scan.",
        {
          synthesisOf: ["knowledge_c08_a", "knowledge_c08_b"],
        },
      ),
    ]);

    const synthesis = retrieveKnowledge(state, { subject: "C-08" }).results.find(
      (record) => record.knowledgeId === "knowledge_c08_s",
    );
    expect(synthesis).toMatchObject({
      status: "provisional",
      synthesisOf: ["knowledge_c08_a", "knowledge_c08_b"],
    });
  });

  it("a synthesis is never counted as one of the competing claims", () => {
    // The sharp case: one claim plus a synthesis of it. Counting the synthesis as a rival claim
    // would manufacture a conflict out of an agreement, and then a reader asking about the subject
    // would be told the project is divided against itself by a record that exists to summarise it.
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution("event_02", "knowledge_c08_s", "C-08", "C-08 looks adequately covered.", {
        synthesisOf: ["knowledge_c08_a"],
      }),
    ]);

    expect(detectKnowledgeConflicts(state)).toEqual([]);

    const disputed = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution(
        "event_02",
        "knowledge_c08_b",
        "C-08",
        "C-08 requires a static-reachability scan.",
      ),
      contribution("event_03", "knowledge_c08_s", "C-08", "C-08 needs both.", {
        synthesisOf: ["knowledge_c08_a", "knowledge_c08_b"],
      }),
    ]);

    expect(detectKnowledgeConflicts(disputed)[0]).toMatchObject({
      knowledgeIds: ["knowledge_c08_a", "knowledge_c08_b"],
      proposedResolutions: ["knowledge_c08_s"],
      resolution: null,
    });
  });

  it("refuses a synthesis that cites a record nobody contributed", () => {
    const state = reduceKnowledgeTruth([
      contribution("event_01", "knowledge_c08_a", "C-08", "C-08 is covered by a determinism test."),
      contribution("event_02", "knowledge_c08_s", "C-08", "C-08 is settled.", {
        synthesisOf: ["knowledge_c08_a", "knowledge_absent"],
      }),
    ]);

    expect(retrieveKnowledge(state, { subject: "C-08" }).issues).toContainEqual({
      code: "SYNTHESIS_CITES_MISSING_RECORD",
      knowledgeId: "knowledge_c08_s",
      message: "synthesis cites knowledge_absent, which is not in the project record",
    });
  });
});
