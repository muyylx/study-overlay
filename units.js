// Whole-question parser: text problems with extra conditions stay with the solver.
(() => {
  const groups = [
    [['мм mm',1],['см cm',10],['дм dm',100],['м m',1000],['км km',1000000]],
    [['мг mg',1],['г g',1000],['кг kg',1000000],['т t',1000000000]],
    [['мс ms',1],['с s сек',1000],['хв мин min',60000],['ч h',3600000]],
    [['мм² mm²',1],['см² cm²',100],['м² m²',1000000],['га ha',10000000000],['км² km²',1000000000000]],
    [['мл ml см³ cm³',1],['л l дм³ dm³',1000],['м³ m³',1000000]],
    [['Па Pa',1],['кПа kPa',1000],['МПа MPa',1000000]],
    [['Дж J',1],['кДж kJ',1000],['МДж MJ',1000000]],
    [['Вт W',1],['кВт kW',1000],['МВт MW',1000000]],
    [['Гц Hz',1],['кГц kHz',1000],['МГц MHz',1000000]],
    [['м/с m/s',18],['км/год км/ч km/h',5]]
  ];
  const units = new Map();
  groups.forEach((group,dimension)=>group.forEach(([names,factor])=>{
    for(const name of names.split(' ')) units.set(name,{dimension,factor:BigInt(factor)});
  }));
  function parse(value){
    const match=value.trim().match(/^([+-]?\d{1,14})(?:[.,](\d{1,10}))?\s*([^\s]+)$/u);
    if(!match || !units.has(match[3]))return null;
    const digits=match[2]||'';
    return {n:BigInt(match[1]+digits),d:10n**BigInt(digits.length),unit:units.get(match[3])};
  }
  function format(n,d){
    const sign=n<0n?'-':'';
    if(n<0n)n=-n;
    let a=n,b=d;
    while(b)[a,b]=[b,a%b];
    n/=a;d/=a;
    let k=0,p=1n;
    while(p%d && k<12){p*=10n;k++;}
    if(p%d)return sign+n+'/'+d;
    const digits=(n*p/d).toString().padStart(k+1,'0');
    return sign+(k?digits.slice(0,-k)+','+digits.slice(-k):digits);
  }
  window.scannerUnits = question=>{
    const [stem,choices]=question.replace(/^Вопрос \(проверь текст\):\s*/u,'').split('\nВарианты:\n');
    const m=stem.trim().replace(/[?!.]+$/u,'').match(/^(?:(?:переведи(?:те)?|переведіть|переведи|виразіть|выразите|convert)\s*:?\s*)?(.+?)\s*(?:→|=\s*\?|\s+(?:в|у|to)\s+)\s*(\S+)$/iu);
    if(!m)return null;
    const from=parse(m[1]),to=units.get(m[2]);
    if(!from||!to||from.unit.dimension!==to.dimension)return null;
    const n=from.n*from.unit.factor,d=from.d*to.factor;
    if(!choices)return format(n,d)+' '+m[2];
    const matches=[];
    for(const row of choices.trim().split('\n')){
      const entry=row.trim().replace(/^\d+\.\s+(?=[A-HА-Д])/u,'').match(/^([A-HА-Д])[).:\s]+(.+)$/u);
      if(!entry)return null;
      const val=parse(entry[2])||parse(entry[2]+' '+m[2]);
      if(val && val.unit.dimension===to.dimension && val.unit.factor===to.factor && val.n*d===n*val.d)matches.push(entry[1]+') '+entry[2]);
    }
    return matches.length===1?matches[0]:null;
  };
})();
