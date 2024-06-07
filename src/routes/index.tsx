import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import {
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    untrack,
} from "solid-js";
import { useMyChallengeQuery, useSeasonRankingQuery } from "~/api/client";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import Chart from "chart.js/auto";
import "chartjs-adapter-luxon";
import { useTeamsData } from "~/components/TeamScoreTracker";

export default function Home() {
    const navigate = useNavigate();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate("/login");
    });
    const firstUserId = createMemo(
        () => users().tokens.keys().next().value as string | undefined,
    );
    // If user is not set, will navigate out, this page
    const query = useMyChallengeQuery(firstUserId);
    const endAtTimestamp = createMemo(() => {
        if (!query.data || !query.data.endAt) return;
        return new Date(query.data.endAt).getTime();
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

    const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();

    const teamsQuery = useSeasonRankingQuery();
    const first10TeamsMetadata = createMemo(() => {
        return teamsQuery.data?.teams
            .toSorted((a, b) => b.points - a.points)
            .slice(0, 10);
    });

    const teamsData = useTeamsData();

    const datasets = createMemo(() => {
        const teamEntries = teamsData()
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
                            timestamp: curr.points,
                        });
                        return acc;
                    }
                    acc[curr.teamId] = [
                        { points: curr.points, timestamp: curr.points },
                    ];
                    return acc;
                },
                {} as Record<string, { timestamp: number; points: number }[]>,
            );
        const dataByTeamId = Object.keys(teamEntries)
            .map((teamId) => {
                const teamMetadata = first10TeamsMetadata()?.find(
                    (x) => x.id === teamId,
                );
                if (!teamMetadata) return;

                return {
                    data: teamEntries[teamId]!.map((entry) => ({
                        x: entry.timestamp,
                        y: entry.points,
                    })),
                    label: teamMetadata.name,
                };
            })
            .filter((x) => !!x)
            .map((x) => x as NonNullable<typeof x>);
        return dataByTeamId;
    });

    const chart = createMemo(() => {
        if (typeof window === "undefined") return;
        // if (!teamsQuery.data) return;
        const localCanvas = canvas();
        if (!localCanvas) return;
        const ctx = localCanvas.getContext("2d");
        if (!ctx) return;
        var lineChart = new Chart(localCanvas, {
            type: "line",
            options: {
                spanGaps: true,
                parsing: false,
                scales: {
                    x: {
                        type: "time",
                    },
                },
            },
            data: {
                datasets: untrack(() => datasets()),
            },
        });
        return lineChart;
    });

    createEffect(() => {
        const c = chart();
        if (!c) return;
        c.data.datasets = datasets();
        c.update();
    });

    return (
        <main class="flex flex-col items-center">
            <Title>SquadEasy</Title>
            <h1>Countdown</h1>
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
            <canvas ref={setCanvas} />
        </main>
    );
}
