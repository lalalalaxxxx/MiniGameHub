'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');

const IDS=['candyland','gemquest'];
const clone=value=>JSON.parse(JSON.stringify(value));
const storageKey=id=>`childgame.match.${id}.v1`;

function candidates(C,state){
  const result=[];
  for(let a=0;a<C.N*C.N;a++){
    const targets=[a%C.N<C.N-1?a+1:-1,a+C.N<C.N*C.N?a+C.N:-1].filter(i=>i>=0);
    for(const b of targets){
      const next=clone(state),event=C.play(next,a,b);
      if(event.ok)result.push({move:[a,b],next,event});
    }
  }
  return result;
}

function progress(state){
  return state.goals.colors.reduce((sum,goal)=>sum+Math.min(goal.count,state.collected[goal.color])*5,0)
    +Math.min(state.goals.covers,state.clearedCovers)*8
    +Math.min(state.goals.locks,state.clearedLocks)*8
    +Math.min(state.goals.rescue,state.rescued)*28
    +Math.min(state.goals.score,state.score)/50
    +state.board.reduce((sum,p,i)=>sum+(p.kind==='ingredient'||p.kind==='chest'?Math.floor(i/7)*1.5:0)+(p.special?0.3:0),0);
}

// A goal-aware player finishes actual generated opening levels; fixtures below do
// not reduce the level targets or give the browser extra moves.
function openingPlan(C,id){
  for(const seed of [741,1027,37,2026]){
    const initial=C.fresh(id,0,seed),state=clone(initial),moves=[];
    for(let step=0;state.phase==='playing'&&step<60;step++){
      const options=candidates(C,state);
      options.sort((a,b)=>(b.next.phase==='won'?100000:0)+progress(b.next)-(a.next.phase==='won'?100000:0)-progress(a.next)||b.next.score-a.next.score);
      if(!options.length)break;
      moves.push(options[0].move);Object.assign(state,options[0].next);
    }
    if(state.phase==='won')return{initial,moves,finished:state};
  }
  assert.fail(`${id}: the opening level must be winnable by a goal-aware player`);
}

function invalidMove(C,state){
  for(let a=0;a<C.N*C.N;a++)for(const b of [a%C.N<C.N-1?a+1:-1,a+C.N<C.N*C.N?a+C.N:-1].filter(i=>i>=0)){
    const next=clone(state);if(!C.play(next,a,b).ok)return[a,b];
  }
  return null;
}

