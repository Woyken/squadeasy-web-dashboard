import { createSignal, createMemo, For, Show, Suspense } from "solid-js";
import { createFileRoute, Link } from "@tanstack/solid-router";
import {
    useUserByIdQuery,
    useUserStatisticsQuery,
    useMyChallengeQuery,
    useHistoricalUserActivityPointsQuery,
} from "~/api/client";
import { useMainUser } from "~/components/MainUserProvider";
import { getDefaultHistoricalTimeWindow } from "~/utils/timeRange";
import { BrutChart, brutTip, brutAxis, brutGrid, brutZoom } from "~/components/BrutChart";

export const Route = createFileRoute("/user")({
    component: UserPage,
    validateSearch: (search: Record<string, unknown>) => ({
        id: (search.id as string) ?? "",
    }),
});

function UserPage() {
    const search = Route.useSearch();
    const mainUser = useMainUser();
    const userId = createMemo(() => search().id || mainUser.mainUserId() || "");

    const userQuery = useUserByIdQuery(userId);
    const statsQuery = useUserStatisticsQuery(userId);
    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);

    const userName = createMemo(() => {
        const data = userQuery.data;
        if (!data?.firstName) return userId().slice(0, 8);
        return `${data.firstName} ${data.lastName ?? ""}`.trim();
    });
    const teamName = createMemo(() => userQuery.data?.teamName ?? "");
    const imageUrl = createMemo(() => userQuery.data?.imageUrl);
    const totalPoints = createMemo(() => statsQuery.data?.totalPoints ?? 0);

    const activities = createMemo(() => statsQuery.data?.activities ?? []);

    return (
        <main class="mx-auto max-w-225 px-5 pb-20 pt-6 font-mono">
            {/* User header */}
            <div class="mb-6 border-[3px] border-black p-6">
                <div class="flex items-center gap-4">
                    <Show
                        when={imageUrl()}
                        fallback={
                            <div class="grid h-16 w-16 place-items-center border-2 border-black bg-black text-lg font-bold text-white">
                                {userName().slice(0, 2).toUpperCase()}
                            </div>
                        }
                    >
                        <img
                            src={imageUrl()!}
                            alt={userName()}
                            class="h-16 w-16 border-2 border-black object-cover"
                        />
                    </Show>
                    <div class="flex-1">
                        <h1 class="text-lg font-bold uppercase">{userName()}</h1>
                        <Show when={teamName()}>
                            <p class="text-[11px] text-(--color-brut-gray)">
                                TEAM: {teamName()}
                            </p>
                        </Show>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] tracking-widest text-(--color-brut-gray)">
                            TOTAL
                        </div>
                        <div class="text-2xl font-bold text-(--color-brut-red)">
                            {totalPoints().toLocaleString()}
                        </div>
                        <div class="text-[10px] text-(--color-brut-gray)">PTS</div>
                    </div>
                </div>
            </div>

            {/* Activity breakdown */}
            <Show when={activities().length > 0}>
                <div class="mb-6">
                    <span class="brut-heading mb-2">ACTIVITIES</span>
                    <table class="w-full border-collapse font-mono text-xs">
                        <thead>
                            <tr>
                                <th class="border-b-[3px] border-black px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    TYPE
                                </th>
                                <th class="border-b-[3px] border-black px-3 py-2 text-right text-[10px] tracking-widest text-(--color-brut-gray)">
                                    VALUE
                                </th>
                                <th class="border-b-[3px] border-black px-3 py-2 text-right text-[10px] tracking-widest text-(--color-brut-gray)">
                                    PTS
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={activities()}>
                                {(activity) => (
                                    <tr class="border-b border-(--color-brut-light)">
                                        <td class="px-3 py-2 font-bold uppercase">
                                            {activity.activityId}
                                        </td>
                                        <td class="px-3 py-2 text-right text-(--color-brut-dim)">
                                            {activity.value.toLocaleString()}
                                        </td>
                                        <td class="px-3 py-2 text-right font-bold">
                                            {activity.points.toLocaleString()}
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </Show>

            {/* Activity points chart */}
            <Suspense fallback={<div class="h-85 brut-skeleton" />}>
                <Show when={challengeQuery.data?.startAt && challengeQuery.data?.endAt}>
                    <ActivityCharts
                        userId={userId()}
                        startAt={new Date(challengeQuery.data!.startAt!).getTime()}
                        endsAt={new Date(challengeQuery.data!.endAt!).getTime()}
                    />
                </Show>
            </Suspense>

            <div class="mt-6 text-center">
                <Link to="/" class="brut-btn-ghost no-underline">
                    ← DASHBOARD
                </Link>
            </div>
        </main>
    );
}

