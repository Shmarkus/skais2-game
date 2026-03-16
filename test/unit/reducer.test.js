import { createInitialState, reduce, reduceUntilInput } from '../../src/reducer.js';
import { createGameConfig, TASKS, MISFORTUNE_CARDS } from '../../src/config.js';
import { TurnPhase, SprintPhase, GamePhase } from '../../src/stateMachine.js';
import { createSequenceRng, createSeededRng, createDiceSequence, createFixedDeck } from '../../src/rng.js';
import { addBug, addDissatisfaction } from '../../src/modules/board.js';
import { getLegalActions } from '../../src/validator.js';

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

// ── Helpers ──

function makeState(overrides = {}) {
  const config = createGameConfig();
  const task = TASKS[0]; // T01: BE, effort 2, SP 3
  const state = createInitialState(
    ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'],
    {},
    createSeededRng(42),
  );
  return { ...state, ...overrides };
}

// Builds a minimal mid-game state for targeted testing
function makeMidGameState(phaseStep, playerOverrides = {}, boardOverrides = {}) {
  const config = createGameConfig();
  const players = Array.from({ length: 5 }, (_, i) => ({
    name: `P${i}`,
    skills: { BE: 0, DB: 0, DO: 0, FE: 0 },
    task: TASKS[0],
    effort: 3,
    score: 0,
    bugs: 0,
    reviewPile: [],
    ...((i === 0) ? playerOverrides : {}),
  }));

  // We need a live GSM for the reducer to work
  const state = createInitialState(
    ['P0', 'P1', 'P2', 'P3', 'P4'],
    {},
    createSequenceRng(Array.from({ length: 200 }, (_, i) => (i % 10) / 10)),
  );

  // Override what we need
  return {
    ...state,
    players,
    board: { playerBugs: [0, 0, 0, 0, 0], dissatisfaction: 0, ...boardOverrides },
  };
}

// ═════════════════════════════════════
console.log('\n── createInitialState ──');
// ═════════════════════════════════════

test('creates state with correct player count', () => {
  const s = makeState();
  assert(s.players.length === 5, `expected 5 players, got ${s.players.length}`);
});

test('initial phase is DRAW_MISFORTUNE', () => {
  const s = makeState();
  assert(s.phase.step === TurnPhase.DRAW_MISFORTUNE, `expected DRAW_MISFORTUNE, got ${s.phase.step}`);
});

test('initial game phase is PLAYING', () => {
  const s = makeState();
  assert(s.phase.game === GamePhase.PLAYING, `expected PLAYING, got ${s.phase.game}`);
});

test('players start with tasks dealt', () => {
  const s = makeState();
  for (let i = 0; i < 5; i++) {
    assert(s.players[i].task !== null, `player ${i} should have a task`);
    assert(s.players[i].effort > 0, `player ${i} should have effort > 0`);
  }
});

test('active player is 0', () => {
  const s = makeState();
  assert(s.phase.activePlayer === 0, `expected 0, got ${s.phase.activePlayer}`);
});

// ═════════════════════════════════════
console.log('\n── reduce: DRAW_MISFORTUNE ──');
// ═════════════════════════════════════

test('draws a card and advances to CHECK_IMMUNITY', () => {
  const s = makeState();
  const s2 = reduce(s, { type: 'DRAW_MISFORTUNE' });
  assert(s2.phase.step === TurnPhase.CHECK_IMMUNITY, `expected CHECK_IMMUNITY, got ${s2.phase.step}`);
  assert(s2.meta.lastDrawn !== null, 'should have drawn a card');
});

// ═════════════════════════════════════
console.log('\n── reduce: validation ──');
// ═════════════════════════════════════

test('rejects invalid action type for phase', () => {
  const s = makeState();
  const s2 = reduce(s, { type: 'DEVELOP', player: 0 });
  assert(s2.meta.rejected === true, 'should be rejected');
});

test('rejects wrong player', () => {
  const s = makeState();
  // Advance to AWAITING_ACTION first is complex, so just verify rejection
  const s2 = reduce(s, { type: 'DEVELOP', player: 1 });
  assert(s2.meta.rejected === true, 'should reject wrong player');
});

// ═════════════════════════════════════
console.log('\n── reduce: CHECK_IMMUNITY ──');
// ═════════════════════════════════════

