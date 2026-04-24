import { useQueryClient } from "@tanstack/solid-query";
import { createEffect, onCleanup } from "solid-js";
import type { paths as SquadEasyPaths } from "~/api/squadEasyApi";
import type { paths as TrackerServerPaths } from "~/api/trackerServerApi";
import {
    API_BASE_URL,
    getHistoricalTeamPointsQueryOptions,
    getHistoricalUserActivityPointsQueryOptions,
    getHistoricalUserPointsQueryOptions,
    getMyTeamQueryOptions,
    getMyUserQueryOptions,
    getSeasonRankingQueryOptions,
    getTeamQueryOptions,
    getUserByIdQueryOptions,
    getUserStatisticsQueryOptions,
    useGetUserToken,
} from "~/api/client";
import { useMainUser } from "./MainUserProvider";

const DEFAULT_RETRY_DELAY_MS = 5000;
const getQueryKeyOnlyToken = async () => {
    throw new Error("Query key helper should not execute the query function");
};
const disableKeyOnlyQuery = () => false;
const seasonRankingQueryKey = getSeasonRankingQueryOptions(
    getQueryKeyOnlyToken,
).queryKey;
const historicalTeamPointsQueryRootKey =
    getHistoricalTeamPointsQueryOptions(
        () => 0,
        () => 0,
        getQueryKeyOnlyToken,
    ).queryKey[0];
const historicalUserPointsQueryRootKey =
    getHistoricalUserPointsQueryOptions(
        () => "",
        () => 0,
        () => 0,
        getQueryKeyOnlyToken,
    ).queryKey[0];
const historicalUserActivityPointsQueryRootKey =
    getHistoricalUserActivityPointsQueryOptions(
        () => "",
        () => 0,
        () => 0,
        getQueryKeyOnlyToken,
    ).queryKey[0];
const userStatisticsQueryRootKey = getUserStatisticsQueryOptions(
    () => "",
    getQueryKeyOnlyToken,
).queryKey[0];
const userByIdQueryRootKey = getUserByIdQueryOptions(
    () => "",
    getQueryKeyOnlyToken,
    disableKeyOnlyQuery,
).queryKey[0];
const myUserQueryRootKey = getMyUserQueryOptions(
    () => "",
    getQueryKeyOnlyToken,
).queryKey[0];
const teamQueryRootKey = getTeamQueryOptions(
    () => "",
    getQueryKeyOnlyToken,
    disableKeyOnlyQuery,
).queryKey[0];
const myTeamQueryRootKey = getMyTeamQueryOptions(
    () => "",
    getQueryKeyOnlyToken,
    disableKeyOnlyQuery,
).queryKey[0];

type SeasonRankingData = {
    teams: Array<{
        id: string;
        image?: string;
        name: string;
        points: number;
    }>;
    raw: SquadEasyPaths["/api/3.0/ranking/{type}/{seasonId}"]["get"]["responses"][200]["content"]["application/json"];
};
type SeasonRankingQueryData = {
    time: number;
    data: SeasonRankingData;
};

type HistoricalTeamPointsData =
    TrackerServerPaths["/api/v1/teams/points"]["get"]["responses"][200]["content"]["application/json"];
type HistoricalUserPointsData =
    TrackerServerPaths["/api/v1/users/{userId}/points"]["get"]["responses"][200]["content"]["application/json"];
type HistoricalUserActivityPointsData =
    TrackerServerPaths["/api/v1/users/{userId}/activity-points"]["get"]["responses"][200]["content"]["application/json"];
type UserStatisticsData =
    SquadEasyPaths["/api/2.0/users/{id}/statistics"]["get"]["responses"][200]["content"]["application/json"];

type StreamConnectedEvent = {
    event: "connected";
    data: {
        time: string;
    };
};

type TeamPointsStreamEvent = {
    event: "team-points";
    data: {
        time: string;
        items: Array<{
            teamId: string;
            points: number;
        }>;
    };
};

