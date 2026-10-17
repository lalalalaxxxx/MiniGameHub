const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const data=require('../assets/js/academy-data.js'),C=require('../assets/js/academy-core.js');
const root=path.resolve(__dirname,'..');
test('Academy content: unambiguous choices, arithmetic, unique sessions and bundled narration',()=>{
  const ids=new Set();
  for(const [id,config] of Object.entries(data).filter(([,config])=>!config.kind))for(const [level,bank] of config.banks.entries()){
    assert(bank.length>=12);
    for(const q of bank){
      assert(!ids.has(q.id));ids.add(q.id);assert(q.hint&&q.explain&&q.speech&&q.prompt);
      if(id==='mathtrain'){assert.equal(q.answer,q.op==='+'?q.a+q.b:q.op==='−'?q.a-q.b:q.a*q.b);assert(q.answer>=0&&q.answer<=(level?100:10));}
      else{const options=q.options.map(o=>typeof o==='string'?o:o.id);assert.equal(new Set(options).size,4);assert.equal(options.filter(v=>v===q.answer).length,1);}
      for(const type of ['prompt','hint','explain'])assert(fs.statSync(path.join(root,`assets/audio/academy/${q.id}-${type}.mp3`)).size>1000);
    }
    const seen=new Set();for(let seed=0;seed<100;seed++){const qs=C.questions(config,level,seed);assert.equal(new Set(qs.map(q=>q.id)).size,6);qs.forEach(q=>seen.add(q.id));assert.deepEqual(qs,C.questions(config,level,seed));}assert.equal(seen.size,bank.length);
  }
  const config=data.hanzi,s=C.fresh();assert.deepEqual(C.restore(s,config),s);
  for(const corrupt of [null,{}, {...s,level:3},{...s,index:7},{...s,cargo:-1},{...s,seed:'1'},{...s,solved:true},{...s,index:6}])assert.equal(C.restore(corrupt,config).started,false);
});
test('Academy touch flows: both ages, mistakes, explanations, saves, rewards, audio and layouts',{timeout:180000},async()=>{
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
  const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'}),errors=[];
    await context.addInitScript(()=>{window.__clips=[];window.__plays=[];window.__voice=null;const nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__voice=this;window.__clips.push(this.src);const p=nativePlay.call(this);p.then(()=>window.__plays.push(this.src),()=>{});return p;};});
    for(const [id,config] of Object.entries(data).filter(([,config])=>!config.kind)){
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}/games/${id}/index.html`;
      const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),`childgame.academy.${id}.v1`);
      for(const level of [0,1]){
        await page.goto(url);if(level===1){await page.locator('[data-level="1"]').tap();}await page.locator('[data-action="start"], [data-action="again"]').tap();
        let s=await saved();assert.equal(s.level,level);assert(s.started);const qs=C.questions(config,s.level,s.seed);
        for(let i=0;i<6;i++){
          const q=qs[i];
          await page.locator('#listen').tap();assert((await page.evaluate(()=>window.__clips.at(-1))).endsWith(`${q.id}-prompt.mp3`));
          if(i===0){
            if(engine===chromium){await page.waitForFunction(()=>window.__plays.length>0&&window.__voice.duration>0&&!window.__voice.paused);}
            await page.locator('[data-action="hint"]').tap();assert((await page.evaluate(()=>window.__clips.at(-1))).endsWith(`${q.id}-hint.mp3`));
            await page.locator('#sound').tap();assert(await page.evaluate(()=>window.__voice.paused));
            await page.locator('#sound').tap();
            await page.locator('#help').tap();assert(await page.locator('#dialog').evaluate(el=>el.open));assert(await page.evaluate(()=>window.__voice.paused));await page.locator('#confirm').tap();
          }
          if(id==='mathtrain'){
            // Submit an incorrect load, then adjust by real one/ten-box buttons.
            if(q.answer===0)await page.locator('[data-action="cargo"][data-value="1"]').tap();
            await page.locator('[data-action="check"]').tap();assert.equal((await saved()).solved,false);
            const current=(await saved()).cargo;for(let j=0;j<current;j++)await page.locator('[data-action="cargo"][data-value="-1"]').tap();
            let amount=q.answer;if(level){for(let j=0;j<Math.floor(amount/10);j++)await page.locator('[data-action="cargo"][data-value="10"]').tap();amount%=10;}
            for(let j=0;j<amount;j++)await page.locator('[data-action="cargo"][data-value="1"]').tap();
            assert.equal((await saved()).cargo,q.answer);
            if(i===0){const before=await saved();await page.reload();assert.deepEqual(await saved(),before);}
            await page.locator('[data-action="check"]').tap();
          }else{
            const incorrect=q.options.map(o=>typeof o==='string'?o:o.id).find(v=>v!==q.answer);
            await page.locator(`[data-action="choose"][data-value="${incorrect}"]`).tap();assert.equal((await saved()).solved,false);assert(await page.locator('.counting').isVisible());
            await page.locator(`[data-action="choose"][data-value="${q.answer}"]`).tap();
          }
          assert.equal((await saved()).solved,true);assert(await page.locator('.answer-note').isVisible());
          await page.locator('[data-action="explain"]').tap();assert((await page.evaluate(()=>window.__clips.at(-1))).endsWith(`${q.id}-explain.mp3`));
          if(i===0){const before=await saved();await page.reload();assert.deepEqual(await saved(),before);assert(await page.locator('.answer-note').isVisible());}
          if(i===1){for(const viewport of [{width:820,height:1180},{width:390,height:844},{width:1180,height:820}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await page.locator('#listen').boundingBox();assert(bounds.height>=44);}
            await page.screenshot({path:path.join(os.tmpdir(),`${id}-${level}.png`),fullPage:true});}
          await page.locator('#next-question').tap();assert.equal((await saved()).index,i+1);
        }
        assert(await page.locator('#finish-title').isVisible());await page.locator('[data-action="sticker"][data-value="2"]').tap();assert.equal((await saved()).sticker,2);await page.reload();assert.equal(await page.locator('[data-action="sticker"][aria-pressed="true"]').getAttribute('data-value'),'2');
        // Leave an unstarted session for the next age group.
        if(level===0){await page.evaluate(key=>localStorage.removeItem(key),`childgame.academy.${id}.v1`);}
      }
      await page.locator('[data-action="again"]').tap();const before=await saved();await page.locator('#restart').tap();await page.locator('#cancel').tap();assert.deepEqual(await saved(),before);
      await page.locator('[data-level="0"]').tap();await page.locator('#confirm').tap();assert.equal((await saved()).level,0);assert.equal((await saved()).index,0);
      await page.evaluate(key=>localStorage.setItem(key,'{"level":"bad"}'),`childgame.academy.${id}.v1`);await page.reload();assert(await page.locator('[data-action="start"]').isVisible());
      await page.close();
    }
    assert.deepEqual(errors,[]);
    const restricted=await browser.newContext({serviceWorkers:'block'});await restricted.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked');};Storage.prototype.setItem=()=>{throw Error('blocked');};});const page=await restricted.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/games/hanzi/index.html`);await page.locator('[data-action="start"]').click();assert(await page.locator('.choices').isVisible());assert.match(await page.locator('#save-status').textContent(),/无法保存/);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
