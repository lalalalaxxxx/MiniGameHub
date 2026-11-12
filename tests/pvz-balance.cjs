'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../games/pvz/core');
function arena(level=9,deck=[]){const s=C.fresh(level,37,deck);C.start(s);s.sun=9990;s.waveIn=10000;s.graves=[];return s;}
function run(s,seconds,step=1/60){const events=[];for(let n=0;n<Math.round(seconds/step);n++)events.push(...C.tick(s,step));return events;}
function pea(s,z){s.shots.push({id:s.nextId++,type:'peashooter',row:z.row,y:z.row,x:z.x-.04,from:z.x-.04,age:0,life:4,damage:20,vx:3.6,vy:0});C.tick(s,1/60);}
const baseType=t=>({ducky1:'zombie',ducky2:'cone',ducky3:'bucket'}[t]||t);

test('classic combat: 10/28/65 peas remove attacking ability, with intact armour accounting',()=>{
 for(const [type,hits] of [['zombie',10],['cone',28],['bucket',65]]){
  const s=arena(),z=C.spawn(s,type,2,5);z.freeze=100;
  for(let n=1;n<hits;n++){pea(s,z);assert.equal(z.headless,false,type+' before threshold');}
  pea(s,z);assert.equal(z.headless,true,type);assert(z.hp>0,'losing head is not instant removal');
  assert.equal(z.armor,0);assert.equal(z.action,'walk');assert.deepEqual(C.restore(s),s);
  run(s,5);assert(!s.zombies.some(other=>other.id===z.id),'headless actor decays even when frozen');
 }
});

test('headless zombies cannot eat, summon, jump, steal a mower or enter the house',()=>{
 for(const type of ['zombie','pole','dancer','jack']){
  const s=arena(19,['wallnut']);assert(C.plantAt(s,'wallnut',2,2));const p=s.plants[0],z=C.spawn(s,type,2,2.6);
  z.hp=C.zombies[type].hp/3-1;run(s,1);assert.equal(p.hp,4000,type);assert.equal(z.headless,true);assert.equal(s.zombies.length,1);assert.equal(z.jumped,false);
  z.x=-.2;C.tick(s,.1);assert.equal(s.phase,'running');assert(!s.mowers.some(m=>m.active||m.spent));assert(!s.zombies.includes(z));
 }
 for(const type of ['gargantuar','zomboni','catapult','boss','bungee','balloon']){
  const s=arena(),z=C.spawn(s,type,2,8);z.hp=100;C.tick(s,.01);assert.equal(z.headless,false,type+' retains its own special death rules');
 }
});

test('classic pacing: shot jitter, sunflower production and progressively slower sky sun',()=>{
 const s=arena(9,['peashooter','sunflower']);assert(C.plantAt(s,'peashooter',2,0));assert(C.plantAt(s,'sunflower',1,0));
 const flower=s.plants.find(p=>p.type==='sunflower');assert(flower.cd>=3&&flower.cd<=12.5);
 const z=C.spawn(s,'gargantuar',2,8);z.freeze=1000;const shots=[],suns=[];
 for(let n=0;n<8000;n++){const e=C.tick(s,.01);if(e.some(e=>e.kind==='shot'))shots.push(s.time);if(e.some(e=>e.kind==='produce'))suns.push(s.time);for(const sun of [...s.suns])C.collect(s,sun.id);}
 const intervals=shots.slice(1).map((t,n)=>t-shots[n]);assert(intervals.length>20);assert(intervals.every(t=>t>=1.359&&t<=1.511));assert(new Set(intervals.map(t=>t.toFixed(2))).size>4);
 assert(suns.length>=3);assert(suns[0]>=3&&suns[0]<=12.51);for(let n=1;n<suns.length;n++)assert(suns[n]-suns[n-1]>=23.499&&suns[n]-suns[n-1]<=25.011);
 const sky=arena();assert(sky.sunIn>=4.25&&sky.sunIn<7);
 for(let n=0;n<60;n++){sky.sunIn=0;C.tick(sky,.01);const base=Math.min(9.5,4.25+n*.1);assert(sky.sunIn>=base&&sky.sunIn<=base+2.75);for(const sun of [...sky.suns])C.collect(sky,sun.id);}
 assert.equal(sky.sunDrops,60);assert(sky.sunIn>=9.5&&sky.sunIn<=12.25);
});

test('all wave plans obey budgets, specialist gates, terrain and per-wave caps across seeds',()=>{
 for(let level=1;level<=49;level++)for(let seed=1;seed<=24;seed++){
  const s=arena(level);s.rng=seed;const info=C.levelInfo(level);if(info.mode==='vases')continue;
  for(let wave=1;wave<=info.waves;wave++){
   const plan=C.wavePlan(s,wave),counts={},flag=info.waves>=10&&(wave%10===0||wave===info.waves);
   assert(plan.entries.length>0&&plan.entries.length<=40);let cost=0;
   for(const q of plan.entries){
    const type=baseType(q.type),spec=C.encounters[type];cost+=spec.cost;counts[type]=(counts[type]||0)+1;
    assert(spec.debut<=level||info.mode==='whack');assert(wave>=spec.firstWave||info.mode==='whack');assert(info.lanes.includes(q.row));
    assert.equal(!!C.zombies[q.type].water,C.water(s,q.row),level+' '+q.type+' terrain');assert.equal(q.wave,wave);
   }
   assert.equal(cost,plan.spent);assert(cost<=plan.budget);assert.equal(plan.budget,C.waveBudget(s,wave));
   for(const [type,count] of Object.entries(counts))assert(count<=C.encounters[type].cap*(flag?2:1));
   if(info.mode==='normal'&&!info.little&&wave===1)assert.equal(cost,1,'opening remains one basic enemy');
   if(flag)assert.equal(counts.flag,1);s.introduced=[...new Set([...s.introduced,...plan.types])];
  }
 }
});

