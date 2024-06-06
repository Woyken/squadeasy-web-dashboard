import {
    Accessor,
    ParentProps,
    Setter,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    useContext,
} from "solid-js";
import {
    teamQueryOptions,
    useGetUserToken,
    useSeasonRankingQuery,
    userStatisticsQueryOptions,
} from "~/api/client";
import localForage from "localforage";
import { CreateQueryResult, createQueries } from "@tanstack/solid-query";
import { useUsersTokens } from "./UsersTokensProvider";

const teamsStorage = localForage.createInstance({
    name: "teamsStorage2",
});

interface StoredTeamsData {
    timestamp: number;
    teamsData: Record<string, number>;
}

function queryAndStore<T, K extends { timestamp: number }>(
    storage: LocalForage,
    storageKey: string,
    fetchEveryMs: number,
    query: CreateQueryResult<T>,
    mapResult: (t: T) => K,
    localData: Accessor<K[] | undefined>,
    setLocalData: Setter<K[] | undefined>,
) {
    // Schedule refetching in consistent intervals
    createEffect(() => {
        let ignore = false;
        onCleanup(() => (ignore = true));
        let timeoutVal: ReturnType<typeof setTimeout> | undefined = undefined;
        onCleanup(() => clearTimeout(timeoutVal));
        let intervalVal: ReturnType<typeof setInterval> | undefined = undefined;
        onCleanup(() => clearInterval(intervalVal));

        // Get previous data stored on device
        void storage.getItem<K[]>(storageKey).then((storedData) => {
            if (storedData == null) {
                setLocalData([]);
                storedData = [];
            } else setLocalData(storedData);
            // Determine how old stored data is, and schedule interval to continue to fetch
            const maxDate = Math.max(...storedData.map((x) => x.timestamp));
            const currentDate = new Date().getTime();
            const fetchTimer = fetchEveryMs;
            const initialFetchDelay =
                currentDate - maxDate > fetchTimer
                    ? 0
                    : fetchTimer - (currentDate - maxDate);
            timeoutVal = setTimeout(() => {
                if (ignore) return;
                query.refetch();
                intervalVal = setInterval(() => {
                    if (ignore) return;
                    query.refetch();
                }, fetchTimer);
            }, initialFetchDelay);
        });
    });

    // Every time we receive new query data, set local signal to mapped value
    createEffect(() => {
        if (!query.data) return;
        const data = query.data;

        setLocalData((old) =>
            old ? [...old, mapResult(data)] : [mapResult(data)],
        );
    });

    return localData;
}

const teamsDataCtx = createContext<Accessor<StoredTeamsData[]>>();

export function useTeamsData() {
    const ctxValue = useContext(teamsDataCtx);
    if (!ctxValue) throw new Error("Missing teamsDataCtx provider!");
    return ctxValue;
}

export function TeamScoreTracker(props: ParentProps) {
    const teamsQuery = useSeasonRankingQuery(() => false);

    const [localData, setLocalData] = createSignal<StoredTeamsData[]>();
    const teamsData = queryAndStore(
        teamsStorage,
        "teamsData",
        2 * 60 * 60 * 1000,
        teamsQuery,
        (queryData) => ({
            teamsData: queryData.teams.reduce(
                (acc, curr) => ({
                    ...acc,
                    [curr.id]: curr.points,
                }),
                {} as Record<string, number>,
            ),
            timestamp: new Date().getTime(),
        }),
        localData,
        setLocalData,
    );

    // Store local signal to db
    createEffect(() => {
        const localD = localData();
        if (!localD) return;
        teamsStorage.setItem("teamsData", localD);
    });

    const first10TeamsIds = createMemo(() => {
        const teamsD = teamsData();
        if (!teamsD) return [];
        const latestEntry = teamsD
            .map((x) => x)
            .toSorted((a, b) => b.timestamp - a.timestamp)[0];
        if (!latestEntry) return [];
        const first10TeamsIds = Object.keys(latestEntry.teamsData)
            .map((x) => ({ id: x, points: latestEntry.teamsData[x] ?? 0 }))
            .toSorted((a, b) => b.points - a.points)
            .slice(0, 10)
            .map((x) => x.id);

        return first10TeamsIds;
    });

    createEffect(() => console.log("first10TeamsIds", first10TeamsIds()));

    useTeamUsersScoreTracker(first10TeamsIds);

    return (
        <teamsDataCtx.Provider value={() => localData() ?? []}>
            {props.children}
        </teamsDataCtx.Provider>
    );
}

