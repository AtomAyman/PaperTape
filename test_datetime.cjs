/**
 * Test Suite for PaperTape Date, Time & Timezone Engine
 * Run with: node test_datetime.cjs
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

// Transpile and load dateTimeEngine.ts into CommonJS runtime
const enginePath = path.resolve(__dirname, 'src/services/dateTimeEngine.ts');
const tsCode = fs.readFileSync(enginePath, 'utf8');
const jsCode = ts.transpileModule(tsCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const mod = { exports: {} };
const runner = new Function('module', 'exports', 'require', jsCode);
runner(mod, mod.exports, require);
const { evaluateDateTimeExpression } = mod.exports;

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
console.log('PaperTape DateTime Engine Test Suite');
console.log('========================================\n');

// -----------------------------------------------------------------------------
// 1. DATE ARITHMETIC & DIFFERENCES
// -----------------------------------------------------------------------------
console.log('--- 1. Date Arithmetic ---');

test('today + 30 days', () => {
  const res = evaluateDateTimeExpression('today + 30 days');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result !== null && res.result.length > 0);
  // Verify date calculation
  const expected = new Date();
  expected.setDate(expected.getDate() + 30);
  const expectedMonth = expected.toLocaleDateString('en-US', { month: 'short' });
  const expectedDay = expected.getDate().toString();
  assert.ok(res.result.includes(expectedMonth), `Expected month ${expectedMonth} in ${res.result}`);
  assert.ok(res.result.includes(expectedDay), `Expected day ${expectedDay} in ${res.result}`);
});

test('today + 3 weeks', () => {
  const res = evaluateDateTimeExpression('today + 3 weeks');
  assert.strictEqual(res.type, 'date');
  const expected = new Date();
  expected.setDate(expected.getDate() + 21);
  const expectedDay = expected.getDate().toString();
  assert.ok(res.result.includes(expectedDay), `Expected day ${expectedDay} in ${res.result}`);
});

test('today - 2 months', () => {
  const res = evaluateDateTimeExpression('today - 2 months');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result !== null);
});

test('now + 90 days', () => {
  const res = evaluateDateTimeExpression('now + 90 days');
  assert.strictEqual(res.type, 'date');
  const expected = new Date();
  expected.setDate(expected.getDate() + 90);
  const expectedYear = expected.getFullYear().toString();
  assert.ok(res.result.includes(expectedYear), `Expected year ${expectedYear} in ${res.result}`);
});

test('90 days from Oct 1st', () => {
  const res = evaluateDateTimeExpression('90 days from Oct 1st');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result.includes('Dec 30') || res.result.includes('December 30'), `Result was ${res.result}`);
});

test('90 days from Oct 1', () => {
  const res = evaluateDateTimeExpression('90 days from Oct 1');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result.includes('Dec 30') || res.result.includes('December 30'), `Result was ${res.result}`);
});

test('Oct 1 + 90 days', () => {
  const res = evaluateDateTimeExpression('Oct 1 + 90 days');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result.includes('Dec 30') || res.result.includes('December 30'), `Result was ${res.result}`);
});

test('Dec 25 - 2 weeks', () => {
  const res = evaluateDateTimeExpression('Dec 25 - 2 weeks');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result.includes('Dec 11') || res.result.includes('December 11'), `Result was ${res.result}`);
});

test('Oct 1st to Dec 25th in days', () => {
  const res = evaluateDateTimeExpression('Oct 1st to Dec 25th in days');
  assert.strictEqual(res.result, '85 days');
  assert.strictEqual(res.type, 'date');
});

test('today to Dec 31 in weeks', () => {
  const res = evaluateDateTimeExpression('today to Dec 31 in weeks');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result.endsWith('weeks'), `Expected weeks in ${res.result}`);
});

test('between Oct 1 and Dec 25 in days', () => {
  const res = evaluateDateTimeExpression('between Oct 1 and Dec 25 in days');
  assert.strictEqual(res.result, '85 days');
  assert.strictEqual(res.type, 'date');
});

test('Oct 1st to Dec 25th (default to days)', () => {
  const res = evaluateDateTimeExpression('Oct 1st to Dec 25th');
  assert.strictEqual(res.result, '85 days');
  assert.strictEqual(res.type, 'date');
});

test('tomorrow + 3 days', () => {
  const res = evaluateDateTimeExpression('tomorrow + 3 days');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result !== null);
});

test('2 weeks before Dec 25', () => {
  const res = evaluateDateTimeExpression('2 weeks before Dec 25');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result.includes('Dec 11') || res.result.includes('December 11'), `Result was ${res.result}`);
});

// -----------------------------------------------------------------------------
// 2. TIME DURATIONS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Time Durations ---');

test('9:30 am to 5:45 pm -> 8h 15m', () => {
  const res = evaluateDateTimeExpression('9:30 am to 5:45 pm');
  assert.strictEqual(res.result, '8h 15m');
  assert.strictEqual(res.type, 'duration');
});

test('9:30am to 5:45pm (compact format)', () => {
  const res = evaluateDateTimeExpression('9:30am to 5:45pm');
  assert.strictEqual(res.result, '8h 15m');
  assert.strictEqual(res.type, 'duration');
});

test('3h 20m + 45m -> 4h 5m', () => {
  const res = evaluateDateTimeExpression('3h 20m + 45m');
  assert.strictEqual(res.result, '4h 5m');
  assert.strictEqual(res.type, 'duration');
});

test('1h 30m - 45m -> 45m', () => {
  const res = evaluateDateTimeExpression('1h 30m - 45m');
  assert.strictEqual(res.result, '45m');
  assert.strictEqual(res.type, 'duration');
});

test('9am to 5pm -> 8h', () => {
  const res = evaluateDateTimeExpression('9am to 5pm');
  assert.strictEqual(res.result, '8h');
  assert.strictEqual(res.type, 'duration');
});

test('9:30 to 17:45 (24-hr format) -> 8h 15m', () => {
  const res = evaluateDateTimeExpression('9:30 to 17:45');
  assert.strictEqual(res.result, '8h 15m');
  assert.strictEqual(res.type, 'duration');
});

test('11pm to 2am (overnight) -> 3h', () => {
  const res = evaluateDateTimeExpression('11pm to 2am');
  assert.strictEqual(res.result, '3h');
  assert.strictEqual(res.type, 'duration');
});

test('10pm to 2:30am (overnight) -> 4h 30m', () => {
  const res = evaluateDateTimeExpression('10pm to 2:30am');
  assert.strictEqual(res.result, '4h 30m');
  assert.strictEqual(res.type, 'duration');
});

test('2 hours + 30 mins -> 2h 30m', () => {
  const res = evaluateDateTimeExpression('2 hours + 30 mins');
  assert.strictEqual(res.result, '2h 30m');
  assert.strictEqual(res.type, 'duration');
});

test('1.5 hours + 45 mins -> 2h 15m', () => {
  const res = evaluateDateTimeExpression('1.5 hours + 45 mins');
  assert.strictEqual(res.result, '2h 15m');
  assert.strictEqual(res.type, 'duration');
});

test('45m + 15m -> 1h', () => {
  const res = evaluateDateTimeExpression('45m + 15m');
  assert.strictEqual(res.result, '1h');
  assert.strictEqual(res.type, 'duration');
});

test('2h - 30m -> 1h 30m', () => {
  const res = evaluateDateTimeExpression('2h - 30m');
  assert.strictEqual(res.result, '1h 30m');
  assert.strictEqual(res.type, 'duration');
});

test('5h 10m - 2h 20m -> 2h 50m', () => {
  const res = evaluateDateTimeExpression('5h 10m - 2h 20m');
  assert.strictEqual(res.result, '2h 50m');
  assert.strictEqual(res.type, 'duration');
});

// -----------------------------------------------------------------------------
// 3. TIME ZONE CONVERSIONS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Time Zone Conversions ---');

test('5pm EST in PST -> 2:00 PM PST', () => {
  const res = evaluateDateTimeExpression('5pm EST in PST');
  assert.strictEqual(res.result, '2:00 PM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('5pm EST to PST -> 2:00 PM PST', () => {
  const res = evaluateDateTimeExpression('5pm EST to PST');
  assert.strictEqual(res.result, '2:00 PM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('10am UTC in EST -> 5:00 AM EST', () => {
  const res = evaluateDateTimeExpression('10am UTC in EST');
  assert.strictEqual(res.result, '5:00 AM EST');
  assert.strictEqual(res.type, 'timezone');
});

test('3pm JST in GMT -> 6:00 AM GMT', () => {
  const res = evaluateDateTimeExpression('3pm JST in GMT');
  assert.strictEqual(res.result, '6:00 AM GMT');
  assert.strictEqual(res.type, 'timezone');
});

test('3pm Tokyo in London -> 7:00 AM BST (or 6:00 AM GMT)', () => {
  const res = evaluateDateTimeExpression('3pm Tokyo in London');
  assert.strictEqual(res.type, 'timezone');
  assert.ok(
    res.result === '7:00 AM BST' || res.result === '6:00 AM GMT',
    `Expected 7:00 AM BST or 6:00 AM GMT, got: ${res.result}`
  );
});

test('12pm EST in PST -> 9:00 AM PST', () => {
  const res = evaluateDateTimeExpression('12pm EST in PST');
  assert.strictEqual(res.result, '9:00 AM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('noon EST in PST -> 9:00 AM PST', () => {
  const res = evaluateDateTimeExpression('noon EST in PST');
  assert.strictEqual(res.result, '9:00 AM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('midnight EST in PST -> 9:00 PM PST', () => {
  const res = evaluateDateTimeExpression('midnight EST in PST');
  assert.strictEqual(res.result, '9:00 PM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('17:00 EST in PST -> 2:00 PM PST', () => {
  const res = evaluateDateTimeExpression('17:00 EST in PST');
  assert.strictEqual(res.result, '2:00 PM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('8:30am IST in London -> 4:00 AM BST (or 3:00 AM GMT)', () => {
  const res = evaluateDateTimeExpression('8:30am IST in London');
  assert.strictEqual(res.type, 'timezone');
  assert.ok(
    res.result === '4:00 AM BST' || res.result === '3:00 AM GMT',
    `Expected 4:00 AM BST or 3:00 AM GMT, got: ${res.result}`
  );
});

test('Common zones: CST, CDT, MST, MDT, AEDT, CET, CEST', () => {
  const r1 = evaluateDateTimeExpression('12pm CST in EST');
  assert.strictEqual(r1.result, '1:00 PM EST');

  const r2 = evaluateDateTimeExpression('10am MST in PST');
  assert.strictEqual(r2.result, '9:00 AM PST');

  const r3 = evaluateDateTimeExpression('12pm CET in GMT');
  assert.strictEqual(r3.result, '11:00 AM GMT');
});

// -----------------------------------------------------------------------------
// 4. SYNTAX TOLERANCE & NON-DATE/TIME EXPRESSIONS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Syntax Tolerance & Edge Cases ---');

test('Trailing = on date calculation', () => {
  const res = evaluateDateTimeExpression('today + 30 days =');
  assert.strictEqual(res.type, 'date');
  assert.ok(res.result !== null);
});

test('Trailing = on duration calculation', () => {
  const res = evaluateDateTimeExpression('3h 20m + 45m =');
  assert.strictEqual(res.result, '4h 5m');
  assert.strictEqual(res.type, 'duration');
});

test('Trailing = on timezone calculation', () => {
  const res = evaluateDateTimeExpression('5pm EST in PST =');
  assert.strictEqual(res.result, '2:00 PM PST');
  assert.strictEqual(res.type, 'timezone');
});

test('Non-datetime: "10 + 20"', () => {
  const res = evaluateDateTimeExpression('10 + 20');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.type, null);
});

test('Non-datetime: "rate: 85"', () => {
  const res = evaluateDateTimeExpression('rate: 85');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.type, null);
});

test('Non-datetime: "hello world"', () => {
  const res = evaluateDateTimeExpression('hello world');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.type, null);
});

test('Non-datetime: empty string', () => {
  const res = evaluateDateTimeExpression('');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.type, null);
});

// Summary
console.log('\n========================================');
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log('========================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
