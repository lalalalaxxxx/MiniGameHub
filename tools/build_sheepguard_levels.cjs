'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../games/sheepguard/core.js');
let seed=731928;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const shuffle=a=>a.map(x=>[random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
const result={guard:[],escort:[]},names=['溪边小径','风车草坡','石头花园','松林岔路','绕弯牧场','双桥山谷','月牙草地','秘密小路','云朵山丘','回家之约'];
for(const mode of Object.keys(result))for(let index=0;index<C.modes[mode].count;index++){
  let chosen;
  for(let attempt=0;attempt<10000&&!chosen;attempt++){
    const n=index<10?5:7,cut=index<3?1:2+Math.floor(random()*(n-3)),rocks=[];
    for(let p=0;p<n*n;p++)if(random()<(index<2?.53:.27))rocks.push(p);
    const left=[],right=[];for(let p=0;p<n*n;p++)if(!rocks.includes(p))(p%n<=cut?left:right).push(p);
    if(left.length<3||right.length<4)continue;
    const wolves=shuffle(left).slice(0,index>=15?2:1),pick=shuffle(right),sheep=pick.slice(0,index>=7?2:1),pen=mode==='escort'?pick[sheep.length]:null;
    let sockets=[];for(let row=0;row<n;row++){const a=row*n+cut,b=a+1;if(!rocks.includes(a)&&!rocks.includes(b))sockets.push(C.edge(a,b));}
    const wanted=index<3?1:index<10?2:index<20?3:4;if(sockets.length!==wanted)continue;
    const extra=[];for(let p=0;p<n*n;p++)if(p%n<n-1&&!rocks.includes(p)&&!rocks.includes(p+1)&&!sockets.includes(C.edge(p,p+1)))extra.push(C.edge(p,p+1));
    sockets.push(...shuffle(extra).slice(0,index<2?1:index<7?4:7));
    let l={n,rocks,wolves,sheep,pen,sockets,budget:wanted,title:names[index%10]};
    if(C.check(l,[]).reason!=='wolf'||sheep.some(p=>!C.path(l,wolves[0],[p])))continue;
    // Require the designed split to retain every sheep's route to the pen.
    const certificate=sockets.slice(0,wanted);if(!C.check(l,certificate).ok)continue;
    if(wanted>1&&C.solve({...l,budget:wanted-1}))continue;
    // Rotate layouts for horizontal and vertical bottlenecks, without tiny
    // overlapping perpendicular socket targets on touch screens.
    const turns=index%4,rotate=p=>{let x=p%n,y=Math.floor(p/n);for(let k=0;k<turns;k++)[x,y]=[n-1-y,x];return y*n+x;};
    l={...l,rocks:rocks.map(rotate),wolves:wolves.map(rotate),sheep:sheep.map(rotate),pen:pen===null?null:rotate(pen),sockets:sockets.map(e=>C.edge(...e.split('-').map(Number).map(rotate)))};
    chosen={...l,solution:certificate.map(e=>C.edge(...e.split('-').map(Number).map(rotate)))};
  }
  if(!chosen)throw Error(`Could not generate ${mode} ${index}`);result[mode].push(chosen);
}
const target=path.resolve(__dirname,'../games/sheepguard/levels.js');
fs.writeFileSync(target,'// Deterministic, solver-verified levels. Rebuild with tools/build_sheepguard_levels.cjs.\n(function(root){const levels='+JSON.stringify(result)+';if(typeof module==="object"&&module.exports)module.exports=levels;else root.SheepLevels=levels;})(typeof globalThis!=="undefined"?globalThis:this);\n');
console.log('Generated 30 guard + 20 escort levels; minimal budgets and safe home routes verified.');
