(function(root){
  const fresh=(kind,q)=>kind==='build'||kind==='sentence'?{selected:[]}:kind==='clock'?{time:q.start||0}:kind==='share'?{counts:Array(q.children).fill(0)}:{counts:Array(q.stock.length).fill(0)};
  function restore(kind,q,raw){
    const fallback=fresh(kind,q);if(!raw||typeof raw!=='object')return fallback;
    if(kind==='build'||kind==='sentence')return Array.isArray(raw.selected)&&raw.selected.length<=q.parts.length&&new Set(raw.selected).size===raw.selected.length&&raw.selected.every(i=>Number.isInteger(i)&&i>=0&&i<q.pool.length)?{selected:[...raw.selected]}:fallback;
    if(kind==='clock')return Number.isInteger(raw.time)&&raw.time>=0&&raw.time<720&&raw.time%5===0?{time:raw.time}:fallback;
    const max=kind==='share'?q.total:9;
    return Array.isArray(raw.counts)&&raw.counts.length===fallback.counts.length&&raw.counts.every(n=>Number.isInteger(n)&&n>=0&&n<=max)&&(kind!=='share'||raw.counts.reduce((a,b)=>a+b,0)<=q.total)?{counts:[...raw.counts]}:fallback;
  }
  function won(kind,q,w){
    if(kind==='build'||kind==='sentence')return w.selected.length===q.parts.length&&w.selected.every((i,n)=>q.pool[i]===q.parts[n]);
    if(kind==='clock')return w.time===q.time;
    if(kind==='share')return w.counts.every(n=>n===q.each);
    return w.counts.every((n,i)=>n===q.order[i]);
  }
  function reduce(kind,q,w,action,value){
    const next=restore(kind,q,w),n=Number(value);
    if(action==='w-clear')return fresh(kind,q);
    if(action==='w-add'&&(kind==='build'||kind==='sentence')&&Number.isInteger(n)&&n>=0&&n<q.pool.length&&next.selected.length<q.parts.length&&!next.selected.includes(n))next.selected.push(n);
    if(action==='w-remove'&&(kind==='build'||kind==='sentence')&&Number.isInteger(n)&&n>=0&&n<next.selected.length)next.selected.splice(n,1);
    if(action==='w-time'&&kind==='clock'&&[60,-60,5,-5].includes(n))next.time=(next.time+n+720)%720;
    if(action==='w-round'&&kind==='share'&&next.counts.reduce((a,b)=>a+b,0)+q.children<=q.total)next.counts=next.counts.map(v=>v+1);
    if((action==='w-give'||action==='w-take')&&['share','shop'].includes(kind)&&Number.isInteger(n)&&n>=0&&n<next.counts.length){
      if(action==='w-take'&&next.counts[n]>0)next.counts[n]--;
      if(action==='w-give'&&next.counts[n]<(kind==='share'?q.total:9)&&(kind==='shop'||next.counts.reduce((a,b)=>a+b,0)<q.total))next.counts[n]++;
    }
    return next;
  }
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function clockSVG(time){
    const h=time/60,m=time%60;
    return `<svg class="teaching-clock" viewBox="0 0 260 260" role="img" aria-label="${Math.floor(h)||12}时${m}分"><circle cx="130" cy="130" r="120" fill="#fffdf4" stroke="#d7bc80" stroke-width="8"/>${Array.from({length:60},(_,i)=>`<path d="M130 17v${i%5?4:9}" stroke="#65756b" stroke-width="${i%5?1:3}" transform="rotate(${i*6} 130 130)"/>`).join('')}${Array.from({length:12},(_,i)=>{const a=(i+1)*Math.PI/6;return `<text x="${130+91*Math.sin(a)}" y="${137-91*Math.cos(a)}" text-anchor="middle" font-size="19" fill="#344c54">${i+1}</text>`;}).join('')}<path d="M130 130V74" stroke="#397b9b" stroke-width="9" stroke-linecap="round" transform="rotate(${h*30} 130 130)"/><path d="M130 130V49" stroke="#bb652d" stroke-width="5" stroke-linecap="round" transform="rotate(${m*6} 130 130)"/><circle cx="130" cy="130" r="7" fill="#344c54"/></svg>`;
  }
  function render(kind,q,w,level,solved,shuffle,seed){
    const disabled=solved?'disabled':'';let html='';
    if(kind==='build'||kind==='sentence'){
      const slots=kind==='build'?(q.layout==='左右'?['左边','右边']:q.layout==='上下'?['上面','下面']:['外面','里面']):q.parts.map((_,i)=>`${i+1}`);
      html=`<div class="assembly-scene"><span aria-hidden="true">${q.picture}</span>${kind==='build'?`<strong>${solved?q.answer:q.showTarget?q.answer:'？'}</strong><small>${q.layout}结构</small>`:'<strong>把小信件装好</strong>'}</div><div class="assembly-target ${kind==='build'?'build-slots':''}" data-layout="${q.layout==='上下'||q.layout==='内外'?'vertical':'horizontal'}" aria-label="已放入的卡片">${q.parts.map((_,i)=>`<div class="assembly-slot"><small>${slots[i]}</small>${w.selected[i]!==undefined?`<button data-action="w-remove" data-value="${i}" ${disabled} aria-label="取回${esc(q.pool[w.selected[i]])}">${esc(q.pool[w.selected[i]])}</button>`:'<span class="slot-empty" aria-hidden="true">＋</span>'}</div>`).join('')}</div><p class="work-note">点选卡片放入，也可以拖进上面的区域。点已放好的卡片取回。</p><div class="word-pool" aria-label="可用的卡片">${shuffle(q.pool.map((_,i)=>i),seed).map(i=>`<button data-action="w-add" data-value="${i}" ${solved||w.selected.includes(i)||w.selected.length===q.parts.length?'disabled':''}>${esc(q.pool[i])}</button>`).join('')}</div>`;
    }else if(kind==='clock'){
      html=`<div class="clock-scene"><span class="clock-bear" aria-hidden="true">🐻 ${q.picture}</span>${clockSVG(w.time)}<output class="clock-readout" aria-live="polite">${Math.floor(w.time/60)||12}:${String(w.time%60).padStart(2,'0')}</output><p>蓝色短针：小时 · 橙色长针：分钟</p></div><div class="load-controls">${[60,-60,...(level?[5,-5]:[])].map(n=>`<button data-action="w-time" data-value="${n}" ${disabled}>${n>0?'＋':'−'} ${Math.abs(n)===60?'1 小时':'5 分钟'}</button>`).join('')}</div>`;
    }else if(kind==='share'){
      const left=q.total-w.counts.reduce((a,b)=>a+b,0),friends=['🐰','🐻','🐼','🦊'];
      html=`<div class="food-store"><strong>还剩 ${left} 份</strong><div aria-hidden="true">${q.food.repeat(left)||'全部分好了'}</div></div><div class="plates">${w.counts.map((n,i)=>`<section class="plate"><button class="plate-give" data-action="w-give" data-value="${i}" ${solved||!left?'disabled':''} aria-label="给第${i+1}位朋友一份"><span class="friend" aria-hidden="true">${friends[i]}</span><span class="plate-food" aria-hidden="true">${q.food.repeat(n)||'空盘子'}</span><strong>第 ${i+1} 位 · ${n} 份</strong></button><button data-action="w-take" data-value="${i}" ${solved||!n?'disabled':''} aria-label="从第${i+1}位朋友拿回一份">拿回一份</button></section>`).join('')}</div><button class="wide-action" data-action="w-round" ${solved||left<q.children?'disabled':''}>每人分一份 · 分一轮</button>`;
    }else{
      html=`<div class="shop-customer"><span aria-hidden="true">🐻 🛍️</span><p>“听听我想买什么吧！”</p></div><div class="shop-stock">${q.stock.map((item,i)=>`<section class="shop-item"><span class="stock-picture" aria-hidden="true">${item.picture}</span><strong>${esc(item.label)}</strong><small lang="en">${item.word}</small><output aria-live="polite">袋里 ${w.counts[i]} 份</output><div><button data-action="w-take" data-value="${i}" aria-label="减少${esc(item.label)}" ${solved||!w.counts[i]?'disabled':''}>−</button><button data-action="w-give" data-value="${i}" aria-label="添加${esc(item.label)}" ${solved||w.counts[i]>=9?'disabled':''}>＋</button></div></section>`).join('')}</div><div class="shopping-bag" aria-label="购物袋"><strong>🛍️ 我的购物袋</strong><p>${q.stock.filter((_,i)=>w.counts[i]).map(item=>`${item.picture} × ${w.counts[q.stock.indexOf(item)]}`).join('　')||'还没有商品'}</p></div>`;
    }
    return html+`<div class="work-actions"><button data-action="w-clear" ${disabled}>${kind==='share'?'全部收回':'清空重来'}</button><button class="primary" data-action="w-check" ${disabled}>${kind==='shop'?'交给顾客':kind==='sentence'?'寄出小信件':'检查一下'} ✓</button></div>`;
  }
  const api={fresh,restore,reduce,won,render,clockSVG};if(typeof module!=='undefined')module.exports=api;else root.AcademyActivities=api;
})(typeof window!=='undefined'?window:globalThis);
