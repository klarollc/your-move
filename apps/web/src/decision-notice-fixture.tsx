import {
  createDecisionState,
  type Clock,
  type DecisionNotice,
  type DecisionState,
} from "@cuckcode/domain";
import { useState } from "react";

import { DecisionNoticeCard, type DecisionNoticeStorage } from "./decision-notice.js";
import "./decision-notice-fixture.css";

const notice: DecisionNotice = {
  decisionId: "decision_fixture_001",
  title: "Adopt the bounded kickoff turn budget",
  summary: "A plain-language summary of one decision awaiting acknowledgement.",
  severity: "significant",
  dueAt: "2026-10-01T00:00:00.000Z",
  evidenceLinks: [
    { linkId: "link_a", label: "Preflight packet", artifactPath: "fixture/preflight.md" },
    { linkId: "link_b", label: "Round transcript", artifactPath: "fixture/transcript.json" },
    { linkId: "link_c", label: "Missing report", artifactPath: "fixture/missing.md" },
    { linkId: "link_d", label: "External report", artifactPath: "https://example.invalid/doc" },
  ],
};

const fixture: ReadonlyMap<string, string> = new Map([
  ["fixture/preflight.md", "# packet"],
  ["fixture/transcript.json", "{}"],
]);

const clock: Clock = { now: () => "2026-09-14T12:00:00.000Z" };
let persisted: DecisionState | null = null;
let nextAction = 1;

const storage: DecisionNoticeStorage = {
  load: () => persisted,
  save: (state) => {
    persisted = state;
  },
};

export function DecisionNoticeFixture() {
  const [key, setKey] = useState(0);

  return (
    <main className="decision-notice-fixture">
      <DecisionNoticeCard
        key={key}
        notice={notice}
        fixture={fixture}
        clock={clock}
        storage={storage}
        idSource={() => `fixture-action-${nextAction++}`}
        locale="en-US"
        animationPolicy="reduced"
      />
      <button
        type="button"
        className="decision-notice-fixture__reload"
        onClick={() => setKey((value) => value + 1)}
      >
        Reload injected fixture state
      </button>
    </main>
  );
}

export function resetDecisionNoticeFixture() {
  persisted = createDecisionState(notice);
  nextAction = 1;
}
