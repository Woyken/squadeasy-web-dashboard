import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    ssr: true,
    server: {
        baseURL: process.env.BASE_PATH,
        static: true,
        preset: 'static',
        prerender: {
            routes: ["/", "/login", "/user", "/404"],
            crawlLinks: true,
        },
    },
});
