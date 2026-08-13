import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HarnessDisclosure } from "./test-surface.js";

describe("browser component harness", () => {
  it("drives a named native control through accessible semantics", async () => {
    const user = userEvent.setup();
    render(<HarnessDisclosure />);

    const trigger = screen.getByRole("button", { name: "Show harness detail" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Component harness ready");
  });
});
