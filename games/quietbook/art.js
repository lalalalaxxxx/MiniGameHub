"use strict";

window.BookArt = (() => {
  const themes = {
    garden: { name: "植物守卫", wall: "#edf2dc", floor: "#d8dfb9", accent: "#7c9d62", pale: "#f6f4dd", names: ["豆豆", "小葵"], tops: ["leaf-dress", "sun-dress"] },
    fairy: { name: "萌系精灵", wall: "#f6e5ee", floor: "#e4cddd", accent: "#bd85a8", pale: "#fff0f4", names: ["心心", "月月"], tops: ["heart-dress", "moon-dress"] },
    snow: { name: "冰雪公主", wall: "#e3eff6", floor: "#ccdce9", accent: "#86adc4", pale: "#f4f8ff", names: ["雪莉", "小霜"], tops: ["ice-dress", "star-shirt"] },
  };
  const items = [];
  const put = (id, name, type, shape, color, extra = {}) => items.push({ id, name, type, shape, color, ...extra });
  [
    ["leaf-dress","叶子裙","#91b875","leaf"], ["sun-dress","向日葵裙","#f1ca6a","sun"],
    ["heart-dress","爱心裙","#edacca","heart"], ["moon-dress","月亮裙","#b7a8dc","moon"],
    ["ice-dress","冰晶长裙","#93c7e1","snow"], ["peach-dress","桃桃裙","#edb397","flower"],
  ].forEach(([id,name,color,motif]) => put(id,name,"top","dress",color,{motif,dress:true}));
  [["star-shirt","星星上衣","#b7cee3"],["mint-shirt","薄荷上衣","#b4d8bf"],["cream-shirt","奶油上衣","#eee0b4"],["rose-shirt","莓莓上衣","#e7a8ad"]].forEach(([id,name,c])=>put(id,name,"top","shirt",c,{motif:"star"}));
  ["#a4b9d3","#cbb5d8","#e8be99","#a3c8a2","#e1acbb","#d7cbac"].forEach((c,i)=>put(`bottom-${i}`,["蓝蓝短裤","紫色裙子","杏色短裤","草地裙子","粉粉短裤","奶茶裙子"][i],"bottom",i%2?"skirt":"pants",c));
  ["#adbecf","#ebc06e","#c8a3c8","#9cbf91","#eaa8a6","#e8e1cc"].forEach((c,i)=>put(`shoes-${i}`,["蓝色小鞋","小黄靴","紫色小鞋","叶子鞋","莓果鞋","云朵鞋"][i],"shoes","shoes",c));
  [["leaf-hat","叶子帽","#8bb57b","leaf"],["sun-hat","阳光帽","#e4bf71","sun"],["heart-hat","爱心头饰","#e6a1c0","heart"],["moon-hat","月亮头饰","#b4a0d0","moon"],["ice-hat","冰晶皇冠","#8dc5df","snow"],["bow-hat","蝴蝶结","#e7b4bd","bow"],["cap-hat","小小帽子","#a7c5be","cap"],["star-hat","星星皇冠","#e4ca8c","star"]].forEach(([id,n,c,m])=>put(id,n,"hat","hat",c,{motif:m}));
  [["bag-green","叶子小包","bag","#a4c48f"],["bag-pink","爱心小包","bag","#e5a9c1"],["wand","星星魔杖","wand","#e6ca7a"],["glasses","圆圆眼镜","glasses","#a7b9cc"],["scarf","软软围巾","scarf","#deb2cb"],["wings","精灵翅膀","wings","#c4b6e3"]].forEach(([id,n,s,c])=>put(id,n,"accessory",s,c));
  [["apple","小苹果","#e48f83"],["berry","草莓","#e899a2"],["carrot","胡萝卜","#e7ad71"],["bread","小面包","#d5ad7d"],["rice","饭饭碗","#e8d9bb"],["egg","荷包蛋","#f0ce73"],["fish","小鱼饼","#e4b887"],["pizza","披萨","#e7c37f"],["cake","草莓蛋糕","#e3b0be"],["cookie","小饼干","#c9a47d"],["banana","香蕉","#edcf80"],["broccoli","西兰花","#94b586"]].forEach(([id,n,c])=>put(id,n,"food",id,c));
  ["#f2dbba","#d8b1c7","#c6d9b0","#a9cedf","#edd9a6","#f0e8d8"].forEach((c,i)=>put(`drink-${i}`,["暖暖牛奶","草莓奶","青苹果汁","蓝莓饮料","橙子汁","温水"][i],"drink","drink",c));
  ["#b4c8db","#e6b6c9","#d8d5a9","#d1c2df","#e5c6a1","#b3cbb7"].forEach((c,i)=>put(`plate-${i}`,["蓝蓝盘子","花花盘子","奶油盘子","月亮盘子","木头托盘","叶子盘子"][i],"plate","plate",c,{width:160}));
  [["teddy","小熊玩偶","bear","#caaa8b"],["bunny","小兔玩偶","bunny","#e3cbd8"],["blocks","彩色积木","blocks","#b5c5cf"],["train","小火车","train","#b7c994"],["sunflower","向日葵朋友","sunflower","#e9c675"],["peafriend","豌豆朋友","pea","#a1bb80"],["snowman","雪人朋友","snowman","#e7f1f4"],["star-toy","星星抱枕","star","#ead18b"]].forEach(([id,n,s,c])=>put(id,n,"toy",s,c));
  [["plant","小盆栽","plant","#a1b78c"],["flowers","花花瓶","flowers","#d8acc3"],["rug","圆圆地毯","rug","#d6b5a1"],["pillow","软软靠垫","pillow","#bbcadb"],["books","故事书","books","#b4bc9e"],["lamp","小台灯","lamp","#e0c69c"],["snowball","水晶球","snowball","#b5cddb"],["basket","玩具篮","basket","#d4b898"]].forEach(([id,n,s,c])=>put(id,n,"decor",s,c,{width:s==="rug"?220:100}));
  ["#b7c9b3","#dcb7ce","#b5cfdf","#e5c995"].forEach((c,i)=>put(`blanket-${i}`,["叶子小被子","爱心小被子","雪花小被子","星星小被子"][i],"blanket","blanket",c,{width:235}));
  const catalog = Object.fromEntries(items.map(item=>[item.id,item]));
  const star = (x,y,r=12,color="#f0d58d") => `<path d="M${x} ${y-r}l${r*.3} ${r*.65} ${r*.7} ${r*.1}-${r*.5} ${r*.5} ${r*.12} ${r*.75}-${r*.62}-${r*.35}-${r*.62} ${r*.35} ${r*.12}-${r*.75}-${r*.5}-${r*.5} ${r*.7}-${r*.1}z" fill="${color}"/>`;
  function motif(name,c="#fff8e7") {
    if(name==="heart")return `<path d="M50 62C12 38 37 22 50 38c14-16 39 0 0 24" fill="${c}"/>`;
    if(name==="leaf")return `<path d="M30 64Q20 28 70 30Q74 68 30 64" fill="${c}"/><path d="m31 63 29-24" fill="none" stroke="#76925a" stroke-width="3"/>`;
    if(name==="snow")return `<g stroke="${c}" stroke-width="4"><path d="M50 27v44M30 38l40 22M30 60l40-22"/></g>`;
    if(name==="moon")return `<path d="M62 29a22 22 0 1 0 9 32 22 22 0 0 1-9-32" fill="${c}"/>`;
    if(name==="sun"||name==="flower")return `<g fill="${c}">${Array.from({length:8},(_,i)=>`<ellipse cx="50" cy="29" rx="8" ry="12" transform="rotate(${i*45} 50 50)"/>`).join("")}<circle cx="50" cy="50" r="14" fill="#e6bb68"/></g>`;
    return star(50,49,22,c);
  }
  function shape(item) {
    const c=item.color, s=item.shape;
    let p="";
    if(s==="dress")p=`<path d="m35 14-13 13 11 12 5-4-17 50q29 12 58 0L62 35l5 4 11-12-13-13-8 7H43z" fill="${c}"/><path d="M36 46h28" stroke="#fff8e7" stroke-width="4"/><g transform="translate(25 40) scale(.5)">${motif(item.motif)}</g>`;
    else if(s==="shirt")p=`<path d="m34 18-19 13 10 18 10-5v36h30V44l10 5 10-18-19-13q-16 16-32 0z" fill="${c}"/>${star(50,51,14,"#fff8e9")}`;
    else if(s==="pants")p=`<path d="M27 20h46l6 63H55L50 44l-5 39H21z" fill="${c}"/><path d="M28 29h44" stroke="#fff8e9" stroke-width="5"/>`;
    else if(s==="skirt")p=`<path d="M34 24h32l17 56q-33 16-66 0z" fill="${c}"/><path d="M35 27h30M38 41l-7 34m20-33v38m12-39 7 35" fill="none" stroke="#fff8e7" stroke-width="3"/>`;
    else if(s==="shoes")p=`<path d="M18 32h21v29q15 0 14 18H10V58zM59 32h21v29q15 0 14 18H51V58z" fill="${c}"/><path d="M12 72h38m4 0h38" stroke="#fff9eb" stroke-width="5"/>`;
    else if(s==="hat") {
      if(item.motif==="cap")p=`<path d="M23 58a27 27 0 0 1 54 0l12 9H20z" fill="${c}"/>`;
      else if(item.motif==="bow")p=`<path d="M50 48Q8 9 15 68q18 10 35-13Q92 91 85 29 66 23 50 48" fill="${c}"/><circle cx="50" cy="50" r="10" fill="#fff3de"/>`;
      else p=`<path d="m17 38 20 12 13-24 13 24 20-12-8 39H25z" fill="${c}"/><g transform="translate(30 33) scale(.4)">${motif(item.motif)}</g>`;
    } else if(s==="bag")p=`<path d="M33 39V28a17 17 0 0 1 34 0v11" fill="none" stroke="${c}" stroke-width="8"/><rect x="20" y="36" width="60" height="48" rx="13" fill="${c}"/><g transform="translate(31 40) scale(.38)">${motif("heart")}</g>`;
    else if(s==="wand")p=`<path d="m29 85 35-51" stroke="${c}" stroke-width="8"/>${star(67,27,23,c)}`;
    else if(s==="glasses")p=`<g fill="#fff9" stroke="${c}" stroke-width="6"><circle cx="29" cy="50" r="20"/><circle cx="73" cy="50" r="20"/><path d="M49 48h4M7 43 2 37m93 6 3-6"/></g>`;
    else if(s==="scarf")p=`<path d="M24 29q26 19 52 0v20l-18 5 9 30H47l-7-30-16-5z" fill="${c}"/><path d="M25 41q25 16 50 0" fill="none" stroke="#fff6e8" stroke-width="4"/>`;
    else if(s==="wings")p=`<path d="M50 53Q4 0 12 46q1 13 24 17Q5 90 39 84l11-20 11 20q34 6 3-21 23-4 24-17 8-46-38 7" fill="${c}" opacity=".85"/>`;
    else if(s==="apple"||s==="berry")p=`<path d="M50 30C12 8 7 75 42 85q8-6 16 0 35-10 28-43-3-25-36-12" fill="${c}"/><path d="M50 31 48 13m2 14q23-27 30-6-15 12-30 6" fill="#92b27b" stroke="#799567" stroke-width="3"/>${s==="berry"?'<path d="m29 45 2 5m16-5 1 5m18-5 1 5m-28 11 1 5m19-5 1 5" stroke="#fff2bf" stroke-width="3"/>':''}`;
    else if(s==="carrot")p=`<path d="M33 30q25-15 39 9L32 90z" fill="${c}"/><path d="M48 29 38 9m15 17 8-19m-4 23 22-9" stroke="#8eae78" stroke-width="8" stroke-linecap="round"/><path d="m42 48 15 4m-18 12 11 3" stroke="#c28b59" stroke-width="3"/>`;
    else if(s==="bread")p=`<path d="M18 51q-8-33 14-33 18-12 36 0 22 0 14 33v32H18z" fill="${c}"/><path d="M28 46q0-20 15-17m7 0q15-3 20 15" fill="none" stroke="#f7dfb5" stroke-width="7"/>`;
    else if(s==="rice")p=`<path d="M15 51q5-40 20-25 12-25 24-4 18-12 25 29" fill="#fff9e8"/><path d="M12 48h76q-4 37-38 37T12 48" fill="${c}"/><path d="M26 60h48" stroke="#b8c8b1" stroke-width="5"/>`;
    else if(s==="egg")p=`<path d="M18 42C9 15 46 12 58 24c31-12 40 32 22 40 0 26-37 28-48 11C8 78 3 48 18 42" fill="#fffdf0"/><circle cx="52" cy="50" r="19" fill="${c}"/>`;
    else if(s==="fish")p=`<path d="M24 49Q53 8 82 49 53 90 24 49L8 29v40z" fill="${c}"/><circle cx="68" cy="43" r="3" fill="#685745"/><path d="m44 37 8 12-8 12" fill="none" stroke="#b78e60" stroke-width="3"/>`;
    else if(s==="pizza")p=`<path d="M50 12 88 83H12z" fill="${c}"/><path d="M17 78h66" stroke="#bd9467" stroke-width="10" stroke-linecap="round"/><g fill="#cc8179"><circle cx="48" cy="39" r="7"/><circle cx="35" cy="62" r="7"/><circle cx="65" cy="65" r="7"/></g>`;
    else if(s==="cake")p=`<rect x="16" y="35" width="68" height="48" rx="6" fill="${c}"/><path d="M16 38q10-15 20 0 10-15 20 0 18-15 28 0v11H16zM16 64h68" fill="#fff8e8" stroke="#fff8e8" stroke-width="8"/><path d="M43 25q-3-20 8-17 18-2 8 20z" fill="#dc9298"/>`;
    else if(s==="cookie")p=`<circle cx="50" cy="50" r="35" fill="${c}"/><g fill="#8e6d52"><circle cx="34" cy="34" r="5"/><circle cx="64" cy="39" r="5"/><circle cx="46" cy="58" r="5"/><circle cx="67" cy="65" r="4"/><circle cx="28" cy="63" r="4"/></g>`;
    else if(s==="banana")p=`<path d="M22 22q-8 64 53 32l10-10Q65 103 24 73 5 56 22 22" fill="${c}"/><path d="m22 22 6-9m52 34 9-6" stroke="#998568" stroke-width="6"/>`;
    else if(s==="broccoli")p=`<path d="M43 46h16l8 40H35z" fill="#b5c898"/><g fill="${c}"><circle cx="29" cy="41" r="20"/><circle cx="49" cy="27" r="22"/><circle cx="72" cy="41" r="20"/><circle cx="49" cy="48" r="21"/></g>`;
    else if(s==="drink")p=`<path d="M24 28h52L69 87H31z" fill="${c}"/><path d="M57 55V14h18" fill="none" stroke="#b9b5a3" stroke-width="5" stroke-linecap="round"/><path d="M29 36h42" stroke="#fff8e8" stroke-width="5"/>${star(50,61,13,"#fff9e8")}`;
    else if(s==="plate"||s==="rug")p=`<ellipse cx="50" cy="54" rx="46" ry="${s==="rug"?29:24}" fill="${c}"/><ellipse cx="50" cy="54" rx="35" ry="${s==="rug"?20:15}" fill="${s==="rug"?"none":"#fff9ee"}" stroke="#fff8e9" stroke-width="3"/>`;
    else if(s==="bear"||s==="bunny")p=`<g fill="${c}"><ellipse cx="32" cy="${s==="bunny"?21:32}" rx="12" ry="${s==="bunny"?23:12}"/><ellipse cx="68" cy="${s==="bunny"?21:32}" rx="12" ry="${s==="bunny"?23:12}"/><ellipse cx="50" cy="72" rx="24" ry="22"/><circle cx="50" cy="48" r="28"/></g><g fill="#725e52"><circle cx="39" cy="46" r="3"/><circle cx="61" cy="46" r="3"/><path d="m46 55 4 4 4-4z"/></g><ellipse cx="50" cy="78" rx="12" ry="10" fill="#fff1df"/>`;
    else if(s==="blocks")p=`<rect x="8" y="51" width="38" height="36" rx="5" fill="#c6afd1"/><rect x="49" y="51" width="38" height="36" rx="5" fill="#e7c383"/><path d="m48 11 27 36H21z" fill="#a4bfad"/>`;
    else if(s==="train")p=`<path d="M10 47h37V25h35v51H10z" fill="${c}"/><rect x="53" y="32" width="21" height="20" rx="4" fill="#fff5dd"/><path d="M19 46V33h13v13" fill="#dba99b"/><g fill="#9c8572"><circle cx="28" cy="78" r="12"/><circle cx="68" cy="78" r="12"/></g>`;
    else if(s==="sunflower")p=`<path d="M50 52v39M50 77q-29-20-26-1 10 12 26 5" fill="#a7be85" stroke="#9ab477" stroke-width="6"/><g transform="translate(0 -7)">${motif("sun",c)}</g><g fill="#7d6749"><circle cx="44" cy="42" r="2.5"/><circle cx="56" cy="42" r="2.5"/></g>`;
    else if(s==="pea")p=`<path d="M48 55v28m0-5Q20 59 18 78q14 12 30 7 20-19 32-7-9 14-32 7" fill="#abc28b" stroke="#9bb67e" stroke-width="6"/><circle cx="48" cy="38" r="25" fill="${c}"/><path d="M60 34h22v19H62" fill="${c}"/><ellipse cx="82" cy="43" rx="6" ry="10" fill="#728d57"/><circle cx="43" cy="30" r="4" fill="#53674a"/>`;
    else if(s==="snowman")p=`<circle cx="50" cy="66" r="27" fill="${c}"/><circle cx="50" cy="30" r="21" fill="${c}"/><path d="M32 46h37l-6 19" fill="none" stroke="#abc0d9" stroke-width="8"/><path d="m50 32 16 4-16 4" fill="#dbab7a"/><g fill="#71899b"><circle cx="42" cy="27" r="2.5"/><circle cx="57" cy="27" r="2.5"/><circle cx="50" cy="70" r="3"/></g>`;
    else if(s==="star")p=star(50,48,40,c);
    else if(s==="plant"||s==="flowers")p=`<path d="M49 67V25" stroke="#8eaa78" stroke-width="5"/><path d="M47 49Q5 39 22 24q28 0 26 25M50 45q43-31 37-4-10 18-37 10" fill="#abc18e"/>${s==="flowers"?`<g transform="translate(14 -12) scale(.7)">${motif("flower",c)}</g>`:""}<path d="M27 61h47L67 92H34z" fill="${s==="flowers"?c:"#cfb499"}"/>`;
    else if(s==="pillow"||s==="blanket")p=`<rect x="8" y="${s==="blanket"?23:18}" width="84" height="${s==="blanket"?60:67}" rx="${s==="blanket"?8:20}" fill="${c}"/><rect x="15" y="30" width="70" height="44" rx="10" fill="none" stroke="#fff8ed" stroke-dasharray="3 4" stroke-width="2"/>${star(50,51,16,"#fff7e9")}`;
    else if(s==="books")p=`<g stroke="#fff4dd" stroke-width="4"><rect x="15" y="17" width="20" height="68" rx="3" fill="${c}"/><rect x="36" y="24" width="20" height="61" rx="3" fill="#d8b2b4"/><rect x="59" y="18" width="20" height="67" rx="3" fill="#b3c7d4" transform="rotate(-8 59 85)"/></g>`;
    else if(s==="lamp")p=`<path d="M48 50v35H29h42" fill="none" stroke="#ab9377" stroke-width="7"/><path d="M31 15h38l17 40H14z" fill="${c}"/>`;
    else if(s==="snowball")p=`<circle cx="50" cy="43" r="33" fill="${c}" opacity=".8"/><path d="m29 64 21-40 21 40" fill="#fff8ee"/><path d="M26 74h48l9 17H17z" fill="#b6a4c3"/>${star(29,30,8,"#fff")}`;
    else if(s==="basket")p=`<path d="M26 37V30a24 24 0 0 1 48 0v7" fill="none" stroke="${c}" stroke-width="7"/><path d="M13 36h74L77 84H23z" fill="${c}"/><path d="M19 49h62M22 64h56m-40-25 3 42m17-42-3 42" fill="none" stroke="#f5dfbd" stroke-width="3"/>`;
    return `<g stroke="#786551" stroke-opacity=".22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</g>`;
  }
  const icon = item => `<svg viewBox="0 0 100 100" aria-hidden="true">${shape(item)}</svg>`;
  function character(theme, who, look, pose, chewing) {
    const t=themes[theme], plant=theme==="garden", fairy=theme==="fairy", skin=plant?(who?"#f0ce79":"#b5cf91"):fairy?(who?"#d8c4e8":"#f0c9dd"):"#f5dbc8";
    const top=catalog[look.slots.top], bottom=catalog[look.slots.bottom], shoes=catalog[look.slots.shoes], hat=catalog[look.slots.hat], accessory=catalog[look.slots.accessory];
    const hair=theme==="snow"?["#ead8aa","#d9c7a2","#c3d3e2"][look.hair]:[t.accent,"#c1a4ba","#a7bf92"][look.hair];
    let headExtra="";
    if(plant&&who) headExtra=Array.from({length:12},(_,i)=>`<ellipse cx="110" cy="37" rx="14" ry="23" fill="#e7c36c" transform="rotate(${i*30} 110 91)"/>`).join("");
    if(fairy)headExtra=who?`<ellipse cx="77" cy="29" rx="16" ry="37" fill="${skin}"/><ellipse cx="145" cy="29" rx="16" ry="37" fill="${skin}"/>`:`<path d="M58 78 60 19 99 50m24 0 37-31 2 59" fill="${skin}"/>`;
    let body=`<ellipse cx="110" cy="326" rx="62" ry="10" fill="#665648" opacity=".1"/><path d="M76 225v66h25l9-50 9 50h25v-66" fill="${skin}"/><path d="M68 152q-26 13-28 60l17 6 19-33m68-33q26 13 28 60l-17 6-19-33" fill="${skin}"/>`;
    if(accessory?.shape==='wings')body=`<g data-slot="accessory" transform="translate(0 115) scale(2.2 1.5)">${shape(accessory)}</g>`+body;
    // The modest default outfit is a fallback, never another layer under clothes.
    if(!top)body+='<path data-base="top" d="M77 143h66l10 91H67z" fill="#fff0dd"/>';
    if(!bottom&&!top?.dress)body+='<path data-base="bottom" d="M72 226h76v42h-33l-5-19-5 19H72z" fill="#d8c6b2"/>';
    if(bottom&&!top?.dress)body+=`<g data-slot="bottom" data-item-id="${bottom.id}"><path d="${bottom.shape==='skirt'?'M73 218h74l20 66q-57 19-114 0z':'M73 218h74l8 72h-39l-6-40-6 40H65z'}" fill="${bottom.color}"/><path d="M75 225h70" stroke="#fff8e7" stroke-width="5"/></g>`;
    if(top)body+=`<g data-slot="top" data-item-id="${top.id}"><path d="${top.dress?'M77 143 57 154 47 181 67 190 77 174 55 288q55 21 110 0l-22-114 10 16 20-9-10-27-20-11q-33 20-66 0z':'M77 143 57 154 47 181 67 190 77 174 72 230h76l-5-56 10 16 20-9-10-27-20-11q-33 20-66 0z'}" fill="${top.color}"/><path d="M78 208h64" stroke="#fff8e7" stroke-width="4"/><g transform="translate(85 ${top.dress?222:157}) scale(.5)">${motif(top.motif)}</g></g>`;
    body+=`<g data-slot="shoes" transform="translate(57 273) scale(1.06 .58)">${shape(shoes||catalog['shoes-5'])}</g>`;
    if(pose==="sit")body=`<g transform="translate(0 35) scale(1 .86)">${body}</g>`;
    const fringe=["M56 85q-5-65 56-58 59-1 54 61-23-2-36-28-19 27-74 25","M56 85q-5-65 56-58 59-1 54 61l-19-12-13 8-15-15-13 13-15-10-16 13z","M56 85q-5-65 56-58 59-1 54 61-30-6-56-36-15 31-54 33"][look.hair];
    body+=`${headExtra}<circle cx="110" cy="91" r="55" fill="${skin}"/><path d="${fringe}" fill="${hair}"/>`;
    if(theme==="snow")body+=`<path d="M155 74q25 26 10 48 20 23-1 40 11 16-5 25" fill="none" stroke="${hair}" stroke-width="20" stroke-linecap="round"/><path d="m153 102 18 5m-17 22 17 5m-20 18 16 5" stroke="#bda980" opacity=".35" stroke-width="3"/>`;
    if(plant&&!who)body+=`<path d="M110 30q-34-37-37-10 10 13 37 10 14-30 32-19 2 16-32 19" fill="#86a963"/>`;
    const face=look.face;
    body+=`<g fill="#605250">${face===1?'<path d="M81 94q9-10 18 0m22 0q9-10 18 0" fill="none" stroke="#605250" stroke-width="4" stroke-linecap="round"/>':'<ellipse cx="90" cy="92" rx="5" ry="7"/><ellipse cx="130" cy="92" rx="5" ry="7"/>'}${face===2||chewing?'<ellipse cx="110" cy="115" rx="7" ry="9"/>':'<path d="M101 111q9 12 18 0" fill="none" stroke="#605250" stroke-width="3" stroke-linecap="round"/>'}</g><ellipse cx="77" cy="108" rx="10" ry="6" fill="#dc9a9b" opacity=".55"/><ellipse cx="143" cy="108" rx="10" ry="6" fill="#dc9a9b" opacity=".55"/>`;
    if(fairy)body+=`<g transform="translate(90 45) scale(.4)">${motif(who?"moon":"heart",who?"#f6df93":"#d78caf")}</g>`;
    if(hat)body+=`<g data-slot="hat" transform="translate(48 -6) scale(1.24 .85)">${shape(hat)}</g>`;
    if(accessory&&accessory.shape!=='wings'){const loc=accessory.shape==="glasses"?"translate(62 65) scale(.96 .65)":accessory.shape==="scarf"?"translate(63 122) scale(.95 .8)":"translate(130 178) scale(.9)";body+=`<g data-slot="accessory" transform="${loc}">${shape(accessory)}</g>`;}
    return body;
  }
  function background(scene,theme) {
    const t=themes[theme];
    const base=`<rect x="8" y="8" width="984" height="634" rx="28" fill="${t.wall}"/><rect x="8" y="8" width="984" height="634" rx="28" fill="url(#dots)"/><path d="M8 429h984v185q0 28-28 28H36q-28 0-28-28z" fill="${t.floor}"/><path d="M10 430h980" stroke="#b4a38c" stroke-opacity=".35" stroke-width="7"/><path d="M24 535h950M130 435v198m250-198v198m250-198v198m250-198v198" stroke="#fff" opacity=".19" stroke-width="3"/>`;
    const window=`<g stroke="#fffaf0" stroke-width="11"><rect x="650" y="67" width="215" height="200" rx="78" fill="#d4e4e7"/><path d="M757 70v194M653 167h210"/></g><path d="M674 204q43-42 84 0 35-65 83-22v72H674z" fill="#b7cba9" opacity=".8"/>${star(707,118,17,"#fff7d7")}`;
    if(scene==="wardrobe")return base+`<rect x="66" y="90" width="255" height="403" rx="30" fill="#c9b091"/><rect x="80" y="105" width="226" height="372" rx="20" fill="#f8ecda"/><path d="M101 145h185" stroke="#bba282" stroke-width="8"/><path d="m137 146-22 37h45zm91 0-22 37h45z" fill="none" stroke="#c6b294" stroke-width="4"/><path d="M108 184h59l14 126H94zm92 0h57l18 126h-90z" fill="${t.accent}" opacity=".65"/><path d="M85 365h216" stroke="#d7c3a5" stroke-width="8"/><rect x="108" y="393" width="70" height="53" rx="9" fill="#d8c1c9"/><rect x="196" y="393" width="84" height="53" rx="9" fill="#bdcdb0"/><ellipse cx="551" cy="562" rx="150" ry="40" fill="${t.pale}"/><rect x="754" y="99" width="151" height="376" rx="74" fill="#c7b698"/><rect x="766" y="112" width="127" height="345" rx="63" fill="#e4edf0"/><path d="m790 208 70-60m-69 153 74-64" stroke="#fff" opacity=".65" stroke-width="10"/>`;
    if(scene==="dining")return base+window+`<rect x="68" y="247" width="475" height="140" rx="14" fill="#f7eddd"/><path d="M63 251h485" stroke="#b49c7e" stroke-width="15"/><path d="M220 265v110m160-110v110" stroke="#ddcdb8" stroke-width="5"/><circle cx="196" cy="291" r="5" fill="#bca78a"/><circle cx="354" cy="291" r="5" fill="#bca78a"/><rect x="105" y="170" width="100" height="67" rx="15" fill="${t.accent}" opacity=".65"/><path d="M130 170v-14h49v14" fill="none" stroke="#9c9879" stroke-width="8"/><rect x="395" y="408" width="32" height="170" rx="10" fill="#b69c7d"/><rect x="850" y="408" width="32" height="170" rx="10" fill="#b69c7d"/><rect x="357" y="371" width="558" height="99" rx="32" fill="#d8bd99"/><rect x="357" y="371" width="558" height="68" rx="31" fill="#f4dfbd"/><path d="M387 405h500" stroke="#fff7e9" opacity=".5" stroke-width="2"/>`;
    return base+window+`<rect x="71" y="338" width="291" height="157" rx="34" fill="${t.accent}"/><rect x="91" y="318" width="249" height="118" rx="30" fill="${t.pale}"/><rect x="88" y="420" width="253" height="61" rx="24" fill="${t.accent}" opacity=".7"/><path d="M98 481v36m233-36v36" stroke="#a48b71" stroke-width="14"/><rect x="534" y="370" width="380" height="173" rx="18" fill="#bca78c"/><rect x="547" y="369" width="354" height="128" rx="26" fill="${t.pale}"/><rect x="787" y="380" width="96" height="87" rx="27" fill="#fffdf3"/><path d="M546 520v48m356-48v48" stroke="#bca78c" stroke-width="16"/><rect x="414" y="373" width="76" height="111" rx="13" fill="#dfc9a9"/><path d="M450 369v-64" stroke="#aa9579" stroke-width="7"/><path d="M425 263h50l25 51h-100z" fill="#efd799"/><ellipse cx="449" cy="290" rx="72" ry="48" fill="#fff5b8" opacity=".18"/>`;
  }
  return {themes,items,catalog,shape,icon,character,background};
})();
