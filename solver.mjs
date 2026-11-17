/* Study Overlay Lite: deterministic, offline school-math helper. No eval, no network. */
const num = x => Number(String(x).replace(',', '.').replace(/\s/g, ''));
const fmt = x => Number.isFinite(x) ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 8 }).format(Number(x.toFixed(8))) : 'не определено';
function tokenize(expr) {
  const s = expr.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/[÷:]/g, '/').replace(/\s/g, '').replace(/,(?=\d)/g, '.');
  if (s.length > 160 || !/^[\d.()+\-*/^]+$/.test(s)) return null;
  const tokens = s.match(/\d+(?:\.\d+)?|\.\d+|[()+\-*/^]/g);
  if (!tokens || tokens.join('') !== s || tokens.length > 80) return null;
  return tokens;
}
export function evaluate(expr) {
  const t = tokenize(expr); if (!t) return null;
  let i = 0;
  function atom(depth) {
    if (depth > 30) throw Error('depth');
    const x = t[i++];
    if (x === '+') return atom(depth + 1);
    if (x === '-') return -atom(depth + 1);
    if (x === '(') { const v = sum(depth + 1); if (t[i++] !== ')') throw Error('paren'); return v; }
    if (x && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(x)) return Number(x);
    throw Error('number');
  }
  function power(depth) {
    let v = atom(depth + 1);
    if (t[i] === '^') { i++; const exponent = power(depth + 1); if (Math.abs(exponent) > 12) throw Error('power'); v = Math.pow(v, exponent); }
    return v;
  }
  function product(depth) {
    let v = power(depth + 1);
    while (t[i] === '*' || t[i] === '/') {
      const op = t[i++], b = power(depth + 1);
      if (op === '/' && b === 0) throw Error('zero');
      v = op === '*' ? v * b : v / b;
    }
    return v;
  }
  function sum(depth) {
    let v = product(depth + 1);
    while (t[i] === '+' || t[i] === '-') { const op = t[i++], b = product(depth + 1); v = op === '+' ? v + b : v - b; }
    return v;
  }
  try { const v = sum(0); if (i !== t.length || !Number.isFinite(v) || Math.abs(v) > 1e14) return null; return v; }
  catch { return null; }
}
function detectOption(text, value) {
  const lines = text.split(/\n|(?=\b[А-ГA-D][\).]\s)/).map(s=>s.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^([А-ГA-D1-9])\s*[).:-]\s*([-+]?\d+(?:[,.]\d+)?)(?:\b|\s|$)/i);
    if (m && Math.abs(num(m[2]) - value) < 1e-7) return `\nВ вариантах подходит: ${m[1]}) ${m[2]}.`;
  }
  return '';
}
export function solveOffline(raw) {
  const text = String(raw ?? '').replace(/\u00a0/g, ' ').slice(0, 7000).trim();
  if (!text) return { kind: 'empty', title: 'Нет вопроса', answer: 'Нажми «Считать страницу» или вставь текст задания.' };
  const simple = text.replace(/[−–]/g, '-');
  // 2x + 3 = 11, -x - 4 = 2, x=7
  const eq = simple.match(/(?:^|[^\p{L}\d])([+-]?\s*(?:\d+(?:[,.]\d+)?)?\s*[xх]\s*(?:[+-]\s*\d+(?:[,.]\d+)?)?)\s*=\s*([+-]?\d+(?:[,.]\d+)?)(?=$|[^\d])/imu);
  if (eq) {
    const left = eq[1].replace(/\s/g, '').replace('х', 'x');
    const match = left.match(/^([+-]?(?:\d+(?:[,.]\d+)?)?)x([+-]\d+(?:[,.]\d+)?)?$/);
    if (match) {
      const a = !match[1] || match[1] === '+' ? 1 : match[1] === '-' ? -1 : num(match[1]);
      const b = match[2] ? num(match[2]) : 0, c = num(eq[2]);
      if (a !== 0 && [a,b,c].every(Number.isFinite)) {
        const value = (c - b) / a;
        return { kind:'math', title:'Линейное уравнение', answer:`${left} = ${fmt(c)}\nПереносим свободный член: ${fmt(a)}x = ${fmt(c - b)}\nДелим на ${fmt(a)}.\nОтвет: x = ${fmt(value)}.${detectOption(text,value)}` };
      }
    }
  }
  // p% от n, Russian/Ukrainian
  const perc = simple.match(/(\d+(?:[,.]\d+)?)\s*%\s*(?:от|від|of)\s*(\d+(?:[,.]\d+)?)/i);
  if (perc) {
    const p=num(perc[1]),base=num(perc[2]),v=base*p/100;
    return {kind:'math',title:'Проценты',answer:`${fmt(p)}% от ${fmt(base)} = ${fmt(base)} × ${fmt(p)} / 100 = ${fmt(v)}.${detectOption(text,v)}`};
  }
  // Simple geometric area word problems. Requires explicit figure + two measurements.
  if (/площад[ьи]|площ[аі]|area/i.test(simple) && /прямоугольник|прямокутник/i.test(simple)) {
    const a=simple.match(/(?:длина|довжина)\D{0,13}(\d+(?:[,.]\d+)?)/i), b=simple.match(/(?:ширина|ширина)\D{0,13}(\d+(?:[,.]\d+)?)/i);
    if(a&&b){const v=num(a[1])*num(b[1]);return {kind:'math',title:'Площадь прямоугольника',answer:`S = длина × ширина = ${fmt(num(a[1]))} × ${fmt(num(b[1]))} = ${fmt(v)}.${detectOption(text,v)}`};}
  }
  // Evaluate only a clear expression, avoid blindly parsing random numbers in text.
  const normalized = simple.replace(/[×·]/g, '*').replace(/[÷]/g, '/');
  const chunks = [...normalized.matchAll(/(?:^|[\n\s:=?])((?:\(?\s*[-+]?\s*\d+(?:[,.]\d+)?\s*\)?\s*){1,3}(?:[+*/^:-]\s*\(?\s*[-+]?\s*\d+(?:[,.]\d+)?\s*\)?\s*)+)(?=\s*(?:[=?.!,;\n]|$))/g)];
  for (const chunk of chunks) {
    const expr=chunk[1].trim();
    const v=evaluate(expr);
    if (v!==null) return {kind:'math',title:'Вычисление',answer:`Выражение: ${expr}\nСначала считаем действия в скобках и степени, затем умножение/деление, затем сложение/вычитание.\nРезультат: ${fmt(v)}.${detectOption(text,v)}`};
  }
  return {kind:'unknown',title:'Нужен подробный разбор',answer:'Быстрый режим умеет точно разбирать некоторые вычисления, проценты и уравнения, но не может достоверно ответить на этот вопрос. Можно скопировать его для более мощного помощника или попробовать экспериментальную компактную модель. Не выбираю ответ наугад.'};
}
