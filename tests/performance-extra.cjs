'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/extra-browser.cjs');
const Racer=require('../assets/js/extras/buildracer'),C=require('../assets/js/casual-core');

async function installCasual(b,id){
 const state=C.fresh(id,0,37);await b.page.goto(b.base+'index.html');
 await b.page.evaluate(s=>localStorage.setItem(`childgame.casual.${s.id}.v1`,JSON.stringify({state:s})),state);
 await b.page.goto(b.base+`games/${id}/index.html`);await b.page.waitForFunction(()=>window.CasualGame);
}
async function instrument(b){
 await b.page.addInitScript(()=>{
  window.renderProbe={draws:0,writes:0};
  const paint=CanvasRenderingContext2D.prototype.setTransform,write=Storage.prototype.setItem;
  CanvasRenderingContext2D.prototype.setTransform=function(...args){if(this.canvas.id==='board')renderProbe.draws++;return paint.apply(this,args);};
  Storage.prototype.setItem=function(...args){renderProbe.writes++;return write.apply(this,args);};
 });
}
async function stable(b,kind){
 await b.page.waitForFunction(kind=>!window[kind].effects().raf,kind,{timeout:5000});
 await b.page.waitForTimeout(280);
 const before=await b.page.evaluate(kind=>({state:window[kind].snapshot(),probe:{...renderProbe}}),kind);
 await b.page.waitForTimeout(180);
 assert.deepEqual(await b.page.evaluate(kind=>({state:window[kind].snapshot(),probe:{...renderProbe}}),kind),before,'idle board does not simulate, repaint or repeatedly write storage');
}
async function pointerBatch(b){
 const result=await b.page.evaluate(()=>{
  const c=document.querySelector('#board'),r=c.getBoundingClientRect(),base={pointerId:91,pointerType:'touch',isPrimary:true,button:0,bubbles:true,cancelable:true},before=renderProbe.draws;
  c.dispatchEvent(new PointerEvent('pointerdown',{...base,clientX:r.x+r.width*.5,clientY:r.y+r.height*.5}));
  for(let i=0;i<30;i++)c.dispatchEvent(new PointerEvent('pointermove',{...base,clientX:r.x+r.width*(.25+i*.01),clientY:r.y+r.height*.4}));
  return {synchronousDraws:renderProbe.draws-before};
 });
 assert.equal(result.synchronousDraws,0,'many input events coalesce into one scheduled render');
 await b.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await b.page.evaluate(()=>document.querySelector('#board').dispatchEvent(new PointerEvent('pointercancel',{pointerId:91,bubbles:true})));
}

test('extra/casual static boards sleep, coalesce gestures, and wake for actual play',{timeout:35000},async()=>{
 const b=await setup();try{
  await instrument(b);await b.install(Racer.create(0,37));await b.page.locator('#resume').click();await stable(b,'ExtraGame');
  for(const viewport of [{width:820,height:560},{width:768,height:500},{width:768,height:1024},{width:1024,height:650}]){
   await b.page.setViewportSize(viewport);
   await b.page.waitForFunction(()=>{const c=document.querySelector('#board'),r=document.querySelector('.stage').getBoundingClientRect(),w=Math.min(r.width,r.height*.9),d=Math.min(2,devicePixelRatio);return c.width===Math.round(w*d)&&c.height===Math.round(w/.9*d);},null,{timeout:1500});
   const bounds=await b.page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,sleeping:!ExtraGame.effects().raf,controls:[...document.querySelectorAll('#mechanisms button,#pause,#help,#restart')].map(b=>{const r=b.getBoundingClientRect();return{y:r.y,bottom:r.bottom,w:r.width,h:r.height};})}));
   assert.ok(bounds.scroll<=bounds.height+1,'sleeping workshop fits resized viewport '+viewport.width+'x'+viewport.height);
   assert.ok(bounds.controls.every(r=>r.y>=0&&r.bottom<=bounds.height+1&&r.w>=32&&r.h>=32),'sleeping workshop controls remain visible');
   assert.equal(bounds.sleeping,true,'resize redraws without restarting the idle game loop');
  }
  await pointerBatch(b);await stable(b,'ExtraGame');await b.tap({x:280,y:325});
  assert.equal((await b.snap()).parts[6],'frame','sleeping editor installs a part on touch');await stable(b,'ExtraGame');
  await b.page.locator('#undo').click();assert.equal((await b.snap()).parts[6],null,'undo wakes editor');
  for(const id of ['bubblepop','brickball']){
   await installCasual(b,id);await b.page.locator('#resume').click();await stable(b,'CasualGame');
   await pointerBatch(b);await stable(b,'CasualGame');
   await b.page.locator('#primary').click();
   await b.page.waitForFunction(()=>{const s=CasualGame.snapshot();return !!(s.shot||s.volley);});
   assert.equal(await b.page.evaluate(()=>CasualGame.effects().raf),true,id+' resumes simulation after launch');
   await b.page.locator('#pause').click();await stable(b,'CasualGame');
  }
 }finally{await b.close();}
});

