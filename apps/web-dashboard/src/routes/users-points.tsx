import { createSignal, createMemo, createEffect, For, Show, Suspense } from "solid-js";
import { createFileRoute, Link } from "@tanstack/solid-router";
import {
    useSeasonRankingQuery,
    useTeamQuery,
    useMyChallengeQuery,
    useHistoricalUserPointsQueries,
} from "~/api/client";
import { useMainUser } from "~/components/MainUserProvider";
import { getDefaultHistoricalTimeWindow } from "~/utils/timeRange";
import { BrutChart, brutTip, brutAxis, brutGrid, brutZoom } from "~/components/BrutChart";

export const Route = createFileRoute("/users-points")({
    component: UsersPointsPage,
    validateSearch: (search: Record<string, unknown>) => ({
        teamId: (search.teamId as string) ?? "",
    }),
});

function UsersPointsPage() {
    const search = Route.useSearch();
    const mainUser = useMainUser();
    const teamsQuery = useSeasonRankingQuery();

    const sortedTeams = createMemo(() =>
        teamsQuery.data?.data?.teams
            .slice()
            .sort((a, b) => b.points - a.points) ?? [],
    );

    const [expandedTeamId, setExpandedTeamId] = createSignal<string | null>(
        search().teamId || null,
    );

    return (
        <main class="mx-auto max-w-250 px-5 pb-20 pt-6 font-mono">
            <h1 class="mb-1 text-lg font-bold uppercase">TEAMS</h1>
            <div class="mb-6 bg-black px-3 py-1 text-[11px] tracking-widest text-(--color-brut-red) inline-block">
                SEASON RANKING
            </div>

            <Suspense fallback={<div class="h-60 brut-skeleton" />}>
                <div class="flex flex-col gap-0">
                    <For each={sortedTeams()}>
                        {(team, i) => {
                            const isExpanded = createMemo(
                                () => expandedTeamId() === team.id,
                            );
                            return (
                                <div class="border-2 border-black -mt-0.5">
                                    <button
                                        class={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${isExpanded() ? "bg-black text-white" : "bg-white hover:bg-(--color-brut-light)"}`}
                                        onClick={() =>
                                            setExpandedTeamId((prev) =>
                                                prev === team.id ? null : team.id,
                                            )
                                        }
                                    >
                                        <div class="flex items-center gap-3">
                                            <span class={`text-sm font-bold ${isExpanded() ? "text-(--color-brut-red)" : "text-(--color-brut-gray)"}`}>
                                                {String(i() + 1).padStart(2, "0")}
                                            </span>
                                            <Show
                                                when={team.image}
                                                fallback={
                                                    <div class={`grid h-8 w-8 place-items-center border-2 ${isExpanded() ? "border-white bg-white text-black" : "border-black bg-black text-white"} text-[10px] font-bold`}>
                                                        {team.name
                                                            .slice(0, 2)
                                                            .toUpperCase()}
                                                    </div>
                                                }
                                            >
                                                <img
                                                    src={team.image!}
                                                    alt={team.name}
                                                    class="h-8 w-8 border-2 border-black object-cover"
                                                />
                                            </Show>
                                            <span class="text-sm font-bold uppercase">
                                                {team.name}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-3">
                                            <span class="text-sm font-bold">
                                                {team.points.toLocaleString()} PTS
                                            </span>
                                            <span class={`text-lg font-bold transition-transform ${isExpanded() ? "rotate-90 text-(--color-brut-red)" : ""}`}>
                                                →
                                            </span>
                                        </div>
                                    </button>
                                    <Show when={isExpanded()}>
                                        <TeamDetail teamId={team.id} />
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Suspense>

            <div class="mt-6 text-center">
                <Link to="/" class="brut-btn-ghost no-underline">
                    ← DASHBOARD
                </Link>
            </div>
        </main>
    );
}

function TeamDetail(props: { teamId: string }) {
    const mainUser = useMainUser();
    const teamQuery = useTeamQuery(() => props.teamId);
    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);

    const users = createMemo(() =>
        teamQuery.data?.users?.slice().sort((a, b) => b.points - a.points) ?? [],
    );
    const userIds = createMemo(() => users().map((u) => u.id));

    const startAt = createMemo(() => {
        const s = challengeQuery.data?.startAt;
        return s ? new Date(s).getTime() : Date.now() - 86400000;
    });
    const endsAt = createMemo(() => {
        const e = challengeQuery.data?.endAt;
        return e ? new Date(e).getTime() : Date.now();
    });

    const [timeWindow] = createSignal(
        getDefaultHistoricalTimeWindow(startAt(), endsAt()),
    );

    const userPointsQueries = useHistoricalUserPointsQueries(
        userIds,
        () => timeWindow().start,
        () => timeWindow().end,
    );

    const userColors = [
        "#000", "#ff0000", "#0000ff", "#008800", "#ff8800",
        "#8800ff", "#00aaaa", "#aa0088", "#888", "#446600",
    ];

    const chartOptions = createMemo(() => {
        const usrs = users();
        const series = usrs.map((user, i) => {
            const queryResult = userPointsQueries[i];
            const raw = queryResult?.data ?? [];
            const data = [...raw]
                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                .map((d) => [new Date(d.time).getTime(), d.points]);
            // Add current points as last point
            data.push([Date.now(), user.points]);
            return {
                name: `${user.firstName} ${user.lastName}`,
                type: "line" as const,
                smooth: false,
                step: "middle" as const,
                data,
                lineStyle: { color: userColors[i % userColors.length]!, width: 2 },
                itemStyle: { color: userColors[i % userColors.length]! },
                symbol: "rect" as const,
                symbolSize: 5,
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
            xAxis: { type: "time" as const, ...brutAxis() },
            yAxis: { type: "value" as const, ...brutGrid(), ...brutAxis() },
            series,
            dataZoom: brutZoom(),
        };
    });

    return (
        <div class="border-t-2 border-black">
            {/* Members table */}
            <Suspense fallback={<div class="h-40 brut-skeleton" />}>
                <Show when={users().length > 0}>
                    <table class="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th class="border-b-2 border-(--color-brut-light) bg-(--color-brut-light) px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    #
                                </th>
                                <th class="border-b-2 border-(--color-brut-light) bg-(--color-brut-light) px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    MEMBER
                                </th>
                                <th class="border-b-2 border-(--color-brut-light) bg-(--color-brut-light) px-3 py-2 text-right text-[10px] tracking-widest text-(--color-brut-gray)">
                                    PTS
                                </th>
                                <th class="border-b-2 border-(--color-brut-light) bg-(--color-brut-light) px-3 py-2 w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            <For each={users()}>
                                {(user, j) => (
                                    <tr class="hover:bg-[#fafafa]">
                                        <td class="border-b border-(--color-brut-light) px-3 py-2 text-(--color-brut-gray)">
                                            {String(j() + 1).padStart(2, "0")}
                                        </td>
                                        <td class="border-b border-(--color-brut-light) px-3 py-2">
                                            <div class="flex items-center gap-2">
                                                <Show
                                                    when={user.image}
                                                    fallback={
                                                        <div class="grid h-6 w-6 place-items-center border border-black bg-black text-[8px] font-bold text-white">
                                                            {(user.firstName[0] ?? "") + (user.lastName[0] ?? "")}
                                                        </div>
                                                    }
                                                >
                                                    <img
                                                        src={user.image!}
                                                        alt={user.firstName}
                                                        class="h-6 w-6 border border-black object-cover"
                                                    />
                                                </Show>
                                                <span class="font-bold uppercase">
                                                    {user.firstName} {user.lastName}
                                                </span>
                                                <Show when={user.isCaptain}>
                                                    <span class="bg-(--color-brut-red) px-1 py-0.5 text-[8px] font-bold text-white">
                                                        CPT
                                                    </span>
                                                </Show>
                                            </div>
                                        </td>
                                        <td class="border-b border-(--color-brut-light) px-3 py-2 text-right font-bold">
                                            {user.points.toLocaleString()}
                                        </td>
                                        <td class="border-b border-(--color-brut-light) px-3 py-2 text-center">
                                            <Link
                                                to="/user"
                                                search={{ id: user.id }}
                                                class="font-bold text-(--color-brut-red) no-underline"
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

            {/* User scores chart */}
            <div class="p-4">
                <span class="brut-heading mb-2">USER_SCORES</span>
                <div class="mt-2 border-2 border-black bg-white p-3">
                    <Show
                        when={users().length > 0}
                        fallback={
                            <div class="flex h-75 items-center justify-center text-xs text-(--color-brut-gray)">
                                LOADING...
                            </div>
                        }
                    >
                        <BrutChart options={chartOptions()} height="300px" />
                    </Show>
                </div>
            </div>
        </div>
    );
}
