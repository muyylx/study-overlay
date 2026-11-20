const CATALOG={apinex:{url:'https://api.apinex.bond/v1/chat/completions',defaultModel:'free/glm-5.3-flashx'}};
export function validProvider(name){return Object.hasOwn(CATALOG,name)}
export function safeModel(model,provider){const name=(model||CATALOG[provider]?.defaultModel||'').trim();return name.length>=3&&name.length<=105&&/^[a-zA-Z0-9._:/-]+$/.test(name)?name:null}
function systemText(multiple){return 'Ты помощник для обучения. Прочитай условие на языке пользователя, разберись в вопросе, проверь даты, отрицания, факты и варианты. Не выдумывай. Верни строго JSON вида {"choices":["A"],"answer":"","explanation":"краткое объяснение почему","uncertain":false}. '+(multiple?'Возможны несколько верных вариантов.':'Если предложены варианты, выбери ровно один.')+' Если ответить нельзя, пометь uncertain=true и объясни недостаток данных. Не утверждай о внешней проверке, если источники не были предоставлены.'}
function normalize(q){
 const question=String(q.question||'').trim().slice(0,3300);
 const options=Array.isArray(q.options)?q.options.slice(0,8).map(x=>String(x||'').slice(0,350)):[];
 if(question.length<6||question.length>3300)throw Object.assign(Error('Не удалось получить полный текст вопроса'),{status:400});
 const images=Array.isArray(q.images)?q.images.slice(0,5).filter(x=>x&&typeof x.data==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{200,530000}$/.test(x.data)).map(x=>({data:x.data,label:String(x.label||'Изображение').slice(0,80)})):[];
 const imageCandidates=Math.min(8,Math.max(images.length,Math.max(0,Number(q.imageCandidates)||0)));
 return{question,options,multiple:!!q.multiple,context:String(q.context||'').slice(0,300),images,imageCandidates};
}
function parse(text,n){
 text=String(text||'').trim();let j=null;try{j=JSON.parse(text)}catch(_){const hit=text.match(/\{[\s\S]*\}/);if(hit)try{j=JSON.parse(hit[0])}catch(_){}}
 if(!j||typeof j!=='object')return{answer:text.slice(0,650)||'Не удалось сформировать ответ',explanation:'Формат ответа модели нестандартный.',uncertain:true,choices:[]};
 const allowed='ABCDEFGH'.slice(0,n).split('');const raw=Array.isArray(j.choices)?j.choices:[];
 const choices=[...new Set(raw.map(x=>String(x).toUpperCase().trim()))].filter(x=>allowed.includes(x));
 if(!choices.length&&n>0)return{answer:'Не удалось надёжно определить вариант',explanation:String(j.explanation||'Модель не указала правильные варианты.').slice(0,850),choices:[],uncertain:true};
 let answer=String(j.answer||'').slice(0,700);
 if(choices.length)answer=choices.map(c=>c+') '+String(j._options?.[allowed.indexOf(c)]||'')).join('\n');
 return{answer,explanation:String(j.explanation||'').slice(0,900),choices,uncertain:!!j.uncertain};
}
async function jsonFetch(url,opts,ms){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{...opts,signal:c.signal,redirect:'manual'});if(!r.ok){const e=Error('Провайдер вернул HTTP '+r.status);e.status=r.status===429?429:502;throw e}const txt=await r.text();if(txt.length>150000)throw Error('Ответ провайдера слишком большой');return JSON.parse(txt)}finally{clearTimeout(t)}}
export async function solveWithPersonalKey(provider,model,apiKey,raw){
 const q=normalize(raw);if(!validProvider(provider))throw Object.assign(Error('Провайдер не настроен'),{status:400});
 const chosen=safeModel(model,provider);if(!chosen)throw Object.assign(Error('Неверная модель'),{status:400});
 const prompt='Контекст: '+q.context+'\nВопрос: '+q.question+'\n'+q.options.map((t,i)=>'ABCDEFGH'[i]+') '+t).join('\n');
 const providerUrl=CATALOG.apinex.url;
 // Only send images to a model known to support vision; the user's key stays unchanged.
 const isVisionModel=/gemini|deepseek-v4\.1-flash|hy4-flash|(?:^|[-/])vl(?:[-/]|$)|vision/i.test(chosen);
 const usedModel=q.images.length&&!isVisionModel?'free/gemini-3.8-flash':chosen;
 const content=q.images.length?[
   {type:'text',text:prompt+'\n\nК каждому изображению дана подпись. Внимательно прочти текст, графики и рисунки; если детали невидимы, отметь неопределённость.'},
   ...q.images.flatMap(im=>[{type:'text',text:im.label},{type:'image_url',image_url:{url:im.data,detail:'high'}}])
 ]:prompt;
 const response=await jsonFetch(providerUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:usedModel,messages:[{role:'system',content:systemText(q.multiple)},{role:'user',content}],temperature:0.1,max_tokens:1150})},16000);
 let answer=response.choices?.[0]?.message?.content||'';
 if(Array.isArray(answer))answer=answer.map(x=>x.text||'').join('');
 if(!String(answer).trim())throw Object.assign(Error('Модель не прислала текст'),{status:502});
 const parsed=parse(answer,q.options.length);
 if(parsed.choices.length>1&&!q.multiple){parsed.uncertain=true;parsed.explanation='Модель указала несколько вариантов для вопроса с одним ответом. '+parsed.explanation}
 if(parsed.choices.length)parsed.answer=parsed.choices.map(c=>c+') '+q.options['ABCDEFGH'.indexOf(c)]).join('\n');
 if(q.imageCandidates>q.images.length){parsed.uncertain=true;parsed.explanation+='\nНекоторые изображения на странице не удалось считать: '+(q.imageCandidates-q.images.length)+'. Результат может быть неполным.'}
 return {...parsed,provider,model:usedModel,imageAnalysis:{candidates:q.imageCandidates,transmitted:q.images.length,visionUsed:q.images.length>0}};
}