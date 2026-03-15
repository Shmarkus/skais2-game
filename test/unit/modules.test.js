import { createDeck, shuffle, draw, isEmpty, size } from '../../src/modules/deck.js';
import { createBoard, addBug, removeBug, addDissatisfaction, removeDissatisfaction, totalTokens, playerBugCount, dangerCheck, deliveryTarget, deliveryCheck, sprintBonus } from '../../src/modules/board.js';
import { qaCheck, scoreTask, bounceTask } from '../../src/modules/completion.js';
import { checkImmunity, resolveEffect, isSkipEffect, isInstantComplete, registerEffect } from '../../src/modules/misfortune.js';

let passed = 0, failed = 0;
function assert(c, m) { if (c) passed++; else { failed++; console.error(`  ✗ FAIL: ${m}`); } }
function test(name, fn) { try { fn(); console.log(`  ✓ ${name}`); } catch(e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); } }

// ── Configs ──
const BE = { id: 'BE', hasMisfortune: true, immunityLevel: 1, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } };
const FE = { id: 'FE', hasMisfortune: false, immunityLevel: null, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } };
const ALL = [BE, { id: 'DB', hasMisfortune: true, immunityLevel: 1, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } }, { id: 'DO', hasMisfortune: true, immunityLevel: 1, qaPassLevel: 2, maxLevel: 3, effortModifiers: { 0: 1, 1: 0, 2: 0, 3: -1 } }, FE];

// ═══════════════════════════════════════
console.log('\n── Deck Module ──');
// ═══════════════════════════════════════

test('createDeck shuffles a copy', () => {
  const cards = ['A', 'B', 'C', 'D', 'E'];
  const deck = createDeck(cards, () => 0.5);
  assert(deck.length === 5, 'same length');
  assert(cards[0] === 'A', 'original unchanged');
});

test('draw returns first card and remaining', () => {
  const deck = ['A', 'B', 'C'];
  const result = draw(deck);
  assert(result.card === 'A', 'first card');
  assert(result.remaining.length === 2, '2 remaining');
  assert(!result.reshuffled, 'not reshuffled');
});

test('draw from empty returns null (no reshuffle)', () => {
  const result = draw([]);
  assert(result.card === null, 'no card');
  assert(result.remaining.length === 0, 'empty');
});

test('draw from empty reshuffles when template provided', () => {
  const template = ['X', 'Y', 'Z'];
  const result = draw([], template, () => 0.5);
  assert(result.card !== null, 'got a card');
  assert(result.reshuffled, 'reshuffled flag');
  assert(result.remaining.length === 2, '2 remaining after draw');
});

test('isEmpty and size', () => {
  assert(isEmpty([]), 'empty');
  assert(!isEmpty(['A']), 'not empty');
  assert(size(['A', 'B']) === 2, 'size 2');
});

// ═══════════════════════════════════════
console.log('\n── Board Module ──');
// ═══════════════════════════════════════

test('createBoard initializes clean', () => {
  const b = createBoard(5);
  assert(b.playerBugs.length === 5, '5 players');
  assert(totalTokens(b) === 0, 'no tokens');
});

test('addBug increases player count and total', () => {
  let b = createBoard(3);
  b = addBug(b, 1);
  assert(playerBugCount(b, 1) === 1, 'player 1 has 1');
  assert(totalTokens(b) === 1, 'total 1');
  b = addBug(b, 1);
  assert(playerBugCount(b, 1) === 2, 'player 1 has 2');
});

test('removeBug decreases', () => {
  let b = createBoard(3);
  b = addBug(b, 0);
  b = addBug(b, 0);
  b = removeBug(b, 0);
  assert(playerBugCount(b, 0) === 1, 'down to 1');
});

test('removeBug at 0 stays at 0', () => {
  let b = createBoard(3);
  b = removeBug(b, 0);
  assert(playerBugCount(b, 0) === 0, 'still 0');
});

test('dissatisfaction adds to total', () => {
  let b = createBoard(3);
  b = addBug(b, 0);
  b = addDissatisfaction(b, 3);
  assert(totalTokens(b) === 4, '1 bug + 3 dissat');
});

test('removeDissatisfaction decreases', () => {
  let b = createBoard(3);
  b = addDissatisfaction(b, 2);
  b = removeDissatisfaction(b);
  assert(b.dissatisfaction === 1, 'down to 1');
});

