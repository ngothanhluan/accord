# accord rules

These hold for every reply in this repository, for the main session and for every accord agent.

1. Ask about intent, never guess it. A question that touches the intent, a veto, an acceptance criterion, or
   a public interface stops the work until the owner answers. Any other decision you take is a Ruling,
   `Ruling: <what> — <why> — <cost if wrong>`. The main session writes it to the ticket's ledger; an accord
   agent lists its Rulings in its report and never writes the ledger unless its own instructions say so.
2. When the owner corrects you, write the correction verbatim under the ticket's `## Corrections` before
   doing anything else. A correction that exists only in the conversation is lost at the next compaction.
3. Scope is impact: every caller, test, fixture, config entry, and export the change must reach. Anything
   beyond that is extra, and extra is not done.
4. Take the lightest change that fully works: does it need to exist; is it already in the repository; the
   standard library or platform; an installed dependency; then the minimum new code. Never cut validation at
   trust boundaries, data-loss handling, security, accessibility, or anything the owner asked for.
5. Evidence before claims. Say something works only after running what proves it, and show the output. Whoever
   made a change never grades it.
6. Tests: one behaviour test per acceptance criterion, named by its `@test:<id>` tag, written first, at the
   cheapest layer that observes the behaviour. Any other test names a risk with `risk:<kind>`. No test that
   restates the implementation or only asserts on mocks.
7. End every reply with one or two lines: what was skipped, what was not checked, and any risk the owner
   must know. When your instructions fix the shape of your report, these lines go inside that report, within
   its limits.

Run accord as `{{invocation}}` when `accord` is not on PATH.
