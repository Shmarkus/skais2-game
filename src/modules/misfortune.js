// ── Misfortune Module ──
// Effect resolution. Each effect type is a named function.
// The resolver dispatches by effect type — adding a new effect = adding one function.

import { isImmuneTo } from './skills.js';

export function checkImmunity(skillConfigs, playerSkills, card) {
  if (card.severity === 'LUCKY') return false;
  if (!card.category) return false;
  return isImmuneTo(skillConfigs, playerSkills, card.category);
}

// ── Effect Handlers ──
// Each returns a patch: { playerPatch?, boardPatch?, meta }
// Caller applies patches to state. Effects don't mutate anything.

const effectHandlers = {
  effort(player, board, card, context) {
    if (!player.task) return { meta: { type: 'no_effect', reason: 'no_task' } };
    return {
      playerPatch: { effort: player.effort + card.effectValue },
      meta: { type: 'effort_added', amount: card.effectValue },
    };
  },

  skip(player, board, card, context) {
    return { meta: { type: 'skip' } };
  },

  skip_be(player, board, card, context) {
    if (player.task && player.task.requiredSkills.includes('BE')) {
      return { meta: { type: 'skip', reason: 'be_task' } };
    }
    return { meta: { type: 'no_effect', reason: 'not_be_task' } };
  },

  skip_db(player, board, card, context) {
    if (player.task && player.task.requiredSkills.includes('DB')) {
      return { meta: { type: 'skip', reason: 'db_task' } };
    }
    return { meta: { type: 'no_effect', reason: 'not_db_task' } };
  },

  bug(player, board, card, context) {
    return {
      playerPatch: { bugs: player.bugs + card.effectValue },
      boardPatch: { addBugs: card.effectValue, playerIndex: context.playerIndex },
      meta: { type: 'bug', amount: card.effectValue },
    };
  },

  skip_bug(player, board, card, context) {
    return {
      playerPatch: { bugs: player.bugs + card.effectValue },
      boardPatch: { addBugs: card.effectValue, playerIndex: context.playerIndex },
      meta: { type: 'skip_bug', amount: card.effectValue },
    };
  },

  discard(player, board, card, context) {
    return {
      meta: { type: 'discard_task' },
    };
  },

  lose_sp(player, board, card, context) {
    return {
      playerPatch: { score: Math.max(0, player.score - card.effectValue) },
      meta: { type: 'lose_sp', amount: card.effectValue },
    };
  },

  two_actions(player, board, card, context) {
    return {
      meta: { type: 'two_actions', extraActions: 1 },
    };
  },

  reduce_effort(player, board, card, context) {
    if (!player.task) return { meta: { type: 'no_effect', reason: 'no_task' } };
    return {
      playerPatch: { effort: Math.max(0, player.effort - card.effectValue) },
      meta: { type: 'effort_reduced', amount: card.effectValue },
    };
  },

  instant_complete(player, board, card, context) {
    return {
      meta: { type: 'instant_complete' },
    };
  },

  grant_sp(player, board, card, context) {
    return {
      playerPatch: { score: player.score + card.effectValue },
      meta: { type: 'grant_sp', amount: card.effectValue },
    };
  },

  integration_effort(player, board, card, context) {
    const integrationTasks = context.integrationTaskIds || [];
    if (player.task && integrationTasks.includes(player.task.id)) {
      return {
        playerPatch: { effort: player.effort + card.effectValue },
        meta: { type: 'effort_added', amount: card.effectValue, reason: 'integration' },
      };
    }
    return { meta: { type: 'no_effect', reason: 'not_integration' } };
  },
};

export function resolveEffect(player, board, card, context = {}) {
  const handler = effectHandlers[card.effectType];
  if (!handler) {
    throw new Error(`Unknown effect type: ${card.effectType}`);
  }
  return handler(player, board, card, context);
}

export function isSkipEffect(meta) {
  return meta.type === 'skip' || meta.type === 'skip_bug';
}

export function isInstantComplete(meta) {
  return meta.type === 'instant_complete';
}

export function hasExtraActions(meta) {
  return meta.extraActions > 0;
}

// ── Register custom effect handler (extension point) ──

export function registerEffect(name, handler) {
  effectHandlers[name] = handler;
}
