# v0.42 — playable Level 12 final archive / complete 120-glyph campaign

Level 12 is implemented as the final and deliberately hardest campaign level. It uses four physical floors and five required master trials: a unique ten-switch parity network, a uniquely constrained eight-record identity permutation, a persisted randomized six-glyph totality cipher, a unique three-beam/ten-mirror relation array, and finally an expert 9×9 nanpa-linja-n Sudoku. The Sudoku is physically isolated on the deepest floor and is always the last puzzle; the FINAL hatch appears only after all three preliminary branch states are complete.

Canonical Level 12 glyphs are `a, ale, li, mi, mute, olin, pakala, pi, sin, sina`. Completing the final Sudoku reaches all **120/120 canonical glyphs**. Exact Level 12 reset starts with 110 prior canonical glyphs and 0/10 Level 12 glyphs. The complete implementation and uniqueness/mobile/save acceptance criteria are documented in `LEVEL-12-DESIGN.md`.

The earlier moderate-Sudoku plan is superseded by the explicit final-level requirement: the shipped Sudoku is expert-level, unique, sparse, supports notes, uses nanpa-linja-n glyphs with persistent Latin numeral fallbacks, and reveals correctness only through **Try answer**.

Level 12 parity is deliberately fully coupled: every lamp is affected by at least four switches, so an initially matching lamp cannot expose a unique switch to avoid. The final Sudoku uses a viewport-bounded board: desktop/laptop places controls beside the grid, while narrow/mobile layouts stack compact controls below it so all 81 cells remain visible.

# v0.40 — Level 11 difficulty + submission UX correction

Level 11 has been difficulty-reviewed after playtesting. The lineage registry is now a true global constraint puzzle: each hatchling exposes only one trait and remains individually ambiguous, while two cross-record observations plus the one-to-one parent rule produce one exhaustively verified solution. The final habitat triage now uses neutral station labels and explicit role definitions, so the player can understand what `akesi` and `moli` mean and solve from evidence rather than trial-and-error.

Across configuration-style mechanism puzzles, the primary action is now **Try answer** and remains available before correctness is known. Correct configurations are no longer exposed by enabling/highlighting the submit button, and selected choices use neutral styling rather than green success styling. Required Level 11 evidence is retained on short mobile layouts instead of being hidden.

# v0.38 — playable Level 11 nocturnal wildlife sanctuary

Level 11 is now a playable three-floor field-station environment rather than another locked-room chain. The route is: physically record three call pylons → uniquely triangulate the night roost → restore an overnight schedule crossing midnight → descend through the newly opened incubator hatch → match hatchlings to parent pairs → carry/recover two released parent bands onto the correct nest perches → use the resulting canopy shortcut to Recovery Ward → solve an evidence-based final habitat triage.

Canonical Level 11 glyphs are `mu, waso, lape, uta, mama, unpa, meli, mije, akesi, moli`. New vertical routes are explicitly announced, visually marked in-world and permanently marked on the minimap once available. The new mechanisms have narrow/coarse-pointer layouts and avoid stretching glyph/cartouche content. Exact Level 11 reset starts with 100/120 prior canonical glyphs and 0/10 Level 11 glyphs. Full implementation/acceptance details are in `LEVEL-11-DESIGN.md`.

# v0.37 — Level 10 route / UX correction

Level 10 has been rechecked as a complete staged route before further level work. The delivery cart is now a coherent ground-floor Receiving ↔ Market mechanism only; unused later-floor cart panels were removed. Correct `pan` / `suwi` stand placement opens a deliberately obvious Cold Store hatch: it is visibly open in-world, permanently marked `↓` on the minimap, and named in the HUD objective. Delivery completion no longer depends on a hidden cart-trip counter, and old saves parked at obsolete cart docks migrate safely back to Market.

The Market Permit till was also rebuilt for mobile safety. Numeric cartouches retain their natural aspect ratio and scale proportionally; cards and the exact-total row reflow vertically on narrow screens, while token controls wrap to three columns (two on very narrow phones).

An end-to-end Level 10 flow regression now verifies the intended progression: till → delivery → Cold Store → cold-chain → textile → audit.

# v0.35 — playable Level 10 cold market / logistics tower

Level 10 is now fully authored and playable. Completing Level 9 can continue directly into a three-floor market/logistics environment with ten new canonical glyphs: `esun, mani, pan, suwi, lete, len, ko, jaki, laso, walo`.