type UserPointsStreamEvent = {
    event: "user-points";
    data: {
        time: string;
        items: Array<{
            userId: string;
            points: number;
        }>;
    };
};

type UserActivityPointsStreamEvent = {
    event: "user-activity-points";
    data: {
        time: string;
        items: Array<{
            userId: string;
            activityId: string;
            value: number;
            points: number;
        }>;
    };
};

type UserActivityVisibilityStreamEvent = {
    event: "user-activity-visibility";
    data: {
        time: string;
        items: Array<{
            userId: string;
            isActivityPublic: boolean;
        }>;
    };
};

type PointsStreamEvent =
    | StreamConnectedEvent
    | TeamPointsStreamEvent
    | UserPointsStreamEvent
    | UserActivityPointsStreamEvent
    | UserActivityVisibilityStreamEvent;

type TeamPointsStreamItem = TeamPointsStreamEvent["data"]["items"][number];
type UserPointsStreamItem = UserPointsStreamEvent["data"]["items"][number];
type UserActivityPointsStreamItem =
    UserActivityPointsStreamEvent["data"]["items"][number];

export function RealtimePointsListener() {
    const queryClient = useQueryClient();
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);

    createEffect(() => {
        const mainUserId = mainUser.mainUserId();
        if (!mainUserId || typeof window === "undefined") {
            return;
        }

        let disposed = false;
        let retryDelayMs = DEFAULT_RETRY_DELAY_MS;
        let reconnectTimer: number | undefined;
        let activeController: AbortController | undefined;

        const clearReconnectTimer = () => {
            if (reconnectTimer !== undefined) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = undefined;
            }
        };

        const scheduleReconnect = () => {
            if (disposed || reconnectTimer !== undefined) {
                return;
            }

            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = undefined;
                void connect();
            }, retryDelayMs);
        };

        const handleEvent = (event: PointsStreamEvent) => {
            switch (event.event) {
                case "connected":
                    return;
                case "team-points":
                    applyTeamPointsEvent(queryClient, event);
                    return;
                case "user-points":
                    applyUserPointsEvent(queryClient, event);
                    return;
                case "user-activity-points":
                    applyUserActivityPointsEvent(queryClient, event);
                    return;
                case "user-activity-visibility":
                    applyUserActivityVisibilityEvent(queryClient);
                    return;
            }
        };

        const connect = async () => {
            clearReconnectTimer();

            const accessToken = await getToken();
            if (disposed) {
                return;
            }

            if (!accessToken) {
                scheduleReconnect();
                return;
            }

            const controller = new AbortController();
            activeController = controller;

            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/realtime/points`, {
                    method: "GET",
                    headers: {
                        Accept: "text/event-stream",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    cache: "no-store",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Points stream request failed with ${response.status}`);
                }

                const body = response.body;
                if (!body) {
                    throw new Error("Points stream response body is missing");
                }

                const reader = body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (!disposed) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    buffer = buffer.replace(/\r\n/g, "\n");

                    let messageBoundary = buffer.indexOf("\n\n");
                    while (messageBoundary !== -1) {
                        const rawMessage = buffer.slice(0, messageBoundary);
                        buffer = buffer.slice(messageBoundary + 2);
                        processSseMessage(rawMessage, handleEvent, (nextRetryDelayMs) => {
                            retryDelayMs = nextRetryDelayMs;
                        });
                        messageBoundary = buffer.indexOf("\n\n");
                    }
                }
            } catch (error) {
                if (!isAbortError(error)) {
                    console.error("Failed to read points stream", error);
                }
            } finally {
                if (activeController === controller) {
                    activeController = undefined;
                }

                if (!disposed) {
                    scheduleReconnect();
                }
            }
        };

        void connect();

        onCleanup(() => {
            disposed = true;
            clearReconnectTimer();
            activeController?.abort();
            activeController = undefined;
        });
    });

    return null;
}

