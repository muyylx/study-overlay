'use strict';
window.studyReadCards = function readCards(document,visible){
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
