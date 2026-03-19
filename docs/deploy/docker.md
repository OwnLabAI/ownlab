---
title: Docker
summary: Docker Compose quickstart for Ownlab
---

Run OwnLab in Docker without installing Node or pnpm locally.

## Compose Quickstart (Recommended)

```sh
docker compose -f docker-compose.quickstart.yml up --build
```

Open:

- Web UI: [http://localhost:3000](http://localhost:3000)
- API server: [http://localhost:3100](http://localhost:3100)

Defaults:

- Web port: `3000`
- API port: `3100`
- Data directory: `./data/docker-ownlab`

Override with environment variables:

```sh
OWNLAB_WEB_PORT=3001 OWNLAB_SERVER_PORT=3200 \
NEXT_PUBLIC_OWNLAB_SERVER_URL=http://localhost:3200 \
OWNLAB_DATA_DIR=./data/ownlab \
  docker compose -f docker-compose.quickstart.yml up --build
```

Quickstart uses embedded PostgreSQL inside the `server` container and persists it under the mounted `OWNLAB_HOME` volume.

## Manual Docker Build

Build separate runtime images from the shared multi-stage Dockerfile:

```sh
docker build --target server-runtime -t ownlab-server-local .
docker build --target web-runtime -t ownlab-web-local .
```

Run the API server:

```sh
docker run --name ownlab-server \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e OWNLAB_HOME=/ownlab \
  -v "$(pwd)/data/docker-ownlab:/ownlab" \
  ownlab-server-local
```

Run the web app against that server:

```sh
docker run --name ownlab-web \
  -p 3000:3000 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e OWNLAB_SERVER_URL=http://host.docker.internal:3100 \
  -e NEXT_PUBLIC_OWNLAB_SERVER_URL=http://localhost:3100 \
  ownlab-web-local
```

## Data Persistence

All data under `OWNLAB_HOME` inside the container is persisted under the bind mount (`./data/docker-ownlab` by default), including:

- Embedded PostgreSQL data (when `DATABASE_URL` is not set)
- Uploaded assets
- Local secrets/keys
- Agent and workspace data

## External Postgres via docker-compose

The top-level `docker-compose.yml` spins up:

- A `postgres:17-alpine` container named `db`
- The OwnLab API server container pointing at that database via `DATABASE_URL`
- The OwnLab web container pointing at the API server via `OWNLAB_SERVER_URL`

Start both:

```sh
docker compose up --build
```

Open:

- Web UI: [http://localhost:3000](http://localhost:3000)
- API server: [http://localhost:3100](http://localhost:3100)

You can customize connection details by editing `docker-compose.yml` or overriding the environment on the `server` and `web` services.
