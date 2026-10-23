'use strict';
window.PetLinkArt=(()=>{
  const names=['小猫','小狗','兔子','熊猫','狐狸','小熊','小鸡','青蛙','企鹅','小猪','考拉','浣熊'];
  const coats=['#f4ba65','#c79266','#fff3ed','#fff9ee','#f39256','#bb855f','#ffe17c','#8fce8d','#647d99','#f6b5c4','#b9c6d8','#b0a6bf'];
  const backgrounds=['#fff0ce','#f9e3cb','#fbe0ec','#e0eee5','#ffe3ce','#e9dfd2','#fff4bb','#dcf2d9','#dceaf8','#fce2e8','#e2e9fa','#e9e0f4'];
  function sprite(pet){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=180;const g=canvas.getContext('2d'),coat=coats[pet],ink='#38404c';
    const ellipse=(x,y,rx,ry,color)=>{g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
    const line=(points,color,width=4)=>{g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
    const triangle=(a,b,c,color)=>{g.fillStyle=color;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.lineTo(...c);g.closePath();g.fill();};
    g.fillStyle='#253d401a';g.beginPath();g.roundRect(8,13,164,160,29);g.fill();
    g.fillStyle=backgrounds[pet];g.beginPath();g.roundRect(8,7,164,160,29);g.fill();g.strokeStyle='#ffffffdf';g.lineWidth=4;g.stroke();
    ellipse(91,143,49,9,'#0000000b');
    if(pet===0||pet===4||pet===11){triangle([43,78],[39,29],[78,58],coat);triangle([102,58],[141,29],[137,78],coat);triangle([48,62],[47,41],[65,59],'#edb4a6');triangle([115,59],[133,41],[132,62],'#edb4a6');}
    else if(pet===2){ellipse(65,46,15,30,coat);ellipse(115,46,15,30,coat);ellipse(65,44,7,21,'#f2b5c5');ellipse(115,44,7,21,'#f2b5c5');}
    else if(pet===1){ellipse(45,82,18,36,'#986144');ellipse(135,82,18,36,'#986144');}
    else if([3,5,10].includes(pet)){const color=pet===3?'#495661':coat;ellipse(49,57,22,23,color);ellipse(131,57,22,23,color);if(pet!==3){ellipse(49,57,13,14,pet===10?'#dce2ef':'#e2b39a');ellipse(131,57,13,14,pet===10?'#dce2ef':'#e2b39a');}}
    else if(pet===9){triangle([42,76],[41,40],[74,64],coat);triangle([106,64],[139,40],[138,76],coat);}
    else if(pet===6){line([[82,44],[76,28],[90,39],[99,27]],'#efba55',6);}
    else if(pet===7){ellipse(59,61,22,22,coat);ellipse(121,61,22,22,coat);}
    ellipse(90,99,53,49,coat);
    if(pet===4){triangle([40,87],[89,134],[57,135],'#fff2db');triangle([140,87],[91,134],[123,135],'#fff2db');}
    if(pet===8){ellipse(90,111,40,34,'#fff8e9');ellipse(74,83,18,24,'#fff8e9');ellipse(106,83,18,24,'#fff8e9');}
    if(pet===11){ellipse(65,94,26,19,'#696678');ellipse(115,94,26,19,'#696678');}
    if(pet===3){g.save();g.translate(66,94);g.rotate(.3);ellipse(0,0,16,20,'#495661');g.restore();g.save();g.translate(114,94);g.rotate(-.3);ellipse(0,0,16,20,'#495661');g.restore();}
    if(pet===1)ellipse(62,91,19,24,'#a56b43');
    if(pet===0){line([[78,57],[82,68]],'#c68945',5);line([[90,54],[90,67]],'#c68945',5);line([[102,57],[98,68]],'#c68945',5);}
    if(pet===5||pet===1)ellipse(90,119,25,18,'#f5d9b5');
    if(pet===7){ellipse(60,65,12,14,'#fffbea');ellipse(120,65,12,14,'#fffbea');}
    const eyes=pet===7?[[60,66],[120,66]]:[[68,94],[112,94]];
    for(const [x,y] of eyes){ellipse(x,y,5.5,7.5,pet===11||pet===3?'#fffaf3':ink);ellipse(x-1,y-2,1.8,2,pet===11||pet===3?ink:'#fff');}
    ellipse(55,112,9,5,'#ed9c9b88');ellipse(125,112,9,5,'#ed9c9b88');
    if(pet===9){ellipse(90,117,22,14,'#df8fa4');ellipse(82,117,3.5,5,'#b96a81');ellipse(98,117,3.5,5,'#b96a81');}
    else if(pet===6||pet===8){triangle([80,110],[100,110],[90,122],'#eaa046');}
    else if(pet===10){ellipse(90,108,10,15,'#56616f');line([[84,128],[90,131],[96,128]],ink,3);}
    else if(pet===7){g.strokeStyle=ink;g.lineWidth=3;g.beginPath();g.arc(90,105,18,.2,Math.PI-.2);g.stroke();}
    else{triangle([84,110],[96,110],[90,117],ink);line([[90,117],[90,122],[83,125]],ink,3);line([[90,122],[97,125]],ink,3);}
    if(pet===0){line([[54,113],[34,109]],'#b58965',2);line([[54,120],[35,123]],'#b58965',2);line([[126,113],[146,109]],'#b58965',2);line([[126,120],[145,123]],'#b58965',2);}
    return canvas;
  }
  return{names,coats,sprite};
})();
