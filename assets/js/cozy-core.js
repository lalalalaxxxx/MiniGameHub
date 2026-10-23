(function(root){
  const N=6,clone=o=>JSON.parse(JSON.stringify(o));
  function random(s,n){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return (s.seed>>>16)%n;}
  const neighbors=i=>[i%N?i-1:-1,i%N<N-1?i+1:-1,i>=N?i-N:-1,i<N*(N-1)?i+N:-1].filter(n=>n>=0);
  function group(board,i){const found=new Set([i]),queue=[i];while(queue.length){const at=queue.pop();for(const j of neighbors(at))if(!found.has(j)&&board[j]===board[i]){found.add(j);queue.push(j);}}return [...found];}
  function runs(board){const result=[];for(let axis=0;axis<2;axis++)for(let line=0;line<N;line++){let cells=[];for(let p=0;p<=N;p++){const i=axis?p*N+line:line*N+p;if(p<N&&(!cells.length||board[i]===board[cells[0]])){cells.push(i);continue;}if(cells.length>=3)result.push(cells);cells=p<N?[i]:[];}}return result;}
  function move(board,special=[]){for(let a=0;a<36;a++)for(const b of neighbors(a).filter(b=>b>a)){if(special[a]===2||special[b]===2)return [a,b];const next=[...board];[next[a],next[b]]=[next[b],next[a]];if(runs(next).length)return [a,b];}return null;}
  function generate(s,match){for(let trial=0;trial<100;trial++){s.board=[];s.special=Array(36).fill(0);for(let i=0;i<36;i++){let v=random(s,match?5:4);if(match)while(i%6>=2&&s.board[i-1]===v&&s.board[i-2]===v||i>=12&&s.board[i-6]===v&&s.board[i-12]===v)v=(v+1)%5;s.board.push(v);}if(match?move(s.board):s.board.some((_,i)=>group(s.board,i).length>1))return;}throw Error('Unable to create a playable board');}
  function puzzle(s,match){s.progress=[0,0];s.targets=[random(s,match?5:4),0];s.targets[1]=(s.targets[0]+1+random(s,match?4:3))%(match?5:4);s.goal=match?15:12;s.won=false;s.moves=0;generate(s,match);}
  function fresh(id){const s={version:1,id,seed:Math.floor(Math.random()*4294967296)};if(id==='toyblast'||id==='fruitgarden'){puzzle(s,id==='fruitgarden');if(id==='fruitgarden')Object.assign(s,{seeds:3,coins:0,plots:Array(6).fill(null),decor:Array(6).fill(0),owned:[0]});}else if(id==='icecream')Object.assign(s,{mode:'orders',order:0,flavors:[],topping:-1,cup:0,album:[],served:0});else Object.assign(s,{fish:[{id:1,type:0,x:30,y:40},{id:2,type:1,x:65,y:55}],nextId:3,decor:Array(15).fill(0),theme:0});return s;}
  const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  function restore(id,v){
    if(!v||v.version!==1||v.id!==id||!int(v.seed,0,4294967295))return fresh(id);
    const array=(a,n,fn)=>Array.isArray(a)&&a.length===n&&a.every(fn);
    if(id==='toyblast'||id==='fruitgarden'){
      if(!array(v.board,36,n=>int(n,0,id==='toyblast'?3:4))||!array(v.special,36,n=>int(n,0,2))||!array(v.progress,2,n=>int(n,0,100000))||!array(v.targets,2,n=>int(n,0,id==='toyblast'?3:4))||v.targets[0]===v.targets[1]||v.goal!==(id==='toyblast'?12:15)||typeof v.won!=='boolean'||!int(v.moves,0,100000)||v.won!==v.progress.every(n=>n>=v.goal))return fresh(id);
      if(id==='fruitgarden'&&(!int(v.seeds,0,1000000)||!int(v.coins,0,1000000)||!array(v.plots,6,p=>p===null||int(p.type,0,2)&&Number.isFinite(p.planted)&&p.planted>=0&&typeof p.watered==='boolean')||!array(v.decor,6,n=>int(n,0,3))||!Array.isArray(v.owned)||!v.owned.includes(0)||v.owned.length>4||!v.owned.every(n=>int(n,0,3))||!v.decor.every(n=>v.owned.includes(n))))return fresh(id);
    }else if(id==='icecream'){
      const design=d=>d&&int(d.cup,0,2)&&Array.isArray(d.flavors)&&d.flavors.length<=3&&d.flavors.every(n=>int(n,0,4))&&int(d.topping,-1,3);
      if(!['orders','free'].includes(v.mode)||!int(v.order,0,6)||!design(v)||!int(v.served,0,100000)||!Array.isArray(v.album)||v.album.length>6||!v.album.every(design))return fresh(id);
    }else if(id==='aquarium'){
      if(!Array.isArray(v.fish)||v.fish.length>8||!v.fish.every(f=>int(f.id,1,100000)&&int(f.type,0,7)&&Number.isFinite(f.x)&&f.x>=10&&f.x<=85&&Number.isFinite(f.y)&&f.y>=15&&f.y<=75)||new Set(v.fish.map(f=>f.id)).size!==v.fish.length||!int(v.nextId,1,100000)||v.fish.some(f=>f.id>=v.nextId)||!array(v.decor,15,n=>int(n,0,5))||!int(v.theme,0,2))return fresh(id);
    }else return fresh(id);
    return clone(v);
  }
  function refill(s,removed,match){for(let col=0;col<N;col++){const keep=[];for(let row=N-1;row>=0;row--){const i=row*N+col;if(!removed.has(i))keep.push([s.board[i],s.special[i]]);}for(let row=N-1;row>=0;row--){const pair=keep.shift()||[random(s,match?5:4),0];s.board[row*N+col]=pair[0];s.special[row*N+col]=pair[1];}}}
  function collect(s,cells){for(const i of cells)for(let t=0;t<2;t++)if(s.board[i]===s.targets[t])s.progress[t]++;}
  function settleWin(s){if(!s.won&&s.progress.every(n=>n>=s.goal)){s.won=true;if(s.id==='fruitgarden')s.seeds=Math.min(1000000,s.seeds+3);}}
  function blast(s,i){if(s.won||!int(i,0,35))return false;const cells=group(s.board,i);if(cells.length<2)return false;collect(s,cells);refill(s,new Set(cells),false);s.moves++;settleWin(s);if(!s.won&&!s.board.some((_,i)=>group(s.board,i).length>1))generate(s,false);return cells.length;}
  function swap(s,a,b){
    if(s.won||!int(a,0,35)||!neighbors(a).includes(b))return false;
    const snapshot=clone(s);[s.board[a],s.board[b]]=[s.board[b],s.board[a]];[s.special[a],s.special[b]]=[s.special[b],s.special[a]];
    let all=runs(s.board),forced=new Set(),made=0,total=0;
    if(s.special[a]===2||s.special[b]===2){const other=s.special[a]===2?b:a,color=s.board[other];for(let i=0;i<36;i++)if(s.board[i]===color||s.special[i]===2&&[a,b].includes(i))forced.add(i);}
    if(!all.length&&!forced.size){Object.assign(s,snapshot);return false;}
    for(let chain=0;chain<40&&(all.length||forced.size);chain++){
      const removed=new Set([...all.flat(),...forced]);forced.clear();
      let specialAt=-1,specialType=0;
      if(chain===0){const big=[...all].sort((x,y)=>y.length-x.length).find(r=>r.length>=4);if(big){specialAt=big.includes(b)?b:big[0];specialType=big.length>=5?2:1;}}
      // Expand activated special fruit until no new row or colour is added.
      const processed=new Set();for(const i of removed){if(processed.has(i))continue;processed.add(i);if(s.special[i]===1)for(let c=0;c<6;c++)removed.add(Math.floor(i/6)*6+c);if(s.special[i]===2)for(let j=0;j<36;j++)if(s.board[j]===s.board[i])removed.add(j);}
      if(specialAt>=0&&s.special[specialAt]===0){removed.delete(specialAt);s.special[specialAt]=specialType;made=specialType;}
      collect(s,removed);total+=removed.size;refill(s,removed,true);all=runs(s.board);
    }
    if(all.length)generate(s,true);
    s.moves++;settleWin(s);if(!s.won&&!move(s.board,s.special))generate(s,true);return {total,made};
  }
  const growSeconds=[60,90,120];
  function growth(plot,now=Date.now()){if(!plot)return 0;const elapsed=Math.max(0,Math.min(86400000,now-plot.planted))/1000+(plot.watered?30:0);return Math.min(1,elapsed/growSeconds[plot.type]);}
  function plant(s,i,type,now=Date.now()){if(!int(i,0,5)||!int(type,0,2)||s.plots[i]||s.seeds<=0)return false;s.seeds--;s.plots[i]={type,planted:now,watered:false};return true;}
  function harvest(s,i,now=Date.now()){if(!int(i,0,5)||!s.plots[i]||growth(s.plots[i],now)<1)return false;s.plots[i]=null;s.seeds=Math.min(1000000,s.seeds+1);s.coins=Math.min(1000000,s.coins+2);return true;}
  function order(index){return {cup:index%3,flavors:Array.from({length:1+index%3},(_,i)=>(index+i*2)%5),topping:index%4};}
  function serve(s){if(s.mode!=='orders'||s.order>=6)return false;const q=order(s.order);if(s.cup!==q.cup||s.topping!==q.topping||JSON.stringify(s.flavors)!==JSON.stringify(q.flavors))return false;s.order++;s.served++;s.flavors=[];s.topping=-1;return true;}
  const api={N,clone,random,neighbors,group,runs,move,generate,puzzle,fresh,restore,blast,swap,growth,growSeconds,plant,harvest,order,serve};if(typeof module!=='undefined')module.exports=api;else root.CozyCore=api;
})(typeof window!=='undefined'?window:globalThis);
