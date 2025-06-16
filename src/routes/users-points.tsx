import { createFileRoute, Link } from "@tanstack/solid-router";
import { Title } from "@solidjs/meta";
import { For, Show, Suspense, createSignal, onMount } from "solid-js";
import { useSeasonRankingQuery } from "~/api/client";
import { TeamUsersScoresGraph } from "~/components/TeamUsersScoresGraph";
import * as v from "valibot";
import { OnMount } from "~/components/OnMount";

export const Route = createFileRoute("/users-points")({
    component: RouteComponent,
    validateSearch: v.object({
        teamId: v.optional(v.string()),
    }),
});

function RouteComponent() {
    const teamsRankingQuery = useSeasonRankingQuery();
    const [showTeamScores, setShowTeamScores] = createSignal<string>();
    const teamId = Route.useSearch({ select: (s) => s.teamId });
    const navigate = Route.useNavigate();

    onMount(() => {
        if (teamId()) {
            setShowTeamScores(teamId());
        }
    });

    return (
        <main class="flex-1 overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>Users points</Title>
            <div class="card mt-2 w-full bg-base-100 p-6 shadow-xl">
                <div class="inline-block text-xl font-semibold">
                    Teams users points
                </div>
                <div class="divider mt-2" />
                <Suspense fallback={<span>Loading...</span>}>
                    <div class="h-full w-full bg-base-100 pb-6">
                        <div class="w-full overflow-x-auto">
                            <table class="table w-full">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <Show when={teamsRankingQuery.isLoading}>
                                        <tr>
                                            <td>
                                                <span class="loading loading-spinner"></span>
                                            </td>
                                        </tr>
                                    </Show>
                                    <Show when={!!teamsRankingQuery.data}>
                                        <For
                                            each={
                                                teamsRankingQuery.data?.data?.teams.toSorted(
                                                    (a, b) =>
                                                        b.points - a.points,
                                                ) ?? []
                                            }
                                        >
                                            {(team) => (
                                                <>
                                                    <tr id={`id-${team.id}`}>
                                                        <Show
                                                            when={
                                                                teamId() ===
                                                                team.id
                                                            }
                                                        >
                                                            <OnMount
                                                                onMount={() => {
                                                                    document
                                                                        .querySelector(
                                                                            `#id-${team.id}`,
                                                                        )
                                                                        ?.scrollIntoView();
                                                                }}
                                                            />
                                                        </Show>
                                                        <td
                                                            onclick={() => {
                                                                setShowTeamScores(
                                                                    (old) =>
                                                                        old ===
                                                                        team.id
                                                                            ? undefined
                                                                            : team.id,
                                                                );
                                                                // Update the query string to reflect the expanded team
                                                                navigate({
                                                                    to: "/users-points",
                                                                    search: {
                                                                        teamId: team.id,
                                                                    },
                                                                });
                                                            }}
                                                        >
                                                            <div class="flex items-center space-x-3">
                                                                <Show
                                                                    when={
                                                                        !!team.image
                                                                    }
                                                                    fallback={
                                                                        <div class="avatar placeholder">
                                                                            <div class="w-12 rounded-full bg-neutral text-neutral-content">
                                                                                <span class="text-xl">
                                                                                    {team.name.slice(
                                                                                        0,
                                                                                        2,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    }
                                                                >
                                                                    <div class="avatar">
                                                                        <div class="mask mask-circle h-12 w-12">
                                                                            <img
                                                                                src={
                                                                                    team.image ??
                                                                                    ""
                                                                                }
                                                                                alt={`${team.name} Avatar`}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </Show>
                                                                <div>
                                                                    <div class="font-bold">
                                                                        {
                                                                            team.name
                                                                        }
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>{team.points}</td>
                                                    </tr>
                                                    <Show
                                                        when={
                                                            showTeamScores() ===
                                                            team.id
                                                        }
                                                    >
                                                        <div>
                                                            <Link
                                                                to={`/user-statistics`}
                                                                search={{
                                                                    teamId: team.id,
                                                                }}
                                                            >
                                                                User statistics
                                                            </Link>
                                                            <div class="max-h-96">
                                                                <TeamUsersScoresGraph
                                                                    teamId={
                                                                        team.id
                                                                    }
                                                                />
                                                            </div>
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
                </Suspense>
            </div>
        </main>
    );
}
