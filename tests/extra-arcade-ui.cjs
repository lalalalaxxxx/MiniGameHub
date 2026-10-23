'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs'),{zumaTurn,slingTurn,bomberTurn}=require('./helpers/extra-arcade.js');
const keys=['up','right','down','left'];
for(const id of ['zumapath','slingblocks','bombergarden','tankguard'])test('Extra arcade UI: '+id+' real opening level, result and next level',{timeout:240000},async()=>{
 const h=await setup(),{page,install,snap}=h,G=require('../assets/js/extras/'+id+'.js');
 try{
  await install(G.create(0,37));await page.locator('#resume').tap();
  if(id==='zumapath'){
   for(let i=0;i<65&&(await snap()).phase==='playing';i++){
    const s=await snap(),turn=zumaTurn(G,s);if(!turn){await page.waitForTimeout(700);continue;}
    if(turn.action.swap)await page.locator('[data-action="swap"]').tap();await h.tap(turn.action);await page.waitForFunction(()=>!ExtraGame.snapshot().shot);await page.waitForTimeout(650);
   }
  }else if(id==='slingblocks'){
   for(let i=0;i<4&&(await snap()).phase==='playing';i++){
    const turn=slingTurn(G,await snap());await h.drag({x:145,y:578},turn.action);
    if(turn.burstAt!==null){await page.waitForFunction(()=>{const s=ExtraGame.snapshot();return s.phase!=='playing'||s.ball&&s.bodies.some(b=>b.type==='target'&&Math.hypot(b.x-s.ball.x,b.y-s.ball.y)<105);});if((await snap()).phase==='playing')await page.locator('[data-action="burst"]').tap();}
    await page.waitForFunction(()=>{const s=ExtraGame.snapshot();return s.phase!=='playing'||!s.ball&&s.settling<=0;});
   }
  }else if(id==='bombergarden'){
   async function walk(path){for(const d of path){if((await snap()).phase!=='playing')return;await page.waitForTimeout(160);await page.locator(`[data-action="${keys[d]}"]`).tap();}await page.waitForTimeout(160);}
   for(let i=0;i<30&&(await snap()).phase==='playing';i++){
    const turn=bomberTurn(G,await snap());assert(turn,'legal bombing route');await walk(turn.path);if((await snap()).phase!=='playing')break;await page.locator('[data-action="bomb"]').tap();await walk(turn.escape);await page.waitForTimeout(2700);
   }
  }else{
   await h.hold('up',317);
   await page.evaluate(()=>{const b=document.querySelector('[data-action="fire"]'),r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:11,button:0,isPrimary:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));});
   for(let i=0;i<1600&&(await snap()).phase==='playing';i++){
    await page.evaluate(()=>{const s=ExtraGame.snapshot(),distance=e=>Math.hypot(e.x-s.player.x,e.y-s.player.y),aligned=e=>Math.abs(e.x-s.player.x)<19||Math.abs(e.y-s.player.y)<19;
     const e=s.bullets.filter(b=>b.enemy&&aligned(b)&&distance(b)<180).sort((a,b)=>distance(a)-distance(b))[0]||s.enemies.filter(aligned).sort((a,b)=>distance(a)-distance(b))[0];
     if(e){const dx=e.x-s.player.x,dy=e.y-s.player.y,a=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up',b=document.querySelector(`[data-action="${a}"]`),r=b.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])b.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:12,button:0,isPrimary:false,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));}
     if((s.player.hp<2&&s.invuln<=0||s.baseHp<3&&s.baseShield<=0)&&s.shields)document.querySelector('[data-action="shield"]').click();
    });await page.waitForTimeout(50);
   }
  }
  await h.result();assert((await snap()).score>0);await h.capture(id+'-result');await page.reload();assert.equal((await snap()).phase,'won');await page.locator('#resume').tap();assert.equal((await snap()).level,1);assert.equal((await snap()).phase,'playing');assert(!(await page.locator('#overlay').isVisible()));
 }finally{await h.close();}
});
