# Engine Gaps: Board Game vs Digital

Differences between the physical board game (v3.1) and the current digital engine.

## ~~1. Skill Up Token Pool (multi-turn mechanic)~~ DONE

Fixed: Token pool with 3 tiers (`floor(players * 1.5)` each). Must take cheapest available. Tier 1 = instant, tier 2/3 = multi-turn redemption. Mid-redemption forces SKILL_UP only. Skill chosen at final redemption step.

## ~~2. Leader Mechanic (review cards)~~ DONE

Fixed: `reduceScoreTask` now sends the completed task card to the leader's (highest SP, lowest index tiebreak) review pile. Leader accumulates cards that become bugs at merge freeze if unreviewed.

## ~~3. LGTM Dice Rolling~~ DONE

Fixed: LGTM now rolls d6 per card, 1-2 = bug.

## ~~4. Sprint Task Counter~~ DONE

Fixed: `meta.sprintCompletedTasks` tracks completions per sprint. `reduceDelivery` uses it. Counter resets on sprint advance.

## ~~5. AI Assistant (M31) Dice Roll for Bug~~ DONE

Fixed: instant_complete now rolls d6 via `action.diceRoll`, 1-4 = bug, 5-6 = no bug.
