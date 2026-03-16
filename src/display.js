// ── Display Module ──
// Pure functions: (state) → string. All CLI formatting lives here.

import { totalBugs, totalTokens, dangerCheck } from './modules/board.js';

// ── Board Display ──

export function renderBoard(state) {
  const { phase, players, board } = state;
  const total = totalTokens(board);
  const zone = dangerCheck(board, 0).zone;
  const bugs = totalBugs(board);

  const lines = [];
  lines.push('');
  lines.push('═'.repeat(72));
  lines.push(`  SPRINT ${phase.sprint} / TURN ${phase.turn}                              Delivery: ${players.filter(p => !p.task).length}/${Math.floor(players.length / 2) + 1}`);
  lines.push('═'.repeat(72));
  lines.push('  Player       Task                      Effort  Skills        SP  Bugs');
  lines.push('─'.repeat(72));

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const marker = i === phase.activePlayer ? '>' : ' ';
    const name = p.name.padEnd(12);
    const taskName = p.task ? p.task.name.substring(0, 24).padEnd(24) : '-- none --'.padEnd(24);
    const effort = p.task ? String(p.effort).padEnd(6) : '--'.padEnd(6);
    const skills = `BE${p.skills.BE} DB${p.skills.DB} DO${p.skills.DO} FE${p.skills.FE}`;
    const sp = String(p.score).padStart(2);
    const bugStr = String(p.bugs).padStart(3);
    lines.push(`  ${marker} ${name} ${taskName} ${effort} ${skills.padEnd(13)} ${sp} ${bugStr}`);
  }

  lines.push('═'.repeat(72));
  lines.push(`  Board: ${bugs} bug${bugs !== 1 ? 's' : ''} + ${board.dissatisfaction} dissatisfaction = ${total} token${total !== 1 ? 's' : ''} (${zone})`);
  lines.push('═'.repeat(72));
  lines.push('');

  return lines.join('\n');
}

// ── Phase Result ──

export function renderPhaseResult(state, phaseType) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];
  const meta = state.meta;

  switch (phaseType) {
    case 'DRAW_MISFORTUNE': {
      const card = meta.lastDrawn;
      if (!card) return '  No misfortune card drawn (deck empty)';
      const cat = card.category || 'Lucky';
      const sev = card.severity;
      return `  Drew "${card.name}" (${cat} ${sev}, ${describeEffect(card)})`;
    }

    case 'CHECK_IMMUNITY': {
      const card = meta.lastDrawn;
      if (meta.immune) {
        const cat = card?.category || '?';
        return `  ${player.name} is immune to ${cat} (level ${player.skills[cat] || 0}) — effect skipped`;
      }
      return `  ${player.name} is not immune — effect will resolve`;
    }

    case 'RESOLVE_EFFECT': {
      const eff = meta.effectResolution;
      if (!eff) return '  No effect';
      switch (eff.type) {
        case 'effort_added': return `  Effect: +${eff.amount} effort`;
        case 'effort_reduced': return `  Effect: -${eff.amount} effort`;
        case 'skip': return `  Effect: skip turn`;
        case 'skip_bug': return `  Effect: skip turn + ${eff.amount} bug${eff.amount !== 1 ? 's' : ''}`;
        case 'bug': return `  Effect: +${eff.amount} bug${eff.amount !== 1 ? 's' : ''}`;
        case 'discard_task': return `  Effect: task discarded!`;
        case 'lose_sp': return `  Effect: -${eff.amount} SP`;
        case 'two_actions': return `  Effect: lucky! Two actions this turn`;
        case 'instant_complete': return `  Effect: lucky! Task completed instantly`;
        case 'grant_sp': return `  Effect: lucky! +${eff.amount} SP directly`;
        case 'no_effect': return `  Effect: no effect (${eff.reason})`;
        default: return `  Effect: ${eff.type}`;
      }
    }

    case 'CHECK_COMPLETION': {
      const qa = meta.qaResult;
      if (!qa) return '  Task not at zero effort — no QA check';
      if (qa.autoPass) return `  QA check: auto-pass (gap 0)`;
      if (qa.passed) return `  QA check: gap ${qa.gap}, rolled ${qa.roll} — PASSED!`;
      return `  QA check: gap ${qa.gap}, rolled ${qa.roll} — BOUNCED! (effort → 1, +1 bug)`;
    }

    case 'SCORE_TASK': {
      if (meta.scored) return `  Task scored: +${meta.scoredPoints} SP`;
      return '  No task to score';
    }

    case 'EXECUTE_ACTION': {
      const action = meta.executedAction;
      if (!action) return '  No action executed';
      switch (action.type) {
        case 'DEVELOP': return `  ${player.name} develops — effort -1`;
        case 'SKILL_UP': return `  ${player.name} skills up ${action.skill}`;
        case 'PAY_DEBT': return `  ${player.name} pays tech debt — removed 1 token`;
        case 'PROPER_REVIEW': return `  ${player.name} reviews a PR`;
        case 'LGTM': return `  ${player.name} LGTMs all review cards`;
        default: return `  ${player.name} does ${action.type}`;
      }
    }

    default:
      return '';
  }
}

