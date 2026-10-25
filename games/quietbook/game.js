"use strict";
(() => {
  const A = window.BookArt, $ = id => document.getElementById(id);
  const KEY = 'childgame.quietbook.v1', slots = ['top','bottom','shoes','hat','accessory'];
  const categories = {wardrobe:slots, dining:['food','drink','plate'], home:['toy','decor','blanket']};
  const labels = {top:'衣服',bottom:'裙裤',shoes:'鞋子',hat:'头饰',accessory:'配饰',food:'食物',drink:'饮料',plate:'餐盘',toy:'玩具',decor:'摆设',blanket:'被子'};
  const fresh = () => ({version:1,theme:'garden',actor:0,scene:'wardrobe',looks:{},rooms:{wardrobe:[],dining:[],home:[]},pose:'stand',light:true});
  const clamp = (n,a,b) => Math.max(a,Math.min(b,Number(n)||a));
  let state = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if(saved?.version === 1) {
      if(Object.hasOwn(A.themes,saved.theme))state.theme=saved.theme;
      if(Object.hasOwn(categories,saved.scene))state.scene=saved.scene;
      state.actor=saved.actor===1?1:0; state.light=saved.light!==false;
      if(['stand','sit','sleep'].includes(saved.pose))state.pose=saved.pose;
      for(const theme of Object.keys(A.themes))for(let i=0;i<2;i++) {
        const key=theme+':'+i, look=saved.looks?.[key];
        if(!look)continue;
        state.looks[key]={hair:clamp(Math.floor(look.hair),0,2),face:clamp(Math.floor(look.face),0,2),slots:{}};
        for(const slot of slots)if(A.catalog[look.slots?.[slot]]?.type===slot)state.looks[key].slots[slot]=look.slots[slot];
        if(A.catalog[state.looks[key].slots.top]?.dress)delete state.looks[key].slots.bottom;
      }
      for(const room of Object.keys(categories))if(Array.isArray(saved.rooms?.[room]))state.rooms[room]=saved.rooms[room].filter(x=>x&&Object.hasOwn(A.catalog,x.id)&&!slots.includes(A.catalog[x.id].type)).slice(0,60).map((x,i)=>({uid:'saved-'+room+i,id:x.id,x:clamp(x.x,60,940),y:clamp(x.y,60,590),bites:clamp(x.bites,1,3)}));
    }
  } catch (_) {}
  let category=categories[state.scene][0], picked=null, selected=null, drag=null, chewing=false, eatTimer, trayPage=0;
  const history=[],markupKeys=new Map(),shapes=new Map(),icons=new Map(),stickerNodes=new Map();
  let dragFrame=0;
  const shape=id=>{if(!shapes.has(id))shapes.set(id,A.shape(A.catalog[id]));return shapes.get(id);};
  const icon=item=>{if(!icons.has(item.id))icons.set(item.id,A.icon(item));return icons.get(item.id);};
  function markup(id,key,build){if(markupKeys.get(id)===key)return;$(id).innerHTML=build();markupKeys.set(id,key);}
  function attribute(el,name,value){if(el.getAttribute(name)!==value)el.setAttribute(name,value);}
  let soundOn=true;
  try{soundOn=localStorage.getItem('childgame.sound')!=='off';}catch(_){}
  const audio=createGameAudio({game:'quietbook',music:false,isPlaying:()=>true,isEnabled:()=>soundOn});
  const look=()=>state.looks[state.theme+':'+state.actor] ||= {hair:0,face:0,slots:{top:A.themes[state.theme].tops[state.actor]}};
  const room=()=>state.rooms[state.scene];
  const hint=text=>{$('hint').textContent=text;};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('save-status').textContent='搭配已自动保存';}catch(_){$('save-status').textContent='本次可玩，存档空间不足';}}
  function change(fn,sound='drop'){history.push(JSON.stringify(state));if(history.length>30)history.shift();fn();render();save();audio.effect(sound,{volume:.28});}
  function equip(id){
    const item=A.catalog[id];picked=null;selected={slot:item.type};
    change(()=>{
      const outfit=look().slots;outfit[item.type]=id;
      if(item.dress)delete outfit.bottom;
      if(item.type==='bottom'&&A.catalog[outfit.top]?.dress)outfit.top='cream-shirt';
    },'rotate');
    hint(`已换上${item.name}，原来的同类衣物已收起。`);
  }
  function choose(id){if(slots.includes(A.catalog[id].type)){equip(id);return;}picked=id;selected=null;render();hint('选好了，再点角色或场景就能放下。');}
  function actorTransform(){if(state.scene==='wardrobe')return 'translate(420 165) scale(1.2)';if(state.scene==='dining')return 'translate(145 155) scale(1.1)';if(state.pose==='sleep')return 'translate(620 300) rotate(75 110 170) scale(.85)';if(state.pose==='sit')return 'translate(150 200)';return 'translate(390 190) scale(1.1)';}
  function sticker(x,ghost=false){const item=A.catalog[x.id],w=item.width||95;return `<g ${ghost?'class="drag-ghost"':`class="sticker" data-uid="${x.uid}"`} transform="translate(${x.x-w/2} ${x.y-w/2}) scale(${w/100})"><rect width="100" height="100" fill="transparent"/>${shape(x.id)}${!ghost&&selected?.uid===x.uid?'<rect class="selected-ring" x="0" y="0" width="100" height="100" rx="15"/>':''}${x.bites&&x.bites<3?`<text x="80" y="96" fill="#655344" font-size="16">${x.bites}</text>`:''}</g>`;}
  function drawStickers(){
    const parent=$('stickers'),items=[...room()].sort((a,b)=>(['plate','rug'].includes(A.catalog[b.id].shape)?1:0)-(['plate','rug'].includes(A.catalog[a.id].shape)?1:0)),alive=new Set();
    items.forEach((x,i)=>{alive.add(x.uid);let entry=stickerNodes.get(x.uid);if(!entry){const el=document.createElementNS('http://www.w3.org/2000/svg','g');el.setAttribute('class','sticker');el.dataset.uid=x.uid;entry={el,key:''};stickerNodes.set(x.uid,entry);}
      const key=x.id+':'+x.bites+':'+(selected?.uid===x.uid);if(entry.key!==key){const svg=sticker(x);entry.el.innerHTML=svg.slice(svg.indexOf('>')+1,-4);entry.key=key;}
      const w=A.catalog[x.id].width||95;attribute(entry.el,'transform',`translate(${x.x-w/2} ${x.y-w/2}) scale(${w/100})`);
      if(parent.children[i]!==entry.el)parent.insertBefore(entry.el,parent.children[i]||null);
    });
    for(const [uid,entry]of stickerNodes)if(!alive.has(uid)){entry.el.remove();stickerNodes.delete(uid);}
  }
  function drawActor(){
    attribute($('actor'),'transform',actorTransform());markup('actor',JSON.stringify([state.theme,state.actor,look(),state.pose,state.scene,chewing]),()=>A.character(state.theme,state.actor,look(),state.pose==='sit'&&state.scene==='home'?'sit':'stand',chewing));
    $('actor').querySelectorAll('.selected-clothing').forEach(el=>el.classList.remove('selected-clothing'));
    if(selected?.slot)$('actor').querySelector(`[data-slot="${selected.slot}"]`)?.classList.add('selected-clothing');
  }
  function render(){
    document.body.dataset.theme=state.theme;
    for(const key of ['theme','scene'])document.querySelectorAll(`button[data-${key}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===state[key])));
    markup('backdrop',state.scene+':'+state.theme,()=>A.background(state.scene,state.theme));
    drawActor();
    drawStickers();
    markup('night',state.scene+':'+state.light,()=>state.scene==='home'&&!state.light?'<rect width="1000" height="650" fill="#253652" opacity=".28" pointer-events="none"/>':'');
    markup('characters',state.theme+':'+state.actor,()=>A.themes[state.theme].names.map((name,i)=>`<button type="button" data-actor="${i}" aria-pressed="${i===state.actor}">${name}</button>`).join(''));
    const items=A.items.filter(x=>x.type===category), pageSize=innerWidth<=600?4:6, pageCount=Math.ceil(items.length/pageSize);
    trayPage%=pageCount;
    markup('categories',`${state.scene}:${category}:${trayPage}:${pageCount}`,()=>categories[state.scene].map(c=>`<button type="button" data-category="${c}" aria-pressed="${c===category}">${labels[c]}</button>`).join('')+(pageCount>1?`<button type="button" data-more="true" aria-label="下一组贴纸">更多 ${trayPage+1}/${pageCount} ›</button>`:''));
    markup('tray',JSON.stringify([category,trayPage,pageSize,picked,look().slots]),()=>items.slice(trayPage*pageSize,(trayPage+1)*pageSize).map(x=>`<button type="button" class="item" data-item="${x.id}" aria-pressed="${picked===x.id||look().slots[x.type]===x.id}">${icon(x)}<span>${x.name}</span></button>`).join(''));
    $('item-count').textContent=items.length+' 件';
    $('pose').hidden=$('light').hidden=state.scene!=='home';
    $('pose').textContent={stand:'坐一坐',sit:'躺下来',sleep:'站起来'}[state.pose];$('light').textContent=state.light?'关灯':'开灯';
    $('undo').disabled=!history.length;$('remove').disabled=!selected;
    $('scene-note').textContent={wardrobe:'点衣服直接换装，也可以拖到角色身上',dining:'摆好餐盘，把食物送到嘴边',home:'摆玩具、盖被子，创造自己的小屋'}[state.scene];
  }
  function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform($('scene').getScreenCTM().inverse());}
  function actorPoint(p){return new DOMPoint(p.x,p.y).matrixTransform($('actor').getCTM().inverse().multiply($('scene').getCTM()));}
  function drop(id,p,uid){
    if(p.x<0||p.x>1000||p.y<0||p.y>650){hint('移出书页了，再试一次吧。');return;}
    const item=A.catalog[id],local=actorPoint(p);
    if(slots.includes(item.type)){
      if(local.x < -35 || local.x >255 || local.y < -40 || local.y >380){hint('把衣服放到角色身上哦。');return;}
      equip(id);return;
    }
    if(['food','drink'].includes(item.type)&&Math.hypot(local.x-110,local.y-115)<70){
      picked=null;selected=null;change(()=>{if(uid){const entry=room().find(x=>x.uid===uid);if(--entry.bites<=0)state.rooms[state.scene]=room().filter(x=>x.uid!==uid);}},'collect');
      chewing=true;drawActor();$('actor').classList.add('eating');clearTimeout(eatTimer);eatTimer=setTimeout(()=>{chewing=false;$('actor').classList.remove('eating');drawActor();},700);hint('啊呜，好好吃！');return;
    }
    if(!uid&&room().length>=60){hint('这页已经很热闹啦，先收起一些贴纸吧。');return;}
    let x=clamp(p.x,60,940),y=clamp(p.y,60,590);
    if(['food','drink'].includes(item.type)){const plate=room().find(s=>A.catalog[s.id].type==='plate'&&Math.hypot(s.x-x,s.y-y)<85);if(plate){x=plate.x;y=plate.y-12;}}
    picked=null;change(()=>{let entry=room().find(s=>s.uid===uid);if(entry)Object.assign(entry,{x,y});else{entry={uid:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),id,x,y,bites:3};room().push(entry);}selected={uid:entry.uid};});hint('摆好啦！点选后可以收回，拖动可以换位置。');
  }
  function cancel(){cancelAnimationFrame(dragFrame);dragFrame=0;if(!drag)return;const old=drag;drag=null;$('drag-layer').replaceChildren();if(old.capture.hasPointerCapture?.(old.pointer))old.capture.releasePointerCapture(old.pointer);}
  function drawDrag(){dragFrame=0;if(!drag?.moved||!drag.id)return;const p=new DOMPoint(drag.clientX,drag.clientY).matrixTransform(drag.matrix),w=A.catalog[drag.id].width||95;if(!drag.ghost){$('drag-layer').innerHTML=sticker({id:drag.id,x:0,y:0},true);drag.ghost=$('drag-layer').firstElementChild;}drag.ghost.setAttribute('transform',`translate(${p.x+drag.offset.x-w/2} ${p.y+drag.offset.y-w/2}) scale(${w/100})`);}
  function start(e){
    if(drag||e.isPrimary===false||e.button!==0||!$('confirm').hidden)return;
    const palette=e.target.closest('[data-item]'),entry=e.target.closest('[data-uid]');
    if(!palette&&!e.target.closest('#scene'))return;
    const p=point(e),existing=entry&&room().find(x=>x.uid===entry.dataset.uid);
    drag={pointer:e.pointerId,capture:palette||$('scene'),id:palette?.dataset.item||existing?.id,uid:existing?.uid,startX:e.clientX,startY:e.clientY,matrix:$('scene').getScreenCTM().inverse(),offset:existing?{x:existing.x-p.x,y:existing.y-p.y}:{x:0,y:0},moved:false,palette:!!palette,target:e.target};
    drag.capture.setPointerCapture(e.pointerId);e.preventDefault();
  }
  document.addEventListener('pointerdown',start);
  document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8)drag.moved=true;drag.clientX=e.clientX;drag.clientY=e.clientY;if(drag.moved&&drag.id&&!dragFrame)dragFrame=requestAnimationFrame(drawDrag);});
  document.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;const d=drag,p=point(e);cancel();
    if(d.moved){if(d.id)drop(d.id,{x:p.x+d.offset.x,y:p.y+d.offset.y},d.uid);return;}
    if(d.palette){choose(d.id);return;}
    if(picked){drop(picked,p);return;}
    selected=d.uid?{uid:d.uid}:d.target.closest('[data-slot]')?{slot:d.target.closest('[data-slot]').dataset.slot}:null;render();
  });
  document.addEventListener('pointercancel',e=>{if(drag?.pointer===e.pointerId)cancel();});
  document.addEventListener('lostpointercapture',e=>{if(drag?.pointer===e.pointerId)cancel();});
  window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  function navigate(fn){cancel();trayPage=0;picked=selected=null;change(fn,'move');}
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.theme)navigate(()=>state.theme=b.dataset.theme);
    if(b.dataset.scene)navigate(()=>{state.scene=b.dataset.scene;category=categories[state.scene][0];});
    if(b.dataset.actor)navigate(()=>state.actor=Number(b.dataset.actor));
    if(b.dataset.category){trayPage=0;picked=selected=null;category=b.dataset.category;render();}
    if(b.dataset.more){trayPage++;render();}
    if(b.dataset.item&&e.detail===0)choose(b.dataset.item);
    if(b.dataset.preset){navigate(()=>{
      const preset=b.dataset.preset;
      if(preset==='day'){state.scene='wardrobe';look().slots={top:A.themes[state.theme].tops[state.actor],hat:{garden:'leaf-hat',fairy:'heart-hat',snow:'ice-hat'}[state.theme],shoes:'shoes-0',accessory:'bag-pink'};}
      else{state.scene=preset==='picnic'?'dining':'home';const content=preset==='picnic'?[['plate-0',530,420],['plate-1',750,420],['cake',530,405],['apple',750,405],['drink-0',840,370]]:[['blanket-2',695,450],['teddy',560,480],['books',300,500]];state.rooms[state.scene]=content.map(([id,x,y],i)=>({uid:'preset-'+i,id,x,y,bites:3}));if(preset==='night'){state.pose='sleep';state.light=false;}}
      category=categories[state.scene][0];
    });hint('场景准备好啦，接下来由你自由搭配。');}
  });
  $('hair').onclick=()=>change(()=>look().hair=(look().hair+1)%3,'rotate');
  $('face').onclick=()=>change(()=>look().face=(look().face+1)%3,'rotate');
  $('pose').onclick=()=>change(()=>state.pose={stand:'sit',sit:'sleep',sleep:'stand'}[state.pose]);
  $('light').onclick=()=>change(()=>state.light=!state.light,'move');
  $('sound').onclick=()=>{soundOn=audio.toggle();if(soundOn)audio.unlock(true);try{localStorage.setItem('childgame.sound',soundOn?'on':'off');}catch(_){}audio.sync();};
  $('undo').onclick=()=>{cancel();if(!history.length)return;state=JSON.parse(history.pop());category=categories[state.scene][0];picked=selected=null;render();save();hint('回到上一步啦。');};
  $('remove').onclick=()=>{if(!selected)return;change(()=>{if(selected.uid)state.rooms[state.scene]=room().filter(x=>x.uid!==selected.uid);else delete look().slots[selected.slot];selected=null;});};
  function closeDialog(){$('confirm').hidden=true;$('clear').focus();}
  $('clear').onclick=()=>{cancel();$('confirm').hidden=false;$('cancel-clear').focus();};
  $('cancel-clear').onclick=closeDialog;
  $('confirm-clear').onclick=()=>{change(()=>{state.rooms[state.scene]=[];if(state.scene==='wardrobe')look().slots={};selected=picked=null;});closeDialog();};
  document.addEventListener('keydown',e=>{if($('confirm').hidden)return;if(e.key==='Escape')closeDialog();if(e.key==='Tab'){e.preventDefault();(document.activeElement===$('cancel-clear')?$('confirm-clear'):$('cancel-clear')).focus();}});
  window.addEventListener('resize',()=>{cancel();render();});
  render();
})();
