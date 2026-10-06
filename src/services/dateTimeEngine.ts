/**
 * PaperTape Date, Time & Timezone Engine
 * Mimics Soulver and Numi for date calculations, durations, and time zone conversions.
 */

export type DateTimeResultType = 'date' | 'duration' | 'timezone';

export interface DateTimeEvaluationResult {
  result: string | null;
  type: DateTimeResultType | null;
}

// Common timezone definitions with standard UTC offset in minutes
interface ZoneInfo {
  offsetMinutes: number;
  abbr: string;
  iana?: string;
}

const COMMON_TIMEZONES: Record<string, ZoneInfo> = {
  // UTC / GMT
  'utc': { offsetMinutes: 0, abbr: 'UTC' },
  'gmt': { offsetMinutes: 0, abbr: 'GMT', iana: 'Europe/London' },
  'z': { offsetMinutes: 0, abbr: 'UTC' },

  // US & Canada
  'est': { offsetMinutes: -300, abbr: 'EST', iana: 'America/New_York' },
  'edt': { offsetMinutes: -240, abbr: 'EDT', iana: 'America/New_York' },
  'cst': { offsetMinutes: -360, abbr: 'CST', iana: 'America/Chicago' },
  'cdt': { offsetMinutes: -300, abbr: 'CDT', iana: 'America/Chicago' },
  'mst': { offsetMinutes: -420, abbr: 'MST', iana: 'America/Denver' },
  'mdt': { offsetMinutes: -360, abbr: 'MDT', iana: 'America/Denver' },
  'pst': { offsetMinutes: -480, abbr: 'PST', iana: 'America/Los_Angeles' },
  'pdt': { offsetMinutes: -420, abbr: 'PDT', iana: 'America/Los_Angeles' },
  'akst': { offsetMinutes: -540, abbr: 'AKST', iana: 'America/Anchorage' },
  'akdt': { offsetMinutes: -480, abbr: 'AKDT', iana: 'America/Anchorage' },
  'hst': { offsetMinutes: -600, abbr: 'HST', iana: 'Pacific/Honolulu' },

  // Europe
  'wet': { offsetMinutes: 0, abbr: 'WET' },
  'west': { offsetMinutes: 60, abbr: 'WEST' },
  'cet': { offsetMinutes: 60, abbr: 'CET', iana: 'Europe/Paris' },
  'cest': { offsetMinutes: 120, abbr: 'CEST', iana: 'Europe/Paris' },
  'bst': { offsetMinutes: 60, abbr: 'BST', iana: 'Europe/London' },
  'eet': { offsetMinutes: 120, abbr: 'EET' },
  'eest': { offsetMinutes: 180, abbr: 'EEST' },
  'msk': { offsetMinutes: 180, abbr: 'MSK', iana: 'Europe/Moscow' },

  // Asia & Pacific
  'ist': { offsetMinutes: 330, abbr: 'IST', iana: 'Asia/Kolkata' },
  'jst': { offsetMinutes: 540, abbr: 'JST', iana: 'Asia/Tokyo' },
  'kst': { offsetMinutes: 540, abbr: 'KST', iana: 'Asia/Seoul' },
  'hkt': { offsetMinutes: 480, abbr: 'HKT', iana: 'Asia/Hong_Kong' },
  'sgt': { offsetMinutes: 480, abbr: 'SGT', iana: 'Asia/Singapore' },
  'cst-china': { offsetMinutes: 480, abbr: 'CST', iana: 'Asia/Shanghai' },
  'gst': { offsetMinutes: 240, abbr: 'GST', iana: 'Asia/Dubai' },

  // Australia & New Zealand
  'aest': { offsetMinutes: 600, abbr: 'AEST', iana: 'Australia/Sydney' },
  'aedt': { offsetMinutes: 660, abbr: 'AEDT', iana: 'Australia/Sydney' },
  'acst': { offsetMinutes: 570, abbr: 'ACST', iana: 'Australia/Adelaide' },
  'acdt': { offsetMinutes: 630, abbr: 'ACDT', iana: 'Australia/Adelaide' },
  'awst': { offsetMinutes: 480, abbr: 'AWST', iana: 'Australia/Perth' },
  'nzst': { offsetMinutes: 720, abbr: 'NZST', iana: 'Pacific/Auckland' },
  'nzdt': { offsetMinutes: 780, abbr: 'NZDT', iana: 'Pacific/Auckland' }
};

