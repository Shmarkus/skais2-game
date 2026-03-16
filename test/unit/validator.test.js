import {
  ok, fail,
  validateGameRunning,
  validateActivePlayer,
  validatePhaseAcceptsAction,
  validateActionPreconditions,
  validateAction,
  getLegalActions,
  composeValidators,
} from '../../src/validator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

// ── Test Helpers: build minimal state ──

const baseConfig = {
  skills: [
    { id: 'BE', name: 'Backend', maxLevel: 3 },
    { id: 'DB', name: 'Database', maxLevel: 3 },
    { id: 'DO', name: 'DevOps', maxLevel: 3 },
    { id: 'FE', name: 'Frontend', maxLevel: 3 },
  ],
};

function makeState(overrides = {}) {
  return {
    phase: { game: 'PLAYING', step: 'AWAITING_ACTION', activePlayer: 0, sprint: 1, turn: 1 },
    players: [
      { skills: { BE: 0, DB: 0, DO: 0, FE: 0 }, task: { id: 'T01', requiredSkills: ['BE'] }, effort: 3, score: 0, bugs: 0, reviewPile: [], skillUpProgress: null },
      { skills: { BE: 1, DB: 0, DO: 0, FE: 0 }, task: { id: 'T13', requiredSkills: ['DB'] }, effort: 2, score: 0, bugs: 0, reviewPile: [], skillUpProgress: null },
    ],
    board: { playerBugs: [0, 0], dissatisfaction: 1 },
    tokenPool: { tier1: 3, tier2: 3, tier3: 3 },
    config: baseConfig,
    ...overrides,
  };
}

// ═════════════════════════════════════
console.log('\n── validateGameRunning ──');
// ═════════════════════════════════════

test('accepts PLAYING state', () => {
  const state = makeState();
  const result = validateGameRunning(state, {});
  assert(result.valid, 'should be valid');
});

test('rejects GAME_OVER', () => {
  const state = makeState({ phase: { game: 'GAME_OVER', step: 'AWAITING_ACTION', activePlayer: 0 } });
  const result = validateGameRunning(state, {});
  assert(!result.valid, 'should be invalid');
  assert(result.error.includes('GAME_OVER'), 'error mentions GAME_OVER');
});

test('rejects SETUP', () => {
  const state = makeState({ phase: { game: 'SETUP', step: 'AWAITING_ACTION', activePlayer: 0 } });
  const result = validateGameRunning(state, {});
  assert(!result.valid, 'should be invalid');
});

// ═════════════════════════════════════
console.log('\n── validateActivePlayer ──');
// ═════════════════════════════════════

test('accepts correct player', () => {
  const state = makeState();
  const result = validateActivePlayer(state, { player: 0 });
  assert(result.valid, 'player 0 is active');
});

test('rejects wrong player', () => {
  const state = makeState();
  const result = validateActivePlayer(state, { player: 1 });
  assert(!result.valid, 'player 1 is not active');
});

test('accepts action without player field (auto-actions)', () => {
  const state = makeState();
  const result = validateActivePlayer(state, { type: 'DRAW_MISFORTUNE' });
  assert(result.valid, 'no player field = ok');
});

// ═════════════════════════════════════
console.log('\n── validatePhaseAcceptsAction ──');
// ═════════════════════════════════════

test('AWAITING_ACTION accepts DEVELOP', () => {
  const state = makeState();
  const result = validatePhaseAcceptsAction(state, { type: 'DEVELOP' });
  assert(result.valid, 'develop allowed');
});

test('AWAITING_ACTION accepts SKILL_UP', () => {
  const state = makeState();
  const result = validatePhaseAcceptsAction(state, { type: 'SKILL_UP' });
  assert(result.valid, 'skill_up allowed');
});

test('AWAITING_ACTION accepts PAY_DEBT', () => {
  const state = makeState();
  const result = validatePhaseAcceptsAction(state, { type: 'PAY_DEBT' });
  assert(result.valid, 'pay_debt allowed');
});

test('AWAITING_ACTION accepts PROPER_REVIEW', () => {
  const state = makeState();
  const result = validatePhaseAcceptsAction(state, { type: 'PROPER_REVIEW' });
  assert(result.valid, 'proper_review allowed');
});

test('AWAITING_ACTION accepts LGTM', () => {
  const state = makeState();
  const result = validatePhaseAcceptsAction(state, { type: 'LGTM' });
  assert(result.valid, 'lgtm allowed');
});

test('AWAITING_ACTION rejects DRAW_MISFORTUNE', () => {
  const state = makeState();
  const result = validatePhaseAcceptsAction(state, { type: 'DRAW_MISFORTUNE' });
  assert(!result.valid, 'draw not allowed during action');
});

