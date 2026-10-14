Inline descriptive numeric cartouches are renderer-backed: localization keeps the nanpa-linja-n source string in `data-nanpa-source`, and the game engine renders it to a canvas. The source notation itself must never be displayed as player-facing text. If the renderer is unavailable, the UI falls back to the Latin numeric value only.

Mechanism numeric cartouches are also layout-bounded: every non-Sudoku mechanism numeric host constrains the renderer canvas to the control width, and its Latin fallback is stacked below rather than allowed to widen the control. Compact puzzle surfaces such as the Level 5 sliding tiles use one consistent cartouche bounding box at each responsive breakpoint.

# v0.75 — Numeric cartouches everywhere except Sudoku

Player-facing numeric values in the Toki Pona interface now consistently use nanpa-linja-n numeric cartouches. This includes mechanism values as well as prose: clock dials, weights, vessel readings, disc/tile numbers, nonogram clues, schedule ranks, tone/pulse labels, order slots, truth-table values, exact-path values, coupled-switch labels, cold-chain settings/readings and triangulation distances. Renderer-backed ordinary decimal canvases are normalized to explicit **Nanpa-format** sources.

Signed values keep their sign inside the cartouche (`en` for positive, `ona` for negative). The developer `z` floor coordinate has been removed from the HUD. The deliberate exception is the final Sudoku: Sudoku cells and keypad retain straight digit glyphs, and tiny pencil notes remain Latin decimal numerals because that is materially easier to read while solving. The Level 3 raw `03:09` source display remains raw because converting it to a contextual time cartouche would reveal the answer to that recognition puzzle.

# v0.72 — directional translation vocabulary

Toki Pona positional labels now use one campaign-wide vocabulary: **`poka loje` = left**, **`meso` = middle**, and **`poka laso` = right**. This applies to puzzle labels, relational clues, river banks, route instructions and other translated left/middle/right references. Arrow characters are reserved for cases where the symbol itself is meaningful (for example keyboard keys, ordered sequences, rotation, or up/down route markers), rather than being used as a substitute for the translated words.

# v0.70 — Toki Pona numeric display and literal punctuation

Toki Pona UI prose now promotes standalone descriptive decimal values to explicit abbreviated nanpa-linja-n **Nanpa-format** cartouches. The conversion is centralized in the localization renderer, so level numbers, progress counts and totals stay consistent. A small Latin value remains beside the cartouche for readability. Ratios used as progress/total values are encoded as one fraction cartouche: for example `7/10` uses `[nanpa1/2 :1/2 mun o2/3 o2/3 wan ijo nanpa1/2]` rather than two independent decimal cartouches. Mixed fractions, decimals and percentages are supported by the same helper when they occur in Toki Pona prose.

Localization also supports explicit literal punctuation with `{{...}}`. Use this whenever a symbol is meant literally rather than as nasin-nanpa/sitelen syntax, e.g. `{{+}}`, `{{−}}`, `{{=}}`, `{{(}}`, `{{)}}`. The renderer additionally protects bare `+`, `-`, `−`, `&`, `[`, `]`, `(`, `)` and `=` in Toki Pona prose. This prevents arithmetic clues such as the Level 3 clock equations from turning `+` into a compound marker.

# v0.68 — Toki Pona-first localization

`game-engine.html` now has a persistent **Toki Pona / English** language selector. The setting is stored in localStorage under `toki-pona-rooms-language`; when no valid setting exists, the game starts in **Toki Pona**. The selected language applies to the static game-engine page, HUD and objectives, room names/hints, puzzle titles/instructions/objectives, clues/evidence, field messages and submission feedback across all twelve levels. Switching language rerenders the active interface without changing puzzle or campaign state.

