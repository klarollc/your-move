import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSharedKnowledgeAcceptance } from "./shared-knowledge-scenario.js";

const roots: string[] = [];
const make = (label: string) => {
  const root = mkdtempSync(join(tmpdir(), `cuckcode-${label}-`));
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("cross-project shared-knowledge contract", () => {
  it("contributes, contests, resolves, refreshes, recovers, and never crosses project canaries", () => {
    const first = runSharedKnowledgeAcceptance({
      projectAlphaRoot: make("scenario-alpha"),
      projectBetaRoot: make("scenario-beta"),
      recoveryRoot: make("scenario-recovery"),
    });
    const second = runSharedKnowledgeAcceptance({
      projectAlphaRoot: make("scenario-alpha"),
      projectBetaRoot: make("scenario-beta"),
      recoveryRoot: make("scenario-recovery"),
    });

    expect(first).toEqual(second);
    expect(first.lifecycle).toEqual(["provisional", "contested", "approved"]);
    expect(first.isolation).toEqual({ alphaCanaryCrossed: false, betaCanaryCrossed: false });
    expect(first.propagation).toEqual({ pausedBeforeAction: true, refreshedAtCheckpoint: true });
    expect(first.hashes.rebuildBefore).toBe(first.hashes.rebuildAfter);
    expect(first.hashes.restart).toBe(first.hashes.rebuildAfter);
    expect(first.hashes.backupDatabase).toBe(first.hashes.exportDatabase);
    expect(first.hashes.packet).toBe(first.hashes.packetRepeat);
    expect(first.recovery).toEqual({ backupIntegrity: "ok", exportIntegrity: "ok" });
  });
});
