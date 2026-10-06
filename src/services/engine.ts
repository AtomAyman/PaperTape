import { evaluateMathExpression } from './mathEngine';
import { evaluateDateTimeExpression } from './dateTimeEngine';
import { parseReminderFromLine, ReminderData } from './reminderEngine';

export interface MathVariable {
  name: string;
  value: number;
}

export interface LineEvaluation {
  raw: string;
  isTrigger: boolean;
  triggerType?: 'sum' | 'avg' | 'count' | 'math' | 'timer' | 'checklist' | 'variable' | 'date' | 'duration' | 'timezone' | 'reminder';
  result?: string | number | null;
  timerData?: {
    type: 'stopwatch' | 'countdown' | 'pomo';
    seconds: number;
    initialSeconds: number;
    label: string;
  };
  reminderData?: ReminderData;
  isChecklistItem?: boolean;
  isChecked?: boolean;
  cleanText?: string;
  varName?: string;
  varValue?: number;
}

// Common conversion multipliers
const UNIT_CONVERSIONS: Record<string, { to: string; factor: number }> = {
  'km to miles': { to: 'miles', factor: 0.621371 },
  'km in miles': { to: 'miles', factor: 0.621371 },
  'miles to km': { to: 'km', factor: 1.60934 },
  'miles in km': { to: 'km', factor: 1.60934 },
  'lbs to kg': { to: 'kg', factor: 0.453592 },
  'lbs in kg': { to: 'kg', factor: 0.453592 },
  'kg to lbs': { to: 'lbs', factor: 2.20462 },
  'kg in lbs': { to: 'lbs', factor: 2.20462 },
  'usd in eur': { to: 'EUR', factor: 0.92 },
  'eur in usd': { to: 'USD', factor: 1.09 },
  'usd in gbp': { to: 'GBP', factor: 0.79 },
  'usd in cad': { to: 'CAD', factor: 1.36 }
};

