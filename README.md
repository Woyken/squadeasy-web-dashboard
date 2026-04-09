# SquadEasy Monorepo

This repository now contains the SquadEasy web dashboard and tracker server in a single pnpm workspace.

The deployment split is intentional:

- `apps/web-dashboard` is deployed to GitHub Pages.
- `apps/tracker-server` is deployed manually outside GitHub Pages.

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
- The tracker server is not part of the GitHub Pages pipeline and should be deployed manually from `apps/tracker-server`.
