import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('button',{name:'开始学新词'})).toBeVisible();});
test('learn, favorite, undo, resume and saved data after reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'开始学新词'}).click();await expect(page.locator('.study-word')).toBeVisible();
 const word=await page.locator('.study-word').textContent();await page.getByRole('button',{name:'收藏单词',exact:true}).click();
 await page.getByRole('button',{name:'查看释义'}).click();await expect(page.locator('.examples')).toBeVisible();
 await page.getByRole('button',{name:/记住了/}).click();await expect(page.locator('.study-header')).toContainText('1 / 20');
 await page.getByRole('button',{name:'撤销上次评分'}).click();await expect(page.locator('.study-word')).toHaveText(word);
 await page.getByRole('button',{name:'查看释义'}).click();await page.getByRole('button',{name:/记住了/}).click();
 await expect(page.locator('.study-header')).toContainText('1 / 20');const second=await page.locator('.study-word').textContent();await page.reload();await expect(page.locator('.study-word')).toHaveText(second);
 await page.getByRole('button',{name:'暂停学习'}).click();await expect(page.getByRole('button',{name:/继续上次学习/})).toBeVisible();
 await page.getByRole('button',{name:'单词本',exact:true}).click();await expect(page.locator('.word-row').first()).toContainText(word);
 await page.locator('.word-row').first().click();await page.locator('#word-note').fill('记住今天的第一个词');await page.getByRole('button',{name:'保存笔记'}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();await page.locator('.word-row').first().click();await expect(page.locator('#word-note')).toHaveValue('记住今天的第一个词');
 expect(errors).toEqual([]);
});
test('books, Chinese search, kana quiz, settings and theme',async({page})=>{
 await page.getByRole('button',{name:'词书',exact:true}).click();await expect(page.locator('.book-tile')).toHaveCount(5);
 await page.getByRole('button',{name:'浏览',exact:true}).first().click();await page.getByRole('searchbox').fill('猫');await expect(page.locator('.word-row').first()).toBeVisible();
 await page.getByRole('button',{name:'今日',exact:true}).click();await page.getByRole('button',{name:'打开五十音'}).click();await expect(page.locator('.kana-cell')).toHaveCount(104);await page.getByRole('button',{name:'片假名',exact:true}).click();await expect(page.locator('.kana-cell').first()).toContainText('ア');await page.getByRole('button',{name:'随机测一测'}).click();await expect(page.locator('.quiz-options button')).toHaveCount(4);await page.locator('.quiz-options button').first().click();await expect(page.locator('#quiz-feedback')).not.toBeEmpty();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'我的',exact:true}).click();await page.locator('#goal').selectOption('5');await page.locator('#theme').check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await expect(page.locator('#goal')).toHaveValue('5');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('CSV import, spelling, completion, backup export and restore',async({page})=>{
 await page.getByRole('button',{name:'词书',exact:true}).click();await page.getByRole('button',{name:'导入词书',exact:true}).click();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'选择词书文件'}).click();await (await chooser).setFiles({name:'我的测试词.csv',mimeType:'text/csv',buffer:Buffer.from('word,reading,meaning,sentence,translation\n猫,ねこ,猫,猫がいます。,有猫。')});
 await expect(page.locator('dialog')).toContainText('准备导入 1 词');await page.getByRole('button',{name:'导入并开始学习'}).click();
 await page.getByRole('button',{name:'假名拼写',exact:true}).click();await page.getByRole('textbox',{name:'输入假名'}).fill('ネコ');await page.getByRole('button',{name:'检查答案'}).click();await expect(page.locator('.answer-feedback')).toContainText('假名写对了');await page.getByRole('button',{name:/记住了/}).click();await expect(page.locator('.completion')).toBeVisible();await page.getByRole('button',{name:'回到今日'}).click();
 await page.getByRole('button',{name:'开始学新词'}).click();await page.getByRole('button',{name:'查看释义'}).click();await page.getByRole('button',{name:/很熟悉/}).click();await page.getByRole('button',{name:'回到今日'}).click();await page.getByRole('button',{name:'我的',exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true}));
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份',exact:true}).click();const saved=await download;const filePath=await saved.path();
 const restore=page.waitForEvent('filechooser');await page.getByRole('button',{name:'恢复备份'}).click();await (await restore).setFiles(filePath);await expect(page.locator('dialog')).toContainText('备份包含 1 个已学词');await page.getByRole('button',{name:'确认恢复此备份'}).click();await expect(page.locator('.book-current')).toContainText('我的测试词');
});
test('production shell, all books and learned state work after server stops and page closes',async({page,context})=>{
 const server=spawn(process.execPath,['scripts/server.mjs','--test'],{env:{...process.env,PORT:'4174'},windowsHide:true});
 try{
 await new Promise((resolve,reject)=>{server.on('error',reject);server.on('exit',c=>{if(c)reject(new Error('Test server failed'))});server.stdout.on('data',d=>{if(d.toString().includes('Kotoba is ready'))resolve();});});
 await page.goto('http://localhost:4174/');await page.getByRole('button',{name:'我的',exact:true}).click();await expect(page.locator('#offline-status')).toContainText('离线已就绪',{timeout:40000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.getByRole('button',{name:'今日',exact:true}).click();await page.getByRole('button',{name:'开始学新词'}).click();await page.getByRole('button',{name:'查看释义'}).click();await page.getByRole('button',{name:/记住了/}).click();await expect(page.locator('.study-header')).toContainText('1 / 20');const second=await page.locator('.study-word').textContent();
 const exited=once(server,'exit');server.kill();await exited;await page.close();
 const reopened=await context.newPage();const response=await reopened.goto('http://localhost:4174/#study');expect(response.fromServiceWorker()).toBe(true);await expect(reopened.locator('.study-word')).toHaveText(second);await reopened.getByRole('button',{name:'暂停学习'}).click();await reopened.getByRole('button',{name:'词书',exact:true}).click();await expect(reopened.locator('.book-tile')).toHaveCount(5);await reopened.getByRole('button',{name:'浏览',exact:true}).last().click();await reopened.getByRole('searchbox').fill('昭和');await expect(reopened.locator('.word-row')).toHaveCount(1);
 }finally{if(server.exitCode===null&&!server.killed)server.kill();}
});
test('invalid backup rejected, HTML imports treated as text, no accidental code execution',async({page})=>{
 await page.getByRole('button',{name:'我的',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'恢复备份'}).click();await (await chooser).setFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"app":"kotoba-local","version":1,"state":{}}')});await expect(page.locator('#toast')).toContainText('备份格式');await expect(page.locator('#goal')).toHaveValue('20');
});

test('automatic speech once per card, broad tap area, and independent practice resume',async({page})=>{
 await page.addInitScript(()=>{
   window.spoken=[];
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'ja-JP',voiceURI:'test-ja',localService:true}],cancel:()=>{},speak:u=>window.spoken.push(u.text)}});
   Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
 });
 await page.reload();await page.getByRole('button',{name:'开始学新词'}).click();
 await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(1);
 const first=await page.locator('.study-word').textContent();
 await page.locator('.word-stage').click({position:{x:8,y:8}});await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(2);
 await page.getByRole('button',{name:'朗读当前单词'}).click();await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(3);
 await page.getByRole('button',{name:'查看释义'}).click();expect(await page.evaluate(()=>window.spoken.length)).toBe(3);
 await page.getByRole('button',{name:/记住了/}).click();await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(4);
 const second=await page.locator('.study-word').textContent();expect(second).not.toBe(first);
 await page.getByRole('button',{name:'暂停学习'}).click();await page.getByRole('button',{name:'假名拼写',exact:true}).click();
 await expect(page.locator('#spelling')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(4);
 const prompt=await page.locator('.write-prompt').textContent();await page.locator('#spelling').fill('テスト');expect(await page.evaluate(()=>window.spoken.length)).toBe(4);
 await page.getByRole('button',{name:'暂停学习'}).click();await page.getByRole('button',{name:/继续上次学习/}).click();await expect(page.locator('.study-word')).toHaveText(second);await expect(page.locator('.study-header')).toContainText('1 / 20');
 await page.getByRole('button',{name:'暂停学习'}).click();await page.getByRole('button',{name:'继续假名拼写',exact:true}).click();await expect(page.locator('.write-prompt')).toHaveText(prompt);await page.waitForURL('**/#study');await page.reload();await expect(page.locator('.write-prompt')).toHaveText(prompt);
 await page.getByRole('button',{name:'直接看答案'}).click();await page.getByRole('button',{name:/记住了/}).click();await expect(page.locator('.completion')).toBeVisible();
 await page.getByRole('button',{name:'回到今日'}).click();await page.getByRole('button',{name:/继续上次学习/}).click();await expect(page.locator('.study-word')).toHaveText(second);await page.waitForURL('**/#study');await page.reload();await expect(page.locator('.study-word')).toHaveText(second);await expect(page.locator('.study-header')).toContainText('1 / 20');
});

