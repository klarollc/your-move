import { describe, expect, it } from "vitest";

import { parseTurnJson } from "./phase4-kickoff-session.js";

/**
 * The parser between a role's turn and the kickoff domain.
 *
 * It is the one part of the live path testable without a provider, and it decides whether a spent
 * turn becomes a contribution or a recorded failure. Being lenient about a code fence while strict
 * about everything else is deliberate: fencing is a formatting habit, and treating it as a refusal
 * would burn turns on presentation. Anything that is not a JSON object is a turn that produced
 * nothing the domain can accept, and it must say so rather than guess.
 */
describe("kickoff turn payload parsing", () => {
  it("reads a bare JSON object", () => {
    const parsed = parseTurnJson('{"response":"affirm","statement":"the evidence floor holds"}');
    expect(parsed).toEqual({
      ok: true,
      value: { response: "affirm", statement: "the evidence floor holds" },
    });
  });

  it("reads a fenced object, because models fence even when told not to", () => {
    const parsed = parseTurnJson(
      '```json\n{"response":"amend","statement":"narrow the scope"}\n```',
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value.response).toBe("amend");
  });

  it("reads an object wrapped in stray prose rather than losing the turn to it", () => {
    const parsed = parseTurnJson(
      'Here is my revision:\n{"response":"challenge","statement":"no"}\nHope that helps.',
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value.response).toBe("challenge");
  });

  it("refuses a response with no object at all", () => {
    const parsed = parseTurnJson("I affirm the synthesis.");
    expect(parsed.ok).toBe(false);
  });

  it("refuses a JSON array, which is not a payload the domain accepts", () => {
    // An array parses as JSON and would sail through a naive `JSON.parse` check, then fail deeper in
    // the domain where the cause is far less obvious.
    const parsed = parseTurnJson('[{"response":"affirm"}]');
    expect(parsed.ok).toBe(false);
  });

  it("refuses malformed JSON and says why", () => {
    const parsed = parseTurnJson('{"response":"affirm",}');
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.detail.length).toBeGreaterThan(0);
  });

  it("does not silently accept an empty object as a position", () => {
    // `{}` parses. Whether it is a usable payload is the domain's call, and it refuses one with no
    // required fields — so the parser must hand it on rather than inventing a failure of its own.
    const parsed = parseTurnJson("{}");
    expect(parsed).toEqual({ ok: true, value: {} });
  });
});
