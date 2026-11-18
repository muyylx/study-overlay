(() => {
'use strict';
const cfg=window.STUDY_CONFIG||{};
const api=String(cfg.apiBase||'').replace(/\/+$/,'');
const $=id=>document.getElementById(id);
let token='',device='',profile=null,settings=null,adminData=null,chatUserId='',lastUnread=0,currentScreen='home',newInviteCode='';
const tokenKey='study_3_token',deviceKey='study_3_device';
const getStore=k=>{try{return localStorage.getItem(k)||'';}catch{return '';}};
const setStore=(k,v)=>{try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k);}catch{}};
const randomHex=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
device=getStore(deviceKey);if(!/^[a-f0-9]{64}$/.test(device)){device=randomHex();setStore(deviceKey,device);}
token=getStore(tokenKey);
const show=(id,yes)=>$(id)?.classList.toggle('hidden',!yes);
const text=(id,value)=>{const el=typeof id==='string'?$(id):id;if(el)el.textContent=String(value??'');};
const el=(tag,cl='',value)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(value!==undefined)n.textContent=String(value);return n;};
const time=s=>{try{return new Date(s).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'});}catch{return String(s||'');}};
function today(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts().map(i=>[i.type,i.value]));return `${p.year}-${p.month}-${p.day}`;}
let toastTimer;
function toast(message){text('toast',message);show('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),5200);}
async function call(path,method='GET',body=null,auth=true){
 if(!api.startsWith('https://'))throw Error('Адрес Cloudflare не настроен');
 const headers={'content-type':'application/json','x-study-device':device};if(auth&&token)headers.authorization='Bearer '+token;
 let res;try{res=await fetch(api+path,{signal:AbortSignal.timeout(22000),method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});}catch{throw Error('Нет связи с Cloudflare. Проверь интернет и адрес сервера.');}
 const obj=await res.json().catch(()=>({error:'Сервер вернул неожиданный ответ'}));
 if(res.status===401&&auth){saveToken('');profile=null;render();}
 if(!res.ok)throw Object.assign(Error(obj.error||`Ошибка ${res.status}`),{status:res.status});
 return obj;
}
function saveToken(t){token=t||'';setStore(tokenKey,token);}
function notice(err){toast(err?.message||String(err));}
function setButtonBusy(button,busy){if(!button)return;if(busy){button.dataset.label=button.textContent;button.disabled=true;button.textContent='Выполняется…';}else{button.disabled=false;button.textContent=button.dataset.label||button.textContent;}}
function navigation(to){
 if(!profile){show('auth',true);return;}if(to==='admin'&&profile.role!=='admin')return;
 currentScreen=to;
 for(const button of document.querySelectorAll('[data-screen]'))button.classList.toggle('active',button.dataset.screen===to);
 for(const p of document.querySelectorAll('.page'))p.classList.add('hidden');show('page-'+to,true);
 if(to==='home'){updateProfile();loadNotifications();}if(to==='bonus')loadBonus();if(to==='support')loadSupport();if(to==='bugs')loadBugs();if(to==='admin')loadAdmin();
}
function render(){
 show('loading',false);show('auth',!profile);show('application',!!profile);show('logout',!!profile);
 if(!profile)return;
 text('userName',profile.name);text('avatar',profile.name?.slice(0,1)?.toUpperCase()||'S');text('userRole',profile.role==='admin'?'Super Admin':'Участник');
 text('remaining',profile.remaining===null?'∞':profile.remaining);text('limitNote',profile.role==='admin'?'Без личного лимита':`Лимит ${profile.limit} · обычных ${profile.regularRemaining??'—'} · бонусных сегодня ${profile.bonusRemaining??'—'} · в банке ${profile.bank??'—'}. Сброс в 00:00 по Киеву.`);
 show('adminTab',profile.role==='admin');show('blockedInfo',!!profile.blocked&&profile.role!=='admin');
 const maintenance=!!settings?.maintenance&&profile.role!=='admin';
 show('maintenance',maintenance);text('maintenanceText',settings?.maintenance_message||'Сайт временно недоступен');
 const announce=String(settings?.announcement||'');show('announcement',!!announce&&!maintenance);text('announcement',announce);
 if(maintenance && !['home','support','install'].includes(currentScreen))navigation('home');
}
async function start(){
 try{
  const publicState=await call('/public','GET',null,false);settings=publicState.settings;
  text('status','● Онлайн');show('setupForm',!!publicState.setupRequired);
  if(token){try{const response=await call('/me');profile=response.user;settings=response.settings;}catch(e){if(e.status===401){saveToken('');profile=null;}else notice(e);}}
 }catch(e){text('status','● Нет связи');notice(e);}
 render();if(profile){navigation(location.hash==='#admin'?'admin':'home');pollUnread();}
}
async function login(e,path,data){e.preventDefault();const button=e.submitter;setButtonBusy(button,true);show('authError',false);
 try{const r=await call(path,'POST',{...data,device},false);saveToken(r.token);profile=r.user;toast('Вход выполнен');await start();}
 catch(err){text('authError',err.message);show('authError',true);}
 finally{setButtonBusy(button,false);}
}
$('adminLoginToggle').addEventListener('click',()=>show('adminLoginForm',$('adminLoginForm').classList.contains('hidden')));
$('inviteForm').addEventListener('submit',e=>login(e,'/auth/redeem',{code:$('invite').value.trim()}));
$('adminLoginForm').addEventListener('submit',e=>login(e,'/admin/login',{login:$('adminLogin').value,password:$('adminPass').value}));
$('setupForm').addEventListener('submit',e=>login(e,'/admin/setup',{name:$('setupName').value,login:$('setupLogin').value,password:$('setupPass').value,secret:$('setupSecret').value}));
$('logout').addEventListener('click',async()=>{try{await call('/auth/logout','POST',{});}catch{}saveToken('');profile=null;location.reload();});
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>navigation(b.dataset.screen)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>navigation(b.dataset.goto)));
function empty(container,message){container.replaceChildren(el('p','muted',message));}
function card(title,description='',subtitle=''){const item=el('div','item');item.append(el('h4','',title));if(description)item.append(el('p','',description));if(subtitle)item.append(el('small','',subtitle));return item;}
function action(container,label,handler,type='outline'){const b=el('button',type+' tinybutton',label);b.type='button';b.addEventListener('click',async()=>{setButtonBusy(b,true);try{await handler();}catch(e){notice(e);}finally{setButtonBusy(b,false);}});container.append(b);return b;}
function safeImage(src,into){if(typeof src==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(src)&&src.length<400000){const img=el('img');img.src=src;img.alt='Приложенный скриншот';img.loading='lazy';into.append(img);}}
async function imageData(file){
 if(!file)return null;if(!file.type.startsWith('image/'))throw Error('Выбери фото или скриншот');if(file.size>15_000_000)throw Error('Исходный файл слишком большой');
 const url=URL.createObjectURL(file);try{
  const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Не удалось прочитать изображение'));im.src=url;});
  let side=950,quality=.67;let data='';
  for(let i=0;i<6;i++){
    const factor=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight)),cv=document.createElement('canvas');
    cv.width=Math.max(1,Math.round(img.naturalWidth*factor));cv.height=Math.max(1,Math.round(img.naturalHeight*factor));const context=cv.getContext('2d');if(!context)throw Error('Canvas не работает');
    context.fillStyle='#fff';context.fillRect(0,0,cv.width,cv.height);context.drawImage(img,0,0,cv.width,cv.height);
    data=cv.toDataURL('image/jpeg',quality);cv.width=cv.height=1;if(data.length<=350000)break;side*=.78;quality*=.83;
  }
  if(data.length>350000)throw Error('Скриншот слишком большой. Обрежь его и попробуй снова.');return data;
 }finally{URL.revokeObjectURL(url);}
}
async function updateProfile(){try{const d=await call('/me');profile=d.user;settings=d.settings;render();}catch(e){notice(e);}}
// Bonus bank: server is authoritative; this display never computes balances locally.
async function loadBonus(){try{const {bonus}=await call('/bonus');text('bank',bonus.bank);
 const list=$('scheduled');list.replaceChildren();if(!bonus.scheduled.length)empty(list,'Пока ничего не распределено.');
 for(const entry of bonus.scheduled){const item=card(entry.day,`Назначено: ${entry.amount} · использовано: ${entry.spent} · можно вернуть: ${entry.amount-entry.spent}`);
  if(entry.amount>entry.spent)action(item,'↩ Вернуть остаток в банк',async()=>{await call('/bonus/return','POST',{day:entry.day});toast('Неиспользованные бонусы возвращены');await loadBonus();await updateProfile();});
  list.append(item);
 }
 $('bonusDate').min=today();if(!$('bonusDate').value)$('bonusDate').value=today();
 }catch(e){notice(e);}}
