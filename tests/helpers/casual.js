'use strict';
const C=require('../../assets/js/casual-core.js');
function advance(s,seconds){for(let i=0;i<Math.round(seconds*120)&&s.phase==='playing';i++)C.tick(s,1/120);return s;}
function settle(s){for(let i=0;i<190&&s.phase==='playing'&&(s.shot||s.volley);i++)C.tick(s,.1);return s;}
function bubble(s){for(let i=0;i<45&&s.phase==='playing';i++){C.act(s,'fire',C.hint(s));settle(s);}return s;}
function brickAim(s){let best=null,value=-Infinity;for(let i=-16;i<=16;i++){const a=i*.075,p={x:C.clamp(s.origin+Math.tan(a)*150,0,720),y:560},copy=C.clone(s);C.act(copy,'fire',p);settle(copy);const v=copy.phase==='won'?1e7:copy.phase==='lost'?-1e7:copy.score-s.score+copy.bonus*50+(copy.ballCount-s.ballCount)*60-copy.bricks.reduce((n,b)=>n+Math.max(0,b.y-280)*b.hp*.04,0);if(v>value){value=v;best=p;}}return best;}
function brick(s){for(let i=0;i<30&&s.phase==='playing';i++){C.act(s,'fire',brickAim(s));settle(s);}return s;}
function miner(s){for(let f=0;f<13000&&s.phase==='playing';f++){const h=s.hook;if(h.mode==='swing'&&s.items.some(b=>b.kind!=='stone'&&Math.abs(Math.atan2(b.x-360,b.y-145)-h.angle)<.03))C.act(s,'fire');if(h.mode==='back'&&s.items.find(b=>b.uid===h.item)?.kind==='stone')C.act(s,'discard');C.tick(s,1/120);}return s;}
function rope(s){const l=s.level;if(l===1||l===2){C.act(s,'cut',{index:l===1?0:1});advance(s,72/120);C.act(s,'cut',{index:l===1?1:0});}else if([3,7,8].includes(l)){C.act(s,'cut',{index:0});advance(s,(l===3?142:104)/120);C.act(s,'pop');if(s.fan){advance(s,8/120);C.act(s,'fan');}}else{if(s.fan)C.act(s,'fan');C.act(s,'cut',{path:[{x:0,y:240},{x:720,y:240}]});}return advance(s,8);}
function snailActions(s){const l=C.layout(s),b=s.snail,keys=[];for(const g of l.gates||[])if(g.x>b.x&&g.x-b.x<90&&Math.abs(g.y-b.y)<8&&s.switches[g.key]!==g.open)keys.push(g.key);for(const br of l.bridges||[])if(br.x+br.w>b.x&&br.x-b.x<90&&Math.abs(br.y-b.y)<8&&s.switches[br.key]!==br.on)keys.push(br.key);if(s.riding&&l.lift&&!s.switches[l.lift.key])keys.push(l.lift.key);return [...new Set(keys)];}
function snail(s){for(let f=0;f<600&&s.phase==='playing';f++){for(const index of snailActions(s))C.act(s,'switch',{index});C.tick(s,.1);}return s;}
module.exports={C,advance,settle,bubble,brickAim,brick,miner,rope,snailActions,snail};
