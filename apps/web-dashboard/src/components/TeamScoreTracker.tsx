import {
    Accessor,
    For,
    ParentProps,
    Setter,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    untrack,
    useContext,
} from "solid-js";
import {
    useSeasonRankingQuery,
    useTeamQuery,
    useUserStatisticsQuery,
} from "~/api/client";
import localForage from "localforage";
import { CreateQueryResult } from "@tanstack/solid-query";

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
    const [isHistoryLoaded, setIsHistoryLoaded] = createSignal(false);
    createEffect(() => {
        // Get previous data stored on device
        void storage.getItem<K[]>(storageKey).then((storedData) => {
            if (storedData == null) {
                setLocalData([]);
                storedData = [];
                setIsHistoryLoaded(true);
            } else {
                setLocalData(storedData);
                setIsHistoryLoaded(true);
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
        if (!isHistoryLoaded()) return;
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
    const [localData, setLocalData] = createSignal<
        Record<string, { users: Record<string, number>; timestamp: number }[]>
    >({});

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
            <For each={props.teamsIds}>
                {(teamId) => (
                    <TrackTeamUsersScore
                        teamId={teamId}
                        parentData={localData}
                        setParentData={setLocalData}
                    />
                )}
            </For>
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
    const [localData, setLocalData] = createSignal<
        Record<
            string,
            {
                activities: Record<string, { value: number; points: number }>;
                timestamp: number;
            }[]
        >
    >({});

    return (
        <userStatisticsCtx.Provider value={localData}>
            <For each={props.usersIds}>
                {(userId) => (
                    <TrackUserStatistics
                        userId={userId}
                        setParentData={setLocalData}
                    />
                )}
            </For>
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
