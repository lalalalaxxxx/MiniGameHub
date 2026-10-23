'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright'),C=require('../assets/js/petlink-core.js'),KEY='childgame.petlink.v1';
function sameState(actual,expected,message){assert(actual.comboLeft>=0&&actual.comboLeft<=expected.comboLeft+.001);assert.deepEqual({...actual,comboLeft:expected.comboLeft},expected,message);}
async function setup(){
  const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json'};
  const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu']}:{})});
  const context=await browser.newContext({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),base=`http://127.0.0.1:${server.address().port}/`,errors=[],missing=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))missing.push(response.url());});
  async function install(state){await page.goto(base+'index.html');await page.evaluate(([key,state])=>localStorage.setItem(key,JSON.stringify(state)),[KEY,state]);await page.goto(base+'games/petlink/index.html');await page.waitForFunction(()=>window.PetLinkGame);assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),state);}
  const idle=()=>page.waitForFunction(()=>!PetLinkGame.busy()&&!PetLinkGame.effects().raf&&PetLinkGame.effects().particles===0&&PetLinkGame.effects().rings===0,null,{timeout:15000});
  const pair=async move=>{for(const i of move)await page.locator(`[data-cell="${i}"]`).tap();};
  return{page,context,base,engine,install,idle,pair,errors,missing,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));}};
}
async function fit(page,label){
  await page.waitForTimeout(130);
  const report=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight,
    bad:[...document.querySelectorAll('button,select,a')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(el=>el.id||el.textContent.trim())
  }));assert(report.width<=report.w+1&&report.height<=report.h+1,`${label} ${JSON.stringify(report)}`);assert.deepEqual(report.bad,[],label);
  const box=await page.locator('[data-cell="0"]').boundingBox();assert(box.width>=30&&box.height>=30,`${label}: tile size ${JSON.stringify(box)}`);assert(Math.abs(box.width-box.height)<.1,`${label}: pet tiles must remain square`);
}
test('Pet browser: touch, route animations, hint/shuffle/undo, saves, layouts and complete real campaigns',{timeout:180000},async()=>{
  const T=await setup(),{page,install,idle,pair,engine}=T;
  try{
    const initial=C.fresh(0,37,'practice');await install(initial);assert.equal(await page.locator('#levels option').count(),12);
    assert.equal(await page.locator('#cells button').count(),24);await page.evaluate(()=>window.originalPetCells=[...document.querySelectorAll('#cells button')]);
    await page.locator('#hint').tap();const hinted=C.clone(initial);C.useHint(hinted);assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),hinted);assert.equal(await page.locator('.hinted').count(),2);
    const action=C.hint(hinted),expected=C.clone(hinted);assert(C.play(expected,...action.pair).ok);await pair(action.pair);
    assert(await page.evaluate(()=>PetLinkGame.busy()));assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),expected);
    await page.waitForFunction(()=>PetLinkGame.effects().particles>0);const effects=await page.evaluate(()=>PetLinkGame.effects());assert(effects.particles<=96&&effects.rings<=8);
    await page.evaluate(()=>document.querySelector('#cells button').click());assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),expected,'busy rejects extra input');await idle();
    assert(await page.evaluate(()=>originalPetCells.every((el,i)=>el===document.querySelectorAll('#cells button')[i])));
    if(engine===chromium)await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');
    await page.locator('#undo').tap();assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),hinted);
    await page.locator('#shuffle').tap();await idle();const shuffled=await page.evaluate(()=>PetLinkGame.snapshot());assert.equal(shuffled.shufflesLeft,2);assert(C.hint(shuffled));assert.equal(shuffled.pairs,0);assert.equal(shuffled.score,0);
    await page.locator('#undo').tap();assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),hinted);
    await pair(action.pair);assert(await page.evaluate(()=>PetLinkGame.busy()));await page.reload();await idle();sameState(await page.evaluate(()=>PetLinkGame.snapshot()),expected,'reload mid-animation saves one complete pair');
    await page.locator('#restart').tap();await page.locator('#cancel').tap();sameState(await page.evaluate(()=>PetLinkGame.snapshot()),expected);
    await page.locator('#help').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));await page.locator('#confirm').tap();
    await page.locator('#levels').selectOption('3');await page.locator('#cancel').tap();assert.equal(await page.locator('#levels').inputValue(),'0');
    await page.locator('#levels').selectOption('3');await page.locator('#confirm').tap();assert.equal((await page.evaluate(()=>PetLinkGame.snapshot())).level,3);
    for(const index of [0,3,11]){
      await install(C.fresh(index,37,'practice'));
      for(const viewport of [{width:1024,height:650},{width:820,height:560},{width:768,height:1024},{width:390,height:844},{width:375,height:667}]){await page.setViewportSize(viewport);await fit(page,`level ${index} ${viewport.width}x${viewport.height}`);}
    }
    await page.setViewportSize({width:1024,height:650});await install(C.fresh(3,37,'practice'));
    await page.screenshot({path:path.join(os.tmpdir(),`petlink-${engine===webkit?'webkit':'chrome'}.png`)});
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const index of [0,3,11]){
      const state=C.fresh(index,37,'practice');await install(state);
      while(state.phase==='playing'){const hint=C.hint(state);assert(C.play(state,...hint.pair).ok);await pair(hint.pair);await idle();sameState(await page.evaluate(()=>PetLinkGame.snapshot()),state);}
      assert.equal(state.phase,'won');assert(await page.locator('#result').isVisible());assert.equal(await page.locator('#score').textContent(),String(state.score));
      await page.setViewportSize({width:375,height:667});
      const buttons=await page.locator('#result button:visible').all();for(const button of buttons){const r=await button.boundingBox();assert(r.y>=0&&r.y+r.height<=667);}
      await page.reload();assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),state);await page.locator('#next').tap();assert.equal((await page.evaluate(()=>PetLinkGame.snapshot())).level,(index+1)%12);await page.setViewportSize({width:1024,height:650});
    }
    assert.deepEqual(T.errors,[]);assert.deepEqual(T.missing,[]);
  }finally{await T.close();}
});
test('Pet browser: clock, explicit resume, multi-touch, pause, background, mode switching and timeout',{timeout:60000},async()=>{
  const T=await setup(),{page,install,idle}=T;
  try{
    const initial=C.fresh(0,37);await install(initial);assert(await page.evaluate(()=>PetLinkGame.paused()));await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),initial);
    await page.locator('#resume').tap();await page.waitForFunction(()=>PetLinkGame.snapshot().timeLeft<99.7);await page.locator('#pause').tap();const paused=await page.evaluate(()=>PetLinkGame.snapshot());await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),paused);
    await page.locator('#pause').tap();await page.locator('#help').tap();const help=await page.evaluate(()=>PetLinkGame.snapshot());await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),help);await page.locator('#confirm').tap();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert(await page.evaluate(()=>PetLinkGame.paused()));const background=await page.evaluate(()=>PetLinkGame.snapshot());await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),background);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert(await page.evaluate(()=>PetLinkGame.paused()));await page.reload();assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),background);
    await page.locator('#mode').selectOption('practice');await page.locator('#confirm').tap();assert.equal((await page.evaluate(()=>PetLinkGame.snapshot())).timeLeft,null);assert(!(await page.evaluate(()=>PetLinkGame.paused())));
    const practice=C.fresh(0,37,'practice');await install(practice);const hint=C.hint(practice);
    await page.evaluate(([a,b])=>{
      const el=document.querySelector(`[data-cell="${a}"]`),other=document.querySelector(`[data-cell="${b}"]`),r=el.getBoundingClientRect(),q=other.getBoundingClientRect();
      const event=(target,type,id,primary,x,y)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,isPrimary:primary,button:0,clientX:x,clientY:y}));
      event(el,'pointerdown',51,true,r.x+r.width/2,r.y+r.height/2);event(other,'pointerdown',52,false,q.x+q.width/2,q.y+q.height/2);event(other,'pointerup',52,false,q.x+q.width/2,q.y+q.height/2);event(el,'pointerup',51,true,r.x+r.width/2,r.y+r.height/2);
    },hint.pair);
    assert.deepEqual(await page.evaluate(()=>PetLinkGame.snapshot()),practice,'second finger cannot pair or change the first choice');assert.equal(await page.locator('.selected').getAttribute('data-cell'),String(hint.pair[0]));
    await page.locator(`[data-cell="${hint.pair[1]}"]`).tap();await idle();C.play(practice,...hint.pair);sameState(await page.evaluate(()=>PetLinkGame.snapshot()),practice);
    const almost=C.fresh(0,37);almost.timeLeft=.1;await install(almost);await page.locator('#resume').tap();await page.waitForFunction(()=>PetLinkGame.snapshot().phase==='lost');assert(await page.locator('#result').isVisible());await page.locator('#retry').tap();assert.equal((await page.evaluate(()=>PetLinkGame.snapshot())).timeLeft,100);assert(await page.evaluate(()=>PetLinkGame.paused()));
    assert.deepEqual(T.errors,[]);assert.deepEqual(T.missing,[]);
  }finally{await T.close();}
});

