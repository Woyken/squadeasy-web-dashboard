import { MetaProvider } from "@solidjs/meta";
import { A, Router, useBeforeLeave, useNavigate } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import "./app.css";
import "./resetCss.css";
import {
    UsersTokensProvider,
    useUsersTokens,
} from "./components/UsersTokensProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import "@shoelace-style/shoelace/dist/themes/dark.css";
import Drawer from "./components/sl/Drawer";
import { SlDrawer } from "@shoelace-style/shoelace";
import { UserPickerRow } from "./components/UserPickerRow";
import { AutoBooster } from "./components/AutoBooster";
import { UserAvatar } from "./components/UserAvatar";

function NavigationBar() {
    const [drawer, setDrawer] = createSignal<SlDrawer>();
    const userTokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(userTokens().tokens.keys()));
    useBeforeLeave(() => {
        drawer()?.hide();
    });
    const navigate = useNavigate();
    return (
        <header
            style={{
                display: "grid",
                "grid-template-columns": "2fr 1fr 2fr",
                "align-items": "center",
                padding: "var(--sl-spacing-x-small)",
                "background-color": "var(--sl-color-neutral-50)",
            }}
        >
            <div></div>
            <h2
                onclick={() => navigate("/")}
                style={{ margin: 0, "text-align": "center" }}
            >
                SquadEasy
            </h2>
            <div style={{ display: "flex", "justify-content": "end" }}>
                <Show when={userIds().length > 0}>
                    <UserAvatar
                        onclick={() => drawer()?.show()}
                        userId={userIds()[0]}
                    />
                </Show>
                <Drawer ref={setDrawer}>
                    <div
                        style={{
                            display: "flex",
                            "flex-direction": "column",
                            gap: "var(--sl-spacing-x-small)",
                        }}
                    >
                        <For each={userIds()}>
                            {(userId) => (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "var(--sl-spacing-x-small)",
                                        "align-items": "center",
                                    }}
                                >
                                    <UserPickerRow userId={userId} />
                                </div>
                            )}
                        </For>
                    </div>
                    <div slot="footer">
                        <A onclick={() => drawer()?.hide()} href="/login">
                            Login with different user
                        </A>
                    </div>
                </Drawer>
            </div>
        </header>
    );
}

export default function App() {
    const [queryClient] = createSignal(new QueryClient());
    return (
        <Router
            base={import.meta.env.SERVER_BASE_URL}
            root={(props) => (
                <MetaProvider>
                    <QueryClientProvider client={queryClient()}>
                        <UsersTokensProvider>
                            <AutoBooster>
                                <NavigationBar />
                                <Suspense>{props.children}</Suspense>
                            </AutoBooster>
                        </UsersTokensProvider>
                    </QueryClientProvider>
                </MetaProvider>
            )}
        >
            <FileRoutes />
        </Router>
    );
}
