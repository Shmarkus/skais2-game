import { Given, When, Then, Before } from '@cucumber/cucumber';
import assert from 'assert';
import { calculateEffort, isImmuneTo, qaGap, canLevelUp, levelUp } from '../../src/modules/skills.js';
import { qaCheck } from '../../src/modules/completion.js';
import { SKILLS, TASKS, MISFORTUNE_CARDS, createGameConfig } from '../../src/config.js';

Before(function () {
  this.config = null;
  this.skills = null;
  this.playerSkills = {};
  this.task = null;
  this.card = null;
  this.diceRoll = null;
  this.result = null;
});

Given('a standard game configuration', function () {
  this.config = createGameConfig();
  this.skills = this.config.skills;
});

Given('a game with skills BE, DB, DO, FE', function () {
  this.config = createGameConfig();
  this.skills = this.config.skills;
});

Given('a player with {word} at level {int}', function (skillId, level) {
  this.playerSkills[skillId] = level;
});

Given('a player with {word} at level {int} and {word} at level {int}', function (s1, l1, s2, l2) {
  this.playerSkills[s1] = l1;
  this.playerSkills[s2] = l2;
});

Given('a player with {word} at level {int} and {word} at level {int} and {word} at level {int}', function (s1, l1, s2, l2, s3, l3) {
  this.playerSkills[s1] = l1;
  this.playerSkills[s2] = l2;
  this.playerSkills[s3] = l3;
});

Given('a player with {word}', function (skillSpec) {
  // Parses "BE:0,DB:2,FE:1" format
  for (const part of skillSpec.split(',')) {
    const [id, level] = part.split(':');
    this.playerSkills[id] = parseInt(level, 10);
  }
});

Given('a task requiring {word} with base effort {int}', function (skillSpec, baseEffort) {
  this.task = {
    requiredSkills: skillSpec.split(' and ').map(s => s.trim()),
    baseEffort,
    storyPoints: 3,
  };
});

Given('a task requiring {word} and {word} with base effort {int}', function (s1, s2, baseEffort) {
  this.task = { requiredSkills: [s1, s2], baseEffort, storyPoints: 3 };
});

Given('a task requiring {word} and {word}', function (s1, s2) {
  this.task = { requiredSkills: [s1, s2], baseEffort: 2, storyPoints: 3 };
});

Given('a task requiring {word}', function (skillSpec) {
  const skills = skillSpec.includes(',') ? skillSpec.split(',') : skillSpec.split(' and ');
  this.task = { requiredSkills: skills.map(s => s.trim()), baseEffort: 2, storyPoints: 3 };
});

Given('a misfortune card in category {word}', function (category) {
  this.card = { category, severity: 'MINOR' };
});

Given('a lucky break misfortune card', function () {
  this.card = { category: null, severity: 'LUCKY' };
});

Given('the dice will roll {int}', function (roll) {
  this.diceRoll = roll;
});

When('effort is calculated', function () {
  this.result = calculateEffort(this.skills, this.playerSkills, this.task);
});

When('immunity is checked', function () {
  this.result = isImmuneTo(this.skills, this.playerSkills, this.card.category);
});

When('QA gap is calculated', function () {
  this.result = qaGap(this.skills, this.playerSkills, this.task);
});

When('QA check is performed', function () {
  this.result = qaCheck(this.skills, this.playerSkills, this.task, this.diceRoll);
});

When('the player levels up {word}', function (skillId) {
  this.playerSkills = levelUp(this.playerSkills, skillId);
});

Then('the final effort should be {int}', function (expected) {
  assert.strictEqual(this.result, expected);
});

Then('the player should be immune', function () {
  assert.strictEqual(this.result, true);
});

Then('the player should not be immune', function () {
  assert.strictEqual(this.result, false);
});

Then('the gap should be {int}', function (expected) {
  assert.strictEqual(this.result, expected);
});

Then('the task should auto-pass', function () {
  assert.strictEqual(this.result.passed, true);
  assert.strictEqual(this.result.autoPass, true);
});

Then('the task should bounce', function () {
  assert.strictEqual(this.result.passed, false);
  assert.strictEqual(this.result.bounced, true);
});

Then('the task should pass', function () {
  assert.strictEqual(this.result.passed, true);
});

Then('{word} should be at level {int}', function (skillId, level) {
  assert.strictEqual(this.playerSkills[skillId], level);
});

Then('leveling up {word} should not be allowed', function (skillId) {
  const config = this.skills.find(s => s.id === skillId);
  const level = this.playerSkills[skillId] || 0;
  assert.strictEqual(canLevelUp(config, level), false);
});

Then('the game should have {int} skill tracks', function (count) {
  assert.strictEqual(this.skills.length, count);
});

Then('each player should start at level {int} in all skills', function (level) {
  // Verify default is 0 for all skills (convention: missing key = 0)
  for (const skill of this.skills) {
    assert.strictEqual(this.playerSkills[skill.id] || 0, level);
  }
});

Then('the player should not be immune to any misfortune category', function () {
  for (const skill of this.skills) {
    if (skill.hasMisfortune) {
      const immune = isImmuneTo(this.skills, this.playerSkills, skill.id);
      assert.strictEqual(immune, false, `Should not be immune to ${skill.id}`);
    }
  }
});
