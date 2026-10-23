'use strict';
(() => {
  const C=BirdCore,$=id=>document.getElementById(id),KEY='childgame.birdblast.v2';
  const canvas=$('board'),ctx=canvas.getContext('2d',{alpha:false}),grid=$('cells'),wrap=document.querySelector('.board-wrap');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const palette=['#ef7765','#f4ca55','#72bde0','#95c966','#ae83cd','#ed9dbe','#f4eee0','#e49b5e'];
  const names=['珊瑚鸟','金黄鸟','蓝天鸟','青柠鸟','紫羽鸟','桃花鸟','云朵鸟','橘子鸟'];
  const powers={glow:'发光鸟',fire:'燃火鸟',lightning:'闪电鸟',whirlwind:'黑洞鸟'};
  const modeNames={classic:'经典挑战',ice:'顶部投放 · 破冰',pandora:'潘多拉宝盒',practice:'轻松练习',fever:'狂热冲分'};
  const notes={classic:'上方、侧边露出的小鸟都能抓。三消抖动时，快加同色伙伴！',ice:'点一下目标列，从顶部投下一只鸟。连起同色伙伴，震碎旁边的冰。',pandora:'合成超能鸟打开宝盒，集齐 BIRZZLE，赢取加时和超能伙伴。',practice:'没有倒计时，也没有自动掉排。慢慢练习自由拖动和超能合成。',fever:'两分钟内持续连消，填满能量条，进入双倍得分的狂热时刻。'};
  let s=C.fresh(),sound=true,bests={},paused=true,started=false,selected=null,drag=null,hints=[],pendingAction=null,wasPaused=true;
  let last=0,vtime=0,raf=0,hudAt=0,saveAt=0,suppressClick=0,announcement='',announcementUntil=0,focusIndex=0;
  const poses=new Map(),sprites=new Map(),particles=[],rings=[],beams=[],ghosts=[],cells=[];
  let background=document.createElement('canvas');
  try{const raw=JSON.parse(localStorage.getItem(KEY));if(raw){s=C.restore(raw);started=true;}sound=localStorage.getItem('childgame.sound')!=='off';bests=JSON.parse(localStorage.getItem(KEY+'.best'))||{};}catch{}
  const audio=createGameAudio({game:'birdblast',music:false,isEnabled:()=>sound,isPlaying:()=>s.phase==='playing',isPaused:()=>paused||$('dialog').open});
  const text=(id,value)=>{const el=$(id),v=String(value);if(el.textContent!==v)el.textContent=v;};
  const point=i=>({x:(i%7+.5)*100,y:100+(Math.floor(i/7)+.5)*100});
  const emit=(array,item,max)=>{if(array.length<max)array.push({...item,start:vtime});};
  const say=t=>text('feedback',t);
  function announce(t){announcement=t;announcementUntil=vtime+1.3;say(t);}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(s));bests[s.mode]=Math.max(Number(bests[s.mode])||0,s.score);localStorage.setItem(KEY+'.best',JSON.stringify(bests));text('save-status','进度已保存 · 支持离线');}catch{text('save-status','暂时无法保存进度');}}
  function round(g,x,y,w,h,r,fill,stroke){g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}}
  function ellipse(g,x,y,rx,ry,color){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();}
  function sprite(b){
    const key=[b.kind,b.color,b.special,b.lock,b.hp,b.loot].join(':');if(sprites.has(key))return sprites.get(key);
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.scale(1.28,1.28);
    if(b.kind==='ice'){
      const fill=g.createLinearGradient(0,0,100,100);fill.addColorStop(0,'#e9fdff');fill.addColorStop(.5,'#9bdef0');fill.addColorStop(1,'#599fc7');
      round(g,5,6,90,88,15,fill,'#d4faff');round(g,12,13,76,72,9,null,'#ffffff90');
      g.strokeStyle='#eaffff';g.lineWidth=4;g.beginPath();g.moveTo(17,36);g.lineTo(32,20);g.stroke();
      if(b.hp===2){g.strokeStyle='#537f9b';g.lineWidth=3;g.beginPath();g.moveTo(54,14);g.lineTo(44,38);g.lineTo(63,52);g.lineTo(47,80);g.stroke();}
      g.font='bold 37px sans-serif';g.textAlign='center';g.fillStyle='#46768c';g.fillText(b.loot==='clock'?'◷':b.loot==='bomb'?'✹':b.loot==='egg'?'●':'✧',50,65);
      if(b.loot==='egg'){ellipse(g,50,51,15,21,'#f7cf68');ellipse(g,45,43,4,7,'#fff6c3');}
    }else if(b.kind==='box'){
      round(g,6,9,88,83,13,'#b4824e','#f3d090');round(g,13,16,74,69,9,'#d4ab72','#8e653f');g.strokeStyle='#a87a48';g.lineWidth=6;g.strokeRect(20,24,60,51);g.fillStyle='#fff2bb';g.font='900 45px sans-serif';g.textAlign='center';g.fillText('?',50,69);
    }else{
      const color=palette[b.color],fill=g.createLinearGradient(0,10,0,94);fill.addColorStop(0,color);fill.addColorStop(1,b.color===6?'#d4dacc':color);
      ellipse(g,50,91,37,6,'#281f232d');round(g,7,12,86,79,23,fill,'#273f3226');
      round(g,13,17,74,23,15,'#ffffff24');ellipse(g,50,77,26,10,'#ffffff29');
      g.fillStyle=color;g.beginPath();g.moveTo(39,19);g.quadraticCurveTo(30,0,48,5);g.lineTo(50,16);g.quadraticCurveTo(62,-3,65,6);g.lineTo(61,20);g.fill();
      if(b.color===4){ellipse(g,33,46,17,19,'#ebd8f3');ellipse(g,67,46,17,19,'#ebd8f3');}
      for(const x of [34,66]){ellipse(g,x,46,13,16,'#fffef2');ellipse(g,x+2,48,7.5,10,'#303b41');ellipse(g,x+4,43,3,4,'white');}
      g.fillStyle='#e5993c';g.beginPath();g.moveTo(41,61);g.lineTo(59,61);g.quadraticCurveTo(50,78,41,61);g.fill();ellipse(g,22,64,6,3,'#f2988f85');ellipse(g,78,64,6,3,'#f2988f85');
      if(b.special){const color={glow:'#fff5ad',fire:'#ffb14b',lightning:'#a3edff',whirlwind:'#e3bcff'}[b.special];round(g,5,9,90,85,23,null,color);g.lineWidth=3;g.stroke();ellipse(g,78,77,15,15,'#30444e');g.fillStyle=color;g.textAlign='center';g.font='bold 22px sans-serif';g.fillText({glow:'✦',fire:'♨',lightning:'ϟ',whirlwind:'◎'}[b.special],78,85);}
      if(b.lock){g.strokeStyle=b.lock===2?'#e4ba5d':'#afc2c5';g.lineWidth=8;g.strokeRect(12,19,76,68);round(g,37,68,26,23,6,b.lock===2?'#f4d683':'#d8e0df');ellipse(g,50,79,3,5,'#55726f');}
    }
    sprites.set(key,c);return c;
  }
  function drawBackground(){
    background.width=700;background.height=(s.rows+1)*100;const g=background.getContext('2d');
    const sky=g.createLinearGradient(0,0,0,background.height);sky.addColorStop(0,'#8fd9e6');sky.addColorStop(.5,'#d5efdb');sky.addColorStop(1,'#91bc74');g.fillStyle=sky;g.fillRect(0,0,700,background.height);
    round(g,4,100,692,s.rows*100-4,18,'#a5784b','#e9c58a');
    const wood=g.createLinearGradient(0,100,700,1100);wood.addColorStop(0,s.mode==='ice'?'#2e7684':'#4e392d');wood.addColorStop(1,s.mode==='ice'?'#194e62':'#775239');round(g,9,106,682,s.rows*100-15,13,wood);
    for(let r=0;r<s.rows;r++)for(let c=0;c<7;c++){round(g,c*100+5,100+r*100+5,90,90,14,(r+c)%2?'#ffffff05':'#ffffff09');}
    round(g,6,4,688,90,19,'#fcf3d9','#c5ba87');g.fillStyle='#867444';g.font='bold 12px sans-serif';g.fillText(s.mode==='ice'?'下一只 →':'下一排小鸟',18,18);
    if(s.mode==='ice'){g.setLineDash([9,10]);g.strokeStyle='#d0f6fd90';g.lineWidth=3;g.beginPath();g.moveTo(12,100+(s.rows-2)*100);g.lineTo(688,100+(s.rows-2)*100);g.stroke();}
  }
  function fit(){const box=document.querySelector('.stage').getBoundingClientRect(),h=(s.rows+1)*100,w=Math.max(1,Math.min(box.width,box.height*700/h));wrap.style.width=w+'px';wrap.style.height=w*h/700+'px';const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(w*h/700*dpr);grid.style.top=100/h*100+'%';grid.style.gridTemplateRows=`repeat(${s.rows},minmax(0,1fr))`;draw();}
  function syncCells(){
    if(cells.length!==s.board.length){grid.replaceChildren();cells.length=0;for(let i=0;i<s.board.length;i++){const el=document.createElement('button');el.type='button';el.dataset.cell=i;el.tabIndex=i===0?0:-1;grid.append(el);cells.push(el);}}
    for(let i=0;i<cells.length;i++){const el=cells[i],b=s.board[i];const label=`第${Math.floor(i/7)+1}行第${i%7+1}列，${!b?'空位':b.kind==='ice'?'冰块'+(b.loot==='egg'?'，金蛋':b.loot==='clock'?'，加时':''):b.kind==='box'?'潘多拉宝盒':names[b.color]+(b.special?'，'+powers[b.special]:'')+(b.lock?'，带锁':'')}`;
      if(el.getAttribute('aria-label')!==label)el.setAttribute('aria-label',label);el.classList.toggle('selected',!!b&&b.uid===selected);el.classList.toggle('hinted',hints.includes(i));el.classList.toggle('pickable',C.selectable(s,i));el.disabled=paused||s.phase!=='playing';
    }
  }
  function status(){
    text('score',s.score.toLocaleString());text('level-label',s.mode==='ice'?'破冰波次':'森林等级');text('level',s.mode==='ice'?`${s.wave} · 蛋 ${s.eggs}`:s.level);
    text('mode-title',modeNames[s.mode]);text('mode-note',notes[s.mode]);$('mode').value=s.mode;$('pace').value=s.pace;
    text('clock-label',s.mode==='practice'?'练习记录':s.timeLeft!==null?'剩余时间':'下一排小鸟');
    text('clock',s.timeLeft!==null?`${Math.floor(Math.ceil(s.timeLeft)/60)}:${String(Math.ceil(s.timeLeft)%60).padStart(2,'0')}`:s.mode==='practice'?`${s.cleared} 只伙伴`:`${Math.max(0,s.dropLeft).toFixed(1)} 秒`);
    $('progress').style.width=Math.min(100,s.mode==='fever'?s.fever:s.levelCleared/C.threshold(s)*100)+'%';
    text('pause',paused?(started?'继续':'开始'):'暂停');text('best',`本模式最高分 ${Math.max(bests[s.mode]||0,s.score).toLocaleString()}`);
    $('hint').disabled=paused||s.phase!=='playing';$('shuffle').disabled=paused||s.phase!=='playing'||!!s.charges.length;
    const finished=s.phase!=='playing';$('overlay').hidden=!paused&&!finished;
    text('overlay-title',finished?(s.phase==='won'?'挑战完成！':'下次再来一场！'):started?'稍作休息':modeNames[s.mode]);
    text('overlay-text',finished?`这次获得 ${s.score.toLocaleString()} 分，解救 ${s.cleared} 只小鸟。`:notes[s.mode]);
    text('resume',finished?'再玩一次':started?'继续游戏':'开始游戏');syncCells();
  }
  function syncPoses(events=[]){
    const births=new Map();for(const e of events)if(e.type==='drop')for(const m of e.moved)births.set(m.uid,{x:(m.to%7+.5)*100,y:55});
    const alive=new Set();for(let i=0;i<s.board.length;i++){const b=s.board[i];if(!b)continue;alive.add(b.uid);const p=point(i);let pose=poses.get(b.uid);if(!pose){const from=births.get(b.uid)||p;pose={x:from.x,y:from.y,tx:p.x,ty:p.y,land:0};poses.set(b.uid,pose);}pose.tx=p.x;pose.ty=p.y;}
    for(const id of poses.keys())if(!alive.has(id))poses.delete(id);
    if(selected&&!alive.has(selected))selected=null;if(drag&&!alive.has(drag.uid))drag=null;
  }
  function burst(e){
    for(const item of e.removed){const p=point(item.index),pose=poses.get(item.tile.uid);emit(ghosts,{...p,x:pose?.x??p.x,y:pose?.y??p.y,tile:item.tile,life:reduced.matches?.12:.32,spin:e.triggers.some(t=>t.special==='whirlwind')},80);}
    const stride=Math.max(1,Math.ceil(e.removed.length/14));
    for(let j=0;j<e.removed.length;j+=stride){const item=e.removed[j],p=point(item.index),color=palette[item.tile.color]||'#b9efff';emit(rings,{...p,color,life:.45,size:65},16);
      if(!reduced.matches)for(let k=0;k<7;k++){const a=k*Math.PI*2/7;emit(particles,{...p,color:k%3?color:'#fff5c4',vx:Math.cos(a)*(90+Math.random()*140),vy:Math.sin(a)*160-100,size:4+Math.random()*6,life:.45+Math.random()*.3},180);}}
    for(const [i,t] of e.triggers.entries()){emit(beams,{...point(t.index),special:t.special,life:t.special==='whirlwind'?1:t.special==='fire'?.8:.55},16);if(i<3)audio.effect(t.special,{volume:.55});}
    audio.effect(e.triggers.length?'merge':'clear',{rate:Math.min(1.5,1+Math.max(0,e.combo-1)*.045),volume:e.triggers.length?.75:.6});
    announce(e.largest>=7?'黑洞小鸟诞生！':e.combo>=2?`${e.combo} 连击！ +${e.gain}`:`${e.largest} 只相连！ +${e.gain}`);
  }
  function consume(result){
    if(!result?.events?.length)return;
    for(const e of result.events){
      if(e.type==='clear')burst(e);
      if(e.type==='move'||e.type==='drop')audio.effect('drop',{volume:.3});
      if(e.type==='create'){emit(rings,{...point(e.index),color:'#fff4ad',life:.6,size:95},16);audio.effect('collect',{volume:.45});}
      if(e.type==='unlock'||e.type==='icehit')audio.effect('hit',{volume:.18,rate:1.5});
      if(e.type==='reward')announce(e.text);
      if(e.type==='box')announce(`宝盒打开！收集 ${e.letter} · +5 秒`);
      if(e.type==='wave')announce(`第 ${e.wave} 波${e.wave>1?' · +21 秒':''}`);
      if(e.type==='level'){announce(`森林等级 ${e.level}！`);audio.effect('collect',{volume:.4});}
      if(e.type==='end'){audio.effect(s.phase==='won'?'finish':'over',{volume:.6});save();}
    }syncPoses(result.events);syncCells();status();save();
  }
  function draw(dt=0){
    if(!canvas.width||!background.width)return;const scale=canvas.width/700;ctx.setTransform(scale,0,0,scale,0,0);ctx.drawImage(background,0,0);
    for(let c=0;c<7;c++){const b=s.next[c];if(!b)continue;const size=s.mode==='ice'?(c===0?72:53):64,x=s.mode==='ice'?62+c*92:50+c*100;ctx.globalAlpha=s.mode==='ice'&&c>0?.65:1;ctx.drawImage(sprite(b),x-size/2,22,size,size);ctx.globalAlpha=1;}
    const charging=new Map();for(const g of s.charges)for(const id of g.uids)charging.set(id,g.at-s.clock);
    let aim=-1;if(drag&&drag.moved){const from=s.board.findIndex(b=>b?.uid===drag.uid);if(from>=0)aim=C.target(s,from,drag.target);}
    if(s.mode==='ice'&&hints.length)aim=hints[1];
    if(aim>=0){const p=point(aim);ctx.fillStyle='#fff5a92c';ctx.fillRect(aim%7*100,100,100,s.rows*100);round(ctx,p.x-43,p.y-43,86,86,18,null,'#fff1ad');}
    for(let i=0;i<s.board.length;i++){const b=s.board[i];if(!b)continue;const pose=poses.get(b.uid)||{...point(i),tx:point(i).x,ty:point(i).y,land:0};let x=pose.x,y=pose.y,scaleY=1;
      const distance=Math.hypot(pose.tx-x,pose.ty-y);if(distance>.5){const speed=reduced.matches?1:Math.min(1,dt*(distance>250?14:19));pose.x+=(pose.tx-pose.x)*speed;pose.y+=(pose.ty-pose.y)*speed;x=pose.x;y=pose.y;if(Math.hypot(pose.tx-x,pose.ty-y)<3)pose.land=vtime;}
      else{pose.x=pose.tx;pose.y=pose.ty;x=pose.x;y=pose.y;}
      if(!reduced.matches&&vtime-pose.land<.17)scaleY=1-Math.sin((vtime-pose.land)/.17*Math.PI)*.09;
      if(charging.has(b.uid)){if(!reduced.matches)x+=Math.sin(vtime*58+b.uid)*2.4;round(ctx,x-47,y-47,94,94,22,'#fff6b22c','#ffed95');}
      if(drag?.uid===b.uid&&drag.moved)continue;
      ctx.drawImage(sprite(b),x-48,y-48*scaleY,96,96*scaleY);
      if(b.special&&!reduced.matches){ctx.globalAlpha=.45+.25*Math.sin(vtime*5);round(ctx,x-46,y-45,92,91,21,null,{glow:'#fff6af',fire:'#ffcc8c',lightning:'#b4f2ff',whirlwind:'#eac4ff'}[b.special]);ctx.globalAlpha=1;}
    }
    for(const g of ghosts){const u=Math.min(1,(vtime-g.start)/g.life),size=96*(1-u*.7);ctx.globalAlpha=1-u;ctx.save();ctx.translate(g.x,g.y-24*u);if(g.spin)ctx.rotate(u*2);ctx.drawImage(sprite(g.tile),-size/2,-size/2,size,size);ctx.restore();}ctx.globalAlpha=1;
    for(const r of rings){const u=(vtime-r.start)/r.life;ctx.globalAlpha=Math.max(0,1-u);ctx.strokeStyle=r.color;ctx.lineWidth=5*(1-u)+1;ctx.beginPath();ctx.arc(r.x,r.y,12+r.size*u,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
    for(const b of beams){const u=(vtime-b.start)/b.life;ctx.globalAlpha=Math.max(0,1-u);ctx.lineCap='round';
      if(b.special==='lightning'){for(const width of [18,6]){ctx.strokeStyle=width===18?'#79cee86e':'#e3fcff';ctx.lineWidth=width;for(const vertical of [false,true]){ctx.beginPath();for(let k=0;k<=14;k++){const q=k/14,jitter=k===0||k===14?0:Math.sin(k*18+Math.floor(u*7))*12;const x=vertical?b.x+jitter:q*700,y=vertical?100+q*s.rows*100:b.y+jitter;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}}}
      else if(b.special==='fire'){const end=100+(s.rows-.5)*100,now=b.y+(end-b.y)*Math.min(1,u*1.5);ctx.strokeStyle='#ffb64e';ctx.lineWidth=22;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x,now);ctx.stroke();ellipse(ctx,b.x,now,22,29,'#fff2ac');if(u>.65){ctx.lineWidth=7;ctx.beginPath();ctx.arc(b.x,end,(u-.65)*280,0,Math.PI*2);ctx.stroke();}}
      else if(b.special==='whirlwind'){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(u*8);for(let j=0;j<4;j++){ctx.strokeStyle=j%2?'#eee0ff':'#a486d4';ctx.lineWidth=7-j;ctx.beginPath();for(let k=0;k<70;k++){const a=k*.11+j*1.6,r=10+k*3*(1-u*.4);k?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.stroke();}ellipse(ctx,0,0,22+u*35,22+u*35,'#302743');ctx.restore();}
      else{ctx.strokeStyle='#fff4af';ctx.lineWidth=13*(1-u);ctx.beginPath();ctx.arc(b.x,b.y,20+u*160,0,Math.PI*2);ctx.stroke();}
    }ctx.globalAlpha=1;
    for(const p of particles){const t=vtime-p.start,u=t/p.life;ctx.globalAlpha=1-u;ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x+p.vx*t,p.y+p.vy*t+170*t*t);ctx.rotate(t*4);ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*.65);ctx.restore();}ctx.globalAlpha=1;
    if(drag?.moved){const b=s.board.find(b=>b?.uid===drag.uid);if(b)ctx.drawImage(sprite(b),drag.x-54,drag.y-58,108,108);}
    if(announcementUntil>vtime&&!paused){const u=(announcementUntil-vtime)/1.3;ctx.globalAlpha=Math.min(1,u*4);ctx.font='900 32px sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#2b4f43';ctx.strokeText(announcement,350,150);ctx.fillStyle='#fff4bd';ctx.fillText(announcement,350,150);ctx.globalAlpha=1;}
    if(s.mode==='pandora'){ctx.font='bold 21px sans-serif';ctx.textAlign='center';for(let i=0;i<7;i++){ctx.fillStyle=i<s.letters.length?'#ffe18a':'#ffffff55';ctx.fillText('BIRZZLE'[i],180+i*57,background.height-12);}}
  }
  function loop(now){raf=0;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!paused&&!$('dialog').open&&s.phase==='playing'){vtime+=dt;consume(C.tick(s,dt));}
    else if(!paused&&s.phase!=='playing')vtime+=dt;
    for(const list of [ghosts,particles,rings,beams])for(let i=list.length-1;i>=0;i--)if(vtime-list[i].start>=list[i].life)list.splice(i,1);
    draw(paused?0:dt);if(now-hudAt>100){hudAt=now;status();}if(now-saveAt>2000&&!paused){saveAt=now;save();}
    if(!document.hidden)raf=requestAnimationFrame(loop);
  }
  function wake(){if(!raf&&!document.hidden){last=0;raf=requestAnimationFrame(loop);}}
  function start(){if(s.phase!=='playing')reset(s.mode,s.pace);paused=false;started=true;audio.unlock();audio.sync();status();last=0;wake();}
  function pause(){paused=true;drag=null;selected=null;audio.sync();status();save();}
  function reset(mode,pace){s=C.fresh(mode,undefined,pace);selected=null;drag=null;hints=[];poses.clear();for(const list of [particles,rings,beams,ghosts])list.length=0;vtime=0;announcementUntil=0;paused=true;started=false;drawBackground();syncPoses();status();fit();save();say(notes[s.mode]);}
  function dialog(title,body,action){wasPaused=paused;paused=true;drag=null;pendingAction=action;text('dialog-title',title);text('dialog-text',body);$('cancel').hidden=!action;audio.sync();$('dialog').showModal();status();}
  function closeDialog(accept){$('dialog').close();const action=pendingAction;pendingAction=null;if(accept&&action)action();else paused=wasPaused;audio.sync();last=0;status();wake();}
  function perform(from,to){const r=C.move(s,from,to);if(r.ok){hints=[];selected=null;consume(r);}else say(r.reason==='space'?'这里放不下，试试旁边的空位。':'找一只上方或侧边露出的小鸟。');}
  function tap(i){if(paused||s.phase!=='playing')return;if(s.mode==='ice'){const r=C.shoot(s,i%7);if(r.ok){hints=[];consume(r);}else if(r.reason==='space')say('这一列满啦，换一列试试。');return;}
    const from=s.board.findIndex(b=>b?.uid===selected);if(from>=0&&from!==i){perform(from,i);return;}
    selected=C.selectable(s,i)?s.board[i].uid:null;if(!selected)say('上方或侧边留有空隙，才能抓起小鸟。');syncCells();
  }
  function coords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*700,y:(e.clientY-r.top)/r.height*(s.rows+1)*100};}
  function cellAt(p){if(p.x<0||p.x>=700||p.y<100||p.y>=(s.rows+1)*100)return -1;return Math.floor((p.y-100)/100)*7+Math.floor(p.x/100);}
  grid.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button!==0||drag||paused||s.phase!=='playing')return;const i=Number(e.target.dataset.cell);if(!Number.isInteger(i))return;audio.unlock();const p=coords(e);drag={pointer:e.pointerId,uid:C.selectable(s,i)?s.board[i].uid:null,source:i,x:p.x,y:p.y,sx:p.x,sy:p.y,target:i,moved:false};try{grid.setPointerCapture(e.pointerId);}catch{}e.preventDefault();});
  grid.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;const p=coords(e);drag.x=p.x;drag.y=p.y;drag.target=cellAt(p);if(Math.hypot(p.x-drag.sx,p.y-drag.sy)>9)drag.moved=true;e.preventDefault();});
  grid.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const d=drag;drag=null;suppressClick=performance.now()+400;try{grid.releasePointerCapture(e.pointerId);}catch{}if(d.moved){if(d.uid&&d.target>=0){const source=s.board.findIndex(b=>b?.uid===d.uid);if(source>=0)perform(source,d.target);}}else tap(d.source);e.preventDefault();});
  for(const name of ['pointercancel','lostpointercapture'])grid.addEventListener(name,e=>{if(drag?.pointer===e.pointerId){drag=null;suppressClick=performance.now()+400;}});
  grid.addEventListener('click',e=>{if(performance.now()<suppressClick||e.detail>0)return;const i=Number(e.target.dataset.cell);if(Number.isInteger(i))tap(i);});
  grid.addEventListener('keydown',e=>{const i=Number(e.target.dataset.cell);if(!Number.isInteger(i))return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(delta){e.preventDefault();focusIndex=Math.max(0,Math.min(cells.length-1,i+delta));cells[i].tabIndex=-1;cells[focusIndex].tabIndex=0;cells[focusIndex].focus();}if(e.key==='Escape'){selected=null;drag=null;syncCells();}});
  $('resume').onclick=start;$('pause').onclick=()=>paused?start():pause();
  $('sound').onclick=()=>{sound=audio.toggle();try{localStorage.setItem('childgame.sound',sound?'on':'off');}catch{}audio.unlock(true);audio.sync();};
  $('restart').onclick=()=>dialog('重新开始？','本局进度将重新开始，最高分会保留。',()=>reset(s.mode,s.pace));
  for(const id of ['mode','pace'])$(id).onchange=()=>{const mode=$('mode').value,pace=$('pace').value;dialog('开始新的挑战？','会保留最高分，并为这个玩法准备新的棋盘。',()=>reset(mode,pace));$('mode').value=s.mode;$('pace').value=s.pace;};
  $('hint').onclick=()=>{hints=C.hint(s)||[];syncCells();say(!hints.length?'先处理锁或腾出一些空位。':s.mode==='ice'?'点亮的这一列，可以试试。':'先抓亮框里的小鸟，再放到另一个亮框。');};
  $('shuffle').onclick=()=>{const r=C.shuffle(s);if(r.ok){selected=null;hints=[];consume(r);say('小鸟换了位置，看看新的机会。');}};
  $('help').onclick=()=>dialog('怎么玩',notes[s.mode]+'\n\n3 只同色上下左右相连就开始抖动，斜角不算。趁短暂抖动再加同色鸟，可以合成超能鸟。\n\n4 只：发光，炸开周围一圈。\n5 只：燃火，向下烧穿并在底部爆炸。\n6 只：闪电，清除所在行和列。\n7 只以上：黑洞，大范围吸走小鸟。\n\n超能鸟再次参与同色消除，或被其他超能鸟击中时发动。爆破期间仍可移动其他小鸟。\n\n'+(s.mode==='ice'?'点击目标列投鸟，清除虚线以上的冰块自动进入下一波；沙漏加时，金蛋加分。':s.mode==='classic'?'新鸟定时从上方落下；鸟太少时底部补充。整盘填满且没有可消除组合才结束。带锁小鸟不能拖，同色匹配可解锁，超能爆破可以清除它。':s.mode==='pandora'?'宝盒不能普通三消，需用超能爆破打开。收集七个字母获得额外奖励。':'留出空列，练习同时安排几组连消。'),null);
  $('cancel').onclick=()=>closeDialog(false);$('confirm').onclick=()=>closeDialog(true);$('dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog(false);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();cancelAnimationFrame(raf);raf=0;}else wake();});window.addEventListener('pagehide',save);window.addEventListener('pageshow',wake);
  new ResizeObserver(fit).observe(document.querySelector('.stage'));
  window.BirdGame=window.MatchGame={snapshot:()=>C.clone(s),paused:()=>paused,busy:()=>s.charges.length>0||ghosts.length>0,effects:()=>({particles:particles.length,rings:rings.length,beams:beams.length,sprites:sprites.size,ghosts:ghosts.length})};
  drawBackground();syncPoses();status();fit();wake();
})();
