const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),C=require('../assets/js/match-core.js');
test('A large combination uses bounded canvas effects and keeps board controls intact',{timeout:45000},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:650},serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(engine===chromium){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  await page.goto(base+'games/birdblast/index.html');
  assert.deepEqual(errors,[],'initial page errors');
  assert(await page.evaluate(()=>{const c=document.querySelector('#board');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}), 'the initial board paints before the first interaction');
  await page.goto(base+'index.html');const s=C.fresh('candyland',11,17);s.board[24].special='rainbow';s.board[25].special='bomb';
  const expected=C.clone(s),event=C.play(expected,24,25);assert(event.ok&&event.frames.filter(f=>f.kind==='clear').length>=2);
  await page.evaluate(s=>localStorage.setItem('childgame.match.candyland.v1',JSON.stringify(s)),s);await page.goto(base+'games/candyland/index.html');await page.waitForTimeout(200);
  await page.evaluate(()=>{
   window.stress={button:document.querySelector('[data-cell="0"]'),frames:[],peak:{particles:0,rings:0,beams:0,sprites:0},added:0,last:0,done:false};
   window.observer=new MutationObserver(records=>{for(const r of records)stress.added+=r.addedNodes.length;});observer.observe(document.querySelector('main'),{childList:true,subtree:true});
   const sample=t=>{if(stress.done)return;const fx=MatchGame.effects();for(const k of Object.keys(stress.peak))stress.peak[k]=Math.max(stress.peak[k],fx[k]);if(MatchGame.busy()&&stress.last)stress.frames.push(t-stress.last);stress.last=t;requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.locator('[data-cell="24"]').click();await page.locator('[data-cell="25"]').click();await page.waitForFunction(()=>!MatchGame.busy(),null,{timeout:25000});await page.waitForTimeout(800);
  const report=await page.evaluate(()=>{stress.done=true;observer.disconnect();return {...stress,button:stress.button===document.querySelector('[data-cell="0"]'),now:MatchGame.effects(),buttons:document.querySelectorAll('#cells button').length,canvases:document.querySelectorAll('canvas').length,snapshot:MatchGame.snapshot()};});
  assert.deepEqual(report.snapshot,expected);assert(report.button);assert.equal(report.buttons,49);assert.equal(report.canvases,1);
  assert(report.added<240,'no per-frame reconstruction of tile controls or DOM particles');assert(report.peak.particles>0&&report.peak.particles<=210);assert(report.peak.rings<=20);assert(report.peak.beams<=30);assert(report.peak.sprites<=80);
  for(const k of ['particles','rings','beams'])assert.equal(report.now[k],0,`${k} drains when the chain finishes`);
  const frames=report.frames.sort((a,b)=>a-b);assert(frames.length>5);
  console.log(JSON.stringify({engine:process.env.TEST_BROWSER||'chrome',cpuThrottle:engine===chromium?4:1,sampledFrames:frames.length,frameP95ms:Math.round(frames[Math.floor(frames.length*.95)]*10)/10,addedNodes:report.added,peak:report.peak}));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
