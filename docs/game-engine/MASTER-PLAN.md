# Toki Pona Rooms — authoritative working master plan (v0.30)

This file is the build-time source of truth for campaign decisions that are currently recoverable and verified.

**Historical limitation:** the detailed earlier transcript for the original Level 6 design could not be recovered from the available Project context. Level 6 in v0.21, Level 7 in v0.28, Level 8 in v0.29, and Level 9 in v0.30 are explicitly marked **reconstructed** where no exact historical specification was recoverable. Levels 10–12 were subsequently designed and implemented in this project; their current specifications are documented as new/reconstructed designs rather than claimed historical agreements.

## Campaign invariants

- Target: 12 levels × 10 canonical original-120 glyphs = 120.
- A canonical glyph is guaranteed by its designated level; bonus/future glyphs may never be required for the minimum-solvable path.
- Current-level completion uses exact canonical identities plus mandatory world-state objectives, never a raw glyph count.
- Owned glyphs are permanent reusable capabilities and are never consumed.
- Mandatory puzzles must involve real deduction, ordering, navigation, manipulation, state change, or multi-step reasoning.
- Physical progression must be modeled: areas, gates, reveals, movable state and solved-state effects.
- Solved physical puzzle stations turn green.
- After major solves, topology should open forward routes/shortcuts rather than require tedious retracing.
- Ordinary mandatory puzzles must fit the available game viewport. On phones, no whole puzzle/modal vertical scrolling; controls remain touch-sized and visible.
- The universal glyph-key picker keeps the last selected letter drawer open after placement.
- Numeric cartouches must be produced/validated using the actual nanpa-linja-n renderer/parser, not decimal-character assumptions.
- Reset testing page: `game-engine-reset.html?level=N` must produce the exact authored start of that level with earlier canonical progression only.
- Difficulty progression from Level 8 onward must rise materially: later puzzles should require several simultaneous constraints, coupled consequences, or multi-condition solutions rather than mostly isolated one-step deductions.
- Do not retroactively rebalance Levels 1–7 while authoring Levels 8–12. Complete the twelve-level campaign first, then review the campaign difficulty curve as a whole.
- From Level 9 onward, make navigation state part of puzzle state more often: ladders, trapdoors, shafts, shortcuts and reachable spaces should appear/change because of puzzle outcomes rather than relying on another repeated row of locked doors.
- Reintroduce carried physical objects in more elaborate forms across the remaining levels. Objects must remain recoverable, can be moved between floors/areas where useful, and their placement should change world state or progression.
- Avoid defaulting back to the repeated six-chambers-on-one-floor layout. Significant spaces may still number around six, but distribute them vertically or structurally when that produces more interesting navigation.

## Levels 1–2 — twenty-glyph foundation

### Level 1
Canonical:
`o, e, wan, tu, seli, awen, luka, nanpa, ona, ma`

### Level 2
Canonical:
`ijo, utala, mun, pipi, jo, en, kulupu, kala, nena, kiwen`

By the end of Level 2, all Toki Pona initial-letter families needed by the glyph picker are guaranteed and the ordinary abbreviated decimal nanpa-linja-n repertoire is established. `kin`, `kipisi`, and other Common Sitelen Pona 2026 extras outside the original 120 remain baseline.

## Level 3 — signal/time wing

Canonical:
`tenpo, suno, toki, kasi, nasin, tawa, sitelen, sona, ilo, poka`

Required mechanisms:
1. Clock alignment → `tenpo + suno`
2. Relay routing → `toki + kasi`
3. Beacon route/checkpoints → `nasin + tawa`
4. Lights Out observation grid → `sitelen + sona`
5. Balance machine → `ilo + poka`
6. Renderer-backed contextual time/date/decimal recognition finale

## Level 4 — machine/equivalence wing

Canonical:
`telo, poki, palisa, supa, kule, lukin, sama, ante, open, pini`

Required mechanisms:
1. 3/5 water-jug measurement → `telo + poki`
2. Three-disc Tower of Hanoi → `palisa + supa`
3. Randomized sitelen-pona Mastermind-style codebreaker → `kule + lukin`
4. Fraction/decimal/percentage equivalence → `sama + ante`
5. Date/time schedule ordering using cartouches only → `open + pini`

The Hanoi and codebreaker branches are independent and both gate equivalence.

## Level 5 — transport/strategy wing

Canonical:
`jan, soweli, pana, lupa, sewi, anpa, linja, lawa, kili, moku`

