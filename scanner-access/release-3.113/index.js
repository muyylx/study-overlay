import {adminPage,clientPage,publicLauncher} from './ui.js';
import {adminOwner,publicOwner} from './owner.js';
import {validProvider,safeModel,solveWithPersonalKey,aiConfig,validateAiConfig,listPersonalModels} from './providers.js';
const NOW=()=>Math.floor(Date.now()/1000);
const NEVER=253402300799; // Year 9999: invitations and access do not expire.
const SESSION_AGE=365*86400;
const stateOf=u=>u.access_state||((u.enabled)?'active':'paused');
const enc=new TextEncoder();
const baseHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow, noarchive','permissions-policy':'camera=(), microphone=(), geolocation=()'};
function send(obj,status=200,other={}){return new Response(JSON.stringify(obj),{status,headers:{...baseHeaders,'content-type':'application/json; charset=utf-8',...other}})}
function securePage(html,admin){const bytes=crypto.getRandomValues(new Uint8Array(16));const nonce=btoa(String.fromCharCode(...bytes));const policy="default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-src 'none'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; frame-ancestors "+(admin?"'none'":"*");
 return new Response(html.replaceAll('__NONCE__',nonce),{status:200,headers:{...baseHeaders,'content-type':'text/html; charset=utf-8','content-security-policy':policy}})}
