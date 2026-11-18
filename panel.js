(() => {
'use strict';
const cfg=window.STUDY_CONFIG||{}, api=String(cfg.apiBase||'').replace(/\/$/,'');
const $=id=>document.getElementById(id);
let token='',device='',me=null,image='',popup=null,pairNonce='',busy=false,awaitingRead=false;
const hostParam=new URL(location.href).searchParams.get('host');
let parentOrigin='';
try{const origin=new URL(hostParam||document.referrer);if(/^https?:$/.test(origin.protocol))parentOrigin=origin.origin;}catch{}
const SESSION_KEY='study3_paired_session_v2';
function msg(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(msg.timer);msg.timer=setTimeout(()=>$('toast').hidden=true,5000);}
function save(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({token,device}));}catch{}}
function remove(){try{localStorage.removeItem(SESSION_KEY);}catch{}}
function view(on){$('loginState').hidden=on;$('workState').hidden=!on;if(on){$('who').textContent=me.name;$('remaining').textContent=me.remaining===null?'Без личного лимита':`${me.remaining} осталось`;}}
async function request(path,method='GET',data=null){if(!api.startsWith('https://'))throw Error('Не настроен адрес облачного сервера.');const headers={'content-type':'application/json','authorization':'Bearer '+token,'x-study-device':device};let r;try{r=await fetch(api+path,{signal:AbortSignal.timeout(60000),method,headers,body:data===null?undefined:JSON.stringify(data),cache:'no-store'});}catch{throw Error('Нет связи с облачным сервером.');}const res=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(res.error||'Ошибка сервера'),{status:r.status});return res;}
async function validate(){const res=await request('/me');me=res.user;view(true);return res;}
function clear(){clearLesson();token='';device='';me=null;remove();view(false);}
function tokenFromStorage(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(s&&/^[a-f0-9]{64}$/.test(s.token||'')&&/^[a-f0-9]{64}$/.test(s.device||'')){token=s.token;device=s.device;return true;}}catch{}return false;}
function id(){const a=crypto.getRandomValues(new Uint8Array(16));return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
$('connect').addEventListener('click',()=>{
 pairNonce=id();const target=new URL('./panel-connect.html',location.href);target.searchParams.set('nonce',pairNonce);
 popup=window.open(target.href,'_blank');
 if(!popup){msg('Safari не открыл страницу подключения. Разреши всплывающее окно для scanner test by muyylx.');return;}
 $('loginHelp').textContent='Открой появившуюся вкладку, подтверди вход и вернись сюда.';
});
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||!popup||event.source!==popup||event.data?.type!=='STUDY_PANEL_CONNECT'||event.data?.nonce!==pairNonce)return;
 const t=String(event.data.token||''),d=String(event.data.device||'');
 if(!/^[a-f0-9]{64}$/.test(t)||!/^[a-f0-9]{64}$/.test(d))return;
 token=t;device=d;pairNonce='';
 try{await validate();save();msg('Аккаунт подключён. Повторная регистрация не нужна.');}
 catch(e){clear();msg('Не удалось подключиться: '+e.message);}
});
$('disconnect').addEventListener('click',()=>{clear();msg('Панель отключена. Аккаунт на основном сайте сохранён.');});
async function refresh(){try{await validate();}catch(e){if(e.status===401)clear();msg(e.message);}}
const lessonFields={grade:'Класс',subject:'Предмет',topic:'Тема или произведение',excerpt:'Отрывок или заметка'};
function clearLesson(){for(const key of Object.keys(lessonFields))$(key).value='';}
$('clearLesson').addEventListener('click',clearLesson);
function withLesson(question){
 const notes=Object.entries(lessonFields).map(([key,label])=>[label,$(key).value.trim()]).filter(([,value])=>value);
 const guidance='Сверь ответ с формулировкой, отрицаниями и видимыми вариантами. Если вопрос отсылает к неизвестному произведению или отсутствующему отрывку и надёжного ответа нет, напиши «Недостаточно данных». Только итог.';
 const parts=[guidance, 'Задание: '+question];
 if(notes.length)parts.push('Справка ученика (учитывай только относящееся к вопросу): '+JSON.stringify(Object.fromEntries(notes)));
 const input=parts.join('\n');
 if(input.length>6500)throw Error('Слишком много текста. Сократи отрывок или выдели только вопрос с вариантами.');
 return input;
}
async function send(question){
 if(busy)return;if(!question&&!image){$('answer').textContent='Вопрос не найден. Выдели текст задания или прикрепи скриншот.';msg('Не удалось прочитать вопрос. Прикрепи скриншот через скрепку.');return;}
 const exact=!image && window.scannerArithmetic?.(question);
 if(typeof exact==='string'){$('answer').textContent=exact;return;}
 busy=true;$('scan').disabled=true;$('answer').textContent='Обрабатываем вопрос в облаке…';
 try{const response=await request('/ask','POST',{question:withLesson(question||'Прочитай вопрос и варианты на изображении.'),image:image||undefined});$('answer').textContent=response.answer;await refresh();}
 catch(e){$('answer').textContent='Ошибка: '+e.message;if(e.status===401)clear();}
 finally{busy=false;$('scan').disabled=false;}
}
$('scan').addEventListener('click',()=>{
 if(busy)return;
 if(window.parent===window){msg('Сканирование доступно после запуска закладки поверх учебной страницы.');return;}
 awaitingRead=true;$('answer').textContent='Читаем текст страницы…';window.parent.postMessage({type:'STUDY_OVERLAY_READ_PAGE'},parentOrigin||'*');
 setTimeout(()=>{if(awaitingRead){awaitingRead=false;if(image){send('Разбери задание на прикреплённом изображении.');}else{$('answer').textContent='Не удалось прочитать вопрос со страницы. Попробуй скриншот через скрепку.';}}},4000);
});
window.addEventListener('message',event=>{
 if(window.parent===window||event.source!==window.parent||(parentOrigin&&event.origin!==parentOrigin)||!awaitingRead||!event.data||event.data.type!=='STUDY_OVERLAY_PAGE_TEXT')return;
 awaitingRead=false;const question=String(event.data.text||'').trim().slice(0,6500);send(question);
});
async function compressPhoto(file){
 if(!file.type.startsWith('image/'))throw Error('Выбери фото или скриншот');if(file.size>15_000_000)throw Error('Фото слишком большое');
 const raw=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(Error('Не прочитали фото'));fr.readAsDataURL(file);});
 const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Не удалось открыть фото'));im.src=raw;});
 const scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(!ctx)throw Error('Нет поддержки обработки фото');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
 const result=c.toDataURL('image/jpeg',.68);c.width=c.height=0;if(result.length>1_450_000)throw Error('Изображение слишком большое. Обрежь его.');return result;
}
$('photo').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{image=await compressPhoto(file);$('imageSection').hidden=false;$('sendPhoto').hidden=false;$('imageName').textContent='📎 '+file.name.slice(0,30);msg('Фото прикреплено');}catch(error){msg(error.message);}e.target.value='';});
$('removePhoto').addEventListener('click',()=>{image='';$('imageSection').hidden=true;$('sendPhoto').hidden=true;});
$('sendPhoto').addEventListener('click',()=>send('Прочитай вопрос и варианты на изображении.'));
if(window.parent===window){
 $('connect').hidden=true; $('loginHelp').textContent='Войди в кабинет и вернись на эту страницу.';
 $('scan').hidden=true;
 try{token=localStorage.getItem('study_3_token')||'';device=localStorage.getItem('study_3_device')||'';}catch{}
 $('answer').textContent='Прикрепи скриншот задания и нажми «Разобрать фото».';
}
window.addEventListener('pageshow',()=>{if(window.parent===window&&!me){
 try{const saved=localStorage.getItem('study_3_token');if(saved){token=saved;device=localStorage.getItem('study_3_device')||'';validate().catch(e=>msg(e.message));}}catch{}
}});
view(false);if(token||tokenFromStorage())validate().catch(e=>{if(e.status===401)clear();msg(e.message);});
if(window.parent!==window)window.parent.postMessage({type:'STUDY_PANEL_READY'},'*');
})();
