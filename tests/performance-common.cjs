'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {setup}=require('./helpers/extra-browser.cjs');

test('audio synchronizes gestures, failures, pause and terminal events without polling',async()=>{
  const events=new Map(),sources=[],requests=[],button={dataset:{},setAttribute(){}},flags={playing:true,enabled:true,paused:false};
  const listen=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
  const emit=name=>events.get(name)?.forEach(fn=>fn({isTrusted:true,target:{closest:()=>false}}));
  const gain=()=>({gain:{value:1,cancelScheduledValues(){},setTargetAtTime(){}},connect(){},disconnect(){}});
  let context,fail=true;
  class AudioContext{
    constructor(){context=this;this.state='suspended';this.currentTime=10;this.sampleRate=44100;}
    createGain(){return gain();}
    createBuffer(){return {duration:0};}
    createBufferSource(){const source={playbackRate:{value:1},connect(){},disconnect(){},start(){this.active=true;},stop(){this.active=false;}};sources.push(source);return source;}
    addEventListener(name,fn){this.change=fn;}
    async resume(){this.state='running';this.change();}
    async decodeAudioData(){return {duration:60};}
  }
  const document={hidden:false,currentScript:{src:'http://game/assets/js/audio.js'},querySelector:()=>button,addEventListener:listen};
  const window={AudioContext,addEventListener:listen,setInterval(){throw Error('audio must not poll');}};
  const sandbox={window,document,URL,queueMicrotask,fetch:async url=>{requests.push(String(url));return {ok:!fail,arrayBuffer:async()=>new ArrayBuffer(1)};}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/audio.js'),'utf8'),sandbox);
  const mixer=window.createGameAudio({game:'snake',isPlaying:()=>flags.playing,isEnabled:()=>flags.enabled,isPaused:()=>flags.paused});
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const music=()=>sources.filter(s=>s.loop&&s.active).length;
  await flush();assert.equal(context.state,'suspended');assert.equal(button.dataset.audioState,'locked');
  emit('pointerdown');await flush();assert.equal(button.dataset.audioState,'error');assert.equal(music(),0);
  fail=false;mixer.unlock(true);await flush();assert.equal(button.dataset.audioState,'on');assert.equal(music(),1);
  const loaded=requests.length;for(let i=0;i<100;i++)emit('pointerup');await flush();assert.equal(requests.length,loaded);assert.equal(music(),1);
  flags.paused=true;emit('blur');await flush();assert.equal(music(),0);
  flags.paused=false;emit('click');await flush();assert.equal(music(),1);
  document.hidden=true;emit('visibilitychange');await flush();assert.equal(music(),0);
  document.hidden=false;emit('visibilitychange');await flush();assert.equal(music(),1);
  flags.playing=false;mixer.effect('not-downloaded');assert.equal(music(),0,'terminal state stops music even without a decoded effect');
  flags.playing=true;flags.enabled=false;mixer.sync();assert.equal(button.dataset.audioState,'off');assert.equal(music(),0);
  flags.enabled=true;mixer.unlock();await flush();assert.equal(music(),1);
  emit('pagehide');assert.equal(music(),0);emit('pageshow');assert.equal(music(),1);
});

test('Sudoku keeps focused cells and number buttons while editing and changing notes',{timeout:45000},async()=>{
  const h=await setup();
  try{
    await h.page.goto(h.base+'games/sudoku/index.html');
    const s=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.sudoku.v1'))),i=s.givens.indexOf(0);
    await h.page.evaluate(()=>{window.savedCells=[...document.querySelector('#board').children];window.savedNumbers=[...document.querySelector('#numbers').children];});
    await h.page.locator(`[data-cell="${i}"]`).tap();await h.page.locator('#notes').tap();await h.page.locator(`[data-number="${s.solution[i]}"]`).tap();
    await h.page.locator('#notes').tap();await h.page.locator(`[data-number="${s.solution[i]}"]`).tap();await h.page.locator('#undo').tap();
    assert(await h.page.evaluate(()=>savedCells.every((el,i)=>el===document.querySelector('#board').children[i])&&savedNumbers.every((el,i)=>el===document.querySelector('#numbers').children[i])));
    await h.page.locator('[data-mode="easy"]').tap();await h.page.locator('#confirm').tap();
    assert.equal(await h.page.locator('[data-cell]').count(),36);assert.equal(await h.page.locator('[data-number]').count(),6);
    await h.page.locator('#symbols').tap();assert.equal(await h.page.locator('#numbers small').count(),0);
  }finally{await h.close();}
});

test('quiet book retains 60 stickers and reuses the drag artwork across pointer moves',{timeout:45000},async()=>{
  const h=await setup();
  try{
    await h.page.goto(h.base+'games/quietbook/index.html');
    await h.page.evaluate(()=>localStorage.setItem('childgame.quietbook.v1',JSON.stringify({version:1,theme:'garden',actor:0,scene:'home',looks:{},rooms:{home:Array.from({length:60},(_,i)=>({id:'bunny',x:75+i%10*90,y:65+Math.floor(i/10)*100,bites:3}))},pose:'stand',light:true})));
    await h.page.reload();assert.equal(await h.page.locator('#stickers [data-uid]').count(),60);
    await h.page.evaluate(()=>{window.savedStickers=[...document.querySelector('#stickers').children];window.savedBackdrop=document.querySelector('#backdrop').firstChild;});
    const pos=(x,y)=>h.page.evaluate(({x,y})=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector('#scene').getScreenCTM());return {x:p.x,y:p.y};},{x,y});
    const a=await pos(885,565),b=await pos(800,510),c=await pos(730,470);
    await h.page.mouse.move(a.x,a.y);await h.page.mouse.down();await h.page.mouse.move(b.x,b.y,{steps:5});
    await h.page.waitForFunction(()=>!!document.querySelector('.drag-ghost'));
    await h.page.evaluate(()=>{window.savedGhost=document.querySelector('.drag-ghost');window.ghostPosition=savedGhost.getAttribute('transform');});
    await h.page.mouse.move(c.x,c.y,{steps:30});await h.page.waitForTimeout(50);
    assert(await h.page.evaluate(()=>savedGhost===document.querySelector('.drag-ghost')&&ghostPosition!==savedGhost.getAttribute('transform')));
    await h.page.mouse.up();
    assert(await h.page.evaluate(()=>savedStickers.every((el,i)=>el===document.querySelector('#stickers').children[i])&&savedBackdrop===document.querySelector('#backdrop').firstChild));
    assert.equal(await h.page.locator('.drag-ghost').count(),0);
    let s=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.quietbook.v1')));assert(Math.abs(s.rooms.home[59].x-730)<2);
    await h.page.locator('#undo').tap();s=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('childgame.quietbook.v1')));assert.equal(s.rooms.home[59].x,885);
  }finally{await h.close();}
});
