// Exact addition and subtraction for unambiguous text exercises.
(() => {
  function numberPair(text) {
    const parts = text.split('/');
    if (parts.length === 2) return [BigInt(parts[0]), BigInt(parts[1])];
    const [whole, decimal = ''] = text.replace(',', '.').split('.');
    return [BigInt(whole + decimal), 10n ** BigInt(decimal.length)];
  }

  function calculate(text) {
    if (text.length > 180) return null;
    const source = text.replace(/[−–—﹣－]/g, '-').trim();
    const tokens = source.match(/\d+(?:[.,]\d+|\s*\/\s*\d+)?|[()+-]|[^\s]/gu) || [];
    let pos = 0;
    function atom() {
      const sign = tokens[pos] === '-' ? -1n : 1n;
      if (['+', '-'].includes(tokens[pos])) pos++;
      let pair;
      if (tokens[pos] === '(') {
        pos++;
        pair = sum();
        if (tokens[pos++] !== ')') throw Error();
      } else {
        const literal = tokens[pos++] || '';
        if (!/^\d+(?:[.,]\d+|\s*\/\s*\d+)?$/.test(literal)) throw Error();
        pair = numberPair(literal.replace(/\s/g, ''));
        if (!pair[1]) throw Error();
      }
      return [pair[0] * sign, pair[1]];
    }
    function sum() {
      let [n,d] = atom();
      while (['+', '-'].includes(tokens[pos])) {
        const minus = tokens[pos++] === '-';
        const [a,b] = atom();
        n = n*b + (minus ? -a : a)*d;
        d *= b;
      }
      return [n,d];
    }
    try {
      const result = sum();
      return pos === tokens.length ? result : null;
    } catch { return null; }
  }

  function evaluate(side, x) {
      const tokens = side.replace(/(\d|\))(?=x|\()/gu, '$1*').match(/\d+(?:[.,]\d+)?|[^\s]/gu) || [];
      let pos = 0;
      function atom() {
        const t = tokens[pos++];
        if (t === '+' || t === '-') {
          const [n,d] = atom();
          return [t === '-' ? -n : n,d];
        }
        if (t === '(') {
          const pair = sum();
          if (tokens[pos++] !== ')') throw Error();
          return pair;
        }
        if (t === 'x' && x) return x;
        if (!t || !/^\d+(?:[.,]\d+)?$/u.test(t)) throw Error();
        return numberPair(t);
      }
      function product() {
        let [n,d] = atom();
        while (['*','×','·','/','÷'].includes(tokens[pos])) {
          const op = tokens[pos++], [a,b] = atom();
          if (op === '/' || op === '÷') {
            if (!a) throw RangeError();
            n *= b; d *= a;
          } else { n *= a; d *= b; }
        }
        return [n,d];
      }
      function sum() {
        let [n,d] = product();
        while (tokens[pos] === '+' || tokens[pos] === '-') {
          const op = tokens[pos++], [a,b] = product();
          n = n*b + (op === '-' ? -a : a)*d; d *= b;
        }
        return [n,d];
      }
      const result = sum();
      if (pos !== tokens.length) throw Error();
      return result;
    }

  // Substitute each displayed value in the original equation, including its denominators.
  function checkCandidates(expression, choices) {
    const sides = expression.replace(/[хХX]/gu, 'x').replace(/[−–—]/gu, '-').split('=');
    if (sides.length !== 2 || sides.some(side => !side.trim() || /[^x0-9.,()+*/÷×·\s-]/u.test(side)) || expression.length > 180) return null;
    const hits = [];
    for (const line of choices.trim().split('\n')) {
      const entry = line.trim().replace(/^\d+\.\s+(?=[A-HА-Д])/iu,'').match(/^([A-HА-Д])[).:\s]+(.+)$/iu);
      if (!entry) return null;
      const x = calculate(entry[2]);
      if (!x) return null;
      try {
        const [a,b] = evaluate(sides[0],x), [c,d] = evaluate(sides[1],x);
        if (a*d === c*b) hits.push(entry[1]+') '+entry[2]);
      } catch (error) {
        if (!(error instanceof RangeError)) return null;
      }
    }
    return hits.length === 1 ? hits[0] : null;
  }

  function solve(text) {
    const [question, choices] = text.replace(/^Вопрос \(проверь текст\):\s*/u,'').split(/\nВарианты:\s*\n/u);
    // Parse the whole prompt. Extracting an arbitrary substring can turn a score or an option into the exercise.
    const expression = question.trim()
      .replace(/^(?:виконай(?:те)? (?:дії|додавання(?: зручним способом)?)|спрости(?:ти)? вираз|розв[’'ʼ]яж(?:и|іть) рівняння|виконай(?:те)? дії|обчисл(?:и|іть|ити)|вычисли(?:те|ть)?|знайд(?:и|іть) значення виразу|найди(?:те)? значение выражения|чему равно|сколько (?:будет|получится)|скільки буде)\s*[:：]?\s*/iu,'')
      .replace(/[\s=?？]+$/u,'').trim();
    if (choices && expression.includes('=') && /[xх]/iu.test(expression)) {
      const checked = checkCandidates(expression, choices);
      if (checked) return checked;
    }
    if (!/[+\-−–—﹣－/*×·÷]/u.test(expression)) return null;
    let result = calculate(expression);
    if (!result && expression.length <= 180 && /^[0-9.,()+*/×·÷\s−–—-]+$/u.test(expression)) {
      try { result = evaluate(expression.replace(/[−–—]/gu, '-'), null); }
      catch { return null; }
      if (result[1] < 0n) result = [-result[0], -result[1]];
    }
    if (!result && /[a-zх]/i.test(expression)) {
      // With only addition and subtraction, evaluating at zero and each basis vector
      // recovers the constant and every coefficient exactly.
      const sides = expression.replace(/х/gu,'x').split('=');
      if (sides.length > 2 || /[^a-z0-9.,()+−–—/\s=-]/i.test(sides.join('='))) return null;
      const variables = [...new Set(sides.join('').match(/[a-z]/gi) || [])];
      if (!variables.length || variables.length > 6) return null;
      const difference = sides.length === 2 ? '('+sides[0]+')-('+sides[1]+')' : sides[0];
      const at = active => calculate(difference.replace(/[a-z]/gi,letter=>letter===active?'(1)':'(0)'));
      const constant=at(null);
      if (!constant) return null;
      if (sides.length === 2 && variables.length !== 1) return null;
      result=constant;
      for (const variable of variables) {
        const sample=at(variable);
        if (!sample) return null;
        const slope=sample[0]*constant[1]-constant[0]*sample[1];
        if (sides.length===1 && slope!==0n || sides.length===2 && slope===0n) return null;
        if (sides.length===2) result=slope>0n?[-constant[0]*sample[1],slope]:[constant[0]*sample[1],-slope];
      }
    }
    if (!result) return null;
    const [n,d] = result;
    if (choices) {
      const matches = [];
      for (const line of choices.trim().split('\n')) {
        // Previous bookmarks prefixed every option with a synthetic ordinal.
        const choice = line.trim().replace(/^\d+\.\s+(?=[A-DА-ГІЇЄҐ][).:\s])/iu,'');
        const parts = choice.match(/^(?:([A-HА-ДЄІЇҐ])(?:\s*[).:]\s*|\s+))?(.+)$/iu);
        if (!parts) continue;
        const value = calculate(parts[2]);
        if (!value) continue;
        if (value[0]*d === n*value[1]) matches.push(parts[1] ? parts[1]+') '+parts[2] : parts[2]);
      }
      if (matches.length === 1) return matches[0];
    }
    let a = n < 0n ? -n : n, b = d;
    while (b) [a,b] = [b,a%b];
    return d/a === 1n ? String(n/a) : String(n/a)+'/'+String(d/a);
  }
  window.scannerArithmetic = solve;
})();