function useTeamUsersScoreTracker(teamsIds: Accessor<string[]>) {
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
    const queriesOptions = createMemo(() =>
        teamsIds().map((teamId) =>
            teamQueryOptions(
                () => teamId,
                getToken,
                () => false,
            ),
        ),
    );
    const teamsQueries = createQueries(() => ({
        queries: queriesOptions(),
    }));

    const [localData, setLocalData] =
        createSignal<{ users: Record<string, number>; timestamp: number }[]>();
    const usersFromTeamsPoints = createMemo(() =>
        teamsQueries.map((query) =>
            queryAndStore(
                teamsStorage,
                `teamUserPoints`,
                2 * 60 * 60 * 1000,
                query,
                (t) => ({
                    users: t.users.reduce(
                        (acc, user) => ({
                            ...acc,
                            [user.id]: user.points,
                        }),
                        {} as Record<string, number>,
                    ),
                    timestamp: new Date().getTime(),
                }),
                localData,
                setLocalData,
            ),
        ),
    );

    // Store local signal to db
    createEffect(() => {
        const localD = localData();
        if (!localD) return;
        teamsStorage.setItem("teamUserPoints", localD);
    });

    const usersIds = createMemo(() => {
        const localusersFromTeamsPoints = usersFromTeamsPoints();
        const latestUserEntries = localusersFromTeamsPoints
            .flatMap((x) => x())
            .filter((x) => !!x)
            .map((x) => x as NonNullable<typeof x>)
            .flatMap((x) => [
                ...Object.keys(x.users).map((userId) => ({
                    id: userId,
                    points: x.users[userId]!,
                    timestamp: x.timestamp,
                })),
            ])
            .reduce(
                (acc, curr) => {
                    const existingUserEntry = acc[curr.id];
                    if (
                        !existingUserEntry ||
                        existingUserEntry.timestamp < curr.timestamp
                    ) {
                        return {
                            ...acc,
                            [curr.id]: {
                                points: curr.points,
                                timestamp: curr.timestamp,
                            },
                        };
                    }
                    return acc;
                },
                {} as Record<string, { points: number; timestamp: number }>,
            );
        const userIds = Object.keys(latestUserEntries);
        return userIds;
    });

    createEffect(() => console.log("usersIds", usersIds()));

    useUsersStatisticsTracker(usersIds);
}

function useUsersStatisticsTracker(usersIds: Accessor<string[]>) {
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
    const queriesOptions = createMemo(() =>
        usersIds().map((x) =>
            userStatisticsQueryOptions(
                () => x,
                getToken,
                () => false,
            ),
        ),
    );
    const usersStatisticsQueries = createQueries(() => ({
        queries: queriesOptions(),
    }));

    const [localData, setLocalData] = createSignal<
        {
            userId: string;
            activities: Record<string, { value: number; points: number }>;
            timestamp: number;
        }[]
    >();
    const usersStatistics = createMemo(() =>
        usersStatisticsQueries.map((query) =>
            queryAndStore(
                teamsStorage,
                "userStatistics",
                2 * 60 * 60 * 1000,
                query,
                (t) => ({
                    userId: t.id,
                    activities: t.activities.reduce(
                        (acc, curr) => {
                            return {
                                ...acc,
                                [curr.activityId]: {
                                    value: curr.value,
                                    points: curr.points,
                                },
                            };
                        },
                        {} as Record<string, { value: number; points: number }>,
                    ),
                    timestamp: new Date().getTime(),
                }),
                localData,
                setLocalData,
            ),
        ),
    );

    createEffect(() => usersStatistics());

    // Store local signal to db
    createEffect(() => {
        const localD = localData();
        if (!localD) return;
        teamsStorage.setItem("userStatistics", localD);
    });
}
