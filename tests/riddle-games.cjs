'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs');
const {ids,game,plan,perform,settle}=require('./helpers/riddles.cjs');

test('five riddles: all fifty levels finish through touch controls, save their result and reach the next level',{timeout:300000},async t=>{
  const h=await setup();try{
    await h.page.clock.install({time:new Date('2030-01-01T00:00:00Z')});
    await h.page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
    for(const id of ids){
      const G=game(id);
      for(let level=0;level<G.levels;level++){
        const actions=plan(id,level);assert.ok(actions.length>0,id+' nontrivial level '+level);
        await h.install(G.create(level,37));await h.page.locator('#resume').click({force:true});
        for(const a of actions){await perform(h,a);await h.page.clock.runFor(1100);}
        await h.page.clock.runFor(1800);
        const s=await h.snap();assert.equal(s.phase,'won',id+' level '+(level+1));assert.ok(s.stars>=1&&s.stars<=3);assert.ok(G.validate(s));
        assert.equal(await h.page.locator('#overlay').isVisible(),true);assert.equal(await h.page.evaluate(()=>ExtraGame.effects().raf),false,'completed game stops rendering');
        await h.page.reload();assert.deepEqual(await h.snap(),s,'completed puzzle reloads exactly');assert.equal(await h.page.evaluate(()=>ExtraGame.paused()),true);
        await h.page.locator('#resume').click({force:true});assert.equal((await h.snap()).level,level<G.levels-1?level+1:level);assert.equal((await h.snap()).phase,'playing');
      }
      t.diagnostic(id+': ten complete touch solutions, save/reopen and next level');
    }
  }finally{await h.close();}
});
test('five riddles: real-clock tablet layouts, pause, hints, undo, cancel, audio and corrupt saves',{timeout:150000},async t=>{
  const h=await setup();try{
    for(const id of ids){
      const G=game(id);await h.install(G.create(9,37));
      for(const viewport of [{width:1024,height:650},{width:820,height:560},{width:768,height:500},{width:768,height:1024},{width:390,height:844}]){
        await h.page.setViewportSize(viewport);
        await h.page.waitForFunction(()=>{const c=document.querySelector('#board'),r=document.querySelector('.stage').getBoundingClientRect(),w=Math.min(r.width,r.height*.9),d=Math.min(2,devicePixelRatio);return c.width===Math.round(w*d)&&c.height===Math.round(w/.9*d);});
        const bounds=await h.page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],bad:[...document.querySelectorAll('button,a,select')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).filter(e=>{const r=e.getBoundingClientRect(),side=e.closest('.side')?.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||r.height<43||side&&r.bottom>side.bottom-2;}).map(e=>e.id||e.textContent)}));
        assert.ok(bounds.scroll[0]<=bounds.width+1&&bounds.scroll[1]<=bounds.height+1,id+' fits '+JSON.stringify(viewport));assert.deepEqual(bounds.bad,[],id+' reachable controls');
      }
      await h.page.setViewportSize({width:1024,height:650});await h.page.locator('#resume').tap();await settle(h.page);
      await h.page.locator('#hint').tap();assert.ok((await h.page.locator('#feedback').textContent()).length>3);
      const initial=await h.snap(),actions=plan(id,9);let count=0;
      while((await h.snap()).moves===initial.moves&&count<actions.length){await perform(h,actions[count++]);await settle(h.page);}
      assert.ok((await h.snap()).moves>initial.moves,id+' meaningful touch move');
      await h.page.locator('#undo').tap();assert.equal((await h.snap()).moves,initial.moves);
      await h.page.locator('#help').tap();const help=await h.snap();await h.page.waitForTimeout(120);assert.deepEqual(await h.snap(),help);await h.page.locator('#confirm').tap();
      await h.page.locator('#pause').tap();const saved=await h.snap();await h.page.waitForTimeout(120);assert.deepEqual(await h.snap(),saved);assert.equal(await h.page.evaluate(()=>ExtraGame.effects().raf),false);
      await h.page.reload();assert.deepEqual(await h.snap(),saved);assert.equal(await h.page.evaluate(()=>ExtraGame.paused()),true);
      await h.page.locator('#resume').tap();await settle(h.page);await h.page.locator('#levels').selectOption('0');await h.page.locator('#cancel').tap();assert.equal((await h.snap()).level,9);
      await h.page.locator('#levels').selectOption('0');await h.page.locator('#confirm').tap();assert.equal((await h.snap()).level,0);
      await h.page.locator('#resume').tap();
      if(await h.page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext))){await h.page.waitForFunction(()=>audioDecoded===12);await h.page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');await h.page.locator('#sound').tap();assert.equal(await h.page.locator('#sound').getAttribute('data-audio-state'),'off');await h.page.locator('#sound').tap();await h.page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');}
      await h.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await h.snap();await h.page.waitForTimeout(120);assert.deepEqual(await h.snap(),hidden);assert.equal(await h.page.evaluate(()=>ExtraGame.effects().raf),false);
      await h.page.evaluate(id=>localStorage.setItem(`childgame.extra.${id}.v1`,JSON.stringify({state:{id,bad:true},history:[null],bests:{0:9999}})),id);
      await h.page.reload();assert.equal((await h.snap()).moves,0);assert.equal((await h.snap()).level,0);assert.equal(await h.page.evaluate(()=>ExtraGame.paused()),true);
      t.diagnostic(id+': layouts, undo, resume, help, audio and safe restore');
    }
  }finally{await h.close();}
});
