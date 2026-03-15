# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

SKAIS2: The Board Game — a satirical 5-player turn-based strategy game about Estonian social insurance system development. This project is a digital engine (ESM, Node 20) that can drive CLI play, web UI, and online multiplayer. The physical board game (v3) is complete; game rules are encoded as data in `src/config.js`.

## Commands

```bash
npm install
npm run test:unit          # 212 unit tests (custom runner, JUnit XML output)
npm run test:features      # Gherkin acceptance tests (Cucumber)
npm test                   # both sequentially

# Run a single unit test file directly:
node test/unit/skills.test.js
node test/unit/modules.test.js

# Run a single Gherkin feature:
npx cucumber-js --import test/steps/*.js test/features/board.feature
```

## Architecture

**Reducer pattern** — the entire game is `(state, action) → newState`:

```
Transport (CLI / REST / WebSocket)
  ↓ action
Validator (is this legal?)
  ↓ validated action
Reducer (apply to state, return new state)     ← TODO
  ↓ new state
Presentation (CLI / React / spectator)
```

**Key principles:**
- All game state is a single serializable object
- All game logic is pure functions (no side effects in modules)
- State machines are the exception: classes with mutable internal state
- Decks and dice are injectable for deterministic testing
- Skills/tasks/cards are configured as data, not hardcoded

## Core Patterns

### Validator composition
Validators return `{ valid, error }`. Chain them with `composeValidators(...fns)` which short-circuits on first failure. Each validator is `(state, action) → { valid, error }`.

### RNG injection
Modules accept an optional `rng` parameter (default `Math.random`). For deterministic tests use `createSequenceRng([0.5, 0.3])`, `createDiceSequence([6, 1, 4])`, or `createSeededRng(42)` from `src/rng.js`.

### Misfortune extension registry
Effect handlers are a mutable dictionary keyed by `card.effectType`. Each handler is `(player, board, card, context) → { playerPatch?, boardPatch?, meta }` — returns patches, never mutates. Register new effects with `registerEffect(name, handler)`.

### Three nested state machines
`GameStateMachine` → `SprintStateMachine` → `TurnStateMachine`. Game has 4 sprints × 4 turns × N players. Turn phases: `DRAW_MISFORTUNE → CHECK_IMMUNITY → RESOLVE_EFFECT → CHECK_COMPLETION → AWAITING_ACTION → EXECUTE_ACTION → SCORE_TASK → END_TURN`. Sprint ends with merge freeze sequence.

### Custom test framework
No external test library — tests use a bespoke `test(name, fn)` / `assert(cond, msg)` pattern. Each test file is self-contained and prints `"N passed, M failed"` parsed by `test/unit/run.js`.

## Game Rules (v3)

- 2-10 players, 4 sprints × 4 turns
- 4 skills: BE, DB, DO, FE (levels 0-3)
- Effort modifiers: +1/+0/+0/-1 per skill level; minimum effort = 1
- Immunity: BE/DB/DO at level 1+; FE never (intentional trap — no misfortune cards)
- QA: skills below level 2 = gap; roll d6 > gap to pass; else bounce (effort→1, +1 bug)
- Delivery target: `⌊players÷2⌋+1` per sprint
- Danger zone: 0-7 safe, 8-9 die on 6, 10-11 on 5+, ... 18+ auto-death (lookup table in config)
- 32 misfortune cards: 14 minor, 10 major, 4 catastrophic, 4 lucky
- Actions: Develop, Skill Up, Pay Debt, Proper Review, LGTM

## What's Next (in order)

1. **Reducer** — `reduce(state, action) → newState`. Wire modules together.
2. **Pending Gherkin steps** (turns.steps.js, freeze.feature) — implement with reducer
3. **CLI interface** — readline-based game loop
4. **AI player** — `(state, legalActions) → action` pure function
5. **E2E tests** — full game scripts with fixed decks and dice