function ActivityCharts(props: { userId: string; startAt: number; endsAt: number }) {
    const [timeWindow] = createSignal(
        getDefaultHistoricalTimeWindow(props.startAt, props.endsAt),
    );

    const histQuery = useHistoricalUserActivityPointsQuery(
        () => props.userId,
        () => timeWindow().start,
        () => timeWindow().end,
    );

    const actColors: Record<string, string> = {
        walk: "#000",
        statistic_walk: "#333",
        statistic_run: "#ff0000",
        active_walk: "#0000ff",
        bike: "#008800",
        socialtag: "#ff8800",
        quiz: "#8800ff",
        mission: "#00aaaa",
    };

    const pointsChartOptions = createMemo(() => {
        const raw = histQuery.data ?? [];
        const byActivity: Record<string, { t: number; p: number }[]> = {};
        for (const entry of raw) {
            const ts = new Date(entry.time).getTime();
            const key = entry.activityId;
            if (!byActivity[key]) byActivity[key] = [];
            byActivity[key]!.push({ t: ts, p: entry.points });
        }

        const series = Object.entries(byActivity).map(([actId, data]) => ({
            name: actId,
            type: "line" as const,
            stack: "total",
            areaStyle: { opacity: 0.3 },
            data: data.sort((a, b) => a.t - b.t).map((d) => [d.t, d.p]),
            lineStyle: { color: actColors[actId] ?? "#888", width: 2 },
            itemStyle: { color: actColors[actId] ?? "#888" },
            symbol: "none" as const,
        }));

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

    const valuesChartOptions = createMemo(() => {
        const raw = histQuery.data ?? [];
        const byActivity: Record<string, { t: number; v: number }[]> = {};
        for (const entry of raw) {
            const ts = new Date(entry.time).getTime();
            const key = entry.activityId;
            if (!byActivity[key]) byActivity[key] = [];
            byActivity[key]!.push({ t: ts, v: entry.value });
        }

        const series = Object.entries(byActivity).map(([actId, data]) => ({
            name: actId,
            type: "bar" as const,
            stack: "total",
            data: data.sort((a, b) => a.t - b.t).map((d) => [d.t, d.v]),
            itemStyle: { color: actColors[actId] ?? "#888" },
        }));

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
        <>
            <div class="mb-6">
                <span class="brut-heading mb-2">ACTIVITY_POINTS</span>
                <div class="border-2 border-black bg-white p-3">
                    <Show
                        when={(histQuery.data ?? []).length > 0}
                        fallback={
                            <div class="flex h-75 items-center justify-center text-xs text-(--color-brut-gray)">
                                {histQuery.isLoading ? "LOADING..." : "NO DATA"}
                            </div>
                        }
                    >
                        <BrutChart options={pointsChartOptions()} height="300px" />
                    </Show>
                </div>
            </div>

            <div class="mb-6">
                <span class="brut-heading mb-2">ACTIVITY_VALUES</span>
                <div class="border-2 border-black bg-white p-3">
                    <Show
                        when={(histQuery.data ?? []).length > 0}
                        fallback={
                            <div class="flex h-75 items-center justify-center text-xs text-(--color-brut-gray)">
                                {histQuery.isLoading ? "LOADING..." : "NO DATA"}
                            </div>
                        }
                    >
                        <BrutChart options={valuesChartOptions()} height="300px" />
                    </Show>
                </div>
            </div>
        </>
    );
}
