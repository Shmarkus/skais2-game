// ── Deck Module ──
// Generic deck behavior. Works for task deck, misfortune deck, or any future deck.
// Decks are arrays. Operations return new arrays (immutable).

export function createDeck(cards, rng = Math.random) {
  return shuffle([...cards], rng);
}

export function shuffle(cards, rng = Math.random) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function draw(deck, reshuffleTemplate = null, rng = Math.random) {
  if (deck.length === 0) {
    if (reshuffleTemplate) {
      const reshuffled = shuffle([...reshuffleTemplate], rng);
      return { card: reshuffled[0], remaining: reshuffled.slice(1), reshuffled: true };
    }
    return { card: null, remaining: [], reshuffled: false };
  }
  return { card: deck[0], remaining: deck.slice(1), reshuffled: false };
}

export function isEmpty(deck) {
  return deck.length === 0;
}

export function size(deck) {
  return deck.length;
}