test('immutability: addBug returns new object', () => {
  const b = createBoard(3);
  const b2 = addBug(b, 0);
  assert(b !== b2, 'different object');
  assert(playerBugCount(b, 0) === 0, 'original unchanged');
});

// ── Danger Zone ──

test('0-7 tokens = Safe', () => {
  let b = createBoard(5);
  b = addDissatisfaction(b, 7);
  const result = dangerCheck(b, 1);
  assert(result.zone === 'Safe', 'safe zone');
  assert(result.survived, 'survived');
});

test('8 tokens + roll 5 = Warning, survived', () => {
  let b = createBoard(5);
  b = addDissatisfaction(b, 8);
  const result = dangerCheck(b, 5);
  assert(result.zone === 'Warning', 'warning');
  assert(result.survived, 'roll 5 < 6');
});

test('8 tokens + roll 6 = Warning, died', () => {
  let b = createBoard(5);
  b = addDissatisfaction(b, 8);
  const result = dangerCheck(b, 6);
  assert(result.zone === 'Warning', 'warning');
  assert(!result.survived, 'roll 6 >= 6');
});

test('18+ tokens = auto death', () => {
  let b = createBoard(5);
  b = addDissatisfaction(b, 20);
  const result = dangerCheck(b, 1);
  assert(result.zone === 'DEAD', 'dead');
  assert(!result.survived, 'auto death');
});

// ── Delivery Target ──

test('delivery target: 2 players = 2', () => { assert(deliveryTarget(2) === 2, '2'); });
test('delivery target: 5 players = 3', () => { assert(deliveryTarget(5) === 3, '3'); });
test('delivery target: 10 players = 6', () => { assert(deliveryTarget(10) === 6, '6'); });

test('deliveryCheck: met', () => {
  const r = deliveryCheck(3, 5);
  assert(r.met, 'met');
  assert(r.deficit === 0, 'no deficit');
});

test('deliveryCheck: missed', () => {
  const r = deliveryCheck(1, 5);
  assert(!r.met, 'not met');
  assert(r.deficit === 2, 'deficit 2');
});

// ── Sprint Bonus ──

test('sole zero bugs = +2 SP', () => {
  const b = { playerBugs: [0, 1, 2, 1, 3] };
  const r = sprintBonus(b);
  assert(r.type === 'sole_zero', 'sole zero');
  assert(r.bonus === 2, '+2');
  assert(r.players.length === 1, 'one player');
  assert(r.players[0] === 0, 'player 0');
});

test('tied fewest = +1 each', () => {
  const b = { playerBugs: [1, 1, 2, 3, 2] };
  const r = sprintBonus(b);
  assert(r.type === 'tied_fewest', 'tied');
  assert(r.bonus === 1, '+1');
  assert(r.players.length === 2, 'two players tied');
});

test('all zero = tied, +1 each', () => {
  const b = { playerBugs: [0, 0, 0] };
  const r = sprintBonus(b);
  assert(r.type === 'tied_fewest', 'tied (not sole_zero with multiple)');
  assert(r.bonus === 1, '+1');
});

// ═══════════════════════════════════════
console.log('\n── Completion Module ──');
// ═══════════════════════════════════════

test('qaCheck: gap 0 = auto-pass', () => {
  const r = qaCheck(ALL, { BE: 2 }, { requiredSkills: ['BE'] }, null);
  assert(r.passed, 'passed');
  assert(r.autoPass, 'auto');
});

test('qaCheck: gap 1, roll 2 = pass', () => {
  const r = qaCheck(ALL, { BE: 0 }, { requiredSkills: ['BE'] }, 2);
  assert(r.passed, 'roll 2 > gap 1');
  assert(!r.autoPass, 'not auto');
});

test('qaCheck: gap 1, roll 1 = bounce', () => {
  const r = qaCheck(ALL, { BE: 0 }, { requiredSkills: ['BE'] }, 1);
  assert(!r.passed, 'roll 1 <= gap 1');
  assert(r.bounced, 'bounced');
});

test('qaCheck: gap 2, roll 2 = bounce', () => {
  const r = qaCheck(ALL, { BE: 0, FE: 0 }, { requiredSkills: ['BE', 'FE'] }, 2);
  assert(!r.passed, 'roll 2 <= gap 2');
});

