import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { Link, Outlet, createRootRoute } from "@tanstack/solid-router";
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
import { MainUserProvider, useMainUser } from "~/components/MainUserProvider";
import { ToasterProvider } from "~/components/ToasterProvider";
import { NotFound } from "~/components/NotFoundRoutePage";
import { RealtimePointsListener } from "~/components/RealtimePointsListener";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2,
            retry: 1,
        },
    },
});

export const Route = createRootRoute({
    component: RootComponent,
    notFoundComponent: () => <NotFound />,
    errorComponent: (props) => {
        console.error("rendering error", props.error);
        return (
            <div
                class="grid min-h-screen place-items-center bg-white font-mono"
                onClick={props.reset}
            >
                <div class="border-[3px] border-black p-8 text-center">
                    <div class="mb-4 text-5xl font-bold">ERR</div>
                    <div class="mb-2 bg-black px-3 py-1.5 text-[11px] tracking-widest text-(--color-brut-red)">
                        STATUS: FATAL_ERROR
                    </div>
                    <pre class="mb-4 max-w-md overflow-auto text-left text-[10px] text-(--color-brut-gray)">
                        {props.error?.message ?? "UNKNOWN"}
                    </pre>
                    <button class="brut-btn-primary">[RETRY]</button>
                </div>
            </div>
        );
    },
});

function RootComponent() {
    return (
        <QueryClientProvider client={queryClient}>
            <UsersTokensProvider>
                <MainUserProvider>
                    <AutoBooster>
                        <AutoLikeTeamPosts>
                            <ToasterProvider>
                                <RealtimePointsListener />
                                <NavigationBar />
                                <Outlet />
                            </ToasterProvider>
                        </AutoLikeTeamPosts>
                    </AutoBooster>
                </MainUserProvider>
            </UsersTokensProvider>
        </QueryClientProvider>
    );
}

function NavigationBar() {
    const usersTokens = useUsersTokens();
    const { mainUserId, setMainUserId } = useMainUser();
    const [menuOpen, setMenuOpen] = createSignal(false);
    const userIds = createMemo(() =>
        Array.from(usersTokens().tokens.keys()),
    );

    return (
        <nav class="sticky top-0 z-9999 flex h-12 items-center justify-between border-b-[3px] border-black bg-white px-4">
            <div class="flex items-center gap-4">
                <Link
                    to="/"
                    class="text-sm font-bold tracking-tighter no-underline text-black"
                >
                    SQUADEASY_
                </Link>
                <div class="hidden gap-2 sm:flex">
                    <Link
                        to="/"
                        class="px-2 py-1 text-sm font-bold uppercase tracking-wider no-underline text-(--color-brut-dim) hover:text-(--color-brut-red)"
                    >
                        LEADERBOARD
                    </Link>
                    <Link
                        to="/teams-dashboard"
                        class="px-2 py-1 text-sm font-bold uppercase tracking-wider no-underline text-(--color-brut-dim) hover:text-(--color-brut-red)"
                    >
                        CHARTS
                    </Link>
                    <Link
                        to="/users-points"
                        search={{ teamId: "" }}
                        class="px-2 py-1 text-sm font-bold uppercase tracking-wider no-underline text-(--color-brut-dim) hover:text-(--color-brut-red)"
                    >
                        TEAMS
                    </Link>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <Show when={userIds().length > 0}>
                    <div class="hidden sm:block">
                        <UsersAvatarsPreview userIds={userIds()} />
                    </div>
                </Show>

                <Show
                    when={userIds().length > 0}
                    fallback={
                        <Link to="/login" class="brut-btn-primary text-[10px] no-underline">
                            [LOGIN]
                        </Link>
                    }
                >
                    <div class="relative">
                        <button
                            class="border-2 border-black px-2 py-0.5 text-[10px] font-bold tracking-wider hover:bg-black hover:text-white"
                            onClick={() => setMenuOpen((p) => !p)}
                        >
                            MENU
                        </button>
                        <Show when={menuOpen()}>
                            <div
                                class="absolute right-0 top-full mt-1 w-56 border-2 border-black bg-white shadow-[4px_4px_0_#000] z-50"
                                onClick={() => setMenuOpen(false)}
                            >
                                <For each={userIds()}>
                                    {(userId) => {
                                        const isMain = createMemo(() => mainUserId() === userId);
                                        return (
                                            <div class={`flex items-center gap-2 border-b border-(--color-brut-light) px-3 py-2 text-[11px] ${isMain() ? "bg-(--color-brut-light)" : ""}`}>
                                                <Avatar userId={userId} size={24} />
                                                <UserLoader userId={userId}>
                                                    {(query, displayName) => (
                                                        <Show
                                                            when={!query.isLoading}
                                                            fallback={<span class="h-3 w-16 brut-skeleton" />}
                                                        >
                                                            <Link
                                                                to="/user"
                                                                search={{ id: userId }}
                                                                class="flex-1 font-bold uppercase no-underline text-black hover:text-(--color-brut-red)"
                                                            >
                                                                {displayName()}
                                                            </Link>
                                                        </Show>
                                                    )}
                                                </UserLoader>
                                                <Show
                                                    when={isMain()}
                                                    fallback={
                                                        <button
                                                            class="ml-auto shrink-0 border border-(--color-brut-light) px-1.5 py-0.5 text-[9px] tracking-wider text-(--color-brut-dim) hover:border-black hover:text-black"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setMainUserId(userId);
                                                            }}
                                                        >
                                                            SET MAIN
                                                        </button>
                                                    }
                                                >
                                                    <span class="ml-auto shrink-0 text-[9px] font-bold tracking-wider text-(--color-brut-red)">
                                                        MAIN
                                                    </span>
                                                </Show>
                                            </div>
                                        );
                                    }}
                                </For>
                                <div class="sm:hidden border-t border-(--color-brut-light)">
                                    <Link
                                        to="/"
                                        class="block px-3 py-2 text-sm font-bold uppercase tracking-wider no-underline text-black hover:text-(--color-brut-red)"
                                    >
                                        LEADERBOARD
                                    </Link>
                                    <Link
                                        to="/teams-dashboard"
                                        class="block px-3 py-2 text-sm font-bold uppercase tracking-wider no-underline text-black hover:text-(--color-brut-red)"
                                    >
                                        CHARTS
                                    </Link>
                                    <Link
                                        to="/users-points"
                                        search={{ teamId: "" }}
                                        class="block px-3 py-2 text-sm font-bold uppercase tracking-wider no-underline text-black hover:text-(--color-brut-red)"
                                    >
                                        TEAMS
                                    </Link>
                                </div>
                                <button
                                    class="w-full border-t-2 border-black px-3 py-2 text-left text-[10px] font-bold tracking-widest text-(--color-brut-red) hover:bg-(--color-brut-red) hover:text-white"
                                    onClick={() => {
                                        for (const uid of userIds()) {
                                            usersTokens().removeToken(uid);
                                        }
                                    }}
                                >
                                    [LOGOUT_ALL]
                                </button>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </nav>
    );
}
