(() => {
'use strict';
const cfg=window.STUDY_CONFIG||{}, api=String(cfg.apiBase||'').replace(/\/$/,'');
const $=id=>document.getElementById(id);
let photoRevision=0,sessionRevision=0;
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
async function request(path,method='GET',data=null){if(!api.startsWith('https://'))throw Error('Не настроен адрес облачного сервера.');const headers={'content-type':'application/json','authorization':'Bearer '+token,'x-study-device':device};let r;try{r=await fetch(api+path,{signal:AbortSignal.timeout(path==='/ask'?(data?.image?23500:16000):60000),method,headers,body:data===null?undefined:JSON.stringify(data),cache:'no-store'});}catch(e){if(e?.name==='TimeoutError'||e?.name==='AbortError')throw Error('Время ожидания ответа истекло. Попробуй ещё раз.');throw Error('Не удалось соединиться с сервером.');}const res=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(res.error||'Ошибка сервера'),{status:r.status});return res;}
async function validate(){const res=await request('/me');me=res.user;view(true);return res;}
function clear(){clearRecent();$('answer').textContent='';$('readText').textContent='';$('manualQuestion').value='';$('removePhoto').click();sessionRevision++;clearLesson();token='';device='';me=null;remove();view(false);}
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
async function refresh(){
 const revision=sessionRevision;
 try{const res=await request('/me');if(revision===sessionRevision){me=res.user;view(true);}}
 catch(e){if(revision!==sessionRevision)return;if(e.status===401)clear();msg(e.message);}
}
// Only the stem and lesson metadata participate. Choices may contain distractor authors.
function scanLesson(stem,pageTopic='',pageSubject='',pageAuthor=''){
  const text=String(stem||'').split(/\n(?:Варианты|варіанти відповідей|answer choices):?/iu)[0];
  const work=text.match(/(?:роман[іуеа]?|повіст[іюь]|твор[іуеа]?|поем[іиаы]|оповіданн[ія]|п'єс[іаи]|novel|poem)\s+[«„“"]([^»”"\n]{2,110})[»”"]/iu)?.[1];
  const books=[
    [/тигролови|тигроловы|григор.{0,12}многогріш/iu,'Тигролови','Іван Багряний','Українська література'],
    [/тарас\s+бульб/iu,'Тарас Бульба','Микола Гоголь','Література'],
    [/різдвяна пісня|рождественская песнь|a christmas carol/iu,'Різдвяна пісня в прозі','Чарльз Дікенс','Зарубіжна література'],
    [/вітька\s*(?:\+|і|та)\s*галя|вітьк[аоиуі] гороб/iu,'Вітька + Галя','Валентин Чемерис','Українська література'],
    [/лісова пісня/iu,'Лісова пісня','Леся Українка','Українська література'],
    [/захар беркут/iu,'Захар Беркут','Іван Франко','Українська література']
  ];
  const book=books.find(([re])=>re.test(work||text))||(!work&&books.find(([re])=>re.test(pageTopic)));
  const topic=work||pageTopic||book?.[1]||'';
  const named=text.match(/(?:автор(?:ка)? (?:твору|произведения)|work author)\s*[:：]\s*([^\n.?!;:]{3,85})(?:$|\n)/imu)?.[1];
  // Accept a bibliographic title only when a named writer is paired with a quoted work.
  const citation=String(pageTopic).replace(/^(?:тест|тема)\s*:\s*/iu,'').match(/^([А-ЯІЇЄҐA-Z][\p{L}’'-]+(?:\s+[А-ЯІЇЄҐA-Z][\p{L}’'-]+){1,2})\s*[.:—–-]?\s*[«„“"]([^»”"\n]{2,110})[»”"]/u);
  const paired=citation&&(!work||citation[2].toLowerCase()===work.toLowerCase());
  const subjects=[[/раціональн.{0,5} числ|рациональн.{0,5} числ|додаванн|відніманн|дроб[иіья]|рівнян|уравнен|алгебр|equation|трикутник|геометр/iu,'Математика'],[/фотосинтез|біолог|біосфер|митоз/iu,'Біологія'],[/підрядн|морфолог|сполучник/iu,'Українська мова'],[/столиц|географ/iu,'Географія'],[/літератур|литератур|роман[уіа]?\s+[«"]/iu,'Література']];
  const subject=pageSubject||book?.[3]||subjects.find(([re])=>re.test(topic+' '+text))?.[1]||'';
  return {topic:work||(paired?citation[2]:topic),subject:subject||(paired?'Література':''),author:named?.trim()||book?.[2]||(paired?citation[1]:'')||pageAuthor||''};
}

let pageSubject="",pageAuthor="",lessonStem="";
function contextFor(stem){return scanLesson(stem,topicValue(),$("subject").value.trim()||pageSubject,pageAuthor);}
const lessonFields={grade:'Класс',subject:'Предмет',topic:'Тема'};
let detectedTopic='', inferred=false, finding=false, searchRound=0;
function topicValue(){return $('topic').value.trim()||detectedTopic;}
function showTopic(){const meta=contextFor(lessonStem);if($("metadataStatus"))$("metadataStatus").textContent="Предмет: "+(meta.subject||"не найдено")+" · Автор произведения: "+(meta.author||"не найдено"); $('topicStatus').textContent='Тема: '+(topicValue()||'не найдено')+(inferred && !$('topic').value.trim()?' (по вопросу)':''); }
function setDetectedTopic(value,approximate=false){
 inferred=approximate;
 detectedTopic=typeof value==='string'?value.replace(/\s+/gu,' ').trim().slice(0,180):'';
 showTopic();
}
function topicFromScan(data,question,keepPage=false){
 const prompt=question.split('\nВарианты:')[0];
 lessonStem=prompt;
 if(!keepPage){pageSubject=typeof data.subject==='string'?data.subject.slice(0,80):'';pageAuthor=typeof data.author==='string'?data.author.slice(0,85):'';}
 const explicit=prompt.match(/^(?:Тема(?: тест[ау])?|Назва тесту|Название теста)\s*[:：]\s*([^\n]{1,180})$/imu)?.[1];
 const pageTopic=data.topic||explicit||((keepPage&&!inferred)?detectedTopic:'');
 const work=prompt.match(/(?:твор[уіае]?|повіст[ію]|оповіданн[ія]|роман[іуае]?|поем[іиаы]|каз(?:ка|ці|ки)|вірш[іуа]?)\s+[«„“"]([^»“”"\n]{2,100})[»“”"]/iu);
 const topics=[
   [/григор.{0,12}многогріш|гриць.{0,8}сірко|тигролови/iu,'Тигролови'],[/багрян/iu,'Іван Багряний'],
   [/складнопідрядн|підрядн.{0,16}(частин|реченн)/iu,'Складнопідрядне речення'],
   [/розв.{1,4}яж.{0,6} рівняння|решите? уравнение/iu,'Рівняння'],
   [/фотосинтез/iu,'Фотосинтез'],[/географічн.{0,4} координат/iu,'Географічні координати'],
   [/раціональн.{0,4} числ/iu,'Раціональні числа'],[/частин[аи] мов[иі]/iu,'Частини мови']
 ];
 const knownTopic=scanLesson(prompt,pageTopic).topic;
 const found=work?'«'+work[1]+'»':knownTopic||topics.find(([pattern])=>pattern.test(prompt))?.[1];
 if(work){setDetectedTopic(found,true);return;}
 if(pageTopic){setDetectedTopic(pageTopic);return;}
 setDetectedTopic(found,!!found);
}
function endTopicSearch(hint){
 finding=false;$('findTopic').disabled=false;$('topicHint').textContent=hint;
}
function findTopic(){
 if(window.parent===window){endTopicSearch('Открой панель поверх страницы теста.');return;}
 if(finding||awaitingRead)return;
 finding=true;const round=++searchRound;$('findTopic').disabled=true;$('topicHint').textContent='Читаю страницу…';
 window.parent.postMessage({type:'STUDY_OVERLAY_READ_PAGE'},parentOrigin||'*');
 setTimeout(()=>{if(finding&&round===searchRound)endTopicSearch('Страница не ответила. Попробуй после загрузки вопроса.');},3000);
}
$('findTopic').addEventListener('click',findTopic);
$('topic').addEventListener('input',showTopic);
window.addEventListener('message',event=>{
 if(!parentOrigin||event.origin!==parentOrigin||event.source!==window.parent||window===window.parent)return;
 if(event.data?.type==='STUDY_OVERLAY_TOPIC')setDetectedTopic(event.data.topic);
});
function clearLesson(){lessonStem='';pageAuthor='';pageSubject='';detectedTopic='';inferred=false;if($('passage'))$('passage').value='';if($('selection'))$('selection').value='auto';for(const key of Object.keys(lessonFields))$(key).value='';showTopic();}
$('clearLesson').addEventListener('click',clearLesson);
// Editorial summaries are selected by work and question, never by option position.
function lessonReference(topic,question){
 const named=/вітька\s*(?:\+|і|и|та)\s*галя|повість про перше кохання/iu;
 const distinctive=/великі чаплі|вітьк[аоиуі] гороб|федько котигорош|дуел.{0,48}вітьк|вітьк.{0,48}дуел/iu;
 const bulba=/тарас.{1,12}бульб|андрій.{0,18}панноч|панноч.{0,20}андрі/iu;
 if(bulba.test(topic+' '+question)){
   const chapter=/хліб|хлеб|передати|передать/iu.test(question) ? 5 : /панноч|вітчизн|батьківщин/iu.test(question) ? 6 : /привіта|привет|розлук|разлук/iu.test(question) ? 1 : 0;
   const scenes={1:'Повернувшись із бурси, Остап вступає з батьком у кулачний бій.',5:'Панночка через служницю просить Андрія дати хліба її голодній матері.',6:'Андрій приносить їжу. У розмові з панночкою він називає її своєю вітчизною.'};
   const notes=[
     [/навча|вчил|учил|бурс|старш.{0,24}син|молодш.{0,24}син/iu,'Старший брат Остап і молодший Андрій навчаються в київській бурсі, потім повертаються до батьківського дому.'],
     [/підзем|подзем|служниц|пров[іе]в|провел/iu,'Татарка, служниця панночки, проводить Андрія підземним ходом до міста Дубна, яке перебуває в облозі.'],
     [/загуб|згуб|упуст|потер|схопил/iu,'Тарас затримується шукати люльку, що випала. Під час затримки його захоплюють.'],
     [/доля.{0,30}андрі|помер.{0,15}андр|загину.{0,14}андр/iu,'Андрій переходить до супротивника. Тарас зустрічає сина і власноруч стріляє в нього.'],
     [/поклик|відгук|страт[аиі]|казн/iu,'Остапа страчують у Варшаві. Він кличе батька, і з натовпу відповідає Тарас.']
   ];
   const note=notes.find(([pattern])=>pattern.test(question));
   if(note)return {fact:note[1],url:'https://www.ukrlib.com.ua/world/printit.php?tid=15'};
   if(chapter)return {fact:scenes[chapter],url:'https://www.gutenberg.org/ebooks/1197',chapter};
 }
 if(/різдвяна пісня|рождественская песнь|скрудж|christmas carol/iu.test(topic+' '+question) && /відправив|надіслав|індич|послал|отправил/iu.test(question)){
   return {fact:'На різдвяний ранок Скрудж купує велику індичку і посилає її родині свого службовця Боба Кретчита.',url:'https://www.gutenberg.org/ebooks/46'};
 }
 if(!named.test(topic+' '+question)&&!distinctive.test(question))return null;
 const records=[
   [/дуел|подія|липня|ставк/iu,'25 липня у Великих Чаплях запланували дуель. Суперником Вітьки був Петро Білий.','https://uahistory.co/pidruchniki/mischenko-ukraine-literature-8-class-2016/25.php'],
   [/стаж|скільки.{0,25}років|вік/iu,'На початку повісті Вітькові ще не виповнилося чотирнадцять років.','https://www.ukrlib.com.ua/styslo/printit.php?tid=17567'],
   [/гітар|серенад|бриль|сомбреро/iu,'Інструмент для серенади належав сестрі Федька. Для капелюха використали бриль з городнього опудала.','https://files.pidruchnyk.com.ua/uploads/book/8-klas-ukrliteratura-borzenko-2021.pdf']
 ];
 const record=records.find(([pattern])=>pattern.test(question));
 return record?{fact:record[1],url:record[2]}:null;
}
function withLesson(question){
 const notes=Object.entries(lessonFields).map(([key,label])=>[label,key==='topic'?topicValue():$(key).value.trim()]).filter(([,value])=>value);
 const [stem]=question.split('\nВарианты:');
 const meta=contextFor(stem);
 const context={...Object.fromEntries(notes),Тема:meta.topic||'не найдено',Предмет:meta.subject||'не найдено','Автор произведения':meta.author||'не найдено'};
 const parts=[];
 const reference=lessonReference(context.Тема||'',stem);
 if(reference)parts.push('Джерело до завдання — переказ фрагмента про відповідний епізод: '+reference.fact+' Зістав факт з усіма варіантами, врахуй заперечення.');
 const passage=$('passage')?.value?.trim();
 if(passage)parts.push('Отрывок ученика для сверки фактов: '+JSON.stringify(passage.slice(0,1500)));
 parts.push('Контекст теста: '+JSON.stringify(context));
 parts.push('Определи, что именно требуется узнать из формулировки задания. Сначала сформулируй краткий ответ по существу, затем сопоставь его с содержанием каждого варианта. Проверь отрицания, ограничения и подпись выбранного варианта. Верни только итог на языке задания.');
 if(/літератур|литератур|письменник|автор|книг|повіст|геро[йяї]|читач|твір|твору|оповідан|роман|поем|жанр/iu.test([context.Предмет,context.Тема,stem].join(' '))){
   parts.push('Для литературного вопроса установи произведение и тип запрошенного факта: жанр, адресат книги, авторский замысел, рассказчик, поступок персонажа или событие. Проверь, отвечает ли вариант на этот вопрос целиком: верный факт о герое может не относиться к читателям. Не выбирай группу читателей только потому, что к ней принадлежит главный герой.');
   if(/різдвяна пісня (?:в|у) прозі|рождественская песнь в прозе|a christmas carol/iu.test([context.Тема,stem].join(' ')) && /адресован|призначен|читач|аудитор|посвящ|readers|audience/iu.test(stem)){
     parts.push('Справка к вопросу об адресате. Charles Dickens, A Christmas Carol, предисловие: автор обращается к читателям в целом, говорит об их отношении к себе и друг к другу. Источник: Project Gutenberg, ebook 24022, Preface. Учитывай эту справку только если вопрос относится к обращению автора к читателям.');
   }
 }
 if(/підрядн|сполучн|членом речення/iu.test(question)){
   parts.push('Для каждого варианта восстанови обе грамматические основы и смысл связи. Сполучне слово выполняет синтаксическую роль: попробуй заменить его на який в нужном падеже. Сполучник только связывает части. Цель отвечает на навіщо, причина на чому, последствие обозначает результат и обычно вводится так що. Для з’ясувального найди опорное слово мысли, речи, восприятия или чувства и задай от него падежный вопрос ко всей придаточной части. Для придаточного времени задай вопрос «коли відбувається дія?». Сравни эту зависимость у всех вариантов даже при одинаковом «коли». Выведи только выбранный вариант.');
 }
 parts.push('Задание: '+question.replace(/^Вопрос \(проверь текст\):\s*/u,''));
 const input=parts.join('\n');
 if(input.length>6500 && question.length<6400){const room=6500-question.length-12;return (parts.slice(0,-1).join('\n').slice(0,room)+'\nЗадание: '+question);}
 if(input.length>6500)throw Error('Слишком много текста. Сократи текст или выдели только вопрос с вариантами.');
 return input;
}
// Narrow source-backed lookup. An unfamiliar wording goes through the usual solver.
function verifiedAudience(question,multiple){
 if(multiple)return null;
 const [stem,options,extra]=question.split('\nВарианты:\n');
 if(!options||extra!==undefined)return null;
 const normalize=t=>t.normalize('NFC').toLowerCase().replace(/["«»“”„]/gu,'').replace(/\s+/gu,' ').trim();
 const prompt=normalize(stem.replace(/^Вопрос \(проверь текст\):\s*/u,''));
 const work='різдвяна пісня (?:у|в) прозі';
 const named=new RegExp('^(?:книга|повість|твір) '+work+' (?:за задумом автора )?(?:бул[аио] )?адресован[аои][?.:…]*$','u');
 const implicit=/^(?:кому адресовано (?:цей твір|цю книгу)|кому за задумом автора адресовано твір)[?.:…]*$/u;
 const topic=normalize(topicValue()).replace(/^тест:\s*/u,'');
 if(!named.test(prompt)&&!(implicit.test(prompt)&&new RegExp('^'+work+'$','u').test(topic)))return null;
 const rows=options.trim().split('\n').map(line=>line.trim().replace(/^\d+\.\s+(?=[A-HА-Д])/u,'').match(/^([A-HА-Д])(?:[).:]\s*|\s+)(.+)$/u));
 if(rows.length<2||rows.some(r=>!r)||new Set(rows.map(r=>r[1])).size!==rows.length)return null;
 const hits=rows.filter(r=>/^(?:для широкого (?:кола|загалу) читачів|широкому колу читачів|усім читачам|всім читачам)[.!]?$/u.test(normalize(r[2])));
 return hits.length===1?hits[0][1]+') '+hits[0][2].trim():null;
}
// Restore the displayed label only when one option matches the complete response.
function displayAnswer(answer,question){
 const rows=question.split('\nВарианты:\n')[1];
 if(!rows||typeof answer!=='string')return answer;
 const norm=s=>s.normalize('NFC').trim().replace(/[.!]+$/u,'').replace(/\s+/gu,' ');
 const options=rows.split('\n').map(row=>row.trim().replace(/^\d+\.\s+(?=[A-HА-Д])/u,'').match(/^([A-HА-Д])(?:[).:]\s*|\s+)(.+)$/u)).filter(Boolean);
 const value=norm(answer);
 let matches=options.filter(([,label,content])=>norm(content)===value || label===value || [' ',') ','. ',': '].some(sep=>norm(label+sep+content)===value));
 if(!matches.length && value.length>3){
   matches=options.filter(([,label,content])=>norm(content).toLowerCase()===value.toLowerCase());
 }
 return matches.length===1?matches[0][1]+') '+matches[0][2]:answer;
}
// Only text answers from this open panel are retained. Closing it releases the history.
const recentAnswers = new Map();
let activeResult = null;
let readRound=0;
function renderRecent(){
 const list=$('recentList');
 if(!list?.replaceChildren)return;
 list.replaceChildren();
 $('recent').hidden=!recentAnswers.size;
 $('recentCount').textContent='('+recentAnswers.size+')';
 for(const item of [...recentAnswers.values()].reverse()){
   const button=document.createElement('button');
   button.type='button';button.className='tiny';
   button.textContent=item.question.split('\nВарианты:')[0].replace(/^Вопрос \(проверь текст\):\s*/u,'').slice(0,100);
   const preview=document.createElement('small');
   preview.textContent=item.answer.slice(0,120);
   button.append(document.createElement('br'),preview);
   button.addEventListener('click',()=>{
     if(busy||awaitingRead)return;
     showResult(item,'Из истории · '+item.method);
     $('readout').hidden=false;$('readText').textContent=item.question;
     $('recent').open=false;
   });
   list.append(button);
 }
}
function showResult(item,method){
 activeResult=item;
 $('answer').textContent=item.answer;
 $('method').textContent=method;
 $('resultTools').hidden=false;
 $('recheck').hidden=!item.key;
}
function resetResult(){
 $('method').textContent='';activeResult=null;$('resultTools').hidden=true;
}
function clearRecent(){
 recentAnswers.clear();renderRecent();resetResult();
}
$('clearRecent').addEventListener('click',clearRecent);
$('copyResult').addEventListener('click',async()=>{
 if(!activeResult)return;
 try{await navigator.clipboard.writeText(activeResult.answer);msg('Ответ скопирован');}
 catch{msg('Удерживай текст ответа и выбери «Скопировать».');}
});
$('recheck').addEventListener('click',()=>{
 if(!activeResult?.key||busy||awaitingRead)return;
 if(image){msg('Убери прикреплённое фото, чтобы перепроверить текст.');return;}
 send(activeResult.question,true,activeResult.fromCheckbox);
});
let visibleCards=[];
function pickCard(card){
 $('cardPicker').hidden=true;
 if(card.issue&&!image){resetResult();$('readout').hidden=true;$('answer').textContent=card.issue;return;}
 send(card.text,false,card.multiple===true);
}
$('solveCard').addEventListener('click',()=>{
 const card=visibleCards[Number($('cardSelect').value)];if(card&&!busy)pickCard(card);
});
async function send(question,force=false,fromCheckbox=false){
 if(busy)return;
 const activeKeyBefore=activeResult?.key;
 $('cardPicker').hidden=true;resetResult();
 const divider='\nВарианты:\n';
 question=question.replace(/\r\n?/gu,'\n').replace(/^[ \t]*(?:варіанти відповідей|варианты ответов|answer choices)[ \t]*[:：]?[ \t]*$/gimu,'Варианты:');
 // A copied exercise often has labels but no line introducing its choices.
 if(!question.includes(divider)){
   const lines=question.trim().split('\n');
   const first=lines.findIndex(line=>/^\s*[A-HА-Д][).:]\s+\S/u.test(line));
   if(first>0 && lines.length-first>=2 && lines.slice(first).every(line=>/^\s*[A-HА-Д][).:]\s+\S/u.test(line))){
     question=lines.slice(0,first).join('\n')+divider+lines.slice(first).join('\n');
   }
 }
 const pos=question.indexOf(divider);
 let multiple=fromCheckbox || $('selection')?.value==='multiple';
 if(pos>=0){
   const lines=question.slice(pos+divider.length).split('\n');
   const action=/^(?:обери|оберіть|вибери|виберіть) (?:правильні )?відповіді[.!]?$/iu;
   multiple ||= lines.some(line=>action.test(line.trim()));
   const kept=lines.filter(line=>!action.test(line.trim())&&!/^(?:далі|діслексія|дислексія|завершити|наступне|назад|submit)$/iu.test(line.trim()));
   const options=kept.map(row=>row.trim()).filter(Boolean);
   // Sites often render the letter and a numeric value as separate spans.
   for(let i=0;i<options.length;i++){
     options[i]=options[i].replace(/^([A-HА-Д])\s+(?=[+−–—-]?\s*\d)/u,'$1) ');
   }
   const labelled=options.map(row=>/^(?:\d+[.)]\s+)?[A-HА-Д][).:]\s*\S/u.test(row));
   if(options.length>=2 && options.length<=8 && labelled.every(value=>!value)){
     for(let i=0;i<options.length;i++)options[i]=String.fromCharCode(65+i)+') '+options[i];
   }
   question=question.slice(0,pos)+(options.length?divider+options.join('\n'):'');
 }
 $('readout').hidden=false;$('readText').textContent=question||'Только фото';$('method').textContent='';
 if(!image && topicValue() && (!question || question.trim()===topicValue() || /^(?:Тема|Назва тесту|Название теста):[^\n]+$/iu.test(question.trim()))){
   $('answer').textContent='Тема: '+topicValue()+'. Для выбора ответа нужен сам вопрос. Выдели его на странице или прикрепи фото.';
   return;
 }
 if(!image && /^Вопрос \(проверь текст\):\n/u.test(question)){
   const stems=question.split(divider)[0].split('\n').slice(1).filter(line=>/[?？]\s*$/u.test(line));
   if(stems.length>1){$('answer').textContent='Сканер прочитал несколько вопросов. Выдели один вопрос с его вариантами или нажми «Исправить текст».';return;}
 }
 if(!question&&!image){$('answer').textContent='Вопрос не найден. Выдели текст задания или прикрепи скриншот.';msg('Не удалось прочитать вопрос. Прикрепи скриншот через скрепку.');return;}
 const prompt=question.split(/\nВарианты:/u)[0];
 if(!image)topicFromScan({},prompt,true);
 const referencesFigure=/(?:на|за|по)\s+(?:схем[іеу]|карт[іеу]|рисунк[уе]|малюнк[уе]|ілюстрації|изображении|фото)/iu.test(prompt);
 const referencesMark=/(?:познач|обознач|цифр|стрілк|стрелк|нумер|номер|літер|букв)/iu.test(prompt);
 if(!image&&referencesFigure&&referencesMark){
   $('method').textContent='Нужно изображение';
   $('answer').textContent='Прикрепи карту или схему с обозначениями.';
   return;
 }
 multiple ||=/оберіть (?:усі|всі|два|три)|выберите (?:все|два|три)|select all|choose (?:two|three)/iu.test(prompt);
 const key=image?'':JSON.stringify([question,contextFor(prompt),topicValue(),$('subject').value,$('grade').value,$('passage').value,multiple]);
 if(force && activeKeyBefore && activeKeyBefore!==key){
   $('answer').textContent='Контекст изменился. Просканируй вопрос заново с текущими настройками.';
   return;
 }
 const previous=key&&recentAnswers.get(key);
 if(!force && previous && Date.now()-previous.time<10*60*1000){
   showResult(previous,'Повторный вопрос · '+previous.method);return;
 }
 let submittedReadout='';
 function complete(answer,method){
   if(typeof answer!=='string'||!answer.trim())throw Error('Получен пустой ответ');
   const item={key,question:submittedReadout||question,answer,method,fromCheckbox,time:Date.now()};
   if(key && !/недостат(?:очно|ньо) дан|не удалось подтвердить/iu.test(answer)){
     recentAnswers.delete(key);recentAnswers.set(key,item);
     if(recentAnswers.size>10)recentAnswers.delete(recentAnswers.keys().next().value);
     renderRecent();
   }
   showResult(item,method);
 }
 const converted=!image&&!multiple&&window.scannerUnits?.(question);
 if(converted){complete(converted,'Точный перевод единиц');return;}
 const audience=image?null:verifiedAudience(question,multiple);
 if(audience){
   $('method').textContent='Сверено с предисловием Диккенса · Project Gutenberg № 24022';
   complete(audience,$('method').textContent);return;
 }
 const exact=image || multiple ? null : window.scannerArithmetic?.(question);
 if(typeof exact==='string'){$('method').textContent='Точный расчёт по тексту';complete(exact,$('method').textContent);return;}
 $('method').textContent=image?'Модель · прикреплено фото':'Модель · текст';
 const reference=!image&&lessonReference(topicValue(),prompt);
 if(reference)$('method').textContent='Модель · сверка с текстом произведения: '+reference.url;
 const readingReview=!image && !multiple && /багрян|тигролов|многогріш|літератур|литератур|автор|роман|твор[уіе]|повіст|скрудж|бульб|лісов[аі] пісн|геро[йяї]|поем|повест|гоголь|диккенс|діккенс|письменник/iu.test([topicValue(),$('subject').value,prompt].join(' '));
 const submittedImage=image;
 const submittedSession=sessionRevision;
 if(submittedImage)question+='\nСверь условие, выделенные слова и все варианты по приложенному снимку. При расхождении текста страницы со снимком используй задание на снимке.';
 busy=true;$('scan').disabled=true;$('answer').textContent='Обрабатываем вопрос в облаке…';
 try{const response=await request('/ask','POST',{selection:multiple?'multiple':'auto',readingReview,contextScan:true,scanPhoto:!!submittedImage,lesson:contextFor(prompt),topic:topicValue(),question:withLesson(question||'Прочитай вопрос и варианты на изображении.'),image:submittedImage||undefined});if(submittedSession!==sessionRevision)return;if(response.scan){submittedReadout=response.scan.text;$('readText').textContent=response.scan.text;topicFromScan({topic:response.scan.topic||topicValue(),author:response.lesson?.author,subject:response.lesson?.subject},response.scan.text);$('method').textContent='Фото прочитано · варианты сверены по тексту';}if(response.source)$('method').textContent+=' · '+response.source;const photoMath=response.scan&&!response.scan.multiple&&!multiple&&window.scannerArithmetic?.(response.scan.text);
 if(photoMath)$('method').textContent='Фото прочитано · проверено точным расчётом';
 complete(photoMath||(submittedImage||multiple?response.answer:displayAnswer(response.answer,question)),$('method').textContent);if(submittedImage&&image===submittedImage)$('removePhoto').click();void refresh();}
 catch(e){
   if(submittedSession!==sessionRevision)return;
   if(reference && (!e.status || [429,502,503,504].includes(e.status))){
     $('answer').textContent='Ответ модели не подтверждён. По тексту произведения: '+reference.fact;
     $('method').textContent='Справка к вопросу · '+reference.url;
   }else $('answer').textContent='Ошибка: '+e.message;
   if(e.status===401)clear();
 }
 finally{busy=false;$('scan').disabled=false;}
}
$('editScan').addEventListener('click',()=>{
 const text=$('readText').textContent;
 if(!text||text==='Только фото')return;
 $('manualQuestion').value=text;
 $('manualQuestion').closest('details').open=true;
 $('manualQuestion').focus();
});
$('manualForm').addEventListener('submit',event=>{
 event.preventDefault();
 const value=$('manualQuestion').value.trim();
 if(value.length>=3)send(value);
});
$('scan').addEventListener('click',()=>{
 if(busy||awaitingRead)return;
 $('cardPicker').hidden=true;visibleCards=[];resetResult();
 const reuseRead=finding;
 if(finding)endTopicSearch('');
 if(window.parent===window){msg('Сканирование доступно после запуска закладки поверх учебной страницы.');return;}
 const round=++readRound;awaitingRead=true;$('answer').textContent='Читаем текст страницы…';if(!reuseRead)window.parent.postMessage({type:'STUDY_OVERLAY_READ_PAGE'},parentOrigin||'*');
 setTimeout(()=>{if(awaitingRead && round===readRound){awaitingRead=false;if(image){send('Разбери задание на прикреплённом изображении.');}else{$('answer').textContent='Не удалось прочитать вопрос со страницы. Попробуй скриншот через скрепку.';}}},4000);
});
window.addEventListener('message',event=>{
 if(window.parent===window||event.source!==window.parent||(parentOrigin&&event.origin!==parentOrigin)||(!awaitingRead&&!finding)||!event.data||event.data.type!=='STUDY_OVERLAY_PAGE_TEXT')return;
 const question=String(event.data.text||'').trim().slice(0,6500);
 topicFromScan(event.data,question);
 if(finding){
   endTopicSearch($('topic').value.trim()?'Используется введённая вручную тема.':detectedTopic?'':question?'В доступном тексте название теста не указано.':'Закладка не получила название или текст. Можно выделить заголовок с подписью «Тема: …» и повторить поиск.');
   return;
 }
 awaitingRead=false;
 const cards=Array.isArray(event.data.cards)?event.data.cards.slice(0,12).filter(c=>c&&typeof c.text==='string'&&c.text.length<=6500&&typeof c.title==='string'): [];
 if(cards.length===1){pickCard(cards[0]);return;}
 if(cards.length>1 && !image){
   visibleCards=cards;
   $('cardSelect').replaceChildren(...cards.map((card,i)=>{
     const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+card.title.slice(0,150);return option;
   }));
   $('cardPicker').hidden=false;$('readout').hidden=true;
   $('answer').textContent='Выбери вопрос, для которого нужен ответ.';return;
 }
 if(event.data.issue&&!image){$('answer').textContent=String(event.data.issue).slice(0,250);$('readout').hidden=true;return;}
 send(question);
});
async function compressPhoto(file){
 if(!file.type.startsWith('image/'))throw Error('Выбери фото или скриншот');if(file.size>15_000_000)throw Error('Фото слишком большое');
 const raw=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(Error('Не прочитали фото'));fr.readAsDataURL(file);});
 const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Не удалось открыть фото'));im.src=raw;});
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Нет поддержки обработки фото');
 try{
   for(const limit of [1600,1280,1024,800]){
     const scale=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
     canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
     canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
     for(const quality of [.86,.68]){
       const result=canvas.toDataURL('image/jpeg',quality);
       if(result.startsWith('data:image/jpeg;base64,') && result.length<=1_450_000)return result;
     }
   }
   throw Error('Обрежь снимок до области задания.');
 }finally{canvas.width=canvas.height=0;}
}
async function attachPhoto(file){
 const revision=++photoRevision;
 try{
   const compressed=await compressPhoto(file);
   if(revision!==photoRevision)return;
   image=compressed;$('photoThumb').src=image;$('imageSection').hidden=false;
   $('sendPhoto').hidden=false;$('imageName').textContent='📎 '+(file.name||'Скриншот').slice(0,30);
   msg('Фото прикреплено');
 }catch(error){if(revision===photoRevision)msg(error.message);}
}
$('photo').addEventListener('change',event=>{
 const input=event.target,file=input.files?.[0];input.value='';
 if(file)void attachPhoto(file);
});
window.addEventListener('paste',event=>{
 if(!me || busy)return;
 const item=Array.from(event.clipboardData?.items||[]).find(x=>x.kind==='file'&&x.type.startsWith('image/'));
 const file=item?.getAsFile();if(!file)return;
 event.preventDefault();void attachPhoto(file);
});
$('removePhoto').addEventListener('click',()=>{photoRevision++;image='';$('photoThumb').removeAttribute('src');$('imageSection').hidden=true;$('sendPhoto').hidden=true;});
$('sendPhoto').addEventListener('click',()=>send('Прочитай вопрос и варианты на изображении.'));
if(window.parent===window){
 $('backHome').hidden=false;$('findTopic').hidden=true;$('manualBox').open=true;
 $('workState').insertBefore($('manualBox'),$('imageSection'));
 $('connect').hidden=true; $('loginHelp').textContent='Войди в кабинет и вернись на эту страницу.';
 $('scan').hidden=true;
 try{token=localStorage.getItem('study_3_token')||'';device=localStorage.getItem('study_3_device')||'';}catch{}
 $('answer').textContent='Введи вопрос выше или прикрепи фото через скрепку.';
}
window.addEventListener('pageshow',()=>{if(window.parent===window&&!me){
 try{const saved=localStorage.getItem('study_3_token');if(saved){token=saved;device=localStorage.getItem('study_3_device')||'';validate().catch(e=>msg(e.message));}}catch{}
}});
view(false);if(token||tokenFromStorage())validate().catch(e=>{if(e.status===401)clear();msg(e.message);});
if(window.parent!==window){
 window.parent.postMessage({type:'STUDY_PANEL_READY'},'*');
 if(parentOrigin)setTimeout(()=>{if(!topicValue()&&!busy&&!awaitingRead&&!searchRound)findTopic();},650);
}
})();
