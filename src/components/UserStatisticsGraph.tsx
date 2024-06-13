import { useUserStatisticsQuery } from "~/api/client";
import { useUserStatistics } from "./TeamScoreTracker";
import {
    createEffect,
    createMemo,
    createRenderEffect,
    createSignal,
    onCleanup,
    untrack,
} from "solid-js";
import Chart, { ChartDataset } from "chart.js/auto";
import { addChartJsDateAdapter } from "~/utils/chartJsDateAdapter";

addChartJsDateAdapter();

export function UserStatisticsGraph(props: { userId: string }) {
    const userStatistics = useUserStatistics();
    const userStatisticsQuery = useUserStatisticsQuery(() => props.userId);
    const currentUserStatistics = createMemo(
        () => userStatistics()[props.userId],
    );
    const statisticsHistoryData = createMemo(() => {
        const statistics = currentUserStatistics();
        if (!statistics) return;
        return statistics
            .flatMap((s) => {
                return Object.keys(s.activities).map((activityName) => ({
                    activityName,
                    points: s.activities[activityName]!.points,
                    value: s.activities[activityName]!.value,
                    timestamp: s.timestamp,
                }));
            })
            .toSorted((a, b) => a.timestamp - b.timestamp)
            .concat(
                userStatisticsQuery.data?.activities.map((a) => ({
                    activityName: a.activityId,
                    points: a.points,
                    timestamp: new Date().getTime(),
                    value: a.value,
                })) ?? [],
            )
            .reduce(
                (acc, curr) => {
                    if (acc[curr.activityName]) {
                        acc[curr.activityName] = [
                            ...acc[curr.activityName]!,
                            curr,
                        ];
                    } else {
                        acc[curr.activityName] = [curr];
                    }
                    return acc;
                },
                {} as Record<
                    string,
                    { points: number; value: number; timestamp: number }[]
                >,
            );
    });

    const pointsDatasets = createMemo(() => {
        const userStatistics = statisticsHistoryData();
        if (!userStatistics) return;

        const activityNames = Object.keys(userStatistics);
        return activityNames
            .map((x) => ({ activityData: userStatistics[x], activityName: x }))
            .map<ChartDataset<"line", { x: number; y: number }[]>>(
                (activity) => ({
                    data:
                        userStatistics[activity.activityName]?.map((u) => ({
                            x: u.timestamp,
                            y: u.points,
                        })) ?? [],
                    label: `${activity.activityName} Points`,
                }),
            );
    });

    const valuesDatasets = createMemo(() => {
        const userStatistics = statisticsHistoryData();
        if (!userStatistics) return;

        const activityNames = Object.keys(userStatistics);
        return activityNames
            .map((x) => ({ activityData: userStatistics[x], activityName: x }))
            .map<ChartDataset<"line", { x: number; y: number }[]>>(
                (activity) => ({
                    data:
                        userStatistics[activity.activityName]?.map((u) => ({
                            x: u.timestamp,
                            y: u.value,
                        })) ?? [],
                    label: `${activity.activityName} Value`,
                }),
            );
    });

    return (
        <>
            <div class="max-h-96">
                <div class="inline-block text-xl font-semibold">Points</div>
                <ChartComponent datasets={pointsDatasets()} />
            </div>
            <div class="max-h-96">
                <div class="inline-block text-xl font-semibold">Values</div>
                <ChartComponent datasets={valuesDatasets()} />
            </div>
        </>
    );
}

function ChartComponent(props: {
    datasets:
        | ChartDataset<
              "line",
              {
                  x: number;
                  y: number;
              }[]
          >[]
        | undefined;
}) {
    const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();

    const createChart = () => {
        if (typeof window === "undefined") return;
        const localCanvas = canvas();
        if (!localCanvas) return;
        const ctx = localCanvas.getContext("2d");
        if (!ctx) return;
        var lineChart = new Chart(localCanvas, {
            type: "line",
            options: {
                maintainAspectRatio: false,
                parsing: false,
                plugins: {
                    legend: {
                        labels: {
                            usePointStyle: true,
                        },
                        position: "right",
                    },
                },
                scales: {
                    x: {
                        type: "time",
                    },
                },
            },
            data: {
                datasets: untrack(() => props.datasets ?? []),
            },
        });
        return lineChart;
    };

    const [chart, setChart] = createSignal<ReturnType<typeof createChart>>();

    createRenderEffect(() => setChart(createChart()));

    createEffect(() => {
        const c = chart();
        onCleanup(() => {
            c?.destroy();
        });
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        c.data.datasets = props.datasets ?? [];
        c.update();
    });

    return <canvas ref={(e) => setCanvas(e)} />;
}
