'use strict';
// Reproducible browser workload for every catalog entry; profile an untouched
// checkout with --root, then compare the same scenarios against the working tree.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const root=path.resolve(option('--root',path.join(__dirname,'..'))),output=option('--out',''),filter=option('--ids','').split(',').filter(Boolean),throttle=Number(option('--cpu','4'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg'};
async function main(){
 const server=http.createServer((req,res)=>{let url=new URL(req.url,'http://local').pathname.replace(/^\/minigames\//,'/');if(url.endsWith('/'))url+='index.html';const file=path.join(root,url);fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/minigames/`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),report={root,cpuThrottle:throttle,viewport:{width:1024,height:650},games:[]};
 try{
  const context=await browser.newContext({viewport:report.viewport,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{
   window.__profile={raf:0,timers:0,draw:0,storage:0};
   const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>raf.call(window,time=>{__profile.raf++;fn(time);});
   for(const type of ['setTimeout','setInterval']){const native=window[type];window[type]=(fn,...args)=>native.call(window,typeof fn==='function'?function(...a){__profile.timers++;return fn.apply(this,a);}:fn,...args);}
   for(const name of ['drawImage','fill','stroke','fillRect','clearRect','fillText','strokeText']){const native=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){__profile.draw++;return native.apply(this,args);};}
   const set=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){__profile.storage++;return set.apply(this,args);};
  });
  const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  let errors=[];page.on('pageerror',e=>errors.push(e.message));
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  async function sample(ms){await page.evaluate(()=>Object.keys(__profile).forEach(k=>__profile[k]=0));const before=await metrics();await page.waitForTimeout(ms);const after=await metrics(),counts=await page.evaluate(()=>({...__profile}));return{...counts,taskMs:Math.round((after.TaskDuration-before.TaskDuration)*10000)/10,scriptMs:Math.round((after.ScriptDuration-before.ScriptDuration)*10000)/10,layoutMs:Math.round((after.LayoutDuration-before.LayoutDuration)*10000)/10,heapMB:Math.round(after.JSHeapUsedSize/104857.6)/10,periodMs:ms};}
  for(const game of JSON.parse(fs.readFileSync(path.join(root,'games/manifest.json'),'utf8')).filter(g=>!filter.length||filter.includes(g.id))){
   errors=[];await page.goto(base+game.entry);await page.waitForTimeout(400);
   for(const selector of ['#resume','#start','[data-action="start"]']){const b=page.locator(selector).first();if(await b.isVisible().catch(()=>false)&&await b.isEnabled()){await b.click();break;}}
   if(game.id==='snake')await page.keyboard.press('ArrowUp');
   await page.waitForTimeout(350);const active=await sample(1000);
   let rest='idle';const pause=page.locator('#pause').first();
   if(await pause.isVisible().catch(()=>false)&&await pause.isEnabled()&&/暂停/.test(await pause.textContent())){await pause.click();rest='paused';}
   else{const help=page.locator('#help,#rules').first();if(await help.isVisible().catch(()=>false)&&await help.isEnabled()){await help.click();rest='help';}}
   await page.waitForTimeout(450);const idle=await sample(650);
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);const hidden=await sample(500);
   report.games.push({id:game.id,rest,active,idle,hidden,errors:[...errors]});console.log(`${game.id}: active ${active.taskMs}ms, ${rest} RAF ${idle.raf}, hidden RAF ${hidden.raf}/timers ${hidden.timers}`);
  }
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  if(report.games.some(g=>g.errors.length))throw new Error('Browser errors: '+JSON.stringify(report.games.filter(g=>g.errors.length).map(g=>[g.id,g.errors])));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
