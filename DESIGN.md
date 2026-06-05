---
name: Supplywatch
description: "A read-only local dashboard for auditing headless merch availability watcher state."
colors:
  paper: "oklch(97% 0.006 88)"
  paper-ink: "oklch(17% 0.006 95)"
  paper-muted: "oklch(50% 0.012 95)"
  rule: "oklch(72% 0.012 95)"
  panel: "oklch(99% 0.004 88)"
  panel-alt: "oklch(94% 0.008 88)"
  annotation-green: "oklch(46% 0.085 158)"
  annotation-green-soft: "oklch(91% 0.035 154)"
  warning-amber: "oklch(70% 0.13 80)"
  danger-red: "oklch(58% 0.13 28)"
  info-blue: "oklch(58% 0.09 245)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "0"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  sm: "3px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.paper-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
    typography: "{typography.label}"
  status-chip:
    backgroundColor: "{colors.annotation-green-soft}"
    textColor: "{colors.annotation-green}"
    rounded: "{rounded.sm}"
    padding: "3px 6px"
    typography: "{typography.label}"
  table-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.sm}"
---

# Design System: Supplywatch

<!-- SEED -->

## 1. Overview

**Creative North Star: "The Annotated Operations Ledger"**

Supplywatch's dashboard should translate the README image into a working product surface: warm paper, firm black type, thin rules, green annotations, and product evidence, tightened into a local read-only dashboard. The result should feel more like a careful monitoring ledger than a SaaS admin panel.

The interface is product-first. It favors dense tables, stable detail routes, quick filters, and explicit evidence. Editorial touches belong in hierarchy, annotations, empty states, and snapshot framing, not in invented controls or decorative flourishes.

It rejects buyer UI, checkout cues, sci-fi observability styling, and urgency theater. Candidate signals should look like evidence that needs inspection; confirmed availability and notification failures should be clearly distinguishable.

**Key Characteristics:**

- Warm paper surfaces with tinted black text and thin ledger-like rules.
- Restrained green accent for monitoring, confirmation, focus, and annotation.
- Dense Product, Event, and Run views with stable labels and URLs.
- Raw JSON and fingerprints treated as auditable evidence, not visual noise.
- Familiar product controls: tables, filters, tabs, breadcrumbs, buttons, links.

## 2. Colors

The palette is restrained: paper neutrals do most of the work, annotation green is the signature accent, and semantic colors appear only when state needs them.

### Primary

- **Annotation Green** (`oklch(46% 0.085 158)`): Use for active monitoring, confirmed positive status, selected filters, focus rings, and sparse annotation marks. Keep it rare enough to remain meaningful.
- **Soft Annotation Green** (`oklch(91% 0.035 154)`): Use for quiet chip backgrounds, selected table filters, and low-intensity success surfaces.

### Secondary

- **Warning Amber** (`oklch(70% 0.13 80)`): Use for stale-looking running Runs, pending notifications, low-confidence evidence, and configuration warnings.
- **Danger Red** (`oklch(58% 0.13 28)`): Use for failed notification delivery, unavailable API/database states, and operational failures.
- **Info Blue** (`oklch(58% 0.09 245)`): Use sparingly for neutral links and informational status when green would imply confirmation.

### Neutral

- **Paper** (`oklch(97% 0.006 88)`): The main page background. It should feel warm and readable, not beige-heavy.
- **Paper Ink** (`oklch(17% 0.006 95)`): Main text, table headers, primary controls, and rule labels. Never use pure black.
- **Paper Muted** (`oklch(50% 0.012 95)`): Secondary text, timestamps, helper text, and metadata.
- **Rule** (`oklch(72% 0.012 95)`): Hairline borders, table dividers, section rules, and chart axes.
- **Panel** (`oklch(99% 0.004 88)`): Table surfaces, popovers, and detail panels.
- **Panel Alt** (`oklch(94% 0.008 88)`): Hover rows, pinned summary regions, and low-contrast empty-state surfaces.

### Named Rules

**The Evidence Color Rule.** Green means monitored or confirmed, amber means uncertain or waiting, red means operational failure. Candidate evidence must not use the same treatment as confirmed public availability.

**The Paper Rule.** Do not use pure white, pure black, or gray-on-gray defaults. Every neutral is lightly warm and should still meet contrast requirements.

## 3. Typography

**Display Font:** system UI sans stack.
**Body Font:** system UI sans stack.
**Label/Mono Font:** UI monospace stack.
**Editorial Accent Font:** Georgia or the platform serif stack for occasional page headlines and evidence notes only.

**Character:** Most UI text should be practical and familiar. Serif appears as a restrained editorial accent for top-level headings or explanatory empty states, never inside table cells, filters, labels, or buttons.

### Hierarchy