function processSseMessage(
    rawMessage: string,
    onEvent: (event: PointsStreamEvent) => void,
    onRetryDelayChange: (retryDelayMs: number) => void,
) {
    if (!rawMessage) {
        return;
    }

    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of rawMessage.split("\n")) {
        if (!line || line.startsWith(":")) {
            continue;
        }

        const separatorIndex = line.indexOf(":");
        const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
        const rawValue = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);
        const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

        switch (field) {
            case "event":
                eventName = value || "message";
                break;
            case "data":
                dataLines.push(value);
                break;
            case "retry": {
                const retryDelayMs = Number.parseInt(value, 10);
                if (!Number.isNaN(retryDelayMs) && retryDelayMs >= 0) {
                    onRetryDelayChange(retryDelayMs);
                }
                break;
            }
        }
    }

    if (dataLines.length === 0) {
        return;
    }

    const payload = dataLines.join("\n");

    try {
        onEvent({
            event: eventName,
            data: JSON.parse(payload),
        } as PointsStreamEvent);
    } catch (error) {
        console.warn(`Ignoring malformed SSE payload for event "${eventName}"`, error);
    }
}

function applyTeamPointsEvent(
    queryClient: ReturnType<typeof useQueryClient>,
    event: TeamPointsStreamEvent,
) {
    const eventTimestamp = new Date(event.data.time).getTime();
    const pointsByTeamId = new Map(
        event.data.items.map((item) => [item.teamId, item.points]),
    );

    queryClient.setQueryData<SeasonRankingQueryData>(
        seasonRankingQueryKey,
        (current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                time: eventTimestamp,
                data: {
                    ...current.data,
                    teams: current.data.teams.map((team) => {
                        const nextPoints = pointsByTeamId.get(team.id);
                        if (nextPoints === undefined) {
                            return team;
                        }

                        return {
                            ...team,
                            points: nextPoints,
                        };
                    }),
                },
            };
        },
    );

    updateHistoricalTeamPointsQueries(queryClient, eventTimestamp, event.data.time, event.data.items);
}

function updateHistoricalTeamPointsQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    eventTimestamp: number,
    time: string,
    items: TeamPointsStreamItem[],
) {
    for (const [queryKey, current] of queryClient.getQueriesData<HistoricalTeamPointsData>({
        queryKey: [historicalTeamPointsQueryRootKey],
    })) {
        if (!Array.isArray(queryKey) || !isTimeRangeQueryKey(queryKey)) {
            continue;
        }

        const [, rangeStart, rangeEnd] = queryKey;
        if (eventTimestamp < rangeStart || eventTimestamp > rangeEnd) {
            continue;
        }

        const next = current ? [...current] : [];
        for (const item of items) {
            next.push({
                teamId: item.teamId,
                time,
                points: item.points,
            });
        }

        queryClient.setQueryData(
            queryKey,
            dedupeHistoricalEntries(next, (entry) => `${entry.teamId}:${entry.time}`),
        );
    }
}

function applyUserPointsEvent(
    queryClient: ReturnType<typeof useQueryClient>,
    event: UserPointsStreamEvent,
) {
    const eventTimestamp = new Date(event.data.time).getTime();

    for (const item of event.data.items) {
        queryClient.setQueryData<UserStatisticsData>(
            getUserStatisticsQueryOptions(
                () => item.userId,
                getQueryKeyOnlyToken,
            ).queryKey,
            (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    totalPoints: item.points,
                };
            },
        );
    }

    updateHistoricalUserPointsQueries(queryClient, eventTimestamp, event.data.time, event.data.items);
}

function updateHistoricalUserPointsQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    eventTimestamp: number,
    time: string,
    items: UserPointsStreamItem[],
) {
    const itemsByUserId = new Map(items.map((item) => [item.userId, item]));

    for (const [queryKey, current] of queryClient.getQueriesData<HistoricalUserPointsData>({
        queryKey: [historicalUserPointsQueryRootKey],
    })) {
        if (!Array.isArray(queryKey) || !isUserTimeRangeQueryKey(queryKey)) {
            continue;
        }

        const [, userId, rangeStart, rangeEnd] = queryKey;
        if (eventTimestamp < rangeStart || eventTimestamp > rangeEnd) {
            continue;
        }

        const item = itemsByUserId.get(userId);
        if (!item) {
            continue;
        }

        const next = current ? [...current] : [];
        next.push({
            userId: item.userId,
            time,
            points: item.points,
        });

        queryClient.setQueryData(
            queryKey,
            dedupeHistoricalEntries(next, (entry) => `${entry.userId}:${entry.time}`),
        );
    }
}

