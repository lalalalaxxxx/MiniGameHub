/* Birzzle-inspired rules. Time advances only through foreground simulation ticks. */
(function(root){
  'use strict';
  const COLS=7,MODES=['classic','ice','pandora','practice','fever'];
  const SPECIALS=['','glow','fire','lightning','whirlwind'],WINDOW=.73;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
  const random=(s,n)=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return Math.floor(s.rng/4294967296*n);};
  const neighbors=(s,i)=>[i%7?i-1:-1,i%7<6?i+1:-1,i>=7?i-7:-1,i<s.board.length-7?i+7:-1].filter(v=>v>=0);
  const colors=s=>Math.min(8,4+Math.floor((s.level-1)/4));
  const interval=s=>Math.max(s.pace==='gentle'?3.2:1.6,(s.pace==='gentle'?13:9)-Math.log2(s.level+1)*1.1);
  const threshold=s=>30+Math.min(90,(s.level-1)*5);
  const tier=n=>n>=7?'whirlwind':n===6?'lightning':n===5?'fire':n===4?'glow':'';
  const tile=(s,color=random(s,colors(s)),kind='bird')=>({uid:s.nextId++,kind,color,special:'',lock:0,hp:kind==='ice'?1:0,loot:''});
  // Board scans are expensive flood fills. Remember only matching inputs, outside saved state.
  const scanned=new WeakMap();
  function remember(s){let memo=scanned.get(s);if(!memo){memo={uids:[],colors:[],kinds:[]};scanned.set(s,memo);}memo.length=s.board.length;memo.charges=s.charges;for(let i=0;i<s.board.length;i++){const b=s.board[i];memo.uids[i]=b?.uid;memo.colors[i]=b?.color;memo.kinds[i]=b?.kind;}}
  function scanChanged(s){const memo=scanned.get(s);if(memo&&memo.length===s.board.length&&memo.charges===s.charges){let same=true;for(let i=0;i<s.board.length;i++){const b=s.board[i];if(memo.uids[i]!==b?.uid||memo.colors[i]!==b?.color||memo.kinds[i]!==b?.kind){same=false;break;}}if(same)return;}scan(s);}
  const event=(events,type,data={})=>events.push({type,...data});
  const top=(s,c)=>{for(let i=c;i<s.board.length;i+=7)if(s.board[i])return i;return -1;};
  const landing=(s,c)=>{const t=top(s,c);return t<0?s.board.length-7+c:t-7;};
  const charging=(s,uid)=>s.charges.some(g=>g.uids.includes(uid));
  function exposed(s,i){return i<7||!s.board[i-7]||i%7>0&&!s.board[i-1]||i%7<6&&!s.board[i+1];}
  function selectable(s,i){const b=s.board[i];return s.phase==='playing'&&s.mode!=='ice'&&!!b&&b.kind==='bird'&&!b.lock&&!charging(s,b.uid)&&exposed(s,i);}
  function group(s,start){
    const b=s.board[start];if(!b||b.kind!=='bird')return [];
    const found=new Set([start]),todo=[start];
    while(todo.length)for(const i of neighbors(s,todo.pop()))if(!found.has(i)&&s.board[i]?.kind==='bird'&&s.board[i].color===b.color){found.add(i);todo.push(i);}
    return [...found];
  }
  function groups(s){const seen=new Set(),out=[];for(let i=0;i<s.board.length;i++){if(seen.has(i)||s.board[i]?.kind!=='bird')continue;const g=group(s,i);g.forEach(p=>seen.add(p));if(g.length>=3)out.push(g);}return out;}
  function nextBird(s){const b=tile(s);if(s.level>=7&&random(s,100)<Math.min(32,s.level+3))b.lock=s.level>=20&&random(s,4)===0?2:1;return b;}
  function gravity(s,events){
    const moved=[];
    for(let c=0;c<7;c++){let write=s.board.length-7+c;
      for(let i=write;i>=0;i-=7){const b=s.board[i];if(!b)continue;
        if(b.kind==='ice'){write=i-7;continue;}
        if(write!==i){s.board[write]=b;s.board[i]=null;moved.push({uid:b.uid,from:i,to:write});}write-=7;
      }
    }if(moved.length)event(events,'fall',{moved});
  }
  function safeFill(s,i){const b=tile(s),start=b.color;s.board[i]=b;for(let n=0;n<colors(s);n++){b.color=(start+n)%colors(s);if(group(s,i).length<3)break;}}
  function rise(s,events){
    if(s.board.slice(0,7).some(Boolean))return false;
    const moved=s.board.flatMap((b,i)=>b?[{uid:b.uid,from:i,to:i-7}]:[]);
    s.board.splice(0,7);s.board.push(...Array(7).fill(null));
    for(let i=s.board.length-7;i<s.board.length;i++)safeFill(s,i);event(events,'rise',{moved});return true;
  }
  function scan(s,preferred=-1){
    const old=s.charges;
    s.charges=groups(s).map(cells=>{
      const uids=cells.map(i=>s.board[i].uid),prev=old.filter(g=>g.uids.some(id=>uids.includes(id)));
      return{uids,at:prev.length?Math.min(...prev.map(g=>g.at)):s.clock+(s.mode==='ice'?.9:WINDOW),anchor:cells.includes(preferred)?s.board[preferred].uid:prev.find(g=>uids.includes(g.anchor))?.anchor||uids[0]};
    });
    remember(s);
  }
  function fresh(mode='classic',seed=Math.floor(Math.random()*4294967296),pace='gentle'){
    if(!MODES.includes(mode)||!integer(seed,0,4294967295)||!['gentle','normal'].includes(pace))throw new RangeError('Invalid bird game');
    const s={version:2,mode,pace,rows:mode==='ice'?9:10,seed,rng:seed,nextId:1,board:[],next:[],charges:[],clock:0,dropLeft:0,level:1,levelCleared:0,score:0,cleared:0,moves:0,combo:0,comboUntil:0,phase:'playing',timeLeft:mode==='ice'?60:['pandora','fever'].includes(mode)?120:null,wave:1,eggs:0,iceBroken:0,letters:[],chests:0,fever:0,feverUntil:0,shotLeft:0,supplyLeft:1};
    s.board=Array(s.rows*7).fill(null);
    if(mode==='ice')iceWave(s,[],true);else for(let i=s.board.length-21;i<s.board.length;i++)safeFill(s,i);
    s.next=Array.from({length:7},()=>nextBird(s));s.dropLeft=interval(s);if(mode==='pandora')addBox(s,[]);return s;
  }
  function target(s,from,to){
    if(!integer(to,0,s.board.length-1)||from===to)return -1;
    const bird=s.board[from];s.board[from]=null;let dest=s.board[to]?landing(s,to%7):to;
    if(dest<0||!exposed(s,dest)){s.board[from]=bird;return -1;}
    while(dest+7<s.board.length&&!s.board[dest+7])dest+=7;s.board[from]=bird;return dest===from?-1:dest;
  }
  function move(s,from,to){
    if(!integer(from,0,s.board.length-1)||!selectable(s,from))return{ok:false,events:[],reason:'blocked'};
    const dest=target(s,from,to);if(dest<0)return{ok:false,events:[],reason:'space'};
    const events=[],b=s.board[from];s.board[from]=null;s.board[dest]=b;s.moves++;
    event(events,'move',{uid:b.uid,from,to:dest});gravity(s,events);scan(s,s.board.findIndex(t=>t?.uid===b.uid));return{ok:true,events};
  }
  function shoot(s,col){
    if(s.phase!=='playing'||s.mode!=='ice'||!integer(col,0,6)||s.shotLeft>0)return{ok:false,events:[],reason:'wait'};
    const dest=landing(s,col);if(dest<0)return{ok:false,events:[],reason:'space'};
    const b=s.next.shift();s.next.push(tile(s));s.board[dest]=b;s.moves++;s.shotLeft=.09;
    const events=[];event(events,'drop',{moved:[{uid:b.uid,from:col-7,to:dest}]});scan(s,dest);return{ok:true,events};
  }
  function area(s,i,special){
    const row=Math.floor(i/7),col=i%7,out=[];
    for(let p=0;p<s.board.length;p++){const r=Math.floor(p/7),c=p%7;
      if(special==='whirlwind'||special==='glow'&&Math.abs(r-row)<=1&&Math.abs(c-col)<=1||special==='lightning'&&(r===row||c===col)||special==='fire'&&(c===col&&r>=row||r>=s.rows-2&&Math.abs(c-col)<=1))out.push(p);
    }return out;
  }
  function openBox(s,events,i){
    s.chests++;const letter='BIRZZLE'[s.letters.length];s.letters.push(letter);s.timeLeft+=5;event(events,'box',{index:i,letter});
    if(s.letters.length===7){s.letters=[];s.timeLeft+=20;const options=s.board.flatMap((b,j)=>b?.kind==='bird'&&!b.special&&!b.lock?[j]:[]);
      for(let k=0;k<3&&options.length;k++){const p=options.splice(random(s,options.length),1)[0];s.board[p].special=SPECIALS[1+random(s,3)];}
      event(events,'reward',{text:'BIRZZLE！超能伙伴 +20 秒'});
    }
  }
  function clear(s,charges,events){
    const index=new Map(s.board.flatMap((b,i)=>b?[[b.uid,i]]:[])),hit=new Set(),blast=new Set(),anchors=new Map(),triggers=[],removed=[],damage=new Map();let largest=0;
    for(const charge of charges){const cells=charge.uids.map(id=>index.get(id)).filter(i=>i!==undefined);if(cells.length<3)continue;
      largest=Math.max(largest,cells.length);cells.forEach(i=>hit.add(i));const kind=tier(cells.length),eligible=cells.filter(i=>!s.board[i].lock&&!s.board[i].special);
      if(kind&&eligible.length){const p=index.get(charge.anchor);anchors.set(eligible.includes(p)?p:eligible[0],kind);}
      for(const i of cells)for(const p of neighbors(s,i))if(s.board[p]?.kind==='ice')damage.set(p,(damage.get(p)||0)+1);
    }
    for(const i of damage.keys())if(s.board[i]?.loot==='bomb'&&damage.get(i)>=s.board[i].hp)hit.add(i);
    const processed=new Set();
    // Set iteration visits newly appended targets, so every chained power fires once.
    for(const i of hit){const b=s.board[i];if(!b||processed.has(i))continue;processed.add(i);const special=b.special||(b.kind==='ice'&&b.loot==='bomb'?'glow':'');
      if(special){triggers.push({index:i,special,color:b.color});for(const p of area(s,i,special)){hit.add(p);blast.add(p);}}
    }
    for(const p of blast)if(s.board[p]?.kind==='ice')damage.set(p,2);
    let count=0;
    for(const i of hit){const b=s.board[i];if(!b||anchors.has(i)||b.kind==='ice')continue;
      if(b.kind==='box'){if(blast.has(i)){openBox(s,events,i);removed.push({index:i,tile:{...b}});s.board[i]=null;}continue;}
      if(b.lock&&!blast.has(i)){b.lock--;event(events,'unlock',{index:i});continue;}
      removed.push({index:i,tile:{...b}});s.board[i]=null;count++;
    }
    for(const [i,n]of damage){const b=s.board[i];if(!b||b.kind!=='ice')continue;b.hp=Math.max(0,b.hp-n);event(events,'icehit',{index:i});if(!b.hp){
      if(b.loot==='clock'){s.timeLeft+=6;event(events,'reward',{text:'+6 秒'});}if(b.loot==='egg'){s.eggs++;s.score+=1000;event(events,'reward',{text:'救出金蛋！'});}
      removed.push({index:i,tile:{...b}});s.board[i]=null;s.iceBroken++;
    }}
    for(const [i,kind]of anchors)if(s.board[i]){s.board[i].special=kind;event(events,'create',{index:i,special:kind,uid:s.board[i].uid});}
    if(count||damage.size){s.combo=s.clock<=s.comboUntil?s.combo+1:1;s.comboUntil=s.clock+2;s.cleared+=count;s.levelCleared+=count;
      const gain=Math.round(Math.max(1,largest-2)**2*100*Math.min(64,Math.pow(1.5,s.combo-1))*(s.feverUntil>s.clock?2:1));s.score=Math.min(1e12,s.score+gain);
      if(s.mode==='fever'){s.fever+=12;if(s.fever>=100){s.fever=0;s.feverUntil=s.clock+10;event(events,'reward',{text:'狂热！10 秒双倍分'});}}
      event(events,'clear',{removed,triggers,count,combo:s.combo,gain,largest});
    }
    s.charges=s.charges.filter(g=>!charges.includes(g));gravity(s,events);scan(s);
    if(s.mode!=='ice')while(s.levelCleared>=threshold(s)){s.levelCleared-=threshold(s);s.level++;event(events,'level',{level:s.level});}s.supplyLeft=.4;
  }
  function addBox(s,events){
    let boxes=0;for(const b of s.board)if(b?.kind==='box'&&++boxes>=2)return;const cols=[];for(let c=0;c<7;c++)if(landing(s,c)>=0)cols.push(c);if(!cols.length)return;
    const col=cols[random(s,cols.length)],i=landing(s,col),b=tile(s,-1,'box');s.board[i]=b;event(events,'drop',{moved:[{uid:b.uid,from:col-7,to:i}]});
  }
  function drop(s,events){const moved=[];for(let c=0;c<7;c++){const i=landing(s,c);if(i<0)continue;const b=s.next[c];s.board[i]=b;moved.push({uid:b.uid,from:c-7,to:i});s.next[c]=nextBird(s);}if(moved.length)event(events,'drop',{moved});scan(s);}
  function iceWave(s,events,initial=false){
    const rows=Math.min(4,3+Math.floor((s.wave-1)/4));
    if(!initial){if(s.board.slice(0,rows*7).some(Boolean)){s.phase='lost';return;}s.board.splice(0,rows*7);s.board.push(...Array(rows*7).fill(null));s.timeLeft+=21;}
    for(let i=s.board.length-rows*7;i<s.board.length;i++){const c=i%7,r=Math.floor(i/7);if((c+r+s.wave)%3===0){const b=tile(s,-1,'ice');b.hp=s.wave>=3&&random(s,4)===0?2:1;b.loot=['','clock','egg','bomb'][random(s,4)];s.board[i]=b;}else safeFill(s,i);}
    const objective=s.board.length-rows*7+3;s.board[objective]=tile(s,-1,'ice');s.board[objective].loot='egg';event(events,'wave',{wave:s.wave,rows});gravity(s,events);scan(s);
  }
  function tick(s,dt){
    const events=[];if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return{ok:false,events};dt=Math.min(dt,1);s.clock+=dt;s.shotLeft=Math.max(0,s.shotLeft-dt);s.supplyLeft=Math.max(0,s.supplyLeft-dt);
    if(s.timeLeft!==null)s.timeLeft=Math.max(0,s.timeLeft-dt);if(s.comboUntil<s.clock)s.combo=0;
    const ready=s.charges.filter(g=>g.at<=s.clock);if(ready.length)clear(s,ready,events);
    if(s.timeLeft===0){s.phase=s.mode==='ice'?'lost':'won';event(events,'end');return{ok:true,events};}
    if(s.mode==='classic'||s.mode==='pandora'){s.dropLeft=Math.max(-1,s.dropLeft-dt);if(s.dropLeft<=0&&!s.charges.length){drop(s,events);s.dropLeft=interval(s);if(s.mode==='pandora')addBox(s,events);}}
    if(!s.charges.length&&!s.supplyLeft){if(s.mode==='ice'){
      let ice=false;for(let i=0;i<s.board.length-14;i++)if(s.board[i]?.kind==='ice'){ice=true;break;}
      if(!ice){s.wave++;s.level=s.wave;iceWave(s,events);s.supplyLeft=.8;}
    }else{let count=0;for(const b of s.board)if(b)count++;for(let n=0;n<3&&count<21;n++){if(!rise(s,events))break;count+=7;}scanChanged(s);if(s.mode==='pandora')addBox(s,events);}}
    if(!s.charges.length&&s.board.every(Boolean)){s.phase='lost';event(events,'end');}return{ok:events.length>0,events};
  }
  function hint(s){
    if(s.phase!=='playing')return null;let best=null,value=-Infinity;
    if(s.mode==='ice'){for(let c=0;c<7;c++){const i=landing(s,c);if(i<0)continue;s.board[i]=s.next[0];const v=group(s,i).length*10+neighbors(s,i).filter(p=>s.board[p]?.kind==='ice').length;s.board[i]=null;if(v>value){value=v;best=[-1,i];}}return best;}
    for(let a=0;a<s.board.length;a++)if(selectable(s,a))for(let c=0;c<7;c++){const dest=target(s,a,c);if(dest<0)continue;const b=s.board[a];s.board[a]=null;s.board[dest]=b;const g=group(s,dest),v=g.length*10+g.filter(i=>s.board[i].special).length*15;s.board[dest]=null;s.board[a]=b;if(v>value){value=v;best=[a,dest];}}return best;
  }
  function shuffle(s){
    if(s.phase!=='playing'||s.charges.length)return{ok:false,events:[]};const positions=s.board.flatMap((b,i)=>b?.kind==='bird'&&!b.lock?[i]:[]);if(positions.length<2)return{ok:false,events:[]};
    for(let k=positions.length-1;k>0;k--){const a=positions[k],b=positions[random(s,k+1)];[s.board[a],s.board[b]]=[s.board[b],s.board[a]];}scan(s);return{ok:true,events:[{type:'shuffle'}]};
  }
  function restore(raw){
    const fail=()=>fresh();if(!raw||raw.version!==2||!MODES.includes(raw.mode)||!['gentle','normal'].includes(raw.pace)||raw.rows!==(raw.mode==='ice'?9:10))return fail();
    const s=clone(raw),finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
    if(!integer(s.seed,0,4294967295)||!integer(s.rng,0,4294967295)||!integer(s.nextId,1,1e9)||!Array.isArray(s.board)||s.board.length!==s.rows*7||!Array.isArray(s.next)||s.next.length!==7)return fail();
    const ids=new Set();for(const b of [...s.board,...s.next])if(b){
      if(!integer(b.uid,1,s.nextId-1)||ids.has(b.uid)||!['bird','ice','box'].includes(b.kind)||!integer(b.color,b.kind==='bird'?0:-1,b.kind==='bird'?7:-1)||!SPECIALS.includes(b.special)||!integer(b.lock,0,2)||!integer(b.hp,0,2)||!['','egg','clock','bomb'].includes(b.loot)||b.kind!=='bird'&&(b.special||b.lock)||b.kind==='ice'&&s.mode!=='ice'||b.kind==='box'&&s.mode!=='pandora')return fail();ids.add(b.uid);
    }
    if(s.next.some(b=>!b||b.kind!=='bird'))return fail();for(const k of ['level','wave'])if(!integer(s[k],1,1e6))return fail();
    for(const k of ['score','cleared','moves','combo','eggs','iceBroken','chests','levelCleared','fever'])if(!integer(s[k],0,1e12))return fail();
    for(const k of ['clock','comboUntil','feverUntil','shotLeft','supplyLeft'])if(!finite(s[k],0,1e12))return fail();
    if(!finite(s.dropLeft,-1,30)||!['playing','won','lost'].includes(s.phase)||!Array.isArray(s.letters)||s.letters.length>6||s.letters.join('')!=='BIRZZLE'.slice(0,s.letters.length))return fail();
    if(['ice','pandora','fever'].includes(s.mode)?!finite(s.timeLeft,0,1e9):s.timeLeft!==null)return fail();if(!Array.isArray(s.charges)||s.charges.length>24)return fail();
    const charged=new Set(),onBoard=new Set(s.board.filter(Boolean).map(b=>b.uid));for(const g of s.charges){if(!g||!Array.isArray(g.uids)||g.uids.length<3||g.uids.length>s.board.length||!finite(g.at,s.clock-1,s.clock+1)||!g.uids.includes(g.anchor))return fail();for(const id of g.uids){if(charged.has(id)||!onBoard.has(id))return fail();charged.add(id);}}
    const clean=fresh(s.mode,s.seed,s.pace);for(const k of Object.keys(clean))clean[k]=s[k];scan(clean);return clean;
  }
  const api={COLS,MODES,SPECIALS,WINDOW,clone,fresh,restore,neighbors,top,landing,selectable,exposed,group,groups,colors,interval,threshold,tier,target,move,shoot,tick,hint,shuffle,scan,area};
  if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BirdCore=api;
})(typeof window==='object'?window:null);