The level is built around a persistent two-cargo delivery cart and changing navigation state rather than a sequence of locked rooms. Progression runs through an exact-payment market till, manifest-driven bread/sweet deliveries, coupled signed-temperature cold controls, a 2:1:1 textile dye process with recoverable cloth routing, and a final dispatch/quarantine audit that reuses the same shipment records. Solved branches activate the basement route, chilled service lift and upper-to-ground awning shortcut.

Level 10 physical and mechanism state is saved, including cart dock/cargo, parcel placements, cloth/sample locations and the active till/cold/dye mechanism state. `game-engine-reset.html?level=10` starts an exact Level 10 test state with the 90 prior canonical glyphs and 0/10 Level 10 glyphs.

Level 10 is followed by the implemented Level 11 sanctuary and Level 12 Final Archive.

# Toki Pona Rooms — complete 12-level campaign

## Mobile first-person controls

Touch gameplay uses a circular lower-left joystick with an inner dead zone. North/south move only, east/west rotate only, and diagonal sectors combine movement with rotation. The lower-left viewport is reserved for this control during first-person exploration; required HUD/navigation information must not depend on that area. Full-screen puzzles and modal overlays hide the joystick and USE control so puzzles retain the full mobile viewport. Desktop `A`/`D` strafing is unchanged.


## v0.10 Level 2 testing fixes

The Level 2 coordinate-map and hidden-cache chain is now explicit and viewport-safe. The coordinate map fits inside the puzzle viewport without vertical page/modal scrolling, displays compact row/column coordinate labels, and keeps Leave visible. Solving it reports that the cache is in the **Lower Archive** and places a marker on the minimap.

The revealed cache itself displays the three source glyphs `kiwen → ma → kiwen` both in-world and above the answer slots. Its instruction now plainly asks the player to enter those same three sitelen pona glyphs in the same order. Completing the cache immediately opens the Laboratory door. Completing the later full-form bridge immediately opens both Foundation Vault doors.

All completed physical puzzle stations now switch to a green solved state. The HUD also prioritizes required progression objectives over optional bonus puzzles, so an unsolved bonus country puzzle cannot obscure “Return to the Lower Archive and inspect the revealed cache.”

Existing v0.9 IndexedDB saves remain compatible because the save version is unchanged.

Static first-person 2.5D campaign test for `game-engine.html`.

The renderer consumes the campaign runtime/manifest in `campaign/`. Geometry is authored in `game-engine.js`; campaign logic controls glyph ownership, puzzle availability, world-state changes, level completion and transitions across all twelve authored levels.

## Foundation objective

The active draft deliberately uses the first two levels to establish a 20-glyph foundation.

Level 1 canonical glyphs:

`o, e, wan, tu, seli, awen, luka, nanpa, ona, ma`

Level 2 canonical glyphs:

`ijo, utala, mun, pipi, jo, en, kulupu, kala, nena, kiwen`

By the end of Level 2 the player has at least one available glyph in every Toki Pona initial-letter family and the collectible repertoire needed for ordinary abbreviated decimal nanpa-linja-n cartouches. `kin`, `kipisi`, and other Common Sitelen Pona 2026 glyphs outside the original 120 are baseline capabilities available from the start.

## Level 1

The revised Level 1 keeps the v0.4 physical maze improvements: immediate branching, widely separated dead ends, a persistent entrance marker, a remotely unlocked inner chamber, and a quick Leave maze action after the exit code has been solved.

The new logical route emphasizes multi-step chains rather than repeated one-slot copying. It introduces the early digit foundation, an ordered maze code, a multi-glyph nanpa reconstruction, machinery sequencing and a signed decimal reconstruction. The observation terminal remains available as optional story/flavour content, but it no longer gates Level 2.

## Level 2

Level 2 is a new authored first-person environment with genuinely gated archive, cartography, lab and vault regions. Progression includes digit ordering, sequence work, a workshop/stone puzzle, a map-coordinate discovery chain, a hidden cache, thousands/scientific-number work and a final full-form bridge. The vault terminal is optional story/flavour content rather than a completion gate.

The map puzzle demonstrates the intended cross-puzzle world-state relationship: solving the map identifies a location, which makes a hidden cache appear at that location in the first-person world; interacting with that cache opens the next puzzle.

