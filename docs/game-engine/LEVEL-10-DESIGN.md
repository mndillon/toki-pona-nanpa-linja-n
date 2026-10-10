# Level 10 — Cold Market / Logistics Tower

**Status:** implemented; route/UX corrected and fully flow-checked in v0.37.

## Design objective

Level 10 is a connected logistics environment rather than another row of independent puzzle rooms. The player restores a multi-floor market by moving goods, balancing a transaction, stabilizing refrigeration, processing textiles and auditing shipments. Solved mechanisms change both **cargo routes** and **player navigation**.

The implementation continues the Level 9 design rules:

- no repeated sequence of locked chambers;
- navigation state is part of puzzle state;
- important cargo is physical and recoverable;
- completed branches create shortcuts instead of demanding long backtracking;
- numbers appear as prices, temperatures, dates, times, quantities and stock identifiers rather than detached notation tests;
- all interactions use the global proximity rule: an in-range interactable offers `E` / `USE` without requiring camera alignment.

## Canonical glyphs

`esun, mani, pan, suwi, lete, len, ko, jaki, laso, walo`

The five required award chains yield exactly two canonical glyphs each. The textile dye mixer is a required state-setting step inside the `len + laso` chain but does not award extra glyphs.

## Physical structure

Level 10 uses three physical floors and seven authored areas.

```text
                    UPPER (+1)
          ┌─────────────────────────┐
          │ Textile / Dye Loft      │──── Ledger Office
          └──────────┬──────────────┘
                     │ chilled lift
                     │
GROUND (0)           │
┌──────────────┐  ┌──┴──────────────────┐  ┌──────────────┐
│ Receiving Bay│──│ Central Market Arcade│──│ Dispatch Bay │
└──────┬───────┘  └──┬──────────────────┘  └──────────────┘
       │ freight       │ awning shortcut
       │               │
       └───────────────┼─────────────────────────────┐
                       │                             │
                 BASEMENT (-1)                     │
              ┌────────┴─────────┐          ┌────────┴──────┐
              │ Cold Store       │──────────│ Quarantine    │
              └──────────────────┘          └───────────────┘
```

The Market Arcade is the legible hub. Progressively solved branches activate the basement route, chilled upper lift, and upper-to-ground awning shortcut so the level becomes easier to traverse as it is repaired.

## Delivery cart

Level 10 introduces a physical delivery-cart state instead of repeating Level 9's one-relic hand-carry loop.

- The cart holds up to two bulk parcels.
- The authored delivery cargo consists of the `pan` and `suwi` crates in Receiving.
- The cart runs only on the **ground-floor freight route between Receiving and the Market Arcade**. It does not use player ladders, trapdoors or service lifts.
- Either ground-floor stop can call the cart after the till powers the freight system, preventing a legal player action from permanently stranding it.
- Cart position/cargo are persisted and cannot be duplicated by save/reload.
- The bakery and sweet-goods stands are visibly marked with `pan` / `suwi` and their proximity prompts repeat the expected cargo.
- Stand interaction unloads the matching crate from the cart rather than depending on loading order. Legacy wrong placements remain recoverable.

This keeps the cart physically coherent and removes misleading freight controls from later areas where the cart is not actually part of the puzzle.

## Required chain 1 — Market Permit / Till

**Awards:** `esun + mani`

The player balances a physical-style market transaction using a limited token set rather than entering an answer on a keypad.

Authored transaction:

- `pan`: 2.40
- `suwi`: 1.20 with a 25% reduction → 0.90
- exact amount due: **3.30**

Available token values are 2.00, 1.00, 0.50, 0.20, 0.10 and 0.05. Tokens can be added and removed before activation.

**World-state result:** `l10PowerOn` — the freight system becomes usable.

## Required chain 2 — Delivery Manifest / Freight Routing

**Awards:** `pan + suwi`

Two bulk crates begin in Receiving and must be loaded into the cart and delivered to the correct market stands.

- bread stock ID `0042`, time `08:30`, date `2026-10-10` → bakery
- sweet stock ID `0017`, time `09:15`, date `2026-10-11` → sweet-goods stall

