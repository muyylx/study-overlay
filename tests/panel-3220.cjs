const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
function panel(reply) {
  const nodes = new Map();
  function field(id) {
    if (!nodes.has(id)) nodes.set(id, {value:'', addEventListener(type,fn){ this[type]=fn; }});
    return nodes.get(id);
  }
  const win = {STUDY_CONFIG:{apiBase:'https://api.example'}, parent:{postMessage(){}}, addEventListener(){}};
  const requests = [];
  const context = vm.createContext({window:win, URL, location:new URL('https://panel.example/?host=https://quiz.example'), document:{getElementById:field}, localStorage:{getItem(){return null;}}, setTimeout(){}, clearTimeout(){}, AbortSignal,
    async fetch(url,init){
      if (url.endsWith('/me')) return {ok:true,json:async()=>({user:{role:'user'}})};
      const body=JSON.parse(init.body); requests.push(body);
      return reply ? reply(body) : {ok:false,status:503,json:async()=>({error:'Облако недоступно'})};
    }
  });
  for (const file of ['arithmetic.js','panel.js']) vm.runInContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
  async function submit(text) {
    field('manualQuestion').value=text;
    field('manualForm').submit({preventDefault(){}});
    await new Promise(resolve=>setImmediate(resolve));
    return field('answer').textContent;
  }
  return {field,submit,requests};
}
test('ручная вставка, разные переносы строк, подстановка и ОДЗ',async()=>{
 const ui=panel();assert.equal(await ui.submit('(x+2)/(x-1)=2\r\nA) 1\r\nB) 4\r\nC) 3'),'B) 4');assert.equal(ui.requests.length,0);
});
test('тема без задания',async()=>{
 const ui=panel();ui.field('topic').value='Електрика';assert.match(await ui.submit('Електрика'),/нужен сам вопрос/);assert.equal(ui.requests.length,0);
});
test('разбор эпизода при сбое облака',async()=>{
 const ui=panel();ui.field('topic').value='Тарас Бульба';assert.match(await ui.submit('Для кого панночка просила хліба?'),/матері/);
 assert.match(ui.field('method').textContent,/gutenberg/);
});
test('несколько вариантов, контекст и очистка',async()=>{
 const ui=panel();ui.field('selection').value='multiple';ui.field('passage').value='Контрольный отрывок';
 await ui.submit('1+1\nA) 2\nB) 4/2');assert.equal(ui.requests[0].selection,'multiple');assert.match(ui.requests[0].question,/Контрольный отрывок/);
 ui.field('clearLesson').click();assert.equal(ui.field('passage').value,'');
});
test('неподтвержденный сюжет не подменяется справкой другого произведения',async()=>{
 const ui=panel();ui.field('topic').value='Гамлет';assert.match(await ui.submit('Для кого попросили хліба?'),/Облако недоступно/);
});
test('дополнительная проверка для литературы, обычный маршрут для физики',async()=>{
 const ui=panel();ui.field('topic').value='Українська література';
 await ui.submit('Хто написав твір?\nA) Автор перший\nB) Автор другий');assert.equal(ui.requests[0].readingReview,true);
 ui.field('topic').value='Оптика';await ui.submit('Що відбиває світло?\nA) Дзеркало\nB) Тінь');assert.equal(ui.requests[1].readingReview,false);
});
