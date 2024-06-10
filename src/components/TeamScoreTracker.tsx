import {
    Accessor,
    For,
    ParentProps,
    Setter,
    Show,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    untrack,
    useContext,
} from "solid-js";
import {
    teamQueryOptions,
    useGetUserToken,
    useSeasonRankingQuery,
    useTeamQuery,
    useUserStatisticsQuery,
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
    debounceStorageMs: number,
    query: CreateQueryResult<T, unknown>,
    mapResult: (t: T) => K,
    localData: Accessor<K[] | undefined>,
    setLocalData: Setter<K[] | undefined>,
) {
    createEffect(() => {
        // Get previous data stored on device
        void storage.getItem<K[]>(storageKey).then((storedData) => {
            const queryData = untrack(() => query.data);
            if (storedData == null) {
                setLocalData(queryData ? [mapResult(queryData)] : []);
                storedData = [];
            } else {
                setLocalData(
                    queryData
                        ? storedData.concat(mapResult(queryData))
                        : storedData,
                );
            }
        });
    });

    const lastEntryMs = createMemo(() => {
        const ld = localData();
        if (!ld) return;
        return Math.max(...ld.map((x) => x.timestamp));
    });

    // Every time we receive new query data, set local signal to mapped value
    createEffect(() => {
        // wait until local history is retrieved
        if (!!untrack(() => localData())) return;
        if (!query.data) return;
        if (
            new Date().getTime() - (untrack(() => lastEntryMs()) ?? 0) <
            debounceStorageMs
        )
            return;

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
    const teamsQuery = useSeasonRankingQuery(
        () => true,
        2 * 60 * 60 * 1000,
        true,
    );

    const [localData, setLocalData] = createSignal<StoredTeamsData[]>();
    const teamsData = queryAndStore(
        teamsStorage,
        "teamsData",
        1 * 60 * 60 * 1000,
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

    return (
        <teamsDataCtx.Provider value={() => localData() ?? []}>
            <TeamUsersScoreTracker teamsIds={first10TeamsIds()}>
                {props.children}
            </TeamUsersScoreTracker>
        </teamsDataCtx.Provider>
    );
}

const teamUsersCtx =
    createContext<
        Accessor<
            Record<
                string,
                { users: Record<string, number>; timestamp: number }[]
            >
        >
    >();

export function useTeamsUsersScore() {
    const ctxValue = useContext(teamUsersCtx);
    if (!ctxValue) throw new Error("Missing teamUsersCtx provider!");
    return ctxValue;
}

function TeamUsersScoreTracker(props: ParentProps<{ teamsIds: string[] }>) {
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
    const queriesOptions = createMemo(() =>
        props.teamsIds.map((teamId) =>
            teamQueryOptions(
                () => teamId,
                getToken,
                () => true,
                2 * 60 * 60 * 1000,
                true,
            ),
        ),
    );
    const teamsQueries = createQueries(() => ({
        queries: queriesOptions(),
    }));

    const [localData, setLocalData] = createSignal<
        Record<string, { users: Record<string, number>; timestamp: number }[]>
    >({});

    const [migrationDone, setMigrationDone] = createSignal(false);
    const [dataToMigrate, setDataToMigrate] =
        createSignal<{ users: Record<string, number>; timestamp: number }[]>();
    createEffect(() => {
        // Migrate old data
        teamsStorage
            .getItem<
                { users: Record<string, number>; timestamp: number }[]
            >("teamUserPoints")
            .then((oldData) => {
                if (!oldData) return setMigrationDone(true);
                setDataToMigrate(oldData);
            });
    });

    createEffect(() => {
        if (migrationDone()) return;
        const dm = dataToMigrate();
        if (!dm) return;
        if (dm.length === 0) {
            teamsStorage.removeItem("teamUserPoints");
            setMigrationDone(true);
            return;
        }

        const foundData = teamsQueries
            .map((x) => {
                if (!x.data) return;
                const userId = x.data.users[0]?.id;
                if (!userId) return;
                return {
                    userId,
                    teamId: x.data.id,
                };
            })
            .filter((x) => !!x)
            .map((x) => x as NonNullable<typeof x>)
            .map((x) => {
                return {
                    teamId: x.teamId,
                    dataForTeam: dm.filter(
                        (dmus) =>
                            !!Object.keys(dmus.users).find(
                                (u) => u === x.userId,
                            ),
                    ),
                };
            });
        if (foundData.length > 0) {
            foundData.forEach((x) => {
                teamsStorage.setItem(
                    `teamUserPoints-${x.teamId}`,
                    x.dataForTeam,
                );
            });
            const newDataToMigrate = dm.filter(
                (d) =>
                    !foundData.find(
                        (x) => !!x.dataForTeam.find((y) => y === d),
                    ),
            );
            setDataToMigrate((old) =>
                !old || old.length === newDataToMigrate.length
                    ? old
                    : newDataToMigrate,
            );
        }

        if (!teamsQueries.some((q) => !q.data)) {
            // All queries are completed, mark migration as completed now
            teamsStorage.removeItem("teamUserPoints");
            setMigrationDone(true);
            setDataToMigrate(undefined);
        }
    });

    const usersIds = createMemo(() => {
        const ld = localData();
        const teamIds = Object.keys(ld);
        const localusersFromTeamsPoints = teamIds.map((x) => ld[x]!);
        const userIds = new Set(
            localusersFromTeamsPoints
                .flatMap((x) => x)
                .flatMap((x) => Object.keys(x.users)),
        );
        return Array.from(userIds);
    });

    return (
        <teamUsersCtx.Provider value={() => localData() ?? []}>
            <Show when={migrationDone()}>
                <For each={props.teamsIds}>
                    {(teamId) => (
                        <TrackTeamUsersScore
                            teamId={teamId}
                            parentData={localData}
                            setParentData={setLocalData}
                        />
                    )}
                </For>
            </Show>
            <UsersStatisticsTracker usersIds={usersIds()}>
                {props.children}
            </UsersStatisticsTracker>
        </teamUsersCtx.Provider>
    );
}

function TrackTeamUsersScore(
    props: ParentProps<{
        teamId: string;
        parentData: Accessor<
            Record<
                string,
                { users: Record<string, number>; timestamp: number }[]
            >
        >;
        setParentData: Setter<
            Record<
                string,
                { users: Record<string, number>; timestamp: number }[]
            >
        >;
    }>,
) {
    const [localData, setLocalData] =
        createSignal<{ users: Record<string, number>; timestamp: number }[]>();

    const teamQuery = useTeamQuery(
        () => props.teamId,
        () => true,
        2 * 60 * 60 * 1000,
    );

    queryAndStore(
        teamsStorage,
        `teamUserPoints-${props.teamId}`,
        1 * 60 * 60 * 1000,
        teamQuery,
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
    );

    // Store local signal to db
    createEffect(() => {
        const localD = localData();
        if (!localD) return;
        teamsStorage.setItem(`teamUserPoints-${props.teamId}`, localD);
    });

    createEffect(() => {
        const ld = localData();
        if (!ld) return;
        props.setParentData((old) => ({
            ...old,
            [props.teamId]: ld,
        }));
    });

    return <>{props.children}</>;
}

const userStatisticsCtx = createContext<
    Accessor<
        Record<
            string,
            {
                activities: Record<string, { value: number; points: number }>;
                timestamp: number;
            }[]
        >
    >
>();

export function useUserStatistics() {
    const ctxValue = useContext(userStatisticsCtx);
    if (!ctxValue) throw new Error("Missing teamUsersCtx provider!");
    return ctxValue;
}

function UsersStatisticsTracker(props: ParentProps<{ usersIds: string[] }>) {
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
    const queriesOptions = createMemo(() =>
        props.usersIds.map((x) =>
            userStatisticsQueryOptions(
                () => x,
                getToken,
                () => true,
                2 * 60 * 60 * 1000,
                true,
            ),
        ),
    );
    const usersStatisticsQueries = createQueries(() => ({
        queries: queriesOptions(),
    }));

    const [localData, setLocalData] = createSignal<
        Record<
            string,
            {
                activities: Record<string, { value: number; points: number }>;
                timestamp: number;
            }[]
        >
    >({});

    const [migrationDone, setMigrationDone] = createSignal(false);
    const [dataToMigrate, setDataToMigrate] = createSignal<
        {
            userId: string;
            activities: Record<string, { value: number; points: number }>;
            timestamp: number;
        }[]
    >();
    createEffect(() => {
        // Migrate old data
        teamsStorage
            .getItem<
                {
                    userId: string;
                    activities: Record<
                        string,
                        { value: number; points: number }
                    >;
                    timestamp: number;
                }[]
            >("userStatistics")
            .then((oldData) => {
                if (!oldData) return setMigrationDone(true);
                setDataToMigrate(oldData);
            });
    });

    createEffect(() => {
        if (migrationDone()) return;
        const dm = dataToMigrate();
        if (!dm) return;
        if (dm.length === 0) {
            teamsStorage.removeItem("userStatistics");
            setMigrationDone(true);
            return;
        }

        const foundData = usersStatisticsQueries
            .map((x) => {
                if (!x.data) return;
                const userId = x.data.id;
                if (!userId) return;
                return userId;
            })
            .filter((x) => !!x)
            .map((x) => x as NonNullable<typeof x>)
            .map((x) => {
                return {
                    userId: x,
                    dataForUser: dm.filter((dmus) => dmus.userId === x),
                };
            });
        if (foundData.length > 0) {
            foundData.forEach((x) => {
                teamsStorage.setItem<
                    {
                        activities: Record<
                            string,
                            { value: number; points: number }
                        >;
                        timestamp: number;
                    }[]
                >(
                    `userStatistics-${x.userId}`,
                    x.dataForUser.map((x) => ({
                        timestamp: x.timestamp,
                        activities: x.activities,
                    })),
                );
            });
            const newDataToMigrate = dm.filter(
                (d) => !foundData.find((x) => x.userId === d.userId),
            );
            setDataToMigrate((old) =>
                !old || old.length === newDataToMigrate.length
                    ? old
                    : newDataToMigrate,
            );
        }

        if (!usersStatisticsQueries.some((q) => !q.data)) {
            // All queries are completed, mark migration as completed now
            teamsStorage.removeItem("userStatistics");
            setMigrationDone(true);
            setDataToMigrate(undefined);
        }
    });

    return (
        <userStatisticsCtx.Provider value={localData}>
            <Show when={migrationDone()}>
                <For each={props.usersIds}>
                    {(userId) => (
                        <TrackUserStatistics
                            userId={userId}
                            setParentData={setLocalData}
                        />
                    )}
                </For>
            </Show>
            {props.children}
        </userStatisticsCtx.Provider>
    );
}

function TrackUserStatistics(props: {
    userId: string;
    setParentData: Setter<
        Record<
            string,
            {
                activities: Record<string, { value: number; points: number }>;
                timestamp: number;
            }[]
        >
    >;
}) {
    const query = useUserStatisticsQuery(
        () => props.userId,
        2 * 60 * 60 * 1000,
        true,
    );
    const [localData, setLocalData] = createSignal<
        {
            activities: Record<string, { value: number; points: number }>;
            timestamp: number;
        }[]
    >();
    queryAndStore(
        teamsStorage,
        `userStatistics-${props.userId}`,
        1 * 60 * 60 * 1000,
        query,
        (t) => ({
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
    );

    // Store local signal to db
    createEffect(() => {
        const localD = localData();
        if (!localD) return;
        teamsStorage.setItem(`userStatistics-${props.userId}`, localD);
    });

    createEffect(() => {
        const ld = localData();
        if (!ld) return;
        props.setParentData((old) => ({
            ...old,
            [props.userId]: ld,
        }));
    });

    return <></>;
}
