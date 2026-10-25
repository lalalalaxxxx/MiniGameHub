'use strict';
const G = require('../../assets/js/extras/colorsort.js');
const games = { colorsort: G };
function settle(s) {
  for(let i=0;i<600&&G.needsFrame(s);i++)G.step(s,1/120);
  if(G.needsFrame(s))throw Error('colorsort animation did not settle');
}
function plan(id,level,seed=37) {
  if(id!=='colorsort')throw Error('Unknown sorting game: '+id);
  const s=G.create(level,seed),route=G.solve(s),actions=[];
  if(!route)throw Error('No sorting solution for level '+level);
  for(const move of route){
    actions.push({type:'tap',point:G.center(s,move.from)},{type:'tap',point:G.center(s,move.to)});
    if(!G.act(s,'pour',move).ok)throw Error('Invalid sorting strategy');
    settle(s);
  }
  if(s.phase!=='won')throw Error('Incomplete sorting strategy');
  return actions;
}
function solve(id,level,seed=37){
  const s=G.create(level,seed),actions=plan(id,level,seed);
  for(const action of actions){G.act(s,'pointerup',{...action.point,start:action.point});settle(s);}
  return {G,s,actions};
}
module.exports={games,plan,solve,settle};
