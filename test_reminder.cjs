/**
 * Test Suite for PaperTape Reminder & Scheduled To-Do Engine
 * Run with: node test_reminder.cjs
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

// Transpile and load reminderEngine.ts
const enginePath = path.resolve(__dirname, 'src/services/reminderEngine.ts');
const tsCode = fs.readFileSync(enginePath, 'utf8');
const jsCode = ts.transpileModule(tsCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const mod = { exports: {} };
const runner = new Function('module', 'exports', 'require', jsCode);
runner(mod, mod.exports, require);
const { parseReminderFromLine } = mod.exports;

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n========================================');
console.log('PaperTape Reminder Engine Test Suite');
console.log('========================================\n');

// Fixed reference date: Tuesday, Oct 6, 2026, 10:00 AM
const refDate = new Date(2026, 9, 6, 10, 0, 0, 0); // Oct 6, 2026 is Tuesday (day 2)

console.log('--- 1. "Tomorrow" Triggers ---');

test('Simple "tomorrow"', () => {
  const res = parseReminderFromLine('call accountant tomorrow', refDate);
  assert(res !== null, 'Should detect reminder');
  assert.strictEqual(res.dayLabel, 'Tomorrow');
  assert.strictEqual(res.timeLabel, '9:00 AM');
  assert.strictEqual(res.title, 'call accountant');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 7); // Oct 7
  assert.strictEqual(d.getMonth(), 9);
});

test('"tomorrow at 3pm"', () => {
  const res = parseReminderFromLine('dentist appointment tomorrow at 3pm', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Tomorrow');
  assert.strictEqual(res.timeLabel, '3:00 PM');
  assert.strictEqual(res.title, 'dentist appointment');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 7);
  assert.strictEqual(d.getHours(), 15);
});

test('Checklist item: "- [ ] buy groceries tomorrow"', () => {
  const res = parseReminderFromLine('- [ ] buy groceries tomorrow', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Tomorrow');
  assert.strictEqual(res.title, 'buy groceries');
});

test('Checklist item suffix: "submit invoice tomorrow /x"', () => {
  const res = parseReminderFromLine('submit invoice tomorrow /x', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Tomorrow');
  assert.strictEqual(res.title, 'submit invoice');
});

console.log('\n--- 2. Days of the Week Triggers ---');

test('Simple "friday" (ref is Tuesday, Friday is +3 days: Oct 9)', () => {
  const res = parseReminderFromLine('team standup friday', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Friday');
  assert.strictEqual(res.timeLabel, '9:00 AM');
  assert.strictEqual(res.title, 'team standup');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 9); // Oct 9
});

test('"on friday at 10:30 am"', () => {
  const res = parseReminderFromLine('client sync on friday at 10:30 am', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Friday');
  assert.strictEqual(res.timeLabel, '10:30 AM');
  assert.strictEqual(res.title, 'client sync');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 9);
  assert.strictEqual(d.getHours(), 10);
  assert.strictEqual(d.getMinutes(), 30);
});

test('"this friday"', () => {
  const res = parseReminderFromLine('- [ ] pay rent this friday', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Friday');
  assert.strictEqual(res.title, 'pay rent');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 9);
});

test('"next monday" (should be next week: Oct 12)', () => {
  const res = parseReminderFromLine('quarterly review next monday at 2pm', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Monday');
  assert.strictEqual(res.timeLabel, '2:00 PM');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 12); // Oct 12
  assert.strictEqual(d.getHours(), 14);
});

console.log('\n--- 3. Relative "in X days / hours" Triggers ---');

test('"in 2 days"', () => {
  const res = parseReminderFromLine('follow up with design in 2 days', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'In 2 days');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 8); // Oct 8
});

test('"in 3 hours"', () => {
  const res = parseReminderFromLine('check oven in 3 hours', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'In 3h');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getHours(), 13); // 10am + 3h = 1pm
});

console.log('\n--- 4. Specific Calendar Dates ---');

test('"Oct 15 at 11am"', () => {
  const res = parseReminderFromLine('doctor checkup Oct 15 at 11am', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Oct 15');
  assert.strictEqual(res.timeLabel, '11:00 AM');
  assert.strictEqual(res.title, 'doctor checkup');
  const d = new Date(res.targetTimestamp);
  assert.strictEqual(d.getDate(), 15);
  assert.strictEqual(d.getMonth(), 9);
  assert.strictEqual(d.getHours(), 11);
});

test('"November 1st"', () => {
  const res = parseReminderFromLine('- [ ] renew domain November 1st', refDate);
  assert(res !== null);
  assert.strictEqual(res.dayLabel, 'Nov 1');
  assert.strictEqual(res.timeLabel, '9:00 AM');
  assert.strictEqual(res.title, 'renew domain');
});

console.log('\n--- 5. Non-Reminder & Edge Cases ---');

test('Plain text line with no date/day returns null', () => {
  const res = parseReminderFromLine('Buy milk and eggs', refDate);
  assert.strictEqual(res, null);
});

test('Math calculation line returns null', () => {
  const res = parseReminderFromLine('rate: 85 * 40 =', refDate);
  assert.strictEqual(res, null);
});

test('Empty or whitespace line returns null', () => {
  const res = parseReminderFromLine('   ', refDate);
  assert.strictEqual(res, null);
});

console.log('\n========================================');
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log('========================================\n');