export function evaluateNoteContent(content: string): LineEvaluation[] {
  const lines = content.split('\n');
  const variables: Record<string, number> = {};
  const evaluations: LineEvaluation[] = [];

  // Pass 1: Parse variables from lines like "rate: 85" or "daily earnings: hourly rate * 8"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes(':') && !line.startsWith('http://') && !line.startsWith('https://')) {
      const parts = line.split(':');
      const varName = parts[0].trim().toLowerCase();
      const valStr = parts.slice(1).join(':').trim();

      // Check if it's a direct number or calculation
      const numMatch = valStr.match(/^[\$€£]?\s*([0-9]+(?:\.[0-9]+)?)/);
      if (numMatch && !valStr.includes('*') && !valStr.includes('+') && !valStr.includes('-') && !valStr.includes('/')) {
        variables[varName] = parseFloat(numMatch[1]);
      } else {
        // Try evaluating expression with existing variables
        const evaluated = evaluateExpression(valStr, variables);
        if (evaluated !== null && !isNaN(evaluated)) {
          variables[varName] = evaluated;
        }
      }
    }
  }

  // Pass 2: Evaluate lines
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Checklist detection:
    // Prefix checklists: "- [ ]", "* [ ]", "[ ]", "- [x]", "* [x]", "[x]"
    // Suffix checklists: "/x", "/X", "/ ", "/o", "[ ]", "[x]"
    const prefixChecklist = trimmed.match(/^([-*]\s*)?\[([ xX])\]\s*(.*)$/);
    const suffixChecklist = trimmed.match(/^(.*?)\s*(\/x|\/X|\/\s*|\[[ xX]\])$/);

    if (prefixChecklist) {
      const isChecked = prefixChecklist[2].toLowerCase() === 'x';
      const cleanText = prefixChecklist[3].trim() || 'Task';
      const reminder = parseReminderFromLine(rawLine);
      evaluations.push({
        raw: rawLine,
        isTrigger: true,
        triggerType: 'checklist',
        isChecklistItem: true,
        isChecked,
        cleanText,
        reminderData: reminder || undefined
      });
      continue;
    } else if (suffixChecklist) {
      const token = suffixChecklist[2].toLowerCase();
      const isChecked = token === '/x' || token === '[x]';
      const cleanText = suffixChecklist[1].trim() || 'Task';
      const reminder = parseReminderFromLine(rawLine);
      evaluations.push({
        raw: rawLine,
        isTrigger: true,
        triggerType: 'checklist',
        isChecklistItem: true,
        isChecked,
        cleanText,
        reminderData: reminder || undefined
      });
      continue;
    }

    // 2. Timer trigger: "timer", "timer 5", "timer pomo", "timer 3:30"
    const timerMatch = trimmed.match(/^timer(?:\s+(.+))?$/i);
    if (timerMatch) {
      const arg = (timerMatch[1] || '').trim().toLowerCase();
      let timerData: LineEvaluation['timerData'] = {
        type: 'stopwatch',
        seconds: 0,
        initialSeconds: 0,
        label: 'Stopwatch'
      };

      if (!arg) {
        timerData = { type: 'stopwatch', seconds: 0, initialSeconds: 0, label: 'Stopwatch' };
      } else if (arg === 'pomo') {
        timerData = { type: 'pomo', seconds: 25 * 60, initialSeconds: 25 * 60, label: 'Pomodoro (25m)' };
      } else if (arg.includes(':')) {
        const [m, s] = arg.split(':').map(Number);
        const total = (m || 0) * 60 + (s || 0);
        timerData = { type: 'countdown', seconds: total, initialSeconds: total, label: `${m}m ${s}s` };
      } else if (!isNaN(Number(arg))) {
        const mins = Number(arg);
        timerData = { type: 'countdown', seconds: mins * 60, initialSeconds: mins * 60, label: `${mins}m Countdown` };
      }

      evaluations.push({
        raw: rawLine,
        isTrigger: true,
        triggerType: 'timer',
        timerData
      });
      continue;
    }

    // 3. Aggregators: "sum", "avg", "count", "total"
    const aggMatch = trimmed.match(/^(sum|avg|count|total)(?:\s+(.*))?$/i);
    if (aggMatch) {
      const rawType = aggMatch[1].toLowerCase();
      const type = (rawType === 'total' ? 'sum' : rawType) as 'sum' | 'avg' | 'count';
      const numbers = extractNumbersFromBlock(lines, i);
      let result: string | number = '';

      if (type === 'sum') {
        const total = numbers.reduce((a, b) => a + b, 0);
        result = total % 1 === 0 ? total.toLocaleString() : total.toFixed(2);
      } else if (type === 'avg') {
        if (numbers.length > 0) {
          const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
          result = avg % 1 === 0 ? avg.toLocaleString() : avg.toFixed(2);
        } else {
          result = '0';
        }
      } else if (type === 'count') {
        result = numbers.length > 0 ? numbers.length : lines.filter(l => l.trim().length > 0).length - 1;
      }

      evaluations.push({
        raw: rawLine,
        isTrigger: true,
        triggerType: type,
        result
      });
      continue;
    }

    // 4. Unit & Currency Conversion: "50 km in miles" or "100 usd in eur"
    const convMatch = trimmed.match(/([0-9]+(?:\.[0-9]+)?)\s+([a-zA-Z]+)\s+(in|to)\s+([a-zA-Z]+)(?:\s*=\s*)?/i);
    if (convMatch) {
      const amount = parseFloat(convMatch[1]);
      const key = `${convMatch[2].toLowerCase()} in ${convMatch[4].toLowerCase()}`;
      if (UNIT_CONVERSIONS[key]) {
        const converted = amount * UNIT_CONVERSIONS[key].factor;
        const resStr = `${converted.toFixed(2)} ${UNIT_CONVERSIONS[key].to}`;
        evaluations.push({
          raw: rawLine,
          isTrigger: true,
          triggerType: 'math',
          result: resStr
        });
        continue;
      }
    }

    // 5. Date, Time Duration & Timezone Conversions (Soulver & Numi style)
    const dateTimeRes = evaluateDateTimeExpression(trimmed);
    if (dateTimeRes.result !== null) {
      evaluations.push({
        raw: rawLine,
        isTrigger: true,
        triggerType: dateTimeRes.type || 'math',
        result: dateTimeRes.result
      });
      continue;
    }

    // 6. Reactive Math expression ending in "=": e.g. "$150 + 20% =", "guests * cost per guest =" or "34 * 5 ="
    if (trimmed.endsWith('=')) {
      const res = evaluateMathExpression(trimmed, variables);
      if (res.result !== null && res.formatted !== null) {
        evaluations.push({
          raw: rawLine,
          isTrigger: true,
          triggerType: 'math',
          result: res.formatted
        });
        continue;
      }
    }

    // 6. Variable assignment line: e.g. "rent: 1400"
    if (trimmed.includes(':') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const parts = trimmed.split(':');
      const varName = parts[0].trim();
      const lowerName = varName.toLowerCase();
      if (lowerName in variables) {
        const val = variables[lowerName];
        evaluations.push({
          raw: rawLine,
          isTrigger: true,
          triggerType: 'variable',
          varName,
          varValue: val,
          result: val % 1 === 0 ? val.toLocaleString() : val.toFixed(2)
        });
        continue;
      }
    }

    // 7. Natural language reminder / scheduled to-do (e.g. "call accountant tomorrow", "dentist friday at 3pm")
    const reminder = parseReminderFromLine(trimmed);
    if (reminder) {
      evaluations.push({
        raw: rawLine,
        isTrigger: true,
        triggerType: 'reminder',
        reminderData: reminder,
        result: reminder.targetDateStr
      });
      continue;
    }

    // Standard text line
    evaluations.push({
      raw: rawLine,
      isTrigger: false
    });
  }

  return evaluations;
}

function extractNumbersFromBlock(lines: string[], triggerLineIndex: number): number[] {
  const numbers: number[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    if (idx === triggerLineIndex) continue;
    const l = lines[idx];
    if (l.toLowerCase().startsWith('total:') || l.toLowerCase().startsWith('sum:')) continue;
    
    // Find all currency or raw numbers: $25.50 or 25.50 or $2
    const matches = l.match(/[\$€£]?\s*([0-9]+(?:\.[0-9]+)?)/g);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.replace(/[\$€£\s]/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val)) {
          numbers.push(val);
        }
      }
    }
  }
  return numbers;
}

function evaluateExpression(expr: string, variables: Record<string, number>): number | null {
  try {
    const res = evaluateMathExpression(expr, variables);
    if (typeof res.result === 'number' && isFinite(res.result)) {
      return res.result;
    }
    return null;
  } catch {
    return null;
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
