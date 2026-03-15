import { effortModifier, calculateEffort, isImmuneTo, qaGap, canLevelUp, levelUp } from '../../src/modules/skills.js';

let passed = 0, failed = 0;
function assert(c, m) { if (c) passed++; else { failed++; console.error(`  ✗ FAIL: ${m}`); } }
function test(name, fn) { try { fn(); console.log(`  ✓ ${name}`); } catch(e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); } }

// ── Skill configs matching v3 rules ──
const BE = { id: 'BE', name: 'Backend', hasMisfortune: true, immunityLevel: 1, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } };
const DB = { id: 'DB', name: 'Database', hasMisfortune: true, immunityLevel: 1, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } };
const DO = { id: 'DO', name: 'DevOps', hasMisfortune: true, immunityLevel: 1, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } };
const FE = { id: 'FE', name: 'Frontend', hasMisfortune: false, immunityLevel: null, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } };
const ALL = [BE, DB, DO, FE];

console.log('\n── effortModifier ──');

test('level 0 = +1', () => { assert(effortModifier(BE, 0) === 1, 'BE 0'); });
test('level 1 = +0', () => { assert(effortModifier(BE, 1) === 0, 'BE 1'); });
test('level 2 = +0', () => { assert(effortModifier(BE, 2) === 0, 'BE 2'); });
test('level 3 = -1', () => { assert(effortModifier(BE, 3) === -1, 'BE 3'); });
test('FE uses same modifiers', () => { assert(effortModifier(FE, 0) === 1, 'FE 0'); });

console.log('\n── calculateEffort ──');

test('pure BE task at 0/0/0/0', () => {
  const task = { requiredSkills: ['BE'], baseEffort: 2 };
  assert(calculateEffort(ALL, { BE: 0, DB: 0, DO: 0, FE: 0 }, task) === 3, '2 + 1 = 3');
});

test('pure BE task at BE:3', () => {
  const task = { requiredSkills: ['BE'], baseEffort: 2 };
  assert(calculateEffort(ALL, { BE: 3, DB: 0, DO: 0, FE: 0 }, task) === 1, '2 + (-1) = 1');
});

test('BE/FE task at 0/0/0/0', () => {
  const task = { requiredSkills: ['BE', 'FE'], baseEffort: 3 };
  assert(calculateEffort(ALL, { BE: 0, DB: 0, DO: 0, FE: 0 }, task) === 5, '3 + 1 + 1 = 5');
});

test('BE/FE task at BE:2 FE:0', () => {
  const task = { requiredSkills: ['BE', 'FE'], baseEffort: 3 };
  assert(calculateEffort(ALL, { BE: 2, DB: 0, DO: 0, FE: 0 }, task) === 4, '3 + 0 + 1 = 4');
});

test('BE/DB task at BE:3 DB:3', () => {
  const task = { requiredSkills: ['BE', 'DB'], baseEffort: 3 };
  assert(calculateEffort(ALL, { BE: 3, DB: 3, DO: 0, FE: 0 }, task) === 1, 'min 1');
});

test('minimum effort is 1', () => {
  const task = { requiredSkills: ['BE'], baseEffort: 1 };
  assert(calculateEffort(ALL, { BE: 3, DB: 0, DO: 0, FE: 0 }, task) === 1, '1 + (-1) clamped to 1');
});

test('only relevant skills count', () => {
  const task = { requiredSkills: ['DB'], baseEffort: 2 };
  assert(calculateEffort(ALL, { BE: 3, DB: 0, DO: 3, FE: 3 }, task) === 3, 'only DB matters');
});

console.log('\n── isImmuneTo ──');

test('BE:0 not immune to BE', () => { assert(!isImmuneTo(ALL, { BE: 0 }, 'BE'), 'BE 0'); });
test('BE:1 immune to BE', () => { assert(isImmuneTo(ALL, { BE: 1 }, 'BE'), 'BE 1'); });
test('BE:2 immune to BE', () => { assert(isImmuneTo(ALL, { BE: 2 }, 'BE'), 'BE 2'); });
test('DO:0 not immune to DO', () => { assert(!isImmuneTo(ALL, { DO: 0 }, 'DO'), 'DO 0'); });
test('DO:1 immune to DO', () => { assert(isImmuneTo(ALL, { DO: 1 }, 'DO'), 'DO 1'); });
test('FE never grants immunity', () => { assert(!isImmuneTo(ALL, { FE: 3 }, 'FE'), 'FE has no misfortune'); });
test('missing skill defaults to 0 (not immune)', () => { assert(!isImmuneTo(ALL, {}, 'BE'), 'missing = 0'); });

console.log('\n── qaGap ──');

test('pure BE task at BE:0 = gap 1', () => {
  assert(qaGap(ALL, { BE: 0 }, { requiredSkills: ['BE'] }) === 1, 'gap 1');
});

test('pure BE task at BE:2 = gap 0', () => {
  assert(qaGap(ALL, { BE: 2 }, { requiredSkills: ['BE'] }) === 0, 'auto-pass');
});

test('BE/DB task at BE:0 DB:0 = gap 2', () => {
  assert(qaGap(ALL, { BE: 0, DB: 0 }, { requiredSkills: ['BE', 'DB'] }) === 2, 'gap 2');
});

test('BE/DB task at BE:2 DB:0 = gap 1', () => {
  assert(qaGap(ALL, { BE: 2, DB: 0 }, { requiredSkills: ['BE', 'DB'] }) === 1, 'gap 1');
});

test('BE/FE task at BE:2 FE:0 = gap 1 (FE contributes to gap)', () => {
  assert(qaGap(ALL, { BE: 2, FE: 0 }, { requiredSkills: ['BE', 'FE'] }) === 1, 'FE gap');
});

test('BE/FE task at BE:2 FE:2 = gap 0', () => {
  assert(qaGap(ALL, { BE: 2, FE: 2 }, { requiredSkills: ['BE', 'FE'] }) === 0, 'both pass');
});

test('level 1 still contributes to gap', () => {
  assert(qaGap(ALL, { BE: 1 }, { requiredSkills: ['BE'] }) === 1, 'lvl 1 < qaPassLevel 2');
});

console.log('\n── canLevelUp ──');

test('level 0 can level up', () => { assert(canLevelUp(BE, 0), 'can'); });
test('level 2 can level up', () => { assert(canLevelUp(BE, 2), 'can'); });
test('level 3 cannot level up (at max)', () => { assert(!canLevelUp(BE, 3), 'at max'); });

console.log('\n── levelUp ──');

test('immutable: returns new object', () => {
  const skills = { BE: 0, DB: 0, DO: 0, FE: 0 };
  const after = levelUp(skills, 'BE');
  assert(after.BE === 1, 'BE is 1');
  assert(skills.BE === 0, 'original unchanged');
});

test('only changes targeted skill', () => {
  const after = levelUp({ BE: 1, DB: 2, DO: 0, FE: 0 }, 'DO');
  assert(after.DO === 1, 'DO leveled');
  assert(after.BE === 1, 'BE unchanged');
  assert(after.DB === 2, 'DB unchanged');
});

console.log('\n── Results ──');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
