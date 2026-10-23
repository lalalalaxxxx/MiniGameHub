/* Presentation clock is separate from combat: effects never change damage or rewards. */
(function(root){
  const colors=['#a8d55c','#ee9dcc','#99e7fc'];
  function fresh(){return {time:0,shots:{},hurt:{},bursts:[]};}
  function advance(fx,dt,events=[]){
    fx.time+=dt;
    for(const table of [fx.shots,fx.hurt])for(const key of Object.keys(table)){table[key]-=dt;if(table[key]<=0)delete table[key];}
    fx.bursts=fx.bursts.filter(b=>(b.age+=dt)<b.duration);
    for(const e of events){
      if(e.kind==='shot'){fx.shots[e.cell]=.48;const angle=Math.atan2(e.ty-e.y,e.tx-e.x);fx.bursts.push({kind:'muzzle',x:e.x+Math.cos(angle)*.32,y:e.y+Math.sin(angle)*.32,type:e.type,age:0,duration:.2});}
      if(e.kind==='hurt')fx.hurt[e.id]=.18;
      if(e.kind==='impact'||e.kind==='clear')fx.bursts.push({...e,age:0,duration:e.kind==='clear'?.7:.42});
    }
    fx.bursts=fx.bursts.slice(-100);
  }
  function frame(fx,cell,reduced=false){const shot=fx.shots[cell];return shot?reduced?5:Math.min(9,4+Math.floor((.48-shot)/.08)):reduced?0:Math.floor(fx.time*3+cell)%4;}
  function particles(fx,reduced=false){return fx.bursts.map(b=>{
    const u=b.age/b.duration,x=b.x*100,y=b.y*100,color=colors[b.type]||'#f1c85d';
    if(b.kind==='clear')return `<g class="reward-pop" transform="translate(${x},${y-u*45})" opacity="${1-u}"><circle r="${12+u*8}" fill="#f8dc73"/><text y="5" text-anchor="middle" fill="#795322" font-size="15" font-weight="bold">+7</text></g>`;
    const radius=b.kind==='muzzle'?18:b.type===1?72:b.type===2?42:28;
    if(reduced)return `<circle cx="${x}" cy="${y}" r="14" fill="${color}" opacity="${(1-u)*.5}"/>`;
    let art=`<circle r="${radius*u}" fill="none" stroke="${color}" stroke-width="${5*(1-u)}"/>`;
    for(let i=0;i<6;i++){const a=i*Math.PI/3,r=radius*(.25+.75*u),px=Math.cos(a)*r,py=Math.sin(a)*r;
      art+=b.type===2?`<path d="M${px-5} ${py}h10m-5-5v10" stroke="${color}" stroke-width="3"/>`:`<circle cx="${px}" cy="${py}" r="${(b.type===1?9:4)*(1-u)+1}" fill="${color}" ${b.type===1?'stroke="white" stroke-width="2"':''}/>`;}
    return `<g class="impact-burst" transform="translate(${x},${y})" opacity="${1-u}">${art}</g>`;
  }).join('');}
  const api={fresh,advance,frame,particles};if(typeof module!=='undefined')module.exports=api;else root.DefenseFX=api;
})(globalThis);
