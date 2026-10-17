// Generate original pages, covers and the reproducible narration script.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),data=require('../assets/js/academy-data.js');
const speech=[];
const colors={hanzi:['#f2dfec','#86517b'],mathtrain:['#deedf5','#3d708b'],englishisland:['#e1efd9','#397b75']};
for(const [id,game] of Object.entries(data)) {
  const dir=path.join(root,'games',id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#f7f7ee"><meta name="apple-mobile-web-app-capable" content="yes"><title>${game.title} · 软软游戏屋</title><link rel="icon" href="../../assets/img/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="../../assets/img/apple-touch-icon.png"><link rel="manifest" href="../../manifest.webmanifest"><link rel="stylesheet" href="../../assets/css/academy.css"></head>
<body data-game="${id}">
<header><a href="../../index.html">‹ 回大厅</a><div><p>学习乐园 · 听一听，动动手</p><h1>${game.title}</h1></div><button id="sound">开启声音</button></header>
<div class="topbar"><nav class="levels" aria-label="学习阶段"><button data-level="0">幼儿园<small>${game.levels[0]}</small></button><button data-level="1">二年级<small>${game.levels[1]}</small></button></nav><div class="tools"><button id="help">怎么玩</button><button id="restart">开始旅程</button></div></div>
<main><div id="journey" class="journey" aria-label="本轮进度" hidden></div><div id="activity"></div></main>
<footer><p id="feedback" role="status"></p><span id="save-status"></span></footer>
<dialog id="dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><p id="dialog-text"></p><div><button id="cancel">继续玩</button><button id="confirm" class="primary">确定</button></div></dialog>
<script src="../../assets/js/academy-data.js"></script><script src="../../assets/js/academy-core.js"></script><script src="../../assets/js/audio.js"></script><script src="../../assets/js/academy-ui.js"></script><script src="../../assets/js/offline.js"></script>
</body></html>
`);
  const [bg,ink]=colors[id];
  const art=id==='hanzi'?`<rect x="122" y="55" width="105" height="116" rx="16" fill="white" transform="rotate(-9 175 110)"/><text x="175" y="135" text-anchor="middle" font-size="72" fill="${ink}" font-family="serif">木</text><circle cx="274" cy="107" r="43" fill="#fff9" stroke="${ink}" stroke-width="10"/><path d="M305 140l37 37" stroke="${ink}" stroke-width="16" stroke-linecap="round"/>`:id==='mathtrain'?`<path d="M76 170h330" stroke="#7895a5" stroke-width="5"/><rect x="90" y="88" width="86" height="68" rx="14" fill="${ink}"/><rect x="100" y="57" width="43" height="48" rx="7" fill="#72a5ba"/><rect x="108" y="65" width="27" height="24" rx="5" fill="white"/><path d="M175 140h24m90 0h20" stroke="${ink}" stroke-width="8"/><rect x="196" y="99" width="88" height="57" rx="10" fill="#ddb379"/><rect x="305" y="99" width="88" height="57" rx="10" fill="#83ad97"/><text x="240" y="139" font-size="34" text-anchor="middle" fill="white">3</text><text x="350" y="139" font-size="34" text-anchor="middle" fill="white">6</text>${[112,155,217,266,324,374].map(x=>`<circle cx="${x}" cy="159" r="12" fill="#53646b"/>`).join('')}`:`<ellipse cx="253" cy="169" rx="150" ry="29" fill="#9ad5cf"/><ellipse cx="253" cy="152" rx="110" ry="26" fill="#efda9a"/><path d="M177 149l12-75" stroke="#a47a4c" stroke-width="13"/><path d="M190 77q-48-55-78-7 42-15 78 7m0 0q31-60 74-20-43-1-74 20m0 0q-5-58 23-51" fill="#70a675"/><rect x="253" y="86" width="96" height="73" rx="12" fill="#b98455"/><path d="M253 109h96" stroke="#efd797" stroke-width="7"/><rect x="292" y="104" width="17" height="23" rx="4" fill="#efd797"/><text x="301" y="88" font-size="37" text-anchor="middle" fill="${ink}" font-family="sans-serif">ABC</text>`;
  fs.writeFileSync(path.join(dir,'cover.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><rect width="480" height="240" fill="${bg}"/><circle cx="45" cy="40" r="80" fill="white" opacity=".3"/><circle cx="451" cy="227" r="80" fill="white" opacity=".35"/>${art}<path d="M397 42l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" fill="#e4bb64"/></svg>`);
  for(const bank of game.banks)for(const q of bank)for(const type of ['prompt','hint','explain'])speech.push({id:`${q.id}-${type}`,lang:type==='prompt'?q.lang:'zh-CN',text:type==='prompt'?q.speech:type==='explain'&&q.lang==='en-US'?q.explain.split('. ').slice(1).join('. '):q[type]});
}
const manifestPath=path.join(root,'games/manifest.json');
const old=JSON.parse(fs.readFileSync(manifestPath,'utf8')).filter(game=>!data[game.id]);
const subjects={hanzi:['识字','汉字','形近字'],mathtrain:['数学','加减','乘法','装货'],englishisland:['英语','English','单词','颜色','数量']};
const entries=Object.entries(data).map(([id,g])=>({id,title:g.title,blurb:g.subtitle+' · 幼儿园 / 二年级',category:'学习',tags:[...subjects[id],'幼儿园','二年级','语音'],cover:`games/${id}/cover.svg`,entry:`games/${id}/index.html`}));
fs.writeFileSync(manifestPath,JSON.stringify([...entries,...old],null,2)+'\n');
fs.writeFileSync(path.join(root,'tools/academy-speech.json'),JSON.stringify(speech,null,2)+'\n');
console.log(`Generated ${entries.length} games and ${speech.length} narration segments.`);
