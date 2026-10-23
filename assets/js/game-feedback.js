/* Short, event-driven feedback. Saved game state never waits for an animation. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set();
  let layer,canvas,ctx,burstFrame=0,burstLast=0;
  const sparks=[];
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
  function capture(root){const out=new Map();out.initialized=root.childElementCount>0;
    if(reduced.matches||document.hidden)return out;
    for(const [key,{el,kind}] of elements(root)){
    // Only moving actors and disappearing faces need geometry. Keep the old
    // element until we know a ghost is needed instead of cloning every item.
    const ghost=kind==='flip'||key.startsWith('.tile'),r=ghost||kind==='move'?el.getBoundingClientRect():null;
    out.set(key,{kind,angle:Number(el.dataset.clockAngle),mask:el.dataset.pipeMask,signature:signature(el),rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,font:ghost?getComputedStyle(el).font:null,el});
  }return out;}
  function signature(el){return [el.innerHTML,el.getAttribute('transform'),el.getAttribute('style'),el.getAttribute('fill')].join('|');}
  function animate(el,frames,options={}){
    if(!el||reduced.matches||document.hidden||!el.animate)return;
    // Decorations may run out of slots, but never cancel an actor mid-move.
    for(const a of running)if(!a.effect?.target?.isConnected){a.cancel();running.delete(a);}
    const {decoration=false,...timing}=options;
    if(running.size>=(decoration?64:96))return;
    const a=el.animate(frames,{duration:360,easing:'cubic-bezier(.2,.8,.3,1)',...timing});running.add(a);
    a.finished.catch(()=>{}).finally(()=>running.delete(a));return a;
  }
  function clear(){for(const a of running)a.cancel();running.clear();cancelAnimationFrame(burstFrame);burstFrame=0;burstLast=0;sparks.length=0;layer?.replaceChildren();}
  function overlay(){if(!layer){layer=document.createElement('div');layer.id='game-fx-layer';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:30;contain:strict';document.body.append(layer);}return layer;}
  function ghost(old,flip=false){
    if(reduced.matches||document.hidden||!old.rect.width)return;
    const el=document.createElement('div'),r=old.rect;
    el.style.cssText=`position:absolute;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;display:grid;place-items:center;font:${old.font};pointer-events:none`;
    const clone=old.el.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.style.width='100%';clone.style.height='100%';el.append(clone);overlay().append(el);
    const a=animate(el,flip?[{transform:'perspective(500px) rotateY(0deg)',opacity:1},{transform:'perspective(500px) rotateY(90deg)',opacity:0}]:[{transform:'scale(1)',opacity:1},{transform:'translateY(-18px) scale(.2)',opacity:0}],{duration:flip?120:260});
    if(a)a.finished.catch(()=>{}).finally(()=>el.remove());else el.remove();
  }
  function update(before,root){
    if(!before.initialized||reduced.matches||document.hidden)return;
    // Finish layout reads before starting any animation writes.
    const next=[...elements(root)].map(([key,{el,kind}])=>({key,el,kind,old:before.get(key),r:kind==='move'?el.getBoundingClientRect():null,signature:signature(el)}));let index=0;
    for(const {key,el,kind,old,r,signature:nextSignature}of next){const changed=!old||old.signature!==nextSignature;
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
  function paintBurst(now){
    const dt=burstLast?Math.max(0,(now-burstLast)/1000):0;burstLast=now;
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for(let i=sparks.length-1;i>=0;i--){
      const p=sparks[i];p.age+=dt;if(p.age>=p.life){sparks.splice(i,1);continue;}
      const u=p.age/p.life;ctx.globalAlpha=(1-u)*(1-u);ctx.fillStyle=p.color;ctx.strokeStyle=p.color;
      if(p.ring){ctx.beginPath();ctx.arc(p.x,p.y,8+u*p.size,0,Math.PI*2);ctx.lineWidth=5*(1-u);ctx.stroke();}
      else {
        const x=p.x+p.vx*p.age,y=p.y+p.vy*p.age+130*p.age*p.age,r=p.size*(1-u*.7);
        ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.closePath();ctx.fill();
        ctx.globalAlpha*=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-p.vx*.035,y-p.vy*.035);ctx.lineWidth=r*.7;ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    if(sparks.length)burstFrame=requestAnimationFrame(paintBurst);
    else{burstFrame=0;burstLast=0;canvas.remove();}
  }
  function blast(elements,strength=1){
    if(reduced.matches||document.hidden)return;
    const targets=Array.from(elements||[]).slice(0,8).map(el=>({r:el.getBoundingClientRect(),color:['#f28da6','#8dc95b','#f4c34d','#74c9ef','#c29bea'][Number(el.dataset.color)||0]}));
    if(!targets.length)return;
    if(!canvas){canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.dataset.fx='blast';ctx=canvas.getContext('2d');}
    if(!canvas.isConnected){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.ceil(innerWidth*dpr);canvas.height=Math.ceil(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);overlay().append(canvas);}
    const power=Math.min(2.2,Math.max(1,strength));
    for(const {r,color}of targets){
      if(sparks.length>=128)break;
      const x=r.x+r.width/2,y=r.y+r.height/2;
      sparks.push({x,y,color,ring:true,size:30*power,age:0,life:.4});
      for(let i=0;i<12&&sparks.length<128;i++){
        const a=i*Math.PI/6,speed=(65+Math.random()*60)*power;
        sparks.push({x,y,color:i%4===0?'#fff1a1':color,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-35,size:3+Math.random()*4,age:0,life:.4+Math.random()*.25});
      }
    }
    if(!burstFrame)burstFrame=requestAnimationFrame(paintBurst);
  }
  function celebrate(el){if(!el||reduced.matches||document.hidden||running.size>=64)return;const r=el.getBoundingClientRect();for(let i=0;i<10&&running.size<64;i++){
    const dot=document.createElement('i'),angle=i*Math.PI/5;dot.style.cssText=`position:absolute;left:${r.x+r.width/2}px;top:${r.y+r.height/2}px;width:7px;height:7px;border-radius:50%;background:${['#edba58','#82b89a','#90bddd'][i%3]}`;overlay().append(dot);
    const a=animate(dot,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*65}px,${Math.sin(angle)*45-18}px) scale(.2)`,opacity:0}],{duration:650,decoration:true});if(a)a.finished.catch(()=>{}).finally(()=>dot.remove());else dot.remove();
  }}
  function water(el){if(!el||reduced.matches||document.hidden||running.size>=64)return;const r=el.getBoundingClientRect();for(let i=0;i<8&&running.size<64;i++){
    const dot=document.createElement('i');dot.style.cssText=`position:absolute;left:${r.x+r.width*(.2+Math.random()*.6)}px;top:${r.y}px;width:5px;height:10px;border-radius:60%;background:#64b8d9`;overlay().append(dot);
    const a=animate(dot,[{translate:'0px -14px',opacity:0},{opacity:1,offset:.2},{translate:`0px ${r.height*.8}px`,opacity:0}],{duration:500,delay:i*35,decoration:true});if(a)a.finished.catch(()=>{}).finally(()=>dot.remove());else dot.remove();
  }}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});window.addEventListener('pagehide',clear);reduced.addEventListener('change',clear);
  window.addEventListener('resize',clear);
  window.GameFeedback={capture,update,animate,pulse,blast,celebrate,water,clear};
})();
