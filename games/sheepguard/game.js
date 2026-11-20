(()=>{'use strict';
  const C=SheepCore,A=SheepArt,$=id=>document.getElementById(id),key='childgame.sheepguard.v1';
  let state;try{state=C.restore(JSON.parse(localStorage.getItem(key)));}catch{state=C.fresh();}
  let history=[],message='',hinted='',result=null,busy=false,timer=0,run=0;
  const voice=new Audio();voice.preload='none';voice.volume=.85;
  const audio=createGameAudio({game:'colorsort',music:false,isPlaying:()=>true,isEnabled:()=>state.sound,isPaused:()=>!!document.querySelector('dialog[open]')});
  const round=()=>state.rounds[state.mode],level=()=>C.level(state.mode,round().level);
  function save(){try{localStorage.setItem(key,JSON.stringify(state));$('save-status').textContent='进度已保存在这台设备 · 不计时，不扣分';}catch{$('save-status').textContent='可以继续玩；浏览器暂时无法保存进度';}}
  function cancel(){run++;clearTimeout(timer);timer=0;busy=false;voice.pause();GameUX.cancelNext();}
  function pos(p){const n=level().n;return `left:${(p%n+.5)*100/n}%;top:${(Math.floor(p/n)+.5)*100/n}%`;}
  function draw(){const l=level(),r=round();$('board').style.setProperty('--n',l.n);
    $('board').innerHTML=Array.from({length:l.n*l.n},(_,p)=>`<div class="cell" style="left:${p%l.n*100/l.n}%;top:${Math.floor(p/l.n)*100/l.n}%">${l.rocks.includes(p)?A.rock:p===l.pen?A.pen:`<span class="grass" aria-hidden="true">${p%4===0?'⌁':''}</span>`}</div>`).join('')+
      `<svg class="routes" viewBox="0 0 ${l.n} ${l.n}" aria-hidden="true">${(result?.ok?result.routes:result?.route?[result.route]:[]).map(route=>`<polyline class="route ${result.ok?'safe':''}" points="${route.map(p=>`${p%l.n+.5},${Math.floor(p/l.n)+.5}`).join(' ')}"/>`).join('')}</svg>`+
      l.wolves.map((p,i)=>`<div class="actor wolf" id="wolf-${i}" style="${pos(p)}" role="img" aria-label="大灰狼，第${Math.floor(p/l.n)+1}行第${p%l.n+1}列">${A.wolf}</div>`).join('')+
      l.sheep.map((p,i)=>`<div class="actor sheep" id="sheep-${i}" style="${pos(r.won&&l.pen!==null?l.pen:p)}" role="img" aria-label="小羊${i+1}">${A.sheep}</div>`).join('')+
      l.sockets.map(e=>{const [a,b]=e.split('-').map(Number),vertical=b-a===1,placed=r.fences.includes(e);return `<button class="socket ${vertical?'':'horizontal'} ${placed?'placed':''} ${hinted===e?'hinted':''}" data-edge="${e}" aria-pressed="${placed}" aria-label="${placed?'收回':'放置'}围栏：第${Math.floor(a/l.n)+1}行第${a%l.n+1}列${vertical?'右侧':'下侧'}" style="left:${((a%l.n+b%l.n)/2+.5)*100/l.n}%;top:${((Math.floor(a/l.n)+Math.floor(b/l.n))/2+.5)*100/l.n}%" ${busy?'disabled':''}></button>`;}).join('');
  }
  function render(){const l=level(),r=round();document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===state.mode));
    $('chapter').textContent=`${state.mode==='guard'?'守护':'护送'} ${String(r.level+1).padStart(2,'0')} / ${C.modes[state.mode].count}`;
    $('mission').textContent=r.won?(state.mode==='escort'?'小羊安心到家啦！':'小羊安全啦！'):l.title;
    $('instruction').textContent=state.mode==='guard'?'点虚线放围栏，堵住所有狼到羊的路。':'先隔开大灰狼，还要给每只小羊留下到羊圈的路。';
    $('budget').textContent=`${l.budget-r.fences.length} / ${l.budget}`;$('fence-stock').textContent='▥ '.repeat(l.budget-r.fences.length)||'已全部摆好';
    $('feedback').textContent=message||(r.won?'✦ 做到了！你的围栏让牧场变得很安心。':'先看看岔路在哪里。再点一次围栏，就能把它收回来。');
    $('undo').disabled=busy||!history.length;$('reset-board').disabled=busy||!r.fences.length;$('try-route').hidden=r.won;$('try-route').disabled=busy;$('try-route').textContent=busy?'正在看看路线…':'让大灰狼试试看';
    $('next').hidden=!r.won||r.level===C.modes[state.mode].count-1;
    $('reward').textContent=`★ 已守护 ${state.stars[state.mode].length} / ${C.modes[state.mode].count} 片牧场${r.won&&r.level===C.modes[state.mode].count-1?' · 最后一关也完成啦！':''}`;draw();
  }
  function edit(e){if(busy||!level().sockets.includes(e))return;cancel();const r=round();if(!r.fences.includes(e)&&r.fences.length===level().budget){message='围栏用完了。点一下已有的围栏，把它换个地方吧。';render();return;}
    history.push(r.fences.slice());r.fences=r.fences.includes(e)?r.fences.filter(x=>x!==e):[...r.fences,e];r.won=false;message='';hinted='';result=null;audio.effect('drop');save();render();$('board').querySelector(`[data-edge="${e}"]`)?.focus({preventScroll:true});
  }
  function load(mode,index){cancel();state.mode=mode;if(round().level!==index)state.rounds[mode]={level:index,fences:[],won:false};history=[];message='';hinted='';result=null;save();render();}
  function next(){if(round().won&&round().level+1<C.modes[state.mode].count)load(state.mode,round().level+1);}
  function finish(){busy=false;timer=0;const r=round();if(result.ok){r.won=true;if(!state.stars[state.mode].includes(r.level))state.stars[state.mode].push(r.level);message=state.mode==='guard'?'✦ 每条路都检查过了，所有小羊都安全！':'✦ 每只小羊都沿着安全的小路回家啦！';audio.effect('finish');save();}else{message=result.reason==='home'?'狼被隔开了，可是小羊回家的路也被堵住了。换个位置试试。':'还有一条绕过去的路！沿着橙色虚线，找找哪里需要围栏。';audio.effect('move');}render();
    if(r.won&&r.level<C.modes[state.mode].count-1){const m=state.mode,i=r.level;GameUX.queueNext({next,valid:()=>state.mode===m&&round().level===i&&round().won,button:$('next'),host:$('transition'),delay:5000,text:'守护成功，准备去下一片牧场…'});}
  }
  function trial(){if(busy)return;cancel();hinted='';result=C.check(level(),round().fences);message='正在检查每条岔路…';busy=true;render();const token=run,l=level(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tracks=result.ok&&state.mode==='escort'?result.routes.map((route,i)=>({id:`sheep-${i}`,route})):result.reason==='wolf'?[{id:`wolf-${l.wolves.indexOf(result.route[0])}`,route:result.route.slice(0,-1)}]:[];
    if(reduced||!tracks.length){finish();return;}let step=0;
    function tick(){if(token!==run)return;for(const t of tracks){const p=t.route[Math.min(step,t.route.length-1)];$(t.id).style.cssText=pos(p);}step++;if(step<=Math.max(...tracks.map(t=>t.route.length)))timer=setTimeout(tick,240);else finish();}tick();
  }
  function reset(){cancel();history=[];round().fences=[];round().won=false;message='重新想一想，星星奖励会保留。';hinted='';result=null;save();render();}
  function hint(){cancel();GameUX.closeMenu();const l=level(),r=round(),solution=C.solve(l,r.fences);if(solution){hinted=solution.find(e=>!r.fences.includes(e))||'';message=hinted?'试着在金色标记的位置放一段围栏，再观察剩下的路。':'你的围栏已经摆好了，试试看吧！';}else{const answer=C.solve(l);hinted=r.fences.find(e=>!answer.includes(e))||'';message='试着先收回金色标记的围栏，给更关键的路口留一段。';}render();}
  $('board').addEventListener('click',e=>{const b=e.target.closest('[data-edge]');if(b)edit(b.dataset.edge);});
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>load(b.dataset.mode,state.rounds[b.dataset.mode].level));
  $('undo').onclick=()=>{if(!history.length||busy)return;cancel();round().fences=history.pop();round().won=false;message='已经退回上一步。';hinted='';result=null;save();render();};
  $('reset-board').onclick=reset;$('restart').onclick=()=>{GameUX.closeMenu();reset();};$('hint').onclick=hint;$('try-route').onclick=trial;$('next').onclick=next;
  $('sound').onclick=()=>{state.sound=audio.toggle()?true:!state.sound;if(!state.sound)voice.pause();audio.sync();save();};
  $('listen').onclick=()=>{suspend();render();if(!state.sound){message='声音已关闭，可以在“更多”里打开。';render();return;}voice.src=`../../assets/audio/sheepguard/${state.mode}.mp3`;voice.play().catch(()=>{message='暂时无法播放，看看右侧的玩法说明吧。';render();});};
  function open(id){cancel();render();GameUX.closeMenu();$(id).showModal();audio.sync();}
  $('help').onclick=()=>open('help-dialog');$('choose-level').onclick=()=>{const m=state.mode;$('level-grid').innerHTML=C.levels[m].map((l,i)=>`<button data-index="${i}" class="${state.stars[m].includes(i)?'complete':''} ${round().level===i?'current':''}" aria-label="第${i+1}关 ${l.title}${state.stars[m].includes(i)?' 已完成':''}">${state.stars[m].includes(i)?'★':'○'} ${i+1}</button>`).join('');open('level-dialog');};
  $('level-grid').onclick=e=>{const b=e.target.closest('[data-index]');if(b){$('level-dialog').close();load(state.mode,Number(b.dataset.index));}};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>audio.sync()));
  function suspend(){const wasBusy=busy;cancel();if(wasBusy){result=null;message='路线演示已暂停。准备好后，再试试看。';render();}}
  GameUX.configure({suspend,resume:()=>audio.sync()});document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});window.addEventListener('pagehide',suspend);window.addEventListener('blur',suspend);
  // A cancelled or second touch must never turn into an extra fence placement.
  let primary=null,blockedClick=false;const rejected=new Set(),board=$('board');board.addEventListener('pointerdown',e=>{if(!e.isPrimary||primary!==null){rejected.add(e.pointerId);e.preventDefault();return;}primary=e.pointerId;blockedClick=false;});
  board.addEventListener('pointercancel',e=>{if(primary===e.pointerId){primary=null;blockedClick=true;}rejected.delete(e.pointerId);});window.addEventListener('pointerup',e=>{if(primary===e.pointerId)primary=null;});board.addEventListener('click',e=>{if((blockedClick&&e.detail!==0)||rejected.has(e.pointerId)){e.stopImmediatePropagation();blockedClick=false;rejected.delete(e.pointerId);}},true);
  window.SheepGame={snapshot:()=>JSON.parse(JSON.stringify(state)),effects:()=>({busy,timer:!!timer})};render();save();audio.sync();
})();
