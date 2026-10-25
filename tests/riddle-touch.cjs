'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs');
const {ids,game,plan,perform,settle,gesture}=require('./helpers/riddles.cjs');

test('riddles: real swipes push boxes, dragging pours bottles, and one continuous stroke completes a constellation',{timeout:35000},async()=>{
  const h=await setup();try{
    const Box=game('boxtrail'),box=Box.create(9,37),dir=Box.solve(box)[0];
    await h.install(box);await h.page.locator('#resume').tap();const swipe=gesture('boxtrail');await h.drag(swipe.from,swipe.to);Box.act(box,dir);
    assert.equal((await h.snap()).p,box.p);assert.deepEqual((await h.snap()).boxes,box.boxes);await h.page.locator('#undo').tap();assert.equal((await h.snap()).moves,0);
    const Sort=game('colorsort'),sort=Sort.create(9,37),pour=Sort.solve(sort)[0];await h.install(sort);await h.page.locator('#resume').tap();
    await h.drag(Sort.center(sort,pour.from),Sort.center(sort,pour.to));Sort.act(sort,'pour',pour);assert.deepEqual((await h.snap()).bottles,sort.bottles);assert.equal((await h.snap()).moves,1);await settle(h.page);
    const Star=game('starpath'),star=Star.create(4,37),route=Star.solve(star);await h.install(star);await h.page.locator('#resume').tap();
    const start=await h.point(Star.nodePoint(star,route[0]));await h.page.mouse.move(start.x,start.y);await h.page.mouse.down();
    for(const node of route.slice(1)){const p=await h.point(Star.nodePoint(star,node));await h.page.mouse.move(p.x,p.y,{steps:7});}
    assert.equal((await h.snap()).moves,0,'unreleased drawing remains a preview');await h.page.mouse.up();await h.result();assert.equal((await h.snap()).phase,'won');assert.deepEqual((await h.snap()).path,route);
  }finally{await h.close();}
});

test('riddles: secondary fingers cannot act or take over, cancelled gestures leave the puzzle unchanged',{timeout:60000},async t=>{
  const h=await setup();try{
    for(const id of ids){
      await h.install(game(id).create(9,37));await h.page.locator('#resume').tap();await settle(h.page);
      const report=await h.page.evaluate(({from,to})=>{
        const c=document.querySelector('#board'),r=c.getBoundingClientRect();
        const emit=(type,pointerId,p,isPrimary)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId,pointerType:'touch',isPrimary,button:0,buttons:type==='pointerup'?0:1,clientX:r.x+p.x/720*r.width,clientY:r.y+p.y/800*r.height}));
        const before=ExtraGame.snapshot();emit('pointerdown',91,from,true);emit('pointerdown',92,to,false);emit('pointermove',92,{x:650,y:650},false);emit('pointerup',92,{x:650,y:650},false);
        const second=ExtraGame.snapshot();emit('pointermove',91,to,true);emit('pointercancel',91,to,true);return{before,second,cancelled:ExtraGame.snapshot(),history:ExtraGame.history()};
      },gesture(id));
      assert.deepEqual(report.second,report.before,id+' second finger does not act');assert.deepEqual(report.cancelled,report.before,id+' cancel rolls back the complete gesture');assert.equal(report.history,0);
      // A real touch immediately after cancellation still works.
      const actions=plan(id,9);for(let i=0;i<actions.length&&(await h.snap()).moves===report.before.moves;i++){await perform(h,actions[i]);await settle(h.page);}
      assert.ok((await h.snap()).moves>report.before.moves,id+' receives the next real touch');
      t.diagnostic(id+': ignored secondary contact, cancellation and subsequent touch');
    }
  }finally{await h.close();}
});

test('riddles: animated feedback finishes, static boards sleep, and reduced motion remains playable',{timeout:90000},async t=>{
  const h=await setup();try{
    await h.page.addInitScript(()=>{window.riddlePaints=0;const set=CanvasRenderingContext2D.prototype.setTransform;CanvasRenderingContext2D.prototype.setTransform=function(...args){if(this.canvas.id==='board')riddlePaints++;return set.apply(this,args);};});
    for(const id of ids){
      await h.install(game(id).create(9,37));await h.page.locator('#resume').tap();await settle(h.page);await h.page.waitForTimeout(230);
      const before=await h.page.evaluate(()=>({state:ExtraGame.snapshot(),paints:riddlePaints}));await h.page.waitForTimeout(160);assert.deepEqual(await h.page.evaluate(()=>({state:ExtraGame.snapshot(),paints:riddlePaints})),before,id+' static puzzle is asleep');
      const actions=plan(id,9);let i=0;while((await h.snap()).moves===before.state.moves){assert.ok(i<actions.length);await perform(h,actions[i++]);}
      assert.equal(await h.page.evaluate(()=>ExtraGame.effects().raf),true,id+' interaction starts animation');
      await h.page.locator('#pause').tap();const frozen=await h.snap();await h.page.waitForTimeout(120);assert.deepEqual(await h.snap(),frozen,id+' pause freezes animation/simulation');
      await h.page.reload();assert.equal((await h.snap()).moves,frozen.moves);await h.page.locator('#resume').tap();await settle(h.page);
      const fx=await h.page.evaluate(()=>ExtraGame.effects());assert.equal(fx.raf,false);assert.equal(fx.particles,0);assert.equal(fx.rings,0);assert.equal(fx.labels,0);
      if(id==='colorsort'){assert.equal(await h.page.locator('[data-action="left"]').isDisabled(),false,'bottle buttons re-enable on the final animation frame before sleeping');await h.page.locator('[data-action="left"]').tap();}
      await h.page.emulateMedia({reducedMotion:'reduce'});await h.install(game(id).create(0,37));await h.page.locator('#resume').tap();
      for(const a of plan(id,0)){await perform(h,a);await settle(h.page);assert.equal(await h.page.evaluate(()=>ExtraGame.effects().particles),0,id+' reduced motion has no confetti');}
      assert.equal((await h.snap()).phase,'won');await h.page.emulateMedia({reducedMotion:'no-preference'});
      t.diagnostic(id+': sleeps when static, animated action, pause/reopen and reduced-motion win');
    }
  }finally{await h.close();}
});
