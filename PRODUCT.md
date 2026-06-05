# Product

## Register

product

## Users

Supplywatch is used by a local operator who wants to understand what the headless watcher has observed without querying SQLite, reading logs, or opening debug artifacts by hand. They are usually checking current product availability, notification outcomes, recent watcher runs, or the evidence behind a questionable classification.

Future maintainers and dashboard implementers also use the interface as an audit surface over persisted watcher state. They need stable Product, Event, and Run routes, clear read models, and vocabulary that matches the domain docs.

## Product Purpose

The Watcher dashboard is a local-only, read-only interface over recorded Supplywatch state. It helps humans navigate Products, Events, Runs, notification delivery outcomes, product overrides, and raw evidence while preserving the headless watcher as the primary system.

Success means an operator can answer everyday questions quickly: which Products are active, what changed, whether a public availability alert was confirmed, what evidence exists, which notifications failed, and whether recent Runs look healthy. The dashboard must not become a buyer, admin console, checkout assistant, or state mutation tool.

## Brand Personality

Editorial, precise, restrained.

Supplywatch should feel like an annotated field notebook for a careful monitoring system: direct, legible, evidence-first, and lightly tactile. It can borrow the README image's warm paper, black editorial type, thin rules, product collage energy, and green annotation accent, but the dashboard itself should remain dense and task-focused.

The voice is calm and operational. It should avoid sales language, urgency theater, and words that imply automated purchasing.

## Anti-references

- Admin panels that suggest the dashboard can change watcher behavior.
- Buyer UI, checkout UI, cart patterns, or language that implies Supplywatch purchases products.
- Dark observability dashboards with blue/purple gradients, neon accents, or sci-fi styling.
- Decorative glassmorphism, giant hero metrics, and generic SaaS card grids.
- Alert-heavy layouts that treat candidate signals as confirmed availability.
- Overly playful merch-store styling that hides audit evidence behind decoration.

## Design Principles

1. Evidence before conclusion. Show the observed Product, Event, Run, override, and notification facts that support a status.
2. Read-only by posture. Links may lead outward to source pages, but dashboard controls must not imply mutation, checkout, authentication bypass, or personal-data submission.
3. Products lead, Events and Runs explain. Products are the primary way in; Events and Runs provide audit trails and operational context.
4. Editorial restraint, operational density. Keep the README's annotated-paper character, but tune it for scanning tables, filters, detail pages, and repeated use.
5. Stable language beats clever labels. Use domain vocabulary such as Availability state, Product override, candidate evidence, Event, and Run consistently.

## Accessibility & Inclusion

Target WCAG 2.2 AA for color contrast, keyboard navigation, focus visibility, and screen-reader semantics. Do not rely on color alone for Availability state, notification status, overrides, or Run health; pair color with labels, icons, or structured text.

Respect reduced-motion preferences. Use motion only to clarify state changes such as refreshes, row updates, collapsible raw evidence, and focus transitions.
