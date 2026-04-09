import { Title } from "@solidjs/meta";
import {
    For,
    Show,
    createSignal,
    createMemo,
    onMount,
    Suspense,
} from "solid-js";
import {
    useMyChallengeQuery,
    useTeamQuery,
    useUserStatisticsQuery,
} from "~/api/client";
import { Avatar } from "~/components/Avatar";
import { useMainUser } from "~/components/MainUserProvider";
import { UserStatisticsGraph } from "~/components/UserStatisticsGraph";
import { getUserDisplayName } from "~/getUserDisplayName";
import { createFileRoute } from "@tanstack/solid-router";
import * as v from "valibot";

export const Route = createFileRoute("/user-statistics")({
    component: RouteComponent,
    validateSearch: v.object({
        teamId: v.optional(v.string()),
        userId: v.optional(v.string()),
    }),
});

function RouteComponent() {
    const teamId = Route.useSearch({ select: (s) => s.teamId });
    const userIdParam = Route.useSearch({ select: (s) => s.userId });
    const teamQuery = useTeamQuery(teamId);
    const [showUserStatistics, setShowUserStatistics] = createSignal<string>();

    onMount(() => {
        if (userIdParam()) {
            setShowUserStatistics(userIdParam());
        }
    });

    const mainUser = useMainUser();
    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);
    const endAtTimestamp = createMemo(() => {
        if (!challengeQuery.data || !challengeQuery.data.endAt) return;
        return new Date(challengeQuery.data.endAt).getTime();
    });
    const startAtTimestamp = createMemo(() => {
        if (!challengeQuery.data || !challengeQuery.data.startAt) return;
        return new Date(challengeQuery.data.startAt).getTime();
    });

    return (
        <main class="flex-1 overflow-y-auto bg-base-200 bg-grid">
            <div class="bg-glow absolute inset-0" />
            <Title>User Statistics — SquadEasy</Title>
            <div class="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <h1 class="section-header mb-6">User Statistics</h1>

                <Suspense
                    fallback={
                        <div class="glass-card flex h-48 items-center justify-center">
                            <span class="loading loading-ring loading-lg text-primary"></span>
                        </div>
                    }
                >
                    <div class="flex flex-col gap-3">
                        <Show when={teamQuery.isLoading}>
                            <div class="glass-card flex h-48 items-center justify-center">
                                <span class="loading loading-ring loading-lg text-primary"></span>
                            </div>
                        </Show>
                        <Show when={!!teamQuery.data}>
                            <For
                                each={
                                    teamQuery.data?.users
                                        .slice()
                                        .sort(
                                            (a, b) => b.points - a.points,
                                        ) ?? []
                                }
                            >
                                {(user, idx) => (
                                    <div
                                        class={`glass-card overflow-hidden transition-all duration-300 ${
                                            showUserStatistics() === user.id
                                                ? "ring-1 ring-primary/30"
                                                : ""
                                        }`}
                                    >
                                        {/* User row */}
                                        <button
                                            class="table-row-interactive flex w-full items-center gap-4 px-4 py-4 sm:px-6"
                                            onClick={() =>
                                                setShowUserStatistics(
                                                    (old) =>
                                                        old === user.id
                                                            ? undefined
                                                            : user.id,
                                                )
                                            }
                                        >
                                            {/* Rank */}
                                            <span class="w-6 text-center text-sm font-medium text-base-content/40">
                                                {idx() + 1}
                                            </span>

                                            {/* Avatar */}
                                            <Avatar userId={user.id} />

                                            {/* Name */}
                                            <div class="min-w-0 flex-1 text-left">
                                                <span class="block truncate text-sm font-semibold">
                                                    {getUserDisplayName({
                                                        email: "Unknown",
                                                        ...user,
                                                    })}
                                                </span>
                                                <UserStepLengthInline
                                                    userId={user.id}
                                                />
                                            </div>

                                            {/* Points */}
                                            <span class="text-base font-bold text-primary sm:text-lg">
                                                {user.points.toLocaleString()}
                                            </span>

                                            {/* Expand icon */}
                                            <svg
                                                class={`h-4 w-4 flex-shrink-0 text-base-content/30 transition-transform duration-200 ${
                                                    showUserStatistics() ===
                                                    user.id
                                                        ? "rotate-180"
                                                        : ""
                                                }`}
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
                                        </button>

                                        {/* Expanded: Activity graphs */}
                                        <Show
                                            when={
                                                showUserStatistics() ===
                                                user.id
                                            }
                                        >
                                            <div class="animate-slide-down border-t border-white/5 px-4 pb-4 pt-3 sm:px-6">
                                                <Show
                                                    when={
                                                        endAtTimestamp() &&
                                                        startAtTimestamp()
                                                    }
                                                >
                                                    <UserStatisticsGraph
                                                        userId={user.id}
                                                        endsAt={
                                                            endAtTimestamp()!
                                                        }
                                                        startAt={
                                                            startAtTimestamp()!
                                                        }
                                                    />
                                                </Show>
                                            </div>
                                        </Show>
                                    </div>
                                )}
                            </For>
                        </Show>
                    </div>
                </Suspense>
            </div>
        </main>
    );
}

function UserStepLengthInline(props: { userId: string }) {
    const userStatisticsQuery = useUserStatisticsQuery(() => props.userId);
    const totalTrackedMovingDistance = createMemo(() => {
        if (!userStatisticsQuery.data) return;
        return userStatisticsQuery.data.activities
            .filter(
                (a) =>
                    !!["active_walk", "run", "hiking"].find(
                        (x) => x === a.activityId,
                    ),
            )
            .map((a) => a.value)
            .reduce((acc, curr) => acc + curr, 0);
    });
    const stepsCount = createMemo(() => {
        if (!userStatisticsQuery.data) return;
        return userStatisticsQuery.data.activities.find(
            (a) => a.activityId === "walk",
        )?.value;
    });
    const stepLength = createMemo(() => {
        const distance = totalTrackedMovingDistance();
        const steps = stepsCount();
        if (!distance || !steps) return;
        return distance / steps;
    });
    return (
        <Show when={stepLength()}>
            <span class="text-xs text-base-content/40">
                Step: {stepLength()?.toFixed(2)}m
            </span>
        </Show>
    );
}
