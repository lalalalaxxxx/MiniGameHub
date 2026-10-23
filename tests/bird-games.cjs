'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const C=require('../assets/js/bird-core.js');
const clone=C.clone,KEY='childgame.match.birdblast.v1';

test('Bird browser: top-only column moves, frozen birds, multi-touch, all modes and real stage completion',{timeout:150000},async()=>{
  const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json'};
  const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'});
    const base=`http://127.0.0.1:${server.address().port}/`,errors=[],missing=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))missing.push(`${response.status()} ${response.url()}`);});
    const snap=()=>page.evaluate(()=>MatchGame.snapshot());
    const idle=()=>page.waitForFunction(()=>window.MatchGame&&!MatchGame.busy(),null,{timeout:15000});
    const cell=i=>page.locator(`#cells [data-cell="${i}"]`);
    async function install(s){
      assert.deepEqual(C.restore('birdblast',s),s,'browser fixtures must satisfy the real save schema');
      // Leave the previous game before writing; its pagehide handler saves once.
      await page.goto(base+'index.html');await page.evaluate(([key,state])=>localStorage.setItem(key,JSON.stringify(state)),[KEY,s]);
      await page.goto(base+'games/birdblast/index.html');await idle();assert.deepEqual(await snap(),s);
    }
    async function clickMove(move){for(const i of move)await cell(i).tap();await idle();}
    async function drag(move){
      const a=await cell(move[0]).boundingBox(),b=await cell(move[1]).boundingBox();
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:6});await page.mouse.up();
    }
    const initial=C.fresh('birdblast',0,37);
    await install(initial);assert.equal(await page.locator('#cells [data-cell]').count(),49);assert.equal(await page.locator('#mode option').count(),5);
    assert.equal(await page.locator('#levels option').count(),12);
    const buried=C.top(initial,0)+7;await drag([buried,6]);await idle();assert.deepEqual(await snap(),initial,'a buried bird cannot be dragged');
    await page.locator('#hint').tap();assert.deepEqual(await snap(),initial);assert.equal(await page.locator('#cells .hinted').count(),2);

    // A bird may cross several columns. This is a stack rearrangement, not an
    // adjacent swap, and it must be accepted without an immediate match.
    let rearrange;
    for(let from=0;from<7&&!rearrange;from++)for(let to=0;to<7&&!rearrange;to++){
      if(Math.abs(from-to)<3)continue;const s=clone(initial),move=[C.top(s,from),to],r=C.play(s,...move);
      if(r.ok&&!r.total)rearrange={move,state:s};
    }
    assert(rearrange);await drag(rearrange.move);assert(await page.evaluate(()=>MatchGame.busy()));
    const moved=await snap();assert.deepEqual(moved,rearrange.state);
    await page.evaluate(()=>{document.querySelector('#cells [data-cell="42"]').click();document.querySelector('#cells [data-cell="0"]').click();});
    assert.deepEqual(await snap(),moved,'busy board rejects a second action');await idle();
    await page.locator('#undo').tap();assert.deepEqual(await snap(),initial);
    await page.waitForTimeout(420);

    const hint=C.hint(initial),expected=clone(initial);assert(C.play(expected,...hint).ok);
    await page.evaluate(([a,b])=>{
      const from=document.querySelector(`#cells [data-cell="${a}"]`),to=document.querySelector(`#cells [data-cell="${b}"]`),other=document.querySelector('#cells [data-cell="48"]');
      const r=from.getBoundingClientRect(),t=to.getBoundingClientRect(),o=other.getBoundingClientRect();
      const pointer=(el,type,id,primary,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,isPrimary:primary,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
      pointer(from,'pointerdown',51,true,r.x+r.width/2,r.y+r.height/2);
      pointer(other,'pointerdown',52,false,o.x+o.width/2,o.y+o.height/2);pointer(other,'pointerup',52,false,o.x+o.width/2,o.y+o.height/2);
      pointer(from,'pointermove',51,true,t.x+t.width/2,t.y+t.height/2);pointer(from,'pointerup',51,true,t.x+t.width/2,t.y+t.height/2);
    },hint);
    assert.deepEqual(await snap(),expected,'secondary touch cannot take over the first drag');
    assert(await page.evaluate(()=>MatchGame.busy()));
    await page.reload();await idle();assert.deepEqual(await snap(),expected,'reloading during an explosion restores the whole completed move');

    const ice=C.fresh('birdblast',0,37,'ice'),frozenTop=C.top(ice,0),oldIce=ice.covers.findIndex(Boolean);
    ice.covers[oldIce]=0;ice.covers[frozenTop]=1;await install(ice);await drag([frozenTop,6]);await idle();assert.deepEqual(await snap(),ice,'frozen top bird cannot be dragged');

    await install(initial);
    for(const mode of ['classic','pandora','ice','fever','practice']){
      const before=await snap();await page.locator('#mode').selectOption(mode);assert(await page.locator('#dialog').evaluate(el=>el.open));
      await page.locator('#cancel').tap();assert.deepEqual(await snap(),before);assert.equal(await page.locator('#mode').inputValue(),before.mode);
      await page.locator('#mode').selectOption(mode);await page.locator('#confirm').tap();assert.equal((await snap()).mode,mode);
      if(['classic','pandora','fever'].includes(mode)){await page.locator('#pause').tap();assert(await page.evaluate(()=>MatchGame.paused()));}
    }

    await page.emulateMedia({reducedMotion:'reduce'});
    for(const mode of ['practice','ice']){
      const s=C.fresh('birdblast',0,37,mode);await install(s);let dry=0,last=-1;
      for(let step=0;step<80&&s.phase==='playing';step++){
        dry=s.score===last?dry+1:0;last=s.score;
        if(dry===8){const change=C.shuffle(s);if(change.ok){await page.locator('#shuffle').tap();await idle();assert.deepEqual(await snap(),s);}dry=0;}
        const move=C.hint(s);assert(move);assert(C.play(s,...move).ok);await clickMove(move);assert.deepEqual(await snap(),s);
      }
      assert.equal(s.phase,'won',`${mode} opening is completed through legal moves`);assert(await page.locator('#result').isVisible());assert(await page.locator('#next').isVisible());
      await page.reload();await idle();assert.deepEqual(await snap(),s);assert(await page.locator('#result').isVisible());
      const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.match.birdblast.v1.progress')));assert(progress[`${mode}:0`]>=s.score);
      await page.locator('#next').tap();assert.equal((await snap()).level,1);assert.equal((await snap()).mode,mode);assert.equal((await snap()).movesUsed,0);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Bird browser: classic rise/topout and timed pause, dialog, background, reload and expiry',{timeout:90000},async()=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json'})[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[];
    page.on('pageerror',error=>errors.push(error.message));const snap=()=>page.evaluate(()=>MatchGame.snapshot());
    async function install(s){assert.deepEqual(C.restore('birdblast',s),s);await page.goto(base+'index.html');await page.evaluate(([key,s])=>localStorage.setItem(key,JSON.stringify(s)),[KEY,s]);await page.goto(base+'games/birdblast/index.html');assert.deepEqual(await snap(),s);assert(await page.evaluate(()=>MatchGame.paused()));}
    const classic=C.fresh('birdblast',0,37,'classic');classic.riseLeft=.5;await install(classic);
    await page.waitForTimeout(650);assert.deepEqual(await snap(),classic,'restored classic waits for resume');
    await page.locator('#pause').tap();await page.waitForFunction(()=>MatchGame.busy());
    assert((await snap()).nextId>classic.nextId,'classic adds a bottom row');await page.waitForFunction(()=>!MatchGame.busy());
    await page.locator('#pause').tap();const paused=await snap();await page.waitForTimeout(650);assert.deepEqual(await snap(),paused);
    const full=C.fresh('birdblast',0,37,'classic');for(let row=0;row<7;row++)full.board[row*7]={uid:full.nextId++,kind:'normal',color:row%3,special:''};full.riseLeft=.3;
    await install(full);await page.locator('#pause').tap();await page.waitForFunction(()=>MatchGame.snapshot().phase==='lost');assert(await page.locator('#result').isVisible());assert(await page.locator('#retry').isVisible());
    await page.locator('#retry').tap();assert.equal((await snap()).mode,'classic');assert.equal((await snap()).phase,'playing');

    for(const mode of ['pandora','fever']){
      const s=C.fresh('birdblast',0,37,mode);s.timeLeft=4;await install(s);await page.waitForTimeout(450);assert.deepEqual(await snap(),s);
      await page.locator('#pause').tap();await page.waitForFunction(()=>MatchGame.snapshot().timeLeft<3.7);await page.locator('#pause').tap();const stopped=await snap();
      await page.waitForTimeout(650);assert.deepEqual(await snap(),stopped,'pause freezes the actual simulation timer');
      await page.locator('#pause').tap();await page.locator('#help').tap();const dialog=await snap();await page.waitForTimeout(650);assert.deepEqual(await snap(),dialog,'help dialog pauses elapsed time');await page.locator('#confirm').tap();
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      const background=await snap();assert(await page.evaluate(()=>MatchGame.paused()));await page.waitForTimeout(650);assert.deepEqual(await snap(),background,'hidden page freezes the round');
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert(await page.evaluate(()=>MatchGame.paused()),'returning to the tab does not silently resume');
      await page.reload();assert.deepEqual(await snap(),background);assert(await page.evaluate(()=>MatchGame.paused()),'saved timed round resumes only on request');
      const nearEnd=C.fresh('birdblast',0,37,mode);nearEnd.timeLeft=.3;await install(nearEnd);await page.locator('#pause').tap();await page.waitForFunction(()=>MatchGame.snapshot().phase==='won');assert(await page.locator('#result').isVisible());assert.equal((await snap()).timeLeft,0);
      await page.reload();assert.equal((await snap()).phase,'won');assert(await page.locator('#result').isVisible());
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
