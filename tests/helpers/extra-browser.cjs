'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
async function setup(){
 const root=path.resolve(__dirname,'../..'),types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.wav':'audio/wav','.json':'application/json','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{let f=new URL(req.url,'http://local').pathname.replace(/^\/minigames\//,'/');if(f.endsWith('/'))f+='index.html';fs.readFile(path.join(root,f),(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium,browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const page=await browser.newPage({viewport:{width:1024,height:650},hasTouch:true,serviceWorkers:'block'}),base=`http://127.0.0.1:${server.address().port}/minigames/`,errors=[],missing=[];
 await page.addInitScript(()=>{window.audioDecoded=0;const Native=window.AudioContext||window.webkitAudioContext;if(Native)window.AudioContext=class extends Native{decodeAudioData(...args){return super.decodeAudioData(...args).then(buffer=>{audioDecoded++;return buffer;});}};});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 const snap=()=>page.evaluate(()=>ExtraGame.snapshot());
 async function install(s){const G=require('../../assets/js/extras/'+s.id+'.js');assert(G.validate(s),s.id+' valid fixture');await page.goto(base+'index.html');await page.evaluate(s=>localStorage.setItem(`childgame.extra.${s.id}.v1`,JSON.stringify({state:s})),s);await page.goto(base+`games/${s.id}/index.html`);await page.waitForFunction(()=>window.ExtraGame);}
 async function point(p){const r=await page.locator('#board').boundingBox();return{x:r.x+p.x/720*r.width,y:r.y+p.y/800*r.height};}
 async function tap(p){const a=await point(p);await page.touchscreen.tap(a.x,a.y);}
 async function drag(a,b){a=await point(a);b=await point(b);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}
 async function hold(action,ms){const r=await page.locator(`[data-action="${action}"]`).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();}
 async function capture(name){const dir=path.join(os.tmpdir(),'childgame-extra');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});}
 async function result(phase='won',timeout=25000){await page.waitForFunction(phase=>ExtraGame.snapshot().phase===phase,phase,{timeout});await page.locator('#overlay').waitFor({state:'visible',timeout:5000});await page.waitForFunction(()=>!ExtraGame.effects().raf,null,{timeout:5000});const fx=await page.evaluate(()=>ExtraGame.effects());for(const key of ['particles','rings','labels'])assert.equal(fx[key],0,phase+' final '+key);}
 async function close(){await browser.close();await new Promise(r=>server.close(r));assert.deepEqual(errors,[],'no browser runtime errors');assert.deepEqual(missing,[],'no missing resources');}
 return{page,base,browser,engine,snap,install,point,tap,drag,hold,result,capture,close};
}
module.exports={setup};
