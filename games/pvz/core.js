/* Independent, deterministic lawn simulation. Coordinates are lawn cells, seconds and hit points. */
(function (root) {
  'use strict';
  const plants = {};
  function plant(id, name, cost, unlock, extra = {}) {
    plants[id] = { id, name, cost, unlock, hp: 300, recharge: 7.5, ...extra };
  }
  plant('peashooter','豌豆射手',100,1,{shot:20,rate:1.425});
  plant('sunflower','向日葵',50,2,{sun:25});
  plant('cherrybomb','樱桃炸弹',150,3,{recharge:50,instant:1.1});
  plant('wallnut','坚果墙',50,4,{hp:4000,recharge:30});
  plant('potatomine','土豆地雷',25,6,{recharge:30});
  plant('snowpea','寒冰射手',175,7,{shot:20,rate:1.425,ice:true});
  plant('chomper','大嘴花',150,8);
  plant('repeater','双发射手',200,9,{shot:20,rate:1.425,burst:2});
  plant('puffshroom','小喷菇',0,11,{shot:20,rate:1.425,range:3,mushroom:true});
  plant('sunshroom','阳光菇',25,12,{sun:15,mushroom:true});
  plant('fumeshroom','大喷菇',75,13,{shot:20,rate:1.425,range:4,mushroom:true,pierce:true});
  plant('gravebuster','墓碑吞噬者',75,14,{instant:4.5});
  plant('hypnoshroom','魅惑菇',75,16,{recharge:30,mushroom:true});
  plant('scaredyshroom','胆小菇',25,17,{shot:20,rate:1.425,mushroom:true});
  plant('iceshroom','寒冰菇',75,18,{recharge:50,instant:1,mushroom:true});
  plant('doomshroom','毁灭菇',125,19,{recharge:50,instant:1,mushroom:true});
  plant('lilypad','睡莲',25,21,{base:true});
  plant('squash','窝瓜',50,22,{recharge:30});
  plant('threepeater','三线射手',325,23,{shot:20,rate:1.425,lanes:3});
  plant('tanglekelp','缠绕海草',25,24,{recharge:30,water:true});
  plant('jalapeno','火爆辣椒',125,26,{recharge:50,instant:1});
  plant('spikeweed','地刺',100,27);
  plant('torchwood','火炬树桩',175,28);
  plant('tallnut','高坚果',125,29,{hp:8000,recharge:30});
  plant('seashroom','海蘑菇',0,31,{shot:20,rate:1.425,range:3,mushroom:true,water:true,recharge:30});
  plant('plantern','路灯花',25,32,{recharge:30});
  plant('cactus','仙人掌',125,33,{shot:20,rate:1.425});
  plant('blover','三叶草',100,34,{instant:.8});
  plant('splitpea','裂荚射手',125,36,{shot:20,rate:1.425});
  plant('starfruit','杨桃',125,37,{shot:20,rate:1.425});
  plant('pumpkin','南瓜头',125,38,{hp:4000,recharge:30,armor:true});
  plant('magnetshroom','磁力菇',100,39,{mushroom:true});
  plant('cabbagepult','卷心菜投手',100,41,{shot:40,rate:2.85,lob:true});
  plant('flowerpot','花盆',25,42,{base:true});
  plant('kernelpult','玉米投手',100,43,{shot:20,rate:2.85,lob:true});
  plant('coffeebean','咖啡豆',75,44,{instant:1});
  plant('garlic','大蒜',50,46,{hp:400});
  plant('umbrella','叶子保护伞',100,47);
  plant('marigold','金盏花',50,48,{recharge:30});
  plant('melonpult','西瓜投手',300,49,{shot:80,rate:2.85,lob:true,splash:true});
  plant('gatlingpea','机枪射手',250,51,{shot:20,rate:1.425,burst:4,upgrade:'repeater',recharge:50,art:'repeater'});
  plant('twinsunflower','双子向日葵',150,51,{sun:50,upgrade:'sunflower',recharge:50,art:'sunflower'});
  plant('gloomshroom','忧郁菇',150,51,{shot:20,rate:.6,mushroom:true,upgrade:'fumeshroom',recharge:50,art:'fumeshroom'});
  plant('cattail','香蒲',225,51,{shot:20,rate:.7,upgrade:'lilypad',water:true,recharge:50,art:'cactus'});
  plant('wintermelon','冰西瓜',200,51,{shot:80,rate:2.85,lob:true,splash:true,ice:true,upgrade:'melonpult',recharge:50,art:'melonpult'});
  plant('goldmagnet','吸金磁',50,51,{upgrade:'magnetshroom',recharge:50,art:'magnetshroom'});
  plant('spikerock','地刺王',125,51,{upgrade:'spikeweed',hp:450,recharge:50,art:'spikeweed'});
  plant('cobcannon','玉米加农炮',500,51,{upgrade:'kernelpult',hp:300,recharge:50,art:'kernelpult'});
  plant('imitater','模仿者',0,51);
  const zombies = {
    zombie:{name:'普通僵尸',hp:270,speed:.22},flag:{name:'旗帜僵尸',hp:270,speed:.28},cone:{name:'路障僵尸',hp:270,armor:370,speed:.22},
    pole:{name:'撑杆僵尸',hp:500,speed:.43},bucket:{name:'铁桶僵尸',hp:270,armor:1100,speed:.22,metal:true},
    newspaper:{name:'读报僵尸',hp:270,armor:150,speed:.22},door:{name:'铁栅门僵尸',hp:270,armor:1100,speed:.22,metal:true},
    football:{name:'橄榄球僵尸',hp:270,armor:1400,speed:.48,metal:true},dancer:{name:'舞王僵尸',hp:500,speed:.22},backup:{name:'伴舞僵尸',hp:270,speed:.22},
    ducky1:{name:'救生圈僵尸',hp:270,speed:.22,water:true},ducky2:{name:'路障救生圈',hp:270,armor:370,speed:.22,water:true},ducky3:{name:'铁桶救生圈',hp:270,armor:1100,speed:.22,water:true,metal:true},
    snorkel:{name:'潜水僵尸',hp:270,speed:.22,water:true},zomboni:{name:'冰车僵尸',hp:1350,speed:.25,vehicle:true},bobsled:{name:'雪橇僵尸',hp:270,speed:.4},
    dolphin:{name:'海豚骑士',hp:500,speed:.6,water:true},jack:{name:'玩偶匣僵尸',hp:500,speed:.38,metal:true},balloon:{name:'气球僵尸',hp:270,speed:.25},
    digger:{name:'矿工僵尸',hp:270,speed:.45,metal:true},pogo:{name:'跳跳僵尸',hp:500,speed:.42,metal:true},yeti:{name:'雪人僵尸',hp:1350,speed:.3},
    bungee:{name:'蹦极僵尸',hp:450,speed:0},ladder:{name:'扶梯僵尸',hp:500,armor:500,speed:.4,metal:true},catapult:{name:'投篮车僵尸',hp:850,speed:.2,vehicle:true},
    gargantuar:{name:'伽刚特尔',hp:3000,speed:.2},imp:{name:'小鬼僵尸',hp:270,speed:.32},boss:{name:'僵王博士',hp:40000,speed:0}
  };
  const worlds = ['白天庭院','夜晚庭院','泳池','浓雾泳池','屋顶'];
  // Classic PC 1.0.0.1051 is a reference, not a claim of mobile parity.
  // Cost/debut/earliest-wave/weight follow its zombie definitions. Per-wave
  // caps and scenario multipliers below are explicit recreation tuning.
  const encounters = Object.fromEntries([
    ['zombie',1,1,1,40,40],['flag',1,1,1,0,1],['cone',2,3,1,40,6],
    ['pole',2,6,5,20,3],['bucket',4,8,1,30,3],['newspaper',2,11,1,10,4],
    ['door',4,13,5,35,3],['football',7,16,5,20,1],['dancer',5,18,5,10,1],
    ['snorkel',3,23,10,20,3],['zomboni',7,26,10,20,1],['dolphin',3,28,10,15,3],
    ['jack',3,31,10,10,2],['balloon',2,33,10,20,2],['digger',4,36,10,10,2],
    ['pogo',4,38,10,10,2],['bungee',3,41,10,10,2],['ladder',4,43,10,10,2],
    ['catapult',5,46,10,15,1],['gargantuar',10,48,15,15,1]
  ].map(([type,cost,debut,firstWave,weight,cap])=>[type,{cost,debut,firstWave,weight,cap}]));
  const balance = Object.freeze({revision:2,firstWave:18,waveMin:25,waveMax:31,
    waveGrace:4,advanceDelay:2,flagPrepare:45,flagWarning:7.5,mineArm:15,
    sunMin:4.25,sunMax:9.5,sunJitter:2.75,sunGrowth:.1,headlessDrain:20});
  const clone = v => JSON.parse(JSON.stringify(v));
  const bounded = (n,a,b) => Number.isFinite(n) && n>=a && n<=b;
  function random(s) { s.rng = (Math.imul(s.rng,1664525)+1013904223)>>>0; return s.rng/4294967296; }
  function levelInfo(level) {
    level=Math.max(1,Math.min(50,level|0)); const world=Math.floor((level-1)/10),stage=(level-1)%10+1;
    const mode=level===5?'bowling':level===15?'whack':level===35?'vases':level===50?'boss':stage===10?'conveyor':'normal';
    return {level,world,stage,mode,rows:world===2||world===3?6:5,night:world===1||world===3,roof:world===4,pool:world===2||world===3,
      lanes:level===1?[2]:level<4?[1,2,3]:world===2||world===3?[0,1,2,3,4,5]:[0,1,2,3,4],
      little:level===25,storm:level===40,waves:level===1?3:level===2?5:stage<5?10:stage<10?20:30, name:`${world+1}-${stage} · ${worlds[world]}`};
  }
  function available(level) {return Object.keys(plants).filter(id=>plants[id].unlock<=level);}
  function defaultDeck(level) {
    const i=levelInfo(level),a=available(level);
    const wanted=i.roof?['flowerpot','sunflower','cabbagepult','kernelpult','wallnut','cherrybomb']:i.pool?['lilypad',i.night?'sunshroom':'sunflower',i.night?'puffshroom':'peashooter','wallnut',i.night?'plantern':'repeater','tanglekelp']:i.night?['puffshroom','sunshroom','fumeshroom','gravebuster','wallnut','cherrybomb']:['sunflower','peashooter','wallnut','potatomine','repeater','cherrybomb'];
    return [...new Set(wanted.filter(p=>a.includes(p)).concat(a))].slice(0,6);
  }
  function fresh(level=1,seed=Date.now(),deck=defaultDeck(level),imitate='peashooter') {
    const info=levelInfo(level), s={version:1,level:info.level,rng:seed>>>0,phase:'ready',time:0,sun:level===1?150:50,coins:0,deck:deck.filter(p=>plants[p]).slice(0,6),cooldowns:{},
      plants:[],zombies:[],shots:[],suns:[],graves:[],craters:[],ice:[],vases:[],mowers:info.lanes.map(row=>({row,x:-.65,active:false,spent:false})),
      nextId:1,wave:0,spawned:0,killed:0,spawnQueue:[],waveIn:balance.firstWave,sunIn:5,conveyor:[],conveyorIn:0,bossIn:8,bossBalls:[],fogClear:0,imitate:plants[imitate]&&!plants[imitate].upgrade&&imitate!=='imitater'?imitate:'peashooter',
      balance:balance.revision,sunDrops:0,waveAge:0,waveHealth:0,waveTrigger:.6,waveWarning:false,introduced:[]};
    s.sunIn=balance.sunMin+random(s)*balance.sunJitter;
    for(const p of s.deck)s.cooldowns[p]=0;
    if(info.night&&info.world===1&&info.mode!=='whack')for(let n=0;n<Math.min(12,2+info.stage);n++){let cell=info.lanes[n%5]*9+5+Math.floor(random(s)*4);if(!s.graves.includes(cell))s.graves.push(cell);}
    if(info.roof)for(let r=0;r<5;r++)for(let c=0;c<3;c++)addPlant(s,'flowerpot',r,c);
    if(info.mode==='bowling')s.deck=['wallnut','cherrybomb'];
    if(info.mode==='vases'){
      s.deck=[];s.sun=0;s.wave=info.waves;
      for(let r=0;r<5;r++)for(let c=3;c<9;c++)s.vases.push({id:s.nextId++,row:r,col:c,content:c===3?'repeater':random(s)<.52?(random(s)<.7?'zombie':'bucket'):'snowpea',green:c===3});
    }
    if(info.mode==='boss')s.deck=['flowerpot','cabbagepult','kernelpult','melonpult','iceshroom','jalapeno'];
    return s;
  }
  function emit(events,kind,data={}){events.push({kind,...data});}
  function start(s){if(s.phase!=='ready')return false;s.phase='running';return true;}
  function at(s,row,col){return s.plants.filter(p=>p.row===row&&(p.col===col||p.type==='cobcannon'&&p.col+1===col)&&p.hp>0);}
  function water(s,row){return levelInfo(s.level).pool&&(row===2||row===3);}
  function addPlant(s,type,row,col){const spec=plants[type],p={id:s.nextId++,type,row,col,hp:spec.hp,age:0,cd:spec.sun?3+random(s)*9.5:0,attack:0,awake:false};s.plants.push(p);return p;}
  function canPlant(s,type,row,col) {
    if(s.phase!=='running'||!plants[type]||!Number.isInteger(row)||!Number.isInteger(col)||col<0||col>8||!levelInfo(s.level).lanes.includes(row))return false;
    if(type==='imitater')return canPlant(s,s.imitate,row,col);
    const spec=plants[type],cell=row*9+col,here=at(s,row,col).map(p=>p.type==='imitater'?{...p,type:s.imitate}:p),info=levelInfo(s.level);
    if(s.vases.some(v=>v.row===row&&v.col===col)||s.craters.some(c=>c.cell===cell)||s.ice.some(c=>c.row===row&&col>=c.col))return false;
    if(type==='gravebuster')return s.graves.includes(cell);
    if(s.graves.includes(cell))return false;
    if(type==='coffeebean')return here.some(p=>plants[p.type].mushroom&&!p.awake&&!info.night);
    if(spec.upgrade){
      if(!here.some(p=>p.type===spec.upgrade))return false;
      return type!=='cobcannon'||col<8&&at(s,row,col+1).some(p=>p.type==='kernelpult');
    }
    if(type==='lilypad')return water(s,row)&&!here.some(p=>plants[p.type].base);
    if(type==='flowerpot')return !water(s,row)&&!here.some(p=>plants[p.type].base)&&!here.some(p=>!plants[p.type].armor);
    if(spec.water&&!water(s,row))return false;
    if(['spikeweed','spikerock'].includes(type)&&(water(s,row)||info.roof))return false;
    if(water(s,row)&&!spec.water&&!here.some(p=>p.type==='lilypad'))return false;
    if(info.roof&&!spec.base&&!here.some(p=>p.type==='flowerpot'))return false;
    return spec.armor?!here.some(p=>plants[p.type].armor):!here.some(p=>!plants[p.type].base&&!plants[p.type].armor);
  }
  function plantAt(s,type,row,col,events=[]) {
    if(!canPlant(s,type,row,col))return false;
    const info=levelInfo(s.level),free=['conveyor','boss','vases','bowling'].includes(info.mode),card=s.conveyor.find(p=>p.type===type);
    const spec=plants[type==='imitater'?s.imitate:type];
    if(free?!card:!s.deck.includes(type)||s.sun<spec.cost||(s.cooldowns[type]||0)>.001)return false;
    if(free)s.conveyor.splice(s.conveyor.indexOf(card),1);else{s.sun-=spec.cost;s.cooldowns[type]=spec.recharge;}
    if(plants[type].upgrade){s.plants=s.plants.filter(p=>!(p.row===row&&(p.col===col&&p.type===plants[type].upgrade||type==='cobcannon'&&p.col===col+1&&p.type==='kernelpult')));}
    addPlant(s,type,row,col);emit(events,'plant',{row,col,type});return true;
  }
  function shovel(s,row,col){if(s.phase!=='running')return false;const here=at(s,row,col).sort((a,b)=>(plants[b.type].armor?2:plants[b.type].base?0:1)-(plants[a.type].armor?2:plants[a.type].base?0:1));if(!here.length)return false;s.plants=s.plants.filter(p=>p.id!==here[0].id);return true;}
  function sun(s,x,y,value=25,sky=false,currency='sun'){if(s.suns.length>=45)return;s.suns.push({id:s.nextId++,x:Math.max(0,Math.min(9.5,x)),y:sky?-.5:y,toY:y,age:0,value,sky,currency});}
  function collect(s,id){if(s.phase!=='running')return false;const i=s.suns.findIndex(p=>p.id===id);if(i<0)return false;if(s.suns[i].currency==='coin')s.coins+=s.suns[i].value;else s.sun=Math.min(9990,s.sun+s.suns[i].value);s.suns.splice(i,1);return true;}
  function spawn(s,type,row,x=9.5){if(s.zombies.length>=100)return null;const spec=zombies[type];if(!spec)return null;const z={id:s.nextId++,type,row,x,hp:spec.hp,armor:spec.armor||0,max:spec.hp+(spec.armor||0),age:0,animTime:0,cd:0,slow:0,freeze:0,hurt:0,jumped:false,air:type==='balloon',underground:type==='digger',dir:-1,ally:false,action:'walk',actionTime:0,headless:false,wave:s.wave};s.zombies.push(z);return z;}
  function loseHead(z){
    if(z.hp>0&&!z.headless&&z.hp<zombies[z.type].hp/3&&!zombies[z.type].vehicle&&!['gargantuar','boss','bungee','bobsled'].includes(z.type)&&!z.air){
      z.headless=true;z.action='walk';z.actionTime=0;z.underground=false;
    }
  }
  function damage(z,n,bypass=false){if(z.hp<=0||z.type==='boss'&&z.shielded)return;if(!bypass&&z.armor>0){const d=Math.min(z.armor,n);z.armor-=d;n-=d;}z.hp-=n;z.hurt=.12;loseHead(z);}
  function blast(s,row,x,radius,events,kind='cherrybomb',amount=1800){
    for(const z of s.zombies)if(Math.hypot((z.row-row)*.9,z.x-x)<=radius)damage(z,amount);
    emit(events,'blast',{row,x,type:kind,radius});
  }
  function breakVase(s,id,events=[]){if(s.phase!=='running')return false;const i=s.vases.findIndex(v=>v.id===id);if(i<0)return false;const v=s.vases.splice(i,1)[0];if(plants[v.content])s.conveyor.push({id:s.nextId++,type:v.content});else spawn(s,v.content,v.row,v.col+.5);emit(events,'vase',{row:v.row,x:v.col+.5});return true;}
  function whack(s,id,events=[]){if(levelInfo(s.level).mode!=='whack'||s.phase!=='running')return false;const z=s.zombies.find(z=>z.id===id);if(!z)return false;damage(z,450);emit(events,'hit',{row:z.row,x:z.x});return true;}
  function bowl(s,type,row,events=[]){const c=s.conveyor.find(c=>c.type===type);if(levelInfo(s.level).mode!=='bowling'||!c||s.phase!=='running'||!levelInfo(s.level).lanes.includes(row))return false;s.conveyor.splice(s.conveyor.indexOf(c),1);s.shots.push({id:s.nextId++,row,y:row,x:0,from:0,age:0,life:15,type,damage:1800,vx:2.5,vy:0,bowling:true,hits:[]});emit(events,'shot',{row,x:0,type});return true;}
  function cannon(s,id,row,x,events=[]){const p=s.plants.find(p=>p.id===id&&p.type==='cobcannon');if(!p||p.cd>0||s.phase!=='running'||!Number.isInteger(row)||!levelInfo(s.level).lanes.includes(row)||!bounded(x,0,9))return false;p.cd=35;p.attack=.7;s.shots.push({id:s.nextId++,type:'cobcannon',row,y:p.row,fromRow:p.row,x:p.col+1,from:p.col+1,tx:x,lob:true,damage:1800,age:0,life:4,vx:0,vy:0});emit(events,'shot',{row:p.row,x:p.col+1,type:'cobcannon'});return true;}
  function enemyPool(s){
    const i=levelInfo(s.level);
    if(i.mode==='whack')return ['zombie','cone','bucket'];
    const extras=[[],['newspaper','door','football','dancer'],['snorkel','zomboni','dolphin'],
      ['snorkel','zomboni','dolphin','jack','balloon','digger','pogo'],['zomboni','bungee','ladder','catapult','gargantuar']][i.world];
    return ['zombie','cone','pole','bucket',...extras].filter(t=>s.level>=encounters[t].debut&&!(i.roof&&t==='pole'));
  }
  function flagWave(s,wave){return levelInfo(s.level).waves>=10&&(wave%10===0||wave===levelInfo(s.level).waves);}
  function waveBudget(s,wave){
    const i=levelInfo(s.level),base=1+Math.floor((wave-1)/3);
    const multiplier=i.mode==='bowling'||i.little?4:i.mode==='conveyor'?3:1;
    return Math.min(75,Math.floor(base*(flagWave(s,wave)?2.5:1)*multiplier));
  }
  function wavePlan(s,wave){
    const info=levelInfo(s.level),flag=flagWave(s,wave),budget=waveBudget(s,wave),pool=enemyPool(s);
    const counts={},lanes=Array(info.rows).fill(0),entries=[];let remaining=budget;
    function add(type){
      const spec=encounters[type];
      // Amphibious basic zombies keep their cost. Vehicles and specialists stay
      // on valid terrain; they are never silently converted to cheap swimmers.
      const basic=['zombie','cone','bucket'].includes(type);
      const rows=info.lanes.filter(row=>water(s,row)?basic||zombies[type].water:!zombies[type].water);
      const min=Math.min(...rows.map(row=>lanes[row])),choices=rows.filter(row=>lanes[row]===min);
      const row=choices[Math.floor(random(s)*choices.length)];lanes[row]+=spec.cost;
      counts[type]=(counts[type]||0)+1;remaining-=spec.cost;
      if(water(s,row)&&basic)type=type==='bucket'?'ducky3':type==='cone'?'ducky2':'ducky1';
      entries.push({type,row,in:entries.length*.6,wave});
    }
    if(flag)add('flag');
    const eligible=()=>pool.filter(t=>encounters[t].cost<=remaining&&
      (info.mode==='whack'||wave>=encounters[t].firstWave)&&
      (counts[t]||0)<encounters[t].cap*(flag?2:1));
    // Give a newly introduced enemy a deliberate first encounter, within the
    // same budget and wave gates as every other enemy.
    const debut=eligible().find(t=>t!=='zombie'&&encounters[t].debut===s.level&&!s.introduced.includes(t));
    if(debut)add(debut);
    while(remaining>0&&entries.length<40){
      const choices=eligible();if(!choices.length)break;
      let roll=random(s)*choices.reduce((sum,t)=>sum+encounters[t].weight,0),type=choices.at(-1);
      for(const t of choices){roll-=encounters[t].weight;if(roll<0){type=t;break;}}
      add(type);
    }
    return {budget,spent:budget-remaining,entries,types:Object.keys(counts)};
  }
  function newWave(s,events){
    const plan=wavePlan(s,s.wave+1);s.wave++;
    s.spawnQueue.push(...plan.entries);s.introduced=[...new Set([...s.introduced,...plan.types])];
    s.waveAge=0;s.waveWarning=false;s.waveHealth=plan.entries.reduce((sum,q)=>sum+zombies[q.type].hp+(zombies[q.type].armor||0),0);
    s.waveTrigger=.5+random(s)*.15;
    s.waveIn=flagWave(s,s.wave+1)?balance.flagPrepare:balance.waveMin+random(s)*(balance.waveMax-balance.waveMin);
    emit(events,'wave',{wave:s.wave,budget:plan.budget,spent:plan.spent});
  }
  function advanceWaves(s,dt,events){
    const info=levelInfo(s.level);
    if(s.wave<info.waves){
      s.waveAge+=dt;s.waveIn-=dt;
      if(!s.waveWarning&&s.wave>0&&s.waveAge>=balance.waveGrace&&!s.spawnQueue.length){
        const health=s.zombies.reduce((sum,z)=>sum+(z.wave===s.wave&&!z.ally?Math.max(0,z.hp)+z.armor:0),0);
        const threshold=flagWave(s,s.wave+1)?0:s.waveHealth*s.waveTrigger;
        if(health<=threshold)s.waveIn=Math.min(s.waveIn,balance.advanceDelay);
      }
      if(s.waveIn<=0&&!s.spawnQueue.length){
        if(flagWave(s,s.wave+1)&&!s.waveWarning){s.waveWarning=true;s.waveIn=balance.flagWarning;emit(events,s.wave+1===info.waves?'finalwave':'hugewave');}
        else newWave(s,events);
      }
    }
    const pending=[];
    for(const item of s.spawnQueue){
      item.in=Math.max(0,item.in-dt);
      if(item.in===0&&s.zombies.length<100){const z=spawn(s,item.type,item.row,info.mode==='whack'?5+random(s)*3:9.3+random(s)*.5);if(z){z.wave=item.wave;s.spawned++;continue;}}
      pending.push(item);
    }
    s.spawnQueue=pending;
  }
  function shoot(s,p,row,dir,events,type=p.type){
    const sp=plants[p.type],x=p.col+.65,target=s.zombies.filter(z=>z.row===row&&z.hp>0&&!z.ally&&!z.underground&&(!z.air||['cactus','cattail'].includes(p.type))&&(z.x-x)*dir>-.3).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0];
    const actualTarget=target||s.zombies.find(z=>z.type==='boss'&&z.hp>0);
    if(!actualTarget||Math.abs(actualTarget.x-x)>(sp.range||11))return false;
    if(sp.pierce){for(const z of s.zombies)if(z.row===row&&z.x>=x-.3&&z.x<=x+(sp.range||4)&&!z.air&&!z.underground)damage(z,sp.shot,z.type==='door');emit(events,'fume',{row,x});return true;}
    if(s.shots.length>=240)return false;
    const butter=p.type==='kernelpult'&&random(s)<.25;
    s.shots.push({id:s.nextId++,row,y:row,x,from:x,age:0,life:levelInfo(s.level).roof&&p.col<4&&!sp.lob?.28:sp.range?sp.range/3.6:4,type,butter,ice:!!sp.ice,damage:butter?40:sp.shot,vx:dir*3.6,vy:0,target:sp.lob?actualTarget.id:null,tx:actualTarget.x,lob:!!sp.lob,splash:!!sp.splash,fire:false});
    emit(events,'shot',{row,x,type});return true;
  }
  function tick(s,dt){
    const events=[];if(s.phase!=='running'||!bounded(dt,0,.25)||dt===0)return events;
    const info=levelInfo(s.level);s.time+=dt;s.fogClear=Math.max(0,s.fogClear-dt);
    for(const key of Object.keys(s.cooldowns))s.cooldowns[key]=Math.max(0,s.cooldowns[key]-dt);
    s.craters=s.craters.filter(c=>(c.left-=dt)>0);s.ice=s.ice.filter(c=>(c.left-=dt)>0);
    if(!info.night&&info.mode==='normal'){s.sunIn-=dt;if(s.sunIn<=0){sun(s,.5+random(s)*8,random(s)*(info.rows-1),25,true);s.sunIn=Math.min(balance.sunMax,balance.sunMin+s.sunDrops*balance.sunGrowth)+random(s)*balance.sunJitter;s.sunDrops++;}}
    for(const v of s.suns){v.age+=dt;if(v.sky)v.y=Math.min(v.toY,v.y+dt*.55);else v.y+=(v.toY-v.y)*Math.min(1,dt*5);}
    s.suns=s.suns.filter(v=>v.age<16);
    if(['conveyor','boss','bowling'].includes(info.mode)){
      s.conveyorIn-=dt;
      if(s.conveyorIn<=0&&s.conveyor.length<8){let choices=info.mode==='bowling'?['wallnut','wallnut','wallnut','cherrybomb']:info.mode==='boss'?s.deck:available(s.level).filter(t=>!['sunflower','sunshroom','gravebuster','coffeebean','marigold'].includes(t));if(info.roof&&random(s)<.2)choices=['flowerpot'];s.conveyor.push({id:s.nextId++,type:choices[Math.floor(random(s)*choices.length)]});s.conveyorIn=3+random(s)*3;}
    }
    if(info.mode==='boss'){
      if(!s.spawned){spawn(s,'boss',2,8.9);s.spawned++;s.wave=1;}
      const boss=s.zombies.find(z=>z.type==='boss');
      if(boss){boss.shielded=s.time%32<12;boss.action=boss.shielded?'idle':'head';if(!boss.shielded&&boss.cd===0){const row=Math.floor(random(s)*5);s.bossBalls.push({row,x:8.5,type:random(s)<.5?'fire':'ice',age:0});boss.cd=10;emit(events,'bossball',{row,x:8.5});}}
      for(const ball of s.bossBalls){ball.age+=dt;ball.x-=.85*dt;for(const p of s.plants)if(p.row===ball.row&&Math.abs(p.col+.5-ball.x)<.45)p.hp=0;if(ball.x<-.7){const mower=s.mowers.find(m=>m.row===ball.row&&!m.spent);if(mower){mower.active=true;ball.x=-2;}else{s.phase='lost';emit(events,'lost');}}}
      s.bossBalls=s.bossBalls.filter(b=>b.x>-1);
      s.bossIn-=dt;if(s.bossIn<=0&&s.zombies.some(z=>z.type==='boss'&&z.hp>0)){for(let r=0;r<5;r++)spawn(s,['zombie','cone','bucket','gargantuar'][Math.min(3,Math.floor(random(s)*4))],r);s.bossIn=18;s.wave++;
        if(s.wave%3===0){const r=Math.floor(random(s)*5);emit(events,'bossattack',{row:r,x:7});for(const p of s.plants)if(p.row===r&&p.col>3)p.hp=0;}}
    }else if(info.mode!=='vases')advanceWaves(s,dt,events);
    for(const p of s.plants){
      if(p.hp<=0)continue;const sp=plants[p.type],x=p.col+.5;p.age+=dt;p.cd=Math.max(0,p.cd-dt);p.attack=Math.max(0,p.attack-dt);
      if(p.type==='imitater'){if(p.age>=3.2){p.type=s.imitate;p.age=0;p.hp=plants[p.type].hp;p.cd=plants[p.type].sun?3+random(s)*9.5:0;emit(events,'plant',{row:p.row,col:p.col,type:p.type});}continue;}
      const asleep=sp.mushroom&&!info.night&&!p.awake&&info.mode!=='boss';if(asleep)continue;
      if(sp.sun&&p.cd===0){const v=p.type==='sunshroom'&&p.age>=120?25:sp.sun;sun(s,x,p.row,v);p.cd=23.5+random(s)*1.5;emit(events,'produce',{row:p.row,x});}
      if(p.type==='marigold'&&p.cd===0){sun(s,x,p.row,10,false,'coin');p.cd=24;emit(events,'coin',{row:p.row,x});}
      if(p.type==='goldmagnet'&&p.cd===0){for(const v of [...s.suns])if(v.currency==='coin')collect(s,v.id);p.cd=6;}
      if(sp.instant&&p.age>=sp.instant){
        if(p.type==='cherrybomb')blast(s,p.row,x,1.7,events);
        if(p.type==='jalapeno'){for(const z of s.zombies)if(z.row===p.row||z.type==='boss')damage(z,1800);s.ice=s.ice.filter(c=>c.row!==p.row);s.bossBalls=s.bossBalls.filter(b=>!(b.type==='ice'&&b.row===p.row));emit(events,'fire',{row:p.row,x});}
        if(p.type==='doomshroom'){blast(s,p.row,x,3,events,'doomshroom');s.craters.push({cell:p.row*9+p.col,left:180});}
        if(p.type==='iceshroom'){for(const z of s.zombies){z.freeze=4;z.slow=20;damage(z,20);}s.bossBalls=s.bossBalls.filter(b=>b.type!=='fire');emit(events,'freeze');}
        if(p.type==='blover'){s.zombies.forEach(z=>{if(z.air)z.hp=0;});s.fogClear=20;emit(events,'wind');}
        if(p.type==='gravebuster')s.graves=s.graves.filter(cell=>cell!==p.row*9+p.col);
        if(p.type==='coffeebean'){at(s,p.row,p.col).forEach(v=>v.awake=true);emit(events,'coffee');}
        p.hp=0;continue;
      }
      const near=s.zombies.find(z=>z.hp>0&&!z.ally&&z.row===p.row&&!z.air&&!z.underground&&Math.abs(z.x-x)<(p.type==='squash'?1.1:.6));
      if(p.type==='potatomine'&&p.age>=balance.mineArm&&near){blast(s,p.row,x,.75,events,'potatomine');p.hp=0;}
      if(p.type==='squash'&&near&&p.cd===0&&p.targetX===undefined){p.cd=.65;p.attack=.65;p.targetX=near.x;}
      if(p.type==='squash'&&p.targetX!==undefined&&p.cd===0){blast(s,p.row,p.targetX,.75,events,'squash');p.hp=0;}
      if(p.type==='tanglekelp'&&near){near.hp=0;p.hp=0;emit(events,'splash',{row:p.row,x});}
      if(p.type==='chomper'&&near&&p.cd===0){if(zombies[near.type].vehicle||near.type==='gargantuar'){damage(near,40);p.cd=1;}else{near.hp=0;p.cd=42;p.attack=.7;emit(events,'chomp',{row:p.row,x});}}
      if(['spikeweed','spikerock'].includes(p.type)&&p.cd===0){for(const z of s.zombies)if(z.row===p.row&&!z.air&&!z.underground&&Math.abs(z.x-x)<.6){if(zombies[z.type].vehicle){z.hp=0;p.hp-=150;if(p.type==='spikeweed')p.hp=0;}else damage(z,p.type==='spikerock'?40:20);}p.cd=1;}
      if(p.type==='magnetshroom'&&p.cd===0){const z=s.zombies.find(z=>z.hp>0&&zombies[z.type].metal&&Math.hypot(z.row-p.row,z.x-x)<3&&(z.armor>0||['digger','pogo','jack'].includes(z.type)&&!z.disarmed));if(z){z.armor=0;z.disarmed=true;z.underground=false;p.cd=15;p.attack=.5;emit(events,'magnet',{row:p.row,x,tx:z.x,ty:z.row});}}
      if(p.type==='gloomshroom'&&p.cd===0){let fired=false;for(const z of s.zombies)if(!z.air&&!z.underground&&Math.hypot(z.row-p.row,z.x-x)<1.6){damage(z,20,true);fired=true;}if(fired){p.cd=.6;p.attack=.3;emit(events,'fume',{row:p.row,x});}}
      else if(p.type==='cattail'&&p.cd===0){const z=s.zombies.find(z=>z.hp>0&&!z.ally);if(z){damage(z,20);z.air=false;p.cd=.7;p.attack=.2;emit(events,'magnet',{row:p.row,x,tx:z.x,ty:z.row});}}
      else if(sp.shot&&p.cd===0){
        if(p.type==='scaredyshroom'&&s.zombies.some(z=>z.hp>0&&Math.hypot(z.x-x,z.row-p.row)<1.5)){p.scared=true;continue;}p.scared=false;
        let fired=false;
        if(p.type==='starfruit'){
          if(s.zombies.some(z=>z.hp>0&&Math.hypot(z.x-x,z.row-p.row)<9)){
            for(const [vx,vy] of [[-3.6,0],[0,-3.6],[0,3.6],[3.1,-1.8],[3.1,1.8]])if(s.shots.length<240)s.shots.push({id:s.nextId++,row:p.row,y:p.row,x,from:x,age:0,life:4,type:p.type,damage:20,vx,vy});fired=true;
          }
        }else for(const r of sp.lanes===3?[p.row-1,p.row,p.row+1]:[p.row])if(r>=0&&r<info.rows){fired=shoot(s,p,r,1,events)||fired;if(p.type==='splitpea')fired=shoot(s,p,r,-1,events)||fired;}
        if(fired){p.cd=sp.rate===1.425?1.36+random(s)*.14:sp.rate;p.attack=.25;if(sp.burst)p.burst={left:sp.burst-1,in:.12};}
      }
      if(p.burst){p.burst.in-=dt;if(p.burst.in<=0){shoot(s,p,p.row,1,events);p.burst.left--;p.burst.in=.12;if(!p.burst.left)delete p.burst;}}
    }
    for(const q of s.shots){
      q.life-=dt;q.age+=dt;const prev=q.x;
      if(q.lob){const z=s.zombies.find(z=>z.id===q.target);if(z&&z.hp>0)q.tx=z.x;const duration=q.type==='cobcannon'?1.8:.85;q.x=q.from+(q.tx-q.from)*Math.min(1,q.age/duration);if(q.fromRow!==undefined)q.y=q.fromRow+(q.row-q.fromRow)*Math.min(1,q.age/duration);if(q.age>=duration){if(q.type==='cobcannon')blast(s,q.row,q.tx,1.8,events,'cherrybomb');if(z&&z.hp>0){damage(z,q.damage,z.type==='door');if(q.butter)z.freeze=4;if(q.ice)z.slow=10;}if(q.splash)for(const other of s.zombies)if(other!==z&&Math.hypot(other.x-q.tx,other.row-q.row)<1.5){damage(other,Math.floor(q.damage/3),other.type==='door');if(q.ice)other.slow=10;}q.life=0;emit(events,'impact',{row:q.row,x:q.tx,type:q.type});}continue;}
      q.x+=q.vx*dt;q.y+=q.vy*dt;
      if(!q.fire&&q.type!=='starfruit'&&!q.bowling)for(const p of s.plants)if(p.type==='torchwood'&&p.row===q.row&&p.col+.5>=prev&&p.col+.5<=q.x){if(q.ice){q.ice=false;q.type='peashooter';}else{q.fire=true;q.damage=40;}}
    const hit=s.zombies.filter(z=>z.hp>0&&!z.ally&&!z.underground&&(!z.air||q.type==='cactus')&&!(z.type==='snorkel'&&z.action!=='eat')&&(z.type==='boss'||Math.abs(z.row-q.y)<.4)&&Math.min(prev,q.x)-.15<=z.x&&z.x<=Math.max(prev,q.x)+.2&&(!q.hits||!q.hits.includes(z.id))).sort((a,b)=>q.vx>=0?a.x-b.x:b.x-a.x)[0];
      if(hit){damage(hit,q.damage);if(q.ice)hit.slow=10;if(q.type==='cactus')hit.air=false;emit(events,'impact',{row:hit.row,x:hit.x,type:q.type});
        if(q.bowling){if(q.type==='cherrybomb'){blast(s,hit.row,hit.x,1.8,events);q.life=0;}else{q.hits.push(hit.id);q.vy=(hit.row===0?1:hit.row===4?-1:random(s)<.5?-1:1)*1.6;}}
        else q.life=0;
      }
      if(q.bowling&&(q.y<0||q.y>info.rows-1)){q.y=Math.max(0,Math.min(info.rows-1,q.y));q.vy=-q.vy;}
    }
    s.shots=s.shots.filter(q=>q.life>0&&q.x<11&&q.x>-1&&q.y>-1&&q.y<info.rows);
    for(const z of s.zombies){
      if(z.hp<=0)continue;const spec=zombies[z.type];z.age+=dt;z.hurt=Math.max(0,z.hurt-dt);z.slow=Math.max(0,z.slow-dt);z.freeze=Math.max(0,z.freeze-dt);z.cd=Math.max(0,z.cd-dt);z.actionTime=Math.max(0,z.actionTime-dt);
      loseHead(z);
      if(z.headless){
        z.hp-=balance.headlessDrain*(spec.hp>=500?3:1)*dt;
        if(z.freeze===0){z.animTime+=dt*(z.slow>0?.5:1);z.x+=z.dir*spec.speed*dt*(z.slow>0?.5:1);}
        if(z.x<0||z.x>10)z.hp=0;
        continue;
      }
      if(z.freeze>0||z.type==='boss')continue;
      z.animTime=(z.animTime||0)+dt*(z.slow>0?.5:1);
      if(z.ally){const other=s.zombies.find(v=>!v.ally&&v.row===z.row&&v.hp>0&&Math.abs(v.x-z.x)<.5);if(other){damage(other,100*dt);damage(z,100*dt);z.action='eat';}else{z.x+=spec.speed*dt;z.action='walk';}if(z.x>10)z.hp=0;continue;}
      if(z.type==='bungee'){
        if(z.age<.1){const target=s.plants[Math.floor(random(s)*s.plants.length)];if(target){z.row=target.row;z.x=target.col+.5;z.target=target.id;}}
        if(z.age>4){const target=s.plants.find(p=>p.id===z.target);if(target&&!s.plants.some(p=>p.type==='umbrella'&&Math.abs(p.col+.5-z.x)<1.6&&Math.abs(p.row-z.row)<=1)){target.hp=0;emit(events,'steal',{row:z.row,x:z.x});}z.hp=0;}continue;
      }
      if(z.type==='jack'&&!z.disarmed&&z.age>18){blast(s,z.row,z.x,1.5,events,'jack',0);for(const p of s.plants)if(Math.hypot(p.row-z.row,p.col+.5-z.x)<1.5)p.hp=0;z.hp=0;continue;}
      if(z.type==='digger'&&z.underground){z.x-=spec.speed*dt;if(z.x<.2){z.underground=false;z.dir=1;z.freeze=1.5;}continue;}
      if(z.type==='gargantuar'&&z.hp<1500&&!z.thrown){z.thrown=true;const imp=spawn(s,'imp',z.row,Math.max(1,z.x-3));if(imp){imp.wave=z.wave;imp.actionTime=.8;imp.action='thrown';}emit(events,'throw',{row:z.row,x:z.x});}
      if(z.type==='dancer'&&z.cd===0&&z.x<8){for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(z.row+dy>=0&&z.row+dy<info.rows&&!water(s,z.row+dy)&&!s.zombies.some(v=>v.type==='backup'&&v.hp>0&&Math.abs(v.x-z.x-dx)<.7&&v.row===z.row+dy)){const backup=spawn(s,'backup',z.row+dy,z.x+dx);if(backup)backup.wave=z.wave;}z.cd=12;emit(events,'dance',{row:z.row,x:z.x});}
      if(z.type==='catapult'&&z.x<8.2&&s.plants.some(p=>p.row===z.row)&&z.cd===0){const target=s.plants.filter(p=>p.row===z.row&&p.hp>0).sort((a,b)=>a.col-b.col)[0];if(target&&!s.plants.some(p=>p.type==='umbrella'&&Math.abs(p.col-target.col)<=1&&Math.abs(p.row-target.row)<=1))target.hp-=100;z.cd=3;emit(events,'basketball',{row:z.row,x:target?.col+.5});}
      const touching=s.plants.filter(p=>p.hp>0&&p.row===z.row&&Math.abs(p.col+.5-z.x)<.52&&!['spikeweed','spikerock'].includes(p.type)).sort((a,b)=>(plants[b.type].armor?2:plants[b.type].base?0:1)-(plants[a.type].armor?2:plants[a.type].base?0:1))[0];
      if(touching&&!z.air){
        if(['pole','dolphin','pogo'].includes(z.type)&&!z.disarmed&&(!z.jumped||z.type==='pogo')&&touching.type!=='tallnut'){
          if(z.action!=='jump'){z.action='jump';z.actionTime=.7;z.jumpTo=z.x-1.3;}else if(z.actionTime===0){z.x=z.jumpTo;z.jumped=true;z.action='walk';}continue;
        }
        if(z.type==='ladder'&&z.armor>0&&['wallnut','tallnut','pumpkin'].includes(touching.type)){touching.ladder=true;z.armor=0;z.x-=1.2;continue;}
        if(touching.ladder){z.x-=spec.speed*dt;continue;}
        z.action='eat';
        if(spec.vehicle){touching.hp=0;z.x-=spec.speed*dt;}
        else if(z.type==='gargantuar'){if(z.cd===0){touching.hp=0;z.cd=1.8;z.action='smash';emit(events,'smash',{row:z.row,x:z.x});}}
        else{touching.hp-=100*dt*(z.slow>0?.5:1);if(z.cd===0){emit(events,'chomp',{row:z.row,x:z.x});z.cd=.6;}
          if(touching.type==='hypnoshroom'&&(info.night||touching.awake)){touching.hp=0;z.ally=true;z.dir=1;}
          if(touching.type==='garlic'){const next=z.row+(z.row===0?1:z.row===info.rows-1?-1:random(s)<.5?-1:1);if(!water(s,next)){z.row=next;z.freeze=.6;touching.hp-=40;}}
        }
      }else{z.action='walk';const speed=z.type==='newspaper'&&z.armor<=0?spec.speed*2.5:z.jumped&&['pole','dolphin'].includes(z.type)?spec.speed*.5:spec.speed;
        if(!(z.type==='catapult'&&z.x<8.2&&s.plants.some(p=>p.row===z.row)))z.x+=z.dir*speed*dt*(z.slow>0?.5:1);
      }
      if(z.type==='zomboni'&&z.x<9&&!s.ice.some(c=>c.row===z.row&&c.col<=Math.floor(z.x))){s.ice.push({row:z.row,col:Math.max(0,Math.floor(z.x)),left:30});}
      const mower=s.mowers.find(m=>m.row===z.row&&!m.spent);
      if(z.x<-.1&&z.dir<0&&!z.air){if(mower){if(!mower.active){mower.active=true;emit(events,'mower',{row:z.row,x:mower.x});}}else if(z.x<-.6){s.phase='lost';emit(events,'lost');}}
      if(z.x<-.7&&z.air){s.phase='lost';emit(events,'lost');}if(z.dir>0&&z.x>10)z.hp=0;
    }
    for(const m of s.mowers)if(m.active&&!m.spent){m.x+=dt*4;for(const z of s.zombies)if(z.row===m.row&&z.x<m.x+.6&&z.x>m.x-.8&&!z.air)z.hp=0;if(m.x>10){m.spent=true;m.active=false;}}
    for(const z of s.zombies)if(z.hp<=0){s.killed++;if(!z.ally&&random(s)<.08)sun(s,z.x,z.row,10,false,'coin');emit(events,'death',{row:z.row,x:z.x,type:z.type});}
    s.zombies=s.zombies.filter(z=>z.hp>0);s.plants=s.plants.filter(p=>p.hp>0);
    if(s.phase==='running'&&(info.mode==='boss'?s.spawned&&!s.zombies.some(z=>z.type==='boss'):s.wave>=info.waves&&!s.spawnQueue.length&&!s.zombies.length&&!s.vases.length)){s.phase='won';emit(events,'won');s.coins+=50;}
    return events;
  }
  function restore(raw){
    if(!raw||raw.version!==1||!Number.isInteger(raw.level)||!bounded(raw.level,1,50)||!['ready','running','won','lost'].includes(raw.phase))return null;
    if(!bounded(raw.time,0,1e7)||!bounded(raw.sun,0,9990)||!bounded(raw.rng,0,4294967295)||!bounded(raw.nextId,1,1e8)||!bounded(raw.wave,0,10000))return null;
    const limits={plants:110,zombies:100,shots:240,suns:45,mowers:6,graves:45,craters:54,ice:300,vases:54,spawnQueue:40,conveyor:40,deck:10,bossBalls:10};
    if(Object.entries(limits).some(([k,n])=>!Array.isArray(raw[k])||raw[k].length>n))return null;
    if(!raw.cooldowns||typeof raw.cooldowns!=='object'||Object.values(raw.cooldowns).some(n=>!bounded(n,0,60)))return null;
    if(raw.deck.some(t=>!plants[t])||raw.conveyor.some(c=>!c||!plants[c.type]))return null;
    if(!plants[raw.imitate]||plants[raw.imitate].upgrade||raw.imitate==='imitater')return null;
    if(raw.plants.some(p=>!p||!plants[p.type]||!Number.isInteger(p.col)||!bounded(p.col,0,8)||!Number.isInteger(p.row)||!bounded(p.row,0,levelInfo(raw.level).rows-1)||!bounded(p.hp,.001,8000)||!bounded(p.age,0,1e7)||!bounded(p.cd,0,100)))return null;
    if(raw.zombies.some(z=>!z||!zombies[z.type]||!bounded(z.x,-2,12)||!bounded(z.row,0,5)||!bounded(z.hp,.001,40000)||!bounded(z.armor,0,2000)))return null;
    if(raw.shots.some(q=>!q||!bounded(q.x,-2,12)||!bounded(q.y,-2,7)||!bounded(q.life,0,15)||!bounded(q.vx,-5,5)||!bounded(q.vy,-5,5)||!bounded(q.damage,0,2000)||!bounded(q.age,0,20)))return null;
    if(raw.suns.some(v=>!v||!bounded(v.x,0,10)||!bounded(v.y,-1,6)||!bounded(v.toY,0,6)||!bounded(v.value,1,100)||!bounded(v.age,0,16)))return null;
    if(raw.mowers.some(m=>!m||!Number.isInteger(m.row)||!bounded(m.row,0,5)||!bounded(m.x,-1,11)||typeof m.active!=='boolean'||typeof m.spent!=='boolean'))return null;
    if(raw.graves.some(c=>!Number.isInteger(c)||!bounded(c,0,53))||raw.craters.some(c=>!c||!Number.isInteger(c.cell)||!bounded(c.cell,0,53)||!bounded(c.left,0,180)))return null;
    if(raw.ice.some(c=>!c||!bounded(c.row,0,5)||!bounded(c.col,0,8)||!bounded(c.left,0,30)))return null;
    if(raw.vases.some(v=>!v||!Number.isInteger(v.row)||!bounded(v.row,0,5)||!Number.isInteger(v.col)||!bounded(v.col,0,8)||!plants[v.content]&&!zombies[v.content]))return null;
    if(raw.spawnQueue.some(q=>!q||!zombies[q.type]||!bounded(q.row,0,5)||!bounded(q.in,0,30)))return null;
    if(raw.bossBalls.some(b=>!b||!bounded(b.x,-1,9)||!bounded(b.row,0,4)||!['fire','ice'].includes(b.type)||!bounded(b.age,0,30)))return null;
    if(raw.plants.some(p=>p.burst&&(!bounded(p.burst.left,1,3)||!bounded(p.burst.in,0,.12))))return null;
    if(raw.zombies.some(z=>['age','cd','slow','freeze','hurt','actionTime'].some(k=>!bounded(z[k],0,1e7))||![-1,1].includes(z.dir)))return null;
    const numeric=['time','sun','coins','wave','spawned','killed','waveIn','sunIn','conveyorIn','bossIn','fogClear'];if(numeric.some(k=>!Number.isFinite(raw[k])))return null;
    const s=clone(raw);
    if(s.balance===undefined){
      // Preserve an in-progress old battle, including its already queued enemies.
      // Only subsequent waves use the new schedule; no resource/plant reset.
      s.balance=balance.revision;s.sunDrops=Math.floor(s.time/8.5);s.waveAge=0;s.waveTrigger=.6;s.waveWarning=false;
      s.waveIn=Math.max(balance.advanceDelay,s.waveIn);
      s.waveHealth=s.zombies.reduce((n,z)=>n+z.hp+z.armor,0)+s.spawnQueue.reduce((n,q)=>n+zombies[q.type].hp+(zombies[q.type].armor||0),0);
      s.introduced=[...new Set(s.zombies.map(z=>z.type).concat(s.spawnQueue.map(q=>q.type)).filter(t=>encounters[t]))];
      for(const z of s.zombies){z.wave=s.wave;z.headless=false;z.animTime=z.animTime||0;}
      for(const q of s.spawnQueue)q.wave=s.wave;
    }
    if(s.balance!==balance.revision||!Number.isInteger(s.sunDrops)||!bounded(s.sunDrops,0,1e7)||!bounded(s.waveAge,0,1e7)||!bounded(s.waveHealth,0,1e7)||!bounded(s.waveTrigger,.5,.65)||typeof s.waveWarning!=='boolean'||!Array.isArray(s.introduced)||s.introduced.length>30||s.introduced.some(t=>!encounters[t]))return null;
    if(s.zombies.some(z=>typeof z.headless!=='boolean'||!Number.isInteger(z.wave)||!bounded(z.wave,0,s.wave)||!bounded(z.animTime,0,1e7)))return null;
    if(s.spawnQueue.some(q=>!Number.isInteger(q.wave)||!bounded(q.wave,0,s.wave)))return null;
    return s;
  }
  const api={plants,zombies,worlds,balance,encounters,clone,random,levelInfo,available,defaultDeck,fresh,start,at,water,canPlant,plantAt,shovel,collect,spawn,tick,restore,breakVase,whack,bowl,cannon,enemyPool,waveBudget,wavePlan};
  if(typeof module!=='undefined')module.exports=api;else root.PVZCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
