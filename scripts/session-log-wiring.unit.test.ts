import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const scripts = resolve(import.meta.dirname);
const source = (name: string) => readFileSync(join(scripts, name), "utf8");

describe("where the session log is written (CX-5)", () => {
  it("the shared session opener closes it before the controlled home is deleted, on both paths", () => {
    const text = source("phase4-kickoff-session.ts");
    const handedBack = text.slice(text.indexOf("close: async (): Promise<void> => {"));
    expect(handedBack.indexOf("await liveLog.close()")).toBeGreaterThan(-1);
    expect(handedBack.indexOf("await liveLog.close()")).toBeLessThan(
      handedBack.indexOf("await controlledHome.dispose()"),
    );
    const failed = text.slice(text.lastIndexOf("} finally {"));
    expect(failed.indexOf("if (log) await log.close()")).toBeGreaterThan(-1);
    expect(failed.indexOf("if (log) await log.close()")).toBeLessThan(
      failed.indexOf("if (home) await home.dispose()"),
    );
  });

  it("each script that builds its own supervisor opens a log for it and closes it before disposal", () => {
    for (const name of ["run-role-exercises.ts", "run-phase6-review.ts"]) {
      const text = source(name);
      expect(text.indexOf("openSessionLog(supervisor"), name).toBeGreaterThan(-1);
      const tail = text.slice(
        text.indexOf("} finally {", text.indexOf("openSessionLog(supervisor")),
      );
      expect(tail.indexOf("await sessionLog.close()"), name).toBeGreaterThan(-1);
      expect(tail.indexOf("await sessionLog.close()"), name).toBeLessThan(
        tail.indexOf("await home.dispose()"),
      );
    }
  });
});
