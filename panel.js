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
const panelBuild=new URL(document.currentScript?.src||location.href).searchParams.get('v');
let releaseUser=null;
async function ownerRelease(user){
 const badge=$('ownerRelease');
 if(user?.role!=='admin'){releaseUser=null;badge.hidden=true;badge.textContent='';return;}
 if(releaseUser===user.id && !badge.hidden)return;
 releaseUser=user.id;badge.hidden=false;badge.textContent='Проверяем обновление…';
 try{
  const response=await fetch('./panel-release.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw Error();
  const {build}=await response.json();if(typeof build!=='string')throw Error();
  if(me?.role==='admin'&&me.id===user.id)badge.textContent=build===panelBuild?'✓ Обновление подключено · '+build:'Доступно обновление · переоткрой панель';
 }catch{if(me?.role==='admin'&&me.id===user.id){badge.textContent='Версию подтвердить не удалось';releaseUser=null;}}
}
function view(on){ownerRelease(on?me:null);$('loginState').hidden=on;$('workState').hidden=!on;if(on){$('who').textContent=me.name;$('remaining').textContent=me.remaining===null?'Без личного лимита':`${me.remaining} осталось`;}}
async function request(path,method='GET',data=null){if(!api.startsWith('https://'))throw Error('Не настроен адрес облачного сервера.');const headers={'content-type':'application/json','authorization':'Bearer '+token,'x-study-device':device};let r;try{r=await fetch(api+path,{signal:AbortSignal.timeout(path==='/ask'?16000:60000),method,headers,body:data===null?undefined:JSON.stringify(data),cache:'no-store'});}catch(e){if(e?.name==='TimeoutError'||e?.name==='AbortError')throw Error('Время ожидания ответа истекло. Попробуй ещё раз.');throw Error('Не удалось соединиться с сервером.');}const res=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(res.error||'Ошибка сервера'),{status:r.status});return res;}
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
const lessonFields={grade:'Класс',subject:'Предмет',topic:'Тема или произведение'};
function clearLesson(){for(const key of Object.keys(lessonFields))$(key).value='';}
$('clearLesson').addEventListener('click',clearLesson);
function withLesson(question){
 const notes=Object.entries(lessonFields).map(([key,label])=>[label,$(key).value.trim()]).filter(([,value])=>value);
 const guidance='Ответь на языке задания. По умолчанию выбери ровно один наиболее полный вариант. Несколько ответов допустимы по явному указанию в задании. Используй предметные знания даже если класс и тема не указаны. Проверь отрицания («НЕ», «крім»), число требуемых ответов и точное соответствие букв вариантам. Для соответствий верни все пары, для последовательности — порядок. Для карты учитывай легенду, координаты и масштаб, для биологической схемы — подписи и направление стрелок, для литературы — различай автора, рассказчика и героя, сверяй цитаты с отрывком. На самостоятельный вопрос отвечай по знаниям. Если необходимой карты, схемы или отрывка нет или подпись не читается, не угадывай. Только итог.';
 const parts=[guidance];
 if(/підрядн|сполучн|членом речення/iu.test(question)){
   parts.push('Для каждого варианта восстанови обе грамматические основы и смысл связи. Сполучне слово выполняет синтаксическую роль: попробуй заменить его на який в нужном падеже. Сполучник только связывает части. Цель отвечает на навіщо, причина на чому, последствие обозначает результат и обычно вводится так що. Для з’ясувального найди опорное слово мысли, речи, восприятия или чувства и задай от него падежный вопрос ко всей придаточной части. Для придаточного времени задай вопрос «коли відбувається дія?». Сравни эту зависимость у всех вариантов даже при одинаковом «коли». Выведи только выбранный вариант.');
 }
 parts.push('Задание: '+question);
 if(notes.length)parts.push('Справка ученика (учитывай только относящееся к вопросу): '+JSON.stringify(Object.fromEntries(notes)));
 const input=parts.join('\n');
 if(input.length>6500)throw Error('Слишком много текста. Сократи текст или выдели только вопрос с вариантами.');
 return input;
}
async function send(question){
 if(busy)return;
 $('readout').hidden=false;$('readText').textContent=question||'Только фото';$('method').textContent='';
 if(!question&&!image){$('answer').textContent='Вопрос не найден. Выдели текст задания или прикрепи скриншот.';msg('Не удалось прочитать вопрос. Прикрепи скриншот через скрепку.');return;}
 const prompt=question.split(/\nВарианты:/u)[0];
 const referencesFigure=/(?:на|за|по)\s+(?:схем[іеу]|карт[іеу]|рисунк[уе]|малюнк[уе]|ілюстрації|изображении|фото)/iu.test(prompt);
 const referencesMark=/(?:познач|обознач|цифр|стрілк|стрелк|нумер|номер|літер|букв)/iu.test(prompt);
 if(!image&&referencesFigure&&referencesMark){
   $('method').textContent='Нужно изображение';
   $('answer').textContent='Прикрепи карту или схему с обозначениями.';
   return;
 }
 const exact=image ? null : window.scannerArithmetic?.(question);
 if(typeof exact==='string'){$('method').textContent='Точный расчёт по тексту';$('answer').textContent=exact;return;}
 $('method').textContent=image?'Модель · прикреплено фото':'Модель · текст';
 const submittedImage=image;
 if(submittedImage)question+='\nСверь условие, выделенные слова и все варианты по приложенному снимку. При расхождении текста страницы со снимком используй задание на снимке.';
 busy=true;$('scan').disabled=true;$('answer').textContent='Обрабатываем вопрос в облаке…';
 try{const response=await request('/ask','POST',{question:withLesson(question||'Прочитай вопрос и варианты на изображении.'),image:submittedImage||undefined});$('answer').textContent=response.answer;if(submittedImage&&image===submittedImage)$('removePhoto').click();await refresh();}
 catch(e){$('answer').textContent='Ошибка: '+e.message;if(e.status===401)clear();}
 finally{busy=false;$('scan').disabled=false;}
}
$('manualForm').addEventListener('submit',event=>{
 event.preventDefault();
 const value=$('manualQuestion').value.trim();
 if(value.length>=3)send(value);
});
$('scan').addEventListener('click',()=>{
 if(busy||awaitingRead)return;
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
 const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(!ctx)throw Error('Нет поддержки обработки фото');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
 let result=c.toDataURL('image/jpeg',.86);if(result.length>1_450_000)result=c.toDataURL('image/jpeg',.65);c.width=c.height=0;if(result.length>1_450_000)throw Error('Изображение слишком большое. Обрежь его.');return result;
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
