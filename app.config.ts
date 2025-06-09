import { defineConfig } from "@solidjs/start/config";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const basePathPrepend = process.env.BASE_PATH
    ? `/${process.env.BASE_PATH}`
    : "";

export default defineConfig({
    ssr: true,
    server: {
        baseURL: process.env.BASE_PATH,
        static: true,
        preset: "static",
        prerender: {
            routes: [
                `/`,
                `${basePathPrepend}/404.html`,
                `${basePathPrepend}/login`,
                `${basePathPrepend}/user-statistics`,
                `${basePathPrepend}/user`,
                `${basePathPrepend}/users-points`,
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
