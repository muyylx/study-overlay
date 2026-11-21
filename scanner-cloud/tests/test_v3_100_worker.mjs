import fs from 'node:fs';
const js=fs.readFileSync(new URL('../worker-v3.100.js',import.meta.url),'utf-8');
const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const worker=(await import(url)).default;
const key='fake-token-testing';
const env={SCANNER_CLIENT_TOKEN:key,GROQ_KEY:'groq-test',APINEX_API_KEY:'apx-test',GEMINI_KEY:'gemini-test',OPENROUTER_KEY:'router-test',ASK_RATE:{limit:async()=>({success:true})}};
let seen=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
globalThis.fetch=async(uri,options)=>{
 const u=String(uri),body=options.body?JSON.parse(options.body):{};
 seen.push({u,body,method:options.method,at:Date.now()});
 if(u.includes('wikipedia.org')||u.includes('wikidata.org'))return new Response('{}',{status:200});
 if(u.includes('api.groq.com')){await sleep(120);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({choices:['C'],explanation:'Вміст газу заповнює посудину.',uncertain:false})}}]}),{status:200});}
 if(u.includes('api.apinex.bond')){await sleep(1100);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({choices:['C'],explanation:'Вміст газу заповнює посудину.',uncertain:false})}}]}),{status:200});}
 if(u.includes('generativelanguage.googleapis.com')){await sleep(650);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({choices:['C'],explanation:'Вміст газу заповнює посудину.',uncertain:false})}]}}]}),{status:200});}
 return new Response('not found',{status:404});
};
const mk = async (q,quick=true)=>{
  const req=new Request('https://mock.workers.dev/solve'+(quick?'?quick=1':''),{method:'POST',headers:{'x-scanner-token':key,'content-type':'application/json'},body:JSON.stringify(q)});
  const started=performance.now(),resp=await worker.fetch(req,env);const answer=await resp.json();return{status:resp.status,elapsed:Math.round(performance.now()-started),answer};
};
const q={question:'Що відомо про гази?',options:['постійний об’єм','визначена форма','заповнюють всю ємність','не можна стиснути'],multiple:false,context:'Тест'};
const a=await mk(q);console.log('quick-text',a.elapsed,a.answer.answer,a.answer.verification,'queries',seen.length);if(a.status!==200||a.elapsed>850||a.answer.choices[0]!=='C'||!a.answer.fast)throw Error('quick path failed');
seen=[];const image={label:'Рисунок вопроса 1',data:'data:image/jpeg;base64,'+'A'.repeat(300)};const b=await mk({...q,question:'Що показано на цьому рисунку?',images:[image]});console.log('quick-vision',b.elapsed,b.answer.answer,b.answer.verification,seen.map(x=>x.u.split('/')[2]));if(b.status!==200||b.answer.choices[0]!=='C'||seen.some(x=>x.u.includes('api.groq.com')))throw Error('image-essential routing failed');
seen=[];const c=await mk({...q,images:[image]});console.log('decorative-image-fast-text',c.elapsed,c.answer.answer,seen.map(x=>x.u.split('/')[2]));if(c.status!==200||c.elapsed>750||!seen.some(x=>x.u.includes('api.groq.com')))throw Error('decorative photo latency failed');
console.log('PASSED 3/3');