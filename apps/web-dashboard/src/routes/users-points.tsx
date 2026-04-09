import { createMemo, createSignal, For, Show, Suspense } from "solid-js";
import { createFileRoute, Link } from "@tanstack/solid-router";
import {
    useHistoricalTeamMembershipsQuery,
    useHistoricalTeamPointsQuery,
    useHistoricalUserPointsQueries,
    useMyChallengeQuery,
    useStoredTeamQueries,
    useSeasonRankingQuery,
    mergeSeasonTeams,
    type HistoricalTeamMembership,
} from "~/api/client";
import { useMainUser } from "~/components/MainUserProvider";
import { BrutChart, brutAxis, brutGrid, brutTip, brutZoom } from "~/components/BrutChart";
import { getDefaultHistoricalTimeWindow } from "~/utils/timeRange";

export const Route = createFileRoute("/users-points")({
    component: UsersPointsPage,
    validateSearch: (search: Record<string, unknown>) => ({
        teamId: (search.teamId as string) ?? "",
    }),
});

function UsersPointsPage() {
    const search = Route.useSearch();
    const mainUser = useMainUser();
    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);
    const teamsQuery = useSeasonRankingQuery();

    const phase = createMemo(() => {
        const start = challengeQuery.data?.startAt
            ? new Date(challengeQuery.data.startAt).getTime()
            : undefined;
        const end = challengeQuery.data?.endAt
            ? new Date(challengeQuery.data.endAt).getTime()
            : undefined;

        if (!start || !end) return "upcoming" as const;

        const now = Date.now();
        if (now < start) return "upcoming" as const;
        if (now >= end) return "ended" as const;
        return "active" as const;
    });
    const historicalTimeWindow = createMemo(() => {
        const startAt = challengeQuery.data?.startAt
            ? new Date(challengeQuery.data.startAt).getTime()
            : Date.now() - 86400000;
        const endAt = challengeQuery.data?.endAt
            ? new Date(challengeQuery.data.endAt).getTime()
            : Date.now();

        return getDefaultHistoricalTimeWindow(startAt, endAt);
    });
    const historicalTeamPointsQuery = useHistoricalTeamPointsQuery(
        () => historicalTimeWindow().start,
        () => historicalTimeWindow().end,
    );
    const missingHistoricalTeamIds = createMemo(() => {
        if (phase() !== "ended") {
            return [];
        }

        const liveTeamIds = new Set((teamsQuery.data?.data?.teams ?? []).map((team) => team.id));
        const trackedTeamIds = new Set(
            (historicalTeamPointsQuery.data ?? []).map((team) => team.teamId),
        );

        return [...trackedTeamIds].filter((teamId) => !liveTeamIds.has(teamId));
    });
    const storedTeamQueries = useStoredTeamQueries(missingHistoricalTeamIds);
    const storedTeams = createMemo(() =>
        storedTeamQueries
            .map((query) => query.data)
            .filter((team): team is NonNullable<typeof team> => !!team),
    );

    const sortedTeams = createMemo(() =>
        phase() === "ended"
            ? mergeSeasonTeams(
                  teamsQuery.data?.data?.teams ?? [],
                  storedTeams(),
                  historicalTeamPointsQuery.data ?? [],
              )
            : (teamsQuery.data?.data?.teams
                  .slice()
                  .sort((a, b) => b.points - a.points) ?? []),
    );

    const [expandedTeamId, setExpandedTeamId] = createSignal<string | null>(
        search().teamId || null,
    );

    return (
        <main class="mx-auto max-w-250 px-5 pb-20 pt-6 font-mono">
            <h1 class="mb-1 text-lg font-bold uppercase">TEAMS</h1>
            <div class="mb-6 inline-block bg-black px-3 py-1 text-[11px] tracking-widest text-(--color-brut-red)">
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
    const challengeQuery = useMyChallengeQuery(mainUser.mainUserId);

    const startAt = createMemo(() => {
        const start = challengeQuery.data?.startAt;
        return start ? new Date(start).getTime() : Date.now() - 86400000;
    });
    const endsAt = createMemo(() => {
        const end = challengeQuery.data?.endAt;
        return end ? new Date(end).getTime() : Date.now();
    });

    const timeWindow = createMemo(() =>
        getDefaultHistoricalTimeWindow(startAt(), endsAt()),
    );

    const membershipsQuery = useHistoricalTeamMembershipsQuery(
        () => props.teamId,
        () => timeWindow().start,
        () => timeWindow().end,
    );

    const users = createMemo(() =>
        groupHistoricalTeamMembers(membershipsQuery.data ?? []),
    );
    const userIds = createMemo(() => users().map((user) => user.userId));

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
        const series = users()
            .map((user, i) => {
                const data = buildMembershipSeriesData(
                    userPointsQueries[i]?.data ?? [],
                    user.intervals,
                );

                if (data.length === 0) {
                    return null;
                }

                return {
                    name: `${user.firstName} ${user.lastName}`,
                    type: "line" as const,
                    smooth: false,
                    step: "middle" as const,
                    connectNulls: false,
                    data,
                    lineStyle: { color: userColors[i % userColors.length]!, width: 2 },
                    itemStyle: { color: userColors[i % userColors.length]! },
                    symbol: "rect" as const,
                    symbolSize: 5,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

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
            <Suspense fallback={<div class="h-40 brut-skeleton" />}>
                <Show
                    when={users().length > 0}
                    fallback={
                        <div class="p-4 text-xs text-(--color-brut-gray)">
                            NO_MEMBERS_TRACKED_FOR_THIS_RANGE.
                        </div>
                    }
                >
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
                                    ACTIVE_IN_RANGE
                                </th>
                                <th class="border-b-2 border-(--color-brut-light) bg-(--color-brut-light) px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    PERIODS
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
                                                        src={user.image ?? undefined}
                                                        alt={user.firstName}
                                                        class="h-6 w-6 border border-black object-cover"
                                                    />
                                                </Show>
                                                <div class="min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <span class="font-bold uppercase">
                                                            {user.firstName} {user.lastName}
                                                        </span>
                                                        <Show when={user.isCurrentMember}>
                                                            <span class="bg-(--color-brut-red) px-1 py-0.5 text-[8px] font-bold text-white">
                                                                NOW
                                                            </span>
                                                        </Show>
                                                    </div>
                                                    <div class="text-[10px] text-(--color-brut-gray)">
                                                        {formatMembershipIntervals(user.intervals)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="border-b border-(--color-brut-light) px-3 py-2 text-right font-bold">
                                            {formatDuration(user.totalActiveMs)}
                                        </td>
                                        <td class="border-b border-(--color-brut-light) px-3 py-2 text-(--color-brut-gray)">
                                            {user.intervals.length}
                                            <span class="ml-1 text-[10px] uppercase">
                                                {user.intervals.length === 1 ? "period" : "periods"}
                                            </span>
                                        </td>
                                        <td class="border-b border-(--color-brut-light) px-3 py-2 text-center">
                                            <Link
                                                to="/user"
                                                search={{ id: user.userId }}
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

            <div class="p-4">
                <span class="brut-heading mb-2">USER_SCORES</span>
                <div class="mt-2 border-2 border-black bg-white p-3">
                    <Show
                        when={users().length > 0}
                        fallback={
                            <div class="flex h-75 items-center justify-center text-xs text-(--color-brut-gray)">
                                NO_MEMBERS_TRACKED_FOR_THIS_RANGE.
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

type HistoricalTeamMember = {
    userId: string;
    firstName: string;
    lastName: string;
    image?: string | null;
    intervals: {
        activeFrom: number;
        activeUntil: number;
        leftAt: number | null;
    }[];
    totalActiveMs: number;
    isCurrentMember: boolean;
};

type HistoricalUserPointsEntry = {
    time: string;
    points: number;
};

const membershipDateFormatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

function groupHistoricalTeamMembers(
    memberships: HistoricalTeamMembership[],
): HistoricalTeamMember[] {
    const membersByUser = new Map<string, HistoricalTeamMember>();

    for (const membership of memberships) {
        const activeFrom = new Date(membership.activeFrom).getTime();
        const activeUntil = new Date(membership.activeUntil).getTime();

        if (!Number.isFinite(activeFrom) || !Number.isFinite(activeUntil)) {
            continue;
        }

        if (activeUntil <= activeFrom) {
            continue;
        }

        const existingMember = membersByUser.get(membership.userId) ?? {
            userId: membership.userId,
            firstName: membership.firstName,
            lastName: membership.lastName,
            image: membership.image,
            intervals: [],
            totalActiveMs: 0,
            isCurrentMember: false,
        };

        existingMember.intervals.push({
            activeFrom,
            activeUntil,
            leftAt: membership.leftAt ? new Date(membership.leftAt).getTime() : null,
        });
        existingMember.totalActiveMs += activeUntil - activeFrom;
        existingMember.isCurrentMember ||= membership.leftAt === null;
        existingMember.image ??= membership.image;

        membersByUser.set(membership.userId, existingMember);
    }

    return [...membersByUser.values()]
        .map((member) => ({
            ...member,
            intervals: member.intervals.sort(
                (a, b) => a.activeFrom - b.activeFrom,
            ),
        }))
        .sort(
            (a, b) =>
                Number(b.isCurrentMember) - Number(a.isCurrentMember) ||
                b.totalActiveMs - a.totalActiveMs ||
                `${a.firstName} ${a.lastName}`.localeCompare(
                    `${b.firstName} ${b.lastName}`,
                ),
        );
}

function buildMembershipSeriesData(
    points: HistoricalUserPointsEntry[],
    intervals: HistoricalTeamMember["intervals"],
) {
    const sortedPoints = points
        .map((point) => ({
            time: new Date(point.time).getTime(),
            points: point.points,
        }))
        .filter((point) => Number.isFinite(point.time))
        .sort((a, b) => a.time - b.time);

    const series: Array<[number, number | null]> = [];

    for (const interval of intervals) {
        let lastPointBeforeStart:
            | {
                  time: number;
                  points: number;
              }
            | undefined;
        let lastPointBeforeEnd:
            | {
                  time: number;
                  points: number;
              }
            | undefined;
        const intervalPoints: Array<[number, number]> = [];

        for (const point of sortedPoints) {
            if (point.time <= interval.activeFrom) {
                lastPointBeforeStart = point;
            }

            if (point.time <= interval.activeUntil) {
                lastPointBeforeEnd = point;
            }

            if (
                point.time >= interval.activeFrom &&
                point.time <= interval.activeUntil
            ) {
                intervalPoints.push([point.time, point.points]);
            }
        }

        if (
            !intervalPoints.some(([time]) => time === interval.activeFrom) &&
            lastPointBeforeStart
        ) {
            intervalPoints.unshift([
                interval.activeFrom,
                lastPointBeforeStart.points,
            ]);
        }

        const lastIntervalPoint = intervalPoints.at(-1);
        if (
            (!lastIntervalPoint ||
                lastIntervalPoint[0] < interval.activeUntil) &&
            lastPointBeforeEnd
        ) {
            intervalPoints.push([
                interval.activeUntil,
                lastPointBeforeEnd.points,
            ]);
        }

        if (intervalPoints.length === 0) {
            continue;
        }

        if (series.length > 0) {
            series.push([interval.activeFrom, null]);
        }

        series.push(...intervalPoints);
        series.push([interval.activeUntil, null]);
    }

    while (series.at(-1)?.[1] === null) {
        series.pop();
    }

    return series;
}

function formatMembershipIntervals(
    intervals: HistoricalTeamMember["intervals"],
) {
    return intervals
        .map((interval) => {
            const startLabel = membershipDateFormatter.format(interval.activeFrom);
            const endLabel =
                interval.leftAt === null
                    ? "NOW"
                    : membershipDateFormatter.format(interval.activeUntil);

            return `${startLabel} - ${endLabel}`;
        })
        .join(" • ");
}

function formatDuration(durationMs: number) {
    const totalMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));

    if (totalMinutes < 60) {
        return `${totalMinutes}m`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (totalHours < 48) {
        return remainingMinutes > 0
            ? `${totalHours}h ${remainingMinutes}m`
            : `${totalHours}h`;
    }

    const totalDays = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;

    return remainingHours > 0
        ? `${totalDays}d ${remainingHours}h`
        : `${totalDays}d`;
}
