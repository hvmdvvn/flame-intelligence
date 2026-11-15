import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";

test("researcher discovers source-linked investigations and compares objectives", async ({ page }) => {
  await page.goto("/investigations");
  await expect(page.getByRole("heading", { name: "Investigations" })).toBeVisible();
  await expect(page.getByTestId("investigation-results")).toBeVisible();
  const searchResponse=page.waitForResponse(r => r.url().includes("q=BASS") && r.ok());
  await page.getByLabel("Search investigations").fill("BASS");
  await searchResponse;
  await expect(page.getByRole("status").last()).toContainText("matching investigations");
  const checks = page.getByRole("checkbox");
  await expect(checks.first()).toBeVisible();
  await checks.nth(0).check();
  await checks.nth(1).check();
  await expect(page.getByText(/^Qualitative comparison\. Shared topics/)).toBeVisible();
  await expect(page.getByRole("table").last()).toContainText("objective");
  await page.getByRole("link", { name: "BASS", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Research objective", exact: true })).toBeVisible();
  await expect(page.getByText("No authenticated experimental files have been imported", { exact: false })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export metadata and provenance" }).click();
  expect((await download).suggestedFilename()).toMatch(/metadata\.json$/);
});

test("mission ranking explains uncertainty and exports a reproducible configuration", async ({ page }) => {
  await page.goto("/missions");
  await page.getByLabel("Oxygen concentration").fill("30");
  await page.getByLabel("Total pressure").fill("70");
  await page.getByRole("button", { name: "Rank available investigations" }).click();
  await expect(page.getByRole("heading", { name: "Ranked research evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence gaps" })).toBeVisible();
  await page.getByText("Inspect scoring, missing data, and limitations").first().click();
  await expect(page.getByRole("table").first()).toContainText("Atmospheric similarity");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText("Research configuration saved in this browser.", { exact: true })).toBeVisible();
  await page.getByLabel("Oxygen concentration").fill("25");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByLabel("Oxygen concentration")).toHaveValue("30");
  await page.getByRole("button", { name: "Rank available investigations" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export reproducible report" }).click();
  const reportFile=await download;
  expect(reportFile.suggestedFilename()).toBe("flame-mission-research-report.json");
  const report=JSON.parse(await readFile((await reportFile.path())!,"utf8"));
  expect(report.reproducibility_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.sources.length).toBeGreaterThan(0);
});

test("analytics preserves published evidence classes and declares predictions unavailable", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Published numerical evidence" })).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("model prediction");
  await expect(page.getByRole("table").first()).toContainText("directly observed result");
  await expect(page.getByText("Prediction remains unavailable", { exact: false })).toBeVisible();
});

test("historical context distinguishes the Apollo 13 mechanism", async ({ page }) => {
  await page.goto("/sources");
  await page.getByRole("button", { name: "Historical incidents" }).click();
  await expect(page.getByText("Apollo 13 involved an oxygen-tank failure and explosion.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Apollo 13/ })).toBeVisible();
  const apolloSource=page.locator("article").filter({has:page.getByRole("heading",{name:/Apollo 13/})}).getByRole("link").first();
  const sourceHref=await apolloSource.getAttribute("href");
  await apolloSource.click();
  await expect(page.locator(`[id="${decodeURIComponent(sourceHref!.split("#")[1])}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Earth applications" }).click();
  await expect(page.getByRole("heading", { name: "Documented technology transfer" })).toBeVisible();
});

test("research assistant links extractive evidence to the original passage", async ({ page }) => {
  await page.goto("/ask");
  await page.getByLabel("Scientific question").fill("How does confinement affect flame spread in microgravity?");
  await page.getByRole("button", {name:"Retrieve evidence"}).click();
  const passage=page.getByRole("link", {name:"Open passage"}).first();
  await expect(passage).toBeVisible();
  await passage.click();
  await expect(page.getByText("PASSAGE LENS", {exact:true})).toBeVisible();
  await expect(page.getByRole("link", {name:"Official record",exact:true})).toHaveAttribute("href", /^https:\/\/ntrs\.nasa\.gov\//);
  await expect(page.locator("mark.quote")).toBeVisible();
});

test("comparison gate rejects mismatched gravity and evidence classes", async ({ page }) => {
  await page.goto("/compare");
  await expect(page.getByLabel("Left study")).toBeVisible();
  await page.getByRole("button", {name:"Check comparison"}).click();
  await expect(page.getByText("Comparison unavailable", {exact:true})).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("normal_gravity");
});

test("mobile navigation remains usable and keyboard skip reaches main content", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:"Skip to main content"})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("button",{name:"Open navigation menu",exact:true}).click();
  await page.getByRole("dialog",{name:"Site navigation"}).getByRole("link",{name:"Investigations",exact:true}).click();
  await expect(page.getByRole("heading", {name:"Investigations"})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("search failures provide a working retry", async ({ page }) => {
  let fail = true;
  await page.route("**/api/investigations?**", async route => {
    if(fail) await route.fulfill({status:503,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"http://127.0.0.1:3011"},body:JSON.stringify({error:{message:"Temporary registry outage"}})});
    else await route.continue();
  });
  await page.goto("/investigations");
  await expect(page.getByRole("alert").filter({hasText:"Temporary registry outage"})).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("investigation-results")).toBeVisible();
});

for (const route of ["/", "/investigations", "/missions", "/sources", "/analytics", "/ask", "/research", "/compare"]) {
  test(`accessibility scan ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if(route === "/investigations") await expect(page.getByTestId("investigation-results")).toBeVisible();
    if(route === "/sources") await expect(page.locator("article").first()).toBeVisible();
    if(route === "/analytics") await expect(page.getByRole("heading",{name:"Published numerical evidence"})).toBeVisible();
    await page.addScriptTag({ path: path.resolve("node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
      return (await axe.run(document, { runOnly: {type:"tag", values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]} })).violations;
    });
    expect(violations).toEqual([]);
    if(route === "/" || route === "/missions") {
      await page.setViewportSize({width:1440,height:1000});
      await page.screenshot({path:route === "/" ? "../qa/frontend-overview.png" : "../qa/frontend-mission-workspace.png",fullPage:true});
    }
  });
}
