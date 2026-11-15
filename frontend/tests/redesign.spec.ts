import { test, expect } from "@playwright/test";
import path from "node:path";

const ROUTES=["/","/investigations","/research","/compare","/analytics","/ask","/missions","/sources"];

test("mobile menu manages focus, escape, navigation and all eight destinations",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  const toggle=page.getByRole("button",{name:"Open navigation menu",exact:true});
  await toggle.click();
  const dialog=page.getByRole("dialog",{name:"Site navigation"});
  await expect(dialog).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded","true");
  for(const label of ["Overview","Investigations","Publications","Comparison","Analytics","Research assistant","Mission workspace","Sources & context"]){
    await expect(dialog.getByRole("link",{name:label,exact:true})).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await dialog.getByRole("link",{name:"Investigations",exact:true}).click();
  await expect(page).toHaveURL(/\/investigations/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("theme preference persists and light theme passes an automated accessibility check",async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  const theme=page.getByLabel("Theme",{exact:true}).first();
  await theme.selectOption("ember");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","ember");
  await theme.selectOption("daylight");
  await expect(page.locator("html")).toHaveAttribute("data-theme","daylight");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","daylight");
  await page.addScriptTag({path:path.resolve("node_modules/axe-core/axe.min.js")});
  const violations=await page.evaluate(async()=>{
    const axe=(window as unknown as {axe:{run:(context:unknown,options:unknown)=>Promise<{violations:unknown[]}>}}).axe;
    return (await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}})).violations;
  });
  expect(violations).toEqual([]);
});

test("signature footer is real readable text and respects reduced motion",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  const wordmark=page.locator("footer .signature-wordmark");
  await wordmark.scrollIntoViewIfNeeded();
  await expect(wordmark).toBeVisible();
  expect((await wordmark.innerText()).replace(/\s+/g," ").trim()).toBe("fire in free-fall");
  const metrics=await wordmark.evaluate(element=>({scrollWidth:element.scrollWidth,width:element.clientWidth,opacity:getComputedStyle(element).opacity}));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width+1);
  expect(metrics.opacity).toBe("1");
  const loops=await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations===Infinity&&Number(a.effect?.getTiming().duration)>1).length);
  expect(loops).toBe(0);
  await page.getByRole("link",{name:/Back to top/i}).click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(10);
});

for(const width of [320,390,430,768,1024,1440,1920]){
  test(`all eight routes fit a ${width}px viewport`,async({page})=>{
    test.setTimeout(90_000);
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({reducedMotion:"reduce"});
    for(const route of ROUTES){
      await page.goto(route);
      await expect(page.getByRole("heading",{level:1})).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      const metrics=await page.evaluate(()=>({width:window.innerWidth,page:document.documentElement.scrollWidth,main:document.querySelector("main")?.scrollWidth,footer:document.querySelector("footer .signature-wordmark")?.scrollWidth,footerWidth:document.querySelector("footer .signature-wordmark")?.clientWidth}));
      expect(metrics.page,`${route} page width at ${width}`).toBeLessThanOrEqual(width+1);
      expect(metrics.footer,`${route} footer lettering fit at ${width}`).toBeLessThanOrEqual((metrics.footerWidth??0)+1);
    }
  });
}
