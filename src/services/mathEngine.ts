/**
 * PaperTape Reactive Math & Expression Engine
 * Mimics Soulver and Numi for reactive percentage, currency,
 * natural language math, and safe mathematical evaluation.
 */

export interface MathResult {
  result: number | string | null;
  formatted: string | null;
}

type TokenType =
  | 'NUMBER'
  | 'PERCENT'
  | 'PLUS'
  | 'MINUS'
  | 'MUL'
  | 'DIV'
  | 'POW'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'PERCENT_SYM'
  | 'OF'
  | 'OFF'
  | 'ON'
  | 'FUNC'
  | 'EOF';

interface Token {
  type: TokenType;
  value?: number | string;
  rawPercent?: number;
}

interface EvalNodeResult {
  value: number;
  isPercent?: boolean;
  rawPercent?: number;
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely substitutes variable names with their values.
 * Longest variable names are substituted first to prevent partial overlaps.
 */
function substituteVariables(expr: string, variables: Record<string, number>): string {
  if (!variables || Object.keys(variables).length === 0) {
    return expr;
  }

  const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);

  let current = expr;
  for (const key of sortedKeys) {
    const val = variables[key];
    if (typeof val !== 'number' || !isFinite(val)) continue;

    const valStr = val < 0 ? `(${val})` : `${val}`;
    const escaped = escapeRegExp(key.trim());
    // Match whole words/phrases avoiding partial identifier collision
    const regex = new RegExp(`(?<![a-zA-Z0-9_])${escaped}(?![a-zA-Z0-9_])`, 'gi');
    current = current.replace(regex, valStr);
  }
  return current;
}

/**
 * Replaces natural language word operators with standard mathematical symbols.
 */
function normalizeNaturalLanguage(expr: string): string {
  let s = expr;
  s = s.replace(/\bplus\b/gi, '+');
  s = s.replace(/\bminus\b/gi, '-');
  s = s.replace(/\b(times|multiplied\s+by)\b/gi, '*');
  s = s.replace(/\b(divided\s+by|over)\b/gi, '/');
  s = s.replace(/\b(percent|percentage)\b/gi, '%');
  s = s.replace(/\bincreased\s+by\b/gi, '+');
  s = s.replace(/\bdecreased\s+by\b/gi, '-');
  s = s.replace(/\bdiscounted\s+by\b/gi, '-');
  s = s.replace(/\bon\s+top\s+of\b/gi, 'on');
  return s;
}

/**
 * Tokenizes the expression string.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number parsing (integers, decimals, scientific notation)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
      let numStr = '';
      while (i < len && (/\d/.test(input[i]) || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        let eStr = input[i];
        let j = i + 1;
        if (j < len && (input[j] === '+' || input[j] === '-')) {
          eStr += input[j];
          j++;
        }
        if (j < len && /\d/.test(input[j])) {
          while (j < len && /\d/.test(input[j])) {
            eStr += input[j];
            j++;
          }
          numStr += eStr;
          i = j;
        }
      }

      const numVal = parseFloat(numStr);
      if (isNaN(numVal)) {
        throw new Error(`Invalid number: ${numStr}`);
      }

      // Check if followed by optional whitespace and '%'
      let k = i;
      while (k < len && /\s/.test(input[k])) {
        k++;
      }
      if (k < len && input[k] === '%') {
        i = k + 1;
        tokens.push({
          type: 'PERCENT',
          value: numVal,
          rawPercent: numVal
        });
      } else {
        tokens.push({
          type: 'NUMBER',
          value: numVal
        });
      }
      continue;
    }

    // Operators
    if (ch === '+') {
      tokens.push({ type: 'PLUS' });
      i++;
      continue;
    }
    if (ch === '-') {
      tokens.push({ type: 'MINUS' });
      i++;
      continue;
    }
    if (ch === '*' || ch === '×') {
      tokens.push({ type: 'MUL' });
      i++;
      continue;
    }
    if (ch === '/' || ch === '÷') {
      tokens.push({ type: 'DIV' });
      i++;
      continue;
    }
    if (ch === '^') {
      tokens.push({ type: 'POW' });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA' });
      i++;
      continue;
    }
    if (ch === '%') {
      tokens.push({ type: 'PERCENT_SYM' });
      i++;
      continue;
    }

    // Word tokens: of, off, on, functions, constants
    if (/[a-zA-Z_]/.test(ch)) {
      let word = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        word += input[i];
        i++;
      }
      const lower = word.toLowerCase();

      if (lower === 'of') {
        tokens.push({ type: 'OF' });
      } else if (lower === 'off') {
        tokens.push({ type: 'OFF' });
      } else if (lower === 'on') {
        tokens.push({ type: 'ON' });
      } else if (lower === 'pi') {
        tokens.push({ type: 'NUMBER', value: Math.PI });
      } else if (lower === 'e') {
        tokens.push({ type: 'NUMBER', value: Math.E });
      } else if (['sqrt', 'abs', 'round', 'floor', 'ceil', 'min', 'max', 'pow', 'log', 'exp'].includes(lower)) {
        tokens.push({ type: 'FUNC', value: lower });
      } else {
        throw new Error(`Unknown identifier: ${word}`);
      }
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

/**
 * Safe Recursive Descent Parser implementing Operator Precedence
 * and Soulver/Numi reactive percentage semantics.
 */
