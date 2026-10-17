const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const data=require('../assets/js/academy-data.js'),C=require('../assets/js/academy-core.js'),A=require('../assets/js/academy-activities.js');
const root=path.resolve(__dirname,'..'),entries=Object.entries(data).filter(([,c])=>c.kind);
test('Five activities: all content, bounded edits, correct construction and damaged saves',()=>{
  const ids=new Set();
  for(const [,config]of entries)for(const [level,bank]of config.banks.entries()){
    assert(bank.length>=12);const kind=config.kind;
    for(const q of bank){
      assert(!ids.has(q.id));ids.add(q.id);assert(q.prompt&&q.speech&&q.hint&&q.explain);
      for(const type of ['prompt','hint','explain'])assert(fs.statSync(path.join(root,`assets/audio/academy/${q.id}-${type}.mp3`)).size>1000);
      let w=A.fresh(kind,q);assert.deepEqual(A.restore(kind,q,{selected:[-1],counts:[999],time:-1}),w);
      if(kind==='build'||kind==='sentence'){
        assert(q.parts.every((s,i)=>q.pool[i]===s));
        for(let i=0;i<q.parts.length;i++){w=A.reduce(kind,q,w,'w-add',i);const before=w;w=A.reduce(kind,q,w,'w-add',i);assert.deepEqual(w,before);}
        assert(A.won(kind,q,w));w=A.reduce(kind,q,w,'w-remove',0);assert(!A.won(kind,q,w));w=A.reduce(kind,q,w,'w-clear');assert.deepEqual(w,{selected:[]});
      }else if(kind==='clock'){
        assert(q.time>=0&&q.time<720&&q.time%5===0);if(!level)assert.equal(q.time%60,0);
        assert(A.won(kind,q,{time:q.time}));assert.equal(A.reduce(kind,q,{time:715},'w-time',5).time,0);assert.equal(A.reduce(kind,q,{time:0},'w-time',-5).time,715);
      }else if(kind==='share'){
        assert.equal(q.total,q.children*q.each);
        for(let i=0;i<q.each;i++)w=A.reduce(kind,q,w,'w-round');assert(A.won(kind,q,w));assert.deepEqual(A.reduce(kind,q,w,'w-give',0),w);w=A.reduce(kind,q,w,'w-take',0);assert(!A.won(kind,q,w));
      }else{
        assert.equal(q.order.filter(Boolean).length,level?2:1);
        for(let i=0;i<q.order.length;i++)for(let n=0;n<q.order[i];n++)w=A.reduce(kind,q,w,'w-give',i);assert(A.won(kind,q,w));w=A.reduce(kind,q,w,'w-give',0);assert(!A.won(kind,q,w));
      }
    }
    for(let seed=0;seed<20;seed++)assert.equal(new Set(C.questions(config,level,seed).map(q=>q.id)).size,6);
  }
});
test('Five games: full touch play at both ages, drag/cancel, retry, save, sound and responsive layouts',{timeout:300000},async()=>{
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
  const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'}),errors=[];
    await context.addInitScript(()=>{window.__voice=null;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__voice=this;return play.call(this);};});
    for(const [id,config]of entries.filter(([id])=>!process.env.ACADEMY_GAME||id===process.env.ACADEMY_GAME)){
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const key=`childgame.academy.${id}.v1`,url=`http://127.0.0.1:${server.address().port}/games/${id}/index.html`;
      const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),button=(action,value)=>page.locator(`[data-action="${action}"]${value===undefined?'':`[data-value="${value}"]`}`);
      for(const level of [0,1]){
        await page.goto(url);if(level)await page.locator('[data-level="1"]').tap();await button('start').tap();let s=await saved();assert.equal(s.level,level);const qs=C.questions(config,level,s.seed),kind=config.kind;
        for(let i=0;i<6;i++){
          const q=qs[i];assert.equal((await saved()).index,i);
          if(i===0){
            await page.locator('#listen').tap();if(engine===chromium)await page.waitForFunction(()=>window.__voice.currentTime>0&&!window.__voice.paused);
            await page.locator('#sound').tap();assert(await page.evaluate(()=>window.__voice.paused));await page.locator('#sound').tap();
            await page.locator('#help').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));assert(await page.evaluate(()=>window.__voice.paused));await page.locator('#confirm').tap();
            const old=await saved();await page.locator('#restart').tap();await page.locator('#cancel').tap();assert.deepEqual(await saved(),old);
            // Pointer drag inserts only once; dropping outside leaves the state unchanged.
            if(kind==='build'||kind==='sentence'){
              const box=await button('w-add',0).boundingBox(),target=await page.locator('.assembly-target').boundingBox();
              await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(target.x+30,target.y+30,{steps:5});await page.mouse.up();assert.deepEqual((await saved()).work.selected,[0]);await page.waitForTimeout(410);await button('w-clear').tap();
              const from=await button('w-add',0).boundingBox();await page.mouse.move(from.x+20,from.y+20);await page.mouse.down();await page.mouse.move(5,5,{steps:5});await page.mouse.up();assert.deepEqual((await saved()).work.selected,[]);await page.waitForTimeout(410);
              if(engine===chromium&&level===0){
                await button('w-add',0).scrollIntoViewIfNeeded();
                const a=await button('w-add',0).boundingBox(),b=await button('w-add',1).boundingBox(),target=await page.locator('.assembly-target').boundingBox();
                const cdp=await context.newCDPSession(page),p1={id:1,x:a.x+a.width/2,y:a.y+a.height/2},p2={id:2,x:b.x+b.width/2,y:b.y+b.height/2};
                await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p1,x:target.x+30,y:target.y+30},p2]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
                assert.deepEqual((await saved()).work.selected,[]);await cdp.detach();
              }
            }
          }
          // Make an incorrect answer through the same controls used by children.
          if(kind==='clock'&&A.won(kind,q,(await saved()).work))await button('w-time',60).tap();
          if(kind==='share'||kind==='shop')await button('w-give',0).tap();
          await button('w-check').tap();assert.equal((await saved()).solved,false);assert(await page.locator('.counting').isVisible());
          if(kind==='share'||kind==='shop'){await button('w-take',0).tap();assert((await saved()).work.counts.every(n=>n===0));}
          await button('w-clear').tap();
          if(kind==='build'||kind==='sentence'){
            await button('w-add',0).tap();assert(await button('w-add',0).isDisabled());await button('w-remove',0).tap();
            for(let j=0;j<q.parts.length;j++)await button('w-add',j).tap();
          }else if(kind==='clock'){
            let delta=(q.time-(await saved()).work.time+1080)%720-360;
            while(Math.abs(delta)>=60){const step=delta>0?60:-60;await button('w-time',step).tap();delta-=step;}
            while(delta!==0){const step=delta>0?5:-5;await button('w-time',step).tap();delta-=step;}
          }else if(kind==='share'){for(let j=0;j<q.each;j++)await button('w-round').tap();assert(await button('w-round').isDisabled());}
          else for(let j=0;j<q.order.length;j++)for(let n=0;n<q.order[j];n++)await button('w-give',j).tap();
          assert(A.won(kind,q,(await saved()).work));
          if(i===0){const old=await saved();await page.reload();assert.deepEqual(await saved(),old);}
          await button('w-check').tap();assert.equal((await saved()).solved,true);assert(await page.locator('.answer-note').isVisible());
          await button('explain').tap();assert((await page.evaluate(()=>window.__voice.src)).endsWith(`${q.id}-explain.mp3`));
          if(i===0){const old=await saved();await page.reload();assert.deepEqual(await saved(),old);}
          if(i===1){for(const viewport of [{width:820,height:1180},{width:390,height:844},{width:1180,height:820}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert((await page.locator('#listen').boundingBox()).height>=44);}
            await page.screenshot({path:path.join(os.tmpdir(),`${id}-${level}.png`),fullPage:true});}
          await page.locator('#next-question').tap();
        }
        assert(await page.locator('#finish-title').isVisible());await button('sticker',3).tap();await page.reload();assert.equal((await saved()).sticker,3);
        if(!level)await page.evaluate(key=>localStorage.removeItem(key),key);
      }
      await button('again').tap();await page.locator('[data-level="0"]').tap();await page.locator('#confirm').tap();assert.equal((await saved()).level,0);
      await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.work={selected:[999],time:NaN,counts:[999]};s.solved=true;localStorage.setItem(key,JSON.stringify(s));},key);await page.reload();assert.equal((await saved()).solved,false);
      await page.evaluate(key=>localStorage.setItem(key,'broken'),key);await page.reload();assert(await button('start').isVisible());
      await page.close();console.log(`PASS ${id}: both ages, six-stage completion and persistence`);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
