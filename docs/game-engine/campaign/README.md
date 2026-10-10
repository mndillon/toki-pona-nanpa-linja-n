# Campaign constructor + validator — Levels 1–4 draft

This folder defines the data-driven campaign layer above the first-person renderer.

## Active campaign

`campaign-draft-v0.1.js/json` now contain four playable/validated levels. Levels 1–2 establish the early 20-glyph foundation; Level 3 introduces a broad set of mechanism puzzles; Level 4 continues the campaign with another five distinct mechanisms and a branching dependency structure.

Level 1 canonical glyphs:

`o, e, wan, tu, seli, awen, luka, nanpa, ona, ma`

Level 2 canonical glyphs:

`ijo, utala, mun, pipi, jo, en, kulupu, kala, nena, kiwen`

The previous v0.4 Level 1 definition is retained separately as `campaign-reference-level1-v0.4.js/json` and is not loaded by the active game.

## Baseline glyph rule

`standardGlyphs` is the original 120-glyph collectible set. `baselineGlyphs` contains Common Sitelen Pona 2026 word glyphs outside that 120. Baseline glyphs are available at campaign start and never count toward the 120 total. This includes `kin`, `kipisi`, and the rest of the configured extra-word repertoire. `baselineSymbols` separately contains punctuation/cartouche/support symbols.

Canonical rewards may only come from the original 120. A mandatory puzzle may use a baseline glyph without requiring the player to earn it.

## Foundation milestone

The campaign now has an explicit `foundationMilestone` after `L02`. The validator proves, using only guaranteed non-bonus progression, that by that point the player has:

- all 20 planned foundation collectibles;
- at least one available glyph for every initial `A E I J K L M N O P S T U W`;
- all collectible glyphs needed for ordinary abbreviated decimal nanpa-linja-n digits and punctuation;
- baseline numeric glyphs `kin` and `kipisi`;
- coordinate foundation glyphs `ma` and `kiwen`.

This is a campaign invariant rather than a comment-only design intention.

## Combined topology/progression model

Each validator state contains:

```text
current area
+ permanent owned glyphs
+ solved puzzle set
+ world-state flags
```

Connections can require glyphs, solved puzzles and/or world-state values. Puzzle completion can award glyphs and change world state. The validator explores the exact reachable combined state graph and reverse-marks every state that can still reach completion; any reachable state outside that winning set is a soft lock.

Bonus puzzles are disabled during the minimum-path proof, so an optional reward can never repair the guaranteed route.


## Completion semantics

A level is complete only when **all glyphs in that level's canonical set** are owned and its declared mandatory completion requirements are satisfied. Raw collection totals are never used for progression, so bonus/future glyphs cannot replace missing current-level glyphs.

The Level 1 observation terminal and Level 2 vault terminal are optional story terminals. They no longer gate progression. The guaranteed route completes from the required canonical glyphs plus the mandatory world-state chain; the terminals may still be visited after completion if the player stays in the level.

## Level transition

The runtime now exposes `startLevel()` and `nextLevel()`.

A transition is rejected unless the current level is complete. Permanent glyph ownership is retained while the new level's area/world-state context becomes active. The engine serializes this runtime into IndexedDB and shows a new full-screen level-start state after transition.

## Puzzle UI contract

Puzzle descriptors still use the generic `ui.presentation: "fullscreen"` contract. The current engine implements:

- exact/reusable glyph-sequence puzzles;
- `country-cartouche` puzzles, where Latin-letter slots accept any owned/baseline glyph with the matching Toki Pona initial;
- `coordinate-map` puzzles, where the numeric coordinate clue identifies a location on a touch-friendly map grid and success changes world state.

All glyph-key puzzle types use the same shared letter-family picker.

## Level 2 progression clarity

Puzzle UI descriptors may now include an optional `ui.objective` string. The constructor preserves it so the HUD can give a location-aware next action instead of only repeating the puzzle title. Required-for-minimum puzzles are preferred over optional bonus puzzles when choosing the current objective.

For the first Level 2 map chain, solving the coordinate map sets `cacheRevealed=true`, while the hidden-cache puzzle remains physically located in `l2Archive`. The archive is already reachable before the map can be solved. Completing `l2-hidden-cache` sets `l2LabAccess=true`; the engine then opens the corresponding Laboratory door immediately. The later `l2-full-form-bridge` sets `l2VaultAccess=true` and opens both physical vault doors.

The hidden-cache puzzle also carries `ui.payload.displaySequence = ["kiwen", "ma", "kiwen"]`, allowing the engine to render the source inscription explicitly rather than asking the player to copy an unseen sequence.

