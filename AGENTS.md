## Agent skills

### Issue tracker

GitHub Issues on `nick-neely/supplywatch`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles use the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## supplywatch Direction

- Build a headless watcher, not a buyer: never automate checkout, bypass auth, submit personal data, or complete purchases.
- Treat product detail state as the source of truth. `animate-wiggle` is only candidate evidence that should accelerate inspection.
- Prefer low site load with fast escalation: observe cards, inspect new/changed/promising products, retire repeatedly out-of-stock products, and keep periodic full sweeps.
- Keep deep modules around stable concepts: product discovery, detail inspection, availability classification, snapshot identity/fingerprinting, state diffing, notification delivery, and scheduling.
- Test domain behavior with fixtures before live scraping. Live Playwright runs are for verification and fixture capture, not the only safety net.
- Store enough evidence to audit decisions, but avoid noisy debug artifacts by default. Confirmed alerts and operational failures are the important artifact cases.

## Learned User Preferences

- Prefer `AGENTS.md` over `CLAUDE.md` for agent-oriented repo configuration.

## Learned Workspace Facts

- Biome handles formatting and linting; `pnpm lint` runs `biome check` (includes format); also `pnpm lint:fix` and `pnpm format`.
- Biome formatter uses 2-space indentation.
- Enable `css.parser.tailwindDirectives` in `biome.json` for Tailwind v4 CSS (`@theme`, `@apply`, etc.).
- `pnpm verify` runs typecheck, lint, format:check, build, and test in parallel via concurrently.
- README and repo images belong in `assets/`.
- `.cursor/hooks/state/` is gitignored for local Cursor hook and continual-learning state.
