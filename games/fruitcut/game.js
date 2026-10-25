'use strict';
(() => {
  const E=FruitCutEngine,$=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
  let state=E.create(),sound=true,bests={relax:0,challenge:0},particles=[],halves=[],labels=[],pointers=new Map(),last=0,toastTime=0,pending=null;
  let view={scale:1,x:0,y:0,width:900,height:650};
  let frameId=0,background=null,shownTime=-1,toastVisible=false;
  const fruitImages=new Map(),timeEl=$('time'),toastEl=$('toast');
  function syncAnimation(){
    const active=state.status==='playing'&&!document.hidden;
    if(active&&!frameId)frameId=requestAnimationFrame(frame);
    else if(!active&&frameId){cancelAnimationFrame(frameId);frameId=0;}
  }
  function updateTime(){const next=Math.ceil(state.time);if(next!==shownTime){shownTime=next;timeEl.textContent=next;}}
  function updateToast(){const visible=toastTime>0;if(visible!==toastVisible){toastVisible=visible;toastEl.classList.toggle('visible',visible);}}
  try{sound=localStorage.getItem('childgame.sound')!=='off';const saved=JSON.parse(localStorage.getItem('childgame.fruitcut.best.v1'));for(const mode of ['relax','challenge'])if(Number.isSafeInteger(saved?.[mode])&&saved[mode]>=0)bests[mode]=saved[mode];}catch{}
  const audio=createGameAudio({game:'fruitcut',music:false,isEnabled:()=>sound,isPlaying:()=>state.status==='playing',isPaused:()=>state.status==='paused'});
  function save(){bests[state.mode]=Math.max(bests[state.mode],state.score);try{let saved;try{saved=JSON.parse(localStorage.getItem('childgame.fruitcut.best.v1'));}catch{}for(const mode of ['relax','challenge'])if(Number.isSafeInteger(saved?.[mode])&&saved[mode]>=0)bests[mode]=Math.max(bests[mode],saved[mode]);localStorage.setItem('childgame.fruitcut.best.v1',JSON.stringify(bests));$('save-status').textContent='最高分已保存 · 两种模式分别记录';}catch{$('save-status').textContent='暂时无法保存纪录，这局仍可正常玩';}}
  function clearPointers(){for(const [id]of pointers){if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}pointers.clear();}
  function sync(){
    $('score').textContent=state.score;updateTime();$('best').textContent=bests[state.mode];
    $('stat-label').firstChild.textContent=state.mode==='challenge'?'炸弹碰撞':'切中水果';$('stat').textContent=state.mode==='challenge'?`${state.bombs} / 3`:state.cut;
    $('pause').disabled=!['playing','paused'].includes(state.status);$('pause').textContent=state.status==='paused'?'继续':'暂停';$('restart').textContent=state.status==='ready'?'开始游戏':'重新开始';
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    $('overlay').hidden=state.status==='playing';
    if(state.status==='ready'){$('overlay-title').textContent='手指就是小小刀光';$('overlay-text').textContent=state.mode==='relax'?'按住并划过水果。每个水果 10 分，一划连切的后续水果各多得 5 分。60 秒开心切，没有炸弹，漏掉不扣分。':'60 秒挑战：水果 10 分，连续切中有奖励。黑色炸弹不能切！碰到一次扣 20 分，碰到三次结束。漏掉水果不扣分。';$('play').textContent='开始切水果';}
    if(state.status==='paused'){$('overlay-title').textContent='果园休息一下';$('overlay-text').textContent='时间已经暂停。准备好了，再来切水果吧！';$('play').textContent='继续游戏';}
    if(state.status==='over'){$('overlay-title').textContent=state.bombs>=3?'下次小心黑色炸弹':'果汁大丰收！';$('overlay-text').textContent=`本局 ${state.score} 分，切开 ${state.cut} 个水果，最高一划连切 ${state.bestCombo} 个。${state.mode==='challenge'?'也可以试试无炸弹的开心切。':'休息一下，下次再来玩。'}`;$('play').textContent='再切一局';}
    syncAnimation();
    audio.sync();
  }
  function start(mode=state.mode){clearPointers();state=E.create(mode);state.status='playing';particles=[];halves=[];labels=[];toastTime=0;updateToast();last=performance.now();sync();canvas.focus({preventScroll:true});audio.effect('start',{volume:.2});}
  function pause(){if(state.status!=='playing')return;state.status='paused';clearPointers();sync();draw();audio.sync();}
  function resume(){if(state.status!=='paused')return;clearPointers();state.status='playing';last=performance.now();sync();canvas.focus({preventScroll:true});}
  function finish(){clearPointers();save();sync();draw();audio.effect('finish',{volume:.25});$('play').focus({preventScroll:true});}
  function requestStart(mode){if(['playing','paused'].includes(state.status)){pending={mode,resume:state.status==='playing'};pause();$('confirm-dialog').showModal();$('cancel').focus();}else start(mode);}
  $('play').onclick=()=>state.status==='paused'?resume():start();$('pause').onclick=()=>state.status==='paused'?resume():pause();$('restart').onclick=()=>requestStart(state.mode);
  $('confirm').onclick=()=>{save();const mode=pending.mode;pending=null;$('confirm-dialog').close();start(mode);};
  $('cancel').onclick=()=>{const shouldResume=pending?.resume;pending=null;$('confirm-dialog').close();if(shouldResume)resume();};$('confirm-dialog').addEventListener('cancel',()=>{const shouldResume=pending?.resume;pending=null;if(shouldResume)resume();});
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode===state.mode)return;if(state.status==='ready'){state=E.create(b.dataset.mode);sync();}else requestStart(b.dataset.mode);});
  $('sound').onclick=()=>{sound=audio.toggle();if(sound)audio.unlock(true);try{localStorage.setItem('childgame.sound',sound?'on':'off');}catch{}audio.sync();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else{last=performance.now();syncAnimation();}});window.addEventListener('pagehide',()=>{pause();save();});window.addEventListener('blur',pause);
  canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();state.status==='playing'?pause():state.status==='paused'?resume():start();}});
  function point(event,r=canvas.getBoundingClientRect()){return {x:(event.clientX-r.left-view.x)/view.scale,y:(event.clientY-r.top-view.y)/view.scale};}
  const inside=p=>p.x>=0&&p.x<=E.W&&p.y>=0&&p.y<=E.H;
  canvas.addEventListener('pointerdown',event=>{if(state.status!=='playing'||event.button!==0&&event.pointerType==='mouse'||pointers.size>=5)return;const p=point(event);if(!inside(p))return;event.preventDefault();pointers.set(event.pointerId,{point:p,combo:0,lastAt:-Infinity,trail:[{...p,life:.16}]});canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
    const stroke=pointers.get(event.pointerId);if(!stroke||state.status!=='playing')return;event.preventDefault();
    const samples=event.getCoalescedEvents?.(),rect=canvas.getBoundingClientRect();
    for(const sample of samples?.length?samples:[event]){
      const p=point(sample,rect);if(!inside(p)){stroke.point=null;stroke.combo=0;continue;}
      if(stroke.point){const hits=E.slash(state,stroke.point,p,stroke);for(const f of hits)burst(f,p,stroke.point);if(hits.length){save();sync();if(state.status==='over'){finish();return;}}}
      if(!stroke.point||Math.hypot(p.x-stroke.point.x,p.y-stroke.point.y)>=6)stroke.point=p;
      stroke.trail.push({...p,life:.16});if(stroke.trail.length>40)stroke.trail.shift();
    }
  });
  function release(event){pointers.delete(event.pointerId);}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
  function burst(f,to,from){
    const bomb=f.kind==='bomb',color=bomb?'#f5c669':f.kind==='melon'?'#f45d6c':f.kind==='orange'?'#ffc567':f.kind==='kiwi'?'#b9e96b':'#ffa8a1';
    for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,v=90+Math.random()*230;particles.push({x:f.x,y:f.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,r:3+Math.random()*6,life:.6+Math.random()*.3,color});}
    if(!bomb){const angle=Math.atan2(to.y-from.y,to.x-from.x);for(const sign of [-1,1])halves.push({...f,x:f.x+Math.cos(angle+Math.PI/2)*sign*8,y:f.y+Math.sin(angle+Math.PI/2)*sign*8,vx:f.vx+Math.cos(angle+Math.PI/2)*sign*100,vy:f.vy*.25-70,angle:angle,spin:sign*1.7,side:sign,life:1.1});}
    labels.push({x:f.x,y:f.y,text:bomb?'−20':f.combo>1?`连切 ${f.combo}！ +15`:'+10',color,life:.8});
    if(bomb){$('toast').textContent='小心炸弹！−20 分';toastTime=1.1;audio.effect('crash',{volume:.24});}
    else{audio.effect('collect',{rate:.9+Math.min(f.combo,5)*.08,volume:.22});if(f.combo>1){$('toast').textContent=`一划连切 ${f.combo} 个！`;toastTime=.8;}}
    if(particles.length>240)particles.splice(0,particles.length-240);if(halves.length>40)halves.splice(0,halves.length-40);if(labels.length>16)labels.splice(0,labels.length-16);
    updateToast();
  }
  function resize(){
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(rect.width<1||rect.height<1||(view.width===rect.width&&view.height===rect.height&&view.dpr===dpr))return;
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    view={width:rect.width,height:rect.height,scale:Math.min(rect.width/E.W,rect.height/E.H),x:0,y:0,dpr};view.x=(rect.width-E.W*view.scale)/2;view.y=(rect.height-E.H*view.scale)/2;
    background=null;clearPointers();draw();
  }
  new ResizeObserver(resize).observe(canvas);
  function fruit(f,half=false){
    // Three nearby radii cover launched fruit while keeping the texture cache bounded.
    const radius=f.kind==='bomb'?33:f.r>55?Math.round(f.r):Math.round(f.r/5)*5;
    const key=`${f.kind}:${half?f.side:0}:${radius}`;
    let sprite=fruitImages.get(key);
    if(!sprite){
      const extent=radius+28,image=document.createElement('canvas');image.width=image.height=extent*4;
      const buffer=image.getContext('2d');buffer.scale(2,2);
      paintFruit(buffer,{...f,x:extent,y:extent,angle:0,r:radius},half);
      sprite={image,extent};fruitImages.set(key,sprite);
    }
    const extent=sprite.extent*f.r/radius;
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.drawImage(sprite.image,-extent,-extent,extent*2,extent*2);ctx.restore();
  }
  function paintFruit(ctx,f,half=false){
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);const r=f.r;
    if(half){ctx.beginPath();ctx.rect(-r-4,f.side<0?-r-4:0,2*r+8,r+4);ctx.clip();}
    ctx.shadowColor='#041f2780';ctx.shadowBlur=10;ctx.shadowOffsetY=8;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=f.kind==='melon'?'#5ba946':f.kind==='orange'?'#efa83d':f.kind==='kiwi'?'#a4b852':f.kind==='bomb'?'#29333b':'#f09489';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    if(f.kind==='melon'){
      if(half){ctx.beginPath();ctx.arc(0,0,r-5,0,Math.PI*2);ctx.fillStyle='#e3ebad';ctx.fill();ctx.beginPath();ctx.arc(0,0,r-10,0,Math.PI*2);ctx.fillStyle='#ef6570';ctx.fill();for(let i=0;i<9;i++){const a=i*2.4;ctx.save();ctx.translate(Math.cos(a)*(r-17)*.7,Math.sin(a)*(r-17)*.7);ctx.rotate(a);ctx.fillStyle='#452f37';ctx.beginPath();ctx.ellipse(0,0,2.4,4,0,0,7);ctx.fill();ctx.restore();}}
      else{ctx.save();ctx.beginPath();ctx.arc(0,0,r-1,0,7);ctx.clip();ctx.strokeStyle='#297f48';ctx.lineWidth=8;for(let x=-r;x<=r;x+=22){ctx.beginPath();ctx.moveTo(x,-r);ctx.bezierCurveTo(x+20,-r/3,x-20,r/3,x,r);ctx.stroke();}ctx.restore();}
    }else if(f.kind==='bomb'){ctx.lineWidth=6;ctx.strokeStyle='#b9a477';ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(12,-r-24,25,-r-10);ctx.stroke();ctx.fillStyle='#f5c567';ctx.beginPath();ctx.arc(25,-r-10,5,0,7);ctx.fill();ctx.strokeStyle='#f4cf93';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-10,-10);ctx.lineTo(10,10);ctx.moveTo(10,-10);ctx.lineTo(-10,10);ctx.stroke();}
    else if(half){ctx.strokeStyle='#fff4c7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r-7,0,7);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*(r-10),Math.sin(a)*(r-10));ctx.stroke();}ctx.fillStyle=f.kind==='kiwi'?'#f3edbf':'#fff0c3';ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();}
    else{ctx.fillStyle='#458c53';ctx.beginPath();ctx.ellipse(7,-r+3,14,6,-.5,0,7);ctx.fill();}
    if(!half){ctx.fillStyle='#ffffff2b';ctx.beginPath();ctx.ellipse(-r*.3,-r*.4,r*.28,r*.12,-.6,0,7);ctx.fill();}ctx.restore();
  }
  function draw(){
    if(!background){
      background=document.createElement('canvas');background.width=canvas.width;background.height=canvas.height;
      const buffer=background.getContext('2d');buffer.scale(view.dpr,view.dpr);
      const bg=buffer.createRadialGradient(view.width*.5,view.height*.35,10,view.width*.5,view.height*.4,view.width*.7);bg.addColorStop(0,'#286354');bg.addColorStop(1,'#102f33');buffer.fillStyle=bg;buffer.fillRect(0,0,view.width,view.height);
      buffer.strokeStyle='#b1d3940a';buffer.lineWidth=1;for(let y=0;y<view.height;y+=55){buffer.beginPath();buffer.moveTo(0,y);buffer.lineTo(view.width,y);buffer.stroke();}
    }
    ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.drawImage(background,0,0,view.width,view.height);
    ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);
    ctx.strokeStyle='#aec99113';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(450,610,320,50,0,0,7);ctx.stroke();
    if(state.status==='ready'){fruit({x:310,y:365,r:90,kind:'melon',angle:-.3});fruit({x:620,y:300,r:62,kind:'orange',angle:.2});fruit({x:540,y:470,r:52,kind:'kiwi',angle:-.5});}
    for(const f of halves){ctx.globalAlpha=Math.min(1,f.life*2);fruit(f,true);}ctx.globalAlpha=1;
    for(const f of state.fruits)fruit(f);
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();}ctx.globalAlpha=1;
    for(const stroke of pointers.values()){const trail=stroke.trail;if(trail.length<2)continue;ctx.lineCap='round';ctx.lineJoin='round';for(let i=1;i<trail.length;i++){ctx.globalAlpha=trail[i].life/.16;ctx.strokeStyle='#d9ffbd';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(trail[i].x,trail[i].y);ctx.stroke();ctx.strokeStyle='#fffdf1';ctx.lineWidth=3;ctx.stroke();}}ctx.globalAlpha=1;
    ctx.textAlign='center';ctx.font='bold 25px sans-serif';for(const l of labels){ctx.globalAlpha=Math.min(1,l.life*2);ctx.fillStyle=l.color;ctx.fillText(l.text,l.x,l.y);}ctx.globalAlpha=1;ctx.restore();
  }
  function trimExpired(items){let alive=0;for(const item of items)if(item.life>0)items[alive++]=item;items.length=alive;}
  function frame(now){
    frameId=0;const dt=Math.min((now-(last||now))/1000,.05);last=now;
    if(state.status==='playing'){
      E.step(state,dt);
      for(const f of halves){f.life-=dt;f.vy+=580*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.angle+=f.spin*dt;}trimExpired(halves);
      for(const p of particles){p.life-=dt;p.vy+=500*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}trimExpired(particles);
      for(const l of labels){l.life-=dt;l.y-=dt*45;}trimExpired(labels);
      for(const p of pointers.values()){for(const t of p.trail)t.life-=dt;trimExpired(p.trail);}
      toastTime-=dt;updateToast();updateTime();if(state.status==='over')finish();
    }
    draw();syncAnimation();
  }
  // Read-only diagnostics also help verify touch geometry without changing gameplay.
  window.FruitCut={snapshot:()=>JSON.parse(JSON.stringify({...state,view,pointers:pointers.size}))};
  resize();sync();
})();
