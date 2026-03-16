#!/usr/bin/env node
// ── SKAIS2 CLI ──
// Usage: node src/cli.js <name1> <name2> [...] [--seed N] [--fast-forward]

import { createInitialState, reduce } from './reducer.js';
import { getLegalActions } from './validator.js';
import { renderBoard, renderPhaseResult, renderActionMenu, renderFreezeStep, renderGameEnd } from './display.js';
import { initIO, prompt, print, closeIO } from './cli-io.js';
import { createSeededRng } from './rng.js';

// ── Arg Parsing ──

function parseArgs(argv) {
  const args = argv.slice(2);
  const names = [];
  let seed = null;
  let fastForward = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed') {
      seed = parseInt(args[++i], 10);
      if (isNaN(seed)) {
        return { error: '--seed requires a number' };
      }
    } else if (args[i] === '--fast-forward') {
      fastForward = true;
    } else if (args[i].startsWith('--')) {
      return { error: `Unknown flag: ${args[i]}` };
    } else {
      names.push(args[i]);
    }
  }

  if (names.length < 2 || names.length > 10) {
    return { error: `Need 2-10 player names, got ${names.length}` };
  }

  return { names, seed, fastForward };
}

export { parseArgs };

// ── Auto-action mapping ──

const AUTO_ACTIONS = {
  'DRAW_MISFORTUNE': 'DRAW_MISFORTUNE',
  'CHECK_IMMUNITY': 'CHECK_IMMUNITY',
  'RESOLVE_EFFECT': 'RESOLVE_EFFECT',
  'CHECK_COMPLETION': 'CHECK_COMPLETION',
  'EXECUTE_ACTION': 'EXECUTE_ACTION',
  'SCORE_TASK': 'SCORE_TASK',
  'END_TURN': 'END_TURN',
  'MERGE_FREEZE_UNREVIEWED': 'RESOLVE_UNREVIEWED',
  'MERGE_FREEZE_DELIVERY': 'RESOLVE_DELIVERY',
  'MERGE_FREEZE_BONUS': 'RESOLVE_BONUS',
  'MERGE_FREEZE_DANGER': 'RESOLVE_DANGER',
};

const FREEZE_PHASES = new Set([
  'MERGE_FREEZE_UNREVIEWED', 'MERGE_FREEZE_DELIVERY',
  'MERGE_FREEZE_BONUS', 'MERGE_FREEZE_DANGER',
]);

// ── Game Loop ──

async function gameLoop(state, rng, fastForward) {
  let s = state;

  while (true) {
    const { game, step } = s.phase;

    // Game ended
    if (game === 'GAME_WON' || game === 'GAME_OVER') {
      print(renderGameEnd(s));
      break;
    }

    // Player action needed
    if (step === 'AWAITING_ACTION') {
      print(renderBoard(s));
      const actions = getLegalActions(s);

      if (actions.length === 0) {
        // No legal actions — end turn
        s = reduce(s, { type: 'END_TURN' });
        continue;
      }

      print(renderActionMenu(actions, s));
      const input = await prompt('');
      const idx = parseInt(input, 10) - 1;

      if (isNaN(idx) || idx < 0 || idx >= actions.length) {
        print(`  Invalid choice. Enter 1-${actions.length}.`);
        continue;
      }

      const action = actions[idx];
      s = reduce(s, action);
      continue;
    }

    // Freeze phase
    if (FREEZE_PHASES.has(step)) {
      const actionType = AUTO_ACTIONS[step];
      const actionCtx = step === 'MERGE_FREEZE_DANGER'
        ? { type: actionType, diceRoll: Math.ceil(rng() * 6) }
        : { type: actionType };

      s = reduce(s, actionCtx);
      print(renderFreezeStep(s, actionType));

      if (!fastForward) {
        await prompt('  [Enter to continue]');
      }
      continue;
    }

    // Auto-action phases
    const actionType = AUTO_ACTIONS[step];
    if (!actionType) {
      print(`  Unknown phase: ${step}`);
      break;
    }

    // Build action context
    const actionCtx = { type: actionType };

    // Provide dice for CHECK_COMPLETION (QA check)
    if (step === 'CHECK_COMPLETION') {
      actionCtx.diceRoll = Math.ceil(rng() * 6);
    }

    const prevStep = step;
    s = reduce(s, actionCtx);
    print(renderPhaseResult(s, prevStep));

    if (!fastForward) {
      await prompt('  [Enter]');
    }
  }
}

// ── Main ──

async function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.error) {
    console.error(`Error: ${parsed.error}`);
    console.error('Usage: node src/cli.js <name1> <name2> [...] [--seed N] [--fast-forward]');
    process.exit(1);
  }

  const { names, seed, fastForward } = parsed;
  const rng = seed !== null ? createSeededRng(seed) : Math.random;

  print('');
  print('  ╔═══════════════════════════════════════════╗');
  print('  ║  SKAIS2: The Board Game                   ║');
  print('  ║  Race to ship. Try not to break prod.     ║');
  print('  ╚═══════════════════════════════════════════╝');
  print('');
  print(`  Players: ${names.join(', ')}`);
  if (seed !== null) print(`  Seed: ${seed}`);
  if (fastForward) print(`  Mode: fast-forward`);
  print('');

  initIO();

  try {
    const state = createInitialState(names, {}, rng);
    await gameLoop(state, rng, fastForward);
  } finally {
    closeIO();
  }
}

// Only run main when executed directly (not imported for testing)
const isMain = process.argv[1] && (
  process.argv[1].endsWith('/cli.js') || process.argv[1].endsWith('\\cli.js')
);
if (isMain) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
