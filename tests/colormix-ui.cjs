const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {setup}=require('./helpers/extra-browser.cjs');
const C=require('../games/colormix/core.js');
const key='childgame.colormix.v1';
async function snapshot(h){return h.page.evaluate(()=>ColorGame.snapshot());}
async function mode(h,id){await h.page.locator(`[data-mode="${id}"]`).click();}
async function add(h,c){await h.page.locator(`[data-color="${c}"]`).click();}
async function stay(h){if(await h.page.locator('.ux-next button').isVisible())await h.page.locator('.ux-next button').click();}
async function solve(h){
  const s=await snapshot(h),r=s.rounds[s.mode],remaining=[...C.task(s).drops];
  for(const c of r.drops)remaining.splice(remaining.indexOf(c),1);
  for(const c of remaining)await add(h,c);
  await h.page.locator('#stir').click();await h.page.locator('#apply').click();await stay(h);
}

test('Color studio: all 48 missions, collection, saved progress, and touch-sized responsive layouts',{timeout:180000},async()=>{
  const h=await setup();try{
    await h.page.emulateMedia({reducedMotion:'reduce'});
    await h.page.goto(h.base+'games/colormix/index.html');
    await add(h,'blue');await add(h,'blue');await h.page.locator('#stir').click();await h.page.locator('#apply').click();
    assert.equal((await snapshot(h)).rounds.shop.won,false);
    await h.page.locator('#empty-bowl').click();
    for(const id of ['shop','town','detective','shades']){
      await mode(h,id);
      for(let level=0;level<C.modes[id].count;level++){
        for(let patch=0;patch<(id==='town'?6:1);patch++){
          if(id==='town')await h.page.locator(`[data-patch="${patch}"]`).click();
          await solve(h);
        }
        const s=await snapshot(h);assert(s.rounds[id].won,`${id} ${level} completes`);
        if(level<C.modes[id].count-1)await h.page.locator('#next').click();
      }
    }
    await h.page.reload();let s=await snapshot(h);
    for(const id of ['shop','town','detective','shades'])assert(s.rounds[id].won);
    await mode(h,'lab');
    for(const recipe of Object.values(C.recipes)){
      if((await snapshot(h)).rounds.lab.drops.length)await h.page.locator('#empty-bowl').click();
      for(const c of recipe)await add(h,c);await h.page.locator('#stir').click();
      if(recipe[0]!=='white'){await add(h,'white');await h.page.locator('#stir').click();}
    }
    assert.equal(Object.keys((await snapshot(h)).book).length,15);
    await h.page.locator('#book-button').click();assert.equal(await h.page.locator('.color-card:not(.locked)').count(),15);
    await h.page.locator('#book-dialog [data-close]').last().click();
    for(const [width,height] of [[1180,820],[1024,650],[820,560],[768,1024],[390,844],[320,740],[844,390]]){
      await h.page.setViewportSize({width,height});
      for(const id of Object.keys(C.modes)){
        await mode(h,id);
        const report=await h.page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,small:[...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length&&!e.closest('dialog')).filter(e=>e.getBoundingClientRect().height<43).map(e=>e.id||e.className)}));
        assert(report.width<=width+1,`${id} ${width} horizontal overflow`);
        if(width>=700&&height>=500)assert(report.height<=height+1,`${id} ${width} vertical overflow ${report.height}`);
        assert.deepEqual(report.small,[],`${id} ${width} touch targets`);
      }
    }
    await h.page.setViewportSize({width:1180,height:820});await mode(h,'shop');
    await h.page.screenshot({path:path.join(os.tmpdir(),'colormix-desktop.png')});
    await h.page.setViewportSize({width:390,height:844});await mode(h,'lab');
    await h.page.screenshot({path:path.join(os.tmpdir(),'colormix-mobile.png'),fullPage:true});
    await h.page.goto(h.base.replace('/minigames/','/')+'games/colormix/index.html');assert(await h.page.locator('#modes').isVisible());
  }finally{await h.close();}
});