// Common city to IANA timezone / default info mapping
const MAJOR_CITIES: Record<string, { iana: string; defaultAbbr: string; dstAbbr?: string }> = {
  'tokyo': { iana: 'Asia/Tokyo', defaultAbbr: 'JST' },
  'london': { iana: 'Europe/London', defaultAbbr: 'GMT', dstAbbr: 'BST' },
  'new york': { iana: 'America/New_York', defaultAbbr: 'EST', dstAbbr: 'EDT' },
  'nyc': { iana: 'America/New_York', defaultAbbr: 'EST', dstAbbr: 'EDT' },
  'los angeles': { iana: 'America/Los_Angeles', defaultAbbr: 'PST', dstAbbr: 'PDT' },
  'la': { iana: 'America/Los_Angeles', defaultAbbr: 'PST', dstAbbr: 'PDT' },
  'san francisco': { iana: 'America/Los_Angeles', defaultAbbr: 'PST', dstAbbr: 'PDT' },
  'sf': { iana: 'America/Los_Angeles', defaultAbbr: 'PST', dstAbbr: 'PDT' },
  'chicago': { iana: 'America/Chicago', defaultAbbr: 'CST', dstAbbr: 'CDT' },
  'denver': { iana: 'America/Denver', defaultAbbr: 'MST', dstAbbr: 'MDT' },
  'seattle': { iana: 'America/Los_Angeles', defaultAbbr: 'PST', dstAbbr: 'PDT' },
  'boston': { iana: 'America/New_York', defaultAbbr: 'EST', dstAbbr: 'EDT' },
  'paris': { iana: 'Europe/Paris', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'berlin': { iana: 'Europe/Berlin', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'rome': { iana: 'Europe/Rome', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'madrid': { iana: 'Europe/Madrid', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'amsterdam': { iana: 'Europe/Amsterdam', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'dubai': { iana: 'Asia/Dubai', defaultAbbr: 'GST' },
  'singapore': { iana: 'Asia/Singapore', defaultAbbr: 'SGT' },
  'hong kong': { iana: 'Asia/Hong_Kong', defaultAbbr: 'HKT' },
  'sydney': { iana: 'Australia/Sydney', defaultAbbr: 'AEST', dstAbbr: 'AEDT' },
  'melbourne': { iana: 'Australia/Melbourne', defaultAbbr: 'AEST', dstAbbr: 'AEDT' },
  'auckland': { iana: 'Pacific/Auckland', defaultAbbr: 'NZST', dstAbbr: 'NZDT' },
  'seoul': { iana: 'Asia/Seoul', defaultAbbr: 'KST' },
  'mumbai': { iana: 'Asia/Kolkata', defaultAbbr: 'IST' },
  'delhi': { iana: 'Asia/Kolkata', defaultAbbr: 'IST' },
  'bangalore': { iana: 'Asia/Kolkata', defaultAbbr: 'IST' },
  'india': { iana: 'Asia/Kolkata', defaultAbbr: 'IST' },
  'toronto': { iana: 'America/Toronto', defaultAbbr: 'EST', dstAbbr: 'EDT' },
  'vancouver': { iana: 'America/Vancouver', defaultAbbr: 'PST', dstAbbr: 'PDT' },
  'dublin': { iana: 'Europe/Dublin', defaultAbbr: 'GMT', dstAbbr: 'IST' },
  'zurich': { iana: 'Europe/Zurich', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'stockholm': { iana: 'Europe/Stockholm', defaultAbbr: 'CET', dstAbbr: 'CEST' },
  'beijing': { iana: 'Asia/Shanghai', defaultAbbr: 'CST' },
  'shanghai': { iana: 'Asia/Shanghai', defaultAbbr: 'CST' }
};

// Month names lookup
const MONTH_NAMES: Record<string, number> = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

/**
 * Main evaluation entry point
 */
export function evaluateDateTimeExpression(expr: string): DateTimeEvaluationResult {
  if (!expr || typeof expr !== 'string') {
    return { result: null, type: null };
  }

  let cleaned = expr.trim();
  // Strip trailing '=' or '?' if present
  if (cleaned.endsWith('=')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  if (cleaned.endsWith('?')) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  if (!cleaned) {
    return { result: null, type: null };
  }

  // 1. Time Zone conversions (e.g. "5pm EST in PST", "5pm EST to PST", "3pm Tokyo in London")
  const tzResult = parseAndEvaluateTimezone(cleaned);
  if (tzResult) {
    return { result: tzResult, type: 'timezone' };
  }

  // 2. Time Durations
  // 2a. Time span / range (e.g. "9:30 am to 5:45 pm")
  const spanResult = parseAndEvaluateTimeSpan(cleaned);
  if (spanResult) {
    return { result: spanResult, type: 'duration' };
  }

  // 2b. Duration arithmetic (e.g. "3h 20m + 45m", "1h 30m - 45m")
  const durationArithResult = parseAndEvaluateDurationArithmetic(cleaned);
  if (durationArithResult) {
    return { result: durationArithResult, type: 'duration' };
  }

  // 3. Date Arithmetic & Differences
  // 3a. Date differences (e.g. "Oct 1st to Dec 25th in days", "today to Dec 31 in weeks")
  const dateDiffResult = parseAndEvaluateDateDifference(cleaned);
  if (dateDiffResult) {
    return { result: dateDiffResult, type: 'date' };
  }

  // 3b. Date arithmetic (e.g. "today + 30 days", "90 days from Oct 1st", "Dec 25 - 2 weeks")
  const dateArithResult = parseAndEvaluateDateArithmetic(cleaned);
  if (dateArithResult) {
    return { result: dateArithResult, type: 'date' };
  }

  return { result: null, type: null };
}

// =============================================================================
// 1. TIME ZONE CONVERSIONS
// =============================================================================

function parseAndEvaluateTimezone(expr: string): string | null {
  // Pattern: <time> <fromZone> (in|to|as|->) <toZone>
  // e.g. "5pm EST in PST", "5pm EST to PST", "10am UTC in EST", "3pm Tokyo in London", "3pm JST in GMT"
  const tzRegex = /^(.+?)\s+(in|to|as|->)\s+(.+?)$/i;
  const match = expr.match(tzRegex);
  if (!match) return null;

  const leftPart = match[1].trim();
  const toZoneStr = match[3].trim();

  // Validate toZone
  const toInfo = resolveZone(toZoneStr);
  if (!toInfo) return null;

  // Extract time and fromZone from leftPart
  const extracted = extractTimeAndZone(leftPart);
  if (!extracted) return null;

  const fromInfo = resolveZone(extracted.zoneStr);
  if (!fromInfo) return null;

  const timeMinutes = parseTimeStrToMinutes(extracted.timeStr);
  if (timeMinutes === null) return null;

  // Convert timeMinutes in fromZone to UTC:
  // Local time = UTC + offsetMinutes => UTC = Local time - offsetMinutes
  const utcMinutes = timeMinutes - fromInfo.offsetMinutes;

  // Convert UTC to toZone:
  // Target local time = UTC + toZone.offsetMinutes
  let targetMinutes = utcMinutes + toInfo.offsetMinutes;

  // Normalize to 0..1439
  targetMinutes = ((targetMinutes % 1440) + 1440) % 1440;

  const hours24 = Math.floor(targetMinutes / 60);
  const minutes = targetMinutes % 60;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minFormatted = minutes.toString().padStart(2, '0');

  return `${hours12}:${minFormatted} ${period} ${toInfo.displayAbbr}`;
}

interface ResolvedZone {
  offsetMinutes: number;
  displayAbbr: string;
}

function extractTimeAndZone(str: string): { timeStr: string; zoneStr: string } | null {
  // If time ends with am/pm: "9:30 am EST" or "5pm EST"
  const m1 = str.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+(.+)$/i);
  if (m1) {
    return { timeStr: m1[1].trim(), zoneStr: m1[2].trim() };
  }

  // 24-hr or named times: "17:00 EST", "noon EST"
  const m2 = str.match(/^(\d{1,2}:\d{2}|noon|midnight)\s+(.+)$/i);
  if (m2) {
    const candidate = m2[2].trim().toLowerCase();
    // Do not treat "am" or "pm" as a timezone
    if (candidate === 'am' || candidate === 'pm') {
      return null;
    }
    return { timeStr: m2[1].trim(), zoneStr: m2[2].trim() };
  }

  return null;
}

function resolveZone(name: string): ResolvedZone | null {
  const clean = name.trim().toLowerCase();
  if (!clean || clean === 'am' || clean === 'pm') {
    return null;
  }

  // 1. Direct match in common timezones
  if (COMMON_TIMEZONES[clean]) {
    return {
      offsetMinutes: COMMON_TIMEZONES[clean].offsetMinutes,
      displayAbbr: COMMON_TIMEZONES[clean].abbr
    };
  }

  // 2. City match
  if (MAJOR_CITIES[clean]) {
    const city = MAJOR_CITIES[clean];
    const offset = getIanaOffsetMinutes(city.iana);
    let abbr = city.defaultAbbr;
    const defaultOffset = COMMON_TIMEZONES[city.defaultAbbr.toLowerCase()]?.offsetMinutes;
    if (city.dstAbbr && defaultOffset !== undefined && offset !== defaultOffset) {
      abbr = city.dstAbbr;
    }
    return {
      offsetMinutes: offset,
      displayAbbr: abbr
    };
  }

  // 3. Only if valid IANA timezone name
  try {
    Intl.DateTimeFormat(undefined, { timeZone: clean });
    const offset = getIanaOffsetMinutes(clean);
    return {
      offsetMinutes: offset,
      displayAbbr: clean.toUpperCase()
    };
  } catch {
    return null;
  }
}

function getIanaOffsetMinutes(ianaTz: string, date = new Date()): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: ianaTz }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function parseTimeStrToMinutes(str: string): number | null {
  const lower = str.trim().toLowerCase();
  if (lower === 'noon') return 12 * 60;
  if (lower === 'midnight') return 0;

  // 12-hour: "5pm", "5:30 pm", "9am", "9:45 am"
  const ampmMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3] === 'pm';

    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (isPm && h !== 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return h * 60 + m;
  }

  // 24-hour: "17:00", "09:30"
  const h24Match = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

// =============================================================================
// 2. TIME DURATIONS
// =============================================================================

/**
 * 2a. Time span between two clock times:
 * e.g. "9:30 am to 5:45 pm" -> "8h 15m"
 * e.g. "9am to 5pm" -> "8h"
 * e.g. "9:30 to 17:45" -> "8h 15m"
 */
function parseAndEvaluateTimeSpan(expr: string): string | null {
  // Pattern: (from )?<time1> (to|until|till|-) <time2>
  let s = expr.trim();
  if (s.toLowerCase().startsWith('from ')) {
    s = s.slice(5).trim();
  }

  // Split on separator
  const sepMatch = s.match(/^(.+?)\s+(to|until|till|-)\s+(.+)$/i);
  if (!sepMatch) return null;

  const t1Str = sepMatch[1].trim();
  const t2Str = sepMatch[3].trim();

  const m1 = parseTimeStrToMinutes(t1Str);
  const m2 = parseTimeStrToMinutes(t2Str);

  if (m1 === null || m2 === null) return null;

  let diff = m2 - m1;
  // If span crosses midnight, e.g. 11pm to 2am
  if (diff < 0) {
    diff += 24 * 60;
  }

  return formatMinutesToDuration(diff);
}

/**
 * 2b. Duration arithmetic:
 * e.g. "3h 20m + 45m" -> "4h 5m"
 * e.g. "1h 30m - 45m" -> "45m"
 * e.g. "2 hours + 30 mins" -> "2h 30m"
 */
function parseAndEvaluateDurationArithmetic(expr: string): string | null {
  // Must contain duration units like h, m, min, hours
  if (!/(?:hours?|hrs?|h|minutes?|mins?|m\b)/i.test(expr)) {
    return null;
  }

  // Tokenize into signed duration chunks:
  // e.g. "3h 20m + 45m" or "1h 30m - 45m"
  const normalized = expr.replace(/\s*\+\s*/g, ' + ').replace(/\s*\-\s*/g, ' - ');
  const parts = normalized.split(/\s+/);

  let currentSign = 1;
  let totalMinutes = 0;
  let parsedAny = false;
  let currentToken = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '+') {
      if (currentToken) {
        const mins = parseSingleDuration(currentToken);
        if (mins === null) return null;
        totalMinutes += currentSign * mins;
        parsedAny = true;
        currentToken = '';
      }
      currentSign = 1;
    } else if (part === '-') {
      if (currentToken) {
        const mins = parseSingleDuration(currentToken);
        if (mins === null) return null;
        totalMinutes += currentSign * mins;
        parsedAny = true;
        currentToken = '';
      }
      currentSign = -1;
    } else {
      currentToken = currentToken ? `${currentToken} ${part}` : part;
    }
  }

  if (currentToken) {
    const mins = parseSingleDuration(currentToken);
    if (mins === null) return null;
    totalMinutes += currentSign * mins;
    parsedAny = true;
  }

  if (!parsedAny) return null;

  return formatMinutesToDuration(totalMinutes);
}

function parseSingleDuration(str: string): number | null {
  const trimmed = str.trim();
  let totalMins = 0;
  let matched = false;

  // Pattern: hours (e.g. "3h", "3 hours", "1.5 hrs")
  const hMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hMatch) {
    totalMins += parseFloat(hMatch[1]) * 60;
    matched = true;
  }

  // Pattern: minutes (e.g. "20m", "45 mins", "30 minutes")
  const mMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i);
  if (mMatch) {
    totalMins += parseFloat(mMatch[1]);
    matched = true;
  }

  // Pattern: seconds (e.g. "30s", "45 seconds")
  const sMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i);
  if (sMatch) {
    totalMins += parseFloat(sMatch[1]) / 60;
    matched = true;
  }

  return matched ? totalMins : null;
}

