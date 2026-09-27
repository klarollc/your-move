import { describe, expect, it } from "vitest";

import { attentionSummary } from "./office-model.js";

/**
 * Phase 7-O Task 9f-1, owner ruling P-4: the bar counts attention by canonical reason. Questions
 * are `question_open` and `waiting_input`; reviews are `review_requested` and `approval_required`;
 * blocked is `blocked` and `failed`. Only non-zero parts are shown.
 */
const item = (reason: string) => ({ reason });

describe("attentionSummary", () => {
  it("groups canonical reasons into blocked, questions and reviews", () => {
    expect(
      attentionSummary([
        item("blocked"),
        item("failed"),
        item("question_open"),
        item("waiting_input"),
        item("review_requested"),
        item("approval_required"),
      ]),
    ).toBe("2 blocked · 2 questions · 2 reviews");
  });

  it("uses the singular and omits empty groups", () => {
    expect(attentionSummary([item("review_requested"), item("blocked")])).toBe(
      "1 blocked · 1 review",
    );
    expect(attentionSummary([item("question_open")])).toBe("1 question");
  });

  it("is empty when nothing needs the manager", () => {
    expect(attentionSummary([])).toBe("");
  });

  it("does not hide a reason it does not know", () => {
    expect(attentionSummary([item("something_new")])).toBe("1 other");
  });
});
