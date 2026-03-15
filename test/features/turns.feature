Feature: Turn Flow
  Each turn follows a strict sequence: draw misfortune, check immunity,
  resolve effect, optionally act. The state machine enforces this order.

  Background:
    Given a standard game configuration
    And a game with 5 players

  # ── Normal Turn ──

  Scenario: Immune player skips effect and takes action
    Given it is player 0's turn
    And player 0 has BE at level 1
    And the next misfortune is M01 (Backend, MINOR)
    When misfortune is drawn
    Then player 0 should be immune
    And the phase should be AWAITING_ACTION

  Scenario: Non-immune player suffers effect then takes action
    Given it is player 0's turn
    And player 0 has BE at level 0
    And player 0 has a task with effort 3
    And the next misfortune is M01 (Backend, MINOR, +1 effort)
    When misfortune is drawn and resolved
    Then player 0's effort should be 4
    And the phase should be AWAITING_ACTION

  Scenario: Skipped player gets no action
    Given it is player 0's turn
    And player 0 has DO at level 0
    And the next misfortune is M10 (DevOps, MINOR, skip)
    When misfortune is drawn and resolved
    Then the phase should be END_TURN
    And player 0 should not get an action

  # ── Task Completion ──

  Scenario: Develop reduces effort by 1
    Given player 0 has a task with effort 2
    And the phase is AWAITING_ACTION for player 0
    When player 0 chooses DEVELOP
    Then player 0's effort should be 1
    And the task should not be complete

  Scenario: Develop to zero triggers QA check
    Given player 0 has a task with effort 1
    And player 0 has BE at level 2
    And the phase is AWAITING_ACTION for player 0
    When player 0 chooses DEVELOP
    Then QA check should be performed
    And the task should auto-pass QA
    And the task should be scored

  Scenario: QA bounce resets effort to 1 and adds a bug
    Given player 0 has a task requiring BE with effort 1
    And player 0 has BE at level 0
    And the dice will roll 1
    And the phase is AWAITING_ACTION for player 0
    When player 0 chooses DEVELOP
    Then the task should bounce
    And player 0's effort should be 1
    And 1 bug should be added to the board

  # ── Actions ──

  Scenario: Skill Up increases a skill level
    Given player 0 has BE at level 1
    And the phase is AWAITING_ACTION for player 0
    When player 0 chooses SKILL_UP BE
    Then player 0 should have BE at level 2

  Scenario: Pay Debt removes a board token
    Given the board has 5 total tokens
    And the phase is AWAITING_ACTION for player 0
    When player 0 chooses PAY_DEBT
    Then the board total should be 4

  Scenario: Cannot take action outside AWAITING_ACTION phase
    Given the phase is DRAW_MISFORTUNE
    When player 0 tries to DEVELOP
    Then the action should be rejected
    And the error should mention phase

  Scenario: Cannot act on another player's turn
    Given it is player 0's turn
    And the phase is AWAITING_ACTION for player 0
    When player 1 tries to DEVELOP
    Then the action should be rejected
    And the error should mention player

  # ── Lucky Break: Two Actions ──

  Scenario: Quiet Day grants two actions
    Given it is player 0's turn
    And the next misfortune is M29 (Lucky, two actions)
    When misfortune is drawn and resolved
    Then player 0 should have 2 actions available
    When player 0 chooses DEVELOP
    Then player 0 should still have 1 action remaining
    When player 0 chooses SKILL_UP BE
    Then the turn should end

  # ── Lucky Break: Instant Complete ──

  Scenario: AI Assistant completes task instantly then player still acts
    Given player 0 has a task worth 5 SP
    And the next misfortune is M31 (Lucky, instant complete)
    And the dice will roll 3
    When misfortune is drawn and resolved
    Then player 0's task should be completed
    And player 0 should gain 5 SP
    And 1 bug should be added (AI quality)
    And the phase should be AWAITING_ACTION
