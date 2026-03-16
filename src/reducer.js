// ── Game Reducer ──
// (state, action) → newState
// Wires together validator, state machines, and all game modules.

import { validateAction } from './validator.js';
import { GameStateMachine, TurnPhase, SprintPhase, GamePhase } from './stateMachine.js';
import { draw } from './modules/deck.js';
import { checkImmunity, resolveEffect, isSkipEffect, isInstantComplete, hasExtraActions } from './modules/misfortune.js';
import { calculateEffort, levelUp } from './modules/skills.js';
import { qaCheck, scoreTask, bounceTask } from './modules/completion.js';
import { addBug, removeBug, removeDissatisfaction, totalBugs, addDissatisfaction, deliveryCheck, sprintBonus, dangerCheck } from './modules/board.js';
import { createBoard } from './modules/board.js';
import { createDeck } from './modules/deck.js';
import { createGameConfig } from './config.js';

// ── Initial State Factory ──

export function createInitialState(playerNames, configOverrides = {}, rng = Math.random) {
  const config = typeof configOverrides === 'object' && configOverrides.skills
    ? configOverrides
    : createGameConfig(configOverrides);
  const playerCount = playerNames.length;

  const players = playerNames.map(name => ({
    name,
    skills: { BE: 0, DB: 0, DO: 0, FE: 0 },
    task: null,
    effort: 0,
    score: 0,
    bugs: 0,
    reviewPile: [],
    skillUpProgress: null, // { tier, progress } when mid-redemption
  }));

  // Skill token pool: floor(players * 1.5) per tier
  const tokensPerTier = Math.floor(playerCount * 1.5);
  const tokenPool = { tier1: tokensPerTier, tier2: tokensPerTier, tier3: tokensPerTier };

  const taskDeck = createDeck(config.tasks, rng);
  const misfortuneDeck = createDeck(config.misfortuneCards, rng);

  // Deal one task to each player
  let remaining = taskDeck;
  for (const player of players) {
    const result = draw(remaining);
    if (result.card) {
      player.task = result.card;
      player.effort = calculateEffort(config.skills, player.skills, result.card);
      remaining = result.remaining;
    }
  }

  const gsm = new GameStateMachine(playerCount, config.sprintsPerGame);
  gsm.start();

  return {
    phase: {
      game: GamePhase.PLAYING,
      step: TurnPhase.DRAW_MISFORTUNE,
      activePlayer: 0,
      sprint: 1,
      turn: 1,
    },
    config,
    players,
    board: createBoard(playerCount),
    decks: {
      taskDeck: remaining,
      taskTemplate: [...config.tasks],
      misfortune: misfortuneDeck,
      misfortuneTemplate: [...config.misfortuneCards],
    },
    tokenPool,
    meta: {},
    _gsm: gsm,
  };
}

// ── Helpers ──

function updatePlayer(state, playerIndex, patch) {
  const players = [...state.players];
  players[playerIndex] = { ...players[playerIndex], ...patch };
  return { ...state, players };
}

function syncPhase(state) {
  const gsm = state._gsm;
  if (gsm.phase !== GamePhase.PLAYING) {
    return {
      ...state,
      phase: { ...state.phase, game: gsm.phase },
    };
  }

  const sm = gsm.sprintMachine;
  if (!sm) {
    return { ...state, phase: { ...state.phase, game: gsm.phase } };
  }

  const step = sm.phase === SprintPhase.PLAYING && sm.turnMachine
    ? sm.turnMachine.phase
    : sm.phase;

  return {
    ...state,
    phase: {
      game: gsm.phase,
      step,
      activePlayer: sm.phase === SprintPhase.PLAYING && sm.turnMachine
        ? sm.currentPlayerIndex
        : state.phase.activePlayer,
      sprint: gsm.currentSprint,
      turn: sm.phase === SprintPhase.PLAYING ? sm.currentTurn : state.phase.turn,
    },
  };
}

// Wrap transitionTurn: if the turn becomes terminal, handle end-of-turn effects
function advanceTurn(state, input, action = {}) {
  const prevPlayerIndex = state._gsm.sprintMachine.currentPlayerIndex;
  const result = state._gsm.sprintMachine.transitionTurn(input);

  let s = state;

  // If the turn reached END_TURN, the sprint machine already called advancePlayer.
  // Handle end-of-turn effects for the player who just finished.
  if (result.to === TurnPhase.END_TURN) {
    s = handleEndOfTurn(s, prevPlayerIndex, action);
  }

  return syncPhase(s);
}

