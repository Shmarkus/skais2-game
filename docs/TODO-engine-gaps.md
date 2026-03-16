# Engine Gaps: Board Game vs Digital

Differences between the physical board game (v3.1) and the current digital engine.

## 1. Skill Up Token Pool (multi-turn mechanic)

**Board game:** Skill tokens come in tiers (cost 1/2/3). Pool has `floor(players * 1.5)` of each tier. Must take cheapest available. Tier 2/3 tokens require multiple turns to redeem (mark progress on redemption bar). Can't abandon mid-redemption.

**Current engine:** SKILL_UP is instant — one action = one level up. No token pool, no multi-turn redemption.

## 2. Leader Mechanic (review cards)

**Board game:** Player with highest SP is the "leader". When any player completes a task (scores SP), their task card goes to the leader's review pile. Leader accumulates review cards that become bugs at merge freeze if not reviewed.

**Current engine:** `reviewPile` exists on player objects but the "card goes to leader on task completion" logic is not wired in the reducer's `reduceScoreTask`.

## 3. LGTM Dice Rolling

**Board game:** LGTM clears all review cards. Roll d6 per card: 1-2 = 1 bug per card.

**Current engine:** LGTM adds bugs for ALL cards unconditionally (no dice roll, worst case always).

## 4. Sprint Task Counter

**Board game:** Board tracks how many tasks the team completed this sprint (for delivery target check).

**Current engine:** `reduceDelivery` uses `action.completedTasks` or counts players without tasks as a proxy. No explicit sprint completion counter is maintained across the sprint.

## 5. AI Assistant (M31) Dice Roll for Bug

**Board game:** M31 "AI Assistant" completes task instantly, then roll d6: 1-4 = 1 bug.

**Current engine:** Always adds 1 bug unconditionally on instant_complete (no dice roll).
