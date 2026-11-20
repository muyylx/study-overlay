// Scanner Cloud 5.2. (Verified vision-first routing, bounded evidence latency) Provider secrets exist only as Cloudflare Worker bindings.
// This is a learning assistant. It never clicks, fills in, or submits an online test.
const MAX_BODY = 3_200_000;
const ALLOWED_LETTERS = 'ABCDEFGH';
const PROVIDERS = [
  { id: 'groq', key: 'GROQ_KEY', model: 'llama-3.3-70b-versatile', base: 'https://api.groq.com/openai/v1', vision: false },
  { id: 'gemini', key: 'GEMINI_KEY', model: 'gemini-3.1-flash-lite', base: 'https://generativelanguage.googleapis.com/v1beta', vision: true },
  { id: 'apinex', key: 'APINEX_API_KEY', model: 'free/glm-5.3-flashx', base: 'https://api.apinex.bond/v1', vision: false },
  { id: 'openrouter', key: 'OPENROUTER_KEY', model: 'openai/gpt-oss-20b:free', base: 'https://openrouter.ai/api/v1', vision: false },
  { id: 'apinex-vision', key: 'APINEX_API_KEY', model: 'free/gemini-3.8-flash', base: 'https://api.apinex.bond/v1', vision: true },
  { id: 'apinex-vision-check', key: 'APINEX_API_KEY', model: 'free/deepseek-v4.1-flash', base: 'https://api.apinex.bond/v1', vision: true }
];
const RULES = 'Ты образовательный помощник. Анализируй вопрос школьной программы Украины на исходном языке. Независимо проверь все варианты, отрицания, хронологию, единицы и подсчёты. Никогда не додумывай недостающие сведения. Если вопрос неясен или изображения недоступны, прямо укажи неопределённость. Верни ТОЛЬКО JSON: {"choices":["A"],"explanation":"краткое проверяемое объяснение на языке вопроса","uncertain":false}. Если вариантов нет, верни {"answer":"краткий ответ","explanation":"обоснование","uncertain":false}. Не утверждай, что сверялся с источником, если источник не был предоставлен.';
function cors(origin) { return { 'access-control-allow-origin':'*', 'access-control-allow-methods':'POST, GET, OPTIONS', 'access-control-allow-headers':'content-type,x-scanner-token', 'access-control-max-age':'7200', 'vary':'Origin', 'cache-control':'no-store' }; }
function reply(data, status=200, origin='') { return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json;charset=utf-8'}}); }
async function sameSecret(input,secret) {
  if (typeof input !== 'string' || !secret || input.length > 200) return false;
  const enc=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(input)),crypto.subtle.digest('SHA-256',enc.encode(secret))]);
  const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
