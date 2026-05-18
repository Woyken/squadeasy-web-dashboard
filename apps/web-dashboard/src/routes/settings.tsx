import { createMemo, Show } from "solid-js";
import { createFileRoute, Link, redirect } from "@tanstack/solid-router";
import * as v from "valibot";
import { hasStoredUserTokens } from "~/utils/localStorage";
import { useAutoLikeTeamPosts } from "~/components/AutoLikeTeamPosts";
import { useMainUser } from "~/components/MainUserProvider";
import { getUserDisplayName } from "~/getUserDisplayName";
import { useGetUserToken, getMyUserQueryOptions } from "~/api/client";
import { useQuery } from "@tanstack/solid-query";

const settingsSearchSchema = v.object({
    userId: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/settings")({
    component: SettingsPage,
    validateSearch: settingsSearchSchema,
    beforeLoad: ({ location }) => {
        if (!hasStoredUserTokens()) {
            throw redirect({ to: "/login", search: { redirect: location.href } });
        }
    },
});

function SettingsPage() {
    const search = Route.useSearch();
    const mainUser = useMainUser();
    const userId = createMemo(() => search().userId || mainUser.mainUserId() || "");
    const getToken = useGetUserToken(userId);

    const userQuery = useQuery(() =>
        getMyUserQueryOptions(userId, getToken),
    );

    const autoLike = useAutoLikeTeamPosts();

    const isEnabled = createMemo(() => autoLike.autoLikeTeamPosts(userId()));
    const phase = createMemo(() => autoLike.getPhase(userId()));
    const settings = createMemo(() => autoLike.getSettings(userId()));

    const phaseLabel = createMemo(() => {
        const p = phase();
        const s = settings();
        if (p === "crawling") {
            return s?.crawlCursor !== null ? "INITIAL SCAN IN PROGRESS" : "LIKING NEW POSTS...";
        }
        return s?.crawlCursor === null ? "UP TO DATE" : "IDLE";
    });

    const lastLikedDate = createMemo(() => {
        const d = settings()?.lastLikedPostDate;
        if (!d) return undefined;
        return new Date(d).toLocaleString();
    });

    const displayName = createMemo(
        () => getUserDisplayName(userQuery.data) ?? userId().slice(0, 8),
    );

    return (
        <main class="mx-auto max-w-120 px-5 pb-20 pt-6 font-mono">
            {/* Header */}
            <div class="mb-6 border-[3px] border-black p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-lg font-bold uppercase">USER SETTINGS</h1>
                        <p class="text-[11px] text-(--color-brut-gray) uppercase">
                            {displayName()}
                        </p>
                    </div>
                    <Link to="/" class="brut-btn-ghost text-[10px] no-underline">
                        ← BACK
                    </Link>
                </div>
            </div>

            {/* Auto-Like section */}
            <div class="mb-6 border-2 border-black p-5">
                <div class="mb-4 flex items-center justify-between">
                    <div>
                        <div class="text-sm font-bold uppercase tracking-widest">
                            AUTO-LIKE TEAM POSTS
                        </div>
                        <div class="mt-0.5 text-[10px] text-(--color-brut-gray)">
                            Automatically likes posts from your team members
                        </div>
                    </div>
                    <button
                        type="button"
                        class={`border-2 border-black px-4 py-1.5 text-[11px] font-bold tracking-widest transition-colors ${
                            isEnabled()
                                ? "bg-black text-white hover:bg-(--color-brut-red) hover:border-(--color-brut-red)"
                                : "bg-white text-black hover:bg-black hover:text-white"
                        }`}
                        onClick={() =>
                            autoLike.setAutoLikeTeamPosts(userId(), !isEnabled())
                        }
                    >
                        {isEnabled() ? "ON" : "OFF"}
                    </button>
                </div>

                {/* Status */}
                <Show when={isEnabled()}>
                    <div class="border-t border-(--color-brut-light) pt-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                STATUS
                            </span>
                            <span class="text-[11px] font-bold">
                                {phaseLabel()}
                            </span>
                        </div>

                        <Show when={lastLikedDate()}>
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                    LAST LIKED
                                </span>
                                <span class="text-[11px]">{lastLikedDate()}</span>
                            </div>
                        </Show>

                        <Show when={settings()?.crawlCursor !== null && settings()?.crawlCursor !== undefined}>
                            <div class="text-[10px] text-(--color-brut-dim) italic">
                                Initial scan in progress — liking all team posts going backwards.
                            </div>
                        </Show>

                        <div class="mt-3 pt-3 border-t border-(--color-brut-light)">
                            <button
                                type="button"
                                class="w-full border-2 border-black py-1.5 text-[10px] font-bold tracking-widest hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={phase() === "crawling"}
                                onClick={() => autoLike.triggerNow(userId())}
                            >
                                [LIKE NOW]
                            </button>
                        </div>
                    </div>
                </Show>
            </div>
        </main>
    );
}
