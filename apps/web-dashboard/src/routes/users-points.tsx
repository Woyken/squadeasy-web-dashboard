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
        <main class="flex-1 overflow-y-auto bg-base-200 bg-grid">
            <div class="bg-glow absolute inset-0" />
            <Title>Teams — SquadEasy</Title>
            <div class="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <h1 class="section-header mb-6">Team Rankings</h1>

                <Suspense
                    fallback={
                        <div class="glass-card flex h-48 items-center justify-center">
                            <span class="loading loading-ring loading-lg text-primary"></span>
                        </div>
                    }
                >
                    <div class="flex flex-col gap-3">
                        <Show when={teamsRankingQuery.isLoading}>
                            <div class="glass-card flex h-48 items-center justify-center">
                                <span class="loading loading-ring loading-lg text-primary"></span>
                            </div>
                        </Show>
                        <Show when={!!teamsRankingQuery.data}>
                            <For
                                each={
                                    teamsRankingQuery.data?.data?.teams
                                        .slice()
                                        .sort(
                                            (a, b) => b.points - a.points,
                                        ) ?? []
                                }
                            >
                                {(team, idx) => (
                                    <div id={`team-${team.id}`}>
                                        <Show
                                            when={teamId() === team.id}
                                        >
                                            <OnMount
                                                onMount={() => {
                                                    document
                                                        .querySelector(
                                                            `#team-${team.id}`,
                                                        )
                                                        ?.scrollIntoView({
                                                            behavior:
                                                                "smooth",
                                                        });
                                                }}
                                            />
                                        </Show>
                                        <div
                                            class={`glass-card overflow-hidden transition-all duration-300 ${
                                                showTeamScores() ===
                                                team.id
                                                    ? "ring-1 ring-primary/30"
                                                    : ""
                                            }`}
                                        >
                                            {/* Team row */}
                                            <button
                                                class="table-row-interactive flex w-full items-center gap-4 px-4 py-4 sm:px-6"
                                                onClick={() => {
                                                    setShowTeamScores(
                                                        (old) =>
                                                            old ===
                                                            team.id
                                                                ? undefined
                                                                : team.id,
                                                    );
                                                    navigate({
                                                        to: "/users-points",
                                                        search: {
                                                            teamId:
                                                                team.id,
                                                        },
                                                    });
                                                }}
                                            >
                                                {/* Rank */}
                                                <div
                                                    class={`rank-badge flex-shrink-0 ${
                                                        idx() === 0
                                                            ? "gold"
                                                            : idx() === 1
                                                              ? "silver"
                                                              : idx() === 2
                                                                ? "bronze"
                                                                : "bg-base-300 text-base-content/50"
                                                    }`}
                                                >
                                                    {idx() + 1}
                                                </div>

                                                {/* Avatar */}
                                                <Show
                                                    when={team.image}
                                                    fallback={
                                                        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral text-sm font-bold text-neutral-content">
                                                            {team.name.slice(
                                                                0,
                                                                2,
                                                            )}
                                                        </div>
                                                    }
                                                >
                                                    <img
                                                        src={
                                                            team.image ??
                                                            ""
                                                        }
                                                        alt={team.name}
                                                        class="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-white/10"
                                                    />
                                                </Show>

                                                {/* Name */}
                                                <span class="min-w-0 flex-1 truncate text-left text-sm font-semibold sm:text-base">
                                                    {team.name}
                                                </span>

                                                {/* Points */}
                                                <span class="text-base font-bold text-primary sm:text-lg">
                                                    {team.points.toLocaleString()}
                                                </span>

                                                {/* Expand icon */}
                                                <svg
                                                    class={`h-4 w-4 flex-shrink-0 text-base-content/30 transition-transform duration-200 ${
                                                        showTeamScores() ===
                                                        team.id
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

                                            {/* Expanded content */}
                                            <Show
                                                when={
                                                    showTeamScores() ===
                                                    team.id
                                                }
                                            >
                                                <div class="animate-slide-down border-t border-white/5 px-4 pb-4 pt-3 sm:px-6">
                                                    <div class="mb-3 flex items-center gap-2">
                                                        <Link
                                                            to="/user-statistics"
                                                            search={{
                                                                teamId:
                                                                    team.id,
                                                            }}
                                                            class="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                                        >
                                                            📊 User
                                                            statistics
                                                        </Link>
                                                    </div>
                                                    <div class="chart-container !p-2">
                                                        <div class="h-[300px] sm:h-[350px]">
                                                            <TeamUsersScoresGraph
                                                                teamId={
                                                                    team.id
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>
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
