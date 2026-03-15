Feature: Merge Freeze
  After 4 turns per player, the sprint ends with Merge Freeze.
  Five steps execute in order: unreviewed MRs, delivery check,
  sprint bonus, danger zone check, advance sprint.

  Background:
    Given a standard game configuration
    And a game with 5 players

  # ── Freeze Sequence ──

  Scenario: Merge Freeze steps execute in order
    Given sprint 1 turns are complete
    Then the phase should be MERGE_FREEZE_UNREVIEWED
    When unreviewed MRs are resolved
    Then the phase should be MERGE_FREEZE_DELIVERY
    When delivery check is resolved
    Then the phase should be MERGE_FREEZE_BONUS
    When sprint bonus is resolved
    Then the phase should be MERGE_FREEZE_DANGER
    When danger check passes
    Then the game should advance to sprint 2

  # ── Unreviewed MRs ──

  Scenario: Unreviewed cards in review pile become bugs
    Given player 0 has 2 cards in their review pile
    And sprint turns are complete
    When unreviewed MRs are resolved
    Then 2 bugs should be added to the board for player 0

  Scenario: Empty review pile adds no bugs
    Given player 0 has 0 cards in their review pile
    And sprint turns are complete
    When unreviewed MRs are resolved
    Then 0 bugs should be added to the board for player 0

  # ── Sprint Bonus ──

  Scenario: Sole player with zero bugs gets +2 SP
    Given end of sprint bug counts are [0, 1, 2, 1, 3]
    When sprint bonus is calculated
    Then player 0 should receive 2 bonus SP

  Scenario: Tied fewest bugs each get +1 SP
    Given end of sprint bug counts are [1, 1, 2, 3, 2]
    When sprint bonus is calculated
    Then player 0 and player 1 should each receive 1 bonus SP

  # ── Game End ──

  Scenario: Surviving 4 sprints wins the game
    Given the team survives sprint 1, 2, 3, and 4
    Then the game should be WON
    And the player with the most SP should be the winner

  Scenario: Dying during danger check ends the game
    Given the board total is 12 at end of sprint 2
    And the dice will roll 4
    When danger check is performed
    Then the project should die
    And the game should be OVER
    And no further actions should be accepted
