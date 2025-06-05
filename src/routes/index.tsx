import { Title } from "@solidjs/meta";
import {
    createEffect,
    createMemo,
    createSignal,
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

function RouteComponent() {
    const navigate = Route.useNavigate();
    const mainUser = useMainUser();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate({ to: "/login" });
    });

    // If user is not set, will navigate out, this page
    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);
    const endAtTimestamp = createMemo(() => {
        if (!challengeQuery.data || !challengeQuery.data.endAt) return;
        return new Date(challengeQuery.data.endAt).getTime();
    });
    const startAtTimestamp = createMemo(() => {
        if (!challengeQuery.data || !challengeQuery.data.startAt) return;
        return new Date(challengeQuery.data.startAt).getTime();
    });
    const [diffMs, setDiffMs] = createSignal(0);
    createEffect(() => {
        const endAtMs = endAtTimestamp();
        if (endAtMs === undefined) return;

        const interval = setInterval(() => {
            setDiffMs(endAtMs - new Date().getTime());
        }, 1000);
        onCleanup(() => clearInterval(interval));
    });

    const absDiffMs = createMemo(() => Math.abs(diffMs()));
    const sLeft = createMemo(() =>
        Math.floor((absDiffMs() % (60 * 1000)) / 1000)
            .toString()
            .padStart(2, "0"),
    );
    const mLeft = createMemo(() =>
        Math.floor((absDiffMs() % (60 * 60 * 1000)) / (60 * 1000))
            .toString()
            .padStart(2, "0"),
    );
    const hLeft = createMemo(() =>
        Math.floor((absDiffMs() % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
            .toString()
            .padStart(2, "0"),
    );
    const dLeft = createMemo(() =>
        Math.floor(absDiffMs() / (24 * 60 * 60 * 1000))
            .toString()
            .padStart(2, "0"),
    );

    return (
        <main class="flex w-full flex-1 flex-col gap-4 bg-base-200 px-6 pt-4">
            <Title>SquadEasy</Title>
            <div class="mt-2 flex flex-wrap justify-center gap-6">
                <div class="card bg-base-100 shadow-md">
                    <div class="card-body items-center text-center">
                        <h1 class="text-5xl font-bold">Countdown</h1>
                        <div class="grid auto-cols-max grid-flow-col gap-5 text-center">
                            <div class="flex flex-col rounded-box bg-neutral p-2 text-neutral-content">
                                <span class="countdown font-mono text-5xl">
                                    <span style={`--value:${dLeft()};`}></span>
                                </span>
                                days
                            </div>
                            <div class="flex flex-col rounded-box bg-neutral p-2 text-neutral-content">
                                <span class="countdown font-mono text-5xl">
                                    <span style={`--value:${hLeft()};`}></span>
                                </span>
                                hours
                            </div>
                            <div class="flex flex-col rounded-box bg-neutral p-2 text-neutral-content">
                                <span class="countdown font-mono text-5xl">
                                    <span style={`--value:${mLeft()};`}></span>
                                </span>
                                min
                            </div>
                            <div class="flex flex-col rounded-box bg-neutral p-2 text-neutral-content">
                                <span class="countdown font-mono text-5xl">
                                    <span style={`--value:${sLeft()};`}></span>
                                </span>
                                sec
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card bg-base-100 shadow-md">
                    <div class="card-body items-center text-center">
                        <Link to="/users-points" class="text-5xl font-bold">
                            Teams User Scores 🎮
                        </Link>
                    </div>
                </div>
            </div>
            <div class="mt-2 flex flex-1 flex-wrap justify-center gap-6">
                <div class="card max-h-full min-h-96 w-full bg-base-100 shadow-md">
                    <Suspense fallback={<span>Loading...</span>}>
                        <Show when={startAtTimestamp() && endAtTimestamp()}>
                            <CanvasRenderer
                                startAt={startAtTimestamp()!}
                                endsAt={endAtTimestamp()!}
                            ></CanvasRenderer>
                        </Show>
                    </Suspense>
                </div>
            </div>
        </main>
    );
}

function CanvasRenderer(props: { endsAt: number; startAt: number }) {
    const [canvasContainer, setCanvasContainer] =
        createSignal<HTMLDivElement>();

    const navigate = Route.useNavigate();
    const teamsQuery = useSeasonRankingQuery();
    const first20TeamsMetadata = createMemo(() => {
        return {
            timestamp: teamsQuery.data?.time ?? Date.now(),
            data: teamsQuery.data?.data?.teams
                .toSorted((a, b) => b.points - a.points)
                .slice(0, 20),
        };
    });

    const pointStyleImages = [
        "https://cdn3.emoji.gg/emojis/7529_KEKW.png",
        "https://cdn3.emoji.gg/emojis/5163-95-crythumbsup.png",
        "https://cdn3.emoji.gg/emojis/7572-pepe-yes.png",
        "https://cdn3.emoji.gg/emojis/PepeHands.png",
        "https://cdn3.emoji.gg/emojis/3049-pepenosign.png",
        "https://cdn3.emoji.gg/emojis/9378-fuckboi.png",
        "https://cdn3.emoji.gg/emojis/8176-boohoo.png",
        "https://cdn3.emoji.gg/emojis/3416-bonk.png",
        "https://cdn3.emoji.gg/emojis/monkaS.png",
        "https://cdn3.emoji.gg/emojis/7482-uwucat.png",
        "https://cdn3.emoji.gg/emojis/6237-megareverse-1.png",
    ];

    const [timeWindow, setTimeWindow] = createSignal<{
        start: number;
        end: number;
    }>(
        (() => {
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
                    .map((teamId) => {
                        return {
                            teamId,
                            points: teamsPoint[teamId]!,
                            timestamp,
                        };
                    })
                    .filter((x) => !!x)
                    .map((x) => x as NonNullable<typeof x>);
            })
            .flatMap((x) => x)
            .toSorted((a, b) => b.timestamp - a.timestamp)
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
                    data: teamEntries[teamId]!.slice()
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

        // Sort datasets so higher score teams are rendered last
        return dataByTeamId.toSorted((a, b) => {
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

    const createChart = () => {
        if (typeof window === "undefined") return;

        const a = new AbortController();
        onCleanup(() => a.abort());
        window.addEventListener("resize", () => lineChart()?.resize(), {
            signal: a.signal,
        });

        lineChart()?.setOption({
            type: "line",
            tooltip: {
                trigger: "axis",
            },

            xAxis: {
                min: xAxisMin(),
                max: xAxisMax(),
                type: "time",
            },
            yAxis: {
                type: "value",
                min: "dataMin",
            },
            grid: {
                containLabel: true,
            },
            series: datasets().map((x, idx) => ({
                name: x.teamName,
                type: "line",
                endLabel: {
                    show: true,
                    formatter: (params: {
                        seriesName: string;
                        value: number[];
                    }) => {
                        return params.seriesName + ": " + params.value[1];
                    },
                    distance: 20,
                },
                smooth: true,
                emphasis: {
                    focus: "series",
                },
                lineStyle: {
                    width: 4,
                },
                symbolSize: 20,
                symbol: `image://${first20TeamsMetadata().data?.find((f) => f.id === x.teamId)?.image ?? pointStyleImages[idx % pointStyleImages.length]}`,
                data: x.data.map((x) => [x.x, x.y]),
                teamId: x.teamId,
            })),
        });

        // Add click event for navigation
        lineChart()?.on("click", function (params: any) {
            // params.seriesName gives the team name, but we want teamId
            // Find the teamId from the series
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

        lineChart()?.on("dataZoom", function (event) {
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
        // Prepare legend.selected: top 10 enabled, rest disabled
        const allTeams = untrack(() => datasets());
        const top10 = allTeams.slice(-10).map((x) => x.teamName);
        const legendSelected = Object.fromEntries(
            allTeams.map((x) => [x.teamName, top10.includes(x.teamName)]),
        );
        lineChart()?.setOption({
            legend: {
                inactiveColor: "#777",
                textStyle: {
                    color: "#fff",
                },
                selected: legendSelected,
            },
        });
    });

    createEffect(() => createChart());

    createEffect(() => {
        const updateXAxisMax = () => {
            lineChart()?.setOption({
                xAxis: {
                    min: xAxisMin(),
                    max: xAxisMax(),
                },
            });
        };

        updateXAxisMax();

        const a = new AbortController();

        window.addEventListener("focus", updateXAxisMax, { signal: a.signal });

        onCleanup(() => {
            a.abort();
        });
    });

    createEffect(() => {
        lineChart()?.setOption({
            dataZoom: [
                {
                    type: "slider",
                    filterMode: "none",
                    startValue: untrack(() => timeWindow().start),
                    end: 100,
                    minValueSpan: 5 * 60 * 1000, // No point in trying to zoom in more than few minutes
                },
                { type: "inside" },
            ],
        });
    });

    createEffect(() => {
        const c = lineChart();
        onCleanup(() => {
            c?.dispose();
        });
    });

    return <div ref={setCanvasContainer} class="card-body"></div>;
}
