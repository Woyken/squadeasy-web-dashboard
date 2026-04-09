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
import {
    clampRangeToNow,
    getDefaultHistoricalTimeWindow,
} from "~/utils/timeRange";

const chartColors = [
    "#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6",
    "#fb7185", "#f87171", "#fb923c", "#fbbf24", "#34d399",
    "#2dd4bf", "#38bdf8", "#60a5fa", "#a3e635", "#facc15",
];

export function UserStatisticsGraph(props: {
    userId: string;
    endsAt: number;
    startAt: number;
}) {
    const [timeWindow, setTimeWindow] = createSignal<{
        start: number;
        end: number;
    }>(getDefaultHistoricalTimeWindow(props.startAt, props.endsAt));

    return (
        <div class="flex flex-col gap-4">
            <div>
                <h3 class="mb-2 text-sm font-semibold text-base-content/70">
                    📈 Points by Activity
                </h3>
                <div class="chart-container !p-2">
                    <Suspense
                        fallback={
                            <div class="flex h-[250px] items-center justify-center">
                                <span class="loading loading-ring loading-md text-primary"></span>
                            </div>
                        }
                    >
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
            </div>
            <div>
                <h3 class="mb-2 text-sm font-semibold text-base-content/70">
                    📊 Activity Values
                </h3>
                <div class="chart-container !p-2">
                    <Suspense
                        fallback={
                            <div class="flex h-[250px] items-center justify-center">
                                <span class="loading loading-ring loading-md text-primary"></span>
                            </div>
                        }
                    >
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
            </div>
        </div>
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
        activityEntries.sort((a, b) => (a.last ?? 0) - (b.last ?? 0));
        if (props.type === "points") {
            return activityEntries.map(({ activityName, arr }) => ({
                name: `${activityName} Points`,
                type: "line",
                smooth: true,
                symbolSize: 6,
                symbol: "circle",
                lineStyle: { width: 2 },
                data: arr
                    .map((d) => [d.timestamp, d.points])
                    .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
            }));
        } else {
            return activityEntries.map(({ activityName, arr }) => ({
                name: `${activityName} Value`,
                type: "line",
                smooth: true,
                symbolSize: 6,
                symbol: "circle",
                lineStyle: { width: 2 },
                data: arr
                    .map((d) => [d.timestamp, d.value])
                    .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
            }));
        }
    });

    createEffect(() => {
        if (typeof window === "undefined" || !canvasContainer()) return;
        const c = echartsInit(canvasContainer()!, null, { renderer: "canvas" });
        setChart(c);
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
            color: chartColors,
            backgroundColor: "transparent",
            legend: {
                inactiveColor: "rgba(255,255,255,0.15)",
                textStyle: { color: "rgba(224,231,255,0.7)", fontSize: 11 },
            },
            emphasis: { focus: "series" },
            tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(15, 14, 26, 0.95)",
                borderColor: "rgba(255, 255, 255, 0.1)",
                textStyle: { color: "#e0e7ff", fontSize: 12 },
            },
            xAxis: {
                type: "time",
                min: xAxisMin(),
                max: xAxisMax(),
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
        });

        c.on("dataZoom", function () {
            const dz = (c.getOption().dataZoom as any)?.[0];
            if (!dz) return;
            const startTime = Math.floor(dz.startValue);
            const endTime = Math.floor(dz.endValue);
            props.setTimeWindow(clampRangeToNow(startTime, endTime));
        });
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        c.setOption({ series: series() ?? [] });
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
                xAxis: { min: xAxisMin(), max: xAxisMax() },
            });
            const tw = props.timeWindow();
            const nextTimeWindow = clampRangeToNow(
                tw.start,
                tw.end,
                xAxisMax(),
            );
            if (
                tw.start !== nextTimeWindow.start ||
                tw.end !== nextTimeWindow.end
            ) {
                props.setTimeWindow(nextTimeWindow);
            }
        };
        updateXAxisMax();
        const a = new AbortController();
        window.addEventListener("focus", updateXAxisMax, { signal: a.signal });
        onCleanup(() => a.abort());
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
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderColor: "rgba(255,255,255,0.05)",
                    fillerColor: "rgba(129,140,248,0.08)",
                    handleStyle: { color: "#818cf8", borderColor: "#818cf8" },
                    textStyle: { color: "rgba(224,231,255,0.5)" },
                },
                { type: "inside" },
            ],
        });
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
            const nextTimeWindow = clampRangeToNow(startTime, endTime);
            if (
                tw.start !== nextTimeWindow.start ||
                tw.end !== nextTimeWindow.end
            ) {
                props.setTimeWindow(nextTimeWindow);
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

    return (
        <div
            class="h-[250px] w-full sm:h-[300px]"
            ref={setCanvasContainer}
        ></div>
    );
}
