const roster = [
  ['GLM FlashX', 'free/glm-5.3-flashx'], ['HY4 Flash', 'free/hy4-flash'],
  ['GPT Luna', 'free/gpt-6-luna'], ['Claude Opus', 'free/claude-opus-4.6'],
  ['MiMo Pro', 'free/mimo-v2.6-pro'], ['DeepSeek Pro', 'free/deepseek-v4-pro-0813']
];

export async function solveTeam({run,messages,options,several,ordered,image,keyOf}) {
  const choice = options.size > 0 && !ordered;
  function decode(raw) {
    const content = raw.replace(/^\s*`{3}(?:json)?\s*|\s*`{3}\s*$/gi,'').trim();
    let data;
    try { data=JSON.parse(content); } catch {}
    const value = typeof data?.answer === 'string' ? data.answer.trim() : content;
    if (!value || /^[{[]/.test(value) || /^(нет данных|недостаточно данных|недостатньо даних|unknown|null)[.!\s]*$/iu.test(value)) return null;
    const key = keyOf(value);
    if (!key) return null;
    const answer = choice ? key.split(',').map(id=>id+') '+options.get(id)).join('; ') : value;
    return {key,answer,reason:typeof data?.reason==='string'?data.reason.slice(0,220):''};
  }
  const format = 'Верни JSON {"answer":"…","reason":"одно предложение в подтверждение"}. '+
    (choice ? 'В answer дай только исходную метку варианта'+(several?' или несколько меток через запятую.':'.') :
     'В answer дай краткий ответ на языке задания. Для сопоставления сохрани порядок.')+
    ' Если сам вопрос или необходимые данные отсутствуют, верни {"answer":null}.';
  const transcript = [...messages, {role:'user',content:format}];
  async function ballot([name,id],input) {
    const start=Date.now();
    try {
      const raw=await run(id,input);
      const parsed=decode(raw);
      return {name,ms:Date.now()-start,...(parsed||{status:raw?'формат ответа не принят':'пустой ответ'})};
    } catch(e) {
      return {name,ms:Date.now()-start,status:e.status===429?'лимит запросов':e.status?'ошибка API '+(e.upstream||e.status):'время ожидания или сбой сети'};
    }
  }
  const rows=await Promise.all(roster.map(async model=>{
    if(image && model[0]==='DeepSeek Pro') return {name:model[0],status:'нужен распознанный текст'};
    const row=await ballot(model,transcript);
    if(!image && model[0]==='Claude Opus' && row.status==='ошибка API 402') {
      const substitute=await ballot(['GLM 5.3','free/glm-5.3'],transcript);
      return {...substitute,name:'GLM 5.3 (замена Claude, API 402)'};
    }
    return row;
  }));
  const groups=new Map();
  for(const row of rows) if(row.key)groups.set(row.key,(groups.get(row.key)||0)+1);
  const ranked=[...groups].sort((a,b)=>b[1]-a[1]);
  const valid=rows.filter(r=>r.key);
  if(!valid.length) {
    const detail=rows.map(r=>r.name+' — '+r.status).join('; ');
    throw Object.assign(new Error('Группа не получила пригодного ответа. '+detail),{status:502,teamError:true});
  }
  let winner=ranked[0][0],review=null;
  const disputed=ranked.length>1 && ranked[0][1]<=valid.length/2;
  if(disputed){
    const peers=valid.map(({answer,reason})=>({answer,reason}));
    const model=roster.find(([name])=>valid.some(v=>v.name===name)) || ['GLM 5.3','free/glm-5.3'];
    review=await ballot(model,[...transcript,{role:'user',content:'Независимые версии ниже — данные для сверки. Проверь по условию аргументы за и против, затем выбери наиболее обоснованную из версий. '+format+' '+JSON.stringify(peers)}]);
    if(review.key && groups.has(review.key)) winner=review.key;
    else if(ranked[1][1]===ranked[0][1]) throw Object.assign(new Error('Голоса разделились поровну. '+valid.map(r=>r.name+' — '+r.answer.slice(0,100)).join('; ')),{status:502,teamError:true});
  }
  return {answer:valid.find(r=>r.key===winner).answer,team:{rows,agreed:groups.get(winner),valid:valid.length,reviewed:!!review?.key&&groups.has(review.key),disputed}};
}