Required mechanisms:
1. River Crossing → `jan + soweli`
   - 4 rows × 4 columns.
   - Column 1 left bank; columns 2–3 river/dock; column 4 right bank.
   - Objects: `pan`, `waso`, `soweli` = grain/chicken/fox.
   - Objects begin in column 1, rows 2/3/4.
   - `jan` operates a `supa` raft.
   - Raft docks clearly at column 2 or 3, moves vertically while docked, loads/unloads only an aligned object, and crosses horizontally.
   - Loaded raft uses Nasin Nanpa compounds `supa&pan`, `supa&waso`, `supa&soweli`.
   - Unsafe unattended pairs: `pan + waso`, `waso + soweli`.
2. Freight Bay Sokoban → `pana + lupa`
3. 3×3 Sliding Gallery → `sewi + anpa`
   - v0.21 start `[8,6,2,1,0,3,5,4,7]`
   - verified minimum solution depth 18
   - no numbered tile begins in its target cell
4. Peg solitaire strategy line → `linja + lawa`
5. Pantry 6×6 nonogram → `kili + moku`
   - separate run clues always show an explicit `+`, e.g. `3 + 2`

## Level 6 — records/number-systems wing — RECONSTRUCTED v0.21

The exact historical Level 6 transcript was unavailable. This level was reconstructed only from preserved master-plan directions: ten glyphs per level, 4–6 substantial mechanisms, branching physical topology, mobile fixed-viewport interaction, and the recorded future use of playing cards, calculator work, and a longer country/proper-name crossword.

Canonical:
`musi, lipu, pali, ken, nimi, pu, noka, nasa, sike, lon`

Topology:
- Start: Card Archive.
- Card Archive opens Records Junction.
- Calculation Bench and Country Index are independent branches.
- Both branch solves open Number Systems Lab.
- Number Systems Lab opens Position Vault.
- Position Vault completes Level 6.

Required mechanisms:
1. **Card Archive** → `musi + lipu`
   - sort five sitelen playing cards by ascending rank
   - card faces use a direct adaptation of the `solitaire-toki(5).html` face-rendering pipeline (82×116 cards; exact corner/centre placement; 4× suit and 8× rank supersampling; same enclosed-region fill-mask algorithm)
   - Solitaire suit mapping is `♠→ilo`, `♥→pilin`, `♦→kiwen`, `♣→kasi`
   - every rank/suit glyph shown is guaranteed before Level 6
2. **Calculation Bench** → `pali + ken`
   - three renderer-backed calculations: `73 − 28`, `15 − 27`, `-3.5 + 8.25`
   - operands and entered answers use the shared nanpa-linja-n renderer
   - operation glyphs follow the calculator mapping: addition=`en`, subtraction=`lape`
   - the keypad accepts actual `+`/`−` expressions (for example `73−28`), renders working as number-cartouche/operator/number-cartouche, and Enter evaluates the expression before checking the required result
3. **Country Index** → `nimi + pu`
   - crossing proper names: Kanata, Kana, Nijon, Tona
   - cells use the universal reusable glyph picker
   - any owned Toki Pona glyph with the required initial is valid
   - crossing letters occupy one shared cell
   - broad country clues are intentionally allowed: any clue-bank answer that matches the clue, length and shared crossings is valid
   - clue/grid indexes use two-digit abbreviated nanpa-format cartouches (`01`, `02`, ...), matching the original crossword
4. **Number Systems Lab** → `noka + nasa`
   - match decimal targets to equivalent Noka binary or Nasa hexadecimal cartouches
   - binary/hexadecimal parsing is explicitly enabled for these choices so `0b…` renders as Noka and `#…` as Nasa
   - each of the three first selections is accepted without correctness feedback; only the complete three-answer set is evaluated
   - a failed set regenerates new numbers for the next attempt
   - render all values through the shared renderer
5. **Position Vault** → `sike + lon`
   - four marker dials with eight positions
   - the first ring is positioned from the top reference; every later ring is positioned relative to the immediately previous ring (`suno → mun → ma → toki`)
   - clues use both clockwise and anti-clockwise relationships so an early deduction error propagates through the chain

Exact Level 6 reset start:
- 50/120 prior canonical glyphs
- 0/10 Level 6 canonical glyphs
- no Level 6 puzzles solved
- Level 6 intro pending

## Level 7 — sensory-systems wing — RECONSTRUCTED v0.28

No exact historical Level 7 transcript was recovered. This Level 7 is a new reconstruction that follows the campaign invariants rather than claiming to reproduce a lost prior specification.

