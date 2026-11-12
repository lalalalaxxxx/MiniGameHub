'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../games/pvz/core');
const advance=(s,seconds)=>{const events=[];for(let n=0;n<Math.ceil(seconds*60);n++)events.push(...C.tick(s,1/60));return events;};
function arena(level=49,deck=['peashooter']){const s=C.fresh(level,42,deck);C.start(s);s.sun=9990;s.waveIn=10000;s.graves=[];return s;}
function put(s,type,row,col){if(!s.deck.includes(type))s.deck.push(type);s.cooldowns[type]=0;assert(C.plantAt(s,type,row,col),`plant ${type} ${row},${col}`);return s.plants.at(-1);}

test('PvZ: paid planting, cooldowns, occupancy, sun pickup and shovel layers',()=>{
 const s=arena(21,['lilypad','peashooter','pumpkin']);assert(!C.plantAt(s,'peashooter',2,1));const pad=put(s,'lilypad',2,1);put(s,'peashooter',2,1);put(s,'pumpkin',2,1);
 assert(!C.canPlant(s,'peashooter',2,1));assert(C.shovel(s,2,1));assert.equal(C.at(s,2,1).length,2);assert(C.shovel(s,2,1));assert.equal(C.at(s,2,1)[0].id,pad.id);
 assert(!C.plantAt(s,'lilypad',2,3));advance(s,7.6);assert(C.plantAt(s,'lilypad',2,3));
 s.suns.push({id:99,x:3,y:2,toY:2,value:25,age:0});s.sun=0;assert(C.collect(s,99));assert.equal(s.sun,25);assert(!C.collect(s,99));
});
test('PvZ: roof pots, sleeping mushrooms and coffee',()=>{
 const s=arena(49,['flowerpot','puffshroom','coffeebean']);assert(!C.canPlant(s,'puffshroom',0,5));put(s,'flowerpot',0,5);const p=put(s,'puffshroom',0,5);const z=C.spawn(s,'zombie',0,7);advance(s,2);assert.equal(s.shots.length,0);put(s,'coffeebean',0,5);advance(s,1.1);assert(p.awake);advance(s,.5);assert(z.hp<270);
});
test('PvZ: real projectiles hit only after travel, nearest enemy absorbs damage',()=>{
 const s=arena(9,['peashooter']);put(s,'peashooter',2,1);const front=C.spawn(s,'zombie',2,5),back=C.spawn(s,'zombie',2,7);C.tick(s,1/60);assert(s.shots.length);assert.equal(front.hp,270);advance(s,1);assert(front.hp<270);assert.equal(back.hp,270);
});
test('PvZ: armor, piercing fumes, slowing peas and lobbed butter',()=>{
 const s=arena(19,['fumeshroom']);put(s,'fumeshroom',2,2);const z=C.spawn(s,'door',2,4);C.tick(s,1/60);assert.equal(z.armor,1100);assert.equal(z.hp,250);
 const slow=arena(9,['snowpea']);put(slow,'snowpea',2,2);const cone=C.spawn(slow,'cone',2,4);advance(slow,.6);assert(cone.slow>0);assert.equal(cone.hp,270);assert(cone.armor<370);
 const roof=arena(49,['cabbagepult']);put(roof,'cabbagepult',2,1);const target=C.spawn(roof,'door',2,7);advance(roof,1);assert(target.hp<270);assert.equal(target.armor,1100);
});
test('PvZ: mines arm before triggering, squash jumps and chomper digests',()=>{
 const s=arena(9,['potatomine']);const mine=put(s,'potatomine',2,3);const z=C.spawn(s,'zombie',2,3.9);advance(s,.2);assert(z.hp>0);mine.age=14;advance(s,.2);assert(z.hp>0);mine.age=15;advance(s,.1);assert(!s.zombies.length);assert(!s.plants.length);
 const q=arena(24,['squash']);put(q,'squash',0,3);C.spawn(q,'bucket',0,4);advance(q,.8);assert(!q.zombies.length);assert(!q.plants.length);
 const c=arena(9,['chomper']);const p=put(c,'chomper',2,3);C.spawn(c,'zombie',2,3.9);advance(c,.1);assert(!c.zombies.length);assert(p.cd>40);
});
test('PvZ: cherry splash, chili lane and ice mushroom freeze',()=>{
 const s=arena(19,['cherrybomb']);put(s,'cherrybomb',2,3);C.spawn(s,'bucket',2,4);const far=C.spawn(s,'zombie',0,7);advance(s,1.2);assert.equal(s.zombies.length,1);assert.equal(s.zombies[0].id,far.id);
 const q=arena(29,['jalapeno']);put(q,'jalapeno',0,1);C.spawn(q,'bucket',0,7);C.spawn(q,'zombie',1,7);advance(q,1.1);assert.equal(q.zombies.length,1);assert.equal(q.zombies[0].row,1);
 const n=arena(19,['iceshroom']);put(n,'iceshroom',0,1);const target=C.spawn(n,'football',4,7);advance(n,1.1);assert(target.freeze>3);const x=target.x;advance(n,.5);assert.equal(target.x,x);
});
test('PvZ: pole vaults once, tall nuts stop jumping, balloon requires anti-air',()=>{
 const s=arena(29,['wallnut']);put(s,'wallnut',0,3);const pole=C.spawn(s,'pole',0,3.95);advance(s,1.3);assert(pole.jumped);assert(pole.x<3);
 const q=arena(29,['tallnut']);const nut=put(q,'tallnut',0,3);const p=C.spawn(q,'pole',0,3.9);advance(q,1);assert(!p.jumped);assert(nut.hp<8000);
 const air=arena(34,['peashooter','cactus']);put(air,'peashooter',0,1);const z=C.spawn(air,'balloon',0,4);advance(air,.5);assert.equal(air.shots.length,0);put(air,'cactus',0,2);advance(air,.6);assert.equal(z.air,false);
});
test('PvZ: hypno turns an eater around, magnet strips armor, umbrella blocks theft',()=>{
 const s=arena(19,['hypnoshroom']);put(s,'hypnoshroom',0,3);const z=C.spawn(s,'zombie',0,3.8);advance(s,.1);assert(z.ally);assert.equal(z.dir,1);
 const q=arena(39,['magnetshroom']);put(q,'magnetshroom',0,3);const bucket=C.spawn(q,'bucket',0,5);advance(q,.1);assert.equal(bucket.armor,0);
 const roof=arena(49,['umbrella']);const umbrella=put(roof,'umbrella',0,1);const b=C.spawn(roof,'bungee',0,1);b.age=1;b.target=umbrella.id;advance(roof,4);assert(roof.plants.some(p=>p.id===umbrella.id));
});
test('PvZ: mowers are single-use and a later breach loses',()=>{
 const s=arena(9);const z=C.spawn(s,'zombie',2,-.2);advance(s,.2);assert(s.mowers.find(m=>m.row===2).active);assert(!s.zombies.includes(z));advance(s,3);assert(s.mowers.find(m=>m.row===2).spent);C.spawn(s,'zombie',2,-.65);advance(s,.1);assert.equal(s.phase,'lost');const snapshot=C.clone(s);advance(s,2);assert.deepEqual(s,snapshot);
});
test('PvZ: bowling, vase contents and whack use distinct direct actions',()=>{
 const s=C.fresh(5,3);C.start(s);advance(s,.1);assert(s.conveyor.length);assert(C.bowl(s,s.conveyor[0].type,2));assert(s.shots[0].bowling);
 const v=C.fresh(35,3);C.start(v);const vase=v.vases.find(v=>v.green);assert(C.breakVase(v,vase.id));assert(!C.breakVase(v,vase.id));assert(v.conveyor.length);assert(C.plantAt(v,v.conveyor[0].type,0,0));
 const w=C.fresh(15,3);C.start(w);const z=C.spawn(w,'zombie',0,5);assert(C.whack(w,z.id));advance(w,.1);assert(!w.zombies.length);assert(!C.whack(v,10));
});
test('PvZ: first level completes through legal play and seed reward unlock order is stable',()=>{
 const s=C.fresh(1,42);C.start(s);assert(C.plantAt(s,'peashooter',2,1));for(let n=0;n<12000&&s.phase==='running';n++){for(const sun of [...s.suns])C.collect(s,sun.id);C.tick(s,1/60);}assert.equal(s.phase,'won');assert.equal(s.killed,3);assert.deepEqual(C.available(2),['peashooter','sunflower']);assert(C.available(49).includes('melonpult'));
});
test('PvZ: all fifty levels are deterministic and running saves round-trip',()=>{
 for(let level=1;level<=50;level++){const a=C.fresh(level,1234),b=C.fresh(level,1234);C.start(a);C.start(b);for(let n=0;n<1500;n++){C.tick(a,1/60);C.tick(b,1/60);}assert.deepEqual(a,b,'level '+level);assert.deepEqual(C.restore(a),a,'restore '+level);}
});
test('PvZ: malformed saves fail closed without throwing',()=>{
 const s=C.fresh(1,42);for(const bad of [null,{}, {...s,sun:NaN},{...s,plants:[null]},{...s,mowers:[null]},{...s,shots:[{}]},{...s,vases:[{}]},{...s,spawnQueue:[{}]},{...s,suns:[null]},{...s,zombies:[{}]}])assert.equal(C.restore(bad),null);
});

