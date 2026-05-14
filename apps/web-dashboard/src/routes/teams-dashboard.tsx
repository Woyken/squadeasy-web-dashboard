import {
    createMemo,
    Show,
    Suspense,
} from "solid-js";
import {
    getHistoricalTeamPointsQueryOptions,
    getMyChallengeQueryOptions,
    getSeasonRankingQueryOptions,
    mergeSeasonTeams,
    useGetUserToken,
    useStoredTeamQueries,
} from "~/api/client";
import { useQuery } from "@tanstack/solid-query";
import { getDefaultHistoricalTimeWindow } from "~/utils/timeRange";
import { useMainUser } from "~/components/MainUserProvider";
import { createFileRoute, Link, redirect } from "@tanstack/solid-router";
import { hasStoredUserTokens } from "~/utils/localStorage";
import { BrutChart, brutTip, brutAxis, brutGrid, brutZoom } from "~/components/BrutChart";

export const Route = createFileRoute("/teams-dashboard")({
    component: TeamsDashboardPage,
    beforeLoad: ({ location }) => {
        if (!hasStoredUserTokens()) {
            throw redirect({ to: "/login", search: { redirect: location.href } });
        }
    },
});

type ChallengePhase = "upcoming" | "active" | "ended";

function TeamsDashboardPage() {
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

    const teamsQuery = useQuery(() =>
        getSeasonRankingQueryOptions(getToken, () => !!mainUser.mainUserId()),
    );
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
        if (phase() !== "ended") return [];
        const liveTeamIds = new Set((teamsQuery.data?.data?.teams ?? []).map((team) => team.id));
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
                  teamsQuery.data?.data?.teams ?? [],
                  storedTeams(),
                  historicalTeamPointsQuery.data ?? [],
              )
            : (teamsQuery.data?.data?.teams
                  .slice()
                  .sort((a, b) => b.points - a.points) ?? []),
    );

    return (
        <main class="mx-auto max-w-[90vw] px-5 pb-20 pt-6 font-mono">
            <div class="mb-6 flex items-center justify-between">
                <div>
                    <h1 class="mb-1 text-2xl font-bold uppercase">TEAMS SCORE PROGRESSION</h1>
                    <div class="inline-block bg-black px-3 py-1 text-sm tracking-widest text-(--color-brut-red)">
                        TOP 10 TEAMS
                    </div>
                </div>
                <Link to="/" class="brut-btn-ghost no-underline">
                    ← LEADERBOARD
                </Link>
            </div>

            <div class="border-2 border-black bg-white p-4">
                <Suspense
                    fallback={
                        <div class="flex h-[60vh] items-center justify-center">
                            <span class="text-sm text-(--color-brut-gray)">LOADING_CHART...</span>
                        </div>
                    }
                >
                    <Show when={startAtTimestamp() && endAtTimestamp()}>
                        <TeamScoreChart
                            phase={phase()}
                            startAt={startAtTimestamp()!}
                            endsAt={endAtTimestamp()!}
                            historicalPoints={historicalTeamPointsQuery.data ?? []}
                            teams={sortedTeams()}
                            currentSnapshotTime={teamsQuery.data?.time ?? Date.now()}
                        />
                    </Show>
                </Suspense>
            </div>
        </main>
    );
}

function TeamScoreChart(props: {
    phase: ChallengePhase;
    endsAt: number;
    historicalPoints: { teamId: string; time: string; points: number }[];
    startAt: number;
    teams: { id: string; name: string; points: number }[];
    currentSnapshotTime: number;
}) {
    const teamColors = [
        "#000", "#ff0000", "#0000ff", "#008800", "#ff8800", "#8800ff",
        "#00aaaa", "#aa0088", "#888", "#446600", "#004488", "#cc4400",
    ];
    const defaultVisibleTeamsCount = 10;

    const chartOptions = createMemo(() => {
        const currentData = props.teams.reduce(
            (acc, t) => { acc[t.id] = t.points; return acc; },
            {} as Record<string, number>,
        );
        const historical = props.historicalPoints;

        const byTeam: Record<string, { t: number; p: number }[]> = {};
        for (const entry of historical) {
            const ts = new Date(entry.time).getTime();
            if (ts < props.startAt || ts > props.endsAt) continue;
            if (!byTeam[entry.teamId]) byTeam[entry.teamId] = [];
            byTeam[entry.teamId]!.push({ t: ts, p: entry.points });
        }
        if (props.phase !== "ended") {
            for (const [teamId, points] of Object.entries(currentData)) {
                if (!byTeam[teamId]) byTeam[teamId] = [];
                byTeam[teamId]!.push({ t: props.currentSnapshotTime, p: points });
            }
        }

        const series = props.teams.map((team, i) => {
            const data = (byTeam[team.id] ?? [])
                .sort((a, b) => a.t - b.t)
                .map((d) => [d.t, d.p]);
            return {
                name: team.name,
                type: "line" as const,
                smooth: false,
                step: "middle" as const,
                data,
                lineStyle: { color: teamColors[i % teamColors.length], width: 2.5 },
                itemStyle: { color: teamColors[i % teamColors.length] },
                symbol: "rect" as const,
                symbolSize: 6,
            };
        });
        const initiallyVisibleTeamNames = new Set(
            props.teams
                .slice()
                .sort((a, b) => b.points - a.points)
                .slice(0, defaultVisibleTeamsCount)
                .map((team) => team.name),
        );
        const legendSelected = Object.fromEntries(
            props.teams.map((team) => [team.name, initiallyVisibleTeamNames.has(team.name)]),
        );

        return {
            backgroundColor: "transparent",
            tooltip: brutTip(),
            legend: {
                textStyle: { color: "#666", fontFamily: "'Space Mono', monospace", fontSize: 11 },
                bottom: 24,
                type: "scroll" as const,
                selected: legendSelected,
            },
            grid: { top: 12, right: 12, bottom: 58, left: 60 },
            xAxis: {
                type: "time" as const,
                min: props.startAt,
                max: props.endsAt,
                ...brutAxis(),
            },
            yAxis: { type: "value" as const, ...brutGrid(), ...brutAxis() },
            series,
            dataZoom: brutZoom(),
        };
    });

    return <BrutChart options={chartOptions()} height="calc(100vh - 250px)" />;
}
