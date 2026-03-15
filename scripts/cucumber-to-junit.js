// Converts cucumber JSON report to JUnit XML for GitLab test reporting
import { readFileSync, writeFileSync } from 'fs';

const input = 'test-results/cucumber.json';
const output = 'test-results/gherkin.xml';

try {
  const data = JSON.parse(readFileSync(input, 'utf8'));

  let tests = 0, failures = 0, pending = 0, time = 0;
  const cases = [];

  for (const feature of data) {
    const suiteName = feature.name || 'Unknown';
    for (const scenario of (feature.elements || [])) {
      if (scenario.type !== 'scenario') continue;
      tests++;

      const name = scenario.name;
      const steps = scenario.steps || [];
      const duration = steps.reduce((s, st) => s + ((st.result?.duration || 0) / 1e9), 0);
      time += duration;

      const failed = steps.find(s => s.result?.status === 'failed');
      const pend = steps.find(s => s.result?.status === 'pending' || s.result?.status === 'undefined');

      if (failed) {
        failures++;
        const msg = failed.result.error_message || 'Step failed';
        cases.push(`    <testcase classname="${esc(suiteName)}" name="${esc(name)}" time="${duration.toFixed(3)}">
      <failure message="${esc(msg.split('\n')[0])}">${esc(msg)}</failure>
    </testcase>`);
      } else if (pend) {
        pending++;
        cases.push(`    <testcase classname="${esc(suiteName)}" name="${esc(name)}" time="${duration.toFixed(3)}">
      <skipped message="Pending implementation"/>
    </testcase>`);
      } else {
        cases.push(`    <testcase classname="${esc(suiteName)}" name="${esc(name)}" time="${duration.toFixed(3)}"/>`);
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${tests}" failures="${failures}" skipped="${pending}" time="${time.toFixed(3)}">
  <testsuite name="Gherkin" tests="${tests}" failures="${failures}" skipped="${pending}" time="${time.toFixed(3)}">
${cases.join('\n')}
  </testsuite>
</testsuites>
`;

  writeFileSync(output, xml);
  console.log(`JUnit XML: ${tests} tests, ${failures} failures, ${pending} pending → ${output}`);
} catch (e) {
  console.error('Failed to convert cucumber report:', e.message);
  process.exit(1);
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