test('PvZ: upgrade prerequisites, cannon footprint, coin collection and imitater transformation',()=>{
 const s=arena(49,['kernelpult','cobcannon']);put(s,'kernelpult',0,0);assert(!C.canPlant(s,'cobcannon',0,0));put(s,'kernelpult',0,1);const cannon=put(s,'cobcannon',0,0);assert.equal(C.at(s,0,1).find(p=>p.type==='cobcannon').id,cannon.id);assert(!C.canPlant(s,'kernelpult',0,1));assert(C.cannon(s,cannon.id,1,5));assert(!C.cannon(s,cannon.id,1,5));
 const q=arena(9,['imitater']);q.imitate='wallnut';const before=q.sun;put(q,'imitater',2,2);assert.equal(q.sun,before-50);advance(q,3);assert.equal(q.plants[0].type,'imitater');advance(q,.3);assert.equal(q.plants[0].type,'wallnut');assert.equal(q.plants[0].hp,4000);
 q.suns.push({id:77,x:1,y:0,toY:0,age:0,value:10,currency:'coin'});const sun=q.sun;assert(C.collect(q,77));assert.equal(q.sun,sun);assert.equal(q.coins,10);
 const pool=arena(29,['imitater','lilypad','peashooter']);pool.imitate='lilypad';put(pool,'imitater',2,2);assert(!C.canPlant(pool,'lilypad',2,2));put(pool,'peashooter',2,2);advance(pool,3.3);assert.equal(C.at(pool,2,2).length,2);
 const armor=arena(39,['imitater','pumpkin','peashooter']);armor.imitate='pumpkin';put(armor,'peashooter',0,0);put(armor,'imitater',0,0);assert(!C.canPlant(armor,'pumpkin',0,0));advance(armor,3.3);assert.equal(C.at(armor,0,0).length,2);
});