test('Pet Canvas performance: bounded particles, retained cells and no idle rendering',{timeout:60000},async()=>{
  const T=await setup(),{page,context,install,pair,idle,engine}=T;
  try{
    await install(C.fresh(11,37,'practice'));
    if(engine===chromium){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
    await page.evaluate(()=>{
      window.perf={cells:[...document.querySelectorAll('#cells button')],times:[],running:true,added:0};
      new MutationObserver(records=>{for(const r of records)perf.added+=r.addedNodes.length;}).observe(document.querySelector('main'),{subtree:true,childList:true});
      let last;function measure(now){if(last&&PetLinkGame.busy())perf.times.push(now-last);last=now;if(perf.running)requestAnimationFrame(measure);}requestAnimationFrame(measure);
    });
    for(let i=0;i<12;i++){const hint=await page.evaluate(()=>PetLinkCore.hint(PetLinkGame.snapshot()));await pair(hint.pair);await idle();}
    const report=await page.evaluate(()=>{perf.running=false;const sorted=perf.times.sort((a,b)=>a-b);return{samples:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],retained:perf.cells.every((el,i)=>el===document.querySelectorAll('#cells button')[i]),added:perf.added,canvases:document.querySelectorAll('canvas').length,...PetLinkGame.effects()};});
    assert(report.retained);assert.equal(report.canvases,1);assert.equal(report.raf,false);assert.equal(report.particles,0);assert.equal(report.rings,0);assert(report.sprites<=12);assert(report.peak>0&&report.peak<=96);assert(report.added<250);assert(report.samples>50);assert(report.p95<100,JSON.stringify(report));
    console.log(`Pet ${engine===chromium?'Chrome 4x CPU':'WebKit'} performance: ${JSON.stringify(report)}`);
    assert.deepEqual(T.errors,[]);
  }finally{await T.close();}
});
