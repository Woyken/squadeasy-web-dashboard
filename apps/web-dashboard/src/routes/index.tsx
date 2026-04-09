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
    useHistoricalTeamPointsQuery,
    useMyChallengeQuery,
    useSeasonRankingQuery,
} from "~/api/client";
import {
    getDefaultHistoricalTimeWindow,
} from "~/utils/timeRange";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import { useMainUser } from "~/components/MainUserProvider";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { BrutChart, brutTip, brutAxis, brutGrid, brutZoom } from "~/components/BrutChart";

export const Route = createFileRoute("/")({
    component: DashboardPage,
});

type ChallengePhase = "upcoming" | "active" | "ended";

function DashboardPage() {
    const navigate = Route.useNavigate();
    const mainUser = useMainUser();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate({ to: "/login" });
    });

    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);

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

    const teamsQuery = useSeasonRankingQuery();
    const sortedTeams = createMemo(() =>
        teamsQuery.data?.data?.teams
            .slice()
            .sort((a, b) => b.points - a.points) ?? [],
    );

    const countdownLabel = createMemo(() => {
        if (phase() === "upcoming") return "STARTS IN";
        if (phase() === "active") return "ENDS IN";
        return "CHALLENGE ENDED";
    });

    return (
        <main class="mx-auto max-w-250 px-5 pb-20 pt-6 font-mono">
            {/* Hero grid */}
            <div class="mb-6 grid grid-cols-1 border-[3px] border-black sm:grid-cols-2">
                <div class="border-b-[3px] border-black p-6 sm:border-b-0 sm:border-r-[3px]">
                    <Suspense fallback={<div class="h-16 brut-skeleton" />}>
                        <Show when={challengeQuery.data}>
                            <h1 class="mb-2 text-lg font-bold uppercase leading-tight">
                                {challengeQuery.data?.title}
                            </h1>
                            <p class="text-[11px] uppercase tracking-widest text-(--color-brut-gray)">
                                {challengeQuery.data?.tagline}
                            </p>
                        </Show>
                    </Suspense>
                </div>
                <div class="flex flex-col justify-center p-6">
                    <div class="mb-3 text-[11px] tracking-widest text-(--color-brut-red)">
                        {countdownLabel()}
                    </div>
                    <Show
                        when={phase() !== "ended"}
                        fallback={
                            <span class="text-sm text-(--color-brut-gray)">
                                CHALLENGE CONCLUDED 🏁
                            </span>
                        }
                    >
                        <div class="flex gap-2">
                            <span class="border-b-[3px] border-(--color-brut-red) py-1 text-3xl font-bold text-(--color-brut-red)">
                                {days()}D
                            </span>
                            <span class="border-b-[3px] border-black py-1 text-3xl font-bold">
                                {hours()}H
                            </span>
                            <span class="border-b-[3px] border-black py-1 text-3xl font-bold">
                                {minutes()}M
                            </span>
                            <span class="border-b-[3px] border-black py-1 text-3xl font-bold">
                                {seconds()}S
                            </span>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Score progression chart */}
            <div class="mb-6">
                <span class="brut-heading mb-2">SCORE_PROGRESSION</span>
                <div class="border-2 border-black bg-white p-3">
                    <Suspense
                        fallback={
                            <div class="flex h-85 items-center justify-center">
                                <span class="text-xs text-(--color-brut-gray)">LOADING_CHART...</span>
                            </div>
                        }
                    >
                        <Show when={startAtTimestamp() && endAtTimestamp()}>
                            <TeamScoreChart
                                startAt={startAtTimestamp()!}
                                endsAt={endAtTimestamp()!}
                            />
                        </Show>
                    </Suspense>
                </div>
            </div>

            {/* Leaderboard table */}
            <div class="mb-6">
                <span class="brut-heading mb-2">LEADERBOARD</span>
                <Suspense
                    fallback={<div class="h-40 border-2 border-black brut-skeleton" />}
                >
                    <Show when={sortedTeams().length > 0}>
                        <table class="w-full border-collapse font-mono text-xs">
                            <thead>
                                <tr>
                                    <th class="border-b-[3px] border-black px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                        #
                                    </th>
                                    <th class="border-b-[3px] border-black px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                        TEAM
                                    </th>
                                    <th class="border-b-[3px] border-black px-3 py-2 text-right text-[10px] tracking-widest text-(--color-brut-gray)">
                                        PTS
                                    </th>
                                    <th class="border-b-[3px] border-black px-3 py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                <For each={sortedTeams()}>
                                    {(team, i) => (
                                        <tr
                                            class={`cursor-pointer transition-colors hover:bg-[#fafafa] ${i() < 3 ? "border-l-[3px] border-l-(--color-brut-red)" : ""}`}
                                        >
                                            <td class="border-b border-(--color-brut-light) px-3 py-2.5 font-bold text-(--color-brut-gray)">
                                                {String(i() + 1).padStart(2, "0")}
                                            </td>
                                            <td class="border-b border-(--color-brut-light) px-3 py-2.5">
                                                <Link
                                                    to="/users-points"
                                                    search={{ teamId: team.id }}
                                                    class="flex items-center gap-2 no-underline text-black"
                                                >
                                                    <Show
                                                        when={team.image}
                                                        fallback={
                                                            <div class="grid h-7 w-7 place-items-center border-2 border-black bg-black text-[10px] font-bold text-white">
                                                                {team.name.slice(0, 2).toUpperCase()}
                                                            </div>
                                                        }
                                                    >
                                                        <img
                                                            src={team.image!}
                                                            alt={team.name}
                                                            class="h-7 w-7 border-2 border-black object-cover"
                                                        />
                                                    </Show>
                                                    <span class="font-bold uppercase">
                                                        {team.name}
                                                    </span>
                                                </Link>
                                            </td>
                                            <td class="border-b border-(--color-brut-light) px-3 py-2.5 text-right font-bold">
                                                {team.points.toLocaleString()}
                                            </td>
                                            <td class="border-b border-(--color-brut-light) px-3 py-2.5 text-center font-bold text-(--color-brut-red)">
                                                <Link
                                                    to="/users-points"
                                                    search={{ teamId: team.id }}
                                                    class="no-underline text-(--color-brut-red)"
                                                >
                                                    →
                                                </Link>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </Show>
                </Suspense>
            </div>
        </main>
    );
}