test('cached scenery preserves moving art, destroyed walls and resize quality with bounded storage',{timeout:50000},async t=>{
 const b=await setup();try{
  for(const id of ['fireice','zumapath','slingblocks','tankguard','bombergarden','trafficpark','tripletown']){
   const G=require('../assets/js/extras/'+id);await b.install(G.create(9,37));
   const report=await b.page.evaluate(id=>{
    const G=ExtraGames[id],cache=ExtraRender,view={time:1,dt:1/60,reduced:false},sizes=[];let s=G.create(9,37);
    function render(useCache,scale=1,scaleY=scale,pixels=true){window.ExtraRender=useCache?cache:undefined;const c=document.createElement('canvas');c.width=Math.round(720*scale);c.height=Math.round(800*scaleY);const g=c.getContext('2d'),draw=g.drawImage;g.drawImage=function(image,...args){if(useCache&&args.length===4&&args[0]===0&&args[1]===0&&args[2]===720&&args[3]===800)sizes.push({actual:[image.width,image.height],expected:[c.width,c.height]});return draw.call(this,image,...args);};g.setTransform(c.width/720,0,0,c.height/800,0,0);G.draw(g,s,view);window.ExtraRender=cache;return pixels?g.getImageData(0,0,c.width,c.height).data:null;}
    function compare(){const a=render(false),b=render(true);let total=0,different=0;for(let i=0;i<a.length;i+=4){let delta=0;for(let j=0;j<3;j++){const d=Math.abs(a[i+j]-b[i+j]);total+=d;delta=Math.max(delta,d);}if(delta>40)different++;}return{mean:total/(a.length/4*3),different:different/(a.length/4)};}
    const initial=compare();let changed=null;
    if(id==='bombergarden'){
     // A real timed bomb breaks this crate and must invalidate the cached map.
     s=G.create(0,37);s.grid[13]=2;render(true);G.act(s,'bomb');s.bombs[0].time=.01;G.step(s,1/120);G.step(s,1/120);changed={cleared:s.grid[13]===0,...compare()};
    }
    if(id==='tankguard'){
     const tile=11*13+5;s.player.x=74+5*44+22;s.player.y=110+10*44+22;s.player.dir=2;render(true);G.act(s,'fire');for(let i=0;i<12;i++)G.step(s,1/120);changed={cleared:s.grid[tile]===0,...compare()};
    }
    // Cache dimensions adapt to the actual canvas scale; many level switches stay bounded.
    for(const [x,y] of [[.5,.5],[1.5,1.5],[2,2],[2.375,2.375],[2.5,2.25]])render(true,x,y,false);
    for(let level=0;level<10;level++){const next=G.create(level,level+9),c=document.createElement('canvas');c.width=720;c.height=800;G.draw(c.getContext('2d'),next,view);}
    return{initial,changed,sizes,stats:cache.stats()};
   },id);
   t.diagnostic(id+' '+JSON.stringify({initial:report.initial,changed:report.changed,scales:report.sizes.length,stats:report.stats}));
   assert.ok(report.initial.mean<2.5&&report.initial.different<.025,id+' preserves artwork with only raster antialiasing differences');
   if(report.changed){assert.equal(report.changed.cleared,true,id+' destroyed a wall');assert.ok(report.changed.mean<2.5&&report.changed.different<.025,id+' repaint after destruction matches live geometry');}
   assert.ok(report.sizes.some(s=>s.expected[0]>1440),'includes a canvas larger than twice logical resolution');
   for(const size of report.sizes)assert.deepEqual(size.actual,size.expected,id+' background uses exact physical pixels on both axes');
   assert.ok(report.stats.layers<=3&&report.stats.sprites<=32,id+' caches stay bounded across levels');
  }
 }finally{await b.close();}
});

test('extra backgrounds match large iPad portrait pixels at DPR 2 and 3 after rotation',{timeout:30000},async t=>{
 const b=await setup(),errors=[];try{
  for(const dpr of [2,3]){
   const context=await b.browser.newContext({viewport:{width:820,height:1180},deviceScaleFactor:dpr,hasTouch:true,serviceWorkers:'block'});
   try{
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(b.base+'games/fireice/index.html');await page.waitForFunction(()=>window.ExtraGame);
    for(const size of [{width:820,height:1180},{width:1024,height:1366},{width:1180,height:820}]){
     await page.setViewportSize(size);
     await page.waitForFunction(()=>{const c=document.querySelector('#board'),r=document.querySelector('.stage').getBoundingClientRect(),w=Math.min(r.width,r.height*.9),d=Math.min(2,devicePixelRatio);return c.width===Math.round(w*d)&&c.height===Math.round(w/.9*d);});
     const report=await page.evaluate(()=>{
      const c=document.querySelector('#board'),g=c.getContext('2d'),draw=g.drawImage,images=[];
      g.drawImage=function(image,...args){if(args.length===4&&args[0]===0&&args[1]===0&&args[2]===720&&args[3]===800)images.push([image.width,image.height]);return draw.call(this,image,...args);};
      try{g.setTransform(c.width/720,0,0,c.height/800,0,0);ExtraGames.fireice.draw(g,ExtraGame.snapshot(),{time:0,dt:0,reduced:false});}finally{g.drawImage=draw;}
      const r=c.getBoundingClientRect();return{dpr:devicePixelRatio,canvas:[c.width,c.height],css:[r.width,r.height],images,stats:ExtraRender.stats()};
     });
     t.diagnostic(JSON.stringify({viewport:size,...report}));
     assert.equal(report.dpr,dpr);assert.equal(report.images.length,1);assert.deepEqual(report.images[0],report.canvas,'cached background matches the physical canvas exactly');
     assert.ok(Math.abs(report.canvas[0]-report.css[0]*2)<=1&&Math.abs(report.canvas[1]-report.css[1]*2)<=1,'fit remains the sole DPR 2 cap');
     if(size.width===1024)assert.ok(report.canvas[0]>1440&&report.canvas[1]>1600,'large iPad exceeds logical scale 2');
     assert.ok(report.stats.layers<=3);
    }
   }finally{await context.close();}
  }
  assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