test('qaCheck: gap 2, roll 3 = pass', () => {
  const r = qaCheck(ALL, { BE: 0, FE: 0 }, { requiredSkills: ['BE', 'FE'] }, 3);
  assert(r.passed, 'roll 3 > gap 2');
});

test('scoreTask adds SP and clears task', () => {
  const player = { score: 5, task: { id: 'T01' }, effort: 0 };
  const result = scoreTask(player, { storyPoints: 3 });
  assert(result.score === 8, 'score +3');
  assert(result.task === null, 'task cleared');
  assert(player.score === 5, 'original unchanged');
});

test('bounceTask sets effort to 1', () => {
  const player = { effort: 0, bugs: 2 };
  const result = bounceTask(player);
  assert(result.effort === 1, 'effort reset to 1');
});

// ═══════════════════════════════════════
console.log('\n── Misfortune Module ──');
// ═══════════════════════════════════════

test('immune to BE at BE:1', () => {
  assert(checkImmunity(ALL, { BE: 1 }, { category: 'BE', severity: 'MINOR' }), 'immune');
});

test('not immune to BE at BE:0', () => {
  assert(!checkImmunity(ALL, { BE: 0 }, { category: 'BE', severity: 'MINOR' }), 'not immune');
});

test('never immune to LUCKY', () => {
  assert(!checkImmunity(ALL, { BE: 3 }, { category: null, severity: 'LUCKY' }), 'lucky always resolves');
});

test('FE cards: no immunity possible', () => {
  assert(!checkImmunity(ALL, { FE: 3 }, { category: 'FE', severity: 'MINOR' }), 'FE has no misfortune');
});

test('effect: effort adds to current task', () => {
  const player = { task: { id: 'T01' }, effort: 3 };
  const result = resolveEffect(player, {}, { effectType: 'effort', effectValue: 1 }, {});
  assert(result.playerPatch.effort === 4, 'effort +1');
});

test('effect: skip returns skip meta', () => {
  const result = resolveEffect({}, {}, { effectType: 'skip' }, {});
  assert(isSkipEffect(result.meta), 'is skip');
});

test('effect: bug adds to player and board', () => {
  const result = resolveEffect({ bugs: 1 }, {}, { effectType: 'bug', effectValue: 2 }, { playerIndex: 0 });
  assert(result.playerPatch.bugs === 3, 'bugs +2');
  assert(result.boardPatch.addBugs === 2, 'board +2');
});

test('effect: instant_complete', () => {
  const result = resolveEffect({}, {}, { effectType: 'instant_complete' }, {});
  assert(isInstantComplete(result.meta), 'instant');
});

test('effect: lose_sp floors at 0', () => {
  const result = resolveEffect({ score: 1 }, {}, { effectType: 'lose_sp', effectValue: 5 }, {});
  assert(result.playerPatch.score === 0, 'floored at 0');
});

test('effect: two_actions returns extra', () => {
  const result = resolveEffect({}, {}, { effectType: 'two_actions' }, {});
  assert(result.meta.extraActions === 1, '+1 extra action');
});

test('effect: integration_effort on integration task', () => {
  const player = { task: { id: 'T03', requiredSkills: ['BE'] }, effort: 3 };
  const result = resolveEffect(player, {}, { effectType: 'integration_effort', effectValue: 2 }, { integrationTaskIds: ['T03', 'T26'] });
  assert(result.playerPatch.effort === 5, '+2 on integration');
});

test('effect: integration_effort on non-integration task', () => {
  const player = { task: { id: 'T01', requiredSkills: ['BE'] }, effort: 3 };
  const result = resolveEffect(player, {}, { effectType: 'integration_effort', effectValue: 2 }, { integrationTaskIds: ['T03'] });
  assert(result.meta.type === 'no_effect', 'no effect');
});

test('registerEffect: extend with custom effect', () => {
  registerEffect('coffee_break', (player) => ({
    meta: { type: 'coffee', message: 'Kohvipaus!' },
  }));
  const result = resolveEffect({}, {}, { effectType: 'coffee_break' }, {});
  assert(result.meta.type === 'coffee', 'custom effect works');
});

test('unknown effect throws', () => {
  let threw = false;
  try { resolveEffect({}, {}, { effectType: 'nonexistent' }, {}); }
  catch (e) { threw = true; }
  assert(threw, 'threw on unknown');
});

// ═══════════════════════════════════════
console.log('\n── Results ──');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