function describeEffect(card) {
  switch (card.effectType) {
    case 'effort': return `+${card.effectValue} effort`;
    case 'skip': return 'skip';
    case 'skip_be': return 'skip if BE task';
    case 'skip_db': return 'skip if DB task';
    case 'bug': return `+${card.effectValue} bug${card.effectValue !== 1 ? 's' : ''}`;
    case 'skip_bug': return `skip + ${card.effectValue} bug${card.effectValue !== 1 ? 's' : ''}`;
    case 'discard': return 'discard task';
    case 'lose_sp': return `-${card.effectValue} SP`;
    case 'two_actions': return 'two actions';
    case 'reduce_effort': return `-${card.effectValue} effort`;
    case 'instant_complete': return 'instant complete';
    case 'integration_effort': return `+${card.effectValue} effort (integration)`;
    case 'grant_sp': return `+${card.effectValue} SP`;
    default: return card.effectType;
  }
}

// ── Action Menu ──

export function renderActionMenu(legalActions, state) {
  const pi = state.phase.activePlayer;
  const player = state.players[pi];
  const total = totalTokens(state.board);

  const lines = [`  ${player.name}'s actions:`];

  for (let i = 0; i < legalActions.length; i++) {
    const a = legalActions[i];
    const num = `  ${i + 1}.`;

    switch (a.type) {
      case 'DEVELOP':
        lines.push(`${num} DEVELOP        effort ${player.effort} → ${player.effort - 1}`);
        break;
      case 'SKILL_UP': {
        const cur = player.skills[a.skill] || 0;
        const nxt = cur + 1;
        const mod = nxt === 1 ? '+0 eff, immune' : nxt === 2 ? '+0 eff, QA auto' : nxt === 3 ? '-1 eff' : '';
        lines.push(`${num} SKILL UP ${a.skill.padEnd(4)} level ${cur} → ${nxt} (${mod})`);
        break;
      }
      case 'PAY_DEBT':
        lines.push(`${num} PAY DEBT       remove 1 token (${total} on board)`);
        break;
      case 'PROPER_REVIEW':
        lines.push(`${num} PROPER REVIEW  remove 1 from review pile (${player.reviewPile.length} cards)`);
        break;
      case 'LGTM':
        lines.push(`${num} LGTM           clear all review cards (${player.reviewPile.length} cards)`);
        break;
      default:
        lines.push(`${num} ${a.type}`);
    }
  }

  lines.push(`  Choose [1-${legalActions.length}]: `);
  return lines.join('\n');
}

// ── Freeze Steps ──

export function renderFreezeStep(state, freezeType) {
  const { players, board, meta } = state;

  switch (freezeType) {
    case 'RESOLVE_UNREVIEWED': {
      const parts = players.map(p => {
        const count = p.reviewPile.length;
        return count > 0 ? `${p.name} ${count} (+${count} bugs)` : `${p.name} 0`;
      });
      return `  Unreviewed MRs: ${parts.join(', ')}`;
    }

    case 'RESOLVE_DELIVERY': {
      const dr = meta.deliveryResult;
      if (!dr) return '  Delivery check completed';
      const status = dr.met ? 'MET!' : `MISSED! +${dr.deficit} dissatisfaction`;
      return `  Delivery: ${dr.completed}/${dr.target} — ${status}`;
    }

    case 'RESOLVE_BONUS': {
      const br = meta.bonusResult;
      if (!br) return '  Sprint bonus calculated';
      const names = br.players.map(i => players[i].name).join(', ');
      if (br.type === 'sole_zero') {
        return `  Sprint Bonus: ${names} has 0 bugs — +${br.bonus} SP`;
      }
      return `  Sprint Bonus: ${names} tied fewest bugs — +${br.bonus} SP each`;
    }

    case 'RESOLVE_DANGER': {
      const dr = meta.dangerResult;
      if (!dr) return '  Danger check completed';
      if (dr.survived) {
        if (dr.rollNeeded === null) {
          return `  Danger Check: ${dr.total} tokens (${dr.zone}) — survived!`;
        }
        return `  Danger Check: ${dr.total} tokens (${dr.zone}), rolled ${dr.roll} (need ${dr.rollNeeded}+) — survived!`;
      }
      if (dr.rollNeeded === 'auto') {
        return `  Danger Check: ${dr.total} tokens (${dr.zone}) — DEAD! Auto-death at 18+ tokens`;
      }
      return `  Danger Check: ${dr.total} tokens (${dr.zone}), rolled ${dr.roll} (die on ${dr.rollNeeded}+) — DEAD!`;
    }

    default:
      return '';
  }
}

// ── Game End ──

export function renderGameEnd(state) {
  const { phase, players } = state;
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  const lines = [''];
  lines.push('═'.repeat(40));

  if (phase.game === 'GAME_WON') {
    lines.push('  GAME WON — 4 sprints survived!');
  } else {
    lines.push('  GAME OVER — project died!');
    const dr = state.meta.dangerResult;
    if (dr) {
      lines.push(`  Danger: ${dr.total} tokens (${dr.zone}), rolled ${dr.roll}`);
    }
  }

  lines.push('═'.repeat(40));
  lines.push('  Final Scores:');

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const rank = `  ${i + 1}.`;
    const mark = p === winner ? ' ★ WINNER' : '';
    lines.push(`${rank} ${p.name.padEnd(12)} ${String(p.score).padStart(3)} SP${mark}`);
  }

  lines.push('');
  return lines.join('\n');
}
