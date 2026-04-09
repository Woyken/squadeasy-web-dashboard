// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
    <StartServer
        document={({ assets, children, scripts }) => (
            <html
                data-theme="dark"
                lang="en"
                class="sl-theme-dark"
                style={{ "color-scheme": "dark" }}
            >
                <head>
                    <meta charset="utf-8" />
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1"
                    />
                    <link rel="icon" href="/favicon.ico" />
                    {assets}
                </head>
                <body>
                    <div id="app" class="h-dvh overflow-auto flex flex-col">{children}</div>
                    {scripts}
                </body>
            </html>
        )}
    />
));
