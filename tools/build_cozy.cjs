const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const games=[
  ['toyblast','玩具点点消','点击相连玩具，轻松收集好朋友',['点点消','消除','玩具','幼儿园'],'#eadff3','🧸'],
  ['fruitgarden','水果三消花园','交换消除赚种子，离线种花装饰花园',['三消','种植','放置','花园','消消乐'],'#e1edcd','🍓'],
  ['icecream','小熊冰淇淋店','招待小熊顾客，自由搭配冰淇淋作品',['冰淇淋','经营','厨房','自由创作'],'#f7dfe7','🍦'],
  ['aquarium','我的水族馆','邀请小鱼，喂食、布置安静的水底世界',['鱼','放置','水族馆','装饰'],'#d9eff0','🐠']
];
for(const [id,title,blurb,tags,color,emoji]of games){
  const dir=path.join(root,'games',id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#faf7ef"><meta name="apple-mobile-web-app-capable" content="yes"><title>${title} · 软软游戏屋</title><link rel="icon" href="../../assets/img/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="../../assets/img/apple-touch-icon.png"><link rel="manifest" href="../../manifest.webmanifest"><link rel="stylesheet" href="../../assets/css/cozy.css"><link rel="stylesheet" href="../../assets/css/screen-fit.css"></head>
<body data-game="${id}"><header><a href="../../index.html">‹ 回大厅</a><div><span>慢慢玩 · 发现小小快乐</span><h1>${title}</h1></div><button id="sound">开启声音</button></header><div class="toolbar"><nav id="tabs" aria-label="游戏玩法"></nav><div class="tools"><button id="undo">撤销</button><button id="help">怎么玩</button><button id="restart">重新开始</button></div></div><main><div id="activity" class="layout"></div></main><footer><p id="feedback" role="status"></p><span id="save-status"></span></footer><dialog id="dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><p id="dialog-text"></p><div><button id="cancel">继续玩</button><button id="confirm" class="primary">确定</button></div></dialog><script src="../../assets/js/cozy-core.js"></script><script src="../../assets/js/audio.js"></script><script src="../../assets/js/aquarium.js"></script><script src="../../assets/js/game-feedback.js"></script><script src="../../assets/js/cozy-ui.js"></script><script src="../../assets/js/offline.js"></script><script src="../../assets/js/screen-fit.js"></script></body></html>
`);
  const art={
    toyblast:'<rect x="128" y="45" width="100" height="70" rx="16" fill="#efb9ce"/><rect x="240" y="45" width="100" height="70" rx="16" fill="#d5c1e9"/><rect x="128" y="126" width="100" height="70" rx="16" fill="#b9dcca"/><rect x="240" y="126" width="100" height="70" rx="16" fill="#efd495"/><g fill="#fff9"><circle cx="178" cy="80" r="20"/><circle cx="290" cy="80" r="20"/><path d="M178 137l22 39h-44zM290 137l22 39h-44z"/></g>',
    fruitgarden:'<path d="M95 178h300" stroke="#99aa72" stroke-width="20" stroke-linecap="round"/><g stroke="#719654" stroke-width="7"><path d="M160 170v-65M240 170v-95M320 170v-65"/></g><g fill="#e8a7bb"><circle cx="160" cy="93" r="29"/><circle cx="320" cy="93" r="29"/></g><circle cx="240" cy="69" r="35" fill="#efca75"/><g fill="#f9edb6"><circle cx="160" cy="93" r="10"/><circle cx="320" cy="93" r="10"/></g><circle cx="240" cy="69" r="15" fill="#b88a5c"/>',
    icecream:'<path d="M180 130h120l-40 82h-40z" fill="#d8a86a"/><path d="M195 156h90M210 180h60" stroke="#f6d5a3" stroke-width="4"/><ellipse cx="240" cy="124" rx="70" ry="37" fill="#f5d994"/><ellipse cx="240" cy="87" rx="60" ry="35" fill="#e8a3b3"/><circle cx="240" cy="46" r="14" fill="#bd5369"/><path d="M241 35q20-24 30-11" fill="none" stroke="#62895c" stroke-width="5"/>',
    aquarium:'<rect x="90" y="32" width="300" height="180" rx="30" fill="#9bd4d9"/><path d="M105 196h270" stroke="#e3d2ac" stroke-width="20"/><path d="M135 185q-20-40 3-72m10 65q24-25 10-48" fill="none" stroke="#70a77c" stroke-width="10"/><g transform="translate(245 107)"><path d="M34 0l40-28v56z" fill="#e7a966"/><ellipse rx="50" ry="31" fill="#f0c875"/><circle cx="-22" cy="-7" r="5" fill="#456979"/></g><circle cx="200" cy="57" r="9" fill="#fff7"/><circle cx="325" cy="144" r="6" fill="#fff7"/>'
  }[id];
  fs.writeFileSync(path.join(dir,'cover.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><rect width="480" height="240" fill="${color}"/><circle cx="30" cy="20" r="90" fill="#fff5"/><circle cx="470" cy="220" r="85" fill="#fff4"/>${art}</svg>`);
}
const file=path.join(root,'games/manifest.json'),old=JSON.parse(fs.readFileSync(file,'utf8')).filter(g=>!games.some(([id])=>g.id===id));
fs.writeFileSync(file,JSON.stringify([...games.map(([id,title,blurb,tags])=>({id,title,blurb,tags,category:'休闲',cover:`games/${id}/cover.svg`,entry:`games/${id}/index.html`})),...old],null,2)+'\n');
console.log('Generated four cozy games, covers and lobby entries.');
