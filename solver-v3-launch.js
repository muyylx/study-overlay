(()=>{
'use strict';
const studyReadCards = function readCards(document,visible){
 const layouts=[
   ['article.tb-single-q','.tb-single-q-text','.tb-single-opt-text'],
   ['.que','.qtext','.answer label,.answer .flex-fill'],
   ['[role=listitem]','[role=heading]','[role=radio],[role=checkbox]'],
   ['fieldset','legend','label,[role=radio],[role=checkbox]'],
   ['[data-question-id]','[data-testid=question-text],.question-text,.question-title,legend,[role=heading]','[data-testid*=answer-option],.answer-option,[role=radio],[role=checkbox],label']
 ];
 const visual='img,svg,canvas,.katex,mjx-container,math,sup,sub';
 function displayed(el){return el.getClientRects().length>0 && getComputedStyle(el).visibility==='visible'&&!el.closest('[hidden],[aria-hidden=true]');}
 const text=el=>(el.innerText||'').replace(/\s+/gu,' ').trim();
 // Read structural math only when the entire formula has a known representation.
 function formula(node){
   const tag=node.localName.toLowerCase(),children=Array.from(node.children);
   if(['mi','mn','mo','mtext'].includes(tag))return node.textContent.trim();
   if(tag==='semantics')return children[0]?formula(children[0]):null;
   const values=children.map(formula);
   if(values.includes(null))return null;
   if(['math','mrow','mstyle'].includes(tag))return values.join('');
   if(tag==='mfrac'&&values.length===2)return '(('+values[0]+')/('+values[1]+'))';
   if(tag==='msup'&&values.length===2)return '('+values[0]+')^('+values[1]+')';
   if(tag==='msub'&&values.length===2)return values[0]+'_('+values[1]+')';
   if(tag==='msqrt'&&values.length)return '√('+values.join('')+')';
   if(tag==='mspace')return ' ';
   return null;
 }
 function content(el){
   if(!el.querySelector(visual))return text(el);
   const copy=el.cloneNode(true);
   for(const block of copy.querySelectorAll('.katex,mjx-container,math,sup,sub')){
     if(!copy.contains(block))continue;
     const tag=block.localName.toLowerCase();
     const math=tag==='math'?block:block.querySelector('math');
     let value=math?formula(math):null;
     if((tag==='sup'||tag==='sub')&&/^[0-9+−-]{1,5}$/u.test(block.textContent.trim()))
       value=(tag==='sup'?'^':'_')+'('+block.textContent.trim()+')';
     if(!value)return null;
     block.replaceWith(el.ownerDocument.createTextNode(value));
   }
   if(copy.querySelector(visual))return null;
   for(const br of copy.querySelectorAll('br'))br.replaceWith(' ');
   return copy.textContent.replace(/\s+/gu,' ').trim();
 }
 const host=document.location?.hostname||'';
 const singleScreen=[
   [/(^|\.)kahoot\.it$/u,'[data-functional-selector="block-title"],[data-functional-selector="question-title"]','[data-functional-selector^="answer-"]'],
   [/(^|\.)(?:quizizz|wayground)\.com$/u,'[data-testid="question-text"],.question-text','[data-testid^="answer-option"],.option-text'],
   [/(^|\.)naurok\.(?:com\.)?ua$/u,'.question-title,.question-text,[data-testid="question-title"]','.answer-option,[data-testid="answer-option"]']
 ];
 for(const [domain,title,options] of singleScreen){
   if(!domain.test(host))continue;
   if([...document.querySelectorAll(title)].filter(visible).length===1)
     layouts.push(['body',title,options]);
 }
 const items=[];
 let recognized=false;
 for(const [group,title,options] of layouts){
   for(const root of document.querySelectorAll(group)){
     const heading=group==='body'?[...root.querySelectorAll(title)].find(visible):root.querySelector(title);
     if(!heading||heading.closest(group)!==root)continue;
     if(group==='[role=listitem]'&&!root.querySelector('[role=radio],[role=checkbox],textarea,input'))continue;
     if(group==='fieldset' && !root.querySelector('input[type=radio],input[type=checkbox],[role=radio],[role=checkbox],textarea'))continue;
     recognized=true;
     if((group!=='body'&&!visible(root))||items.some(item=>item.root.contains(root)||root.contains(item.root)))continue;
     const extracted=content(heading);
     const stem=extracted||text(heading);
     if(!stem&&!heading.querySelector(visual))continue;
     let rows=[...root.querySelectorAll(options)].filter(el=>displayed(el)&&el.closest(group)===root);
     rows=rows.filter(el=>!rows.some(other=>other!==el && other.contains(el)));
     let unreadable=extracted===null;
     const formatted=rows.map(el=>{
       const marked=/виділен|підкреслен|выделен|подчеркнут/iu.test(stem)
         ? [...el.querySelectorAll('strong,b,u,mark,em,i')].filter(displayed).map(text).filter(Boolean) : [];
       const value=content(el);if(value===null)unreadable=true;
       const body=value||el.getAttribute('aria-label')||'';
       return marked.length?body+' [виділено: '+marked.join(', ')+']':body;
     });
     const multiple=!!root.querySelector('input[type=checkbox],[role=checkbox]')||/кілька правильних відповідей/iu.test(text(root));
     const value='Вопрос (проверь текст):\n'+stem+(formatted.length?'\nВарианты:\n'+formatted.join('\n'):'');
     const media=unreadable;
     const issue=group==='body'&&/kahoot\.it$/u.test(host)&&!formatted.length?'На этом экране нет текста вариантов. Прикрепи фото вопроса и ответов.':media?'В этом задании есть формула или изображение. Прикрепи снимок всей карточки.':
       (!stem||value.length>6500||formatted.some(v=>!v))?'Текст карточки прочитан не полностью. Выдели задание или прикрепи фото.':'';
     items.push({root,title:stem.slice(0,150)||'Задание с изображением',text:issue?'':value,multiple,issue});
   }
 }
 return {recognized,cards:items.slice(0,12).map(({root,...card})=>card)};
};

function studyOverlayQuick(url,readCards){
'use strict';
const ID='study-overlay-3-quick-panel';
const prev=document.getElementById(ID);
if(prev){prev.dispatchEvent(new Event('scanner-close'));return;}
document.getElementById('study-overlay-3-container')?.remove();
const h=document.createElement('div');h.id=ID;
h.style.cssText='position:fixed!important;top:60px!important;left:8px!important;width:min(360px,calc(100vw - 16px))!important;z-index:2147483647!important;max-width:none!important;max-height:none!important;';
const s=h.attachShadow({mode:'open'});
s.innerHTML=`<style>
*{box-sizing:border-box} .bar{display:flex;align-items:center;gap:7px;height:46px;padding:5px 7px;border-radius:13px 13px 0 0;background:#18243b;color:#eef3ff;font:600 13px system-ui,-apple-system,sans-serif;box-shadow:0 3px 18px #0008;touch-action:none;user-select:none;cursor:grab}
.brand{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.logo{display:grid;place-items:center;background:#a5bbff;color:#13203b;border-radius:8px;width:29px;height:29px;font-weight:900;font-size:18px}
button,a.action{all:unset;display:grid;place-items:center;border:1px solid #4e6487;border-radius:8px;height:38px;min-width:40px;color:#fff;background:#30415e;font:700 17px system-ui;cursor:pointer;text-decoration:none}iframe{display:block;width:100%;height:min(440px,65vh);border:1px solid #344969;border-top:0;border-radius:0 0 13px 13px;background:#111a29;box-shadow:0 15px 30px #0009}.hidden{display:none!important}.bar.folded{border-radius:13px}.bar.folded .brand{display:none}
</style><div class="bar"><span class="logo">S</span><span class="brand">scanner test</span><button class="fold" aria-label="Свернуть">−</button><button class="close" aria-label="Закрыть">×</button></div><iframe title="scanner test by muyylx" referrerpolicy="no-referrer" loading="eager"></iframe>`;
const bar=s.querySelector('.bar'),frame=s.querySelector('iframe'),fold=s.querySelector('.fold');
const panelURL=new URL(url);panelURL.searchParams.set('host',location.origin);frame.src=panelURL.href;
function shrink(){const closed=frame.classList.toggle('hidden');bar.classList.toggle('folded',closed);fallback.hidden=closed;fold.textContent=closed?'+':'−';h.style.setProperty('width',closed?'132px':'min(360px,calc(100vw - 16px))','important');place();}
fold.addEventListener('click',e=>{e.stopPropagation();shrink();});
function close(){clearTimeout(timer);removeEventListener('message',onMsg);h.remove();}
h.addEventListener('scanner-close',close);
s.querySelector('.close').addEventListener('click',close);
let start=null;
function place(){const w=h.getBoundingClientRect().width||132;const x=Math.max(2,Math.min(parseFloat(h.style.left)||8,innerWidth-w-2));const y=Math.max(2,Math.min(parseFloat(h.style.top)||60,innerHeight-44));h.style.setProperty('left',x+'px','important');h.style.setProperty('top',y+'px','important');}
bar.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;start={x:e.clientX,y:e.clientY,left:parseFloat(h.style.left)||8,top:parseFloat(h.style.top)||60};try{bar.setPointerCapture(e.pointerId);}catch{}e.preventDefault();});
bar.addEventListener('pointermove',e=>{if(!start)return;h.style.setProperty('left',start.left+e.clientX-start.x+'px','important');h.style.setProperty('top',start.top+e.clientY-start.y+'px','important');place();});
bar.addEventListener('pointerup',()=>{start=null;});bar.addEventListener('pointercancel',()=>{start=null;});
function visible(el){if(!el||!el.getClientRects().length)return false;const r=el.getBoundingClientRect(),v=getComputedStyle(el);return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0&&v.display!=='none'&&v.visibility!=='hidden'&&!!el.closest('body');}
function readTopic(){
  const brand=/^(?:на\s*урок|naurok(?:\.com)?(?:\.ua)?|google forms|google форми|kahoot!?|quizizz|wayground|moodle|онлайн[- ]тест(?:ування)?|тестування|тест|тест на урок|виконання тесту|проходження тесту|тестування учнів|вхід|quiz|join a game|test|untitled form|без названия|без назви)$/iu;
  function usable(raw){
    const text=String(raw||'').replace(/\s+/gu,' ').trim().replace(/\s*[|｜]\s*Тест (?:з|із|зі|по) .{1,100}?[–—-]\s*[«"“]?На Урок[»"”]?$/iu,'');
    if(text.length<3 || text.length>220)return '';
    const chunks=text.split(/\s*[|｜]\s*|\s+[–—-]\s+/u);
    const generic=v=>brand.test(v)||/^(?:тести? онлайн|онлайн[- ]тести|онлайн[- ]тестування|проходження тесту|тестування)(?:\s+(?:на|від))?\s*[«"“]?на\s*урок[»"”]?$/iu.test(v)||/^(?:виконати|пройти|почати|начать|пройти) тест|^(?:тестування онлайн|онлайн тестування|тести онлайн|онлайн[- ]тести|тести|тесты|гра|результати тесту|kahoot! play|google форми|google формы|test your knowledge)$/iu.test(v);
    const parts=chunks.filter(v=>!generic(v));
    const name=parts.join(' — ').replace(/^(?:тема(?: тест[ау])?|назва тесту|название теста|quiz title)\s*[:：]\s*/iu,'').trim();
    if(!name||generic(name)||name.length>180||/^(?:питання|запитання|вопрос|question)\s*(?:№|#)?\s*\d|[?？]$|^\d+\s*\/\s*\d+$|https?:\/\//iu.test(name))return '';
    return /[\p{L}]/u.test(name)?name:'';
  }
  for(const el of document.querySelectorAll('[data-quiz-title],[data-test-title],.quiz-title,.test-title,[data-testid="quiz-title"],[data-testid="test-title"],[itemprop="educationalAlignment"] [itemprop="targetName"]')){
    const t=usable(el.getAttribute('data-quiz-title')||el.getAttribute('data-test-title')||el.textContent);if(t)return t;
  }
  for(const el of document.querySelectorAll('h1,h2,h3,legend')){
    const raw=el.innerText||'';
    if(!el.closest('[hidden],[aria-hidden=true]')&&/^(?:тема(?: тест[ау])?|назва тесту|название теста|quiz title)\s*[:：]/iu.test(raw.trim())){
      const t=usable(raw);if(t)return t;
    }
  }
  for(const raw of [document.querySelector('meta[property="og:title"]')?.content,document.title]){
    const t=usable(raw);if(t)return t;
  }
  for(const el of document.querySelectorAll('main h1,article h1,[role=main] h1')){
    if(el.closest('fieldset,[data-question-id],[class*="question"],[aria-hidden=true],[hidden]'))continue;
    const raw=(el.innerText||'').trim();
    if(/^(?:обери|вибери|визнач|розв|назви|укаж|вкаж|choose|select|выберите|обчисл|сколько)/iu.test(raw))continue;
    const t=usable(raw);if(t)return t;
  }
  return '';
}
function pageLesson(){
  const meta={subject:'',author:''};
  for(const [key,selector] of [['subject','[data-quiz-subject],[data-test-subject],meta[itemprop="educationalSubject"]'],['author','[data-work-author],[itemprop="workExample"] [itemprop="author"]']]){
    const el=document.querySelector(selector);
    if(el)meta[key]=String(el.dataset?.quizSubject||el.dataset?.testSubject||el.dataset?.workAuthor||el.content||el.textContent||'').trim().slice(0,85);
  }
  if(!meta.subject){const title=document.title||'';meta.subject=title.match(/(?:тест (?:з|із|по) )([^–—|]{3,65})/iu)?.[1]?.trim()||'';}
  return meta;
}
function pageTopic(){try{return readTopic();}catch{return '';}}
function read(){const selected=String(getSelection()?.toString()||'').trim();if(selected.length>2)return selected.slice(0,6500);const seen=new Set(),qs=[],as=[],groups=new Set();
for(const el of document.querySelectorAll('[data-testid*="question"],[class*="question-title"],[class*="questionTitle"],[class*="question-text"],[id*="question"],h1,h2,legend')){if(qs.length>=3)break;if(!visible(el)||el.closest('nav,header,footer,aside'))continue;if(el.querySelector('math,.katex,mjx-container,sup,sub,img,svg,canvas'))return '';const t=String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();if(el.matches('h1,h2')&&!el.closest('[class*="question"],[id*="question"],[data-testid*="question"]')&&!/^\s*[-+(\d][\d\s(),.+/−–—-]*[+−–—-]\s*[-(\d][\d\s(),.+/−–—-]*$/.test(t)&&!/[?？=]|підрядн|сполучн|виділене слово|обчисл|вибер|визнач|укаж|вкаж|оберіть|обери|познач|установ|встанов|розташ|зістав|зазнач|назвіть|определи|укажи|укажите|сопостав|перечисл|сколько|найди|выбер|назови|calculate|which|choose/i.test(t))continue;if(t.length<3||t.length>1000||seen.has(t))continue;seen.add(t);qs.push(t);const group=el.closest("fieldset");if(group)groups.add(group);}
for(const el of document.querySelectorAll('[data-testid*="answer"],[class*="answer-option"],button,[role="button"],[role="radio"],[role="checkbox"],label')){if(el.matches('label')&&!el.control?.matches('input[type="radio"],input[type="checkbox"]'))continue;if(as.length>=32)return '';const isOption=el.matches('[data-testid*="answer"],[class*="answer-option"],[role="radio"],[role="checkbox"],label');
const box=el.getBoundingClientRect?.();
const below=isOption&&box&&box.top>=innerHeight&&box.width>0&&box.height>0&&box.left<innerWidth&&box.right>0&&getComputedStyle(el).visibility==='visible'&&!el.closest('[hidden],[aria-hidden="true"]')&&groups.has(el.closest('fieldset'));
if((!visible(el)&&!below)||el.closest('header,nav,footer,aside,[role=toolbar]'))continue;if(el.matches('[data-testid*="answer"],[class*="answer-option"]')&&el.querySelector('math,.katex,mjx-container,sup,sub,img,canvas'))return '';const t=String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();if(!t||t.length>1000||seen.has(t)||/^(next|back|submit|join|skip|help|play|login|settings|далее|назад|готово|завершити|дислексія|завершить|дислексия|далі|наступне|налаштування)$/i.test(t))continue;seen.add(t);
const needsMarks=qs.some(q=>/виділен|підкреслен|выделен|подчеркнут/i.test(q));
const marks=needsMarks?Array.from(el.querySelectorAll('strong,b,u,mark,em,i')).filter(n=>visible(n)).map(n=>n.innerText.trim()).filter(w=>w&&w.length<80&&!/^[A-HА-Д]$/.test(w)):[];
as.push(marks.length?t+' [виділено: '+[...new Set(marks)].join(', ')+']':t);}
if(qs.length)return('Вопрос (проверь текст):\n'+qs.join('\n')+(as.length?'\nВарианты:\n'+as.join('\n'):'' )).slice(0,6500);
return '';}
const origin=new URL(url).origin;
const fallback=document.createElement('div');
fallback.style.cssText='padding:12px;color:#eef3ff;background:#18243b;font:14px system-ui;';
fallback.textContent='Панель не загрузилась. Сделай скриншот вопроса и ';
const link=document.createElement('a');link.textContent='открой разбор фото';link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.style.color='#b6caff';fallback.append(link);
const timer=setTimeout(()=>{s.append(fallback);frame.hidden=true;frame.style.display='none';},8000);

function diagram(cards){
 if(cards.length>1)return '';
 const nodes=[...document.querySelectorAll('main img,main canvas,article img,article canvas,[role=main] img,[role=main] canvas,.que img,.que canvas')].filter(el=>visible(el)&&!el.closest('header,nav,footer')&&el.getBoundingClientRect().width>=48);
 if(!nodes.length||nodes.length>8)return '';
 const grid=document.createElement('canvas');grid.width=800;grid.height=nodes.length*300;
 const ctx=grid.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,grid.width,grid.height);
 for(const [i,el] of nodes.entries()){
 const r=el.getBoundingClientRect(),scale=Math.min(790/r.width,265/r.height);
 const option=el.closest('label,[role=radio],[role=checkbox],.answer-option');
 ctx.fillStyle='black';ctx.font='20px sans-serif';ctx.fillText((option?.innerText||'Иллюстрация '+(i+1)).trim().slice(0,60),5,i*300+22);
 ctx.drawImage(el,5,i*300+28,r.width*scale,r.height*scale);
 }const data=grid.toDataURL('image/jpeg',0.78);return data.length<=1450000?data:'';
}
const onMsg=e=>{if(!h.isConnected){removeEventListener('message',onMsg);return;}if(e.source!==frame.contentWindow||e.origin!==origin||!e.data)return;if(e.data.type==='STUDY_PANEL_READY'){clearTimeout(timer);fallback.remove();frame.style.display='';frame.hidden=false;frame.contentWindow.postMessage({type:'STUDY_OVERLAY_TOPIC',topic:pageTopic()},origin);}if(e.data.type==='STUDY_OVERLAY_READ_PAGE'){let text='',cards=[],issue='';
 try{
   const selection=String(getSelection()?.toString()||'').trim();
   if(selection.length>2){
     const clean=value=>value.replace(/\s+/gu,' ').trim().toLowerCase();
     const needle=clean(selection);
     const matches=readCards(document,visible).cards.filter(card=>clean(card.text).includes(needle));
     if(matches.length===1){cards=matches;text=matches[0].text;}
     else text=selection.slice(0,6500);
   }
   else {
     const found=readCards(document,visible);cards=found.cards;
     if(!found.recognized)text=read();
     else if(!cards.length)issue='Прокрути страницу до нужного вопроса и нажми «Просканировать экран».';
     if(cards.length===1)text=cards[0].text;
   }
 }catch{issue='Не удалось прочитать разметку. Выдели вопрос или прикрепи снимок.';}
 let diagramData='';try{if(e.data.includeDiagram)diagramData=diagram(cards);}catch{}
 if(diagramData&&cards.length===1&&!cards[0].text){cards[0].text=read()||cards[0].title;}
 frame.contentWindow.postMessage({type:'STUDY_OVERLAY_PAGE_TEXT',text,cards,diagramData,issue,topic:pageTopic(),...pageLesson()},origin);}else if(e.data.type==='STUDY_OVERLAY_HIDE_PANEL'&&!frame.classList.contains('hidden'))shrink();};
addEventListener('message',onMsg);
(document.body||document.documentElement).appendChild(h);place();
}

const site='https://muyylx.github.io/study-overlay/panel.html?v=3700';
studyOverlayQuick(site,studyReadCards);
})();