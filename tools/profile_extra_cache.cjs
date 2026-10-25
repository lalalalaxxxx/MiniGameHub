'use strict';
// Same-browser A/B measurement of ExtraRender only. No source files are changed.
// Run after other browser workloads have stopped. "sync" includes the cost of
// completing the canvas raster, avoiding a misleading drawImage submission win.
const fs=require('node:fs'),path=require('node:path');
const {setup}=require('../tests/helpers/extra-browser.cjs');
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const ids=option('--ids','zumapath,slingblocks,trafficpark,waterworks').split(','),frames=Number(option('--frames','100')),cpu=Number(option('--cpu','4')),output=option('--out','');
async function main(){
 const b=await setup(),report={cpu,frames,rounds:3,viewport:{width:1024,height:650},games:[]};let cdp;
 try{
  cdp=await b.page.context().newCDPSession(b.page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  for(const id of ids){
   const G=require('../assets/js/extras/'+id);await b.install(G.create(0,37));await b.page.waitForFunction(()=>!ExtraGame.effects().raf);
   await b.page.evaluate(()=>{
    const game=ExtraGames[document.body.dataset.game],state=game.create(0,37);
    for(let i=0;i<60&&state.phase==='playing';i++)game.step(state,1/120);
    const source=document.querySelector('#board');
    window.cacheBench={game,state,cache:ExtraRender,width:source.width,height:source.height,contexts:{}};
   });
   const rounds=[];
   for(const mode of ['submit','sync'])for(let round=0;round<3;round++)for(const enabled of round%2?[true,false]:[false,true]){
    const value=await b.page.evaluate(({enabled,mode,frames,round})=>{
     const b=cacheBench;let g=b.contexts[mode];
     if(!g){const canvas=document.createElement('canvas');canvas.width=b.width;canvas.height=b.height;g=canvas.getContext('2d',{alpha:false,willReadFrequently:false});b.contexts[mode]=g;}
     window.ExtraRender=enabled?b.cache:undefined;
     function paint(frame){g.setTransform(b.width/720,0,0,b.height/800,0,0);g.globalAlpha=1;b.state.t=.5+frame/60;b.game.draw(g,b.state,{time:.5+frame/60,dt:1/60,reduced:false,pointer:null,hint:null});}
     // Warm both paths in every trial, including readback backend initialization.
     for(let i=0;i<24;i++){paint(i);if(mode==='sync')g.getImageData(0,0,1,1);}
     g.getImageData(0,0,1,1);
     const draw=[],completed=[];let checksum=0;const start=performance.now();
     for(let i=0;i<frames;i++){
      const at=performance.now();paint(i);const submitted=performance.now();
      if(mode==='sync')checksum+=g.getImageData(0,0,1,1).data[0];
      const done=performance.now();draw.push(submitted-at);completed.push(done-at);
     }
     const batchMs=performance.now()-start,flushAt=performance.now();checksum+=g.getImageData(0,0,1,1).data[0];const finalFlushMs=performance.now()-flushAt;
     window.ExtraRender=b.cache;
     function stats(list){const sorted=list.slice().sort((a,b)=>a-b);return{mean:list.reduce((a,b)=>a+b,0)/list.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]};}
     return{mode,round:round+1,enabled,draw:stats(draw),completed:stats(completed),batchMs,finalFlushMs,checksum};
    },{enabled,mode,frames,round});
    rounds.push(value);
   }
   const size=await b.page.evaluate(()=>({width:cacheBench.width,height:cacheBench.height}));
   const summary={};for(const mode of ['submit','sync']){
    const average=(enabled,key)=>{const values=rounds.filter(x=>x.mode===mode&&x.enabled===enabled).map(x=>key==='batchMs'?x.batchMs+x.finalFlushMs:x[key].mean).sort((a,b)=>a-b);return values[1];};
    const off=average(false,'completed'),on=average(true,'completed');
    summary[mode]={uncachedDrawMs:average(false,'draw'),cachedDrawMs:average(true,'draw'),uncachedCompleteMs:off,cachedCompleteMs:on,ratio:on/off,uncachedBatchMs:average(false,'batchMs'),cachedBatchMs:average(true,'batchMs')};
   }
   report.games.push({id,size,summary,rounds});console.log(id+' '+JSON.stringify({size,summary}));
  }
  if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2)+'\n');
 }finally{if(cdp)await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await b.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