Toki Pona prose uses the existing `NasinNanpaGame` font/ligatures for sitelen pona. Localization strings may mark exact referenced tokens as `[[word]]`; those marked terms remain in Latin text with a subtle highlight so clues can clearly refer to a particular word such as `suno` or `telo` while the surrounding explanation remains sitelen pona. The same explicit markers also subtly highlight those operands in English mode, avoiding ambiguous automatic word detection. Relationship clues are authored semantically rather than as literal English-calque sentences: compact arrows, gaps and slot diagrams are used where they communicate immediate-before, somewhere-before, distance and similar constraints more clearly in Toki Pona. No puzzle mechanics, solutions, progression rules or glyph awards are changed by localization.

# v0.67 — Level 10 advanced numeric reasoning + medium final Sudoku

Level 10 now has a stronger late-game identity: the player must **derive multiple related values and then encode them** as nanpa-linja-n cartouches. The Market allocation ledger states each equal lot as the exact fraction **1/16** and requires three calculated percentages; the Cold Store keeps its coupled-control mechanism and then requires three normalized scientific-notation records before the upper lift opens; the Textile Loft requires three mixed-fraction arithmetic totals before physical cloth routing. These use the shared glyph-family picker, submission-only **Try answer**, and the nanpa-linja-n PDF cheat-sheet reference. Physical cart delivery, cold controls, cloth placement and final dispatch/quarantine remain in the route.

Level 12 keeps Sudoku as the final 120-glyph action but changes it from a 23-given expert grid to a **29-given medium grid** with the same unique solution. It still uses nanpa-linja-n digit glyphs, persistent Latin fallbacks, notes, and submission-only correctness, but no longer creates an expert-Sudoku endurance wall after the other four final master trials.

## Mobile puzzle fit

Mobile landscape is a hard whole-game acceptance contract, not a per-puzzle best effort. Every level, puzzle, puzzle control, normal game control, reward/completion overlay and required interaction must fit inside the **actual available game/content area** without page or modal scrolling and without clipped controls; physical screen height is not treated as fully usable. The landscape game shell is pinned to the viewport and actively clears stale page scroll on startup/orientation changes, so the player must not manually nudge the gameplay area into position. Short landscape layouts reserve real space for the game heading/status UI, explicitly compact dense mechanisms (including pattern/shape, colour-order, XOR/OR truth gates, mirror arrays, river crossing and Sudoku), and apply a final measured overflow-fit guard only to the actual puzzle display area. That guard measures visible descendant bounds as well as scroll dimensions. The live cartouche/glyph-family input dock and the shorter Reset/Try/Leave action row are reserved zones and can never be used as puzzle display space. The Level 2 coordinate clue and map use a side-by-side short-landscape layout to keep the grid readable, and multi-value numeric/cartouche entry rows use horizontal clue/slot rows so three-answer screens stay clear of the buttons. Sudoku keeps the 9×9 board compact and promotes the selected square into a larger focus cell above the notes/keypad. Dense square boards (both mirror arrays and Sudoku) are top-anchored with explicit instruction clearance in short landscape so row 1 cannot be clipped by centered overflow. Mirror puzzles keep the first mirror on each beam in its authored starting orientation while later mirrors are randomized once per campaign and persisted, avoiding the old obvious “flip every mirror” start pattern without changing the unique solution. Puzzle logic and solutions are unchanged.

# v0.42 — playable Level 12 final archive / complete 120-glyph campaign

Level 12 is implemented as the final and deliberately hardest campaign level. It uses four physical floors and five required master trials: a unique ten-switch parity network, a uniquely constrained eight-record identity permutation, a persisted randomized six-glyph totality cipher, a unique three-beam/ten-mirror relation array, and finally a medium 9×9 nanpa-linja-n Sudoku. The Sudoku is physically isolated on the deepest floor and is always the last puzzle; the FINAL hatch appears only after all three preliminary branch states are complete.

Canonical Level 12 glyphs are `a, ale, li, mi, mute, olin, pakala, pi, sin, sina`. Completing the final Sudoku reaches all **120/120 canonical glyphs**. Exact Level 12 reset starts with 110 prior canonical glyphs and 0/10 Level 12 glyphs. The complete implementation and uniqueness/mobile/save acceptance criteria are documented in `LEVEL-12-DESIGN.md`.

