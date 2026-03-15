import { Given, When, Then, Before } from '@cucumber/cucumber';
import assert from 'assert';
import { draw, isEmpty, size } from '../../src/modules/deck.js';
import { TASKS, MISFORTUNE_CARDS, createGameConfig } from '../../src/config.js';

Before(function () {
  if (!this.deck) this.deck = null;
  if (!this.drawnCards) this.drawnCards = [];
  if (!this.reshuffled) this.reshuffled = false;
});

Given('the task deck', function () {
  this.config = this.config || createGameConfig();
  this.deck = [...this.config.tasks];
});

Given('the misfortune deck', function () {
  this.config = this.config || createGameConfig();
  this.deck = [...this.config.misfortuneCards];
});

Given('a deck with {int} cards', function (n) {
  this.deck = Array.from({ length: n }, (_, i) => ({ id: `C${i + 1}` }));
});

Given('a misfortune deck with {int} cards', function (n) {
  this.deck = Array.from({ length: n }, (_, i) => ({ id: `M${i + 1}` }));
  this.reshuffleTemplate = [...this.deck];
});

Given('a task deck ordered as {list}', function (idList) {
  const ids = typeof idList === 'string' ? idList.split(',').map(s => s.trim()) : idList;
  this.deck = ids.map(id => {
    const card = TASKS.find(t => t.id === id);
    return card || { id };
  });
});

When('{int} cards are drawn', function (n) {
  this.drawnCards = [];
  for (let i = 0; i < n; i++) {
    const result = draw(this.deck);
    if (result.card) {
      this.drawnCards.push(result.card);
      this.deck = result.remaining;
    }
  }
});

When('{int} cards are drawn with reshuffle enabled', function (n) {
  this.drawnCards = [];
  for (let i = 0; i < n; i++) {
    const result = draw(this.deck, this.reshuffleTemplate);
    if (result.card) {
      this.drawnCards.push(result.card);
      this.deck = result.remaining;
      if (result.reshuffled) this.reshuffled = true;
    }
  }
});

Then('it should contain {int} cards', function (expected) {
  assert.strictEqual(this.deck.length, expected);
});

Then('the deck should be empty', function () {
  assert.strictEqual(isEmpty(this.deck), true);
});

Then('the {nth} card should come from a reshuffled deck', function (nth) {
  assert.strictEqual(this.reshuffled, true);
});

Then('the cards should be {list} in that order', function (idList) {
  const ids = typeof idList === 'string' ? idList.split(',').map(s => s.trim()) : idList;
  const drawnIds = this.drawnCards.map(c => c.id);
  assert.deepStrictEqual(drawnIds, ids);
});

Then('no card should have category FE', function () {
  for (const card of this.deck) {
    assert.notStrictEqual(card.category, 'FE', `Card ${card.id} has category FE`);
  }
});

Then('exactly {int} tasks should require FE skill', function (expected) {
  const count = this.deck.filter(t => t.requiredSkills && t.requiredSkills.includes('FE')).length;
  assert.strictEqual(count, expected);
});

Then('exactly {int} tasks should be pure FE', function (expected) {
  const count = this.deck.filter(t =>
    t.requiredSkills && t.requiredSkills.length === 1 && t.requiredSkills[0] === 'FE'
  ).length;
  assert.strictEqual(count, expected);
});

Then('exactly {int} tasks should be BE\\/FE', function (expected) {
  const count = this.deck.filter(t =>
    t.requiredSkills && t.requiredSkills.includes('BE') && t.requiredSkills.includes('FE') && t.requiredSkills.length === 2
  ).length;
  assert.strictEqual(count, expected);
});

Then('exactly {int} tasks should be DO\\/FE', function (expected) {
  const count = this.deck.filter(t =>
    t.requiredSkills && t.requiredSkills.includes('DO') && t.requiredSkills.includes('FE') && t.requiredSkills.length === 2
  ).length;
  assert.strictEqual(count, expected);
});
