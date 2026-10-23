'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs');
const Water=require('../assets/js/extras/waterworks'),Tank=require('../assets/js/extras/tankguard'),War=require('../assets/js/extras/mushroomwar'),Bomber=require('../assets/js/extras/bombergarden');
function advance(G,s,seconds){for(let i=0;i<seconds*120&&s.phase==='playing';i++)G.step(s,1/120);return s;}
function fixtures(){
 const water=Water.create(9,37);Water.act(water,'water');advance(Water,water,7);assert.ok(water.drops.length>=90,'water fixture has many physical droplets');
 const tank=Tank.create(9,37);advance(Tank,tank,8);assert.ok(tank.enemies.length>=3,'tank fixture has concurrent attackers');
 const war=War.create(9,37);for(const n of war.nodes)n.troops=180;const a=war.nodes[0],b=war.nodes[1],distance=Math.hypot(b.x-a.x,b.y-a.y);for(let i=0;i<40;i++){const progress=(i%10)*.018;war.waves.push({id:war.nextId++,from:a.id,to:b.id,team:1,count:48,x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress,progress,distance,speed:78,alive:true});}assert.equal(war.waves.length,40);
 return[water,tank,war];
}
test('extras: busy scenes retain responsive frames under 4× CPU and bounded effects',{timeout:90000},async t=>{
 if(process.env.TEST_BROWSER==='webkit'){t.skip('CDP CPU throttling is Chromium-only');return;}
 const b=await setup();let cdp;try{cdp=await b.page.context().newCDPSession(b.page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 for(const state of fixtures()){
  await b.install(state);await b.page.evaluate(()=>{const G=ExtraGames[document.body.dataset.game],draw=G.draw;window.drawCosts=[];G.draw=function(...args){const at=performance.now();draw.apply(this,args);drawCosts.push(performance.now()-at);if(drawCosts.length>300)drawCosts.shift();};});
  await b.page.locator('#resume').click();if(state.id==='tankguard'){await b.page.locator('#board').focus();await b.page.keyboard.down('Space');}
  const report=await b.page.evaluate(()=>new Promise(resolve=>{const gaps=[],max={particles:0,rings:0,labels:0};let previous=0,frames=0;function frame(now){if(previous&&frames>20)gaps.push(now-previous);previous=now;frames++;const fx=ExtraGame.effects();for(const k of Object.keys(max))max[k]=Math.max(max[k],fx[k]);if(frames<150){requestAnimationFrame(frame);return;}const sorted=gaps.slice().sort((a,b)=>a-b),costs=drawCosts.slice(20).sort((a,b)=>a-b);resolve({id:document.body.dataset.game,frames:gaps.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],drawP95:costs[Math.floor(costs.length*.95)],max,phase:ExtraGame.snapshot().phase});}requestAnimationFrame(frame);}));
  if(state.id==='tankguard')await b.page.keyboard.up('Space');t.diagnostic(JSON.stringify(report));assert.equal(report.phase,'playing','fixture stays active while sampled');assert.ok(report.frames>=100);assert.ok(report.median<30,`${state.id} median frame ${report.median} ms`);assert.ok(report.p95<55,`${state.id} p95 frame ${report.p95} ms under 4× CPU`);assert.ok(report.drawP95<30,`${state.id} p95 render ${report.drawP95} ms under 4× CPU`);assert.ok(report.max.particles<=160);assert.ok(report.max.rings<=18);assert.ok(report.max.labels<=14);
  await b.page.locator('#pause').click();await b.page.waitForTimeout(150);assert.equal(await b.page.evaluate(()=>ExtraGame.effects().raf),false,'paused simulation releases RAF');const before=await b.snap();await b.page.waitForTimeout(250);assert.deepEqual(await b.snap(),before,'paused state is frozen');
 }
 }finally{if(cdp)await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await b.close();}
});
test('extras: reduced motion removes burst particles while keeping game interactions',{timeout:20000},async()=>{const b=await setup();try{await b.page.emulateMedia({reducedMotion:'reduce'});const s=Bomber.create(0,37);s.grid[13]=2;Bomber.act(s,'bomb');await b.install(s);await b.page.locator('#resume').click();const result=await b.page.evaluate(()=>new Promise(resolve=>{let maxParticles=0,sawBurst=false,frames=0;function sample(){const s=ExtraGame.snapshot(),fx=ExtraGame.effects();maxParticles=Math.max(maxParticles,fx.particles);sawBurst||=s.flames.length>0;frames++;if(sawBurst&&s.flames.length===0||frames>260)resolve({maxParticles,sawBurst,cleared:s.grid[13]===0});else requestAnimationFrame(sample);}sample();}));assert.ok(result.sawBurst,'timed explosion still fires');assert.ok(result.cleared,'soft wall still clears');assert.equal(result.maxParticles,0,'decorative confetti disabled');}finally{await b.close();}});
