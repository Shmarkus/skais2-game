import { Given, When, Then } from '@cucumber/cucumber';

// ── Turn flow steps ──
// These require the reducer to be implemented.
// Marked pending so they show as TODO in test output.

Given('it is player {int}\'s turn', function (pi) {
  return 'pending';
});

Given('player {int} has {word} at level {int}', function (pi, skill, level) {
  return 'pending';
});

Given(/^the next misfortune is (\w+) \((.+)\)$/, function (id, desc) {
  return 'pending';
});

Given('player {int} has a task with effort {int}', function (pi, effort) {
  return 'pending';
});

Given('player {int} has a task requiring {word} with effort {int}', function (pi, skill, effort) {
  return 'pending';
});

Given('player {int} has a task worth {int} SP', function (pi, sp) {
  return 'pending';
});

Given('the phase is AWAITING_ACTION for player {int}', function (pi) {
  return 'pending';
});

Given('the phase is DRAW_MISFORTUNE', function () {
  return 'pending';
});

When('misfortune is drawn', function () {
  return 'pending';
});

When('misfortune is drawn and resolved', function () {
  return 'pending';
});

When('player {int} chooses DEVELOP', function (pi) {
  return 'pending';
});

When('player {int} chooses SKILL_UP {word}', function (pi, skill) {
  return 'pending';
});

When('player {int} chooses PAY_DEBT', function (pi) {
  return 'pending';
});

When('player {int} tries to DEVELOP', function (pi) {
  return 'pending';
});

Then('player {int} should be immune', function (pi) {
  return 'pending';
});

Then('the phase should be {word}', function (phase) {
  return 'pending';
});

Then('player {int}\'s effort should be {int}', function (pi, effort) {
  return 'pending';
});

Then('player {int} should not get an action', function (pi) {
  return 'pending';
});

Then('the task should not be complete', function () {
  return 'pending';
});

Then('QA check should be performed', function () {
  return 'pending';
});

Then('the task should auto-pass QA', function () {
  return 'pending';
});

Then('the task should be scored', function () {
  return 'pending';
});

Then('{int} bug(s) should be added to the board', function (n) {
  return 'pending';
});

Then('player {int} should have {word} at level {int}', function (pi, skill, level) {
  return 'pending';
});

// board total covered by board.steps.js

Then('the action should be rejected', function () {
  return 'pending';
});

Then('the error should mention phase', function () {
  return 'pending';
});

Then('the error should mention player', function () {
  return 'pending';
});

Then('player {int} should have {int} actions available', function (pi, n) {
  return 'pending';
});

Then('player {int} should still have {int} action remaining', function (pi, n) {
  return 'pending';
});

Then('the turn should end', function () {
  return 'pending';
});

Then('player {int}\'s task should be completed', function (pi) {
  return 'pending';
});

Then('player {int} should gain {int} SP', function (pi, sp) {
  return 'pending';
});

Then('{int} bug(s) should be added \\(AI quality)', function (n) {
  return 'pending';
});

// ── Freeze steps ──

Given('sprint {int} turns are complete', function (sprint) {
  return 'pending';
});

Given('sprint turns are complete', function () {
  return 'pending';
});

Given('player {int} has {int} cards in their review pile', function (pi, n) {
  return 'pending';
});

Given('the team meets delivery target next sprint', function () {
  return 'pending';
});

Given('the team survives sprint {int}, {int}, {int}, and {int}', function (s1, s2, s3, s4) {
  return 'pending';
});

When('unreviewed MRs are resolved', function () {
  return 'pending';
});

When('delivery check is resolved', function () {
  return 'pending';
});

When('sprint bonus is resolved', function () {
  return 'pending';
});

When('danger check passes', function () {
  return 'pending';
});

Then('the game should advance to sprint {int}', function (sprint) {
  return 'pending';
});

Then('{int} bugs should be added to the board for player {int}', function (n, pi) {
  return 'pending';
});

Then('the game should be WON', function () {
  return 'pending';
});

Then('the game should be OVER', function () {
  return 'pending';
});

Then('the player with the most SP should be the winner', function () {
  return 'pending';
});

Then('no further actions should be accepted', function () {
  return 'pending';
});