test('PvZ: cannon travels before blast, frozen actors stop animating, and boss balls have opposite counters',()=>{
 const s=arena(49,['kernelpult','cobcannon']);put(s,'kernelpult',0,0);put(s,'kernelpult',0,1);const p=put(s,'cobcannon',0,0),z=C.spawn(s,'bucket',1,5);assert(C.cannon(s,p.id,1,5));const hp=z.hp+z.armor;advance(s,1);assert.equal(z.hp+z.armor,hp);advance(s,1);assert(z.hp<=0);
 const n=arena(9);const f=C.spawn(n,'zombie',0,8);f.freeze=2;advance(n,1);assert.equal(f.animTime,0);f.freeze=0;f.slow=2;advance(n,1);assert(Math.abs(f.animTime-.5)<.02);
 for(const [type,cleared] of [['iceshroom','fire'],['jalapeno','ice']]){const b=arena(50);b.conveyor=[{id:b.nextId++,type}];b.bossBalls=[{row:0,x:8,type:'fire',age:0},{row:0,x:7,type:'ice',age:0}];assert(C.plantAt(b,type,0,0));advance(b,1.2);assert(!b.bossBalls.some(ball=>ball.type===cleared));assert(b.bossBalls.some(ball=>ball.type!==cleared));}
});
