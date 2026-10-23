// A reproducible budget-respecting strategy, also used to regression-test balance.
const C=require('../assets/js/defense-core.js');
function prepare(s,mode='mixed'){
 const garden=s.id==='gardenwatch',base=garden?[0,8,16,24,32]:[9,11,13,25,27,29];
 for(const cell of base)C.build(s,cell,0);
 if(mode==='idle')return;
 if(mode==='mixed'){
  const extra=garden?[17,25,33,1,9,18,26,34,2,10]:[10,12,26,28,14,30];
  for(let i=0;i<extra.length;i++)C.build(s,extra[i],garden?i<5?1:2:i%2?2:1);
 }
 for(let level=1;level<3;level++)for(const t of s.towers)if(t.level===level)C.upgrade(s,t.cell);
}
function simulate(id,difficulty,mode){const s=C.fresh(id,difficulty),log=[];let ticks=0;
 while(!['won','lost'].includes(s.phase)&&ticks<30000){
  if(s.phase==='ready'){prepare(s,mode);C.start(s);}
  C.tick(s,.1);ticks++;
  if(s.phase!=='running')log.push({wave:s.wave,hearts:s.hearts,coins:s.coins});
 }
 return {state:s,log};
}
module.exports={prepare,simulate};
