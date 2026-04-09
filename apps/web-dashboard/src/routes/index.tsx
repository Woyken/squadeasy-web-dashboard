import { Title } from "@solidjs/meta";
import {
    createEffect,
    createMemo,
    createSignal,
    For,
    onCleanup,
    Show,
    Suspense,
    untrack,
} from "solid-js";
import {
    useHistoricalTeamPointsQuery,
    useMyChallengeQuery,
    useSeasonRankingQuery,
} from "~/api/client";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import { useMainUser } from "~/components/MainUserProvider";
import { init as echartsInit } from "echarts";
import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
    component: RouteComponent,
});

type ChallengePhase = "upcoming" | "active" | "ended";

function RouteComponent() {
    const navigate = Route.useNavigate();
    const mainUser = useMainUser();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate({ to: "/login" });
    });

    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);

    const endAtTimestamp = createMemo(() => {
        if (!challengeQuery.data || !challengeQuery.data.endAt) return;
        return new Date(challengeQuery.data.endAt).getTime();
    });
    const startAtTimestamp = createMemo(() => {
        if (!challengeQuery.data || !challengeQuery.data.startAt) return;
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

    // Countdown target: if upcoming → startAt, if active → endAt
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
        const interval = setInterval(() => {
            setDiffMs(target - Date.now());
        }, 1000);
        onCleanup(() => clearInterval(interval));
    });

    const absDiffMs = createMemo(() => Math.max(0, diffMs()));
    const days = createMemo(() =>
        Math.floor(absDiffMs() / (24 * 60 * 60 * 1000))
            .toString()
            .padStart(2, "0"),
    );
    const hours = createMemo(() =>
        Math.floor((absDiffMs() % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
            .toString()
            .padStart(2, "0"),
    );
    const minutes = createMemo(() =>
        Math.floor((absDiffMs() % (60 * 60 * 1000)) / (60 * 1000))
            .toString()
            .padStart(2, "0"),
    );
    const seconds = createMemo(() =>
        Math.floor((absDiffMs() % (60 * 1000)) / 1000)
            .toString()
            .padStart(2, "0"),
    );

    // Team rankings for leaderboard
    const teamsQuery = useSeasonRankingQuery();
    const sortedTeams = createMemo(() =>
        teamsQuery.data?.data?.teams
            .slice()
            .sort((a, b) => b.points - a.points) ?? [],
    );

    const countdownLabel = createMemo(() => {
        if (phase() === "upcoming") return "Challenge starts in";
        if (phase() === "active") return "Challenge ends in";
        return "Challenge has ended";
    });

    const phaseColor = createMemo(() => {
        if (phase() === "upcoming") return "text-info";
        if (phase() === "active") return "text-success";
        return "text-base-content/50";
    });

    const phasePill = createMemo(() => {
        if (phase() === "upcoming") return "upcoming";
        if (phase() === "active") return "active";
        return "ended";
    });

    return (
        <main class="flex w-full flex-1 flex-col bg-base-200 bg-grid">
            <Title>SquadEasy Dashboard</Title>

            {/* Hero / Countdown Section */}
            <div class="relative overflow-hidden">
                <div class="bg-glow absolute inset-0" />
                <div class="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
                    {/* Challenge title & status */}
                    <div class="mb-6 flex flex-col items-center gap-3 text-center animate-fade-in">
                        <Show when={challengeQuery.data}>
                            <h1 class="text-2xl font-extrabold tracking-tight text-base-content sm:text-4xl glow-text">
                                {challengeQuery.data?.title}
                            </h1>
                            <p class="max-w-lg text-sm text-base-content/50">
                                {challengeQuery.data?.tagline}
                            </p>
                        </Show>
                        <span class={`status-pill ${phasePill()}`}>
                            <span
                                class={`inline-block h-1.5 w-1.5 rounded-full ${
                                    phase() === "active"
                                        ? "bg-success animate-pulse"
                                        : phase() === "upcoming"
                                          ? "bg-info"
                                          : "bg-base-content/30"
                                }`}
                            />
                            {phase() === "active"
                                ? "Live"
                                : phase() === "upcoming"
                                  ? "Upcoming"
                                  : "Ended"}
                        </span>
                    </div>

                    {/* Countdown */}
                    <Show when={phase() !== "ended"}>
                        <div class="animate-fade-in-up text-center">
                            <p
                                class={`mb-4 text-xs font-medium uppercase tracking-widest ${phaseColor()}`}
                            >
                                {countdownLabel()}
                            </p>
                            <div class="flex items-center justify-center gap-2 sm:gap-4">
                                <div class="countdown-box">
                                    <span class="digit">{days()}</span>
                                    <span class="unit">days</span>
                                </div>
                                <span class="text-2xl font-light text-base-content/20 sm:text-3xl">
                                    :
                                </span>
                                <div class="countdown-box">
                                    <span class="digit">{hours()}</span>
                                    <span class="unit">hours</span>
                                </div>
                                <span class="text-2xl font-light text-base-content/20 sm:text-3xl">
                                    :
                                </span>
                                <div class="countdown-box">
                                    <span class="digit">{minutes()}</span>
                                    <span class="unit">min</span>
                                </div>
                                <span class="text-2xl font-light text-base-content/20 sm:text-3xl">
                                    :
                                </span>
                                <div class="countdown-box">
                                    <span class="digit">{seconds()}</span>
                                    <span class="unit">sec</span>
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={phase() === "ended"}>
                        <div class="animate-fade-in text-center">
                            <p class="text-lg text-base-content/50">
                                The challenge has concluded 🏁
                            </p>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Content */}
            <div class="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 sm:px-6">
                {/* Leaderboard + Stats Row */}
                <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Top 3 Podium */}
                    <div class="lg:col-span-2">
                        <h2 class="section-header mb-4">Leaderboard</h2>
                        <Suspense
                            fallback={
                                <div class="glass-card flex h-48 items-center justify-center">
                                    <span class="loading loading-ring loading-lg text-primary"></span>
                                </div>
                            }
                        >
                            <Show when={sortedTeams().length > 0}>
                                {/* Podium - top 3 */}
                                <div class="mb-4 grid grid-cols-3 gap-3">
                                    <For
                                        each={sortedTeams().slice(0, 3)}
                                    >
                                        {(team, idx) => (
                                            <Link
                                                to="/users-points"
                                                search={{
                                                    teamId: team.id,
                                                }}
                                                class="podium-card"
                                            >
                                                <div
                                                    class={`rank-badge mb-2 ${
                                                        idx() === 0
                                                            ? "gold"
                                                            : idx() === 1
                                                              ? "silver"
                                                              : "bronze"
                                                    }`}
                                                >
                                                    {idx() + 1}
                                                </div>
                                                <Show
                                                    when={team.image}
                                                    fallback={
                                                        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-neutral text-lg font-bold text-neutral-content">
                                                            {team.name.slice(
                                                                0,
                                                                2,
                                                            )}
                                                        </div>
                                                    }
                                                >
                                                    <img
                                                        src={team.image!}
                                                        alt={team.name}
                                                        class="h-12 w-12 rounded-full object-cover ring-2 ring-white/10"
                                                    />
                                                </Show>
                                                <span class="mt-2 line-clamp-1 text-center text-xs font-semibold sm:text-sm">
                                                    {team.name}
                                                </span>
                                                <span class="text-lg font-bold text-primary">
                                                    {team.points.toLocaleString()}
                                                </span>
                                                <span class="text-[10px] uppercase tracking-wider text-base-content/40">
                                                    points
                                                </span>
                                            </Link>
                                        )}
                                    </For>
                                </div>

                                {/* Rest of teams list */}
                                <Show when={sortedTeams().length > 3}>
                                    <div class="glass-card divide-y divide-white/5">
                                        <For
                                            each={sortedTeams().slice(
                                                3,
                                                10,
                                            )}
                                        >
                                            {(team, idx) => (
                                                <Link
                                                    to="/users-points"
                                                    search={{
                                                        teamId: team.id,
                                                    }}
                                                    class="table-row-interactive flex items-center gap-3 px-4 py-3"
                                                >
                                                    <span class="w-6 text-center text-sm font-medium text-base-content/40">
                                                        {idx() + 4}
                                                    </span>
                                                    <Show
                                                        when={team.image}
                                                        fallback={
                                                            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-neutral text-xs font-bold text-neutral-content">
                                                                {team.name.slice(
                                                                    0,
                                                                    2,
                                                                )}
                                                            </div>
                                                        }
                                                    >
                                                        <img
                                                            src={team.image!}
                                                            alt={team.name}
                                                            class="h-8 w-8 rounded-full object-cover"
                                                        />
                                                    </Show>
                                                    <span class="min-w-0 flex-1 truncate text-sm font-medium">
                                                        {team.name}
                                                    </span>
                                                    <span class="text-sm font-semibold text-primary">
                                                        {team.points.toLocaleString()}
                                                    </span>
                                                </Link>
                                            )}
                                        </For>
                                        <Show
                                            when={sortedTeams().length > 10}
                                        >
                                            <Link
                                                to="/users-points"
                                                class="flex items-center justify-center py-3 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                                            >
                                                View all{" "}
                                                {sortedTeams().length}{" "}
                                                teams →
                                            </Link>
                                        </Show>
                                    </div>
                                </Show>
                            </Show>
                        </Suspense>
                    </div>

                    {/* Quick Stats Sidebar */}
                    <div class="flex flex-col gap-4">
                        <h2 class="section-header">Quick Stats</h2>
                        <Suspense>
                            <Show when={sortedTeams().length > 0}>
                                <div class="stat-card">
                                    <span class="stat-label">
                                        Total teams
                                    </span>
                                    <span class="stat-value">
                                        {sortedTeams().length}
                                    </span>
                                </div>
                                <div class="stat-card">
                                    <span class="stat-label">
                                        Leading team
                                    </span>
                                    <span class="stat-value text-lg">
                                        {sortedTeams()[0]?.name}
                                    </span>
                                    <span class="text-sm text-base-content/50">
                                        {sortedTeams()[0]?.points.toLocaleString()}{" "}
                                        pts
                                    </span>
                                </div>
                                <div class="stat-card">
                                    <span class="stat-label">
                                        Total points
                                    </span>
                                    <span class="stat-value">
                                        {sortedTeams()
                                            .reduce(
                                                (sum, t) => sum + t.points,
                                                0,
                                            )
                                            .toLocaleString()}
                                    </span>
                                </div>
                                <Show when={challengeQuery.data?.startAt}>
                                    <div class="stat-card">
                                        <span class="stat-label">
                                            Challenge period
                                        </span>
                                        <span class="text-sm font-medium text-base-content/80">
                                            {new Date(
                                                challengeQuery.data!.startAt,
                                            ).toLocaleDateString()}{" "}
                                            →{" "}
                                            {new Date(
                                                challengeQuery.data!.endAt,
                                            ).toLocaleDateString()}
                                        </span>
                                    </div>
                                </Show>
                            </Show>
                        </Suspense>
                    </div>
                </div>

                {/* Team Scores Chart */}
                <div>
                    <h2 class="section-header mb-4">
                        Team Score Progression
                    </h2>
                    <div class="chart-container">
                        <Suspense
                            fallback={
                                <div class="flex h-[400px] items-center justify-center">
                                    <span class="loading loading-ring loading-lg text-primary"></span>
                                </div>
                            }
                        >
                            <Show
                                when={
                                    startAtTimestamp() && endAtTimestamp()
                                }
                            >
                                <TeamScoreChart
                                    startAt={startAtTimestamp()!}
                                    endsAt={endAtTimestamp()!}
                                />
                            </Show>
                        </Suspense>
                    </div>
                </div>
            </div>
        </main>
    );
}

