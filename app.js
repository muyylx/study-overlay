(() => {
'use strict';
const cfg=window.STUDY_CONFIG||{};
const api=String(cfg.apiBase||'').replace(/\/+$/,'');
const configured=/^https:\/\/[^/]+\.[^/]+/.test(api)&&!api.includes('CHANGE-ME');
const embedded=window.parent!==window;
if(embedded)document.body.classList.add('embedded');
const $=id=>document.getElementById(id);
const deviceKey='study_3_device',tokenKey='study_3_token';
let storageWorks=true;
const storage={
 get(k){try{return localStorage.getItem(k);}catch{storageWorks=false;return null;}},
 set(k,v){try{localStorage.setItem(k,v);}catch{storageWorks=false;}},
 remove(k){try{localStorage.removeItem(k);}catch{storageWorks=false;}}
};
const device=(()=>{let d=storage.get(deviceKey);if(!/^[a-f0-9]{64}$/.test(d||'')){d=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');storage.set(deviceKey,d);}return d;})();
let token=storage.get(tokenKey)||'';
let me=null;
let siteSettings=null;
let currentImage='';
let latestAnswer='';
let latestInviteCode='';
const safeText=(el,value)=>{if(el)el.textContent=String(value??'');};
const show=(id,on)=>$(id)?.classList.toggle('hidden',!on);
const fmt=n=>new Intl.NumberFormat('ru-RU').format(Number(n)||0);
const dt=s=>{if(!s)return 'ещё не было';try{return new Date(s).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});}catch{return s;}};
const toast=(message)=>{const n=$('toast');safeText(n,message);show('toast',true);clearTimeout(toast.timer);toast.timer=setTimeout(()=>show('toast',false),4300);};
function setToken(t){token=t||'';if(token)storage.set(tokenKey,token);else storage.remove(tokenKey);}
async function call(path,method='GET',body=null,authed=true){
 if(!configured)throw new Error('Сначала укажи адрес Cloudflare Worker в файле config.js');
 const headers={'content-type':'application/json','x-study-device':device};
 if(authed&&token)headers.authorization=`Bearer ${token}`;
 let response;
 try{response=await fetch(api+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});}
 catch{throw new Error('Нет связи с облачным сервером. Проверь интернет, Cloudflare и настройку config.js.');}
 const result=await response.json().catch(()=>({error:'Сервер вернул не-JSON ответ'}));
 if(!response.ok)throw Object.assign(new Error(result.error||`Ошибка сервера ${response.status}`),{status:response.status});
 return result;
}
function loader(button,on,loadingText='Выполняется…'){
 if(!button)return; if(on){button.dataset.original=button.textContent;button.textContent=loadingText;button.disabled=true;}
 else{button.textContent=button.dataset.original||button.textContent;button.disabled=false;}
}
function applySettings(s){
 siteSettings=s||{maintenance:0,maintenance_message:'Технические работы',announcement:''};
 const msg=String(siteSettings.announcement||'');
 show('announcementBar',!!msg&&!siteSettings.maintenance);safeText($('announcementBar'),msg);
 safeText($('maintenanceText'),siteSettings.maintenance_message||'Сайт временно недоступен');
}
function renderPage(){
 show('notConfigured',!configured);
 if(!configured){show('authSection',false);show('appSection',false);show('maintenanceSection',false);return;}
 const maintenance=!!siteSettings?.maintenance&&me?.role!=='admin';
 show('maintenanceSection',maintenance);
 show('authSection',!me&&!maintenance);
 show('appSection',!!me&&!maintenance);
 show('topLogout',!!me);
 if(me){safeText($('helloName'),me.name);safeText($('profileName'),me.name);safeText($('profileRole'),me.role==='admin'?'Super Admin':'Участник');safeText($('avatar'),me.name.slice(0,1).toUpperCase());show('adminTab',me.role==='admin');}
}
function refreshStats(profile,totals){
 me=profile;
 safeText($('statRemaining'),profile.limit===null?'∞':fmt(profile.remaining));
 safeText($('statLimit'),profile.limit===null?'Без личного лимита · общий облачный ресурс ограничен':`${profile.used} из ${profile.limit} вопросов · сброс в 00:00 UTC`);
 safeText($('statToday'),fmt(totals.questions));
 safeText($('statNeurons'),'≈ '+fmt(totals.estimatedRemainingQuestions));
 $('quotaBar').style.width=profile.limit===null?'100%':`${Math.max(0,100-100*(profile.used/profile.limit||0))}%`;
}
async function restore(){
 if(!configured){safeText($('serverStatus'),'● Не подключено');$('serverStatus').className='health-pill bad';renderPage();return;}
 try{
  const p=await call('/public','GET',null,false);applySettings(p.settings);show('setupBox',!!p.setupRequired);
  safeText($('serverStatus'),'● Облако онлайн');$('serverStatus').className='health-pill good';
  if(token){try{const data=await call('/me');me=data.user;refreshStats(data.user,data.totals);applySettings(data.settings);}
   catch(e){if(e.status===401||e.status===403){setToken('');me=null;}else toast(e.message);}}
 }catch(e){safeText($('serverStatus'),'● Нет связи');$('serverStatus').className='health-pill bad';toast(e.message);}
 renderPage();if(new URL(location.href).searchParams.get('admin')==='1'){if(me?.role==='admin')setActiveTab('admin');else show('adminLoginForm',true);}else if(me?.role==='admin')loadAdmin();
}
function setActiveTab(tab){
 for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===tab);
 for(const name of ['study','guide','admin'])show(`tab${name[0].toUpperCase()+name.slice(1)}`,name===tab);
 if(tab==='admin' && me?.role==='admin')loadAdmin();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setActiveTab(b.dataset.tab)));
