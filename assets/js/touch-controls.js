'use strict';
/* Independent pointer ownership: either thumb may touch first. No polling or layout per frame. */
(() => {
  window.createTouchControls = function ({mount, axis = 'four', label = '移动', onMove = () => {}, onAction = () => {}}) {
    const root = document.createElement('div'); root.className = 'touch-controls';
    const left = document.createElement('div'), right = document.createElement('div');
    left.className = 'touch-left'; right.className = 'touch-right'; root.append(left, right); mount.append(root);
    const pointers = new Map(), buttons = new Map(), timers = new Set();
    let enabled = true, stickId = null, stickBounds = null, vector = {x:0,y:0}, last = '', resetting = false;
    let stick, knob;
    function publish() {
      let {x,y} = vector;
      for (const p of pointers.values()) if (p.direction) {x += p.direction.x; y += p.direction.y;}
      x = Math.max(-1, Math.min(1,x)); y = Math.max(-1,Math.min(1,y));
      if (axis === 'horizontal') y = 0;
      if (axis === 'four' && x && y) {if (Math.abs(x) >= Math.abs(y)) y = 0; else x = 0;}
      const keys = []; if(x<0) keys.push('left'); if(x>0) keys.push('right'); if(y<0) keys.push('up'); if(y>0) keys.push('down');
      const signature = `${x.toFixed(3)},${y.toFixed(3)}`;
      if (signature !== last) {last = signature; onMove({x,y,keys});}
      if(stick) {stick.dataset.direction = keys.join(' '); stick.classList.toggle('held', keys.length > 0);}
    }
    const directions = {left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}};
    const captions = {left:'←',right:'→',up:'↑',down:'↓'};
    function capture(element,id) {try {element.setPointerCapture(id);} catch {}}
    function paintButton(button) {button.classList.toggle('held', [...pointers.values()].some(p=>p.button===button));}
    function pressButton(e,button,direction) {
      if(!enabled || button.disabled || e.button!==0 || pointers.has(e.pointerId)) return;
      e.preventDefault(); const source = `touch:${e.pointerId}`;
      pointers.set(e.pointerId,{button,direction,id:button.dataset.action,source}); capture(button,e.pointerId);paintButton(button);
      if(direction) publish(); else onAction(button.dataset.action,true,source);
    }
    function release(e) {
      const p = pointers.get(e.pointerId); if(!p) return;
      pointers.delete(e.pointerId);
      const target=p.stick?stick:p.button;try{if(target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId);}catch{}
      if(p.stick) {stickId=null;vector={x:0,y:0};knob.style.transform='translate(0px,0px)';publish();}
      else {paintButton(p.button);if(p.direction) publish(); else onAction(p.id,false,p.source);}
    }
    function bindButton(button,direction) {
      button.addEventListener('pointerdown',e=>pressButton(e,button,direction));
      button.addEventListener('click',e=>{e.preventDefault();if(e.detail!==0||!enabled||button.disabled) return;
        if(direction){const p={pointerId:-1,button:0,preventDefault(){}};pressButton(p,button,direction);release(p);}
        else {onAction(button.dataset.action,true,'accessible');onAction(button.dataset.action,false,'accessible');}
      });
    }
    if(axis) {
      stick=document.createElement('div');stick.className='touch-stick';stick.dataset.touchStick='';stick.setAttribute('aria-label',label+'摇杆');
      knob=document.createElement('span');knob.className='touch-knob';knob.setAttribute('aria-hidden','true');
      const pad=document.createElement('span');pad.className='touch-stick-base';pad.setAttribute('aria-hidden','true');stick.append(pad,knob);
      for(const id of axis==='horizontal'?['left','right']:['left','right','up','down']) {
        const b=document.createElement('button');b.type='button';b.className=`touch-direction touch-${id}`;b.dataset.action=id;b.textContent=captions[id];b.setAttribute('aria-label',({left:'向左',right:'向右',up:'向上',down:'向下'})[id]);
        // Pointer input anywhere on the pad drags the same stick. Buttons remain keyboard accessible.
        b.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&enabled){const p={pointerId:-1-Object.keys(directions).indexOf(id),button:0,preventDefault(){}};pressButton(p,b,directions[id]);const timer=setTimeout(()=>{timers.delete(timer);release(p);},120);timers.add(timer);}});stick.append(b);
      }
      const caption=document.createElement('span');caption.className='touch-caption';caption.textContent=`拖动${label}`;left.append(stick,caption);
      function move(e) {
        if(e.pointerId!==stickId)return;e.preventDefault();
        const r=stickBounds, radius=r.width*.29;let x=(e.clientX-r.x-r.width/2)/radius,y=(e.clientY-r.y-r.height/2)/radius;
        if(axis==='horizontal')y=0;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
        knob.style.transform=`translate(${x*radius}px,${y*radius}px)`;
        if(length<.19) vector={x:0,y:0};
        else if(axis==='free')vector={x,y};
        else if(axis==='horizontal'||Math.abs(x)>=Math.abs(y))vector={x:Math.sign(x),y:0};else vector={x:0,y:Math.sign(y)};
        publish();
      }
      stick.addEventListener('pointerdown',e=>{if(!enabled||stickId!==null||e.button!==0)return;e.preventDefault();stickId=e.pointerId;stickBounds=stick.getBoundingClientRect();pointers.set(e.pointerId,{stick:true});capture(stick,e.pointerId);move(e);});
      stick.addEventListener('pointermove',move);
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,release);
    root.addEventListener('contextmenu',e=>e.preventDefault());
    function reset() {if(resetting)return;resetting=true;for(const timer of timers)clearTimeout(timer);timers.clear();for(const id of [...pointers.keys()])release({pointerId:id});vector={x:0,y:0};publish();resetting=false;}
    function setActions(config=[]) {
      const wanted=new Set(config.map(c=>c.id));
      for(const [id,b] of buttons)if(!wanted.has(id)){for(const [pid,p]of pointers)if(p.button===b)release({pointerId:pid});b.remove();buttons.delete(id);}
      for(const c of config){let b=buttons.get(c.id);if(!b){b=document.createElement('button');b.type='button';b.dataset.action=c.id;bindButton(b);buttons.set(c.id,b);}
        b.className='touch-action'+(c.primary?' touch-primary':'')+(c.active?' on':'')+(pointers.size&&[...pointers.values()].some(p=>p.button===b)?' held':'');
        if(b.textContent!==c.label)b.textContent=c.label;b.dataset.hold=c.hold?'1':'0';b.disabled=!enabled||!!c.disabled;b.dataset.unavailable=c.disabled?'1':'0';b.setAttribute('aria-pressed',String(!!c.active));
        const side=c.side==='left'?left:right;if(b.parentNode!==side)side.append(b);
        if(b.disabled)for(const [pid,p]of pointers)if(p.button===b)release({pointerId:pid});
      }
    }
    function setEnabled(value){value=!!value;if(enabled===value)return;enabled=value;if(!value)reset();root.classList.toggle('disabled',!enabled);if(stick){stick.setAttribute('aria-disabled',String(!enabled));stick.querySelectorAll('button').forEach(b=>b.disabled=!enabled);}for(const b of buttons.values())b.disabled=!enabled||b.dataset.unavailable==='1';}
    const onHidden=()=>{if(document.hidden)reset();};
    window.addEventListener('blur',reset);window.addEventListener('resize',reset);document.addEventListener('visibilitychange',onHidden);
    return {element:root,setActions,setEnabled,reset,state:()=>({enabled,x:vector.x,y:vector.y,pointers:pointers.size}),destroy(){reset();window.removeEventListener('blur',reset);window.removeEventListener('resize',reset);document.removeEventListener('visibilitychange',onHidden);root.remove();}};
  };
})();
