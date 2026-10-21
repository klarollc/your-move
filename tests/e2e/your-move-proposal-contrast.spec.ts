import { expect, test, type Locator } from "@playwright/test";

import { routeHostedApi, signIn, streetDrafts } from "../support/your-move-hosted.js";

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

test("@e2e Your Move renders readable, explicit proposal decisions on the daylight surface", async ({
  page,
}, testInfo) => {
  await routeHostedApi(page);

  await signIn(page);
  await page.getByRole("button", { name: "List", exact: true }).click();
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

/**
 * Every visible text node on a surface, measured against the nearest painted background behind it.
 * Disabled controls are exempt (WCAG 1.4.3), as are visually hidden labels.
 */
async function surfaceContrast(surface: Locator, label: string) {
  const samples = await surface.evaluate((root) => {
    const painted = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        const background = getComputedStyle(node).backgroundColor;
        if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") return background;
      }
      return "rgb(255, 255, 255)";
    };
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        "h1, h2, h3, p, span, strong, li, label, button, a, blockquote, time, pre, td, th",
      ),
    )
      .filter((node) => node.getClientRects().length > 0 && node.textContent?.trim())
      .filter((node) => !(node as HTMLButtonElement).disabled)
      .filter((node) => !node.closest(".ym3__visually-hidden"))
      .map((node) => ({
        text: node.textContent!.trim().replace(/\s+/g, " ").slice(0, 80),
        color: getComputedStyle(node).color,
        background: painted(node),
      }));
  });
  expect(samples.length, `${label} has measurable text`).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(
      contrastRatio(sample.color, sample.background),
      `${label} contrast: ${sample.text}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
}

test("@e2e Your Move slip, status line, street sheet, queue strip, and draft sheet meet contrast", async ({
  page,
}) => {
  await routeHostedApi(page, streetDrafts);
  await signIn(page);

  await surfaceContrast(
    page.getByRole("region", { name: "New work", exact: true }),
    "New Work slip",
  );
  await surfaceContrast(page.locator(".ym3__status-line"), "Status line");
  await surfaceContrast(page.getByRole("region", { name: "Queue" }), "Queue strip");

  await page
    .getByRole("group", { name: "The street" })
    .getByRole("button", { name: "Add a setup section — Review a proposed change" })
    .click();
  const sheet = page.getByRole("region", { name: "Add a setup section" });
  await expect(sheet).toBeVisible();
  await surfaceContrast(sheet, "Correspondence sheet");
  await surfaceContrast(page.getByRole("region", { name: "Queue" }), "Queue strip, selected row");

  await page.getByLabel(/What should get done/).fill("Add a changelog page to the docs site");
  await page.getByRole("button", { name: "Draft it" }).click();
  const draft = page.getByRole("region", { name: "New work draft" });
  await expect(draft).toBeVisible();
  await surfaceContrast(draft, "Draft sheet");
  await surfaceContrast(page.getByRole("region", { name: "New work", exact: true }), "Held slip");
  await draft.getByRole("button", { name: "Approve draft" }).click();
  await surfaceContrast(draft, "Draft sheet approval confirmation");
});
