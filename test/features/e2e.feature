Feature: End-to-End Game Scenarios
  Full game scripts with deterministic decks and dice.
  Each scenario plays a complete game and verifies the final outcome.

  # ── Regression: Golden Path ──

  Scenario: Happy path — 3 players survive 4 sprints
    Given a 3-player game with seed 100
    And the strategy is "always develop"
    And all danger rolls are safe
    When the game is played to completion
    Then the game result should be WON
    And all 4 sprints should have been played
    And each player should have a non-negative score

  Scenario: Death path — team dies from accumulated tokens
    Given a 3-player game with seed 42
    And the board starts with 20 bugs on player 0
    And the strategy is "always develop"
    And all danger rolls are 6
    When the game is played to completion
    Then the game result should be OVER
    And the cause of death should be danger check

  Scenario: Delivery miss — dissatisfaction accumulates
    Given a 3-player game with seed 50
    And the strategy is "always skill up"
    And all danger rolls are safe
    When the game is played to completion
    Then the board should have dissatisfaction tokens
    And the game result should be WON

  # ── Rules Consistency ──

  Scenario: Skill token pool drains across tiers
    Given a 2-player game with seed 77
    And the strategy is "always skill up"
    And all danger rolls are safe
    When the game is played to completion
    Then the token pool should have fewer tokens than it started with
    And at least one player should have skilled up

  Scenario: Leader receives review cards on task completion
    Given a 3-player game with seed 100
    And the strategy is "always develop"
    And all danger rolls are safe
    When the game is played through sprint 1
    Then the player with the highest score should have review cards

  Scenario: LGTM dice determines bugs
    Given a 3-player game with seed 100
    And the strategy is "always develop"
    And all danger rolls are safe
    And all LGTM rolls are 1
    When the game is played through sprint 1
    Then every LGTM should have added bugs

  # ── Edge Cases ──

  Scenario: Misfortune deck reshuffles when empty
    Given a 5-player game with seed 33
    And the strategy is "always develop"
    And all danger rolls are safe
    When the game is played to completion
    Then more misfortune cards should have been drawn than the initial deck size

  Scenario: Game completes with all skills maxed
    Given a 2-player game with seed 88
    And the strategy is "always skill up"
    And all danger rolls are safe
    When the game is played to completion
    Then the game result should be WON
    And at least one skill should be at max level
