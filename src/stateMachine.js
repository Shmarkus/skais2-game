// ── State Machine Core ──

export const TurnPhase = {
  DRAW_MISFORTUNE: 'DRAW_MISFORTUNE',
  CHECK_IMMUNITY: 'CHECK_IMMUNITY',
  RESOLVE_EFFECT: 'RESOLVE_EFFECT',
  CHECK_COMPLETION: 'CHECK_COMPLETION',
  AWAITING_ACTION: 'AWAITING_ACTION',
  EXECUTE_ACTION: 'EXECUTE_ACTION',
  SCORE_TASK: 'SCORE_TASK',
  END_TURN: 'END_TURN',
};

export const SprintPhase = {
  PLAYING: 'PLAYING',
  MERGE_FREEZE_UNREVIEWED: 'MERGE_FREEZE_UNREVIEWED',
  MERGE_FREEZE_DELIVERY: 'MERGE_FREEZE_DELIVERY',
  MERGE_FREEZE_BONUS: 'MERGE_FREEZE_BONUS',
  MERGE_FREEZE_DANGER: 'MERGE_FREEZE_DANGER',
  SPRINT_COMPLETE: 'SPRINT_COMPLETE',
};

export const GamePhase = {
  SETUP: 'SETUP',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
  GAME_WON: 'GAME_WON',
};

// ── Turn State Machine ──

export class TurnStateMachine {
  constructor(playerIndex, completionSource = null) {
    this.playerIndex = playerIndex;
    this.phase = TurnPhase.DRAW_MISFORTUNE;
    this.skipped = false;
    this.actionsRemaining = 1;
    this.completionSource = completionSource; // 'effect' or 'action'
  }

  transition(input) {
    const from = this.phase;

    switch (this.phase) {
      case TurnPhase.DRAW_MISFORTUNE:
        this.phase = TurnPhase.CHECK_IMMUNITY;
        break;

      case TurnPhase.CHECK_IMMUNITY:
        if (input.immune) {
          this.phase = TurnPhase.AWAITING_ACTION;
        } else {
          this.phase = TurnPhase.RESOLVE_EFFECT;
        }
        break;

      case TurnPhase.RESOLVE_EFFECT:
        if (input.skipped) {
          this.skipped = true;
        }
        if (input.extraActions) {
          this.actionsRemaining += input.extraActions;
        }
        if (input.instantComplete) {
          this.completionSource = 'effect';
          this.phase = TurnPhase.SCORE_TASK;
        } else {
          this.phase = TurnPhase.CHECK_COMPLETION;
          this.completionSource = 'effect';
        }
        break;

      case TurnPhase.CHECK_COMPLETION:
        if (input.completed) {
          this.phase = TurnPhase.SCORE_TASK;
        } else {
          // After effect: go to action (if not skipped)
          // After action: go to action only if actions remain
          if (this.completionSource === 'effect') {
            this.phase = this.skipped ? TurnPhase.END_TURN : TurnPhase.AWAITING_ACTION;
          } else {
            // post-action
            this.phase = (this.actionsRemaining > 0 && !this.skipped)
              ? TurnPhase.AWAITING_ACTION 
              : TurnPhase.END_TURN;
          }
        }
        break;

      case TurnPhase.SCORE_TASK:
        if (this.completionSource === 'effect' && !this.skipped) {
          this.phase = TurnPhase.AWAITING_ACTION;
        } else {
          this.phase = TurnPhase.END_TURN;
        }
        break;

      case TurnPhase.AWAITING_ACTION:
        if (this.actionsRemaining <= 0) {
          this.phase = TurnPhase.END_TURN;
        } else {
          this.actionsRemaining--;
          this.phase = TurnPhase.EXECUTE_ACTION;
        }
        break;

      case TurnPhase.EXECUTE_ACTION:
        this.completionSource = 'action';
        this.phase = TurnPhase.CHECK_COMPLETION;
        break;

      case TurnPhase.END_TURN:
        // Terminal — sprint machine handles what's next
        break;

      default:
        throw new Error(`Unknown phase: ${this.phase}`);
    }

    return { from, to: this.phase, playerIndex: this.playerIndex };
  }

  isTerminal() {
    return this.phase === TurnPhase.END_TURN;
  }

  isAwaitingInput() {
    return this.phase === TurnPhase.AWAITING_ACTION;
  }
}

// ── Sprint State Machine ──

export class SprintStateMachine {
  constructor(sprintNumber, playerCount, turnsPerSprint = 4) {
    this.sprintNumber = sprintNumber;
    this.playerCount = playerCount;
    this.turnsPerSprint = turnsPerSprint;
    this.phase = SprintPhase.PLAYING;
    this.currentTurn = 1;
    this.currentPlayerIndex = 0;
    this.turnMachine = new TurnStateMachine(0);
  }

