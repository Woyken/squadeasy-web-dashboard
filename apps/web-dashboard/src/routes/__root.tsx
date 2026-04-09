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
import { NotFound } from "~/components/NotFoundRoutePage";

export const Route = createRootRoute({
    component: RootComponent,
    notFoundComponent: () => <NotFound />,
    errorComponent: (props) => {
        console.error("rendering error", props.error);
        return (
            <div
                class="flex min-h-screen items-center justify-center bg-base-200"
                onclick={props.reset}
            >
                <div class="glass-card max-w-md p-8 text-center">
                    <div class="mb-4 text-4xl">💥</div>
                    <h2 class="mb-2 text-xl font-bold text-error">
                        Something went wrong
                    </h2>
                    <p class="mb-4 text-sm text-base-content/60">
                        Click anywhere to retry
                    </p>
                    <pre class="max-h-40 overflow-auto rounded-lg bg-base-300 p-3 text-left text-xs text-base-content/70">
                        {JSON.stringify(props.error, null, 2)}
                    </pre>
                </div>
            </div>
        );
    },
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
                                        <NavigationBar />
                                        <Suspense
                                            fallback={
                                                <div class="flex flex-1 items-center justify-center">
                                                    <span class="loading loading-ring loading-lg text-primary"></span>
                                                </div>
                                            }
                                        >
                                            <Outlet />
                                        </Suspense>
                                    </AutoLikeTeamPosts>
                                </AutoBooster>
                            </MainUserProvider>
                        </UsersTokensProvider>
                    </QueryClientProvider>
                </ToasterProvider>
            </MetaProvider>

            <Suspense>
                <TanStackRouterDevtools />
            </Suspense>
        </>
    );
}

function NavigationBar() {
    const userTokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(userTokens().tokens.keys()));
    const [mobileOpen, setMobileOpen] = createSignal(false);

    return (
        <nav class="nav-glass">
            <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <Link
                    to="/"
                    class="flex items-center gap-2 text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
                >
                    <span class="text-gradient text-xl">⚡</span>
                    <span class="text-gradient">SquadEasy</span>
                </Link>

                {/* Desktop nav links */}
                <div class="hidden items-center gap-1 sm:flex">
                    <Link
                        to="/"
                        class="rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-white/5 hover:text-base-content"
                    >
                        Dashboard
                    </Link>
                    <Link
                        to="/users-points"
                        class="rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-white/5 hover:text-base-content"
                    >
                        Teams
                    </Link>
                </div>

                {/* Right side: avatars + dropdown */}
                <div class="flex items-center gap-2">
                    <div class="dropdown dropdown-end">
                        <div
                            tabindex="0"
                            role="button"
                            class="btn btn-ghost btn-sm gap-2 rounded-xl border border-white/10 hover:bg-white/5"
                        >
                            <UsersAvatarsPreview userIds={userIds()} />
                            <svg
                                class="h-4 w-4 text-base-content/50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </div>
                        <ul
                            tabindex="0"
                            class="menu dropdown-content z-[50] mt-3 w-64 animate-slide-down rounded-xl border border-white/10 bg-base-200/95 p-2 shadow-2xl backdrop-blur-xl"
                        >
                            <For each={userIds()}>
                                {(userId) => (
                                    <li>
                                        <Link
                                            to={`/user`}
                                            search={{ id: userId }}
                                            class="rounded-lg transition-colors hover:bg-white/5"
                                        >
                                            <UserLoader userId={userId}>
                                                {(query, displayName) => (
                                                    <div class="flex items-center gap-3">
                                                        <Avatar
                                                            userId={userId}
                                                        />
                                                        <div class="min-w-0 flex-1">
                                                            <Show
                                                                when={
                                                                    query.isLoading
                                                                }
                                                                fallback={
                                                                    <span class="truncate text-sm font-medium">
                                                                        {displayName()}
                                                                    </span>
                                                                }
                                                            >
                                                                <span class="loading loading-dots loading-sm"></span>
                                                            </Show>
                                                        </div>
                                                    </div>
                                                )}
                                            </UserLoader>
                                        </Link>
                                    </li>
                                )}
                            </For>
                            <div class="my-1 border-t border-white/5" />
                            <li>
                                <Link
                                    to="/login"
                                    class="rounded-lg text-sm text-primary transition-colors hover:bg-primary/10"
                                >
                                    <svg
                                        class="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                                        />
                                    </svg>
                                    Add account
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Mobile menu button */}
                    <button
                        class="btn btn-ghost btn-sm sm:hidden"
                        onClick={() => setMobileOpen(!mobileOpen())}
                    >
                        <svg
                            class="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <Show
                                when={!mobileOpen()}
                                fallback={
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                }
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </Show>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile nav */}
            <Show when={mobileOpen()}>
                <div class="animate-slide-down border-t border-white/5 px-4 pb-4 pt-2 sm:hidden">
                    <Link
                        to="/"
                        class="block rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-white/5"
                        onClick={() => setMobileOpen(false)}
                    >
                        Dashboard
                    </Link>
                    <Link
                        to="/users-points"
                        class="block rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-white/5"
                        onClick={() => setMobileOpen(false)}
                    >
                        Teams
                    </Link>
                </div>
            </Show>
        </nav>
    );
}
