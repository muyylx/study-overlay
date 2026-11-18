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
  for (const file of ['units.js','arithmetic.js','panel.js']) vm.runInContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
  async function submit(text) {
    field('manualQuestion').value=text;
    field('manualForm').submit({preventDefault(){}});
    await new Promise(resolve=>setImmediate(resolve));
    return field('answer').textContent;
  }
  return {field,submit,requests};
}
test('одинаковый запрос использует историю, перепроверка вызывает API',async()=>{
 const ui=panel(()=>({ok:true,json:async()=>({answer:'B) Париж'})}));
 const q='Столица Франции?\nA) Рим\nB) Париж';
 await ui.submit(q);await ui.submit(q);assert.equal(ui.requests.length,1);
 ui.field('recheck').click();await new Promise(r=>setImmediate(r));assert.equal(ui.requests.length,2);
 ui.field('clearRecent').click();await ui.submit(q);assert.equal(ui.requests.length,3);
});
test('другая тема или другой порядок вариантов требует нового решения',async()=>{
 const ui=panel(()=>({ok:true,json:async()=>({answer:'A'})}));
 await ui.submit('Вопрос?\nA) Один\nB) Два');ui.field('topic').value='Новая тема';
 await ui.submit('Вопрос?\nA) Один\nB) Два');await ui.submit('Вопрос?\nA) Два\nB) Один');assert.equal(ui.requests.length,3);
});
test('повтор после сбоя снова обращается в облако',async()=>{
 const ui=panel();await ui.submit('Столица Франции?');await ui.submit('Столица Франции?');assert.equal(ui.requests.length,2);
});
test('панель решает перевод единиц без запроса',async()=>{
 const ui=panel();assert.equal(await ui.submit('Переведи 36 км/ч в м/с'),'10 м/с');assert.equal(ui.requests.length,0);
});
