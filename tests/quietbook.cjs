const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
test('quiet book complete wardrobe, dining, home, touch, saving and layout checks',{timeout:180000},async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{let file=new URL(req.url,'http://localhost').pathname;const target=path.join(root,file);fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/games/quietbook/index.html`);
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.quietbook.v1')));
    const pos=(x,y)=>page.evaluate(({x,y})=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector('#scene').getScreenCTM());return {x:p.x,y:p.y};},{x,y});
    const tap=async(x,y)=>{const p=await pos(x,y);await page.touchscreen.tap(p.x,p.y);};
    // A dress replaces the two-piece outfit, including its saved bottom slot.
    await page.locator('[data-category="bottom"]').tap();
    await page.locator('[data-item="bottom-0"]').tap();await tap(550,360);
    await page.locator('[data-category="top"]').tap();
    await page.locator('[data-item="ice-dress"]').tap();await tap(550,360);
    assert.equal((await saved()).looks['garden:0'].slots.top,'ice-dress');
    assert.equal((await saved()).looks['garden:0'].slots.bottom,undefined,'dress must remove the previous bottom');
    assert.equal(await page.locator('#actor path[fill="#fff0dd"], #actor path[fill="#d8c6b2"]').count(),0,'default clothes must not remain underneath equipped dress');
    const catalog=await page.evaluate(()=>BookArt.items);
    const clothes=catalog.filter(x=>['top','bottom','shoes','hat','accessory'].includes(x.type));
    const choose=async item=>{
      if(await page.locator(`[data-category="${item.type}"]`).getAttribute('aria-pressed')!=='true')await page.locator(`[data-category="${item.type}"]`).tap();
      for(let i=0;!await page.locator(`[data-item="${item.id}"]`).count()&&i<5;i++)await page.locator('[data-more]').tap();
      await page.locator(`[data-item="${item.id}"]`).tap();
    };
    for(const theme of ['garden','fairy','snow']){
      await page.locator(`button[data-theme="${theme}"]`).tap();
      for(const actor of [0,1]){
        await page.locator(`[data-actor="${actor}"]`).tap();
        for(const item of clothes){
          await choose(item);
          const outfit=(await saved()).looks[theme+':'+actor].slots;
          assert.equal(outfit[item.type],item.id,`${theme}:${actor} taps ${item.id} to equip`);
          assert.equal(await page.locator(`#actor [data-slot="${item.type}"]`).count(),1,`${item.id} renders once`);
          if(item.type==='top')assert.equal(await page.locator('#actor [data-base="top"]').count(),0);
          if(item.dress){assert.equal(outfit.bottom,undefined);assert.equal(await page.locator('#actor [data-slot="bottom"], #actor [data-base="bottom"]').count(),0);}
          if(item.type==='bottom'){assert.equal(await page.locator('#actor [data-base="bottom"]').count(),0);assert(!catalog.find(x=>x.id===outfit.top)?.dress);}
        }
        const current=(await saved()).looks[theme+':'+actor];
        await page.locator('#remove').tap();assert.equal((await saved()).looks[theme+':'+actor].slots.accessory,undefined);
        await page.locator('#undo').tap();assert.deepEqual((await saved()).looks[theme+':'+actor],current);
        for(const control of ['hair','face']){
          const values=new Set();for(let i=0;i<3;i++){await page.locator('#'+control).tap();values.add(await page.locator('#actor').innerHTML());}
          assert.equal(values.size,3,`${control} has three visually different states`);
        }
      }
    }
    console.log(`PASS all ${clothes.length} wearables on all six characters; replacement, removal, undo, hair and expressions`);
    // A real palette drag equips only after release; invalid drops preserve the outfit.
    await page.locator('[data-category="top"]').tap();
    let source=await page.locator('[data-item="leaf-dress"]').boundingBox(),target=await pos(550,360);
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up();
    assert.equal((await saved()).looks['snow:1'].slots.top,'leaf-dress');
    const beforeInvalid=await saved();source=await page.locator('[data-item="ice-dress"]').boundingBox();target=await pos(100,100);
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up();assert.deepEqual(await saved(),beforeInvalid);
    // Keyboard activation follows the same equip path.
    await page.locator('[data-item="ice-dress"]').focus();await page.keyboard.press('Enter');assert.equal((await saved()).looks['snow:1'].slots.top,'ice-dress');
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'quietbook-outfit.png')});
    const savedLooks=(await saved()).looks;await page.reload();await page.locator('#face').tap();await page.locator('#undo').tap();assert.deepEqual((await saved()).looks,savedLooks);
    // Clear affects only the active character and can be undone; dialog traps focus.
    await page.locator('#clear').tap();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-clear');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'cancel-clear');
    await page.keyboard.press('Escape');assert(await page.locator('#confirm').isHidden());
    await page.locator('#clear').tap();await page.locator('#confirm-clear').tap();assert.deepEqual((await saved()).looks['snow:1'].slots,{});assert.deepEqual((await saved()).looks['garden:0'],savedLooks['garden:0']);
    await page.locator('#undo').tap();assert.deepEqual((await saved()).looks,savedLooks);
    for(const scene of ['dining','home']){
      await page.locator(`[data-scene="${scene}"]`).tap();
      for(const item of catalog.filter(x=>(scene==='dining'?['food','drink','plate']:['toy','decor','blanket']).includes(x.type))){
        await choose(item);await tap(500,540);
        assert.equal((await saved()).rooms[scene].at(-1).id,item.id);
        assert.equal(await page.locator('#stickers [data-uid]').count(),1);
        await page.locator('#remove').tap();assert.equal((await saved()).rooms[scene].length,0);
      }
    }
    for(const pose of ['sit','sleep','stand']){await page.locator('#pose').tap();assert.equal((await saved()).pose,pose);}
    await page.locator('#light').tap();assert.equal((await saved()).light,false);assert.equal(await page.locator('#night rect').count(),1);
    await page.locator('#light').tap();assert.equal((await saved()).light,true);assert.equal(await page.locator('#night rect').count(),0);
    await page.locator('[data-scene="dining"]').tap();
    for(const item of catalog.filter(x=>['food','drink'].includes(x.type))){
      await choose(item);await tap(500,540);
      for(let bite=2;bite>=0;bite--){
        const a=await pos(500,540),b=await pos(266,281.5);
        await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:3});await page.mouse.up();
        const entries=(await saved()).rooms.dining;
        if(bite)assert.equal(entries[0].bites,bite,`${item.id}: ${bite} bites remaining`);else assert.equal(entries.length,0,`${item.id} is eaten completely`);
      }
    }
    console.log('PASS every food/drink/plate/toy/decoration/blanket, three-bite feeding, posture, lights, clear and keyboard controls');
    const supportsAudio=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
    if(supportsAudio){await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');await page.locator('#sound').tap();assert.equal(await page.locator('#sound').getAttribute('data-audio-state'),'off');await page.reload();assert.equal(await page.locator('#sound').getAttribute('data-audio-state'),'off');await page.locator('#sound').tap();await page.waitForFunction(()=>document.querySelector('#sound').dataset.audioState==='on');}
    await page.locator('[data-preset="day"]').tap();assert.equal((await saved()).scene,'wardrobe');
    await page.locator('[data-preset="picnic"]').tap();
    await page.locator('[data-item="apple"]').tap();await tap(530,420);
    let state=await saved(),apple=state.rooms.dining.at(-1);assert.equal(apple.x,530);assert.equal(apple.y,408);
    // Move a placed food to the mouth; one bite is consumed, original position stays.
    let from=await pos(apple.x,apple.y),to=await pos(266,281.5);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
    assert.equal((await saved()).rooms.dining.at(-1).bites,2);
    await page.locator('[data-preset="night"]').tap();
    await page.locator('[data-item="bunny"]').tap();await tap(390,530);
    const before=await saved();
    // Real two-finger events in Chromium: secondary touch cannot move/release first drag.
    if(engine===chromium){
      const cdp=await context.newCDPSession(page);from=await pos(390,530);to=await pos(440,510);
      const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      await touch('touchStart',[{id:1,...from}]);await touch('touchMove',[{id:1,...to}]);
      await touch('touchStart',[{id:1,...to},{id:2,x:100,y:100}]);
      await touch('touchMove',[{id:1,...to},{id:2,x:200,y:100}]);
      assert.deepEqual(await saved(),before);
      await touch('touchEnd',[{id:1,...to}]);await touch('touchEnd',[]);
      assert(Math.abs((await saved()).rooms.home.at(-1).x-440)<2);
      await page.locator('#undo').click();
      assert.deepEqual(await saved(),before,'undo restores pre-drag position');
      await touch('touchStart',[{id:1,...from}]);await touch('touchMove',[{id:1,...to}]);await touch('touchCancel',[]);
      assert.deepEqual(await saved(),before);
    }
    from=await pos(390,530);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(5,5);await page.mouse.up();assert.deepEqual(await saved(),before);
    await page.locator('#clear').tap();await page.locator('#cancel-clear').tap();assert.deepEqual(await saved(),before);
    await page.locator('#clear').tap();await page.locator('#confirm-clear').tap();assert.equal((await saved()).rooms.home.length,0);
    await page.locator('#undo').click();assert.deepEqual(await saved(),before);
    await page.reload();assert.deepEqual(await saved(),before);
    await tap(390,530);await page.locator('#remove').tap();assert.equal((await saved()).rooms.home.length,before.rooms.home.length-1);
    for(const viewport of [{width:820,height:1180},{width:1180,height:820},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#scene').isVisible());
      const box=await page.locator('#tray').boundingBox();assert(box.height>60);
      if(viewport.width===1180)await page.screenshot({path:path.join(root,'quietbook-preview.png')});
    }
    // Migrate old saves which kept a hidden bottom under a dress.
    await page.evaluate(()=>{const key='childgame.quietbook.v1',s=JSON.parse(localStorage.getItem(key));s.scene='wardrobe';s.looks[s.theme+':'+s.actor].slots={top:'ice-dress',bottom:'bottom-0'};localStorage.setItem(key,JSON.stringify(s));});
    await page.reload();assert.equal(await page.locator('#actor [data-slot="bottom"]').count(),0);await page.locator('#face').tap();
    state=await saved();assert.equal(state.looks[state.theme+':'+state.actor].slots.bottom,undefined);
    await page.evaluate(()=>localStorage.setItem('childgame.quietbook.v1','{"version":1,"theme":"__proto__","rooms":{"home":[null,{"id":"bogus"}]}}'));
    await page.reload();await page.locator('[data-preset="day"]').tap();assert.equal((await saved()).theme,'garden');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});