$('allocateForm').addEventListener('submit',async e=>{e.preventDefault();try{await call('/bonus/allocate','POST',{day:$('bonusDate').value,amount:Number($('bonusAmount').value)});toast('Вопросы назначены');await loadBonus();await updateProfile();}catch(e){notice(e);}});
// Private support chat (messages cannot be deleted).
function activeThread(){return profile?.role==='admin'?chatUserId:'';}
async function loadSupport(){if(!profile)return;try{
 if(profile.role==='admin'){
  const {threads}=await call('/support/threads');const list=$('chatList');list.replaceChildren();show('chatList',true);
  for(const t of threads){const item=el('button','tile');item.type='button';item.style.fontSize='12px';item.append(el('span','',`${t.name} · ${t.unread} новых · ${t.lastMessage||'Нет сообщений'}`));item.addEventListener('click',()=>{chatUserId=t.id;loadSupport();});list.append(item);}
  if(!threads.length)empty(list,'Ученики ещё не зарегистрированы');
 }
 const target=activeThread();show('chatForm',profile.role!=='admin'||!!target);
 if(profile.role==='admin'&&!target){empty($('chatThread'),'Выбери ученика для переписки.');text('chatTarget','');return;}
 const {messages}=await call('/support/thread'+(target?'/'+target:''));if(target!==activeThread())return;const thread=$('chatThread');thread.replaceChildren();if(!messages.length)empty(thread,'Здесь появится переписка.');
 for(const m of messages){const box=el('div','bubble'+(m.senderId===profile.id?' mine':''));box.append(el('small','',`${m.senderId===profile.id?'Вы':'Собеседник'} · ${time(m.createdAt)}`));if(m.body)box.append(el('div','',m.body));safeImage(m.image,box);thread.append(box);}
 if(profile.role==='admin'){action(thread,'Профиль ученика',async()=>{navigation('admin');await loadAdmin();document.getElementById('user-'+target)?.scrollIntoView();});}
 thread.scrollTop=thread.scrollHeight;text('chatTarget',profile.role==='admin'?'Открыт чат с выбранным учеником':'Чат с администратором');pollUnread();
 }catch(e){notice(e);}}
