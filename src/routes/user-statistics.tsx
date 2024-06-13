import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { For, Show, createSignal, createMemo } from "solid-js";
import { useTeamQuery, useUserStatisticsQuery } from "~/api/client";
import { Avatar } from "~/components/Avatar";
import { UserStatisticsGraph } from "~/components/UserStatisticsGraph";
import { getUserDisplayName } from "~/getUserDisplayName";

export default function UserStatisticsPage() {
    const [params] = useSearchParams();
    const teamId = createMemo(() => params.teamId);
    const teamQuery = useTeamQuery(teamId);
    const [showUserStatistics, setShowUserStatistics] = createSignal<string>();
    return (
        <main class="flex-1 overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>Users statistics</Title>
            <div class="card mt-2 w-full bg-base-100 p-6 shadow-xl">
                <div class="inline-block text-xl font-semibold">
                    User statistics
                </div>
                <div class="divider mt-2" />
                <div class="h-full w-full bg-base-100 pb-6">
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
                                                (a, b) => b.points - a.points,
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
                                                        <div class="flex items-center space-x-3">
                                                            <Avatar
                                                                userId={user.id}
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
                                                        <UserStatisticsGraph
                                                            userId={user.id}
                                                        />
                                                    </div>
                                                </Show>
                                            </>
                                        )}
                                    </For>
                                </Show>
                            </tbody>
                        </table>
                    </div>
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
        return (distance / steps);
    });
    return <td>{stepLength()?.toFixed(2) ?? "-"}</td>;
}