function formatMinutesToDuration(totalMinutes: number): string {
  const isNegative = totalMinutes < 0;
  const absMins = Math.round(Math.abs(totalMinutes));

  const h = Math.floor(absMins / 60);
  const m = absMins % 60;

  let str = '';
  if (h > 0 && m > 0) {
    str = `${h}h ${m}m`;
  } else if (h > 0) {
    str = `${h}h`;
  } else if (m > 0) {
    str = `${m}m`;
  } else {
    str = '0m';
  }

  return isNegative ? `-${str}` : str;
}

// =============================================================================
// 3. DATE ARITHMETIC & DIFFERENCES
// =============================================================================

/**
 * 3a. Date differences:
 * e.g. "Oct 1st to Dec 25th in days" -> "85 days"
 * e.g. "today to Dec 31 in weeks" -> "12.3 weeks"
 * e.g. "Oct 1 to Dec 25" -> "85 days"
 */
function parseAndEvaluateDateDifference(expr: string): string | null {
  // Pattern: (from |between )?<date1> (to|until|till|-|and) <date2>( in (days|weeks|months|years))?
  let s = expr.trim();
  if (s.toLowerCase().startsWith('from ') || s.toLowerCase().startsWith('between ')) {
    s = s.replace(/^(?:from|between)\s+/i, '').trim();
  }

  // Check unit at end: "in days", "in weeks", "in months", "in years"
  let unit = 'days';
  const unitMatch = s.match(/\s+in\s+(days|weeks|months|years)\s*$/i);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    s = s.slice(0, unitMatch.index).trim();
  }

  const sepMatch = s.match(/^(.+?)\s+(to|until|till|and|-)\s+(.+)$/i);
  if (!sepMatch) return null;

  const d1Str = sepMatch[1].trim();
  const d2Str = sepMatch[3].trim();

  const date1 = parseFlexibleDate(d1Str);
  const date2 = parseFlexibleDate(d2Str);

  if (!date1 || !date2) return null;

  // Calculate day difference
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));

  if (unit === 'days') {
    return `${diffDays} days`;
  } else if (unit === 'weeks') {
    const w = diffDays / 7;
    const rounded = w % 1 === 0 ? w.toString() : parseFloat(w.toFixed(1)).toString();
    return `${rounded} weeks`;
  } else if (unit === 'months') {
    const m = diffDays / 30.4375;
    const rounded = m % 1 === 0 ? m.toString() : parseFloat(m.toFixed(1)).toString();
    return `${rounded} months`;
  } else if (unit === 'years') {
    const y = diffDays / 365.25;
    const rounded = y % 1 === 0 ? y.toString() : parseFloat(y.toFixed(1)).toString();
    return `${rounded} years`;
  }

  return `${diffDays} days`;
}

