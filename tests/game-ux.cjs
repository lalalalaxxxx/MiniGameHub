'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup}=require('./helpers/extra-browser.cjs');
const {game,plan,perform}=require('./helpers/riddles.cjs');
const manifest=require('../games/manifest.json');

test('every game protects touch surfaces and exposes a reachable compact tools drawer',{timeout:180000},async t=>{
 const h=await setup();try{
  for(const g of manifest){
   const html=fs.readFileSync(path.join(__dirname,'..',g.entry),'utf8');
   assert.equal((html.match(/src="\.\.\/\.\.\/assets\/js\/game-ux.js"/g)||[]).length,1,g.id+' shared script');
   await h.page.goto(h.base+g.entry);
   for(const viewport of [{width:1024,height:650},{width:768,height:500},{width:390,height:844}]){
    await h.page.setViewportSize(viewport);
    const more=h.page.locator('#game-more');await more.click();
    const report=await h.page.evaluate(()=>{
     const menu=document.getElementById('game-tools'),r=menu.getBoundingClientRect();
     return {open:menu.open,select:getComputedStyle(document.body).userSelect||getComputedStyle(document.body).webkitUserSelect,
      zoom:visualViewport.scale,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},
      small:[...menu.querySelectorAll('button,select')].filter(el=>!el.hidden).filter(el=>el.getBoundingClientRect().height<43).map(el=>el.id),
      cancel:['selectstart','contextmenu','gesturestart','gesturechange'].map(type=>!document.body.dispatchEvent(new Event(type,{bubbles:true,cancelable:true})))};
    });
    assert.equal(report.open,true);assert.equal(report.select,'none');assert.deepEqual(report.cancel,[true,true,true,true]);assert.equal(report.zoom,1);
    assert.ok(report.rect.x>=0&&report.rect.y>=0&&report.rect.right<=viewport.width+1&&report.rect.bottom<=viewport.height+1,g.id+' menu bounds '+JSON.stringify(report));
    assert.deepEqual(report.small,[],g.id+' minimum tool targets');
    await h.page.locator('#game-tools-close').click();assert.equal(await more.getAttribute('aria-expanded'),'false');
   }
   t.diagnostic(g.id+' touch protection and three viewport menus');
  }
 }finally{await h.close();}
});

test('puzzle wins advance automatically, pause/background and staying cancel the transition',{timeout:60000},async()=>{
 const h=await setup();try{
  await h.page.clock.install({time:new Date('2030-01-01T00:00:00Z')});await h.page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
  for(const id of ['mirrorlight','firefly','boxtrail','colorsort','starpath']){
   await h.install(game(id).create(0,37));await h.page.locator('#resume').click({force:true});
   for(const action of plan(id,0)){await perform(h,action);await h.page.clock.runFor(1100);}
   assert.equal((await h.snap()).phase,'won');assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),true);
   await h.page.clock.runFor(4000);assert.equal((await h.snap()).level,1,id+' advances');assert.equal((await h.snap()).phase,'playing');assert.equal(await h.page.evaluate(()=>ExtraGame.paused()),false);
  }
  for(const interrupt of ['stay','pause','hidden','menu','reload']){
   await h.install(game('mirrorlight').create(0,37));await h.page.locator('#resume').click({force:true});await perform(h,plan('mirrorlight',0)[0]);await h.page.clock.runFor(1200);
   if(interrupt==='stay')await h.page.locator('.ux-next button').click({force:true});
   if(interrupt==='pause')await h.page.locator('#pause').click({force:true});
   if(interrupt==='hidden')await h.page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
   if(interrupt==='menu')await h.page.locator('#game-more').click({force:true});
   if(interrupt==='reload')await h.page.reload();
   await h.page.clock.runFor(10000);assert.equal((await h.snap()).level,0,interrupt+' preserves result');assert.equal((await h.snap()).phase,'won');
  }
  await h.install(game('mirrorlight').create(0,37));await h.page.locator('#resume').click({force:true});await perform(h,plan('mirrorlight',0)[0]);await h.page.clock.runFor(1200);
  await h.page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:90,pointerType:'touch'})));
  await h.page.clock.runFor(6000);assert.equal((await h.snap()).level,0,'a held finger defers advancement');
  await h.page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:90,pointerType:'touch'})));
  await h.page.clock.runFor(300);assert.equal((await h.snap()).level,1,'advance after the finger is released');
 }finally{await h.close();}
});

test('direct puzzle interaction replaces selection buttons and menus freeze ongoing games',{timeout:60000},async()=>{
 const h=await setup();try{
  for(const id of ['mirrorlight','firefly','colorsort','trafficpark']){
   await h.install(require('../assets/js/extras/'+id).create(0,37));await h.page.locator('#resume').tap();
   assert.equal(await h.page.locator('#mechanisms button:visible').count(),0,id+' no duplicate selectors');
  }
  for(const id of ['fireice','tankguard','mushroomwar','waterworks']){
   await h.install(require('../assets/js/extras/'+id).create(0,37));await h.page.locator('#resume').tap();await h.page.waitForTimeout(120);
   await h.page.locator('#game-more').tap();const before=await h.snap();await h.page.waitForTimeout(180);assert.deepEqual(await h.snap(),before,id+' menu pauses simulation');assert.equal(await h.page.evaluate(()=>ExtraGame.effects().raf),false);
   if(id==='fireice'){await h.page.keyboard.press('ArrowRight');assert.deepEqual(await h.page.evaluate(()=>ExtraGame.inputs()),[]);await h.page.keyboard.press('Escape');assert.equal(await h.page.locator('#game-tools').evaluate(el=>el.open),false);}
   else await h.page.locator('#game-tools-close').tap();await h.page.waitForTimeout(120);assert.equal(await h.page.evaluate(()=>ExtraGame.paused()),false);
  }
 }finally{await h.close();}
});
