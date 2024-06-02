import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    server: {
        static: true,
        prerender: {
            crawlLinks: true,
        },
    },
});
