Feature: Frontend Skill
  Frontend is an intentional trap. It has no misfortune cards,
  so leveling it only helps with effort modifiers and QA checks
  on FE-tagged tasks. Players discover this through play.

  Background:
    Given a standard game configuration

  Scenario: No misfortune cards target Frontend
    Given the misfortune deck
    Then no card should have category FE

  Scenario: FE skill reduces effort on FE tasks
    Given a player with FE at level 3
    And a task requiring FE with base effort 2
    When effort is calculated
    Then the final effort should be 1

  Scenario: FE skill does not grant misfortune immunity
    Given a player with FE at level 3
    Then the player should not be immune to any misfortune category

  Scenario: FE skill contributes to QA gap
    Given a player with BE at level 2 and FE at level 0
    And a task requiring BE and FE
    When QA gap is calculated
    Then the gap should be 1

  Scenario: FE level 2 closes FE portion of QA gap
    Given a player with BE at level 2 and FE at level 2
    And a task requiring BE and FE
    When QA gap is calculated
    Then the gap should be 0

  Scenario: Pure FE task at level 0 has maximum penalty
    Given a player with FE at level 0
    And a task requiring FE with base effort 1
    When effort is calculated
    Then the final effort should be 2

  Scenario: 9 out of 40 tasks require Frontend skill
    Given the task deck
    Then exactly 9 tasks should require FE skill
    And exactly 4 tasks should be pure FE
    And exactly 3 tasks should be BE/FE
    And exactly 2 tasks should be DO/FE