## Coordinate-map reveal chain

Level 2 includes the first map-to-world dependency:

```text
coordinate clue
→ solve map grid
→ cacheRevealed = true
→ hidden object becomes visible in the 3D world
→ interact with cache
→ next puzzle/reward chain
```

The validator models the logical state dependency while `game-engine.js` maps the state to the object's physical visibility.

## Nanpa-linja-n rule

The constructor never derives numeric glyph requirements from decimal characters. Any future puzzle that supplies `glyphSequenceSpec` requires a real `resolveGlyphSequence(spec)` backed by the current nanpa-linja-n parser/renderer. Unresolved numeric sequences are validation errors.

Repeated glyph occurrences remain repeated in puzzle answers while ownership remains set-based.

## Validation

Run:

```bash
node game-engine/campaign/validate-campaign.cjs
node tests/campaign-validator.test.cjs
node tests/level1-integration.test.cjs
node tests/renderer-topology.test.cjs
```

The active draft validates all four levels with zero soft locks. The expected draft warning is that only 40/120 canonical glyphs have been assigned so far.


### Level 3 (v0.11)

Canonical glyphs: `tenpo, suno, toki, kasi, nasin, tawa, sitelen, sona, ilo, poka`. Level 3 deliberately shifts away from repeated glyph-sequence entry: its minimum path uses clock-dial deduction, relay routing, checkpoint navigation, a Lights Out board, a balance machine, and a renderer-backed contextual time-cartouche recognition puzzle. Levels 1 and 2 are preserved from the v0.10 reference copies.


### Level 4 (v0.12)

Canonical glyphs: `telo, poki, palisa, supa, kule, lukin, sama, ante, open, pini`. Levels 1–3 are preserved exactly from the v0.11 reference copy.

Level 4 has five minimum-path puzzle types that are new to the campaign: `jug-transfer`, `hanoi-stack`, `codebreaker`, `equivalence-grid`, and `schedule-order`. The reservoir solve opens two independent branches; both `l4StackDone` and `l4CodeDone` are required before the equivalence area becomes reachable. The validator therefore checks the branch join as part of the combined topology/state graph rather than relying on UI sequencing.

The equivalence puzzle uses actual renderer source forms for fractions, decimals and percentages, and the schedule puzzle uses renderer source forms for full dates and times. These are presentation-side renderer calls rather than hand-authored sitelen glyph sequences.

Reference copies of the complete v0.11 Levels 1–3 campaign are retained in `campaign-reference-level1-level2-level3-v0.11.js/json` so regression tests can prove that Level 4 authoring did not alter prior campaign definitions.


## v0.13
Level 5 extends the authored campaign to 50/120 canonical glyphs while retaining Levels 1–4. The Schedule Archive deliberately exposes only rendered suno/tenpo cartouches, not ISO answer text.

## v0.14 Level 5 River Crossing

`l5-river-crossing` keeps its existing `jan` + `soweli` canonical rewards and `l5BranchAccess` progression effect, but the mechanism is now the classic three-passenger ferry dependency: distinct `akesi`, `soweli`, `kili` travellers with unsafe unattended pairs `[akesi,soweli]` and `[soweli,kili]`. Campaign solvability remains unchanged; the mechanism-level test additionally proves the minimum safe route is seven crossings.

## v0.15 Level 5 simplification

`l5-pattern-sequence` has been removed from the active campaign. `l5-peg-line` remains gated by completion of both Level 5 branches and now awards the final four canonical Level 5 glyphs (`linja`, `lawa`, `kili`, `moku`) while setting both `l5StrategyDone` and `l5ExitUnlocked`. The active Level 5 campaign therefore contains four substantial puzzle families and no rotating-pattern terminal.

A complete v0.14 Level 1–5 campaign reference is retained in `campaign-reference-level1-level2-level3-level4-level5-v0.14.js/json`.

## v0.16 Level 5 final-room restoration

The active Level 5 topology once again includes `l5Pantry`, reached through `l5-strategy-pantry` only after `l5StrategyDone`. `l5-peg-line` awards `linja` + `lawa` and sets `l5StrategyDone`; the replacement `l5-pantry-nonogram` awards `kili` + `moku` and sets `l5ExitUnlocked`.

`l5-pattern-sequence` remains removed. The replacement is a 6×6 `nonogram` mechanism with a uniquely solvable authored target. This restores the original five-puzzle reward distribution without restoring the too-easy rotation puzzle. Exact v0.15 campaign reference copies are retained in `campaign-reference-level1-level2-level3-level4-level5-v0.15.js/json`.

