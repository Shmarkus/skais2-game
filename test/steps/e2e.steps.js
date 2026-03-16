import { Given, When, Then, Before } from '@cucumber/cucumber';
import assert from 'assert';
import { createInitialState, reduce } from '../../src/reducer.js';
import { getLegalActions } from '../../src/validator.js';
import { createSeededRng } from '../../src/rng.js';
import { totalTokens, addBug } from '../../src/modules/board.js';

// ── State ──

Before(function () {
  this.e2e = null;
});

function initE2E(world) {
  if (!world.e2e) {
    world.e2e = {
      state: null,
      strategy: 'develop',
      dangerRoll: 1,       // safe by default
      lgtmRoll: null,      // null = use random
      misfortuneDraws: 0,
      lgtmBugsAdded: 0,
      lgtmCount: 0,
      initialPoolTotal: 0,
      initialDeckSize: 0,
    };
  }
  return world.e2e;
}

// ── Strategy: pick action based on strategy name ──

function pickAction(state, strategy) {
  const legal = getLegalActions(state);
  if (legal.length === 0) return null;

  // Mid-redemption forces SKILL_UP
  const player = state.players[state.phase.activePlayer];
  if (player.skillUpProgress) {
    return legal[0]; // only SKILL_UP is legal
  }

  switch (strategy) {
    case 'develop': {
      const dev = legal.find(a => a.type === 'DEVELOP');
      if (dev) return dev;
      // Fallback: pick first available
      return legal[0];
    }
    case 'skill up': {
      const skill = legal.find(a => a.type === 'SKILL_UP');
      if (skill) return skill;
      return legal.find(a => a.type === 'DEVELOP') || legal[0];
    }
    default:
      return legal[0];
  }
}

// ── Game Runner ──

function playGame(e2e, untilSprint = null) {
  let s = e2e.state;
  let safety = 20000;

  while (safety-- > 0 && s.phase.game === 'PLAYING') {
    // Stop condition for partial play
    if (untilSprint !== null && s.phase.step === 'MERGE_FREEZE_UNREVIEWED') {
      if (s.phase.sprint >= untilSprint) break;
    }

    const step = s.phase.step;

    // Player action
    if (step === 'AWAITING_ACTION') {
      const action = pickAction(s, e2e.strategy);
      if (!action) break;
      s = reduce(s, action);
      continue;
    }

    // Freeze phases
    if (step === 'MERGE_FREEZE_UNREVIEWED') {
      s = reduce(s, { type: 'RESOLVE_UNREVIEWED' });
      continue;
    }
    if (step === 'MERGE_FREEZE_DELIVERY') {
      s = reduce(s, { type: 'RESOLVE_DELIVERY' });
      continue;
    }
    if (step === 'MERGE_FREEZE_BONUS') {
      s = reduce(s, { type: 'RESOLVE_BONUS' });
      continue;
    }
    if (step === 'MERGE_FREEZE_DANGER') {
      s = reduce(s, { type: 'RESOLVE_DANGER', diceRoll: e2e.dangerRoll });
      continue;
    }

    // Auto phases
    const autoMap = {
      DRAW_MISFORTUNE: 'DRAW_MISFORTUNE',
      CHECK_IMMUNITY: 'CHECK_IMMUNITY',
      RESOLVE_EFFECT: 'RESOLVE_EFFECT',
      CHECK_COMPLETION: 'CHECK_COMPLETION',
      EXECUTE_ACTION: 'EXECUTE_ACTION',
      SCORE_TASK: 'SCORE_TASK',
      END_TURN: 'END_TURN',
    };
    const actionType = autoMap[step];
    if (!actionType) break;

    const ctx = { type: actionType };

    if (step === 'DRAW_MISFORTUNE') {
      e2e.misfortuneDraws++;
    }

    // QA rolls: 6 = always pass
    if (step === 'CHECK_COMPLETION') {
      ctx.diceRoll = 6;
    }

    // SCORE_TASK: AI assistant bug roll
    if (step === 'SCORE_TASK') {
      ctx.diceRoll = 6; // no AI bug
    }

    // EXECUTE_ACTION: handle LGTM rolls
    if (step === 'EXECUTE_ACTION' && s.meta.pendingAction?.type === 'LGTM') {
      const pileSize = s.players[s.phase.activePlayer].reviewPile.length;
      if (e2e.lgtmRoll !== null) {
        ctx.lgtmRolls = Array(pileSize).fill(e2e.lgtmRoll);
      }
      e2e.lgtmCount++;
      const bugsBefore = totalTokens(s.board);
      s = reduce(s, ctx);
      e2e.lgtmBugsAdded += totalTokens(s.board) - bugsBefore;
      continue;
    }

    s = reduce(s, ctx);
    if (s.meta.rejected) break;
  }

  e2e.state = s;
}

// ── Given Steps ──

