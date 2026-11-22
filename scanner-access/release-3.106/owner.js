import {ownerClient} from './owner-client.js';
const te=new TextEncoder(),time=()=>Math.floor(Date.now()/1000),SESSION_TTL=2592000;
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-scanner-token','access-control-allow-methods':'GET,POST,OPTIONS','access-control-max-age':'3600'};
function res(x,s=200,c=false){return new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...(c?cors:{})}})}
function fault(m,s=400){return Object.assign(new Error(m),{status:s})}
async function parse(r,max=20000){const s=await r.text();if(s.length>max)throw fault('Слишком большой запрос',413);try{return JSON.parse(s)}catch{throw fault('Некорректный JSON')}}
async function sha(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(String(v))))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function aes(env){const b=Uint8Array.from(atob(env.USER_KEY_ENC),x=>x.charCodeAt(0));if(b.length!==32)throw fault('Ошибка шифрования',500);return crypto.subtle.importKey('raw',b,'AES-GCM',false,['encrypt','decrypt'])}
async function seal(env,s){const iv=crypto.getRandomValues(new Uint8Array(12));const r=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aes(env),te.encode(s));return btoa(String.fromCharCode(...iv,...new Uint8Array(r)))}
async function unseal(env,s){const b=Uint8Array.from(atob(s),x=>x.charCodeAt(0));const r=await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},await aes(env),b.slice(12));return new TextDecoder().decode(r)}
function token(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
const P={
 apinex:{name:'APINex',root:'https://api.apinex.bond/v1',model:'free/glm-5.3-flashx'},
 groq:{name:'Groq',root:'https://api.groq.com/openai/v1',model:'openai/gpt-oss-20b'},
 openrouter:{name:'OpenRouter',root:'https://openrouter.ai/api/v1',model:'openrouter/free'},
 gemini:{name:'Gemini',root:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-3.8-flash'},
 openai:{name:'OpenAI',root:'https://api.openai.com/v1',model:'gpt-4.1-mini'}
};
function detect(k){if(/^sk-apx[A-Za-z0-9_-]{12,200}$/i.test(k))return 'apinex';if(/^gsk_[A-Za-z0-9_-]{12,200}$/.test(k))return 'groq';if(/^sk-or-v1-[A-Za-z0-9_-]{12,200}$/i.test(k))return 'openrouter';if(/^(?:AIza[A-Za-z0-9_-]{20,200}|AQ\.[A-Za-z0-9._-]{20,350})$/.test(k))return 'gemini';if(/^sk-proj-[A-Za-z0-9_-]{12,250}$/.test(k))return 'openai';return null}
async function verify(p,k){
 const x=P[p],u=p==='openrouter'?x.root+'/key':x.root+'/models';
 const h=p==='gemini'?{'x-goog-api-key':k}:{authorization:'Bearer '+k};
 const r=await fetch(u,{headers:h,signal:AbortSignal.timeout(11000)});
 if(!r.ok)throw fault(x.name+' отклонил ключ (HTTP '+r.status+')');
 const j=await r.json().catch(()=>({}));
 if(p==='openrouter')return [];
 return (p==='gemini'?(j.models||[]).map(x=>String(x.name||'').replace(/^models\//,'')):(j.data||[]).map(x=>String(x.id||''))).filter(x=>/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,110}$/.test(x));
}
function pickModel(p,list,wish){
 if(wish){if(!/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,110}$/.test(wish))throw fault('Некорректная модель');if(list.length&&!list.includes(wish))throw fault('Модель не указана провайдером');return wish}
 const pref=[P[p].model,'free/glm-5.3-flashx','free/qwen-3.8-max','gemini-3.6-flash','gemini-3.5-flash-lite'];
 if(p==='openrouter')return P[p].model;
 if(p==='groq'){
  const chat=list.filter(x=>!/(guard|moderation|whisper|transcri|speech|tts|audio|embed|rerank|llama-3\.1-8b-instant|llama-3\.3-70b-versatile|qwen3\.6-27b)/i.test(x));
  if(!chat.length)throw fault('У Groq не обнаружены подходящие чат-модели');
  return [P[p].model,'openai/gpt-oss-120b','qwen/qwen3.8-27b'].find(x=>chat.includes(x))||chat[0];
 }
 return pref.find(x=>list.includes(x))||(p==='apinex'?list.find(x=>x.startsWith('free/')):null)||list.find(x=>!/(guard|moderation|whisper|transcri|tts|audio|embed|rerank)/i.test(x))||P[p].model;
}
export async function adminOwner(r,env,path){
 if(r.method!=='GET'){
  const site=r.headers.get('sec-fetch-site'),origin=r.headers.get('origin'),referer=r.headers.get('referer'),self=new URL(r.url).origin;
  let validRef=false;try{validRef=!!referer&&new URL(referer).origin===self}catch{}
  if(r.headers.get('x-scanner-admin-request')!=='1'||(origin&&origin!==self)||(site&&site!=='same-origin'&&site!=='none')||(!origin&&!site&&!validRef))return res({error:'Запрос к админ-панели не подтверждён'},403);
 }

 if(path==='/owner/keys'&&r.method==='GET'){const q=await env.DB.prepare('SELECT id,provider,model,label,enabled,created_at,verified_at FROM owner_keys ORDER BY created_at DESC').all();return res({keys:q.results||[],limit:10})}
 if(path==='/owner/keys'&&r.method==='POST'){
  const d=await parse(r,6000),k=String(d.key||'').trim(),p=detect(k);
  if(!p)return res({error:'Нельзя однозначно определить провайдера по этому ключу. Поддерживаются APINex, Groq, OpenRouter, Gemini и OpenAI.'},400);
  const n=await env.DB.prepare('SELECT count(*) n FROM owner_keys').first();if(n.n>=10)return res({error:'Максимум 10 ключей владельца'},409);
  const f=await sha(k);
  if(await env.DB.prepare('SELECT id FROM owner_keys WHERE fingerprint=?').bind(f).first())return res({error:'Ключ уже добавлен'},409);
  let models;try{models=await verify(p,k)}catch(e){return res({error:String(e.message||'Ошибка проверки').slice(0,160)},e.status||502)}
  const model=pickModel(p,models,String(d.model||'').trim()),id=crypto.randomUUID(),now=time(),label=P[p].name+' · '+k.slice(-4);
  const inserted=await env.DB.prepare('INSERT INTO owner_keys(id,provider,model,label,secret_cipher,fingerprint,enabled,created_at,verified_at) SELECT ?,?,?,?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM owner_keys)<10 RETURNING id').bind(id,p,model,label,await seal(env,k),f,now,now).first().catch(e=>{if(String(e.message).includes('UNIQUE'))throw fault('Ключ уже добавлен',409);throw e});if(!inserted)return res({error:'Максимум 10 ключей владельца'},409);
  return res({ok:true,provider:p,model,label});
 }
 const m=path.match(/^\/owner\/keys\/([a-f0-9-]{36})\/(toggle|delete)$/);
 if(m&&r.method==='POST'){
  if(m[2]==='delete')await env.DB.prepare('DELETE FROM owner_keys WHERE id=?').bind(m[1]).run();
  else{const d=await parse(r,1000);await env.DB.prepare('UPDATE owner_keys SET enabled=? WHERE id=?').bind(d.enabled?1:0,m[1]).run()}
  return res({ok:true});
 }
 if(path==='/owner/diagnostics'&&r.method==='POST'){
  const all=await env.DB.prepare('SELECT id,provider,model,enabled,secret_cipher FROM owner_keys ORDER BY created_at').all();
  const checked=await Promise.all((all.results||[]).map(async k=>{
   const begin=Date.now();const result={id:k.id,provider:k.provider,model:k.model,enabled:!!k.enabled};
   try{
    if(/(?:prompt.guard|moderation|whisper|transcri|speech|tts|audio|embed|rerank)/i.test(k.model))throw fault('Выбрана неподходящая модель');
    const secret=await unseal(env,k.secret_cipher);
    const models=await verify(k.provider,secret);
    if(models.length&&!models.includes(k.model))throw fault('Сохранённая модель отсутствует в списке API');
    const proof=await solveOne(k,secret,{question:'Сколько будет два плюс два?',options:['4','7'],multiple:false,context:'Проверка соединения и работы модели',images:[],imageCandidates:0},9000);
    result.ok=proof.choices?.[0]==='A';
    result.message=result.ok?'API и модель ответили корректно':'Модель ответила, но тест не подтверждён';if(result.ok)await env.DB.prepare('UPDATE owner_keys SET verified_at=? WHERE id=?').bind(time(),k.id).run();
   }catch(e){result.ok=false;result.message=String(e.message||'Ошибка связи').slice(0,180)}
   result.elapsedMs=Date.now()-begin;
   return result;
  }));
  return res({version:'3.106',results:checked,checked:checked.length});
 }
 if(path==='/owner/sessions'&&r.method==='GET'){
  const x=await env.DB.prepare('SELECT substr(token_hash,1,12) AS id,created_at,last_seen,expires_at,total_requests FROM owner_sessions ORDER BY created_at DESC').all();
  return res({sessions:x.results||[],serverTime:time()});
 }
 const rev=path.match(/^\/owner\/sessions\/([a-f0-9]{12})\/revoke$/);
 if(rev&&r.method==='POST'){
  const x=await env.DB.prepare('DELETE FROM owner_sessions WHERE substr(token_hash,1,12)=?').bind(rev[1]).run();
  return res({ok:true,revoked:x.meta?.changes||0});
 }
 if(path==='/owner/install'&&r.method==='POST'){
  const t=token(),now=time(),expiresAt=now+SESSION_TTL;await env.DB.prepare('INSERT INTO owner_sessions(token_hash,created_at,expires_at) VALUES(?,?,?)').bind(await sha(t),now,expiresAt).run();
  await env.DB.prepare('DELETE FROM owner_sessions WHERE expires_at<? OR token_hash NOT IN (SELECT token_hash FROM owner_sessions ORDER BY created_at DESC LIMIT 3)').bind(now).run();
  const code=ownerClient.replace('__SCANNER_OWNER_TOKEN__',t);
  if(code.includes('__SCANNER_OWNER_TOKEN__'))throw fault('Не собран код',500);
  return res({code:'javascript:'+encodeURIComponent(code),version:'3.106',expiresAt});
 }
 if(path==='/owner/revoke'&&r.method==='POST'){await env.DB.prepare('DELETE FROM owner_sessions').run();return res({ok:true})}
 return res({error:'Не найдено'},404);
}
function normalized(x){
 const question=String(x.question||'').replace(/\s+/g,' ').trim().slice(0,3300);
 if(question.length<6)throw fault('Текст вопроса не найден');
 return{question,options:Array.isArray(x.options)?x.options.slice(0,8).map(v=>String(v||'').slice(0,350)):[],multiple:!!x.multiple,context:String(x.context||'').slice(0,260),imageCandidates:Math.min(10,Math.max(0,Number(x.imageCandidates)||0)),images:Array.isArray(x.images)?x.images.slice(0,5).filter(v=>v&&typeof v.data==='string'&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]{200,530000}$/.test(v.data)):[]};
}
function decodeAnswer(raw,q){
 const s=String(raw||'').trim();let x;
 try{x=JSON.parse(s)}catch{try{x=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1))}catch{}}
 if(!x||typeof x!=='object')throw fault('Модель не вернула JSON',502);
 const legal='ABCDEFGH'.slice(0,q.options.length);
 const choices=[...new Set((Array.isArray(x.choices)?x.choices:[]).map(v=>String(v).trim().toUpperCase()).filter(v=>v.length===1&&legal.includes(v)))].slice(0,q.multiple?8:1);
 if(q.options.length&&!choices.length&&!x.uncertain)throw fault('Не получен проверяемый вариант',502);
 return{choices,answer:choices.length?choices.map(c=>c+') '+q.options[legal.indexOf(c)]).join('\n'):String(x.answer||'').slice(0,2800),explanation:String(x.explanation||'').slice(0,3000),uncertain:!!x.uncertain,verification:'Результат одной модели',sources:[]};
}
async function solveOne(k,secret,q,timeoutMs=11000){
 const p=k.provider,root=P[p].root;
 const prompt='Ответь по существу и только JSON: {"answer":"текст","choices":["A"],"explanation":"краткое объяснение","uncertain":false}. Если есть варианты, choices содержит буквы A-H. Если данных недостаточно, uncertain=true. Вопрос: '+q.question+'\nКонтекст: '+q.context+'\nВарианты:\n'+q.options.map((x,i)=>'ABCDEFGH'[i]+') '+x).join('\n')+'\nТип: '+(q.multiple?'несколько верных':'один верный');
 let url,h,payload;
 if(p==='gemini'){
  url=root+'/models/'+encodeURIComponent(k.model)+':generateContent';h={'x-goog-api-key':secret,'content-type':'application/json'};
  const parts=[{text:prompt}];
  for(const im of q.images){const a=im.data.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);if(a)parts.push({inline_data:{mime_type:a[1],data:a[2]}})}
  payload={contents:[{parts}],generationConfig:{temperature:0.1,maxOutputTokens:1000}};
 }else{
  url=root+'/chat/completions';h={authorization:'Bearer '+secret,'content-type':'application/json'};
  const contents=q.images.length?[{type:'text',text:prompt},...q.images.map(x=>({type:'image_url',image_url:{url:x.data}}))]:prompt;
  payload={model:k.model,messages:[{role:'user',content:contents}],temperature:0.1,max_tokens:1000};
  if(p==='groq'&&k.model.startsWith('openai/gpt-oss-')){payload.response_format={type:'json_object'};payload.reasoning_format='hidden';}
 }
 const r=await fetch(url,{method:'POST',headers:h,body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw fault(P[p].name+' вернул HTTP '+r.status,r.status===429?429:502);
 const content=p==='gemini'?(j.candidates?.[0]?.content?.parts||[]).map(v=>v.text||'').join(''):(j.choices?.[0]?.message?.content??j.output_text??'');const s=Array.isArray(content)?content.map(v=>typeof v==='string'?v:String(v.text||v.content||'')).join(''):content;
 return{...decodeAnswer(s,q),provider:p,model:k.model,models:[{name:k.model,status:'ok'}]};
}
export async function publicOwner(req,env,path){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(path==='/owner/health'&&req.method==='GET'){const x=await env.DB.prepare('SELECT COUNT(*) AS n FROM owner_keys WHERE enabled=1').first();return res({latestClientVersion:'3.106',minimumClientVersion:'3.105',serverVersion:'3.106',ready:!!(env.USER_KEY_ENC&&x?.n),activeKeys:x?.n||0},200,true);}
 if(path==='/owner/status'&&req.method==='GET'){
  const t=req.headers.get('x-scanner-token')||'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(t))return res({authorized:false},401,true);
  const row=await env.DB.prepare('SELECT token_hash,expires_at FROM owner_sessions WHERE token_hash=? AND expires_at>?').bind(await sha(t),time()).first();
  if(!row)return res({authorized:false},401,true);
  const x=await env.DB.prepare('SELECT count(*) n FROM owner_keys WHERE enabled=1').first();
  return res({authorized:true,enabledKeys:x?.n||0,expiresAt:row.expires_at,version:'3.106'},200,true);
 }
 if(path!=='/owner/solve'||req.method!=='POST')return res({error:'Не найдено'},404,true);
 const t=req.headers.get('x-scanner-token')||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(t))return res({error:'Скопируй новую личную закладку через админ-панель'},401,true);
 const now=time(),h=await sha(t);
 const usage=await env.DB.prepare('UPDATE owner_sessions SET req_window_at=CASE WHEN req_window_at<? THEN ? ELSE req_window_at END,req_window_count=CASE WHEN req_window_at<? THEN 1 ELSE req_window_count+1 END,total_requests=total_requests+1,last_seen=? WHERE token_hash=? AND expires_at>? AND (req_window_at<? OR req_window_count<20) RETURNING total_requests').bind(now-60,now,now-60,now,h,now,now-60).first();
 if(!usage)return res({error:'Личная закладка недействительна или достигнут лимит запросов'},429,true);
 let data;try{data=normalized(await parse(req,3200000))}catch(e){return res({error:e.message},e.status||400,true)}
 const rows=await env.DB.prepare('SELECT provider,model,secret_cipher FROM owner_keys WHERE enabled=1 ORDER BY created_at').all();
 const keys=rows.results||[];if(!keys.length)return res({error:'Сначала добавь хотя бы один ключ в админ-панель'},409,true);
 const prohibited=/(?:prompt.guard|moderation|whisper|transcri|speech|tts|audio|embed|rerank)/i;
 const vision=k=>k.provider==='gemini'||(k.provider==='openai'&&/gpt-4|gpt-5|vision|o\d/i.test(k.model))||/(?:vision|multimodal|[/-]vl[/-]|gemini|pixtral)/i.test(k.model);
 const ready=keys.filter(k=>!prohibited.test(k.model)&&(!data.images.length||vision(k)));if(data.images.length)for(const k of keys.filter(x=>x.provider==='apinex'))ready.push({...k,model:'free/gemini-3.8-flash',visionFallback:true});
 if(!ready.length)return res({error:data.images.length?'Нет активной модели с подтверждённой поддержкой изображений':'Нет подходящей модели для текста'},422,true);
 const priority=k=>data.images.length?(k.provider==='gemini'?100:k.visionFallback?95:k.provider==='openai'?90:k.provider==='openrouter'?80:70):
   (k.provider==='apinex'?100:k.provider==='gemini'?95:k.provider==='groq'?85:k.provider==='openai'?80:60);
 ready.sort((a,b)=>priority(b)-priority(a));
 const errs=[],started=Date.now();
 for(let i=0;i<Math.min(3,ready.length);i++){
  const k=ready[i],remaining=22000-(Date.now()-started);
  if(remaining<1500)break;
  try{
   const result=await solveOne(k,await unseal(env,k.secret_cipher),data,Math.min(remaining,data.images.length?11000:8500));
   const imageEssential=data.images.length&&/(?:рисунк|малюнк|графік|график|схем|зображенн|картин|діаграм|diagram|image|picture|chart)/i.test(data.question);
   if(imageEssential&&data.imageCandidates>data.images.length)result.uncertain=true;
   result.elapsedMs=Date.now()-started;result.attempts=i+1;
   if(result.uncertain&&i+1<Math.min(3,ready.length)){errs.push(k.provider+': недостаточно уверенный результат');continue}
   return res(result,200,true);
  }catch(e){errs.push(k.provider+': '+String(e.message||'ошибка').slice(0,85))}
 }
 return res({error:'Не удалось получить проверяемый результат',diagnostics:errs,elapsedMs:Date.now()-started},502,true);
}
