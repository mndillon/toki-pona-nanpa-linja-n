# Level 10 — Cold Market / Logistics Tower

**Status:** implemented; final-audit/navigation clarity redesign in v0.89.

## Design objective

Level 10 is a connected logistics environment rather than another row of independent puzzle rooms. The player restores a multi-floor market by moving goods, balancing a transaction, stabilizing refrigeration, processing textiles and auditing shipments. Solved mechanisms change both **cargo routes** and **player navigation**.

The implementation continues the Level 9 design rules:

- no repeated sequence of locked chambers;
- navigation state is part of puzzle state;
- important cargo is physical and recoverable;
- completed branches create shortcuts instead of demanding long backtracking;
- advanced nanpa-linja-n input is always attached to a reasoning task: derive values first, then encode the result;
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

The Market Arcade is the legible hub. Progressively solved branches activate the basement route, chilled upper lift, and upper-to-ground awning shortcut so the level becomes easier to traverse as it is repaired. After textile routing, **only the Ledger Office opens for the final required task**. Dispatch Bay and Quarantine remain sealed until that audit is approved, so they can never look like unexplained active objectives. The Ledger audit console is visually distinct, marked `!` in-world and on the upper-floor minimap; the HUD gives floor-specific directions to it.

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

## Required chain 1 — Market Allocation Ledger

**Awards:** `esun + mani`

The first terminal is now a three-answer applied percentage problem rather than an exact-token till.

Sixteen equal shipment lots must be allocated:

- bakery: 5 of 16 lots → **31.25%**
- sweet-goods: 7 of 16 lots → **43.75%**
- reserve: 4 of 16 lots → **25%**

The ledger explicitly notes that each equal lot is **1/16 of the shipment**, but it does not supply the three answers. The player must derive each percentage and then construct all three **abbreviated nanpa-format percentage cartouches** using the shared glyph picker. All three are checked together only after **Try answer**.

**World-state result:** `l10PowerOn` — the freight system becomes usable.

## Required chain 2 — Delivery Manifest / Freight Routing

**Awards:** `pan + suwi`

Two bulk crates begin in Receiving and must be loaded into the cart and delivered to the correct market stands.

- bread stock ID `0042`, time `08:30`, date `2026-10-10` → bakery
- sweet stock ID `0017`, time `09:15`, date `2026-10-11` → sweet-goods stall

The identifiers deliberately preserve leading zeros and the manifest reuses date/time forms already learned in earlier levels. Each stand identifies its expected crate and unloads that matching crate from the cart, so cart loading order cannot cause an accidental wrong delivery; legacy wrong placements from earlier saves can still be recovered.

**World-state result:** `l10DeliveryDone` / `l10BasementOpen` — the Cold Store route becomes available. The opened hatch is visibly open, marked with a down arrow in-world and permanently marked `↓` on the minimap so the new route cannot be mistaken for a closed floor hatch.

## Required chain 3 — Cold-chain Control + Scientific Record

**Awards:** `lete + ko` after the complete cold chain is documented.

The Cold Store still begins with the three coupled physical controls. Their settings jointly determine three displayed values:

- freezer target: **−18.0**
- chilled-store target: **+4.0**
- gel-loop target: **+0.5**

The authored control system has one verified solution within its legal 0–2 control ranges. Solving it sets `l10ColdStable`, but **does not yet open the upper lift**.

A second recorder console then activates with three raw calibration readings:

- `0.0042` → **`4.2e-3`**
- `0.00075` → **`7.5e-4`**
- `125` → **`1.25e2`**

The player must normalize all three values and construct the three abbreviated nanpa-format **scientific-notation** cartouches. This is deliberately a two-layer challenge: numerical conversion first, notation second.

**World-state result:** `l10ColdRecorded` / `l10UpperLift` — only the accepted scientific record activates the chilled service lift.

## Required chain 4 — Textile / Dye Loft

**Awards:** `len + laso`

This chain has two linked parts.

1. The dye-batch reconciliation terminal provides three arithmetic records:
   - `(1+1/2) + (1+1/4)` → **`2+3/4`**
   - `(2+3/4) + (2+3/4)` → **`5+1/2`**
   - `(3+1/2) + (4+3/4)` → **`8+1/4`**
   The player must calculate all three totals and construct three abbreviated **mixed-fraction** cartouches.
2. The physical blue and white cloth batches must then be routed to their correct processing stations. Wrong placements remain recoverable.

