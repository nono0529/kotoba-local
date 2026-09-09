import { chromium, webkit, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/screenshots',{recursive:true});
for(const mobile of [true,false]){
 const browser=mobile?await webkit.launch():await chromium.launch({channel:'msedge'});
 const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1080}});
 const page=await context.newPage();await page.goto('http://localhost:4173/');await page.getByRole('button',{name:'开始学新词'}).waitFor();await page.screenshot({path:`docs/screenshots/${mobile?'iphone':'desktop'}-home.png`,fullPage:!mobile});
 console.log(mobile?'iPhone':'Desktop',await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth})));
 if(mobile){await page.getByRole('button',{name:'开始学新词'}).click();await page.getByRole('button',{name:'查看释义'}).click();await page.screenshot({path:'docs/screenshots/iphone-study.png',fullPage:false});await page.getByRole('button',{name:'暂停学习'}).click();await page.getByRole('button',{name:'词书',exact:true}).click();await page.screenshot({path:'docs/screenshots/iphone-books.png',fullPage:true});}
 await browser.close();
}
