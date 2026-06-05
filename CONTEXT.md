# Supplywatch

Supplywatch watches product availability and records enough state for humans to understand product changes, watcher runs, and notification outcomes without automating purchases.

## Language

**Watcher dashboard**:
A read-only interface for navigating recorded Supplywatch state, including **Products**, **Events**, **Runs**, and alert delivery outcomes. It helps humans understand what the watcher has observed; it is not an operator console for changing watcher behavior.
_Avoid_: Admin panel, buyer UI, checkout UI

**Availability state**:
The user-facing label for a **Product's** current public availability classification: unknown, out of stock, publicly available, or employee only. Internally this may be stored as `buyableState`, but dashboard language should avoid implying that Supplywatch buys products.
_Avoid_: Buyable state, purchase state

**Product override**:
A human-supplied interpretation rule for a **Product** that can affect how Supplywatch treats that product, such as denylisting it, forcing it watched, forcing it retired, or marking it employee only. The **Watcher dashboard** may display overrides, but read-only dashboard views do not change them.
_Avoid_: Admin setting, dashboard edit

## Example Dialogue

Dev: "Should the watcher dashboard let us force-retire a product?"
Domain expert: "Not yet. It should show the product's current state and evidence, but changing overrides belongs outside the dashboard until we define those operations."

Dev: "Should the product row show buyable state?"
Domain expert: "Show Availability state. The dashboard can say Publicly available or Employee only without suggesting the watcher completes purchases."

Dev: "Why does this product say Employee only?"
Domain expert: "Check whether a Product override marked it employee only before assuming the latest inspection found that state."