function asText(x,n=1600) { return String(x||'').slice(0,n).trim(); }
function normalize(obj) {
  const q=asText(obj.question,4000);
  const multiple=!!obj.multiple;
  const options=Array.isArray(obj.options)?obj.options.slice(0,8).map((x,i)=>({label:ALLOWED_LETTERS[i],text:asText(typeof x==='string'?x:x?.text,500)})):[];
  const context=asText(obj.context,300);
  const images=Array.isArray(obj.images)?obj.images.slice(0,5).filter(x=>x&&typeof x.data==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x.data)&&x.data.length<530000).map(x=>({label:asText(x.label,50),data:x.data})):[];
  return {q,options,multiple,context,images};
}
function prompt(q,doc='') {
 const opt=q.options.length?q.options.map(x=>`${x.label}) ${x.text||'[изображение]'}`).join('\n'):'Вариантов ответа нет';
 return `ТЕМА: ${q.context}\nВОПРОС: ${q.q}\nВАРИАНТЫ:\n${opt}\nТИП: ${q.multiple?'несколько вариантов':'один вариант или открытый ответ'}${q.images.length?'\nК сообщению прикреплены изображения с подписями.':''}${doc?'\n\nВОЗМОЖНО ПОЛЕЗНЫЕ ПУБЛИЧНЫЕ МАТЕРИАЛЫ (не принимай за доказательство без проверки):\n'+doc:''}`;
}
function parse(raw,q) {
 const clean=String(raw||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
 let x;try{x=JSON.parse(clean)}catch(_){try{x=JSON.parse(clean.slice(clean.indexOf('{'),clean.lastIndexOf('}')+1))}catch(_){return null}}
 if(!x||typeof x!=='object')return null;
 if(q.options.length) {
   const valid=new Set(q.options.map(o=>o.label));let a=Array.isArray(x.choices)?x.choices:typeof x.choices==='string'?x.choices.split(/[,;\s]+/):[];
   a=[...new Set(a.map(s=>String(s||'').toUpperCase().trim()).filter(v=>valid.has(v)))];
   if(!q.multiple && a.length!==1)return null;
   if(!a.length)return null;
   return {choices:a.sort(),answer:a.map(z=>`${z}) ${q.options.find(o=>o.label===z).text||'[изображение]'}`).join('\n'),explanation:asText(x.explanation,550),uncertain:!!x.uncertain};
 }
 const ans=asText(x.answer,350);
 return ans?{choices:[],answer:ans,explanation:asText(x.explanation,550),uncertain:!!x.uncertain}:null;
}
async function timedFetch(url,options,ms=11000){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort('timeout'),ms);try{const r=await fetch(url,{...options,signal:ctrl.signal,redirect:'manual'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.text();if(data.length>300000)throw new Error('Ответ слишком большой');return JSON.parse(data)}finally{clearTimeout(timer)}}
async function ai(p,env,q,doc='') {
 if(!env[p.key])throw new Error('Ключ '+p.id+' не настроен');
 const withImages=Boolean(q.images.length&&p.vision);
 const user=prompt(q,doc);
 let json;
 if(p.id==='gemini'){
   const parts=[{text:user}];if(withImages)for(const x of q.images){const mt=x.data.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);if(mt)parts.push({text:x.label||'Изображение'},{inlineData:{mimeType:mt[1],data:mt[2]}})}
   json=await timedFetch(`${p.base}/models/${encodeURIComponent(p.model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env[p.key]},body:JSON.stringify({systemInstruction:{parts:[{text:RULES}]},contents:[{role:'user',parts}],generationConfig:{temperature:0.05,maxOutputTokens:1050,responseMimeType:'application/json'}})},12000);
   const text=(json.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');return parse(text,q);
 }
 const content=withImages?[{type:'text',text:user},...q.images.flatMap(i=>[{type:'text',text:i.label},{type:'image_url',image_url:{url:i.data}}])]:user;
 json=await timedFetch(`${p.base}/chat/completions`,{method:'POST',headers:{Authorization:'Bearer '+env[p.key],'Content-Type':'application/json'},body:JSON.stringify({model:p.model,messages:[{role:'system',content:RULES},{role:'user',content}],temperature:0.1,max_tokens:900})},12000);
 let text=json.choices?.[0]?.message?.content||'';if(Array.isArray(text))text=text.map(p=>p.text||'').join('');return parse(text,q);
}
function terms(s){const stop=new Set(['який','яка','яке','які','коли','кого','що','хто','для','про','цей','яким','якою','скільки','правильна','відповідь','назвіть','оберіть','укажіть','питання','вопрос','какой','какая','какие','когда','почему','который','выберите','ответ','ответы','между','the','which','what','when','where','with','from','this']);return [...new Set((String(s).toLowerCase().match(/[\p{L}\d-]{4,}/gu)||[]).filter(s=>!stop.has(s)))].slice(0,9)}
async function wikipedia(lang,search){
 const api=`https://${lang}.wikipedia.org/w/api.php`;
 const found=await timedFetch(api+'?'+new URLSearchParams({action:'query',list:'search',srsearch:search,srlimit:'2',format:'json'}),{},2600);
 const titles=(found.query?.search||[]).map(s=>s.title);if(!titles.length)return null;
 const page=await timedFetch(api+'?'+new URLSearchParams({action:'query',prop:'extracts',exintro:'1',explaintext:'1',exsentences:'5',titles:titles[0],format:'json'}),{},2600);
 const x=Object.values(page.query?.pages||{})[0];const text=asText(x?.extract,1300);
 if(text.length<70)return null;
 return {name:`Wikipedia (${lang}): ${titles[0]}`,url:`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(titles[0].replace(/ /g,'_'))}`,extract:text};
}
async function wikidata(search){
 const data=await timedFetch('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',search,language:'uk',uselang:'uk',limit:'2',format:'json'}),{},2500);
 const item=data.search?.[0];if(!item)return null;
 return {name:'Wikidata: '+asText(item.label,120),url:'https://www.wikidata.org/wiki/'+item.id,extract:asText(item.description,250)};
}
async function sources(q){
 const keys=terms(q.context+' '+q.q);const search=keys.slice(0,5).join(' ').slice(0,90);
 if(!search)return [];
 const p=[wikipedia('uk',search),wikipedia('en',search),wikipedia('ru',search),wikidata(keys.slice(0,3).join(' '))];
 const settled=await Promise.allSettled(p);
 const all=settled.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
 const relevant=all.filter(x=>{
   const doc=terms(x.name+' '+x.extract);return keys.some(k=>doc.some(z=>z===k||z.startsWith(k.slice(0,5))));
 });return relevant.slice(0,3);
}
function report(rows,q,src) {
 const good=rows.filter(x=>x.result);if(!good.length)return null;
 const key=x=>q.options.length?x.choices.join(','):x.answer.toLocaleLowerCase();
 const groups=new Map();for(const row of good){const k=key(row.result);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row)}
 const rank=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);const win=rank[0][1][0].result;
 const agreement=rank[0][1].length;const disputed=rank.length>1;
 return {answer:win.answer,choices:win.choices,explanation:win.explanation,uncertain:win.uncertain||disputed||good.length===1,verification:disputed?'Модели разошлись, требуется дополнительная проверка':good.length>=2?'Совпадение '+agreement+' из '+good.length+' моделей':'Ответ одной модели, не подтверждён',models:rows.map(x=>({name:x.name,status:x.result?'ok':x.error||'не дал ответа',choices:x.result?.choices||[]})),sources:src.map(x=>({name:x.name,url:x.url,extract:x.extract.slice(0,260)}))};
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('origin')||'';const u=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method==='GET'&&u.pathname==='/health')return reply({ok:true,version:'5.2',secrets:{groq:!!env.GROQ_KEY,gemini:!!env.GEMINI_KEY,apinex:!!env.APINEX_API_KEY,openrouter:!!env.OPENROUTER_KEY}},200,origin);
  if(request.method!=='POST'||u.pathname!=='/solve')return reply({error:'Not found'},404,origin);
  if(!await sameSecret(request.headers.get('x-scanner-token'),env.SCANNER_CLIENT_TOKEN))return reply({error:'Доступ запрещён'},401,origin);
  if(Number(request.headers.get('content-length')||0)>MAX_BODY)return reply({error:'Слишком большой запрос'},413,origin);
  try {
   if(env.ASK_RATE){const ip=request.headers.get('cf-connecting-ip')||'unknown';const r=await env.ASK_RATE.limit({key:'scanner:'+ip});if(!r.success)return reply({error:'Лимит запросов. Повтори позже.'},429,origin)}
   const text=await request.text();if(text.length>MAX_BODY)return reply({error:'Слишком большой запрос'},413,origin);
   const q=normalize(JSON.parse(text));if(q.q.length<5)return reply({error:'Не найден текст вопроса'},400,origin);
   const started=Date.now();const docsP=sources(q).catch(()=>[]);
   const chosen=q.images.length?[PROVIDERS[1],PROVIDERS[4]]:[PROVIDERS[0],PROVIDERS[1]];
   const execute=async(p,doc='')=>{try{const result=await ai(p,env,q,doc);return {name:p.id,result}}catch(e){return{name:p.id,error:e.message.slice(0,90)}}};
   const firstP=Promise.all(chosen.map(p=>execute(p)));
   const first=await firstP;
   let docs=await Promise.race([docsP,new Promise(resolve=>setTimeout(()=>resolve([]),1300))]);
   let rows=first;
   let result=report(rows,q,docs);
   if(!result||result.uncertain){
     if(!docs.length)docs=await Promise.race([docsP,new Promise(resolve=>setTimeout(()=>resolve([]),800))]);
     const evidence=docs.map(x=>x.name+'\n'+x.extract.slice(0,700)).join('\n\n').slice(0,1800);
     const used=new Set(chosen.map(p=>p.id));
     const fallback=PROVIDERS.filter(x=>!used.has(x.id)&&(!q.images.length||x.vision)).filter(x=>!rows.some(r=>r.name.startsWith('apinex')&&x.key==='APINEX_API_KEY'&&/^HTTP (401|402|403|429)/.test(r.error||'')));
     if(fallback.length){ const reviewer=await execute(fallback[0],evidence);rows=[...rows,reviewer];result=report(rows,q,docs); }
   }
   if(!result)return reply({error:'Ни одна модель не дала пригодного ответа',models:rows.map(x=>({name:x.name,error:x.error||'некорректный формат'}))},502,origin);
   return reply({...result,imageAnalysis:q.images.length?{received:q.images.length,visionModels:rows.filter(r=>r.name==='gemini'||r.name.startsWith('apinex-vision')).filter(r=>r.result).map(r=>r.name),warning:!rows.some(r=>(r.name==='gemini'||r.name.startsWith('apinex-vision'))&&r.result)?'Нет подтверждённого анализа изображения':''}:null,elapsedMs:Date.now()-started,disclaimer:'Совпадение моделей и найденные статьи не гарантируют правильный ответ.'},200,origin);
  }catch(e){return reply({error:'Ошибка обработки: '+asText(e.message,120)},500,origin)}
 }
};