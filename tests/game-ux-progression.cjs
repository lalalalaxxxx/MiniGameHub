'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs'),{uxControl}=require('./helpers/game-ux.cjs');
const clone=s=>JSON.parse(JSON.stringify(s));
async function install(h,id,key,state){await h.page.goto(h.base+'index.html');await h.page.evaluate(([key,state])=>localStorage.setItem(key,JSON.stringify(state)),[key,state]);await h.page.goto(h.base+`games/${id}/index.html`);}
async function virtual(page){await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));}
function matchFinalMove(C,id){
 const value=s=>s.goals.colors.reduce((n,g)=>n+Math.min(g.count,s.collected[g.color])*5,0)+Math.min(s.goals.covers,s.clearedCovers)*8+Math.min(s.goals.locks,s.clearedLocks)*8+Math.min(s.goals.rescue,s.rescued)*28+Math.min(s.goals.score,s.score)/50+s.board.reduce((n,p,i)=>n+(p.kind==='ingredient'||p.kind==='chest'?Math.floor(i/7)*1.5:0)+(p.special?.3:0),0);
 for(const seed of [741,1027,37,2026]){let s=C.fresh(id,0,seed);for(let n=0;n<60&&s.phase==='playing';n++){
  const options=[];for(let a=0;a<49;a++)for(const b of [a%7<6?a+1:-1,a+7<49?a+7:-1].filter(b=>b>=0)){const next=clone(s);if(C.play(next,a,b).ok)options.push({move:[a,b],next});}
  options.sort((a,b)=>(b.next.phase==='won'?100000:0)+value(b.next)-(a.next.phase==='won'?100000:0)-value(a.next)||b.next.score-a.next.score);
  if(!options.length)break;if(options[0].next.phase==='won')return{state:s,move:options[0].move};s=options[0].next;
 }}throw Error('Opening level needs a legal win: '+id);
}

test('match, pet, casual and cozy campaigns advance after real final actions without another start click',{timeout:90000},async()=>{
 const h=await setup();try{await virtual(h.page);
  const Match=require('../assets/js/match-core.js');
  for(const id of ['candyland','gemquest']){
   const {state,move}=matchFinalMove(Match,id);await install(h,id,`childgame.match.${id}.v1`,state);
   if(await h.page.evaluate(()=>MatchGame.paused()))await h.page.locator('#pause').click({force:true});
   for(const i of move)await h.page.locator(`[data-cell="${i}"]`).click({force:true});
   for(let i=0;i<80&&!await h.page.evaluate(()=>GameUX.transitioning());i++)await h.page.clock.runFor(100);
   assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),true,id+' transition offered');
   await h.page.clock.runFor(4000);assert.equal(await h.page.evaluate(()=>MatchGame.snapshot().level),1);assert.equal(await h.page.evaluate(()=>MatchGame.paused()),false);
  }
  const Pet=require('../assets/js/petlink-core.js');
  for(const mode of ['practice','timed']){
   const s=Pet.fresh(0,37,mode);while(s.board.filter(Boolean).length>2){const pair=Pet.hint(s).pair;assert(Pet.play(s,...pair).ok);}
   const pair=Pet.hint(s).pair;await install(h,'petlink','childgame.petlink.v1',s);if(mode==='timed')await h.page.locator('#resume').click({force:true});
   for(const i of pair)await h.page.locator(`[data-cell="${i}"]`).click({force:true});await h.page.clock.runFor(1000);
   assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),true);await h.page.clock.runFor(4000);assert.equal(await h.page.evaluate(()=>PetLinkGame.snapshot().level),1);assert.equal(await h.page.evaluate(()=>PetLinkGame.paused()),false);
  }
  const {C,settle}=require('./helpers/casual.js');let bubble=C.fresh('bubblepop',0,37),before,aim;
  for(let i=0;i<40&&bubble.phase==='playing';i++){before=clone(bubble);aim=C.hint(bubble);C.act(bubble,'fire',aim);settle(bubble);}assert.equal(bubble.phase,'won');
  await install(h,'bubblepop','childgame.casual.bubblepop.v1',{state:before});await h.page.locator('#resume').click({force:true});await h.tap(aim);await h.page.clock.runFor(13000);assert.equal(await h.page.evaluate(()=>CasualGame.snapshot().level),1);assert.equal(await h.page.evaluate(()=>CasualGame.paused()),false);
  const Cozy=require('../assets/js/cozy-core.js');let cozy=Cozy.fresh('toyblast');cozy.seed=37;Cozy.puzzle(cozy,false);let tile;
  for(let i=0;i<120&&!cozy.won;i++){before=clone(cozy);const groups=cozy.board.map((_,i)=>Cozy.group(cozy.board,i)).filter(g=>g.length>1);groups.sort((a,b)=>b.length-a.length);tile=groups[0][0];Cozy.blast(cozy,tile);}assert(cozy.won);
  await install(h,'toyblast','childgame.cozy.toyblast.v1',before);await h.page.locator(`[data-action=tile][data-value="${tile}"]`).click({force:true});assert.equal(await h.page.evaluate(()=>CozyGame.snapshot().won),true);await h.page.clock.runFor(4000);assert.equal(await h.page.evaluate(()=>CozyGame.snapshot().won),false);assert.equal(await h.page.evaluate(()=>CozyGame.snapshot().moves),0);
 }finally{await h.close();}
});

