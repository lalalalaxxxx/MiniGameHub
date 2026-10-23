(function(root){
  'use strict';
  const N=7,SIZE=N*N,IDS=['candyland','gemquest'];
  const SPECIALS=['','row','col','bomb','rainbow'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const int=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  const neighbors=i=>[i%N?i-1:-1,i%N<N-1?i+1:-1,i>=N?i-N:-1,i<SIZE-N?i+N:-1].filter(v=>v>=0);
  const random=(s,n)=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return Math.floor(s.rng/4294967296*n);};
  const coverPatterns=[[],[30,32,34],[22,24,26,31,33],[15,17,19,29,31,33],[16,17,18,29,30,31,32,33],[8,10,12,22,24,26,36,38,40],[15,16,17,18,19,29,30,31,32,33],[8,9,10,11,12,22,24,26,36,37,38,39,40]];
  const lockPatterns=[[],[22,24,26],[16,18,30,32],[15,17,19,29,31,33],[9,11,22,24,26,37,39],[8,10,12,22,24,26,36,38,40],[8,9,11,12,22,24,26,36,37,39,40]];
  // Each row is an authored step: moves, palette, colour goals, obstacle pattern,
  // rescue columns, and (from later levels) reinforced obstacle cells.
  const definitions={
    candyland:[
      ['甜蜜第一步',18,4,[[0,15]],0,[]],
      ['草莓软糖',19,4,[[1,18],[2,12]],0,[]],
      ['奶油小径',21,4,[[3,18]],1,[]],
      ['条纹工坊',22,4,[[0,22],[1,16]],2,[]],
      ['樱桃甜心',24,4,[[2,18]],0,[2,4]],
      ['五彩糖盒',24,5,[[1,24],[4,18]],3,[]],
      ['巧克力广场',25,5,[[0,26]],4,[],[17,31]],
      ['限时甜点',25,4,[],0,[]],
      ['双层糖霜',26,5,[[1,28]],6,[],[16,18,30,32]],
      ['樱桃花园',28,5,[[0,24],[4,18]],3,[1,3,5],[17]],
      ['缤纷盛宴',28,5,[[2,30],[3,24]],7,[],[9,11,24,37,39]],
      ['糖果城堡',29,5,[[0,32],[1,26]],7,[],[8,10,12,22,24,26,38]]
    ],
    gemquest:[
      ['发现宝藏',19,4,[[0,15]],0,[3]],
      ['双子宝箱',21,4,[[1,18]],0,[2,4]],
      ['解开锁链',22,4,[[2,20]],1,[3]],
      ['宝石矿洞',23,4,[[0,20],[3,15]],2,[2,4]],
      ['锁链小径',24,4,[[1,24]],3,[1,5]],
      ['紫晶洞穴',25,5,[[2,24],[4,16]],3,[2,4]],
      ['失落宝藏',26,5,[[0,26]],4,[1,3,5]],
      ['矿洞火花',26,5,[[1,26],[3,20]],4,[2,4]],
      ['深海宝箱',27,5,[[2,28]],5,[1,3,5]],
      ['黄金走廊',28,5,[[0,28],[4,22]],5,[1,3,5]],
      ['宝藏守护者',29,5,[[1,30],[3,22]],6,[0,2,4,6]],
      ['宝石大冒险',30,5,[[0,32],[2,24]],6,[0,2,4,6]]
    ]
  };
  function level(id,index=0){
    if(!IDS.includes(id))throw new RangeError('Unknown match game');
    if(!int(index,0,11))throw new RangeError('Unknown level');
    const [name,moves,colors,targets,pattern,rescueCols,reinforced=[]]=definitions[id][index];
    const coverCells=id==='gemquest'?[]:coverPatterns[pattern].map(i=>[i,reinforced.includes(i)?2:1]);
    const lockCells=id==='gemquest'?[...lockPatterns[pattern]]:[];
    const timed=id==='candyland'&&index===7,score=id==='candyland'&&index===1?1600:timed?5000:0;
    const type=timed?'timed':rescueCols.length?'ingredient':coverCells.length?'jelly':score?'score':'order';
    return {name,moves:timed?null:moves,colors,type,seconds:timed?90:null,coverCells,lockCells,rescueCols:[...rescueCols],goals:{colors:score?[]:targets.map(([color,count])=>({color,count})),covers:coverCells.length,locks:lockCells.length,rescue:rescueCols.length,score}};
  }
  const levels=id=>definitions[id].map((_,i)=>level(id,i));
  const tile=(s,color)=>({uid:s.nextId++,kind:s.timeLeft!==null&&random(s,18)===0?'time':'normal',color,special:''});
  const matchable=t=>t&&(t.kind==='normal'||t.kind==='time');
  const blocked=(s,i)=>s.locks[i]>0;
  const selectable=(s,i)=>int(i,0,SIZE-1)&&matchable(s.board[i])&&!blocked(s,i);
  function group(s,index){
    if(!selectable(s,index))return [];
    const color=s.board[index].color,seen=new Set([index]),queue=[index];
    while(queue.length)for(const n of neighbors(queue.pop()))if(!seen.has(n)&&selectable(s,n)&&s.board[n].color===color){seen.add(n);queue.push(n);}
    return [...seen];
  }
  function runs(board){
    const found=[];
    for(let axis=0;axis<2;axis++)for(let line=0;line<N;line++){
      let cells=[];
      for(let p=0;p<=N;p++){
        const i=axis?p*N+line:line*N+p,t=p<N?board[i]:null;
        if(matchable(t)&&(!cells.length||t.color===board[cells[0]].color)){cells.push(i);continue;}
        if(cells.length>=3)found.push({cells,axis:axis?'col':'row'});
        cells=matchable(t)?[i]:[];
      }
    }
    return found;
  }
  function validPair(s,a,b){
    if(!selectable(s,a)||!selectable(s,b)||!neighbors(a).includes(b))return false;
    const x=s.board[a],y=s.board[b];
    if(x.special==='rainbow'||y.special==='rainbow'||x.special&&y.special)return true;
    [s.board[a],s.board[b]]=[y,x];
    const valid=runs(s.board).some(r=>r.cells.includes(a)||r.cells.includes(b));
    [s.board[a],s.board[b]]=[x,y];return valid;
  }
  function hint(s){
    if(s.phase!=='playing')return null;
    let best=null,bestValue=-Infinity;
    for(let a=0;a<SIZE;a++)for(const b of neighbors(a))if(b>a&&validPair(s,a,b)){
      [s.board[a],s.board[b]]=[s.board[b],s.board[a]];
      const found=runs(s.board),cells=new Set(found.flatMap(r=>r.cells));
      let value=found.reduce((sum,r)=>sum+(r.cells.length>=4?6:0),0);
      if(s.board[a].special&&s.board[b].special)value+=35;
      if(s.board[a].special==='rainbow'||s.board[b].special==='rainbow')value+=25;
      for(const i of cells){
        value+=1+s.covers[i]*5+s.locks[i]*6;
        if(s.goals.colors.some(g=>g.color===s.board[i].color&&s.collected[g.color]<g.count))value+=3;
        if(s.board[i].special)value+=9;
        for(let above=i-N;above>=0;above-=N)if(!matchable(s.board[above]))value+=7+(Math.floor(i/N)===N-1?3:0);
      }
      [s.board[a],s.board[b]]=[s.board[b],s.board[a]];
      if(value>bestValue){bestValue=value;best=[a,b];}
    }
    return best;
  }
  function goalsMet(s){return s.goals.colors.every(g=>s.collected[g.color]>=g.count)&&s.clearedCovers>=s.goals.covers&&s.clearedLocks>=s.goals.locks&&s.rescued>=s.goals.rescue&&s.score>=s.goals.score;}
  function settlePhase(s){s.phase=goalsMet(s)?'won':s.movesLeft===0||s.timeLeft===0?'lost':'playing';}
  const stats=s=>({score:s.score,collected:[...s.collected],rescued:s.rescued,clearedCovers:s.clearedCovers,clearedLocks:s.clearedLocks,movesLeft:s.movesLeft,timeLeft:s.timeLeft,timeBonus:s.timeBonus});
  function frame(s,kind,extra={}){
    return {kind,board:s.board.map(t=>t?{...t}:null),covers:[...s.covers],locks:[...s.locks],removed:[],triggered:[],rescued:[],created:[],chain:0,stats:stats(s),...extra};
  }
  function shuffleBoard(s){
    const positions=[];for(let i=0;i<SIZE;i++)if(selectable(s,i))positions.push(i);
    const original=positions.map(i=>s.board[i]),colors=level(s.id,s.level).colors;
    for(let attempt=0;attempt<300;attempt++){
      const pool=[...original];for(let i=pool.length-1;i>0;i--){const j=random(s,i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
      positions.forEach((i,k)=>{s.board[i]=pool[k];});
      // Extremely constrained boards may need fresh colours, but keep tile IDs,
      // specials, objectives, obstacles and every rescue piece untouched.
      if(attempt>=100)for(const i of positions)s.board[i]={...s.board[i],color:random(s,colors)};
      if(!runs(s.board).length&&hint({...s,phase:'playing'}))return true;
    }
    positions.forEach((i,k)=>{s.board[i]=original[k];});return false;
  }
  function fresh(id,index=0,seed){
    const cfg=level(id,index),initialSeed=int(seed,0,4294967295)?seed:Math.floor(Math.random()*4294967296);
    const s={version:1,id,level:index,seed:initialSeed,rng:initialSeed,nextId:1,board:[],covers:Array(SIZE).fill(0),locks:Array(SIZE).fill(0),movesLeft:cfg.moves,movesUsed:0,timeLeft:cfg.seconds,timeBonus:0,score:0,collected:Array(5).fill(0),rescued:0,clearedCovers:0,clearedLocks:0,goals:clone(cfg.goals),phase:'playing'};
    for(let i=0;i<SIZE;i++){
      let color=random(s,cfg.colors);
      while(i%N>=2&&s.board[i-1].color===color&&s.board[i-2].color===color||i>=N*2&&s.board[i-N].color===color&&s.board[i-N*2].color===color)color=(color+1)%cfg.colors;
      s.board.push(tile(s,color));
    }
    for(const [i,hp] of cfg.coverCells)s.covers[i]=hp;
    for(const i of cfg.lockCells)s.locks[i]=1;
    for(const col of cfg.rescueCols)s.board[col]={uid:s.board[col].uid,kind:id==='candyland'?'ingredient':'chest',color:0,special:''};
    if(!hint(s)&&!shuffleBoard(s))throw new Error('Unable to build a playable board');
    return s;
  }
  function gravity(s,frames,chain){
    const colors=level(s.id,s.level).colors;
    function fill(){
      for(let col=0;col<N;col++){
        let bottom=N-1;
        while(bottom>=0){
          if(blocked(s,bottom*N+col)){bottom--;continue;}
          let top=bottom;while(top>0&&!blocked(s,(top-1)*N+col))top--;
          const keep=[];for(let row=bottom;row>=top;row--){const t=s.board[row*N+col];if(t)keep.push(t);}
          for(let row=bottom;row>=top;row--)s.board[row*N+col]=keep.shift()||tile(s,random(s,colors));
          bottom=top-1;
        }
      }
    }
    fill();frames.push(frame(s,'fall',{chain}));
    // A rescue piece is never destroyed by blasts. It exits only at the bottom;
    // repeat for stacked pieces in one column before looking for new matches.
    for(let round=0;round<N;round++){
      const escaped=[];for(let i=SIZE-N;i<SIZE;i++)if(!matchable(s.board[i]))escaped.push(i);
      if(!escaped.length)break;
      s.rescued+=escaped.length;s.score+=escaped.length*250;
      frames.push(frame(s,'rescue',{chain,rescued:escaped}));
      for(const i of escaped)s.board[i]=null;
      fill();frames.push(frame(s,'fall',{chain}));
    }
  }
  function area(center,radius){const cells=[];for(let y=Math.max(0,Math.floor(center/N)-radius);y<=Math.min(N-1,Math.floor(center/N)+radius);y++)for(let x=Math.max(0,center%N-radius);x<=Math.min(N-1,center%N+radius);x++)cells.push(y*N+x);return cells;}
  function specialCells(s,index,special){
    if(special==='row')return Array.from({length:N},(_,x)=>Math.floor(index/N)*N+x);
    if(special==='col')return Array.from({length:N},(_,y)=>y*N+index%N);
    if(special==='bomb')return area(index,1);
    if(special==='rainbow')return s.board.flatMap((t,i)=>matchable(t)&&t.color===s.board[index].color?[i]:[]);
    return [];
  }
  function matchPlan(s,found,preferred=[]){
    const groups=[];
    for(const run of found){
      const touching=groups.filter(g=>run.cells.some(i=>g.cells.has(i)));
      const g={cells:new Set(run.cells),runs:[run]};
      for(const old of touching){old.cells.forEach(i=>g.cells.add(i));g.runs.push(...old.runs);groups.splice(groups.indexOf(old),1);}
      groups.push(g);
    }
    const created=[];
    for(const g of groups){
      const longest=[...g.runs].sort((a,b)=>b.cells.length-a.cells.length)[0];
      const type=longest.cells.length>=5?'rainbow':new Set(g.runs.map(r=>r.axis)).size>1?'bomb':longest.cells.length===4?longest.axis:'';
      if(!type)continue;
      const available=[...g.cells].filter(i=>s.board[i].special==='');
      const index=preferred.find(i=>available.includes(i))??available[Math.floor(available.length/2)];
      if(index!==undefined)created.push({index,special:type});
    }
    return {cells:[...new Set(found.flatMap(r=>r.cells))],created};
  }
  function clear(s,cells,created,frames,chain,extraTriggers=[]){
    const before=frame(s,'clear',{chain}),hit=new Set(cells),processed=new Set(),triggered=[...extraTriggers],pending=[];
    // Set iteration visits newly added cells too, so every special can fan out
    // once without recursion, object churn, or an unbounded event queue.
    for(const i of hit){const t=s.board[i];if(!matchable(t)||!t.special||processed.has(i))continue;processed.add(i);triggered.push({index:i,special:t.special});if(t.special==='bomb')pending.push({uid:t.uid,radius:extraTriggers.some(t=>t.special==='bomb-bomb')?2:1});for(const p of specialCells(s,i,t.special))hit.add(p);}
    const made=created.filter(c=>!processed.has(c.index)),anchors=new Set(made.map(c=>c.index));
    const damaged=new Set();
    for(const i of hit)if(s.covers[i])damaged.add(i);
    for(const i of damaged){s.covers[i]--;if(!s.covers[i])s.clearedCovers++;}
    const removed=[],unlocked=[],held=[],timeBonuses=[];
    for(const i of hit){
      const t=s.board[i];if(!matchable(t))continue;
      if(s.locks[i]){s.locks[i]=0;s.clearedLocks++;unlocked.push(i);}
      if(anchors.has(i))continue;
      if(pending.some(p=>p.uid===t.uid)){s.board[i]={...t,special:''};held.push(i);continue;}
      if(t.kind==='time'&&s.timeLeft!==null){s.timeBonus+=5;s.timeLeft=Math.min(180,s.timeLeft+5);timeBonuses.push(i);}
      removed.push(i);s.collected[t.color]++;s.score+=10*(1+Math.min(chain,5));s.board[i]=null;
    }
    for(const {index,special} of made)if(s.board[index])s.board[index]={...s.board[index],special};
    Object.assign(before,{removed,triggered,created:made,damagedCovers:[...damaged],unlocked,held,timeBonuses,stats:stats(s)});frames.push(before);
    gravity(s,frames,chain);return {total:removed.length,pending};
  }
  function resolveClear(s,cells,created,frames,chain,extraTriggers=[]){
    let result=clear(s,cells,created,frames,chain,extraTriggers),total=result.total;
    // Wrapped sweets survive the first pulse, fall with the board, then explode
    // once more at their new position. Every UID is consumed exactly once.
    for(let round=0;result.pending.length&&round<SIZE;round++){
      const centers=result.pending.map(p=>({index:s.board.findIndex(t=>t&&t.uid===p.uid),radius:p.radius})).filter(p=>p.index>=0);
      const next=[...new Set(centers.flatMap(p=>area(p.index,p.radius)))];
      result=clear(s,next,[],frames,chain,centers.map(({index})=>({index,special:'bomb-second'})));
      total+=result.total;
    }
    return total;
  }
  function combination(s,a,b){
    const x=s.board[a],y=s.board[b],cells=new Set([a,b]),triggers=[];
    const hasRainbow=x.special==='rainbow'||y.special==='rainbow';
    if(hasRainbow){
      const both=x.special==='rainbow'&&y.special==='rainbow',other=x.special==='rainbow'?y:x;
      for(let i=0;i<SIZE;i++){const t=s.board[i];if(!matchable(t)||!both&&t.color!==other.color)continue;cells.add(i);if(!both&&other.special&&other.special!=='rainbow'&&!blocked(s,i))s.board[i]={...t,special:other.special};}
      triggers.push({index:x.special==='rainbow'?a:b,special:both?'rainbow-rainbow':other.special?`rainbow-${other.special}`:'rainbow'});
    }else if(x.special==='bomb'&&y.special==='bomb'){
      for(const i of area(b,2))cells.add(i);triggers.push({index:b,special:'bomb-bomb'});
    }else if(x.special==='bomb'||y.special==='bomb'){
      for(let i=0;i<SIZE;i++)if(Math.abs(Math.floor(i/N)-Math.floor(b/N))<=1||Math.abs(i%N-b%N)<=1)cells.add(i);
      triggers.push({index:b,special:'bomb-stripe'});
    }else{
      for(const i of [...specialCells(s,b,'row'),...specialCells(s,b,'col')])cells.add(i);
      triggers.push({index:b,special:'stripe-stripe'});
    }
    return {cells:[...cells],triggers};
  }
  function play(s,a,b){
    if(s.phase!=='playing')return {ok:false,reason:'finished',frames:[]};
    if(!selectable(s,a))return {ok:false,reason:'blocked',frames:[]};
    let cells=[],created=[],extraTriggers=[];const frames=[];
    if(!validPair(s,a,b))return {ok:false,reason:'swap',frames:[]};
    [s.board[a],s.board[b]]=[s.board[b],s.board[a]];frames.push(frame(s,'swap',{from:a,to:b}));
    const x=s.board[a].special,y=s.board[b].special;
    if(x==='rainbow'||y==='rainbow'||x&&y){const combo=combination(s,a,b);cells=combo.cells;extraTriggers=combo.triggers;}
    else({cells,created}=matchPlan(s,runs(s.board),[b,a]));
    if(s.movesLeft!==null)s.movesLeft--;s.movesUsed++;
    let total=resolveClear(s,cells,created,frames,0,extraTriggers),chain=0;
    for(chain=1;chain<32;chain++){
      const found=runs(s.board);if(!found.length)break;
      const plan=matchPlan(s,found);total+=resolveClear(s,plan.cells,plan.created,frames,chain);
    }
    if(runs(s.board).length){shuffleBoard(s);frames.push(frame(s,'shuffle',{chain}));}
    settlePhase(s);
    if(s.phase==='playing'&&!hint(s)){shuffleBoard(s);frames.push(frame(s,'shuffle',{chain}));}
    return {ok:true,frames,total,chain:Math.max(1,chain),phase:s.phase};
  }
  function tick(s,seconds){
    if(s.phase!=='playing'||s.timeLeft===null||!Number.isFinite(seconds)||seconds<=0)return {ok:false,frames:[],phase:s.phase};
    s.timeLeft=Math.max(0,s.timeLeft-seconds);settlePhase(s);return {ok:true,frames:[],phase:s.phase};
  }
  function shuffle(s){
    if(s.phase!=='playing')return {ok:false,reason:'finished',frames:[]};
    if(!shuffleBoard(s))return {ok:false,reason:'shuffle',frames:[]};
    return {ok:true,frames:[frame(s,'shuffle')],total:0,chain:0};
  }
  function restore(id,raw){
    const fallback=()=>fresh(id,int(raw&&raw.level,0,11)?raw.level:0);
    if(!raw||raw.version!==1||raw.id!==id||!int(raw.level,0,11))return fallback();
    const cfg=level(id,raw.level),array=(v,n,fn)=>Array.isArray(v)&&v.length===n&&v.every(fn);
    if(!int(raw.seed,0,4294967295)||!int(raw.rng,0,4294967295)||!int(raw.nextId,50,10000000)||!int(raw.movesUsed,0,cfg.moves===null?100000:cfg.moves)||!int(raw.score,0,10000000)||!array(raw.collected,5,n=>int(n,0,100000))||!int(raw.rescued,0,cfg.goals.rescue)||JSON.stringify(raw.goals)!==JSON.stringify(cfg.goals)||!int(raw.timeBonus,0,100000))return fallback();
    if(cfg.seconds!==null?raw.movesLeft!==null||!Number.isFinite(raw.timeLeft)||raw.timeLeft<0||raw.timeLeft>180:raw.timeLeft!==null||raw.timeBonus!==0||!int(raw.movesLeft,0,cfg.moves)||raw.movesLeft+raw.movesUsed!==cfg.moves)return fallback();
    const rescueKind=id==='candyland'?'ingredient':'chest';
    if(!array(raw.board,SIZE,t=>t&&int(t.uid,1,raw.nextId-1)&&['normal',...(cfg.seconds!==null?['time']:[]),rescueKind].includes(t.kind)&&int(t.color,0,cfg.colors-1)&&SPECIALS.includes(t.special)&&(matchable(t)||t.special===''&&t.color===0))||new Set(raw.board.map(t=>t.uid)).size!==SIZE||raw.board.filter(t=>!matchable(t)).length+raw.rescued!==cfg.goals.rescue)return fallback();
    const maxCovers=Array(SIZE).fill(0),maxLocks=Array(SIZE).fill(0);for(const [i,hp] of cfg.coverCells)maxCovers[i]=hp;for(const i of cfg.lockCells)maxLocks[i]=1;
    if(!array(raw.covers,SIZE,(n,i)=>int(n,0,maxCovers[i]))||!array(raw.locks,SIZE,(n,i)=>int(n,0,maxLocks[i]))||raw.clearedCovers!==cfg.goals.covers-raw.covers.filter(Boolean).length||raw.clearedLocks!==cfg.goals.locks-raw.locks.filter(Boolean).length||raw.board.some((t,i)=>!matchable(t)&&(raw.locks[i]||i>=SIZE-N)))return fallback();
    const expected=goalsMet(raw)?'won':raw.movesLeft===0||raw.timeLeft===0?'lost':'playing';
    if(raw.phase!==expected||runs(raw.board).length||expected==='playing'&&!hint(raw))return fallback();
    return clone(raw);
  }
  const api={N,SIZE,IDS,SPECIALS,clone,neighbors,level,levels,fresh,restore,play,tick,hint,shuffle,group,runs,goalsMet};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MatchCore=api;
})(typeof window!=='undefined'?window:globalThis);