function handleEndOfTurn(state, playerIndex, action = {}) {
  const player = state.players[playerIndex];
  let s = state;

  // If player has no task at end of turn, draw a new one
  if (!player.task) {
    const rng = action.rng || Math.random;
    const { card, remaining } = draw(s.decks.taskDeck, s.decks.taskTemplate, rng);
    if (card) {
      const effort = calculateEffort(s.config.skills, player.skills, card);
      s = updatePlayer(s, playerIndex, { task: card, effort });
      s = { ...s, decks: { ...s.decks, taskDeck: remaining } };
    }
  }

  return s;
}

// ── Reducer ──

export function reduce(state, action) {
  // Validate
  const validation = validateAction(state, action);
  if (!validation.valid) {
    return { ...state, meta: { ...state.meta, error: validation.error, rejected: true } };
  }

  // Preserve meta across phases (don't clear) — handlers set what they need
  let s = { ...state, meta: { ...state.meta, rejected: false, error: null } };

  switch (action.type) {
    case 'DRAW_MISFORTUNE':
      return reduceDraw(s, action);
    case 'CHECK_IMMUNITY':
      return reduceCheckImmunity(s, action);
    case 'RESOLVE_EFFECT':
      return reduceResolveEffect(s, action);
    case 'CHECK_COMPLETION':
      return reduceCheckCompletion(s, action);
    case 'EXECUTE_ACTION':
      return reduceExecuteAction(s, action);
    case 'SCORE_TASK':
      return reduceScoreTask(s, action);
    case 'END_TURN':
      return reduceEndTurn(s, action);
    case 'DEVELOP':
    case 'SKILL_UP':
    case 'PAY_DEBT':
    case 'PROPER_REVIEW':
    case 'LGTM':
      return reducePlayerAction(s, action);
    case 'RESOLVE_UNREVIEWED':
      return reduceUnreviewed(s, action);
    case 'RESOLVE_DELIVERY':
      return reduceDelivery(s, action);
    case 'RESOLVE_BONUS':
      return reduceBonus(s, action);
    case 'RESOLVE_DANGER':
      return reduceDanger(s, action);
    default:
      return { ...s, meta: { ...s.meta, error: `Unknown action: ${action.type}`, rejected: true } };
  }
}

// ── Phase Handlers ──

function reduceDraw(state, action) {
  const rng = action.rng || Math.random;
  const reshuffleTemplate = state.config.reshuffleMisfortune ? state.decks.misfortuneTemplate : null;
  const { card, remaining, reshuffled } = draw(state.decks.misfortune, reshuffleTemplate, rng);

  let s = {
    ...state,
    decks: { ...state.decks, misfortune: remaining },
    meta: { ...state.meta, lastDrawn: card, reshuffled },
  };

  s = advanceTurn(s, {}, action);
  return s;
}

function reduceCheckImmunity(state, action) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];
  const card = state.meta.lastDrawn;

  const immune = card ? checkImmunity(state.config.skills, player.skills, card) : true;

  let s = { ...state, meta: { ...state.meta, immune } };
  s = advanceTurn(s, { immune }, action);
  return s;
}

function reduceResolveEffect(state, action) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];
  const card = state.meta.lastDrawn;

  if (!card) {
    return advanceTurn(state, { skipped: false }, action);
  }

  const context = {
    playerIndex: pi,
    integrationTaskIds: state.config.integrationTaskIds,
  };

  const result = resolveEffect(player, state.board, card, context);
  let s = state;

  // Apply player patch
  if (result.playerPatch) {
    s = updatePlayer(s, pi, result.playerPatch);
  }

  // Apply board patch
  if (result.boardPatch) {
    let board = s.board;
    for (let i = 0; i < (result.boardPatch.addBugs || 0); i++) {
      board = addBug(board, result.boardPatch.playerIndex);
    }
    s = { ...s, board };
  }

  // Handle discard effect
  if (result.meta.type === 'discard_task') {
    s = updatePlayer(s, pi, { task: null, effort: 0 });
  }

  const skipped = isSkipEffect(result.meta);
  const instantComplete = isInstantComplete(result.meta);
  const extraActions = hasExtraActions(result.meta) ? result.meta.extraActions : 0;

  s = { ...s, meta: { ...s.meta, effectResolution: result.meta } };
  s = advanceTurn(s, { skipped, instantComplete, extraActions }, action);
  return s;
}

function reduceCheckCompletion(state, action) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];
  const diceRoll = action.diceRoll;

  // No task or effort > 0 → not completed
  if (!player.task || player.effort > 0) {
    let s = { ...state, meta: { ...state.meta, qaResult: null } };
    s = advanceTurn(s, { completed: false }, action);
    return s;
  }

  // Effort is 0 → QA check
  const result = qaCheck(state.config.skills, player.skills, player.task, diceRoll);
  let s = { ...state, meta: { ...state.meta, qaResult: result } };

  if (result.passed) {
    s = advanceTurn(s, { completed: true }, action);
  } else {
    // Bounce: reset effort to 1 and add a bug
    s = updatePlayer(s, pi, bounceTask(player));
    s = { ...s, board: addBug(s.board, pi) };
    s = advanceTurn(s, { completed: false }, action);
  }

  return s;
}

