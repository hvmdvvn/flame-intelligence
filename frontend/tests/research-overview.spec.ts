import { expect, test, type Page } from "@playwright/test";
import type { Stats } from "../lib/types";

async function corpus(page: Page) {
  const [stats, investigations] = await Promise.all([
    page.request.get("/service/api/stats"),
    page.request.get("/service/api/investigations?limit=1"),
  ]);
  const data = await stats.json() as Stats;
  return { data, metrics: [(await investigations.json()).total, data.papers, data.chunks, data.verified_measurements].map(String) };
}

async function showFraction(page: Page, selector: string, fraction: number) {
  await page.locator(selector).evaluate((root, visible) => {
    const box = root.getBoundingClientRect();
    scrollTo({ top: box.top + scrollY - innerHeight + box.height * visible, behavior: "instant" });
  }, fraction);
}

async function numbers(page: Page, selector: string) {
  return page.locator(`${selector} [data-count-to]`).allTextContents();
}

test("statistics begin at 30% visibility, count integers without shifting, and play once per visit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  const { metrics } = await corpus(page);
  await page.goto("/", { waitUntil: "networkidle" });
  const statistics = page.locator(".research-statistics");
  await expect(statistics).toHaveAttribute("data-animation", "waiting");
  expect(await numbers(page, ".research-statistics")).toEqual(["0", "0", "0", "0"]);
  const before = await statistics.evaluate(el => ({ height: el.clientHeight, nextTop: el.nextElementSibling!.getBoundingClientRect().top + scrollY }));
  await showFraction(page, ".research-statistics", 0.2);
  await page.waitForTimeout(150);
  await expect(statistics).toHaveAttribute("data-animation", "waiting");
  await showFraction(page, ".research-statistics", 0.45);
  await expect(statistics).toHaveAttribute("data-animation", "running");
  await page.waitForTimeout(650);
  const during = await numbers(page, ".research-statistics");
  expect(during.every(value => /^\d+$/.test(value))).toBe(true);
  expect(Number(during[2])).toBeGreaterThan(0);
  expect(Number(during[2])).toBeLessThan(Number(metrics[2]));
  expect(await statistics.locator("dd .sr-only").allTextContents()).toEqual(metrics);
  await expect(statistics).toHaveAttribute("data-animation", "complete");
  expect(await numbers(page, ".research-statistics")).toEqual(metrics);
  const after = await statistics.evaluate(el => ({ height: el.clientHeight, nextTop: el.nextElementSibling!.getBoundingClientRect().top + scrollY }));
  expect(after.height).toBe(before.height);
  expect(after.nextTop).toBeCloseTo(before.nextTop, 1);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await showFraction(page, ".research-statistics", 0.8);
  await expect(statistics).toHaveAttribute("data-animation", "complete");
  expect(await numbers(page, ".research-statistics")).toEqual(metrics);
  await page.reload({ waitUntil: "networkidle" });
  // A new page visit creates a new entrance, even when scroll position is restored.
  await expect(statistics).toHaveAttribute("data-animation", /waiting|running/);
});

test("topic fills and values cascade together, preserve proportions, and retain working search links", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { data } = await corpus(page);
  await page.goto("/", { waitUntil: "networkidle" });
  const topics = page.locator(".research-topics");
  await expect(topics).toHaveAttribute("data-animation", "waiting");
  const bars = () => topics.locator(".topic-fill").evaluateAll(elements => elements.map(el => new DOMMatrix(getComputedStyle(el).transform).a));
  expect((await bars()).every(scale => scale === 0)).toBe(true);
  expect(await numbers(page, ".research-topics")).toEqual(data.coverage.map(() => "0"));
  await showFraction(page, ".research-topics", 0.7);
  await expect(topics).toHaveAttribute("data-animation", "running");
  await page.waitForTimeout(900);
  const growing = await bars();
  expect(growing[0]).toBeGreaterThan(0);
  expect(growing[0]).toBeLessThan(1);
  expect(growing[0]).toBeGreaterThan(growing.at(-1)!);
  await expect(topics).toHaveAttribute("data-animation", "complete");
  expect(await numbers(page, ".research-topics")).toEqual(data.coverage.map(topic => String(topic.papers)));
  expect((await bars()).every(scale => scale === 1)).toBe(true);
  const widths = await topics.locator(".topic-fill").evaluateAll(elements => elements.map(el => parseFloat((el as HTMLElement).style.width)));
  const max = Math.max(...data.coverage.map(topic => topic.papers));
  widths.forEach((width, index) => expect(width).toBeCloseTo(data.coverage[index].papers / max * 100, 3));
  const first = topics.locator(".topic-list a").first();
  const background = await first.evaluate(el => getComputedStyle(el).backgroundColor);
  await first.hover();
  await page.waitForTimeout(350);
  expect(await first.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(background);
  expect(await first.locator(".topic-track").evaluate(el => new DOMMatrix(getComputedStyle(el).transform).d)).toBeGreaterThan(1);
  await first.click();
  await expect(page).toHaveURL(url => url.pathname === "/research" && url.searchParams.get("q") === data.coverage[0].term);
  await expect(page.getByLabel("Search titles, authors, and abstracts")).toHaveValue(data.coverage[0].term);
});

