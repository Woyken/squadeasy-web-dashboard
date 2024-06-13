import { useTeamQuery } from "~/api/client";
import { useTeamsUsersScore } from "./TeamScoreTracker";
import {
    createEffect,
    createMemo,
    createRenderEffect,
    createSignal,
    onCleanup,
    untrack,
} from "solid-js";
import Chart, { ChartDataset } from "chart.js/auto";
import { getUserDisplayName } from "~/getUserDisplayName";
import { addChartJsDateAdapter } from "~/utils/chartJsDateAdapter";

addChartJsDateAdapter();

export function TeamUsersScoresGraph(props: { teamId: string }) {
    const teamsUsersScore = useTeamsUsersScore();
    const teamQuery = useTeamQuery(() => props.teamId);
    const usersHistoryData = createMemo(() => {
        const teamUsers = teamQuery.data?.users;
        if (!teamUsers) return;
        const teamUsersScores = teamsUsersScore()[props.teamId];
        if (!teamUsersScores) return;
        const usersScore = teamUsersScores.filter(
            (x) =>
                !!Object.keys(x.users).find(
                    (userId) => !!teamUsers.find((tu) => tu.id === userId),
                ),
        );
        const usersScoresSorted = usersScore.toSorted(
            (a, b) => a.timestamp - b.timestamp,
        );
        return teamUsers.reduce(
            (acc, curr) => {
                const usersScoreTimestampAndPoints = usersScoresSorted.map(
                    (x) => ({
                        timestamp: x.timestamp,
                        points: x.users[curr.id] ?? 0,
                    }),
                );
                acc[curr.id] = usersScoreTimestampAndPoints;
                return acc;
            },
            {} as Record<string, { timestamp: number; points: number }[]>,
        );
    });

    const datasets = createMemo(() => {
        const teamUsers = teamQuery.data?.users;
        if (!teamUsers) return;
        const usersData = usersHistoryData();
        if (!usersData) return;
        const sortedUsers = teamUsers.toSorted((a, b) => b.points - a.points);

        return sortedUsers.map<
            ChartDataset<"line", { x: number; y: number }[]>
        >((user) => ({
            data: (
                usersData[user.id]?.map((u) => ({
                    x: u.timestamp,
                    y: u.points,
                })) ?? []
            ).concat(
                teamUsers
                    .filter((x) => x.id === user.id)
                    .map((x) => ({
                        x: new Date().getTime(),
                        y: x.points,
                    })),
            ),
            label: getUserDisplayName({ email: "unknown", ...user }),
        }));
    });

    const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();

    const createChart = () => {
        if (typeof window === "undefined") return;
        // if (!teamsQuery.data) return;
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
                datasets: untrack(() => datasets() ?? []),
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
        c.data.datasets = datasets() ?? [];
        c.update();
    });

    return (
        <>
            <canvas ref={(e) => setCanvas(e)} />
        </>
    );
}
