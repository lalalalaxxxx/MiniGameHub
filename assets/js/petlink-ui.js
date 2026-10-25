'use strict';
(()=>{
  const C=PetLinkCore,A=PetLinkArt,$=id=>document.getElementById(id),key='childgame.petlink.v1';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),canvas=$('board'),ctx=canvas.getContext('2d');
  let s=C.fresh(),progress={},sound=true;
  try{s=C.restore(JSON.parse(localStorage.getItem(key)));sound=localStorage.getItem('childgame.sound')!=='off';const p=JSON.parse(localStorage.getItem(key+'.progress'));if(p&&typeof p==='object'&&!Array.isArray(p))progress=p;}catch{}
  let paused=s.mode==='timed'&&s.phase==='playing',started=s.pairs>0,view=C.clone(s.board),queue=[],active=null,busy=false,raf=0;
  let selected=-1,hinted=null,pointer=null,pending=null,history=[],lastClock=performance.now(),saveClock=0,messageTimer=0,clockTimer=0;
  let width=800,height=600,scale=1,cells=[],sprites=new Map(),particles=[],rings=[],fxPeak=0;
  const audio=createGameAudio({game:'petlink',music:false,isEnabled:()=>sound,isPlaying:()=>s.phase==='playing',isPaused:()=>paused||$('dialog').open});
  const text=(id,value)=>{const el=$(id);if(el.textContent!==String(value))el.textContent=value;};
  const point=i=>({x:(i%s.cols+1.5)*100,y:(Math.floor(i/s.cols)+1.5)*100});
  const pathPoint=p=>({x:(p.x+1.5)*100,y:(p.y+1.5)*100}),routes=new WeakMap(),background=document.createElement('canvas');
  const say=value=>text('feedback',value);
  function save(){try{localStorage.setItem(key,JSON.stringify(s));text('save-status','进度已保存 · 支持离线游玩');}catch{text('save-status','暂时无法保存，请先不要关闭页面');}}
  function record(){if(s.phase!=='won')return;const k=`${s.mode}:${s.level}`;progress[k]=Math.max(Number(progress[k])||0,s.score);try{localStorage.setItem(key+'.progress',JSON.stringify(progress));}catch{}}
  function flash(value){clearTimeout(messageTimer);text('board-message',value);messageTimer=setTimeout(()=>text('board-message',''),1000);}
  function populate(){
    $('levels').replaceChildren(...C.levels().map((cfg,i)=>{const el=document.createElement('option');el.value=i;el.textContent=`${i+1}. ${cfg.name}${progress[`${s.mode}:${i}`]?' ✓':''}`;return el;}));$('levels').value=s.level;$('mode').value=s.mode;
  }
  function clock(){
    const cfg=C.level(s.level),remaining=s.timeLeft===null?1:s.timeLeft/cfg.maxSeconds;
    text('timer',s.timeLeft===null?'不限时':`${Math.ceil(s.timeLeft)} 秒`);text('clock-label',s.timeLeft===null?'慢慢观察':'剩余时间');
    const transform=`scaleX(${remaining})`;if($('time-fill').style.transform!==transform)$('time-fill').style.transform=transform;
    const bar=$('time-fill').parentElement,value=String(Math.ceil(remaining*100)),description=s.timeLeft===null?'不限时':`${Math.ceil(s.timeLeft)} 秒`;
    if(bar.getAttribute('aria-valuenow')!==value)bar.setAttribute('aria-valuenow',value);if(bar.getAttribute('aria-valuetext')!==description)bar.setAttribute('aria-valuetext',description);
  }
  function stopClock(){clearTimeout(clockTimer);clockTimer=0;lastClock=0;}
  function syncClock(){const active=!paused&&!busy&&!document.hidden&&!$('dialog').open&&s.phase==='playing'&&(s.timeLeft!==null||s.comboLeft>0);if(!active)stopClock();else if(!clockTimer){if(!lastClock)lastClock=performance.now();clockTimer=setTimeout(tickClock,100);}}
  function status(){
    const cfg=C.level(s.level);text('level-title',`${s.level+1} / 12 · ${cfg.name}`);text('flow',C.flows[cfg.flow]);
    text('level-note',cfg.flow==='none'?'最多两个拐角，也能从棋盘外围绕行。':`配对后${C.flows[cfg.flow]}，看看新的相遇路线。`);
    text('pairs',`${s.pairs} / ${s.cols*s.rows/2}`);text('score',s.score);text('best',`最好 ${Number(progress[`${s.mode}:${s.level}`])||0}`);
    text('combo',s.combo>1?`连消 ×${s.combo}`:'找到好朋友');text('hint',`提示 · ${s.hintsLeft}`);text('shuffle',`重排 · ${s.shufflesLeft}`);
    $('hint').disabled=busy||paused||s.phase!=='playing'||!s.hintsLeft;$('shuffle').disabled=busy||paused||s.phase!=='playing'||!s.shufflesLeft;
    $('undo').disabled=!history.length;$('result-undo').disabled=!history.length;
    $('pause').disabled=s.phase!=='playing';text('pause',paused?(started?'▶ 继续':'▶ 开始'):'Ⅱ 暂停');
    $('resume').hidden=!paused||s.phase!=='playing';$('resume').querySelector('strong').textContent=started?'小伙伴等你回来':'准备好了吗？';$('resume').querySelector('small').textContent=started?'点这里继续':'点这里开始';
    const finished=!busy&&s.phase!=='playing';$('result').hidden=!finished;
    if(finished){text('result-title',s.phase==='won'?'都找到好朋友啦！':'再观察一次吧');text('result-text',s.phase==='won'?`完成 ${s.pairs} 对，获得 ${s.score} 分！`:`时间到了，已找到 ${s.pairs} 对。也可以选择「慢慢练习」。`);$('next').hidden=s.phase!=='won';text('next',s.level===11?'回到第一关':'下一关 →');}
    for(let i=0;i<cells.length;i++){
      const el=cells[i],tile=s.board[i];el.classList.toggle('empty',!tile);el.classList.toggle('selected',selected===i);el.classList.toggle('hinted',!!hinted?.pair.includes(i));
      const label=`第${Math.floor(i/s.cols)+1}行第${i%s.cols+1}列 ${tile?A.names[tile.pet]:'空位'}`;
      if(el.getAttribute('aria-label')!==label)el.setAttribute('aria-label',label);
      el.setAttribute('aria-pressed',String(selected===i));el.disabled=!tile||paused||busy||s.phase!=='playing';
    }
    // Leave one remaining tile in the keyboard tab order after a pair disappears.
    const focused=cells.findIndex(el=>el.tabIndex===0&&!el.disabled),first=s.board.findIndex(Boolean);
    if(focused<0)cells.forEach((el,i)=>el.tabIndex=i===first?0:-1);
    clock();document.querySelector('.pet-clock').classList.toggle('urgent',s.timeLeft!==null&&s.timeLeft<=20);syncClock();
  }
  function build(){
    width=(s.cols+2)*100;height=(s.rows+2)*100;
    background.width=width;background.height=height;const g=background.getContext('2d');
    g.strokeStyle='#ecf6dd30';g.lineWidth=2;g.setLineDash([5,12]);g.beginPath();g.roundRect(49,49,width-98,height-98,24);g.stroke();g.setLineDash([]);
    g.fillStyle='#d9edd214';for(let i=0;i<s.board.length;i++){const p=point(i);g.beginPath();g.roundRect(p.x-45,p.y-45,90,90,16);g.fill();}
    const grid=$('cells');grid.style.left=`${100/width*100}%`;grid.style.top=`${100/height*100}%`;grid.style.width=`${s.cols*100/width*100}%`;grid.style.height=`${s.rows*100/height*100}%`;
    grid.style.gridTemplateColumns=`repeat(${s.cols},minmax(0,1fr))`;grid.style.gridTemplateRows=`repeat(${s.rows},minmax(0,1fr))`;
    cells=Array.from({length:s.board.length},(_,i)=>{const el=document.createElement('button');el.type='button';el.dataset.cell=i;el.tabIndex=i===0?0:-1;return el;});grid.replaceChildren(...cells);resize();
  }
  function sprite(pet){if(!sprites.has(pet))sprites.set(pet,A.sprite(pet));return sprites.get(pet);}
  function routeLine(path,progress=1,alpha=1,dashed=false){
    let route=routes.get(path);if(!route){const points=path.map(pathPoint),lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));route={points,lengths,total:lengths.reduce((a,b)=>a+b,0)};routes.set(path,route);}
    const {points,lengths}=route;let left=route.total*progress,head=points[0];const visible=[head];
    for(let i=0;i<lengths.length&&left>0;i++){const a=points[i],b=points[i+1],t=Math.min(1,left/lengths[i]);head={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};visible.push(head);left-=lengths[i];}
    ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';if(dashed)ctx.setLineDash([12,10]);
    for(const [color,lineWidth] of [['#f2bd62',14],['#fff4c4',6]]){ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();visible.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
    ctx.fillStyle='#fff9df';ctx.beginPath();ctx.arc(head.x,head.y,dashed?5:9,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function draw(now=performance.now()){
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    ctx.drawImage(background,0,0);
    const frame=active?.frame,u=active?Math.min(1,(now-active.start)/active.duration):1,board=frame?.board||view;
    const moving=frame&&['shift','shuffle'].includes(frame.kind);
    if(hinted&&!busy)routeLine(hinted.path,1,.65,true);
    for(let i=0;i<board.length;i++){
      const tile=board[i];if(!tile)continue;const p=point(i);let x=p.x,y=p.y,zoom=1,opacity=1;
      if(moving){const old=active.oldMap.get(tile.uid),from=old==null?p:point(old),t=1-Math.pow(1-u,3);x=from.x+(p.x-from.x)*t;y=from.y+(p.y-from.y)*t;zoom=1+Math.sin(u*Math.PI)*.035;}
      if(frame?.removed?.includes(i)){if(frame.kind==='link')zoom=1+Math.sin(u*Math.PI)*.09;else if(frame.kind==='clear'){zoom=u<.25?1+u*.5:Math.max(.01,1.125*(1-(u-.25)/.75));opacity=1-u;}}
      ctx.globalAlpha=opacity;ctx.save();ctx.translate(x,y);ctx.scale(zoom,zoom);ctx.drawImage(sprite(tile.pet),-46,-46,92,92);ctx.restore();ctx.globalAlpha=1;
    }
    if(frame?.path)routeLine(frame.path,frame.kind==='link'?Math.min(1,u*1.3):1,frame.kind==='clear'?1-u:1);
    for(let i=rings.length-1;i>=0;i--){const r=rings[i],u=(now-r.start)/r.life;if(u>=1){rings.splice(i,1);continue;}ctx.globalAlpha=(1-u)*.8;ctx.strokeStyle=r.color;ctx.lineWidth=7*(1-u);ctx.beginPath();ctx.arc(r.x,r.y,18+u*65,0,Math.PI*2);ctx.stroke();}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i],u=(now-p.start)/p.life;if(u>=1){particles.splice(i,1);continue;}const t=(now-p.start)/1000,x=p.x+p.vx*t,y=p.y+p.vy*t+150*t*t,r=p.size*(1-u*.6);ctx.globalAlpha=1-u;ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+r*1.6,y-r*1.6,x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.quadraticCurveTo(x-r*1.6,y-r*1.6,x,y-r);ctx.fill();}
    ctx.globalAlpha=1;
  }
  function burst(frame,now){
    for(const i of frame.removed){const p=point(i);if(rings.length<8)rings.push({...p,start:now,life:460,color:'#fff0b4'});
      for(let n=0;n<14&&particles.length<96;n++){const a=n*Math.PI*2/14,v=85+Math.random()*110;particles.push({...p,start:now,life:420+Math.random()*180,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,size:5+Math.random()*4,color:['#fff3b8','#f6c0b5','#d9efbf',A.coats[frame.board[i].pet]][n%4]});}
    }fxPeak=Math.max(fxPeak,particles.length);
  }
  function requestDraw(){if(!raf&&!document.hidden)raf=requestAnimationFrame(tickDraw);}
  function nextFrame(now){
    if(!queue.length){active=null;busy=false;view=C.clone(s.board);status();if(s.phase!=='playing'){record();populate();audio.effect(s.phase==='won'?'finish':'over',{volume:.45});}return;}
    const frame=queue.shift(),duration={link:220,clear:230,shift:290,shuffle:340}[frame.kind];
    active={frame,start:now,duration,oldMap:new Map(view.flatMap((t,i)=>t?[[t.uid,i]]:[]))};
    if(frame.kind==='clear'){burst(frame,now);audio.effect(s.combo>2?'merge':'clear',{rate:1+Math.min(6,s.combo-1)*.05,volume:.53});}
    else if(frame.kind==='shift'||frame.kind==='shuffle')audio.effect('drop',{volume:.22});
  }
  function tickDraw(now){raf=0;if(active&&now-active.start>=active.duration){view=active.frame.kind==='clear'?active.frame.board.map((t,i)=>active.frame.removed.includes(i)?null:t):active.frame.board;nextFrame(now);}draw(now);if(active||particles.length||rings.length)requestDraw();}
  function finish(){queue=[];active=null;busy=false;particles.length=rings.length=0;view=C.clone(s.board);cancelAnimationFrame(raf);raf=0;status();draw();}
  function animate(frames){
    selected=-1;hinted=null;
    if(reduced.matches||document.hidden){finish();audio.effect(s.phase==='won'?'finish':'clear',{volume:.4});return;}
    queue=frames;busy=true;status();nextFrame(performance.now());requestDraw();
  }
  function select(i){
    if(busy||paused||s.phase!=='playing'||$('dialog').open||!s.board[i])return;
    hinted=null;
    if(selected===i){selected=-1;status();requestDraw();return;}
    if(selected<0){selected=i;audio.effect('move',{volume:.15});status();requestDraw();return;}
    const before=C.clone(s),result=C.play(s,selected,i);
    if(!result.ok){selected=i;say(result.reason==='different'?'这两只不一样，再找找同样的小伙伴。':'这条路被挡住啦，试试不超过两个拐角的路线。');audio.effect('rotate',{volume:.13});status();requestDraw();return;}
    history.push(before);history=history.slice(-24);save();record();
    flash(`${s.combo>1?`连消 ×${s.combo} · `:''}+${result.earned}${result.bonus?`  +${Number(result.bonus.toFixed(2))}秒`:''}`);
    say(result.automatic?'暂时没有配对，已免费重排。提示和重排次数都保留。':result.path.length>2?`绕过 ${result.path.length-2} 个拐角，找到好朋友啦！`:'一条直线，找到好朋友啦！');animate(result.frames);
  }
  const grid=$('cells');
  grid.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||pointer||event.button>0){event.preventDefault();return;}const el=event.target.closest('[data-cell]');if(!el||el.disabled)return;
    pointer={id:event.pointerId,index:Number(el.dataset.cell),x:event.clientX,y:event.clientY};event.preventDefault();try{el.setPointerCapture(event.pointerId);}catch{}
  });
  grid.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const p=pointer;pointer=null;event.preventDefault();if(Math.hypot(event.clientX-p.x,event.clientY-p.y)<15)select(p.index);});
  for(const name of ['pointercancel','lostpointercapture'])grid.addEventListener(name,event=>{if(pointer?.id===event.pointerId)pointer=null;});
  grid.addEventListener('click',event=>{if(event.detail!==0)return;const el=event.target.closest('[data-cell]');if(el)select(Number(el.dataset.cell));});
  grid.addEventListener('keydown',event=>{
    const el=event.target.closest('[data-cell]');if(!el)return;const i=Number(el.dataset.cell),step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-s.cols,ArrowDown:s.cols}[event.key];
    if(step){event.preventDefault();let n=i+step;while(n>=0&&n<cells.length&&(Math.abs(step)===s.cols||Math.floor(n/s.cols)===Math.floor(i/s.cols))){if(!cells[n].disabled){cells.forEach((el,j)=>el.tabIndex=j===n?0:-1);cells[n].focus();break;}n+=step;}}
    if(event.key==='Escape'){selected=-1;hinted=null;status();requestDraw();}
  });
  function reset(level=s.level,mode=s.mode){pointer=null;s=C.fresh(level,undefined,mode);history=[];selected=-1;hinted=null;paused=mode==='timed';started=false;clearTimeout(messageTimer);text('board-message','');populate();finish();build();status();save();lastClock=performance.now();say('先找相邻的小伙伴，也可以沿棋盘外侧绕行。');audio.sync();}
  function ask(title,description,fn){pointer=null;finish();pending=fn;text('dialog-title',title);text('dialog-text',description);$('cancel').hidden=!fn;text('confirm',fn?'确定':'知道啦');$('dialog').showModal();stopClock();audio.sync();}
  function pause(){if(s.phase!=='playing')return;pointer=null;finish();paused=!paused;started=true;lastClock=performance.now();status();draw();audio.sync();}
  $('pause').onclick=pause;$('resume').onclick=pause;
  $('hint').onclick=()=>{if(paused||busy)return;const found=C.useHint(s);if(found){hinted=found;selected=-1;save();status();draw();audio.effect('collect',{volume:.2});say('这两个小伙伴可以连接，看看亮起的路线。');}};
  $('shuffle').onclick=()=>{if(paused||busy)return;const before=C.clone(s),result=C.shuffle(s);if(result.ok){history.push(before);history=history.slice(-24);save();say('换好位置了，空位和剩余宠物都保留。');animate(result.frames);}};
  $('undo').onclick=()=>{if(!history.length)return;pointer=null;finish();s=history.pop();selected=-1;hinted=null;lastClock=performance.now();save();finish();say('已回到上一步，换一条路线试试。');};
  $('result-undo').onclick=()=>$('undo').onclick();$('retry').onclick=()=>reset();$('next').onclick=()=>reset((s.level+1)%12);
  $('restart').onclick=()=>ask('重新开始这一关？','本关会重新排列，已经完成的关卡记录会保留。',()=>reset());
  $('levels').onchange=event=>{const n=Number(event.target.value);event.target.value=s.level;if(n!==s.level)ask('切换关卡？','当前这一关会重新开始。',()=>reset(n));};
  $('mode').onchange=event=>{const mode=event.target.value;event.target.value=s.mode;if(mode!==s.mode)ask(mode==='practice'?'进入慢慢练习？':'进入计时挑战？','当前这一关会重新开始。慢慢练习没有时间限制。',()=>reset(s.level,mode));};
  $('help').onclick=()=>ask('小伙伴怎么相遇？','先点一只宠物，再点另一只相同的宠物。连线不能穿过其他宠物，最多转弯 2 次，也可以绕过棋盘外围。\n\n计时挑战每配对成功一次加 2 秒，连续配对加时更多；时间条有上限。慢慢练习不限时。\n\n每关有 3 次提示、3 次重排。完全没有可消除的配对时，会免费自动重排。\n\n后面的关卡会在配对后向下、向左、向右或向上移动，留意棋盘上方的方向说明。离开页面会暂停，回来点「继续」即可。',null);
  $('cancel').onclick=()=>{pending=null;$('dialog').close();};$('confirm').onclick=()=>{const fn=pending;pending=null;$('dialog').close();fn?.();};$('dialog').addEventListener('cancel',()=>pending=null);$('dialog').addEventListener('close',()=>{lastClock=performance.now();syncClock();audio.sync();});
  $('sound').onclick=()=>{sound=audio.toggle();if(sound)audio.unlock(true);try{localStorage.setItem('childgame.sound',sound?'on':'off');}catch{}audio.sync();};
  function suspend(){pointer=null;if(s.phase==='playing')paused=true;finish();save();audio.sync();lastClock=performance.now();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else{lastClock=performance.now();draw();}});window.addEventListener('pagehide',suspend);
  reduced.addEventListener('change',()=>{if(reduced.matches)finish();});
  function resize(){
    const r=document.querySelector('.board-stage').getBoundingClientRect(),size=Math.max(.001,Math.min(r.width/width,r.height/height)),wrap=document.querySelector('.board-wrap');
    wrap.style.width=`${width*size}px`;wrap.style.height=`${height*size}px`;
    const dpr=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(width*size*dpr)),h=Math.max(1,Math.round(height*size*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}scale=w/width;draw();
  }
  new ResizeObserver(resize).observe(document.querySelector('.board-stage'));
  function tickClock(){
    clockTimer=0;const now=performance.now(),dt=Math.min(1,(now-lastClock)/1000);lastClock=now;
    if(paused||busy||document.hidden||$('dialog').open||s.phase!=='playing')return;
    const combo=s.combo;C.tick(s,dt);saveClock+=dt;if(s.timeLeft!==null){clock();document.querySelector('.pet-clock').classList.toggle('urgent',s.timeLeft<=20);}
    if(combo!==s.combo)text('combo',s.combo>1?`连消 ×${s.combo}`:'找到好朋友');
    if(s.phase!=='playing'){save();finish();audio.effect('over',{volume:.35});}
    if(saveClock>=2||combo!==s.combo){save();saveClock=0;}syncClock();
  }
  window.PetLinkGame={snapshot:()=>C.clone(s),busy:()=>busy,paused:()=>paused,effects:()=>({particles:particles.length,rings:rings.length,sprites:sprites.size,peak:fxPeak,raf:!!raf}),scheduling:()=>({clock:!!clockTimer})};
  populate();build();status();save();draw();
})();
