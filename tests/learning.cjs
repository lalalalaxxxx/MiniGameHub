const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../assets/js/learning-core.js');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const ids=['pipes','tangram','market','robot','bento','shadow','patterns','memory','bridge','rhythm'];
function robotCode(map){const queue=[{...map.start,code:[]}],seen=new Set();while(queue.length){const p=queue.shift(),key=[p.x,p.y,p.dir,p.key].join();if(seen.has(key))continue;seen.add(key);if(p.y*5+p.x===map.goal&&(map.key<0||p.key))return p.code;for(const cmd of ['forward','left','right']){const code=[...p.code,cmd],result=C.runRobot(map,code);if(result.path.length===code.length+1)queue.push({...result.path.at(-1),code});}}throw Error('unreachable robot level');}
test('learning level rules: routes, prices, pairs, patterns and structures',()=>{
  for(let l=0;l<3;l++)for(let seed=1;seed<=100;seed++){
    const p=C.pipes(l,seed);assert(C.watered({...p,cells:p.solution}));assert.equal(p.cells.length,p.n*p.n);
    const list=C.shopping(l,seed),price=list.reduce((s,x)=>s+C.foods.find(f=>f.id===x.id).price*x.quantity,0);assert(price>0&&price<30);assert.equal(new Set(list.map(x=>x.id)).size,list.length);
    const memory=C.memory(l,seed);for(const card of memory)assert.equal(memory.filter(x=>x.pair===card.pair).length,2);
    assert.equal(new Set(Array.from({length:6},(_,round)=>C.detective(l,seed,round).target.id)).size,6);
    for(let round=0;round<6;round++){const q=C.pattern(l,seed,round);assert.equal(q.options.filter(x=>x===q.answer).length,1);const d=C.detective(l,seed,round);assert.equal(d.options.filter(x=>x.id===d.target.id).length,1);}
  }
  for(let l=0;l<3;l++){const map=C.robot(l),code=robotCode(map);assert(code.length<=24);assert(C.runRobot(map,code).ok);const b=C.bridge(l),deck=Array(b.n).fill(true),supports=Array.from({length:b.n+1},(_,i)=>b.foundations.includes(i));assert(C.bridgeCheck(b,deck,supports).ok);assert(!C.bridgeCheck(b,deck,Array(b.n+1).fill(false)).ok);deck[0]=false;assert(!C.bridgeCheck(b,deck,supports).ok);}
});
test('all ten learning games complete all three difficulty levels through their UI',{timeout:300000},async t=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const target=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav'})[path.extname(target)]||'application/octet-stream');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{for(const id of ids.filter(id=>!process.env.LEARNING_GAME||process.env.LEARNING_GAME.split(',').includes(id)))await t.test(id,{timeout:90000},async()=>{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'});
    await context.addInitScript(()=>{window.__toneStarts=0;const Native=window.AudioContext||window.webkitAudioContext;if(Native)window.AudioContext=class extends Native{createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{window.__toneStarts++;return start(...args);};return node;}};});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/games/${id}/index.html`);
      const model=()=>page.evaluate(()=>JSON.parse(JSON.stringify(LearningApp.model)));
      const act=async(type,value)=>{const locator=page.locator(`[data-action="${type}"]${value===undefined?'':`[data-value="${value}"]`}`);if(await locator.evaluate(e=>e.tagName.toLowerCase()==='g')){await locator.focus();await page.keyboard.press('Enter');}else await locator.tap();};
      const idle=()=>page.waitForFunction(()=>!LearningApp.busy,null,{timeout:15000});
      const before=await model();
      const initialQuestion=C.detective(0,await page.evaluate(()=>LearningApp.seed),0);
      const first={pipes:['rotate',0],tangram:['rotate'],market:['add',before.list?.[0].id],robot:['command','forward'],bento:['add','apple'],shadow:['answer',initialQuestion.options.find(x=>x.id!==initialQuestion.target.id).id],patterns:['answer','bad'],memory:['flip',0],bridge:['deck',0],rhythm:['hit',0]};
      // Each game gets a real partial action, then refresh and undo that action.
      if(id==='patterns'){const q=C.pattern(0,await page.evaluate(()=>LearningApp.seed),0);first.patterns=['answer',q.options.find(v=>v!==q.answer)];}
      if(id==='rhythm')first.rhythm=['pad',before.sequence[0]];
      await act(...first[id]);const partial=await model();assert.notDeepEqual(partial,before);
      await page.reload();assert.deepEqual(await model(),partial);await page.locator('#undo').tap();assert.deepEqual(await model(),before);
      await page.locator('#help').tap();assert(await page.locator('#dialog').evaluate(e=>e.open));await page.locator('#confirm').tap();
      if(id==='tangram'){
        await act('select',1);await act('place',0);assert.equal((await model()).placed[0],1);assert(await page.locator('[data-action="select"][data-value="1"]').isDisabled());assert(!await page.locator('[data-action="select"][data-value="0"]').isDisabled());await page.locator('#undo').tap();await page.locator('#undo').tap();
        const source=await page.locator('[data-action="select"][data-value="0"]').boundingBox();
        const target=await page.evaluate(()=>{const p=new DOMPoint(230,210).matrixTransform(document.querySelector('#puzzle-scene').getScreenCTM());return {x:p.x,y:p.y};});
        await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:5});assert.equal(await page.locator('#tangram-ghost').count(),1);await page.mouse.up();assert.equal((await model()).placed[0],0);await page.locator('#undo').click();assert.deepEqual((await model()).placed,Array(7).fill(-1));
        if(engine===chromium){const cdp=await context.newCDPSession(page),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});const begin={id:1,x:source.x+source.width/2,y:source.y+source.height/2},end={id:1,...target};
          await touch('touchStart',[begin]);await touch('touchMove',[end]);await touch('touchStart',[end,{id:2,x:80,y:100}]);assert.deepEqual((await model()).placed,Array(7).fill(-1));await touch('touchCancel',[]);assert.deepEqual((await model()).placed,Array(7).fill(-1));assert.equal(await page.locator('#tangram-ghost').count(),0);
        }
      }
      for(let l=0;l<3;l++){
        let m=await model();assert.equal(await page.evaluate(()=>LearningApp.level),l);
        if(id==='pipes'){for(let i=0;i<m.solution.length;i++){if(!m.solution[i])continue;for(let k=0;(await model()).cells[i]!==m.solution[i]&&k<4;k++)await act('rotate',i);}}
        if(id==='tangram'){for(let i=0;i<7;i++){await act('select',i);const target=C.tangrams[l].slots[i][2];for(let k=0;(await model()).rotation[i]!==target&&k<8;k++)await act('rotate');await act('place',i);assert.equal((await model()).placed[i],i);}}
        if(id==='market'){for(const item of m.list)for(let n=0;n<item.quantity;n++)await act('add',item.id);await act('checkout');if(l===1){await act('pay');assert(!(await model()).done);const total=C.foods.reduce((s,f)=>s+((m.list.find(x=>x.id===f.id)?.quantity||0)*f.price),0);let rest=total;for(const coin of [5,2,1])while(rest>=coin){await act('coin',coin);rest-=coin;}await act('pay');}if(l===2){const total=m.list.reduce((s,x)=>s+C.foods.find(f=>f.id===x.id).price*x.quantity,0);await act('change',30-total);}}
        if(id==='robot'){const code=robotCode(m.map);for(const cmd of code)await act('command',cmd);await act('run');await idle();assert((await model()).result.ok);}
        if(id==='bento'){await act('check');assert(!(await model()).done);for(const [kind,n] of Object.entries(m.target)){const food={fruit:'apple',veg:'carrot',grain:'rice',protein:'egg'}[kind];for(let i=0;i<n;i++)await act('add',food);}await act('check');}
        if(id==='shadow'){for(let round=0;round<6;round++){const q=C.detective(l,await page.evaluate(()=>LearningApp.seed),round);await act('answer',q.target.id);if(round<5)await act('next');}}
        if(id==='patterns'){for(let round=0;round<6;round++){const q=C.pattern(l,await page.evaluate(()=>LearningApp.seed),round);await act('answer',q.answer);if(round<5)await act('next');}}
        if(id==='memory'){const a=0,b=m.cards.findIndex(x=>x.pair!==m.cards[0].pair);await act('flip',a);await act('flip',b);await page.waitForFunction(()=>LearningApp.model.open.length===0);for(const pair of [...new Set(m.cards.map(x=>x.pair))])for(let i=0;i<m.cards.length;i++)if(m.cards[i].pair===pair)await act('flip',i);}
        if(id==='bridge'){await act('test');await idle();assert(!(await model()).result.ok);for(let i=0;i<m.map.n;i++)await act('deck',i);for(const i of m.map.foundations)await act('support',i);await act('test');await idle();assert((await model()).result.ok);}
        if(id==='rhythm'){
          if(l===0){await act('mode','free');for(let empty=0;empty<2;empty++){await act('record');await act('record');assert(!await page.evaluate(()=>LearningApp.transient.recording));}await act('record');await act('pad',0);await page.waitForTimeout(90);await act('pad',1);await act('pad',2);await act('record');assert.equal((await model()).recording.length,3);assert((await model()).recording[1].time>(await model()).recording[0].time);await page.reload();assert.equal((await model()).recording.length,3);await act('play');await idle();await act('mode','learn');}
          if(l===0){
            await act('listen');await act('stop');assert(!await page.evaluate(()=>LearningApp.busy));const stopped=await page.evaluate(()=>window.__toneStarts);await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.__toneStarts),stopped);
            if(await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext))){await page.waitForFunction(()=>document.getElementById('sound').dataset.audioState==='on');await page.locator('#sound').tap();const silent=await page.evaluate(()=>window.__toneStarts);await act('pad',m.sequence[0]);assert.equal(await page.evaluate(()=>window.__toneStarts),silent);await page.locator('#sound').tap();}
          }
          await act('listen');await idle();for(const pad of m.sequence)await act('pad',pad);
        }
        assert(await page.locator('#success').isVisible(),`${id} level ${l} completes`);
        if(l===2&&['robot','bridge'].includes(id)){await act(id==='robot'?'run':'test');await idle();assert(await page.locator('#success').isVisible(),'replaying the same successful animation finishes cleanly');}
        if(l===0){await page.locator('#undo').tap();assert(await page.locator('#success').isHidden());await page.reload();assert(await page.locator('#success').isHidden());
          // Redo the final action through the actual interface.
          if(id==='pipes'){const now=await model(),i=now.cells.findIndex((v,i)=>now.solution[i]&&v!==now.solution[i]);await act('rotate',i);}
          if(id==='tangram')await act('place',6);
          if(id==='market')await act('checkout');if(id==='robot'){await act('run');await idle();}if(id==='bento')await act('check');
          if(id==='shadow')await act('answer',C.detective(l,await page.evaluate(()=>LearningApp.seed),5).target.id);
          if(id==='patterns')await act('answer',C.pattern(l,await page.evaluate(()=>LearningApp.seed),5).answer);
          if(id==='memory'){const now=await model(),last=now.cards.findIndex((_,i)=>!now.matched.includes(i)&&!now.open.includes(i));await act('flip',last);}
          if(id==='bridge'){await act('test');await idle();}if(id==='rhythm')await act('pad',m.sequence.at(-1));
          assert(await page.locator('#success').isVisible());
        }
        if(l<2)await page.locator('#next').tap();
      }
      await page.screenshot({path:path.join(os.tmpdir(),`learning-${id}.png`),fullPage:true});
      for(const size of [{width:820,height:1180},{width:390,height:844}]){await page.setViewportSize(size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id} has no horizontal overflow`);}
      await page.locator('#restart').tap();assert(await page.locator('#success').isHidden());
      const clean=await model();
      if(id==='pipes')await act('rotate',0);else if(id==='tangram')await act('rotate');else if(id==='market')await act('add',clean.list[0].id);else if(id==='robot')await act('command','left');else if(id==='bento')await act('add','apple');else if(id==='shadow'){const q=C.detective(2,await page.evaluate(()=>LearningApp.seed),0);await act('answer',q.target.id);}else if(id==='patterns'){const q=C.pattern(2,await page.evaluate(()=>LearningApp.seed),0);await act('answer',q.answer);}else if(id==='memory')await act('flip',0);else if(id==='bridge')await act('deck',0);else await act('pad',clean.sequence[0]);
      const unfinished=await model();await page.locator('#restart').tap();assert(await page.locator('#dialog').evaluate(e=>e.open));await page.locator('#cancel').tap();assert.deepEqual(await model(),unfinished);await page.locator('#restart').tap();await page.locator('#confirm').tap();assert(await page.locator('#success').isHidden());
      await page.evaluate(id=>localStorage.setItem('childgame.learning.'+id+'.v1','{"level":99,"seed":"bad","actions":[null]}'),id);await page.reload();assert.equal(await page.evaluate(()=>LearningApp.level),0);
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  });}finally{await browser.close();await new Promise(r=>server.close(r));}
});