test('Color studio: drag, cancel, keyboard, safe transitions, narration and storage failures',{timeout:90000},async()=>{
  const h=await setup();try{
    await h.page.addInitScript(()=>{
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){window.lastNarration=this;return play.call(this);};
    });
    await h.page.goto(h.base+'games/colormix/index.html');await mode(h,'lab');
    let start=await h.page.locator('[data-color=red]').boundingBox(),end=await h.page.locator('#bowl').boundingBox();
    await h.page.mouse.move(start.x+20,start.y+20);await h.page.mouse.down();await h.page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:8});await h.page.mouse.up();
    assert.deepEqual((await snapshot(h)).rounds.lab.drops,['red'],'drag adds exactly one drop');
    await h.page.locator('[data-color=yellow]').focus();await h.page.keyboard.press('Enter');assert.deepEqual((await snapshot(h)).rounds.lab.drops,['red','yellow']);
    await h.page.locator('#stir').click();assert.equal((await snapshot(h)).book.orange.length,2);
    if(h.engine.name()==='chromium'){
      await h.page.waitForFunction(()=>window.audioDecoded===12);
      await h.page.locator('#listen').click();
      await h.page.waitForFunction(()=>window.lastNarration?.currentTime>0&&!window.lastNarration.paused);
      assert.match(await h.page.evaluate(()=>window.lastNarration.src),/colormix\/lab.mp3$/);
      await h.page.locator('#game-more').click();assert(await h.page.evaluate(()=>window.lastNarration.paused));
      await h.page.locator('#game-tools-close').click();
      const cdp=await h.page.context().newCDPSession(h.page);
      start=await h.page.locator('[data-color=blue]').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+20,y:start.y+20,id:0}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end.x+50,y:end.y+20,id:0}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.deepEqual((await snapshot(h)).rounds.lab.drops,['red','yellow']);assert(await h.page.locator('#drag-ghost').isHidden());
      // A second finger must not become a second jar/drop in the first gesture.
      const other=await h.page.locator('[data-color=white]').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+20,y:start.y+20,id:0}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+20,y:start.y+20,id:0},{x:other.x+20,y:other.y+20,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.deepEqual((await snapshot(h)).rounds.lab.drops,['red','yellow','blue']);
      await cdp.detach();
    }
    await mode(h,'shop');await add(h,'red');await add(h,'yellow');await h.page.locator('#stir').click();await h.page.locator('#apply').click();
    assert(await h.page.evaluate(()=>GameUX.transitioning()));
    await h.page.locator('#game-more').click();assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),false);
    await h.page.locator('#game-tools-close').click();await h.page.reload();assert.equal((await snapshot(h)).rounds.shop.level,0);assert.equal(await h.page.evaluate(()=>GameUX.transitioning()),false);
    await h.page.locator('#next').click();assert.equal((await snapshot(h)).rounds.shop.level,1);
    // Test real auto-advance and cancellation with a virtual clock after audio has loaded.
    await h.page.locator('#game-more').click();await h.page.locator('#sound').click();
    assert.equal((await snapshot(h)).sound,false);
    await h.page.clock.install();await solve(h);
    await h.page.clock.runFor(8000);assert.equal((await snapshot(h)).rounds.shop.level,1,'stay preserves completed work');
    await h.page.locator('#next').click();
    await add(h,'red');await add(h,'blue');await h.page.locator('#stir').click();await h.page.locator('#apply').click();
    await h.page.clock.runFor(7000);assert.equal((await snapshot(h)).rounds.shop.level,3,'completion advances safely');
    await add(h,'red');await add(h,'yellow');await h.page.locator('#stir').click();await h.page.locator('#apply').click();
    await h.page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
    await h.page.clock.runFor(8000);assert.equal((await snapshot(h)).rounds.shop.level,3,'background cancels progression');
    assert(await h.page.evaluate(()=>window.lastNarration.paused));
    await h.page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
    await h.page.locator('#game-more').click();await h.page.locator('#restart').click();assert(await h.page.locator('#restart-dialog').isVisible());
    await h.page.locator('#confirm-restart').click();assert.equal((await snapshot(h)).rounds.shop.level,0);assert((await snapshot(h)).book.orange);
    await h.page.evaluate(key=>localStorage.setItem(key,'broken'),key);await h.page.reload();assert.equal((await snapshot(h)).mode,'shop');
    await h.page.context().addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked');};Storage.prototype.setItem=()=>{throw Error('blocked');};});
    await h.page.reload();await add(h,'red');assert.match(await h.page.locator('#save-status').textContent(),/暂时不能保存/);
  }finally{await h.close();}
});

test('Color studio: short landscape keeps controls reachable and narration delays automatic advancement',{timeout:45000},async()=>{
  const h=await setup();try{
    await h.page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.lastNarration=this;return play.call(this);};});
    await h.page.setViewportSize({width:844,height:390});
    await h.page.goto(h.base+'games/colormix/index.html');
    for(const id of Object.keys(C.modes)){
      await mode(h,id);
      const geometry=await h.page.evaluate(()=>{
        const story=document.querySelector('.story').getBoundingClientRect(),bench=document.querySelector('.workbench').getBoundingClientRect();
        return {storyBottom:story.bottom,targetBottom:document.querySelector('#target').getBoundingClientRect().bottom,benchBottom:bench.bottom,controlBottom:document.querySelector('#stir').getBoundingClientRect().bottom,width:document.documentElement.scrollWidth};
      });
      assert(geometry.width<=844);assert(geometry.targetBottom<=geometry.storyBottom);assert(geometry.controlBottom<=geometry.benchBottom);
      await h.page.locator('#empty-bowl').scrollIntoViewIfNeeded();assert(await h.page.locator('#empty-bowl').isVisible());
    }
    if(h.engine.name()==='chromium'){
      await h.page.setViewportSize({width:1024,height:650});await mode(h,'shop');
      await add(h,'red');await add(h,'yellow');await h.page.clock.install();
      await h.page.locator('#stir').click();await h.page.locator('#apply').click();
      await h.page.waitForFunction(()=>window.lastNarration?.currentTime>0&&!window.lastNarration.paused);
      await h.page.clock.runFor(7000);
      assert.equal((await snapshot(h)).rounds.shop.level,0,'virtual elapsed time must not cut real narration');
      assert(await h.page.evaluate(()=>GameUX.transitioning()));
      await h.page.evaluate(()=>window.lastNarration.pause());await h.page.clock.runFor(1100);
      assert.equal((await snapshot(h)).rounds.shop.level,1);
    }
  }finally{await h.close();}
});