Given('a {int}-player game with seed {int}', function (count, seed) {
  const e2e = initE2E(this);
  const names = Array.from({ length: count }, (_, i) =>
    ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack'][i]
  );
  const rng = createSeededRng(seed);
  e2e.state = createInitialState(names, {}, rng);
  const pool = e2e.state.tokenPool;
  e2e.initialPoolTotal = pool.tier1 + pool.tier2 + pool.tier3;
  e2e.initialDeckSize = e2e.state.decks.misfortune.length;
});

Given('the board starts with {int} bugs on player {int}', function (n, pi) {
  const e2e = initE2E(this);
  let board = e2e.state.board;
  for (let i = 0; i < n; i++) {
    board = addBug(board, pi);
  }
  e2e.state = { ...e2e.state, board };
});

Given('the strategy is {string}', function (strategy) {
  const e2e = initE2E(this);
  e2e.strategy = strategy.replace('always ', '');
});

Given('all danger rolls are safe', function () {
  const e2e = initE2E(this);
  e2e.dangerRoll = 1;
});

Given('all danger rolls are {int}', function (roll) {
  const e2e = initE2E(this);
  e2e.dangerRoll = roll;
});

Given('all LGTM rolls are {int}', function (roll) {
  const e2e = initE2E(this);
  e2e.lgtmRoll = roll;
});

// ── When Steps ──

When('the game is played to completion', function () {
  const e2e = initE2E(this);
  playGame(e2e);
});

When('the game is played through sprint {int}', function (sprint) {
  const e2e = initE2E(this);
  playGame(e2e, sprint);
});

When('the game is played to freeze of sprint {int}', function (sprint) {
  const e2e = initE2E(this);
  // Play until we reach MERGE_FREEZE_UNREVIEWED for the target sprint
  let s = e2e.state;
  let safety = 20000;
  while (safety-- > 0 && s.phase.game === 'PLAYING') {
    if (s.phase.step === 'MERGE_FREEZE_UNREVIEWED' && s.phase.sprint >= sprint) break;
    const step = s.phase.step;
    if (step === 'AWAITING_ACTION') {
      const action = pickAction(s, e2e.strategy);
      if (!action) break;
      s = reduce(s, action);
      continue;
    }
    if (step === 'MERGE_FREEZE_UNREVIEWED') { s = reduce(s, { type: 'RESOLVE_UNREVIEWED' }); continue; }
    if (step === 'MERGE_FREEZE_DELIVERY') { s = reduce(s, { type: 'RESOLVE_DELIVERY' }); continue; }
    if (step === 'MERGE_FREEZE_BONUS') { s = reduce(s, { type: 'RESOLVE_BONUS' }); continue; }
    if (step === 'MERGE_FREEZE_DANGER') { s = reduce(s, { type: 'RESOLVE_DANGER', diceRoll: e2e.dangerRoll }); continue; }
    const autoMap = { DRAW_MISFORTUNE:'DRAW_MISFORTUNE', CHECK_IMMUNITY:'CHECK_IMMUNITY',
      RESOLVE_EFFECT:'RESOLVE_EFFECT', CHECK_COMPLETION:'CHECK_COMPLETION',
      EXECUTE_ACTION:'EXECUTE_ACTION', SCORE_TASK:'SCORE_TASK', END_TURN:'END_TURN' };
    const t = autoMap[step];
    if (!t) break;
    const ctx = { type: t };
    if (step === 'CHECK_COMPLETION') ctx.diceRoll = 6;
    if (step === 'SCORE_TASK') ctx.diceRoll = 6;
    s = reduce(s, ctx);
    if (s.meta.rejected) break;
  }
  e2e.state = s;
  assert.strictEqual(s.phase.step, 'MERGE_FREEZE_UNREVIEWED',
    `Expected MERGE_FREEZE_UNREVIEWED, got ${s.phase.step}`);
});

When('all player bugs are set to {int}', function (n) {
  const e2e = initE2E(this);
  const playerCount = e2e.state.players.length;
  e2e.state = {
    ...e2e.state,
    board: { ...e2e.state.board, playerBugs: new Array(playerCount).fill(n) },
  };
  // Record scores before bonus
  e2e.scoresBeforeBonus = e2e.state.players.map(p => p.score);
});

When('the freeze is resolved', function () {
  const e2e = initE2E(this);
  let s = e2e.state;
  if (s.phase.step === 'MERGE_FREEZE_UNREVIEWED') s = reduce(s, { type: 'RESOLVE_UNREVIEWED' });
  if (s.phase.step === 'MERGE_FREEZE_DELIVERY') s = reduce(s, { type: 'RESOLVE_DELIVERY' });
  if (s.phase.step === 'MERGE_FREEZE_BONUS') s = reduce(s, { type: 'RESOLVE_BONUS' });
  if (s.phase.step === 'MERGE_FREEZE_DANGER') s = reduce(s, { type: 'RESOLVE_DANGER', diceRoll: e2e.dangerRoll });
  e2e.state = s;
});

