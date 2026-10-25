'use strict';
const games=Object.fromEntries(['boxtrail','starpath'].map(id=>[id,require('../../assets/js/extras/'+id+'.js')]));
function plan(id,level,seed=37){const G=games[id],s=G.create(level,seed),route=G.solve(s);if(!route)throw new Error('No legal route for '+id+' level '+level);return route.map(move=>id==='boxtrail'?{type:'button',action:move}:{type:'tap',point:G.nodePoint(s,move)});}
function solve(id,level,seed=37){const G=games[id],s=G.create(level,seed),route=G.solve(s);if(!route)throw new Error('No legal route for '+id+' level '+level);const actions=route.map(move=>id==='boxtrail'?[move,{}]:['visit',{node:move}]);for(const[type,p]of actions){const result=G.act(s,type,p);if(!result.ok)throw new Error('Illegal solver move '+type);}return{G,s,actions,route};}
module.exports={games,plan,solve};
