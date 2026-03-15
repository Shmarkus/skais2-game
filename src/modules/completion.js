// ── Completion Module ──
// QA check, task scoring, bounce. Pure functions.
// Depends on skills module for qaGap.

import { qaGap } from './skills.js';

export function qaCheck(skillConfigs, playerSkills, task, roll) {
  const gap = qaGap(skillConfigs, playerSkills, task);

  if (gap === 0) {
    return { passed: true, gap, roll: null, autoPass: true };
  }

  const passed = roll > gap;
  return { passed, gap, roll, autoPass: false, bounced: !passed };
}

export function scoreTask(player, task) {
  return {
    ...player,
    score: player.score + task.storyPoints,
    task: null,
    effort: 0,
  };
}

export function bounceTask(player) {
  return {
    ...player,
    effort: 1,
  };
}