test('immune player skips to AWAITING_ACTION', () => {
  let s = makeState();
  // Give player 0 BE level 1 for immunity
  s.players = [...s.players];
  s.players[0] = { ...s.players[0], skills: { ...s.players[0].skills, BE: 1 } };

  // Draw a BE misfortune card
  s = reduce(s, { type: 'DRAW_MISFORTUNE' });
  // Force the drawn card to be a BE card for testing
  s = { ...s, meta: { ...s.meta, lastDrawn: MISFORTUNE_CARDS[0] } }; // M01: BE MINOR

  s = reduce(s, { type: 'CHECK_IMMUNITY' });
  assert(s.meta.immune === true, 'player should be immune');
  assert(s.phase.step === TurnPhase.AWAITING_ACTION, `expected AWAITING_ACTION, got ${s.phase.step}`);
});

// ═════════════════════════════════════
console.log('\n── reduce: SCORE_TASK ──');
// ═════════════════════════════════════

test('scoring awards story points and clears task', () => {
  let s = makeState();
  const task = s.players[0].task;
  const sp = task.storyPoints;

  // Manually set up state for scoring
  // Move through phases: DRAW → CHECK_IMMUNITY → (immune) → AWAITING
  s.players = [...s.players];
  s.players[0] = { ...s.players[0], effort: 0, score: 0 };

  // We need the phase to be SCORE_TASK
  // Use the GSM to advance properly
  s = reduce(s, { type: 'DRAW_MISFORTUNE' });
  s = { ...s, meta: { ...s.meta, lastDrawn: null } }; // no card drawn
  s = reduce(s, { type: 'CHECK_IMMUNITY' });
  // Now at AWAITING_ACTION (immune because no card)
  assert(s.phase.step === TurnPhase.AWAITING_ACTION, `before develop: ${s.phase.step}`);
});

// ═════════════════════════════════════
console.log('\n── reduce: LGTM dice rolling ──');
// ═════════════════════════════════════

// Helper: advance state to AWAITING_ACTION for player 0
function advanceToAwaitingAction(s) {
  let safety = 100;
  while (safety-- > 0 && s.phase.game === 'PLAYING') {
    if (s.phase.step === 'AWAITING_ACTION' && s.phase.activePlayer === 0) return s;
    if (s.phase.step === 'AWAITING_ACTION') {
      s = reduce(s, { type: 'DEVELOP', player: s.phase.activePlayer });
    }
    const auto = { DRAW_MISFORTUNE: 'DRAW_MISFORTUNE', CHECK_IMMUNITY: 'CHECK_IMMUNITY',
      RESOLVE_EFFECT: 'RESOLVE_EFFECT', CHECK_COMPLETION: 'CHECK_COMPLETION',
      EXECUTE_ACTION: 'EXECUTE_ACTION', SCORE_TASK: 'SCORE_TASK', END_TURN: 'END_TURN' };
    const t = auto[s.phase.step];
    if (!t) break;
    s = reduce(s, { type: t, diceRoll: 6 });
    if (s.meta.rejected) break;
  }
  return s;
}

// Helper: advance to SCORE_TASK for player 0 (draw → immune → instant complete path)
function advanceToScoreTask(s) {
  // Draw misfortune
  s = reduce(s, { type: 'DRAW_MISFORTUNE' });
  // Force the drawn card to instant_complete (M31)
  s = { ...s, meta: { ...s.meta, lastDrawn: { ...MISFORTUNE_CARDS[30], effectType: 'instant_complete' } } };
  s = reduce(s, { type: 'CHECK_IMMUNITY' });
  // Now at RESOLVE_EFFECT (lucky cards aren't immune)
  s = reduce(s, { type: 'RESOLVE_EFFECT' });
  // Should be at SCORE_TASK
  return s;
}

