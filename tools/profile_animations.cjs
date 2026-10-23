// Comparable local stress sample. CDP throttling approximates a slower device,
// but is not a claim about measured performance on a physical iPad.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const C=require('../assets/js/defense-core.js');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:650},serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await page.goto(base+'index.html');
  const s=C.fresh('gardenwatch','hard');Object.assign(s,{wave:12,phase:'running',spawned:48,nextId:49,coins:1000,hearts:20});
  s.towers=Array.from({length:40},(_,cell)=>cell).filter(cell=>C.buildable(s.id,cell)).map((cell,i)=>({cell,type:i%3,level:3,cooldown:0}));
  s.enemies=Array.from({length:48},(_,i)=>({id:i+1,kind:'armor',p:(i%8)*.55,lane:i%5,hp:1200,max:1200,slow:0}));
  await page.evaluate(s=>localStorage.setItem('childgame.defense.gardenwatch.v1',JSON.stringify(s)),s);await page.goto(base+'games/gardenwatch/index.html');
  await page.evaluate(()=>{window.__profile={frames:[],added:0,removed:0,layoutWrites:0};const p=window.__profile;new MutationObserver(rs=>{for(const r of rs){p.added+=r.addedNodes.length;p.removed+=r.removedNodes.length;if(r.type==='attributes'&&r.target.tagName==='MAIN')p.layoutWrites++;}}).observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});let last=0;const frame=t=>{if(last)p.frames.push(t-last);last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  const before=await cdp.send('Performance.getMetrics');await page.locator('#pause').click();await page.waitForTimeout(6000);const after=await cdp.send('Performance.getMetrics');
  const report=await page.evaluate(()=>({...window.__profile,nodes:document.querySelectorAll('*').length}));const sorted=report.frames.sort((a,b)=>a-b);report.frameP95ms=+sorted[Math.floor(sorted.length*.95)].toFixed(2);report.frames=sorted.length;
  for(const name of ['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','TaskDuration'])report[name]=+(after.metrics.find(m=>m.name===name).value-before.metrics.find(m=>m.name===name).value).toFixed(4);
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
