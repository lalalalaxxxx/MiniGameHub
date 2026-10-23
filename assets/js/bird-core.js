(function(root){
  'use strict';
  const N=7,SIZE=N*N,MODES=['practice','classic','pandora','ice','fever'];
  const SPECIALS=['','glow','fire','lightning','whirlwind'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const int=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  const neighbors=i=>[i%N?i-1:-1,i%N<N-1?i+1:-1,i>=N?i-N:-1,i<SIZE-N?i+N:-1].filter(v=>v>=0);
  const random=(s,n)=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return Math.floor(s.rng/4294967296*n);};
  function level(id,index=0,mode='practice'){
    if(id!=='birdblast'||!int(index,0,11)||!MODES.includes(mode))throw new RangeError('Unknown bird game or mode');
    const ice=mode==='ice',stage=index+1,names={practice:'小鸟练习',classic:'经典上升',pandora:'潘多拉',ice:'冰雪挑战',fever:'狂热冲分'};
    return {name:names[mode]+' '+stage,moves:null,colors:Math.min(5,3+Math.floor(index/4)),height:Math.min(5,3+Math.floor(index/4)),coverCells:[],lockCells:[],rescueCols:[],goals:{score:ice?0:mode==='practice'?150+index*70:0,colors:[],covers:ice?4+index:0,locks:0,rescue:0}};
  }
  const levels=(id,mode='practice')=>Array.from({length:12},(_,i)=>level(id,i,mode));
  const top=(s,col)=>{if(!int(col,0,N-1))return -1;for(let row=0;row<N;row++)if(s.board[row*N+col])return row*N+col;return -1;};
  const selectable=(s,index)=>int(index,0,SIZE-1)&&!!s.board[index]&&!s.covers[index]&&top(s,index%N)===index;
  function group(s,index){
    if(!int(index,0,SIZE-1)||!s.board[index])return [];
    const color=s.board[index].color,seen=new Set([index]),queue=[index];
    while(queue.length)for(const n of neighbors(queue.pop()))if(!seen.has(n)&&s.board[n]&&s.board[n].color===color){seen.add(n);queue.push(n);}
    return [...seen];
  }
  function groups(s){
    const seen=new Set(),result=[];
    for(let i=0;i<SIZE;i++)if(s.board[i]&&!seen.has(i)){const cells=group(s,i);for(const p of cells)seen.add(p);if(cells.length>=3)result.push(cells);}
    return result;
  }
  function destination(s,col){const first=top(s,col);return first<0?(N-1)*N+col:first>=N?first-N:-1;}
  function canMove(s,a,b){return s.phase==='playing'&&selectable(s,a)&&int(b,0,SIZE-1)&&a%N!==b%N&&destination(s,b%N)>=0;}
  function hint(s){
    if(s.phase!=='playing')return null;
    let best=null,bestValue=-Infinity,immediate=false;const setup=[];
    for(let col=0;col<N;col++){
      const a=top(s,col);if(!selectable(s,a))continue;
      for(let target=0;target<N;target++){
        if(target===col)continue;
        const b=destination(s,target);if(b<0)continue;
        const bird=s.board[a];s.board[a]=null;s.board[b]=bird;
        const connected=group(s,b),matching=connected.length>=3;
        let value=(matching?connected.length*20:connected.length*2)+(matching?connected.filter(i=>s.covers[i]).length*15:0);
        if(matching)for(const i of connected){if(s.board[i].special)value+=50;for(const n of neighbors(i))if(s.covers[n])value+=8;}
        // A nonmatching move is still legal and useful for exposing buried birds.
        value+=Math.floor(a/N)*.01+Math.floor(b/N)*.02;
        if(matching)immediate=true;
        else setup.push({a,b,value});
        s.board[a]=bird;s.board[b]=null;
        if(value>bestValue){bestValue=value;best=[a,b];}
      }
    }
    if(immediate)return best;
    // If there is no direct match, show a setup that makes a match on the next
    // move. This prevents hints from endlessly moving the same pair back/forth.
    let setupValue=-Infinity;
    for(const option of setup){
      const bird=s.board[option.a];s.board[option.a]=null;s.board[option.b]=bird;
      let nextValue=0;
      for(let source=0;source<N;source++){
        const a=top(s,source);if(!selectable(s,a))continue;
        for(let target=0;target<N;target++){
          if(target===source)continue;const b=destination(s,target);if(b<0)continue;
          const moving=s.board[a];s.board[a]=null;s.board[b]=moving;
          const connected=group(s,b);
          if(connected.length>=3)nextValue=Math.max(nextValue,connected.length*20+connected.reduce((sum,i)=>sum+(s.covers[i]?15:0)+(s.board[i].special?40:0)+neighbors(i).filter(n=>s.covers[n]).length*8,0));
          s.board[a]=moving;s.board[b]=null;
        }
      }
      s.board[option.a]=bird;s.board[option.b]=null;
      const value=nextValue+option.value*.01;
      if(nextValue&&value>setupValue){setupValue=value;best=[option.a,option.b];}
    }
    return best;
  }
  function tile(s,color){return {uid:s.nextId++,kind:s.mode==='pandora'&&random(s,10)===0?'token':'normal',color,special:''};}
  const stats=s=>({score:s.score,collected:[...s.collected],rescued:s.rescued,clearedCovers:s.clearedCovers,clearedLocks:s.clearedLocks,movesLeft:s.movesLeft});
  function frame(s,kind,extra={}){return {kind,board:s.board.map(t=>t?{...t}:null),covers:[...s.covers],locks:[...s.locks],removed:[],triggered:[],rescued:[],created:[],chain:0,stats:stats(s),...extra};}
  function noStartingGroups(s){
    const colors=level(s.id,s.level,s.mode).colors;
    for(let attempt=0;attempt<80;attempt++){
      let good=true;
      for(let i=0;i<SIZE;i++)if(s.board[i]){
        const original=s.board[i].color,start=random(s,colors);let chosen=false;
        for(let turn=0;turn<colors;turn++){s.board[i].color=(start+turn)%colors;if(group(s,i).length<3){chosen=true;break;}}
        if(!chosen){s.board[i].color=original;good=false;break;}
      }
      if(good&&!groups(s).length)return true;
    }
    // A Latin arrangement always has distinct orthogonal neighbours.
    const offset=random(s,colors);for(let i=0;i<SIZE;i++)if(s.board[i])s.board[i].color=(Math.floor(i/N)+i%N+offset)%colors;
    return true;
  }
  function fresh(id,index=0,seed,mode='practice'){
    const cfg=level(id,index,mode),initialSeed=int(seed,0,4294967295)?seed:Math.floor(Math.random()*4294967296);
    const s={version:1,id,level:index,mode,seed:initialSeed,rng:initialSeed,nextId:1,board:Array(SIZE).fill(null),covers:Array(SIZE).fill(0),locks:Array(SIZE).fill(0),movesLeft:null,movesUsed:0,score:0,collected:Array(5).fill(0),rescued:0,clearedCovers:0,clearedLocks:0,goals:clone(cfg.goals),phase:'playing',timeLeft:mode==='pandora'||mode==='fever'?120:null,riseLeft:mode==='classic'?18:null,combo:0,comboLeft:0};
    for(let col=0;col<N;col++)for(let row=N-cfg.height+(col%3===0?1:0);row<N;row++)s.board[row*N+col]=tile(s,random(s,cfg.colors));
    noStartingGroups(s);
    if(mode==='ice'){
      const positions=[];for(let row=N-1;row>=0;row--)for(let col=0;col<N;col++)if(s.board[row*N+col])positions.push(row*N+col);
      for(let i=0;i<cfg.goals.covers;i++)s.covers[positions[i]]=1;
    }
    return s;
  }
  function gravity(s,frames,chain){
    for(let col=0;col<N;col++){
      const birds=[];for(let row=N-1;row>=0;row--){const i=row*N+col;if(s.board[i])birds.push({bird:s.board[i],ice:s.covers[i]});s.board[i]=null;s.covers[i]=0;}
      for(let k=0;k<birds.length;k++){const i=(N-1-k)*N+col;s.board[i]=birds[k].bird;s.covers[i]=birds[k].ice;}
    }
    frames.push(frame(s,'fall',{chain}));
  }
  function specialCells(index,special){
    const row=Math.floor(index/N),col=index%N,cells=[];
    if(special==='glow'){
      for(const [dx,dy]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1]])if(col+dx>=0&&col+dx<N&&row+dy>=0&&row+dy<N)cells.push((row+dy)*N+col+dx);
      return cells;
    }
    for(let i=0;i<SIZE;i++){
      const dy=Math.abs(Math.floor(i/N)-row),dx=Math.abs(i%N-col);
      if(special==='whirlwind'||special==='lightning'&&(dy<=1||dx<=1)||special==='fire'&&(dy===0||dx===0||dy<=1&&dx<=1))cells.push(i);
    }
    return cells;
  }
  const tier=count=>count>=7?'whirlwind':count===6?'lightning':count===5?'fire':count===4?'glow':'';
  function clearGroups(s,found,preferred,frames,chain){
    const before=frame(s,'clear',{chain}),hit=new Set(found.flat()),protectedCells=new Set(),created=[],triggered=[],processed=new Set();
    for(const cells of found){
      const type=tier(cells.length);if(!type)continue;
      const options=cells.filter(i=>!s.covers[i]&&!s.board[i].special);
      const index=options.includes(preferred)?preferred:options[0];
      if(index!==undefined){protectedCells.add(index);created.push({index,special:type});}
    }
    for(const i of hit){
      const bird=s.board[i];if(!bird||!bird.special||s.covers[i]||processed.has(i))continue;
      processed.add(i);triggered.push({index:i,special:bird.special});for(const n of specialCells(i,bird.special))hit.add(n);
    }
    const frozen=new Set(),damaged=new Set();
    for(const i of hit){if(s.covers[i]){frozen.add(i);damaged.add(i);}for(const n of neighbors(i))if(s.covers[n])damaged.add(n);}
    for(const i of damaged){s.covers[i]=0;s.clearedCovers++;}
    const removed=[];let tokenCount=0;
    const multiplier=s.mode==='fever'?1+Math.min(6,s.combo):1+Math.min(4,chain);
    for(const i of hit){
      const bird=s.board[i];if(!bird||frozen.has(i)||protectedCells.has(i))continue;
      if(bird.kind==='token')tokenCount++;
      removed.push(i);s.collected[bird.color]++;s.score+=10*multiplier;s.board[i]=null;
    }
    if(tokenCount){s.score+=tokenCount*50;s.timeLeft=Math.min(150,s.timeLeft+tokenCount*2);}
    for(const {index,special}of created)if(s.board[index])s.board[index]={...s.board[index],special};
    Object.assign(before,{removed,triggered,created,damagedCovers:[...damaged],tokens:tokenCount,multiplier,stats:stats(s)});frames.push(before);
    gravity(s,frames,chain);return removed.length;
  }
  function settlePhase(s){
    if(s.phase!=='playing')return;
    if(s.mode==='practice'&&s.score>=s.goals.score||s.mode==='ice'&&s.clearedCovers>=s.goals.covers||s.timeLeft===0)s.phase='won';
  }
  function resolve(s,frames,preferred=-1){
    let total=0,chain=0;
    for(;chain<24;chain++){
      const found=groups(s);if(!found.length)break;
      total+=clearGroups(s,found,preferred,frames,chain);preferred=-1;
    }
    return{total,chain};
  }
  function rise(s,frames,avoidMatches=false){
    if(s.board.slice(0,N).some(Boolean)){s.phase='lost';return false;}
    const colors=level(s.id,s.level,s.mode).colors;
    for(let i=0;i<SIZE-N;i++){s.board[i]=s.board[i+N];s.covers[i]=s.covers[i+N];}
    for(let col=0;col<N;col++){const i=SIZE-N+col;s.board[i]=null;s.covers[i]=0;}
    for(let col=0;col<N;col++){
      const i=SIZE-N+col,color=random(s,colors);s.board[i]=tile(s,color);
      if(avoidMatches)for(let attempt=0;attempt<colors;attempt++){s.board[i].color=(color+attempt)%colors;if(group(s,i).length<3)break;}
    }
    frames.push(frame(s,'rise'));return true;
  }
  function supply(s,frames){
    if(s.mode==='classic'||s.phase!=='playing')return;
    // Untimed stages and timed score modes need fresh birds after a big clear.
    // Supply is earned by making room, never by waiting through a forced timer.
    for(let count=0;count<2&&s.board.filter(Boolean).length<14&&!s.board.slice(0,N).some(Boolean);count++)rise(s,frames,true);
  }
  function play(s,a,b){
    if(!canMove(s,a,b))return{ok:false,reason:s.phase!=='playing'?'finished':!selectable(s,a)?'top':'column',frames:[],total:0,chain:0};
    const to=destination(s,b%N),frames=[];
    s.board[to]=s.board[a];s.board[a]=null;s.movesUsed++;
    frames.push(frame(s,'move',{from:a,to}));
    if(s.mode==='fever'){if(s.comboLeft<=0)s.combo=0;}
    const result=resolve(s,frames,to);
    if(result.total>0){s.combo=s.comboLeft>0?Math.min(30,s.combo+1):1;s.comboLeft=4;}
    settlePhase(s);supply(s,frames);settlePhase(s);
    return{ok:true,frames,total:result.total,chain:result.chain};
  }
  function shuffle(s){
    if(s.phase!=='playing')return{ok:false,reason:'finished',frames:[],total:0,chain:0};
    const positions=[];for(let i=0;i<SIZE;i++)if(s.board[i]&&!s.covers[i])positions.push(i);
    if(positions.length<2)return{ok:false,reason:'ice',frames:[],total:0,chain:0};
    const original=positions.map(i=>s.board[i]);
    for(let attempt=0;attempt<160;attempt++){
      const pool=[...original];for(let i=pool.length-1;i>0;i--){const j=random(s,i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
      positions.forEach((i,k)=>{s.board[i]=pool[k];});
      if(!groups(s).length&&hint(s))return{ok:true,frames:[frame(s,'shuffle')],total:0,chain:0};
    }
    positions.forEach((i,k)=>{s.board[i]=original[k];});
    return{ok:false,reason:'unchanged',frames:[],total:0,chain:0};
  }
  function tick(s,dt){
    const frames=[],beforePhase=s.phase;
    if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return{ok:false,frames,total:0,chain:0};
    // Callers supply only foreground elapsed time. Capping a single tick prevents
    // a suspended tab from injecting an entire wall-clock interval on resume.
    dt=Math.min(dt,1);s.comboLeft=Math.max(0,s.comboLeft-dt);if(!s.comboLeft)s.combo=0;
    if(s.timeLeft!==null){s.timeLeft=Math.max(0,s.timeLeft-dt);settlePhase(s);}
    let total=0,chain=0;
    if(s.mode==='classic'){
      s.riseLeft-=dt;
      if(s.riseLeft<=0){if(rise(s,frames)){const result=resolve(s,frames);total=result.total;chain=result.chain;}s.riseLeft=Math.max(6,18-Math.floor(s.score/300));}
    }
    return{ok:frames.length>0||s.phase!==beforePhase,frames,total,chain};
  }
  function restore(id,raw){
    const fallback=()=>fresh(id);
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||raw.id!==id||id!=='birdblast'||!MODES.includes(raw.mode)||!int(raw.level,0,11))return fallback();
    const s=clone(raw),cfg=level(id,s.level,s.mode),finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(!int(s.seed,0,4294967295)||!int(s.rng,0,4294967295)||!int(s.nextId,1,1e9)||!Array.isArray(s.board)||s.board.length!==SIZE||!Array.isArray(s.covers)||s.covers.length!==SIZE||!Array.isArray(s.locks)||s.locks.length!==SIZE)return fallback();
    const seen=new Set();
    for(let i=0;i<SIZE;i++){
      const bird=s.board[i];
      if(!int(s.covers[i],0,1)||s.locks[i]!==0||s.covers[i]&&(!bird||s.mode!=='ice'))return fallback();
      if(!bird)continue;
      if(typeof bird!=='object'||!int(bird.uid,1,s.nextId-1)||seen.has(bird.uid)||!['normal','token'].includes(bird.kind)||bird.kind==='token'&&s.mode!=='pandora'||!int(bird.color,0,cfg.colors-1)||!SPECIALS.includes(bird.special))return fallback();
      seen.add(bird.uid);
    }
    for(let col=0;col<N;col++){let occupied=false;for(let row=0;row<N;row++){const bird=s.board[row*N+col];if(bird)occupied=true;else if(occupied)return fallback();}}
    for(const key of ['movesUsed','score','rescued','clearedCovers','clearedLocks','combo'])if(!int(s[key],0,1e9))return fallback();
    if(s.movesLeft!==null||!Array.isArray(s.collected)||s.collected.length!==5||!s.collected.every(n=>int(n,0,1e9))||s.rescued!==0||s.clearedLocks!==0||!finite(s.comboLeft,0,4)||s.combo>30||JSON.stringify(s.goals)!==JSON.stringify(cfg.goals)||!['playing','won','lost'].includes(s.phase))return fallback();
    if(s.clearedCovers+s.covers.reduce((a,b)=>a+b,0)!==cfg.goals.covers)return fallback();
    const timed=s.mode==='pandora'||s.mode==='fever';
    if(timed?!finite(s.timeLeft,0,150):s.timeLeft!==null)return fallback();
    if(s.mode==='classic'?!finite(s.riseLeft,0,18):s.riseLeft!==null)return fallback();
    const complete=s.mode==='practice'&&s.score>=cfg.goals.score||s.mode==='ice'&&s.clearedCovers>=cfg.goals.covers||timed&&s.timeLeft===0;
    if(s.phase==='won'&&!complete||s.phase==='playing'&&complete||s.phase==='lost'&&s.mode!=='classic')return fallback();
    return s;
  }
  const api={N,MODES,SPECIALS,clone,neighbors,level,levels,fresh,restore,top,selectable,group,groups,hint,play,shuffle,tick};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BirdCore=api;
})(typeof window==='object'?window:null);