An optional country-name cartouche puzzle is also present as a first test of future bonus-glyph rewards. It is excluded from the minimum required route.

## Live numeric-cartouche construction feedback

Numeric glyph-key puzzles now show a live sitelen cartouche preview while the player fills the slots. The preview is built from the glyphs currently placed, in slot order, and skips empty slots, so an intermediate state can legitimately display a partial cartouche such as `[tu nanpa1/2]`. Structural and punctuation glyphs use the same fractional scaling roles as the shared renderer: numeric heads/closers and the nanpa-format colon are half-size; the leading positive `en` is two-thirds; and the numeric punctuation glyphs use their established quarter/third/half/two-thirds scales.

The live preview updates for both tap placement and desktop drag/drop, and its canvas scales down for phone-sized puzzle overlays.

## Shared glyph-key picker

All glyph-key puzzles use the same letter-family picker.

- Available Toki Pona initial families are shown as `A E I J K L M N O P S T U W` buttons, but only when the player currently has at least one glyph in that family.
- Selecting a letter opens all currently owned/baseline glyphs for that letter.
- A punctuation/support family is always available for non-word structural symbols.
- Mobile uses slot → letter family → glyph as the primary path; the first empty slot is selected automatically and focus advances after placement.
- The letter-family selector stays visible, while the actual family glyphs open in a temporary bottom sheet that does not enlarge the puzzle layout.
- Desktop can use the same tap interaction or drag/drop; drag is disabled for coarse pointers so touch taps remain reliable.
- Glyphs are permanent reusable capabilities; one owned glyph can be placed multiple times.

Country spelling puzzles label slots with Latin letters and accept any available glyph whose Toki Pona word begins with the required letter.

### Fixed-viewport puzzle layout

Normal glyph-key and country-cartouche puzzles are designed to fit inside one game viewport on laptops and phones. The puzzle card itself does not vertically scroll: slots are compact, the live cartouche is a short strip, the phone letter selector uses two horizontally scrollable rows, and Clear / Activate / Leave remain visible. A selected letter opens an overlaid bottom sheet; only that bounded glyph sheet may scroll when a family contains many glyphs. Very short landscape phone viewports switch to an even tighter layout rather than pushing controls below the viewport.


## Level progress and completion

Level completion is based on the identity of the current level's canonical glyph set plus mandatory world-state objectives, never on the raw number of glyphs collected. Bonus/future glyphs therefore cannot substitute for a missing required glyph or trigger an early level exit.

The HUD distinguishes current-level required progress, bonus discoveries, and the global 120-glyph total. If all required glyphs are present but a mandatory objective remains, the objective line says so explicitly. Once Level 1 is complete, a persistent **Continue to Level 2** control remains visible inside the game viewport even if the player chooses to stay in the finished level. Existing v0.8 saves with the ten Level 1 canonical glyphs and completed mandatory chain are recognized as complete without requiring the old observation-terminal confirmation.

## Level-start transition

Numeric puzzle sequences in nanpa format include the visible `:` as a baseline punctuation slot (for example `nanpa : wan tu seli nanpa`).

Every level begins with a full-screen start state showing the level number as a nanpa-format abbreviated nanpa-linja-n numeric cartouche. The shared site renderer is used when available. Click/tap anywhere, press the visible Start button, or use Enter/Space to begin. Movement is frozen until the screen is dismissed.

Completing a level saves state, preserves the permanent glyph inventory, starts the next authored level and displays its nanpa-linja-n start screen.

## Reference campaign

The previous playable v0.4 Level 1 campaign has been retained for reference in:

- `campaign/campaign-reference-level1-v0.4.js`
- `campaign/campaign-reference-level1-v0.4.json`

It is not the active campaign.

## Controls

Desktop: WASD, arrow keys to turn, mouse look, E interact, G collection, M map. After the Level 1 maze has been solved, `X` leaves the maze immediately from anywhere inside.

Mobile/coarse pointer: left movement pad, drag the first-person view to rotate, large USE button, and touch-sized puzzle controls.

## Persistence

First-person position, explored map, physical object state, transition state and serialized campaign runtime are stored in IndexedDB (`tokiPonaRoomsGame`). Glyphs remain permanent reusable capabilities across level transitions.

## Validation

From the package root:

