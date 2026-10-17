(function(root) {
  function shuffle(list,seed) {
    const result=[...list]; let n=seed>>>0;
    for(let i=result.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function questions(config,level,seed){return shuffle(config.banks[level],seed).slice(0,6);}
  function fresh(level=0){return {version:1,level,seed:Math.floor(Math.random()*1000000000),index:0,cargo:0,solved:false,started:false,sticker:0};}
  function restore(raw,config) {
    if(!raw||raw.version!==1||![0,1].includes(raw.level)||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>=1000000000||!Number.isInteger(raw.index)||raw.index<0||raw.index>6||!Number.isInteger(raw.cargo)||raw.cargo<0||raw.cargo>(raw.level?100:10)||typeof raw.solved!=='boolean'||typeof raw.started!=='boolean'||!Number.isInteger(raw.sticker)||raw.sticker<0||raw.sticker>3)return fresh();
    if(raw.index===6&&!raw.started||raw.solved&&!raw.started)return fresh();
    if(config===undefined)return fresh();
    return {version:1,level:raw.level,seed:raw.seed,index:raw.index,cargo:raw.cargo,solved:raw.solved,started:raw.started,sticker:raw.sticker};
  }
  const api={shuffle,questions,fresh,restore};if(typeof module!=='undefined')module.exports=api;else root.AcademyCore=api;
})(typeof window!=='undefined'?window:globalThis);