function fail(message,status=400){return send({error:message},status)}
function bad(message,status=400){return Object.assign(new Error(message),{status})}
async function body(req,max=15000){const len=Number(req.headers.get('content-length')||0);if(len>max)throw bad('Слишком большой запрос',413);const tx=await req.text();if(tx.length>max)throw bad('Слишком большой запрос',413);try{return JSON.parse(tx)}catch{throw bad('Некорректный JSON')}}
function token(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function sha(x){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(x))))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function equalHex(x,y){if(typeof x!=='string'||typeof y!=='string'||x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0}
function originOK(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
async function adminSession(req,env){const raw=req.headers.get('cookie')||'';const m=raw.match(/(?:^|;\s*)sc_admin=([A-Za-z0-9_-]{30,100})/);if(!m)return null;const h=await sha(m[1]);const row=await env.DB.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(h,NOW()).first();return row?m[1]:null}
function cookie(path,content,maxAge){return 'sc_admin='+content+'; Path='+path+'; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge}
async function userSession(req,env){const m=(req.headers.get('authorization')||'').match(/^Bearer\s+([A-Za-z0-9_-]{35,130})$/i);if(!m)return null;const h=await sha(m[1]);return await env.DB.prepare('SELECT u.*,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(h,NOW()).first()}
async function aesKey(env){const raw=Uint8Array.from(atob(env.USER_KEY_ENC),c=>c.charCodeAt(0));if(raw.length!==32)throw bad('Ошибка ключа шифрования',500);return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encrypt(env,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const out=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(env),enc.encode(secret));return btoa(String.fromCharCode(...iv,...new Uint8Array(out)))}
async function decrypt(env,cipher){const raw=Uint8Array.from(atob(cipher),c=>c.charCodeAt(0));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},await aesKey(env),raw.slice(12));return new TextDecoder().decode(plain)}
async function audit(env,action,user_id='',detail=''){await env.DB.prepare('INSERT INTO audit(timestamp,action,user_id,detail) VALUES(?,?,?,?)').bind(NOW(),action,user_id,detail).run()}
function userPublic(u){const state=stateOf(u);return{id:u.id,nickname:u.nickname||'',createdAt:u.created_at,activatedAt:u.activated_at,enabled:state==='active',accessState:state,provider:u.provider==='apinex'?'apinex':'',model:u.provider==='apinex'?(u.model||''):'',aiConfig:aiConfig(u.ai_config),hasKey:!!(u.key_cipher&&u.provider==='apinex'),keyRevision:u.key_revision,lastSeen:u.last_seen||0,requests:u.requests||0}}
function noCache(req){return {'vary':'Origin'}}
async function adminAPI(req,env,path){
 const root=env.ADMIN_PATH,route=path.slice(root.length);
 if(req.method==='GET'&&(route===''||route==='/'))return securePage(adminPage,true);
 if(req.method==='POST'&&route==='/login'){
  const ip=await sha(req.headers.get('cf-connecting-ip')||'unknown');const recent=await env.DB.prepare('SELECT failed,blocked_until FROM login_attempts WHERE ip_hash=?').bind(ip).first();if(recent?.blocked_until>NOW())return fail('Слишком много попыток. Повтори позже.',429);
  const d=await body(req,3000),given=await sha(String(d.password||''));
  if(!equalHex(given,env.ADMIN_PASSWORD_SHA256)){
   const attempts=(recent?.failed||0)+1;const block=attempts>=5?NOW()+900:0;
   await env.DB.prepare('INSERT INTO login_attempts(ip_hash,failed,blocked_until) VALUES(?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET failed=excluded.failed,blocked_until=excluded.blocked_until').bind(ip,block?0:attempts,block).run();
   return fail('Неверный пароль',401);
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ip).run();
  const t=token();await env.DB.prepare('INSERT INTO admin_sessions(token_hash,created_at,expires_at) VALUES(?,?,?)').bind(await sha(t),NOW(),NOW()+7*86400).run();
  return send({ok:true},200,{'set-cookie':cookie(root,t,7*86400)});
 }
 const adm=await adminSession(req,env);if(!adm)return fail('Требуется вход администратора',401);
 if(route.startsWith('/owner/'))return adminOwner(req,env,route);
 if(route==='/me'&&req.method==='GET')return send({ok:true});
 if(route==='/logout'&&req.method==='POST'){
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha(adm)).run();return send({ok:true},200,{'set-cookie':cookie(root,'',0)});
 }
 if(route==='/data'&&req.method==='GET'){
  const [u,c]=await Promise.all([env.DB.prepare('SELECT id,nickname,created_at,activated_at,enabled,access_state,provider,model,key_cipher,key_revision,last_seen,requests,ai_config FROM users ORDER BY created_at DESC LIMIT 300').all(),env.DB.prepare('SELECT i.user_id,i.created_at,i.expires_at,i.redeemed_at,u.nickname FROM invites i JOIN users u ON u.id=i.user_id ORDER BY i.created_at DESC LIMIT 200').all()]);
  return send({users:u.results.map(userPublic),codes:c.results.map(x=>({userId:x.user_id,createdAt:x.created_at,expiresAt:x.expires_at,used:!!x.redeemed_at,nickname:x.nickname})),now:NOW()});
 }
 if(route==='/codes'&&req.method==='POST'){
  const d=await body(req,2000),nickname=String(d.username||'').trim();
  if(nickname.length<2||nickname.length>48||/[<>\r\n\u0000-\u001f]/u.test(nickname))return fail('Укажи username (2–48 символов)');
  const now=NOW(),id=crypto.randomUUID();
  const raw=Array.from(crypto.getRandomValues(new Uint8Array(14)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const code=raw.match(/.{1,7}/g).join('-');
  await env.DB.batch([
   env.DB.prepare("INSERT INTO users(id,nickname,created_at,enabled,access_state) VALUES(?,?,?,1,'active')").bind(id,nickname,now),
   env.DB.prepare('INSERT INTO invites(code_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha(raw),id,now,NEVER)
  ]);
  await audit(env,'create_code',id);return send({codes:[{code,userId:id,username:nickname,expiresAt:null}]});
 }
 if(route.startsWith('/codes/')&&req.method==='DELETE'){
  const id=route.slice('/codes/'.length);
  if(!/^[0-9a-f-]{36}$/i.test(id))return fail('Неверный ID');
  const invite=await env.DB.prepare('SELECT user_id,redeemed_at FROM invites WHERE user_id=?').bind(id).first();
  if(!invite)return fail('Запись кода не найдена',404);
  await env.DB.prepare('DELETE FROM invites WHERE user_id=?').bind(id).run();
  if(!invite.redeemed_at){
   await env.DB.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(id).run();
   await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
   await env.DB.prepare('DELETE FROM users WHERE id=? AND activated_at IS NULL').bind(id).run();
  }
  await audit(env,'delete_code',id,invite.redeemed_at?'used: account retained':'unused: code revoked');
  return send({ok:true,userRetained:!!invite.redeemed_at});
 }
 const idMatch=route.match(/^\/users\/([0-9a-f-]{36})\/(access|nickname|key|clear-key|reset|recovery|config|models|reveal)$/i);
 if(idMatch&&req.method==='POST'){
  const id=idMatch[1],action=idMatch[2],found=await env.DB.prepare('SELECT id,provider,key_cipher,ai_config FROM users WHERE id=?').bind(id).first();if(!found)return fail('Пользователь не найден',404);
  if(action==='access'){
   const d=await body(req),state=String(d.state||'');
   if(!['active','paused','blocked'].includes(state))return fail('Неверный статус доступа');
   const existing=await env.DB.prepare('SELECT access_state FROM users WHERE id=?').bind(id).first();
   if(existing?.access_state===state)return send({ok:true,state});
   await env.DB.prepare('UPDATE users SET access_state=?,enabled=? WHERE id=?').bind(state,state==='active'?1:0,id).run();
   if(state==='blocked'){
     await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
     await env.DB.prepare('DELETE FROM recovery_codes WHERE user_id=? AND used_at IS NULL').bind(id).run();
   }
   await audit(env,'access',id,state);return send({ok:true,state,requiresRecovery:state==='blocked'});
  }

  if(action==='config'){
   const d=await body(req,7000),config=validateAiConfig(d.config);
   if(!config)return fail('Неверные настройки моделей');
   await env.DB.prepare('UPDATE users SET ai_config=?,model=?,key_revision=key_revision+1 WHERE id=?').bind(JSON.stringify(config),config.roles.quick,id).run();
   await audit(env,'config',id,'AI roles updated');
   return send({ok:true,config});
  }
  if(action==='models'){
   if(!found.key_cipher||found.provider!=='apinex')return fail('Сначала назначь личный ключ APINex участнику',409);
   try{const models=await listPersonalModels(await decrypt(env,found.key_cipher));return send({models,count:models.length})}
   catch(e){return fail('Не удалось получить модели личного ключа: '+String(e.message||'Ошибка').slice(0,100),502)}
  }
  if(action==='reveal'){
   // Re-authentication and rate limiting before transiently revealing a personal secret.
   const ip=await sha('reveal:'+(req.headers.get('cf-connecting-ip')||'unknown'));
   const recent=await env.DB.prepare('SELECT failed,blocked_until FROM login_attempts WHERE ip_hash=?').bind(ip).first();
   if(recent?.blocked_until>NOW())return fail('Просмотр временно заблокирован после ошибок пароля',429);
   const d=await body(req,1200),given=await sha(String(d.password||''));
   if(!equalHex(given,env.ADMIN_PASSWORD_SHA256)){
    const tries=(recent?.failed||0)+1;const until=tries>=3?NOW()+900:0;
    await env.DB.prepare('INSERT INTO login_attempts(ip_hash,failed,blocked_until) VALUES(?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET failed=excluded.failed,blocked_until=excluded.blocked_until').bind(ip,until?0:tries,until).run();
    return fail('Неверный пароль администратора',401);
   }
   await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ip).run();
   if(!found.key_cipher)return fail('У пользователя пока нет сохранённого ключа',404);
   const secret=await decrypt(env,found.key_cipher);
   await audit(env,'view_key',id,'Owner confirmed password');
   return send({key:secret},200,{'cache-control':'no-store','pragma':'no-cache'});
  }
  if(action==='nickname'){
   const d=await body(req,1500),nickname=String(d.username||'').trim();
   if(nickname.length<2||nickname.length>48||/[<>\r\n\u0000-\u001f]/u.test(nickname))return fail('Неверный username');
   await env.DB.prepare('UPDATE users SET nickname=? WHERE id=?').bind(nickname,id).run();
   await audit(env,'rename_user',id);return send({ok:true});
  }
  if(action==='key'){
   const d=await body(req,10000),provider='apinex',model=safeModel(String(d.model||''),provider),key=String(d.key||'').trim();
   if(d.provider&&d.provider!=='apinex')return fail('Участникам доступен только APINex');
   if(!model||!/^sk-apx[a-zA-Z0-9_-]{12,180}$/i.test(key))return fail('Нужен API-ключ APINex и допустимая модель');
   const cipher=await encrypt(env,key);
   await env.DB.prepare('UPDATE users SET provider=?,model=?,key_cipher=?,key_revision=key_revision+1 WHERE id=?').bind(provider,model,cipher,id).run();
   await audit(env,'set_key',id,provider+' / '+model);return send({ok:true});
  }
  if(action==='clear-key'){
   await env.DB.prepare('UPDATE users SET provider=NULL,model=NULL,key_cipher=NULL,key_revision=key_revision+1 WHERE id=?').bind(id).run();
   await audit(env,'clear_key',id);return send({ok:true});
  }
  if(action==='recovery'){
   const raw=Array.from(crypto.getRandomValues(new Uint8Array(14)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
   await env.DB.prepare('INSERT INTO recovery_codes(code_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha(raw),id,NOW(),NOW()+7*86400).run();
   await audit(env,'recovery_code',id);return send({code:raw.slice(0,7)+'-'+raw.slice(7,14)+'-'+raw.slice(14,21)+'-'+raw.slice(21,28)});
  }
  if(action==='reset'){
   await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();await audit(env,'reset_sessions',id);return send({ok:true});
  }
 }
 return fail('Не найдено',404);
}
async function redeem(req,env){
 const d=await body(req,3000);const raw=String(d.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const backupName=String(d.nickname||'').trim().slice(0,48);
 if(raw.length!==28)return fail('Укажи код активации');
 const hash=await sha(raw);
 const code=await env.DB.prepare('SELECT user_id FROM invites WHERE code_hash=? AND redeemed_at IS NULL AND expires_at>?').bind(hash,NOW()).first();
 let userId,firstActivation=false;
 if(code){
  const pending=await env.DB.prepare('SELECT nickname,access_state FROM users WHERE id=?').bind(code.user_id).first();
  if(!pending||pending.access_state==='blocked')return fail('Участник заблокирован',403);
  const update=await env.DB.prepare('UPDATE invites SET redeemed_at=? WHERE code_hash=? AND redeemed_at IS NULL AND expires_at>?').bind(NOW(),hash,NOW()).run();
  if((update.meta?.changes||0)!==1)return fail('Этот код уже был использован',409);
  userId=code.user_id;firstActivation=true;
  const name=pending.nickname||backupName||'Участник';
  await env.DB.prepare('UPDATE users SET activated_at=?,nickname=?,last_seen=? WHERE id=? AND activated_at IS NULL').bind(NOW(),name,NOW(),userId).run();
 }else{
  const recovery=await env.DB.prepare('SELECT user_id FROM recovery_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>?').bind(hash,NOW()).first();
  if(!recovery)return fail('Код недействителен, истёк или уже использован',403);
  const update=await env.DB.prepare('UPDATE recovery_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL AND expires_at>?').bind(NOW(),hash,NOW()).run();
  if((update.meta?.changes||0)!==1)return fail('Этот код уже использован',409);
  userId=recovery.user_id;
 }
 const account=await env.DB.prepare('SELECT access_state FROM users WHERE id=?').bind(userId).first();
 if(!account||account.access_state==='blocked')return fail('Участник заблокирован',403);
 const t=token();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha(t),userId,NOW(),NOW()+SESSION_AGE).run();
 await audit(env,firstActivation?'redeem':'recovery_login',userId);
 const user=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
 return send({token:t,user:userPublic(user)});
}

async function transcribeParticipantPhoto(payload,env,user){
 const started=Date.now();
 const data=typeof payload?.image==='string'?payload.image:'';
 const match=data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
 if(!match||data.length<300||data.length>2200000)return fail('Нужно изображение JPG/PNG/WebP до 1,6 МБ',400);
 const config=aiConfig(user.ai_config);
 if(!config.flags.vision)return fail('Распознавание изображений отключено администратором',403);
 const key=await decrypt(env,user.key_cipher);
 const model=config.roles.vision||'free/gemini-3.8-flash';
 const task='ТЫ OCR для учебных материалов. Только дословно переписывай текст с картинки, в том числе номера заданий и слова в скобках. НЕ решай упражнения, НЕ заполняй пропуски, НЕ выбирай варианты и НЕ предлагай ответы. Неразборчивые места отмечай [неразборчиво]. Пропуски сохраняй как ____. Не смешивай рекламу вокруг листа с текстом упражнений. Выдай только JSON в формате {"title":"...","lines":["..."],"unreadable":["..."]}.';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000),providerStarted=Date.now();
 try{
  const upstream=await fetch('https://api.apinex.bond/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'system',content:task},{role:'user',content:[{type:'text',text:'Перепиши видимый текст листа, сохраняя порядок. Не добавляй ответы.'},{type:'image_url',image_url:{url:data}}]}],temperature:0,max_tokens:3000}),signal:controller.signal});
  if(!upstream.ok){
  const status=upstream.status;
  const msg=status===401||status===403?'APINex отклонил личный API-ключ':status===404?'Vision-модель '+model+' не найдена в APINex':status===429?'Лимит APINex исчерпан':status===400||status===422?'Vision-модель отклонила изображение':'API распознавания вернул HTTP '+status;
  return fail(msg,status===429?429:502);
 }
  const j=await upstream.json();let raw=j.choices?.[0]?.message?.content||'';
  if(Array.isArray(raw))raw=raw.map(p=>p.text||'').join('');
  const rawText=String(raw||'').trim();
  if(!rawText)return fail('Vision-модель вернула пустой ответ. Проверь поддержку изображений.',502);
  let parsed;
  try{parsed=JSON.parse(rawText.replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\x60{3}\s*$/,''))}
  catch(_){
   const candidate=rawText.match(/\{[\s\S]*\}/);
   if(candidate)try{parsed=JSON.parse(candidate[0])}catch(_){}
   if(!parsed)parsed={title:'Распознанный текст',lines:rawText.replace(/^\x60{3}(?:text)?\s*/i,'').replace(/\x60{3}\s*$/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,100),unreadable:[]};
  }
  const lines=(Array.isArray(parsed.lines)?parsed.lines:[]).filter(x=>typeof x==='string').map(x=>x.trim().slice(0,350)).filter(Boolean).slice(0,100);
  if(!lines.length)return fail('На изображении не найден читаемый текст',422);
  const unreadable=(Array.isArray(parsed.unreadable)?parsed.unreadable:[]).filter(x=>typeof x==='string').map(x=>x.slice(0,140)).slice(0,20);
  return send({mode:'transcription-only',title:String(parsed.title||'').slice(0,140),lines,unreadable,elapsedMs:Date.now()-started,providerMs:Date.now()-providerStarted});
 }catch(e){return fail(e.name==='AbortError'?'OCR не ответил за 16 секунд':'OCR временно недоступен',502)}
 finally{clearTimeout(timer)}
}

async function userAPI(req,env,path){
 if(path==='/api/redeem'&&req.method==='POST')return redeem(req,env);
 const user=await userSession(req,env);if(!user)return fail('Сессия недействительна. Нужен новый код от администратора.',401);
 if(path==='/api/me'&&req.method==='GET'){if(user.access_state==='blocked')return fail('Доступ заблокирован администратором',403);return send({user:userPublic(user)});}
 if(path==='/api/logout'&&req.method==='POST'){
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();return send({ok:true});
 }
 if(path==='/api/ping'&&req.method==='POST'){
  if(user.access_state==='blocked')return fail('Доступ заблокирован',403);
  if(user.last_seen<NOW()-20)await env.DB.prepare('UPDATE users SET last_seen=? WHERE id=?').bind(NOW(),user.id).run();
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=? AND expires_at<?').bind(NOW()+SESSION_AGE,user.token_hash,NOW()+20*86400).run();
  return send({ok:true,enabled:user.access_state==='active',accessState:user.access_state,hasKey:!!(user.key_cipher&&user.provider==='apinex'),keyRevision:user.key_revision});
 }

 if(path==='/api/ocr'&&req.method==='POST'){
  if(user.access_state!=='active')return fail('Доступ заблокирован или поставлен на паузу',403);
  if(!user.key_cipher||user.provider!=='apinex')return fail('Администратор ещё не назначил личный ключ APINex',403);
  const d=await body(req,2300000),now=NOW();
  const rate=await env.DB.prepare('UPDATE users SET req_window_at=CASE WHEN req_window_at<? THEN ? ELSE req_window_at END, req_window_count=CASE WHEN req_window_at<? THEN 1 ELSE req_window_count+1 END,requests=requests+1,last_seen=? WHERE id=? AND (req_window_at<? OR req_window_count<20) RETURNING requests').bind(now-60,now,now-60,now,user.id,now-60).first();
  if(!rate)return fail('Личный лимит: 20 запросов в минуту',429);
  return await transcribeParticipantPhoto(d,env,user);
 }
 if(path==='/api/solve'&&req.method==='POST'){
  if(user.access_state!=='active')return fail(user.access_state==='blocked'?'Участник заблокирован':'Доступ поставлен на паузу',403);
  if(!user.key_cipher||user.provider!=='apinex')return fail('Администратор ещё не назначил личный ключ APINex',403);
  const d=await body(req,3250000);
  const now=NOW();
  // Atomic per-user token bucket (20 / rolling one-minute window); no shared owner quota.
  const rate=await env.DB.prepare('UPDATE users SET req_window_at=CASE WHEN req_window_at<? THEN ? ELSE req_window_at END, req_window_count=CASE WHEN req_window_at<? THEN 1 ELSE req_window_count+1 END,requests=requests+1,last_seen=? WHERE id=? AND (req_window_at<? OR req_window_count<20) RETURNING requests').bind(now-60,now,now-60,now,user.id,now-60).first();
  if(!rate)return fail('Личный лимит: 20 запросов в минуту. Повтори позже.',429);
  const started=Date.now();
  const key=await decrypt(env,user.key_cipher);
  try{
   const response=await solveWithPersonalKey('apinex',user.model,key,d,user.ai_config);
   return send({...response,elapsedMs:Date.now()-started});
  }catch(e){return fail((e.message||'Ошибка провайдера').slice(0,170),e.status===429?429:502)}
 }
 return fail('Не найдено',404);
}
export default {
 async fetch(req,env){
  try{
   const url=new URL(req.url),p=url.pathname,method=req.method;
   if(['POST','PUT','PATCH','DELETE'].includes(method)&&!originOK(req)&&p!=='/owner/solve')return fail('Посторонний источник запроса',403);
   if(p.startsWith('/owner/'))return await publicOwner(req,env,p);
   if(p==='/version'&&method==='GET')return send({version:'3.113',minSupported:'3.100',mandatory:false,installUrl:'https://scanner-bookmarklet-install.study-overlay-muyylx.workers.dev/'});
   if(p==='/health')return send({ok:true,ready:!!(env.ADMIN_PATH&&env.ADMIN_PASSWORD_SHA256&&env.USER_KEY_ENC),service:'scanner-access',ownerKeysAvailable:true});
   if(p==='/panel'&&method==='GET')return securePage(clientPage,false);
   if(p==='/public-bookmarklet'&&method==='GET')return new Response('javascript:'+encodeURIComponent(publicLauncher),{status:200,headers:{...baseHeaders,'content-type':'text/plain; charset=utf-8','access-control-allow-origin':'*'}});
   if(p===env.ADMIN_PATH||p.startsWith(env.ADMIN_PATH+'/'))return await adminAPI(req,env,p);
   if(p.startsWith('/api/'))return await userAPI(req,env,p);
   return fail('Не найдено',404);
  }catch(e){if(e.status&&e.status<500)return fail(e.message,e.status);console.error(JSON.stringify({type:'worker_error',name:e.name,message:String(e.message||'').slice(0,90)}));return fail('Внутренняя ошибка сервиса',500)}
 }
};