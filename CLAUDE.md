# SKAIS2: The Board Game — Digital Engine

## Project Context

This is a digital implementation of SKAIS2: The Board Game, a satirical 5-player turn-based strategy game about Estonian social insurance system development. The physical board game (v3) is complete; this project creates a digital engine that can drive CLI play, web UI, and online multiplayer.

## Architecture

**Reducer pattern** — the entire game is `(state, action) → newState`:

```
Transport (CLI / REST / WebSocket)
  ↓ action
Validator (is this legal?)
  ↓ validated action  
Reducer (apply to state, return new state)
  ↓ new state
Presentation (CLI / React / spectator)
```

**Key principles:**
- All game state is a single serializable object
- All game logic is pure functions (no side effects)
- State machine validates phase transitions
- Decks and dice are injectable for deterministic testing
- Skills are dynamic (configured, not hardcoded)

## Project Structure

```
src/
  config.js              — v3 game rules as data (skills, cards, zones)
  stateMachine.js        — phase transition engine (game/sprint/turn)
  validator.js           — composable action validation chain
  rng.js                 — deterministic RNG for testing
  modules/
    skills.js            — effort, immunity, QA gap, level up
    deck.js              — shuffle, draw, reshuffle
    board.js             — bugs, dissatisfaction, danger zone, delivery
    completion.js        — QA check, score task, bounce
    misfortune.js        — immunity, effect resolution, extension registry
  reducer.js             — TODO: (state, action) → newState
  cli.js                 — TODO: CLI game interface

test/
  unit/                  — 212 unit tests (all passing)
    run.js               — test runner
    stateMachine.test.js
    validator.test.js
    skills.test.js
    modules.test.js
  features/              — Gherkin specs (game rules as BDD)
    skills.feature       — skill system rules
    board.feature        — board, danger zone, delivery target
    turns.feature        — turn flow state machine (pending: needs reducer)
    freeze.feature       — merge freeze sequence (pending: needs reducer)  
    frontend.feature     — FE trap verification
    decks.feature        — deck management
  steps/                 — Cucumber step definitions
    parameters.js        — custom parameter types
    skills.steps.js      — skill system steps (implemented)
    board.steps.js       — board/danger steps (implemented)
    decks.steps.js       — deck steps (implemented)
    turns.steps.js       — turn flow steps (PENDING — implement with reducer)
```

## Commands

```bash
npm install
npm run test:unit        # 212 unit tests
npm run test:features    # Gherkin acceptance tests
npm test                 # both
npm run play             # CLI game (TODO)
```

## What's Done

- ✅ State machine (game/sprint/turn phase transitions)
- ✅ Validator (composable action validation chain)
- ✅ Skills module (effort, immunity, QA, level up)
- ✅ Deck module (shuffle, draw, reshuffle)
- ✅ Board module (bugs, dissatisfaction, danger zone, delivery, sprint bonus)
- ✅ Completion module (QA check, score, bounce)
- ✅ Misfortune module (immunity, 12 effect types, extension registry)
- ✅ Game config (all v3 rules as data)
- ✅ Deterministic RNG (seeded, sequenced, fixed decks)
- ✅ 212 unit tests passing
- ✅ Gherkin features for skills, board, decks, frontend
- ✅ Step definitions for skills, board, decks

## What's Next (in order)

1. **Reducer** — `reduce(state, action) → newState`. Wire modules together.
   - Turn flow: draw → immunity → resolve → completion → action → completion
   - Merge freeze: unreviewed → delivery → bonus → danger
   - All state transitions immutable
   
2. **Implement pending Gherkin steps** (turns.steps.js) using the reducer

3. **CLI interface** — readline-based, reads state, prompts for action

4. **AI player** — `(state, legalActions) → action` pure function

5. **E2E tests** — full game scripts with fixed decks and dice

## Game Rules (v3)

- 2-10 players, 4 sprints × 4 turns
- 4 skills: BE, DB, DO, FE (levels 0-3)
- Effort modifiers: +1/+0/+0/-1 per skill level
- Immunity: BE/DB/DO at level 1+; FE never (no misfortune cards)
- QA: skills below level 2 = gap; roll d6 > gap to pass; else bounce (effort→1, +1 bug)
- Delivery target: ⌊players÷2⌋+1 per sprint
- Danger zone: 0-7 safe, 8-9 die on 6, 10-11 on 5+, ... 18+ auto-death
- FE is intentional trap: 9/40 tasks, no misfortune, only effort+QA benefit
- 32 misfortune cards: 14 minor, 10 major, 4 catastrophic, 4 lucky
- Actions: Develop, Skill Up, Pay Debt, Proper Review, LGTM
