import { describe, expect, it } from "vitest";

import { carriesVersion } from "./supervisor.js";

describe("the handshake version check", () => {
  it("accepts the version where Codex reports it", () => {
    expect(carriesVersion("codex_cli_rs/0.157.1 (Windows 10.0.26100; x86_64)", "0.157.1")).toBe(
      true,
    );
    expect(carriesVersion("codex-cli 0.157.1", "0.157.1")).toBe(true);
  });

  it("refuses a different version, including one that merely contains the pin", () => {
    expect(carriesVersion("codex_cli_rs/0.156.1", "0.157.1")).toBe(false);
    expect(carriesVersion("codex_cli_rs/10.157.1", "0.157.1")).toBe(false);
    expect(carriesVersion("codex_cli_rs/0.157.12", "0.157.1")).toBe(false);
  });

  it("treats the dots in a version as dots, not as any character", () => {
    expect(carriesVersion("codex_cli_rs/0x157y1", "0.157.1")).toBe(false);
  });
});