/**
 * 3b. Date arithmetic:
 * e.g. "today + 30 days", "today + 3 weeks", "today - 2 months", "now + 90 days"
 * e.g. "90 days from Oct 1st", "90 days from Oct 1", "Oct 1 + 90 days", "Dec 25 - 2 weeks"
 * e.g. "2 weeks before Dec 25", "10 days ago"
 */
function parseAndEvaluateDateArithmetic(expr: string): string | null {
  const s = expr.trim();

  // Pattern A: "<delta> (from|after|before) <date>"
  const fromAfterBeforeMatch = s.match(/^(.+?)\s+(from|after|before)\s+(.+)$/i);
  if (fromAfterBeforeMatch) {
    const deltaStr = fromAfterBeforeMatch[1].trim();
    const rel = fromAfterBeforeMatch[2].toLowerCase();
    const baseDateStr = fromAfterBeforeMatch[3].trim();

    const baseDate = parseFlexibleDate(baseDateStr);
    if (!baseDate) return null;

    const deltas = parseDateDeltas(deltaStr);
    if (!deltas || deltas.length === 0) return null;

    const sign = rel === 'before' ? -1 : 1;
    const finalDate = applyDeltasToDate(baseDate, deltas, sign);
    return formatDateResult(finalDate);
  }

  // Pattern B: "<delta> ago"
  const agoMatch = s.match(/^(.+?)\s+ago$/i);
  if (agoMatch) {
    const deltaStr = agoMatch[1].trim();
    const baseDate = getTodayMidnight();
    const deltas = parseDateDeltas(deltaStr);
    if (!deltas || deltas.length === 0) return null;

    const finalDate = applyDeltasToDate(baseDate, deltas, -1);
    return formatDateResult(finalDate);
  }

  // Pattern C: "<baseDate> (+|-) <delta> ((+|-) <delta>)*"
  // e.g. "today + 30 days", "Oct 1 + 90 days", "Dec 25 - 2 weeks"
  const arithMatch = s.match(/^(.+?)\s*([\+\-])\s*(.+)$/);
  if (arithMatch) {
    const baseDateStr = arithMatch[1].trim();
    const op = arithMatch[2];
    const rest = arithMatch[3].trim();

    const baseDate = parseFlexibleDate(baseDateStr);
    if (!baseDate) return null;

    const fullDeltaStr = `${op} ${rest}`;
    const deltas = parseDateDeltas(fullDeltaStr);
    if (!deltas || deltas.length === 0) return null;

    const finalDate = applyDeltasToDate(baseDate, deltas, 1);
    return formatDateResult(finalDate);
  }

  return null;
}

