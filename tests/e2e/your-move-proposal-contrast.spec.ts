import { expect, test } from "@playwright/test";

function rgbChannels(value: string): [number, number, number] {
  const channels = value.match(/[\d.]+/g);
  if (!channels || channels.length < 3) throw new Error(`Unsupported CSS color: ${value}`);
  return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = rgbChannels(color).map((channel) => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const draft = {
  id: "draft_synthetic_1",
  status: "approved",
  prose: { achieve: "Add a setup section" },
  execution: {
    id: "exec_synthetic_1",
    status: "waiting-on-you",
    attempt: 1,
    turnCount: 1,
    maxTurns: 4,
    output: "The setup summary is ready for your review.",
    error: null,
    utterances: [
      { turnIndex: 1, text: "Should I add a setup section?" },
      { turnIndex: 2, text: "I drafted a README change for your separate approval." },
    ],
    conversation: [
      { role: "agent", turnIndex: 1, text: "Should I add a setup section?" },
      { role: "owner", text: "Approved — summarize the change." },
      {
        role: "agent",
        turnIndex: 2,
        text: "I drafted a README change for your separate approval.",
      },
    ],
    lampVerdicts: [
      {
        utteranceId: "utterance_synthetic_1_2_1",
        turnIndex: 2,
        verdict: "lamp",
        verdictTs: "2026-10-19T17:01:00.000Z",
        ownerChoice: null,
      },
    ],
    proposals: [
      {
        id: "proposal_synthetic_1",
        tool: "github_propose_write",
        status: "pending",
        createdAt: "2026-10-19T17:00:00.000Z",
        change: {
          repo: "octo/repo",
          path: "README.md",
          message: "Add setup instructions",
          content: "## Setup\n\nInstall with npm ci.",
        },
      },
    ],
    fundedBy: "openai",
  },
};

test("@e2e Your Move renders readable, explicit proposal decisions on the daylight surface", async ({
  page,
}, testInfo) => {
  let authenticated = false;
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    let body: unknown;
    if (pathname === "/api/session" && method === "GET") {
      body = { authenticated };
    } else if (pathname === "/api/session" && method === "POST") {
      authenticated = true;
      body = { authenticated: true };
    } else if (pathname === "/api/providers" && method === "GET") {
      body = {
        providers: [
          { id: "openai", status: "disconnected" },
          { id: "anthropic", status: "disconnected" },
        ],
        modelSelection: { mode: "automatic" },
      };
    } else if (pathname === "/api/work-drafts" && method === "GET") {
      body = { drafts: [draft] };
    } else if (pathname === "/api/chatgpt-plan" && method === "GET") {
      body = {
        status: "disconnected",
        active: false,
        email: null,
        limitReachedAt: null,
        inUseLabel: "Using ChatGPT plan",
        manageUsageUrl: "https://chatgpt.com/settings/usage",
      };
    } else if (pathname === "/api/lamp" && method === "GET") {
      body = {
        endpoint: { baseUrl: "", configured: false, tokenSet: false },
        model: "qwen3:8b",
        degraded: false,
        failures: 0,
        latency: { count: 0, p50Ms: null, p95Ms: null },
      };
    } else if (pathname === "/api/integrations" && method === "GET") {
      body = { integrations: [{ id: "github", status: "disconnected" }] };
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"code":"NOT_FOUND"}',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.goto("/hosted.html");
  await page.getByLabel("Owner password").fill("synthetic-capture-only");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "All work & history" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "List" }).click();
  await page.getByRole("button", { name: "All work & history" }).click();
  await page.getByRole("button", { name: "Open Add a setup section" }).click();

  const surface = page.locator(".ym3");
  await expect(page.locator(".hosted-workspace")).toHaveCSS(
    "background-color",
    "rgb(202, 211, 196)",
  );
  await expect(surface).toHaveCSS("border-radius", "0px");
  const detail = page.getByRole("region", { name: "Add a setup section" });
  const proposal = detail.getByRole("group", { name: "Proposed change to README.md" });
  const send = proposal.getByRole("button", { name: "Go ahead and send" });
  const deny = proposal.getByRole("button", { name: "Don't send this" });
  await expect(send).toBeVisible();
  await expect(send).toBeEnabled();
  await expect(deny).toBeVisible();
  await expect(deny).toBeEnabled();
  await expect(detail.getByText("Approved — summarize the change.")).toBeVisible();
  await expect(detail.getByRole("group", { name: "Lamp verdict" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Mark as seen" })).toBeEnabled();
  await detail.getByText("Approved — summarize the change.").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("owner-reply.png"), fullPage: true });
  const lampVerdict = detail.getByRole("group", { name: "Lamp verdict" });
  await lampVerdict.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("lamp-verdict.png"), fullPage: true });
  await proposal.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("proposal-approval.png"), fullPage: true });

  const colors = await proposal.evaluate((element) => {
    const sample = (node: Element | null) => {
      if (!node) throw new Error("Expected proposal text/control was not rendered");
      const computed = getComputedStyle(node);
      return {
        color: computed.color,
        background: computed.backgroundColor,
        borderWidth: computed.borderTopWidth,
        borderStyle: computed.borderTopStyle,
        borderColor: computed.borderTopColor,
      };
    };
    return {
      card: sample(element),
      label: sample(element.querySelector(".your-move__said-label")),
      message: sample(element.querySelector(".your-move__proposal-message")),
      fineprint: sample(element.querySelector(".your-move__fineprint")),
      send: sample(element.querySelector(".your-move__primary")),
      deny: sample(element.querySelector(".your-move__secondary")),
      curtain: sample(element.querySelector(".your-move__link")),
      content: sample(element.querySelector(".your-move__content")),
    };
  });
  const cardBackground = colors.card.background;
  expect(colors.card.borderWidth, "proposal card has a visible boundary").toBe("1px");
  expect(colors.card.borderStyle).toBe("solid");
  expect(colors.card.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  for (const part of ["card", "label", "message", "fineprint", "deny", "curtain"] as const) {
    expect(
      contrastRatio(colors[part].color, cardBackground),
      `${part} text contrast against proposal card`,
    ).toBeGreaterThanOrEqual(4.5);
  }
  expect(
    contrastRatio(colors.send.color, colors.send.background),
    "send button text contrast",
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrastRatio(colors.content.color, colors.content.background),
    "proposal content contrast",
  ).toBeGreaterThanOrEqual(4.5);

  await page.getByRole("button", { name: "Connections" }).click();
  await page.getByRole("button", { name: "Open Anthropic settings" }).click();
  const paperSurface = page.locator(".ym3c__sheet");
  await expect(paperSurface).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("connections-anthropic-paper.png"),
    fullPage: true,
  });
  const paperBackground = await paperSurface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const paperText = await paperSurface.evaluate((element) => {
    const candidates = [
      element.querySelector("h2"),
      element.querySelector("legend"),
      element.querySelector("label"),
      element.querySelector(".provider-settings__provider-status"),
      element.querySelector(".provider-settings__hint"),
    ];
    return candidates.map((node) => {
      if (!node) throw new Error("Expected Connections paper text was not rendered");
      return { label: node.textContent?.trim(), color: getComputedStyle(node).color };
    });
  });
  const sheetContrast = async (surface: import("@playwright/test").Locator, label: string) => {
    const result = await surface.evaluate((element) => {
      const background = getComputedStyle(element).backgroundColor;
      return Array.from(
        element.querySelectorAll<HTMLElement>(
          "h1, h2, h3, legend, label, p, span, strong, button, input, .provider-settings__hint, .provider-settings__feedback",
        ),
      )
        .map((node) => ({
          label: node.textContent?.trim().replace(/\s+/g, " ").slice(0, 100),
          color: getComputedStyle(node).color,
          background: getComputedStyle(node).backgroundColor,
        }))
        .map((node) => ({ ...node, surfaceBackground: background }));
    });
    for (const text of result) {
      const background =
        text.background === "rgba(0, 0, 0, 0)" ? text.surfaceBackground : text.background;
      expect(
        contrastRatio(text.color, background),
        `${label} paper contrast: ${text.label}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  };
  await sheetContrast(paperSurface, "Anthropic");
  await page.getByRole("button", { name: "Close Anthropic settings" }).click();
  for (const connection of ["Ollama", "GitHub"] as const) {
    const providerRow = page.getByRole("button", { name: new RegExp(`^${connection}`) });
    await expect(providerRow).toBeVisible();
    await providerRow.click();
    const closedTab = page.getByRole("button", { name: `Open ${connection} settings` });
    await expect(closedTab).toHaveAttribute("aria-expanded", "false");
    await closedTab.click();
    await expect(page.getByRole("dialog", { name: `${connection} settings` })).toBeVisible();
    await sheetContrast(page.locator(".ym3c__sheet"), connection);
    await page.getByRole("button", { name: `Close ${connection} settings` }).click();
  }
  for (const text of paperText) {
    expect(
      contrastRatio(text.color, paperBackground),
      `Connections paper text contrast: ${text.label}`,
    ).toBeGreaterThanOrEqual(4.5);
  }

  await page.getByRole("button", { name: /^GitHub/ }).click();
  await page.getByRole("button", { name: "Open GitHub settings" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("connections-github.png"), fullPage: true });
});
