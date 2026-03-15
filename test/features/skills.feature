Feature: Skill System
  Players have 4 skills: Backend, Database, DevOps, Frontend.
  Each skill has levels 0-3 with distinct effects.
  Skills are dynamic — the game engine discovers them from configuration.

  Background:
    Given a standard game configuration

  # ── Effort Modifiers ──

  Scenario Outline: Skill level affects task effort
    Given a player with <skill> at level <level>
    And a task requiring <skill> with base effort <base>
    When effort is calculated
    Then the final effort should be <effort>

    Examples:
      | skill | level | base | effort |
      | BE    | 0     | 2    | 3      |
      | BE    | 1     | 2    | 2      |
      | BE    | 2     | 2    | 2      |
      | BE    | 3     | 2    | 1      |
      | FE    | 0     | 2    | 3      |
      | FE    | 3     | 2    | 1      |

  Scenario: Multi-skill task sums all modifiers
    Given a player with BE at level 3 and DB at level 0
    And a task requiring BE and DB with base effort 3
    When effort is calculated
    Then the final effort should be 3

  Scenario: Effort minimum is 1
    Given a player with BE at level 3
    And a task requiring BE with base effort 1
    When effort is calculated
    Then the final effort should be 1

  # ── Misfortune Immunity ──

  Scenario Outline: Misfortune immunity at level 1+ for BE/DB/DO
    Given a player with <skill> at level <level>
    And a misfortune card in category <skill>
    When immunity is checked
    Then the player should <result>

    Examples:
      | skill | level | result         |
      | BE    | 0     | not be immune  |
      | BE    | 1     | be immune      |
      | BE    | 2     | be immune      |
      | DB    | 0     | not be immune  |
      | DB    | 1     | be immune      |
      | DO    | 0     | not be immune  |
      | DO    | 1     | be immune      |

  Scenario: Frontend never grants misfortune immunity
    Given a player with FE at level 3
    And a misfortune card in category FE
    When immunity is checked
    Then the player should not be immune

  Scenario: Lucky cards bypass all immunity
    Given a player with BE at level 3 and DB at level 3 and DO at level 3
    And a lucky break misfortune card
    When immunity is checked
    Then the player should not be immune

  # ── QA Check ──

  Scenario Outline: QA gap based on skills below level 2
    Given a player with <skills>
    And a task requiring <required>
    When QA gap is calculated
    Then the gap should be <gap>

    Examples:
      | skills          | required | gap |
      | BE:0            | BE       | 1   |
      | BE:1            | BE       | 1   |
      | BE:2            | BE       | 0   |
      | BE:3            | BE       | 0   |
      | BE:0,DB:0       | BE,DB    | 2   |
      | BE:2,DB:0       | BE,DB    | 1   |
      | BE:2,DB:2       | BE,DB    | 0   |
      | BE:2,FE:0       | BE,FE    | 1   |
      | BE:2,FE:2       | BE,FE    | 0   |

  Scenario: QA auto-pass when gap is 0
    Given a player with BE at level 2
    And a task requiring BE
    When QA check is performed
    Then the task should auto-pass

  Scenario: QA bounce when roll <= gap
    Given a player with BE at level 0
    And a task requiring BE
    And the dice will roll 1
    When QA check is performed
    Then the task should bounce

  Scenario: QA pass when roll > gap
    Given a player with BE at level 0
    And a task requiring BE
    And the dice will roll 2
    When QA check is performed
    Then the task should pass

  # ── Skill Up ──

  Scenario: Skill up increases level by 1
    Given a player with BE at level 1
    When the player levels up BE
    Then BE should be at level 2

  Scenario: Cannot level up past maximum
    Given a player with BE at level 3
    Then leveling up BE should not be allowed

  Scenario: Skill configuration is dynamic
    Given a game with skills BE, DB, DO, FE
    Then the game should have 4 skill tracks
    And each player should start at level 0 in all skills
