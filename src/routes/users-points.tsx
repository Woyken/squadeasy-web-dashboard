import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { useSeasonRankingQuery } from "~/api/client";
import { TeamUsersScoresGraph } from "~/components/TeamUsersScoresGraph";

export default function TeamsUsersPoints() {
    const teamsRankingQuery = useSeasonRankingQuery();
    const [showTeamScores, setShowTeamScores] = createSignal<string>();
    return (
        <main class="flex-1 overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>Users points</Title>
            <div class="card mt-2 w-full bg-base-100 p-6 shadow-xl">
                <div class="inline-block text-xl font-semibold">
                    Teams users points
                </div>
                <div class="divider mt-2" />
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
                                            teamsRankingQuery.data?.teams
                                                .toSorted(
                                                    (a, b) =>
                                                        b.points - a.points,
                                                )
                                                .slice(0, 10) ?? []
                                        }
                                    >
                                        {(team) => (
                                            <>
                                                <tr>
                                                    <td
                                                        onclick={() =>
                                                            setShowTeamScores(
                                                                (old) =>
                                                                    old ===
                                                                    team.id
                                                                        ? undefined
                                                                        : team.id,
                                                            )
                                                        }
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
                                                                    {team.name}
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
                                                        <A
                                                            href={`/user-statistics?teamId=${team.id}`}
                                                        >
                                                            User statistics
                                                        </A>
                                                        <div class="max-h-96">
                                                            <TeamUsersScoresGraph
                                                                teamId={team.id}
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
            </div>
        </main>
    );
}