```bash
node game-engine/campaign/validate-campaign.cjs
node tests/campaign-validator.test.cjs
node tests/level1-integration.test.cjs
node tests/renderer-topology.test.cjs
node tests/level3-mechanisms.test.cjs
node tests/level4-mechanisms.test.cjs
node tests/level5-mechanisms.test.cjs
node tests/level6-mechanisms.test.cjs
node tests/level7-mechanisms.test.cjs
node tests/level8-mechanisms.test.cjs
node tests/level9-mechanisms.test.cjs
node tests/game-engine-reset.test.cjs
```

The active nine-level draft validates with zero soft-lock states on all nine levels. The only expected campaign warning is that the draft currently assigns 90/120 canonical glyphs.


## v0.11 Level 3 test

Levels 1 and 2 are preserved from v0.10. Level 3 adds a signal/time wing with five distinct mechanism puzzle families (dial deduction, relay routing, checkpoint navigation, Lights Out, balance) plus a renderer-backed contextual cartouche recognition finale. The shared glyph drawer now stays open after placing or dragging a glyph, so repeated use from the same letter family does not require reopening that family. Existing save version 4 remains compatible.


## v0.12 Level 4 test

Levels 1, 2 and 3 are preserved from v0.11. Level 4 adds the Machine and Equivalence Wing with ten new canonical glyphs: `telo, poki, palisa, supa, kule, lukin, sama, ante, open, pini`.

The level deliberately avoids reusing the Level 3 mechanism families. Its five substantial chains are:

- a 3/5 water-jug measuring puzzle, using numeric glyph feedback, for `telo` + `poki`;
- a three-disc Tower of Hanoi for `palisa` + `supa`;
- a Mastermind-style four-symbol codebreaker for `kule` + `lukin`;
- a fraction/decimal/percentage equivalence board rendered through the shared nanpa-linja-n renderer for `sama` + `ante`;
- a chronological date/time schedule ordering puzzle using `suno` and `tenpo` cartouches for `open` + `pini`.

After the reservoir puzzle, Stackworks and the Codebreaker Lab form two independent branches. Both must be solved before the Equivalence Gallery opens, preventing the level from becoming another purely linear chain. The schedule archive then completes Level 4. All Level 4 mechanism UIs use the existing fixed-viewport puzzle shell and tap-first mobile controls.


## v0.13
Level 5 extends the authored campaign to 50/120 canonical glyphs while retaining Levels 1–4. The Schedule Archive deliberately exposes only rendered suno/tenpo cartouches, not ISO answer text.

## v0.14 River Crossing correction

The Level 5 River Crossing is a spatial ferry puzzle rather than a pair of abstract bank lists. `jan` is always in the ferry; the passenger set is the visually distinct `akesi`, `soweli`, and `kili`. The ferry carries at most one passenger. When `jan` is absent, `akesi` may not remain with `soweli`, and `soweli` may not remain with `kili`. The UI shows the two banks, water, ferry and passenger seat directly and reports the exact unsafe pair when a crossing is rejected. The minimum solution is seven crossings.

## v0.15 Level 5 finale

The simple rotating-pattern/next-shape puzzle has been removed. Level 5 now contains four substantial mechanism families: the seven-crossing ferry puzzle, Sokoban freight, the 3×3 sliding panel, and the final peg-solitaire strategy puzzle. The final peg solve awards `linja`, `lawa`, `kili`, and `moku` and completes the level. The unused Pantry Observatory progression room is sealed rather than leaving a dead terminal behind.

The testing-only `game-engine-reset.html?level=N` page can reset IndexedDB progress to the authored start of Levels 1–5 without replaying earlier levels. The reset now writes and verifies a unique reset-session epoch; if a stale game tab rewrites the save, the next v0.17 game load detects the mismatch and reconstructs the exact requested level start before gameplay begins.

## v0.16 Level 5 final-room restoration

The v0.13 Level 5 physical finale is restored: after both branch puzzles and the Strategy Room, `l5StrategyDone` opens the Pantry Observatory door. The peg-solitaire puzzle again awards only `linja` + `lawa`. The final room now contains **Pantry inventory**, a 6×6 nonogram that awards `kili` + `moku` and completes the level.

The removed rotating-marker puzzle is not restored. The nonogram uses row and column run-length clues rendered with sitelen digit glyphs and a three-state tap cycle (blank → filled → ×). Its authored clue set is verified to have one unique solution. The v0.15 reset utility, randomized sitelen codebreaker, and corrected seven-crossing river implementation remain in place.