As of v0.67, the final Sudoku is deliberately medium difficulty rather than expert: it remains unique, supports notes, uses nanpa-linja-n glyphs with persistent Latin numeral fallbacks, and reveals correctness only through **Try answer**.

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

The level is built around a persistent two-cargo delivery cart and changing navigation state rather than a long sequence of locked rooms. Progression runs through a three-answer percentage allocation ledger, manifest-driven bread/sweet deliveries, coupled signed-temperature cold controls followed by a three-answer scientific-notation recorder, three mixed-fraction dye-batch calculations with recoverable cloth routing, and a final dispatch/quarantine audit that reuses the same shipment records. Solved branches activate the basement route, chilled service lift and upper-to-ground awning shortcut. The three audit-only rooms—Dispatch, Ledger Office and Quarantine—stay behind synchronized inspection shutters until the textile stage is complete, preventing reachable rooms with no active content.

Level 10 physical and mechanism state is saved, including cart dock/cargo, parcel placements, cloth/sample locations and the active coupled cold-control mechanism state. `game-engine-reset.html?level=10` starts an exact Level 10 test state with the 90 prior canonical glyphs and 0/10 Level 10 glyphs.

Level 10 is followed by the implemented Level 11 sanctuary and Level 12 Final Archive.

# Toki Pona Rooms — complete 12-level campaign

# Developer QA campaign playback

QA automation is deliberately disabled in normal play. Load `game-engine.html?qa=1` to install the developer API and the small QA playback badge. The primary global is `TPQA`; `TPQR` and `TRQA` are aliases for convenience.

Useful console commands:

```js
await TPQA.runCampaign();          // visibly continue from the current save
await TPQA.runCampaign({speed:2}); // faster playback
TPQA.pause();                      // pause after the current progression action
TPQA.resume();
await TPQA.step();                 // one progression action while inspecting
await TPQA.back();                 // restore the start of the previous QA puzzle
await TPQA.solve();                // solve the currently open/focused puzzle
await TPQA.solveAndNext();         // solve, apply rewards, then go to the next reachable objective
TPQA.answer();                     // print the current/generated answer without solving
TPQA.status();                     // current level, target, speed and collection count
TPQA.variant();                    // persisted generated variant for the current puzzle, if any
TPQA.stop();                       // stop autoplay; leave the game/save where it is
await TPQA.restartCampaign();      // intentional reset and QA run from Level 1
```

During QA playback the keyboard shortcuts are `P` pause/resume, `N` step once, `B` restore the previous puzzle start, `R` run/continue, `X` restart from Level 1 and immediately run, `S` stop, `[` slower and `]` faster. They are registered only in `?qa=1` mode and are ignored while typing in an input, textarea, select or contenteditable element. Outside QA mode, `X` keeps its normal game behavior. On touch devices the QA controls are concealed until the tester double-taps the small top-left corner hotspot **inside the game viewport**. That pauses an active run at the next safe playback boundary and reveals touch buttons for `P / R / N / B / S / − / + / Ignore / X`; `P` is intentionally first and destructive restart `X` last. The reveal gesture consumes its own synthesized click so opening the strip cannot activate a button; `Ignore` hides the strip without opening a keyboard or changing the current QA state. On short landscape screens the full button set spans the game display in one compact row above gameplay and puzzle overlays. On desktop/laptop fine-pointer input, the QA panel is also an explicit pointer barrier: clicking or double-clicking its controls cannot start viewport mouse-look/drag or leak through to gameplay.

