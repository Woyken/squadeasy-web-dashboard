# SquadEasy Monorepo

This repository now contains the SquadEasy web dashboard and tracker server in a single pnpm workspace.

The deployment split is intentional:

- `apps/web-dashboard` is deployed to GitHub Pages.
- `apps/tracker-server` is deployed separately, for example on Coolify.

## Workspace Layout

- `apps/web-dashboard` contains the SolidStart frontend.
- `apps/tracker-server` contains the Fastify tracker server.
- `patches` contains pnpm patch files shared by the workspace.

## Getting Started

1. Install workspace dependencies:

   ```bash
   pnpm install
   ```

2. Run the frontend:

   ```bash
   pnpm dev:web
   ```

3. Run the tracker server:

   ```bash
   pnpm dev:tracker-server
   ```

## Common Commands

- `pnpm build:web` builds the frontend.
- `pnpm start:web` starts the built frontend.
- `pnpm dev:tracker-server:watch` starts the tracker server with file watching.
- `pnpm db:init` initializes the tracker server database.

## Deployment

- The GitHub Actions workflow in this repository builds and publishes only `apps/web-dashboard` to GitHub Pages.
- The tracker server is not part of the GitHub Pages pipeline and can be deployed from `apps/tracker-server` to your own Coolify instance.

### Tracker Server On Coolify

The simplest Coolify setup is to deploy `apps/tracker-server/compose.yaml` as a single stack:

- `tracker-server` is the only public HTTP service.
- `postgres` stays internal to the Docker network and is not published to the public internet.
- database files persist in the `postgres-data` Docker volume on the host disk.

For that stack, set these environment variables in Coolify:

- `EMAIL`
- `PASSWORD`
- `DB_DATABASE`
- `DB_USER`
- `DB_PASSWORD`
- `CORS_ALLOWED_ORIGINS` - comma-separated browser origins allowed to call the API, for example `https://<your-github-user>.github.io`

The compose stack already wires these server-side values for you:

- `DB_HOST=postgres`
- `DB_PORT=5432`
- `HOST=0.0.0.0`
- `PORT=3000`

Useful endpoints after deployment:

- `/healthz` - liveness probe
- `/readyz` - readiness probe with a database check
- `/docs` - Swagger UI
- `/openapi.json` - OpenAPI document

If you prefer managing Postgres outside the stack, you can still deploy only the tracker server from `apps/tracker-server/Dockerfile`, but then you must provide the external database connection settings yourself.

For local Docker usage, the same `apps/tracker-server/compose.yaml` keeps Postgres private as well. If you ever need direct host access to the database, temporarily add a `5432:5432` port mapping back to the `postgres` service.

### GitHub Pages Frontend

The GitHub Pages workflow already passes `VITE_API_BASE_URL` from the repository secret named `API_BASE_URL`.

Set that secret to your public Coolify tracker server URL, for example:

```text
https://tracker.example.com
```

The frontend trims a trailing slash automatically, so either form works.