$('chatForm').addEventListener('submit',async e=>{e.preventDefault();try{
 const img=await imageData($('chatImage').files[0]);const body=$('chatText').value.trim();if(!body&&!img)throw Error('Напиши текст или прикрепи изображение');
 await call('/support/thread'+(activeThread()?'/'+activeThread():''),'POST',{body,image:img});$('chatText').value='';$('chatImage').value='';await loadSupport();toast('Отправлено');
 }catch(e){notice(e);}});
async function pollUnread(){if(!profile)return;try{const r=await call('/support/unread');const n=Number(r.unread)||0;text('unread',n);show('unread',n>0);
 if(n>lastUnread&&lastUnread>=0&&document.visibilityState==='visible'&&typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('scanner test by muyylx',{body:'Есть новые сообщения в поддержке'});
 lastUnread=n;
 }catch{}}
$('enableNotifications').addEventListener('click',async()=>{if(!('Notification'in window)){toast('Браузер не поддерживает эти уведомления');return;}const v=await Notification.requestPermission();toast(v==='granted'?'Уведомления разрешены (при поддержке браузером)':'Уведомления не разрешены');});
setInterval(()=>{if(document.visibilityState==='visible'&&profile){if(currentScreen==='support')loadSupport();else pollUnread();if(currentScreen==='home')loadNotifications();}},30000);
const bugStatus={sent:'Отправлена',review:'На рассмотрении',confirmed:'Подтверждена',rejected:'Отклонена'};
let latestNotice=0;
async function loadNotifications(){
 try{const {items,unread}=await call('/notifications');
 const list=$('noticeList');list.replaceChildren();text('noticeCount',unread||0);
 for(const item of items||[])list.append(el('p',item.is_read?'muted':'',item.body));
 if(!items?.length)empty(list,'Событий пока нет.');
 latestNotice=items?.[0]?.id||0;$('markRead').hidden=!unread;
 }catch(e){text('noticeList',e.message);}
}
$('markRead').onclick=async()=>{try{await call('/notifications/read','POST',{through:latestNotice});await loadNotifications();await updateProfile();}catch(e){notice(e);}};
function statusMessage(kind,status,rewarded=false){if(rewarded)return '✅ Вознаграждение начислено в бонусный банк.';
 if(kind==='bug'&&status==='confirmed')return 'Ошибка подтверждена.';
 if(kind==='bug'&&status==='rejected')return 'Ошибка не подтверждена. Можно обсудить её в поддержке.';
 if(status==='review')return 'Администратор рассматривает заявку.';return 'Заявка успешно отправлена.';}
async function loadBugs(){try{const {bugs}=await call('/bugs');const list=$('myBugs');list.replaceChildren();const own=profile.role==='admin'?[]:bugs;
 if(!own.length)empty(list,'Пока нет сообщений об ошибках');
 for(const b of own){const item=card(b.category==='answer'?'Неправильный ответ ИИ':'Техническая ошибка',b.description,`${bugStatus[b.status]||b.status} · ${time(b.createdAt)}`);item.append(el('p','muted',statusMessage('bug',b.status,b.rewarded)));safeImage(b.screenshot,item);list.append(item);}
 }catch(e){notice(e);}}
$('bugForm').addEventListener('submit',async e=>{e.preventDefault();try{const f=new FormData(e.currentTarget);const screenshot=await imageData($('bugImage').files[0]);if(!screenshot)throw Error('Скриншот обязателен');await call('/bugs','POST',{category:f.get('category'),description:f.get('description'),screenshot});$('bugForm').reset();toast('Жалоба отправлена на проверку');loadBugs();}catch(e){notice(e);}});
// Admin area: server-side checks enforce every operation.
async function loadAdmin(){if(profile?.role!=='admin')return;try{
 const [overview,u,i,threads,bugs]=await Promise.all([call('/admin/overview'),call('/admin/users'),call('/admin/invites'),call('/support/threads'),call('/bugs')]);
 adminData={overview,users:u.users||[],invites:i.invites||[]};
 text('adminStats',`API на связи · учеников ${overview.users.total} · с запросами сегодня ${u.users.filter(x=>x.usedToday>0).length} · вопросов ${overview.totals.questions??0} · непрочитанных сообщений ${threads.threads.reduce((n,t)=>n+t.unread,0)} · новых ошибок ${bugs.bugs.filter(x=>x.status==='sent').length}`);
 $('maint').checked=!!overview.settings.maintenance;$('maintText').value=overview.settings.maintenance_message||'';$('announceText').value=overview.settings.announcement||'';
 renderAdminUsers(adminData.users);renderAdminChats(threads.threads||[]);renderAdminReview('adminBugs',bugs.bugs||[],'bug');
 }catch(e){notice(e);}}
function renderAdminUsers(users){const list=$('adminUsers');list.replaceChildren();if(!users.length)empty(list,'Пока нет учеников');
 for(const u of users){const item=card(u.name,`Лимит ${u.dailyLimit} · использовано сегодня ${u.usedToday} · банк ${u.bank??0} · всего запросов ${u.totalQuestions} · активность ${time(u.lastActive)}`,`ID: ${u.id} · ${u.blocked?'ИИ заблокирован':'Активен'}`),row=el('div','row');
  const inp=el('input');inp.type='number';inp.min='0';inp.max='10000';inp.value=u.dailyLimit;inp.title='Дневной лимит';row.append(inp);
  action(row,'Сохранить',async()=>{await call('/admin/users/'+u.id,'PATCH',{dailyLimit:Number(inp.value)});toast('Лимит изменён');loadAdmin();});
  action(row,u.blocked?'Разблокировать':'Блокировать',async()=>{await call('/admin/users/'+u.id,'PATCH',{blocked:!u.blocked});toast('Статус изменён');loadAdmin();});
  for(const days of [1,3,7])action(row,`${days} дн.`,async()=>{await call('/admin/users/'+u.id,'PATCH',{blocked:false,blockDays:days});toast('Временная блокировка установлена');loadAdmin();});
  action(row,'+ вопросы',async()=>{const amount=Number(prompt('Сколько бонусных вопросов добавить в банк ученика?',10));if(!Number.isInteger(amount)||amount<1||amount>10000)throw Error('Допустимо 1–10000');await call('/admin/community/grant','POST',{userId:u.id,amount});toast('Бонус начислен');});
  action(row,'Восстановить вход',async()=>{if(!confirm('Сбросить старый вход и выдать новый одноразовый код?'))return;const r=await call('/admin/users/'+u.id+'/recover','POST',{});newInviteCode=r.code;text('newInviteValue',r.code);show('newInvite',true);toast('Код создан, старые сеансы сброшены');});
  item.id='user-'+u.id;
  action(row,'Сбросить обычный счётчик',async()=>{await call('/admin/users/'+u.id,'POST',{action:'reset_today'});await loadAdmin();});
  action(row,'Переписка',()=>{chatUserId=u.id;navigation('support');});
  action(row,'Обращения',()=>{for(const box of document.querySelectorAll('[data-author]'))box.hidden=box.dataset.author!==u.id;document.getElementById('adminBugs').scrollIntoView();});
  item.append(row);list.append(item);
 }
}
function renderAdminChats(threads){const list=$('adminChats');list.replaceChildren();if(!threads.length)empty(list,'Никто ещё не зарегистрирован');for(const t of threads){const box=card(t.name,`Непрочитано: ${t.unread} · ${t.lastMessage||'Пока пусто'}`);action(box,'Открыть чат',()=>{chatUserId=t.id;navigation('support');});list.append(box);}}
function renderAdminReview(id,entries,kind){const list=$(id);list.replaceChildren();if(!entries.length)empty(list,'Новых заявок нет');
 const statuses=bugStatus;
 for(const value of entries){const box=card(`${value.author||value.userId.slice(0,8)}: ${value.title|| (value.category==='answer'?'Ошибка ИИ':'Баг')}`,value.description,`${statuses[value.status]||value.status} · ${time(value.createdAt)} · ID ${value.userId.slice(0,8)}`);
  box.dataset.author=value.userId;safeImage(value.image||value.screenshot,box);
  const select=el('select');const values=['sent','review','confirmed','rejected'];
  for(const key of values){const opt=el('option','',statuses[key]);opt.value=key;select.append(opt);}select.value=value.status;
  const row=el('div','row');row.append(select);
  action(row,'Сохранить статус',async()=>{const path=`/admin/community/bugs/${value.id}`;await call(path,'PATCH',{status:select.value});toast('Статус обновлён');loadAdmin();});
  if(value.rewarded)row.append(el('span','badgetext','✅ Вознаграждение начислено'));
  else if(value.status==='confirmed'){
    const amount=10;
    action(row,'Начислить +10',async()=>{await call(`/admin/community/bugs/${value.id}/reward`,'POST',{});toast(`${amount} вопросов добавлены в бонусный банк`);loadAdmin();});
  }
  box.append(row);list.append(box);
 }
}
$('refreshAdmin').addEventListener('click',loadAdmin);
$('inviteAdminForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await call('/admin/invites','POST',{name:$('inviteName').value.trim(),dailyLimit:Number($('inviteLimit').value)});newInviteCode=r.code;text('newInviteValue',r.code);show('newInvite',true);toast('Код создан. Скопируй и отправь ученику.');loadAdmin();}catch(e){notice(e);}});
$('copyInvite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(newInviteCode);toast('Код скопирован');}catch{toast('Скопируй код вручную');}});
$('adminSettingsForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await call('/admin/settings','POST',{maintenance:$('maint').checked,maintenanceMessage:$('maintText').value,announcement:$('announceText').value});settings=r.settings;render();toast('Настройки сохранены');loadAdmin();}catch(e){notice(e);}});
// Remove legacy SW that can cache earlier site/panel versions.
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.filter(r=>r.scope===new URL('./',location.href).href).forEach(r=>r.unregister())).catch(()=>{});
start();
})();
