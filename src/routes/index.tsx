import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import {
    createEffect,
    createMemo,
    createRenderEffect,
    createSignal,
    onCleanup,
    untrack,
} from "solid-js";
import { useMyChallengeQuery, useSeasonRankingQuery } from "~/api/client";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import Chart, { ChartDataset } from "chart.js/auto";
import "chartjs-adapter-luxon";
import { useTeamsData } from "~/components/TeamScoreTracker";
import { useMainUser } from "~/components/MainUserProvider";

export default function Home() {
    const navigate = useNavigate();
    const mainUser = useMainUser();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate("/login");
    });

    // If user is not set, will navigate out, this page
    const query = useMyChallengeQuery(mainUser.mainUserId);
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
    ].map((x) => {
        if (typeof Image === "undefined") return;
        const image = new Image();
        image.src = x;
        image.width = 20;
        image.height = 20;
        return image;
    });

    const datasets = createMemo(() => {
        const currentTempData = first10TeamsMetadata()?.reduce(
            (acc, curr) => {
                acc.teamsData[curr.id] = curr.points;
                return acc;
            },
            {
                timestamp: new Date().getTime(),
                teamsData: {} as Record<string, number>,
            },
        );
        const teamEntries = (
            !!currentTempData
                ? teamsData().concat(currentTempData)
                : teamsData()
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
            .map<
                | ChartDataset<
                      "line",
                      {
                          x: number;
                          y: number;
                      }[]
                  >
                | undefined
            >((teamId) => {
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
                    pointStyle: (x) =>
                        pointStyleImages[
                            x.datasetIndex % pointStyleImages.length
                        ],
                };
            })
            .filter((x) => !!x)
            .map((x) => x as NonNullable<typeof x>);
        return dataByTeamId;
    });

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
                datasets: untrack(() => datasets()),
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
        c.data.datasets = datasets();
        c.update();
    });

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
                        <A href="/users-points" class="text-5xl font-bold">
                            Teams User Scores 🎮
                        </A>
                    </div>
                </div>
            </div>
            <div class="mt-2 flex flex-1 flex-wrap justify-center gap-6">
                <div class="card max-h-full min-h-96 w-full bg-base-100 shadow-md">
                    <div class="card-body">
                        <canvas ref={setCanvas} />
                    </div>
                </div>
            </div>
        </main>
    );
}
