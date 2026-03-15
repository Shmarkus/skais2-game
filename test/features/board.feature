Feature: Board and Danger Zone
  The shared board tracks bugs (per player) and dissatisfaction tokens.
  At each Merge Freeze, the danger zone determines if the project survives.

  Background:
    Given a standard game configuration

  # ── Delivery Target ──

  Scenario Outline: Delivery target scales with player count
    Given a game with <players> players
    Then the delivery target should be <target>

    Examples:
      | players | target |
      | 2       | 2      |
      | 3       | 2      |
      | 4       | 3      |
      | 5       | 3      |
      | 6       | 4      |
      | 10      | 6      |

  # ── Dissatisfaction ──

  Scenario: Missing delivery target adds dissatisfaction
    Given a game with 5 players
    And the team completed 1 task this sprint
    When delivery is checked
    Then 2 dissatisfaction tokens should be added to the board

  Scenario: Meeting delivery target adds no dissatisfaction
    Given a game with 5 players
    And the team completed 3 tasks this sprint
    When delivery is checked
    Then 0 dissatisfaction tokens should be added to the board

  Scenario: Dissatisfaction is permanent
    Given the board has 3 dissatisfaction tokens
    And the team meets delivery target next sprint
    Then the board should still have 3 dissatisfaction tokens

  # ── Danger Zone ──

  Scenario Outline: Danger zone thresholds
    Given the board total is <total> tokens
    And the dice will roll <roll>
    When danger check is performed
    Then the zone should be "<zone>"
    And the project should <result>

    Examples:
      | total | roll | zone     | result  |
      | 0     | 1    | Safe     | survive |
      | 7     | 6    | Safe     | survive |
      | 8     | 5    | Warning  | survive |
      | 8     | 6    | Warning  | die     |
      | 9     | 5    | Warning  | survive |
      | 9     | 6    | Warning  | die     |
      | 10    | 4    | Danger   | survive |
      | 10    | 5    | Danger   | die     |
      | 12    | 3    | Critical | survive |
      | 12    | 4    | Critical | die     |
      | 14    | 2    | Severe   | survive |
      | 14    | 3    | Severe   | die     |
      | 16    | 1    | Terminal | survive |
      | 16    | 2    | Terminal | die     |
      | 18    | 1    | DEAD     | die     |
      | 20    | 1    | DEAD     | die     |

  # ── Bug Management ──

  Scenario: Pay Debt action removes a token from the board
    Given player 0 has 2 personal bugs on the board
    When player 0 pays tech debt
    Then player 0 should have 1 personal bug on the board
    And the board total should decrease by 1

  Scenario: Bugs from multiple players accumulate
    Given player 0 has 3 bugs and player 1 has 2 bugs
    And the board has 1 dissatisfaction
    Then the board total should be 6
