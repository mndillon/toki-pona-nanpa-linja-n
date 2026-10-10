# Level 12 — Final Archive / `tomo sona pini pi ale`

Status: **implemented in v0.42**.

Level 12 is the final and deliberately hardest campaign level. It does not introduce a new introductory teaching mechanic. Instead it assumes the player has completed Levels 1–11 and can handle dense simultaneous constraints, persisted hidden state, multi-floor navigation and nanpa-linja-n numerals without correctness hints.

The final Sudoku is always the last puzzle. It cannot be entered until every preliminary master trial is complete.

## Canonical glyph allocation

`a, ale, li, mi, mute, olin, pakala, pi, sin, sina`

Five required stages award exactly two glyphs each:

1. Fracture parity core → `pakala + sin`
2. Identity permutation → `mi + sina`
3. Six-glyph totality cipher → `ale + mute`
4. Triple relation mirror array → `olin + pi`
5. Final expert Sudoku → `a + li`

Completing the Sudoku sets `l12ExitUnlocked` and completes the 120/120 campaign.

## Physical topology

Level 12 has **four physical floors** and six significant spaces.

- **Ground, z=0** — Final Archive Vestibule + Fracture Core
- **Upper, z=+1** — Identity Gallery + Relation Observatory
- **Lower, z=-1** — Totality Cipher Vault
- **Deep lower, z=-2** — Final Sudoku Chamber

The player begins in the Vestibule and can enter the Fracture Core immediately. Solving the Fracture Core changes navigation state and visibly exposes two marked routes in the same room:

- `↑` Identity Gallery
- `↓` Totality Cipher Vault

Both branches are required. The Identity trial unlocks the Relation trial. When Identity, Totality and Relation are all complete, a visibly marked **FINAL hatch `↓`** appears in the Totality Cipher Vault and leads to the deepest floor. The final floor contains only the Sudoku, a return ladder and the completion terminal.

There is no sequence of ordinary locked progression doors. Route changes are explicit in the HUD, world rendering and minimap.

## Trial 1 — Fracture parity core

Type: ten-switch coupled binary network.

- 10 lamps
- 10 binary switches
- each switch toggles a different heavily overlapping subset
- every lamp is controlled by at least four different switches, including lamps that happen to match the target at the start; no lamp can reveal a one-switch exclusion
- every switch affects at least four lamps
- pressing a switch twice cancels it
- target is a complete 10-lamp pattern
- player presses **Try answer** to submit

The authored matrix has full rank over GF(2). Exhaustive search of all `2^10 = 1024` switch subsets finds exactly one solution. The unique solution requires seven switches, so the trial cannot be solved by one or two obvious local adjustments.

Reward/state: `pakala + sin`, `l12SpineOnline=true`.

## Trial 2 — Identity permutation

Type: eight-item global deduction/order problem.

Tokens:

`kiwen, jan, waso, mani, tenpo, nasin, telo, suno`

Nine simultaneous relative-position constraints must all hold. No single clue gives the row. Exhaustive testing of all `8! = 40,320` permutations confirms exactly one solution:

`telo → jan → nasin → kiwen → suno → mani → waso → tenpo`

The initial ordering is deliberately far from solved. Submission uses **Try answer** and does not reveal correctness through button state.

Reward/state: `mi + sina`, `l12IdentityDone=true`.

## Trial 3 — Six-glyph totality cipher

Type: persisted Mastermind-style permutation deduction.

- six previously recovered sitelen pona glyphs are selected for the current save
- every selected glyph occurs exactly once in the hidden six-position code
- the hidden permutation is randomized and persisted
- reload does not change the problem
- a tested guess reports only exact-position and misplaced counts
- up to twelve recent attempts remain visible

This trial deliberately has its own **Test code** action because incremental exact/misplaced feedback is the mechanism itself. The campaign-level **Try answer** action remains neutral and is used only after the code has been solved.

The six-symbol controls reflow to 3×2 on narrow/coarse-pointer layouts rather than being compressed.

Reward/state: `ale + mute`, `l12CipherDone=true`.

## Trial 4 — Triple relation mirror array

Type: three-beam / ten-mirror simultaneous routing.

- 7×7 field
- three independent edge sources A/B/C
- three different required exits A/B/C
- ten binary-orientation mirrors shared by all beams

Exhaustive enumeration of all `2^10 = 1024` mirror states confirms exactly one simultaneous solution. In that solution the union of the three beam paths touches **all ten mirrors**, so no mirror is decorative or irrelevant.

Reward/state: `olin + pi`, `l12RelationDone=true`.

## Trial 5 — Final expert Sudoku

Type: 9×9 nanpa-linja-n Sudoku.

This is **always the final puzzle of Level 12 and of the complete campaign**. The FINAL hatch does not open until the Identity, Totality and Relation states are all complete.

The authored grid is deliberately expert-level and sparse, with 23 givens. Automated backtracking validation confirms exactly one solution. The puzzle provides:

- nanpa-linja-n digit glyphs 1–9 as the primary entries
- a small Latin numeral on every filled cell as a readable fallback
- selectable cells
- note/candidate mode
- clear-cell control
- responsive 9×9 square grid; on laptop/desktop the keypad sits beside the board, and on phones the board is height-bounded with the controls reflowed below it
- a 1–9 keypad with both glyph and Latin numeral
- no per-cell right/wrong highlighting before submission
- an always-available **Try answer** button

The Latin numeral fallback is never removed by narrow-screen or short-screen CSS.

Reward/state: `a + li`, `l12ExitUnlocked=true`.

## Save / reload rules

Level 12 adds `l12MechanismStates` to the game save. In-progress Sudoku entries/notes, mechanism state and randomized cipher variant must survive reload. A Level 12 reset starts with exactly the 110 canonical glyphs from Levels 1–11 and none of the Level 12 set.

A completed pre-Level-12 save from the previous build must be able to discover and enter L12 without rebuilding earlier progress.

## Submission / information rules

The v0.40 campaign-wide rule remains in force:

- configuration puzzles use **Try answer**
- the button is available before the correct answer is known
- selection styling is neutral
- no button-state correctness leak
- required clues and numeric information remain visible on mobile
- numeric glyphs have readable Latin fallbacks where loss of the glyph would make a puzzle unsolvable

## Acceptance checks

v0.42 is not accepted unless all of the following pass:

- campaign validator: 12 levels, 0 errors, 0 soft locks, 120/120 canonical glyphs
- parity exhaustive search: exactly one switch subset; every lamp degree ≥4 and every switch affects ≥4 lamps
- identity exhaustive search: exactly one of 40,320 permutations
- triple-mirror exhaustive search: exactly one of 1024 orientations; all mirrors used
- Sudoku solver: exactly one valid solution; givens agree with that solution
- campaign flow: Fracture Core → both master branches → FINAL hatch → Sudoku → complete
- final hatch unavailable if any preliminary master state is missing
- exact Level 12 reset: 110 prior glyphs, 0/10 current glyphs
- previous completed L11 save can continue into L12
- four physical floors are reachable through the intended state changes
- laptop and mobile Sudoku fit the fixed puzzle viewport as a complete 9×9 board; controls move beside/below it as needed without stretching or hiding required numeric fallbacks
- six-symbol cipher reflows without stretching or hiding required information
- full Levels 1–12 regression suite passes
