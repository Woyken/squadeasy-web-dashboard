import { defineConfig, loadEnv } from "vite";
import solid from "vite-plugin-solid";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const basePath = env.VITE_BASE_PATH || "/";
    const normalizedBasePath = basePath.endsWith("/")
        ? basePath
        : `${basePath}/`;

    return {
        base: normalizedBasePath,
        plugins: [
            solid(),
            TanStackRouterVite({ target: "solid", autoCodeSplitting: true }),
        ],
        resolve: {
            alias: {
                "~": path.resolve(__dirname, "./src"),
            },
        },
    };
});