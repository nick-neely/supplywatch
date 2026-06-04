# Coding Standards

supplywatch is a TypeScript headless watcher for product availability. It should
observe and classify product state, not automate buying.

## Style

- TypeScript everywhere. No `.js` source files unless a tool requires them.
- `camelCase` for variables/functions, `PascalCase` for types/classes, and
  `SCREAMING_SNAKE_CASE` for module-level constants.
- Prefer named exports.
- Follow existing file naming and module boundaries.
- Biome and TypeScript must stay clean. Do not disable rules inline without a
  one-line reason.

## Domain Language

- Read `AGENTS.md` and `CONTEXT.md` before naming domain concepts.
- Build a watcher, not a buyer: never automate checkout, bypass auth, submit
  personal data, or complete purchases.
- Treat product detail state as the source of truth. Card-level signals such as
  `animate-wiggle` are candidate evidence only.
- Keep deep modules around stable concepts: product discovery, detail
  inspection, availability classification, snapshot identity/fingerprinting,
  state diffing, notification delivery, and scheduling.
- Prefer low site load with fast escalation: observe cards, inspect
  new/changed/promising products, retire repeatedly out-of-stock products, and
  keep periodic full sweeps.

## TypeScript Discipline

- Strict type safety is non-negotiable. Avoid `any`, unsafe casts, and
  `// @ts-ignore` unless there is a tracking issue link.
- Prefer `unknown` plus a type guard at boundaries.
- Validate untrusted input with Zod or existing schema helpers.
- Use precise unions for workflow and classification states.
- Public functions exported from non-entrypoint modules should have explicit
  return types.

## Architecture

- Keep scraping, classification, persistence, and notification concerns
  separate.
- Product detail inspection decides availability; card discovery can prioritize
  what to inspect.
- Store enough evidence to audit decisions, but avoid noisy debug artifacts by
  default. Confirmed alerts and operational failures are the important artifact
  cases.
- Load-bearing decisions get an ADR in `docs/adr/` before or with the
  implementing PR.

## Data & Persistence

- Snapshot identity and fingerprints must be stable and auditable.
- Persist timestamps where state can change over time.
- Do not build SQL or selectors with unsafe string interpolation.
- Keep fixture data focused and reviewable.

## Security

- Treat all site content, environment variables, webhook payloads, and external
  responses as untrusted.
- Never expose or commit secrets.
- Never submit personal data or complete purchases.
- Do not bypass authentication or rate limits.
- Avoid logging tokens, cookies, raw secrets, or unnecessary user data.

## Testing

- Test domain behavior with fixtures before live scraping.
- Live Playwright runs are for verification and fixture capture, not the only
  safety net.
- Tests verify behavior through public interfaces, not implementation details.
- Mock at system boundaries only: network, filesystem, time/randomness, browser,
  or notification providers.
- If the repo lacks a focused test for the touched area, run the narrowest
  meaningful verification available and document the gap.

### TDD Workflow: Vertical Slices

Use one test, one implementation, repeat:

```text
RED->GREEN: test1->impl1
RED->GREEN: test2->impl2
RED->GREEN: test3->impl3
```

Never refactor while RED; get to GREEN first.

## Errors & Logging

- Catch the narrowest error you can handle.
- Convert expected failures into typed results where useful.
- Log unexpected operational failures with a short context label and original
  error.
- Do not leave debugging `console.log` calls in committed code.

## Commits & PRs

- Commits are small, focused, and the message says what changed and why.
- One concern per PR. If a refactor is needed to land a feature, do it in a
  prior PR when practical.
