(() => {
  'use strict';
  const C=PVZCore,$=id=>document.getElementById(id),renderer=createPVZRenderer($('board'));
  const KEY='childgame.pvz.v1',PROFILE='childgame.pvz.profile.v1';
  const get=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},set=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  let profile=get(PROFILE)||{};profile={unlocked:Math.max(1,Math.min(51,Math.trunc(Number(profile.unlocked))||1)),coins:Math.max(0,Math.min(1e9,Math.trunc(Number(profile.coins))||0))};
  let saved=C.restore(get(KEY)),state=C.fresh(Math.min(50,profile.unlocked)),paused=true,ready=false,raf=0,last=0,accumulator=0,uiElapsed=0,saveElapsed=0,selection=null,hover=null,gesture=null,chosen=[],loading=0,resultShown=false,menuWasPaused=true,infoWasPaused=true;
  if(saved?.phase!=='running')saved=null;
  let cardKey='',cardNodes=[];
  const audio={ctx:null,buffers:new Map(),sources:new Set(),last:new Map(),music:new Audio(),enabled:get('childgame.pvz.sound')!==false,unlocked:false,loading:null,musicName:''};
  audio.music.loop=true;audio.music.volume=.13;audio.music.preload='none';
  const sounds={plant:'plant_water',produce:'points',collect:'points',shot:'bonk',impact:'bonk',blast:'cherrybomb',fire:'cherrybomb',freeze:'frozen',wind:'blover',coffee:'coffee',vase:'vase_breaking',chomp:'chomp',mower:'lawnmower',won:'winmusic-web',lost:'losemusic',hugewave:'hugewave',finalwave:'finalwave',magnet:'mindcontrolled',smash:'bonk',bossattack:'cherrybomb'};
  function soundLabel(){$('sound').textContent=!audio.enabled?'声音已关闭':audio.unlocked?'声音已开启':'开启声音';}
  async function unlock(){
    if(!audio.enabled)return;
    try{if(!audio.ctx)audio.ctx=new(window.AudioContext||window.webkitAudioContext)();await audio.ctx.resume();audio.unlocked=audio.ctx.state==='running';soundLabel();
      if(!audio.loading)audio.loading=Promise.all([...new Set(Object.values(sounds))].map(async name=>{try{const r=await fetch('media/original/'+name+'.mp3');if(r.ok)audio.buffers.set(name,await audio.ctx.decodeAudioData(await r.arrayBuffer()));}catch{}}));
      syncMusic();
    }catch{audio.unlocked=false;soundLabel();}
  }
  function syncMusic(){if(!audio.enabled||!audio.unlocked||paused||state.phase!=='running'||document.hidden){audio.music.pause();return;}const info=C.levelInfo(state.level),name=info.mode==='boss'?'boss':['bowling','whack','vases'].includes(info.mode)?'minigame':info.mode==='conveyor'?'conveyor':['day','night','pool','fog','roof'][info.world];if(name!==audio.musicName){audio.music.src='media/music/'+name+'.mp3';audio.musicName=name;}audio.music.play().catch(()=>{});}
  function sfx(kind){const name=sounds[kind],now=performance.now();if(!name||!audio.enabled||!audio.unlocked||!audio.buffers.has(name)||audio.sources.size>=12||(now-(audio.last.get(name)||-1000))<(kind==='shot'?100:kind==='chomp'?300:60))return;
    audio.last.set(name,now);const src=audio.ctx.createBufferSource(),gain=audio.ctx.createGain();src.buffer=audio.buffers.get(name);gain.gain.value=kind==='shot'?.08:kind==='impact'?.16:.5;src.connect(gain).connect(audio.ctx.destination);audio.sources.add(src);src.onended=()=>{audio.sources.delete(src);src.disconnect();gain.disconnect();};src.start();
  }
  function quiet(){audio.music.pause();for(const src of audio.sources){try{src.stop();}catch{}}audio.sources.clear();}
  $('sound').onclick=async()=>{if(audio.enabled&&!audio.unlocked)await unlock();else{audio.enabled=!audio.enabled;set('childgame.pvz.sound',audio.enabled);if(audio.enabled)await unlock();else quiet();}soundLabel();};
  document.addEventListener('pointerdown',()=>{if(audio.enabled&&!audio.unlocked)unlock();},{passive:true});
  function save(){if(ready&&state.phase!=='ready'){set(KEY,state);saved=state.phase==='running'?C.clone(state):null;}set(PROFILE,profile);}
  function status(text){$('status').textContent=text;}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;accumulator=0;}
  function pause(value){paused=value;gesture=null;hover=null;stop();$('pause').textContent=paused?'继续':'暂停';if(paused){GameUX.cancelNext();quiet();save();}else{status(instruction());syncMusic();wake();}draw();}
  function wake(){if(!raf&&!paused&&ready&&state.phase==='running'&&!document.hidden&&!GameUX.isMenuOpen()&&!$('info').open)raf=requestAnimationFrame(frame);}
  function draw(){if(ready)renderer.draw(state,selection,hover);}
  function process(events){renderer.receive(events);for(const e of events){sfx(e.kind);if(e.kind==='hugewave')status('一大波僵尸正在接近！');if(e.kind==='finalwave')status('最后一波！');}if(state.phase==='won'||state.phase==='lost')finish();}
  function frame(now){raf=0;if(paused||!ready||document.hidden||GameUX.isMenuOpen()||$('info').open)return;
    const dt=last?Math.min(.1,(now-last)/1000):0;last=now;accumulator+=dt;let steps=0;
    while(accumulator>=1/60&&steps++<6&&state.phase==='running'){process(C.tick(state,1/60));renderer.advance(1/60);accumulator-=1/60;}
    uiElapsed+=dt;saveElapsed+=dt;if(uiElapsed>=.1){uiElapsed=0;updateHUD();}if(saveElapsed>=5){saveElapsed=0;save();}draw();wake();
  }
  function fit(){const main=document.querySelector('main').getBoundingClientRect(),scale=Math.min(main.width/1100,main.height/700);$('stage').style.transform=`scale(${scale})`;}
  window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
  const specification=type=>C.plants[type==='imitater'?state.imitate:type];
  function card(type){const spec=C.plants[type],button=document.createElement('button');button.className='seed';button.type='button';button.dataset.plant=type;button.setAttribute('aria-label',`${spec.name}，${specification(type).cost} 阳光`);const img=document.createElement('img');img.src=spec.upgrade||type==='imitater'?'media/runtime/original/'+type+'.webp':'media/original/'+(spec.art||type)+'.png';img.alt='';const name=document.createElement('span');name.className='name';name.textContent=spec.name;const cost=document.createElement('span');cost.className='cost';cost.textContent=specification(type).cost;const shade=document.createElement('span');shade.className='cooldown';button.append(img,name,cost,shade);return button;}
  function updateHUD(){
    $('level-label').textContent=C.levelInfo(state.level).name;$('sun-count').textContent=state.sun;
    const info=C.levelInfo(state.level),free=['conveyor','boss','vases','bowling'].includes(info.mode),cards=free?state.conveyor.map(c=>({type:c.type,id:c.id})):state.deck.map(type=>({type,id:type}));
    const key=cards.map(c=>c.id+':'+c.type).join('|');
    if(cardKey!==key){cardKey=key;cardNodes=cards.map(({type})=>{const b=card(type);$('cards').append(b);return b;});$('cards').replaceChildren(...cardNodes);}
    for(const b of cardNodes){const type=b.dataset.plant,remaining=free?0:state.cooldowns[type]||0,unavailable=!free&&(remaining>.01||state.sun<specification(type).cost);b.classList.toggle('active',type===selection);b.classList.toggle('unavailable',unavailable);b.setAttribute('aria-pressed',String(type===selection));b.querySelector('.cooldown').style.height=`${remaining/specification(type).recharge*100}%`;}
    $('shovel').classList.toggle('active',selection==='shovel');$('shovel').hidden=state.level<5||['bowling','whack','vases'].includes(info.mode);$('sun-count').hidden=free||info.mode==='whack';
    if(selection&&selection!=='shovel'&&!cards.some(c=>c.type===selection)&&!String(selection).startsWith('cannon:'))selection=null;
  }
  async function prepare(next,{resume=false}={}){
    const generation=++loading;stop();quiet();paused=true;ready=false;GameUX.cancelNext();gesture=null;selection=null;hover=null;state=next;resultShown=false;cardKey='';
    $('overlay').hidden=true;$('chooser').hidden=true;$('result').hidden=true;$('hud').hidden=false;$('pause').disabled=true;
    const cover=document.createElement('div');cover.className='loading';cover.textContent='正在准备庭院和角色动画…';$('stage').append(cover);
    try{await renderer.prepare(state);if(generation!==loading)return;ready=true;updateHUD();draw();$('pause').disabled=false;
      if(resume){paused=true;$('pause').textContent='继续';status('已恢复战斗，点“继续”开始。');}
      else{C.start(state);paused=false;$('pause').textContent='暂停';status(instruction());syncMusic();wake();}
      save();
    }catch(error){if(generation!==loading)return;cover.textContent='资源暂未加载完成，请联网后重试。';const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>prepare(next,{resume});cover.append(retry);console.warn(error.message);return;}
    finally{if(ready||generation!==loading)cover.remove();}
  }
  function instruction(){const i=C.levelInfo(state.level);return i.mode==='bowling'?'选坚果，点一条草坪路线，滚动撞击僵尸。':i.mode==='whack'?'直接点僵尸，用锤子把它们赶回去！':i.mode==='vases'?'点破花瓶，使用掉出的植物，清除全部僵尸。':i.mode==='boss'?'传送带免费供卡，守住屋顶，击败僵王。':i.mode==='conveyor'?'传送带自动送来免费植物，选卡后点草坪种下。':state.level===1?'先点豌豆射手，再点中间的草坪。金色阳光可以点按收集。':i.pool?'水上先放睡莲，再种植物。阳光要及时收集。':i.roof?'屋顶需要花盆；投手能越过斜坡攻击。':'选卡后点草坪，也可以把卡片拖到格子里。';}
  function choose(level){
    GameUX.cancelNext();stop();quiet();paused=true;selection=null;hover=null;state=C.fresh(level);chosen=C.defaultDeck(level);$('overlay').hidden=true;$('result').hidden=true;$('hud').hidden=true;$('pause').disabled=true;
    if(C.available(Math.min(51,profile.unlocked)).length<=6||C.levelInfo(level).mode!=='normal'){prepare(state);return;}
    $('chooser').hidden=false;$('choose-note').textContent=C.levelInfo(level).name+' · 选择最多 6 株植物';$('choose-grid').replaceChildren();
    for(const type of C.available(Math.max(level,profile.unlocked))){const b=card(type);b.onclick=()=>{const index=chosen.indexOf(type);if(index>=0)chosen.splice(index,1);else if(chosen.length<6){if(type==='imitater'){pickImitater();return;}chosen.push(type);}else{status('最多选 6 株，点已选植物可以取消。');return;}refreshChooser();};$('choose-grid').append(b);}
    refreshChooser();
  }
  function refreshChooser(){for(const b of $('choose-grid').children)b.setAttribute('aria-pressed',String(chosen.includes(b.dataset.plant)));$('choose-count').textContent=`已选 ${chosen.length} / 6：${chosen.map(t=>C.plants[t].name).join('、')}`;$('begin').disabled=!chosen.length;}
  function pickImitater(){info('模仿哪一株植物',host=>{const grid=document.createElement('div');grid.className='level-grid';for(const type of C.available(profile.unlocked).filter(t=>t!=='imitater'&&!C.plants[t].upgrade)){const b=document.createElement('button');b.textContent=C.plants[type].name;b.onclick=()=>{state.imitate=type;chosen.push('imitater');closeInfo();refreshChooser();const b=$('choose-grid').querySelector('[data-plant=imitater]');b.querySelector('.name').textContent='模仿'+C.plants[type].name;b.querySelector('.cost').textContent=C.plants[type].cost;};grid.append(b);}host.append(grid);});}
  $('begin').onclick=()=>{const i=C.levelInfo(state.level);if(i.pool&&!chosen.includes('lilypad')&&!chosen.some(t=>C.plants[t].water)){status('泳池建议带上睡莲，水路也需要守护。');}prepare(C.fresh(state.level,Date.now(),chosen,state.imitate));};
  $('choose-back').onclick=home;
  function finish(){if(resultShown)return;resultShown=true;stop();paused=true;audio.music.pause();gesture=null;selection=null;$('pause').disabled=true;$('result').hidden=false;
    const won=state.phase==='won';$('result-title').textContent=won?'庭院守住了！':'僵尸进入了房子';$('next').textContent=won?'继续冒险':'再试一次';$('next').hidden=won&&state.level===50;
    const reward=won?Object.values(C.plants).find(p=>p.unlock===state.level+1):null;$('reward').hidden=!reward;if(reward){$('reward').src='media/original/'+(reward.art||reward.id)+'.png';$('reward').alt=reward.name;}
    $('result-text').textContent=won?(state.level===50?'冒险模式完成！可以从关卡列表重玩。':reward?`获得 ${reward.name}！下一关可以使用。`:'准备迎接下一段冒险。'):'多种向日葵，分配好每条路线的防守，再来一次。';
    if(won){profile.unlocked=Math.max(profile.unlocked,state.level+1);profile.coins+=state.coins;}
    save();updateHUD();draw();
    if(won&&state.level<50)GameUX.queueNext({next:()=>choose(state.level+1),valid:()=>state.phase==='won'&&!$('info').open,button:$('next'),host:$('result'),delay:5000,text:reward?`新伙伴 ${reward.name} 已加入，马上进入下一关…`:'马上进入下一关…'});
  }
  $('next').onclick=()=>choose(state.phase==='won'?Math.min(50,state.level+1):state.level);$('home').onclick=home;
  function home(){GameUX.cancelNext();stop();quiet();paused=true;gesture=null;save();$('overlay').hidden=false;$('chooser').hidden=true;$('result').hidden=true;$('hud').hidden=true;$('pause').disabled=true;$('continue').hidden=!saved&&state.phase!=='running';$('adventure').textContent=profile.unlocked>1?'继续冒险 · '+C.levelInfo(Math.min(50,profile.unlocked)).name:'开始冒险';status('');draw();}
  $('adventure').onclick=()=>choose(Math.min(50,profile.unlocked));$('continue').onclick=()=>prepare(saved||state,{resume:true});
  function info(title,build){infoWasPaused=GameUX.isMenuOpen()?menuWasPaused:paused;GameUX.closeMenu();pause(true);$('info-title').textContent=title;$('info-body').replaceChildren();build($('info-body'));$('info').showModal();}
  function closeInfo(){$('info').close();if(!infoWasPaused&&state.phase==='running')pause(false);else draw();}
  $('info-close').onclick=closeInfo;$('info').addEventListener('cancel',e=>{e.preventDefault();closeInfo();});
  function levelPicker(){info('冒险关卡',host=>{const grid=document.createElement('div');grid.className='level-grid';for(let n=1;n<=50;n++){if(n%10===1){const h=document.createElement('div');h.className='world-heading';h.textContent=C.worlds[Math.floor((n-1)/10)];grid.append(h);}const b=document.createElement('button');b.textContent=`${Math.floor((n-1)/10)+1}-${(n-1)%10+1}`;b.disabled=n>profile.unlocked;b.onclick=()=>{$('info').close();choose(n);};grid.append(b);}host.append(grid);});}
  $('levels').onclick=levelPicker;$('quickplay').onclick=levelPicker;
  $('help').onclick=()=>info('怎样守住庭院',host=>{const p=document.createElement('p');p.textContent='点植物卡，再点格子，或拖卡片到草坪。点金色阳光收集；卡片变暗表示阳光不足或正在冷却。先建立阳光生产，再守住每条路线。铲子只移除点中的一株植物。水路先放睡莲，屋顶先放花盆；白天蘑菇需要咖啡豆唤醒。菜单和切到后台都会暂停。';host.append(p);});
  $('credits').onclick=()=>info('制作与素材',host=>{const p=document.createElement('p');p.textContent='本作是独立编写的非官方浏览器复刻，以初代移动版玩法为目标。图像与音频原作：PopCap Games / Electronic Arts。图集参考导出：xyxiao001/pvz-web，原版动画资源参考 ruslan831/PlantsVsZombies-decompilation。关卡波次、僵王攻击流程等仍为重建版本，与官方版本存在差异。';const a=document.createElement('a');a.href='media/sources.json';a.textContent='查看素材来源与校验记录';a.target='_blank';a.rel='noopener';host.append(p,a);});
  $('restart').onclick=()=>info('重新开始本关',host=>{const p=document.createElement('p');p.textContent='本关会从头开始，已经解锁的关卡会保留。';const b=document.createElement('button');b.textContent='重新种植';b.onclick=()=>{$('info').close();prepare(C.fresh(state.level,Date.now(),state.deck,state.imitate));};host.append(p,b);});
  $('pause').onclick=()=>{if(state.phase==='running'&&ready)pause(!paused);};
  $('shovel').onclick=()=>{if(paused||!ready)return;selection=selection==='shovel'?null:'shovel';updateHUD();draw();};
  function canSelect(type){const free=['conveyor','boss','vases','bowling'].includes(C.levelInfo(state.level).mode);return free?state.conveyor.some(c=>c.type===type):(state.cooldowns[type]||0)<.01&&state.sun>=specification(type).cost;}
  function action(point){
    if(paused||!ready||state.phase!=='running')return;
    const eventList=[],nearSun=state.suns.find(sun=>Math.hypot((sun.x-point.x),sun.y+.5-point.y)<.5);
    if(nearSun){C.collect(state,nearSun.id);sfx('collect');updateHUD();draw();return;}
    const i=C.levelInfo(state.level);
    if(i.mode==='whack'){const z=state.zombies.find(z=>Math.abs(z.x-point.x)<.65&&Math.abs(z.row+.45-point.y)<.7);if(z)C.whack(state,z.id,eventList);}
    else if(i.mode==='vases'&&!selection){const v=state.vases.find(v=>v.row===point.row&&v.col===point.col);if(v)C.breakVase(state,v.id,eventList);}
    else if(selection==='shovel'){if(C.shovel(state,point.row,point.col)){sfx('plant');selection=null;}}
    else if(String(selection).startsWith('cannon:')){if(C.cannon(state,Number(selection.split(':')[1]),point.row,point.x,eventList))selection=null;}
    else if(selection){const ok=i.mode==='bowling'?C.bowl(state,selection,point.row,eventList):C.plantAt(state,selection,point.row,point.col,eventList);if(ok){selection=null;status(instruction());}else status('这里不能种下这株植物，请选择空位或合适的地面。');}
    else{const cannon=C.at(state,point.row,point.col).find(p=>p.type==='cobcannon'&&p.cd===0);if(cannon){selection='cannon:'+cannon.id;status('点选炮击目标');}}
    process(eventList);updateHUD();draw();save();
  }
  const stage=$('stage');
  stage.addEventListener('pointerdown',e=>{
    if(gesture||paused||!ready||state.phase!=='running'||e.target.closest('.panel')||e.target.closest('#shovel'))return;
    const seed=e.target.closest('#cards .seed');if(!seed&&e.target!==$('board'))return;
    if(seed){const type=seed.dataset.plant;if(!canSelect(type)){status('这张卡片还在冷却，或阳光不够。');return;}selection=selection===type?null:type;}
    gesture={id:e.pointerId,fromCard:!!seed,x:e.clientX,y:e.clientY,moved:false};stage.setPointerCapture(e.pointerId);e.preventDefault();updateHUD();draw();
  });
  stage.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;gesture.moved=gesture.moved||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>7;hover=renderer.hit(e.clientX,e.clientY);});
  stage.addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);const p=renderer.hit(e.clientX,e.clientY);hover=null;if(!g.fromCard||g.moved&&p.row>=0)action(p);draw();});
  for(const name of ['pointercancel','lostpointercapture'])stage.addEventListener(name,e=>{if(gesture?.id===e.pointerId){gesture=null;hover=null;draw();}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){selection=null;draw();}if(e.code==='Space'&&e.target===document.body){e.preventDefault();$('pause').click();}});
  function suspend(){gesture=null;if(ready&&state.phase==='running')pause(true);else{stop();quiet();}save();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);window.addEventListener('pvz:redraw',draw);
  GameUX.configure({suspend(){menuWasPaused=paused;pause(true);},resume(){if(!menuWasPaused&&ready&&state.phase==='running'&&!document.hidden)pause(false);}});
  document.addEventListener('DOMContentLoaded',()=>{const list=document.querySelector('.ux-tool-list');list.append($('levels'),$('credits'));});
  window.PVZGame={snapshot:()=>C.clone(state),paused:()=>paused,effects:()=>({...renderer.metrics(),raf:!!raf}),ready:()=>ready,point:(row,col)=>renderer.point(row,col)};
  fit();soundLabel();$('continue').hidden=!saved;
  for(const id of ['adventure','continue','quickplay'])$(id).disabled=true;
  renderer.prepare(state).then(()=>{ready=true;draw();home();}).catch(()=>{status('资源未就绪，请联网后点击开始冒险重试。');}).finally(()=>{for(const id of ['adventure','continue','quickplay'])$(id).disabled=false;});
})();
