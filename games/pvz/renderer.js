/* Atlas playback is driven by simulation time, so pausing also pauses every actor. */
window.createPVZRenderer = function (canvas) {
  'use strict';
  const C=PVZCore,ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true}),images=new Map(),atlasPages=new Map();
  const W=1100,H=700,X=110,CELL=82,TOP=156,HEIGHT=486;
  let catalog,background,info,fx=[],deaths=[],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,lost=false,bossData;
  const rigs=new Map(),bossImages=new Map();
  const rigFiles={gatlingpea:'plant-motion',twinsunflower:'plant-motion',wintermelon:'plant-motion',gloomshroom:'actor-motion',cattail:'actor-motion',goldmagnet:'actor-motion',spikerock:'actor-motion',cobcannon:'actor-motion',imitater:'actor-motion'};
  async function json(path){const response=await fetch('media/'+path);if(!response.ok)throw Error('无法加载 '+path);return response.json();}
  function load(path){if(images.has(path))return images.get(path);const task=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{images.delete(path);reject(Error('无法加载 '+path));};im.src='media/'+path;});images.set(path,task);return task;}
  const stills={};
  async function prepare(s){
    info=C.levelInfo(s.level);
    if(!catalog){const response=await fetch('media/packed/animations.json');if(!response.ok)throw Error('动画数据加载失败');catalog=await response.json();for(const a of Object.values(catalog.animations)){a.total=a.durations.reduce((x,y)=>x+y,0);a.ends=[];let sum=0;for(const d of a.durations)a.ends.push(sum+=d);}}
    const keys=new Set(['sun','zombie-walk','zombie-eat','zombie-die']);
    const types=[...s.deck,...s.plants.map(p=>p.type),...(s.deck.includes('imitater')?[s.imitate]:[]),...(info.mode==='normal'?[]:C.available(s.level))];
    for(const type of types){const art=C.plants[type]?.art||type;for(const k of Object.keys(catalog.animations))if(k===art||k.startsWith(art+'-'))keys.add(k);}
    const enemyTypes=new Set([...C.enemyPool(s),'flag',...s.zombies.map(z=>z.type),...s.spawnQueue.map(z=>z.type)]);
    if(enemyTypes.has('dancer'))enemyTypes.add('backup');
    if(enemyTypes.has('gargantuar')||info.mode==='boss'){enemyTypes.add('gargantuar');enemyTypes.add('imp');}
    if(info.pool)for(const type of ['ducky1','ducky2','ducky3'])enemyTypes.add(type);
    for(const type of enemyTypes)for(const k of Object.keys(catalog.animations))if(k.startsWith(type+'-')||type.startsWith('ducky')&&k==='ducky-die')keys.add(k);
    if(types.includes('fumeshroom'))keys.add('fume-cloud');
    if(types.includes('tanglekelp'))keys.add('tanglekelp-grab');
    if(types.includes('jalapeno'))keys.add('jalapeno-fire');
    if(info.mode==='bowling'){keys.add('wallnut-roll');keys.add('explodenut');}
    const pages=new Set();for(const key of keys)for(const frame of catalog.animations[key]?.frames||[])pages.add(frame[0]);
    for(const page of [...atlasPages.keys()])if(!pages.has(page)){atlasPages.delete(page);images.delete('packed/actors-'+page+'.png');}
    await Promise.all([...pages].map(async page=>atlasPages.set(page,await load('packed/actors-'+page+'.png'))));
    const path=info.mode==='boss'?'original/boss-background.png':info.roof?'original/roof.png':info.pool?'original/pool.png':info.night?'original/night.jpg':'lawn.jpg';
    background=await load(path);
    await Promise.all([...new Set(types.filter(type=>rigFiles[type]))].map(async type=>{const path='runtime/'+rigFiles[type]+'/'+type;if(!rigs.has(type))rigs.set(type,{data:await json(path+'.json'),image:await load(path+'.webp')});}));
    for(const type of [...rigs.keys()])if(!types.includes(type)){rigs.delete(type);images.delete('runtime/'+rigFiles[type]+'/'+type+'.webp');}
    if(info.mode==='boss'){
      bossData=await json('runtime/boss/tracks.json');const names=new Set();for(const actor of Object.values(bossData))for(const track of actor.tracks)for(const pose of track.poses)if(pose[8])names.add(pose[8]);
      await Promise.all([...names].map(async name=>bossImages.set(name,await load('runtime/boss/'+name+'.webp'))));
    }else{bossData=null;for(const name of bossImages.keys())images.delete('runtime/boss/'+name+'.webp');bossImages.clear();}
    const names=['sun','mower','pool-cleaner','grave','crater','vases','fog-cloud','meter-empty','meter-full','meter-flag','trophy','ladder','cabbage','kernel','butter','melon','star','puff','snow-pea','ice-trail','coin-silver'];
    await Promise.all(names.map(async name=>stills[name]=await load('original/'+name+'.png')));
    stills.pea=await load('pea.png');
    fx=[];deaths=[];draw(s);
  }
  const px=x=>X+x*CELL,py=row=>TOP+(row+.86)*HEIGHT/info.rows;
  function poseAt(poses,phase){const pos=Math.max(0,phase)*(poses.length-1),a=poses[Math.floor(pos)],b=poses[Math.min(poses.length-1,Math.floor(pos)+1)],u=pos%1;return a.map((v,i)=>i<6||i===7?v+(b[i]-v)*u:v);}
  function transform(p){const kx=p[4]*Math.PI/180,ky=p[5]*Math.PI/180;ctx.transform(Math.cos(kx)*p[2],Math.sin(kx)*p[2],-Math.sin(ky)*p[3],Math.cos(ky)*p[3],p[0],p[1]);}
  function rig(type,x,y,time,action=false,alpha=1){
    const entry=rigs.get(type);if(!entry)return false;const data=entry.data,c=data.clips?(data.clips[action?type+'-attack':type]||data.clips[type]||Object.values(data.clips)[0]):data;
    const phase=reduced?0:((Math.max(0,time)*100)%c.duration)/c.duration;
    ctx.save();ctx.translate(x+(c.origin?.[0]||0),y+(c.origin?.[1]||0));ctx.scale(c.scale||1,c.scale||1);ctx.globalAlpha*=alpha;
    for(const group of c.groups){ctx.save();if(group.attachment)transform(poseAt(group.attachment,phase));for(const track of group.tracks){const p=poseAt(track.poses,phase),f=data.frames[p[8]];if(!f||p[6]<0||p[7]<=0)continue;ctx.save();transform(p);ctx.globalAlpha*=p[7];ctx.drawImage(entry.image,...f,0,0,f[2],f[3]);ctx.restore();}ctx.restore();}ctx.restore();return true;
  }
  function sprite(name,x,y,time,scale=1,alpha=1,flip=false){
    const a=catalog?.animations[name];if(!a)return false;
    let t=reduced?0:(Math.max(0,time)*100)%a.total,idx=a.ends.findIndex(end=>end>t);if(idx<0)idx=0;
    const [page,sx,sy,sw,sh,ox,oy]=a.frames[idx],im=atlasPages.get(page);if(!im)return false;
    ctx.save();ctx.translate(x,y);ctx.scale(flip?-scale:scale,scale);ctx.globalAlpha*=alpha;
    ctx.drawImage(im,sx,sy,sw,sh,ox-a.anchor[0],oy-a.anchor[1],sw,sh);ctx.restore();return true;
  }
  function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function shadow(x,y,w=28){ctx.fillStyle='#15210e35';ctx.beginPath();ctx.ellipse(x,y,w,9,0,0,Math.PI*2);ctx.fill();}
  function plantName(p){
    let name=C.plants[p.type].art||p.type;
    if(p.type==='potatomine'&&p.age<C.balance.mineArm)name+='-unarmed';
    else if(p.type==='sunshroom'&&p.age>120)name+='-big';
    else if(p.type==='scaredyshroom'&&p.scared)name+='-scared';
    else if(p.type==='chomper'&&p.cd>1)name+=p.attack>0?'-bite':'-digest';
    else if(['wallnut','tallnut','pumpkin','garlic'].includes(p.type)){const fraction=p.hp/C.plants[p.type].hp;if(fraction<.33)name+='-cracked2';else if(fraction<.66)name+='-cracked1';}
    else if(p.attack>0&&catalog.animations[name+'-attack'])name+='-attack';
    return name;
  }
  function plant(p,time,ghost=false){
    let x=px(p.col+.5),y=py(p.row),scale=1.1;
    const asleep=C.plants[p.type].mushroom&&!info.night&&!p.awake&&info.mode!=='boss';
    if(p.type==='squash'&&p.targetX!==undefined){const u=1-p.cd/.65;x+=(px(p.targetX)-x)*u;y-=Math.sin(u*Math.PI)*110;}
    shadow(x,y);
    if(!rig(p.type,x,y,asleep?0:time+p.id*.17,p.attack>0,ghost?.5:1))sprite(plantName(p),x,y,asleep?0:time+p.id*.17,scale,ghost?.5:1);
    if(asleep){ctx.fillStyle='#e8e4ff';ctx.font='bold 23px sans-serif';ctx.fillText('Z',x+23,y-55);}
    if(p.ladder)ctx.drawImage(stills.ladder,x-25,y-87,42,92);
    if(p.type==='cobcannon'&&p.cd===0){circle(x+25,y-60,9,'#ffdf57');}
  }
  function zombieName(z){
    if(z.headless)return catalog.animations[z.type+'-headless']?z.type+'-headless':'zombie-headless';
    let type=z.type;if(['cone','bucket','door'].includes(type)&&z.armor===0)type='zombie';
    if(type==='football'&&z.armor===0)type='football-bare';
    if(type==='newspaper'&&z.armor===0)type='newspaper-mad';
    if(z.underground)return 'digger-dig';if(z.type==='balloon'&&z.air)return 'balloon-fly';
    if(z.type==='pole')return z.action==='jump'?'pole-jump':z.action==='eat'?'pole-eat':z.jumped?'pole-walk':'pole-run';
    if(z.type==='dolphin')return z.action==='jump'?'dolphin-jump':z.action==='eat'?'dolphin-eat':z.jumped?'dolphin-swim':'dolphin-ride';
    if(z.type==='snorkel')return z.action==='eat'?'snorkel-eat':'snorkel-swim';
    if(z.type==='pogo'&&!z.disarmed)return 'pogo-bounce';if(z.type==='bungee')return 'bungee-drop';
    if(z.type==='gargantuar'&&z.action==='smash')return 'gargantuar-smash';
    let key=type+'-'+(z.action==='eat'?'eat':'walk');return catalog.animations[key]?key:'zombie-walk';
  }
  function boss(z,time){
    if(!bossData)return;
    function tracks(actor,name,phase){const [start,length]=actor.clips[name],pos=start+(reduced?0:(phase*12)%(length-1)),index=Math.floor(pos),u=pos-index;
      for(const track of actor.tracks){const a=track.poses[index],b=track.poses[index+1]||a,p=a.map((v,i)=>i<6||i===7?v+(b[i]-v)*u:v),im=bossImages.get(p[8]);if(p[6]<0||!im||p[7]<=0)continue;ctx.save();transform(p);ctx.globalAlpha*=p[7];ctx.drawImage(im,0,0);ctx.restore();}}
    ctx.save();ctx.translate(290,135);ctx.scale(.57,.57);tracks(bossData.body,z.shielded?'anim_idle':'anim_head_idle',time);if(!z.shielded){ctx.translate(680,60);ctx.scale(.7,.7);tracks(bossData.driver,z.hurt>0?'anim_damage':'anim_idle',time);}ctx.restore();
  }
  function receive(events){for(const e of events){
    if(e.kind==='death'){if(deaths.length>=32)deaths.shift();deaths.push({...e,age:0,life:1.2});}
    else if(['blast','impact','plant','fume','fire','freeze','wind','vase','magnet','smash','bossattack','basketball','mower'].includes(e.kind)){if(fx.length>=100)fx.shift();fx.push({...e,age:0,life:['fire','freeze','wind'].includes(e.kind)?1.2:.55});}
  }}
  function advance(dt){for(const e of fx)e.age+=dt;for(const e of deaths)e.age+=dt;fx=fx.filter(e=>e.age<e.life);deaths=deaths.filter(e=>e.age<e.life);}
  function draw(s,selection=null,hover=null){
    if(lost||!background||!catalog)return;
    ctx.fillStyle='#1c291b';ctx.fillRect(0,0,W,H);ctx.drawImage(background,140,0,1100,600,0,100,1100,600);
    if(info.night&&info.pool){ctx.fillStyle='#08182f5c';ctx.fillRect(0,100,W,600);}
    const rh=HEIGHT/info.rows;
    if(info.lanes.length<5)for(let r=0;r<5;r++)if(!info.lanes.includes(r)){ctx.fillStyle='#675337b0';ctx.fillRect(X,TOP+r*rh,CELL*9,rh);}
    for(const cell of s.graves)ctx.drawImage(stills.grave,px(cell%9)+8,py(Math.floor(cell/9))-75,65,82);
    for(const c of s.craters)ctx.drawImage(stills.crater,px(c.cell%9)+6,py(Math.floor(c.cell/9))-29,70,37);
    for(const ice of s.ice){ctx.globalAlpha=.55;ctx.drawImage(stills['ice-trail'],px(ice.col),py(ice.row)-25,CELL*(9-ice.col),40);ctx.globalAlpha=1;}
    if(selection&&hover&&hover.row>=0&&hover.row<info.rows&&hover.col>=0&&hover.col<9){
      const allowed=selection==='shovel'||C.canPlant(s,selection,hover.row,hover.col);ctx.fillStyle=allowed?'#e7ffa344':'#ff363655';ctx.fillRect(px(hover.col),TOP+hover.row*rh,CELL,rh);ctx.strokeStyle=allowed?'#fcffb1':'#ff7777';ctx.lineWidth=3;ctx.strokeRect(px(hover.col)+1,TOP+hover.row*rh+1,CELL-2,rh-2);
    }
    for(const m of s.mowers)if(!m.spent){const im=stills[C.water(s,m.row)?'pool-cleaner':'mower'];ctx.drawImage(im,px(m.x)-36,py(m.row)-42,65,50);}
    const actors=[];for(const p of s.plants)actors.push({kind:'p',item:p,depth:p.row*10+(C.plants[p.type].base?0:C.plants[p.type].armor?3:1)});for(const z of s.zombies)actors.push({kind:'z',item:z,depth:z.row*10+2});actors.sort((a,b)=>a.depth-b.depth);
    for(const {kind,item} of actors){if(kind==='p')plant(item,s.time);else{const z=item;if(z.type==='boss'){boss(z,s.time);continue;}const x=px(z.x),y=py(z.row)+(z.underground?20:0)-(z.air?70:0);shadow(x,py(z.row));if(z.type==='bungee'){ctx.strokeStyle='#d5c8a2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,110);ctx.lineTo(x,y-50);ctx.stroke();}
      const animation=zombieName(z),jumpDuration=catalog.animations[animation]?.total/100||.7,animTime=z.action==='jump'?Math.min(jumpDuration-.001,(.7-z.actionTime)/.7*jumpDuration):(z.animTime??z.age);
      sprite(animation,x,y,animTime,info.little?.65:z.type==='gargantuar'?1.05:1.1,z.underground?.6:1,z.dir>0);
      if(z.slow>0||z.freeze>0){ctx.strokeStyle='#a4e8ff';ctx.lineWidth=3;ctx.strokeRect(x-27,y-90,54,90);}
      if(z.hurt>0){ctx.globalAlpha=z.hurt*2;circle(x,y-55,24,'#ffedb4');ctx.globalAlpha=1;}
    }}
    for(const v of s.vases){const im=stills.vases;ctx.drawImage(im,v.green?80:0,101,80,101,px(v.col)+12,py(v.row)-75,60,80);}
    for(const d of deaths){const key=catalog.animations[d.type+'-die']?d.type+'-die':'zombie-die';sprite(key,px(d.x),py(d.row),d.age,1.1,Math.min(1,(d.life-d.age)*3));}
    for(const q of s.shots){let x=px(q.x),y=py(q.y)-45;if(q.lob)y-=Math.sin(Math.min(1,q.age/(q.type==='cobcannon'?1.8:.85))*Math.PI)*(q.type==='cobcannon'?220:150);
      if(q.bowling){ctx.save();ctx.translate(x,py(q.y)-26);ctx.rotate(q.age*7);sprite(q.type==='cherrybomb'?'explodenut':'wallnut-roll',0,28,q.age,.9);ctx.restore();continue;}
      const name=q.butter?'butter':q.type==='starfruit'?'star':q.lob?q.type==='cabbagepult'?'cabbage':q.type==='kernelpult'?'kernel':'melon':q.ice?'snow-pea':q.type.includes('shroom')?'puff':'pea';
      const im=stills[name],size=q.lob?28:q.type==='starfruit'?25:19;if(q.fire){circle(x,y,16,'#f99c35aa');circle(x-9,y,10,'#ff4d1877');}if(im)ctx.drawImage(im,x-size/2,y-size/2,size,size);
    }
    for(const e of fx){const u=e.age/e.life,x=px(e.x??4.5),y=py(e.row??2);ctx.globalAlpha=1-u;
      if(e.kind==='fire'){sprite('jalapeno-fire',px(4.5),y,e.age,1.4);ctx.fillStyle='#ff7e2933';ctx.fillRect(X,y-80,CELL*9,90);}
      else if(e.kind==='freeze'){ctx.fillStyle='#b3edff66';ctx.fillRect(0,110,W,H-110);}
      else if(e.kind==='fume')sprite('fume-cloud',x+110,y-18,e.age,1.5);
      else if(e.kind==='magnet'){ctx.strokeStyle='#8fdcff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-35);ctx.lineTo(px(e.tx),py(e.ty)-40);ctx.stroke();}
      else{const radius=e.kind==='blast'?85:e.kind==='smash'?60:24;ctx.strokeStyle=e.kind==='plant'?'#ad9b55':'#ffd85e';ctx.lineWidth=8*(1-u)+1;ctx.beginPath();ctx.arc(x,y-30,8+u*radius,0,Math.PI*2);ctx.stroke();if(!reduced)for(let n=0;n<8;n++){const a=n*Math.PI/4;circle(x+Math.cos(a)*u*radius,y-30+Math.sin(a)*u*radius,5*(1-u)+1,n%2?'#ffe084':'#ee772e');}}
      ctx.globalAlpha=1;
    }
    if(info.world===3&&s.fogClear===0&&!info.storm){ctx.save();ctx.beginPath();ctx.rect(px(4.5),TOP,CELL*4.5,HEIGHT);for(const p of s.plants)if(p.type==='plantern')ctx.arc(px(p.col+.5),py(p.row)-30,165,0,Math.PI*2,true);ctx.clip('evenodd');ctx.globalAlpha=.77;ctx.drawImage(stills['fog-cloud'],px(4.5),130,480,530);ctx.restore();}
    if(info.storm){const lit=s.time%5<.55;ctx.fillStyle=lit?'#e4edff22':'#030a1bd9';ctx.fillRect(0,110,W,H-110);if(!reduced){ctx.strokeStyle='#b2d6f177';ctx.lineWidth=1;ctx.beginPath();for(let n=0;n<60;n++){const x=(n*79+s.time*80)%W,y=130+(n*123+s.time*420)%550;ctx.moveTo(x,y);ctx.lineTo(x-7,y+15);}ctx.stroke();}}
    if(selection&&C.plants[selection]&&hover&&C.canPlant(s,selection,hover.row,hover.col))plant({id:0,type:selection,row:hover.row,col:hover.col,hp:C.plants[selection].hp,age:0,cd:0,attack:0},s.time,true);
    for(const ball of s.bossBalls){const im=bossImages.get(ball.type==='fire'?'ZOMBIE_BOSS_FIREBALL':'ZOMBIE_BOSS_ICEBALL');if(im){ctx.save();ctx.translate(px(ball.x),py(ball.row)-35);ctx.rotate(ball.age*2);ctx.drawImage(im,-40,-40,80,80);ctx.restore();}}
    for(const sun of s.suns)if(sun.currency==='coin')ctx.drawImage(stills['coin-silver'],px(sun.x)-17,py(sun.y)-52,34,34);else sprite('sun',px(sun.x),py(sun.y)-35,s.time,Math.min(1.1,.8+sun.value/100));
    ctx.fillStyle='#e3dfb8';ctx.font='bold 17px sans-serif';ctx.textAlign='right';ctx.fillText(info.name,1080,132);
    if(s.waveWarning){ctx.fillStyle='#302317e8';ctx.fillRect(290,116,510,35);ctx.fillStyle='#ffdf88';ctx.textAlign='center';ctx.font='bold 20px sans-serif';ctx.fillText(`${s.wave+1===info.waves?'最后一波':'一大波僵尸'} · ${Math.max(1,Math.ceil(s.waveIn))} 秒后到达`,545,141);}
    const progress=info.mode==='boss'?1-(s.zombies.find(z=>z.type==='boss')?.hp??40000)/40000:s.wave/info.waves;
    ctx.fillStyle='#17261c';ctx.fillRect(868,656,210,17);ctx.fillStyle='#8db145';ctx.fillRect(871,659,204*Math.max(0,Math.min(1,progress)),11);ctx.strokeStyle='#ceb788';ctx.strokeRect(868,656,210,17);ctx.textAlign='left';
    if(s.phase==='ready'){ctx.fillStyle='#15251c55';ctx.fillRect(0,110,W,H-110);}
  }
  function hit(clientX,clientY){const r=canvas.getBoundingClientRect(),x=(clientX-r.x)*W/r.width,y=(clientY-r.y)*H/r.height;return {x:(x-X)/CELL,y:(y-TOP)/(HEIGHT/info.rows),col:Math.floor((x-X)/CELL),row:Math.floor((y-TOP)/(HEIGHT/info.rows))};}
  canvas.addEventListener('contextlost',e=>{e.preventDefault();lost=true;});canvas.addEventListener('contextrestored',()=>{lost=false;window.dispatchEvent(new Event('pvz:redraw'));});
  return {prepare,draw,receive,advance,hit,point:(row,col)=>({x:px(col+.5),y:py(row)-25}),metrics:()=>({particles:fx.length,deaths:deaths.length,pages:atlasPages.size,atlasBytes:[...atlasPages.values()].reduce((n,im)=>n+im.naturalWidth*im.naturalHeight*4,0),contextLost:lost}),reset:()=>{fx=[];deaths=[];}};
};
