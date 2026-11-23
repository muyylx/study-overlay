// APINex-only solving for individual participant keys. Never use owner credentials.
const BASE='https://api.apinex.bond/v1';
const DEFAULTS=Object.freeze({quick:'free/glm-5.3-flashx',strong:'free/qwen-3.8-max',vision:'free/gemini-3.8-flash',review:'free/deepseek-v4.1-flash'});
const FEATURES=Object.freeze({quick:true,strong:true,vision:true,review:true,sources:true});
export function validProvider(name){return name==='apinex'}
export function safeModel(x,provider='apinex'){const name=String(x||'').trim();return provider==='apinex'&&name.length>=3&&name.length<=105&&!name.includes('..')&&!name.startsWith('/')&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(name)?name:null}
export function aiConfig(raw){let x=raw;try{if(typeof x==='string')x=JSON.parse(x||'{}')}catch{x={}}if(!x||typeof x!=='object')x={};const roles={};for(const k of Object.keys(DEFAULTS))roles[k]=safeModel(x.roles?.[k])||DEFAULTS[k];const flags={};for(const k of Object.keys(FEATURES))flags[k]=typeof x.flags?.[k]==='boolean'?x.flags[k]:FEATURES[k];return {roles,flags}}
export function validateAiConfig(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const roles={};const flags={};if(!raw.roles||typeof raw.roles!=='object'||!raw.flags||typeof raw.flags!=='object')return null;for(const k of Object.keys(DEFAULTS)){if(!safeModel(raw.roles[k]))return null;roles[k]=raw.roles[k]}for(const k of Object.keys(FEATURES)){if(typeof raw.flags[k]!=='boolean')return null;flags[k]=raw.flags[k]}if(!Object.values(flags).some(Boolean))return null;return{roles,flags}}
// ---- 3.110: fast, honest solver for participants (personal APINex key only) ----
function bad(msg,status=400,http=0){return Object.assign(Error(msg),{status,http})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jsonFetch(url,opts={},timeout=12500,outer=null){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 const onAbort=()=>c.abort();
 if(outer){if(outer.aborted)c.abort();else outer.addEventListener('abort',onAbort,{once:true})}
 try{
  const res=await fetch(url,{...opts,signal:c.signal,redirect:'manual'});
  if(!res.ok)throw bad('APINex HTTP '+res.status,res.status===429?429:res.status===401||res.status===403?403:502,res.status);
  const tx=await res.text();
  if(tx.length>350000)throw bad('Слишком длинный ответ API',502);
  return JSON.parse(tx);
 }catch(e){
  if(e.name==='AbortError')throw bad(outer?.aborted?'Запрос отменён':'Модель не ответила вовремя',504);
  throw e;
 }finally{clearTimeout(t);if(outer)outer.removeEventListener('abort',onAbort)}
}
const VISION_RE=/gemini|vision|\/vl|qwen.*vl|claude.*sonnet|claude.*opus|gpt-6|kimi-k3/i;
export async function listPersonalModels(apiKey,timeout=9000){
 const j=await jsonFetch(BASE+'/models',{headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'}},timeout);
 const ds=Array.isArray(j.data)?j.data:Array.isArray(j.models)?j.models:[];
 const dedup=new Map();
 for(const m of ds){
  const id=safeModel(m.id||m.name);
  if(!id||/(?:^|[/_-])(image-generation|embedding|tts|speech|transcription|audio|video)(?:$|[/_-])/i.test(id))continue;
  const vision=Boolean(m.supports_vision||m.vision||m.architecture?.input_modalities?.includes('image')||m.input_modalities?.includes('image')||VISION_RE.test(id));
  dedup.set(id,{id,vision,free:id.startsWith('free/')});
 }
 return [...dedup.values()].sort((a,b)=>a.id.localeCompare(b.id)).slice(0,100);
}
const IMG_DATA=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]{200,700000}$/;
const IMG_URL=/^https:\/\/(?!(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0))[^\s"'<>\\]{8,1400}$/i;
function normalize(raw){
 const q=String(raw?.question||'').replace(/\s+/g,' ').trim().slice(0,3300);
 if(q.length<6)throw bad('Вопрос не распознан');
 const options=Array.isArray(raw.options)?raw.options.slice(0,8).map(s=>String(s||'').replace(/\s+/g,' ').slice(0,350)):[];
 const images=[];
 for(const x of (Array.isArray(raw.images)?raw.images.slice(0,10):[])){
  if(!x||typeof x!=='object')continue;
  const label=String(x.label||'Рисунок').slice(0,100);
  if(typeof x.data==='string'&&IMG_DATA.test(x.data))images.push({label,data:x.data});
  else if(typeof x.url==='string'&&IMG_URL.test(x.url))images.push({label,url:x.url});
  if(images.length>=8)break;
 }
 const imageCandidates=Math.min(12,Math.max(images.length,Number(raw.imageCandidates)||0));
 return{question:q,options,context:String(raw.context||'').slice(0,300),multiple:!!raw.multiple,images,imageCandidates};
}
const LETTERS='ABCDEFGH';
function system(q,hasImages){
 const open=!q.options.length;
 return 'Ты опытный учитель и строгий проверяющий тестов. Отвечай на языке вопроса. '
  +'Особое внимание: отрицания («не», «крім», «окрім», «кроме», «неправильно»), точные даты, имена, термины, единицы измерения, слова «все/всі/ни один/жодного». '
  +'В вопросах по истории и литературе не путай разные события и разных людей (основание, первое выступление, переименование, автор и персонаж). '
  +(hasImages?'Сначала внимательно рассмотри каждое изображение и перепиши в поле reading весь видимый текст, числа, подписи, оси и обозначения. Изображения подписаны («Вариант A», «Рисунок к вопросу»), не путай их. ':'')
  +'Потом в поле reasoning кратко (до 60 слов) разбери варианты и исключи неверные, и только после этого дай ответ. Не выдумывай факты. '
  +'Верни СТРОГО один JSON без markdown: '
  +(open?'{"reading":"","reasoning":"","answer":"короткий ответ","uncertain":false,"explanation":"1-2 предложения"}. '
        :'{"reading":"","reasoning":"","choices":["A"],"uncertain":false,"explanation":"1-2 предложения"}. ')
  +(open?'':q.multiple?'Верных вариантов может быть несколько. ':'Выбери ровно один вариант. ')
  +'Если данных действительно недостаточно, uncertain=true'+(open?'.':' и choices=[].');
}
function userPrompt(q,more='',plain=false){
 const opts=q.options.map((x,i)=>LETTERS[i]+') '+(/^\[(?:изображение|зображення|малюнок|рисунок|image|picture)\]$/i.test(x.trim())||!x.trim()?'(смотри изображение «Вариант '+LETTERS[i]+'»)':x)).join('\n');
 return (q.context?'Контекст страницы: '+q.context+'\n':'')+'Вопрос: '+q.question+(opts?'\n'+opts:'')
  +'\nТип: '+(q.multiple?'несколько верных':'один верный')
  +(q.imageCandidates?'\nНа странице изображений: '+q.imageCandidates+', передано: '+q.images.length+'. Если нужное изображение не видно, прямо скажи об этом (uncertain=true).':'')
  +(more?'\n\n'+more:'')
  +(plain?'\n\nОтветь ТОЛЬКО буквой правильного варианта'+(q.multiple?' (или буквами через запятую)':'')+', без пояснений.':'');
}
function parseModel(raw,q){
 const txt=String(raw||'').trim();
 let d=null;
 for(const t of [txt.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''),(txt.match(/\{[\s\S]*\}/)||[''])[0]]){
  try{const v=JSON.parse(t);if(v&&typeof v==='object'&&!Array.isArray(v)){d=v;break}}catch{}
 }
 const valid=LETTERS.slice(0,q.options.length);
 let choices=[];
 if(d){choices=Array.isArray(d.choices)?d.choices:typeof d.choices==='string'?d.choices.split(/[,\s;]+/):[]}
 else if(q.options.length){
  const m=txt.match(/(?:ответ|відповідь|answer|choices?)\s*[:\-]?\s*\[?\s*["']?([A-H](?:\s*[,;]\s*[A-H])*)/i)||txt.match(/^\s*([A-H](?:\s*[,;]\s*[A-H])*)\s*(?:[).:\-]|$)/i);
  if(!m)return null;
  choices=m[1].split(/[,;\s]+/);d={uncertain:true,explanation:'Модель ответила не в формате JSON, результат требует проверки.'};
 }else return null;
 choices=[...new Set(choices.map(x=>String(x).toUpperCase().trim()).filter(x=>valid.includes(x)))].sort();
 let uncertain=!!d.uncertain;
 if(!choices.length&&q.options.length&&typeof d.answer==='string'){
  const a=d.answer.toLowerCase().trim();const i=q.options.findIndex(o=>o.toLowerCase().trim()===a);if(i>=0)choices=[valid[i]];
 }
 if(!q.multiple&&choices.length>1){choices=choices.slice(0,1);uncertain=true}
 if(q.options.length&&!choices.length&&!uncertain)return null;
 const answer=choices.length?choices.map(c=>c+') '+q.options[LETTERS.indexOf(c)]).join('\n'):String(d.answer||'').slice(0,450);
 if(!q.options.length&&!answer&&!uncertain)return null;
 return{choices,answer,uncertain,explanation:String(d.explanation||d.reasoning||'').slice(0,700),reading:String(d.reading||'').slice(0,500),reasoning:String(d.reasoning||'').slice(0,500)};
}
async function requestModel(key,model,q,o){
 if(!safeModel(model))throw bad('Недопустимая модель');
 const withImages=!!o.images&&q.images.length>0;
 const text=userPrompt(q,o.more,o.plain);
 const content=withImages?[{type:'text',text},...q.images.flatMap(x=>[{type:'text',text:x.label},{type:'image_url',image_url:{url:x.data||x.url,detail:'high'}}])]:text;
 const sys=o.plain?'Ты преподаватель. Отвечай только буквой правильного варианта.':system(q,withImages);
 const j=await jsonFetch(BASE+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({model,messages:[{role:'system',content:sys},{role:'user',content}],temperature:0,max_tokens:o.maxTokens||750})},o.timeout,o.signal);
 let raw=j.choices?.[0]?.message?.content||'';
 if(Array.isArray(raw))raw=raw.map(x=>x.text||'').join('');
 const parsed=parseModel(raw,q);
 if(!parsed)throw bad('Модель вернула непроверяемый формат',502);
 return parsed;
}
// ---- reference material (Wikipedia RU/UK/EN): hints for the reviewer only, never proof ----
const STOP=new Set(['вопрос','питання','запитання','укажи','укажіть','оберіть','позначте','какой','який','яка','яке','коли','когда','почему','чому','правильні','правильные','ответы','відповіді','варіанти','вариант','назва','название']);
function keyTerms(q){
 const text=q.question;
 const caps=[...new Set(text.match(/\p{Lu}[\p{L}'’-]{2,}/gu)||[])].filter(w=>!STOP.has(w.toLowerCase()));
 const nums=[...new Set(text.match(/\b\d{3,4}\b/g)||[])];
 const long=[...new Set(text.toLowerCase().match(/\p{L}{6,}/gu)||[])].filter(w=>!STOP.has(w)&&!caps.some(c=>c.toLowerCase()===w));
 return[...caps.slice(0,4),...nums.slice(0,1),...long.slice(0,3)].slice(0,6);
}
async function sources(q,signal){
 const terms=keyTerms(q);if(!terms.length)return[];
 const search=terms.join(' ').slice(0,110);
 const rows=await Promise.allSettled(['uk','ru','en'].map(async lang=>{
  const api='https://'+lang+'.wikipedia.org/w/api.php';
  const s=await jsonFetch(api+'?'+new URLSearchParams({action:'query',list:'search',srsearch:search,srlimit:'1',format:'json',origin:'*'}),{},1600,signal);
  const title=s.query?.search?.[0]?.title;if(!title)return null;
  const j=await jsonFetch(api+'?'+new URLSearchParams({action:'query',prop:'extracts',explaintext:'1',exintro:'1',exchars:'700',titles:title,format:'json',origin:'*'}),{},1800,signal);
  const page=Object.values(j.query?.pages||{})[0];
  const extract=String(page?.extract||'').replace(/\s+/g,' ').slice(0,700);
  if(extract.length<40)return null;
  return{title:'Wikipedia '+lang.toUpperCase()+': '+title,extract,url:'https://'+lang+'.wikipedia.org/wiki/'+encodeURIComponent(title.replace(/ /g,'_'))};
 }));
 return rows.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
}
export async function solveWithPersonalKey(provider,legacyModel,key,raw,configRaw){
 if(!validProvider(provider))throw bad('Участникам доступен только APINex');
 const q=normalize(raw),config=aiConfig(configRaw);
 if(safeModel(legacyModel)&&!configRaw)config.roles.quick=legacyModel;
 const t0=Date.now(),hasVisual=q.imageCandidates>0,open=!q.options.length;
 const BUDGET=hasVisual?17000:8200;
 const master=new AbortController(),killer=setTimeout(()=>master.abort(),BUDGET+300);
 const left=()=>BUDGET-(Date.now()-t0);
 try{
  if(hasVisual&&!q.images.length)return{answer:'Изображение не удалось прочитать',choices:[],uncertain:true,confidence:'low',explanation:'Вопрос содержит изображение, но браузер не смог его передать. Попробуй прикрепить скриншот или открой изображение отдельно.',verification:'Нет визуальных данных',imageAnalysis:{detected:q.imageCandidates,transmitted:0,used:false},models:[]};
  if(hasVisual&&!config.flags.vision)return{answer:'Анализ изображений отключён',choices:[],uncertain:true,confidence:'low',explanation:'Администратор отключил Vision для этого аккаунта.',verification:'Vision отключён',models:[]};
  const events=[],done=[],inflight=new Map();
  const run=(role,model,o={})=>{
   const id=model+(o.images?'|v':'|t')+(o.plain?'|p':'');
   if(inflight.has(id))return inflight.get(id);
   const p=(async()=>{
    const begin=Date.now();
    for(let attempt=0;attempt<2;attempt++){
     const timeout=Math.min(o.timeout||6500,left()-150);
     if(timeout<1200){events.push({role,model,status:'skipped',message:'не хватило времени'});return null}
     try{
      const result=await requestModel(key,model,q,{more:o.more,images:!!o.images,timeout,signal:master.signal,maxTokens:o.maxTokens,plain:o.plain});
      const row={role,model,result,vis:!!o.images,ms:Date.now()-begin};done.push(row);events.push({role,model,status:'ok',choices:result.choices,ms:row.ms});return row;
     }catch(e){
      if(attempt===0&&Number(e.http||0)>=500&&left()>3500&&!master.signal.aborted){await sleep(250);continue}
      events.push({role,model,status:'error',code:Number(e.status||0),message:String(e.message||'Ошибка').slice(0,90),ms:Date.now()-begin});return null;
     }
    }
    return null;
   })();
   inflight.set(id,p);return p;
  };
  const usable=row=>!!row&&!!row.result&&(open?!!row.result.answer:row.result.choices.length>0);
  const hard=row=>usable(row)&&!row.result.uncertain;
  const gather=(prs,fallbackMs)=>new Promise(resolve=>{
   let pending=prs.length,timer=null,end=null;
   const finish=()=>{clearTimeout(timer);clearTimeout(end);resolve()};
   if(!pending)return finish();
   end=setTimeout(finish,Math.max(300,fallbackMs));
   for(const p of prs)p.then(row=>{
    pending--;
    if(hard(row)&&(!hasVisual||row.vis)&&!timer)timer=setTimeout(finish,Math.min(3000,Math.max(1500,(row.ms||1000)*1.5)));
    if(pending===0)finish();
   });
  });
  const evidenceP=config.flags.sources?sources(q,master.signal).catch(()=>[]):Promise.resolve([]);
  const modelsP=hasVisual?listPersonalModels(key,5000).catch(()=>[]):null;
  const key_=r=>open?String(r.answer||'').trim().toLowerCase():r.choices.join(',');
  const consensus=(rows)=>{
   const ok=rows.filter(r=>usable(r)&&!r.result.uncertain);
   const tally=new Map();for(const r of ok){const k=key_(r.result);tally.set(k,[...(tally.get(k)||[]),r])}
   const groups=[...tally.values()].sort((a,b)=>b.length-a.length);
   return{ok,groups,agreed:groups.length===1&&ok.length>=2,disputed:groups.length>1};
  };
  const prio={strong:3,review:3,vision:3,vision2:2,quick:2,'vision-reserve':1,text:0,rescue:0};
  const pick=rows=>rows.slice().sort((a,b)=>(prio[b.role]||0)-(prio[a.role]||0))[0];
  const initial=[];
  if(hasVisual){
   initial.push(run('vision',config.roles.vision,{images:true,timeout:11000,maxTokens:900}));
   if(config.flags.strong&&config.roles.strong!==config.roles.vision&&VISION_RE.test(config.roles.strong))initial.push(run('vision2',config.roles.strong,{images:true,timeout:11000,maxTokens:900}));
   if(config.flags.quick)initial.push(run('text',config.roles.quick,{timeout:5500,maxTokens:600}));
  }else{
   if(config.flags.quick)initial.push(run('quick',config.roles.quick,{timeout:5500,maxTokens:650}));
   if(config.flags.strong)initial.push(run('strong',config.roles.strong,{timeout:6500,maxTokens:750}));
   if(!initial.length)initial.push(run('quick',config.roles.quick,{timeout:5500,maxTokens:650}));
  }
  await gather(initial,left()-1200);
  const scope=()=>hasVisual?done.filter(r=>r.vis):done;
  // vision rescue: if no usable visual answer, try another vision-capable model from the account list
  if(hasVisual&&!scope().some(usable)&&left()>4500&&!events.some(e=>e.status==='error'&&(e.code===403||e.code===429))){
   const alt=(await modelsP).find(m=>m.free&&m.vision&&![config.roles.vision,config.roles.strong].includes(m.id));
   if(alt)await run('vision-reserve',alt.id,{images:true,timeout:Math.min(8000,left()-200),maxTokens:800});
  }
  let state=consensus(scope());
  const needReview=config.flags.review&&left()>2400&&!events.some(e=>e.status==='error'&&(e.code===403||e.code===429))&&(state.disputed||!state.ok.length);
  let reviewed=false;
  if(needReview){
   const refs=await Promise.race([evidenceP,sleep(800).then(()=>[])]);
   const prev=done.filter(usable).map(r=>r.role+' ('+r.model+'): '+r.result.answer.replace(/\n/g,' ')+'; аргумент: '+(r.result.reasoning||r.result.explanation)).join('\n').slice(0,1800);
   const src=refs.map(x=>x.title+' | '+x.extract).join('\n').slice(0,2000);
   const canSee=hasVisual&&VISION_RE.test(config.roles.review);
   const more='Независимая проверка. Предыдущие выводы могут быть ошибочными и не считаются доказательством. Реши вопрос сам с нуля, затем сверь с ними и дай ОДИН обоснованный вывод:\n'+(prev||'Предыдущих выводов нет.')+'\nСправочные материалы (подсказка, не доказательство):\n'+(src||'нет')+(hasVisual?(canSee?'\nПроверь изображения заново.':'\nТы НЕ видишь изображения, оценивай только аргументы и не утверждай о визуальной проверке.'):'');
   await run('review',config.roles.review,{more,images:canSee,timeout:Math.min(5500,left()-200),maxTokens:850});
   reviewed=true;
  }
  const review=done.find(r=>r.role==='review'&&usable(r));
  let rescued=false;
  if(!done.some(usable)&&!open&&left()>2300){
   await run('rescue',config.roles.quick,{plain:true,images:false,timeout:Math.min(4000,left()-150),maxTokens:40});
   rescued=done.some(r=>r.role==='rescue'&&usable(r));
  }
  state=consensus(scope());
  let best=null,confidence='low',verification='';
  if(review&&usable(review)&&!review.result.uncertain){best=review;confidence=state.disputed||!state.ok.length?'medium':'high';verification=state.disputed?'Спор моделей решён дополнительной проверкой (предположение)':'Подтверждено дополнительной проверкой моделью-арбитром'}
  else if(state.agreed){best=pick(state.groups[0]);confidence='high';verification='Модели согласны (это не доказательство факта)'}
  else if(state.ok.length===1){best=state.ok[0];confidence='medium';verification='Ответ одной модели; вторая не успела или не ответила'}
  else if(state.disputed){best=pick(state.groups[0].length>1?state.groups[0]:state.ok);confidence='low';verification='Модели расходятся, подтверждения нет'}
  else{
   best=scope().find(usable)||done.find(usable)||null;
   if(best){confidence='low';verification=rescued&&best.role==='rescue'?'Упрощённый запрос: ответ предварительный':hasVisual&&!best.vis?'Ответ без анализа изображения':'Ответ с оговоркой модели'}
  }
  const refs=await Promise.race([evidenceP,sleep(250).then(()=>[])]);
  const missing=Math.max(0,q.imageCandidates-q.images.length);
  const textOnly=hasVisual&&best&&!best.vis;
  let uncertain=!best||best.result.uncertain||confidence==='low'||missing>0||textOnly;
  if(missing>0&&confidence==='high')confidence='medium';
  const base=best?.result;
  let explanation=base?.explanation||(best?'':'Модели не дали проверяемого вывода. '+events.filter(e=>e.status==='error').slice(0,3).map(e=>e.message).join('; '));
  if(missing>0)explanation+=(explanation?'\n':'')+'Часть изображений не прочитана ('+missing+').';
  if(textOnly)explanation+=(explanation?'\n':'')+'Изображение не было проанализировано.';
  return{
   answer:base?.answer||'Нельзя обоснованно определить ответ',
   choices:base?.choices||[],
   explanation,uncertain,confidence,
   provider:'apinex',model:best?.model||'',
   verification:best?verification:'Ответ не получен',
   models:events,
   sources:refs.map(x=>({name:x.title,url:x.url})),
   imageAnalysis:{detected:q.imageCandidates,transmitted:q.images.length,used:hasVisual&&done.some(r=>r.vis&&usable(r))},
   timing:{totalMs:Date.now()-t0,budgetMs:BUDGET,reviewed},
  };
 }finally{clearTimeout(killer);master.abort()}
}
