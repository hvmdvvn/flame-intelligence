import { chromium } from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const mode=process.argv[2] ?? 'reference';
const origin=process.env.AUDIT_ORIGIN ?? 'http://127.0.0.1:3000';
const out=path.resolve('../qa/redesign',mode);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const reports=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
  const page=await context.newPage();
  const record=async(label,url,width,height)=>{
    await page.setViewportSize({width,height});
    const response=await page.goto(url,{waitUntil:'networkidle',timeout:60000});
    await page.locator('h1').first().waitFor({timeout:15000}).catch(()=>{});
    await page.screenshot({path:path.join(out,`${label}-${width}.png`),fullPage:true});
    const info=await page.evaluate(()=>({title:document.title,url:location.href,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fonts:[...new Set([...document.querySelectorAll('h1,h2,footer,p,a')].map(n=>getComputedStyle(n).fontFamily))],headings:[...document.querySelectorAll('h1,h2')].slice(0,12).map(n=>({text:n.textContent,fontSize:getComputedStyle(n).fontSize,fontWeight:getComputedStyle(n).fontWeight,lineHeight:getComputedStyle(n).lineHeight})),footer:document.querySelector('footer')?.innerText,buttons:[...document.querySelectorAll('button')].slice(0,15).map(n=>({text:n.innerText,ariaLabel:n.getAttribute('aria-label')})),animations:document.getAnimations().map(a=>({playState:a.playState,duration:a.effect?.getTiming().duration,target:a.effect?.target?.tagName})).slice(0,20)}));
    reports.push({label,status:response?.status(),...info});
  };
  if(mode==='reference'){
    await record('reference','https://bleckbl.vercel.app/',1440,1000);
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    await page.screenshot({path:path.join(out,'reference-footer-1440.png')});
    await record('reference','https://bleckbl.vercel.app/',390,844);
    const menu=page.getByRole('button',{name:'Open menu'});
    if(await menu.isVisible()){
      await menu.click();
      reports.push({label:'reference-mobile-menu',dialog:await page.locator('[role="dialog"]').count(),buttons:await page.locator('button').evaluateAll(nodes=>nodes.slice(0,8).map(n=>({label:n.getAttribute('aria-label'),expanded:n.getAttribute('aria-expanded')}))),content:(await page.locator('body').innerText()).slice(0,1500)});
      await page.screenshot({path:path.join(out,'reference-menu-390.png')});
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('https://bleckbl.vercel.app/',{waitUntil:'networkidle'});
    for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=800){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(100);}
    await page.screenshot({path:path.join(out,'reference-scrolled-1440.png'),fullPage:true});
    reports.push({label:'reference-footer-details',styles:await page.locator('footer').evaluate(n=>[...n.querySelectorAll('*')].map(c=>({tag:c.tagName,text:c.textContent?.trim().slice(0,50),size:getComputedStyle(c).fontSize,font:getComputedStyle(c).fontFamily,transform:getComputedStyle(c).transform})).filter(c=>parseFloat(c.size)>50))});
  }else{
    for(const route of ['/','/investigations','/research','/compare','/analytics','/ask','/missions','/sources']){
      const label=route==='/'?'overview':route.slice(1);
      for(const [width,height] of [[1440,1000],[390,844]]) await record(label,origin+route,width,height);
    }
  }
  await writeFile(path.join(out,'inspection.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}
