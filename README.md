# supplywatch

![supplywatch monitors the OpenAI Supply Co. store and sends Discord alerts when new items drop](assets/readme.png)

supplywatch is a headless watcher for public OpenAI merch availability on `https://supplyco.openai.com`.

This repository currently contains the foundation layer only: Node.js, TypeScript, Docker, environment config, and the initial worker entrypoint. The scraper, state machine, detectors, and Discord notification behavior will be added in later slices.

## Stack

- Node.js 22+
- TypeScript
- Playwright for rendered-page inspection
- Cheerio as an HTML parsing fallback
- SQLite via `better-sqlite3`
- Discord webhooks
- Docker for deployment

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm playwright:install
pnpm dev
```

`DRY_RUN=true` is the default and should remain enabled until the worker has confirmed behavior locally.

## Scripts

```bash
pnpm dev        # run the TypeScript worker entrypoint
pnpm capture:fixture -- --url https://supplyco.openai.com/products/example --state purchase-button --name example
pnpm build      # compile TypeScript into dist/
pnpm start      # run the compiled worker
pnpm typecheck  # type-check without emitting files
pnpm test       # run tests
```

Fixture capture renders the supplied product/detail URL with Playwright and saves
`detail.html` plus `metadata.json` under `fixtures/product-states/<state>/<name>/`.
Use states such as `out-of-stock`, `purchase-button`, `employee-gated-login`,
`sized`, `sizeless`, `disabled-size`, `enabled-size`, or
`animate-wiggle-candidate`.

## Docker

```bash
docker build -t supplywatch .
docker run --rm --env-file .env -v "$PWD/data:/app/data" supplywatch
```

## Current MVP Boundaries

- This app watches public availability only.
- It must not automate purchasing, bypass login, or complete checkout.
- Discord alerts should only be sent for confirmed availability once implemented.
- `animate-wiggle` is a candidate signal, not the source of truth.
- Products confirmed out of stock three times may be retired from detail checks.
