const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),C=require('../assets/js/defense-core.js');
test('Busy scenes retain actors, avoid repeated fitting and bound decorative work',{timeout:60000},async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch(engine===webkit?{headless:true}:{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:650},serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'index.html');
  const s=C.fresh('gardenwatch','hard');Object.assign(s,{wave:12,phase:'running',spawned:48,nextId:49,coins:1000,hearts:20});
  s.towers=Array.from({length:40},(_,cell)=>cell).filter(cell=>C.buildable(s.id,cell)).map((cell,i)=>({cell,type:i%3,level:3,cooldown:0}));
  s.enemies=Array.from({length:48},(_,i)=>({id:i+1,kind:'armor',p:(i%8)*.55,lane:i%5,hp:1200,max:1200,slow:0}));
  await page.evaluate(s=>localStorage.setItem('childgame.defense.gardenwatch.v1',JSON.stringify(s)),s);
  await page.goto(base+'games/gardenwatch/index.html');await page.locator('#pause').click();await page.waitForTimeout(400);
  await page.evaluate(()=>{
   window.perf={actor:document.querySelector('.enemy'),added:0,layout:0};perf.transform=perf.actor.getAttribute('transform');
   window.observer=new MutationObserver(rs=>{for(const r of rs){perf.added+=r.addedNodes.length;if(r.target.tagName==='MAIN'&&r.type==='attributes')perf.layout++;}});
   observer.observe(document.querySelector('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  });
  await page.waitForTimeout(1800);
  const result=await page.evaluate(()=>{
   observer.disconnect();const cv=document.querySelector('.battle-effects'),data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
   return {retained:perf.actor===document.querySelector('.enemy'),moved:perf.transform!==perf.actor.getAttribute('transform'),added:perf.added,layout:perf.layout,painted:data.some((v,i)=>i%4===3&&v>0),nodes:document.querySelectorAll('*').length};
  });
  assert(result.retained&&result.moved,'existing enemies move without being replaced');assert.equal(result.layout,0,'battle counters do not refit the page');
  assert(result.added<250,'new nodes are spawns, not a rebuilt scene');assert(result.nodes<800);assert(result.painted,'particle canvas actually draws impacts');
  await page.locator('#pause').click();const frozen=await page.locator('#actors').innerHTML();await page.waitForTimeout(250);assert.equal(await page.locator('#actors').innerHTML(),frozen);
  await page.goto(base+'games/aquarium/index.html');
  for(const type of [2,3,4,5,6,7])await page.locator(`[data-action=add-fish][data-value="${type}"]`).click();
  await page.locator('[data-action=feed]').click();await page.waitForTimeout(500);
  assert(await page.evaluate(()=>[...document.querySelectorAll('.swimmer,.food-dot')].every(el=>el.style.top==='0px')),'fish and food move with transforms, not top writes');
  await page.setViewportSize({width:768,height:1024});await page.waitForTimeout(300);
  assert(await page.evaluate(()=>{
   const tank=document.querySelector('#tank'),box=tank.getBoundingClientRect(),scale=box.width/tank.offsetWidth;
   return CozyGame.aquarium().animals.every(a=>{
    const r=tank.querySelector(`[data-value="${a.id}"][data-action=fish]`).getBoundingClientRect();
    const x=box.x+(tank.clientLeft+a.x*tank.clientWidth/100)*scale;
    const y=box.y+(tank.clientTop+a.y*tank.clientHeight/100)*scale;
    return Math.abs(r.x+r.width/2-x)<2&&Math.abs(r.y+r.height/2-y)<2;
   });
  }),'transform coordinates still match swimming positions after a resize');
  await page.goto(base+'games/bento/index.html');
  const feedback=await page.evaluate(()=>{
   GameFeedback.clear();const root=document.createElement('section');root.innerHTML='<div class="tray">'+Array.from({length:48},(_,i)=>`<button>${i}</button>`).join('')+'</div>';document.body.append(root);
   const original=Element.prototype.getBoundingClientRect,clone=Node.prototype.cloneNode;let reads=0,clones=0;
   Element.prototype.getBoundingClientRect=function(){reads++;return original.call(this);};Node.prototype.cloneNode=function(...args){clones++;return clone.apply(this,args);};
   try{const before=GameFeedback.capture(root);root.innerHTML=root.innerHTML.replace('>47<','>changed<');GameFeedback.update(before,root);}finally{Element.prototype.getBoundingClientRect=original;Node.prototype.cloneNode=clone;}
   const actor=root.querySelector('button'),a=GameFeedback.animate(actor,[{opacity:.5},{opacity:1}],{duration:1000});
   for(let i=0;i<30;i++)GameFeedback.celebrate(actor);
   const out={reads,clones,state:a.playState,particles:document.querySelector('#game-fx-layer')?.childElementCount||0};GameFeedback.clear();root.remove();return out;
  });
  assert.equal(feedback.reads,0,'stationary placement items require no layout reads');assert.equal(feedback.clones,0,'unchanged items require no ghost clones');
  assert.equal(feedback.state,'running','burst pressure must not cancel actor motion');assert(feedback.particles<=64);
  for(const [id,action] of [['bridge','test'],['robot','run']]){
   await page.goto(base+`games/${id}/index.html`);
   if(id==='bridge')await page.locator('[data-action=deck]').first().click();
   else for(let i=0;i<2;i++)await page.locator('[data-action=command][data-value=forward]').click();
   await page.evaluate(()=>{window.originalStage=document.querySelector('.stage');window.originalSide=document.querySelector('.side');});
   await page.locator(`[data-action=${action}]`).click();await page.waitForTimeout(160);
   assert(await page.evaluate(()=>LearningApp.busy&&originalStage===document.querySelector('.stage')&&originalSide===document.querySelector('.side')),`${id} moves only the actor`);
   await page.locator('#help').click();assert.equal(await page.evaluate(()=>LearningApp.busy),false,'dialog cancels pending playback');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