**World-state result:** `l10TextileDone` / `l10AwningOpen` — a direct upper-to-ground awning/catwalk shortcut becomes available.

## Required chain 5 — Final Shipment Audit

**Awards:** `jaki + walo`

The final stage is deliberately **not another cargo-routing task**. The player has already delivered `pan` to the bakery and `suwi` to sweet-goods, so asking them to move those goods again was narratively misleading.

After textile routing, the Ledger Office opens and exposes one highly visible audit console. It shows two records for the **same earlier shipments**:

- `pan` record — earlier delivery: bakery ✓; cold history remained within safe limits → **Dispatch**
- `suwi` record — earlier delivery: sweet-goods ✓; cold history shows an unsafe **+8.5** excursion → **Quarantine**

The player classifies the **records only**. The puzzle explicitly says that the goods are not being moved again. No audit parcels, hand-carry state or destination pedestals exist in this stage.

On the audit screen both shipment cards, their evidence, and the two destination choices are visible at once. The `!` console and minimap marker make the remaining task visually obvious.

**World-state result:** `l10ExitUnlocked` — Level 10 completes. Dispatch Bay and the optional Quarantine status room then open; the Dispatch exit terminal is visibly active.

## Nanpa-linja-n role

Level 10 is the campaign point where advanced number forms become **applied output**, not just something the player sees.

The progression is intentionally:

`observe / derive → calculate or convert → construct the nanpa-linja-n cartouche`

Required advanced forms are:

- three related **percentages** derived from a 16-lot allocation;
- three normalized **scientific-notation** values derived from raw instrument readings;
- three **mixed fractions** derived by adding marked batch quantities.

The level still retains physical freight routing, coupled refrigeration controls, dates/times, leading-zero stock IDs and the final dispatch/quarantine audit. The advanced notation therefore sits inside a logistics level rather than replacing the level with a worksheet. The PDF cheat-sheet link is available in each advanced construction puzzle; consulting syntax is allowed, while the reasoning remains the actual challenge.

## Navigation-state progression

1. **Percentage allocation ledger solved** → freight system powered.
2. **Deliveries correct** → basement route opens.
3. **Cold controls stable** → scientific recorder activates.
4. **Scientific record complete** → chilled service lift reaches the upper floor.
5. **Mixed-fraction reconciliation + textile routing complete** → awning shortcut links upper and ground routes; **Ledger Office opens** and the marked `!` audit console becomes the explicit final objective. Dispatch and Quarantine stay sealed.
6. **Ledger record audit complete** → `l10ExitUnlocked`; Dispatch Bay and optional Quarantine status room open, and Level 10 is complete.

The player is not required to traverse a fully solved branch again merely to proceed.

## Save-state implementation

The v0.35 save includes Level 10 physical and mechanism state, including:

- ground-floor cart dock (`receiving` / `market`; obsolete v0.35/v0.36 dock values migrate to `market`);
- cart cargo and trip count;
- delivery placements and parcel locations;
- textile placements and cloth locations;
- persisted Level 10 mechanism state, including the two final audit record classifications;
- Level 10 mechanism state for the coupled cold controls; grouped percentage/scientific/mixed-fraction answer entry uses the shared glyph-key puzzle UI;
- campaign world states controlling freight access, lifts and shortcuts.

Reloading therefore reconstructs the current logistics state rather than resetting the level's movable objects.

## Regression / acceptance coverage

v0.35 tests verify, among other things:

- exact Level 10 reset starts with 90/120 prior canonical glyphs and 0/10 Level 10 glyphs;
- Level 9 progression reaches Level 10;
- the Level 10 award chains yield exactly the ten canonical glyphs;
- the three percentage allocations have verified expected values and grouped cartouche sequences;
- the authored manifest retains leading-zero IDs and date/time data;
- the cold controls have one verified solution;
- scientific-notation and mixed-fraction grouped answers are coherent, and textile placement data remain recoverable;
- the final audit refers back to the actual Level 10 shipments without reusing them as physical cargo;
- all three Level 10 floor maps are connected as authored;
- no Level 10 progression chain falls back to locked-door sequencing;
- Level 10 physical state fields are present in save/reset handling;
- the complete staged route is runtime-verified from percentage ledger through scientific record, mixed-fraction reconciliation and the Ledger record-classification audit;
- the opened Cold Store hatch has dedicated world/minimap visibility;
- delivery has no hidden trip-count prerequisite and is independent of crate loading order;
- the grouped percentage/scientific/mixed-fraction cartouche rows use a dedicated compact mobile layout.