function TeamScoreChart(props: { endsAt: number; startAt: number }) {
    const teamsQuery = useSeasonRankingQuery();
    const teamsMetadata = createMemo(() => {
        return {
            timestamp: teamsQuery.data?.time ?? Date.now(),
            data: teamsQuery.data?.data?.teams.slice().sort((a, b) => b.points - a.points),
        };
    });

    const timeWindow = createMemo(() =>
        getDefaultHistoricalTimeWindow(props.startAt, props.endsAt),
    );

    const historicalQuery = useHistoricalTeamPointsQuery(
        () => timeWindow().start,
        () => timeWindow().end,
    );

    const teamColors = [
        "#000", "#ff0000", "#0000ff", "#008800", "#ff8800", "#8800ff",
        "#00aaaa", "#aa0088", "#888", "#446600", "#004488", "#cc4400",
    ];

    const chartOptions = createMemo(() => {
        const meta = teamsMetadata();
        const currentData = meta.data?.reduce(
            (acc, t) => { acc[t.id] = t.points; return acc; },
            {} as Record<string, number>,
        );
        const historical = historicalQuery.data ?? [];

        // Build per-team data series
        const byTeam: Record<string, { t: number; p: number }[]> = {};
        for (const entry of historical) {
            const ts = new Date(entry.time).getTime();
            if (ts < props.startAt || ts > props.endsAt) continue;
            if (!byTeam[entry.teamId]) byTeam[entry.teamId] = [];
            byTeam[entry.teamId]!.push({ t: ts, p: entry.points });
        }
        // Add current points
        if (currentData) {
            for (const [teamId, points] of Object.entries(currentData)) {
                if (!byTeam[teamId]) byTeam[teamId] = [];
                byTeam[teamId]!.push({ t: meta.timestamp, p: points });
            }
        }

        const series = (meta.data ?? []).map((team, i) => {
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

        return {
            backgroundColor: "transparent",
            tooltip: brutTip(),
            legend: {
                textStyle: { color: "#666", fontFamily: "'Space Mono', monospace", fontSize: 9 },
                bottom: 24,
                type: "scroll" as const,
            },
            grid: { top: 12, right: 12, bottom: 58, left: 50 },
            xAxis: {
                type: "time" as const,
                min: props.startAt,
                max: Math.min(props.endsAt, Date.now()),
                ...brutAxis(),
            },
            yAxis: { type: "value" as const, ...brutGrid(), ...brutAxis() },
            series,
            dataZoom: brutZoom(),
        };
    });

    return <BrutChart options={chartOptions()} height="340px" />;
}