test('DRAW_MISFORTUNE accepts DRAW_MISFORTUNE', () => {
  const state = makeState({ phase: { game: 'PLAYING', step: 'DRAW_MISFORTUNE', activePlayer: 0 } });
  const result = validatePhaseAcceptsAction(state, { type: 'DRAW_MISFORTUNE' });
  assert(result.valid, 'draw allowed');
});

test('DRAW_MISFORTUNE rejects DEVELOP', () => {
  const state = makeState({ phase: { game: 'PLAYING', step: 'DRAW_MISFORTUNE', activePlayer: 0 } });
  const result = validatePhaseAcceptsAction(state, { type: 'DEVELOP' });
  assert(!result.valid, 'develop not allowed during draw');
});

test('freeze phase accepts its own action', () => {
  const state = makeState({ phase: { game: 'PLAYING', step: 'MERGE_FREEZE_DELIVERY', activePlayer: 0 } });
  const result = validatePhaseAcceptsAction(state, { type: 'RESOLVE_DELIVERY' });
  assert(result.valid, 'delivery resolve allowed');
});

test('freeze phase rejects player actions', () => {
  const state = makeState({ phase: { game: 'PLAYING', step: 'MERGE_FREEZE_DANGER', activePlayer: 0 } });
  const result = validatePhaseAcceptsAction(state, { type: 'DEVELOP' });
  assert(!result.valid, 'develop not allowed in freeze');
});

// ═════════════════════════════════════
console.log('\n── validateActionPreconditions ──');
// ═════════════════════════════════════

test('DEVELOP: allowed with active task and effort > 0', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'DEVELOP' });
  assert(result.valid, 'can develop');
});

test('DEVELOP: rejected with no task', () => {
  const state = makeState();
  state.players[0].task = null;
  const result = validateActionPreconditions(state, { type: 'DEVELOP' });
  assert(!result.valid, 'no task');
});

test('DEVELOP: rejected with zero effort', () => {
  const state = makeState();
  state.players[0].effort = 0;
  const result = validateActionPreconditions(state, { type: 'DEVELOP' });
  assert(!result.valid, 'zero effort');
});

test('SKILL_UP: allowed for known skill below max', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'SKILL_UP', skill: 'BE' });
  assert(result.valid, 'BE at 0, can level up');
});

test('SKILL_UP: rejected at max level', () => {
  const state = makeState();
  state.players[0].skills.BE = 3;
  const result = validateActionPreconditions(state, { type: 'SKILL_UP', skill: 'BE' });
  assert(!result.valid, 'BE at max');
});

test('SKILL_UP: rejected for unknown skill', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'SKILL_UP', skill: 'HACKING' });
  assert(!result.valid, 'unknown skill');
});

test('SKILL_UP: rejected with no skill specified', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'SKILL_UP' });
  assert(!result.valid, 'no skill');
});

test('PAY_DEBT: allowed when tokens exist', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'PAY_DEBT' });
  assert(result.valid, 'board has tokens');
});

test('PAY_DEBT: rejected when board empty', () => {
  const state = makeState({ board: { bugs: 0, dissatisfaction: 0 } });
  const result = validateActionPreconditions(state, { type: 'PAY_DEBT' });
  assert(!result.valid, 'board empty');
});

test('PROPER_REVIEW: allowed with cards in pile', () => {
  const state = makeState();
  state.players[0].reviewPile = [{ id: 'T02' }];
  const result = validateActionPreconditions(state, { type: 'PROPER_REVIEW' });
  assert(result.valid, 'has cards');
});

test('PROPER_REVIEW: rejected with empty pile', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'PROPER_REVIEW' });
  assert(!result.valid, 'empty pile');
});

test('LGTM: allowed with cards in pile', () => {
  const state = makeState();
  state.players[0].reviewPile = [{ id: 'T02' }, { id: 'T03' }];
  const result = validateActionPreconditions(state, { type: 'LGTM' });
  assert(result.valid, 'has cards');
});

test('LGTM: rejected with empty pile', () => {
  const state = makeState();
  const result = validateActionPreconditions(state, { type: 'LGTM' });
  assert(!result.valid, 'empty pile');
});

// ═════════════════════════════════════
console.log('\n── composeValidators ──');
// ═════════════════════════════════════

test('stops at first failure', () => {
  const alwaysFails = () => fail('first');
  const shouldNotRun = () => { throw new Error('should not reach'); };
  const composed = composeValidators(alwaysFails, shouldNotRun);
  const result = composed({}, {});
  assert(!result.valid, 'failed');
  assert(result.error === 'first', 'first error returned');
});