test('LGTM rolls dice per card: 1-2 = bug, 3-6 = no bug', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  assert(s.phase.step === 'AWAITING_ACTION', `setup: expected AWAITING_ACTION, got ${s.phase.step}`);

  // Give player 0 review cards
  const players = [...s.players];
  players[0] = { ...players[0], reviewPile: [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }] };
  s = { ...s, players };

  // Choose LGTM → EXECUTE_ACTION
  s = reduce(s, { type: 'LGTM', player: 0 });
  assert(s.phase.step === 'EXECUTE_ACTION', `should be EXECUTE_ACTION, got ${s.phase.step}`);

  // Execute with dice: roll 1 (bug), roll 3 (no bug), roll 2 (bug) → 2 bugs
  const bugsBefore = s.board.playerBugs[0];
  s = reduce(s, { type: 'EXECUTE_ACTION', lgtmRolls: [1, 3, 2] });

  assert(s.players[0].reviewPile.length === 0, 'review pile should be empty');
  assert(s.board.playerBugs[0] === bugsBefore + 2, `expected ${bugsBefore + 2} bugs, got ${s.board.playerBugs[0]}`);
});

test('LGTM with all rolls > 2 adds no bugs', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  const players = [...s.players];
  players[0] = { ...players[0], reviewPile: [{ id: 'R1' }, { id: 'R2' }] };
  s = { ...s, players };

  s = reduce(s, { type: 'LGTM', player: 0 });
  const bugsBefore = s.board.playerBugs[0];
  s = reduce(s, { type: 'EXECUTE_ACTION', lgtmRolls: [3, 6] });
  assert(s.board.playerBugs[0] === bugsBefore, `expected ${bugsBefore} bugs, got ${s.board.playerBugs[0]}`);
});

test('LGTM with all rolls <= 2 adds bug per card', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  const players = [...s.players];
  players[0] = { ...players[0], reviewPile: [{ id: 'R1' }, { id: 'R2' }] };
  s = { ...s, players };

  s = reduce(s, { type: 'LGTM', player: 0 });
  const bugsBefore = s.board.playerBugs[0];
  s = reduce(s, { type: 'EXECUTE_ACTION', lgtmRolls: [1, 2] });
  assert(s.board.playerBugs[0] === bugsBefore + 2, `expected ${bugsBefore + 2} bugs, got ${s.board.playerBugs[0]}`);
});

// ═════════════════════════════════════
console.log('\n── reduce: sprint task counter ──');
// ═════════════════════════════════════

test('scoring a task increments sprintCompletedTasks', () => {
  let s = makeState();
  s = advanceToScoreTask(s);
  assert(s.phase.step === 'SCORE_TASK', `setup: expected SCORE_TASK, got ${s.phase.step}`);
  const before = s.meta.sprintCompletedTasks || 0;
  s = reduce(s, { type: 'SCORE_TASK' });
  assert(s.meta.sprintCompletedTasks === before + 1, `expected ${before + 1}, got ${s.meta.sprintCompletedTasks}`);
});

// ═════════════════════════════════════
console.log('\n── reduce: AI Assistant (M31) dice roll ──');
// ═════════════════════════════════════

test('instant_complete with roll 1-4 adds bug', () => {
  let s = makeState();
  s = advanceToScoreTask(s);
  assert(s.phase.step === 'SCORE_TASK', `setup: expected SCORE_TASK, got ${s.phase.step}`);
  const bugsBefore = s.board.playerBugs[0];
  s = reduce(s, { type: 'SCORE_TASK', diceRoll: 3 });
  assert(s.board.playerBugs[0] === bugsBefore + 1, `expected ${bugsBefore + 1} bug, got ${s.board.playerBugs[0]}`);
});

test('instant_complete with roll 5-6 adds no bug', () => {
  let s = makeState();
  s = advanceToScoreTask(s);
  assert(s.phase.step === 'SCORE_TASK', `setup: expected SCORE_TASK, got ${s.phase.step}`);
  const bugsBefore = s.board.playerBugs[0];
  s = reduce(s, { type: 'SCORE_TASK', diceRoll: 5 });
  assert(s.board.playerBugs[0] === bugsBefore, `expected ${bugsBefore} bugs, got ${s.board.playerBugs[0]}`);
});

// ═════════════════════════════════════
console.log('\n── reduce: leader mechanic ──');
// ═════════════════════════════════════

