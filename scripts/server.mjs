import http from 'node:http';
import https from 'node:https';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { networkInterfaces, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import QRCode from 'qrcode';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const localOnly=process.argv.includes('--test');
const port=Number(process.env.PORT|| (localOnly?4173:8765)),tlsPort=Number(process.env.HTTPS_PORT||8443);
const adapters=Object.entries(networkInterfaces()).filter(([name])=>!/(vmware|virtual|vethernet|loopback|docker)/i.test(name)).flatMap(([name,list])=>list.filter(x=>x.family==='IPv4'&&!x.internal).map(x=>({name,address:x.address})));
adapters.sort((a,b)=>Number(/wlan|wi-fi|wireless/i.test(b.name))-Number(/wlan|wi-fi|wireless/i.test(a.name)));
const address=adapters[0]?.address||'127.0.0.1';
if(!existsSync(resolve(dist,'index.html'))){console.error('Please run npm run build first.');process.exit(1);}
let certInfo={fingerprint:''};
if(!localOnly){
 const candidates=process.env.KOTOBA_PYTHON?[process.env.KOTOBA_PYTHON]:['python',resolve(homedir(),'miniconda3','python.exe'),resolve(homedir(),'anaconda3','python.exe')];
 const python=candidates.find(candidate=>spawnSync(candidate,['-c','from cryptography import x509'],{windowsHide:true,timeout:10000}).status===0);
 if(!python){console.error('Certificate setup failed: no Python environment with cryptography was found. Set KOTOBA_PYTHON to its executable path.');process.exit(1);}
 const run=spawnSync(python,[resolve(root,'scripts/certificates.py'),...adapters.map(x=>x.address)],{encoding:'utf8',windowsHide:true});
 if(run.status!==0){console.error('Certificate setup failed.\n',run.stderr||run.error);process.exit(1);}certInfo=JSON.parse(run.stdout.trim());
}
const learningURL=`https://${address}:${tlsPort}`,installURL=`http://${address}:${port}/install`;
const qr=await QRCode.toDataURL(installURL,{width:280,margin:2,color:{dark:'#182d31',light:'#ffffff'}});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const installPage=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>言叶 · iPhone 安装</title><style>body{font:16px/1.9 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#263e32;background:#f4f6f1;margin:0;padding:30px 22px}main{max-width:760px;margin:auto}h1{font-size:32px;letter-spacing:3px}h2{font-size:21px}section{background:white;padding:24px;border:1px solid #e0e7dc;border-radius:16px;margin:20px 0}a{color:#3d6850;overflow-wrap:anywhere}small{color:#6d7d6d;font-size:13px}.button{display:inline-block;text-decoration:none;background:#36594c;color:white;border-radius:10px;padding:12px 20px;margin:8px 4px 8px 0}.qr{display:block;width:220px;max-width:100%;margin:12px auto}.center{text-align:center}code{overflow-wrap:anywhere;font-size:13px}li{margin-bottom:13px}</style><main><small>KOTOBA · LOCAL INSTALLATION</small><h1>把言叶装进 iPhone</h1><p>10,641 个日语单词，一本属于自己的离线单词本。</p><section class="center"><img class="qr" src="${qr}" alt="用 iPhone 扫码打开安装向导"><p>手机与电脑连接同一 Wi-Fi，使用 Safari 打开</p><a href="${installURL}">${installURL}</a><p><small>电脑预览：<a href="http://localhost:${port}/">打开言叶</a></small></p></section><section><h2>1 · 安装本机证书</h2><p>这份证书由你的电脑在本地生成，用于局域网 HTTPS。点击下载后，在 iPhone 设置 → 通用 → VPN 与设备管理（或“已下载描述文件”）中安装 <strong>Kotoba Local Personal CA</strong>。</p><a class="button" href="/root-ca.cer">下载本机证书</a><p>随后进入 设置 → 通用 → 关于本机 → 证书信任设置，开启该证书的完全信任。</p><small>根证书是信任凭据：只信任你自己电脑生成的这一份。私钥只存放在本机 .local/certs，不会通过网页提供，也不要分享此目录。停止使用后可在手机删除证书。此操作不会自动发生，需要你在手机完成。</small><p><small>本机证书 SHA-256 指纹：<br><code>${certInfo.fingerprint.match(/.{1,2}/g)?.join(':')||'测试模式'}</code></small></p></section><section><h2>2 · 打开言叶，添加到主屏幕</h2><a class="button" href="${learningURL}">打开 HTTPS 学习地址 ↗</a><p><a href="${learningURL}">${learningURL}</a></p><p>确认 Safari 不再显示证书错误后，点分享按钮 → 添加到主屏幕 → 添加。“作为网页 App 打开”如有此选项，请保持开启。</p></section><section><h2>3 · 完成离线准备</h2><ol><li>从主屏幕打开“言叶”，点“我的”，等待显示<strong>离线已就绪 · 10,641 词已保存</strong>。</li><li>开启飞行模式，完全关闭再打开言叶，进入词书、学一个单词，确认仍可使用。</li><li>如需离线发音，在 iPhone 设置的辅助功能里搜索“朗读”或“语音”，下载日语语音，并在言叶“我的 → 声音”试听。具体菜单名称随 iOS 版本变化。</li></ol><p>确认离线后，电脑可以关机。学习记录和词书保存在 iPhone 上；系统清理网站数据会移除它们，请定期在“我的”导出备份到“文件”。</p></section><section><h2>打不开时</h2><ul><li>首次安装时电脑必须开机，并保持“启动言叶”运行。不能只用 HTTP 地址作为离线安装地址。</li><li>检查手机和电脑是否处于同一 Wi-Fi；校园网、访客网络可能禁止设备互访，可改用个人热点或家庭网络。</li><li>若 Windows 防火墙阻止连接，运行项目中的“允许手机连接.ps1”，只开放本应用两个端口到本地子网。</li><li>换 Wi-Fi 后 IP 可能改变。重启“启动言叶”会更新证书与二维码。旧图标仍可离线使用；换新地址前，在旧图标里导出备份，安装新地址后恢复。</li><li>若证书仍显示不可信，重新检查“证书信任设置”，不要仅略过 Safari 的警告。</li></ul></section><p><small>安装依据：<a href="https://support.apple.com/en-ie/102390">Apple 证书信任说明</a> · <a href="https://webkit.org/blog/17333/webkit-features-in-safari-26-0/">WebKit 主屏幕应用说明</a></small></p></main></html>`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8'};
async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-cache');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(path.includes('\\')||path.includes('\0')){res.writeHead(400);res.end();return;}
 try{
   let body,type;
   if(path==='/install'){body=installPage;type=types['.html'];}
   else if(path==='/health'){body=JSON.stringify({ok:true,app:'kotoba-local'});type=types['.json'];}
   else if(path==='/root-ca.cer'&&!localOnly){body=await readFile(resolve(root,'.local/certs/root-ca.cer'));type='application/x-x509-ca-cert';res.setHeader('Content-Disposition','attachment; filename="Kotoba-Local-CA.cer"');}
   else {
     const target=resolve(dist,'.'+(path==='/'?'/index.html':path));
     if(!target.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
     if(!(await stat(target)).isFile()){res.writeHead(404);res.end();return;}
     body=await readFile(target);type=types[extname(target)]||'application/octet-stream';
     res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
   }
   res.writeHead(200,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.code==='ENOENT'?'未找到文件':'读取失败');}
}
const servers=[];
function listen(server,p){return new Promise((resolve,reject)=>{server.on('error',reject);server.listen(p,localOnly?'127.0.0.1':'0.0.0.0',resolve);servers.push(server);});}
try{
 await listen(http.createServer(handler),port);
 if(!localOnly)await listen(https.createServer({key:await readFile(resolve(root,'.local/certs/server-key.pem')),cert:await readFile(resolve(root,'.local/certs/server.pem')),minVersion:'TLSv1.2'},handler),tlsPort);
 if(!localOnly){
 await mkdir(resolve(root,'.local'),{recursive:true});
 await writeFile(resolve(root,'.local/installation.html'),installPage);
 await writeFile(resolve(root,'手机安装地址.txt'),`言叶 · 本次启动地址\r\n\r\n手机和电脑连接同一 Wi-Fi。\r\n安装向导：${installURL}\r\n学习地址：${learningURL}\r\n电脑预览：http://localhost:${port}/\r\n\r\n首次安装需要电脑开机。安装离线完成后不再需要电脑。\r\nIP 改变后重新启动会更新此文件。\r\n证书 SHA256：${certInfo.fingerprint}\r\n`,'utf8');
 }
 console.log(`\nKotoba is ready.\nDesktop: http://localhost:${port}/\nInstall: ${installURL}\nLearning: ${learningURL}\nKeep this window open during initial iPhone setup. Ctrl+C to stop.\n`);
}catch(e){console.error(`Server could not start: ${e.message}. Close the previous Kotoba server or choose other PORT/HTTPS_PORT values.`);for(const s of servers)s.close();process.exitCode=1;}
function close(){for(const s of servers)s.close();setTimeout(()=>process.exit(),500).unref();}process.on('SIGINT',close);process.on('SIGTERM',close);
