import { defineConfig } from "@solidjs/start/config";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
    ssr: true,
    server: {
        baseURL: process.env.BASE_PATH,
        static: true,
        preset: "static",
        prerender: {
            routes: [
                `/`,
                `/404.html`,
                `/login`,
                `/user-statistics`,
                `/user`,
                `/users-points`,
            ],
            crawlLinks: true,
        },
    },
    vite: {
        plugins: [
            TanStackRouterVite({ target: "solid", autoCodeSplitting: true }),
        ],
    },
});
