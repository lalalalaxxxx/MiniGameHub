'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../games/pvz/core');
function play(level,seed,defend=true){
 const i=C.levelInfo(level),sun=i.night?'sunshroom':'sunflower',gun=i.roof?'cabbagepult':i.night?'fumeshroom':'peashooter';
 const deck=[sun,gun,i.pool?'lilypad':i.roof?'flowerpot':'wallnut',i.night?'puffshroom':'repeater',i.world===3?'cactus':'cherrybomb',i.world===3?'blover':'wallnut'];
 const s=C.fresh(level,seed,deck);C.start(s);let actions=0;
 const count=(r,t)=>s.plants.filter(p=>p.row===r&&p.type===t).length;
 function put(t,r,c){if(!C.canPlant(s,t,r,c)&&!C.at(s,r,c).length){if(i.world!=2&&(s.sun<C.plants[t].cost+25||s.cooldowns[t]>.001))return false;if(i.roof)C.plantAt(s,'flowerpot',r,c);else if(C.water(s,r))C.plantAt(s,'lilypad',r,c);}if(C.plantAt(s,t,r,c)){actions++;return true;}return false;}
 for(let n=0;n<18000&&s.phase==='running';n++){
  C.tick(s,.1);if(n%5)continue;
  for(const v of [...s.suns])C.collect(s,v.id);
  if(!defend)continue;
  const threats=i.lanes.map(row=>({row,z:s.zombies.filter(z=>z.row===row&&!z.headless&&!z.ally)})).sort((a,b)=>Math.min(20,...a.z.map(z=>z.x))-Math.min(20,...b.z.map(z=>z.x)));
  if(i.world===3&&s.zombies.some(z=>z.air&&z.x<6))for(const r of i.lanes)if(put('blover',r,7))break;
  if(i.night)for(let c=4;c<=7;c++)for(const {row} of threats)put('puffshroom',row,c);
  for(const {row,z} of threats){if(!z.length)continue;if(!count(row,gun))put(gun,row,i.night?3:2);}
  const growers=s.plants.filter(p=>p.type===sun).length;
  if(growers<10)for(let c=0;c<2;c++)for(const r of i.lanes.filter(r=>i.world===2||!C.water(s,r)))put(sun,r,c);
  for(const {row,z} of threats){
   for(const c of (i.night?[3,2,4]:[2,3,4]))put(gun,row,c);
   if(i.world===3)put('cactus',row,5);
   put('wallnut',row,6);
   if(z.some(z=>z.x<4&&z.hp+z.armor>500))for(const c of [5,6,7])if(put('cherrybomb',row,c))break;
  }
 }
 return {level,seed,phase:s.phase,time:Math.round(s.time),wave:s.wave,actions,sun:s.sun,mowers:s.mowers.filter(m=>m.spent).length};
}
// Fixed legal playthroughs are regression fixtures, not a human difficulty rating.
// No state edits: resources, cooldowns, combat and waves all come from the core.
test('classic balance: legal economy and defensive play can finish five representative worlds',t=>{
 for(const level of [9,19,29,39,49]){
  const result=play(level,1);t.diagnostic(JSON.stringify(result));
  assert.equal(result.phase,'won','representative level '+level);
  assert(result.actions>0);assert.equal(result.wave,C.levelInfo(level).waves);
 }
});
test('classic balance: unattended lawns lose despite their starting mowers',()=>{
 for(const level of [9,19,29,39,49])assert.equal(play(level,37,false).phase,'lost');
});
