import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Phase 7-O Task 9e: the Office outline is on demand. Tests that act through the outline open it
 * first, as a manager would, from the project bar. Idempotent: a no-op when it is already open.
 */
export async function openOfficeOutline(user: UserEvent): Promise<void> {
  if (screen.queryByRole("region", { name: "Office outline" })) return;
  await user.click(screen.getByRole("button", { name: "Office outline" }));
}