class MathParser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF' };
  }

  private consume(): Token {
    const tok = this.current();
    if (tok.type !== 'EOF') {
      this.pos++;
    }
    return tok;
  }

  public parse(): EvalNodeResult {
    const result = this.parseAdditive();
    if (this.current().type !== 'EOF') {
      throw new Error(`Unexpected token at end: ${this.current().type}`);
    }
    return result;
  }

  /**
   * Level 1: Additive (+, -)
   * Handles Soulver percentage addition and subtraction:
   * X + Y% -> X * (1 + Y / 100)
   * X - Y% -> X * (1 - Y / 100)
   */
  private parseAdditive(): EvalNodeResult {
    let left = this.parsePercentageBinary();

    while (this.current().type === 'PLUS' || this.current().type === 'MINUS') {
      const op = this.consume().type;
      const right = this.parsePercentageBinary();

      if (op === 'PLUS') {
        if (right.isPercent && right.rawPercent !== undefined) {
          const val = left.value + (left.value * (right.rawPercent / 100));
          left = { value: val };
        } else {
          left = { value: left.value + right.value };
        }
      } else if (op === 'MINUS') {
        if (right.isPercent && right.rawPercent !== undefined) {
          const val = left.value - (left.value * (right.rawPercent / 100));
          left = { value: val };
        } else {
          left = { value: left.value - right.value };
        }
      }
    }

    return left;
  }

  /**
   * Level 2: Percentage Binary Operators (of, off, on)
   * X% of Y -> (X / 100) * Y
   * X% off Y -> Y * (1 - X / 100)
   * X% on Y -> Y * (1 + X / 100)
   */
  private parsePercentageBinary(): EvalNodeResult {
    let left = this.parseMultiplicative();

    while (this.current().type === 'OF' || this.current().type === 'OFF' || this.current().type === 'ON') {
      const op = this.consume().type;
      const right = this.parseMultiplicative();

      const pct = left.rawPercent !== undefined
        ? left.rawPercent
        : (left.isPercent ? left.value * 100 : left.value);

      if (op === 'OF') {
        left = { value: (pct / 100) * right.value };
      } else if (op === 'OFF') {
        left = { value: right.value * (1 - pct / 100) };
      } else if (op === 'ON') {
        left = { value: right.value * (1 + pct / 100) };
      }
    }

    return left;
  }

  /**
   * Level 3: Multiplicative (*, /)
   */
  private parseMultiplicative(): EvalNodeResult {
    let left = this.parsePower();

    while (this.current().type === 'MUL' || this.current().type === 'DIV') {
      const op = this.consume().type;
      const right = this.parsePower();

      if (op === 'MUL') {
        left = { value: left.value * right.value };
      } else if (op === 'DIV') {
        if (right.value === 0) {
          throw new Error('Division by zero');
        }
        left = { value: left.value / right.value };
      }
    }

    return left;
  }

  /**
   * Level 4: Power (^)
   */
  private parsePower(): EvalNodeResult {
    let left = this.parseUnary();

    if (this.current().type === 'POW') {
      this.consume();
      const right = this.parsePower();
      left = { value: Math.pow(left.value, right.value) };
    }

    return left;
  }

  /**
   * Level 5: Unary (+, -)
   */
  private parseUnary(): EvalNodeResult {
    if (this.current().type === 'PLUS') {
      this.consume();
      return this.parseUnary();
    }
    if (this.current().type === 'MINUS') {
      this.consume();
      const res = this.parseUnary();
      return {
        value: -res.value,
        isPercent: res.isPercent,
        rawPercent: res.rawPercent !== undefined ? -res.rawPercent : undefined
      };
    }
    return this.parsePostfixPercent();
  }

  /**
   * Level 6: Postfix Percent (e.g. `(10 + 10)%`)
   */
  private parsePostfixPercent(): EvalNodeResult {
    let node = this.parseAtom();

    if (this.current().type === 'PERCENT_SYM') {
      this.consume();
      node = {
        value: node.value / 100,
        isPercent: true,
        rawPercent: node.value
      };
    }

    return node;
  }

  /**
   * Level 7: Atoms (numbers, percentages, parentheses, functions)
   */
  private parseAtom(): EvalNodeResult {
    const tok = this.current();

    if (tok.type === 'NUMBER') {
      this.consume();
      return { value: tok.value as number };
    }

    if (tok.type === 'PERCENT') {
      this.consume();
      return {
        value: (tok.value as number) / 100,
        isPercent: true,
        rawPercent: tok.rawPercent as number
      };
    }

    if (tok.type === 'LPAREN') {
      this.consume();
      const res = this.parseAdditive();
      if (this.current().type !== 'RPAREN') {
        throw new Error('Mismatched parentheses');
      }
      this.consume();
      return res;
    }

    if (tok.type === 'FUNC') {
      const funcName = this.consume().value as string;
      if (this.current().type !== 'LPAREN') {
        throw new Error(`Expected '(' after function ${funcName}`);
      }
      this.consume();
      const args: number[] = [];
      if (this.current().type !== 'RPAREN') {
        args.push(this.parseAdditive().value);
        while (this.current().type === 'COMMA') {
          this.consume();
          args.push(this.parseAdditive().value);
        }
      }
      if (this.current().type !== 'RPAREN') {
        throw new Error(`Expected ')' after function arguments`);
      }
      this.consume();

      const val = this.executeFunction(funcName, args);
      return { value: val };
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }

  private executeFunction(name: string, args: number[]): number {
    switch (name) {
      case 'sqrt':
        if (args.length !== 1) throw new Error('sqrt takes 1 argument');
        if (args[0] < 0) throw new Error('sqrt of negative number');
        return Math.sqrt(args[0]);
      case 'abs':
        if (args.length !== 1) throw new Error('abs takes 1 argument');
        return Math.abs(args[0]);
      case 'round':
        if (args.length !== 1) throw new Error('round takes 1 argument');
        return Math.round(args[0]);
      case 'floor':
        if (args.length !== 1) throw new Error('floor takes 1 argument');
        return Math.floor(args[0]);
      case 'ceil':
        if (args.length !== 1) throw new Error('ceil takes 1 argument');
        return Math.ceil(args[0]);
      case 'min':
        if (args.length === 0) throw new Error('min requires at least 1 argument');
        return Math.min(...args);
      case 'max':
        if (args.length === 0) throw new Error('max requires at least 1 argument');
        return Math.max(...args);
      case 'pow':
        if (args.length !== 2) throw new Error('pow takes 2 arguments');
        return Math.pow(args[0], args[1]);
      case 'log':
        if (args.length !== 1 || args[0] <= 0) throw new Error('log takes 1 positive argument');
        return Math.log(args[0]);
      case 'exp':
        if (args.length !== 1) throw new Error('exp takes 1 argument');
        return Math.exp(args[0]);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
}

/**
 * Safely evaluates an arithmetic expression using the recursive descent parser.
 */
function evaluateInternal(expr: string): number | null {
  try {
    const normalized = normalizeNaturalLanguage(expr);
    const tokens = tokenize(normalized);
    const parser = new MathParser(tokens);
    const result = parser.parse();
    if (!isFinite(result.value) || isNaN(result.value)) {
      return null;
    }
    return result.value;
  } catch {
    return null;
  }
}

/**
 * Formats a numeric result cleanly with optional currency.
 */
export function formatValue(val: number, currency: string | null = null): string {
  // Eliminate minor IEEE-754 precision artifacts
  const cleanVal = Math.round(val * 1e10) / 1e10;
  const isInt = cleanVal % 1 === 0;

  let formattedNumber: string;
  if (isInt) {
    formattedNumber = cleanVal.toLocaleString('en-US');
  } else {
    if (currency) {
      formattedNumber = cleanVal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      formattedNumber = parseFloat(cleanVal.toFixed(4)).toLocaleString('en-US', {
        maximumFractionDigits: 4
      });
    }
  }

  if (currency) {
    return `${currency}${formattedNumber}`;
  }
  return formattedNumber;
}

/**
 * Evaluates a mathematical and natural percentage expression.
 * Mimics Soulver and Numi calculation paradigms.
 *
 * @param expr The raw math expression (e.g. "$150 + 20% =", "30% off 80", "25 as a % of 100")
 * @param variables Lookup dictionary of variables
 * @returns { result: number | string | null, formatted: string | null }
 */
export function evaluateMathExpression(
  expr: string,
  variables: Record<string, number> = {}
): MathResult {
  if (!expr || typeof expr !== 'string') {
    return { result: null, formatted: null };
  }

  let cleaned = expr.trim();
  if (cleaned.length === 0) {
    return { result: null, formatted: null };
  }

  // Strip trailing '=' or '?'
  cleaned = cleaned.replace(/[=\?]\s*$/, '').trim();
  if (cleaned.length === 0) {
    return { result: null, formatted: null };
  }

  // Detect and extract primary currency symbol: $, €, £, ¥
  let detectedCurrency: string | null = null;
  const currMatch = cleaned.match(/[\$€£¥]/);
  if (currMatch) {
    detectedCurrency = currMatch[0];
  }

  // Strip currency symbols for parsing
  cleaned = cleaned.replace(/[\$€£¥]/g, '');

  // Strip standard thousands comma separators between digits: 1,000 -> 1000
  cleaned = cleaned.replace(/(?<=\d),(?=\d{3})/g, '');

  // Substitute variables in expression
  cleaned = substituteVariables(cleaned, variables);

  // Check for "X as a % of Y" or "X as % of Y"
  const asPercentMatch = cleaned.match(/^(.*?)\s+(?:as\s+(?:a\s+)?|in\s+)(?:%|percent(?:age)?)\s+of\s+(.*)$/i);
  if (asPercentMatch) {
    const leftEval = evaluateInternal(asPercentMatch[1].trim());
    const rightEval = evaluateInternal(asPercentMatch[2].trim());

    if (leftEval === null || rightEval === null || rightEval === 0) {
      return { result: null, formatted: null };
    }

    const ratio = (leftEval / rightEval) * 100;
    const rounded = Math.round(ratio * 1e10) / 1e10;
    let formattedRatio: string;
    if (rounded % 1 === 0) {
      formattedRatio = `${rounded}%`;
    } else {
      formattedRatio = `${parseFloat(rounded.toFixed(2))}%`;
    }
    return {
      result: formattedRatio,
      formatted: formattedRatio
    };
  }

  // Evaluate mathematical expression
  const val = evaluateInternal(cleaned);
  if (val === null || !isFinite(val) || isNaN(val)) {
    return { result: null, formatted: null };
  }

  const cleanVal = Math.round(val * 1e10) / 1e10;
  const formatted = formatValue(cleanVal, detectedCurrency);

  return {
    result: cleanVal,
    formatted
  };
}