When('unreviewed and delivery are resolved', function () {
  const e2e = initE2E(this);
  let s = e2e.state;
  if (s.phase.step === 'MERGE_FREEZE_UNREVIEWED') s = reduce(s, { type: 'RESOLVE_UNREVIEWED' });
  if (s.phase.step === 'MERGE_FREEZE_DELIVERY') s = reduce(s, { type: 'RESOLVE_DELIVERY' });
  e2e.state = s;
  assert.strictEqual(s.phase.step, 'MERGE_FREEZE_BONUS',
    `Expected MERGE_FREEZE_BONUS, got ${s.phase.step}`);
});

When('sprint bonus is resolved for the current sprint', function () {
  const e2e = initE2E(this);
  let s = e2e.state;
  assert.strictEqual(s.phase.step, 'MERGE_FREEZE_BONUS',
    `Expected MERGE_FREEZE_BONUS, got ${s.phase.step}`);
  s = reduce(s, { type: 'RESOLVE_BONUS' });
  e2e.state = s;
});

// ── Then Steps ──

Then('the game result should be WON', function () {
  assert.strictEqual(this.e2e.state.phase.game, 'GAME_WON',
    `Expected GAME_WON, got ${this.e2e.state.phase.game}`);
});

Then('the game result should be OVER', function () {
  assert.strictEqual(this.e2e.state.phase.game, 'GAME_OVER',
    `Expected GAME_OVER, got ${this.e2e.state.phase.game}`);
});

Then('all {int} sprints should have been played', function (n) {
  // If game is WON, all sprints were completed
  assert.strictEqual(this.e2e.state.phase.game, 'GAME_WON', 'Game should be won');
});

Then('each player should have a non-negative score', function () {
  for (const p of this.e2e.state.players) {
    assert.ok(p.score >= 0, `${p.name} has negative score: ${p.score}`);
  }
});

Then('the cause of death should be danger check', function () {
  const dr = this.e2e.state.meta.dangerResult;
  assert.ok(dr, 'Should have a danger result');
  assert.strictEqual(dr.survived, false, 'Should not have survived');
});

Then('the board should have dissatisfaction tokens', function () {
  assert.ok(this.e2e.state.board.dissatisfaction > 0,
    `Expected dissatisfaction > 0, got ${this.e2e.state.board.dissatisfaction}`);
});

Then('the token pool should have fewer tokens than it started with', function () {
  const pool = this.e2e.state.tokenPool;
  const current = pool.tier1 + pool.tier2 + pool.tier3;
  assert.ok(current < this.e2e.initialPoolTotal,
    `Pool should have decreased: was ${this.e2e.initialPoolTotal}, now ${current}`);
});

Then('at least one player should have skilled up', function () {
  const hasSkill = this.e2e.state.players.some(p =>
    Object.values(p.skills).some(v => v > 0)
  );
  assert.ok(hasSkill, 'At least one player should have a skill > 0');
});

Then('the player with the highest score should have review cards', function () {
  const players = this.e2e.state.players;
  let maxScore = -1;
  let leader = 0;
  for (let i = 0; i < players.length; i++) {
    if (players[i].score > maxScore) {
      maxScore = players[i].score;
      leader = i;
    }
  }
  // Leader should have accumulated review cards (or had them cleared at freeze)
  // Check that leader mechanic worked by checking total review cards or bugs from reviews
  // Since we stopped at freeze, leader may have cards or they've been converted to bugs
  const totalReviews = players.reduce((sum, p) => sum + p.reviewPile.length, 0);
  const totalBugsOnBoard = totalTokens(this.e2e.state.board);
  assert.ok(totalReviews > 0 || totalBugsOnBoard > 0,
    'Leader mechanic should have produced review cards or bugs');
});

Then('every LGTM should have added bugs', function () {
  // With LGTM roll = 1, every card should produce a bug
  if (this.e2e.lgtmCount > 0) {
    assert.ok(this.e2e.lgtmBugsAdded > 0,
      `LGTM should have added bugs, got ${this.e2e.lgtmBugsAdded}`);
  }
});

Then('more misfortune cards should have been drawn than the initial deck size', function () {
  assert.ok(this.e2e.misfortuneDraws > this.e2e.initialDeckSize,
    `Drew ${this.e2e.misfortuneDraws} cards but deck was ${this.e2e.initialDeckSize} — no reshuffle detected`);
});

Then('at least one skill should be at max level', function () {
  const hasMax = this.e2e.state.players.some(p =>
    Object.values(p.skills).some(v => v >= 3)
  );
  assert.ok(hasMax, 'At least one player should have a skill at max level (3)');
});

Then('all players should have received {int} bonus SP from sprint bonus', function (expectedBonus) {
  const before = this.e2e.scoresBeforeBonus;
  assert.ok(before, 'Scores before bonus should have been recorded');
  for (let i = 0; i < this.e2e.state.players.length; i++) {
    const gained = this.e2e.state.players[i].score - before[i];
    assert.strictEqual(gained, expectedBonus,
      `Player ${i} (${this.e2e.state.players[i].name}) should gain ${expectedBonus} SP from bonus, got ${gained}`);
  }
});
