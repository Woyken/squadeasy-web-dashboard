import {
    useHistoricalUserPointsQueries,
    useMyChallengeQuery,
    useTeamQuery,
} from "~/api/client";
import {
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    Show,
    untrack,
} from "solid-js";
import { getUserDisplayName } from "~/getUserDisplayName";
import { init as echartsInit } from "echarts";
import { useMainUser } from "./MainUserProvider";
import { useNavigate } from "@solidjs/router";

export function TeamUsersScoresGraph(props: { teamId: string }) {
    const teamQuery = useTeamQuery(() => props.teamId);

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
        <Show when={startAtTimestamp() && endAtTimestamp()}>
            <Show when={teamQuery.data}>
                {(team) => (
                    <CanvasRenderer
                        endsAt={endAtTimestamp()!}
                        startAt={startAtTimestamp()!}
                        users={team().users.map((x) => ({
                            email: x.id,
                            firstName: x.firstName,
                            lastName: x.lastName,
                            id: x.id,
                        }))}
                    />
                )}
            </Show>
        </Show>
    );
}

function CanvasRenderer(props: {
    users: { id: string; firstName: string; lastName: string; email: string }[];
    endsAt: number;
    startAt: number;
}) {
    const [canvasContainer, setCanvasContainer] =
        createSignal<HTMLDivElement>();
    const navigate = useNavigate(); // Add navigate for programmatic routing

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

    const historicalQueries = useHistoricalUserPointsQueries(
        () => props.users.map((x) => x.id),
        () => timeWindow().start,
        () => timeWindow().end,
    );

    const usersScoresDataFlat = createMemo(() =>
        historicalQueries.flatMap((query) => query.data ?? []),
    );

    createEffect(() => {
        console.log("usersScoresDataFlat.len", usersScoresDataFlat().length);
    });

    const usersScoreData = createMemo(() => {
        const usersScoreData = usersScoresDataFlat();
        if (!usersScoreData) return {};
        const grouped = usersScoreData.reduce(
            (acc, curr) => {
                acc[curr.userId] = acc[curr.userId] ?? [];
                acc[curr.userId]?.push({
                    timestamp: new Date(curr.time).getTime(),
                    points: curr.points,
                });
                return acc;
            },
            {} as Record<string, { timestamp: number; points: number }[]>,
        );
        return grouped;
    });

    // Get user display names
    const userDisplayNames = createMemo(() => {
        // Try to get from TeamScoreTracker or fallback to userId
        return props.users.reduce(
            (acc, user) => {
                acc[user.id] =
                    getUserDisplayName({
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    }) ?? user.email;
                return acc;
            },
            {} as Record<string, string>,
        );
    });

    const datasets = createMemo(() => {
        const grouped = usersScoreData();
        // For each user, get their data and last point
        const usersWithLast = props.users.map((user) => {
            const data = grouped[user.id] ?? [];
            const last = data.length > 0 ? data[data.length - 1]?.points : 0;
            return { id: user.id, data, last };
        });
        // Sort so higher score users render last (on top)
        usersWithLast.sort((a, b) => (a.last ?? 0) - (b.last ?? 0));
        return usersWithLast;
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

    createEffect(() => {
        const sortedDatasets = datasets();

        const t = setTimeout(() => {
            lineChart()?.setOption({
                series: sortedDatasets.map((x, idx) => ({
                    name: userDisplayNames()[x.id] || x.id,
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
                    symbolSize: 10,
                    itemStyle: {},
                    data: x.data.map((d) => [d.timestamp, d.points]),
                    userId: x.id, // Attach userId for click event
                })),
            });
        }, 100);
        onCleanup(() => clearTimeout(t));
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
                trigger: "item",
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
        });

        // Add click event for navigation to user statistics
        lineChart()?.on("click", function (params: any) {
            // params.seriesName gives the user display name
            // Find the userId from the series
            const user = props.users.find(
                (u) => userDisplayNames()[u.id] === params.seriesName,
            );
            if (user) {
                // Find teamId from URL or props if needed
                const urlParams = new URLSearchParams(window.location.search);
                const teamId = urlParams.get("teamId");
                if (teamId) {
                    navigate(
                        `/user-statistics?teamId=${teamId}&userId=${user.id}`,
                    );
                }
            }
        });

        onCleanup(() => {
            lineChart()?.off("dataZoom");
            lineChart()?.off("finished");
        });

        lineChart()?.on("finished", () => {
            const dz = (lineChart()?.getOption().dataZoom as any)?.[0];
            if (!dz) return;
            const startTime = Math.floor(dz.startValue);
            const endTime = Math.floor(dz.endValue);
            setTimeWindow({ start: startTime, end: endTime });
        });

        lineChart()?.on("dataZoom", function () {
            const dz = (lineChart()?.getOption().dataZoom as any)?.[0];
            if (!dz) return;
            const startTime = Math.floor(dz.startValue);
            const endTime = Math.floor(dz.endValue);
            setTimeWindow({ start: startTime, end: endTime });
        });

        return lineChart;
    };

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

    return <div class="min-h-96" ref={setCanvasContainer}></div>;
}
