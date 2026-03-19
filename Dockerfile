FROM node:lts-trixie-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ownlab/web build
RUN pnpm --filter @ownlab/server build
RUN test -f apps/server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS server-runtime

COPY --chown=node:node --from=build /app /app

ENV NODE_ENV=production \
  HOME=/ownlab \
  OWNLAB_HOME=/ownlab \
  HOST=0.0.0.0 \
  PORT=3100

VOLUME ["/ownlab"]
EXPOSE 3100

USER node

CMD ["node", "apps/server/dist/index.js"]

FROM base AS web-runtime

COPY --chown=node:node --from=build /app /app

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  OWNLAB_SERVER_URL=http://server:3100 \
  NEXT_PUBLIC_OWNLAB_SERVER_URL=http://localhost:3100

EXPOSE 3000

USER node

CMD ["pnpm", "--filter", "@ownlab/web", "start"]
