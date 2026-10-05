import { describe, expect, it } from "vitest";

import { selectAppSurface } from "./surface-route.js";

describe("application route selection", () => {
  it("makes the simple work list the default and keeps explicit office fixtures routed", () => {
    expect(selectAppSurface(new URLSearchParams())).toBe("work-list");
    expect(selectAppSurface(new URLSearchParams("surface=office"))).toBe("office");
    expect(selectAppSurface(new URLSearchParams("fixture=work-blocked"))).toBe("office");
    expect(selectAppSurface(new URLSearchParams("surface=font-sheet"))).toBe("font-sheet");
  });
});
