---
id: LOGIN-1                       # equals the file name
title: Connexion par e-mail
type: story
status: open
parent: EPIC-1
# ids in the tracker are strings even when they look numeric
tracker:
  shortcut: 1234
  jira: 1e3
ui: true
design: "https://www.figma.com/file/abc"
assumptions:
  - { text: "L'utilisateur a déjà un compte", confirmed: true }
verified:
  - "ac-1"
  - "ac-2"
---

## Intent
L'utilisateur se connecte avec son e-mail et son mot de passe pour accéder au tableau de bord.
La connexion sociale n'est pas prise en charge dans cette version.

## Requirements
<!-- BA. One EARS line per requirement. -->
- WHEN un utilisateur envoie un e-mail et un mot de passe valides the system SHALL donner accès au tableau de bord
- IF le mot de passe est erroné THEN the system SHALL afficher une erreur

## Acceptance criteria
<!-- BA. One fenced gherkin block; every scenario tagged @ac-n. -->
```gherkin
Feature: LOGIN-1

  Background:
    Given un utilisateur déjà inscrit

  @ac-1
  Scenario: Connexion réussie
    When il envoie un e-mail et un mot de passe valides
    Then il voit le tableau de bord

  @ac-2
  Scenario: Mot de passe erroné
    When il envoie un mot de passe erroné
    Then il voit une erreur
```

## Open questions
- [x] Faut-il mémoriser la connexion ? Non, pas dans cette version.

## Plan
<!-- Developer fills this in. BA leaves it empty. -->
