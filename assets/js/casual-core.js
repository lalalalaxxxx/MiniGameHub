/* Original touch arcade rules. Rendering and sound are independent of simulation. */
(function(root){
  'use strict';
  const W=720,H=800,LEVELS=10;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  const integer=(n,a,b)=>Number.isInteger(n)&&finite(n,a,b);
  const rand=(s,n)=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return Math.floor(s.rng/4294967296*n);};
  const emit=(e,type,data={})=>e.push({type,...data});
  function finish(s,e,won){if(s.phase!=='playing')return;s.phase=won?'won':'lost';s.acc=0;emit(e,won?'win':'lose');}
  function segment(ax,ay,bx,by,cx,cy,dx,dy){
    const cross=(x,y,z,t)=>x*t-y*z,rx=bx-ax,ry=by-ay,sx=dx-cx,sy=dy-cy,d=cross(rx,ry,sx,sy);
    if(Math.abs(d)<.00001)return false;const t=cross(cx-ax,cy-ay,sx,sy)/d,u=cross(cx-ax,cy-ay,rx,ry)/d;return t>=0&&t<=1&&u>=0&&u<=1;
  }
  const META={
    bubblepop:{title:'萌宠泡泡龙',category:'消除',icon:'bubble',color:'#559b8a',note:'拖动瞄准，松手发射。三个同色泡泡相连就消除，失去顶部支撑的泡泡会一起掉落。'},
    brickball:{title:'弹球打砖块',category:'反应',icon:'ball',color:'#638abd',note:'向上拖动瞄准，松手发射一串小球。砖块上的数字归零就会碎掉，别让砖块碰到底线。'},
    goldminer:{title:'小小黄金矿工',category:'休闲',icon:'gold',color:'#b98539',note:'看准钩子的摆动方向，点一下放钩。宝石轻、金块值钱，石头很重。达到目标就能过关。'},
    ropefeast:{title:'糖果喂喂怪',category:'益智',icon:'candy',color:'#ac7592',note:'用手指划断绳子，让糖果落进小怪兽嘴里。观察摆动，尝试收集三颗星星。'},
    snailquest:{title:'蜗牛机关冒险',category:'冒险',icon:'snail',color:'#7e9b54',note:'小蜗牛会自己走。点击彩色开关改变桥梁、闸门和升降台，帮助它到达小屋。'}
  };
  const games={};

  // Bubbles: a staggered hexagonal grid, wall banks and ceiling connectivity.
  const BR=28,BC=11,BROWS=10;
  const bpos=(row,col)=>({x:80+col*56+(row%2)*28,y:86+row*48.5});
  const bslots=()=>Array.from({length:BROWS},(_,row)=>Array.from({length:row%2?10:11},(_,col)=>({row,col,...bpos(row,col)}))).flat();
  const slots=bslots();
  const bnear=(a,b)=>a!==b&&dist(a,b)<58;
  function bgroup(s,start,color){const seen=new Set([start.uid]),todo=[start];while(todo.length){const b=todo.pop();for(const p of s.bubbles)if(!seen.has(p.uid)&&p.color===color&&bnear(p,b)){seen.add(p.uid);todo.push(p);}}return seen;}
  function bnext(s){const colors=[...new Set(s.bubbles.map(b=>b.color))];return colors.length?colors[rand(s,colors.length)]:0;}
  function settleBubble(s,e,shot){
    const taken=new Set(s.bubbles.map(b=>b.row+':'+b.col));
    const free=slots.filter(p=>!taken.has(p.row+':'+p.col)&&(p.row===0||s.bubbles.some(b=>bnear(p,b))));
    free.sort((a,b)=>dist(a,shot)-dist(b,shot));const p=free[0];
    if(!p||dist(p,shot)>90){s.shot=null;finish(s,e,false);return;}
    let color=shot.color;if(color===-1){const near=s.bubbles.filter(b=>bnear(b,p));color=near.sort((a,b)=>bgroup(s,b,b.color).size-bgroup(s,a,a.color).size)[0]?.color??bnext(s);}
    const b={...p,color,uid:s.nextId++,pet:false};s.bubbles.push(b);s.shot=null;emit(e,'land',{x:b.x,y:b.y});
    const matched=bgroup(s,b,color);if(matched.size>=3){
      const popped=s.bubbles.filter(b=>matched.has(b.uid));s.bubbles=s.bubbles.filter(b=>!matched.has(b.uid));
      const supported=new Set(),todo=s.bubbles.filter(b=>b.row===0);todo.forEach(b=>supported.add(b.uid));
      while(todo.length){const a=todo.pop();for(const p of s.bubbles)if(!supported.has(p.uid)&&bnear(a,p)){supported.add(p.uid);todo.push(p);}}
      const fallen=s.bubbles.filter(b=>!supported.has(b.uid));s.bubbles=s.bubbles.filter(b=>supported.has(b.uid));
      s.rescued+=[...popped,...fallen].filter(b=>b.pet).length;s.score+=popped.length*30+fallen.length*60;s.combo=fallen.length?2:1;
      emit(e,'burst',{items:popped,kind:'bubble'});if(fallen.length)emit(e,'cascade',{items:fallen});
    }
    if(!s.bubbles.length){s.stars=s.shots>=8?3:s.shots>=3?2:1;finish(s,e,true);}
    else if(!s.shots||s.bubbles.some(b=>b.y>580))finish(s,e,false);
    if(s.phase==='playing'){s.color=s.nextColor;s.nextColor=bnext(s);if(s.color!==-1&&!s.bubbles.some(b=>b.color===s.color))s.color=bnext(s);}
  }
  games.bubblepop={
    init(s){s.bubbles=[];s.nextId=1;const rows=3+Math.floor(s.level/3),colors=3+(s.level>=6?1:0);
      for(let row=0;row<rows;row++)for(let col=0;col<(row%2?10:11);col++){
        if(row===rows-1&&col%4===3)continue;
        const color=(Math.floor(col/3)+Math.floor(row/2)+s.level)%colors;
        s.bubbles.push({uid:s.nextId++,row,col,...bpos(row,col),color,pet:row===0&&col%4===1});
      }
      s.shots=24+s.level;s.totalPets=s.bubbles.filter(b=>b.pet).length;s.rescued=0;s.color=bnext(s);s.nextColor=bnext(s);s.rainbows=2;s.shot=null;s.combo=0;s.aim={x:360,y:250};
    },
    act(s,type,p,e){if(type==='aim'){s.aim={x:clamp(p.x,0,W),y:clamp(p.y,30,620)};return true;}
      if(s.shot)return false;
      if(type==='swap'){[s.color,s.nextColor]=[s.nextColor,s.color];emit(e,'swap');return true;}
      if(type==='power'&&s.rainbows&&s.color!==-1){s.rainbows--;s.color=-1;emit(e,'power');return true;}
      if(type!=='fire'||!s.shots)return false;
      const dx=clamp(p?.x??s.aim.x,0,W)-360,dy=Math.min(-100,(p?.y??s.aim.y)-710),len=Math.hypot(dx,dy);
      s.shots--;s.moves++;s.shot={x:360,y:710,vx:dx/len*760,vy:dy/len*760,color:s.color,age:0};emit(e,'shoot',{x:360,y:710});return true;
    },
    step(s,dt,e){const b=s.shot;if(!b)return;b.age+=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.x<BR+18){b.x=BR+18;b.vx=Math.abs(b.vx);emit(e,'bounce',{x:b.x,y:b.y});}if(b.x>W-BR-18){b.x=W-BR-18;b.vx=-Math.abs(b.vx);emit(e,'bounce',{x:b.x,y:b.y});}
      if(b.y<=86||s.bubbles.some(p=>dist(p,b)<BR*2-2)||b.age>5)settleBubble(s,e,b);
    },
    valid:s=>Array.isArray(s.bubbles)&&s.bubbles.length<=110&&s.bubbles.every(b=>integer(b.uid,1,s.nextId-1)&&slots.some(p=>p.row===b.row&&p.col===b.col&&p.x===b.x&&p.y===b.y)&&integer(b.color,0,3)&&typeof b.pet==='boolean')&&new Set(s.bubbles.map(b=>b.row+':'+b.col)).size===s.bubbles.length&&integer(s.shots,0,40)&&integer(s.color,-1,3)&&integer(s.nextColor,-1,3)&&integer(s.rainbows,0,2)&&(!s.shot||finite(s.shot.x,0,W)&&finite(s.shot.y,0,H)&&finite(s.shot.vx,-800,800)&&finite(s.shot.vy,-800,0)&&integer(s.shot.color,-1,3)&&finite(s.shot.age,0,6)),
    hint(s){if(s.shot)return null;let best=null,value=-Infinity;for(let angle=-1.28;angle<=1.281;angle+=.04){const p={x:360+Math.tan(angle)*100,y:610},copy=clone(s),out=[];this.act(copy,'fire',p,out);for(let n=0;n<650&&copy.shot;n++)this.step(copy,1/120,out);const v=copy.phase==='won'?1e6:copy.phase==='lost'?-1e6:(s.bubbles.length-copy.bubbles.length)*50+copy.score-s.score-Math.abs(angle)*.1;if(v>value){value=v;best=p;}}return best;}
  };

  // Number bricks: staggered volleys with fixed substeps and a bounded ball pool.
  const brickX=c=>54+c*88,brickY=r=>100+r*72;
  function brickRow(s,e){
    for(const b of s.bricks)b.y+=72;for(const b of s.pickups)b.y+=72;
    if(s.bricks.some(b=>b.y+60>=666)){finish(s,e,false);return;}
    if(s.rowsLeft>0){s.rowsLeft--;const gap=rand(s,7);for(let c=0;c<7;c++)if(c!==gap&&(c+s.round)%4!==0){const hp=2+Math.floor(s.level/2)+rand(s,3)+s.round;s.bricks.push({uid:s.nextId++,x:brickX(c),y:100,w:76,h:60,hp,max:hp});}
      s.pickups.push({uid:s.nextId++,x:brickX(gap)+38,y:130});}
    s.pickups=s.pickups.filter(b=>b.y<650);emit(e,'row');
  }
  function returnVolley(s,e){s.volley=null;s.balls=[];s.ballCount=Math.min(30,s.ballCount+s.bonus);s.bonus=0;s.origin=clamp(s.returnX??s.origin,34,686);s.returnX=null;
    if(!s.bricks.length&&!s.rowsLeft){s.stars=s.round<=8?3:s.round<=12?2:1;finish(s,e,true);return;}s.round++;brickRow(s,e);
  }
  games.brickball={
    init(s){s.bricks=[];s.pickups=[];s.balls=[];s.nextId=1;s.round=1;s.rowsLeft=3+Math.floor(s.level/3);s.ballCount=6+Math.floor(s.level/2);s.bonus=0;s.origin=360;s.returnX=null;s.volley=null;s.aim={x:360,y:200};s.speed=1;s.destroyed=0;brickRow(s,[]);brickRow(s,[]);},
    act(s,type,p,e){if(type==='aim'){s.aim={x:clamp(p.x,0,W),y:clamp(p.y,50,600)};return true;}
      if(type==='speed'){s.speed=s.speed===1?2:1;return true;}
      if(type==='recall'&&s.volley){emit(e,'recall');returnVolley(s,e);return true;}
      if(type!=='fire'||s.volley)return false;const dx=clamp(p?.x??s.aim.x,0,W)-s.origin,dy=Math.min(-150,(p?.y??s.aim.y)-710),len=Math.hypot(dx,dy);
      s.volley={vx:dx/len*650,vy:dy/len*650,age:0,sent:0,next:0};s.moves++;emit(e,'shoot',{x:s.origin,y:710});return true;
    },
    step(s,dt,e){const v=s.volley;if(!v)return;dt*=s.speed;v.age+=dt;v.next-=dt;
      if(v.sent<s.ballCount&&v.next<=0){s.balls.push({uid:s.nextId++,x:s.origin,y:710,vx:v.vx,vy:v.vy});v.sent++;v.next+=.075;emit(e,'launch',{x:s.origin,y:710,index:v.sent});}
      for(let k=s.balls.length-1;k>=0;k--){const b=s.balls[k],ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
        if(b.x<25){b.x=25;b.vx=Math.abs(b.vx);}if(b.x>695){b.x=695;b.vx=-Math.abs(b.vx);}if(b.y<55){b.y=55;b.vy=Math.abs(b.vy);}
        for(let j=s.pickups.length-1;j>=0;j--)if(dist(b,s.pickups[j])<27){s.bonus++;emit(e,'collect',{...s.pickups[j],label:'+1'});s.pickups.splice(j,1);}
        for(let j=s.bricks.length-1;j>=0;j--){const p=s.bricks[j],cx=clamp(b.x,p.x,p.x+p.w),cy=clamp(b.y,p.y,p.y+p.h);if(Math.hypot(b.x-cx,b.y-cy)>=9)continue;
          if(oy<=p.y-8){b.y=p.y-9;b.vy=-Math.abs(b.vy);}else if(oy>=p.y+p.h+8){b.y=p.y+p.h+9;b.vy=Math.abs(b.vy);}else if(ox<=p.x-8){b.x=p.x-9;b.vx=-Math.abs(b.vx);}else if(ox>=p.x+p.w+8){b.x=p.x+p.w+9;b.vx=Math.abs(b.vx);}else{b.y=oy;b.x=ox;b.vy=-b.vy;}
          p.hp--;s.score+=5;emit(e,'hit',{x:cx,y:cy,uid:p.uid});if(!p.hp){s.destroyed++;s.score+=30;emit(e,'burst',{items:[{x:p.x+38,y:p.y+30,color:j%5}],kind:'brick'});s.bricks.splice(j,1);}break;
        }
        if(b.y>=720&&b.vy>0){if(s.returnX===null)s.returnX=b.x;s.balls.splice(k,1);}
      }
      if(v.age>14||(v.sent===s.ballCount&&!s.balls.length))returnVolley(s,e);
    },
    valid:s=>Array.isArray(s.bricks)&&s.bricks.length<=60&&s.bricks.every(b=>integer(b.uid,1,s.nextId-1)&&finite(b.x,20,650)&&finite(b.y,50,700)&&b.w===76&&b.h===60&&integer(b.hp,1,100)&&integer(b.max,b.hp,100))&&Array.isArray(s.pickups)&&s.pickups.length<=15&&s.pickups.every(b=>finite(b.x,20,700)&&finite(b.y,50,700))&&Array.isArray(s.balls)&&s.balls.length<=30&&s.balls.every(b=>finite(b.x,0,W)&&finite(b.y,0,H)&&finite(b.vx,-700,700)&&finite(b.vy,-700,700))&&integer(s.ballCount,1,30)&&integer(s.rowsLeft,0,8)&&integer(s.bonus,0,30)&&integer(s.round,1,100)&&[1,2].includes(s.speed)&&finite(s.origin,20,700)&&(!s.volley||finite(s.volley.age,0,15)&&integer(s.volley.sent,0,s.ballCount)&&finite(s.volley.next,-1,1)&&finite(s.volley.vx,-700,700)&&finite(s.volley.vy,-700,0)),
    hint(s){if(s.volley)return null;const p=s.bricks.slice().sort((a,b)=>b.y-a.y||a.hp-b.hp)[0];return p?{x:p.x+38,y:p.y+30}:{x:360,y:80};}
  };

  // Miner: deterministic pendulum, ray travel, weight-dependent retrieval.
  games.goldminer={
    init(s){s.items=[];s.nextId=1;s.time=80+s.level*2;s.target=500+s.level*85;s.earned=0;s.boosts=2;s.discards=2;s.hook={mode:'swing',angle:0,length:45,item:null,fast:false};
      const placements=[[130,350],[330,350],[560,345],[210,465],[440,475],[610,515],[95,605],[310,620],[490,665],[620,695]];
      placements.forEach(([x,y],i)=>{const kind=i===3||i===6?'stone':i===2||i===7?'gem':i===8?'chest':'gold',large=i===1||i===4;s.items.push({uid:s.nextId++,x:x+rand(s,25)-12,y:y+rand(s,20)-10,kind,r:kind==='gem'?20:large?38:27,value:kind==='stone'?15:kind==='gem'?240:kind==='chest'?100+rand(s,180):large?260:120,weight:kind==='stone'?3.4:kind==='gem'?.65:large?2.1:1.2});});
      const total=s.items.reduce((n,b)=>n+b.value,0);s.target=Math.min(s.target,Math.floor(total*.72));
    },
    act(s,type,p,e){const h=s.hook;if(type==='fire'&&h.mode==='swing'){h.mode='out';s.moves++;emit(e,'shoot',{x:360,y:145});return true;}
      if(type==='power'&&s.boosts&&h.mode==='back'&&!h.fast){s.boosts--;h.fast=true;emit(e,'power');return true;}
      if(type==='discard'&&s.discards&&h.item){const item=s.items.find(b=>b.uid===h.item);s.items=s.items.filter(b=>b.uid!==h.item);s.discards--;h.item=null;h.fast=true;emit(e,'burst',{items:[item],kind:'stone'});return true;}return false;
    },
    step(s,dt,e){s.time=Math.max(0,s.time-dt);const h=s.hook;if(h.mode==='swing'){h.angle=Math.sin(s.t*(.9+s.level*.035))*1.02;}
      else if(h.mode==='out'){h.length+=370*dt;const p={x:360+Math.sin(h.angle)*h.length,y:145+Math.cos(h.angle)*h.length};const item=s.items.find(b=>dist(b,p)<b.r+12);if(item){h.item=item.uid;h.mode='back';emit(e,'grab',{x:p.x,y:p.y,kind:item.kind});}else if(p.x<20||p.x>700||p.y>755){h.mode='back';}}
      else {const item=s.items.find(b=>b.uid===h.item);h.length-=dt*(h.fast?650:310)/(item?.weight||.7);if(h.length<=45){h.length=45;h.mode='swing';h.fast=false;if(item){s.earned+=item.value;s.score=s.earned;emit(e,'collect',{x:360,y:180,label:'+'+item.value,kind:item.kind});s.items=s.items.filter(b=>b.uid!==item.uid);}h.item=null;if(s.earned>=s.target){s.stars=s.time>35?3:s.time>15?2:1;finish(s,e,true);}}}
      if(!s.time)finish(s,e,false);
    },
    valid:s=>Array.isArray(s.items)&&s.items.length<=10&&s.items.every(b=>integer(b.uid,1,10)&&finite(b.x,50,660)&&finite(b.y,300,730)&&['gold','stone','gem','chest'].includes(b.kind)&&finite(b.r,20,38)&&integer(b.value,15,300)&&finite(b.weight,.6,4))&&finite(s.time,0,110)&&integer(s.earned,0,3000)&&integer(s.target,400,2000)&&integer(s.boosts,0,2)&&integer(s.discards,0,2)&&s.hook&&['swing','out','back'].includes(s.hook.mode)&&finite(s.hook.angle,-1.1,1.1)&&finite(s.hook.length,30,900)&&(s.hook.item===null||s.items.some(b=>b.uid===s.hook.item))&&typeof s.hook.fast==='boolean',
    hint(s){const h=s.hook,p=s.items.filter(b=>b.kind!=='stone').sort((a,b)=>b.value/b.weight-a.value/a.weight)[0];return p?{...p,angle:Math.atan2(p.x-360,p.y-145),message:h.mode==='swing'?'等钩子指向亮圈，再点屏幕。':'抓到大金块时，可以使用快速收钩。'}:null;}
  };

  // Candy: Verlet integration, unilateral rope constraints, buoyancy and wind.
  const ropeLevels=[
    {name:'第一颗甜糖',p:[360,360],a:[[360,120]],mouth:[360,710],stars:[[360,450],[360,550],[360,650]],tip:'划过绳子，让糖果直直落下。'},
    {name:'向右荡秋千',p:[270,350],a:[[210,100],[510,100]],mouth:[490,710],stars:[[320,430],[400,540],[470,650]],tip:'先剪左边，糖果会向右摆；看准方向，再剪另一根。'},
    {name:'向左荡秋千',p:[450,350],a:[[210,100],[510,100]],mouth:[230,710],stars:[[400,430],[320,540],[250,650]],tip:'先剪右边的绳子，观察糖果的摆动。'},
    {name:'泡泡升空',p:[360,430],a:[[360,180]],mouth:[360,710],stars:[[360,350],[360,260],[360,620]],bubble:true,tip:'剪绳后泡泡会带糖果上升，点“戳破泡泡”再落下。'},
    {name:'风送糖果',p:[230,330],a:[[230,100]],mouth:[480,710],stars:[[280,440],[370,550],[450,650]],fan:1,tip:'打开风扇后剪绳，风会把糖果向右送。'},
    {name:'左边的微风',p:[490,330],a:[[490,100]],mouth:[240,710],stars:[[440,440],[350,550],[270,650]],fan:-1,tip:'打开风扇，送糖果去左边的小怪兽家。'},
    {name:'两根绳的秘密',p:[360,370],a:[[150,110],[570,110]],mouth:[360,710],stars:[[360,450],[360,540],[360,630]],tip:'一次划过两根绳子，让糖果从中间落下。'},
    {name:'气球与右风',p:[250,440],a:[[250,140]],mouth:[480,710],stars:[[250,330],[330,460],[450,650]],bubble:true,fan:1,tip:'先升空收星星，再戳泡泡、开风扇，把糖果送向右边。'},
    {name:'气球与左风',p:[470,440],a:[[470,140]],mouth:[240,710],stars:[[470,330],[390,460],[270,650]],bubble:true,fan:-1,tip:'先升空，再借左风落进小怪兽嘴里。'},
    {name:'甜糖毕业礼',p:[360,380],a:[[180,100],[540,100],[360,60]],mouth:[360,710],stars:[[360,470],[360,560],[360,650]],tip:'找出三根绳子的位置，可以分次剪，也可以一划剪断。'}
  ];
  games.ropefeast={
    init(s){const l=ropeLevels[s.level];s.title=l.name;s.tip=l.tip;s.candy={x:l.p[0],y:l.p[1],ox:l.p[0],oy:l.p[1],bubble:!!l.bubble};s.ropes=l.a.map(([x,y],i)=>({uid:i,x,y,length:Math.hypot(x-l.p[0],y-l.p[1]),cut:false}));s.mouth={x:l.mouth[0],y:l.mouth[1]};s.tokens=l.stars.map(([x,y],i)=>({uid:i,x,y,got:false}));s.fan=!!l.fan;s.fanDir=l.fan||0;s.fanOn=false;s.popped=false;s.cuts=0;},
    act(s,type,p,e){if(type==='cut'){let cut=false;const lines=Array.isArray(p.path)&&p.path.length<=101?p.path.slice(1).map((b,i)=>({ax:p.path[i].x,ay:p.path[i].y,bx:b.x,by:b.y})):[p];for(const r of s.ropes)if(!r.cut&&(p?.index===r.uid||lines.some(v=>v&&finite(v.ax,-100,820)&&finite(v.ay,-100,900)&&finite(v.bx,-100,820)&&finite(v.by,-100,900)&&segment(v.ax,v.ay,v.bx,v.by,r.x,r.y,s.candy.x,s.candy.y)))){r.cut=true;s.cuts++;cut=true;emit(e,'cut',{x:(r.x+s.candy.x)/2,y:(r.y+s.candy.y)/2,ax:r.x,ay:r.y,bx:s.candy.x,by:s.candy.y});}if(cut)s.moves++;return cut;}
      if(type==='pop'&&s.candy.bubble){s.candy.bubble=false;s.popped=true;emit(e,'pop',{x:s.candy.x,y:s.candy.y});return true;}
      if(type==='fan'&&s.fan){s.fanOn=!s.fanOn;emit(e,'lever');return true;}return false;
    },
    step(s,dt,e){const c=s.candy,oldx=c.x,oldy=c.y;let vx=(c.x-c.ox)*.998,vy=(c.y-c.oy)*.998;
      // State velocities use the engine's fixed 1/120-second physics step.
      c.x+=vx+(s.fanOn?s.fanDir*400:0)*dt*dt;c.y+=vy+(c.bubble?-170:610)*dt*dt;c.ox=oldx;c.oy=oldy;
      for(let k=0;k<8;k++)for(const r of s.ropes)if(!r.cut){const dx=c.x-r.x,dy=c.y-r.y,d=Math.hypot(dx,dy);if(d>r.length){c.x=r.x+dx*r.length/d;c.y=r.y+dy*r.length/d;}}
      for(const p of s.tokens)if(!p.got&&dist(p,c)<38){p.got=true;s.stars++;s.score+=100;emit(e,'star',{x:p.x,y:p.y});}
      if(dist(c,s.mouth)<49){s.score+=500;s.stars=Math.max(1,s.stars);finish(s,e,true);}
      else if(c.y>H+40||c.y<20||c.x< -30||c.x>W+30)finish(s,e,false);
    },
    valid:s=>s.candy&&['x','ox'].every(k=>finite(s.candy[k],-80,800))&&['y','oy'].every(k=>finite(s.candy[k],-50,880))&&typeof s.candy.bubble==='boolean'&&Array.isArray(s.ropes)&&s.ropes.length===ropeLevels[s.level].a.length&&s.ropes.every((r,i)=>r.uid===i&&r.x===ropeLevels[s.level].a[i][0]&&r.y===ropeLevels[s.level].a[i][1]&&finite(r.length,100,500)&&typeof r.cut==='boolean')&&Array.isArray(s.tokens)&&s.tokens.length===3&&s.tokens.every(p=>typeof p.got==='boolean'&&finite(p.x,100,600)&&finite(p.y,100,750))&&typeof s.fanOn==='boolean'&&typeof s.popped==='boolean'&&[-1,0,1].includes(s.fanDir)&&s.mouth?.x===ropeLevels[s.level].mouth[0]&&s.mouth?.y===710,
    hint(s){const l=ropeLevels[s.level];return {message:l.tip,ropes:s.ropes.filter(r=>!r.cut).map(r=>r.uid)};}
  };

  // Snail: authored mechanisms. The snail waits at unbridged edges instead of
  // demanding pixel-perfect timing; linked mechanisms still require sequencing.
  const SLEVELS=[
    {name:'搭一座小桥',tip:'点绿色开关，把缺口补上。',floor:[[35,265,660],[415,690,660]],bridges:[{x:265,w:150,y:660,key:0,on:true}],switches:['绿桥'],start:[95,660],exit:[630,660]},
    {name:'一桥接一桥',tip:'绿色开关一次只能打开一座桥，等蜗牛过了第一座再切换。',floor:[[35,210,660],[300,420,660],[510,690,660]],bridges:[{x:210,w:90,y:660,key:0,on:true},{x:420,w:90,y:660,key:0,on:false}],switches:['换桥'],start:[85,660],exit:[635,660]},
    {name:'门和桥',tip:'先放下绿桥，再打开蓝色闸门。',floor:[[35,260,660],[380,690,660]],bridges:[{x:260,w:120,y:660,key:0,on:true}],gates:[{x:520,y:660,key:1,open:true}],switches:['绿桥','蓝门'],start:[80,660],exit:[635,660]},
    {name:'乘升降台',tip:'等蜗牛站到升降台中央，再按黄色开关送它上楼。',floor:[[35,300,660],[420,690,430]],lift:{x:300,w:120,bottom:660,top:430,key:0},switches:['升降台'],start:[85,660],exit:[630,430]},
    {name:'高处的小桥',tip:'先乘升降台上楼，再打开通往小屋的绿桥。',floor:[[35,260,660],[380,475,430],[565,690,430]],lift:{x:260,w:120,bottom:660,top:430,key:0},bridges:[{x:475,w:90,y:430,key:1,on:true}],switches:['升降台','绿桥'],start:[85,660],exit:[635,430]},
    {name:'关掉红灯',tip:'红灯亮时不能通过。蓝色开关同时控制两道闸门，走过一道再换。',floor:[[35,690,660]],gates:[{x:280,y:660,key:0,open:true},{x:500,y:660,key:0,open:false}],switches:['切换闸门'],start:[85,660],exit:[635,660]},
    {name:'两层小旅行',tip:'蜗牛上到第二层后，先开桥，再开门。',floor:[[35,260,660],[380,455,430],[555,690,430]],lift:{x:260,w:120,bottom:660,top:430,key:0},bridges:[{x:455,w:100,y:430,key:1,on:true}],gates:[{x:600,y:430,key:2,open:true}],switches:['升降台','绿桥','蓝门'],start:[85,660],exit:[655,430]},
    {name:'桥门接力',tip:'绿色开关管桥，蓝色开关轮流打开两道门，记得分段操作。',floor:[[35,285,660],[395,690,660]],bridges:[{x:285,w:110,y:660,key:0,on:true}],gates:[{x:205,y:660,key:1,open:true},{x:515,y:660,key:1,open:false}],switches:['绿桥','换门'],start:[85,660],exit:[640,660]},
    {name:'空中换桥',tip:'先送蜗牛上楼，再用绿色开关轮流连接两座小桥。',floor:[[35,180,660],[300,380,430],[450,535,430],[605,695,430]],lift:{x:180,w:120,bottom:660,top:430,key:0},bridges:[{x:380,w:70,y:430,key:1,on:true},{x:535,w:70,y:430,key:1,on:false}],switches:['升降台','换桥'],start:[75,660],exit:[665,430]},
    {name:'机关大师',tip:'过第一道门后换门，站稳升降台再上楼，最后打开绿桥。',floor:[[35,280,660],[400,490,430],[580,695,430]],lift:{x:280,w:120,bottom:660,top:430,key:0},bridges:[{x:490,w:90,y:430,key:1,on:true}],gates:[{x:180,y:660,key:2,open:true},{x:630,y:430,key:2,open:false}],switches:['升降台','绿桥','换门'],start:[75,660],exit:[670,430]}
  ];
  const floors=SLEVELS.map(l=>l.floor.map(([a,b,y])=>({x:a,w:b-a,y}))),liftGround={lift:true};
  function surfaceAt(s,x,y){const l=SLEVELS[s.level];for(const p of floors[s.level])if(x>=p.x&&x<=p.x+p.w&&Math.abs(p.y-y)<4)return p;for(const p of l.bridges||[])if(s.switches[p.key]===p.on&&x>=p.x&&x<=p.x+p.w&&Math.abs(p.y-y)<4)return p;const lift=l.lift;if(lift&&x>=lift.x&&x<=lift.x+lift.w&&Math.abs(s.liftY-y)<4)return liftGround;return null;}
  games.snailquest={
    init(s){const l=SLEVELS[s.level];s.title=l.name;s.tip=l.tip;s.switches=l.switches.map(()=>false);s.snail={x:l.start[0],y:l.start[1],walk:true,waiting:false};s.liftY=l.lift?.bottom??0;s.riding=false;s.tokens=[.25,.53,.8].map((f,i)=>({uid:i,x:l.start[0]+(l.exit[0]-l.start[0])*f,got:false}));s.wait=0;},
    act(s,type,p,e){if(type==='switch'&&integer(p?.index,0,s.switches.length-1)){s.switches[p.index]=!s.switches[p.index];s.moves++;emit(e,'lever',{index:p.index});return true;}if(type==='walk'){s.snail.walk=!s.snail.walk;return true;}return false;},
    step(s,dt,e){const l=SLEVELS[s.level],b=s.snail,lift=l.lift;const oldLift=s.liftY;
      if(lift){const target=s.switches[lift.key]?lift.top:lift.bottom;s.liftY+=clamp(target-s.liftY,-100*dt,100*dt);if(s.riding)b.y+=s.liftY-oldLift;}
      b.waiting=false;if(!b.walk)return;
      if(s.riding&&lift&&s.liftY>lift.top+1){b.waiting=true;return;}
      const nx=b.x+46*dt,ground=surfaceAt(s,nx+15,b.y);
      const gate=(l.gates||[]).find(g=>s.switches[g.key]!==g.open&&g.x>b.x&&g.x-nx<48&&Math.abs(g.y-b.y)<8);
      if(!ground||gate){b.waiting=true;s.wait+=dt;return;}
      b.x=nx;s.riding=!!ground.lift;if(s.riding&&b.x<lift.x+lift.w/2){s.riding=false;}
      for(const p of s.tokens){const starY=lift&&p.x>=lift.x?lift.top:660;if(!p.got&&b.x>=p.x&&Math.abs(b.y-starY)<8){p.got=true;s.stars++;s.score+=100;emit(e,'star',{x:b.x,y:b.y-60});}}
      if(b.x>=l.exit[0]-12&&Math.abs(b.y-l.exit[1])<8){s.score+=500;finish(s,e,true);}
    },
    valid:s=>Array.isArray(s.switches)&&s.switches.length===SLEVELS[s.level].switches.length&&s.switches.every(b=>typeof b==='boolean')&&s.snail&&finite(s.snail.x,20,710)&&finite(s.snail.y,350,700)&&typeof s.snail.walk==='boolean'&&typeof s.snail.waiting==='boolean'&&finite(s.liftY,0,660)&&typeof s.riding==='boolean'&&Array.isArray(s.tokens)&&s.tokens.length===3&&s.tokens.every(p=>finite(p.x,50,700)&&typeof p.got==='boolean')&&finite(s.wait,0,1e6),
    hint(s){return{message:SLEVELS[s.level].tip};}
  };

  function fresh(id,level=0,seed=Math.floor(Math.random()*4294967296)){
    if(!games[id]||!integer(level,0,LEVELS-1)||!integer(seed,0,4294967295))throw new RangeError('Unknown casual game');
    const s={version:1,id,level,seed,rng:seed,t:0,acc:0,phase:'playing',score:0,stars:0,moves:0};games[id].init(s);return s;
  }
  function act(s,type,p={}){const events=[];if(s.phase!=='playing'||!p||typeof p!=='object')return{ok:false,events};if((type==='aim'||type==='fire')&&['x','y'].some(k=>p[k]!==undefined&&!finite(p[k],-1000,2000)))return{ok:false,events};if(type==='aim'&&(!Number.isFinite(p.x)||!Number.isFinite(p.y)))return{ok:false,events};const ok=games[s.id].act(s,type,p,events);return{ok:!!ok,events};}
  function tick(s,dt){const events=[];if(s.phase!=='playing'||!finite(dt,0,10))return{ok:false,events};s.acc+=Math.min(dt,.1);let steps=0;
    while(s.acc>=1/120&&s.phase==='playing'&&steps++<13){s.acc-=1/120;s.t+=1/120;games[s.id].step(s,1/120,events);}return{ok:events.length>0,events};
  }
  function restore(id,raw){const fail=()=>fresh(id);if(!games[id])throw new RangeError('Unknown casual game');
    try{if(!raw||JSON.stringify(raw).length>60000||raw.version!==1||raw.id!==id||!integer(raw.level,0,9)||!integer(raw.seed,0,4294967295)||!integer(raw.rng,0,4294967295)||!finite(raw.t,0,1e6)||!finite(raw.acc,0,.02)||!integer(raw.score,0,1e8)||!integer(raw.stars,0,3)||!integer(raw.moves,0,1e6)||!['playing','won','lost'].includes(raw.phase)||!games[id].valid(raw))return fail();
      const model=fresh(id,raw.level,raw.seed);if(!validExtras(raw,model))return fail();for(const k of Object.keys(model))model[k]=clone(raw[k]);return model;
    }catch{return fail();}
  }
  function validExtras(s,model){
    for(const [k,v]of Object.entries(model)){
      if(!(k in s))return false;
      if(typeof v==='number'&&!finite(s[k],-1e8,4294967295)||typeof v==='boolean'&&typeof s[k]!=='boolean'||typeof v==='string'&&typeof s[k]!=='string')return false;
    }
    if(model.aim&&(!s.aim||!finite(s.aim.x,0,W)||!finite(s.aim.y,0,H)))return false;
    if(model.nextId&&!integer(s.nextId,1,1e6))return false;
    if(model.title&&(s.title!==model.title||s.tip!==model.tip))return false;
    const unique=items=>items.every(b=>integer(b.uid,1,s.nextId-1))&&new Set(items.map(b=>b.uid)).size===items.length;
    if(s.id==='bubblepop')return unique(s.bubbles)&&integer(s.rescued,0,s.totalPets)&&s.totalPets===model.totalPets&&integer(s.combo,0,2);
    if(s.id==='brickball')return unique([...s.bricks,...s.pickups,...s.balls])&&integer(s.destroyed,0,1000)&&(s.returnX===null||finite(s.returnX,20,700))&&(!s.balls.length||!!s.volley);
    if(s.id==='goldminer')return unique(s.items)&&s.nextId===model.nextId&&s.target===model.target&&s.score===s.earned&&s.items.every(b=>JSON.stringify(b)===JSON.stringify(model.items.find(p=>p.uid===b.uid)))&&(!s.hook.item||s.hook.mode==='back');
    // Math.hypot can differ by one ULP between JavaScript engines.
    if(s.id==='ropefeast')return s.fan===model.fan&&s.fanDir===model.fanDir&&s.cuts===s.ropes.filter(r=>r.cut).length&&s.ropes.every((r,i)=>Math.abs(r.length-model.ropes[i].length)<1e-9)&&Math.abs(s.candy.x-s.candy.ox)<20&&Math.abs(s.candy.y-s.candy.oy)<20&&s.tokens.every((p,i)=>p.uid===i&&p.x===model.tokens[i].x&&p.y===model.tokens[i].y);
    if(s.id==='snailquest')return s.tokens.every((p,i)=>p.uid===i&&p.x===model.tokens[i].x)&&s.stars===s.tokens.filter(p=>p.got).length&&(!s.riding||!!SLEVELS[s.level].lift);
    return false;
  }
  function hint(s){return games[s.id].hint(s);}
  function layout(s){return s.id==='snailquest'?clone(SLEVELS[s.level]):s.id==='ropefeast'?clone(ropeLevels[s.level]):null;}
  const api={W,H,LEVELS,META,clone,clamp,dist,segment,fresh,act,tick,restore,hint,layout,bpos};
  if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CasualCore=api;
})(typeof window==='object'?window:null);