$('toggleAdminLogin').addEventListener('click',()=>show('adminLoginForm',$('adminLoginForm').classList.contains('hidden')));
async function onLogin(e,path,body){e.preventDefault();if(!storageWorks){toast('Safari заблокировал сохранение входа. Открой Study Overlay в отдельной вкладке.');return;}const btn=e.submitter;loader(btn,true,'Проверяем…');try{
 const res=await call(path,'POST',{...body,device},false);
 setToken(res.token);me=res.user;toast('Вход выполнен. Добро пожаловать!');await restore();
 }catch(e){toast(e.message);}finally{loader(btn,false);}}
$('maintenanceAdminToggle').addEventListener('click',()=>show('maintenanceAdminForm',$('maintenanceAdminForm').classList.contains('hidden')));
$('maintenanceAdminForm').addEventListener('submit',e=>onLogin(e,'/admin/login',{login:$('maintenanceLogin').value,password:$('maintenancePassword').value}));
$('redeemForm').addEventListener('submit',e=>onLogin(e,'/auth/redeem',{code:$('inviteCode').value}));
$('adminLoginForm').addEventListener('submit',e=>onLogin(e,'/admin/login',{login:$('adminLogin').value,password:$('adminPassword').value}));
$('setupForm').addEventListener('submit',e=>{const f=new FormData(e.currentTarget);onLogin(e,'/admin/setup',{name:f.get('name'),login:f.get('login'),password:f.get('password'),secret:f.get('secret')});});
$('topLogout').addEventListener('click',async()=>{try{await call('/auth/logout','POST',{});}catch{}setToken('');me=null;renderPage();setActiveTab('study');toast('Вы вышли из аккаунта');});
async function resizeImage(file){
 if(!file.type.startsWith('image/'))throw new Error('Выбери файл с изображением');
 if(file.size>15_000_000)throw new Error('Исходное изображение слишком большое (максимум 15 МБ)');
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,1100/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');
 if(!ctx)throw new Error('Не удалось обработать изображение');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();
 const result=cv.toDataURL('image/jpeg',0.73);cv.width=cv.height=0;
 if(result.length>1_500_000)throw new Error('Скриншот не удалось сжать. Обрежь его перед загрузкой.');
 return result;
}
$('imageUpload').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;
 try{currentImage=await resizeImage(file);$('imagePreview').src=currentImage;safeText($('imageInfo'),`Скриншот прикреплён · ${Math.ceil(currentImage.length*3/4/1024)} КБ`);show('imagePreviewWrap',true);show('clearImage',true);toast('Скриншот готов к отправке');}
 catch(error){toast(error.message);currentImage='';}
 e.target.value='';
});
$('clearImage').addEventListener('click',()=>{currentImage='';$('imagePreview').removeAttribute('src');show('imagePreviewWrap',false);show('clearImage',false);});
$('askForm').addEventListener('submit',async e=>{e.preventDefault();const question=$('question').value.trim();if(!question&&!currentImage){toast('Введи вопрос или добавь скриншот');return;}
 const button=$('askButton');loader(button,true,'ИИ разбирает вопрос…');show('answerPlaceholder',false);show('answerText',true);safeText($('answerText'),'Обрабатываем задание в облаке…');
 try{const res=await call('/ask','POST',{question,image:currentImage||undefined});latestAnswer=res.answer;safeText($('answerText'),res.answer);show('copyAnswer',true);const fresh=await call('/me');refreshStats(fresh.user,fresh.totals);applySettings(fresh.settings);}
 catch(error){safeText($('answerText'),`Ошибка: ${error.message}`);toast(error.message);if(error.status===503){await restore();}}
 finally{loader(button,false);}
});
$('copyAnswer').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(latestAnswer);toast('Ответ скопирован');}catch{toast('Не получилось скопировать ответ');}});
$('readPage').addEventListener('click',()=>{if(!embedded){toast('Для чтения страницы запусти Study Overlay через закладку на учебном сайте.');return;}
 try{window.parent.postMessage({type:'STUDY_OVERLAY_READ_PAGE'},'*');toast('Читаем видимый текст страницы…');}catch{toast('Не удалось запросить текст страницы');}});