async function serverAndBrowser(){
  const root=path.resolve(__dirname,'..');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{
    const file=path.join(root,new URL(req.url,'http://localhost').pathname);
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  return{server,browser,engine,base:`http://127.0.0.1:${server.address().port}/`};
}

test('Match games: real opening levels, touch input, invalid moves, progress, saves and tablet layouts',{timeout:240000},async()=>{
  const C=require('../assets/js/match-core.js');
  const {server,browser,engine,base}=await serverAndBrowser();
  try{
    const context=await browser.newContext({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],missing=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))missing.push(`${response.status()} ${response.url()}`);});
    const snapshot=()=>page.evaluate(()=>MatchGame.snapshot());
    const waitIdle=()=>page.waitForFunction(()=>window.MatchGame&&!MatchGame.busy(),null,{timeout:15000});
    const cell=i=>page.locator(`#cells [data-cell="${i}"]`);
    async function install(state){
      // Leave the current game before installing its save: pagehide correctly
      // saves the old live state, and must not overwrite the test fixture.
      await page.goto(base+'index.html');
      await page.evaluate(([key,state])=>localStorage.setItem(key,JSON.stringify(state)),[storageKey(state.id),state]);
      await page.goto(base+`games/${state.id}/index.html`);await waitIdle();assert.deepEqual(await snapshot(),state);
    }
    async function tapMove(move){for(const i of move)await cell(i).tap();await waitIdle();}
    async function dragMove(move){
      const from=await cell(move[0]).boundingBox(),to=await cell(move[1]).boundingBox();
      await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
      await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:5});await page.mouse.up();
    }
    async function fits(label){
      await page.waitForTimeout(250);
      const report=await page.evaluate(()=>({
        width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:[innerWidth,innerHeight],
        bad:[...document.querySelectorAll('button,select,a')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(el=>el.id||el.textContent.trim()).slice(0,5)
      }));
      assert(report.width<=report.viewport[0]+1&&report.height<=report.viewport[1]+1,`${label}: ${JSON.stringify(report)}`);
      assert.deepEqual(report.bad,[],label);
      const box=await cell(0).boundingBox();assert(box.width>=30&&box.height>=30,`${label}: readable tap targets`);
    }

    for(const id of IDS){
      const plan=openingPlan(C,id),initial=plan.initial;
      await install(initial);
      assert.equal(await page.locator('#cells [data-cell]').count(),49);
      assert.equal(await page.locator('#levels option').count(),12);
      assert(await page.locator('#board').evaluate(el=>el instanceof HTMLCanvasElement&&el.width>0&&el.height>0));
      await page.locator('#hint').tap();assert.deepEqual(await snapshot(),initial,'hint never consumes a move');
      const expected=clone(initial),move=C.hint(initial);assert(move&&C.play(expected,...move).ok);
      await dragMove(move);
      assert(await page.evaluate(()=>MatchGame.busy()),`${id}: normal-motion action has animated feedback`);
      const during=await snapshot();assert.deepEqual(during,expected);
      // Direct DOM dispatch verifies the game guard independently of disabled buttons.
      await page.evaluate(()=>document.querySelector('#cells [data-cell="0"]').click());
      assert.deepEqual(await snapshot(),expected,'extra input during a cascade cannot spend another move');
      await waitIdle();
      if(engine===chromium){await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');}
      await page.locator('#undo').tap();assert.deepEqual(await snapshot(),initial);

      const invalid=invalidMove(C,initial);assert(invalid);
      await tapMove(invalid);assert.deepEqual(await snapshot(),initial,'invalid swap returns pieces without spending a move');
      await page.locator('#shuffle').tap();await waitIdle();const shuffled=await snapshot();
      for(const key of ['movesLeft','movesUsed','score','collected','rescued','clearedCovers','clearedLocks','goals'])assert.deepEqual(shuffled[key],initial[key],`shuffle preserves ${key}`);
      assert.deepEqual(shuffled.board.map(p=>p.uid).sort((a,b)=>a-b),initial.board.map(p=>p.uid).sort((a,b)=>a-b));
      assert(C.hint(shuffled),'shuffle must leave a playable board');
      await page.locator('#undo').tap();assert.deepEqual(await snapshot(),initial);

      await tapMove(move);const saved=await snapshot();await page.reload();await waitIdle();assert.deepEqual(await snapshot(),saved);
      await page.locator('#restart').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));await page.locator('#cancel').tap();assert.deepEqual(await snapshot(),saved);
      await page.locator('#help').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));await page.locator('#confirm').tap();assert.deepEqual(await snapshot(),saved);
      await page.locator('#levels').selectOption('2');await page.locator('#cancel').tap();assert.deepEqual(await snapshot(),saved);assert.equal(await page.locator('#levels').inputValue(),String(saved.level));
      await page.locator('#levels').selectOption('2');await page.locator('#confirm').tap();assert.equal((await snapshot()).level,2);assert.equal((await snapshot()).movesUsed,0);
      for(const viewport of [{width:1024,height:650},{width:820,height:560},{width:768,height:1024},{width:390,height:844}]){await page.setViewportSize(viewport);await fits(`${id} ${viewport.width}x${viewport.height}`);}
      await page.setViewportSize({width:1024,height:650});

      // Reduced motion runs the same rules and allows a whole real opening level
      // to be checked, including results, save restore, and the next-level action.
      await page.emulateMedia({reducedMotion:'reduce'});await install(initial);
      for(const action of plan.moves)await tapMove(action);
      assert.deepEqual(await snapshot(),plan.finished);assert.equal((await snapshot()).phase,'won');
      assert.equal(await page.locator('#score').textContent(),String(plan.finished.score),'HUD reaches the exact final score');
      assert(await page.locator('#result').isVisible());assert(await page.locator('#next').isVisible());await fits(`${id} won`);
      await page.reload();await waitIdle();assert.deepEqual(await snapshot(),plan.finished);
      await page.locator('#next').tap();assert.equal((await snapshot()).level,1);assert.equal((await snapshot()).phase,'playing');
      await page.emulateMedia({reducedMotion:'no-preference'});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Match games: multi-touch isolation, in-flight navigation and loss/retry preserve rules',{timeout:90000},async()=>{
  const C=require('../assets/js/match-core.js');
  const {server,browser,base}=await serverAndBrowser();
  try{
    const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const snapshot=()=>page.evaluate(()=>MatchGame.snapshot());
    const waitIdle=()=>page.waitForFunction(()=>window.MatchGame&&!MatchGame.busy());
    async function install(state){await page.goto(base+'index.html');await page.evaluate(([key,state])=>localStorage.setItem(key,JSON.stringify(state)),[storageKey(state.id),state]);await page.goto(base+`games/${state.id}/index.html`);await waitIdle();assert.deepEqual(await snapshot(),state);}
    const initial=C.fresh('candyland',0,741);await install(initial);
    const move=C.hint(initial),expected=clone(initial);assert(C.play(expected,...move).ok);
    await page.evaluate(([a,b])=>{
      const from=document.querySelector(`#cells [data-cell="${a}"]`),to=document.querySelector(`#cells [data-cell="${b}"]`),other=document.querySelector('#cells [data-cell="48"]');
      const r=from.getBoundingClientRect(),t=to.getBoundingClientRect(),q=other.getBoundingClientRect();
      const event=(el,type,pointerId,isPrimary,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId,isPrimary,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));
      event(from,'pointerdown',51,true,r.x+r.width/2,r.y+r.height/2);
      event(other,'pointerdown',52,false,q.x+q.width/2,q.y+q.height/2);
      event(other,'pointerup',52,false,q.x+q.width/2,q.y+q.height/2);
      event(from,'pointermove',51,true,t.x+t.width/2,t.y+t.height/2);
      event(from,'pointerup',51,true,t.x+t.width/2,t.y+t.height/2);
    },move);
    await waitIdle();assert.deepEqual(await snapshot(),expected,'second finger cannot replace the active swipe');

    // Simulation commits before cosmetic frames; a reload in the middle must
    // restore exactly one move, without restoring a half-cleared board.
    const next=C.hint(expected),after=clone(expected);assert(C.play(after,...next).ok);
    for(const i of next)await page.locator(`#cells [data-cell="${i}"]`).tap();
    assert(await page.evaluate(()=>MatchGame.busy()));
    await page.reload();await waitIdle();assert.deepEqual(await snapshot(),after);

    // Reach defeat only through legal moves, retaining the official target and
    // move budget, then verify retry actually resets the same level.
    let lost;
    for(const seed of [37,741,1027]){
      const s=C.fresh('gemquest',11,seed);
      for(let i=0;s.phase==='playing'&&i<60;i++){const choices=candidates(C,s);choices.sort((a,b)=>progress(a.next)-progress(b.next)||a.next.score-b.next.score);if(!choices.length)break;Object.assign(s,choices[0].next);}
      if(s.phase==='lost'){lost=s;break;}
    }
    assert(lost,'the last level can finish with a genuine loss');await install(lost);
    assert(await page.locator('#result').isVisible());assert(await page.locator('#retry').isVisible());await page.locator('#retry').tap();
    const retry=await snapshot();assert.equal(retry.level,11);assert.equal(retry.phase,'playing');assert.equal(retry.movesUsed,0);assert(retry.movesLeft>0);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Candy timed round: restore, explicit pause, help, reload and timeout preserve the clock',{timeout:45000},async()=>{
  const C=require('../assets/js/match-core.js');
  const {server,browser,base}=await serverAndBrowser();
  try{
    const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const snapshot=()=>page.evaluate(()=>MatchGame.snapshot());
    async function install(state){await page.goto(base+'index.html');await page.evaluate(([key,state])=>localStorage.setItem(key,JSON.stringify(state)),[storageKey(state.id),state]);await page.goto(base+'games/candyland/index.html');await page.waitForFunction(()=>window.MatchGame&&!MatchGame.busy());assert.deepEqual(await snapshot(),state);}
    const initial=C.fresh('candyland',7,23);await install(initial);
    assert(await page.evaluate(()=>MatchGame.paused()));assert(await page.locator('#timer').isVisible());
    await page.waitForTimeout(300);assert.deepEqual(await snapshot(),initial,'a restored clock awaits a deliberate resume');
    await page.locator('#pause').tap();await page.waitForFunction(()=>MatchGame.snapshot().timeLeft<89.7);
    await page.locator('#pause').tap();const paused=await snapshot();
    await page.waitForTimeout(300);assert.deepEqual(await snapshot(),paused,'pause freezes time and board');
    await page.locator('#pause').tap();await page.locator('#help').tap();const help=await snapshot();
    await page.waitForTimeout(300);assert.deepEqual(await snapshot(),help,'reading instructions freezes the clock');
    await page.locator('#confirm').tap();await page.waitForFunction(previous=>MatchGame.snapshot().timeLeft<previous-.15,help.timeLeft);
    await page.reload();await page.waitForFunction(()=>window.MatchGame&&!MatchGame.busy());
    const restored=await snapshot();assert(await page.evaluate(()=>MatchGame.paused()));
    await page.waitForTimeout(300);assert.deepEqual(await snapshot(),restored,'pagehide persists and pauses a live timed round');
    assert.deepEqual(C.restore('candyland',restored),restored);
    const almostOver=C.fresh('candyland',7,23);almostOver.timeLeft=.05;await install(almostOver);
    await page.locator('#pause').tap();await page.waitForFunction(()=>MatchGame.snapshot().phase==='lost');
    assert.equal((await snapshot()).timeLeft,0);assert(await page.locator('#result').isVisible());assert(await page.locator('#retry').isVisible());
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
