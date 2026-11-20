(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./levels.js'));else root.SheepCore=factory(root.SheepLevels);})(typeof globalThis!=='undefined'?globalThis:this,function(levels){
  'use strict';
  const modes={guard:{name:'基础守护',count:30},escort:{name:'护送进阶',count:20}};
  const edge=(a,b)=>a<b?`${a}-${b}`:`${b}-${a}`;
  function neighbors(l,p){return [p-l.n,p+l.n,p%l.n?p-1:-1,p%l.n<l.n-1?p+1:-1].filter(q=>q>=0&&q<l.n*l.n&&!l.rocks.includes(q));}
  function path(l,start,goals,fences=[]){
    const blocked=new Set(fences),targets=new Set(goals),seen=new Map([[start,null]]),queue=[start];
    for(let i=0;i<queue.length;i++){const p=queue[i];if(targets.has(p)){const route=[];for(let q=p;q!==null;q=seen.get(q))route.unshift(q);return route;}for(const q of neighbors(l,p))if(!seen.has(q)&&!blocked.has(edge(p,q))){seen.set(q,p);queue.push(q);}}
    return null;
  }
  function check(l,fences=[]){
    if(!Array.isArray(fences)||new Set(fences).size!==fences.length||fences.length>l.budget||fences.some(e=>!l.sockets.includes(e)))return {ok:false,reason:'invalid',routes:[]};
    for(const wolf of l.wolves){const route=path(l,wolf,l.sheep,fences);if(route)return {ok:false,reason:'wolf',route,routes:[]};}
    const routes=l.sheep.map(p=>l.pen===null?[p]:path(l,p,[l.pen],fences));
    if(routes.some(p=>!p))return {ok:false,reason:'home',routes:[]};
    return {ok:true,reason:'safe',routes};
  }
  // Branch on every removable edge of a real unsafe route. Every valid cut must
  // hit that route; pruning an already severed home route is monotonic and safe.
  function solve(l,initial=[]){
    const visited=new Set();
    function visit(f){const key=f.slice().sort().join(',');if(visited.has(key))return null;visited.add(key);
      if(l.pen!==null&&l.sheep.some(p=>!path(l,p,[l.pen],f)))return null;
      const result=check(l,f);if(result.ok)return f;if(result.reason!=='wolf'||f.length>=l.budget)return null;
      for(let i=1;i<result.route.length;i++){const e=edge(result.route[i-1],result.route[i]);if(l.sockets.includes(e)){const answer=visit([...f,e]);if(answer)return answer;}}return null;
    }
    return check(l,initial).reason==='invalid'?null:visit(initial);
  }
  const level=(mode,index)=>levels[mode][index];
  const freshRound=()=>({level:0,fences:[],won:false});
  const fresh=()=>({version:1,mode:'guard',sound:true,rounds:{guard:freshRound(),escort:freshRound()},stars:{guard:[],escort:[]}});
  function restore(raw){const s=fresh();if(!raw||typeof raw!=='object')return s;s.mode=Object.hasOwn(modes,raw.mode)?raw.mode:'guard';s.sound=raw.sound!==false;
    for(const m of Object.keys(modes)){const r=raw.rounds?.[m];if(r&&Number.isInteger(r.level)&&r.level>=0&&r.level<modes[m].count){const l=level(m,r.level),f=Array.isArray(r.fences)?r.fences:[];if(check(l,f).reason!=='invalid')s.rounds[m]={level:r.level,fences:f.slice(),won:r.won===true&&check(l,f).ok};}
      if(Array.isArray(raw.stars?.[m]))s.stars[m]=[...new Set(raw.stars[m].filter(i=>Number.isInteger(i)&&i>=0&&i<modes[m].count))];
    }return s;
  }
  return {modes,levels,edge,neighbors,path,check,solve,level,fresh,restore};
});