function reducePlayerAction(state, action) {
  // Store the chosen action in meta for EXECUTE_ACTION to use
  let s = { ...state, meta: { ...state.meta, pendingAction: action } };
  s = advanceTurn(s, {}, action);
  return s;
}

function reduceExecuteAction(state, action) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];
  const pending = state.meta.pendingAction;
  let s = state;

  if (!pending) {
    return advanceTurn(s, {}, action);
  }

  switch (pending.type) {
    case 'DEVELOP': {
      s = updatePlayer(s, pi, { effort: player.effort - 1 });
      break;
    }
    case 'SKILL_UP': {
      const progress = player.skillUpProgress;
      if (progress) {
        // Continue existing redemption
        const newProgress = progress.progress + 1;
        if (newProgress >= progress.tier) {
          // Completed — level up the chosen skill
          const newSkills = levelUp(player.skills, pending.skill);
          s = updatePlayer(s, pi, { skills: newSkills, skillUpProgress: null });
        } else {
          // Still in progress
          s = updatePlayer(s, pi, {
            skillUpProgress: { tier: progress.tier, progress: newProgress },
          });
        }
      } else {
        // Start new redemption — take cheapest available token
        const pool = s.tokenPool;
        if (pool.tier1 > 0) {
          // Tier 1 = instant
          const newSkills = levelUp(player.skills, pending.skill);
          s = updatePlayer(s, pi, { skills: newSkills, skillUpProgress: null });
          s = { ...s, tokenPool: { ...pool, tier1: pool.tier1 - 1 } };
        } else if (pool.tier2 > 0) {
          // Tier 2 = start 2-step redemption
          s = updatePlayer(s, pi, { skillUpProgress: { tier: 2, progress: 1 } });
          s = { ...s, tokenPool: { ...pool, tier2: pool.tier2 - 1 } };
        } else if (pool.tier3 > 0) {
          // Tier 3 = start 3-step redemption
          s = updatePlayer(s, pi, { skillUpProgress: { tier: 3, progress: 1 } });
          s = { ...s, tokenPool: { ...pool, tier3: pool.tier3 - 1 } };
        }
      }
      break;
    }
    case 'PAY_DEBT': {
      let board = s.board;
      // Remove a bug first (own bugs, then others), otherwise dissatisfaction
      const playerBugs = board.playerBugs[pi] || 0;
      if (playerBugs > 0) {
        board = removeBug(board, pi);
      } else if (totalBugs(board) > 0) {
        for (let i = 0; i < board.playerBugs.length; i++) {
          if (board.playerBugs[i] > 0) {
            board = removeBug(board, i);
            break;
          }
        }
      } else {
        board = removeDissatisfaction(board);
      }
      s = { ...s, board };
      break;
    }
    case 'PROPER_REVIEW': {
      const reviewPile = [...player.reviewPile];
      reviewPile.shift();
      s = updatePlayer(s, pi, { reviewPile });
      break;
    }
    case 'LGTM': {
      const pileSize = player.reviewPile.length;
      const rolls = action.lgtmRolls || [];
      const rng = action.rng || Math.random;
      let board = s.board;
      let bugsAdded = 0;
      for (let i = 0; i < pileSize; i++) {
        const roll = rolls[i] ?? Math.ceil(rng() * 6);
        if (roll <= 2) {
          board = addBug(board, pi);
          bugsAdded++;
        }
      }
      s = updatePlayer(s, pi, { reviewPile: [] });
      s = { ...s, board };
      break;
    }
  }

  s = { ...s, meta: { ...s.meta, executedAction: pending } };
  s = advanceTurn(s, {}, action);
  return s;
}

function findLeader(players) {
  let leaderIdx = 0;
  for (let i = 1; i < players.length; i++) {
    if (players[i].score > players[leaderIdx].score) {
      leaderIdx = i;
    }
  }
  return leaderIdx;
}

