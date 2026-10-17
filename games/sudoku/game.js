'use strict';
(()=>{
  const E=Sudoku,$=id=>document.getElementById(id),KEY='childgame.sudoku.v1';
  const marks=['●','▲','■','◆','★','♥'],colors=['#b2684b','#5b8861','#557fa1','#926eaa','#b88c32','#b3667b'];
  const fresh=mode=>({...E.generate(mode),version:1,values:[],notes:[],symbols:true});
  let state,selected=-1,pencil=false,pendingHint=null,checked=false,history=[],dialogAction=null;
  try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.version===1&&Object.hasOwn(E.modes,s.mode)){
    const n=E.modes[s.mode].size,valid=a=>Array.isArray(a)&&a.length===n*n&&a.every(v=>Number.isInteger(v)&&v>=0&&v<=n);
    if(valid(s.givens)&&valid(s.values)&&s.values.every((v,i)=>!s.givens[i]||v===s.givens[i])){
      const solutions=E.solve(s.givens,n);if(solutions.length===1)state={...s,solution:solutions[0],symbols:s.symbols!==false,notes:Array.from({length:n*n},(_,i)=>Array.isArray(s.notes?.[i])?[...new Set(s.notes[i].filter(v=>Number.isInteger(v)&&v>=1&&v<=n))]:[])};
    }
  }}catch(_){}
  if(!state){state=fresh('first');state.values=state.givens.slice();state.notes=state.values.map(()=>[]);}
  let soundOn=true;try{soundOn=localStorage.getItem('childgame.sound')!=='off';}catch(_){}
  const audio=createGameAudio({game:'sudoku',music:false,isEnabled:()=>soundOn,isPlaying:()=>true});
  const size=()=>E.modes[state.mode].size,complete=()=>state.values.every((v,i)=>v===state.solution[i]);
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saved').textContent='进度已保存，可以随时休息。';}catch(_){$('saved').textContent='暂时无法保存，关闭页面可能丢失进度。';}}
  function say(text){$('message').textContent=text;}
  function conflicts(){const n=size(),result=new Set();state.values.forEach((v,i)=>{if(v&&E.peers(i,n).some(j=>state.values[j]===v))result.add(i);if(checked&&v&&v!==state.solution[i])result.add(i);});return result;}
  function render(){
    const n=size(),bad=conflicts(),related=selected<0?[]:E.peers(selected,n),focusBoard=document.activeElement?.classList.contains('cell');
    $('board').style.setProperty('--n',n);
    $('board').innerHTML=state.values.map((v,i)=>{const r=Math.floor(i/n),c=i%n;const classes=['cell',state.givens[i]?'given':'',related.includes(i)?'related':'',selected===i?'selected':'',v&&selected>=0&&v===state.values[selected]?'same':'',bad.has(i)?'conflict':'',c%(n/2)===n/2-1&&c!==n-1?'box-right':'',r%2===1&&r!==n-1?'box-bottom':''].filter(Boolean).join(' ');const content=v?`<span>${v}</span>${state.symbols?`<span class="mark" style="--mark:${colors[v-1]}" aria-hidden="true">${marks[v-1]}</span>`:''}`:`<span class="pencil" aria-hidden="true">${Array.from({length:n},(_,j)=>`<span>${state.notes[i].includes(j+1)?j+1:''}</span>`).join('')}</span>`;return `<button class="${classes}" data-cell="${i}" aria-label="第${r+1}行，第${c+1}列，${v||'空格'}${state.givens[i]?'，题目数字':''}${bad.has(i)?'，请检查':''}${!v&&state.notes[i].length?'，草稿'+state.notes[i].join('、'):''}" aria-pressed="${i===selected}">${content}</button>`;}).join('');
    $('numbers').innerHTML=Array.from({length:n},(_,i)=>`<button data-number="${i+1}" aria-label="填写 ${i+1}">${i+1}${state.symbols?`<small style="--mark:${colors[i]}" aria-hidden="true">${marks[i]}</small>`:''}</button>`).join('');
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    $('level').textContent=E.modes[state.mode].label+' · '+(n===4?'2×2':'2×3')+' 小宫';
    const empty=state.values.filter(v=>!v).length;$('progress').textContent=empty?`还有 ${empty} 个空格`:'已经填满啦';
    $('rule-summary').textContent=`把 1～${n} 填进空格。每一行、每一列、每个粗线框里的小宫，数字都不能重复。`;
    $('selection').textContent=selected<0?'先点一个空格，再选数字。':state.givens[selected]?'这是题目给的数字，不能修改。':`第 ${Math.floor(selected/n)+1} 行，第 ${selected%n+1} 列${pencil?' · 正在写草稿':''}`;
    $('notes').setAttribute('aria-pressed',String(pencil));$('notes').textContent=pencil?'✎ 草稿开':'✎ 草稿关';
    $('symbols').setAttribute('aria-pressed',String(state.symbols));$('symbols').textContent=state.symbols?'图形辅助开':'图形辅助关';
    $('undo').disabled=!history.length;$('erase').disabled=selected<0||!!state.givens[selected]||(!state.values[selected]&&!state.notes[selected].length);
    $('hint').textContent=pendingHint?'填入这个提示':'给我一点提示';$('success').hidden=!complete();
    if(focusBoard&&selected>=0)$('board').querySelector(`[data-cell="${selected}"]`).focus({preventScroll:true});
  }
  function select(i){selected=i;pendingHint=null;render();}
  function change(fn){history.push({values:state.values.slice(),notes:state.notes.map(a=>a.slice())});if(history.length>100)history.shift();fn();pendingHint=null;checked=false;save();render();if(complete()){say('完成啦！你让每个数字都找到了自己的位置。');audio.effect('finish',{volume:.3});}else audio.effect('move',{volume:.2});}
  function put(value,asHint=false){
    if(selected<0){say('先点棋盘上的一个空格吧。');return;}if(state.givens[selected]){say('深色数字是题目线索，请选择一个空格。');return;}
    if(pencil&&!asHint){if(state.values[selected]){say('这个格已经有数字，擦除后才能记草稿。');return;}change(()=>{const notes=state.notes[selected];state.notes[selected]=notes.includes(value)?notes.filter(v=>v!==value):[...notes,value].sort();});say('草稿只是记下可能的数字，再点一次可以取消。');return;}
    change(()=>{state.values[selected]=value;state.notes[selected]=[];for(const p of E.peers(selected,size()))state.notes[p]=state.notes[p].filter(v=>v!==value);});
    if(!complete())say(conflicts().size?'有重复的数字啦。看看标着 ! 的格子，它们不能在同一行、列或小宫重复。':'继续找一找：哪一行或哪一宫只差一个数字？');
  }
  function newPuzzle(mode){state=fresh(mode);state.values=state.givens.slice();state.notes=state.values.map(()=>[]);history=[];selected=-1;pencil=false;checked=false;pendingHint=null;save();render();say('新题准备好了，先从空格最少的一行开始吧。');}
  function showDialog(title,text,action){dialogAction=action;$('dialog-title').textContent=title;$('dialog-text').textContent=text;$('cancel').hidden=!action;$('confirm').textContent=action?'换一道题':'我知道啦';$('dialog').showModal();(action?$('cancel'):$('confirm')).focus();}
  function requestNew(mode){if(!complete()&&state.values.some((v,i)=>v!==state.givens[i])||state.notes.some(a=>a.length))showDialog('换一道题吗？','当前题目的进度会被替换。也可以继续完成这一题。',()=>newPuzzle(mode));else newPuzzle(mode);}
  $('board').onclick=e=>{const b=e.target.closest('[data-cell]');if(b)select(Number(b.dataset.cell));};
  $('numbers').onclick=e=>{const b=e.target.closest('[data-number]');if(b)put(Number(b.dataset.number));};
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode!==state.mode)requestNew(b.dataset.mode);});
  $('notes').onclick=()=>{pencil=!pencil;pendingHint=null;render();say(pencil?'草稿模式：记下可能的数字，它们还不算正式答案。':'回到填写答案模式。');};
  $('erase').onclick=()=>{if(selected>=0&&!state.givens[selected]){change(()=>{state.values[selected]=0;state.notes[selected]=[];});say('擦干净啦，可以重新想一想。');}};
  $('undo').onclick=()=>{const old=history.pop();if(!old)return;Object.assign(state,old);checked=false;pendingHint=null;save();render();say('回到上一步了。');};
  $('symbols').onclick=()=>{state.symbols=!state.symbols;save();render();};
  $('check').onclick=()=>{checked=true;render();const bad=conflicts();say(bad.size?'标着 ! 的格子需要再想一想。可以擦掉它，再看看同行、同列和同宫的数字。':complete()?'全部正确，你完成啦！':'目前填的数字都正确，继续慢慢来！');};
  $('hint').onclick=()=>{
    if(complete()){say('已经全部完成啦，可以换一道题。');return;}
    if(pendingHint){selected=pendingHint.index;put(pendingHint.value,true);return;}
    const wrong=state.values.findIndex((v,i)=>v&&v!==state.solution[i]);
    if(wrong>=0){selected=wrong;checked=true;render();say('先检查这个标着 ! 的格子，它与题目线索对不上。擦掉它后，再来找提示。');return;}
    const step=E.next(state.values,size());if(!step){say('试试检查一下已填的数字。');return;}
    selected=step.index;pendingHint=step;render();
    say(step.kind==='排除'?`看选中的格子：同一行、列和小宫已经排除了其他数字，只能填 ${step.value}。想好了，再点下面的按钮填入。`:`观察这个格子所在的${step.kind}：数字 ${step.value} 只能放在这里。想好了，再点下面的按钮填入。`);
  };
  $('restart').onclick=$('next').onclick=()=>requestNew(state.mode);
  $('rules').onclick=()=>showDialog('数独怎么玩？',`① 点一个空格，再点下方的数字。\n② 每一行、每一列、每个粗线小宫，都要有 1～${size()}，不能重复。\n③ 深色数字是题目给的，不能改。相同图形代表相同数字。\n④ 不确定时可以用「草稿」记下可能的数；「提示」会解释下一步。\n慢慢想，没有时间限制。`,null);
  $('cancel').onclick=()=>$('dialog').close();$('confirm').onclick=()=>{const action=dialogAction;$('dialog').close();dialogAction=null;action?.();};
  $('sound').onclick=()=>{soundOn=audio.toggle();if(soundOn)audio.unlock(true);try{localStorage.setItem('childgame.sound',soundOn?'on':'off');}catch(_){}audio.sync();};
  document.addEventListener('keydown',e=>{if($('dialog').open||e.ctrlKey||e.metaKey||e.altKey)return;const n=size();if(/^[1-6]$/.test(e.key)&&Number(e.key)<=n){e.preventDefault();put(Number(e.key));}else if(['Backspace','Delete'].includes(e.key)){e.preventDefault();if(!$('erase').disabled)$('erase').click();}else if(e.key.toLowerCase()==='n')$('notes').click();else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-n,ArrowDown:n}[e.key];select(selected<0?0:Math.max(0,Math.min(n*n-1,selected+delta)));$('board').querySelector(`[data-cell="${selected}"]`).focus();}});
  render();save();
})();
