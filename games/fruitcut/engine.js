(function(root){
  const W=900,H=650,DURATION=60;
  function create(mode='relax'){return {mode:mode==='challenge'?'challenge':'relax',status:'ready',time:DURATION,elapsed:0,score:0,cut:0,bestCombo:0,bombs:0,fruits:[],spawn:0.2,nextId:1};}
  function intersects(a,b,f){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(length<36)return false;const t=Math.max(0,Math.min(1,((f.x-a.x)*dx+(f.y-a.y)*dy)/length));return (a.x+t*dx-f.x)**2+(a.y+t*dy-f.y)**2<=f.r*f.r;}
  function launch(s,random=Math.random){
    const count=2+Math.floor(random()*3),center=260+random()*380;
    for(let i=0;i<count;i++){
      const bomb=s.mode==='challenge'&&s.elapsed>4&&i===count-1&&random()<.32;
      s.fruits.push({id:s.nextId++,kind:bomb?'bomb':['melon','melon','orange','kiwi','peach'][Math.floor(random()*5)],x:Math.max(65,Math.min(W-65,center+(i-(count-1)/2)*100)),y:H+65,r:bomb?33:40+random()*10,vx:(W/2-center)*.18+(random()-.5)*80,vy:-690-random()*95,angle:random()*6.28,spin:(random()-.5)*2.8,entered:false});
    }
  }
  function step(s,dt,random=Math.random){
    if(s.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.05);s.elapsed+=dt;s.time=Math.max(0,DURATION-s.elapsed);
    if(!s.time){s.status='over';s.fruits=[];return;}
    s.spawn-=dt;if(s.spawn<=0){launch(s,random);s.spawn=1.35+random()*.35;}
    for(const f of s.fruits){f.vy+=740*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.angle+=f.spin*dt;if(f.y-f.r<H)f.entered=true;}
    s.fruits=s.fruits.filter(f=>f.y<H+120&&f.x>-100&&f.x<W+100);
  }
  function slash(s,a,b,stroke){
    if(s.status!=='playing'||![a.x,a.y,b.x,b.y].every(Number.isFinite))return [];
    const hits=[];
    // Fruit stays inside the playable field; starting below the screen cannot cut it.
    for(const f of s.fruits){
      if(!f.entered||!intersects(a,b,f))continue;
      if(f.kind==='bomb'){s.bombs++;s.score=Math.max(0,s.score-20);stroke.combo=0;hits.push({...f,points:-20});}
      else{stroke.combo=s.elapsed-(stroke.lastAt??-Infinity)<.4?(stroke.combo||0)+1:1;stroke.lastAt=s.elapsed;const points=10+(stroke.combo>1?5:0);s.score+=points;s.cut++;s.bestCombo=Math.max(s.bestCombo,stroke.combo);hits.push({...f,points,combo:stroke.combo});}
    }
    const removed=new Set(hits.map(f=>f.id));s.fruits=s.fruits.filter(f=>!removed.has(f.id));
    if(s.bombs>=3){s.status='over';s.fruits=[];}
    return hits;
  }
  const api={W,H,DURATION,create,step,launch,slash,intersects};if(typeof module!=='undefined')module.exports=api;else root.FruitCutEngine=api;
})(typeof window!=='undefined'?window:globalThis);
