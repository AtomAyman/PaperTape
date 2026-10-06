/**
 * PaperTape Math & Expression Parser Verification Test Suite
 * Executes via: node test_math.cjs
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

// Transpile mathEngine.ts to CommonJS for standalone node execution
const tsPath = path.join(__dirname, 'src/services/mathEngine.ts');
const tsSource = fs.readFileSync(tsPath, 'utf8');
const jsOutput = ts.transpileModule(tsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const mathModule = { exports: {} };
const runner = new Function('module', 'exports', 'require', '__dirname', '__filename', jsOutput);
runner(mathModule, mathModule.exports, require, path.dirname(tsPath), tsPath);

const { evaluateMathExpression } = mathModule.exports;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
  }
}

console.log('====================================================');
console.log('  PAPERTAPE MATH & EXPRESSION PARSER TEST SUITE');
console.log('====================================================\n');

// 1. Percentage Formulas
console.log('--- 1. Percentage Formulas ---');

runTest('"X + Y%": e.g. "150 + 20%" -> 180', () => {
  const res = evaluateMathExpression('150 + 20%');
  assert.strictEqual(res.result, 180);
  assert.strictEqual(res.formatted, '180');
});

runTest('"X - Y%": e.g. "120 - 15%" -> 102', () => {
  const res = evaluateMathExpression('120 - 15%');
  assert.strictEqual(res.result, 102);
  assert.strictEqual(res.formatted, '102');
});

runTest('"X% of Y": e.g. "20% of 250" -> 50', () => {
  const res = evaluateMathExpression('20% of 250');
  assert.strictEqual(res.result, 50);
  assert.strictEqual(res.formatted, '50');
});

runTest('"X% off Y": e.g. "30% off 80" -> 56', () => {
  const res = evaluateMathExpression('30% off 80');
  assert.strictEqual(res.result, 56);
  assert.strictEqual(res.formatted, '56');
});

runTest('"X as a % of Y": e.g. "25 as a % of 100" -> "25%"', () => {
  const res = evaluateMathExpression('25 as a % of 100');
  assert.strictEqual(res.result, '25%');
  assert.strictEqual(res.formatted, '25%');
});

runTest('"X as % of Y": e.g. "25 as % of 100" -> "25%"', () => {
  const res = evaluateMathExpression('25 as % of 100');
  assert.strictEqual(res.result, '25%');
  assert.strictEqual(res.formatted, '25%');
});

runTest('"X% on Y": e.g. "20% on 100" -> 120', () => {
  const res = evaluateMathExpression('20% on 100');
  assert.strictEqual(res.result, 120);
  assert.strictEqual(res.formatted, '120');
});

runTest('Chained percentage additions: "100 + 10% + 10%" -> 121', () => {
  const res = evaluateMathExpression('100 + 10% + 10%');
  assert.strictEqual(res.result, 121);
  assert.strictEqual(res.formatted, '121');
});

runTest('Chained percentage subtractions: "100 - 10% - 10%" -> 81', () => {
  const res = evaluateMathExpression('100 - 10% - 10%');
  assert.strictEqual(res.result, 81);
  assert.strictEqual(res.formatted, '81');
});

runTest('Parenthesized percentages: "(100 + 50) + 20%" -> 180', () => {
  const res = evaluateMathExpression('(100 + 50) + 20%');
  assert.strictEqual(res.result, 180);
});

runTest('Percentage multiplication: "50 * 20%" -> 10', () => {
  const res = evaluateMathExpression('50 * 20%');
  assert.strictEqual(res.result, 10);
});

runTest('Percentage division: "100 / 20%" -> 500', () => {
  const res = evaluateMathExpression('100 / 20%');
  assert.strictEqual(res.result, 500);
});

// 2. Currency Clean Handling
console.log('\n--- 2. Currency Handling ---');

runTest('USD with trailing =: "$150 + 20% =" -> 180, "$180"', () => {
  const res = evaluateMathExpression('$150 + 20% =');
  assert.strictEqual(res.result, 180);
  assert.strictEqual(res.formatted, '$180');
});

runTest('USD subtraction: "$80 - $20" -> 60, "$60"', () => {
  const res = evaluateMathExpression('$80 - $20');
  assert.strictEqual(res.result, 60);
  assert.strictEqual(res.formatted, '$60');
});

runTest('EUR subtraction & percentage: "€120 - 15%" -> 102, "€102"', () => {
  const res = evaluateMathExpression('€120 - 15%');
  assert.strictEqual(res.result, 102);
  assert.strictEqual(res.formatted, '€102');
});

runTest('GBP addition & percentage: "£250 + 10%" -> 275, "£275"', () => {
  const res = evaluateMathExpression('£250 + 10%');
  assert.strictEqual(res.result, 275);
  assert.strictEqual(res.formatted, '£275');
});

runTest('JPY currency: "¥1000 + 10%" -> 1100, "¥1,100"', () => {
  const res = evaluateMathExpression('¥1000 + 10%');
  assert.strictEqual(res.result, 1100);
  assert.strictEqual(res.formatted, '¥1,100');
});

runTest('Currency in % of: "20% of $250" -> 50, "$50"', () => {
  const res = evaluateMathExpression('20% of $250');
  assert.strictEqual(res.result, 50);
  assert.strictEqual(res.formatted, '$50');
});

runTest('Currency in % off: "30% off $80" -> 56, "$56"', () => {
  const res = evaluateMathExpression('30% off $80');
  assert.strictEqual(res.result, 56);
  assert.strictEqual(res.formatted, '$56');
});

runTest('Currency in % on: "20% on $100" -> 120, "$120"', () => {
  const res = evaluateMathExpression('20% on $100');
  assert.strictEqual(res.result, 120);
  assert.strictEqual(res.formatted, '$120');
});

runTest('Currency in as % of: "$25 as a % of $100" -> "25%"', () => {
  const res = evaluateMathExpression('$25 as a % of $100');
  assert.strictEqual(res.result, '25%');
  assert.strictEqual(res.formatted, '25%');
});

runTest('Thousands separators: "$1,500 + $500" -> 2000, "$2,000"', () => {
  const res = evaluateMathExpression('$1,500 + $500');
  assert.strictEqual(res.result, 2000);
  assert.strictEqual(res.formatted, '$2,000');
});

// 3. Variable Lookup Dictionary
console.log('\n--- 3. Variable Lookup Dictionary ---');

const testVars = {
  salary: 5000,
  tax: 20,
  rate: 85,
  "hourly rate": 90,
  hours: 8,
  discount: 30,
  total: 250,
  subtotal: 100
};

runTest('Simple variable addition: "salary + 10%" -> 5500', () => {
  const res = evaluateMathExpression('salary + 10%', testVars);
  assert.strictEqual(res.result, 5500);
  assert.strictEqual(res.formatted, '5,500');
});

runTest('Multi-word variable with spaces: "hourly rate * hours" -> 720', () => {
  const res = evaluateMathExpression('hourly rate * hours', testVars);
  assert.strictEqual(res.result, 720);
  assert.strictEqual(res.formatted, '720');
});

runTest('Variable in % of: "tax% of total" -> 50', () => {
  const res = evaluateMathExpression('tax% of total', testVars);
  assert.strictEqual(res.result, 50);
});

runTest('Variable in % off: "discount% off subtotal" -> 70', () => {
  const res = evaluateMathExpression('discount% off subtotal', testVars);
  assert.strictEqual(res.result, 70);
});

runTest('Variable in % on: "tax% on subtotal" -> 120', () => {
  const res = evaluateMathExpression('tax% on subtotal', testVars);
  assert.strictEqual(res.result, 120);
});

runTest('Case-insensitive variable: "SALARY - 10%" -> 4500', () => {
  const res = evaluateMathExpression('SALARY - 10%', testVars);
  assert.strictEqual(res.result, 4500);
});

runTest('Longest variable key matching first: "rate" vs "hourly rate"', () => {
  const vars = { rate: 10, "hourly rate": 80 };
  const res1 = evaluateMathExpression('hourly rate + 5', vars);
  assert.strictEqual(res1.result, 85);
  const res2 = evaluateMathExpression('rate + 5', vars);
  assert.strictEqual(res2.result, 15);
});

// 4. Natural Language Expressions
console.log('\n--- 4. Natural Language Phrasing ---');

runTest('"150 plus 20%" -> 180', () => {
  const res = evaluateMathExpression('150 plus 20%');
  assert.strictEqual(res.result, 180);
});

runTest('"120 minus 15%" -> 102', () => {
  const res = evaluateMathExpression('120 minus 15%');
  assert.strictEqual(res.result, 102);
});

runTest('"20 percent of 250" -> 50', () => {
  const res = evaluateMathExpression('20 percent of 250');
  assert.strictEqual(res.result, 50);
});

runTest('"30 percent off 80" -> 56', () => {
  const res = evaluateMathExpression('30 percent off 80');
  assert.strictEqual(res.result, 56);
});

runTest('"20 percent on 100" -> 120', () => {
  const res = evaluateMathExpression('20 percent on 100');
  assert.strictEqual(res.result, 120);
});

runTest('"20% on top of 100" -> 120', () => {
  const res = evaluateMathExpression('20% on top of 100');
  assert.strictEqual(res.result, 120);
});

runTest('"25 as a percent of 100" -> "25%"', () => {
  const res = evaluateMathExpression('25 as a percent of 100');
  assert.strictEqual(res.result, '25%');
});

runTest('"25 as percentage of 100" -> "25%"', () => {
  const res = evaluateMathExpression('25 as percentage of 100');
  assert.strictEqual(res.result, '25%');
});

runTest('"25 as a percentage of 100" -> "25%"', () => {
  const res = evaluateMathExpression('25 as a percentage of 100');
  assert.strictEqual(res.result, '25%');
});

runTest('"100 multiplied by 5" -> 500', () => {
  const res = evaluateMathExpression('100 multiplied by 5');
  assert.strictEqual(res.result, 500);
});

runTest('"100 divided by 4" -> 25', () => {
  const res = evaluateMathExpression('100 divided by 4');
  assert.strictEqual(res.result, 25);
});

runTest('"100 over 4" -> 25', () => {
  const res = evaluateMathExpression('100 over 4');
  assert.strictEqual(res.result, 25);
});

// 5. Mathematical Functions & Safe Evaluation
console.log('\n--- 5. Mathematical Functions & Safe Evaluation ---');

runTest('sqrt: "sqrt(144) + 10" -> 22', () => {
  const res = evaluateMathExpression('sqrt(144) + 10');
  assert.strictEqual(res.result, 22);
});

runTest('abs with percentage: "abs(-50) + 20%" -> 60', () => {
  const res = evaluateMathExpression('abs(-50) + 20%');
  assert.strictEqual(res.result, 60);
});

runTest('min & max functions: "min(10, 20, 5) + max(1, 2, 3)" -> 8', () => {
  const res = evaluateMathExpression('min(10, 20, 5) + max(1, 2, 3)');
  assert.strictEqual(res.result, 8);
});

runTest('Exponentiation: "2 ^ 3 + 4" -> 12', () => {
  const res = evaluateMathExpression('2 ^ 3 + 4');
  assert.strictEqual(res.result, 12);
});

runTest('Pi constant: "round(pi * 100)" -> 314', () => {
  const res = evaluateMathExpression('round(pi * 100)');
  assert.strictEqual(res.result, 314);
});

// 6. Edge Cases & Error Resilience
console.log('\n--- 6. Edge Cases & Error Resilience ---');

runTest('Empty string returns null', () => {
  const res = evaluateMathExpression('');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('Whitespace string returns null', () => {
  const res = evaluateMathExpression('    ');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('Incomplete expression "150 +" returns null', () => {
  const res = evaluateMathExpression('150 +');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('Division by zero returns null', () => {
  const res = evaluateMathExpression('100 / 0');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('"25 as % of 0" division by zero returns null', () => {
  const res = evaluateMathExpression('25 as % of 0');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('Unbalanced parentheses "(100 + 20" returns null', () => {
  const res = evaluateMathExpression('(100 + 20');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('Negative sqrt "sqrt(-4)" returns null', () => {
  const res = evaluateMathExpression('sqrt(-4)');
  assert.strictEqual(res.result, null);
  assert.strictEqual(res.formatted, null);
});

runTest('Arbitrary text / code injection safely returns null', () => {
  const res1 = evaluateMathExpression('process.exit(1)');
  assert.strictEqual(res1.result, null);
  const res2 = evaluateMathExpression('console.log("hello")');
  assert.strictEqual(res2.result, null);
  const res3 = evaluateMathExpression('__proto__');
  assert.strictEqual(res3.result, null);
});

console.log('\n====================================================');
console.log(`  RESULTS: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED 100%!');
  process.exit(0);
}
