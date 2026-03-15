// ── Skills Module ──
// Everything about skill levels, effort calculation, immunity, and QA.
// Operates on skill config + player skill levels. No game state dependency.

export function effortModifier(skillConfig, level) {
  const mods = skillConfig.effortModifiers || { 0: 1, 1: 0, 2: 0, 3: -1 };
  return mods[Math.min(level, skillConfig.maxLevel)] ?? 0;
}

export function calculateEffort(skillConfigs, playerSkills, task) {
  const base = task.baseEffort;
  const modifier = task.requiredSkills.reduce((sum, skillId) => {
    const config = skillConfigs.find(s => s.id === skillId);
    const level = playerSkills[skillId] || 0;
    return sum + effortModifier(config, level);
  }, 0);
  return Math.max(1, base + modifier);
}

export function isImmuneTo(skillConfigs, playerSkills, misfortuneCategory) {
  const config = skillConfigs.find(s => s.id === misfortuneCategory);
  if (!config || !config.hasMisfortune) return false;
  if (config.immunityLevel == null) return false;
  const level = playerSkills[misfortuneCategory] || 0;
  return level >= config.immunityLevel;
}

export function qaGap(skillConfigs, playerSkills, task) {
  return task.requiredSkills.reduce((gap, skillId) => {
    const config = skillConfigs.find(s => s.id === skillId);
    const level = playerSkills[skillId] || 0;
    const passLevel = config.qaPassLevel ?? 2;
    return gap + (level < passLevel ? 1 : 0);
  }, 0);
}

export function canLevelUp(skillConfig, currentLevel) {
  return currentLevel < skillConfig.maxLevel;
}

export function levelUp(playerSkills, skillId) {
  return { ...playerSkills, [skillId]: (playerSkills[skillId] || 0) + 1 };
}