  get currentPhase() {
    if (this.phase === SprintPhase.PLAYING) {
      return `S${this.sprintNumber}T${this.currentTurn}_P${this.currentPlayerIndex}_${this.turnMachine.phase}`;
    }
    return `S${this.sprintNumber}_${this.phase}`;
  }

  advancePlayer() {
    this.currentPlayerIndex++;
    if (this.currentPlayerIndex >= this.playerCount) {
      this.currentPlayerIndex = 0;
      this.currentTurn++;
      if (this.currentTurn > this.turnsPerSprint) {
        this.phase = SprintPhase.MERGE_FREEZE_UNREVIEWED;
        this.turnMachine = null;
        return;
      }
    }
    this.turnMachine = new TurnStateMachine(this.currentPlayerIndex);
  }

  transitionTurn(input) {
    if (this.phase !== SprintPhase.PLAYING) {
      throw new Error(`Cannot transition turn in phase: ${this.phase}`);
    }
    const result = this.turnMachine.transition(input);
    if (this.turnMachine.isTerminal()) {
      this.advancePlayer();
    }
    return result;
  }

  transitionFreeze(input) {
    const from = this.phase;

    switch (this.phase) {
      case SprintPhase.MERGE_FREEZE_UNREVIEWED:
        this.phase = SprintPhase.MERGE_FREEZE_DELIVERY;
        break;
      case SprintPhase.MERGE_FREEZE_DELIVERY:
        this.phase = SprintPhase.MERGE_FREEZE_BONUS;
        break;
      case SprintPhase.MERGE_FREEZE_BONUS:
        this.phase = SprintPhase.MERGE_FREEZE_DANGER;
        break;
      case SprintPhase.MERGE_FREEZE_DANGER:
        if (input.survived) {
          this.phase = SprintPhase.SPRINT_COMPLETE;
        } else {
          this.phase = SprintPhase.SPRINT_COMPLETE;
          return { from, to: this.phase, died: true };
        }
        break;
      default:
        throw new Error(`Not in freeze phase: ${this.phase}`);
    }

    return { from, to: this.phase, died: false };
  }

  isInFreeze() {
    return this.phase !== SprintPhase.PLAYING && this.phase !== SprintPhase.SPRINT_COMPLETE;
  }

  isComplete() {
    return this.phase === SprintPhase.SPRINT_COMPLETE;
  }

  isAwaitingInput() {
    return this.phase === SprintPhase.PLAYING && this.turnMachine && this.turnMachine.isAwaitingInput();
  }
}

// ── Game State Machine ──

export class GameStateMachine {
  constructor(playerCount, totalSprints = 4) {
    this.playerCount = playerCount;
    this.totalSprints = totalSprints;
    this.phase = GamePhase.SETUP;
    this.currentSprint = 0;
    this.sprintMachine = null;
  }

  start() {
    if (this.phase !== GamePhase.SETUP) {
      throw new Error(`Cannot start from phase: ${this.phase}`);
    }
    this.phase = GamePhase.PLAYING;
    this.currentSprint = 1;
    this.sprintMachine = new SprintStateMachine(1, this.playerCount);
  }

  advanceSprint() {
    this.currentSprint++;
    if (this.currentSprint > this.totalSprints) {
      this.phase = GamePhase.GAME_WON;
      this.sprintMachine = null;
    } else {
      this.sprintMachine = new SprintStateMachine(this.currentSprint, this.playerCount);
    }
  }

  transition(input) {
    if (this.phase !== GamePhase.PLAYING) {
      throw new Error(`Game not in PLAYING phase: ${this.phase}`);
    }

    if (this.sprintMachine.isInFreeze()) {
      const result = this.sprintMachine.transitionFreeze(input);
      if (result.died) {
        this.phase = GamePhase.GAME_OVER;
        return { ...result, gamePhase: this.phase };
      }
      if (this.sprintMachine.isComplete()) {
        this.advanceSprint();
      }
      return { ...result, gamePhase: this.phase };
    }

    const result = this.sprintMachine.transitionTurn(input);
    return { ...result, gamePhase: this.phase };
  }

  get currentPhase() {
    if (this.phase !== GamePhase.PLAYING) return this.phase;
    return this.sprintMachine.currentPhase;
  }

  isAwaitingInput() {
    return this.phase === GamePhase.PLAYING && this.sprintMachine && this.sprintMachine.isAwaitingInput();
  }

  isGameOver() {
    return this.phase === GamePhase.GAME_OVER || this.phase === GamePhase.GAME_WON;
  }
}
