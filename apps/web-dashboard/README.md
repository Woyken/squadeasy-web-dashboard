# SquadEasy Web Dashboard

A web dashboard for visualizing and tracking team and user statistics for the SquadEasy platform. It provides interactive charts and tables to monitor team rankings, user points, and activity statistics over time.

## Features

- **Team Rankings:** View and compare the top teams, with interactive charts showing points progression.
- **User Statistics:** Drill down into individual user stats, including activity points and step length calculations.
- **Live Countdown:** Displays a countdown to the end of the current challenge or event.
- **Interactive Graphs:** Zoom, pan, and click through team and user data using ECharts.
- **Authentication:** Requires login to access dashboard features.
- **Modern UI:** Built with Tailwind CSS and DaisyUI for a responsive, clean interface.

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   pnpm dev:web
   ```

3. Open your browser to the local server URL.

## Deployment

This app is the only package deployed by the repository's GitHub Pages workflow.

The tracker server lives in `apps/tracker-server` and is deployed separately.

The dashboard is a client-only SolidJS SPA built with Vite. Production builds emit static files into `dist/`, and the build step also copies `index.html` to `404.html` so deep links keep working on GitHub Pages.

For production, set the repository secret `API_BASE_URL` to the public URL of the tracker server. The GitHub Pages workflow passes that value through `VITE_API_BASE_URL` during the build.

## Available Scripts

- `dev` – Start the Vite development server
- `build` – Build the static SPA for production
- `start` – Preview the production build locally
- `generate-client` – Regenerate TypeScript API types from the OpenAPI spec
