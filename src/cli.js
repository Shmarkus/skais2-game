#!/usr/bin/env node
// ── SKAIS2 CLI ──
// Interactive game loop with support for piped/scripted input (E2E testing).
//
// Usage:
//   node src/cli.js                          # interactive with random players
//   node src/cli.js Alice Bob Charlie        # named players
//   node src/cli.js --seed 42 Alice Bob      # deterministic RNG
//   echo "1\n2\n1" | node src/cli.js Alice Bob  # scripted input (E2E)

import * as readline from 'node:readline';
import { createInitialState, reduce, reduceUntilInput } from './reducer.js';
import { getLegalActions } from './validator.js';
import { GamePhase, TurnPhase, SprintPhase } from './stateMachine.js';
import { totalBugs, totalTokens, dangerCheck } from './modules/board.js';
import { createSeededRng, createRealDice } from './rng.js';

// ── Arg Parsing ──

function parseArgs(argv) {
  const args = argv.slice(2);
  let seed = null;
  const names = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && i + 1 < args.length) {
      seed = parseInt(args[++i], 10);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`SKAIS2: The Board Game — CLI

Usage: node src/cli.js [options] [player names...]

Options:
  --seed <n>   Use deterministic RNG (reproducible games)
  --help       Show this help

Examples:
  node src/cli.js Alice Bob Charlie Dana Eero
  node src/cli.js --seed 42 Alice Bob Charlie
  echo "1" | node src/cli.js Alice Bob Charlie    # scripted E2E`);
      process.exit(0);
    } else {
      names.push(args[i]);
    }
  }

  if (names.length < 2) {
    names.length = 0;
    names.push('Alice', 'Bob', 'Charlie');
  }

  return { names, seed };
}

// ── Display Helpers ──

const SEV_COLORS = { MINOR: '\x1b[33m', MAJOR: '\x1b[91m', CATASTROPHIC: '\x1b[95m', LUCKY: '\x1b[92m' };
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function colorize(text, code) { return `${code}${text}${RESET}`; }

function severityTag(severity) {
  const c = SEV_COLORS[severity] || '';
  return `${c}[${severity}]${RESET}`;
}

function skillBar(skills) {
  return Object.entries(skills).map(([k, v]) => `${k}:${'*'.repeat(v)}${'·'.repeat(3 - v)}`).join(' ');
}

function printBanner() {
  console.log(`
${BOLD}╔══════════════════════════════════════════╗
║     SKAIS2: The Board Game  (v3 CLI)     ║
╚══════════════════════════════════════════╝${RESET}
`);
}

function printBoard(state) {
  const b = state.board;
  const tokens = totalTokens(b);
  const zones = [
    { max: 7, label: 'Safe' }, { max: 9, label: 'Warning' },
    { max: 11, label: 'Danger' }, { max: 13, label: 'Critical' },
    { max: 15, label: 'Severe' }, { max: 17, label: 'Terminal' },
  ];
  const zone = tokens >= 18 ? 'DEAD' : (zones.find(z => tokens <= z.max) || { label: '???' }).label;

  console.log(`${DIM}─── Board ───${RESET}`);
  console.log(`  Bugs: ${totalBugs(b)} (${b.playerBugs.map((n, i) => `${state.players[i].name}:${n}`).join(', ')})`);
  console.log(`  Dissatisfaction: ${b.dissatisfaction}`);
  console.log(`  Danger Zone: ${tokens} tokens → ${zone}`);
}

function printPlayers(state) {
  const pi = state.phase.activePlayer;
  console.log(`${DIM}─── Players ───${RESET}`);
  state.players.forEach((p, i) => {
    const marker = i === pi ? ' ◀' : '';
    const task = p.task ? `${p.task.name} [${p.task.id}] effort:${p.effort}` : '(no task)';
    const review = p.reviewPile.length > 0 ? ` reviews:${p.reviewPile.length}` : '';
    console.log(`  ${i === pi ? BOLD : ''}${p.name}${RESET}  SP:${p.score}  ${skillBar(p.skills)}  task: ${task}${review}${marker}`);
  });
}

function printPhase(state) {
  const p = state.phase;
  console.log(`\n${BOLD}Sprint ${p.sprint} · Turn ${p.turn} · ${state.players[p.activePlayer].name}'s turn${RESET}`);
  console.log(`  Phase: ${p.step}  Game: ${p.game}`);
}