QA also records an in-memory checkpoint at the start of each puzzle it reaches. While paused, `B` / `TPQA.back()` restores the complete engine + campaign snapshot for the previous puzzle and reopens/refocuses that puzzle at its start. Repeated `B` presses walk backward through earlier puzzle starts. The first backward step cleanly terminates the existing forward `runCampaign()` loop before any checkpoint is restored; therefore there is no stale paused async runner left behind. After one or more backward steps, `R` always starts a fresh forward runner from the currently restored/manual live state. Later history is discarded as QA advances again, so Sudoku entries, mirror rotations, carried objects, solved flags and rewards from the abandoned future branch cannot leak into the replay. These checkpoints are QA-session history only and are deliberately cleared by an explicit campaign restart/reset.

`runCampaign()` is intended as visible QA playback rather than an instant save mutation. Before accelerated transport, QA proves that the destination is physically reachable through the current map and door state. Eligible doors are opened through the normal interaction path, and floor changes use the authored ladder/hatch/maze transitions. Puzzle completion uses normal validation/completion/reward handling wherever practical; generated mechanism state is rendered before submission so the tester can see the solved puzzle. Resume is state-recovering rather than happy-path dependent: if a tester pauses and manually leaves a normal popup/mechanism puzzle, `R` reacquires and reopens that focused puzzle through its world object before using the normal popup solver; only genuinely physical puzzle types enter the physical solver. Mechanism puzzles rebuild from the live authored definition into a known solved state (so tester Sudoku entries/notes, mirror rotations, truth-gate choices, etc. cannot strand playback), while mutable carry/placement puzzles normalize misplaced tester objects before continuing. The final 120/120 celebration is deliberately left on screen.

After pausing to inspect a problem, source files can be changed and the page reloaded; rerunning `TPQA.runCampaign()` continues from the campaign state preserved in the save. Use `restartCampaign()` only when a fresh Level 1 run is specifically required.


## Mobile first-person controls

Touch gameplay uses a circular lower-left joystick with an inner dead zone and a nonlinear radial speed response: movement begins very slowly just outside the dead zone, then ramps much more strongly through the middle and outer radius for practical maze traversal, while turning ramps more gently. Outside the dead zone the joystick is divided into four 90-degree quadrants with diagonal boundaries. The top quadrant moves forward and the bottom quadrant moves backward; the initial touch in either vertical quadrant is straight with no rotation. While the same touch remains in that top or bottom quadrant, sideways dragging adds steering in the dragged direction while translation continues. The left and right quadrants always stop translation and rotate in place. Crossing from a vertical quadrant into either side quadrant immediately cancels forward/backward motion; re-entering top or bottom establishes that direction again with steering reset to straight. Strong outer-rim joystick input also catches up elapsed simulation time in small collision-safe steps when rendering is slow, so low mobile frame rates do not artificially reduce travel or turning speed. Mobile movement also uses a circular player-vs-wall collision footprint at exposed wall corners, preserving the full player radius while reducing corner snagging; wall faces, closed doors and diagonally touching solid cells remain impassable. The lower-left viewport is reserved for this control during first-person exploration; required HUD/navigation information must not depend on that area. The main 3D viewport also supports press/drag navigation: the generous central horizontal band preserves the existing left/right drag-to-turn behavior, while holding or dragging sufficiently above that band moves forward and sufficiently below it moves backward; movement begins slowly at the band edge and strengthens toward the top/bottom screen edge, and vertical movement suppresses horizontal turning until the pointer returns to the centre band. On touch devices the minimap is directional rather than destination/pathfinding control: hold anywhere on the map, including unrevealed space or background outside the drawn floor/maze, to point the player immediately in that direction and travel as far as collision permits. Once a drag begins on the minimap, pointer capture keeps steering active even when the finger moves beyond the minimap bounds; the current drag position continuously retargets the facing/travel direction until release. Normal world collision still blocks walls and closed doors. The dotted map guide is clipped to the currently revealed walkable portion and stops at the fog-of-war frontier, so touching unrevealed space does not reveal hidden maze geometry. Map steering never activates interactions or changes floors automatically. Full-screen puzzles and modal overlays hide the joystick and USE control so puzzles retain the full mobile viewport. Desktop `A`/`D` strafing is unchanged.


## v0.10 Level 2 testing fixes

