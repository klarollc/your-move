import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContractDraftPanel, type ContractDraftServiceResult } from "./contract-draft-panel.js";

afterEach(cleanup);

const candidate: ContractDraftServiceResult["candidate"] = {
  outcome: "Document the current parser behavior",
  exclusions: ["Do not edit source files"],
  acceptanceCriteria: ["The documented examples match the parser"],
  dependencies: [],
  evidenceObligations: [{ kind: "review", description: "Inspect the saved document" }],
  permissionCeiling: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccess: false,
    windowsSandbox: "unelevated",
  },
  stopConditions: ["Stop if examples are ambiguous"],
  definitionOfDone: "A manager reviews the saved document",
  contextRefs: [],
  maxTurns: 4,
};

const genuineResult: ContractDraftServiceResult = {
  candidate,
  provenance: {
    draftSource: "agent",
    draftId: "draft_surface_b_test",
    procedureId: "contract-drafter-v1",
    procedureVersion: "1.0.0",
    procedureSha256: "a".repeat(64),
    runtime: "@openai/codex@0.157.1",
    model: "gpt-6.1-sol",
    providerSessionId: "session_test_only_ui_stub",
    providerTurnId: "turn_test_only_ui_stub",
    requestSha256: "b".repeat(64),
    candidateSha256: "c".repeat(64),
  },
  receiptHandle: "draft-receipt-ui-stub",
  expiresAt: "2026-10-05T20:00:00.000Z",
  source: "codex-app-server",
  testOnly: false,
};

describe("Surface B contract draft panel", () => {
  it("keeps draft-first as the default while offering a deliberate manager-authored path", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    render(
      <ContractDraftPanel available={false} disabled={false} revision={3} onCreate={onCreate} />,
    );

    expect(screen.getByRole("heading", { name: "Describe the outcome" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Request agent draft" })).toBeDisabled();
    const directChoice = screen.getByRole("button", {
      name: "You're writing the contract yourself; it will be recorded as manager-authored.",
    });
    expect(directChoice).toBeVisible();
    expect(screen.queryByLabelText("Write the structured contract JSON")).not.toBeInTheDocument();

    await user.click(directChoice);
    expect(screen.getByText("Draft source: manager")).toBeVisible();
    const editor = screen.getByLabelText("Write the structured contract JSON");
    expect(editor).toBeEnabled();
    fireEvent.change(editor, { target: { value: JSON.stringify(candidate) } });
    await user.click(screen.getByRole("button", { name: "Create manager-authored work" }));

    expect(onCreate).toHaveBeenCalledWith(candidate);
  });

  it("keeps manager-authored work unconfirmed when the command is refused", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => {
      throw new Error("The loopback command was refused.");
    });
    render(
      <ContractDraftPanel available={false} disabled={false} revision={3} onCreate={onCreate} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "You're writing the contract yourself; it will be recorded as manager-authored.",
      }),
    );
    fireEvent.change(screen.getByLabelText("Write the structured contract JSON"), {
      target: { value: JSON.stringify(candidate) },
    });
    await user.click(screen.getByRole("button", { name: "Create manager-authored work" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The loopback command was refused. No work was confirmed.",
    );
    expect(screen.queryByText(/work created/u)).not.toBeInTheDocument();
  });

  it("keeps draft and approval disabled while the live source lacks owner authorization", () => {
    render(<ContractDraftPanel available={false} disabled={false} revision={0} />);

    expect(screen.getByText(/has not received separate owner authorization/u)).toBeVisible();
    expect(screen.getByLabelText("What outcome do you need?")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request agent draft" })).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "You're writing the contract yourself; it will be recorded as manager-authored.",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Approve contract and create work" }),
    ).not.toBeInTheDocument();
  });

  it("shows a candidate-to-final edit diff and forwards manager terms with the opaque receipt", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn(async () => genuineResult);
    const onCreate = vi.fn(async () => undefined);
    render(
      <ContractDraftPanel
        available
        disabled={false}
        revision={12}
        onDraft={onDraft}
        onCreate={onCreate}
      />,
    );

    await user.type(screen.getByLabelText("What outcome do you need?"), "Document parser behavior");
    await user.click(screen.getByRole("button", { name: "Request agent draft" }));
    expect(await screen.findByText(/not approved · source confirmed by the server/u)).toBeVisible();

    const edited = { ...candidate, outcome: "Document the verified parser behavior" };
    fireEvent.change(screen.getByLabelText("Edit the structured contract JSON"), {
      target: { value: JSON.stringify(edited) },
    });
    expect(screen.getByRole("region", { name: "Manager edit diff" })).toHaveTextContent(
      "Document the current parser behavior",
    );
    expect(screen.getByRole("region", { name: "Manager edit diff" })).toHaveTextContent(
      "Document the verified parser behavior",
    );

    await user.click(screen.getByRole("button", { name: "Approve contract and create work" }));
    expect(onCreate).toHaveBeenCalledWith(edited, "draft-receipt-ui-stub");
    expect(screen.queryByText(/source confirmed by the server/u)).not.toBeInTheDocument();
  });

  it("refuses a structurally test-only draft without presenting it as agent-authored", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    const onDraft = vi.fn(async () => ({
      ...genuineResult,
      source: "test-fake" as const,
      testOnly: true,
    }));
    render(
      <ContractDraftPanel
        available
        disabled={false}
        revision={12}
        onDraft={onDraft}
        onCreate={onCreate}
      />,
    );

    await user.type(screen.getByLabelText("What outcome do you need?"), "Draft a contract");
    await user.click(screen.getByRole("button", { name: "Request agent draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /test-only draft cannot be reviewed/u,
    );
    expect(screen.queryByText(/source confirmed by the server/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve contract and create work" }),
    ).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("does not infer agent authorship for a receipt missing the explicit source", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    const legacyReceipt = {
      ...genuineResult,
      provenance: {
        draftId: "draft_legacy_transient_receipt",
        procedureId: "contract-drafter-v1",
        procedureVersion: "1.0.0",
        procedureSha256: "a".repeat(64),
        runtime: "@openai/codex@0.157.1",
        model: "gpt-6.1-sol",
        providerSessionId: "session_legacy_ui_stub",
        providerTurnId: "turn_legacy_ui_stub",
        requestSha256: "b".repeat(64),
        candidateSha256: "c".repeat(64),
      },
    } as unknown as ContractDraftServiceResult;
    render(
      <ContractDraftPanel
        available
        disabled={false}
        revision={12}
        onDraft={vi.fn(async () => legacyReceipt)}
        onCreate={onCreate}
      />,
    );

    await user.type(screen.getByLabelText("What outcome do you need?"), "Draft a contract");
    await user.click(screen.getByRole("button", { name: "Request agent draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid draft receipt");
    expect(screen.queryByText(/source confirmed by the server/u)).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("keeps a past-revision create view read-only", () => {
    render(
      <ContractDraftPanel
        available
        disabled
        revision={8}
        onDraft={vi.fn(async () => genuineResult)}
        onCreate={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByLabelText("What outcome do you need?")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request agent draft" })).toBeDisabled();
  });
});
