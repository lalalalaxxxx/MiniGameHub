/* Original vector artwork. The renderer caches each static sprite at its device scale. */
"use strict";
(() => {
  const themes = {
    birdblast: { id: "birdblast", colors: ["#ff7972", "#f7cd55", "#65b7ef", "#9ecf5b", "#b88ae5"], dark: "#153d42", board: "#205a50", cell: "#173e3b", sparkle: "#fff7b2" },
    candyland: { id: "candyland", colors: ["#fa6d8c", "#ffc85c", "#6bc6ef", "#87d47e", "#b58ae9"], dark: "#58304f", board: "#70365f", cell: "#522a4e", sparkle: "#fff3be" },
    gemquest: { id: "gemquest", colors: ["#fa747f", "#ffd06a", "#6ccff4", "#7ed2a5", "#bb99f4"], dark: "#233957", board: "#243e5d", cell: "#1a2f49", sparkle: "#c2f7ff" }
  };
  let active = themes.birdblast;
  const round = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const ellipse = (ctx, x, y, rx, ry, fill, rotation = 0) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fill(); };
  function polygon(ctx, points, fill) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function stroke(ctx, color, width = 2.5) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
  function shine(ctx, x, y, size, opacity = .95) { ctx.save(); ctx.globalAlpha *= opacity; polygon(ctx, [[x, y-size], [x+size*.28, y-size*.25], [x+size, y], [x+size*.28, y+size*.25], [x, y+size], [x-size*.28, y+size*.25], [x-size, y], [x-size*.28, y-size*.25]], "#ffffff"); ctx.restore(); }
  function face(ctx, y = 53, distance = 9, cheerful = false) {
    ellipse(ctx, 50-distance, y, 3.3, 4.8, "#fffdf2"); ellipse(ctx, 50+distance, y, 3.3, 4.8, "#fffdf2");
    ellipse(ctx, 50-distance+.5, y+1, 1.6, 2.8, "#253c49"); ellipse(ctx, 50+distance+.5, y+1, 1.6, 2.8, "#253c49");
    if (cheerful) { ctx.beginPath(); ctx.arc(50, y+7, 5, .08, Math.PI-.08); stroke(ctx, "#74484d", 2); }
  }
  function bird(ctx, color) {
    const fill = active.colors[color];
    ellipse(ctx, 50, 85, 29, 5, "#061c3829");
    polygon(ctx, [[29, 64], [13, 59], [22, 74], [29, 77]], fill);
    polygon(ctx, [[71, 64], [87, 59], [78, 74], [71, 77]], fill);
    if (color === 0) {
      ctx.beginPath(); ctx.moveTo(27, 70); ctx.bezierCurveTo(18, 42, 31, 29, 45, 30); ctx.bezierCurveTo(31, 13, 56, 14, 55, 31); ctx.bezierCurveTo(77, 29, 84, 51, 73, 72); ctx.bezierCurveTo(65, 85, 36, 86, 27, 70); ctx.fillStyle=fill; ctx.fill();
    } else if (color === 1) {
      ctx.beginPath(); ctx.moveTo(50, 24); ctx.bezierCurveTo(63, 25, 80, 48, 78, 67); ctx.bezierCurveTo(76, 87, 26, 87, 23, 68); ctx.bezierCurveTo(22, 50, 39, 25, 50, 24); ctx.fillStyle=fill; ctx.fill();
      ctx.beginPath(); ctx.moveTo(48, 26); ctx.quadraticCurveTo(43, 15, 52, 15); stroke(ctx,"#f6b346",4);
    } else if (color === 2) {
      round(ctx, 21, 31, 58, 50, 19); ctx.fillStyle=fill; ctx.fill();
      polygon(ctx, [[42, 35],[34, 23],[48, 29],[53, 18],[58, 34]], fill);
    } else if (color === 3) {
      ellipse(ctx,50,55,29,29,fill); polygon(ctx,[[37,33],[31,17],[47,29]],fill); polygon(ctx,[[51,29],[64,17],[65,36]],fill);
    } else {
      ctx.beginPath();ctx.moveTo(23,69);ctx.lineTo(22,29);ctx.quadraticCurveTo(24,23,33,35);ctx.quadraticCurveTo(50,25,67,35);ctx.quadraticCurveTo(77,23,79,29);ctx.lineTo(77,69);ctx.bezierCurveTo(73,87,28,87,23,69);ctx.fillStyle=fill;ctx.fill();
    }
    ctx.save();ctx.globalAlpha=.26;ellipse(ctx,59,69,22,13,"#244562");ctx.restore();
    ellipse(ctx,48,66,21,15,"#fff6ddba");
    if(color===4){ellipse(ctx,39,51,11,12,"#ecdff8");ellipse(ctx,61,51,11,12,"#ecdff8");}
    face(ctx, 50, 10);
    polygon(ctx, [[45,58],[55,58],[50,66]], "#db8741");
    ellipse(ctx, 32, 59, 5, 2.5, "#f88e8380");ellipse(ctx, 68, 59, 5, 2.5, "#f88e8380");
    ctx.beginPath();ctx.moveTo(36,42);ctx.quadraticCurveTo(40,38,45,39);stroke(ctx,"#ffffff80",3);
  }
  function candy(ctx, color) {
    const fill=active.colors[color];ellipse(ctx,50,85,28,5,"#26133730");
    if(color===0){
      ctx.beginPath();ctx.moveTo(50,79);ctx.bezierCurveTo(10,55,17,27,35,28);ctx.quadraticCurveTo(45,27,50,37);ctx.quadraticCurveTo(55,27,65,28);ctx.bezierCurveTo(84,27,90,55,50,79);ctx.fillStyle=fill;ctx.fill();stroke(ctx,"#bd365f",2.5);
      ctx.beginPath();ctx.moveTo(29,44);ctx.quadraticCurveTo(30,34,39,36);stroke(ctx,"#ffffff9c",5);
    }else if(color===1){
      polygon(ctx,[[25,50],[11,33],[10,64],[25,58]],"#efaa43");polygon(ctx,[[75,50],[89,33],[90,64],[75,58]],"#efaa43");
      round(ctx,23,29,54,45,15);ctx.fillStyle=fill;ctx.fill();stroke(ctx,"#d39337",2.5);
      [[34,47],[50,55],[66,47]].forEach(([x,y])=>ellipse(ctx,x,y,4,4,"#fff0b4"));
      ctx.beginPath();ctx.moveTo(35,35);ctx.lineTo(61,35);stroke(ctx,"#ffffff99",4);
    }else if(color===2){
      ctx.beginPath();ctx.moveTo(50,20);ctx.bezierCurveTo(59,35,80,49,77,64);ctx.bezierCurveTo(74,88,26,88,23,64);ctx.bezierCurveTo(20,49,41,35,50,20);ctx.fillStyle=fill;ctx.fill();stroke(ctx,"#3099c2",2.5);
      ctx.beginPath();ctx.moveTo(36,47);ctx.quadraticCurveTo(31,52,31,60);stroke(ctx,"#c9f3ff",6);
    }else if(color===3){
      round(ctx,22,26,56,56,17);ctx.fillStyle=fill;ctx.fill();stroke(ctx,"#519d64",2.5);
      round(ctx,29,33,42,42,12);stroke(ctx,"#bff3ad",3);ellipse(ctx,36,40,6,3,"#ffffff98",-.6);
    }else{
      polygon(ctx,[[50,23],[60,40],[79,44],[66,59],[68,79],[50,70],[32,79],[34,59],[21,44],[40,40]],fill);stroke(ctx,"#8660b4",2.5);
      ctx.beginPath();ctx.moveTo(47,36);ctx.lineTo(50,31);ctx.lineTo(56,44);stroke(ctx,"#e8dbff",4);
    }
    if(color!==1){face(ctx,57,8,true);}
  }
  const gems = [ [[50,21],[75,40],[75,66],[50,82],[25,66],[25,40]], [[50,18],[80,52],[50,84],[20,52]], [[29,24],[71,24],[80,39],[72,76],[28,76],[20,39]], [[50,20],[79,45],[67,79],[33,79],[21,45]], [[31,22],[69,22],[82,49],[69,79],[31,79],[18,49]] ];
  function gem(ctx,color){
    ellipse(ctx,50,86,28,5,"#07142944");const pts=gems[color];polygon(ctx,pts,active.colors[color]);stroke(ctx,"#ffffff9c",2);
    const center=[50,51];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];polygon(ctx,[a,b,center],i<2?"#ffffff35":i<4?"#102c6142":"#ffffff18");}
    const inner=pts.map(([x,y])=>[50+(x-50)*.58,51+(y-51)*.58]);polygon(ctx,inner,active.colors[color]);stroke(ctx,"#ffffff65",1.6);
    ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[pts.length-1]);ctx.lineTo(...pts[pts.length-2]);stroke(ctx,"#ffffffbe",2.8);shine(ctx,36,35,5,.9);
  }
  function rescue(ctx){
    ellipse(ctx,50,84,31,5,"#061c3829");ctx.beginPath();ctx.arc(50,50,35,0,Math.PI*2);ctx.fillStyle="#c2f4e6";ctx.fill();stroke(ctx,"#ffeb9f",5);
    ellipse(ctx,50,57,22,23,"#ffd85e");ellipse(ctx,51,68,15,9,"#fff0b5");polygon(ctx,[[29,54],[17,45],[24,64]],"#f3b447");polygon(ctx,[[71,54],[83,45],[76,64]],"#f3b447");
    ctx.beginPath();ctx.moveTo(48,36);ctx.quadraticCurveTo(38,19,51,24);ctx.moveTo(51,35);ctx.quadraticCurveTo(64,19,62,30);stroke(ctx,"#edb04f",4);face(ctx,51,8);polygon(ctx,[[45,58],[55,58],[50,64]],"#e58a3b");shine(ctx,78,23,8);shine(ctx,20,74,5);
  }
  function chest(ctx){
    ellipse(ctx,50,86,33,5,"#07142944");round(ctx,19,45,62,36,7);ctx.fillStyle="#a45d39";ctx.fill();stroke(ctx,"#6f432e",2);round(ctx,18,27,64,32,12);ctx.fillStyle="#d8964d";ctx.fill();stroke(ctx,"#734c30",2);
    round(ctx,19,48,62,9,2);ctx.fillStyle="#ffd06a";ctx.fill();round(ctx,27,29,8,50,3);ctx.fillStyle="#ffce65";ctx.fill();round(ctx,65,29,8,50,3);ctx.fill();
    round(ctx,43,49,14,18,4);ctx.fillStyle="#ffe49b";ctx.fill();ellipse(ctx,50,56,3,3,"#8b653c");ctx.fillStyle="#8b653c";ctx.fillRect(48.5,56,3,5);ctx.beginPath();ctx.moveTo(39,34);ctx.lineTo(59,34);stroke(ctx,"#ffdc9c",3);shine(ctx,79,25,7);
  }
  function special(ctx,kind){
    if(kind==="rainbow"){
      ellipse(ctx,50,52,31,31,"#fff8ea");const tones=["#ff7681","#ffd466","#8edb8e","#6ad0f3","#b58df0"];
      tones.forEach((c,i)=>{ctx.beginPath();ctx.arc(50,52,25,(i*2/5-.5)*Math.PI,((i+1)*2/5-.5)*Math.PI);stroke(ctx,c,10);});
      ellipse(ctx,50,52,17,17,"#fff9ed");shine(ctx,50,52,13);shine(ctx,72,28,7);return;
    }
    if(kind==="row"||kind==="col"){
      ctx.save();round(ctx,25,29,50,47,12);ctx.clip();ctx.beginPath();
      if(kind==="row"){ctx.moveTo(23,38);ctx.lineTo(77,38);ctx.moveTo(23,67);ctx.lineTo(77,67);}
      else{ctx.moveTo(33,26);ctx.lineTo(33,79);ctx.moveTo(67,26);ctx.lineTo(67,79);}
      stroke(ctx,"#fffbed",6);ctx.restore();
    }
    if(kind==="bomb"){
      round(ctx,21,26,58,56,16);stroke(ctx,"#ffe48d",5);round(ctx,23,28,54,52,14);stroke(ctx,"#fff9d9",1.5);
      ctx.beginPath();ctx.moveTo(50,28);ctx.lineTo(50,79);ctx.moveTo(24,51);ctx.lineTo(76,51);stroke(ctx,"#fff1c6bb",5);shine(ctx,22,27,6);shine(ctx,78,82,5);
    }
    ctx.save();ctx.translate(72,73);
    ellipse(ctx,0,0,15,15,"#24334a");ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);stroke(ctx,"#fff1bb",2.5);
    if(kind==="bomb") {ellipse(ctx,0,2,7,7,"#fff3bc");ctx.beginPath();ctx.moveTo(1,-4);ctx.quadraticCurveTo(0,-12,7,-9);stroke(ctx,"#ffd870",2);shine(ctx,8,-9,3);}
    else if(kind==="glow"){shine(ctx,0,0,9);}
    else if(kind==="fire"){ctx.beginPath();ctx.moveTo(1,-10);ctx.bezierCurveTo(12,2,10,10,0,10);ctx.bezierCurveTo(-12,10,-11,-1,-5,-4);ctx.quadraticCurveTo(-6,2,-2,2);ctx.quadraticCurveTo(3,-2,1,-10);ctx.fillStyle="#ffb25d";ctx.fill();ellipse(ctx,0,5,3.5,5,"#fff1b4");}
    else if(kind==="lightning"){polygon(ctx,[[2,-10],[-7,2],[-1,2],[-3,11],[8,-2],[2,-2]],"#fff292");}
    else if(kind==="whirlwind"){ctx.beginPath();ctx.moveTo(-9,-6);ctx.bezierCurveTo(12,-12,13,-2,-7,-1);ctx.bezierCurveTo(7,-3,10,5,-4,5);ctx.quadraticCurveTo(4,5,1,11);stroke(ctx,"#b9efff",2.8);}
    else {ctx.rotate(kind==="col"?Math.PI/2:0);round(ctx,-8,-3,16,6,2);ctx.fillStyle="#fff3bc";ctx.fill();polygon(ctx,[[10,0],[4,-6],[4,6]],"#fff3bc");polygon(ctx,[[-10,0],[-4,-6],[-4,6]],"#fff3bc");}
    ctx.restore();
  }
  function draw(ctx,tile,x,y,size,time=0){
    if(!tile)return;ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.translate(50,50);ctx.scale(1.14,1.14);ctx.translate(-50,-50);const color=((Number(tile.color)||0)%5+5)%5;
    if(["glow","fire","lightning","whirlwind"].includes(tile.special)){
      const aura={glow:["#ffed8b55","#ffed8b"],fire:["#ff986955","#ffb574"],lightning:["#e0e7ff55","#e4ecff"],whirlwind:["#302d735c","#c2bbff"]}[tile.special];
      ellipse(ctx,50,54,36,36,aura[0]);ctx.beginPath();ctx.arc(50,54,36,0,Math.PI*2);stroke(ctx,aura[1],2.8);shine(ctx,20,33,5);shine(ctx,78,70,4);
    }
    if(tile.kind==="chest")chest(ctx);else if(tile.kind==="bird")rescue(ctx);else if(tile.kind==="ingredient")ingredient(ctx);else if(tile.kind==="token")token(ctx,color);else if(active.id==="candyland")candy(ctx,color);else if(active.id==="gemquest")gem(ctx,color);else bird(ctx,color);
    if(tile.kind==="time"){ellipse(ctx,73,73,14,14,"#fff2b8");ctx.beginPath();ctx.arc(73,73,10,0,Math.PI*2);stroke(ctx,"#956d3e",2);ctx.beginPath();ctx.moveTo(73,66);ctx.lineTo(73,73);ctx.lineTo(78,75);stroke(ctx,"#956d3e",2.5);}
    if(tile.special)special(ctx,tile.special);ctx.restore();
  }
  function ingredient(ctx){
    ellipse(ctx,50,85,31,5,"#26133730");ctx.beginPath();ctx.moveTo(36,50);ctx.quadraticCurveTo(40,29,58,19);ctx.quadraticCurveTo(59,41,66,56);stroke(ctx,"#629958",4);ellipse(ctx,37,65,19,19,"#ec5c7b");ellipse(ctx,66,67,18,18,"#d84d75");ellipse(ctx,31,57,5,4,"#ffbac8",-.4);ellipse(ctx,61,59,4,3,"#ffbac8",-.4);ctx.beginPath();ctx.moveTo(57,21);ctx.quadraticCurveTo(74,13,80,27);ctx.quadraticCurveTo(67,34,57,21);ctx.fillStyle="#8fca76";ctx.fill();
  }
  function token(ctx,color){
    bird(ctx,color);ellipse(ctx,24,32,14,14,"#ffe28c");ctx.beginPath();ctx.arc(24,32,13,0,Math.PI*2);stroke(ctx,"#edb348",2);polygon(ctx,[[24,22],[27,28],[34,29],[29,34],[30,41],[24,37],[18,41],[19,34],[14,29],[21,28]],"#bf8537");shine(ctx,16,20,4);
  }
  function lock(ctx,x,y,size){
    ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.lineCap="round";
    for(let direction=0;direction<2;direction++){ctx.save();ctx.translate(50,50);ctx.rotate(direction?-.72:.72);for(let i=-2;i<=2;i++){round(ctx,i*15-12,-5,21,10,5);stroke(ctx,"#48566d",5);stroke(ctx,"#cad8e3",2.5);}ctx.restore();}
    round(ctx,39,42,23,24,5);ctx.fillStyle="#ffe0a0";ctx.fill();stroke(ctx,"#8a6d41",2);ctx.beginPath();ctx.arc(50.5,42,7,Math.PI,0);stroke(ctx,"#ffdf9f",5);ellipse(ctx,50,53,3,3,"#7c6544");ctx.fillStyle="#7c6544";ctx.fillRect(48.7,53,2.6,6);ctx.restore();
  }
  function cover(ctx,kind,hp,x,y,size){
    if(!kind||hp===0)return;if(kind==="chain"||kind==="lock"){lock(ctx,x,y,size);return;}
    ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);
    if(kind==="crate"||kind==="wood"||kind==="box"){
      round(ctx,9,10,82,80,12);ctx.fillStyle="#b57d46";ctx.fill();stroke(ctx,"#704e35",2.4);round(ctx,15,16,70,68,8);ctx.fillStyle="#e6b677";ctx.fill();
      ctx.beginPath();ctx.moveTo(18,39);ctx.lineTo(82,39);ctx.moveTo(18,61);ctx.lineTo(82,61);stroke(ctx,"#b4824f",3);
      polygon(ctx,[[17,22],[24,16],[84,76],[77,84]],"#d29b5e");polygon(ctx,[[76,16],[84,23],[23,84],[16,77]],"#f2cb91");
      [[22,23],[78,23],[22,78],[78,78]].forEach(([x,y])=>ellipse(ctx,x,y,2.8,2.8,"#93673e"));
      if(hp>1){round(ctx,39,38,22,25,5);ctx.fillStyle="#ffdf90";ctx.fill();ctx.beginPath();ctx.arc(50,38,6,Math.PI,0);stroke(ctx,"#ffe6a5",4);ellipse(ctx,50,49,3,3,"#a07742");}
    }else{
      const icy=kind==="ice";round(ctx,10,12,80,77,15);ctx.fillStyle=icy?"#b8ebffb8":"#ffa7ce25";ctx.fill();stroke(ctx,icy?"#e2fbff":"#ffc4e5",hp>1?4:2.5);
      round(ctx,16,18,68,62,11);ctx.fillStyle=icy?"#e8faff55":"#ffe9f20d";ctx.fill();
      if(icy){ctx.beginPath();ctx.moveTo(24,35);ctx.lineTo(43,21);ctx.moveTo(63,75);ctx.lineTo(78,61);stroke(ctx,"#ffffffa0",5);shine(ctx,68,31,8);}
      else{
        ctx.beginPath();ctx.moveTo(18,35);ctx.quadraticCurveTo(16,20,32,20);ctx.moveTo(66,81);ctx.quadraticCurveTo(81,83,82,68);stroke(ctx,"#fff6f2cf",3.5);
        ellipse(ctx,78,24,6,6,"#fff6ed");ellipse(ctx,78,24,2.5,2.5,"#e595bd");
      }
      if(hp>1){
        if(icy){round(ctx,29,31,42,39,10);ctx.fillStyle="#d5f5ffae";ctx.fill();stroke(ctx,"#ffffff",2);shine(ctx,50,50,13,.85);}
        else{round(ctx,16,18,68,65,11);stroke(ctx,"#ffe0f0aa",1.5);ellipse(ctx,65,24,6,6,"#fff6ed");ellipse(ctx,65,24,2.5,2.5,"#e595bd");}
      }
    }ctx.restore();
  }
  window.MatchArt={draw,cover,lock,setTheme(id){active=themes[id]||themes.birdblast;return active;},theme(id){return themes[id]||active;}};
})();