Canonical:
`kalama, kute, kon, selo, sijelo, pilin, loje, jelo, pimeja, wawa`

Topology:
- Start in Resonance Hall.
- Solving Resonance Memory opens Sensor Junction and two independent branches.
- Airflow Gallery and Pulse Chamber can be solved in either order.
- Both branches are required to open Spectrum Laboratory.
- Spectrum Laboratory opens Blackout Substation.
- Blackout Substation completes Level 7.

Required mechanisms:
1. **Resonance Memory** → `kalama + kute`
   - five-tone sequence across four pads
   - explicit replay control
   - tones are accompanied by visible pad flashes, so the puzzle is not audio-only
2. **Airflow Gallery** → `kon + selo`
   - rotatable duct network
   - one inlet branches to two separate outlets
   - both outlets must be connected simultaneously
3. **Pulse Synchronizer** → `sijelo + pilin`
   - three periodic pulse lanes
   - marked target gate
   - adjusting one lane also shifts the next lane in the opposite direction
   - authored start has a verified multi-move solution path
4. **Spectrum Filters** → `loje + jelo`
   - five labeled color filters
   - swap two filters at a time
   - all positional clues must hold simultaneously
   - authored clue set has one solution
5. **Blackout Substation** → `pimeja + wawa`
   - breaker loads and target render through the shared nanpa-linja-n renderer
   - select a subset whose total exactly equals the target
   - authored load set has one valid subset

Exact Level 7 reset start:
- 60/120 prior canonical glyphs
- 0/10 Level 7 canonical glyphs
- no Level 7 puzzles solved
- Level 7 intro pending

## Level 8 — constraint-systems wing — RECONSTRUCTED v0.29

No exact historical Level 8 transcript was recovered. Level 8 is therefore a new reconstruction, with an explicit difficulty increase over the middle campaign.

Canonical:
`seme, ni, sinpin, monsi, ala, anu, kepeken, tan, weka, kama`

Topology:
- Start in Deduction Chamber.
- Solving Deduction Chamber opens Constraint Junction and two independent branches.
- Dual Mirror Array and Truth Gate Rack can be solved in either order.
- Both branches are required to open Dependency Scheduler.
- Dependency Scheduler opens Transit Vault.
- Transit Vault completes Level 8.

Required mechanisms:
1. **Deduction Chamber** → `seme + ni`
   - five glyph tokens
   - seven interacting positional constraints
   - one verified permutation solution
