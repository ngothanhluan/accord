---
id: EARS
title: EARS classification
type: story
status: draft
---

## Intent
Each requirement line is one of the six EARS patterns.

## Requirements
- The system shall log every request.
- WHEN the user submits the form, the system SHALL save the data
- While the aircraft is on ground, the system shall disable reverse thrust
- IF the password is wrong THEN the system SHALL show an error
- Where the premium feature is enabled, the system shall show the export button
- While the user is signed in, when the session expires, the system shall redirect to login
- WHEN un utilisateur envoie un e-mail et un mot de passe valides the system SHALL donner accès au tableau de bord
- IF le mot de passe est erroné THEN the system SHALL afficher une erreur
- WHEN un utilisateur possède un compte the system SHALL permettre la connexion
- WHEN the user clicks, it saves
- The user logs in
- The system must log it
- WHEN x the system shall
- Après la connexion WHEN x the system shall y
- WHEN a WHEN b the system shall c
- WHEN the system shall save
- IF x the system shall y
- WHEN x THEN the system shall y
- IF x THEN y WHEN z the system shall w

## Acceptance criteria
```gherkin
Feature: EARS

  @ac-1 @test:t#a
  Scenario: Write the log
    When they send a request
    Then the request is logged
```

## Open questions

## Plan
- Write the log @ac-1
