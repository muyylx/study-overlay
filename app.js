import { solveOffline } from './solver.mjs?v=2';
const $ = id => document.getElementById(id);
const question=$('questionInput'), answer=$('answerCard'), ansText=$('answerText'), modelBtn=$('loadBtn'), aiSolve=$('modelSolveBtn');
let worker=null, loaded=false, initializing=false, generating=false;
function status(s, ready=true){$('statusText').textContent=s; $('statusDot').classList.toggle('ready',ready);}
function result(title,s){$('answerTitle').textContent=title.toUpperCase();ansText.textContent=s;answer.hidden=false;}
function progress(n,s){ if(Number.isFinite(n))$('progressBar').style.width=Math.max(0,Math.min(100,n))+'%';if(s)$('progressText').textContent=s;}
function getQuestion(){return question.value.trim().slice(0,5500);}
$('solveBtn').addEventListener('click',()=>{const r=solveOffline(getQuestion());result(r.title,r.answer);status(r.kind==='math'?'Вычисление выполнено':'Быстрый режим готов');});
$('clearBtn').addEventListener('click',()=>{question.value='';answer.hidden=true;});
async function copyText(v,b){try{await navigator.clipboard.writeText(v);const s=b.textContent;b.textContent='Готово ✓';setTimeout(()=>b.textContent=s,1300);}catch{question.focus();question.select();status('Выделено: скопируй вручную',false);}}
$('copyQuestionBtn').addEventListener('click',()=>copyText(getQuestion(),$('copyQuestionBtn')));
$('copyAnswerBtn').addEventListener('click',()=>copyText(ansText.textContent,$('copyAnswerBtn')));
$('readPageBtn').addEventListener('click',()=>{if(window.parent===window){result('Чтение страницы','Для чтения открытой страницы запусти эту панель закладкой Safari. В отдельной вкладке можно вставить текст вручную.');return;}window.parent.postMessage({type:'STUDY_OVERLAY_READ_PAGE'},'*');status('Запрашиваю текст страницы…');});
window.addEventListener('message',e=>{if(e.source!==window.parent)return;if(e.data?.type==='STUDY_OVERLAY_PAGE_TEXT'){const t=String(e.data.text||'').slice(0,5500).trim();if(t){question.value=t;answer.hidden=true;status('Текст вопроса получен');}else result('Текст не найден','Выдели вопрос на странице и нажми «Считать страницу» снова либо вставь его вручную.');}});
$('collapseBtn').addEventListener('click',()=>{const c=document.body.classList.toggle('collapsed');if(window.parent!==window)window.parent.postMessage({type:'STUDY_OVERLAY_RESIZE',collapsed:c},'*');});
$('closeBtn').addEventListener('click',()=>{if(window.parent!==window)window.parent.postMessage({type:'STUDY_OVERLAY_CLOSE'},'*');else status('Эту вкладку можно закрыть.');});
function resetWorker(msg='Компактная модель остановлена'){try{worker?.terminate();}catch{}worker=null;loaded=false;initializing=false;generating=false;modelBtn.disabled=false;modelBtn.textContent='Попробовать загрузить';aiSolve.disabled=true;$('stopBtn').disabled=true;progress(0,msg);}
$('stopBtn').addEventListener('click',()=>{resetWorker();status('Быстрый режим по-прежнему работает');});
modelBtn.addEventListener('click',()=>{
 if(worker||initializing)return;
 if(typeof Worker==='undefined'){result('Нет поддержки','В этом браузере модульные Web Workers недоступны. Быстрый режим работает без них.');return;}
 initializing=true;modelBtn.disabled=true;modelBtn.textContent='Загружаю…';$('stopBtn').disabled=false;status('Загрузка экспериментальной модели',false);progress(0,'Подготовка модели…');
 try{
  worker=new Worker('./model-worker.js?v=2',{type:'module'});
  worker.onmessage=({data:d})=>{
   if(d.type==='progress'){progress(d.pct,d.text);return;}
   if(d.type==='ready'){loaded=true;initializing=false;modelBtn.textContent='Модель готова';progress(100,'Готово. Можно разбирать вопрос.');aiSolve.disabled=false;status('Компактная модель загружена');return;}
   if(d.type==='answer'){generating=false;aiSolve.disabled=false;aiSolve.textContent='Разобрать с компактным ИИ';result('Ответ мини-модели · проверяй',String(d.text||'Ответ не получен.'));return;}
   if(d.type==='error'){resetWorker('Ошибка: '+String(d.error).slice(0,140));result('Ошибка ИИ','Мини-модель не запустилась. Это ограничение браузера или библиотеки; быстрый режим продолжает работать.');status('Быстрый режим работает');}
  };
  worker.onerror=e=>{resetWorker('Ошибка запуска модели');result('Ошибка ИИ',String(e.message||'Не удалось запустить модель'));};
  worker.postMessage({type:'load'});
 }catch(e){resetWorker('Ошибка запуска: '+String(e.message||e));}
});
aiSolve.addEventListener('click',()=>{const t=getQuestion();if(!t){question.focus();return;}if(!worker||!loaded||generating)return;generating=true;aiSolve.disabled=true;aiSolve.textContent='Думаю…';result('Компактный ИИ','Модель готовит объяснение. Если зависнет, нажми «Остановить».');worker.postMessage({type:'ask',text:t});});
// Remove old v1 service worker/cache when installing Lite: the v1 cache-first strategy can serve outdated files.
if('serviceWorker' in navigator&&window.parent===window){navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.filter(r=>r.scope.startsWith(location.origin+location.pathname.replace(/[^/]*$/,''))).map(r=>r.unregister()))).catch(()=>{});}
