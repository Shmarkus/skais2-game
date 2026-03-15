// ── Board Module ──
// Shared board state: bug tokens, dissatisfaction, danger zone, delivery, sprint bonus.
// All functions are pure: (boardState, ...) → newBoardState or result.

// ── Bug Counter ──

export function addBug(board, playerIndex) {
  const newBugs = [...board.playerBugs];
  newBugs[playerIndex] = (newBugs[playerIndex] || 0) + 1;
  return { ...board, playerBugs: newBugs };
}

export function removeBug(board, playerIndex) {
  const newBugs = [...board.playerBugs];
  if (newBugs[playerIndex] > 0) {
    newBugs[playerIndex] -= 1;
  }
  return { ...board, playerBugs: newBugs };
}

export function addDissatisfaction(board, amount) {
  return { ...board, dissatisfaction: board.dissatisfaction + amount };
}

export function removeDissatisfaction(board) {
  if (board.dissatisfaction > 0) {
    return { ...board, dissatisfaction: board.dissatisfaction - 1 };
  }
  return board;
}

export function totalBugs(board) {
  return board.playerBugs.reduce((sum, b) => sum + b, 0);
}

export function totalTokens(board) {
  return totalBugs(board) + board.dissatisfaction;
}

export function playerBugCount(board, playerIndex) {
  return board.playerBugs[playerIndex] || 0;
}

export function createBoard(playerCount) {
  return {
    playerBugs: new Array(playerCount).fill(0),
    dissatisfaction: 0,
  };
}

// ── Danger Zone ──

const DEFAULT_ZONES = [
  { min: 0,  max: 7,  name: 'Safe',     dieOn: null },
  { min: 8,  max: 9,  name: 'Warning',  dieOn: 6 },
  { min: 10, max: 11, name: 'Danger',   dieOn: 5 },
  { min: 12, max: 13, name: 'Critical', dieOn: 4 },
  { min: 14, max: 15, name: 'Severe',   dieOn: 3 },
  { min: 16, max: 17, name: 'Terminal', dieOn: 2 },
  { min: 18, max: Infinity, name: 'DEAD', dieOn: 0 },
];

export function dangerCheck(board, roll, zones = DEFAULT_ZONES) {
  const total = totalTokens(board);
  const zone = zones.find(z => total >= z.min && total <= z.max);

  if (!zone) return { zone: 'Unknown', survived: false, total };

  if (zone.dieOn === null) {
    return { zone: zone.name, survived: true, total, rollNeeded: null, roll: null };
  }

  if (zone.dieOn === 0) {
    return { zone: zone.name, survived: false, total, rollNeeded: 'auto', roll };
  }

  const survived = roll < zone.dieOn;
  return { zone: zone.name, survived, total, rollNeeded: zone.dieOn, roll };
}

// ── Delivery Target ──

export function deliveryTarget(playerCount) {
  return Math.floor(playerCount / 2) + 1;
}

export function deliveryCheck(completedTasks, playerCount) {
  const target = deliveryTarget(playerCount);
  const deficit = Math.max(0, target - completedTasks);
  return { target, completed: completedTasks, deficit, met: deficit === 0 };
}

// ── Sprint Bonus ──

export function sprintBonus(board) {
  const bugs = board.playerBugs;
  const min = Math.min(...bugs);
  const playersAtMin = bugs.reduce((indices, b, i) => {
    if (b === min) indices.push(i);
    return indices;
  }, []);

  if (min === 0 && playersAtMin.length === 1) {
    return { type: 'sole_zero', players: playersAtMin, bonus: 2 };
  }
  return { type: 'tied_fewest', players: playersAtMin, bonus: 1 };
}
