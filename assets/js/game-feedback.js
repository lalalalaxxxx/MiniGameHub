/* Short, event-driven feedback. Saved game state never waits for an animation. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set();
  let layer;
  const rules=[
    ['.tile .tile-face','drop'],['.plot .plant','grow'],['.scoop','drop'],['.topping','drop'],['.order-card','enter'],
    ['.memory-face','flip'],['.pipe-grid button svg','pipe'],['.tray button','drop'],['.carriage','enter'],
    ['.spotlight','reveal'],['.program button','drop'],['[data-fx-key]','move'],
    ['.assembly-slot button','drop'],['.plate-food','drop'],['.shopping-bag p','drop'],['.cargo','drop'],
    ['.choice.correct','grow'],['.answer-note','enter'],['.clock-bear','grow'],
    ['[data-clock-angle]','clock'],['.piece-tray polygon','turn'],['#puzzle-scene .slot polygon','grow']
  ];
  function elements(root){const map=new Map();for(const [selector,kind] of rules)root.querySelectorAll(selector).forEach((el,i)=>{
    const key=el.dataset.fxKey||`${selector}:${el.closest('[data-value]')?.dataset.value??i}`;
    map.set(key,{el,kind});
  });return map;}
  function capture(root){const out=new Map();for(const [key,{el,kind}] of elements(root)){
    const r=el.getBoundingClientRect();out.set(key,{kind,angle:Number(el.dataset.clockAngle),mask:el.dataset.pipeMask,html:el.innerHTML,signature:signature(el),rect:{x:r.x,y:r.y,width:r.width,height:r.height},font:getComputedStyle(el).font,el:el.cloneNode(true)});
  }return out;}
  function signature(el){return [el.innerHTML,el.getAttribute('transform'),el.getAttribute('style'),el.getAttribute('fill')].join('|');}
  function animate(el,frames,options={}){
    if(!el||reduced.matches||document.hidden||!el.animate)return;
    if(running.size>=96)clear();
    const a=el.animate(frames,{duration:360,easing:'cubic-bezier(.2,.8,.3,1)',...options});running.add(a);
    a.finished.catch(()=>{}).finally(()=>running.delete(a));return a;
  }
  function clear(){for(const a of running)a.cancel();running.clear();layer?.replaceChildren();}
  function overlay(){if(!layer){layer=document.createElement('div');layer.id='game-fx-layer';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:30;contain:strict';document.body.append(layer);}return layer;}
  function ghost(old,flip=false){
    if(reduced.matches||document.hidden||!old.rect.width)return;
    const el=document.createElement('div'),r=old.rect;
    el.style.cssText=`position:absolute;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;display:grid;place-items:center;font:${old.font};pointer-events:none`;
    const clone=old.el;clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.style.width='100%';clone.style.height='100%';el.append(clone);overlay().append(el);
    const a=animate(el,flip?[{transform:'perspective(500px) rotateY(0deg)',opacity:1},{transform:'perspective(500px) rotateY(90deg)',opacity:0}]:[{transform:'scale(1)',opacity:1},{transform:'translateY(-18px) scale(.2)',opacity:0}],{duration:flip?120:260});
    if(a)a.finished.catch(()=>{}).finally(()=>el.remove());else el.remove();
  }
  function update(before,root){
    if(!before.size||reduced.matches||document.hidden)return;
    const next=elements(root);let index=0;
    for(const [key,{el,kind}]of next){const old=before.get(key),r=el.getBoundingClientRect(),changed=!old||old.signature!==signature(el);
      if(kind==='move'&&old){const dx=old.rect.x-r.x,dy=old.rect.y-r.y;if(Math.abs(dx)+Math.abs(dy)>1)animate(el,[{translate:`${dx}px ${dy}px`},{translate:'0px 0px'}],{duration:230,easing:'linear'});else if(changed)animate(el,[{rotate:'-9deg'},{rotate:'0deg'}]);continue;}
      if(!changed)continue;
      el.dataset.fxEvent=kind;
      if(kind==='clock'&&old){const end=Number(el.dataset.clockAngle),delta=((end-old.angle+540)%360)-180;animate(el,[{transform:`rotate(${end-delta}deg)`},{transform:`rotate(${end}deg)`}],{duration:280});}
      else if(kind==='turn'){const end=Number(el.getAttribute('transform')?.match(/-?\d+/)?.[0]||0);animate(el,[{transform:`rotate(${end-45}deg)`},{transform:`rotate(${end}deg)`}],{duration:250});}
      else if(kind==='flip'){
        if(old)ghost(old,true);
        animate(el,[{transform:'perspective(500px) rotateY(-90deg)',opacity:0},{transform:'perspective(500px) rotateY(0deg)',opacity:1}],{delay:old?110:0,duration:180,fill:'backwards'});
      }else if(kind==='pipe')animate(el,old?.mask!==el.dataset.pipeMask?[{transform:'rotate(-90deg)'},{transform:'rotate(0deg)'}]:[{opacity:.3},{opacity:1}],{duration:240});
      else if(kind==='drop'){if(old&&key.startsWith('.tile'))ghost(old);animate(el,[{transform:'translateY(-28px) scale(.65)',opacity:.2},{transform:'translateY(3px) scale(1.06)',opacity:1,offset:.72},{transform:'translateY(0) scale(1)',opacity:1}],{delay:Math.min(index++*12,120),fill:'backwards'});}
      else animate(el,[{transform:kind==='enter'?'translateX(18px)':'scale(.85)',opacity:.4},{transform:'translateX(0) scale(1)',opacity:1}]);
    }
  }
  function pulse(el,success=true){animate(el,success?[{scale:'1'},{scale:'1.08',offset:.4},{scale:'1'}]:[{translate:'0px 0px'},{translate:'-5px 0px',offset:.25},{translate:'5px 0px',offset:.6},{translate:'0px 0px'}]);}
  function celebrate(el){if(!el||reduced.matches||document.hidden)return;const r=el.getBoundingClientRect();for(let i=0;i<10;i++){
    const dot=document.createElement('i'),angle=i*Math.PI/5;dot.style.cssText=`position:absolute;left:${r.x+r.width/2}px;top:${r.y+r.height/2}px;width:7px;height:7px;border-radius:50%;background:${['#edba58','#82b89a','#90bddd'][i%3]}`;overlay().append(dot);
    const a=animate(dot,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*65}px,${Math.sin(angle)*45-18}px) scale(.2)`,opacity:0}],{duration:650});if(a)a.finished.catch(()=>{}).finally(()=>dot.remove());else dot.remove();
  }}
  function water(el){if(!el||reduced.matches||document.hidden)return;const r=el.getBoundingClientRect();for(let i=0;i<8;i++){
    const dot=document.createElement('i');dot.style.cssText=`position:absolute;left:${r.x+r.width*(.2+Math.random()*.6)}px;top:${r.y}px;width:5px;height:10px;border-radius:60%;background:#64b8d9`;overlay().append(dot);
    const a=animate(dot,[{translate:'0px -14px',opacity:0},{opacity:1,offset:.2},{translate:`0px ${r.height*.8}px`,opacity:0}],{duration:500,delay:i*35});if(a)a.finished.catch(()=>{}).finally(()=>dot.remove());else dot.remove();
  }}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});window.addEventListener('pagehide',clear);reduced.addEventListener('change',clear);
  window.GameFeedback={capture,update,animate,pulse,celebrate,water,clear};
})();