test('scored task card goes to leader review pile', () => {
  let s = makeState();
  // Give player 1 highest SP so they're the leader
  const players = [...s.players];
  players[1] = { ...players[1], score: 10 };
  s = { ...s, players };

  // Advance to SCORE_TASK for player 0
  s = advanceToScoreTask(s);
  assert(s.phase.step === 'SCORE_TASK', `setup: expected SCORE_TASK, got ${s.phase.step}`);

  const task = s.players[0].task;
  const leaderPileBefore = s.players[1].reviewPile.length;
  s = reduce(s, { type: 'SCORE_TASK', diceRoll: 6 });

  // Task card should be in player 1's (leader) review pile
  assert(s.players[1].reviewPile.length === leaderPileBefore + 1,
    `leader pile should grow by 1, got ${s.players[1].reviewPile.length}`);
  assert(s.players[1].reviewPile[s.players[1].reviewPile.length - 1].id === task.id,
    'last card in leader pile should be the scored task');
});

test('leader receives own task card when they score', () => {
  let s = makeState();
  // Player 0 is the leader (give highest SP)
  const players = [...s.players];
  players[0] = { ...players[0], score: 20 };
  s = { ...s, players };

  s = advanceToScoreTask(s);
  const task = s.players[0].task;
  const pileBefore = s.players[0].reviewPile.length;
  s = reduce(s, { type: 'SCORE_TASK', diceRoll: 6 });

  // Task card should be in player 0's own review pile (they're the leader)
  assert(s.players[0].reviewPile.length === pileBefore + 1,
    `own pile should grow by 1, got ${s.players[0].reviewPile.length}`);
});

test('leader is determined by highest SP with lowest index tiebreak', () => {
  let s = makeState();
  // Players 1 and 2 tied at 20 SP — player 1 (lower index) is leader
  // Player 0 scoring ~5 SP won't overtake them
  const players = [...s.players];
  players[1] = { ...players[1], score: 20 };
  players[2] = { ...players[2], score: 20 };
  s = { ...s, players };

  s = advanceToScoreTask(s);
  const pileBefore1 = s.players[1].reviewPile.length;
  const pileBefore2 = s.players[2].reviewPile.length;
  s = reduce(s, { type: 'SCORE_TASK', diceRoll: 6 });

  assert(s.players[1].reviewPile.length === pileBefore1 + 1,
    `player 1 (leader by tiebreak) should get the card`);
  assert(s.players[2].reviewPile.length === pileBefore2,
    `player 2 should not get the card`);
});

// ═════════════════════════════════════
console.log('\n── skill token pool ──');
// ═════════════════════════════════════

test('initial state has token pool with correct counts', () => {
  const s = makeState(); // 5 players → floor(5 * 1.5) = 7 per tier
  assert(s.tokenPool !== undefined, 'tokenPool should exist');
  assert(s.tokenPool.tier1 === 7, `tier1 should be 7, got ${s.tokenPool.tier1}`);
  assert(s.tokenPool.tier2 === 7, `tier2 should be 7, got ${s.tokenPool.tier2}`);
  assert(s.tokenPool.tier3 === 7, `tier3 should be 7, got ${s.tokenPool.tier3}`);
});

test('SKILL_UP with tier 1 available: instant level up, pool decremented', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  const poolBefore = s.tokenPool.tier1;

  s = reduce(s, { type: 'SKILL_UP', skill: 'BE', player: 0 });
  // After SKILL_UP → EXECUTE_ACTION auto
  if (s.phase.step === 'EXECUTE_ACTION') {
    s = reduce(s, { type: 'EXECUTE_ACTION' });
  }

  assert(s.players[0].skills.BE === 1, `BE should be 1, got ${s.players[0].skills.BE}`);
  assert(s.tokenPool.tier1 === poolBefore - 1, `tier1 should decrease by 1`);
  assert(!s.players[0].skillUpProgress, 'no active redemption after instant');
});

test('SKILL_UP with no tier 1: starts tier 2 redemption', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  // Exhaust tier 1
  s = { ...s, tokenPool: { ...s.tokenPool, tier1: 0 } };

  s = reduce(s, { type: 'SKILL_UP', player: 0 });
  if (s.phase.step === 'EXECUTE_ACTION') {
    s = reduce(s, { type: 'EXECUTE_ACTION' });
  }

  assert(s.players[0].skillUpProgress !== null, 'should have active redemption');
  assert(s.players[0].skillUpProgress.tier === 2, `tier should be 2, got ${s.players[0].skillUpProgress.tier}`);
  assert(s.players[0].skillUpProgress.progress === 1, `progress should be 1`);
  assert(s.tokenPool.tier2 < 7, 'tier2 pool should decrease');
});