function printMisfortune(state) {
  const card = state.meta.lastDrawn;
  if (!card) {
    console.log(`\n  Misfortune: (deck empty — no card drawn)`);
    return;
  }
  console.log(`\n  Misfortune: ${severityTag(card.severity)} ${card.name} (${card.category || 'none'})`);
  console.log(`    Effect: ${card.effectType} ${card.effectValue ? `(${card.effectValue})` : ''}`);

  if (state.meta.immune) {
    console.log(`    → ${colorize('IMMUNE', '\x1b[92m')} — skill level protects you`);
  }
  if (state.meta.effectResolution) {
    const er = state.meta.effectResolution;
    console.log(`    → Resolved: ${er.type}${er.reason ? ` (${er.reason})` : ''}`);
  }
}

function printQA(state) {
  const qa = state.meta.qaResult;
  if (!qa) return;
  if (qa.autoPass) {
    console.log(`  QA: ${colorize('AUTO-PASS', '\x1b[92m')} (no skill gaps)`);
  } else {
    const verdict = qa.passed ? colorize('PASSED', '\x1b[92m') : colorize('BOUNCED', '\x1b[91m');
    console.log(`  QA: rolled ${qa.roll} vs gap ${qa.gap} → ${verdict}`);
  }
}

function printFreezeStep(state) {
  const step = state.phase.step;
  console.log(`\n${BOLD}═══ Merge Freeze: ${step} ═══${RESET}`);

  if (state.meta.deliveryResult) {
    const d = state.meta.deliveryResult;
    const verdict = d.met ? colorize('MET', '\x1b[92m') : colorize(`MISSED by ${d.deficit}`, '\x1b[91m');
    console.log(`  Delivery: ${d.completed}/${d.target} → ${verdict}`);
  }
  if (state.meta.bonusResult) {
    const b = state.meta.bonusResult;
    const names = b.players.map(i => state.players[i].name).join(', ');
    console.log(`  Sprint Bonus: ${names} +${b.bonus} SP (${b.type})`);
  }
  if (state.meta.dangerResult) {
    const dr = state.meta.dangerResult;
    const verdict = dr.survived ? colorize('SURVIVED', '\x1b[92m') : colorize('GAME OVER', '\x1b[91m');
    console.log(`  Danger: ${dr.total} tokens, zone ${dr.zone}, roll ${dr.roll} → ${verdict}`);
  }
}

