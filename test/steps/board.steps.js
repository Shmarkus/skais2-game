import { Given, When, Then, Before } from '@cucumber/cucumber';
import assert from 'assert';
import { createBoard, addBug, removeBug, addDissatisfaction, totalTokens, playerBugCount, dangerCheck, deliveryTarget, deliveryCheck, sprintBonus } from '../../src/modules/board.js';
import { createGameConfig } from '../../src/config.js';

Before(function () {
  if (!this.board) this.board = null;
  if (!this.deliveryResult) this.deliveryResult = null;
  if (!this.bonusResult) this.bonusResult = null;
  if (!this.dangerResult) this.dangerResult = null;
  if (!this.playerCount) this.playerCount = 5;
});

Given('a game with {int} players', function (count) {
  this.playerCount = count;
  this.board = createBoard(count);
  if (!this.config) this.config = createGameConfig();
});

Given('the team completed {int} task(s) this sprint', function (count) {
  this.completedTasks = count;
});

Given('the board has {int} dissatisfaction tokens', function (n) {
  if (!this.board) this.board = createBoard(this.playerCount);
  this.board = addDissatisfaction(this.board, n);
});

Given('the board has {int} total tokens', function (n) {
  if (!this.board) this.board = createBoard(this.playerCount);
  this.board = addDissatisfaction(this.board, n);
});

Given('the board total is {int} tokens', function (n) {
  if (!this.board) this.board = createBoard(this.playerCount);
  this.board = addDissatisfaction(this.board, n);
});

Given('the board total is {int} at end of sprint {int}', function (total, sprint) {
  if (!this.board) this.board = createBoard(this.playerCount);
  this.board = addDissatisfaction(this.board, total);
});

Given('player {int} has {int} personal bugs on the board', function (pi, count) {
  if (!this.board) this.board = createBoard(this.playerCount);
  for (let i = 0; i < count; i++) {
    this.board = addBug(this.board, pi);
  }
});

Given('player {int} has {int} bugs and player {int} has {int} bugs', function (p1, b1, p2, b2) {
  if (!this.board) this.board = createBoard(this.playerCount);
  for (let i = 0; i < b1; i++) this.board = addBug(this.board, p1);
  for (let i = 0; i < b2; i++) this.board = addBug(this.board, p2);
});

Given('the board has {int} dissatisfaction', function (n) {
  if (!this.board) this.board = createBoard(this.playerCount);
  this.board = addDissatisfaction(this.board, n);
});

Given('end of sprint bug counts are {list}', function (list) {
  // Parse "[0, 1, 2, 1, 3]" format
  this.board = { playerBugs: JSON.parse(list), dissatisfaction: 0 };
});

When('delivery is checked', function () {
  this.deliveryResult = deliveryCheck(this.completedTasks, this.playerCount);
});

When('player {int} pays tech debt', function (pi) {
  const before = totalTokens(this.board);
  this.board = removeBug(this.board, pi);
  this.tokenDelta = totalTokens(this.board) - before;
});

When('danger check is performed', function () {
  this.dangerResult = dangerCheck(this.board, this.diceRoll);
});

When('sprint bonus is calculated', function () {
  this.bonusResult = sprintBonus(this.board);
});

Then('the delivery target should be {int}', function (expected) {
  assert.strictEqual(deliveryTarget(this.playerCount), expected);
});

Then('{int} dissatisfaction tokens should be added to the board', function (expected) {
  assert.strictEqual(this.deliveryResult.deficit, expected);
});

Then('the board should still have {int} dissatisfaction tokens', function (expected) {
  assert.strictEqual(this.board.dissatisfaction, expected);
});

Then('player {int} should have {int} personal bug(s) on the board', function (pi, expected) {
  assert.strictEqual(playerBugCount(this.board, pi), expected);
});

Then('the board total should decrease by {int}', function (delta) {
  assert.strictEqual(this.tokenDelta, -delta);
});

Then('the board total should be {int}', function (expected) {
  assert.strictEqual(totalTokens(this.board), expected);
});

Then('the zone should be {string}', function (expected) {
  assert.strictEqual(this.dangerResult.zone, expected);
});

Then('the project should survive', function () {
  assert.strictEqual(this.dangerResult.survived, true);
});

Then('the project should die', function () {
  assert.strictEqual(this.dangerResult.survived, false);
});

Then('player {int} should receive {int} bonus SP', function (pi, bonus) {
  assert.ok(this.bonusResult.players.includes(pi));
  assert.strictEqual(this.bonusResult.bonus, bonus);
});

Then('player {int} and player {int} should each receive {int} bonus SP', function (p1, p2, bonus) {
  assert.ok(this.bonusResult.players.includes(p1));
  assert.ok(this.bonusResult.players.includes(p2));
  assert.strictEqual(this.bonusResult.bonus, bonus);
});
