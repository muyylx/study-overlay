// Scanner Access 3.110: сборка из release-3.109.
// 1) Скопируйте в эту папку index.js, owner.js, owner-client.js, sources.js и ui.js из ../release-3.109
//    (providers.js здесь уже новый, его не копировать).
// 2) Запустите: node patch.mjs  (каждая замена проверяется на точное совпадение; при расхождении сборка остановится).
import fs from 'fs';
import {adminPage,clientPage,publicLauncher} from './ui.js';
import {ownerClient} from './owner-client.js';
function must(s,from,to,label,all=false){
  const n=s.split(from).length-1;
  if(n<1)throw new Error('NOT FOUND: '+label);
  if(!all&&n!==1)throw new Error('AMBIGUOUS ('+n+'): '+label);
  return s.split(from).join(to);
}
// ---------- participant launcher ----------
let L=publicLauncher;
L=must(L,"const VERSION='3.102';","const VERSION='3.110';",'launcher version');
const i0=L.indexOf("const imgs=Array.from(area.querySelectorAll('img,canvas,svg'))");
const i1=L.indexOf(".slice(0,5);",i0)+".slice(0,5);".length;
if(i0<0||i1<i0)throw new Error('imgs block not found');
const newImgs=String.raw`const okImg=(e,min)=>visible(e)&&!e.closest('nav,header,footer,aside')&&e.getBoundingClientRect().width>=min[0]&&e.getBoundingClientRect().height>=min[1];
const optImgs=[];options.forEach(o=>{try{const e=Array.from(o.el.querySelectorAll('img,canvas,svg')).find(x=>okImg(x,[24,20]));if(e)optImgs.push({el:e,label:'Вариант '+o.label})}catch(_){}});
const optSet=new Set(optImgs.map(x=>x.el));
const qList=Array.from(area.querySelectorAll('img,canvas,svg')).filter(e=>okImg(e,[55,45])&&!optSet.has(e)&&!options.some(o=>o.el.contains(e))).slice(0,4);
const imgs=[...qList.map((el,i)=>({el:el,label:qList.length>1?'Рисунок к вопросу '+(i+1):'Рисунок к вопросу'})),...optImgs].slice(0,8);
const imgEls=imgs.map(x=>x.el);`;
L=L.slice(0,i0)+newImgs+L.slice(i1);
L=must(L,"const sources=imgs.map(","const sources=imgEls.map(",'sources map');
const d0=L.indexOf("async function imageData(el,i){"),d1=L.indexOf("async function sendScan");
if(d0<0||d1<d0)throw new Error('imageData block not found');
const newImageData=String.raw`async function imageData(item,i,lim){return new Promise(resolve=>{
 const el=item.el,label=item.label||('Изображение '+(i+1));let finished=false,guard=null;
 const urlOf=()=>{const u=(el.currentSrc||el.src||(el.getAttribute&&el.getAttribute('data-src'))||'');return /^https:\/\//i.test(u)&&u.length<1400?u:''};
 const urlOnly=()=>{const u=urlOf();return u?{label:label,url:u}:null};
 const done=v=>{if(!finished){finished=true;clearTimeout(guard);resolve(v)}};
 guard=setTimeout(()=>done(urlOnly()),4500);
 const draw=(img,w,h)=>{try{
  if(!w||!h){done(urlOnly());return}
  const s=Math.min(1,1280/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*s));c.height=Math.max(1,Math.round(h*s));
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
  let v=c.toDataURL('image/jpeg',.84);if(v.length>lim)v=c.toDataURL('image/jpeg',.68);
  if(v.length>lim){const r=Math.sqrt((lim-10000)/v.length),d=document.createElement('canvas');d.width=Math.max(1,Math.round(c.width*r));d.height=Math.max(1,Math.round(c.height*r));d.getContext('2d').drawImage(c,0,0,d.width,d.height);v=d.toDataURL('image/jpeg',.7)}
  done(v.length<=lim?{label:label,data:v}:urlOnly());
 }catch(_){done(urlOnly())}};
 if(el.tagName==='CANVAS'){draw(el,el.width,el.height);return}
 if(el.tagName.toLowerCase()==='svg'){try{const r=el.getBoundingClientRect(),xml=new XMLSerializer().serializeToString(el),s=new Image();s.onload=()=>draw(s,r.width*2,r.height*2);s.onerror=()=>done(null);s.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml)}catch(_){done(null)}return}
 const u=el.currentSrc||el.src;if(!u){done(null);return}
 const im=new Image();im.crossOrigin='anonymous';
 im.onload=()=>draw(im,im.naturalWidth||im.width,im.naturalHeight||im.height);
 im.onerror=()=>done(urlOnly());im.src=u;
})}
`;
L=L.slice(0,d0)+newImageData+L.slice(d1);
L=must(L,"const encoded=await Promise.all(sample.imgs.map(imageData));","const lim=sample.imgs.length>5?330000:480000;const encoded=await Promise.all(sample.imgs.map((it,i)=>imageData(it,i,lim)));",'sendScan');
L=must(L,"бал(?:ів|а|ов))?","бал(?:ів|а|ов)?)?",'launcher score suffix',true);
try{new Function(L)}catch(e){throw new Error('launcher does not parse: '+e.message)}
// ---------- participant panel + admin texts ----------
let C=clientPage;
C=must(C,"Последняя версия: 3.102.","Последняя версия: 3.110.",'client latest text');
C=must(C,"cmpVersion(launcherVersion,'3.102')<0","cmpVersion(launcherVersion,'3.110')<0",'client stale');
let A=adminPage;
A=must(A,"версия 3.109","версия 3.110",'admin version');
A=must(A,"Scanner Cloud 3.109","Scanner 3.110",'admin cloud');
fs.writeFileSync('ui.js','export const adminPage='+JSON.stringify(A)+';\nexport const clientPage='+JSON.stringify(C)+';\nexport const publicLauncher='+JSON.stringify(L)+';\n');
// ---------- owner client ----------
let O=ownerClient;
O=must(O,"const ID='scanner-cloud-3-109';","const ID='scanner-cloud-3-110';",'owner id');
O=must(O,"const VERSION='3.109';","const VERSION='3.110';",'owner version');
O=must(O,"обновление Scanner Cloud.","обновление Scanner.",'owner update text');
O=must(O,"Необходимо обновить Scanner Cloud","Необходимо обновить Scanner",'owner must-update text');
O=must(O,"setTimeout(()=>finish(null),2400)","setTimeout(()=>finish(null),3600)",'owner image timeout');
try{new Function(O)}catch(e){throw new Error('owner client does not parse: '+e.message)}
fs.writeFileSync('owner-client.js','export const ownerClient='+JSON.stringify(O)+';\n');
// ---------- owner.js (server for the personal version) ----------
let W=fs.readFileSync('owner.js','utf8');
W=must(W,"3.109","3.110",'owner.js versions',true);
W=must(W,'Возвращай только JSON: {"answer":"текст"','Сначала в поле reasoning кратко (до 50 слов) разбери варианты и исключи неверные, затем дай ответ. Возвращай только JSON: {"reasoning":"разбор","answer":"текст"','owner prompt');
W=must(W,"properties:{choices:","properties:{reasoning:{type:'string'},choices:",'schema props');
W=must(W,"required:['choices','answer','explanation','uncertain']","required:['reasoning','choices','answer','explanation','uncertain']",'schema required');
W=must(W,"explanation:String(x.explanation||'').slice(0,3000)","explanation:String(x.explanation||x.reasoning||'').slice(0,3000)",'decode explanation');
fs.writeFileSync('owner.js',W);
// ---------- index.js ----------
let I=fs.readFileSync('index.js','utf8');
I=must(I,"send({version:'3.102',minSupported:'3.100'","send({version:'3.110',minSupported:'3.100'",'index version');
fs.writeFileSync('index.js',I);
// ---------- sources.js ----------
let S=fs.readFileSync('sources.js','utf8');
S=must(S,"// Scanner Cloud 3.108","// Scanner Access 3.110",'sources comment');
S=must(S,"const VERSION='3.109',UA='ScannerCloud/'","const VERSION='3.110',UA='ScannerAccess/'",'sources UA');
fs.writeFileSync('sources.js',S);
console.log('PATCH OK');