## v0.21 Level 6 test

Level 5 receives two clarity/difficulty corrections before Level 6 is introduced. Sliding Gallery now starts from a verified 18-move-minimum 8-puzzle state with no numbered tile already in its target cell. Pantry inventory displays an explicit `+` between separate nonogram runs, so `3 + 2` cannot be misread as 32.

The authored Level 6 canonical set is:

`musi, lipu, pali, ken, nimi, pu, noka, nasa, sike, lon`

The physical wing has six rooms. Card Archive opens a junction with two independent branches: Calculation Bench and Country Index. Both branches must be complete before Number Systems Lab opens; that lab then opens Position Vault.

The five required Level 6 mechanisms are:

- **Card Archive** — sort five sitelen playing cards by rank. Card faces use cached supersampled glyph rendering derived from the uploaded solitaire implementation: card/suit glyph work is drawn oversized and reduced for display, with rank glyphs rendered at the higher supersampling factor.
- **Calculation Bench** — solve three arithmetic problems. The operands and entered answers are rendered using the same nanpa-linja-n renderer used elsewhere in the game; the authored set includes subtraction, a negative operand and decimal arithmetic.
- **Country Index** — solve four crossing country proper names (`Kanata`, `Kana`, `Nijon`, `Tona`). Grid cells use the universal glyph-family picker and accept any owned glyph whose Toki Pona word begins with the required letter. Crossings are single shared cells.
- **Number Systems Lab** — match ordinary decimal values to equivalent Noka binary or Nasa hexadecimal cartouches through the shared renderer.
- **Position Vault** — satisfy four relative-position clues on eight-position marker dials.

`game-engine-reset.html?level=6` produces the exact Level 6 start: all fifty canonical glyphs from Levels 1–5, none of the Level 6 canonical glyphs, no Level 6 solved state, and the Level 6 start transition pending.

The detailed historical Level 6 conversation could not be recovered from the available Project context. The Level 6 above is explicitly a reconstruction from the requirements that *were* preserved: 12 levels × 10 canonical glyphs, 4–6 substantial chains, branching world topology, fixed-viewport mobile controls, real nanpa-linja-n renderer usage, and the previously recorded future card / calculator / longer country-crossword directions.


## v0.28 Level 7 test

Level 7 is a reconstructed sensory-systems wing. No exact historical Level 7 transcript was recovered, so this design is new but follows the established campaign invariants: ten new canonical glyphs, five substantial mechanisms, branching physical topology, no bonus dependency, and fixed-viewport mobile interaction.

Canonical set:

`kalama, kute, kon, selo, sijelo, pilin, loje, jelo, pimeja, wawa`

Progression:

**Resonance Hall → Sensor Junction → Airflow Gallery / Pulse Chamber → Spectrum Laboratory → Blackout Substation**

Mechanisms:

- **Resonance memory** — replay and reproduce a five-tone/four-pad pattern. Pads flash as well as sound so the sequence is not audio-only.
- **Airflow Gallery** — rotate a branched duct network so one inlet reaches two outlets simultaneously.
- **Pulse synchronizer** — align three periodic pulse lanes at one marked gate; every adjustment also shifts the next lane in the opposite direction.
- **Spectrum filters** — arrange five labeled color filters from positional clues; the authored clue set has one solution.
- **Blackout substation** — choose breaker loads whose nanpa-linja-n values add exactly to the renderer-backed target; the authored target has one subset solution.

`game-engine-reset.html?level=7` starts with the sixty canonical glyphs from Levels 1–6 and none of the Level 7 canonical set.

Level 12 is now implemented. Its **expert 9×9 nanpa-linja-n Sudoku is the final puzzle of the campaign**, with a verified unique solution and Latin numeral fallbacks for readability.


## v0.29 Level 8 test

Level 8 deliberately raises the puzzle difficulty. Levels 1–7 are left unchanged for now; the whole campaign will be reviewed only after all twelve levels are complete.

Canonical set:

`seme, ni, sinpin, monsi, ala, anu, kepeken, tan, weka, kama`

Progression:

**Deduction Chamber → Constraint Junction → Dual Mirror Array / Truth Gate Rack → Dependency Scheduler → Transit Vault**