test('learning rounds and completed sudoku progress automatically, with time to read explanations',{timeout:60000},async()=>{
 const h=await setup();try{await virtual(h.page);
  for(const id of ['shadow','patterns']){
   await h.page.goto(h.base+`games/${id}/index.html`);
   for(let round=0;round<6;round++){
    const answer=await h.page.evaluate(id=>{const a=LearningApp;return id==='shadow'?LearningCore.detective(a.level,a.seed,a.model.round).target.id:LearningCore.pattern(a.level,a.seed,a.model.round).answer;},id);
    await h.page.locator(`[data-action=answer][data-value="${answer}"]`).click({force:true});await h.page.clock.runFor(1000);assert.equal(await h.page.evaluate(()=>LearningApp.model.round),round);await h.page.clock.runFor(3000);
   }
   assert.equal(await h.page.evaluate(()=>LearningApp.level),1);assert.equal(await h.page.evaluate(()=>LearningApp.model.round),0);
  }
  await h.page.goto(h.base+'games/sudoku/index.html');const s=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.sudoku.v1'))),index=s.givens.findIndex(v=>!v);s.values=s.solution.slice();s.values[index]=0;
  await install(h,'sudoku','childgame.sudoku.v1',s);await h.page.locator(`[data-cell="${index}"]`).click({force:true});await h.page.locator(`[data-number="${s.solution[index]}"]`).click({force:true});assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),true);await h.page.clock.runFor(4000);assert.equal(await h.page.locator('#success').isVisible(),false);
  await h.page.evaluate(()=>localStorage.setItem('childgame.sound','off'));await h.page.goto(h.base+'games/hanzi/index.html');await h.page.locator('[data-action=start]').click({force:true});
  const answer=await h.page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('childgame.academy.hanzi.v1'));return AcademyCore.questions(AcademyData.hanzi,s.level,s.seed)[s.index].answer;});
  await h.page.locator(`[data-action=choose][data-value="${answer}"]`).click({force:true});await h.page.clock.runFor(1000);assert.equal(await h.page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.academy.hanzi.v1')).index),0);
  await h.page.clock.runFor(13000);assert.equal(await h.page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.academy.hanzi.v1')).index),1);
 }finally{await h.close();}
});

