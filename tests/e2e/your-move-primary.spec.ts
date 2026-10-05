import { expect, test } from "@playwright/test";

test("@yourmove-e2e Surface B is the default and its calm screen reflects the event log", async ({
  page,
}) => {
  const commandPosts: string[] = [];
  const failedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/commands")) {
      commandPosts.push(request.url());
    }
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));

  const sessionResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/session"),
  );
  await page.goto("/");
  expect((await sessionResponse).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "No work yet." })).toBeVisible();
  await expect(page.getByText("The event log has no work items.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Your move: 0 matters" })).toBeVisible();

  await page.getByRole("button", { name: "+ New work" }).click();
  await expect(page.getByRole("heading", { name: "Describe the outcome" })).toBeVisible();
  await expect(page.getByText(/current workflow core has no draft service/u)).toBeVisible();
  expect(commandPosts).toEqual([]);
  expect(failedRequests).toEqual([]);
});