window.addEventListener('message',event=>{
 if(!embedded||event.source!==window.parent||!event.data||event.data.type!=='STUDY_OVERLAY_PAGE_TEXT')return;
 const text=String(event.data.text||'').trim();
 if(!text){toast('Не удалось считать вопрос. Скопируй текст или добавь скриншот.');return;}
 $('question').value=text.slice(0,6500);toast('Текст страницы вставлен. Проверь условие перед отправкой.');
});
$('collapseFromFrame').addEventListener('click',()=>window.parent.postMessage({type:'STUDY_OVERLAY_HIDE_PANEL'},'*'));
show('collapseFromFrame',embedded);
async function loadAdmin(){if(!me||me.role!=='admin')return;
 try{
  const [view,userData,inviteData,log]=await Promise.all([call('/admin/overview'),call('/admin/users'),call('/admin/invites'),call('/admin/log')]);
  safeText($('adminUsersCount'),fmt(view.users.total));safeText($('adminQuestions'),fmt(view.totals.questions));safeText($('adminLeft'),'≈ '+fmt(view.totals.estimatedRemainingQuestions));
  $('maintenanceToggle').checked=!!view.settings.maintenance;
  $('maintenanceMessage').value=view.settings.maintenance_message||'';$('announcementMessage').value=view.settings.announcement||'';
  renderUsers(userData.users||[]);renderInvites(inviteData.invites||[]);renderLog(log.events||[]);
 }catch(e){toast(e.message);}
}
function makeNode(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;}
function renderUsers(users){const list=$('usersList');list.replaceChildren();if(!users.length){list.append(makeNode('p','muted','Пока нет пользователей. Создай первое приглашение.'));return;}
 for(const u of users){
  const card=makeNode('div','user-card');
  const header=makeNode('div','user-head'),who=makeNode('div','');who.append(makeNode('strong','',u.name),makeNode('small','',`ID: ${u.id.slice(0,8)} · Активность: ${dt(u.lastActive)}`));header.append(who,makeNode('span',`status-tag${u.blocked?' blocked':''}`,u.blocked?'Заблокирован':'Активен'));card.append(header);
  const stats=makeNode('div','user-metrics');stats.append(makeNode('span','',`Сегодня: ${u.usedToday} / ${u.dailyLimit}`),makeNode('span','',`Всего: ${u.totalQuestions}`),makeNode('span','',`Расход: ≈${u.estimatedNeuronsToday} Neurons`));card.append(stats);
  const controls=makeNode('div','user-controls');const limit=makeNode('input');limit.type='number';limit.min=0;limit.max=10000;limit.value=u.dailyLimit;limit.setAttribute('aria-label','Дневной лимит для '+u.name);
  const save=makeNode('button','btn ghost tiny','Сохранить лимит');const block=makeNode('button',`btn tiny ${u.blocked?'secondary':'danger'}`,u.blocked?'Разблокировать':'Блокировать');const reset=makeNode('button','btn ghost tiny','Сброс сегодня');const recover=makeNode('button','btn ghost tiny','Новый код / смена устройства');
  save.addEventListener('click',()=>runUserAction(`/admin/users/${u.id}`,'PATCH',{dailyLimit:Number(limit.value)},`Лимит для ${u.name} изменён`));
  block.addEventListener('click',()=>runUserAction(`/admin/users/${u.id}`,'PATCH',{blocked:!u.blocked},`${u.name}: статус изменён`));
  reset.addEventListener('click',()=>{if(confirm(`Сбросить использованные сегодня вопросы для ${u.name}?`))runUserAction(`/admin/users/${u.id}`,'POST',{action:'reset_today'},'Счётчик сброшен');});
  recover.addEventListener('click',async()=>{if(!confirm(`Сбросить привязку устройства ${u.name}? Старые сеансы завершатся, потребуется новый код.`))return;
   try{const res=await call(`/admin/users/${u.id}/recover`,'POST',{});revealCode(res);toast('Выдан новый одноразовый код');await loadAdmin();}catch(e){toast(e.message);}
  });
  controls.append(limit,save,block,reset,recover);card.append(controls);list.append(card);
 }
}
async function runUserAction(path,method,data,message){try{await call(path,method,data);toast(message);await loadAdmin();}catch(e){toast(e.message);}}
function revealCode(result){latestInviteCode=result.code;safeText($('generatedCode'),result.code);show('generatedInvite',true);}
$('createInviteForm').addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.currentTarget);const btn=e.submitter;loader(btn,true,'Создаём код…');try{const result=await call('/admin/invites','POST',{name:String(form.get('name')),dailyLimit:Number(form.get('dailyLimit'))});revealCode(result);toast('Код создан. Он виден только сейчас!');await loadAdmin();}catch(error){toast(error.message);}finally{loader(btn,false);}});
$('copyInvite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(latestInviteCode);toast('Код скопирован');}catch{toast('Выдели код и скопируй вручную');}});
$('settingsForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;loader(btn,true,'Сохраняем…');try{const result=await call('/admin/settings','POST',{maintenance:$('maintenanceToggle').checked,maintenanceMessage:$('maintenanceMessage').value,announcement:$('announcementMessage').value});applySettings(result.settings);toast('Настройки сайта сохранены');await loadAdmin();}catch(error){toast(error.message);}finally{loader(btn,false);}});
function renderInvites(items){const list=$('invitesList');list.replaceChildren();if(!items.length){list.append(makeNode('p','muted','Пока нет приглашений'));return;}
 for(const i of items){const row=makeNode('div','mini-item'),status=i.cancelledAt?'Отозван':i.redeemedAt?'Использован':new Date(i.expiresAt)<new Date()?'Истёк':'Ожидает активации';row.append(makeNode('strong','',`${i.name} · ${status}`),makeNode('small','',`Лимит ${i.dailyLimit}/день · создан ${dt(i.createdAt)}`));
  if(!i.cancelledAt&&!i.redeemedAt&&new Date(i.expiresAt)>new Date()){const btn=makeNode('button','btn ghost tiny','Отозвать');btn.addEventListener('click',async()=>{try{await call(`/admin/invites/${i.id}/cancel`,'POST',{});toast('Приглашение отозвано');await loadAdmin();}catch(e){toast(e.message);}});row.append(btn);}list.append(row);
 }
}
function renderLog(items){const list=$('auditList');list.replaceChildren();if(!items.length){list.append(makeNode('p','muted','Записей ещё нет'));return;}
 for(const item of items){const row=makeNode('div','mini-item');row.append(makeNode('strong','',item.action),makeNode('small','',`${dt(item.at)} ${item.target?'· '+item.target.slice(0,8):''}`));list.append(row);}
}
$('refreshAdmin').addEventListener('click',loadAdmin);
if(embedded){window.addEventListener('keydown',event=>{if(event.key==='Escape')window.parent.postMessage({type:'STUDY_OVERLAY_HIDE_PANEL'},'*');});}
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.filter(r=>r.scope.startsWith(new URL('./',location.href).href)).forEach(r=>r.unregister())).catch(()=>{});}
restore();
})();
