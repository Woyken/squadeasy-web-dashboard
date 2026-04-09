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
        <main class="flex-1 overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>Users statistics</Title>
            <div class="card mt-2 w-full bg-base-100 p-6 shadow-xl">
                <div class="inline-block text-xl font-semibold">
                    User statistics
                </div>
                <div class="divider mt-2" />
                <div class="h-full w-full bg-base-100 pb-6">
                    <Suspense fallback={<span>Loading...</span>}>
                        <div class="w-full overflow-x-auto">
                            <table class="table w-full">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Points</th>
                                        <th>
                                            Step length (assuming every walk was
                                            tracked)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <Show when={teamQuery.isLoading}>
                                        <tr>
                                            <td>
                                                <span class="loading loading-spinner"></span>
                                            </td>
                                        </tr>
                                    </Show>
                                    <Show when={!!teamQuery.data}>
                                        <For
                                            each={
                                                teamQuery.data?.users.toSorted(
                                                    (a, b) =>
                                                        b.points - a.points,
                                                ) ?? []
                                            }
                                        >
                                            {(user) => (
                                                <>
                                                    <tr>
                                                        <td
                                                            onclick={() =>
                                                                setShowUserStatistics(
                                                                    (old) =>
                                                                        old ===
                                                                        user.id
                                                                            ? undefined
                                                                            : user.id,
                                                                )
                                                            }
                                                        >
                                                            <div
                                                                class="flex items-center space-x-3"
                                                                id={user.id}
                                                            >
                                                                <Avatar
                                                                    userId={
                                                                        user.id
                                                                    }
                                                                />
                                                                <div>
                                                                    <div class="font-bold">
                                                                        {getUserDisplayName(
                                                                            {
                                                                                email: "Unknown",
                                                                                ...user,
                                                                            },
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>{user.points}</td>
                                                        <UserStepLengthRow
                                                            userId={user.id}
                                                        />
                                                    </tr>
                                                    <Show
                                                        when={
                                                            showUserStatistics() ===
                                                            user.id
                                                        }
                                                    >
                                                        <div>
                                                            <Show
                                                                when={
                                                                    endAtTimestamp() &&
                                                                    startAtTimestamp()
                                                                }
                                                            >
                                                                <UserStatisticsGraph
                                                                    userId={
                                                                        user.id
                                                                    }
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
                                                </>
                                            )}
                                        </For>
                                    </Show>
                                </tbody>
                            </table>
                        </div>
                    </Suspense>
                </div>
            </div>
        </main>
    );
}

function UserStepLengthRow(props: { userId: string }) {
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
        // meters per step
        return distance / steps;
    });
    return <td>{stepLength()?.toFixed(2) ?? "-"}</td>;
}
