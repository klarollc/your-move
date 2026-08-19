import type { projectKickoffReadModel } from "@cuckcode/application";

import "./kickoff-panel.css";

type KickoffModel = ReturnType<typeof projectKickoffReadModel>;

export function KickoffPanel({
  model,
  roleLabels,
  onClose,
}: Readonly<{
  model: KickoffModel;
  roleLabels: Readonly<Record<string, string>>;
  onClose?: () => void;
}>) {
  const label = (roleId: string) => roleLabels[roleId] ?? roleId;
  const roster = model.agents.map(({ roleId }) => roleId);
  const contributed = new Set(model.manager.entries.map(({ roleId }) => roleId));
  const missing = roster.filter((roleId) => !contributed.has(roleId));

  return (
    <section className="kickoff-panel" aria-label="Collaborative kickoff">
      <header>
        <h2>Collaborative kickoff</h2>
        {onClose ? (
          <button type="button" onClick={onClose}>
            Close kickoff
          </button>
        ) : null}
        {/* The shared briefing version is stated, not implied, so a version mismatch is visible
            rather than something a reader has to reconstruct. */}
        <p data-testid="kickoff-briefing">
          Briefing version {model.shared.scope.briefingVersion} · {model.shared.scope.goal}
        </p>
      </header>

      {missing.length > 0 ? (
        <p data-testid="kickoff-synthesis-blocked">
          Synthesis is blocked. No entry yet from {missing.map(label).join(", ")}. Consensus is not
          inferred from an incomplete round.
        </p>
      ) : null}

      <h3 id="kickoff-entries-heading">Role contributions</h3>
      <ul aria-labelledby="kickoff-entries-heading">
        {model.manager.entries.map((entry) => (
          <li key={entry.contributionId} data-testid={`kickoff-entry-${entry.roleId}`}>
            <p>
              <strong>{label(entry.roleId)}</strong> · {entry.agentId} · {entry.kind}
            </p>
            <dl>
              <dt>Proposal</dt>
              <dd>{entry.goal}</dd>
              <dt>Value</dt>
              <dd>{entry.value}</dd>
              <dt>Risk</dt>
              <dd>{entry.risk}</dd>
              <dt>Evidence needed</dt>
              <dd>{entry.evidenceNeeds.join("; ") || "None recorded"}</dd>
            </dl>
          </li>
        ))}
      </ul>

      {model.manager.synthesis ? (
        <section aria-label="Delivery Lead synthesis">
          <h3>Delivery Lead synthesis</h3>
          <p data-testid="kickoff-synthesis">{model.manager.synthesis.proposedGoal}</p>
          <p>
            Unresolved evidence gaps:{" "}
            {model.manager.synthesis.unresolvedEvidenceGaps.join("; ") || "None recorded"}
          </p>
        </section>
      ) : null}

      <h3 id="kickoff-disagreements-heading">Disagreement register</h3>
      <ul aria-labelledby="kickoff-disagreements-heading">
        {model.manager.disagreements.length > 0 ? (
          model.manager.disagreements.map((conflict) => (
            <li key={`${conflict.roleId}:${conflict.statement}`}>
              <strong>{label(conflict.roleId)}</strong>: {conflict.statement}
            </li>
          ))
        ) : (
          <li>No disagreement recorded.</li>
        )}
      </ul>

      <h3 id="kickoff-revisions-heading">Revision responses</h3>
      <ul aria-labelledby="kickoff-revisions-heading">
        {model.manager.revisionState.map((revision) => (
          <li key={revision.roleId} data-testid={`kickoff-revision-${revision.roleId}`}>
            <strong>{label(revision.roleId)}</strong>:{" "}
            {/* Silence is not affirmation. An unanswered role reads as an absence of response,
                never as agreement. */}
            {revision.response === "not_submitted" ? "No response recorded" : revision.response}
          </li>
        ))}
      </ul>

      {model.manager.editDiff.length > 0 ? (
        <>
          <h3 id="kickoff-edits-heading">Manager edits</h3>
          <ul aria-labelledby="kickoff-edits-heading">
            {model.manager.editDiff.map((change) => (
              <li key={change.field}>
                <strong>{change.field}</strong>: was {format(change.before)} · now{" "}
                {format(change.after)}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p data-testid="kickoff-decision-impact">
        {model.manager.decisionImpact.implementationAllowed
          ? "Charter approved. Work is authorised within its recorded scope."
          : "No work is authorised yet. A manager-approved charter is required first."}
      </p>
    </section>
  );
}

function format(value: string | readonly string[]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
