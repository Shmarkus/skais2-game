import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';

const dir = dirname(fileURLToPath(import.meta.url));
const tests = ['stateMachine.test.js', 'validator.test.js', 'skills.test.js', 'modules.test.js', 'reducer.test.js'];

let allPassed = true;
const suiteResults = [];

for (const t of tests) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Running ${t}`);
  console.log('═'.repeat(60));
  try {
    const output = execSync(`node ${join(dir, t)}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    process.stdout.write(output);
    const match = output.match(/(\d+) passed, (\d+) failed/);
    const passed = match ? parseInt(match[1]) : 0;
    const failed = match ? parseInt(match[2]) : 0;
    if (failed > 0) allPassed = false;
    suiteResults.push({ name: t, passed, failed, output });
  } catch (e) {
    allPassed = false;
    const output = (e.stdout || '') + (e.stderr || '');
    process.stdout.write(output);
    const match = output.match(/(\d+) passed, (\d+) failed/);
    suiteResults.push({ name: t, passed: match ? parseInt(match[1]) : 0, failed: match ? parseInt(match[2]) : 1, output });
  }
}

// Generate JUnit XML
const totalTests = suiteResults.reduce((s, r) => s + r.passed + r.failed, 0);
const totalFailures = suiteResults.reduce((s, r) => s + r.failed, 0);
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cases = suiteResults.map(r => {
  if (r.failed > 0) {
    const failLines = r.output.split('\n').filter(l => l.includes('FAIL')).join('\n');
    return `    <testcase classname="unit" name="${esc(r.name)}" time="0">
      <failure message="${r.failed} tests failed">${esc(failLines)}</failure>
    </testcase>`;
  }
  return `    <testcase classname="unit" name="${esc(r.name)}" time="0"/>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${totalTests}" failures="${totalFailures}" time="0">
  <testsuite name="Unit Tests" tests="${totalTests}" failures="${totalFailures}" time="0">
${cases}
  </testsuite>
</testsuites>
`;

try {
  mkdirSync(join(dir, '../../test-results'), { recursive: true });
  writeFileSync(join(dir, '../../test-results/unit.xml'), xml);
  console.log(`\nJUnit XML: ${totalTests} tests, ${totalFailures} failures -> test-results/unit.xml`);
} catch (e) { /* non-fatal */ }

console.log(`\n${'═'.repeat(60)}`);
console.log(allPassed ? '  ALL TEST SUITES PASSED' : '  SOME TESTS FAILED');
console.log('═'.repeat(60));
if (!allPassed) process.exit(1);
