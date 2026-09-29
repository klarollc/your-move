import { runtimeBindingReportSchema, type RuntimeBindingReport } from "@cuckcode/contracts";

import type { ProjectStore } from "./project-store.js";
import { validRecordTime } from "./record-time.js";

export function createRuntimeTrustStore(project: ProjectStore) {
  const db = project.database;
  return {
    registerAgent(input: { agentId: string; displayName: string; createdAt: string }) {
      db.prepare("INSERT INTO agents(agent_id,display_name,created_at) VALUES(?,?,?)").run(
        input.agentId,
        input.displayName,
        input.createdAt,
      );
    },

    appendBinding(input: {
      report: RuntimeBindingReport;
      providerIds: Record<string, string>;
      createdAt: string;
    }) {
      rejectCredentials(input);
      // DF-030: this time is also the provider identities' bind time, so it must be a real one.
      const recordedAt = validRecordTime({ recordedAt: input.createdAt });
      const report = runtimeBindingReportSchema.parse(input.report);
      db.transaction(() => {
        for (const [kind, providerId] of Object.entries(input.providerIds)) {
          const existing = db
            .prepare(
              "SELECT agent_id FROM provider_identities WHERE provider_kind=? AND provider_id=?",
            )
            .get(kind, providerId) as { agent_id: string } | undefined;
          if (existing && existing.agent_id !== report.agentId)
            throw new Error("PROVIDER_ID_IMPERSONATION");
          if (!existing)
            db.prepare(
              "INSERT INTO provider_identities(provider_kind,provider_id,agent_id,recorded_at) VALUES(?,?,?,?)",
            ).run(kind, providerId, report.agentId, recordedAt);
        }
        const version = Number(
          (
            db
              .prepare(
                "SELECT COALESCE(MAX(binding_version),0)+1 AS version FROM runtime_bindings WHERE agent_id=?",
              )
              .get(report.agentId) as { version: number }
          ).version,
        );
        db.prepare(
          "INSERT INTO runtime_bindings(binding_id,agent_id,binding_version,material_fingerprint,status,report_json,created_at) VALUES(?,?,?,?,?,?,?)",
        ).run(
          report.bindingId,
          report.agentId,
          version,
          report.materialFingerprint,
          "candidate",
          JSON.stringify(report),
          input.createdAt,
        );
      })();
    },

    recordQualification(input: {
      qualificationId: string;
      agentId: string;
      bindingId: string;
      roleId: string;
      suiteVersion: string;
      status: string;
      evidenceHash: string;
      recordedAt: string;
    }) {
      rejectCredentials(input);
      db.prepare(
        "INSERT INTO runtime_qualifications(qualification_id,agent_id,binding_id,role_id,suite_version,status,evidence_hash,recorded_at) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        input.qualificationId,
        input.agentId,
        input.bindingId,
        input.roleId,
        input.suiteVersion,
        input.status,
        input.evidenceHash,
        input.recordedAt,
      );
    },

    agentTruth(agentId: string) {
      const agent = db
        .prepare("SELECT agent_id,display_name FROM agents WHERE agent_id=?")
        .get(agentId) as { agent_id: string; display_name: string } | undefined;
      if (!agent) return undefined;
      const binding = db
        .prepare(
          "SELECT binding_id,binding_version,status FROM runtime_bindings WHERE agent_id=? ORDER BY binding_version DESC LIMIT 1",
        )
        .get(agentId) as
        { binding_id: string; binding_version: number; status: string } | undefined;
      const qualifications = db
        .prepare(
          "SELECT qualification_id,binding_id,status FROM runtime_qualifications WHERE agent_id=? ORDER BY qualification_id",
        )
        .all(agentId) as { qualification_id: string; binding_id: string; status: string }[];
      return {
        agentId: agent.agent_id,
        displayName: agent.display_name,
        currentBindingId: binding?.binding_id,
        bindingVersion: binding?.binding_version,
        currentBindingStatus: binding?.status,
        qualifications: qualifications.map((qualification) => ({
          qualificationId: qualification.qualification_id,
          effectiveStatus:
            qualification.binding_id === binding?.binding_id ? qualification.status : "stale",
        })),
      };
    },
  };
}

function rejectCredentials(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (
    /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|authorization)"\s*:/iu.test(
      serialized,
    ) ||
    /sk-[a-z0-9_-]{8,}/iu.test(serialized)
  )
    throw new Error("CREDENTIAL_DATA_FORBIDDEN");
}
