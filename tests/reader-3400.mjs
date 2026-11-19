import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Run with linkedom installed, or set LINKEDOM_MODULE to its standalone ESM entry.
const {parseHTML}=await import(process.env.LINKEDOM_MODULE||'linkedom');
const reader=fs.readFileSync(new URL('../reader.js',import.meta.url),'utf8');
function scan(body,hostname='quiz.example'){
 const {document}=parseHTML('<html><body>'+body+'</body></html>');
 Object.defineProperty(document,'location',{value:{hostname}});
 for(const el of document.querySelectorAll('*'))el.getClientRects=()=>el.closest('[hidden]')?[]:[{}];
 const context={window:{},getComputedStyle:()=>({visibility:'visible'})};
 vm.runInNewContext(reader,context);
 return context.window.studyReadCards(document,el=>!el.closest('[hidden],[data-offscreen]'));
}
const article=(q,opts)=>'<article class="tb-single-q"><div class="tb-single-q-body"><div class="tb-single-q-text">'+q+'</div></div><ul>'+opts.map(x=>'<li class="tb-single-opt"><span class="tb-single-opt-text">'+x+'</span></li>').join('')+'</ul></article>';
test('НаУрок: два соседних вопроса, полный набор вариантов у каждого',()=>{
 const r=scan(article('Вкажіть інфінітив',['Співати','Співають'])+article('Скільки буде 4+1?',['5','7']));
 assert.equal(r.cards.length,2);assert.match(r.cards[0].text,/Співати\nСпівають$/u);assert.doesNotMatch(r.cards[0].text,/Скільки/);
});
test('Moodle: пропуск скрытой карточки, сохранение вариантов ниже экрана',()=>{
 const html='<div class="que"><div class="qtext">Question?</div><div class="answer"><label>One</label><label data-offscreen>Two</label></div></div>';
 const r=scan('<div hidden>'+html+'</div>'+html);assert.equal(r.cards.length,1);assert.match(r.cards[0].text,/One\nTwo$/);
});
test('Google Forms: заголовок, несколько вариантов, чужая кнопка',()=>{
 const r=scan('<div role="listitem"><div role="heading">Select two.</div><div role="checkbox">Blue</div><div role="checkbox">Red</div></div><button>Submit</button>');
 assert.equal(r.cards[0].multiple,true);assert.doesNotMatch(r.cards[0].text,/Submit/);
});
test('HTML: дробь в MathML, варианты после формулы',()=>{
 const r=scan(article('Розв’яжіть рівняння <math><mfrac><mrow><mi>x</mi><mo>+</mo><mn>2</mn></mrow><mrow><mi>x</mi><mo>-</mo><mn>1</mn></mrow></mfrac><mo>=</mo><mn>2</mn></math>',['A) 4','B) 1']));assert.match(r.cards[0].text,/\(\(x\+2\)\/\(x-1\)\)=2/);
});
for(const markup of ['<img src="diagram.jpg">','<canvas></canvas>','<math><mtable></mtable></math>']){
 test('Фото при неизвестном содержимом '+markup,()=>{const r=scan(article('На рисунку:',[markup,'Відповідь']));assert.equal(r.cards[0].text,'');assert.match(r.cards[0].issue,/снимок/);});
}
for(const [host,title,choice] of [['play.kahoot.it','data-functional-selector="block-title"','data-functional-selector="answer-0"'],['wayground.com','class="question-text"','class="option-text"'],['quizizz.com','data-testid="question-text"','data-testid="answer-option-0"'],['naurok.ua','class="question-title"','class="answer-option"']]){
 test(host+' — модель одновопросной страницы',()=>{const r=scan('<h2 '+title+'>Capital?</h2><button '+choice+'>Kyiv</button>',host);assert.match(r.cards[0].text,/Capital\?\nВарианты:\nKyiv/);});
}
test('fieldset: скрытые ответы исключены, checkbox распознан',()=>{const r=scan('<fieldset><legend>Choose</legend><label><input type="checkbox">Cat</label><label hidden>Hidden</label></fieldset>');assert.equal(r.cards[0].multiple,true);assert.doesNotMatch(r.cards[0].text,/Hidden/);});
test('Скопированный код автономен и переключает панель через прежнюю закладку',()=>{
 const nodes=new Map();
 function field(id){if(!nodes.has(id))nodes.set(id,{addEventListener(){}});return nodes.get(id);}
 const env={window:{},document:{getElementById:field}};
 vm.runInNewContext(reader,env);
 const installer=fs.readFileSync(new URL('../install.html',import.meta.url),'utf8').split('<script>').at(-1).split('</script>')[0];
 vm.runInNewContext(installer,env);
 const code=decodeURIComponent(field('code').value.slice('javascript:'.length));
 let closed=false;
 vm.runInNewContext(code,{document:{getElementById:()=>({dispatchEvent(e){closed=e.type==='scanner-close'}})},Event});assert.equal(closed,true);
 assert.match(code,/function readCards\(document,visible\)/);
});
test('Выбор второй карточки в панели: 1 запрос, правильные варианты, режим нескольких ответов',async()=>{
 const html=fs.readFileSync(new URL('../panel.html',import.meta.url),'utf8');
 const {document}=parseHTML(html);const listeners={};const messages=[];const requests=[];
 const host={postMessage:m=>messages.push(m)};
 const win={parent:host,STUDY_CONFIG:{apiBase:'https://server.test'},addEventListener(type,fn){(listeners[type]??=[]).push(fn)}};
 const env={document,window:win,URL,location:new URL('https://panel.test/?host=https://quiz.test'),AbortSignal,setTimeout(){},clearTimeout(){},localStorage:{getItem(){return null}},fetch:async(u,init)=>{
   if(u.endsWith('/me'))return {ok:true,json:async()=>({user:{role:'user'}})};
   requests.push(JSON.parse(init.body));return {ok:true,json:async()=>({answer:'Синій, білий'})};
 }};
 for(const path of ['units.js','arithmetic.js','panel.js'])vm.runInNewContext(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),env);
 document.getElementById('scan').click();
 const cards=scan(article('Перше завдання',['Червоний','Чорний'])+article('Кілька правильних відповідей. Друге завдання',['Синій','Білий'])).cards;
 for(const fn of listeners.message)fn({source:host,origin:'https://quiz.test',data:{type:'STUDY_OVERLAY_PAGE_TEXT',text:'',topic:'Кольори',cards}});
 assert.equal(requests.length,0);assert.equal(document.getElementById('cardPicker').hidden,false);
 document.querySelectorAll('#cardSelect option')[1].selected=true;
 document.getElementById('solveCard').click();await new Promise(r=>setImmediate(r));
 assert.equal(requests.length,1);assert.equal(requests[0].selection,'multiple');
 assert.match(requests[0].question,/Друге завдання/u);assert.doesNotMatch(requests[0].question,/Перше завдання|Чорний/u);
});