interface DateDelta {
  amount: number;
  unit: 'days' | 'weeks' | 'months' | 'years';
}

function parseDateDeltas(str: string): DateDelta[] | null {
  const deltas: DateDelta[] = [];
  // Tokenize chunks like "+ 30 days", "- 2 weeks", "90 days", "+ 1 month"
  const regex = /([\+\-]?)\s*(\d+(?:\.\d+)?)\s*(days?|d|weeks?|w|wks?|months?|mo|mos?|years?|y|yrs?)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    const sign = match[1] === '-' ? -1 : 1;
    const amount = parseFloat(match[2]) * sign;
    const rawUnit = match[3].toLowerCase();

    let unit: DateDelta['unit'] = 'days';
    if (/^(weeks?|w|wks?)$/.test(rawUnit)) {
      unit = 'weeks';
    } else if (/^(months?|mo|mos?)$/.test(rawUnit)) {
      unit = 'months';
    } else if (/^(years?|y|yrs?)$/.test(rawUnit)) {
      unit = 'years';
    }

    deltas.push({ amount, unit });
  }

  return deltas.length > 0 ? deltas : null;
}

function applyDeltasToDate(baseDate: Date, deltas: DateDelta[], overallSign: number): Date {
  const res = new Date(baseDate);

  for (const delta of deltas) {
    const effectiveAmount = delta.amount * overallSign;
    if (delta.unit === 'days') {
      res.setDate(res.getDate() + effectiveAmount);
    } else if (delta.unit === 'weeks') {
      res.setDate(res.getDate() + effectiveAmount * 7);
    } else if (delta.unit === 'months') {
      addMonthsToDate(res, effectiveAmount);
    } else if (delta.unit === 'years') {
      addMonthsToDate(res, effectiveAmount * 12);
    }
  }

  return res;
}

