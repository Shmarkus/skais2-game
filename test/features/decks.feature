Feature: Deck Management
  Task and misfortune decks shuffle on game start.
  Misfortune deck reshuffles when empty. Task deck reshuffles when empty.
  Decks can be injected for deterministic testing.

  Background:
    Given a standard game configuration

  Scenario: Task deck contains 40 cards
    Given the task deck
    Then it should contain 40 cards

  Scenario: Misfortune deck contains 42 cards
    Given the misfortune deck
    Then it should contain 42 cards

  Scenario: Drawing depletes the deck
    Given a deck with 3 cards
    When 3 cards are drawn
    Then the deck should be empty

  Scenario: Misfortune deck reshuffles when empty
    Given a misfortune deck with 2 cards
    When 3 cards are drawn with reshuffle enabled
    Then the 3rd card should come from a reshuffled deck

  Scenario: Injected deck preserves exact order
    Given a task deck ordered as T04, T29, T01
    When 3 cards are drawn
    Then the cards should be T04, T29, T01 in that order