The identifiers deliberately preserve leading zeros and the manifest reuses date/time forms already learned in earlier levels. Each stand identifies its expected crate and unloads that matching crate from the cart, so cart loading order cannot cause an accidental wrong delivery; legacy wrong placements from earlier saves can still be recovered.

**World-state result:** `l10DeliveryDone` / `l10BasementOpen` — the Cold Store route becomes available. The opened hatch is visibly open, marked with a down arrow in-world and permanently marked `↓` on the minimap so the new route cannot be mistaken for a closed floor hatch.

## Required chain 3 — Cold-chain Control

**Awards:** `lete + ko`

The Cold Store uses three coupled controls rather than a direct numeric answer box. Their settings jointly determine three displayed values:

- freezer target: **−18.0**
- chilled-store target: **+4.0**
- gel-loop target: **+0.5**

The authored control system has one verified solution within its legal 0–2 control ranges.

**World-state result:** `l10ColdStable` / `l10UpperLift` — a chilled service lift connects the basement directly to the upper floor.

## Required chain 4 — Textile / Dye Loft

**Awards:** `len + laso`

This chain has two linked parts.

1. The dye mixer must be set to the required **2:1:1** blend, corresponding to 50% / 25% / 25%.
2. The physical blue and white cloth batches must then be routed to their correct processing stations. Wrong placements remain recoverable.

**World-state result:** `l10TextileDone` / `l10AwningOpen` — a direct upper-to-ground awning/catwalk shortcut becomes available.

## Required chain 5 — Inspection / Quarantine

**Awards:** `jaki + walo`

The final audit reuses the same delivery identities rather than introducing an unrelated final clue set.

- bread sample: clean → Dispatch
- sweet sample: recorded cold-chain excursion of **+8.5** → Quarantine

Both samples are physical/recoverable until the correct pair of placements is established.

**World-state result:** `l10ExitUnlocked` — Level 10 completes.

## Nanpa-linja-n role

Level 10 uses numeric forms as environmental information:

- prices and exact payment — decimals;
- discount — percentage/equivalent arithmetic;
- cold storage — signed decimals;
- delivery windows — time values;
- delivery/expiry information — date values;
- stock identifiers — leading zeros;
- quantities and totals — ordinary decimal values.

The purpose is cumulative use of the number system, not a notation worksheet.

## Navigation-state progression

1. **Till solved** → freight system powered.
2. **Deliveries correct** → basement route opens.
3. **Cold chain stable** → chilled service lift reaches the upper floor.
4. **Dye + textile routing complete** → awning shortcut links upper and ground routes.
5. **Audit complete** → Level 10 is complete and ready to continue once Level 11 exists.

The player is not required to traverse a fully solved branch again merely to proceed.

## Save-state implementation

The v0.35 save includes Level 10 physical and mechanism state, including:

- ground-floor cart dock (`receiving` / `market`; obsolete v0.35/v0.36 dock values migrate to `market`);
- cart cargo and trip count;
- delivery placements and parcel locations;
- textile placements and cloth locations;
- audit placements and sample locations;
- Level 10 mechanism states for the till, cold controls and dye mixer;
- campaign world states controlling freight access, lifts and shortcuts.

Reloading therefore reconstructs the current logistics state rather than resetting the level's movable objects.

## Regression / acceptance coverage

v0.35 tests verify, among other things:

- exact Level 10 reset starts with 90/120 prior canonical glyphs and 0/10 Level 10 glyphs;
- Level 9 progression reaches Level 10;
- the Level 10 award chains yield exactly the ten canonical glyphs;
- the till has a valid exact-payment solution;
- the authored manifest retains leading-zero IDs and date/time data;
- the cold controls have one verified solution;
- textile ratio and placement data are coherent;
- the audit refers back to the actual Level 10 shipments;
- all three Level 10 floor maps are connected as authored;
- no Level 10 progression chain falls back to locked-door sequencing;
- Level 10 physical state fields are present in save/reset handling;
- the complete staged route is runtime-verified from till through final audit;
- the opened Cold Store hatch has dedicated world/minimap visibility;
- delivery has no hidden trip-count prerequisite and is independent of crate loading order;
- the Market Permit till reflows on phone widths without distorting numeric cartouches.

Level 11 is not implemented yet, so Level 10 is the current playable campaign endpoint in v0.37.