function reduceScoreTask(state, action) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];

  if (player.task) {
    const completedTask = player.task;
    const scored = scoreTask(player, completedTask);
    let s = updatePlayer(state, pi, { score: scored.score, task: null, effort: 0 });

    // Send completed task card to leader's review pile
    const leaderIdx = findLeader(s.players);
    const leader = s.players[leaderIdx];
    s = updatePlayer(s, leaderIdx, {
      reviewPile: [...leader.reviewPile, completedTask],
    });

    // If instant complete from effect, roll d6: 1-4 = 1 bug (AI quality)
    const effectMeta = state.meta.effectResolution;
    if (effectMeta && effectMeta.type === 'instant_complete') {
      const roll = action.diceRoll ?? Math.ceil((action.rng || Math.random)() * 6);
      if (roll <= 4) {
        s = { ...s, board: addBug(s.board, pi) };
      }
    }

    // Track sprint completions
    const sprintCompleted = (state.meta.sprintCompletedTasks || 0) + 1;
    s = { ...s, meta: { ...s.meta, scored: true, scoredPoints: completedTask.storyPoints, sprintCompletedTasks: sprintCompleted } };
    s = advanceTurn(s, {}, action);
    return s;
  }

  // No task to score
  return advanceTurn(state, {}, action);
}

function reduceEndTurn(state, action) {
  // END_TURN is normally handled automatically by advanceTurn.
  // This handler exists for the edge case where the phase is END_TURN
  // (shouldn't normally happen, but kept for completeness).
  return syncPhase(state);
}

// ── Freeze Handlers ──

function reduceUnreviewed(state, action) {
  let s = state;

  // Each player's unreviewed cards become bugs
  for (let pi = 0; pi < s.players.length; pi++) {
    const pileSize = s.players[pi].reviewPile.length;
    let board = s.board;
    for (let i = 0; i < pileSize; i++) {
      board = addBug(board, pi);
    }
    s = { ...s, board };
    s = updatePlayer(s, pi, { reviewPile: [] });
  }

  state._gsm.sprintMachine.transitionFreeze({});
  s = syncPhase(s);
  return s;
}

function reduceDelivery(state, action) {
  const completedTasks = action.completedTasks ?? state.meta.sprintCompletedTasks ?? 0;
  const result = deliveryCheck(completedTasks, state.players.length);

  let s = state;
  if (!result.met) {
    s = { ...s, board: addDissatisfaction(s.board, result.deficit) };
  }

  s = { ...s, meta: { ...s.meta, deliveryResult: result } };

  state._gsm.sprintMachine.transitionFreeze({});
  s = syncPhase(s);
  return s;
}

function reduceBonus(state, action) {
  const result = sprintBonus(state.board);
  let s = state;

  for (const pi of result.players) {
    s = updatePlayer(s, pi, { score: s.players[pi].score + result.bonus });
  }

  s = { ...s, meta: { ...s.meta, bonusResult: result } };

  state._gsm.sprintMachine.transitionFreeze({});
  s = syncPhase(s);
  return s;
}

function reduceDanger(state, action) {
  const diceRoll = action.diceRoll;
  const result = dangerCheck(state.board, diceRoll);
  let s = { ...state, meta: { ...state.meta, dangerResult: result } };

  const freezeResult = state._gsm.sprintMachine.transitionFreeze({ survived: result.survived });

  if (freezeResult.died) {
    state._gsm.phase = GamePhase.GAME_OVER;
  } else if (state._gsm.sprintMachine.isComplete()) {
    state._gsm.advanceSprint();
    // Reset sprint task counter for new sprint
    s = { ...s, meta: { ...s.meta, sprintCompletedTasks: 0 } };
  }

  s = syncPhase(s);
  return s;
}

// ── Convenience: run auto-actions until player input needed ──

export function reduceUntilInput(state, action, context = {}) {
  let s = reduce(state, action);
  if (s.meta.rejected) return s;

  const autoMap = {
    [TurnPhase.DRAW_MISFORTUNE]: 'DRAW_MISFORTUNE',
    [TurnPhase.CHECK_IMMUNITY]: 'CHECK_IMMUNITY',
    [TurnPhase.RESOLVE_EFFECT]: 'RESOLVE_EFFECT',
    [TurnPhase.CHECK_COMPLETION]: 'CHECK_COMPLETION',
    [TurnPhase.EXECUTE_ACTION]: 'EXECUTE_ACTION',
    [TurnPhase.SCORE_TASK]: 'SCORE_TASK',
    [SprintPhase.MERGE_FREEZE_UNREVIEWED]: 'RESOLVE_UNREVIEWED',
    [SprintPhase.MERGE_FREEZE_DELIVERY]: 'RESOLVE_DELIVERY',
    [SprintPhase.MERGE_FREEZE_BONUS]: 'RESOLVE_BONUS',
    [SprintPhase.MERGE_FREEZE_DANGER]: 'RESOLVE_DANGER',
  };

  let safety = 50;
  while (safety-- > 0) {
    const step = s.phase.step;
    if (step === TurnPhase.AWAITING_ACTION) break;
    if (s.phase.game !== GamePhase.PLAYING) break;
    const autoType = autoMap[step];
    if (!autoType) break;

    s = reduce(s, { type: autoType, ...context });
    if (s.meta.rejected) break;
  }

  return s;
}
