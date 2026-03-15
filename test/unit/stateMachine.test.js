import { 
  TurnStateMachine, TurnPhase,
  SprintStateMachine, SprintPhase,
  GameStateMachine, GamePhase 
} from '../../src/stateMachine.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

// ═══════════════════════════════════════
console.log('\n── Turn State Machine ──');
// ═══════════════════════════════════════

test('starts at DRAW_MISFORTUNE', () => {
  const t = new TurnStateMachine(0);
  assert(t.phase === TurnPhase.DRAW_MISFORTUNE, 'initial phase');
});

test('happy path: draw → immune → action → execute → check → end', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW → CHECK_IMMUNITY
  assert(t.phase === TurnPhase.CHECK_IMMUNITY, 'at immunity check');
  
  t.transition({ immune: true });            // immune → AWAITING_ACTION
  assert(t.phase === TurnPhase.AWAITING_ACTION, 'immune skips to action');
  
  t.transition({});                          // AWAITING → EXECUTE
  assert(t.phase === TurnPhase.EXECUTE_ACTION, 'executing action');
  
  t.transition({});                          // EXECUTE → CHECK_COMPLETION
  assert(t.phase === TurnPhase.CHECK_COMPLETION, 'checking completion');
  
  t.transition({ completed: false });        // not complete → END
  assert(t.phase === TurnPhase.END_TURN, 'turn ends');
  assert(t.isTerminal(), 'is terminal');
});

test('hit path: draw → not immune → resolve → check → action → end', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW → CHECK_IMMUNITY
  t.transition({ immune: false });           // not immune → RESOLVE_EFFECT
  assert(t.phase === TurnPhase.RESOLVE_EFFECT, 'resolving effect');
  
  t.transition({ skipped: false });          // resolve → CHECK_COMPLETION
  assert(t.phase === TurnPhase.CHECK_COMPLETION, 'checking after effect');
  
  t.transition({ completed: false });        // not complete → AWAITING_ACTION
  assert(t.phase === TurnPhase.AWAITING_ACTION, 'awaiting action');
  
  t.transition({});                          // action → execute
  t.transition({});                          // execute → check
  t.transition({ completed: false });        // → END
  assert(t.isTerminal(), 'turn ends after action');
});

test('skipped: no action allowed', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW → CHECK_IMMUNITY
  t.transition({ immune: false });           // → RESOLVE
  t.transition({ skipped: true });           // → CHECK_COMPLETION (skipped flagged)
  assert(t.phase === TurnPhase.CHECK_COMPLETION, 'check after skip');
  
  t.transition({ completed: false });        // skipped → END (not AWAITING)
  assert(t.phase === TurnPhase.END_TURN, 'skipped goes to end');
});

test('effect completes task: score → still get action', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW
  t.transition({ immune: false });           // → RESOLVE
  t.transition({ skipped: false });          // → CHECK_COMPLETION
  
  t.transition({ completed: true });         // → SCORE_TASK
  assert(t.phase === TurnPhase.SCORE_TASK, 'scoring from effect');
  
  t.transition({});                          // SCORE → AWAITING (from effect, not skipped)
  assert(t.phase === TurnPhase.AWAITING_ACTION, 'still get action after effect completion');
});

test('action completes task: score → end turn', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW
  t.transition({ immune: true });            // → AWAITING
  t.transition({});                          // → EXECUTE
  t.transition({});                          // → CHECK_COMPLETION
  
  t.transition({ completed: true });         // → SCORE
  assert(t.phase === TurnPhase.SCORE_TASK, 'scoring from action');
  
  t.transition({});                          // SCORE → END (from action)
  assert(t.phase === TurnPhase.END_TURN, 'end after action completion');
});

test('QA bounce: not completed, not terminal', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW
  t.transition({ immune: true });            // → AWAITING
  t.transition({});                          // → EXECUTE (develop)
  t.transition({});                          // → CHECK_COMPLETION
  
  t.transition({ bounced: true });           // → END_TURN (bounced, no extra action)
  assert(t.phase === TurnPhase.END_TURN, 'bounce ends turn');
});

