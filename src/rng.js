// ── Deterministic RNG ──
// Inject fixed sequences for reproducible games and E2E tests.

export function createSeededRng(seed) {
  // Simple mulberry32 PRNG
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSequenceRng(values) {
  let i = 0;
  return function () {
    if (i >= values.length) throw new Error(`RNG sequence exhausted after ${values.length} values`);
    return values[i++];
  };
}

export function createDiceSequence(rolls) {
  let i = 0;
  return function () {
    if (i >= rolls.length) throw new Error(`Dice sequence exhausted after ${rolls.length} rolls`);
    return rolls[i++];
  };
}

export function createRealDice() {
  return function () {
    return Math.floor(Math.random() * 6) + 1;
  };
}

export function createFixedDeck(cardIds, allCards) {
  return cardIds.map(id => {
    const card = allCards.find(c => c.id === id);
    if (!card) throw new Error(`Card not found: ${id}`);
    return card;
  });
}
