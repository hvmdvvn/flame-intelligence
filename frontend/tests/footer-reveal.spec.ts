import { expect, test, type Page } from "@playwright/test";

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function openPage(page: Page, route = "/") {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", /anchored|flow|reduced/);
  await settle(page);
}

async function reveal(page: Page, progress: number) {
  await page.locator(".footer-reveal").evaluate((root, value) => {
    const top = root.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - innerHeight + root.clientHeight * value, behavior: "instant" });
  }, progress);
  await settle(page);
}

async function sample(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".footer-reveal")!;
    const scene = root.querySelector("footer")!;
    const letters = [...root.querySelectorAll(".wordmark-letter")];
    return {
      top: scene.getBoundingClientRect().top,
      bottom: scene.getBoundingClientRect().bottom,
      edge: root.getBoundingClientRect().top,
      opacity: [...root.querySelectorAll(".footer-utility > *")].map(el => Number(getComputedStyle(el).opacity)),
      letters: letters.map(el => new DOMMatrix(getComputedStyle(el).transform).m42),
      sceneY: new DOMMatrix(getComputedStyle(scene).transform).m42,
    };
  });
}

test("the footer stays anchored, staggers its lettering and reverses with the scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPage(page);
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "anchored");
  await reveal(page, 0.22);
  const early = await sample(page);
  expect(early.letters[0]).toBeLessThan(early.letters.at(-1)!);
  await reveal(page, 0.58);
  const middle = await sample(page);
  expect(Math.abs(middle.top - early.top)).toBeLessThan(2);
  expect(Math.abs(middle.bottom - 1000)).toBeLessThan(2);
  expect(middle.opacity[0]).toBeGreaterThan(middle.opacity[2]);
  const layers = await page.evaluate(() => {
    const edge = document.querySelector(".footer-reveal")!.getBoundingClientRect().top;
    return {
      above: Boolean(document.elementFromPoint(10, edge - 4)?.closest(".page-curtain")),
      below: Boolean(document.elementFromPoint(10, edge + 4)?.closest(".footer-reveal")),
    };
  });
  expect(layers).toEqual({ above: true, below: true });
  await reveal(page, 1);
  const end = await sample(page);
  expect(end.opacity).toEqual([1, 1, 1]);
  expect(end.letters.every(y => Math.abs(y) < 0.01)).toBe(true);
  expect(Math.abs(end.sceneY)).toBeLessThan(0.01);
  await reveal(page, 0.58);
  const reversed = await sample(page);
  expect(reversed.opacity).toEqual(middle.opacity);
  expect(reversed.letters).toEqual(middle.letters);
  expect(reversed.top).toBeCloseTo(middle.top, 1);
  await reveal(page, 0);
  expect((await sample(page)).opacity).toEqual([0, 0, 0]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`the ${viewport.width}x${viewport.height} footer fits and keeps every link reachable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openPage(page);
    if (viewport.height < 600) await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "flow");
    if (viewport.height >= 600) await reveal(page, 1);
    const about = page.locator(".footer-brand");
    await about.scrollIntoViewIfNeeded();
    await settle(page);
    await expect(about).toBeInViewport();
    const brandPosition = await about.boundingBox();
    const headerPosition = await page.locator("header").boundingBox();
    expect(brandPosition!.y).toBeGreaterThanOrEqual(headerPosition!.height);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await settle(page);
    expect((await sample(page)).opacity).toEqual([1, 1, 1]);
    const fit = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      width: innerWidth,
      lettersFit: [...document.querySelectorAll(".wordmark-letter")].every(el => {
        const letter = el.getBoundingClientRect();
        const mask = el.closest(".wordmark-line")!.getBoundingClientRect();
        return letter.top >= mask.top - 1 && letter.bottom <= mask.bottom + 1
          && letter.left >= -1 && letter.right <= innerWidth + 1;
      }),
    }));
    expect(fit.page).toBeLessThanOrEqual(fit.width);
    expect(fit.lettersFit).toBe(true);
    await expect(page.getByRole("link", { name: /Back to top/ })).toBeInViewport();
  });
}

test("reduced motion is static, including when the preference changes live", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPage(page);
  await reveal(page, 0.3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "reduced");
  await settle(page);
  await expect.poll(async () => (await sample(page)).opacity).toEqual([1, 1, 1]);
  const reduced = await sample(page);
  expect(reduced.opacity).toEqual([1, 1, 1]);
  expect(reduced.sceneY).toBe(0);
  expect(reduced.letters.every(y => y === 0)).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "anchored");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "reduced");
});

test("keyboard focus exposes the footer without leaving links behind a mask", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPage(page, "/compare");
  await page.locator("main a, main button, main select, main input").last().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".footer-brand")).toBeFocused();
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "keyboard");
  await settle(page);
  await expect(page.locator(".footer-brand")).toBeInViewport();
  expect((await sample(page)).opacity).toEqual([1, 1, 1]);
});

test("resizing, content expansion and client navigation keep the reveal aligned", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPage(page);
  await page.locator(".integrity-copy summary").click();
  await settle(page);
  await reveal(page, 0.65);
  expect(Math.abs((await sample(page)).bottom - 1000)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".footer-reveal")).toHaveAttribute("data-footer-motion", "anchored");
  await reveal(page, 1);
  await page.getByRole("navigation", { name: "Footer navigation", exact: true }).getByRole("link", { name: "Publications" }).click();
  await expect(page).toHaveURL(/\/research$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText("source records");
  await settle(page);
  await reveal(page, 1);
  expect((await sample(page)).opacity).toEqual([1, 1, 1]);
  expect(Math.abs((await sample(page)).sceneY)).toBeLessThan(1);
});
