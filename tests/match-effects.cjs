'use strict';

const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const C=require('../assets/js/match-core.js');

function candyFixture(a,b){
  const s=C.fresh('candyland',0,37);
  s.board.forEach((tile,i)=>{tile.color=(Math.floor(i/7)*2+i%7)%4;tile.special='';});
  s.board[23].special=a;s.board[24].special=b;
  return {label:`candy ${a}+${b}`,core:C,state:s,move:[23,24],beams:a!=='bomb'||b!=='bomb'};
}

test('Candy special combinations animate, retain cells, finish correctly and clean up',{timeout:90000},async()=>{
  const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json'};
  const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/`,errors=[],missing=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))missing.push(`${response.status()} ${response.url()}`);});
    const cases=[['row','col'],['bomb','row'],['bomb','bomb'],['rainbow','rainbow']].map(([a,b])=>candyFixture(a,b));
    for(const fixture of cases){
      const {core,state,move,label,beams}=fixture,id=state.id,expected=core.clone(state);
      assert.deepEqual(core.restore(id,state),state,`${label}: legal stored state`);
      const result=core.play(expected,...move);assert(result.ok);assert(result.frames.some(frame=>frame.triggered.length),`${label}: triggers a charged power`);
      await page.goto(base+'index.html');await page.evaluate(([key,s])=>localStorage.setItem(key,JSON.stringify(s)),[`childgame.match.${id}.v1`,state]);await page.goto(base+`games/${id}/index.html`);
      assert.deepEqual(await page.evaluate(()=>MatchGame.snapshot()),state);
      await page.evaluate(()=>{window.originalMatchCells=[...document.querySelectorAll('#cells [data-cell]')];});
      for(const index of move)await page.locator(`#cells [data-cell="${index}"]`).tap();
      assert(await page.evaluate(()=>MatchGame.busy()),`${label}: visible animation begins`);
      assert.deepEqual(await page.evaluate(()=>MatchGame.snapshot()),expected,`${label}: animation does not postpone the real move`);
      await page.waitForFunction(()=>{const fx=MatchGame.effects();return fx.rings>0&&fx.particles>0;},null,{timeout:5000});
      const fx=await page.evaluate(()=>MatchGame.effects());assert(fx.particles<=210&&fx.rings<=20&&fx.beams<=30,`${label}: bounded effects`);
      if(beams)assert(fx.beams>0,`${label}: beam effect accompanies the charged blast`);
      await page.waitForFunction(()=>!MatchGame.busy()&&['particles','rings','beams'].every(key=>MatchGame.effects()[key]===0),null,{timeout:15000});
      assert.deepEqual(await page.evaluate(()=>MatchGame.snapshot()),expected,`${label}: effect cleanup cannot change gameplay`);
      assert(await page.evaluate(()=>{const now=[...document.querySelectorAll('#cells [data-cell]')];return now.length===49&&now.every((el,i)=>el===originalMatchCells[i]);}),`${label}: all 49 input elements are reused`);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
