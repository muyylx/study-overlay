/* Optional! Loaded only when user explicitly chooses the experimental tiny model. */
let generator=null,loading=false;
function say(type,payload={}){postMessage({type,...payload});}
self.onmessage=async({data:d})=>{
 if(d.type==='load'&&!loading&&!generator){loading=true;
  try{
   say('progress',{pct:0,text:'Загружаю библиотеку…'});
   const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   env.allowLocalModels=false;env.allowRemoteModels=true;env.useBrowserCache=true;
   if(env.backends?.onnx?.wasm){env.backends.onnx.wasm.numThreads=1;}
   say('progress',{pct:0,text:'Загружаю SmolLM2 135M (≈182 МБ + доп. файлы)…'});
   generator=await pipeline('text-generation','onnx-community/SmolLM2-135M-Instruct-ONNX-MHA',{
    dtype:'q4',device:'wasm',
    progress_callback:p=>{
     if(p.status==='progress'&&Number.isFinite(p.progress))say('progress',{pct:Math.round(p.progress),text:`Загрузка ${p.file||'файла'}: ${Math.round(p.progress)}%`});
     else if(p.status==='done')say('progress',{text:`Получен файл ${p.file||''}`});
    }
   });
   say('ready');
  }catch(e){say('error',{error:String(e?.message||e)});}finally{loading=false;}
 }else if(d.type==='ask'&&generator){
  try{
   const prompt=[{role:'system',content:'You are a careful study tutor. Explain simply, respond in the same language as the question. If unsure, say so. Do not invent.'},{role:'user',content:String(d.text||'').slice(0,3000)}];
   const out=await generator(prompt,{max_new_tokens:110,do_sample:false,return_full_text:false});
   const raw=out?.[0]?.generated_text??'';
   const text=Array.isArray(raw)?raw.filter(x=>x.role==='assistant').map(x=>x.content).join('\n'):String(raw);
   say('answer',{text:text.trim()||'Мини-модель не смогла ответить.'});
  }catch(e){say('error',{error:String(e?.message||e)});}
 }
};
