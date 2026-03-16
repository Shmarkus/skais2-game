# Engine Gaps: Board Game vs Digital

Differences between the physical board game (v3.1) and the current digital engine.

## 1. Skill Up Token Pool (multi-turn mechanic)

**Board game:** Skill tokens come in tiers (cost 1/2/3). Pool has `floor(players * 1.5)` of each tier. Must take cheapest available. Tier 2/3 tokens require multiple turns to redeem (mark progress on redemption bar). Can't abandon mid-redemption.

**Current engine:** SKILL_UP is instant — one action = one level up. No token pool, no multi-turn redemption.

## 2. Leader Mechanic (review cards)

**Board game:** Player with highest SP is the "leader". When any player completes a task (scores SP), their task card goes to the leader's review pile. Leader accumulates review cards that become bugs at merge freeze if not reviewed.

**Current engine:** `reviewPile` exists on player objects but the "card goes to leader on task completion" logic is not wired in the reducer's `reduceScoreTask`.

## ~~3. LGTM Dice Rolling~~ DONE

Fixed: LGTM now rolls d6 per card, 1-2 = bug.

## ~~4. Sprint Task Counter~~ DONE

Fixed: `meta.sprintCompletedTasks` tracks completions per sprint. `reduceDelivery` uses it. Counter resets on sprint advance.

## ~~5. AI Assistant (M31) Dice Roll for Bug~~ DONE

Fixed: instant_complete now rolls d6 via `action.diceRoll`, 1-4 = bug, 5-6 = no bug.
