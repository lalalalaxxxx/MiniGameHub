'use strict';
// Runtime positions deliberately stay separate from the saved aquarium arrangement.
window.createAquarium = function ({state, paused, eat}) {
  const animals=new Map(), pellets=[];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let tank,last=0,serial=0,eaten=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function art(type){
    const bird=type===5||type===6, color=['#ffb653','#70bce4','#ecc968','#8baabc','#d99ddc','#ffe179','#fff9ed','#86b77c'][type];
    const body=bird?`<ellipse cx="46" cy="43" rx="28" ry="17"/><path d="M59 43 Q${type===6?'38 6 66 8':'58 12 72 20'} Q88 24 76 38L70 49Z"/><path d="M77 27l17 6-18 5" fill="#ed9850"/>`:`<ellipse cx="50" cy="38" rx="32" ry="${type===2?26:20}"/><path d="M73 41q8 5 14-2" fill="none" stroke="#885d54" stroke-width="2"/>`;
    return `<svg viewBox="0 0 100 76" aria-hidden="true"><g class="animal-body" fill="${color}" stroke="#466b76" stroke-width="1.5"><g class="animal-tail">${bird?'<path d="M28 42L9 31l8 21Z"/>':type===4?'<path d="M30 45q-22 25-25 7m37-7q-13 30-20 17m34-17q0 30-12 21" fill="none" stroke-width="7"/>':'<path d="M25 38L3 19v38Z"/>'}</g>${body}<g class="animal-fin"><path d="M48 37q-19 6-10 17 15-2 20-13" fill="${bird?'#efd8a4':'#ffffff88'}"/></g>${type===7?'<ellipse cx="43" cy="36" rx="23" ry="18" fill="#548c62"/><path d="M23 33h40M44 19v34" stroke="#bfd493"/>':''}<circle cx="${bird?75:70}" cy="${bird?26:31}" r="3" fill="#263d49" stroke="none"/><circle cx="${bird?76:71}" cy="${bird?25:30}" r="1" fill="white" stroke="none"/></g></svg>`;
  }
  function paint(a){
    if(!a.el)return;
    a.el.style.left=`${a.x}%`;a.el.style.top=`${a.y}%`;
    a.el.style.transform=`translate(-50%,-50%) scaleX(${a.face})`;
    const wave=reduced.matches?0:Math.sin(a.phase),bite=a.bite>0?Math.sin(a.bite/.48*Math.PI):0;
    a.el.querySelector('.animal-tail').style.transform=`rotate(${wave*19}deg) scaleX(${1-Math.abs(wave)*.18})`;
    a.el.querySelector('.animal-fin').style.transform=`rotate(${wave*25}deg)`;
    a.el.querySelector('.animal-body').style.transform=`translateY(${a.bird?bite*7:0}px) rotate(${a.bird?bite*17:wave*2}deg) scale(${1+bite*.1},${1-bite*.08})`;
    a.el.classList.toggle('eating',a.bite>0);
  }
  function sync(){
    tank=document.getElementById('tank');if(!tank)return;
    const s=state();
    for(const [key] of animals)if(!s.fish.some(f=>f.id===key))animals.delete(key);
    for(const f of s.fish){
      const bird=f.type===5||f.type===6;
      let a=animals.get(f.id);
      if(!a){a={id:f.id,type:f.type,bird,x:f.x,y:bird?16:f.y,vx:0,vy:0,face:1,phase:0,bite:0,wander:0};animals.set(f.id,a);}
      a.el=tank.querySelector(`[data-action="fish"][data-value="${f.id}"]`);a.el.innerHTML=art(f.type);a.el.classList.toggle('surface-bird',bird);paint(a);
    }
    for(const p of pellets){tank.append(p.el);}
  }
  function feed(x=50,y=40){
    if(!tank||paused())return false;
    for(let i=0;i<10;i++){
      const angle=Math.random()*Math.PI*2,r=Math.sqrt(Math.random());
      // A small floating share lets surface birds eat wherever the child taps.
      const p={id:serial++,x:clamp(x+Math.cos(angle)*r*13,10,90),y:clamp(i<3?17+Math.random()*5:y+Math.sin(angle)*r*9,17,80),age:0,floating:i<3,el:document.createElement('i')};
      p.el.className='food-dot';p.el.style.left=`${p.x}%`;p.el.style.top=`${p.y}%`;tank.append(p.el);pellets.push(p);
    }
    while(pellets.length>60)pellets.shift().el.remove();return true;
  }
  function tick(now){
    const dt=Math.min(.04,(now-last)/1000||0);last=now;
    if(tank&&!paused()&&!document.hidden){
      for(let i=pellets.length-1;i>=0;i--){const p=pellets[i];p.age+=dt;if(p.age>24){p.el.remove();pellets.splice(i,1);continue;}if(!p.floating)p.y=Math.min(83,p.y+dt*.65);p.el.style.top=`${p.y}%`;}
      for(const a of animals.values()){
        a.bite=Math.max(0,a.bite-dt);
        let target=null,best=Infinity;
        for(const p of pellets){if(a.bird&&!p.floating)continue;const d=Math.hypot(p.x-a.x,p.y-a.y);if(d<best){best=d;target=p;}}
        a.wander-=dt;
        if(a.wander<=0){a.tx=12+Math.random()*76;a.ty=a.bird?16:30+Math.random()*45;a.wander=3+Math.random()*4;}
        const tx=target?target.x-a.face*5:a.tx,ty=target?(a.bird?17:target.y):a.ty;
        const dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy);
        const speed=a.bite>0?0:Math.min(target?24:6,d*2.2),blend=1-Math.exp(-dt*(target?3:1.8));
        a.vx+=((d?dx/d*speed:0)-a.vx)*blend;a.vy+=((d?dy/d*speed:0)-a.vy)*blend;
        a.x=clamp(a.x+a.vx*dt,9,91);a.y=clamp(a.y+a.vy*dt,a.bird?15:20,a.bird?19:82);
        if(Math.abs(a.vx)>1.2)a.face=a.vx>0?1:-1;
        a.phase+=dt*(2+Math.hypot(a.vx,a.vy)*.65);
        if(target&&a.bite===0&&Math.hypot(target.x-(a.x+a.face*5),target.y-(a.bird?21:a.y))<4){
          target.el.remove();pellets.splice(pellets.indexOf(target),1);a.bite=.48;eaten++;eat(a.type);
        }
        paint(a);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return {sync,feed,reset:()=>{animals.clear();pellets.splice(0).forEach(p=>p.el.remove());},snapshot:()=>({eaten,food:pellets.map(({x,y,floating})=>({x,y,floating})),animals:[...animals.values()].map(({el,...a})=>({...a}))})};
};