test('tangram drag reuses one preview and a secondary cancelled finger cannot steal it',{timeout:30000},async()=>{
 const h=await setup();try{
  await h.page.goto(h.base+'games/tangram/index.html');
  const report=await h.page.evaluate(async()=>{
   const root=document.getElementById('activity'),b=root.querySelector('[data-action=select]'),r=b.getBoundingClientRect();
   const send=(type,id,x,y)=>b.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,isPrimary:id===31,pointerType:'touch',button:0,clientX:x,clientY:y}));
   send('pointerdown',31,r.x+10,r.y+10);for(let i=0;i<50;i++)send('pointermove',31,r.x+30+i,r.y+40);
   const syncCount=root.querySelectorAll('#tangram-ghost').length;await new Promise(requestAnimationFrame);const first=document.getElementById('tangram-ghost');
   send('pointercancel',32,r.x,r.y);for(let i=0;i<50;i++)send('pointermove',31,r.x+80+i,r.y+70);await new Promise(requestAnimationFrame);
   const reused=first===document.getElementById('tangram-ghost'),active=LearningApp.busy;send('pointercancel',31,r.x,r.y);
   return{syncCount,reused,active,left:root.querySelectorAll('#tangram-ghost').length,busy:LearningApp.busy};
  });assert.deepEqual(report,{syncCount:0,reused:true,active:true,left:0,busy:false});
 }finally{await h.close();}
});

test('2048 keeps its winning board and menus cancel unfinished match celebrations',{timeout:45000},async()=>{
 const h=await setup();try{await virtual(h.page);
  await h.page.goto(h.base+'games/2048/index.html');
  await h.page.evaluate(()=>{fresh();tileLayerEl.replaceChildren();grid=Array.from({length:4},()=>Array(4).fill(null));grid[0][0]=makeTile(1024,0,0,false);grid[0][1]=makeTile(1024,0,1,false);});
  await h.page.keyboard.press('ArrowLeft');await h.page.clock.runFor(1000);
  assert.equal(await h.page.evaluate(()=>mode),'win');assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),true);
  await h.page.clock.runFor(4000);assert.equal(await h.page.evaluate(()=>mode),'play');assert.equal(await h.page.evaluate(()=>grid.flat().filter(t=>t?.value===2048).length),1);
  const Match=require('../assets/js/match-core.js'),{state,move}=matchFinalMove(Match,'candyland');await install(h,'candyland','childgame.match.candyland.v1',state);
  if(await h.page.evaluate(()=>MatchGame.paused()))await h.page.locator('#pause').click({force:true});
  for(const i of move)await h.page.locator(`[data-cell="${i}"]`).click({force:true});
  assert.equal(await h.page.evaluate(()=>MatchGame.snapshot().phase),'won');
  await h.page.locator('#game-more').click({force:true});await h.page.locator('#game-tools-close').click({force:true});await h.page.clock.runFor(12000);
  assert.equal(await h.page.evaluate(()=>MatchGame.snapshot().level),0);assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),false);
 }finally{await h.close();}
});

test('academy waits for actual explanation audio before automatic progression',{timeout:45000},async t=>{
 if(process.env.TEST_BROWSER==='webkit'){t.skip('Windows WebKit lacks media decoding; muted reading delay is covered separately');return;}
 const h=await setup();try{
  await h.page.goto(h.base+'games/hanzi/index.html');await h.page.locator('[data-action=start]').tap();
  const answer=await h.page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('childgame.academy.hanzi.v1'));return AcademyCore.questions(AcademyData.hanzi,s.level,s.seed)[s.index].answer;});
  await h.page.locator(`[data-action=choose][data-value="${answer}"]`).tap();
  await h.page.waitForFunction(()=>document.getElementById('voice-status')?.textContent==='正在播放…');
  assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),false);
  await h.page.waitForFunction(()=>GameUX.transitioning(),{},{timeout:25000});
  assert.equal(await h.page.locator('#voice-status').textContent(),'听完啦，可以再听一次');
  await h.page.waitForFunction(()=>JSON.parse(localStorage.getItem('childgame.academy.hanzi.v1')).index===1);
 }finally{await h.close();}
});
