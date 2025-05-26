import { MetaProvider } from "@solidjs/meta";
import { Link } from "@tanstack/solid-router";
import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import {
    UsersTokensProvider,
    useUsersTokens,
} from "~/components/UsersTokensProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { AutoBooster } from "~/components/AutoBooster";
import { UsersAvatarsPreview } from "~/components/UsersAvatarsPreview";
import { Avatar } from "~/components/Avatar";
import { UserLoader } from "~/components/UserLoader";
import { AutoLikeTeamPosts } from "~/components/AutoLikeTeamPosts";
import { MainUserProvider } from "~/components/MainUserProvider";
import { ToasterProvider } from "~/components/ToasterProvider";
import { Outlet, createRootRoute } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    const [queryClient] = createSignal(new QueryClient());
    return (
        <>
            <MetaProvider>
                <ToasterProvider>
                    <QueryClientProvider client={queryClient()}>
                        <UsersTokensProvider>
                            <MainUserProvider>
                                <AutoBooster>
                                    <AutoLikeTeamPosts>
                                        {/* <TeamScoreTracker> */}
                                        <NavigationBar />
                                        <Suspense>
                                            <Outlet />
                                        </Suspense>
                                        {/* </TeamScoreTracker> */}
                                    </AutoLikeTeamPosts>
                                </AutoBooster>
                            </MainUserProvider>
                        </UsersTokensProvider>
                    </QueryClientProvider>
                </ToasterProvider>
            </MetaProvider>

            <TanStackRouterDevtools />
        </>
    );
}

function NavigationBar() {
    const userTokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(userTokens().tokens.keys()));
    return (
        <div class="navbar sticky top-0 z-10 bg-base-100">
            <div class="flex-1">
                <Link to="/" class="btn btn-ghost text-xl">
                    SquadEasy
                </Link>
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
                                    <Link to={`/user`} search={{ id: userId }}>
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
                                    </Link>
                                </li>
                            )}
                        </For>
                        <li>
                            <Link to="/login">Login with another account</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