test('specialists have deliberate introductions and cannot appear before their counters unlock',()=>{
 assert(!C.enemyPool(C.fresh(4)).includes('pole'));assert(!C.enemyPool(C.fresh(31)).includes('balloon'));assert(!C.enemyPool(C.fresh(41)).includes('ladder'));
 for(const [level,type] of [[6,'pole'],[16,'football'],[33,'balloon'],[48,'gargantuar']]){
  const s=arena(level),spec=C.encounters[type];let appeared=false;
  for(let wave=1;wave<=C.levelInfo(level).waves;wave++){
   const plan=C.wavePlan(s,wave);if(plan.types.includes(type)){assert(wave>=spec.firstWave);appeared=true;}
   s.introduced=[...new Set([...s.introduced,...plan.types])];
  }
  assert(appeared,type+' gets an introduction within the level');
 }
});

test('waves advance on current-wave health only, after grace plus delay, or by timeout',()=>{
 const s=arena();s.waveIn=0;C.tick(s,.01);assert.equal(s.wave,1);assert(s.waveIn>=25&&s.waveIn<=31);
 const z=s.zombies[0];z.freeze=100;z.hp=148.5;s.waveTrigger=.6;
 const old=C.spawn(s,'gargantuar',4,8);old.wave=0;old.freeze=100;
 run(s,3.8);assert(s.waveIn>20);run(s,.3);assert(s.waveIn<=2&&s.waveIn>1.8);assert.equal(s.wave,1);
 run(s,1.6);assert.equal(s.wave,1);run(s,.5);assert.equal(s.wave,2);
 const t=arena();t.waveIn=0;C.tick(t,.01);const first=t.zombies[0];first.freeze=100;run(t,24);assert.equal(t.wave,1);run(t,7.1);assert.equal(t.wave,2);assert(t.zombies.includes(first));
});

test('flag warning lasts 7.5 seconds and survives saves without replaying the warning',()=>{
 const s=arena();s.wave=9;s.waveIn=.1;s.waveAge=20;
 const events=C.tick(s,.1);assert.equal(s.wave,9);assert.equal(s.waveWarning,true);assert.equal(s.waveIn,7.5);assert.equal(events.filter(e=>e.kind==='hugewave').length,1);
 run(s,3);const copy=C.restore(s);assert.deepEqual(copy,s);assert(copy);
 const a=run(s,4),b=run(copy,4);assert.deepEqual(a,b);assert.deepEqual(copy,s);assert.equal(s.wave,9);assert(!a.some(e=>e.kind==='hugewave'));
 run(s,.6);assert.equal(s.wave,10);assert.equal(s.waveWarning,false);
});

test('pending wave health prevents early advancement; actor caps defer rather than discard spawns',()=>{
 const s=arena();s.wave=4;s.waveIn=0;for(let n=0;n<100;n++){const z=C.spawn(s,'zombie',n%5,8);z.freeze=100;}
 C.tick(s,.01);assert.equal(s.wave,5);assert(s.spawnQueue.length);assert.equal(s.spawned,0);const pending=s.spawnQueue.length;
 run(s,6);assert.equal(s.wave,5);assert.equal(s.spawnQueue.length,pending);assert.equal(s.spawned,0);
 s.zombies.splice(0,2);C.tick(s,.01);assert(s.spawned>0);assert.equal(s.spawnQueue.length+s.spawned,pending);
});

test('a thrown imp belongs to its parent wave, not the newer wave',()=>{
 const s=arena(49);s.wave=15;const giant=C.spawn(s,'gargantuar',2,8);
 s.wave=16;giant.hp=1400;C.tick(s,.01);
 const imp=s.zombies.find(z=>z.type==='imp');assert(imp);assert.equal(imp.wave,15);
});

test('old saves migrate without losing plants, resources, queued enemies or progress',()=>{
 const old=arena(29,['sunflower']);assert(C.plantAt(old,'sunflower',0,0));C.spawn(old,'bucket',0,7);old.wave=5;old.waveIn=12;old.spawnQueue=[{type:'cone',row:0,in:1.2}];old.time=150;old.coins=40;
 for(const k of ['balance','sunDrops','waveAge','waveHealth','waveTrigger','waveWarning','introduced'])delete old[k];
 for(const z of old.zombies){delete z.headless;delete z.wave;}
 const before=C.clone(old),restored=C.restore(old);assert(restored);assert.deepEqual(old,before,'migration is pure');
 assert.deepEqual(restored.plants,old.plants);for(const k of ['sun','coins','time','wave','waveIn','level','rng'])assert.equal(restored[k],old[k]);assert.equal(restored.spawnQueue[0].type,'cone');assert.equal(restored.spawnQueue[0].in,1.2);
 assert.deepEqual(C.restore(restored),restored);run(restored,1.3);assert(restored.zombies.some(z=>z.type==='cone'));
 for(const bad of [{balance:99},{waveTrigger:NaN},{waveHealth:-1},{waveWarning:1},{introduced:['unknown']},{sunDrops:-1}])assert.equal(C.restore({...restored,...bad}),null);
});
