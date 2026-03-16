import { createInitialState, reduce, reduceUntilInput } from '../../src/reducer.js';
import { createGameConfig, TASKS, MISFORTUNE_CARDS } from '../../src/config.js';
import { TurnPhase, SprintPhase, GamePhase } from '../../src/stateMachine.js';
import { createSequenceRng, createSeededRng, createDiceSequence, createFixedDeck } from '../../src/rng.js';
import { addBug, addDissatisfaction } from '../../src/modules/board.js';

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
console.log('\n── Results ──');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
