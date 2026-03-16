import { createInitialState } from '../../src/reducer.js';
import { createGameConfig, SKILLS, TASKS, MISFORTUNE_CARDS } from '../../src/config.js';
import { createFixedDeck, createDiceSequence, createSeededRng } from '../../src/rng.js';
import {
  renderBoard,
  renderPhaseResult,
  renderActionMenu,
  renderFreezeStep,
  renderGameEnd,
} from '../../src/display.js';

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

// ── Helpers ──

function makeState(overrides = {}) {
  const base = {
    phase: { game: 'PLAYING', step: 'AWAITING_ACTION', activePlayer: 0, sprint: 1, turn: 1 },
    config: createGameConfig(),
    players: [
      { name: 'Alice', skills: { BE: 1, DB: 0, DO: 0, FE: 0 }, task: TASKS[0], effort: 2, score: 3, bugs: 0, reviewPile: [] },
      { name: 'Bob', skills: { BE: 0, DB: 1, DO: 0, FE: 0 }, task: TASKS[12], effort: 3, score: 0, bugs: 1, reviewPile: [] },
      { name: 'Carol', skills: { BE: 0, DB: 0, DO: 1, FE: 0 }, task: TASKS[18], effort: 1, score: 2, bugs: 0, reviewPile: [] },
    ],
    board: { playerBugs: [0, 1, 0], dissatisfaction: 0 },
    decks: { taskDeck: [], misfortune: [], taskTemplate: [], misfortuneTemplate: [] },
    meta: {},
  };
  return { ...base, ...overrides };
}

// ── renderBoard ──

console.log('\n── renderBoard ──');

test('includes sprint and turn info', () => {
  const s = makeState();
  const out = renderBoard(s);
  assert(out.includes('SPRINT 1'), 'should include SPRINT 1');
  assert(out.includes('TURN 1'), 'should include TURN 1');
});

test('includes all player names', () => {
  const s = makeState();
  const out = renderBoard(s);
  assert(out.includes('Alice'), 'should include Alice');
  assert(out.includes('Bob'), 'should include Bob');
  assert(out.includes('Carol'), 'should include Carol');
});

test('marks active player', () => {
  const s = makeState();
  const out = renderBoard(s);
  const lines = out.split('\n');
  const aliceLine = lines.find(l => l.includes('Alice'));
  assert(aliceLine && aliceLine.includes('>'), 'active player should have > marker');
  const bobLine = lines.find(l => l.includes('Bob'));
  assert(bobLine && !bobLine.includes('>'), 'non-active player should not have > marker');
});

test('shows player skills', () => {
  const s = makeState();
  const out = renderBoard(s);
  assert(out.includes('BE1'), 'should show BE1 for Alice');
  assert(out.includes('DB1'), 'should show DB1 for Bob');
});

test('shows player effort', () => {
  const s = makeState();
  const out = renderBoard(s);
  // Alice has effort 2
  assert(out.includes('2'), 'should show effort number');
});

test('shows player score', () => {
  const s = makeState();
  const out = renderBoard(s);
  const aliceLine = out.split('\n').find(l => l.includes('Alice'));
  assert(aliceLine && aliceLine.includes('3'), 'should show Alice score 3');
});

test('shows task name', () => {
  const s = makeState();
  const out = renderBoard(s);
  assert(out.includes('Spring Boot 3 Upgrade'), 'should show task name');
});

test('shows board summary with danger zone', () => {
  const s = makeState();
  const out = renderBoard(s);
  assert(out.includes('1 bug'), 'should show bug count');
  assert(out.includes('Safe') || out.includes('token'), 'should show danger zone or token count');
});

test('shows no task when player has none', () => {
  const s = makeState();
  s.players[0] = { ...s.players[0], task: null, effort: 0 };
  const out = renderBoard(s);
  assert(out.includes('--') || out.includes('none') || out.includes('-'), 'should indicate no task');
});

// ── renderPhaseResult ──

console.log('\n── renderPhaseResult ──');

test('shows misfortune draw', () => {
  const s = makeState({
    phase: { game: 'PLAYING', step: 'CHECK_IMMUNITY', activePlayer: 0, sprint: 1, turn: 1 },
    meta: { lastDrawn: MISFORTUNE_CARDS[0] },
  });
  const out = renderPhaseResult(s, 'DRAW_MISFORTUNE');
  assert(out.includes("Project Won't Compile"), 'should show card name');
  assert(out.includes('BE') || out.includes('Backend'), 'should show category');
});