test("reduced motion keeps final values, complete bars and readable content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { data, metrics } = await corpus(page);
  await page.goto("/", { waitUntil: "networkidle" });
  for (const selector of [".research-statistics", ".research-topics"]) {
    await expect(page.locator(selector)).toHaveAttribute("data-animation", "reduced");
  }
  expect(await numbers(page, ".research-statistics")).toEqual(metrics);
  expect(await numbers(page, ".research-topics")).toEqual(data.coverage.map(topic => String(topic.papers)));
  const styles = await page.locator(".topic-fill, .topic-title-line, .metric-item, .topics-grid").evaluateAll(elements => elements.map(el => ({ opacity: getComputedStyle(el).opacity, transform: new DOMMatrix(getComputedStyle(el).transform).toString() })));
  expect(styles.every(style => style.opacity === "1" && style.transform === "matrix(1, 0, 0, 1, 0, 0)")).toBe(true);
});

test("changing motion preference mid-count immediately settles both sections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  const { data, metrics } = await corpus(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await showFraction(page, ".research-statistics", 0.6);
  await expect(page.locator(".research-statistics")).toHaveAttribute("data-animation", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".research-statistics")).toHaveAttribute("data-animation", "reduced");
  await expect(page.locator(".research-topics")).toHaveAttribute("data-animation", "reduced");
  expect(await numbers(page, ".research-statistics")).toEqual(metrics);
  expect(await numbers(page, ".research-topics")).toEqual(data.coverage.map(topic => String(topic.papers)));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await showFraction(page, ".research-statistics", 0.8);
  expect(await numbers(page, ".research-statistics")).toEqual(metrics);
});

test("keyboard navigation reveals topic links without waiting for their animation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  const { data } = await corpus(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".research-topics")).toHaveAttribute("data-animation", "waiting");
  await page.locator(".workflow-link").last().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".topics-intro .text-link")).toBeFocused();
  await expect(page.locator(".research-topics")).toHaveAttribute("data-animation", "complete");
  expect(await numbers(page, ".research-topics")).toEqual(data.coverage.map(topic => String(topic.papers)));
});

test("loading placeholders fit the viewport and reserve the final section height", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/service/api/stats", async route => { await gate; await route.continue(); });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Loading research topics" })).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    const height = await page.locator(".topics-grid").evaluate(el => el.clientHeight);
    release();
    await expect(page.locator(".topic-list li")).toHaveCount(9);
    expect(await page.locator(".topics-grid").evaluate(el => el.clientHeight)).toBe(height);
  } finally { release(); }
});

for (const width of [320, 390]) {
  test(`mobile sections fit ${width}px with two statistics columns and accessible topic links`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".research-statistics")).toHaveAttribute("data-animation", "reduced");
    const cards = await page.locator(".metric-item").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
    expect(cards[0].y).toBe(cards[1].y);
    expect(cards[2].y).toBe(cards[3].y);
    expect(cards[2].y).toBeGreaterThan(cards[0].y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const links = page.locator(".topic-list a");
    for (const link of await links.all()) {
      await expect(link).toHaveAccessibleName(/\d+ publications$/);
      const size = await link.boundingBox();
      expect(size!.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("a missing stats response stays unavailable and retry restores real values", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { metrics } = await corpus(page);
  await page.route("**/service/api/stats", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  expect(await page.locator(".metric-number").allTextContents()).toEqual([metrics[0], "N/A", "N/A", "N/A"]);
  await expect(page.getByText("Research topics are unavailable. Try again above.")).toBeVisible();
  await page.unroute("**/service/api/stats");
  await page.getByRole("button", { name: /Try again/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect.poll(() => numbers(page, ".research-statistics")).toEqual(metrics);
  await expect(page.locator(".topic-list li")).toHaveCount(9);
});