2. **Dual Mirror Array** → `sinpin + monsi`
   - 5 × 5 array
   - seven independently rotatable `/` or `\` mirrors
   - two separate beams enter from the west
   - each beam has its own required exit
   - both target exits must be reached simultaneously
   - exhaustive search over all 128 mirror orientations confirms one solution
3. **Truth Gate Rack** → `ala + anu`
   - three unknown gates selected from AND / OR / XOR
   - gate 1 receives A,B; gate 2 receives B,C; gate 3 combines the first two outputs
   - all eight input rows are shown
   - one gate triple satisfies the entire truth table
4. **Dependency Scheduler** → `kepeken + tan`
   - seven glyph-labeled operations
   - seven precedence/adjacency constraints
   - all clues must hold simultaneously
   - one verified order
5. **Transit Vault** → `weka + kama`
   - 4 × 4 grid of nanpa-linja-n digit values
   - start upper-left; finish lower-right
   - exactly eight moves / nine visited cells
   - cells cannot be revisited
   - visited values must total an exact renderer-backed target
   - exhaustive path search confirms one valid route

Exact Level 8 reset start:
- 70/120 prior canonical glyphs
- 0/10 Level 8 canonical glyphs
- no Level 8 puzzles solved
- Level 8 intro pending

## Level 9 — vertical labyrinth / navigation-state wing — RECONSTRUCTED v0.30

No exact historical Level 9 specification was recovered. Level 9 is a new reconstruction built from the agreed late-campaign direction: higher difficulty, more navigation-state interaction, multi-floor spaces, ladders/trapdoors instead of another locked-door sequence, a harder returning maze, a Sphinx-style riddle encounter, and more elaborate carried-object placement.

Canonical:
`alasa, insa, wile, taso, suli, lili, ike, pona, tomo, la`

Physical structure:
- **Upper floor (+1):** Survey Gallery + Counterweight Loft
- **Middle floor (0):** Vertical Labyrinth + central Sphinx Court
- **Lower floor (-1):** Counterweight Chamber + isolated Alignment Vault
- No Level 9 progression doors. Vertical access is controlled by ladders, trapdoors and shortcuts that physically appear as world state changes.

Required chains:
1. **Labyrinth Survey** → `alasa + insa`
   - large physical maze, harder than the Level 1 maze
   - three survey markers at distant genuine dead ends
   - all three markers must be physically found before the Sphinx puzzle becomes available
2. **Sphinx Court** → `wile + taso`
   - cumulative-memory trial built only from interactions the player already completed in Levels 1–8
   - authored pool contains one memory from every prior level; each trial selects one early, one middle and one late memory
   - selected riddle order and answer positions are shuffled and persisted for the current save so the correct choice is not systematically first and does not move on reload
   - all three must be answered in one run; a wrong answer resets the sequence to the first selected memory
   - success explicitly opens a quick-exit ladder to the upper loft and a trapdoor to the lower chambers
3. **Counterweight Relics** → `suli + lili`
   - three carried relics begin on three different floors: `sike`, `kiwen`, `poki`
   - player can carry only one at a time
   - three lower-floor pedestals have different placement clues
   - wrong placements are recoverable: a placed relic can always be picked back up
   - completing all placements causes a new direct lower/upper ladder to appear
4. **Shaft Polarity** → `ike + pona`
   - six route lamps and five coupled levers
   - every lever flips three lamps
   - unique switch combination from the authored start
   - success causes a new upper-floor trapdoor to the isolated Alignment Vault to appear
5. **Three-floor Alignment** → `tomo + la`
   - three independently rotatable 5×5 floor plans
   - shafts A, B and C must all occupy their marked coordinates on every layer
   - exhaustive 4×4×4 rotation search confirms one valid orientation triple

Exact Level 9 reset start:
- 80/120 prior canonical glyphs
- 0/10 Level 9 canonical glyphs
- no Level 9 solved state
- Level 9 intro pending
- physical start on the upper floor

## Level 12 finale requirement — IMPLEMENTED / superseded by v0.42

The earlier moderate-difficulty Sudoku note has been superseded by the explicit final-level direction: Level 12 is the hardest campaign level and the **expert 9×9 nanpa-linja-n Sudoku is the last puzzle solved**. The shipped grid has a verified unique solution, supports notes, preserves Latin numeric fallbacks, and gives no correctness indication until **Try answer** is submitted.

## Level 10 — cold market / logistics tower — IMPLEMENTED IN v0.35

Level 10 continues the late-campaign direction established in Level 9: navigation state, physical cargo movement and previously learned nanpa-linja-n formats interact inside one connected environment instead of reverting to a row of isolated puzzle rooms.

Canonical set:
`esun, mani, pan, suwi, lete, len, ko, jaki, laso, walo`

Implemented physical structure:
- **Ground floor:** Receiving Bay, central Market Arcade and Dispatch Bay
- **Upper floor:** Textile/Dye Loft and Ledger Office
- **Basement:** Cold Store and Quarantine route
- Freight/cart state, a chilled service lift and an awning shortcut connect the floors as progression changes the world.
- No Level 10 progression chain uses the old repeated locked-door layout.

Implemented object/navigation mechanic:
- a recoverable **delivery cart** holds up to two bulk parcels
- the cart moves among enabled freight stops and can be called from an enabled stop, preventing a permanent cart-position soft lock
- cargo state and wrong placements are recoverable and persisted
- the freight system, basement route, chilled lift and awning shortcut become available through puzzle world-state changes

Required chains:
1. **Market Permit / Till** → `esun + mani`
   - exact-payment token manipulation using decimal pricing and a percentage reduction
   - powers the freight system
2. **Delivery Manifest / Freight Routing** → `pan + suwi`
   - route `0042` bread and `0017` sweet cargo using quantity/date/time manifest information
   - correct deliveries open basement access
3. **Cold-chain Control** → `lete + ko`
   - coupled signed-decimal temperature controls with one verified solution
   - success activates the chilled service lift to the upper floor
4. **Textile/Dye Loft** → `len + laso`
   - set a 2:1:1 dye mixture and physically route recoverable cloth batches
   - success opens the upper-to-ground awning shortcut
5. **Inspection / Quarantine** → `jaki + walo`
   - reuse the actual delivery records to dispatch the clean bread sample and quarantine the sweet sample with the bad temperature history
   - completes Level 10

Nanpa-linja-n is contextual throughout the level: prices, percentages, signed temperatures, dates/times, quantities and leading-zero stock identifiers are operational information rather than detached notation quizzes.

The detailed implemented specification and v0.35 acceptance coverage are recorded in `LEVEL-10-DESIGN.md`.

## Level 11 — nocturnal wildlife sanctuary / field station — RECONSTRUCTED v0.38

No exact historical Level 11 specification was recovered. Level 11 is a new reconstruction that follows the established late-campaign rules: multiple floors, navigation-state changes, physical recoverable objects, proximity-based interactions, cumulative evidence, explicit route marking and mobile-safe puzzle layouts.

Canonical:
`mu, waso, lape, uta, mama, unpa, meli, mije, akesi, moli`

Physical structure:
- **Ground floor:** Field Station + Habitat Hub + physically isolated Recovery Ward
- **Canopy floor:** Aviary Walk + Nest Observatory
- **Lower floor:** Incubator Service + Lineage Registry
- no progression doors; newly available routes appear as marked ladders/hatches/shortcuts

Required chains:
1. **Three call pylons + triangulation** → `mu + waso`
   - physically record A/B/C
   - solve a unique 5×5 Manhattan-distance intersection
   - opens a marked canopy ladder
2. **Roost and feeding cycle** → `lape + uta`
   - chronological schedule across midnight using earlier date/time knowledge
   - opens a marked incubator hatch
3. **Lineage registry** → `mama + unpa`
   - four hatchlings, four parent pairs, only one inherited trait shown per hatchling
   - every row is individually ambiguous; cross-record same-trait constraints plus one-to-one use produce one verified global solution
   - releases two physical parent bands
4. **Parent-band placement** → `meli + mije`
   - carry `loje` and `laso` bands to west/east perches
   - wrong placements are recoverable
   - correct placement opens a direct canopy → Recovery Ward shortcut
5. **Habitat recovery triage** → `akesi + moli`
   - final deduction uses four neutrally named station records and explicit role criteria
   - identifies a warm ground reptile habitat and a dead/frozen sensor from evidence, not from labels

Exact Level 11 reset start:
- 100/120 prior canonical glyphs
- 0/10 Level 11 canonical glyphs
- no Level 11 solved state
- start at the Field Station

Detailed acceptance and mobile rules are recorded in `LEVEL-11-DESIGN.md`.

### Mechanism submission rule (v0.40 onward)

Configuration-style mechanism puzzles must not leak correctness before submission. Their primary action is **Try answer**, it remains available regardless of whether the current configuration is right or wrong, and success/failure is judged only after the player submits. Selection styling may indicate what the player chose, but must not imply that the choice is correct. Required clues must remain visible on narrow and short mobile layouts.

## Level 12 — Final Archive / `tomo sona pini pi ale` — IMPLEMENTED v0.42

Canonical set:
`a, ale, li, mi, mute, olin, pakala, pi, sin, sina`

Level 12 is the final and deliberately hardest campaign level. Its four physical floors are the Final Archive Vestibule/Fracture Core (ground), Identity Gallery/Relation Observatory (upper), Totality Cipher Vault (lower), and the physically separate Final Sudoku Chamber (deep lower, z=-2).

Required chain:
1. **Fracture parity core** → `pakala + sin`
   - 10 binary switches / 10 lamps
   - exhaustive `2^10` validation: exactly one switch subset
   - repairs the archive spine and visibly opens both upper and lower master-trial routes
2. **Identity permutation** → `mi + sina`
   - 8 glyph records under 9 simultaneous positional constraints
   - exhaustive `8!` validation: exactly one ordering
   - unlocks the Relation Observatory trial
3. **Six-glyph totality cipher** → `ale + mute`
   - randomized six-glyph permutation chosen from previously recovered glyphs
   - exact/misplaced feedback
   - hidden code persists across reload
4. **Triple relation mirror array** → `olin + pi`
   - 3 beams, 10 shared binary mirrors
   - exhaustive `2^10` validation: exactly one orientation state
   - all ten mirrors participate in the unique solution
5. **Final expert Sudoku** → `a + li`
   - final puzzle of Level 12 and of the campaign
   - FINAL hatch appears only when Identity, Totality and Relation are all complete
   - sparse expert 9×9 grid, notes mode, nanpa-linja-n digits + persistent Latin fallback
   - automated solver confirms exactly one solution
   - completion sets `l12ExitUnlocked` and reaches 120/120 canonical glyphs

Exact Level 12 reset start:
- 110/120 prior canonical glyphs
- 0/10 Level 12 glyphs
- no Level 12 solved state
- Level 12 intro pending
- physical start in the Final Archive Vestibule

Detailed topology, mobile rules, save-state requirements and uniqueness checks are in `LEVEL-12-DESIGN.md`.
