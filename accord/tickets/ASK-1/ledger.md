# Ledger

## Tasks
- task 1 done 50f64060d634

## Rulings

- Ruling: two tasks rather than one — ac-1 (the file and its loading) and ac-2 (the pointer) each get a failing test of their own — cost if wrong: one extra gen/build/sync cycle.
- Ruling: the pointer goes on a new indented line, not rewrapped into the bullet as the Approach says — every existing byte stays put and the stage skills' required phrases are safe — cost if wrong: one slightly short line in eight skills.
- Ruling: the ac-2 test checks `./ask.md` without the backticks — the scenario's backticks are Markdown quoting — cost if wrong: a pointer with no backticks would still pass.
- Ruling: the plan critic's Nice on Task 2's stale line numbers is answered in each brief (find each bullet by its opening text) rather than by a plan round — the critic found no Must or Should — cost if wrong: an executor edits the line above the bullet, which the ac-2 test catches.
- Ruling: the ac-1 test takes "every target directory" from `skillDirs` over a config whose runtimes are claude, codex, cursor and copilot — `skillDirs` is the write set D-06 names — cost if wrong: a runtime added later is missed until the test config lists it.

## Deferred