test('two actions from lucky break', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW
  t.transition({ immune: false });           // → RESOLVE
  t.transition({ skipped: false, extraActions: 1 }); // TWO ACTIONS
  assert(t.actionsRemaining === 2, 'two actions queued');
  
  t.transition({ completed: false });        // CHECK → AWAITING
  
  t.transition({});                          // AWAITING → EXECUTE (actions: 2→1)
  t.transition({});                          // EXECUTE → CHECK
  t.transition({ completed: false });        // CHECK → AWAITING (1 remaining)
  assert(t.phase === TurnPhase.AWAITING_ACTION, 'second action available');
  
  t.transition({});                          // AWAITING → EXECUTE (1→0)
  t.transition({});                          // EXECUTE → CHECK
  t.transition({ completed: false });        // CHECK → END (0 remaining)
  
  // Need to go through AWAITING which sees 0 remaining
  assert(t.phase === TurnPhase.END_TURN, 'end after both actions');
});

test('instant complete from effect (AI Assistant)', () => {
  const t = new TurnStateMachine(0);
  
  t.transition({});                          // DRAW
  t.transition({ immune: false });           // → RESOLVE
  t.transition({ instantComplete: true });   // → SCORE directly
  assert(t.phase === TurnPhase.SCORE_TASK, 'instant complete goes to score');
  
  t.transition({});                          // SCORE → AWAITING (effect, not skipped)
  assert(t.phase === TurnPhase.AWAITING_ACTION, 'action after instant complete');
});

// ═══════════════════════════════════════
console.log('\n── Sprint State Machine ──');
// ═══════════════════════════════════════

function quickTurn(sprint, input = {}) {
  // Run through a complete turn with all defaults
  sprint.transitionTurn({});                 // DRAW
  sprint.transitionTurn({ immune: true });   // → AWAITING
  sprint.transitionTurn({});                 // → EXECUTE
  sprint.transitionTurn({});                 // → CHECK
  sprint.transitionTurn({ completed: false }); // → END → next player
}

test('sprint starts at turn 1 player 0', () => {
  const s = new SprintStateMachine(1, 2);
  assert(s.currentTurn === 1, 'turn 1');
  assert(s.currentPlayerIndex === 0, 'player 0');
  assert(s.phase === SprintPhase.PLAYING, 'playing');
});

test('advances through players then turns', () => {
  const s = new SprintStateMachine(1, 2); // 2 players
  
  quickTurn(s); // P0 T1
  assert(s.currentPlayerIndex === 1, 'moved to P1');
  assert(s.currentTurn === 1, 'still T1');
  
  quickTurn(s); // P1 T1
  assert(s.currentPlayerIndex === 0, 'back to P0');
  assert(s.currentTurn === 2, 'advanced to T2');
});

test('enters freeze after turn 4 completes', () => {
  const s = new SprintStateMachine(1, 2); // 2 players, 4 turns
  
  // 4 turns × 2 players = 8 quick turns
  for (let i = 0; i < 8; i++) quickTurn(s);
  
  assert(s.phase === SprintPhase.MERGE_FREEZE_UNREVIEWED, 'entered freeze');
  assert(s.isInFreeze(), 'isInFreeze');
});

test('freeze transitions in order', () => {
  const s = new SprintStateMachine(1, 2);
  for (let i = 0; i < 8; i++) quickTurn(s);
  
  s.transitionFreeze({});                    // UNREVIEWED → DELIVERY
  assert(s.phase === SprintPhase.MERGE_FREEZE_DELIVERY, 'delivery check');
  
  s.transitionFreeze({});                    // DELIVERY → BONUS
  assert(s.phase === SprintPhase.MERGE_FREEZE_BONUS, 'bonus');
  
  s.transitionFreeze({});                    // BONUS → DANGER
  assert(s.phase === SprintPhase.MERGE_FREEZE_DANGER, 'danger check');
  
  s.transitionFreeze({ survived: true });    // DANGER → COMPLETE
  assert(s.isComplete(), 'sprint complete');
});

test('freeze death', () => {
  const s = new SprintStateMachine(1, 2);
  for (let i = 0; i < 8; i++) quickTurn(s);
  
  s.transitionFreeze({});                    // → DELIVERY
  s.transitionFreeze({});                    // → BONUS
  s.transitionFreeze({});                    // → DANGER
  
  const result = s.transitionFreeze({ survived: false });
  assert(result.died === true, 'died flag set');
  assert(s.isComplete(), 'sprint complete even on death');
});

