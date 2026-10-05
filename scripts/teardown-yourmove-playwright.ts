import { closeYourMovePlaywrightRuntime } from "./yourmove-playwright-runtime.js";

export default async function teardownYourMovePlaywright(): Promise<void> {
  await closeYourMovePlaywrightRuntime();
}