test('passes when all pass', () => {
  const composed = composeValidators(() => ok(), () => ok(), () => ok());
  const result = composed({}, {});
  assert(result.valid, 'all passed');
});

// ═════════════════════════════════════
console.log('\n── validateAction (full chain) ──');
// ═════════════════════════════════════

test('valid: DEVELOP in AWAITING_ACTION with task', () => {
  const state = makeState();
  const result = validateAction(state, { type: 'DEVELOP', player: 0 });
  assert(result.valid, 'fully valid');
});

test('invalid: wrong player', () => {
  const state = makeState();
  const result = validateAction(state, { type: 'DEVELOP', player: 1 });
  assert(!result.valid, 'wrong player caught');
});

test('invalid: wrong phase', () => {
  const state = makeState({ phase: { game: 'PLAYING', step: 'DRAW_MISFORTUNE', activePlayer: 0 } });
  const result = validateAction(state, { type: 'DEVELOP', player: 0 });
  assert(!result.valid, 'wrong phase caught');
});

test('invalid: game over', () => {
  const state = makeState({ phase: { game: 'GAME_OVER', step: 'AWAITING_ACTION', activePlayer: 0 } });
  const result = validateAction(state, { type: 'DEVELOP', player: 0 });
  assert(!result.valid, 'game over caught');
});

test('invalid: SKILL_UP at max in correct phase', () => {
  const state = makeState();
  state.players[0].skills.FE = 3;
  const result = validateAction(state, { type: 'SKILL_UP', skill: 'FE', player: 0 });
  assert(!result.valid, 'precondition caught through full chain');
});

// ═════════════════════════════════════
console.log('\n── getLegalActions ──');
// ═════════════════════════════════════

test('returns all 7 actions when everything available', () => {
  const state = makeState();
  state.players[0].reviewPile = [{ id: 'T02' }];
  const legal = getLegalActions(state);
  const types = legal.map(a => a.type);
  assert(types.includes('DEVELOP'), 'develop');
  assert(types.includes('PAY_DEBT'), 'pay debt');
  assert(types.includes('PROPER_REVIEW'), 'review');
  assert(types.includes('LGTM'), 'lgtm');
  // 4 skill_ups (BE, DB, DO, FE all below max)
  const skillUps = legal.filter(a => a.type === 'SKILL_UP');
  assert(skillUps.length === 4, `4 skill ups (got ${skillUps.length})`);
});

test('excludes DEVELOP when no task', () => {
  const state = makeState();
  state.players[0].task = null;
  const legal = getLegalActions(state);
  const types = legal.map(a => a.type);
  assert(!types.includes('DEVELOP'), 'no develop');
});

test('excludes review actions when pile empty', () => {
  const state = makeState();
  const legal = getLegalActions(state);
  const types = legal.map(a => a.type);
  assert(!types.includes('PROPER_REVIEW'), 'no review');
  assert(!types.includes('LGTM'), 'no lgtm');
});

test('excludes maxed skills', () => {
  const state = makeState();
  state.players[0].skills = { BE: 3, DB: 3, DO: 3, FE: 3 };
  const legal = getLegalActions(state);
  const skillUps = legal.filter(a => a.type === 'SKILL_UP');
  assert(skillUps.length === 0, 'no skill ups available');
});

test('returns empty when not AWAITING_ACTION', () => {
  const state = makeState({ phase: { game: 'PLAYING', step: 'DRAW_MISFORTUNE', activePlayer: 0 } });
  const legal = getLegalActions(state);
  assert(legal.length === 0, 'empty during draw');
});

test('returns empty when game over', () => {
  const state = makeState({ phase: { game: 'GAME_OVER', step: 'AWAITING_ACTION', activePlayer: 0 } });
  const legal = getLegalActions(state);
  assert(legal.length === 0, 'empty when game over');
});

test('FE skill up available even though it has no misfortune', () => {
  const state = makeState();
  const legal = getLegalActions(state);
  const feUp = legal.find(a => a.type === 'SKILL_UP' && a.skill === 'FE');
  assert(feUp !== undefined, 'FE skill up is a legal action');
});

test('excludes PAY_DEBT when board empty', () => {
  const state = makeState({ board: { bugs: 0, dissatisfaction: 0 } });
  const legal = getLegalActions(state);
  const types = legal.map(a => a.type);
  assert(!types.includes('PAY_DEBT'), 'no pay debt');
});

// ═════════════════════════════════════
console.log('\n── Results ──');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
