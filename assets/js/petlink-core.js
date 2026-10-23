'use strict';
(function(root){
  const clone=value=>JSON.parse(JSON.stringify(value));
  const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  const definitions=[
    ['初次见面',6,4,4,'none',100],['好朋友集合',8,4,6,'none',125],['绕个弯找你',6,6,6,'none',140],
    ['滑滑梯',8,6,8,'down',170],['一起向左',8,6,8,'left',170],['一起向右',8,6,8,'right',170],
    ['森林聚会',8,6,10,'none',165],['落叶小径',8,6,10,'down',160],['左边的秘密',8,6,10,'left',155],
    ['右边的惊喜',8,6,12,'right',155],['气球升空',8,6,12,'up',150],['四季转转',8,6,12,'cycle',150]
  ];
  const flows={none:'原地不动',down:'向下掉落',left:'向左靠拢',right:'向右靠拢',up:'向上升起',cycle:'下、左、上、右轮流移动'};
  function level(index=0){const [name,cols,rows,pets,flow,seconds]=definitions[int(index,0,11)?index:0];return{name,cols,rows,pets,flow,seconds,maxSeconds:seconds+20,hints:3,shuffles:3};}
  const levels=()=>definitions.map((_,i)=>level(i));
  function random(s,n){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return Math.floor(s.rng/4294967296*n);}
  const point=(s,i)=>({x:i%s.cols,y:Math.floor(i/s.cols)});
  const same=(a,b)=>a.x===b.x&&a.y===b.y;
  // A padded empty ring makes routes around all four board edges legal.
  // Enumerating H-V-H and V-H-V covers every route with at most two bends.
  function route(s,a,b,match=true){
    if(!int(a,0,s.board.length-1)||!int(b,0,s.board.length-1)||a===b||!s.board[a]||!s.board[b]||match&&s.board[a].pet!==s.board[b].pet)return null;
    const start=point(s,a),end=point(s,b),candidates=[];
    function segment(p,q){
      if(p.x!==q.x&&p.y!==q.y)return false;
      const dx=Math.sign(q.x-p.x),dy=Math.sign(q.y-p.y),length=Math.abs(q.x-p.x)+Math.abs(q.y-p.y);
      for(let k=0;k<=length;k++){
        const x=p.x+dx*k,y=p.y+dy*k;
        if(x< -1||x>s.cols||y< -1||y>s.rows)return false;
        if(x>=0&&x<s.cols&&y>=0&&y<s.rows){const i=y*s.cols+x;if(i!==a&&i!==b&&s.board[i])return false;}
      }return true;
    }
    function consider(points){
      const clean=points.filter((p,i)=>!i||!same(p,points[i-1]));
      for(let i=clean.length-2;i>0;i--)if(clean[i-1].x===clean[i].x&&clean[i].x===clean[i+1].x||clean[i-1].y===clean[i].y&&clean[i].y===clean[i+1].y)clean.splice(i,1);
      if(clean.length<2||!clean.slice(1).every((p,i)=>segment(clean[i],p)))return;
      const length=clean.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-clean[i].x)+Math.abs(p.y-clean[i].y),0);
      candidates.push({points:clean,length});
    }
    if(start.x===end.x||start.y===end.y)consider([start,end]);
    consider([start,{x:start.x,y:end.y},end]);consider([start,{x:end.x,y:start.y},end]);
    for(let x=-1;x<=s.cols;x++)consider([start,{x,y:start.y},{x,y:end.y},end]);
    for(let y=-1;y<=s.rows;y++)consider([start,{x:start.x,y},{x:end.x,y},end]);
    candidates.sort((a,b)=>a.points.length-b.points.length||a.length-b.length);
    return candidates[0]?.points||null;
  }
  function hint(s){
    if(s.phase!=='playing')return null;
    const groups=new Map();
    for(let i=0;i<s.board.length;i++){const t=s.board[i];if(!t)continue;const prior=groups.get(t.pet)||[];for(const j of prior){const path=route(s,j,i);if(path)return{pair:[j,i],path};}prior.push(i);groups.set(t.pet,prior);}
    return null;
  }
  function permute(s){
    const positions=s.board.flatMap((t,i)=>t?[i]:[]),pool=positions.map(i=>s.board[i]);
    for(let attempt=0;attempt<40;attempt++){
      for(let i=pool.length-1;i>0;i--){const j=random(s,i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
      positions.forEach((i,k)=>s.board[i]=pool[k]);if(hint(s))return true;
    }
    // Deterministic rescue: place an existing equal pair into two connectable
    // occupied positions. Preserve every pet, UID and empty square.
    for(let ai=0;ai<positions.length;ai++)for(let bi=ai+1;bi<positions.length;bi++){
      const a=positions[ai],b=positions[bi];if(!route(s,a,b,false))continue;
      const x=pool[0],y=pool.find(t=>t.uid!==x.uid&&t.pet===x.pet);if(!y)return false;
      for(const [dest,tile] of [[a,x],[b,y]]){const source=s.board.findIndex(t=>t?.uid===tile.uid);[s.board[dest],s.board[source]]=[s.board[source],s.board[dest]];}
      return !!hint(s);
    }return false;
  }
  function fresh(index=0,seed,mode='timed'){
    index=int(index,0,11)?index:0;mode=mode==='practice'?'practice':'timed';
    const cfg=level(index),initial=int(seed,0,4294967295)?seed:Math.floor(Math.random()*4294967296);
    const s={version:1,id:'petlink',level:index,mode,cols:cfg.cols,rows:cfg.rows,seed:initial,rng:initial,board:[],pairs:0,score:0,combo:0,comboLeft:0,timeLeft:mode==='timed'?cfg.seconds:null,hintsLeft:cfg.hints,shufflesLeft:cfg.shuffles,autoShuffles:0,phase:'playing'};
    for(let p=0;p<cfg.cols*cfg.rows/2;p++)for(let j=0;j<2;j++)s.board.push({uid:p*2+j+1,pet:p%cfg.pets});
    if(!permute(s))throw new Error('Cannot make a playable pet board');return s;
  }
  function shift(s,flow){
    if(flow==='none')return;
    const vertical=flow==='up'||flow==='down',end=flow==='down'||flow==='right';
    const lines=vertical?s.cols:s.rows,length=vertical?s.rows:s.cols;
    for(let line=0;line<lines;line++){
      const indexes=Array.from({length},(_,p)=>vertical?p*s.cols+line:line*s.cols+p),tiles=indexes.map(i=>s.board[i]).filter(Boolean);
      indexes.forEach((i,p)=>s.board[i]=tiles[p-(end?length-tiles.length:0)]||null);
    }
  }
  function play(s,a,b){
    if(s.phase!=='playing')return{ok:false,reason:'finished'};
    const path=route(s,a,b);if(!path)return{ok:false,reason:s.board[a]?.pet!==s.board[b]?.pet?'different':'blocked'};
    const before=clone(s.board),removed=[a,b];
    s.board[a]=s.board[b]=null;s.pairs++;s.combo=s.comboLeft>0?s.combo+1:1;s.comboLeft=5;
    const earned=100+25*Math.min(7,s.combo-1);s.score+=earned;
    const cfg=level(s.level),bonus=s.timeLeft===null?0:Math.min(cfg.maxSeconds-s.timeLeft,2+.25*Math.min(4,s.combo-1));
    if(s.timeLeft!==null)s.timeLeft+=bonus;
    const frames=[{kind:'link',board:before,path,removed},{kind:'clear',board:before,path,removed}];
    const flow=cfg.flow==='cycle'?['down','left','up','right'][(s.pairs-1)%4]:cfg.flow;
    const unshifted=clone(s.board);shift(s,flow);
    if(s.board.some((t,i)=>t?.uid!==unshifted[i]?.uid))frames.push({kind:'shift',board:clone(s.board)});
    let automatic=false;
    if(!s.board.some(Boolean))s.phase='won';
    else if(!hint(s)){automatic=permute(s);if(!automatic)throw new Error('Pet rescue failed');s.autoShuffles++;frames.push({kind:'shuffle',board:clone(s.board)});}
    return{ok:true,path,frames,bonus,earned,combo:s.combo,automatic,flow};
  }
  function useHint(s){if(s.phase!=='playing'||!s.hintsLeft)return null;const found=hint(s);if(found)s.hintsLeft--;return found;}
  function shuffle(s){
    if(s.phase!=='playing'||!s.shufflesLeft)return{ok:false};
    if(!permute(s))return{ok:false};s.shufflesLeft--;s.combo=s.comboLeft=0;
    return{ok:true,frames:[{kind:'shuffle',board:clone(s.board)}]};
  }
  function tick(s,seconds){
    if(s.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return;
    s.comboLeft=Math.max(0,s.comboLeft-seconds);if(!s.comboLeft)s.combo=0;
    if(s.timeLeft!==null){s.timeLeft=Math.max(0,s.timeLeft-seconds);if(!s.timeLeft)s.phase='lost';}
  }
  function restore(raw){
    const fallback=()=>fresh(int(raw?.level,0,11)?raw.level:0,undefined,raw?.mode);
    if(!raw||raw.version!==1||raw.id!=='petlink'||!int(raw.level,0,11)||!['timed','practice'].includes(raw.mode))return fallback();
    const cfg=level(raw.level),size=cfg.rows*cfg.cols;
    if(raw.cols!==cfg.cols||raw.rows!==cfg.rows||!int(raw.seed,0,4294967295)||!int(raw.rng,0,4294967295)||!Array.isArray(raw.board)||raw.board.length!==size)return fallback();
    const tiles=raw.board.filter(Boolean),counts=Array(cfg.pets).fill(0);
    if(!raw.board.every(t=>t===null||t&&int(t.uid,1,size)&&int(t.pet,0,cfg.pets-1))||new Set(tiles.map(t=>t.uid)).size!==tiles.length)return fallback();
    for(const t of tiles)counts[t.pet]++;
    if(counts.some(n=>n%2)||!int(raw.pairs,0,size/2)||raw.pairs*2+tiles.length!==size||!int(raw.score,raw.pairs*100,raw.pairs*275)||!int(raw.combo,0,raw.pairs)||!Number.isFinite(raw.comboLeft)||raw.comboLeft<0||raw.comboLeft>5||!!raw.combo!==!!raw.comboLeft)return fallback();
    if(!int(raw.hintsLeft,0,cfg.hints)||!int(raw.shufflesLeft,0,cfg.shuffles)||!int(raw.autoShuffles,0,raw.pairs)|| (raw.mode==='practice'?raw.timeLeft!==null:!Number.isFinite(raw.timeLeft)||raw.timeLeft<0||raw.timeLeft>cfg.maxSeconds))return fallback();
    const phase=!tiles.length?'won':raw.timeLeft===0?'lost':'playing';
    if(raw.phase!==phase||phase==='playing'&&!hint(raw))return fallback();return clone(raw);
  }
  const api={clone,level,levels,flows,point,route,hint,fresh,restore,play,useHint,shuffle,tick,shift};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PetLinkCore=api;
})(typeof window!=='undefined'?window:globalThis);
