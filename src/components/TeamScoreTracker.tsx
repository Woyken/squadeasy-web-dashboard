import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useSeasonRankingQuery } from "~/api/client";
import localForage from "localforage";

const teamsStorage = localForage.createInstance({
    name: "teamsStorage",
});

interface StoredTeamsData {
    timestamp: number;
    teamsData: Record<string, number>[];
}

export function TeamScoreTracker() {
    const teamsQuery = useSeasonRankingQuery(() => false);

    const [teamsData, setTeamsData] = createSignal<StoredTeamsData[]>();

    // Schedule refetching in consistent intervals
    createEffect(() => {
        let ignore = false;
        onCleanup(() => (ignore = true));
        let timeoutVal: ReturnType<typeof setTimeout> | undefined = undefined;
        onCleanup(() => clearTimeout(timeoutVal));
        let intervalVal: ReturnType<typeof setInterval> | undefined = undefined;
        onCleanup(() => clearInterval(intervalVal));

        // Get previous data stored on device
        teamsStorage
            .getItem<StoredTeamsData[]>("teamsData")
            .then((teamsData) => {
                if (teamsData == null) return setTeamsData([]);
                setTeamsData(teamsData);
                // Determine how old stored data is, and schedule interval to continue to fetch
                const maxDate = Math.max(...teamsData.map((x) => x.timestamp));
                const currentDate = new Date().getTime();
                const fetchTimer = 2 * 60 * 60 * 1000;
                const initialFetchDelay =
                    currentDate - maxDate > fetchTimer
                        ? 0
                        : fetchTimer - (currentDate - maxDate);

                timeoutVal = setTimeout(() => {
                    if (ignore) return;
                    teamsQuery.refetch();
                    intervalVal = setInterval(() => {
                        if (ignore) return;
                        teamsQuery.refetch();
                    }, fetchTimer);
                }, initialFetchDelay);
            });
    });

    // Every time we receive new teams data, set local signal to mapped value
    createEffect(() => {
        if (!teamsQuery.data) return;

        setTeamsData((old) =>
            old
                ? [
                      ...old,
                      {
                          teamsData: teamsQuery.data.teams.map((x) => ({
                              [x.id]: x.points,
                          })),
                          timestamp: new Date().getTime(),
                      },
                  ]
                : undefined,
        );
    });

    // Store local signal to db
    createEffect(() => {
        const teamsD = teamsData();
        if (!teamsD) return;
        teamsStorage.setItem("teamsData", teamsD);
    });

    return <></>;
}