// ═══════════════════════════════════════
console.log('\n── Game State Machine ──');
// ═══════════════════════════════════════

function quickSprint(game) {
  // Run all turns
  const playerCount = game.playerCount;
  for (let i = 0; i < 4 * playerCount; i++) {
    game.transition({});                     // DRAW
    game.transition({ immune: true });       // → AWAITING
    game.transition({});                     // → EXECUTE
    game.transition({});                     // → CHECK
    game.transition({ completed: false });   // → END
  }
  // Run freeze
  game.transition({});                       // UNREVIEWED → DELIVERY
  game.transition({});                       // DELIVERY → BONUS
  game.transition({});                       // BONUS → DANGER
  game.transition({ survived: true });       // DANGER → COMPLETE → next sprint
}

test('game starts in SETUP', () => {
  const g = new GameStateMachine(2);
  assert(g.phase === GamePhase.SETUP, 'setup');
});

test('game start transitions to PLAYING', () => {
  const g = new GameStateMachine(2);
  g.start();
  assert(g.phase === GamePhase.PLAYING, 'playing');
  assert(g.currentSprint === 1, 'sprint 1');
});

test('surviving 4 sprints wins', () => {
  const g = new GameStateMachine(2, 4);
  g.start();
  
  quickSprint(g); // Sprint 1
  assert(g.currentSprint === 2, 'advanced to sprint 2');
  
  quickSprint(g); // Sprint 2
  quickSprint(g); // Sprint 3
  quickSprint(g); // Sprint 4
  
  assert(g.phase === GamePhase.GAME_WON, 'game won');
  assert(g.isGameOver(), 'is game over');
});

test('dying in freeze ends game', () => {
  const g = new GameStateMachine(2, 4);
  g.start();
  
  // Run all turns for sprint 1
  for (let i = 0; i < 8; i++) {
    g.transition({});
    g.transition({ immune: true });
    g.transition({});
    g.transition({});
    g.transition({ completed: false });
  }
  
  g.transition({}); // UNREVIEWED
  g.transition({}); // DELIVERY
  g.transition({}); // BONUS
  const result = g.transition({ survived: false }); // DANGER → DEAD
  
  assert(g.phase === GamePhase.GAME_OVER, 'game over');
  assert(result.died === true, 'died');
});

test('cannot transition after game over', () => {
  const g = new GameStateMachine(2, 4);
  g.start();
  
  // Kill in sprint 1
  for (let i = 0; i < 8; i++) {
    g.transition({});
    g.transition({ immune: true });
    g.transition({});
    g.transition({});
    g.transition({ completed: false });
  }
  g.transition({});
  g.transition({});
  g.transition({});
  g.transition({ survived: false });
  
  let threw = false;
  try {
    g.transition({});
  } catch (e) {
    threw = true;
  }
  assert(threw, 'throws on transition after game over');
});

test('5 player game runs correct number of turns', () => {
  const g = new GameStateMachine(5, 4);
  g.start();
  
  let turnCount = 0;
  
  for (let sprint = 0; sprint < 4; sprint++) {
    for (let i = 0; i < 20; i++) { // 5 players × 4 turns
      g.transition({});
      g.transition({ immune: true });
      g.transition({});
      g.transition({});
      g.transition({ completed: false });
      turnCount++;
    }
    g.transition({}); // freeze steps
    g.transition({});
    g.transition({});
    g.transition({ survived: true });
  }
  
  assert(turnCount === 80, `80 player-turns (got ${turnCount})`);
  assert(g.phase === GamePhase.GAME_WON, '5p game won');
});

test('awaiting input only during AWAITING_ACTION', () => {
  const g = new GameStateMachine(2, 4);
  g.start();
  
  assert(!g.isAwaitingInput(), 'not awaiting at draw');
  
  g.transition({});                          // DRAW
  assert(!g.isAwaitingInput(), 'not awaiting at immunity');
  
  g.transition({ immune: true });            // → AWAITING
  assert(g.isAwaitingInput(), 'NOW awaiting input');
});

// ═══════════════════════════════════════
console.log('\n── Results ──');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
