// Original, age-banded activities. Every task has a bundled prompt, hint and explanation.
(function(root){
  const build=[[],[]],sentences=[[],[]],clocks=[[],[]],sharing=[[],[]],shop=[[],[]];
  const combinations=[
    ['明',['日','月'],'左右','☀️','日和月在一起，组成明，表示明亮。'],['林',['木','木'],'左右','🌳','两个木并排站，组成树林的林。'],
    ['好',['女','子'],'左右','🌷','女在左，子在右，组成美好的好。'],['妈',['女','马'],'左右','👩','女在左，马在右，组成妈妈的妈。'],
    ['休',['亻','木'],'左右','🛏️','单人旁在左，木在右，组成休息的休。'],['从',['人','人'],'左右','🚶','两个人一前一后，组成跟从的从。'],
    ['朋',['月','月'],'左右','🧒','两个月并排站，组成朋友的朋。'],['鸣',['口','鸟'],'左右','🐦','口在左，鸟在右，组成鸣叫的鸣。'],
    ['问',['门','口'],'内外','🚪','门在外，口在里，组成提问的问。'],['闪',['门','人'],'内外','✨','门在外，人在里，组成闪亮的闪。'],
    ['尖',['小','大'],'上下','✏️','小在上，大在下，组成笔尖的尖。'],['男',['田','力'],'上下','👦','田在上，力在下，组成男孩的男。']
  ];
  const advanced=[
    ['清',['氵','青'],'清水','三点水和青组成清，清水的清和水有关。'],['晴',['日','青'],'晴天','日字旁和青组成晴，晴天有太阳。'],
    ['情',['忄','青'],'心情','竖心旁和青组成情，心情和内心有关。'],['睛',['目','青'],'眼睛','目字旁和青组成睛，和眼睛有关。'],
    ['抱',['扌','包'],'拥抱','提手旁和包组成抱，用手臂拥抱。'],['泡',['氵','包'],'泡泡','三点水和包组成泡，水里可以有泡泡。'],
    ['炮',['火','包'],'炮火','火字旁和包组成炮，炮火的炮是火字旁。'],['饱',['饣','包'],'吃饱','食字旁和包组成饱，吃饱和食物有关。'],
    ['河',['氵','可'],'小河','三点水和可组成河，小河里有水。'],['树',['木','对'],'树木','木字旁和对组成树，树木的树是木字旁。'],
    ['时',['日','寸'],'时间','日字旁和寸组成时，可以组成时间。'],['红',['纟','工'],'红色','绞丝旁和工组成红，红是一种颜色。']
  ];
  combinations.forEach(([answer,parts,layout,picture,explain],i)=>build[0].push({id:`bk${i}`,answer,parts,layout,picture,showTarget:true,prompt:`把部件装成“${answer}”字`,speech:`我们来拼${answer}字。${explain}`,hint:`按${layout==='左右'?'从左到右':layout==='上下'?'从上到下':'先外后内'}的顺序，点选部件。${explain}`,explain,lang:'zh-CN',pool:[...parts,'水','土']}));
  advanced.forEach(([answer,parts,word,explain],i)=>build[1].push({id:`bg${i}`,answer,parts,layout:'左右',picture:'🧩',showTarget:false,prompt:`拼出“${word}”中的“${answer}”字`,speech:`请拼出${word}中的${answer}字。想想应该用什么偏旁。`,hint:explain,explain,lang:'zh-CN',pool:[...parts,...['日','氵','木','口'].filter(p=>!parts.includes(p)).slice(0,2)]}));
  const simple=[['🐈','小猫|吃|鱼|。'],['🐇','小兔|吃|萝卜|。'],['🧒','我|喝|水|。'],['🐦','小鸟|在|树上|。'],['☀️','太阳|出来|了|。'],['🌸','花儿|开|了|。'],['🐕','小狗|跑|来了|。'],['🧒','我|喜欢|画画|。'],['👩','妈妈|在|看书|。'],['🧒','我|洗|手|。'],['🐟','小鱼|在|水里|。'],['🌧️','天空|下雨|了|。']];
  const longer=[['🌳','小朋友|在公园里|种树|。'],['🐦','小鸟|在树上|唱歌|。'],['📕','我|每天|认真地|读书|。'],['🌷','花园里|开满了|美丽的|鲜花|。'],['🦋','一只|蝴蝶|飞到|花丛中|。'],['🧒','放学后|，|我|先写作业|。'],['🌧️','下雨了|，|我们|带上雨伞|。'],['🐇','小兔|为什么|跑得这么快|？'],['🌈','这道|彩虹|真美|啊|！'],['🚰','洗手以后|，|要|关好水龙头|。'],['🧒','你|喜欢|哪一本书|？'],['🌱','春天|到了|，|小草|变绿了|。']];
  for(const [level,rows]of [simple,longer].entries())rows.forEach(([picture,text],i)=>{const parts=text.split('|'),sentence=parts.join('');sentences[level].push({id:`sp${level}${i}`,parts,pool:parts,picture,answer:sentence,prompt:level?'听句子，把词语和标点排好':'听一听，按顺序装好小信件',speech:`请把这句话装进信封。${sentence}`,hint:`先听完整的句子，再按顺序放词语。${sentence}`,explain:`你送出的句子是：${sentence}${level?'标点也是句子的一部分。':''}`,lang:'zh-CN'});});
  const events=[['起床','🌅',7],['吃早饭','🥣',8],['做早操','🏃',9],['画画','🎨',10],['洗手','🧼',11],['吃午饭','🍱',12],['午休','🛏️',1],['听故事','📕',2],['做游戏','🧸',3],['回家','🏠',4],['吃晚饭','🍚',6],['睡觉','🌙',9]];
  events.forEach(([event,picture,h],i)=>clocks[0].push({id:`ck${i}`,picture,time:(h%12)*60,prompt:`小熊 ${h} 点${event}，请拨好时钟`,speech:`小熊${h}点${event}。把短短的时针拨到${h}，长长的分针指着十二。`,hint:`整点的时候，长分针指向十二，短时针指向 ${h}。`,explain:`这是 ${h} 点整。短时针指向 ${h}，长分针指向十二。`,lang:'zh-CN'}));
  for(let i=0;i<12;i++){
    const hour=7+i%5,minute=[0,15,30,45][i%4],start=(hour%12)*60+minute,duration=[15,20,30][i%3],elapsed=i>=6,time=elapsed?(start+duration)%720:start,h=Math.floor(time/60)||12,m=time%60;
    clocks[1].push({id:`cg${i}`,picture:elapsed?'📖':'🧸',time,start:elapsed?start:0,prompt:elapsed?`小熊 ${hour}:${String(minute).padStart(2,'0')} 开始读书，读 ${duration} 分钟后是几点？`:`请拨到 ${hour} 时 ${minute} 分`,speech:elapsed?`小熊${hour}时${minute}分开始读书，读${duration}分钟以后是几点？`:`请把时钟拨到${hour}时${minute}分。`,hint:elapsed?`从 ${hour} 时 ${minute} 分往后数 ${duration} 分钟。经过十二时，时针会继续走到一时。`:'长分针每一大格代表 5 分钟。短时针也会随着分钟慢慢移动。',explain:`答案是 ${h} 时 ${m} 分。长分针指向 ${m/5||12}，短时针${m?'走过':'指向'} ${h}。`,lang:'zh-CN'});
  }
  for(const level of [0,1])for(let i=0;i<12;i++){
    const children=level?3+i%2:2+i%2,each=level?2+i%5:1+i%4,total=children*each,food=['🍓','🍰','🍎'][i%3],noun=['草莓','小蛋糕','苹果'][i%3];
    sharing[level].push({id:`sh${level}${i}`,children,total,each,food,prompt:`把 ${total} 份${noun}平均分给 ${children} 位朋友`,speech:`请把${total}份${noun}平均分给${children}位朋友。每个人要一样多，并且全部分完。`,hint:'可以每次给每人一份，再重复一轮。分错了可以从盘子里拿回来。',explain:`${total} 份平均分给 ${children} 人，每人 ${each} 份。${level?`${total} 除以 ${children} 等于 ${each}。`:'每人的数量一样多，这样分很公平。'}`,lang:'zh-CN'});
  }
  const stock=[{id:'apple',word:'apple',plural:'apples',label:'苹果',picture:'🍎'},{id:'banana',word:'banana',plural:'bananas',label:'香蕉',picture:'🍌'},{id:'orange',word:'orange',plural:'oranges',label:'橙子',picture:'🍊'},{id:'pear',word:'pear',plural:'pears',label:'梨',picture:'🍐'}];
  const nums=['one','two','three','four'];
  for(const level of [0,1])for(let i=0;i<12;i++){
    const a=i%4,b=(a+1+i%2)%4,n=1+i%3,m=1+(i+1)%3,order=stock.map((_,j)=>j===a?n:level&&j===b?m:0),phrase=`${nums[n-1]} ${n===1?stock[a].word:stock[a].plural}${level?` and ${nums[m-1]} ${m===1?stock[b].word:stock[b].plural}`:''}`,meaning=`${n} 份${stock[a].label}${level?`和 ${m} 份${stock[b].label}`:''}`;
    shop[level].push({id:`es${level}${i}`,stock,order,prompt:'听顾客的英语，把商品装进购物袋',speech:`I would like ${phrase}, please.`,hint:`顾客需要 ${meaning}。检查购物袋里有没有多装的商品。`,explain:`I would like ${phrase}, please. 顾客需要 ${meaning}，你配齐了！`,lang:'en-US'});
  }
  const data={
    wordbuilder:{kind:'build',title:'汉字拼装屋',emoji:'🧩',subtitle:'装好部件，发现汉字的结构',levels:['部件拼字','偏旁与词语'],banks:build,guide:'按位置顺序点选部件，放错可以点格子取回。',help:'先听目标汉字，按从左到右、从上到下或先外后内的顺序点部件。点已放入的部件可以取回。装好后点检查，就能看到合成的完整汉字。'},
    sentencepost:{kind:'sentence',title:'句子小邮差',emoji:'📮',subtitle:'把词语排好，送出一封小信',levels:['听句子排序','词语与标点'],banks:sentences,guide:'先听句子，再依次放入词语。点信封中的卡片可以取回。',help:'听完整句子，依次点词语卡片装进信封。最后放上标点。放错了点信封里的卡片取回，再继续排列；也可以清空重排。'},
    bearclock:{kind:'clock',title:'小熊的一天',emoji:'🕒',subtitle:'拨一拨时钟，安排小熊的生活',levels:['认识整点','时分与经过时间'],banks:clocks,guide:'蓝色短针是时针，橙色长针是分针。用按钮拨钟，不用抢时间。',help:'听小熊的日程，用加一小时、减一小时来拨时针。二年级还可以每次加减五分钟。跨过整点时，两根指针会一起移动。拨好后点检查。'},
    fairshare:{kind:'share',title:'公平分蛋糕',emoji:'🍰',subtitle:'一人一份，大家分得一样多',levels:['一一对应与分享','平均分与除法'],banks:sharing,guide:'点朋友的盘子送一份，点拿回可以取回。所有食物都分完，每人一样多。',help:'给每位朋友分一样多的食物。可以逐个点盘子分，也可以点每人一份分一轮。分错了可以拿回或全部收回。最后点检查，看看是否公平。'},
    englishshop:{kind:'shop',title:'英语小商店',emoji:'🛒',subtitle:'听懂购物愿望，装好小小购物袋',levels:['单词与数量','两样商品的指令'],banks:shop,guide:'听英语选商品，加一份或减一份。购物袋里的东西要刚刚好。',help:'听顾客的英语请求，找到对应商品，点加一份放入购物袋。点减一份可以拿出来。二年级需要听清两样商品和各自的数量，装好后交给顾客。'}
  };
  if(typeof module!=='undefined')module.exports=data;else root.AcademyMore=data;
})(typeof window!=='undefined'?window:globalThis);
