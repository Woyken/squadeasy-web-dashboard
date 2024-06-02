import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    server: {
        baseURL: '/squadeasy-web-dashboard',
        static: true,
        prerender: {
            routes: ["/", "/login"],
            crawlLinks: true,
        },
    },
});
