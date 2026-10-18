# Ledger

## Tasks

## Rulings

- Ruling: the intent interview runs in the worktree C:/Work/accord-ln19, with accord run from that worktree's own build (packages/cli/dist/cli.js) — another session holds C:/Work/accord on t/ST-LN-20 and the worktree has no accord bin on PATH — cost if wrong: that build differs from 0.1.0 in a command this stage uses.
- Ruling: origin/main (6eff52b, ST-LN-5 merged) is merged into t/ST-LN-19 before the first question — main changed ask.md and the intent skill since the claim, and this ticket changes the intent and approach skills — cost if wrong: none beyond a merge commit; no conflict occurred.
- Ruling: the skill text names the D-06 label in English ("In plain words:") and the agent writes it in the chat language, as with the rest of the chat — skills are repository artifacts and stay English, and the owner's "Giải thích:" was an example in the chat language — cost if wrong: one sentence of skill text and its test change.
- Ruling: the auditor's two readings are settled in the criteria's wording, not asked of the owner, each by the reading D-01, D-02, or D-06 already fixes — only leading Given/When steps are shared and a scenario is rebuilt as the shared lines naming it, in printed order, then its own lines (D-01: "a Given or When shared ... printed once", D-02: every step in order); the ids sit on the shared line itself (D-02's example); every step from the first Then on stays under its scenario (D-01); the view prints no `@test:` text, which is outside the approved hash; "as before" means the existing `accord show` tests pass unchanged; the skill check is on the text "from the ticket file", and the line starts with ac-n then the label (D-06 Ruling above) — cost if wrong: the owner wanted a looser format and the criteria go back to step 8.
