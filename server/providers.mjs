async function timed(url,init,ms){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{...init,signal:c.signal,redirect:'manual'});if(!r.ok)throw Object.assign(Error('provider'),{status:r.status});return await r.json()}finally{clearTimeout(t)}}
export async function external(env,id,messages){
 if(id==='gemini'){
 const parts=messages.slice(1).flatMap(m=>typeof m.content==='string'?[{text:m.content}]:m.content.map(p=>{if(p.type==='text')return {text:p.text};const [,mime,data]=p.image_url.url.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);return {inlineData:{mimeType:mime,data}}}));
 const r=await timed('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:messages[0].content}]},contents:[{role:'user',parts}],generationConfig:{temperature:0,maxOutputTokens:650}})},8500);
 return r.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'';}
 const groq=id==='groq';
 const r=await timed(groq?'https://api.groq.com/openai/v1/chat/completions':'https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+(groq?env.GROQ_KEY:env.OPENROUTER_KEY)},body:JSON.stringify({model:groq?'openai/gpt-oss-120b':'openrouter/free',messages,temperature:0,max_tokens:500})},8500);
 return r.choices?.[0]?.message?.content||'';}
const encyclopedia = new Map();
export async function wiki(stem,lesson){
 const tokens=s=>(s.toLowerCase().match(/[\p{L}\d]{3,}/gu)||[]).filter(x=>!['який','якого','який','какой','what','which','тест','вопрос','питання'].includes(x));
 const terms=tokens(stem).slice(0,12);if(terms.length<2||/https?:|@|\d{6}/.test(stem))return null;
 const lang=/[іїєґ]/i.test(stem+' '+lesson.topic)?'uk':/[а-яё]/i.test(stem)?'ru':'en';
 const topic=String(lesson.topic||lesson.author||'').slice(0,100);
 const q=new URLSearchParams({action:'query',generator:'search',gsrsearch:topic+' '+terms.slice(0,6).join(' '),gsrlimit:'3',prop:'extracts|info',inprop:'url',exintro:'1',explaintext:'1',exchars:'1400',format:'json'});
 const cacheKey=lang+':'+q;const prior=encyclopedia.get(cacheKey);if(prior&&Date.now()-prior.time<3600000)return prior.value;
 try{const r=await timed('https://'+lang+'.wikipedia.org/w/api.php?'+q,{headers:{'User-Agent':'StudyOverlay/3.7 (https://github.com/muyylx/study-overlay)'}},1600);
 const candidates=Object.values(r.query?.pages||{}).filter(p=>p.extract&&p.fullurl).map(p=>({p,score:new Set(terms.filter(t=>(p.title+' '+p.extract).toLowerCase().includes(t))).size})).sort((a,b)=>b.score-a.score);
 const hit=candidates[0];if(!hit||hit.score<2)return null;const value={fact:hit.p.extract,url:hit.p.fullurl};if(encyclopedia.size>=128)encyclopedia.delete(encyclopedia.keys().next().value);encyclopedia.set(cacheKey,{value,time:Date.now()});return value;}catch{return null;}}