function addMonthsToDate(date: Date, months: number): void {
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months);
  // Handle end-of-month roll over (e.g. Jan 31 + 1 month -> Feb 28)
  if (date.getDate() < originalDay) {
    date.setDate(0);
  }
}

function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseFlexibleDate(str: string): Date | null {
  const s = str.trim().toLowerCase();
  const currentYear = new Date().getFullYear();

  // Relative keywords
  if (s === 'today' || s === 'now') {
    return getTodayMidnight();
  }
  if (s === 'tomorrow') {
    const d = getTodayMidnight();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (s === 'yesterday') {
    const d = getTodayMidnight();
    d.setDate(d.getDate() - 1);
    return d;
  }

  // Format 1: "Oct 1st", "Oct 1", "October 1st", "Oct 1, 2026", "October 1st 2026"
  // Month followed by Day
  const mFirstMatch = s.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?$/);
  if (mFirstMatch) {
    const monthKey = mFirstMatch[1];
    if (monthKey in MONTH_NAMES) {
      const month = MONTH_NAMES[monthKey];
      const day = parseInt(mFirstMatch[2], 10);
      const year = mFirstMatch[3] ? parseInt(mFirstMatch[3], 10) : currentYear;
      return new Date(year, month, day);
    }
  }

  // Format 2: "1st Oct", "1 Oct", "1st October", "1 Oct 2026", "1st October, 2026"
  // Day followed by Month
  const dFirstMatch = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)(?:\s*,?\s*(\d{4}))?$/);
  if (dFirstMatch) {
    const day = parseInt(dFirstMatch[1], 10);
    const monthKey = dFirstMatch[2];
    if (monthKey in MONTH_NAMES) {
      const month = MONTH_NAMES[monthKey];
      const year = dFirstMatch[3] ? parseInt(dFirstMatch[3], 10) : currentYear;
      return new Date(year, month, day);
    }
  }

  // Format 3: ISO "2026-10-06" or "2026/10/06"
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return new Date(y, m, d);
  }

  // Format 4: US "10/06/2026" or "10-06-2026"
  const usMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (usMatch) {
    const m = parseInt(usMatch[1], 10) - 1;
    const d = parseInt(usMatch[2], 10);
    const y = parseInt(usMatch[3], 10);
    return new Date(y, m, d);
  }

  return null;
}

function formatDateResult(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