test('mid-redemption (non-final step): only SKILL_UP continue is legal', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  // Set player mid-redemption on tier 3, step 1 of 3 (2 more to go)
  const players = [...s.players];
  players[0] = { ...players[0], skillUpProgress: { tier: 3, progress: 1 } };
  s = { ...s, players };

  const legal = getLegalActions(s);
  assert(legal.length === 1, `should have 1 legal action, got ${legal.length}`);
  assert(legal[0].type === 'SKILL_UP', `should be SKILL_UP, got ${legal[0].type}`);
  assert(!legal[0].skill, 'should not have skill choice (not final step)');
});

test('mid-redemption (final step): shows skill variants', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  // Set player on tier 2, step 1 of 2 (final step next)
  const players = [...s.players];
  players[0] = { ...players[0], skillUpProgress: { tier: 2, progress: 1 } };
  s = { ...s, players };

  const legal = getLegalActions(s);
  assert(legal.length === 4, `should have 4 skill variants, got ${legal.length}`);
  assert(legal.every(a => a.type === 'SKILL_UP'), 'all should be SKILL_UP');
  assert(legal.every(a => !!a.skill), 'all should have skill choice');
});

test('tier 2 completes after 2 SKILL_UP actions, skill chosen on last', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  s = { ...s, tokenPool: { ...s.tokenPool, tier1: 0 } };

  // First SKILL_UP — starts tier 2 redemption (no skill choice)
  s = reduce(s, { type: 'SKILL_UP', player: 0 });
  if (s.phase.step === 'EXECUTE_ACTION') s = reduce(s, { type: 'EXECUTE_ACTION' });
  assert(s.players[0].skillUpProgress.progress === 1, 'progress should be 1');

  // Advance to next AWAITING_ACTION for player 0
  s = advanceToAwaitingAction(s);
  // Should still have progress
  assert(s.players[0].skillUpProgress !== null, 'should still have redemption');

  // Second SKILL_UP — completes, choose BE
  s = reduce(s, { type: 'SKILL_UP', skill: 'BE', player: 0 });
  if (s.phase.step === 'EXECUTE_ACTION') s = reduce(s, { type: 'EXECUTE_ACTION' });

  assert(s.players[0].skills.BE === 1, `BE should be 1, got ${s.players[0].skills.BE}`);
  assert(s.players[0].skillUpProgress === null, 'redemption should be cleared');
});

test('tier 3 requires 3 actions', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  // Exhaust tier 1 and tier 2
  s = { ...s, tokenPool: { tier1: 0, tier2: 0, tier3: 7 } };

  // Action 1
  s = reduce(s, { type: 'SKILL_UP', player: 0 });
  if (s.phase.step === 'EXECUTE_ACTION') s = reduce(s, { type: 'EXECUTE_ACTION' });
  assert(s.players[0].skillUpProgress.progress === 1, 'progress 1');
  assert(s.players[0].skillUpProgress.tier === 3, 'tier 3');

  // Action 2
  s = advanceToAwaitingAction(s);
  s = reduce(s, { type: 'SKILL_UP', player: 0 });
  if (s.phase.step === 'EXECUTE_ACTION') s = reduce(s, { type: 'EXECUTE_ACTION' });
  assert(s.players[0].skillUpProgress.progress === 2, 'progress 2');

  // Action 3 — completes
  s = advanceToAwaitingAction(s);
  s = reduce(s, { type: 'SKILL_UP', skill: 'DB', player: 0 });
  if (s.phase.step === 'EXECUTE_ACTION') s = reduce(s, { type: 'EXECUTE_ACTION' });
  assert(s.players[0].skills.DB === 1, `DB should be 1, got ${s.players[0].skills.DB}`);
  assert(s.players[0].skillUpProgress === null, 'redemption cleared');
});

test('empty pool prevents SKILL_UP', () => {
  let s = makeState();
  s = advanceToAwaitingAction(s);
  s = { ...s, tokenPool: { tier1: 0, tier2: 0, tier3: 0 } };

  const legal = getLegalActions(s);
  const hasSkillUp = legal.some(a => a.type === 'SKILL_UP');
  assert(!hasSkillUp, 'SKILL_UP should not be legal with empty pool');
});

// ═════════════════════════════════════
console.log('\n── Results ──');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
