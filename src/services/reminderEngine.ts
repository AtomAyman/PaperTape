/**
 * PaperTape Reminder & Scheduled To-Do Engine
 * Automatically detects natural language date/day triggers in notes and checklists:
 * - "tomorrow", "tomorrow at 10am", "tomorrow morning"
 * - "friday", "on friday", "this friday", "next monday at 2pm"
 * - "today at 5pm", "in 2 days", "in 3 hours"
 * - "Oct 15", "Nov 1st at 11am"
 */

export interface ReminderData {
  id: string;              // Deterministic hash/key based on text & timestamp
  targetTimestamp: number; // Unix timestamp in ms
  targetDateStr: string;   // e.g. "Tomorrow · 9:00 AM" or "Fri, Oct 9 · 2:00 PM"
  relativeStr: string;     // e.g. "in 18h", "in 3 days", "Due today"
  title: string;           // Clean task title (e.g. "Call accountant")
  dayLabel: string;        // "Tomorrow", "Friday", "Today", etc.
  timeLabel: string;       // "9:00 AM", "3:30 PM"
  isPastDue: boolean;
  isToday: boolean;
}

const DAY_NAMES: Record<string, number> = {
  'sun': 0, 'sunday': 0,
  'mon': 1, 'monday': 1,
  'tue': 2, 'tuesday': 2,
  'wed': 3, 'wednesday': 3,
  'thu': 4, 'thursday': 4,
  'fri': 5, 'friday': 5,
  'sat': 6, 'saturday': 6
};

const MONTH_NAMES: Record<string, number> = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4, 'june': 5,
  'jun': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

/**
 * Parses time expression like "at 10am", "at 10:30 am", "at 2pm", "at 14:00", "10am", "5:30pm"
 * Returns { hour, minute, matchedStr } or null
 */
function parseTimeFromText(text: string): { hour: number; minute: number; matchedStr: string } | null {
  // Pattern 1: "at 10:30 am" or "10:30am" or "10:30 am"
  const colonMatch = text.match(/(?:at\s+)?\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])(?:\s*(am|pm))?\b/i);
  if (colonMatch) {
    let hour = parseInt(colonMatch[1], 10);
    const minute = parseInt(colonMatch[2], 10);
    const meridiem = (colonMatch[3] || '').toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    return { hour, minute, matchedStr: colonMatch[0] };
  }

  // Pattern 2: "at 10am" or "10am" or "at 3 pm"
  const ampmMatch = text.match(/(?:at\s+)?\b([1-9]|1[0-2])\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = 0;
    const meridiem = ampmMatch[2].toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    return { hour, minute, matchedStr: ampmMatch[0] };
  }

  // Pattern 3: "morning" -> 9:00 AM, "afternoon" -> 2:00 PM, "evening" -> 6:00 PM, "night" -> 8:00 PM
  const periodMatch = text.match(/\b(in the morning|morning|in the afternoon|afternoon|in the evening|evening|tonight|night)\b/i);
  if (periodMatch) {
    const period = periodMatch[1].toLowerCase();
    if (period.includes('morning')) return { hour: 9, minute: 0, matchedStr: periodMatch[0] };
    if (period.includes('afternoon')) return { hour: 14, minute: 0, matchedStr: periodMatch[0] };
    if (period.includes('evening')) return { hour: 18, minute: 0, matchedStr: periodMatch[0] };
    if (period.includes('night')) return { hour: 20, minute: 0, matchedStr: periodMatch[0] };
  }

  return null;
}

/**
 * Format a Date object to a readable relative string: "in 2 hours", "Tomorrow", "in 3 days", "Due today"
 */
