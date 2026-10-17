'use strict';
window.Learning={
  icon(id,cls=''){const item=window.BookArt?.catalog[id];return item?`<span class="art ${cls}">${BookArt.icon(item)}</span>`:`<span class="emoji ${cls}" aria-hidden="true">${id==='bamboo'?'🎋':id}</span>`;},
  boot(config){
    const $=id=>document.getElementById(id),key='childgame.learning.'+config.id+'.v1';
    let level=0,seed=Math.floor(Math.random()*1000000000),actions=[],model,timers=[],sound=true,dialogAction=null;
    try{sound=localStorage.getItem('childgame.sound')!=='off';const saved=JSON.parse(localStorage.getItem(key));if(saved&&Number.isInteger(saved.level)&&saved.level>=0&&saved.level<3&&Number.isInteger(saved.seed)&&saved.seed>=0&&saved.seed<1000000000&&Array.isArray(saved.actions)&&saved.actions.length<=4096){level=saved.level;seed=saved.seed;actions=saved.actions.filter(a=>a&&typeof a.type==='string'&&a.type.length<30);}}catch(_){}
    function replay(){model=config.create(level,seed);for(const action of actions)config.reduce(model,action,level,seed);}
    try{replay();}catch(_){actions=[];replay();}
    const audio=createGameAudio({game:config.id,music:false,isEnabled:()=>sound,isPlaying:()=>true,isPaused:()=>$('dialog').open});
    const app={get model(){return model;},get level(){return level;},get seed(){return seed;},get sound(){return sound;},busy:false,suppressClick:0,transient:{},
      say(text){$('feedback').textContent=text;},effect(name='move'){audio.effect(name,{volume:.25});},
      later(fn,ms){const t=setTimeout(()=>{timers=timers.filter(x=>x!==t);fn();},ms);timers.push(t);return t;},
      cancel(){for(const t of timers)clearTimeout(t);timers=[];app.busy=false;app.transient={};app.onCancel?.();config.stop?.(app);},
      dispatch(type,value){if(actions.length>=4096){app.say('这一关已经尝试了很多次，可以换一关继续玩。');return;}const action={type,value};const before=JSON.stringify(model);config.reduce(model,action,level,seed);if(before===JSON.stringify(model)){app.cancel();render();return;}app.cancel();actions.push(action);save();render();app.effect(config.won(model,level)?'finish':'move');},
      render,confirm(title,text,fn){app.cancel();render();dialogAction=fn;$('dialog-title').textContent=title;$('dialog-text').textContent=text;$('cancel').hidden=!fn;$('confirm').textContent=fn?'确定':'知道啦';$('dialog').showModal();(fn?$('cancel'):$('confirm')).focus();}
    };
    function save(){try{localStorage.setItem(key,JSON.stringify({level,seed,actions}));$('save-status').textContent='进度已保存 · 随时可以休息';}catch(_){$('save-status').textContent='暂时无法保存，请先不要关闭页面';}}
    function render(){
      $('activity').innerHTML=config.render(model,level,app);$('activity').className='activity '+config.id;
      $('level-label').textContent=(config.levels||['轻松入门','动脑练习','进阶挑战'])[level];
      document.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.level)===level)));
      $('undo').disabled=!actions.length;$('success').hidden=!config.won(model,level);$('next').textContent=level<2?'试试下一档':'再玩一关';
      $('feedback').textContent=model.message||config.intro;config.afterRender?.(app);
    }
    function reset(nextLevel){app.cancel();level=nextLevel;seed=Math.floor(Math.random()*1000000000);actions=[];replay();save();render();}
    function requestReset(nextLevel){if(actions.length&&!config.won(model,level))app.confirm('换一关吗？','当前这一关会重新开始。也可以继续完成它。',()=>reset(nextLevel));else reset(nextLevel);}
    $('restart').onclick=()=>requestReset(level);$('next').onclick=()=>reset(Math.min(2,level+1));
    $('undo').onclick=()=>{if(!actions.length)return;app.cancel();actions.pop();replay();save();render();};
    $('help').onclick=()=>app.confirm('怎么玩',config.help,null);
    $('sound').onclick=()=>{sound=audio.toggle();if(sound)audio.unlock(true);else{app.cancel();render();}try{localStorage.setItem('childgame.sound',sound?'on':'off');}catch(_){}audio.sync();};
    document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.level);if(n!==level)requestReset(n);});
    $('cancel').onclick=()=>$('dialog').close();$('confirm').onclick=()=>{const fn=dialogAction;dialogAction=null;$('dialog').close();fn?.();};
    $('activity').addEventListener('click',e=>{if(Date.now()<app.suppressClick&&e.target===$('activity'))return;const b=e.target.closest('[data-action]');if(!b||b.disabled||app.busy&&b.dataset.action!=='stop')return;const type=b.dataset.action,value=b.dataset.value;if(config.action)config.action(app,type,value,e);else app.dispatch(type,value);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){app.cancel();}else render();});window.addEventListener('pagehide',()=>app.cancel());
    config.install?.(app);window.LearningApp=app;render();save();
  }
};
