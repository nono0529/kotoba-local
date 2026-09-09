"""Convert the attributed egg rolls Anki text export; no upstream HTML executes."""
import csv, json, re, hashlib, shutil
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
class Plain(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]; self.skip=0
    def handle_starttag(self,t,a):
        if t in ('script','style','rt','rp'): self.skip+=1
        if t in ('br','div','p'): self.parts.append('\n')
    def handle_endtag(self,t):
        if t in ('script','style','rt','rp'): self.skip=max(0,self.skip-1)
    def handle_data(self,d):
        if not self.skip:self.parts.append(d)
def plain(t):
    p=Plain();p.feed(t);return re.sub(r'\[sound:[^]]+\]', '', unescape(''.join(p.parts))).strip()

source=ROOT/'sources/eggrolls/notes.csv'
words=[]
with source.open(encoding='utf-8-sig',newline='') as f:
    rows=csv.reader((line for line in f if not line.startswith('#')),delimiter='\t')
    for row in rows:
        if len(row)!=39: raise ValueError(f'Unexpected field count: {len(row)}')
        level=re.search(r'N[1-5]',row[1])
        if not level: continue
        examples=[]
        for i in (11,17,23,29):
            if row[i+1].strip(): examples.append({'ja':plain(row[i+1]),'zh':plain(row[i+3]),'label':plain(row[i]) or '例', 'furigana':plain(row[i+2])})
        words.append({'id':'egg-'+row[2], 'book':level.group(), 'word':plain(row[3]),'reading':plain(row[6]),'accent':plain(row[4]),'pos':plain(row[5]),'meaning':plain(row[7]),'extra':plain(row[9]),'examples':examples,'tags':[s for s in ['高频','中频','低频','カタカナ語','オノマトペ'] if s in row[38]],'source':'egg rolls','order':float(row[35] or 999999)})
words.sort(key=lambda w:(-int(w['book'][1]),w['order']))
assert len({w['id'] for w in words})==len(words)
assert all(w['word'] and w['reading'] and w['meaning'] for w in words)
names={'N5':('初识日语','从日常最常见的表达开始','初'),'N4':('日常会话','把生活里的想法说清楚','常'),'N3':('自在表达','从短句走向丰富的表达','言'),'N2':('深入阅读','读懂工作、新闻与日常','読'),'N1':('进阶理解','向更细腻的语言靠近','深')}
books=[{'id':k,'name':v[0],'description':v[1],'kanji':v[2],'count':sum(w['book']==k for w in words)} for k,v in names.items()]
out=ROOT/'public/data';out.mkdir(parents=True,exist_ok=True)
(out/'words.json').write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'books.json').write_text(json.dumps(books,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'provenance.json').write_text(json.dumps({'author':'egg rolls','url':'https://github.com/5mdld/anki-jlpt-decks','license':'CC BY-NC 4.0','downloaded':'2026-09-09','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'changes':'Converted Anki TSV to JSON; retained simplified Chinese, Japanese, readings, pitch, usage examples; removed HTML, audio references, traditional Chinese and Anki-specific fields; sorted by upstream ordering. Audio uses device speech synthesis, not upstream recordings.','count':len(words)},ensure_ascii=False,indent=2),encoding='utf-8')
lic=ROOT/'public/licenses';lic.mkdir(exist_ok=True)
shutil.copyfile(ROOT/'sources/eggrolls/LICENSE',lic/'eggrolls-CC-BY-NC-4.0.txt')
shutil.copyfile(ROOT/'node_modules/ts-fsrs/LICENSE',lic/'ts-fsrs-MIT.txt')
print(json.dumps(books,ensure_ascii=False));print('Total',len(words),'examples',sum(len(w['examples']) for w in words))
