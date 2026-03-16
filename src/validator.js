// ── Validation Result ──

export function ok() {
  return { valid: true, error: null };
}

export function fail(error) {
  return { valid: false, error };
}

// ── Individual Validators ──
// Each takes (state, action) and returns ok() or fail()

export function validateGameRunning(state, action) {
  if (state.phase.game !== 'PLAYING') {
    return fail(`Game is ${state.phase.game}, not PLAYING`);
  }
  return ok();
}

export function validateActivePlayer(state, action) {
  if (action.player !== undefined && action.player !== state.phase.activePlayer) {
    return fail(`Not player ${action.player}'s turn (active: ${state.phase.activePlayer})`);
  }
  return ok();
}

export function validatePhaseAcceptsAction(state, action) {
  const step = state.phase.step;

  // Phase-based auto-actions (no player choice involved)
  const autoActions = {
    'DRAW_MISFORTUNE': ['DRAW_MISFORTUNE'],
    'CHECK_IMMUNITY': ['CHECK_IMMUNITY'],
    'RESOLVE_EFFECT': ['RESOLVE_EFFECT'],
    'CHECK_COMPLETION': ['CHECK_COMPLETION'],
    'EXECUTE_ACTION': ['EXECUTE_ACTION'],
    'SCORE_TASK': ['SCORE_TASK'],
    'END_TURN': ['END_TURN'],
    'MERGE_FREEZE_UNREVIEWED': ['RESOLVE_UNREVIEWED'],
    'MERGE_FREEZE_DELIVERY': ['RESOLVE_DELIVERY'],
    'MERGE_FREEZE_BONUS': ['RESOLVE_BONUS'],
    'MERGE_FREEZE_DANGER': ['RESOLVE_DANGER'],
  };

  // Player choice actions
  const playerActions = {
    'AWAITING_ACTION': ['DEVELOP', 'SKILL_UP', 'PAY_DEBT', 'PROPER_REVIEW', 'LGTM'],
  };

  const allowed = autoActions[step] || playerActions[step];

  if (!allowed) {
    return fail(`Unknown phase: ${step}`);
  }

  if (!allowed.includes(action.type)) {
    return fail(`Action '${action.type}' not allowed in phase '${step}'. Allowed: ${allowed.join(', ')}`);
  }

  return ok();
}

export function validateActionPreconditions(state, action) {
  const player = state.players[state.phase.activePlayer];

  switch (action.type) {
    case 'DEVELOP':
      if (!player.task) return fail('No active task');
      if (player.effort <= 0) return fail('Task already at zero effort');
      return ok();

    case 'SKILL_UP': {
      const progress = player.skillUpProgress;
      if (progress) {
        // Mid-redemption: continue (no skill choice needed unless final step)
        const isFinalStep = progress.progress + 1 >= progress.tier;
        if (isFinalStep) {
          // Final step needs a skill
          const skill = action.skill;
          if (!skill) return fail('No skill specified for final redemption step');
          const skillDef = state.config.skills.find(s => s.id === skill);
          if (!skillDef) return fail(`Unknown skill: ${skill}`);
          const currentLevel = player.skills[skill] || 0;
          if (currentLevel >= skillDef.maxLevel) return fail(`${skill} already at max level ${skillDef.maxLevel}`);
        }
        return ok();
      }
      // New redemption: need tokens in pool
      const pool = state.tokenPool;
      if (!pool || (pool.tier1 <= 0 && pool.tier2 <= 0 && pool.tier3 <= 0)) {
        return fail('No skill tokens available in pool');
      }
      // Tier 1 is instant — needs skill choice now
      if (pool.tier1 > 0) {
        const skill = action.skill;
        if (!skill) return fail('No skill specified');
        const skillDef = state.config.skills.find(s => s.id === skill);
        if (!skillDef) return fail(`Unknown skill: ${skill}`);
        const currentLevel = player.skills[skill] || 0;
        if (currentLevel >= skillDef.maxLevel) return fail(`${skill} already at max level ${skillDef.maxLevel}`);
      }
      // Tier 2/3: no skill needed yet (chosen at end)
      return ok();
    }

    case 'PAY_DEBT': {
      const bugCount = (state.board.playerBugs || []).reduce((sum, b) => sum + b, 0);
      const totalTokens = bugCount + (state.board.dissatisfaction || 0);
      if (totalTokens <= 0) return fail('No tokens on the board to remove');
      return ok();
    }

    case 'PROPER_REVIEW':
      if (!player.reviewPile || player.reviewPile.length === 0) return fail('Review pile is empty');
      return ok();

    case 'LGTM':
      if (!player.reviewPile || player.reviewPile.length === 0) return fail('Review pile is empty');
      return ok();

    default:
      // Auto-actions and freeze actions have no player-facing preconditions
      return ok();
  }
}

// ── Validator Composition ──

export function composeValidators(...validators) {
  return function validate(state, action) {
    for (const v of validators) {
      const result = v(state, action);
      if (!result.valid) return result;
    }
    return ok();
  };
}

// ── Default Validator ──

export const validateAction = composeValidators(
  validateGameRunning,
  validateActivePlayer,
  validatePhaseAcceptsAction,
  validateActionPreconditions,
);

// ── Query: what actions are legal right now? ──

export function getLegalActions(state) {
  if (state.phase.game !== 'PLAYING') return [];
  if (state.phase.step !== 'AWAITING_ACTION') return [];

  const pi = state.phase.activePlayer;
  const player = state.players[pi];

  // Mid-redemption: only SKILL_UP is allowed
  if (player.skillUpProgress) {
    const progress = player.skillUpProgress;
    const isFinalStep = progress.progress + 1 >= progress.tier;
    if (isFinalStep) {
      // Final step: show skill variants
      const legal = [];
      for (const skill of state.config.skills) {
        const action = { type: 'SKILL_UP', skill: skill.id, player: pi };
        if (validateActionPreconditions(state, action).valid) {
          legal.push(action);
        }
      }
      return legal;
    }
    // Non-final: just one SKILL_UP (continue) option
    return [{ type: 'SKILL_UP', player: pi }];
  }

  const candidates = ['DEVELOP', 'SKILL_UP', 'PAY_DEBT', 'PROPER_REVIEW', 'LGTM'];
  const legal = [];

  for (const type of candidates) {
    if (type === 'SKILL_UP') {
      const pool = state.tokenPool;
      if (!pool || (pool.tier1 <= 0 && pool.tier2 <= 0 && pool.tier3 <= 0)) {
        continue; // No tokens available
      }
      if (pool.tier1 > 0) {
        // Tier 1 instant: show skill variants
        for (const skill of state.config.skills) {
          const action = { type: 'SKILL_UP', skill: skill.id, player: pi };
          if (validateActionPreconditions(state, action).valid) {
            legal.push(action);
          }
        }
      } else {
        // Tier 2/3: one generic SKILL_UP (skill chosen at end)
        legal.push({ type: 'SKILL_UP', player: pi });
      }
    } else {
      const action = { type, player: pi };
      if (validateActionPreconditions(state, action).valid) {
        legal.push(action);
      }
    }
  }

  return legal;
}
