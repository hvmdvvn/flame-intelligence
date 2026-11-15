// Read-only checks of the published corpus, with one research query/report export.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const origin = process.argv[2];
if (!origin || new URL(origin).protocol !== "https:") throw new Error("Usage: node scripts/verify-deployment.mjs https://project.vercel.app");
const browser = await chromium.launch({headless:true, ...(process.platform === "win32" ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"} : {})});
const context = await browser.newContext({baseURL:origin, viewport:{width:1440,height:1000},acceptDownloads:true});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
const checks = [];
const qa = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../qa");
try {
  for (const endpoint of ["/api/health", "/api/ready", "/api/investigations?limit=1", "/api/sources"]) {
    const response = await context.request.get(`/service${endpoint}`, {timeout:60000});
    assert.equal(response.status(),200,endpoint);
    const body = await response.json();
    if(endpoint === "/api/ready") assert.equal(body.status,"ready");
    if(endpoint.startsWith("/api/investigations")) assert.equal(body.total,20);
    if(endpoint === "/api/sources") assert.equal(body.sources.length,40);
    checks.push({endpoint:`/service${endpoint}`,status:response.status()});
  }
  await page.goto("/investigations");
  await page.getByLabel("Search investigations").fill("BASS");
  await page.getByRole("link",{name:"BASS-II",exact:true}).first().waitFor();
  await page.getByRole("link",{name:"BASS-II",exact:true}).first().click();
  await page.getByRole("heading",{name:"Research objective",exact:true}).waitFor();
  checks.push({workflow:"investigation search and detail",passed:true});
  await page.goto("/missions");
  await page.getByLabel("Oxygen concentration").fill("30");
  await page.getByLabel("Total pressure").fill("70");
  await page.getByRole("button",{name:"Rank available investigations"}).click();
  await page.getByRole("heading",{name:"Ranked research evidence",exact:true}).waitFor();
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export reproducible report"}).click();
  const download=await downloadPromise;
  const report=JSON.parse(await readFile(await download.path(),"utf8"));
  assert.match(report.reproducibility_sha256,/^[0-9a-f]{64}$/);
  assert.equal(report.sources.length,40);
  assert.equal(report.ranking.rankings.length,20);
  checks.push({workflow:"mission ranking and source-complete scientific report",passed:true,report_sha256:report.reproducibility_sha256});
  await page.goto("/ask");
  await page.getByLabel("Scientific question").fill("How does confinement affect flame spread in microgravity?");
  const answerPromise = page.waitForResponse(response => response.url().includes("/service/api/ask") && response.request().method() === "POST");
  await page.getByRole("button",{name:/Retrieve evidence/i}).click();
  const answerResponse = await answerPromise;
  assert.equal(answerResponse.status(),200,"research assistant response");
  const answer = await answerResponse.json();
  assert.ok(answer.reported.length > 0,"source-reported findings");
  await page.getByRole("link",{name:/^Open passage/i}).first().click();
  await page.locator("mark.quote").waitFor();
  checks.push({workflow:"research question and cited evidence inspector",passed:true});
  await page.goto("/analytics");
  await page.getByRole("heading",{name:"Published numerical evidence"}).waitFor();
  checks.push({workflow:"published analytics and unavailable prediction",passed:true});
  await page.goto("/");
  await page.getByText("20",{exact:true}).first().waitFor();
  await page.screenshot({path:path.join(qa,"vercel-live-overview.png"),fullPage:true});
  assert.deepEqual(pageErrors,[]);
  const result={verified_at:new Date().toISOString(),origin,status:"passed",checks,page_errors:pageErrors,scope:"Live HTTPS/browser checks; no durable imports or model training performed."};
  await writeFile(path.join(qa,"vercel-live-checks.json"),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
} finally {
  await browser.close();
}
