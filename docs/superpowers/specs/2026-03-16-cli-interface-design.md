# CLI Interface Design

## Goal

A readline-based CLI that lets 2-10 players play SKAIS2 in a terminal, mirroring the physical board game experience. Step-by-step by default, with `--fast-forward` to skip auto-phases.

## Architecture

Three files with clear separation:

- **`src/display.js`** — Pure functions: `(state) → string`. All formatting logic lives here. Testable without I/O.
- **`src/cli-io.js`** — Thin readline wrapper. Only file with side effects. Exports `prompt(question) → Promise<string>`, `print(text)`, `clear()`.
- **`src/cli.js`** — Entry point. Arg parsing, game loop. Wires display + io + reducer.

### Dependency flow

```
cli.js → cli-io.js (I/O)
       → display.js (formatting)
       → reducer.js (game logic)
       → validator.js (getLegalActions)
```

## CLI Usage

```
node src/cli.js <name1> <name2> [...names] [--seed N] [--fast-forward]
```

- 2-10 player names required
- `--seed N` — deterministic RNG via `createSeededRng(N)`
- `--fast-forward` — auto-actions execute without waiting for Enter

Errors: print usage and exit with code 1.

## Game Loop

```
createInitialState(names, config, rng)
loop:
  if game over/won → renderGameEnd(state), exit
  if AWAITING_ACTION → renderBoard(state), renderActionMenu(actions), prompt for choice
  if freeze phase → renderFreezeStep(state), auto-dispatch (Enter or auto in ff)
  if auto-action → renderPhaseResult(state), wait for Enter (or auto in ff), dispatch
  reduce(state, action) → new state
```

## Display Functions

### `renderBoard(state) → string`

Compact table shown before each player action:

```
══════════════════════════════════════════════════════════════
  SPRINT 1 / TURN 2                          Delivery: 0/3
══════════════════════════════════════════════════════════════
  Player      Task                 Effort  Skills       SP  Bugs
  > Alice     REST API Pagination  ██░░ 2  BE1 DB0 DO0 FE0  3   0
    Bob       Query Optimization   ███░ 3  BE0 DB1 DO0 FE0  0   1
    Carol     Pipeline Template    █░░░ 1  BE0 DB0 DO1 FE0  2   0
══════════════════════════════════════════════════════════════
  Board: 1 bug + 0 dissatisfaction = 1 token (Safe)
══════════════════════════════════════════════════════════════
```

- `>` marks active player
- Effort shown as progress bar + number
- Skills as compact `BE1 DB0 DO0 FE0`
- Danger zone name shown with token count

### `renderPhaseResult(state) → string`

One-line summary of what just happened in an auto-phase:

```
  Drew "Merge Conflict" (BE MINOR, +1 effort)
  Alice is immune to BE (level 1) — effect skipped
  Effect resolved: +1 effort (effort now 4)
  QA check: gap 1, rolled 4 — PASSED!
  Task scored: +3 SP (total: 6)
```

### `renderActionMenu(legalActions, state) → string`

Numbered list with context:

```
  Your actions:
    1. DEVELOP        effort 3 → 2
    2. SKILL UP BE    level 0 → 1 (+0 eff, immune)
    3. SKILL UP DB    level 0 → 1 (+0 eff, immune)
    4. SKILL UP DO    level 0 → 1 (+0 eff, immune)
    5. SKILL UP FE    level 0 → 1 (+0 eff)
    6. PAY DEBT       remove 1 token (1 on board)
  Choose [1-6]:
```

### `renderFreezeStep(state) → string`

Freeze phase results:

```
  ═══ MERGE FREEZE ═══
  Unreviewed MRs: Alice 0, Bob 2 (+2 bugs), Carol 0
  Delivery: 2/3 — MISSED! +1 dissatisfaction
  Sprint Bonus: Bob has fewest bugs (1) — +1 SP
  Danger Check: 4 tokens (Safe) — survived!
  ═══ SPRINT 2 BEGINS ═══
```

### `renderGameEnd(state) → string`

```
  ════════════════════════════
    GAME WON — 4 sprints survived!
  ════════════════════════════
  Final Scores:
    1. Alice   15 SP  ★ WINNER
    2. Carol   12 SP
    3. Bob      8 SP
```

Or on death:

```
  ════════════════════════════
    GAME OVER — project died!
  ════════════════════════════
  Danger check: 12 tokens (Critical), rolled 4 — DEAD
  Final Scores:
    ...
```

## Testing Strategy

Unit tests for `display.js` only — pure functions with deterministic input/output:

- `renderBoard`: assert contains player names, skill levels, effort, SP, active marker
- `renderPhaseResult`: assert describes the phase outcome correctly for each phase type
- `renderActionMenu`: assert shows numbered actions with correct context
- `renderFreezeStep`: assert shows each freeze sub-step
- `renderGameEnd`: assert shows winner, scores, game outcome

`cli-io.js` is trivially thin (readline wrapper) — no tests needed.
`cli.js` game loop is tested via E2E: run with `--seed` and fixed input, assert output contains expected game flow.

## Arg Parsing

No external dependency. Manual parsing of `process.argv`:

```js
const args = process.argv.slice(2);
// extract --seed N, --fast-forward
// remaining args are player names
```
