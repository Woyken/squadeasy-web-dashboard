import { MetaProvider } from "@solidjs/meta";
import { A, Router } from "@solidjs/router";
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
import { AutoBooster } from "./components/AutoBooster";
import { UsersAvatarsPreview } from "./components/UsersAvatarsPreview";
import { Avatar } from "./components/Avatar";
import { UserLoader } from "./components/UserLoader";
import { TeamScoreTracker } from "./components/TeamScoreTracker";

function NavigationBar() {
    const userTokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(userTokens().tokens.keys()));
    return (
        <div class="navbar bg-base-100">
            <div class="flex-1">
                <A href="/" class="btn btn-ghost text-xl">
                    SquadEasy
                </A>
            </div>
            <div class="flex-none">
                <div class="dropdown dropdown-end">
                    <div
                        tabindex="0"
                        role="button"
                        class="btn btn-ghost rounded-btn hover:bg-neutral"
                    >
                        <UsersAvatarsPreview userIds={userIds()} />
                    </div>
                    <ul
                        tabindex="0"
                        class="menu dropdown-content z-[1] mt-4 w-52 rounded-box bg-base-100 p-2 shadow"
                    >
                        <For each={userIds()}>
                            {(userId) => (
                                <li>
                                    <A
                                        href={`/user?id=${userId}`}
                                        onclick={(e) => {
                                            e.currentTarget.blur();
                                        }}
                                    >
                                        <UserLoader userId={userId}>
                                            {(query, displayName) => (
                                                <div class="flex items-center space-x-3">
                                                    <Avatar userId={userId} />
                                                    <div class="font-bold">
                                                        <Show
                                                            when={
                                                                query.isLoading
                                                            }
                                                            fallback={displayName()}
                                                        >
                                                            <span class="loading loading-dots loading-lg"></span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            )}
                                        </UserLoader>
                                    </A>
                                </li>
                            )}
                        </For>
                        <li>
                            <A
                                href="/login"
                                onclick={(e) => {
                                    e.currentTarget.blur();
                                }}
                            >
                                Login with another account
                            </A>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
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
                                <TeamScoreTracker />
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
