import { performance } from "node:perf_hooks";

// R4 port of feature/lamp-body-phase-b:packages/runtime-codex/src/lamp-v2.ts (c94612e). The prompt,
// model, request options and binary contract are byte-for-byte the locked v2. The only changes,
// both approved for R4: the endpoint is the owner's configured Ollama URL (Track A #2), and an
// optional bearer token is sent when the owner set one (Nate, 2026-10-19: enforced by the owner's
// tunnel/proxy; Ollama itself has no auth).

/** The prompt literal is copied verbatim from the locked run_lamp_eval_v2.py runner. */
export const LAMP_V2_PROMPT = `Classify this agent utterance for the Your Move decision layer. Decide whether the manager needs to act.

Output exactly one of these two strings, with no JSON, explanation, punctuation, or other text:
lamp
no-lamp

Light the lamp for a question to the manager, a proposed change, a dispute of a ruling or assessment, or a deliverable explicitly handed over to the manager for review or verification.

THE HANDOFF TEST: A completed deliverable with an artifact reference is a lamp signal ONLY when the agent is handing the work TO the manager — for example, asking the manager to review, verify, or approve it, or saying "here's the file" as a handoff. A completion word plus an artifact reference alone is not enough.

When the agent is REPORTING state — such as tests passed, a run finished, a package is building, or a task closed as a fact — that is a status update, not a handoff. Do not light the lamp for a report, even if it uses completion words or names artifacts. If no question, handoff, or decision needed is present, keep a pure state report quiet.

OPERATING RULE: Light the lamp when the manager would want to know because action or judgment is needed. When genuinely uncertain, still light it: a missed lamp costs more than an unneeded one. But do not confuse reporting with handing work over; a pure state report with no question, no handoff, and no decision needed stays quiet.

Examples:

Utterance: "P4 draft is done. Walkthrough: [p4-checklist-draft-2026-10-02.md]. Both pieces are ready for your review. I'd suggest: mark up the protocol first, then the checklist."
Output: lamp

Utterance: "v2 is ready for your review. The new file is [owner-review-package-2026-09-30-v2.md]. Nothing in it is approved for publication or any external action."
Output: lamp

Utterance: "The web article's ready for your review — private, unshared, DRAFT-bannered, built straight from v4. The PDF is still building; give the article a read and flag anything you want changed."
Output: lamp

Utterance: "P3 draft is ready for your review — the first of the three back: [p3-governance-patterns-draft-2026-10-03.md]. Waiting on your review."
Output: lamp

Utterance: "The run completed and stopped at turn 7 — six contributions succeeded, the synthesis was refused. Let me see exactly why."
Gold: status-update; reporting a run outcome, nothing handed over.
Output: no-lamp

Utterance: "The browser validation is complete: 46 E2E, 18 accessibility, and 22 visual tests all pass across both approved viewports."
Gold: status-update; test results reported, no deliverable awaiting verification.
Output: no-lamp

Utterance: "The reviewer data package is building now — packed and ready in case either of them asks."
Gold: status-update; anticipatory preparation, not handing work over.
Output: no-lamp

Utterance: "I'll start by figuring out what this project actually is — the working directory is the LRMHC Contract folder, so let me look before dispatching anyone."
Gold: check-in; intent-only opener, no new information and no manager action needed.
Output: no-lamp

Utterance: "The workspace is clean, but it is not at the baseline you named: HEAD is f0885c9 on main, and 35596d8 is a disconnected commit rather than an ancestor. I’m treating that as a safety boundary and will inspect the approved authority plus the two histories without modifying either."
Gold: status-update; reports a newly found fact, no ruling or answer requested.
Output: no-lamp

Now classify this utterance. Apply the handoff test: reports are not handoffs. When genuinely uncertain whether manager action is needed, output lamp.

Utterance:
`;

export const LAMP_V2_MODEL = "qwen3:8b";
export const LAMP_V2_PROMPT_VERSION = "v2";
export type LampLabel = "lamp" | "no-lamp";
export type OllamaLampOptions = Readonly<{
  fetcher?: typeof fetch;
  /** The full chat URL, `<owner base URL>/api/chat`. */
  endpoint?: string;
  /** Optional bearer token for the owner's tunnel or proxy. Never logged. */
  token?: string;
}>;

export async function classifyLampV2(
  text: string,
  options: OllamaLampOptions = {},
): Promise<Readonly<{ verdict: LampLabel; latencyMs: number }>> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await (options.fetcher ?? fetch)(
      options.endpoint ?? "http://localhost:11434/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: LAMP_V2_MODEL,
          stream: false,
          think: false,
          messages: [{ role: "user", content: LAMP_V2_PROMPT + text }],
          options: { temperature: 0, num_gpu: -1, num_predict: 16 },
        }),
      },
    );
    if (!response.ok) throw new Error(`LAMP_HTTP_${response.status}`);
    const payload = (await response.json()) as { message?: { content?: unknown } };
    const raw = typeof payload.message?.content === "string" ? payload.message.content : "";
    const lines = raw.trim().toLowerCase().split(/\r?\n/u).filter(Boolean);
    if (lines.length !== 1 || (lines[0] !== "lamp" && lines[0] !== "no-lamp")) {
      throw new Error("LAMP_INVALID_BINARY_RESPONSE");
    }
    return { verdict: lines[0], latencyMs: performance.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}
