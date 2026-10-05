export type YourMovePlaywrightRuntime = Readonly<{ close: () => Promise<void> }>;

declare global {
  var __cuckcodeYourMovePlaywrightRuntime: YourMovePlaywrightRuntime | undefined;
}

export function setYourMovePlaywrightRuntime(runtime: YourMovePlaywrightRuntime): void {
  globalThis.__cuckcodeYourMovePlaywrightRuntime = runtime;
}

export async function closeYourMovePlaywrightRuntime(): Promise<void> {
  const runtime = globalThis.__cuckcodeYourMovePlaywrightRuntime;
  globalThis.__cuckcodeYourMovePlaywrightRuntime = undefined;
  await runtime?.close();
}
