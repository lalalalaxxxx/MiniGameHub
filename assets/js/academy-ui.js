'use strict';
(() => {
  const id=document.body.dataset.game,config=AcademyData[id],C=AcademyCore,$=id=>document.getElementById(id);
  const key=`childgame.academy.${id}.v1`,stickers=['🌳','🦋','🐰','🌈'];
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let state=C.fresh(),sound=true,hint=false,wrong=null,message='',pending=null;
  try{state=C.restore(JSON.parse(localStorage.getItem(key)),config);sound=localStorage.getItem('childgame.sound')!=='off';}catch{}
  let list=C.questions(config,state.level,state.seed);
  const activities=window.AcademyActivities;
  function prepareWork(){if(config.kind&&state.index<6){const raw=state.work;state.work=activities.restore(config.kind,list[state.index],raw);if(state.solved&&(!activities.won(config.kind,list[state.index],state.work)||JSON.stringify(raw)!==JSON.stringify(state.work)))state.solved=false;}}
  prepareWork();
  const voice=new Audio();voice.preload='auto';let voiceEpoch=0;
  const audio=createGameAudio({game:id,music:false,isEnabled:()=>sound,isPlaying:()=>false,isPaused:()=>$('dialog').open});
  function stopVoice(){voiceEpoch++;voice.pause();voice.removeAttribute('src');voice.load();const status=$('voice-status');if(status)status.textContent='可以反复听';}
  function say(type='prompt') {
    stopVoice();if(!sound){$('feedback').textContent='声音已关闭，点右上角开启声音后再听。';return;}
    const question=list[state.index];if(!question||!state.started||document.hidden)return;
    const epoch=voiceEpoch;voice.src=`../../assets/audio/academy/${question.id}-${type}.mp3`;
    const status=$('voice-status');if(status)status.textContent='正在播放…';
    voice.play().then(()=>{if(epoch!==voiceEpoch)return;if(status)status.textContent='正在播放…';}).catch(()=>{if(epoch!==voiceEpoch)return;if(status)status.textContent='点听题目重试';$('feedback').textContent='这段语音暂时没能播放，可以点“听题目”重试；也可以看提示继续玩。';});
  }
  voice.onended=()=>{const el=$('voice-status');if(el)el.textContent='听完啦，可以再听一次';};
  function save(){try{localStorage.setItem(key,JSON.stringify(state));$('save-status').textContent='进度已保存 · 随时可以休息';}catch{$('save-status').textContent='暂时无法保存，关闭页面会丢失进度';}}
  function crates(n){return `${Array.from({length:Math.floor(n/10)},()=>'<span class="bundle" aria-label="十箱">10</span>').join('')}${Array.from({length:n%10},()=>'<span class="crate" aria-label="一箱"></span>').join('')}`;}
  function diagram(q) {
    if(q.op==='×')return `<div class="count-row">${Array.from({length:q.a},()=>`<span class="group">${'<i class="dot"></i>'.repeat(q.b)}</span>`).join('')}</div>`;
    if(state.level===0)return `<div class="count-row">${Array.from({length:q.a},(_,i)=>`<i class="dot${q.op==='−'&&i>=q.a-q.b?' removed':''}"></i>`).join('')}${q.op==='+'?`<b>＋</b>${'<i class="dot"></i>'.repeat(q.b)}`:''}</div>`;
    return `<div class="cargo">${crates(q.a)}</div><p>${q.op==='+'?'再加上':'减去'} ${q.b} 箱。深色的一捆代表十箱。</p>`;
  }
  function optionArt(option) {
    if(!option.color)return `<span class="object" aria-hidden="true">${option.picture}</span>`;
    const book=option.picture==='📕';
    return `<svg viewBox="0 0 200 60" aria-hidden="true">${Array.from({length:option.count},(_,i)=>book?`<g transform="translate(${8+i*48},8)"><rect width="35" height="44" rx="4" fill="${option.color}" stroke="#36575b"/><path d="M8 0v44M12 36h18" stroke="white" stroke-width="3"/></g>`:`<g transform="translate(${26+i*48},30)"><circle r="20" fill="${option.color}" stroke="#36575b"/><path d="M-14 -12Q0 -20 14 -12M-14 12Q0 20 14 12" fill="none" stroke="white" stroke-width="2"/></g>`).join('')}</svg>`;
  }
  function render() {
    $('feedback').textContent=message||'慢慢想，试试看。没有倒计时，也不会扣分。';
    document.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.level)===state.level)));
    $('restart').textContent=state.started?'重新出发':'开始旅程';
    $('journey').hidden=!state.started;
    $('journey').innerHTML=`<strong>${state.index===6?'六站都到达啦':`第 ${state.index+1} / 6 站`}</strong>${Array.from({length:6},(_,i)=>`<span class="step ${i<state.index||i===state.index&&state.solved?'done':i===state.index?'current':''}" aria-label="第${i+1}站${i<state.index||i===state.index&&state.solved?'已完成':''}">${i<state.index||i===state.index&&state.solved?'✓':i+1}</span>`).join('')}`;
    if(!state.started){$('activity').className='stage intro';$('activity').innerHTML=`<div class="picture" aria-hidden="true">${config.emoji}</div><h2>${config.subtitle}</h2><p>${state.level===0?'幼儿园':'二年级'} · ${config.levels[state.level]}<br>每轮 6 个小任务，听一听、动动手，随时可以休息。</p><button class="primary" data-action="start">▶ 开始玩 · 听任务</button>`;return;}
    if(state.index===6){$('activity').className='stage celebration';$('activity').innerHTML=`<h2 tabindex="-1" id="finish-title">这次旅程完成啦！</h2><p>你认真完成了 6 个任务。给学习花园选一张贴纸吧。</p><div class="garden">🌷 🌼 ${stickers[state.sticker]} 🌻 🌷</div><div class="stickers" role="group" aria-label="花园贴纸">${stickers.map((s,i)=>`<button data-action="sticker" data-value="${i}" aria-label="${['小树','蝴蝶','兔子','彩虹'][i]}贴纸" aria-pressed="${state.sticker===i}">${s}</button>`).join('')}</div><p>休息一下也很好，下次再来发现新知识。</p><a href="../../index.html">‹ 回大厅休息</a><button class="primary" data-action="again">再玩一轮</button>`;return;}
    const q=list[state.index];
    let content='';
    if(config.kind)content=activities.render(config.kind,q,state.work,state.level,state.solved,C.shuffle,state.seed+state.index*73);
    else if(id==='mathtrain')content=`<div class="equation">${q.a} ${q.op} ${q.b} = ${state.solved?q.answer:'?'}</div><div class="train"><div class="train-top"><span aria-hidden="true">🚂</span><strong id="cargo-count" aria-live="polite">已装 ${state.cargo} 箱</strong></div><div class="cargo">${state.cargo?crates(state.cargo):'<span class="cargo-empty">车厢空空的 · 0 箱</span>'}</div></div><div class="load-controls">${[1,-1,...(state.level?[10,-10]:[])].map(n=>`<button data-action="cargo" data-value="${n}" ${state.solved||state.cargo+n<0||state.cargo+n>(state.level?100:10)?'disabled':''}>${n>0?'＋ 加':'− 减'}${Math.abs(n)===10?'一捆（10 箱）':'一箱'}</button>`).join('')}</div><button class="primary check" data-action="check" ${state.solved?'disabled':''}>🚂 发车检查</button>`;
    else content=`${id==='hanzi'&&state.level===0?`<div class="picture" aria-hidden="true">${q.picture}</div>`:''}<div class="choices">${C.shuffle(q.options,state.seed+state.index*73).map((o,i)=>{const value=typeof o==='string'?o:o.id;return `<button class="choice ${id==='hanzi'?'hanzi':''} ${state.solved&&value===q.answer?'correct':''} ${wrong===value?'wrong':''}" data-action="choose" data-value="${escape(value)}" ${state.solved?'disabled':''}>${typeof o==='string'?escape(o):optionArt(o)+`<small>${escape(o.label)}</small>`}${state.solved&&value===q.answer?'<small>✓ 找到了</small>':''}</button>`;}).join('')}</div>`;
    $('activity').className=`activity ${id}`;
    $('activity').innerHTML=`<section class="stage"><div class="listen-row"><button id="listen" data-action="listen">🔊 听题目</button><span id="voice-status" role="status">可以反复听</span></div><h2 class="prompt">${escape(q.prompt)}</h2>${content}${state.solved?`<div class="answer-note" role="status"><strong>✓ 你做到了！</strong><p>${escape(q.explain)}</p><button data-action="explain">🔊 听解释</button><button class="primary" id="next-question" data-action="next">${state.index===5?'领取花园贴纸':'下一站 →'}</button></div>`:''}</section><aside class="guide"><h2>${config.kind?config.emoji+' '+config.title:id==='hanzi'?'🔎 侦探笔记':id==='mathtrain'?'📦 装货小帮手':'🧭 寻宝小指南'}</h2><p>${config.kind?config.guide:id==='hanzi'?'先听读音，再看看字的样子。':id==='mathtrain'?'装好的货物就是你的答案。可以加，也可以减。':state.level?'色卡上的实物颜色和数量，就是你要听清的线索。':'先听单词，再看看它对应哪件宝物。'}</p><button data-action="hint">💡 ${hint?'再听提示':'小提示'}</button>${hint?`<div class="counting"><p>${escape(q.hint)}</p>${id==='mathtrain'?diagram(q):''}</div>`:''}<p>一时没找到也没关系，慢慢试。</p></aside>`;
  }
  function reset(level) {stopVoice();state=C.fresh(level);state.started=true;list=C.questions(config,level,state.seed);prepareWork();hint=false;wrong=null;message='';save();render();say();}
  function requestReset(level) {
    if(!state.started||state.index===6){reset(level);return;}
    stopVoice();pending=()=>reset(level);$('dialog-title').textContent='重新出发吗？';$('dialog-text').textContent='当前这轮任务会重新开始。也可以继续完成它。';$('cancel').hidden=false;$('confirm').textContent='重新开始';$('dialog').showModal();$('cancel').focus();
  }
  let drag=null,suppressClick=0;
  function workAction(action,value){
    if(!config.kind||state.solved||state.index===6)return;
    state.work=activities.reduce(config.kind,list[state.index],state.work,action,value);
    message='可以继续调整，完成后点检查。';save();render();
    const target=[...$('activity').querySelectorAll('button[data-action]')].find(el=>el.dataset.action===action&&el.dataset.value===value&&!el.disabled);
    (target||$('activity').querySelector('[data-action="w-add"]:not(:disabled), [data-action="w-check"]:not(:disabled)'))?.focus({preventScroll:true});
  }
  $('activity').addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-action="w-add"]');
    if(!button||button.disabled||drag||!event.isPrimary)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,value:button.dataset.value,button,moved:false};button.setPointerCapture(event.pointerId);
  });
  $('activity').addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8){drag.moved=true;drag.button.classList.add('dragging');event.preventDefault();}
  });
  $('activity').addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const current=drag;drag=null;current.button.classList.remove('dragging');
    if(current.moved){suppressClick=Date.now()+400;if(document.elementFromPoint(event.clientX,event.clientY)?.closest('.assembly-target'))workAction('w-add',current.value);}
  });
  for(const name of ['pointercancel','lostpointercapture'])$('activity').addEventListener(name,event=>{if(drag&&event.pointerId===drag.id){drag.button.classList.remove('dragging');drag=null;}});
  $('activity').addEventListener('click',event=>{
    if(drag||Date.now()<suppressClick)return;
    const b=event.target.closest('button[data-action]');if(!b||b.disabled)return;
    const action=b.dataset.action,value=b.dataset.value,q=list[state.index];
    if(action==='start'||action==='again'){reset(state.level);return;}
    if(action==='sticker'){state.sticker=Number(value);save();render();$('activity').querySelector(`[data-value="${value}"]`).focus();audio.effect('collect',{volume:.15});return;}
    if(action==='listen'){say();return;}
    if(action==='explain'){say('explain');return;}
    if(action==='hint'){hint=true;render();say('hint');$('activity').querySelector('[data-action="hint"]').focus();return;}
    if(action==='next'&&state.solved){stopVoice();state.index++;state.solved=false;state.cargo=0;delete state.work;prepareWork();hint=false;wrong=null;message='';save();render();if(state.index<6){$('listen').focus();say();}else{$('finish-title').focus();audio.effect('finish',{volume:.2});}return;}
    if(state.solved||state.index===6)return;
    if(action.startsWith('w-')&&action!=='w-check'){workAction(action,value);return;}
    if(action==='cargo'){const n=state.cargo+Number(value);if(n<0||n>(state.level?100:10))return;state.cargo=n;message='货物调整好了，装好后点“发车检查”。';save();render();const target=$('activity').querySelector(`[data-action="cargo"][data-value="${value}"]`);if(!target.disabled)target.focus();return;}
    if(action==='choose'||action==='check'||action==='w-check'){
      stopVoice();const correct=action==='w-check'?activities.won(config.kind,q,state.work):action==='check'?state.cargo===q.answer:value===q.answer;
      if(correct){state.solved=true;wrong=null;message='找到答案啦！听听解释，再去下一站。';save();render();$('next-question').focus();say('explain');}
      else{wrong=value;hint=true;message=id==='mathtrain'?'还需要调整一下货物。看看提示，再数一数。':'再观察一下，看看提示，还可以继续选。';render();say('hint');const target=action==='w-check'?$('activity').querySelector('[data-action="w-check"]'):action==='check'?$('activity').querySelector('[data-action="check"]'):[...$('activity').querySelectorAll('[data-action="choose"]')].find(el=>el.dataset.value===value);target?.focus();}
    }
  });
  $('restart').onclick=()=>requestReset(state.level);
  document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{const level=Number(b.dataset.level);if(level===state.level)return;if(!state.started){state=C.fresh(level);list=C.questions(config,level,state.seed);save();render();}else requestReset(level);});
  $('help').onclick=()=>{stopVoice();pending=null;$('dialog-title').textContent='怎么玩';$('dialog-text').textContent=config.help;$('cancel').hidden=true;$('confirm').textContent='知道啦';$('dialog').showModal();$('confirm').focus();};
  $('cancel').onclick=()=>{pending=null;$('dialog').close();};$('dialog').addEventListener('cancel',()=>{pending=null;});
  $('confirm').onclick=()=>{const fn=pending;pending=null;$('dialog').close();fn?.();};
  $('sound').onclick=()=>{sound=audio.toggle();stopVoice();if(sound){audio.unlock(true);say();}try{localStorage.setItem('childgame.sound',sound?'on':'off');}catch{}audio.sync();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice();});window.addEventListener('pagehide',stopVoice);
  render();save();
})();
