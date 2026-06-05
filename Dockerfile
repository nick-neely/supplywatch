FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/state/package.json ./packages/state/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY tsconfig.json ./
COPY packages/state ./packages/state
COPY src ./src
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates g++ make python3 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/state/package.json ./packages/state/package.json
RUN pnpm install --prod --frozen-lockfile=false
RUN pnpm exec playwright install --with-deps chromium
COPY --from=build /app/packages/state/dist ./packages/state/dist
COPY --from=build /app/packages/state/drizzle ./packages/state/drizzle
COPY --from=build /app/dist ./dist
VOLUME ["/app/data"]
CMD ["node", "dist/worker.js"]
