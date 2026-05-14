import {
    createEffect,
    createMemo,
    createSignal,
    For,
    onCleanup,
    Show,
    Suspense,
} from "solid-js";
import {
    getHistoricalTeamPointsQueryOptions,
    getMyChallengeQueryOptions,
    getSeasonRankingInfiniteQueryOptions,
    mergeSeasonTeams,
    useGetUserToken,
    useStoredTeamQueries,
} from "~/api/client";
import { useInfiniteQuery, useQuery } from "@tanstack/solid-query";
import {
    getDefaultHistoricalTimeWindow,
} from "~/utils/timeRange";
import { useMainUser } from "~/components/MainUserProvider";
import { createFileRoute, redirect } from "@tanstack/solid-router";
import { hasStoredUserTokens } from "~/utils/localStorage";

export const Route = createFileRoute("/")({
    component: DashboardPage,
    beforeLoad: ({ location }) => {
        if (!hasStoredUserTokens()) {
            throw redirect({ to: "/login", search: { redirect: location.href } });
        }
    },
});

type ChallengePhase = "upcoming" | "active" | "ended";

function DashboardPage() {
    const navigate = Route.useNavigate();
    const mainUser = useMainUser();

    const getToken = useGetUserToken(mainUser.mainUserId);
    const challengeQuery = useQuery(() =>
        getMyChallengeQueryOptions(mainUser.mainUserId, getToken),
    );

    const endAtTimestamp = createMemo(() => {
        if (!challengeQuery.data?.endAt) return;
        return new Date(challengeQuery.data.endAt).getTime();
    });
    const startAtTimestamp = createMemo(() => {
        if (!challengeQuery.data?.startAt) return;
        return new Date(challengeQuery.data.startAt).getTime();
    });

    const phase = createMemo<ChallengePhase>(() => {
        const start = startAtTimestamp();
        const end = endAtTimestamp();
        if (!start || !end) return "upcoming";
        const now = Date.now();
        if (now < start) return "upcoming";
        if (now >= end) return "ended";
        return "active";
    });

    const countdownTarget = createMemo(() => {
        if (phase() === "upcoming") return startAtTimestamp();
        if (phase() === "active") return endAtTimestamp();
        return undefined;
    });

    const [diffMs, setDiffMs] = createSignal(0);
    createEffect(() => {
        const target = countdownTarget();
        if (target === undefined) return;
        setDiffMs(target - Date.now());
        const interval = setInterval(() => setDiffMs(target - Date.now()), 1000);
        onCleanup(() => clearInterval(interval));
    });

    const absDiffMs = createMemo(() => Math.max(0, diffMs()));
    const pad = (n: number) => n.toString().padStart(2, "0");
    const days = createMemo(() => pad(Math.floor(absDiffMs() / (24 * 60 * 60 * 1000))));
    const hours = createMemo(() => pad(Math.floor((absDiffMs() % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))));
    const minutes = createMemo(() => pad(Math.floor((absDiffMs() % (60 * 60 * 1000)) / (60 * 1000))));
    const seconds = createMemo(() => pad(Math.floor((absDiffMs() % (60 * 1000)) / 1000)));

    const teamsQuery = useInfiniteQuery(() =>
        getSeasonRankingInfiniteQueryOptions(
            getToken,
            () => !!mainUser.mainUserId(),
        ),
    );
    createEffect(() => {
        if (
            !mainUser.mainUserId() ||
            !teamsQuery.hasNextPage ||
            teamsQuery.isFetchingNextPage ||
            teamsQuery.isPending
        ) {
            return;
        }

        void teamsQuery.fetchNextPage();
    });
    const loadedTeams = createMemo(() =>
        teamsQuery.data?.pages.flatMap((page) => page.data.teams) ?? [],
    );
    const totalRankedTeams = createMemo(() =>
        teamsQuery.data?.pages[0]?.data.totalTeams ?? loadedTeams().length,
    );
    const areAllRankingPagesLoaded = createMemo(() => !teamsQuery.hasNextPage);
    const historicalTimeWindow = createMemo(() => {
        const startAt = startAtTimestamp() ?? Date.now() - 86400000;
        const endAt = endAtTimestamp() ?? Date.now();

        return getDefaultHistoricalTimeWindow(startAt, endAt);
    });
    const historicalTeamPointsQuery = useQuery(() =>
        getHistoricalTeamPointsQueryOptions(
            () => historicalTimeWindow().start,
            () => historicalTimeWindow().end,
            getToken,
            () => !!mainUser.mainUserId(),
        ),
    );
    const missingHistoricalTeamIds = createMemo(() => {
        if (phase() !== "ended" || !areAllRankingPagesLoaded()) {
            return [];
        }

        const liveTeamIds = new Set(loadedTeams().map((team) => team.id));
        const trackedTeamIds = new Set(
            (historicalTeamPointsQuery.data ?? []).map((team) => team.teamId),
        );

        return [...trackedTeamIds].filter((teamId) => !liveTeamIds.has(teamId));
    });
    const storedTeamQueries = useStoredTeamQueries(missingHistoricalTeamIds);
    const storedTeams = createMemo(() =>
        storedTeamQueries
            .map((query) => query.data)
            .filter((team): team is NonNullable<typeof team> => !!team),
    );
    const sortedTeams = createMemo(() =>
        phase() === "ended"
            ? mergeSeasonTeams(
                  loadedTeams(),
                  storedTeams(),
                  historicalTeamPointsQuery.data ?? [],
              )
            : (loadedTeams()
                  .slice()
                  .sort((a, b) => b.points - a.points) ?? []),
    );

    const countdownLabel = createMemo(() => {
        if (phase() === "upcoming") return "STARTS IN";
        if (phase() === "active") return "ENDS IN";
        return "CHALLENGE ENDED";
    });

    const pointsGap = createMemo(() => {
        const teams = sortedTeams();
        if (teams.length < 2) return 0;
        return teams[0]!.points - teams[1]!.points;
    });
    const challengeProgress = createMemo(() => {
        const start = startAtTimestamp();
        const end = endAtTimestamp();
        if (!start || !end) return 0;
        if (phase() === "ended") return 100;
        const elapsed = Date.now() - start;
        const total = end - start;
        return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    });
    const maxPoints = createMemo(() => {
        const teams = sortedTeams();
        return teams.length > 0 ? teams[0]!.points : 1;
    });

    return (
        <main class="mx-auto max-w-[92vw] px-4 pb-16 pt-4 font-mono sm:px-6 sm:pt-6">
            {/* Full-width countdown bar */}
            <div class="mb-6 border-[3px] border-black bg-black px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
                <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div class="min-w-0">
                        <Suspense fallback={<div class="h-8 w-60 brut-skeleton" />}>
                            <Show when={challengeQuery.data}>
                                <h1 class="text-lg font-bold uppercase text-white sm:text-xl lg:text-2xl">
                                    {challengeQuery.data?.title}
                                </h1>
                                <p class="mt-1 text-[10px] uppercase tracking-[0.18em] text-(--color-brut-gray) sm:text-xs">
                                    {challengeQuery.data?.tagline}
                                </p>
                            </Show>
                        </Suspense>
                    </div>
                    <div class="flex flex-col items-start gap-3 sm:gap-4 lg:items-end">
                        <span class="text-[10px] tracking-[0.2em] text-(--color-brut-red) sm:text-xs">
                            {countdownLabel()}
                        </span>
                        <Show
                            when={phase() !== "ended"}
                            fallback={
                                <span class="text-lg text-(--color-brut-gray)">
                                    CONCLUDED 🏁
                                </span>
                            }
                        >
                            <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                                <span class="border-b-[3px] border-(--color-brut-red) px-1 py-1 text-center text-3xl font-bold text-(--color-brut-red) sm:min-w-22 sm:text-4xl lg:text-6xl">
                                    {days()}D
                                </span>
                                <span class="border-b-[3px] border-white px-1 py-1 text-center text-3xl font-bold text-white sm:min-w-22 sm:text-4xl lg:text-6xl">
                                    {hours()}H
                                </span>
                                <span class="border-b-[3px] border-white px-1 py-1 text-center text-3xl font-bold text-white sm:min-w-22 sm:text-4xl lg:text-6xl">
                                    {minutes()}M
                                </span>
                                <span class="border-b-[3px] border-white px-1 py-1 text-center text-3xl font-bold text-white sm:min-w-22 sm:text-4xl lg:text-6xl">
                                    {seconds()}S
                                </span>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div class="border-[3px] border-black p-5">
                    <div class="text-[10px] uppercase tracking-widest text-(--color-brut-gray)">TEAMS</div>
                    <div class="mt-1 text-3xl font-bold">{totalRankedTeams()}</div>
                </div>
                <div class="border-[3px] border-black p-5">
                    <div class="text-[10px] uppercase tracking-widest text-(--color-brut-gray)">LEADER GAP</div>
                    <div class="mt-1 text-3xl font-bold text-(--color-brut-red)">+{pointsGap().toLocaleString()}</div>
                </div>
                <div class="border-[3px] border-black p-5">
                    <div class="text-[10px] uppercase tracking-widest text-(--color-brut-gray)">PROGRESS</div>
                    <div class="mt-1 text-3xl font-bold">{challengeProgress()}%</div>
                    <div class="mt-2 h-2 w-full border border-black bg-(--color-brut-light)">
                        <div class="h-full bg-(--color-brut-red)" style={{ width: `${challengeProgress()}%` }} />
                    </div>
                </div>
            </div>

            {/* Top-3 podium */}
            <Suspense fallback={<div class="mb-6 h-40 brut-skeleton border-2 border-black" />}>
                <Show when={sortedTeams().length >= 3}>
                    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <For each={sortedTeams().slice(0, 3)}>
                            {(team, i) => (
                                <div
                                    class="flex cursor-pointer items-center gap-4 border-[3px] border-black p-4 transition-colors hover:bg-[#fafafa] sm:p-5"
                                    onClick={() => navigate({ to: "/users-points", search: { teamId: team.id } })}
                                >
                                    <div class="flex h-14 w-14 shrink-0 items-center justify-center border-[3px] border-(--color-brut-red) text-2xl font-bold text-(--color-brut-red)">
                                        {i() + 1}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                            <Show
                                                when={team.image}
                                                fallback={
                                                    <div class="grid h-9 w-9 shrink-0 place-items-center border-2 border-black bg-black text-xs font-bold text-white">
                                                        {team.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                }
                                            >
                                                <img
                                                    src={team.image!}
                                                    alt={team.name}
                                                    class="h-9 w-9 shrink-0 border-2 border-black object-cover"
                                                />
                                            </Show>
                                            <span class="truncate text-base font-bold uppercase">{team.name}</span>
                                        </div>
                                        <div class="mt-2 text-2xl font-bold">{team.points.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Suspense>

            {/* Full leaderboard with point bars */}
            <div>
                <span class="brut-heading mb-3">LEADERBOARD</span>
                <Suspense
                    fallback={<div class="h-40 border-2 border-black brut-skeleton" />}
                >
                    <Show when={sortedTeams().length > 0}>
                        <>
                            <div class="space-y-3 md:hidden">
                                <For each={sortedTeams()}>
                                    {(team, i) => (
                                        <button
                                            type="button"
                                            class="w-full border-[3px] border-black p-4 text-left transition-colors hover:bg-[#fafafa]"
                                            onClick={() => navigate({ to: "/users-points", search: { teamId: team.id } })}
                                        >
                                            <div class="mb-3 flex items-start justify-between gap-3">
                                                <div class="flex min-w-0 items-center gap-3">
                                                    <div class={`flex h-10 w-10 shrink-0 items-center justify-center border-2 text-sm font-bold ${i() < 3 ? "border-(--color-brut-red) text-(--color-brut-red)" : "border-black text-(--color-brut-gray)"}`}>
                                                        {String(i() + 1).padStart(2, "0")}
                                                    </div>
                                                    <div class="flex min-w-0 items-center gap-3">
                                                        <Show
                                                            when={team.image}
                                                            fallback={
                                                                <div class="grid h-10 w-10 place-items-center border-2 border-black bg-black text-sm font-bold text-white">
                                                                    {team.name.slice(0, 2).toUpperCase()}
                                                                </div>
                                                            }
                                                        >
                                                            <img
                                                                src={team.image!}
                                                                alt={team.name}
                                                                class="h-10 w-10 border-2 border-black object-cover"
                                                            />
                                                        </Show>
                                                        <span class="truncate text-base font-bold uppercase">
                                                            {team.name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span class="text-xl font-bold text-(--color-brut-red)">→</span>
                                            </div>
                                            <div class="flex items-center gap-3">
                                                <div class="h-3 flex-1 border border-black bg-(--color-brut-light)">
                                                    <div
                                                        class="h-full bg-black transition-all"
                                                        style={{ width: `${(team.points / maxPoints()) * 100}%` }}
                                                    />
                                                </div>
                                                <span class="min-w-18 text-right text-base font-bold tabular-nums">
                                                    {team.points.toLocaleString()}
                                                </span>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>

                            <table class="hidden w-full border-collapse font-mono text-base md:table">
                                <thead>
                                    <tr>
                                        <th class="border-b-[3px] border-black px-4 py-3 text-left text-sm tracking-widest text-(--color-brut-gray)">
                                            #
                                        </th>
                                        <th class="border-b-[3px] border-black px-4 py-3 text-left text-sm tracking-widest text-(--color-brut-gray)">
                                            TEAM
                                        </th>
                                        <th class="border-b-[3px] border-black px-4 py-3 text-sm tracking-widest text-(--color-brut-gray)">
                                            POINTS
                                        </th>
                                        <th class="border-b-[3px] border-black px-4 py-3 w-12" />
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={sortedTeams()}>
                                        {(team, i) => (
                                            <tr
                                                class={`cursor-pointer transition-colors hover:bg-[#fafafa] ${i() < 3 ? "border-l-[3px] border-l-(--color-brut-red)" : ""}`}
                                                onClick={() => navigate({ to: "/users-points", search: { teamId: team.id } })}
                                            >
                                                <td class="border-b border-(--color-brut-light) px-4 py-4 text-lg font-bold text-(--color-brut-gray)">
                                                    {String(i() + 1).padStart(2, "0")}
                                                </td>
                                                <td class="border-b border-(--color-brut-light) px-4 py-4">
                                                    <div class="flex items-center gap-3">
                                                        <Show
                                                            when={team.image}
                                                            fallback={
                                                                <div class="grid h-10 w-10 place-items-center border-2 border-black bg-black text-sm font-bold text-white">
                                                                    {team.name.slice(0, 2).toUpperCase()}
                                                                </div>
                                                            }
                                                        >
                                                            <img
                                                                src={team.image!}
                                                                alt={team.name}
                                                                class="h-10 w-10 border-2 border-black object-cover"
                                                            />
                                                        </Show>
                                                        <span class="text-lg font-bold uppercase">
                                                            {team.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td class="border-b border-(--color-brut-light) px-4 py-4">
                                                    <div class="flex items-center gap-3">
                                                        <div class="h-3 flex-1 border border-black bg-(--color-brut-light)">
                                                            <div
                                                                class="h-full bg-black transition-all"
                                                                style={{ width: `${(team.points / maxPoints()) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span class="w-20 text-right text-lg font-bold tabular-nums">
                                                            {team.points.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td class="border-b border-(--color-brut-light) px-4 py-4 text-center text-xl font-bold text-(--color-brut-red)">
                                                    →
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>

                            <Show when={teamsQuery.isFetchingNextPage || teamsQuery.hasNextPage}>
                                <div class="border-x-[3px] border-b-[3px] border-black px-4 py-3 text-center text-xs uppercase tracking-[0.2em] text-(--color-brut-gray)">
                                    LOADING TEAMS {sortedTeams().length}/{totalRankedTeams()}
                                </div>
                            </Show>
                        </>
                    </Show>
                </Suspense>
            </div>
        </main>
    );
}