The five required mechanisms are designed to require simultaneous constraints rather than isolated one-step deductions:

- **Deduction Chamber** — place five glyph tokens in one unique order from seven interacting clues.
- **Dual Mirror Array** — orient seven mirrors so two beams reach two different exits simultaneously; exhaustive validation confirms one orientation of the seven mirrors satisfies both beams.
- **Truth Gate Rack** — choose AND/OR/XOR for three unknown gates so one circuit matches all eight truth-table rows; the truth table uniquely determines the gate triple.
- **Dependency Scheduler** — arrange seven glyph-labeled operations under seven simultaneous precedence/adjacency constraints; the clue set has one valid permutation.
- **Transit Vault** — find a non-revisiting eight-move route through a 4×4 numeric grid, finish at the opposite corner and hit an exact nanpa-linja-n sum; exhaustive path validation confirms one route.

`game-engine-reset.html?level=8` starts with the seventy canonical glyphs from Levels 1–7 and none of the Level 8 canonical set.

The previous moderate-Sudoku plan is superseded by v0.42: Level 12 ends with an expert, uniquely solvable 9×9 Sudoku using nanpa-linja-n glyphs 1–9 with Latin numeral fallbacks.


## v0.34 Level 9 Sphinx memory trial + Level 10 design proposal

The Level 9 Sphinx no longer asks three disconnected dictionary-style riddles. Its pool now contains one memory question tied to a real interaction from each of Levels 1–8. Each trial selects one early, one middle and one late memory, shuffles their order, shuffles answer positions, and persists that randomized trial in the current save. A wrong answer still returns the player to the first selected memory.

The post-Sphinx quick exits from v0.33 remain unchanged: solving the trial explicitly opens the ladder to the upper loft and the trapdoor to the lower chambers.

A new **Level 10 design proposal** is recorded in `MASTER-PLAN.md` and expanded in `LEVEL-10-DESIGN.md`: a multi-floor cold-market/logistics tower using `esun, mani, pan, suwi, lete, len, ko, jaki, laso, walo`, with a delivery cart, conveyor/freight-lift navigation, contextual prices/percentages, signed temperatures, dates/times and recoverable cargo routing. It is a design proposal only in v0.34; Level 10 is not yet implemented.

## v0.32 Level 9 navigation and interaction update

Level 9 keeps the three-floor structure from v0.30, but the middle labyrinth now branches almost immediately and contains additional cross-connections/loops rather than beginning with a long forced corridor. The entrance ladder is permanently marked on the minimap and visually distinguished in the world.

Interaction discovery is now global and proximity-only across every level: an `E`/`USE` prompt appears whenever the player is within the interaction radius, without requiring the object to be centred, faced, camera-visible, or line-of-sight visible. The nearest in-range interactable is selected.

The Level 9 survey also exposes a persistent `0/3`–`3/3` objective count, records marker progress in field notes, and explicitly directs the player back to the Sphinx Court after the third marker.

## v0.30 Level 9 test

Level 9 deliberately breaks the repeated single-floor six-room pattern. It has six significant spaces distributed over three physical floors, with ladders and state-dependent trapdoors replacing the usual locked-door progression.

Canonical set:

`alasa, insa, wile, taso, suli, lili, ike, pona, tomo, la`

Physical structure:

- **Upper floor:** Survey Gallery + Counterweight Loft
- **Middle floor:** a large Vertical Labyrinth + central Sphinx Court
- **Lower floor:** Counterweight Chamber + isolated Alignment Vault

Progression is driven by navigation changes. Surveying the labyrinth enables the Sphinx; solving the Sphinx reveals a lower trapdoor and an upper shortcut; correctly carrying/placing three relics creates another direct ladder; solving the coupled shaft controls makes a new vault trapdoor physically appear on the upper floor.

The three carried relics begin on three different floors (`sike`, `kiwen`, `poki`). The player can carry one at a time, place it on any lower counterweight pedestal, pick it back up if wrong, and must eventually satisfy all three pedestal clues.

The final Alignment Vault uses three independently rotatable five-by-five floor plans. Shafts A/B/C must land on the same three marked coordinates on every floor. Exhaustive validation confirms one orientation triple.

Implemented late-campaign note: Level 12 ends with an **expert 9×9 Sudoku** as the last campaign puzzle; entries use nanpa-linja-n glyphs 1–9 with small Latin numeral fallbacks.
