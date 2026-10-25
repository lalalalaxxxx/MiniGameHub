'use strict';
const ids=['mirrorlight','firefly','boxtrail','colorsort','starpath'];
const game=id=>require('../../assets/js/extras/'+id+'.js');
function plan(id,level){return require('./'+(id==='mirrorlight'||id==='firefly'?'riddle-optics':id==='colorsort'?'riddle-sort':'riddle-path')+'.js').plan(id,level,37);}
async function perform(h,a){
  if(a.type==='tap')await h.tap(a.point);
  else if(a.type==='drag')await h.drag(a.from,a.to);
  else if(a.type==='button')await h.page.locator(`[data-action="${a.action}"]`).click({force:true});
  else throw Error('Unknown UI action '+JSON.stringify(a));
}
async function settle(page){await page.waitForFunction(()=>!ExtraGame.effects().raf,null,{timeout:5000});}
function gesture(id,level=9){
  const a=plan(id,level)[0];
  if(a.type==='drag')return{from:a.from,to:a.to};
  if(a.type==='tap')return{from:a.point,to:a.point};
  if(id==='boxtrail'){const d={up:[0,-110],down:[0,110],left:[-110,0],right:[110,0]}[a.action];return{from:{x:360,y:400},to:{x:360+d[0],y:400+d[1]}};}
  throw Error('No canvas gesture for '+id);
}
module.exports={ids,game,plan,perform,settle,gesture};
