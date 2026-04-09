import { useHistoricalUserActivityPointsQuery } from "~/api/client";
import {
    Accessor,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    Setter,
    Suspense,
    untrack,
} from "solid-js";
import { init as echartsInit, EChartsType } from "echarts";

export function UserStatisticsGraph(props: {
    userId: string;
    endsAt: number;
    startAt: number;
}) {
    // Shared timeWindow state
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

    return (
        <>
            <div class="max-h-96">
                <div class="inline-block text-xl font-semibold">Points</div>
                <Suspense fallback={<div>Loading...</div>}>
                    <UserChart
                        type="points"
                        endsAt={props.endsAt}
                        startAt={props.startAt}
                        userId={props.userId}
                        timeWindow={timeWindow}
                        setTimeWindow={setTimeWindow}
                    />
                </Suspense>
            </div>
            <div class="max-h-96">
                <div class="inline-block text-xl font-semibold">Values</div>
                <Suspense fallback={<div>Loading...</div>}>
                    <UserChart
                        type="values"
                        endsAt={props.endsAt}
                        startAt={props.startAt}
                        userId={props.userId}
                        timeWindow={timeWindow}
                        setTimeWindow={setTimeWindow}
                    />
                </Suspense>
            </div>
        </>
    );
}

function UserChart(props: {
    type: "points" | "values";
    endsAt: number;
    startAt: number;
    userId: string;
    timeWindow: Accessor<{ start: number; end: number }>;
    setTimeWindow: Setter<{ start: number; end: number }>;
}) {
    const [canvasContainer, setCanvasContainer] =
        createSignal<HTMLDivElement>();
    const [chart, setChart] = createSignal<EChartsType>();

    // Only use useHistoricalUserActivityPointsQuery with shared timeWindow values
    const historicalActivityPointsQuery = useHistoricalUserActivityPointsQuery(
        () => props.userId,
        () => props.timeWindow().start,
        () => props.timeWindow().end,
    );

    const statisticsHistoryData = createMemo(() => {
        return (
            historicalActivityPointsQuery.data?.map((a) => ({
                activityName: a.activityId,
                points: a.points,
                timestamp: new Date(a.time).getTime(),
                value: a.value,
            })) ?? []
        );
    });

    const groupedByActivity = createMemo(() => {
        const data = statisticsHistoryData();
        return data.reduce(
            (acc, curr) => {
                if (!acc[curr.activityName]) acc[curr.activityName] = [];
                (acc[curr.activityName] ?? []).push({
                    timestamp: curr.timestamp,
                    points: curr.points,
                    value: curr.value,
                });
                return acc;
            },
            {} as Record<
                string,
                { timestamp: number; points: number; value: number }[]
            >,
        );
    });

    const series = createMemo(() => {
        const grouped = groupedByActivity();
        // Compute max value for each activity
        const activityEntries = Object.entries(grouped).map(
            ([activityName, arr]) => {
                const last =
                    arr.length > 0
                        ? props.type === "points"
                            ? arr[arr.length - 1]?.points
                            : arr[arr.length - 1]?.value
                        : 0;
                return { activityName, arr, last };
            },
        );
        // Sort so higher value activities render last (on top)
        activityEntries.sort((a, b) => (a.last ?? 0) - (b.last ?? 0));
        if (props.type === "points") {
            return activityEntries.map(({ activityName, arr }) => ({
                name: `${activityName} Points`,
                type: "line",
                smooth: true,
                symbolSize: 10,
                data: arr
                    .map((d) => [d.timestamp, d.points])
                    .toSorted((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
            }));
        } else {
            return activityEntries.map(({ activityName, arr }) => ({
                name: `${activityName} Value`,
                type: "line",
                smooth: true,
                symbolSize: 10,
                data: arr
                    .map((d) => [d.timestamp, d.value])
                    .toSorted((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
            }));
        }
    });

    createEffect(() => {
        if (typeof window === "undefined" || !canvasContainer()) return;
        const c = echartsInit(canvasContainer()!, null, { renderer: "canvas" });
        setChart(c);
        // Finicky animation, force resize chart
        setTimeout(() => {
            c.resize();
            setTimeout(() => c.resize(), 0);
        }, 0);
        onCleanup(() => c.dispose());
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        c.setOption({
            legend: {
                inactiveColor: "#777",
                textStyle: {
                    color: "#fff",
                },
            },
            type: "line",
            emphasis: {
                focus: "series",
            },
            tooltip: { trigger: "axis" },
            xAxis: { type: "time", min: xAxisMin(), max: xAxisMax() },
            yAxis: { type: "value", min: "dataMin" },
            grid: { containLabel: true },
        });

        c.on("dataZoom", function () {
            const dz = (c.getOption().dataZoom as any)?.[0];
            if (!dz) return;
            const startTime = Math.floor(dz.startValue);
            const endTime = Math.floor(dz.endValue);
            props.setTimeWindow({ start: startTime, end: endTime });
        });
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        c.setOption({
            series: series() ?? [],
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

    createEffect(() => {
        const updateXAxisMax = () => {
            chart()?.setOption({
                xAxis: {
                    min: xAxisMin(),
                    max: xAxisMax(),
                },
            });
            // Update timeWindow end if it exceeds new xAxisMax
            const tw = props.timeWindow();
            const max = xAxisMax();
            if (tw.end > max) {
                props.setTimeWindow({ start: tw.start, end: max });
            }
        };

        updateXAxisMax();

        const a = new AbortController();
        window.addEventListener("focus", updateXAxisMax, { signal: a.signal });
        onCleanup(() => {
            a.abort();
        });
    });

    createEffect(() => {
        chart()?.setOption({
            dataZoom: [
                {
                    type: "slider",
                    filterMode: "none",
                    startValue: untrack(() => props.timeWindow().start),
                    endValue: untrack(() => props.timeWindow().end),
                    minValueSpan: 5 * 60 * 1000,
                },
                { type: "inside" },
            ],
        });
        // Do not update xAxis min/max here
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        const a = new AbortController();
        window.addEventListener("resize", () => c.resize(), {
            signal: a.signal,
        });
        onCleanup(() => a.abort());
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        c.on("dataZoom", () => {
            const dz = (c.getOption().dataZoom as any)?.[0];
            if (!dz) return;
            const startTime = Math.floor(dz.startValue);
            const endTime = Math.floor(dz.endValue);

            const tw = props.timeWindow();
            if (tw.start !== startTime || tw.end !== endTime) {
                props.setTimeWindow({ start: startTime, end: endTime });
            }
        });
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;

        const dz = (c.getOption().dataZoom as any)?.[0];
        const tw = props.timeWindow();
        if (!dz || dz.startValue !== tw.start || dz.endValue !== tw.end) {
            c.setOption({
                dataZoom: [
                    {
                        type: "slider",
                        filterMode: "none",
                        startValue: tw.start,
                        endValue: tw.end,
                        minValueSpan: 5 * 60 * 1000,
                    },
                    { type: "inside" },
                ],
            });
        }
    });

    return <div class="min-h-96" ref={setCanvasContainer}></div>;
}
