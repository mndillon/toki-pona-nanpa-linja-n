# Level 11 — Nocturnal Wildlife Sanctuary / Field Station

Status: **implemented and difficulty-reviewed through v0.40**.

Level 11 continues the late-campaign rule that the environment and its navigation state are part of the puzzle. It does not use another six-room locked-door chain. The player works through a three-floor wildlife field station whose survey data, route openings, parent-band objects and final recovery diagnosis all refer back to things the player has physically done in the same level.

## Canonical glyphs

`mu, waso, lape, uta, mama, unpa, meli, mije, akesi, moli`

Five canonical stages award two glyphs each. The initial three-pylon survey is required world state but awards no glyphs by itself.

## Physical structure

### Ground floor — Field Station / Habitat Hub / Recovery Ward

- **Field Station:** two acoustic pylons.
- **Habitat Hub:** third acoustic pylon, triangulation console, later canopy ladder.
- **Recovery Ward:** physically isolated from the rest of the ground floor; only reachable after the parent-band placement opens the canopy shortcut.

The Recovery Ward has no hidden ordinary doorway. This is deliberate: the route state must visibly change before the player can enter it.

### Canopy floor — Aviary Walk / Nest Observatory

- **Aviary Walk:** overnight roost/feeding schedule and return ladder.
- **Nest Observatory:** physical parent bands and their two perches.
- Completing the overnight schedule opens a visibly marked incubator hatch.
- Correctly placing both parent bands opens a visibly marked shortcut from the Nest Observatory directly to Recovery Ward.

### Lower floor — Incubator Service / Lineage Registry

- **Incubator Service:** return route to Aviary Walk.
- **Lineage Registry:** parent-pair/hatchling matching console.

There are no progression doors on any Level 11 floor. Route changes use ladders and a hatch and are permanently marked on the minimap once available.

## Required route

1. Record all three acoustic pylons.
2. Use their three distance readings to triangulate the night roost.
3. Climb the newly marked canopy ladder.
4. Restore the roost/feeding schedule across midnight.
5. Descend through the newly opened incubator hatch.
6. Use inherited traits to match all four hatchlings to four parent pairs.
7. Return to the Nest Observatory, take the released `loje` and `laso` parent bands and place them on the correct west/east perches.
8. Use the newly opened canopy shortcut to Recovery Ward.
9. Use accumulated Level 11 evidence to identify the reptile habitat and dead sensor.
10. Level 11 completes at 10/10 canonical glyphs.

## Puzzle details

### Three call pylons — required survey state

The player physically visits and records A, B and C. The universal interaction rule applies: the player must be inside interaction range and have an unobstructed world line of sight to the pylon, but camera alignment is not required. A pylon can therefore expose `E` / `USE` while behind the player, provided simply rotating toward it would reveal it; walls and closed doors block the prompt.

Progress is persistent and exposed as `0/3` through `3/3`.

### Call triangulation → `mu + waso`

The habitat grid is 5×5. The recorded Manhattan-distance readings are:

- A at (0,0): distance 5
- B at (4,0): distance 3
- C at (0,4): distance 5

Exactly one grid cell satisfies all three: (3,2). Automated tests exhaustively check all 25 cells for uniqueness.

The UI is a bounded square grid. Mobile layouts reduce cell size rather than stretching or squashing content.

Success opens and marks the canopy ladder in Habitat Hub.

### Roost and feeding cycle → `lape + uta`

Four records cross midnight:

- A — 2042-03-01 19:40
- B — 2042-03-01 23:10
- C — 2042-03-02 00:30
- D — 2042-03-02 05:15

The authored start is scrambled. The player must order the records chronologically, reusing date/time knowledge encountered earlier in the campaign.

Success opens and marks the incubator hatch on the Aviary Walk.

### Lineage registry → `mama + unpa`

Four parent pairs each have three known trait glyphs, but each hatchling exposes only **one** recorded trait. Every hatchling is therefore locally ambiguous: its visible trait matches at least two parent pairs. The player must combine the one-to-one assignment rule with two cross-record observations: K and M came from parent pairs sharing the same middle trait, and P and S likewise came from parent pairs sharing the same middle trait.

The authored constraint system is exhaustively tested and has exactly one global assignment. No individual row reveals its answer, and selection styling is deliberately neutral until the player presses **Try answer**.

Success releases two physical parent bands in the Nest Observatory.

### Parent-band placement → `meli + mije`

- `loje` / red band → west perch
- `laso` / blue band → east perch

The player carries one band at a time. Wrong placements are recoverable: any placed band can be picked back up. Correct placement of both bands opens and marks a direct Nest Observatory → Recovery Ward shortcut.

### Habitat recovery triage → `akesi + moli`

The final puzzle now states the task explicitly instead of expecting the player to infer the roles from vague labels. Four neutral stations A–D expose evidence records. The player must assign exactly two roles:

- **`akesi` habitat:** no bird call + warm substrate + fresh low ground track;
- **`moli` sensor:** current animal activity independently confirmed + environmental reading frozen.

The known bird-roost and parent-nest systems are distractors with normal changing probes. The answer stations are not named “warm habitat” or “recovery sensor”; the player must infer them from evidence. `moli` explicitly refers to failed instrumentation, not an animal death.

## Interaction / navigation UX requirements

- All Level 11 physical interactions follow the global proximity + unobstructed-line-of-sight rule; facing direction is not required.
- Newly opened routes must be obvious both in-world and on the minimap.
- The HUD names the next route after each state change and uses ↑/↓ where useful.
- The player must never have to infer that an apparently closed hatch is secretly usable.
- Wrong band placements are reversible.
- No required route depends on an invisible counter or an arbitrary visit count.

## Save-state requirements

Persist:

- recorded call pylons;
- triangulation selection;
- schedule state;
- lineage assignments;
- parent-band locations and perch placements;
- current carried band;
- final triage choices;
- all campaign world-state route flags.

`game-engine-reset.html?level=11` starts with the 100 canonical glyphs from Levels 1–10, none of Level 11's ten canonical glyphs, no Level 11 puzzle solved, and the player at the Field Station.

## Mobile acceptance

All new mechanism UIs have explicit coarse-pointer / narrow-viewport layouts.

- Triangulation remains a bounded 5×5 grid and scales cells proportionally.
- Lineage parent cards reflow from four columns to two; hatchling rows compact or stack on very narrow displays.
- Triage evidence cards and selectors reflow without horizontal scrolling.
- Low-height rules compact required evidence but do **not** hide clues needed to solve a puzzle.
- No Level 11 puzzle intentionally stretches a glyph or cartouche to fit a container.

## Automated logical checks

The v0.40 suite verifies:

- campaign validator: 11 levels, zero errors and zero soft-lock states;
- unique triangulation solution;
- real chronological schedule target across midnight;
- every lineage row is locally ambiguous while the complete cross-record constraint system has exactly one global solution;
- one-to-one recoverable band placement;
- explicit, evidence-backed final triage with neutral station names;
- mechanism configuration puzzles do not reveal correctness by enabling the submit button: **Try answer** remains available before validation;
- complete runtime route from survey through Level 11 completion;
- physical three-floor topology and isolated Recovery Ward;
- route-state markers and open-hatch visuals;
- save/reset support;
- L1→L11 campaign integration;
- mobile-specific Level 11 layout rules.
