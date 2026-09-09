import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

export const APP_VERSION = 1;
export const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false });
export { Rating };
export function initialState() {
  return { version: APP_VERSION, settings: { book: 'N5', goal: 20, voice: '', rate: 0.85, autoAudio: false, showReading: true, theme: 'light' }, cards: {}, favorites: [], notes: {}, logs: [], customWords: [], customBooks: [], session: null };
}
export function dayKey(date = new Date()) {
  const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function reviveCard(card, now = new Date()) {
  return card ? { ...card, due: new Date(card.due), ...(card.last_review ? { last_review: new Date(card.last_review) } : {}) } : createEmptyCard(now);
}
export function nextCard(card, rating, now = new Date()) {
  if (![1,2,3,4].includes(rating)) throw new Error('无效的评分');
  return scheduler.next(reviveCard(card,now),new Date(now),rating);
}
export function stats(state, words, now = new Date()) {
  const today = dayKey(now), logs = state.logs.filter(l => l.day === today);
  const valid = new Set(words.map(w=>w.id));
  const entries = Object.entries(state.cards).filter(([id])=>valid.has(id));
  const dates = new Set(state.logs.map(l=>l.day));
  let streak=0, d=new Date(now); if(!dates.has(dayKey(d)))d.setDate(d.getDate()-1);
  while(dates.has(dayKey(d))) {streak++;d.setDate(d.getDate()-1);}
  return { newToday: new Set(logs.filter(l=>l.isNew).map(l=>l.id)).size, reviewedToday: new Set(logs.filter(l=>!l.isNew).map(l=>l.id)).size,
    answersToday: logs.length, learned: entries.length, mastered: entries.filter(([,c])=>c.state===2&&c.scheduled_days>=21).length,
    due: entries.filter(([,c])=>new Date(c.due)<=now).map(([id])=>id).sort((a,b)=>new Date(state.cards[a].due)-new Date(state.cards[b].due)), streak };
}
export function makeSession(state, words, kind='learn', mode='recognize', now=new Date()) {
  const s=stats(state,words,now), pool=words.filter(w=>w.book===state.settings.book);
  let queue=[];
  if(kind==='review')queue=s.due.slice(0,100);
  else if(kind==='learn')queue=pool.filter(w=>!state.cards[w.id]).slice(0,Math.max(0,state.settings.goal-s.newToday)).map(w=>w.id);
  else if(kind==='favorites')queue=state.favorites.filter(id=>words.some(w=>w.id===id)).slice(0,30);
  else queue=pool.filter(w=>state.cards[w.id]).slice(0,20).map(w=>w.id);
  if(!queue.length&&kind==='practice')queue=pool.slice(0,10).map(w=>w.id);
  return queue.length ? { queue, kind, mode, total: queue.length, completed: 0, answered: 0, correct: 0, startedAt: now.toISOString() } : null;
}
export function grade(state,id,rating,now=new Date()) {
  const session=state.session;
  if(!session||session.queue[0]!==id)throw new Error('当前单词已变化，请重试');
  const draft=structuredClone(state), ss=draft.session;
  const practice=['practice','favorites'].includes(ss.kind);
  if(!practice){
    const isNew=!draft.cards[id], result=nextCard(draft.cards[id],rating,now);
    draft.cards[id]=JSON.parse(JSON.stringify(result.card));
    draft.logs.push({ id,rating,day:dayKey(now),at:now.toISOString(),isNew,review:JSON.parse(JSON.stringify(result.log)) });
  }
  ss.queue.shift(); ss.answered++;
  if(rating===1&&!practice)ss.queue.splice(Math.min(3,ss.queue.length),0,id);
  else {ss.completed++;if(rating>=3)ss.correct++;}
  return draft;
}
export function normalizeKana(s) {
  return String(s).normalize('NFKC').trim().replace(/[\s・･]/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
}
export function acceptsReading(input, word) {
  const a=normalizeKana(input);return a.length>0&&word.reading.split(/[／/、,;；]/).some(s=>normalizeKana(s.replace(/[（(].*?[）)]/g,''))===a);
}
export function intervalLabel(card,now=new Date()) {
  const mins=Math.max(1,Math.round((new Date(card.due)-now)/60000));
  if(mins<60)return `${mins} 分钟`;if(mins<1440)return `${Math.round(mins/60)} 小时`;return `${Math.round(mins/1440)} 天`;
}
export function parseCSV(text) {
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV 引号没有闭合');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function safeText(value,max=10000){return typeof value==='string'&&value.length<=max;}
function safeId(value){return safeText(value,150)&&/^[A-Za-z0-9_-]+$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);}
export function validateWords(list,book) {
  if(!Array.isArray(list)||!list.length||list.length>30000)throw new Error('词书需要包含 1–30000 个词条');
  return list.map((w,i)=>{
    for(const k of ['word','reading','meaning'])if(!safeText(w[k],2000)||!w[k].trim())throw new Error(`第 ${i+1} 条缺少有效的 ${k}`);
    return {id:`${book}-${i}`,book,word:w.word.trim(),reading:w.reading.trim(),meaning:w.meaning.trim(),accent:safeText(w.accent,100)?w.accent:'',examples:Array.isArray(w.examples)?w.examples.slice(0,10).filter(e=>safeText(e.ja)&&safeText(e.zh)).map(e=>({ja:e.ja,zh:e.zh})):[],tags:[],source:'用户导入'};
  });
}
export function parseWordImport(text,filename,book) {
  if(/\.json$/i.test(filename)){const obj=JSON.parse(text);return validateWords(Array.isArray(obj)?obj:obj.words,book);}
  const rows=parseCSV(text), headers=(rows.shift()||[]).map(h=>h.trim().toLowerCase());
  const col=(names)=>headers.findIndex(h=>names.includes(h));
  const a=col(['word','日语','单词']),b=col(['reading','假名','读音']),c=col(['meaning','中文','释义']),d=col(['sentence','例句']),e=col(['translation','例句翻译']);
  if([a,b,c].includes(-1))throw new Error('CSV 表头需要 word,reading,meaning（或 日语,假名,中文）');
  return validateWords(rows.map(r=>({word:r[a],reading:r[b],meaning:r[c],examples:d>=0&&r[d]?[{ja:r[d],zh:r[e]||''}]:[]})),book);
}
export function validateBackup(input) {
  const fail=()=>{throw new Error('备份格式或内容不完整，原有数据未改动');};
  if(!input||input.app!=='kotoba-local'||input.version!==1||!input.state)fail();
  const s=input.state;
  if(!s.settings||!Number.isInteger(s.settings.goal)||s.settings.goal<1||s.settings.goal>200||!safeId(s.settings.book)||!Number.isFinite(s.settings.rate)||s.settings.rate<0.5||s.settings.rate>1.5||!['light','dark'].includes(s.settings.theme)||!safeText(s.settings.voice,500)||typeof s.settings.autoAudio!=='boolean'||typeof s.settings.showReading!=='boolean')fail();
  if(!s.cards||Array.isArray(s.cards)||typeof s.cards!=='object'||!s.notes||Array.isArray(s.notes)||typeof s.notes!=='object')fail();
  for(const [id,c] of Object.entries(s.cards)){
    if(!safeId(id)||!c||!Number.isFinite(Date.parse(c.due))||(c.last_review&&!Number.isFinite(Date.parse(c.last_review))))fail();
    for(const k of ['stability','difficulty','elapsed_days','scheduled_days','reps','lapses','learning_steps','state'])if(!Number.isFinite(c[k])||c[k]<0)fail();
    if(c.state>3||c.difficulty>10)fail();
  }
  if(!Array.isArray(s.favorites)||!s.favorites.every(safeId)||!Array.isArray(s.logs)||s.logs.length>500000||!s.logs.every(l=>safeId(l.id)&&[1,2,3,4].includes(l.rating)&&/^\d{4}-\d{2}-\d{2}$/.test(l.day)&&Number.isFinite(Date.parse(l.at))&&typeof l.isNew==='boolean'))fail();
  if(!Object.entries(s.notes).every(([id,n])=>safeId(id)&&safeText(n,5000)))fail();
  if(!Array.isArray(s.customBooks)||!s.customBooks.every(b=>safeId(b.id)&&safeText(b.name,100))||!Array.isArray(s.customWords))fail();
  if(s.customWords.length>30000||new Set(s.customWords.map(w=>w.id)).size!==s.customWords.length)fail();
  for(const w of s.customWords){if(!safeId(w.id)||!s.customBooks.some(b=>b.id===w.book))fail();try{validateWords([w],w.book);}catch{fail();}}
  const clean=structuredClone(s);clean.session=null;clean.version=APP_VERSION;
  clean.customWords=clean.customWords.map(w=>({...validateWords([w],w.book)[0],id:w.id}));
  return clean;
}
