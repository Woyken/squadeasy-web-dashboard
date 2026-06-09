import {
    createEffect,
    createMemo,
    createSignal,
    For,
    onCleanup,
    Show,
    Suspense,
    untrack,
} from "solid-js";
import { createFileRoute, Link, redirect } from "@tanstack/solid-router";
import { hasStoredUserTokens } from "~/utils/localStorage";
import * as v from "valibot";
import {
    getActivitiesCatalogQueryOptions,
    getHistoricalUserActivityPointsQueryOptions,
    getMyChallengeQueryOptions,
    getUserComparisonInfiniteQueryOptions,
    useGetUserToken,
    type UserComparisonSortKey,
} from "~/api/client";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/solid-query";
import { useMainUser } from "~/components/MainUserProvider";
import { getDefaultHistoricalTimeWindow } from "~/utils/timeRange";
import { BrutChart, brutAxis, brutGrid, brutTip, brutZoom } from "~/components/BrutChart";

const sortKeys = ["score", "activityValue", "activityPoints"] as const;

const usersSearchSchema = v.object({
    sortBy: v.optional(v.picklist(sortKeys), "score"),
    order: v.optional(v.picklist(["asc", "desc"] as const), "desc"),
    activityId: v.optional(v.string(), ""),
    search: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/users")({
    component: UsersComparisonPage,
    validateSearch: usersSearchSchema,
    beforeLoad: ({ location }) => {
        if (!hasStoredUserTokens()) {
            throw redirect({ to: "/login", search: { redirect: location.href } });
        }
    },
});

const userColors = [
    "#000000", "#ff0000", "#0000ff", "#008800", "#ff8800",
    "#8800ff", "#00aaaa", "#aa0088", "#888888", "#446600",
];

function getInitials(firstName: string, lastName: string) {
    const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.trim();
    return (initials || "??").toUpperCase();
}

function compactNumber(value: number) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    return `${value}`;
}

