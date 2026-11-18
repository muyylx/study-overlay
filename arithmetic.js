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

  function solve(text) {
    const [question, choices] = text.replace(/^Вопрос \(проверь текст\):\s*/u,'').split(/\nВарианты:\s*\n/u);
    // Parse the whole prompt. Extracting an arbitrary substring can turn a score or an option into the exercise.
    const expression = question.trim()
      .replace(/^(?:виконай(?:те)? дії|обчисл(?:и|іть|ити)|вычисли(?:те|ть)?|знайд(?:и|іть) значення виразу|найди(?:те)? значение выражения|чему равно|сколько (?:будет|получится)|скільки буде)\s*[:：]?\s*/iu,'')
      .replace(/[\s=?？]+$/u,'').trim();
    if (!/[+\-−–—﹣－/]/u.test(expression)) return null;
    const result = calculate(expression);
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
