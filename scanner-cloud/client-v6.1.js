(function(){
'use strict';
const ID='scanner-cloud-v6-1';
const API='https://study-overlay-3-api.study-overlay-muyylx.workers.dev';
const TOKEN='__SCANNER_PRIVATE_TOKEN__';
const old=document.getElementById(ID);if(old){old.remove();return;}for(const previousId of ['scanner-cloud-v6','scanner-cloud-v5','scanner-cloud-v5-debug']){const prev=document.getElementById(previousId);if(prev)prev.remove()}
const outdated=document.getElementById('x-s');if(outdated)outdated.remove();
const panel=document.createElement('div');panel.id=ID;
panel.style.cssText='position:fixed;top:156px;left:14px;width:290px;max-width:calc(100vw - 28px);z-index:2147483647;font:14px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#f5f6ff;text-align:left;';
const main=document.createElement('div');main.style.cssText='display:flex;align-items:center;gap:5px;touch-action:none;';
const button=document.createElement('button');button.textContent='Разобрать';button.style.cssText='border:0;border-radius:24px;padding:11px 15px;background:#5969df;color:#fff;font:700 15px -apple-system,sans-serif;box-shadow:0 3px 12px #0005;touch-action:none;user-select:none;';
const autoBtn=document.createElement('button');autoBtn.textContent='авто';autoBtn.style.cssText='border:0;border-radius:22px;padding:11px;background:#303443;color:#fff;font:700 14px -apple-system,sans-serif;';
const close=document.createElement('button');close.textContent='×';close.style.cssText='border:0;border-radius:22px;padding:8px 12px;background:#303443;color:#ddd;font:700 20px -apple-system,sans-serif;';
const collapse=document.createElement('button');collapse.type='button';collapse.setAttribute('aria-label','Свернуть панель');collapse.textContent='−';collapse.style.cssText='border:0;border-radius:18px;padding:6px 11px;background:#303443;color:white;font:700 20px -apple-system,sans-serif;';
const mini=document.createElement('button');mini.type='button';mini.setAttribute('aria-label','Развернуть панель');mini.textContent='⌕';mini.style.cssText='display:none;width:46px;height:46px;border:0;border-radius:50%;background:#5969df;color:white;font:700 24px -apple-system,sans-serif;box-shadow:0 3px 12px #0005;touch-action:none;user-select:none;';
main.append(button,autoBtn,collapse,close);
const output=document.createElement('div');output.style.cssText='display:none;max-height:36vh;overflow:auto;padding:12px;margin-top:8px;border:1px solid #505873;border-radius:14px;background:#191d2af8;color:#f6f7ff;box-shadow:0 4px 18px #0008;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.42;';
const status=document.createElement('div');status.style.cssText='color:#bac5e9;font-size:12px;';
const answer=document.createElement('div');answer.style.cssText='font-weight:750;font-size:17px;margin-top:6px;white-space:pre-wrap;';
const reason=document.createElement('div');reason.style.cssText='font-size:13px;color:#d9dfef;white-space:pre-wrap;margin-top:7px;';
const refs=document.createElement('div');refs.style.cssText='font-size:12px;margin-top:8px;';
output.append(status,answer,reason,refs);
panel.append(main,mini,output);document.body.appendChild(panel);
let running=false,automatic=false,controller=null,signature='',drag=false,moved=false,sx=0,sy=0,dx=0,dy=0;
let collapsed=false,outputShown=false,stableSig='',stableHits=0,stableSince=0,lastProcessedSig='',lastRenderedSig='';
const sent=new Set();
function showOutput(){outputShown=true;if(!collapsed)output.style.display='block'}
function fold(to){collapsed=to;main.style.display=to?'none':'flex';mini.style.display=to?'block':'none';output.style.display=!to&&outputShown?'block':'none';panel.style.width=to?'46px':'290px';panel.style.left=Math.max(0,Math.min(innerWidth-(to?46:290),panel.getBoundingClientRect().left))+'px'}
let cache=window.__scannerCloudCache||(window.__scannerCloudCache=new Map());
const setStatus=s=>{status.textContent=s;showOutput()};
function visible(e){const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>5&&r.height>5&&s.display!=='none'&&s.visibility!=='hidden'}
function badgeOptions(root){
  const all=Array.from(root.querySelectorAll('*')).slice(0,2200),by=new Map();
  for(const e of all){if(e.children.length||!visible(e))continue;const text=(e.textContent||'').trim();if(!/^[A-H]$/.test(text))continue;
    const r=e.getBoundingClientRect();if(r.width>100||r.height>75)continue;const key=e.tagName+':'+Math.round(r.width/6)+':'+Math.round(r.height/6);if(!by.has(key))by.set(key,[]);by.get(key).push({label:text,element:e});}
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
function scan(useSelection=false){
  panel.style.display='none';
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
        const before=(rng.toString()||'').trim().replace(/^(?:ЗАПИТАННЯ|ПИТАННЯ|ВОПРОС|QUESTION)\s*\d{1,3}\s*(?:[·-]\s*\d+\s*бал(?:ів|а|ов))?\s*/i,'').trim();
        if(before.length>=8 && before.length<=3200)question=before;
      }catch(_){}
    }
    const context=[document.title,...Array.from(document.querySelectorAll('h1,h2')).slice(0,3).map(x=>(x.innerText||'').trim())].join(' | ').slice(0,260);
    const multiple=/декілька\s+правильних|кілька\s+правильних|всі\s+правильні|несколько\s+правильных|все\s+верные/i.test(root.innerText||'')||opts.some(o=>!!o.node.querySelector('input[type=checkbox],[role=checkbox]'));
    const target=opts.length?root:document.body;
    const elements=Array.from(target.querySelectorAll('img,canvas')).filter(e=>visible(e)&&e.getBoundingClientRect().width>=55&&e.getBoundingClientRect().height>=45).slice(0,7);
    const images=elements.map((element,i)=>({element,label:'Изображение '+(i+1),src:element.currentSrc||element.src||element.getAttribute('data-src')||'', stableSrc:element.getAttribute('data-src')||element.getAttribute('src')||element.currentSrc||element.src||''}));
    for(const o of opts){for(const im of images){if(o.node.contains(im.element))im.label='Вариант '+o.label}}
    const data={question,options:opts.map(o=>o.text||'[изображение]'),multiple,context,images:[]};
    // Fingerprint tracks content, not the loading order of the counter or decorative UI.
    // Stable image source attributes avoid a second scan when currentSrc finishes loading.
    const normalize = value => String(value||'')
      .replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\u00a0/g,' ')
      .replace(/[✓✔☑]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const normalizedQuestion=normalize(question).replace(/^(?:запитання|питання|вопрос|question)\s*№?\s*\d{1,3}\s*(?:[·-]\s*\d+\s*бал(?:ів|а|ов))?\s*/i,'');
    const sig=JSON.stringify([normalizedQuestion,data.options.map(normalize),multiple,
      images.map(x=>[x.stableSrc.replace(/#.*$/,'').trim(),x.label])]);
    return {data,images,sig};
  }finally{panel.style.display=''}
}
function encodeImage(item){return new Promise(resolve=>{
  const el=item.element;
  function draw(img,w,h){try{const scale=Math.min(1,700/Math.max(w,h));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.66);resolve(data.length<480000?{label:item.label,data}:null)}catch(e){resolve(null)}}
  if(el.tagName.toLowerCase()==='canvas'){draw(el,el.width,el.height);return}
  const src=item.src;if(!src){resolve(null);return}
  const img=new Image();img.crossOrigin='anonymous';let done=false;const timeout=setTimeout(()=>{if(!done){done=true;resolve(null)}},1600);
  img.onload=()=>{if(done)return;done=true;clearTimeout(timeout);draw(img,img.naturalWidth||img.width,img.naturalHeight||img.height)};
  img.onerror=()=>{if(done)return;done=true;clearTimeout(timeout);resolve(null)};img.src=src;
})}
function addResult(data){
  answer.textContent=data.answer||'Ответ не найден';
  reason.textContent=(data.explanation||'')+(data.uncertain?'\n\n⚠ Нужна дополнительная проверка.':'');
  status.textContent=(data.verification||'')+(Number.isFinite(data.elapsedMs)?' · '+(data.elapsedMs/1000).toFixed(1)+' с':'');
  refs.replaceChildren();
  if(data.sources?.length){const h=document.createElement('div');h.textContent='Материалы для проверки:';refs.appendChild(h);for(const s of data.sources){if(!/^https:\/\/(?:[a-z-]+\.wikipedia\.org|www\.wikidata\.org)\//.test(s.url))continue;const a=document.createElement('a');a.href=s.url;a.textContent=s.name;a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='display:block;margin-top:5px;color:#a7b5ff;text-decoration:underline;';refs.appendChild(a)}}
  if(data.models?.length){const d=document.createElement('div');d.style.cssText='margin-top:8px;color:#9ca9c7';d.textContent=data.models.map(m=>m.name+': '+(m.status==='ok'?'✓':'×')).join(' · ');refs.appendChild(d)}
}
async function run(force=false,mode='manual',sample=null){
  if(running){if(mode==='manual')controller?.abort();return}
  let scanned;
  try{scanned=sample||scan(mode==='manual')}catch(e){setStatus('Не удалось прочитать страницу');reason.textContent=e.message||String(e);return}
  const {data,images,sig}=scanned;
  if(!data.question||data.question.length<5){setStatus('Не вижу вопрос');reason.textContent='Выдели текст вопроса и повтори.';return}
  signature=sig;
  // The same question is never charged twice automatically, including after a failed call.
  if(mode==='auto'&&sent.has(sig)){
    if(cache.has(sig)&&lastRenderedSig!==sig){addResult(cache.get(sig));showOutput();lastRenderedSig=sig}
    return;
  }
  if(!force&&cache.has(sig)){
    sent.add(sig);lastProcessedSig=sig;lastRenderedSig=sig;addResult(cache.get(sig));showOutput();return;
  }
  sent.add(sig);lastProcessedSig=sig;
  if(sent.size>100)sent.delete(sent.values().next().value);
  running=true;controller=new AbortController();showOutput();answer.textContent='';reason.textContent='';refs.replaceChildren();setStatus('Читаю вопрос…');button.textContent='Стоп';
  const begin=Date.now();const signal=controller.signal;
  const timer=setInterval(()=>{if(running)status.textContent='Проверка · '+((Date.now()-begin)/1000).toFixed(1)+' с'},500);
  try{
    const all=await Promise.all(images.slice(0,3).map(encodeImage));
    if(signal.aborted)throw Object.assign(new Error('Отменено'),{name:'AbortError'});
    data.images=all.filter(Boolean);
    const res=await fetch(API+'/solve',{method:'POST',mode:'cors',headers:{'Content-Type':'application/json','x-scanner-token':TOKEN},body:JSON.stringify(data),signal});
    const response=await res.json().catch(()=>({error:'Сервер вернул некорректный ответ'}));
    if(!res.ok){const details=Array.isArray(response.models)?response.models.map(m=>m.name+': '+(m.error||m.status||'неизвестная ошибка')).join('\n'):'';throw new Error((response.error||'HTTP '+res.status)+(details?'\n\nДиагностика API:\n'+details:''))}
    if(images.length&&data.images.length===0)response.uncertain=true;
    if(Array.isArray(response.choices)){
      const valid=new Set(data.options.map((_,i)=>'ABCDEFGH'[i]));
      if(response.choices.some(x=>!valid.has(x))||(!data.multiple&&response.choices.length>1))throw new Error('Сервер вернул несовместимые варианты ответа');
    }
    // Rendering the answer must not interpret a single transient DOM mutation as a new question.
    cache.set(sig,response);if(cache.size>45)cache.delete(cache.keys().next().value);
    mini.textContent=response.uncertain?'?':'✓';
    let latest=automatic?scan(false).sig:sig;
    if(latest!==sig){
      await new Promise(resolve=>setTimeout(resolve,320));
      if(!signal.aborted)latest=scan(false).sig;
    }
    if(latest===sig){addResult(response);showOutput();lastRenderedSig=sig}
    else{status.textContent='Страница меняется. Ожидаю стабильный вопрос…';}

  }catch(e){
    setStatus(e.name==='AbortError'?'Остановлено':'Ошибка');
    if(e.name!=='AbortError'){reason.textContent=e.message||String(e);mini.textContent='!'}
  }finally{clearInterval(timer);button.textContent='Разобрать';running=false;controller=null}
}
function draggable(handle){
  handle.addEventListener('pointerdown',e=>{drag=true;moved=false;sx=e.clientX;sy=e.clientY;const r=panel.getBoundingClientRect();dx=r.left;dy=r.top;try{handle.setPointerCapture(e.pointerId)}catch(_){} });
  handle.addEventListener('pointermove',e=>{if(!drag)return;const xx=e.clientX-sx,yy=e.clientY-sy;if(!moved&&Math.abs(xx)+Math.abs(yy)<9)return;moved=true;panel.style.left=Math.max(0,Math.min(innerWidth-(collapsed?46:290),dx+xx))+'px';panel.style.top=Math.max(0,Math.min(innerHeight-48,dy+yy))+'px'});
  handle.addEventListener('pointerup',()=>{drag=false});handle.addEventListener('pointercancel',()=>{drag=false});
}
draggable(button);draggable(mini);
button.addEventListener('click',()=>{if(moved){moved=false;return}run(false,'manual')});
mini.addEventListener('click',()=>{if(moved){moved=false;return}fold(false)});
button.addEventListener('contextmenu',e=>{e.preventDefault();run(true,'manual')});
collapse.addEventListener('click',()=>fold(true));
close.addEventListener('click',()=>{automatic=false;controller?.abort();panel.remove()});
autoBtn.addEventListener('click',()=>{automatic=!automatic;autoBtn.textContent=automatic?'авто ✓':'авто';autoBtn.style.background=automatic?'#278d61':'#303443';stableSig='';stableHits=0;stableSince=0});
// Two stable observations of the same completed question before doing any auto request.
// Button clicks, checkbox selection, and progress animations won't repeatedly trigger a request.
const poll=setInterval(()=>{
  if(!document.body.contains(panel)){clearInterval(poll);return}
  if(!automatic||running||document.visibilityState==='hidden')return;
  let sample;try{sample=scan(false)}catch(_){return}
  if(!sample.data.question||sample.data.question.length<5)return;
  if(sample.sig!==stableSig){stableSig=sample.sig;stableHits=1;stableSince=Date.now();return}
  stableHits++;
  if(stableHits<2||Date.now()-stableSince<800||sample.sig===lastProcessedSig)return;
  if(sent.has(sample.sig)&&!cache.has(sample.sig)){lastProcessedSig=sample.sig;return}
  run(false,'auto',sample);
},950);
})();