function formatRelativeTime(targetMs: number, nowMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs < 0) {
    const pastMinutes = Math.floor(-diffMs / (60 * 1000));
    if (pastMinutes < 60) return `${pastMinutes}m ago`;
    const pastHours = Math.floor(pastMinutes / 60);
    if (pastHours < 24) return `${pastHours}h ago`;
    return 'Overdue';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `in ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'tomorrow';
  return `in ${diffDays} days`;
}

/**
 * Formats a Date object to a 12-hour time string like "9:00 AM" or "3:15 PM"
 */
function formatTime12h(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mStr = m.toString().padStart(2, '0');
  return `${h}:${mStr} ${ampm}`;
}

/**
 * Main parser: attempts to extract a reminder date/time and title from a line of text.
 */
export function parseReminderFromLine(rawText: string, referenceDate: Date = new Date()): ReminderData | null {
  if (!rawText || !rawText.trim()) return null;

  // Clean checklist markdown prefixes/suffixes if present
  let cleanLine = rawText
    .replace(/^([-*]\s*)?\[([ xX])\]\s*/, '')
    .replace(/\s*(\/x|\/X|\/\s*|\[[ xX]\])$/, '')
    .trim();

  // If text starts with "remind me to" or "remind me:"
  cleanLine = cleanLine.replace(/^remind\s+(?:me\s+)?(?:to\s+|that\s+|:\s*)?/i, '');

  const now = referenceDate;
  let targetDate: Date | null = null;
  let matchedDateStr = '';
  let dayLabel = '';

  const lower = cleanLine.toLowerCase();

  // Check for explicit time first
  const timeRes = parseTimeFromText(cleanLine);
  let defaultHour = 9; // Default to 9:00 AM
  let defaultMinute = 0;

  if (timeRes) {
    defaultHour = timeRes.hour;
    defaultMinute = timeRes.minute;
  }

  // 1. "tomorrow" / "tmrw"
  const tomorrowMatch = lower.match(/\b(tomorrow|tmrw)\b/i);
  if (tomorrowMatch) {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, defaultHour, defaultMinute, 0, 0);
    matchedDateStr = tomorrowMatch[0];
    dayLabel = 'Tomorrow';
  }

  // 2. "today" / "tonight"
  if (!targetDate) {
    const todayMatch = lower.match(/\b(today|tonight)\b/i);
    if (todayMatch) {
      const isTonight = todayMatch[1].toLowerCase() === 'tonight';
      const h = isTonight && !timeRes ? 20 : (timeRes ? timeRes.hour : Math.min(23, now.getHours() + 1));
      const m = timeRes ? timeRes.minute : 0;
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      matchedDateStr = todayMatch[0];
      dayLabel = isTonight ? 'Tonight' : 'Today';
    }
  }

  // 3. "day after tomorrow"
  if (!targetDate) {
    const dayAfterMatch = lower.match(/\bday after tomorrow\b/i);
    if (dayAfterMatch) {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, defaultHour, defaultMinute, 0, 0);
      matchedDateStr = dayAfterMatch[0];
      dayLabel = 'In 2 days';
    }
  }

  // 4. Day of the week: "friday", "on friday", "this friday", "next monday", etc.
  if (!targetDate) {
    const dayMatch = lower.match(/\b(?:(this|next|on)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
    if (dayMatch) {
      const modifier = (dayMatch[1] || '').toLowerCase();
      const rawDay = dayMatch[2].toLowerCase();
      const targetDayOfWeek = DAY_NAMES[rawDay];

      if (targetDayOfWeek !== undefined) {
        const currentDayOfWeek = now.getDay();
        let diff = targetDayOfWeek - currentDayOfWeek;

        if (modifier === 'next') {
          // "next Friday": always push to the following week (7+ days if diff <= 0, or diff + 7)
          diff = diff <= 0 ? diff + 7 : diff + 7;
        } else {
          // "this friday" or "friday" or "on friday": upcoming occurrence
          if (diff <= 0) {
            diff += 7;
          }
        }

        targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, defaultHour, defaultMinute, 0, 0);
        matchedDateStr = dayMatch[0];
        
        // Capitalize day name
        const fullDayName = Object.keys(DAY_NAMES).find(k => k.length > 3 && DAY_NAMES[k] === targetDayOfWeek) || rawDay;
        dayLabel = fullDayName.charAt(0).toUpperCase() + fullDayName.slice(1);
      }
    }
  }

  // 5. "in X days" or "in X hours" or "in X mins"
  if (!targetDate) {
    const inMatch = lower.match(/\bin\s+(\d+)\s*(days?|hours?|hrs?|mins?|minutes?)\b/i);
    if (inMatch) {
      const count = parseInt(inMatch[1], 10);
      const unit = inMatch[2].toLowerCase();
      targetDate = new Date(now.getTime());

      if (unit.startsWith('day')) {
        targetDate.setDate(targetDate.getDate() + count);
        targetDate.setHours(defaultHour, defaultMinute, 0, 0);
        dayLabel = `In ${count} days`;
      } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
        targetDate.setHours(targetDate.getHours() + count);
        dayLabel = `In ${count}h`;
      } else if (unit.startsWith('min')) {
        targetDate.setMinutes(targetDate.getMinutes() + count);
        dayLabel = `In ${count}m`;
      }
      matchedDateStr = inMatch[0];
    }
  }

  // 6. Specific calendar date: "Oct 15", "October 15th", "15 Oct", "Nov 1st"
  if (!targetDate) {
    const calMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (calMatch) {
      const monthStr = calMatch[1].toLowerCase().slice(0, 3);
      const dayNum = parseInt(calMatch[2], 10);
      const monthNum = MONTH_NAMES[monthStr];

      if (monthNum !== undefined && dayNum >= 1 && dayNum <= 31) {
        let year = now.getFullYear();
        // If date has already passed this year, schedule for next year
        const candidate = new Date(year, monthNum, dayNum, defaultHour, defaultMinute, 0, 0);
        if (candidate.getTime() < now.getTime()) {
          year += 1;
        }
        targetDate = new Date(year, monthNum, dayNum, defaultHour, defaultMinute, 0, 0);
        matchedDateStr = calMatch[0];
        const monthShort = calMatch[1].charAt(0).toUpperCase() + calMatch[1].slice(1, 3);
        dayLabel = `${monthShort} ${dayNum}`;
      }
    }
  }

  // If no date was found, return null
  if (!targetDate) {
    return null;
  }

  // Build clean task title by removing date and time tokens
  let cleanTitle = cleanLine;
  if (matchedDateStr) {
    cleanTitle = cleanTitle.replace(new RegExp(`\\b${escapeRegExp(matchedDateStr)}\\b`, 'i'), '');
  }
  if (timeRes && timeRes.matchedStr) {
    cleanTitle = cleanTitle.replace(new RegExp(`\\b${escapeRegExp(timeRes.matchedStr)}\\b`, 'i'), '');
  }

  // Clean trailing punctuation or prepositions ("on", "at", "by", ":", "-")
  cleanTitle = cleanTitle
    .replace(/\b(on|at|by|for)\b\s*$/i, '')
    .replace(/^[-–—:\s]+|[-–—:\s]+$/g, '')
    .trim();

  if (!cleanTitle) {
    cleanTitle = 'Reminder';
  }

  const targetMs = targetDate.getTime();
  const nowMs = now.getTime();
  const timeLabel = formatTime12h(targetDate);
  const relativeStr = formatRelativeTime(targetMs, nowMs);
  const isPastDue = targetMs < nowMs;
  const isToday = targetDate.toDateString() === now.toDateString();

  const formattedMonth = targetDate.toLocaleString('en-US', { month: 'short' });
  const formattedDay = targetDate.getDate();
  const targetDateStr = `${dayLabel} · ${timeLabel}`;

  // Deterministic ID for tracking notification state
  const id = `rem_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${targetDate.getFullYear()}_${targetDate.getMonth()}_${targetDate.getDate()}_${targetDate.getHours()}_${targetDate.getMinutes()}`;

  return {
    id,
    targetTimestamp: targetMs,
    targetDateStr,
    relativeStr,
    title: cleanTitle,
    dayLabel,
    timeLabel,
    isPastDue,
    isToday
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