function printGameOver(state) {
  const isWon = state.phase.game === GamePhase.GAME_WON;
  console.log(`\n${BOLD}${'='.repeat(44)}`);
  console.log(isWon ? '  GAME WON — The project survived!' : '  GAME OVER — The project collapsed!');
  console.log(`${'='.repeat(44)}${RESET}\n`);
  console.log('Final scores:');
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  sorted.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.score} SP  ${skillBar(p.skills)}`);
  });
  console.log();
}

function formatAction(action) {
  if (action.type === 'SKILL_UP') return `Skill Up (${action.skill})`;
  const labels = {
    DEVELOP: 'Develop (reduce effort by 1)',
    PAY_DEBT: 'Pay Debt (remove a bug/dissatisfaction)',
    PROPER_REVIEW: 'Proper Review (remove 1 review card)',
    LGTM: 'LGTM (clear reviews → bugs)',
  };
  return labels[action.type] || action.type;
}

// ── Game Loop ──

async function main() {
  const { names, seed } = parseArgs(process.argv);
  const rng = seed != null ? createSeededRng(seed) : Math.random;
  const diceRng = seed != null ? createSeededRng(seed + 9999) : Math.random;
  const dice = () => Math.floor(diceRng() * 6) + 1;
  const isTTY = process.stdin.isTTY;

  printBanner();
  console.log(`Players: ${names.join(', ')}${seed != null ? ` (seed: ${seed})` : ''}\n`);

  // Create game
  let state = createInitialState(names, {}, rng);

  // Auto-advance through initial phases to first player input
  state = autoAdvance(state, rng, dice);

  // Setup readline
  // For piped input: buffer all lines first, then consume them
  let lineBuffer = [];
  let lineResolve = null;
  let eofReached = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: isTTY ? process.stdout : undefined,
    terminal: isTTY,
  });

  if (!isTTY) {
    rl.on('line', (line) => {
      if (lineResolve) {
        const resolve = lineResolve;
        lineResolve = null;
        resolve(line.trim());
      } else {
        lineBuffer.push(line.trim());
      }
    });
    rl.on('close', () => {
      eofReached = true;
      if (lineResolve) {
        lineResolve(null);
        lineResolve = null;
      }
    });
  }

  const prompt = (q) => new Promise((resolve) => {
    if (isTTY) {
      rl.question(q, resolve);
    } else if (lineBuffer.length > 0) {
      resolve(lineBuffer.shift());
    } else if (eofReached) {
      resolve(null);
    } else {
      lineResolve = resolve;
    }
  });

  // Main loop
  while (state.phase.game === GamePhase.PLAYING) {
    // Display state
    printBoard(state);
    printPlayers(state);
    printPhase(state);
    printMisfortune(state);
    printQA(state);

    const step = state.phase.step;

    // Freeze phases are auto-advanced, but show info
    if (isFreezePhase(step)) {
      printFreezeStep(state);
      state = autoAdvance(state, rng, dice);
      continue;
    }

    if (step !== TurnPhase.AWAITING_ACTION) {
      // Shouldn't happen after autoAdvance, but safety net
      state = autoAdvance(state, rng, dice);
      continue;
    }

    // Player choice
    const actions = getLegalActions(state);
    if (actions.length === 0) {
      console.log('  (No legal actions — ending turn)');
      state = reduce(state, { type: 'END_TURN' });
      state = autoAdvance(state, rng, dice);
      continue;
    }

    console.log(`\n  Actions:`);
    actions.forEach((a, i) => {
      console.log(`    ${i + 1}. ${formatAction(a)}`);
    });

    let chosen = null;
    while (chosen === null) {
      const input = await prompt(`\n  Choose [1-${actions.length}]: `);

      // EOF — exit gracefully
      if (input === null) {
        console.log('\n  (EOF — ending game)');
        rl.close();
        printGameOver(state);
        process.exit(0);
      }

      // Allow action type as input (for E2E scripts)
      const byType = actions.findIndex(a => {
        if (a.type === input) return true;
        // SKILL_UP:BE shorthand
        if (input.startsWith('SKILL_UP:') && a.type === 'SKILL_UP' && a.skill === input.split(':')[1]) return true;
        return false;
      });
      if (byType >= 0) {
        chosen = actions[byType];
        break;
      }

      const idx = parseInt(input, 10);
      if (idx >= 1 && idx <= actions.length) {
        chosen = actions[idx - 1];
      } else {
        if (isTTY) console.log(`  Invalid choice. Enter 1-${actions.length} or action type (e.g. DEVELOP, SKILL_UP:BE)`);
      }
    }

    console.log(`\n  → ${formatAction(chosen)}`);

    // Dispatch the player action, then auto-advance through mechanical phases
    state = reduce(state, { ...chosen, rng });
    if (state.meta.rejected) {
      console.log(`  ${colorize('ERROR: ' + state.meta.error, '\x1b[91m')}`);
      continue;
    }

    state = autoAdvance(state, rng, dice);
  }

  // Game ended
  printGameOver(state);
  rl.close();
}

// ── Auto-advance through non-interactive phases ──

function isFreezePhase(step) {
  return [
    SprintPhase.MERGE_FREEZE_UNREVIEWED,
    SprintPhase.MERGE_FREEZE_DELIVERY,
    SprintPhase.MERGE_FREEZE_BONUS,
    SprintPhase.MERGE_FREEZE_DANGER,
  ].includes(step);
}

function autoAdvance(state, rng, dice) {
  let safety = 200;
  while (safety-- > 0 && state.phase.game === GamePhase.PLAYING) {
    const step = state.phase.step;

    if (step === TurnPhase.AWAITING_ACTION) break;

    const autoActions = {
      [TurnPhase.DRAW_MISFORTUNE]: () => ({ type: 'DRAW_MISFORTUNE', rng }),
      [TurnPhase.CHECK_IMMUNITY]: () => ({ type: 'CHECK_IMMUNITY' }),
      [TurnPhase.RESOLVE_EFFECT]: () => ({ type: 'RESOLVE_EFFECT' }),
      [TurnPhase.CHECK_COMPLETION]: () => ({ type: 'CHECK_COMPLETION', diceRoll: dice() }),
      [TurnPhase.EXECUTE_ACTION]: () => ({ type: 'EXECUTE_ACTION' }),
      [TurnPhase.SCORE_TASK]: () => ({ type: 'SCORE_TASK' }),
      [TurnPhase.END_TURN]: () => ({ type: 'END_TURN' }),
      [SprintPhase.MERGE_FREEZE_UNREVIEWED]: () => ({ type: 'RESOLVE_UNREVIEWED' }),
      [SprintPhase.MERGE_FREEZE_DELIVERY]: () => ({ type: 'RESOLVE_DELIVERY' }),
      [SprintPhase.MERGE_FREEZE_BONUS]: () => ({ type: 'RESOLVE_BONUS' }),
      [SprintPhase.MERGE_FREEZE_DANGER]: () => ({ type: 'RESOLVE_DANGER', diceRoll: dice() }),
    };

    const factory = autoActions[step];
    if (!factory) break;

    const prevStep = step;
    state = reduce(state, factory());

    if (state.meta.rejected) {
      console.log(`  ${colorize('Auto-advance error at ' + prevStep + ': ' + state.meta.error, '\x1b[91m')}`);
      break;
    }

    // Show freeze info inline
    if (isFreezePhase(prevStep)) {
      printFreezeStep(state);
    }
  }

  return state;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