function applyUserActivityPointsEvent(
    queryClient: ReturnType<typeof useQueryClient>,
    event: UserActivityPointsStreamEvent,
) {
    const eventTimestamp = new Date(event.data.time).getTime();

    queryClient.invalidateQueries({
        queryKey: [userStatisticsQueryRootKey],
    });

    updateHistoricalUserActivityPointsQueries(
        queryClient,
        eventTimestamp,
        event.data.time,
        event.data.items,
    );
}

function updateHistoricalUserActivityPointsQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    eventTimestamp: number,
    time: string,
    items: UserActivityPointsStreamItem[],
) {
    const itemsByUserId = new Map<string, UserActivityPointsStreamItem[]>();
    for (const item of items) {
        const existing = itemsByUserId.get(item.userId);
        if (existing) {
            existing.push(item);
            continue;
        }

        itemsByUserId.set(item.userId, [item]);
    }

    for (const [queryKey, current] of queryClient.getQueriesData<HistoricalUserActivityPointsData>({
        queryKey: [historicalUserActivityPointsQueryRootKey],
    })) {
        if (!Array.isArray(queryKey) || !isUserTimeRangeQueryKey(queryKey)) {
            continue;
        }

        const [, userId, rangeStart, rangeEnd] = queryKey;
        if (eventTimestamp < rangeStart || eventTimestamp > rangeEnd) {
            continue;
        }

        const userItems = itemsByUserId.get(userId);
        if (!userItems || userItems.length === 0) {
            continue;
        }

        const next = current ? [...current] : [];
        for (const item of userItems) {
            next.push({
                userId: item.userId,
                activityId: item.activityId,
                time,
                value: item.value,
                points: item.points,
            });
        }

        queryClient.setQueryData(
            queryKey,
            dedupeHistoricalEntries(
                next,
                (entry) => `${entry.userId}:${entry.activityId}:${entry.time}`,
            ),
        );
    }
}

function applyUserActivityVisibilityEvent(
    queryClient: ReturnType<typeof useQueryClient>,
) {
    queryClient.invalidateQueries({
        queryKey: [userStatisticsQueryRootKey],
    });
    queryClient.invalidateQueries({
        queryKey: [userByIdQueryRootKey],
    });
    queryClient.invalidateQueries({
        queryKey: [myUserQueryRootKey],
    });
    queryClient.invalidateQueries({
        predicate: (query) =>
            Array.isArray(query.queryKey) &&
            (query.queryKey[0] === teamQueryRootKey ||
                query.queryKey[0] === myTeamQueryRootKey),
    });
}

function dedupeHistoricalEntries<T extends { time: string }>(
    entries: T[],
    getKey: (entry: T) => string,
) {
    const deduped = new Map<string, T>();

    for (const entry of entries) {
        deduped.set(getKey(entry), entry);
    }

    return Array.from(deduped.values()).sort((left, right) => {
        return getEntryTimestamp(left) - getEntryTimestamp(right);
    });
}

function getEntryTimestamp(entry: { time: string }) {
    return new Date(entry.time).getTime();
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}

function isTimeRangeQueryKey(queryKey: unknown[]): queryKey is [string, number, number] {
    return (
        typeof queryKey[1] === "number" &&
        typeof queryKey[2] === "number"
    );
}

function isUserTimeRangeQueryKey(
    queryKey: unknown[],
): queryKey is [string, string, number, number] {
    return (
        typeof queryKey[1] === "string" &&
        typeof queryKey[2] === "number" &&
        typeof queryKey[3] === "number"
    );
}
