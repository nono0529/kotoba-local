import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, currentSession, setSession, migrateState, shuffle, makeSession, grade, stats, nextCard, acceptsReading, parseWordImport, validateBackup, dayKey } from '../src/core.js';
const now=new Date('2026-09-09T10:00:00+08:00');
const words=[{id:'a',book:'N5',word:'猫',reading:'ねこ',meaning:'猫'},{id:'b',book:'N5',word:'犬',reading:'いぬ',meaning:'狗'},{id:'c',book:'N4',word:'駅',reading:'えき',meaning:'车站'}];
test('new-word goal, persisted scheduling, and cross-book due queue',()=>{
 let s=initialState();s.settings.goal=1;s.session=makeSession(s,words,'learn','recognize',now,()=>0.999);assert.deepEqual(s.session.queue,['a']);
 s=grade(s,'a',3,now);assert.equal(s.session.completed,1);assert.equal(stats(s,words,now).newToday,1);assert.deepEqual(makeSession(s,words,'learn','recognize',now,()=>0.999).queue,['b']);
 const later=new Date(new Date(s.cards.a.due).getTime()+1000);s.settings.book='N4';s.session=makeSession(s,words,'review','recognize',later);assert.deepEqual(s.session.queue,['a']);
 s=grade(s,'a',3,later);assert.equal(stats(s,words,later).newToday,1);assert.equal(stats(s,words,later).reviewedToday,1);assert.ok(new Date(s.cards.a.due)>later);assert.equal(s.cards.a.reps,2);
});
test('forgotten words reappear and old state remains immutable',()=>{
 const s=initialState();s.session=makeSession(s,words,'learn','recognize',now,()=>0.999);const next=grade(s,'a',1,now);assert.deepEqual(next.session.queue,['b','a']);assert.equal(next.session.completed,0);assert.equal(s.cards.a,undefined);assert.equal(s.session.queue[0],'a');
 assert.throws(()=>grade(next,'a',3,now));const good=grade(next,'b',3,now);assert.deepEqual(good.session.queue,['a']);assert.equal(good.session.completed,1);
});
test('all four FSRS outcomes survive JSON round trip',()=>{
 for(const rating of [1,2,3,4]){let c=nextCard(null,rating,now).card;assert.ok(c.due>now);c=JSON.parse(JSON.stringify(c));const date=new Date(c.due);const n=nextCard(c,3,date).card;assert.ok(n.due>date);assert.ok(Number.isFinite(n.stability));}
});
test('practice never changes real scheduling or daily statistics',()=>{
 const s=initialState();s.session=makeSession(s,words,'practice','write',now,()=>0.999);const n=grade(s,'a',1,now);assert.equal(n.session.completed,1);assert.deepEqual(n.cards,{});assert.equal(n.logs.length,0);
});
test('kana normalization accepts katakana and halfwidth without fuzzy wrong readings',()=>{
 const w={reading:'コーヒー'};assert.ok(acceptsReading('ｺｰﾋｰ',w));assert.ok(acceptsReading('こーひー',w));assert.ok(!acceptsReading('こひ',w));assert.ok(!acceptsReading('',w));assert.ok(acceptsReading('いちにち',{reading:'ついたち／いちにち'}));assert.ok(!acceptsReading('きて',{reading:'きって'}));
});
test('CSV supports BOM, quotes, commas, CRLF, multiline fields and rejects missing columns',()=>{
 const rows=parseWordImport('\uFEFFword,reading,meaning,sentence,translation\r\n猫,ねこ,"猫, 小猫","猫が\nいます。",有猫\r\n','words.csv','custom-test');assert.equal(rows.length,1);assert.equal(rows[0].meaning,'猫, 小猫');assert.equal(rows[0].examples[0].ja,'猫が\nいます。');
 assert.throws(()=>parseWordImport('word,meaning\n猫,猫','a.csv','custom-test'));assert.throws(()=>parseWordImport('word,reading,meaning\n猫,ねこ,"坏','a.csv','custom-test'));
 const zh=parseWordImport('日语,假名,中文\n犬,いぬ,狗','a.csv','custom-test');assert.equal(zh[0].reading,'いぬ');
});
test('backups preserve progress and imports, reject corruption and prototype keys',()=>{
 let s=initialState();s.session=makeSession(s,words,'learn','recognize',now,()=>0.999);s=grade(s,'a',3,now);s.favorites=['a'];s.notes.a='猫的联想';s.customBooks=[{id:'custom-1',name:'我的词'}];s.customWords=parseWordImport('[{"word":"猫","reading":"ねこ","meaning":"猫"}]','a.json','custom-1');
 const backup={app:'kotoba-local',version:1,state:s};const restored=validateBackup(JSON.parse(JSON.stringify(backup)));assert.deepEqual(restored.cards,s.cards);assert.deepEqual(restored.notes,s.notes);assert.equal(restored.session,null);assert.equal(restored.customWords.length,1);
 for(const edit of [b=>b.state.cards.a.due='bad',b=>b.state.settings.goal=-1,b=>b.state.logs[0].rating=10,b=>b.state.cards.a.stability=-1,b=>b.state.favorites=['__proto__'],b=>b.state.customWords[0].reading=null]){const bad=structuredClone(backup);edit(bad);assert.throws(()=>validateBackup(bad));}
});
test('new daily quota resets at local date, mastered/streak are based on real logs',()=>{
 let s=initialState();s.settings.goal=1;s.session=makeSession(s,words,'learn','recognize',now,()=>0.999);s=grade(s,'a',4,now);
 const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);assert.equal(stats(s,words,tomorrow).newToday,0);assert.deepEqual(makeSession(s,words,'learn','recognize',tomorrow).queue,['b']);assert.equal(stats(s,words,tomorrow).streak,1);assert.notEqual(dayKey(now),dayKey(tomorrow));
});
test('shipped dictionary has unique IDs, complete fields, all five levels, and text-only examples',async()=>{
 const data=JSON.parse(await readFile('public/data/words.json','utf8'));const books=JSON.parse(await readFile('public/data/books.json','utf8'));assert.equal(data.length,10641);assert.equal(new Set(data.map(w=>w.id)).size,data.length);
 for(const b of books)assert.equal(data.filter(w=>w.book===b.id).length,b.count);
 for(const w of data){assert.ok(w.word&&w.reading&&w.meaning);assert.ok(!/<script|<ruby|\[sound:/i.test(JSON.stringify(w)));assert.ok(w.examples.length>0);}
});

test('practice slots and migration preserve learning independently',()=>{
 let s=initialState();s.session=makeSession(s,words,'learn','recognize',now,()=>0.999);
 const original=structuredClone(s.session);
 s=setSession(s,'practice-write',makeSession(s,words,'practice','write',now,()=>0.999));
 s=grade(s,'a',3,now);assert.deepEqual(s.session,original);assert.equal(currentSession(s).completed,1);assert.equal(s.logs.length,0);
 s=setSession(s,'practice-listen',makeSession(s,words,'practice','listen',now,()=>0.999));s=grade(s,'a',1,now);assert.equal(s.practiceSessions['practice-write'].completed,1);
 s.activeSessionKey='study';s=grade(s,'a',3,now);assert.equal(s.logs.length,1);assert.equal(s.practiceSessions['practice-write'].completed,1);
 const legacy=initialState();delete legacy.experienceVersion;legacy.session=makeSession(legacy,words,'practice','write',now);legacy.settings.autoAudio=false;
 const migrated=migrateState(legacy);assert.equal(migrated.session,null);assert.deepEqual(currentSession(migrated),legacy.session);assert.equal(migrated.settings.autoAudio,true);
 migrated.settings.autoAudio=false;assert.equal(migrateState(migrated).settings.autoAudio,false);
 const backup=validateBackup({app:'kotoba-local',version:1,state:s});assert.deepEqual(backup.practiceSessions,{});
});
test('shuffle is a permutation, leaves source intact, and persisted queue stays stable',()=>{
 const ids=['a','b','c','d'];assert.deepEqual(shuffle(ids,()=>0),['b','c','d','a']);assert.deepEqual(ids,['a','b','c','d']);
 const s=initialState();s.session=makeSession(s,words,'learn','recognize',now,()=>0);assert.deepEqual(s.session.queue,['b','a']);assert.deepEqual(migrateState(JSON.parse(JSON.stringify(s))).session,s.session);
});