test('daily target permits extra groups without changing the goal',async({page})=>{
 await page.getByRole('button',{name:'我的',exact:true}).click();await page.locator('#goal').selectOption('5');await page.getByRole('button',{name:'今日',exact:true}).click();await page.getByRole('button',{name:'开始学新词'}).click();
 const seen=new Set();
 for(let i=0;i<5;i++){
  await expect(page.locator('.study-header')).toContainText(`${i} / 5`);seen.add(await page.locator('.study-word').textContent());
  await page.getByRole('button',{name:'查看释义'}).click();await page.getByRole('button',{name:/记住了/}).click();
 }
 await expect(page.locator('.completion')).toBeVisible();await page.getByRole('button',{name:'回到今日'}).click();await page.getByRole('button',{name:'继续学新词'}).click();
 await expect(page.locator('.study-header')).toContainText('0 / 5');expect(seen.has(await page.locator('.study-word').textContent())).toBe(false);
 for(let i=0;i<5;i++){await expect(page.locator('.study-header')).toContainText(`${i} / 5`);await page.getByRole('button',{name:'查看释义'}).click();await page.getByRole('button',{name:/记住了/}).click();}
 await expect(page.locator('.completion')).toBeVisible();await page.getByRole('button',{name:'继续学新词'}).click();await expect(page.locator('.study-header')).toContainText('0 / 5');
 await page.getByRole('button',{name:'暂停学习'}).click();await expect(page.locator('.daily-numbers')).toContainText('10');await page.getByRole('button',{name:'我的',exact:true}).click();await expect(page.locator('#goal')).toHaveValue('5');
});