test('shows immunity result', () => {
  const s = makeState({
    meta: { lastDrawn: MISFORTUNE_CARDS[0], immune: true },
  });
  const out = renderPhaseResult(s, 'CHECK_IMMUNITY');
  assert(out.includes('immune') || out.includes('Immune'), 'should mention immunity');
});

test('shows effect resolution', () => {
  const s = makeState({
    meta: { effectResolution: { type: 'effort_added', amount: 1 } },
  });
  const out = renderPhaseResult(s, 'RESOLVE_EFFECT');
  assert(out.includes('effort') || out.includes('Effort'), 'should describe effect');
});

test('shows skip effect', () => {
  const s = makeState({
    meta: { effectResolution: { type: 'skip' } },
  });
  const out = renderPhaseResult(s, 'RESOLVE_EFFECT');
  assert(out.includes('skip') || out.includes('Skip'), 'should mention skip');
});

test('shows QA pass', () => {
  const s = makeState({
    meta: { qaResult: { passed: true, gap: 1, roll: 4, autoPass: false } },
  });
  const out = renderPhaseResult(s, 'CHECK_COMPLETION');
  assert(out.includes('pass') || out.includes('Pass') || out.includes('PASS'), 'should show QA passed');
});

test('shows QA bounce', () => {
  const s = makeState({
    meta: { qaResult: { passed: false, gap: 1, roll: 1, autoPass: false, bounced: true } },
  });
  const out = renderPhaseResult(s, 'CHECK_COMPLETION');
  assert(out.includes('bounce') || out.includes('Bounce') || out.includes('BOUNCE'), 'should show QA bounced');
});

test('shows QA auto-pass', () => {
  const s = makeState({
    meta: { qaResult: { passed: true, gap: 0, roll: null, autoPass: true } },
  });
  const out = renderPhaseResult(s, 'CHECK_COMPLETION');
  assert(out.includes('auto') || out.includes('Auto'), 'should show auto-pass');
});

test('shows task scored', () => {
  const s = makeState({
    meta: { scored: true, scoredPoints: 5 },
  });
  const out = renderPhaseResult(s, 'SCORE_TASK');
  assert(out.includes('5'), 'should show scored points');
});

test('shows executed action', () => {
  const s = makeState({
    meta: { executedAction: { type: 'DEVELOP' } },
  });
  const out = renderPhaseResult(s, 'EXECUTE_ACTION');
  assert(out.includes('DEVELOP') || out.includes('Develop') || out.includes('develop'), 'should show action');
});

// ── renderActionMenu ──

console.log('\n── renderActionMenu ──');

test('shows numbered list', () => {
  const actions = [
    { type: 'DEVELOP', player: 0 },
    { type: 'SKILL_UP', skill: 'BE', player: 0 },
  ];
  const s = makeState();
  const out = renderActionMenu(actions, s);
  assert(out.includes('1.') || out.includes('1)'), 'should have numbered items');
  assert(out.includes('2.') || out.includes('2)'), 'should have second item');
});

test('shows DEVELOP with effort context', () => {
  const actions = [{ type: 'DEVELOP', player: 0 }];
  const s = makeState();
  const out = renderActionMenu(actions, s);
  assert(out.includes('DEVELOP'), 'should show DEVELOP');
  assert(out.includes('2') && out.includes('1'), 'should show effort change');
});

test('shows SKILL_UP with skill and level context', () => {
  const actions = [{ type: 'SKILL_UP', skill: 'BE', player: 0 }];
  const s = makeState();
  const out = renderActionMenu(actions, s);
  assert(out.includes('SKILL UP') || out.includes('SKILL_UP'), 'should show SKILL UP');
  assert(out.includes('BE'), 'should show skill name');
});

test('shows PAY_DEBT with token count', () => {
  const actions = [{ type: 'PAY_DEBT', player: 0 }];
  const s = makeState();
  const out = renderActionMenu(actions, s);
  assert(out.includes('PAY DEBT') || out.includes('PAY_DEBT'), 'should show PAY DEBT');
  assert(out.includes('1'), 'should show token count');
});

// ── renderFreezeStep ──

console.log('\n── renderFreezeStep ──');