- **Display** (800, 2rem, 1 line-height): Use for the application title or major dashboard section titles when space allows.
- **Headline** (600, 1.375rem, 1.22 line-height): Use for detail page introductions, empty-state messages, and compact editorial notes.
- **Title** (700, 1rem, 1.3 line-height): Use for panel titles, table section headings, and detail field groups.
- **Body** (400, 0.9375rem, 1.5 line-height): Use for normal UI text and prose. Cap prose blocks around 65-75ch.
- **Label** (700, 0.75rem, 1.2 line-height): Use for chips, column labels, tags, and small all-caps ledger labels. Letter spacing stays `0`.

### Named Rules

**The Serif Rationing Rule.** Serif is an accent for editorial framing. Tables, controls, badges, and data stay in the sans or mono stacks.

**The Ledger Label Rule.** Small labels can use monospace and compact uppercase, but they must remain readable and must not become decorative noise.

## 4. Elevation

Supplywatch should be flat by default. Depth comes from tonal surfaces, hairline rules, hover backgrounds, and stable spacing. Shadows are reserved for popovers, menus, and temporary overlays where the user needs to understand stacking.

### Shadow Vocabulary

- **Popover Lift** (`0 14px 32px color-mix(in oklch, oklch(17% 0.006 95) 16%, transparent)`): Use only for floating menus, tooltips, and date/filter popovers.
- **Image Rest** (`0 1px 2px color-mix(in oklch, oklch(17% 0.006 95) 12%, transparent)`): Use on product images when a slight edge is needed against paper.

### Named Rules

**The Flat Ledger Rule.** Do not wrap every page section in a card. Use full-width bands, rules, table structure, and panels only where grouping helps the workflow.

## 5. Components

### Buttons

- **Shape:** Small rounded rectangle (`6px`), compact enough for toolbars and table actions.
- **Primary:** Paper Ink background with Paper text. Use for refresh, apply, and high-confidence actions only.
- **Hover / Focus:** Hover shifts to Annotation Green only when the action is constructive and safe. Focus uses a visible 2px green ring plus offset.
- **Secondary / Ghost:** Transparent or Panel background with a Rule border. Use for filters, back links, and low-emphasis actions.

### Chips

- **Style:** Compact bordered or softly filled tags with monospace label text.
- **State:** Availability, notification, override, and Run status chips must pair color with readable labels. Do not use color-only dots for critical meaning.
- **Candidate Evidence:** Use amber or neutral evidence treatment, not confirmed green.

### Cards / Containers

- **Corner Style:** `6px` for normal panels, `8px` maximum for repeated Product image containers.
- **Background:** Panel on Paper, Panel Alt for hover or selected rows.
- **Shadow Strategy:** Flat by default; see Elevation for rare lifted elements.
- **Border:** `1px` Rule hairlines. Do not use thick side stripes.
- **Internal Padding:** Dense table cells use `8px 12px`; detail panels use `16px` to `24px` depending on content density.

### Inputs / Fields

- **Style:** Panel background, `1px` Rule border, `6px` radius, Body text.
- **Focus:** Annotation Green border or ring, with clear contrast against Paper.
- **Error / Disabled:** Error state uses Danger Red plus message text. Disabled state lowers contrast only within accessible limits and keeps labels readable.

### Navigation

- **Style:** Product-first navigation with Summary, Products, Events, and Runs as clear routes. Use familiar side or top navigation, not decorative tabs.
- **Active State:** Green underline, filled chip, or strong text weight. Avoid full-saturation inactive states.
- **Mobile Treatment:** Collapse navigation predictably and keep filters reachable without hiding primary table content behind modals.

### Tables

- **Structure:** Server-authoritative table state should feel stable: sticky headers where useful, row hover on Panel Alt, clear column labels, and URL-backed sort/filter controls.
- **Rows:** Product rows need image, name, collection, price, Availability state, sizes, override badges, timestamps, and retired status without becoming a card grid.
- **Virtualization:** Preserve row height stability. Loading skeletons should match final row geometry.

### Detail Evidence

- **Curated First:** Product, Event, and Run detail pages show human-readable fields before raw JSON.
- **Raw Data:** Snapshot, fingerprint, payload, and error blocks use collapsible sections with monospace content and copy actions where helpful.
- **Outbound Links:** Source URLs open in a new tab with explicit external-link affordance.

## 6. Do's and Don'ts

### Do:

- **Do** lead with Products and make Events and Runs support the audit trail.
- **Do** use Availability state in UI copy instead of buyable state.
- **Do** distinguish candidate evidence from confirmed public availability with label, tone, and placement.
- **Do** keep tables dense, stable, and URL-addressable.
- **Do** use warm paper neutrals, thin rules, and sparse green annotations to echo the README image.
- **Do** include clear empty, loading, failed database, broken image, and stale-running states.

### Don't:

- **Don't** use admin panel, buyer UI, checkout UI, cart patterns, or language implying Supplywatch buys products.
- **Don't** use dark blue observability defaults, purple gradients, neon accents, or decorative glassmorphism.
- **Don't** treat animate-wiggle or candidate-signal Events as confirmed availability.
- **Don't** hide raw evidence when a classification may need auditing.
- **Don't** use thick colored side stripes on cards, callouts, alerts, or table rows.
- **Don't** build repeated identical icon-card grids for Product, Event, or Run data.