function TeamScoreChart(props: { endsAt: number; startAt: number }) {
    const [canvasContainer, setCanvasContainer] =
        createSignal<HTMLDivElement>();

    const navigate = Route.useNavigate();
    const teamsQuery = useSeasonRankingQuery();
    const first20TeamsMetadata = createMemo(() => {
        return {
            timestamp: teamsQuery.data?.time ?? Date.now(),
            data: teamsQuery.data?.data?.teams
                .slice()
                .sort((a, b) => b.points - a.points),
        };
    });

    const [timeWindow, setTimeWindow] = createSignal<{
        start: number;
        end: number;
    }>(
        (() => {
            const now = Date.now();
            if (now < props.startAt || now >= props.endsAt) {
                return { start: props.startAt, end: props.endsAt };
            }
            const end = Date.now();
            const start = end - 24 * 60 * 60 * 1000;
            return { start, end };
        })(),
    );

    const historicalQuery = useHistoricalTeamPointsQuery(
        () => timeWindow().start,
        () => timeWindow().end,
    );

    const datasets = createMemo(() => {
        const first20Teams = first20TeamsMetadata();
        const currentTempData = first20Teams.data?.reduce(
            (acc, curr) => {
                acc.teamsData[curr.id] = curr.points;
                return acc;
            },
            {
                timestamp: first20Teams.timestamp,
                teamsData: {} as Record<string, number>,
            },
        );
        const historicalData = historicalQuery.data?.map((x) => ({
            timestamp: new Date(x.time).getTime(),
            teamsData: { [x.teamId]: x.points },
        }));
        const teamEntries = (
            !!currentTempData
                ? (historicalData ?? []).concat(currentTempData)
                : (historicalData ?? [])
        )
            .map((teamData) => {
                const timestamp = teamData.timestamp;
                const teamsPoint = teamData.teamsData;
                return Object.keys(teamsPoint)
                    .map((teamId) => ({
                        teamId,
                        points: teamsPoint[teamId]!,
                        timestamp,
                    }))
                    .filter((x) => !!x);
            })
            .flatMap((x) => x)
            .filter(
                (x) =>
                    x.timestamp >= props.startAt && x.timestamp <= props.endsAt,
            )
            .sort((a, b) => b.timestamp - a.timestamp)
            .reduce(
                (acc, curr) => {
                    const existing = acc[curr.teamId];
                    if (existing) {
                        existing.push({
                            points: curr.points,
                            timestamp: curr.timestamp,
                        });
                        return acc;
                    }
                    acc[curr.teamId] = [
                        {
                            points: curr.points,
                            timestamp: curr.timestamp,
                        },
                    ];
                    return acc;
                },
                {} as Record<string, { timestamp: number; points: number }[]>,
            );
        const dataByTeamId = Object.keys(teamEntries)
            .map((teamId) => {
                const teamMetadata = first20TeamsMetadata().data?.find(
                    (x) => x.id === teamId,
                );
                if (!teamMetadata) return;
                return {
                    teamId,
                    data: teamEntries[teamId]!
                        .slice()
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .map((entry) => ({
                            x: entry.timestamp,
                            y: entry.points,
                        })),
                    teamName: teamMetadata.name,
                };
            })
            .filter((x) => !!x)
            .map((x) => x as NonNullable<typeof x>);

        return dataByTeamId.sort((a, b) => {
            const aLast = a.data[a.data.length - 1]?.y ?? 0;
            const bLast = b.data[b.data.length - 1]?.y ?? 0;
            return aLast - bLast;
        });
    });

    const xAxisMin = createMemo(() => new Date(props.startAt).getTime());
    const [xAxisMax, setXAxisMaxDateNow] = createSignal(Date.now());
    createEffect(() => {
        if (props.endsAt <= Date.now()) setXAxisMaxDateNow(props.endsAt);
        else setXAxisMaxDateNow(Date.now());
        const i = setInterval(() => {
            if (props.endsAt <= Date.now()) setXAxisMaxDateNow(props.endsAt);
            else setXAxisMaxDateNow(Date.now());
        }, 60 * 1000);
        onCleanup(() => clearInterval(i));
    });

    const [lineChart, setLineChart] = createSignal<echarts.ECharts>();
    createEffect(() => {
        const l =
            typeof window !== "undefined" && canvasContainer()
                ? echartsInit(canvasContainer()!, null, {
                      renderer: "canvas",
                  })
                : undefined;
        if (l) setLineChart(l);
    });

    const chartColors = [
        "#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6",
        "#fb7185", "#f87171", "#fb923c", "#fbbf24", "#34d399",
        "#2dd4bf", "#38bdf8", "#60a5fa", "#a3e635", "#facc15",
    ];

    const createChart = () => {
        if (typeof window === "undefined") return;

        const a = new AbortController();
        onCleanup(() => a.abort());
        window.addEventListener("resize", () => lineChart()?.resize(), {
            signal: a.signal,
        });

        lineChart()?.setOption({
            color: chartColors,
            backgroundColor: "transparent",
            tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(15, 14, 26, 0.95)",
                borderColor: "rgba(255, 255, 255, 0.1)",
                textStyle: { color: "#e0e7ff", fontSize: 12 },
                axisPointer: {
                    lineStyle: { color: "rgba(129, 140, 248, 0.3)" },
                },
            },
            xAxis: {
                min: xAxisMin(),
                max: xAxisMax(),
                type: "time",
                axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
                axisLabel: { color: "rgba(224,231,255,0.5)", fontSize: 11 },
                splitLine: { show: false },
            },
            yAxis: {
                type: "value",
                min: "dataMin",
                axisLine: { show: false },
                axisLabel: { color: "rgba(224,231,255,0.5)", fontSize: 11 },
                splitLine: {
                    lineStyle: { color: "rgba(255,255,255,0.04)" },
                },
            },
            grid: {
                containLabel: true,
                left: 10,
                right: 10,
                top: 40,
                bottom: 60,
            },
            series: datasets().map((x, idx) => ({
                name: x.teamName,
                type: "line",
                endLabel: {
                    show: true,
                    formatter: (params: {
                        seriesName: string;
                        value: number[];
                    }) => params.seriesName + ": " + params.value[1],
                    distance: 20,
                    fontSize: 11,
                    color: chartColors[idx % chartColors.length],
                },
                smooth: true,
                emphasis: { focus: "series" },
                lineStyle: { width: 2.5 },
                symbolSize: 6,
                symbol: "circle",
                data: x.data.map((d) => [d.x, d.y]),
                teamId: x.teamId,
            })),
        });

        lineChart()?.on("click", function (params: any) {
            const team = datasets().find(
                (t) => t.teamName === params.seriesName,
            );
            if (team) {
                navigate({
                    to: `/users-points`,
                    search: { teamId: team.teamId },
                });
            }
        });

        onCleanup(() => {
            lineChart()?.off("dataZoom");
        });

        lineChart()?.on("finished", () => {
            const startTime = Math.floor(
                (lineChart()?.getOption().dataZoom as any)[0].startValue,
            );
            const endTime = Math.floor(
                (lineChart()?.getOption().dataZoom as any)[0].endValue,
            );
            setTimeWindow({ start: startTime, end: endTime });
        });

        lineChart()?.on("dataZoom", function () {
            const startTime = Math.floor(
                (lineChart()?.getOption().dataZoom as any)[0].startValue,
            );
            const endTime = Math.floor(
                (lineChart()?.getOption().dataZoom as any)[0].endValue,
            );
            setTimeWindow({ start: startTime, end: endTime });
        });

        return lineChart;
    };

    createEffect(() => {
        const allTeams = untrack(() => datasets());
        let legendSelected:
            | { [k: string]: boolean }
            | undefined = undefined;

        const now = Date.now();
        if (now >= props.startAt && now < props.endsAt) {
            const top10 = allTeams.slice(-10).map((x) => x.teamName);
            legendSelected = Object.fromEntries(
                allTeams.map((x) => [
                    x.teamName,
                    top10.includes(x.teamName),
                ]),
            );
        }
        lineChart()?.setOption({
            legend: {
                type: "scroll",
                inactiveColor: "rgba(255,255,255,0.15)",
                textStyle: { color: "rgba(224,231,255,0.7)", fontSize: 11 },
                pageTextStyle: { color: "rgba(224,231,255,0.5)" },
                pageIconColor: "#818cf8",
                pageIconInactiveColor: "rgba(255,255,255,0.15)",
                selected: legendSelected,
            },
        });
    });

    createEffect(() => createChart());

    createEffect(() => {
        const updateXAxisMax = () => {
            lineChart()?.setOption({
                xAxis: { min: xAxisMin(), max: xAxisMax() },
            });
        };
        updateXAxisMax();
        const a = new AbortController();
        window.addEventListener("focus", updateXAxisMax, { signal: a.signal });
        onCleanup(() => a.abort());
    });

    createEffect(() => {
        lineChart()?.setOption({
            dataZoom: [
                {
                    type: "slider",
                    filterMode: "none",
                    startValue: untrack(() => timeWindow().start),
                    end: 100,
                    minValueSpan: 5 * 60 * 1000,
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderColor: "rgba(255,255,255,0.05)",
                    fillerColor: "rgba(129,140,248,0.08)",
                    handleStyle: { color: "#818cf8", borderColor: "#818cf8" },
                    dataBackground: {
                        lineStyle: { color: "rgba(129,140,248,0.3)" },
                        areaStyle: { color: "rgba(129,140,248,0.05)" },
                    },
                    textStyle: { color: "rgba(224,231,255,0.5)" },
                },
                { type: "inside" },
            ],
        });
    });

    createEffect(() => {
        const c = lineChart();
        onCleanup(() => c?.dispose());
    });

    return <div ref={setCanvasContainer} class="chart-inner"></div>;
}