test('shows unreviewed MRs', () => {
  const s = makeState({
    phase: { game: 'PLAYING', step: 'MERGE_FREEZE_DELIVERY', activePlayer: 0, sprint: 1, turn: 4 },
    meta: {},
  });
  // After unreviewed step, we're in delivery phase
  const out = renderFreezeStep(s, 'RESOLVE_UNREVIEWED');
  assert(out.includes('nreviewed') || out.includes('MR') || out.includes('review'), 'should mention unreviewed');
});

test('shows delivery result', () => {
  const s = makeState({
    phase: { game: 'PLAYING', step: 'MERGE_FREEZE_BONUS', activePlayer: 0, sprint: 1, turn: 4 },
    meta: { deliveryResult: { target: 2, completed: 1, deficit: 1, met: false } },
  });
  const out = renderFreezeStep(s, 'RESOLVE_DELIVERY');
  assert(out.includes('1') && out.includes('2'), 'should show delivery numbers');
});

test('shows sprint bonus', () => {
  const s = makeState({
    phase: { game: 'PLAYING', step: 'MERGE_FREEZE_DANGER', activePlayer: 0, sprint: 1, turn: 4 },
    meta: { bonusResult: { type: 'sole_zero', players: [0], bonus: 2 } },
  });
  const out = renderFreezeStep(s, 'RESOLVE_BONUS');
  assert(out.includes('Alice') || out.includes('bonus') || out.includes('Bonus'), 'should mention bonus');
  assert(out.includes('2'), 'should show bonus amount');
});

test('shows danger check survived', () => {
  const s = makeState({
    meta: { dangerResult: { zone: 'Safe', survived: true, total: 1, rollNeeded: null, roll: null } },
  });
  const out = renderFreezeStep(s, 'RESOLVE_DANGER');
  assert(out.includes('Safe') || out.includes('survived') || out.includes('Survived'), 'should show survived');
});

test('shows danger check death', () => {
  const s = makeState({
    phase: { game: 'GAME_OVER', step: 'SPRINT_COMPLETE', activePlayer: 0, sprint: 1, turn: 4 },
    meta: { dangerResult: { zone: 'Critical', survived: false, total: 12, rollNeeded: 4, roll: 4 } },
  });
  const out = renderFreezeStep(s, 'RESOLVE_DANGER');
  assert(out.includes('Critical') || out.includes('die') || out.includes('DEAD') || out.includes('dead'), 'should show death');
});

// ── renderGameEnd ──

console.log('\n── renderGameEnd ──');

test('shows game won', () => {
  const s = makeState({
    phase: { game: 'GAME_WON', step: 'SPRINT_COMPLETE', activePlayer: 0, sprint: 4, turn: 4 },
  });
  const out = renderGameEnd(s);
  assert(out.includes('WON') || out.includes('Won') || out.includes('won'), 'should show won');
});

test('shows game over', () => {
  const s = makeState({
    phase: { game: 'GAME_OVER', step: 'SPRINT_COMPLETE', activePlayer: 0, sprint: 2, turn: 4 },
  });
  const out = renderGameEnd(s);
  assert(out.includes('OVER') || out.includes('Over') || out.includes('died'), 'should show game over');
});

test('shows final scores sorted', () => {
  const s = makeState({
    phase: { game: 'GAME_WON', step: 'SPRINT_COMPLETE', activePlayer: 0, sprint: 4, turn: 4 },
  });
  // Alice=3, Bob=0, Carol=2
  const out = renderGameEnd(s);
  const aliceIdx = out.indexOf('Alice');
  const carolIdx = out.indexOf('Carol');
  const bobIdx = out.indexOf('Bob');
  assert(aliceIdx < carolIdx, 'Alice (3 SP) should be above Carol (2 SP)');
  assert(carolIdx < bobIdx, 'Carol (2 SP) should be above Bob (0 SP)');
});

test('marks winner', () => {
  const s = makeState({
    phase: { game: 'GAME_WON', step: 'SPRINT_COMPLETE', activePlayer: 0, sprint: 4, turn: 4 },
  });
  const out = renderGameEnd(s);
  const lines = out.split('\n');
  const aliceLine = lines.find(l => l.includes('Alice'));
  assert(aliceLine && (aliceLine.includes('WINNER') || aliceLine.includes('winner') || aliceLine.includes('★')), 'should mark winner');
});

// ── Results ──
console.log(`\n── Results ──`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
