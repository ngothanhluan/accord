---
id: "README-1"
title: "Make the readme describe the tool that shipped"
type: "story"
status: open
ui: false
ac_hash: "fnv1a64:565100d5d96d1415"
---

## Intent
The readme is the front door in two places at once: the repository page, and the page the registry
shows anyone deciding whether to try the tool. It describes a contract between four people, says
nothing has been released, names a part that was taken out, and never tells anyone how to run the
thing. We know it worked when a reader who has never heard of accord can say what it is and run it
once, from the registry page alone. Out of scope: what accord does, and the design document behind it.

## Requirements
- The system SHALL show a reader on the registry page the same description a reader on the repository page sees
- The system SHALL describe the four stages as stages one person passes through, and equally four people on a team
- The system SHALL tell a reader how to run the tool without installing it, naming the version that is released
- The system SHALL name no part of the product that has been removed from it
- WHEN a version has been released the system SHALL say so rather than saying the project is still being designed
- IF the description links to a document that exists only in the repository, THEN the system SHALL give a reader on the registry page a link that resolves

## Acceptance criteria
```gherkin
Feature: README-1

  @ac-1
  Scenario: The registry page carries the same description, and its links work
    Given a reader opens the package page on the registry
    Then they see the same description a reader on the repository page sees
    And every link in it opens the document it names, without the reader going to the repository first

  @ac-2
  Scenario: The description matches who accord is for
    Given a reader is reading the description
    Then it presents the four stages as stages one person passes through, and equally four people on a team
    And it does not present them as four separate people who must each be present

  @ac-3
  Scenario: The description does not deny its own release
    Given a version of the tool has been released
    When a reader reads the description
    Then it tells them the tool is released and which version
    And it no longer says the project is still being designed

  @ac-4
  Scenario: The description names only parts that exist
    Given a reader reads the whole description, from the opening line to the run instructions
    Then nothing anywhere in it names a part that has been removed from the product

  @ac-5
  Scenario: A reader can run it from what they just read
    Given a reader has only the registry page in front of them
    When they follow the instruction it gives for trying the tool
    Then the tool runs and reports its version, with nothing installed first
```

## Open questions
- [x] Whether the description on the registry is written separately or generated from the repository one is settled by the first requirement: one source, generated, with a check that fails on drift
- [x] Both pages showing the same description is now ac-1's first Then, so the parity the first requirement asks for is watched rather than assumed. Drift between the two is already a build failure, so the reader never meets it
- [x] Link resolution joined ac-1 rather than becoming a sixth scenario, since both are about what the registry page gives a reader who never opens the repository. It covers every link in the description, and resolving means the link opens the document it names from the registry page itself
- [x] No. ac-3 now carries a second Then for the older claim being gone, so a description that says both fails
- [x] No. ac-4 now reads the whole description, opening line to run instructions, rather than the is-and-is-not list alone
- [x] Yes, it fails, and a test notices rather than a person: the version in the run instruction has to equal the one the package declares, compared as strings. This is the rule the project already applies between the config file and the running tool, applied to the third place the number appears

## Plan
- Rewrite the repository readme's opening and four-stage paragraph so the stages read as stages one person passes through and equally four people on a team, and replace the status line with the version the package declares @ac-2 @ac-3
- Add the run section: the one command a reader runs with nothing installed first, pinned to that same version, and run it in a clean directory and see it report its version before the section is called done @ac-5
- Extend the generator's drift check so the version in the run instruction must equal the one the package declares, string for string, and fail the build when they differ; add the check if the generator has none @ac-5 @ac-3
- Carry the repository readme to the package readme through the generator, rewriting repository-relative links to absolute repository URLs as it goes, because the registry serves the page from a different origin and the relative form resolves to nothing there; then open the generated file and follow every link. The registry shows this only from the next publish, so the version named in the text has to be the one that publish carries @ac-1
- Read the generated package readme end to end, opening line through run instruction, and take out any name of a part no longer in the product — last, so the sweep covers the run section and whatever the generator added rather than only the paragraphs rewritten first @ac-4

## Verification notes
