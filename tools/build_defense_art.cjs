// Original vector sprite sheets: four idle poses and six firing/recovery poses.
const fs=require('fs'),path=require('path'),dir=path.resolve(__dirname,'../assets/img/defense');fs.mkdirSync(dir,{recursive:true});
const colors=[['#f6ce59','#a97530','#79b84c'],['#f2a3cb','#ae588c','#d57cb6'],['#b5edfc','#4c9bbe','#81cfe8']];
const eye='<ellipse cx="43" cy="39" rx="3" ry="4" fill="#344c3b"/><circle cx="44" cy="38" r="1" fill="white"/>';
for(const family of ['garden','castle'])for(let type=0;type<3;type++){
  const [petal,edge,shot]=colors[type];let sheet='';
  for(let f=0;f<10;f++){
    const idle=[0,-1.5,0,1.5][f%4],recoil=f>=4?[0,-7,-4,3,1,0][f-4]:0,sy=f===4?.9:f===5?1.08:1,angle=f<4?[-2,0,2,0][f]:[0,-9,-5,4,1,0][f-4];
    const petals=Array.from({length:type===2?6:8},(_,i)=>{const a=i*360/(type===2?6:8);return type===2?`<path d="M48 11l7 13-7 11-7-11z" transform="rotate(${a} 48 37)" fill="${petal}" stroke="${edge}" stroke-width="1.5"/>`:`<ellipse cx="48" cy="16" rx="10" ry="15" transform="rotate(${a} 48 37)" fill="${petal}" stroke="${edge}" stroke-width="1.5"/>`;}).join('');
    const head=`${petals}<circle cx="48" cy="37" r="19" fill="${type===0?'#f8e59a':type===1?'#ffe4f2':'#e7faff'}" stroke="${edge}" stroke-width="2"/>${eye}<ellipse cx="37" cy="46" rx="5" ry="3" fill="#ef9c8a99"/><path d="M56 36h14q10 0 10 9t-10 9H55" fill="${shot}" stroke="${edge}" stroke-width="2"/><ellipse cx="77" cy="45" rx="5" ry="7" fill="${edge}"/><ellipse cx="78" cy="44" rx="2" ry="3" fill="#233f4055"/>`;
    const plant=`<path d="M48 78Q${44+idle} 61 48 43" fill="none" stroke="#5a9646" stroke-width="7"/><path d="M47 73Q20 76 20 57Q40 53 47 73M49 68Q76 70 76 53Q54 53 49 68" fill="#8fc85b" stroke="#5a9646" stroke-width="2"/><g transform="translate(${recoil} ${idle}) rotate(${angle} 48 70) translate(0 ${37*(1-sy)}) scale(1 ${sy})">${head}</g>`;
    const castle=`<path d="M24 79V56h48v23z" fill="${petal}" stroke="${edge}" stroke-width="3"/><path d="M20 54h56v12H20z" fill="${shot}" stroke="${edge}" stroke-width="2"/><path d="M41 79V68q7-9 14 0v11" fill="${edge}"/><path d="M28 69h7m27 0h6" stroke="#fff9" stroke-width="3"/><g transform="translate(0 ${idle-recoil*.55}) translate(48 35) scale(${f===5?.88:f===7?1.12:1}) translate(-48 -35)"><circle cx="48" cy="35" r="24" fill="${petal}" stroke="${edge}" stroke-width="3"/><circle cx="48" cy="35" r="16" fill="${shot}"/><ellipse cx="40" cy="27" rx="6" ry="4" fill="#fff9"/><path d="M42 41q6 5 12 0" fill="none" stroke="${edge}" stroke-width="2"/><circle cx="40" cy="34" r="2" fill="#344c3b"/><circle cx="56" cy="34" r="2" fill="#344c3b"/>${type===2?'<path d="M48 17v12m-6-9l12 7m0-7l-12 7" stroke="white" stroke-width="2"/>':''}</g>`;
    sheet+=`<svg x="${f*96}" width="96" height="96" viewBox="0 0 96 96"><ellipse cx="48" cy="83" rx="31" ry="7" fill="#42664422"/>${family==='garden'?plant:castle}${f===5?`<path d="M84 27l3 9 7-5-3 10 5 4-9 2 2 9-7-7" fill="#fff4a0" stroke="#e8bf55"/>`:''}</svg>`;
  }
  fs.writeFileSync(path.join(dir,`${family}-${type}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="96" viewBox="0 0 960 96">${sheet}</svg>`);
}
console.log('Generated six original ten-frame sprite sheets.');