function UsersComparisonPage() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);

    const selectedActivityId = createMemo(() => search().activityId || "");
    // Sorting by an activity metric only makes sense when one is selected.
    const resolvedSortBy = createMemo<UserComparisonSortKey>(() =>
        !selectedActivityId() && search().sortBy !== "score"
            ? "score"
            : search().sortBy,
    );
    const order = createMemo(() => search().order);
    const searchTerm = createMemo(() => search().search || "");

    const activitiesQuery = useQuery(() =>
        getActivitiesCatalogQueryOptions(
            getToken,
            () => !!mainUser.mainUserId(),
        ),
    );
    const activities = createMemo(() => activitiesQuery.data ?? []);
    const selectedActivity = createMemo(() =>
        activities().find((a) => a.activityId === selectedActivityId()),
    );
    const activityLabel = createMemo(
        () => selectedActivity()?.title || selectedActivityId(),
    );

    const comparisonQuery = useInfiniteQuery(() =>
        getUserComparisonInfiniteQueryOptions(
            resolvedSortBy,
            order,
            selectedActivityId,
            searchTerm,
            getToken,
            () => !!mainUser.mainUserId(),
        ),
    );
    const rows = createMemo(
        () => comparisonQuery.data?.pages.flatMap((page) => page.items) ?? [],
    );

    function updateSearch(
        patch: Partial<v.InferOutput<typeof usersSearchSchema>>,
    ) {
        void navigate({
            to: "/users",
            search: (prev) => ({ ...prev, ...patch }),
            replace: true,
        });
    }

    function toggleSort(key: UserComparisonSortKey) {
        if (resolvedSortBy() === key) {
            updateSearch({ order: order() === "desc" ? "asc" : "desc" });
        } else {
            updateSearch({ sortBy: key, order: "desc" });
        }
    }

    function onPickActivity(activityId: string) {
        if (!activityId) {
            // Clearing the activity falls back to ranking by Score.
            updateSearch({ activityId: "", sortBy: "score" });
        } else {
            updateSearch({ activityId, sortBy: "activityValue", order: "desc" });
        }
    }

    // Debounced free-text search synced to the URL.
    const [searchInput, setSearchInput] = createSignal(searchTerm());
    createEffect(() => {
        // Keep the input in sync if the URL changes externally.
        const term = searchTerm();
        if (untrack(searchInput) !== term) setSearchInput(term);
    });
    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    function onSearchInput(value: string) {
        setSearchInput(value);
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            if (value !== untrack(searchTerm)) updateSearch({ search: value });
        }, 300);
    }
    onCleanup(() => clearTimeout(searchTimer));

    const sortIndicator = (key: UserComparisonSortKey) =>
        resolvedSortBy() === key ? (order() === "desc" ? " ↓" : " ↑") : "";

    return (
        <main class="mx-auto max-w-[90vw] px-5 pb-20 pt-6 font-mono">
            <h1 class="mb-1 text-2xl font-bold uppercase">USERS</h1>
            <div class="mb-6 inline-block bg-black px-3 py-1 text-sm tracking-widest text-(--color-brut-red)">
                COMPARISON
            </div>

            {/* Controls */}
            <div class="mb-5 flex flex-wrap items-end gap-3">
                <label class="flex flex-col gap-1">
                    <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                        ACTIVITY
                    </span>
                    <select
                        class="border-2 border-black bg-white px-2 py-1.5 text-xs font-bold uppercase tracking-wider focus:outline-none focus:bg-(--color-brut-light)"
                        value={selectedActivityId()}
                        onChange={(e) => onPickActivity(e.currentTarget.value)}
                    >
                        <option value="">SCORE (TOTAL)</option>
                        <For each={activities()}>
                            {(activity) => (
                                <option value={activity.activityId}>
                                    {(activity.title || activity.activityId).toUpperCase()}
                                </option>
                            )}
                        </For>
                    </select>
                </label>

                <label class="flex flex-1 flex-col gap-1 min-w-50">
                    <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                        FILTER NAME / TEAM
                    </span>
                    <input
                        type="search"
                        placeholder="SEARCH..."
                        class="border-2 border-black bg-white px-2 py-1.5 text-xs tracking-wider placeholder:text-(--color-brut-gray) focus:outline-none focus:bg-(--color-brut-light)"
                        value={searchInput()}
                        onInput={(e) => onSearchInput(e.currentTarget.value)}
                    />
                </label>
            </div>

            {/* Top-10 historical chart (only when an activity is selected) */}
            <Show when={selectedActivityId()}>
                <TopUsersActivityChart
                    activityId={selectedActivityId()}
                    activityLabel={activityLabel()}
                    users={rows().slice(0, 10)}
                />
            </Show>

            <Suspense fallback={<div class="h-60 brut-skeleton" />}>
                <div class="overflow-x-auto border-2 border-black">
                    <table class="w-full border-collapse text-xs">
                        <thead>
                            <tr class="bg-(--color-brut-light)">
                                <th class="px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    #
                                </th>
                                <th class="px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    USER
                                </th>
                                <th class="px-3 py-2 text-left text-[10px] tracking-widest text-(--color-brut-gray)">
                                    TEAM
                                </th>
                                <SortableHeader
                                    label="SCORE"
                                    active={resolvedSortBy() === "score"}
                                    indicator={sortIndicator("score")}
                                    onClick={() => toggleSort("score")}
                                />
                                <Show when={selectedActivityId()}>
                                    <SortableHeader
                                        label={`${activityLabel().toUpperCase()} VAL`}
                                        active={resolvedSortBy() === "activityValue"}
                                        indicator={sortIndicator("activityValue")}
                                        onClick={() => toggleSort("activityValue")}
                                    />
                                    <SortableHeader
                                        label={`${activityLabel().toUpperCase()} PTS`}
                                        active={resolvedSortBy() === "activityPoints"}
                                        indicator={sortIndicator("activityPoints")}
                                        onClick={() => toggleSort("activityPoints")}
                                    />
                                </Show>
                            </tr>
                        </thead>
                        <tbody>
                            <For
                                each={rows()}
                                fallback={
                                    <tr>
                                        <td
                                            colspan={selectedActivityId() ? 6 : 4}
                                            class="px-3 py-6 text-center text-xs text-(--color-brut-gray)"
                                        >
                                            {comparisonQuery.isPending
                                                ? "LOADING..."
                                                : "NO_USERS_MATCH_FILTER."}
                                        </td>
                                    </tr>
                                }
                            >
                                {(user, i) => (
                                    <tr class="border-t border-(--color-brut-light) hover:bg-[#fafafa] transition-colors">
                                        <td class="px-3 py-2 font-bold text-(--color-brut-gray)">
                                            {String(i() + 1).padStart(2, "0")}
                                        </td>
                                        <td class="px-3 py-2">
                                            <Link
                                                to="/user"
                                                search={{ id: user.userId }}
                                                class="flex items-center gap-2 no-underline text-black hover:text-(--color-brut-red)"
                                            >
                                                <Show
                                                    when={user.imageUrl}
                                                    fallback={
                                                        <span class="grid h-7 w-7 shrink-0 place-items-center border-2 border-black bg-black text-[9px] font-bold text-white">
                                                            {getInitials(user.firstName, user.lastName)}
                                                        </span>
                                                    }
                                                >
                                                    <img
                                                        src={user.imageUrl!}
                                                        alt=""
                                                        loading="lazy"
                                                        class="h-7 w-7 shrink-0 border-2 border-black object-cover"
                                                    />
                                                </Show>
                                                <span class="font-bold uppercase">
                                                    {`${user.firstName} ${user.lastName}`.trim() ||
                                                        user.userId.slice(0, 8)}
                                                </span>
                                            </Link>
                                        </td>
                                        <td class="px-3 py-2 uppercase text-(--color-brut-dim)">
                                            {user.teamName ?? "—"}
                                        </td>
                                        <td
                                            class={`px-3 py-2 text-right tabular-nums ${resolvedSortBy() === "score" ? "font-bold" : ""}`}
                                        >
                                            {user.score.toLocaleString()}
                                        </td>
                                        <Show when={selectedActivityId()}>
                                            <td
                                                class={`px-3 py-2 text-right tabular-nums ${resolvedSortBy() === "activityValue" ? "font-bold" : "text-(--color-brut-dim)"}`}
                                            >
                                                {user.activityValue == null
                                                    ? "—"
                                                    : user.activityValue.toLocaleString()}
                                            </td>
                                            <td
                                                class={`px-3 py-2 text-right tabular-nums ${resolvedSortBy() === "activityPoints" ? "font-bold" : "text-(--color-brut-dim)"}`}
                                            >
                                                {user.activityPoints == null
                                                    ? "—"
                                                    : user.activityPoints.toLocaleString()}
                                            </td>
                                        </Show>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>

                <Show when={comparisonQuery.hasNextPage}>
                    <button
                        type="button"
                        class="mt-4 w-full border-2 border-black bg-white px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-black hover:text-white disabled:opacity-50"
                        disabled={comparisonQuery.isFetchingNextPage}
                        onClick={() => void comparisonQuery.fetchNextPage()}
                    >
                        {comparisonQuery.isFetchingNextPage
                            ? "LOADING..."
                            : "LOAD MORE"}
                    </button>
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

function SortableHeader(props: {
    label: string;
    active: boolean;
    indicator: string;
    onClick: () => void;
}) {
    return (
        <th class="px-3 py-2 text-right text-[10px] tracking-widest text-(--color-brut-gray)">
            <button
                type="button"
                class={`uppercase tracking-widest hover:text-black ${props.active ? "font-bold text-(--color-brut-red)" : ""}`}
                onClick={props.onClick}
            >
                {props.label}
                {props.indicator}
            </button>
        </th>
    );
}

type ComparisonUser = {
    userId: string;
    firstName: string;
    lastName: string;
};

function TopUsersActivityChart(props: {
    activityId: string;
    activityLabel: string;
    users: ComparisonUser[];
}) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    const challengeQuery = useQuery(() =>
        getMyChallengeQueryOptions(mainUser.mainUserId, getToken),
    );

    const startAt = createMemo(() => {
        const start = challengeQuery.data?.startAt;
        return start ? new Date(start).getTime() : Date.now() - 86400000;
    });
    const endsAt = createMemo(() => {
        const end = challengeQuery.data?.endAt;
        return end ? new Date(end).getTime() : Date.now();
    });
    const baseTimeWindow = createMemo(() =>
        getDefaultHistoricalTimeWindow(startAt(), endsAt()),
    );
    const [zoomedWindow, setZoomedWindow] = createSignal<{ start: number; end: number } | null>(null);
    const timeWindow = createMemo(() => zoomedWindow() ?? baseTimeWindow());
    createEffect(() => {
        startAt();
        endsAt();
        untrack(() => setZoomedWindow(null));
    });

    const userIds = createMemo(() => props.users.map((u) => u.userId));
    const histQueries = useQueries(() => ({
        queries: userIds().map((userId) =>
            getHistoricalUserActivityPointsQueryOptions(
                () => userId,
                () => timeWindow().start,
                () => timeWindow().end,
                getToken,
                () => !!mainUser.mainUserId() && !!props.activityId,
            ),
        ),
    }));
    const histByUserId = createMemo(
        () =>
            new Map(
                userIds().map((id, i) => [id, histQueries[i]?.data ?? []] as const),
            ),
    );

    const hasAnyData = createMemo(() =>
        props.users.some((u) =>
            (histByUserId().get(u.userId) ?? []).some(
                (e) => e.activityId === props.activityId,
            ),
        ),
    );

    const chartOptions = createMemo(() => {
        const actId = props.activityId;
        const series = props.users.flatMap((user, i) => {
            const color = userColors[i % userColors.length]!;
            const hist = (histByUserId().get(user.userId) ?? [])
                .filter((e) => e.activityId === actId)
                .slice()
                .sort(
                    (a, b) =>
                        new Date(a.time).getTime() - new Date(b.time).getTime(),
                );
            if (hist.length === 0) return [];

            const name =
                `${user.firstName} ${user.lastName}`.trim() ||
                user.userId.slice(0, 8);

            return [
                {
                    name,
                    type: "line" as const,
                    smooth: false,
                    symbol: "circle" as const,
                    symbolSize: 6,
                    showAllSymbol: true,
                    yAxisIndex: 0,
                    data: hist.map((e) => [new Date(e.time).getTime(), e.value]),
                    lineStyle: { color, width: 2 },
                    itemStyle: { color },
                },
                {
                    name: `${name} · PTS`,
                    type: "line" as const,
                    smooth: false,
                    symbol: "circle" as const,
                    symbolSize: 5,
                    showAllSymbol: true,
                    yAxisIndex: 1,
                    data: hist.map((e) => [new Date(e.time).getTime(), e.points]),
                    lineStyle: { color, width: 1.5, type: "dashed" as const },
                    itemStyle: { color },
                },
            ];
        });

        return {
            backgroundColor: "transparent",
            tooltip: brutTip(),
            legend: {
                textStyle: {
                    color: "#666",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 9,
                },
                bottom: 24,
                type: "scroll" as const,
            },
            grid: { top: 12, right: 56, bottom: 58, left: 56 },
            xAxis: {
                type: "time" as const,
                min: startAt(),
                max: endsAt(),
                ...brutAxis(),
            },
            yAxis: [
                {
                    type: "value" as const,
                    name: "VALUE",
                    nameTextStyle: { color: "#666", fontSize: 9 },
                    scale: true,
                    ...brutGrid(),
                    ...brutAxis(),
                    axisLabel: { formatter: compactNumber },
                },
                {
                    type: "value" as const,
                    name: "PTS",
                    nameTextStyle: { color: "#666", fontSize: 9 },
                    scale: true,
                    ...brutAxis(),
                    splitLine: { show: false },
                    axisLabel: { formatter: compactNumber },
                },
            ],
            series,
            dataZoom: brutZoom(timeWindow().start, timeWindow().end),
        };
    });

    return (
        <div class="mb-6">
            <span class="brut-heading mb-2">
                TOP 10 · {props.activityLabel.toUpperCase()} (VALUE / PTS)
            </span>
            <div class="border-2 border-black bg-white p-3">
                <Show
                    when={hasAnyData()}
                    fallback={
                        <div class="flex h-75 items-center justify-center text-xs text-(--color-brut-gray)">
                            {histQueries.some((q) => q.isLoading)
                                ? "LOADING..."
                                : "NO DATA"}
                        </div>
                    }
                >
                    <BrutChart
                        options={chartOptions()}
                        height="320px"
                        onZoom={setZoomedWindow}
                    />
                </Show>
            </div>
        </div>
    );
}
