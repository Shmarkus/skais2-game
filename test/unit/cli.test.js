import { parseArgs } from '../../src/cli.js';

// Prevent CLI main() from running — it's guarded by being in main()
// We only import parseArgs which is a pure function.

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('\n── parseArgs ──');

test('parses player names', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob']);
  assert(!r.error, 'should not error');
  assert(r.names.length === 2, 'should have 2 names');
  assert(r.names[0] === 'Alice', 'first name');
  assert(r.names[1] === 'Bob', 'second name');
});

test('parses --seed flag', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob', '--seed', '42']);
  assert(!r.error, 'should not error');
  assert(r.seed === 42, 'seed should be 42');
});

test('parses --fast-forward flag', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob', '--fast-forward']);
  assert(!r.error, 'should not error');
  assert(r.fastForward === true, 'should be fast-forward');
});

test('rejects fewer than 2 players', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice']);
  assert(r.error, 'should error');
  assert(r.error.includes('2-10'), 'should mention range');
});

test('rejects more than 10 players', () => {
  const names = Array.from({ length: 11 }, (_, i) => `P${i}`);
  const r = parseArgs(['node', 'cli.js', ...names]);
  assert(r.error, 'should error');
});

test('rejects unknown flags', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob', '--verbose']);
  assert(r.error, 'should error');
  assert(r.error.includes('--verbose'), 'should mention flag');
});

test('rejects non-numeric seed', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob', '--seed', 'abc']);
  assert(r.error, 'should error');
});

test('all flags together', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob', 'Carol', '--seed', '7', '--fast-forward']);
  assert(!r.error, 'should not error');
  assert(r.names.length === 3, '3 names');
  assert(r.seed === 7, 'seed 7');
  assert(r.fastForward === true, 'fast-forward');
});

test('default seed is null', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob']);
  assert(r.seed === null, 'seed should be null');
});

test('default fast-forward is false', () => {
  const r = parseArgs(['node', 'cli.js', 'Alice', 'Bob']);
  assert(r.fastForward === false, 'should not be fast-forward');
});

console.log(`\n── Results ──`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