The Level 2 coordinate-map and hidden-cache chain is now explicit and viewport-safe. The coordinate map fits inside the puzzle viewport without vertical page/modal scrolling, displays compact row/column coordinate labels, and keeps Leave visible. Solving it reports that the cache is in the **Lower Archive** and places a marker on the minimap.

The revealed cache itself displays the three source glyphs `kiwen → ma → kiwen` both in-world and above the answer slots. Its instruction now plainly asks the player to enter those same three sitelen pona glyphs in the same order. Completing the cache recovers `nena` and immediately opens the Laboratory door. The later full-form bridge reconstructs the verified thousands punctuation sequence `NEKE` as `nena → e → kulupu → e`, rewards `en`, and immediately opens both Foundation Vault doors. The Level 2 end inventory is unchanged; only the acquisition order of `nena` and `en` has moved.

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

Normal glyph-key and country-cartouche puzzles are designed to fit inside one game viewport on laptops and phones. In mobile landscape the puzzle card, letter-family selector and glyph drawer do **not** depend on scrolling: available letter families share a compact row, the active family's glyphs wrap inside a bounded drawer, and Clear / Try answer / Leave remain visible. Portrait layouts may use their separate responsive behavior, but short landscape viewports must never push required controls outside the usable game area.


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

Level 12 is now implemented. Its **medium 9×9 nanpa-linja-n Sudoku is the final puzzle of the campaign**, with a verified unique solution and Latin numeral fallbacks for readability.


## v0.29 Level 8 test

Level 8 deliberately raises the puzzle difficulty. Levels 1–7 are left unchanged for now; the whole campaign will be reviewed only after all twelve levels are complete.

Canonical set:

`seme, ni, sinpin, monsi, ala, anu, kepeken, tan, weka, kama`

Progression:

**Deduction Chamber → Constraint Junction → Dual Mirror Array / Truth Gate Rack → Dependency Scheduler → Transit Vault**

The five required mechanisms are designed to require simultaneous constraints rather than isolated one-step deductions:

- **Deduction Chamber** — place five glyph tokens in one unique order from seven interacting clues.
- **Dual Mirror Array** — orient seven mirrors so two beams reach two different exits simultaneously; exhaustive validation confirms one orientation of the seven mirrors satisfies both beams.
- **Truth Gate Rack** — choose AND/OR/XOR for three unknown gates so one circuit matches all eight truth-table rows; the table shows fixed `Y target` and live `Y now` outputs for every row, with match/mismatch feedback and an `N / 8 rows match` counter. The truth table uniquely determines the gate triple.
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

Interaction discovery is global across every level and now uses **proximity plus unobstructed world line of sight**. The player does not have to centre or face an object: an in-range object behind the player can still expose its `E`/`USE` prompt because rotating toward it would reveal it. However, walls and closed doors block interaction discovery, so glyphs, panels and other interactables on the far side of maze geometry cannot be selected through the wall. The nearest in-range, unobstructed interactable is selected.

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

Implemented late-campaign note: Level 12 ends with a **medium 9×9 Sudoku** as the last campaign puzzle; entries use nanpa-linja-n glyphs 1–9 with small Latin numeral fallbacks.

### Puzzle submission invariant

Puzzle answer controls follow a campaign-wide submission-only rule: ordinary answer puzzles use **Try answer**, the submit control stays available before correctness is known, and configuration/sequence correctness is not signalled by enabling, highlighting, or per-slot green/red feedback before submission. Incomplete or wrong submissions are evaluated only after **Try answer** is pressed and receive neutral whole-answer feedback.


## Early-level answer guidance

Levels 1–3 intentionally provide a small amount of tutorial feedback after a failed **Try answer** submission. Correctly placed answer components may receive a subtle positive outline, while incorrect components remain neutral. Nothing is marked correct before submission, and editing the answer clears the confirmation until the next attempt. From Level 4 onward, puzzle submission returns to whole-answer feedback only with no per-component correctness leakage.
