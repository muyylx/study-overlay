(function(){
'use strict';
const ID='scanner-cloud-3-103';
const VERSION='3.103';
const IS_KAHOOT=/^(?:play\.)?kahoot\.it$/i.test(location.hostname);
const API='https://study-overlay-3-api.study-overlay-muyylx.workers.dev';
const TOKEN='__SCANNER_PRIVATE_TOKEN__';
const old=document.getElementById(ID);if(old){old.remove();return;}for(const previousId of ['scanner-cloud-3-101','scanner-cloud-3-100','scanner-cloud-v7','scanner-cloud-v6-1','scanner-cloud-v6','scanner-cloud-v5','scanner-cloud-v5-debug']){const prev=document.getElementById(previousId);if(prev)prev.remove()}
const outdated=document.getElementById('x-s');if(outdated)outdated.remove();
const panel=document.createElement('div');panel.id=ID;
panel.style.cssText='position:fixed;top:156px;left:14px;width:268px;max-width:calc(100vw - 20px);z-index:2147483647;font:13px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#f5f6ff;text-align:left;';
const main=document.createElement('div');main.style.cssText='display:flex;align-items:center;gap:5px;touch-action:none;';
const button=document.createElement('button');button.textContent='Разобрать';button.style.cssText='border:0;border-radius:24px;padding:11px 15px;background:#5969df;color:#fff;font:700 15px -apple-system,sans-serif;box-shadow:0 3px 12px #0005;touch-action:none;user-select:none;';
const autoBtn=document.createElement('button');autoBtn.textContent='авто';autoBtn.style.cssText='border:0;border-radius:22px;padding:11px;background:#303443;color:#fff;font:700 14px -apple-system,sans-serif;';
const close=document.createElement('button');close.textContent='×';close.style.cssText='border:0;border-radius:22px;padding:8px 12px;background:#303443;color:#ddd;font:700 20px -apple-system,sans-serif;';
const collapse=document.createElement('button');collapse.type='button';collapse.setAttribute('aria-label','Свернуть панель');collapse.textContent='−';collapse.style.cssText='border:0;border-radius:18px;padding:6px 11px;background:#303443;color:white;font:700 20px -apple-system,sans-serif;';
const mini=document.createElement('button');mini.type='button';mini.setAttribute('aria-label','Развернуть панель');mini.textContent='⌕';mini.style.cssText='display:none;width:46px;height:46px;border:0;border-radius:50%;background:#5969df;color:white;font:700 24px -apple-system,sans-serif;box-shadow:0 3px 12px #0005;touch-action:none;user-select:none;';
main.append(button,autoBtn,collapse,close);
const output=document.createElement('div');output.style.cssText='display:none;max-height:27vh;overflow:auto;padding:10px 12px;margin-top:6px;border:1px solid #505873;border-radius:12px;background:#191d2af8;color:#f6f7ff;box-shadow:0 4px 18px #0008;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.3;';
const status=document.createElement('div');status.style.cssText='color:#bac5e9;font-size:12px;';
const answer=document.createElement('div');answer.style.cssText='font-weight:800;font-size:19px;margin-top:5px;white-space:pre-wrap;';
const reason=document.createElement('div');reason.style.cssText='font-size:13px;color:#d9dfef;white-space:pre-wrap;margin-top:7px;';
const refs=document.createElement('div');refs.style.cssText='font-size:12px;margin-top:8px;';
output.append(status,answer,reason,refs);
const version=document.createElement('div');version.textContent='v'+VERSION;version.style.cssText='padding:3px 10px;font-size:11px;color:#657091;text-shadow:0 1px 2px #fff9;pointer-events:none;';
const updateNotice=document.createElement('div');updateNotice.style.cssText='display:none;margin-top:6px;padding:11px;border:1px solid #8d7dd1;border-radius:12px;background:#262a44;color:#f5f6ff;box-shadow:0 4px 14px #0005;line-height:1.35;';
const updateText=document.createElement('div');updateText.style.cssText='font-size:13px;margin-bottom:9px;';
const updateLink=document.createElement('a');updateLink.href='https://muyylx.github.io/study-overlay/scanner-cloud/update.html';updateLink.target='_blank';updateLink.rel='noopener noreferrer';updateLink.textContent='Код новой версии';updateLink.style.cssText='display:inline-block;background:#5969df;color:white;text-decoration:none;padding:9px 12px;border-radius:12px;font-size:13px;font-weight:800;';
updateNotice.append(updateText,updateLink);
panel.append(main,mini,output,updateNotice,version);document.body.appendChild(panel);
let updateAvailable=false,updateRequired=false,versionTimer=null;
let running=false,automatic=false,controller=null,signature='',drag=false,moved=false,sx=0,sy=0,dx=0,dy=0;
let collapsed=false,outputShown=false,stableSig='',stableHits=0,stableSince=0,lastProcessedSig='',lastRenderedSig='';
const sent=new Set();
function showOutput(){outputShown=true;if(!collapsed)output.style.display='block'}
function fold(to){collapsed=to;main.style.display=to?'none':'flex';mini.style.display=to?'block':'none';output.style.display=!to&&outputShown?'block':'none';updateNotice.style.display=!to&&updateAvailable?'block':'none';panel.style.width=to?'56px':'268px';panel.style.left=Math.max(0,Math.min(innerWidth-(to?56:268),panel.getBoundingClientRect().left))+'px'}
let cache=window.__scannerCloudCache||(window.__scannerCloudCache=new Map());
const setStatus=s=>{status.textContent=s;showOutput()};
function compareVersions(a,b){
  const parse=x=>/^\d+\.\d+(?:\.\d+)?$/.test(String(x||''))?String(x).split('.').map(Number):null;
  const left=parse(a),right=parse(b);if(!left||!right)return null;
  for(let i=0;i<3;i++){const d=(left[i]||0)-(right[i]||0);if(d!==0)return d<0?-1:1}return 0;
}
async function checkClientUpdate(){
  try{
    const res=await fetch(API+'/health',{method:'GET',mode:'cors',cache:'no-store'});
    if(!res.ok)return;
    const info=await res.json();
    const latest=String(info.latestClientVersion||'');
    const outdated=compareVersions(VERSION,latest);
    if(outdated===null)return;
    const minimum=String(info.minimumClientVersion||VERSION);
    const belowMin=compareVersions(VERSION,minimum);
    updateAvailable=outdated<0;
    updateRequired=updateAvailable&&belowMin!==null&&belowMin<0;
    updateNotice.style.display=updateAvailable&&!collapsed?'block':'none';
    if(updateAvailable){
      updateText.textContent=(updateRequired?'Обязательное':'Рекомендуемое')+' обновление Scanner Cloud. Установлена '+VERSION+', доступна '+latest+'.';
      if(updateRequired){automatic=false;autoBtn.textContent='авто';button.disabled=true;autoBtn.disabled=true;}
    }else{button.disabled=false;autoBtn.disabled=false;}
  }catch(_){/* Keep scanning when the version endpoint is unavailable. */}
}

function visible(e){const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>5&&r.height>5&&s.display!=='none'&&s.visibility!=='hidden'}
function badgeOptions(root){
  const all=Array.from(root.querySelectorAll('*')).slice(0,2200),by=new Map();
  for(const e of all){if(e.children.length||!visible(e))continue;const text=(e.textContent||'').trim();if(!/^[A-H]$/.test(text))continue;
    const r=e.getBoundingClientRect();if(r.width>100||r.height>75)continue;const key=e.tagName+':'+Math.round(r.height/10);if(!by.has(key))by.set(key,[]);by.get(key).push({label:text,element:e});}
  let group=[];for(const a of by.values())if(new Set(a.map(x=>x.label)).size>new Set(group.map(x=>x.label)).size)group=a;
  if(new Set(group.map(x=>x.label)).size<2)return [];
  const seen=new Set(),results=[];
  for(const o of group){if(seen.has(o.label))continue;seen.add(o.label);
    let node=o.element;while(node.parentElement&&node.parentElement!==root){const parent=node.parentElement,n=group.filter(z=>parent.contains(z.element)).length;if(n>1)break;node=parent;}
    let text=(node.innerText||'').trim();if(text.startsWith(o.label))text=text.slice(1).replace(/^[).:\s]+/,'');text=text.slice(0,500);
    results.push({label:o.label,text,node});
  }
  return results.sort((a,b)=>a.label.localeCompare(b.label));
}
// Kahoot uses colour/shape tiles rather than A–H badges. Never click or submit tiles.
const KAHOOT_SHAPES=[['▲','красный'],['◆','синий'],['●','жёлтый'],['■','зелёный']];
function kahootColour(el){
  for(let e=el,k=0;e&&k<5;e=e.parentElement,k++){
    const m=getComputedStyle(e).backgroundColor.match(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
    if(!m)continue;
    const [r,g,b]=m.slice(1).map(Number);
    if(r>155&&r>g*1.42&&r>b*1.3)return 0;
    if(b>120&&b>r*1.25&&b>g*1.1)return 1;
    if(r>160&&g>110&&b<140)return 2;
    if(g>85&&g>r*1.4&&g>b*1.05)return 3;
  }
  return -1;
}
function scanKahoot(){
 const normal=s=>(s||'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim();
 const root=document.querySelector('main,[data-functional-selector="game-block"],[data-functional-selector="question-block"]')||document.body;
 const all=Array.from(document.querySelectorAll('[data-functional-selector^="answer-"],[data-testid^="answer-"],[id^="answer-"],button[role="answer"]'))
    .filter(e=>visible(e)&&e.getBoundingClientRect().width>90&&e.getBoundingClientRect().height>50);
 const opts=new Map();
 for(const el of all){
   let idx=kahootColour(el);
   if(idx<0){const attr=[el.getAttribute('data-functional-selector'),el.getAttribute('data-testid'),el.id].join(' ');const m=attr.match(/(?:^|\s|-)answer-(\d+)/i);if(m)idx=Number(m[1])}
   if(idx<0||idx>3||opts.has(idx))continue;
   const text=normal((el.querySelector('[data-functional-selector="answer-text"],[data-testid="answer-text"]')||el).innerText).replace(/^[▲△◆◇●○■□\s]+/,'');
   opts.set(idx,{element:el,text:text.slice(0,500),idx});
 }
 // DOM selectors vary between Kahoot layouts: fall back to the actual coloured tiles.
 if(opts.size<2){
   const targets=Array.from(document.querySelectorAll('button,[role="button"]')).filter(e=>visible(e)&&e.getBoundingClientRect().width>90&&e.getBoundingClientRect().height>50);
   for(const el of targets){const idx=kahootColour(el);if(idx>=0&&!opts.has(idx))opts.set(idx,{element:el,text:normal(el.innerText).replace(/^[▲△◆◇●○■□\s]+/,'').slice(0,500),idx})}
 }
 if(opts.size<2)return null;
 const ordered=[...opts.values()].sort((a,b)=>a.idx-b.idx);
 // Populate A..D by colour, not the order in which Kahoot mounted its DOM nodes.
 const optionCount=Math.min(4,Math.max(2,Math.max(...opts.keys())+1));
 const optionTexts=KAHOOT_SHAPES.slice(0,optionCount).map((_,i)=>opts.get(i)?.text||'[вариант на экране]');
 const sels=['[data-functional-selector="question-text"]','[data-testid="question-text"]','[data-functional-selector="question-title"]','[data-functional-selector="question-block"] h1','[data-functional-selector="question-block"] h2','main h1','main h2','h1','[role="heading"]'];
 let qnode=null,question='';
 for(const sel of sels){const found=Array.from(document.querySelectorAll(sel)).find(e=>visible(e)&&normal(e.innerText).length>=6&&!ordered.some(o=>o.element.contains(e)));if(found){qnode=found;question=normal(found.innerText);break}}
 if(!question){
   const nodes=Array.from(root.querySelectorAll('div,p,h1,h2,h3')).filter(e=>visible(e)&&e.children.length<=2&&normal(e.innerText).length>=10&&normal(e.innerText).length<650&&!ordered.some(o=>o.element.contains(e)));
   nodes.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-450)-Math.abs(b.getBoundingClientRect().top-450));
   if(nodes.length){qnode=nodes[0];question=normal(qnode.innerText)}
 }
 if(!question||question.length>2300)return null;
 const bottom=Math.min(...ordered.map(o=>o.element.getBoundingClientRect().top));
 const qTop=qnode?.getBoundingClientRect().top??0;
 const candidates=Array.from(root.querySelectorAll('img,canvas,svg')).filter(e=>{
   if(!visible(e)||e.closest('header,nav,aside,footer,[aria-hidden="true"],a[href]'))return false;
   const r=e.getBoundingClientRect();if(r.width<75||r.height<55||r.width*r.height<6500)return false;
   if(ordered.some(o=>o.element.contains(e)))return true;
   return r.top>=Math.max(0,qTop-60)&&r.top<=bottom+20;
 }).slice(0,4);
 const images=candidates.map((element,i)=>{
   const holder=ordered.find(o=>o.element.contains(element));
   const svg=element.tagName.toLowerCase()==='svg';
   return{element,label:holder?'Рисунок варианта '+('ABCD'[holder.idx]):'Рисунок вопроса '+(i+1),src:element.currentSrc||element.src||element.getAttribute('data-src')||'',stableSrc:svg?element.outerHTML.slice(0,240):element.getAttribute('src')||element.getAttribute('data-src')||element.currentSrc||element.tagName};
 });
 const useful=question.replace(/\s+/g,' ').toLowerCase();
 const missingVisual=/\b(?:рисунк|зображенн|світлин|діаграм|графік|таблиц|малюнк|схем|фото|picture|image|diagram|graph|shown|above|below)\w*/i.test(useful)&&!images.length;
 const data={question,options:optionTexts,multiple:detectMultiple(question,[]),context:document.title.slice(0,230),images:[],imageCandidates:images.length+(missingVisual?1:0),kahoot:true,quick:true};
 const sig=JSON.stringify([useful,optionTexts.map(x=>normal(x).toLowerCase()),images.map(x=>[x.stableSrc,x.label])]);
 return{data,images,sig};
}


/**
 * Question-scoped answer cardinality.
 * Page-wide phrases like "несколько правильных ответов" must not
 * turn an unrelated SINGLE-CHOICE question into multi-choice.
 */
function detectMultiple(question, options){
  const instruction=String(question||'').slice(0,900);
  const single=/(?:один|одна|одно|одну|одного|єдину|єдиний|только\s+один|тільки\s+один|only\s+one|single)\s+(?:правильн\w*|вірн\w*|коректн\w*|correct|answer|ответ\w*|відповід\w*)/i.test(instruction)
    ||/(?:choose|select|выбер\w*|обер\w*|вибер\w*)\s+(?:only\s+)?(?:one|один|одну|1)\b/i.test(instruction);
  if(single)return false;
  const controls=options.some(o=>!!o.node?.querySelector?.('input[type="checkbox"],[role="checkbox"],[aria-checked="true"]'));
  const multi=/(?:декілька|кілька|несколько|все|всі|два|дві|три|two|three|several|multiple|all)\s+(?:правильн\w*|вірн\w*|коректн\w*|correct|відповід\w*|ответ\w*|answers|options|варіант\w*|вариант\w*)/i.test(instruction)
    ||/(?:выбер\w*|вибер\w*|обер\w*|select|choose)\s+(?:all|все|всі|несколько|декілька|кілька|two|two or more|два|дві)/i.test(instruction);
  return controls||multi;
}
function normaliseAnswer(data, question){
  if(!question.options.length)return data;
  const legal='ABCDEFGH'.slice(0,question.options.length);
  let choices=Array.isArray(data.choices)?data.choices:[];
  choices=[...new Set(choices.map(x=>String(x||'').trim().toUpperCase()).filter(x=>x.length===1&&legal.includes(x)))];
  if(choices.length===0){
    const text=String(data.answer||'');
    const match=text.match(/^\s*(?:ответ|відповідь|answer)?\s*[:\-]?\s*([A-H])(?:\s*[).:\-\s]|$)/i);
    if(match&&legal.includes(match[1].toUpperCase()))choices=[match[1].toUpperCase()];
  }
  if(!choices.length)throw new Error('Сервер не определил допустимый вариант ответа');
  data.choices=question.multiple?choices:choices.slice(0,1);
  data.answer=data.choices.map(c=>c+') '+String(question.options[legal.indexOf(c)]||'')).join('\n');
  return data;
}
async function requestWithRecovery(payload,signal,quick){
  const url=API+'/solve'+(quick?'?quick=1':'');
  for(let attempt=0;attempt<2;attempt++){
    if(signal.aborted)throw Object.assign(new Error('Остановлено'),{name:'AbortError'});
    let response;
    // One bounded retry only for transient gateway failures.
    // Never retry authorization errors, quotas or rate limits.
    try{
      response=await fetch(url,{method:'POST',mode:'cors',
        headers:{'Content-Type':'application/json','x-scanner-token':TOKEN},
        body:JSON.stringify(payload),signal,cache:'no-store'});
    }catch(e){throw e}
    const json=await response.json().catch(()=>({error:'Сервер вернул некорректный JSON'}));
    if(attempt===0&&[502,503,504].includes(response.status)){
      await new Promise(resolve=>setTimeout(resolve,500));continue;
    }
    return {response,json};
  }
  throw new Error('Сервер не ответил');
}
function scan(useSelection=false){
  panel.style.display='none';
  if(IS_KAHOOT){try{const special=scanKahoot();if(special)return special;}finally{panel.style.display=''}}
  try{
    const selected=useSelection?(getSelection()?.toString()||'').trim():'';
    const roots=[document.querySelector('main'),document.querySelector('article'),document.querySelector('[role=main]'),document.body].filter(Boolean);
    let root=roots[0],opts=[];for(const x of roots){const o=badgeOptions(x);if(o.length>=2){root=x;opts=o;break}}
    const lines=(root.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean);
    let question=selected.length>8?selected:'';
    if(!question){let start=0,end=lines.length;
      for(let i=0;i<lines.length;i++)if(/^(запитання|питання|вопрос|question)\s*\d+/i.test(lines[i]))start=i+1;
      if(opts.length){const first=opts[0].label;for(let i=start;i<lines.length;i++)if(lines[i]===first||lines[i].startsWith(first+')')||lines[i].startsWith(first+'.')){end=i;break}}
      question=lines.slice(start,end).join(' ').slice(0,3200);
      if(!question||question.length<8)question=lines.slice(Math.max(0,lines.length-20)).join(' ').slice(0,3200);
    }
    if(!selected && opts.length && root.contains(opts[0].node)){
      try{
        const rng=document.createRange();rng.selectNodeContents(root);rng.setEndBefore(opts[0].node);
        const before=(rng.toString()||'').trim().replace(/^(?:ЗАПИТАННЯ|ПИТАННЯ|ВОПРОС|QUESTION)\s*\d{1,3}\s*(?:[·-]\s*\d+\s*бал(?:ів|а|и|ов)?)?\s*/i,'').trim();
        if(before.length>=8 && before.length<=3200)question=before;
      }catch(_){}
    }
    const context=[document.title,...Array.from(document.querySelectorAll('h1,h2')).slice(0,3).map(x=>(x.innerText||'').trim())].join(' | ').slice(0,260);
    const multiple=detectMultiple(question,opts);
    const target=opts.length?root:document.body;
    // Relevant diagrams before options, option illustrations before decorative page art.
    const beforeOptions=opts.length?Math.min(...opts.map(o=>o.node.getBoundingClientRect().top)):1e8;
    const candidates=Array.from(target.querySelectorAll('img,canvas,svg')).filter(e=>{
      if(!visible(e)||e.closest('nav,header,footer,aside,[aria-hidden="true"]'))return false;
      const r=e.getBoundingClientRect();return r.width>=55&&r.height>=45&&r.width*r.height>=3000;
    });
    const elements=candidates.map(element=>{
      const rect=element.getBoundingClientRect();
      const inOption=opts.some(o=>o.node.contains(element));
      const priority=inOption?3:(rect.top<=beforeOptions+12?5:1);
      return {element,priority,top:rect.top};
    }).sort((a,b)=>b.priority-a.priority||a.top-b.top).slice(0,5).map(x=>x.element);
    const images=elements.map((element,i)=>{
      const svg=element.tagName.toLowerCase()==='svg';
      const src=element.currentSrc||element.src||element.getAttribute('data-src')||'';
      const stableSrc=svg?element.outerHTML.slice(0,260):element.getAttribute('data-src')||element.getAttribute('src')||element.currentSrc||element.src||element.tagName;
      return {element,label:'Рисунок вопроса '+(i+1),src,stableSrc};
    });
    for(const o of opts){for(const im of images){if(o.node.contains(im.element))im.label='Рисунок варианта '+o.label}}
    const data={question,options:opts.map(o=>o.text||'[изображение]'),multiple,context,images:[],imageCandidates:candidates.length};
    // Fingerprint tracks content, not the loading order of the counter or decorative UI.
    // Stable image source attributes avoid a second scan when currentSrc finishes loading.
    const normalize = value => String(value||'')
      .replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\u00a0/g,' ')
      .replace(/[✓✔☑]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const normalizedQuestion=normalize(question).replace(/^(?:запитання|питання|вопрос|question)\s*№?\s*\d{1,3}\s*(?:[·-]\s*\d+\s*бал(?:ів|а|и|ов)?)?\s*/i,'');
    const sig=JSON.stringify([normalizedQuestion,data.options.map(normalize),multiple,
      images.map(x=>[x.stableSrc.replace(/#.*$/,'').trim(),x.label])]);
    return {data,images,sig};
  }finally{panel.style.display=''}
}
function encodeImage(item){return new Promise(resolve=>{
  const el=item.element;
  let finished=false;
  const timer=setTimeout(()=>finish(null),2400);
  function finish(value){if(finished)return;finished=true;clearTimeout(timer);resolve(value)}
  function draw(img,w,h){try{
    if(!w||!h||w>20000||h>20000)return finish(null);
    const scale=Math.min(1,1100/Math.max(w,h));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
    const ctx=c.getContext('2d');if(!ctx)return finish(null);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    let data=c.toDataURL('image/jpeg',.8);
    if(data.length>520000)data=c.toDataURL('image/jpeg',.6);
    if(data.length>520000){
      const smaller=document.createElement('canvas');const r=Math.min(1,760/Math.max(c.width,c.height));
      smaller.width=Math.max(1,Math.round(c.width*r));smaller.height=Math.max(1,Math.round(c.height*r));
      const g=smaller.getContext('2d');if(!g)return finish(null);
      g.drawImage(c,0,0,smaller.width,smaller.height);data=smaller.toDataURL('image/jpeg',.65);
    }
    finish(data.length<520000?{label:item.label,data}:null);
  }catch(e){finish(null)}}
  if(el.tagName.toLowerCase()==='canvas'){draw(el,el.width,el.height);return}
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>draw(img,img.naturalWidth||img.width,img.naturalHeight||img.height);
  img.onerror=()=>finish(null);
  if(el.tagName.toLowerCase()==='svg'){
    try{const bounds=el.getBoundingClientRect();const xml=new XMLSerializer().serializeToString(el);
      img.onload=()=>draw(img,bounds.width*2,bounds.height*2);
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);
    }catch(e){finish(null)}
  }else if(item.src)img.src=item.src;else finish(null);
})}
function addResult(data,question={}){
  const multi=question.multiple===true;
  const legal='ABCDEFGH'.slice(0,Math.max(0,question.options?.length||8));
  const all=[...new Set((Array.isArray(data.choices)?data.choices:[])
    .map(x=>String(x||'').trim().toUpperCase()).filter(x=>x.length===1&&legal.includes(x)))];
  const selected=multi?all:all.slice(0,1);
  let short='';
  if(IS_KAHOOT&&selected.length){
    short=selected.map(c=>{
      const item=KAHOOT_SHAPES['ABCD'.indexOf(c)];
      return item?item[0]+' ('+item[1]+')':c;
    }).join(' · ');
  }else if(selected.length){
    short=selected.join(', ');
  }else if(!question.options?.length){
    short=String(data.answer||'Ответ не определён').split('\n')[0].slice(0,220);
  }else{
    short='Не удалось определить вариант';
  }
  answer.textContent=short;
  reason.textContent='';refs.replaceChildren();
  const speed=Number.isFinite(data.elapsedMs)?' · '+(data.elapsedMs/1000).toFixed(1)+' с':'';
  const verified=/(?:совпадени|подтвержден|проверен|сверено)/i.test(String(data.verification||''))&&!data.uncertain;
  status.textContent=(verified?'Проверено':'Ответ')+speed;
  const first=selected[0],colour=IS_KAHOOT?'ABCD'.indexOf(first):-1;
  answer.style.color=colour>=0?['#ff5867','#59a6ff','#ffcd39','#78dc73'][colour]:'#f6f7ff';
}
async function run(force=false,mode='manual',sample=null){
 if(updateRequired){setStatus('Необходимо обновить Scanner Cloud');return;}
  if(running){if(mode==='manual')controller?.abort();return}
  let scanned;
  try{scanned=sample||scan(mode==='manual')}catch(e){setStatus('Не удалось прочитать страницу');reason.textContent=e.message||String(e);return}
  const {data,images,sig}=scanned;
  if(!data.question||data.question.length<5){setStatus('Не вижу вопрос');reason.textContent='Выдели текст вопроса и повтори.';return}
  signature=sig;
  // The same question is never charged twice automatically, including after a failed call.
  if(mode==='auto'&&sent.has(sig)){
    if(cache.has(sig)&&lastRenderedSig!==sig){addResult(cache.get(sig),data);showOutput();lastRenderedSig=sig}
    return;
  }
  if(!force&&cache.has(sig)){
    sent.add(sig);lastProcessedSig=sig;lastRenderedSig=sig;addResult(cache.get(sig),data);showOutput();return;
  }
  sent.add(sig);lastProcessedSig=sig;
  if(sent.size>100)sent.delete(sent.values().next().value);
  running=true;controller=new AbortController();showOutput();answer.textContent='';reason.textContent='';refs.replaceChildren();setStatus(IS_KAHOOT?'Ищу быстрый вариант…':'Читаю вопрос…');button.textContent='Стоп';
  const begin=Date.now();const signal=controller.signal;
  const timer=setInterval(()=>{if(running)status.textContent='Анализ · '+((Date.now()-begin)/1000).toFixed(1)+' с'},500);
  try{
    const all=await Promise.all(images.slice(0,IS_KAHOOT?3:5).map(encodeImage));
    if(signal.aborted)throw Object.assign(new Error('Отменено'),{name:'AbortError'});
    data.images=all.filter(Boolean);
    const {response:res,json:response}=await requestWithRecovery(data,signal,IS_KAHOOT);
    if(!res.ok){const details=Array.isArray(response.models)?response.models.map(m=>m.name+': '+(m.error||m.status||'неизвестная ошибка')).join('\n'):'';throw new Error((response.error||'HTTP '+res.status)+(details?'\n\nДиагностика API:\n'+details:''))}
    if(data.imageCandidates>data.images.length){response.uncertain=true;}
    normaliseAnswer(response,data);
    // Rendering the answer must not interpret a single transient DOM mutation as a new question.
    cache.set(sig,response);if(cache.size>45)cache.delete(cache.keys().next().value);
    mini.textContent=response.uncertain?'?':'✓';
    let latest=sig;try{if(automatic)latest=scan(false).sig}catch(_){}
    if(latest!==sig){
      await new Promise(resolve=>setTimeout(resolve,320));
      if(!signal.aborted){try{latest=scan(false).sig}catch(_){latest=sig}}
    }
    if(latest===sig){addResult(response,data);showOutput();lastRenderedSig=sig}
    else{status.textContent='Страница меняется. Ожидаю стабильный вопрос…';}

  }catch(e){
    setStatus(e.name==='AbortError'?'Остановлено':'Не удалось получить ответ');
    if(e.name!=='AbortError'){reason.textContent=e.message||String(e);mini.textContent='!'}
  }finally{clearInterval(timer);button.textContent='Разобрать';running=false;controller=null}
}
function draggable(handle){
  handle.addEventListener('pointerdown',e=>{drag=true;moved=false;sx=e.clientX;sy=e.clientY;const r=panel.getBoundingClientRect();dx=r.left;dy=r.top;try{handle.setPointerCapture(e.pointerId)}catch(_){} });
  handle.addEventListener('pointermove',e=>{if(!drag)return;const xx=e.clientX-sx,yy=e.clientY-sy;if(!moved&&Math.abs(xx)+Math.abs(yy)<9)return;moved=true;panel.style.left=Math.max(0,Math.min(innerWidth-(collapsed?56:268),dx+xx))+'px';panel.style.top=Math.max(0,Math.min(innerHeight-48,dy+yy))+'px'});
  handle.addEventListener('pointerup',()=>{drag=false});handle.addEventListener('pointercancel',()=>{drag=false});
}
draggable(button);draggable(mini);
button.addEventListener('click',()=>{if(moved){moved=false;return}run(false,'manual')});
mini.addEventListener('click',()=>{if(moved){moved=false;return}fold(false)});
button.addEventListener('contextmenu',e=>{e.preventDefault();run(true,'manual')});
collapse.addEventListener('click',()=>fold(true));
close.addEventListener('click',()=>{automatic=false;controller?.abort();if(versionTimer)clearInterval(versionTimer);panel.remove()});
autoBtn.addEventListener('click',()=>{automatic=!automatic;autoBtn.textContent=automatic?'авто ✓':'авто';autoBtn.style.background=automatic?'#278d61':'#303443';stableSig='';stableHits=0;stableSince=0});
// Two stable observations of the same completed question before doing any auto request.
// Button clicks, checkbox selection, and progress animations won't repeatedly trigger a request.
window.addEventListener('resize',()=>{
  if(!document.body.contains(panel))return;
  const r=panel.getBoundingClientRect(),w=collapsed?56:268;
  panel.style.left=Math.max(0,Math.min(innerWidth-w,r.left))+'px';
  panel.style.top=Math.max(0,Math.min(innerHeight-48,r.top))+'px';
});
const poll=setInterval(()=>{
  if(!document.body.contains(panel)){clearInterval(poll);if(versionTimer)clearInterval(versionTimer);return}
  if(!automatic||running||document.visibilityState==='hidden')return;
  let sample;try{sample=scan(false)}catch(_){return}
  if(!sample.data.question||sample.data.question.length<5)return;
  if(sample.sig!==stableSig){stableSig=sample.sig;stableHits=1;stableSince=Date.now();return}
  stableHits++;
  if(stableHits<2||Date.now()-stableSince<(IS_KAHOOT?230:800)||sample.sig===lastProcessedSig)return;
  if(sent.has(sample.sig)&&!cache.has(sample.sig)){lastProcessedSig=sample.sig;return}
  run(false,'auto',sample);
},IS_KAHOOT?300:950);
checkClientUpdate();versionTimer=setInterval(checkClientUpdate,300000);
})();