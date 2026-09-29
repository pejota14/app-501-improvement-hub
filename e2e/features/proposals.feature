Feature: Submit an improvement proposal
  People can propose an improvement and receive a reference for follow-up.
  Invalid entries must not be submitted, and failed submissions can be retried.

  Background:
    Given I open the proposal form

  @DEMO-1 @smoke
  Scenario Outline: Submit a proposal for each area
    When I enter a generated proposal for "<area>" with "<impact>" impact
    And I submit the proposal
    Then I receive a submission reference from the API
    And I can start another proposal with an empty form

    Examples:
      | area        | impact |
      | engineering | high   |
      | product     | medium |
      | operations  | low    |
      | other       | high   |

  @DEMO-2 @validation
  Scenario: Required fields prevent an empty submission
    When I try to submit the form
    Then all required fields show validation errors
    And no proposal is sent to the API

  @DEMO-3 @validation
  Scenario: Correct required fields and submit the proposal
    When I try to submit the form
    Then all required fields show validation errors
    When I enter a generated proposal for "product" with "medium" impact
    And I submit the proposal
    Then I receive a submission reference from the API

  @DEMO-4 @validation
  Scenario: An invalid email prevents submission
    When I enter a generated proposal for "engineering" with "high" impact
    And I change the email to "not-an-email"
    And I try to submit the form
    Then I see an email validation error
    And no proposal is sent to the API

  @DEMO-5 @resilience
  Scenario: Retry after the API is unavailable
    When I enter a generated proposal for "engineering" with "high" impact
    And the next API submission is unavailable
    And I submit the proposal
    Then I see a submission error without losing my entries
    When I submit the proposal
    Then I receive a submission reference from the API

  @DEMO-6 @api @validation
  Scenario Outline: The API rejects invalid data independently of the form
    When I send a proposal with "<field>" set to "<value>" directly to the API
    Then the API rejects the proposal with status 422

    Examples:
      | field          | value        |
      | email          | not-an-email |
      | area           | finance      |
      | expectedImpact | critical     |
      | description    |              |

  @DEMO-7 @routing
  Scenario: An unknown URL returns to the web application
    When I visit an unknown nested URL
    Then I see the proposal form at the root URL