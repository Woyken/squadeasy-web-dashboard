import createClient from "openapi-fetch";
import { paths } from "./squadEasyApi";
import { paths as trackerServerPaths } from "./trackerServerApi";
import {
    useMutation,
    useQueries,
    keepPreviousData,
    queryOptions,
    useQueryClient,
} from "@tanstack/solid-query";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import { Accessor, createMemo } from "solid-js";
import { parseJwt } from "~/utils/parseJwt";
import { clampRangeToNow } from "~/utils/timeRange";
import { useMainUser } from "~/components/MainUserProvider";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
    configuredApiBaseUrl && configuredApiBaseUrl.length > 0
        ? configuredApiBaseUrl
        : "http://localhost:3000"
).replace(/\/+$/, "");

export const squadEasyClient = createClient<paths>({
    baseUrl: `${API_BASE_URL}/squadeasy/proxy`,
});

export const trackerServerClient = createClient<trackerServerPaths>({
    baseUrl: API_BASE_URL,
});

export type HistoricalTeamMembership =
    trackerServerPaths["/api/team-memberships/{teamId}"]["get"]["responses"][200]["content"]["application/json"][number];
type HistoricalTeamPointsEntry =
    trackerServerPaths["/api/team-points"]["get"]["responses"][200]["content"]["application/json"][number];
type SquadEasyUserProfile =
    paths["/api/3.0/user-profile/{userId}"]["get"]["responses"][200]["content"]["application/json"];
type StoredUserProfile =
    trackerServerPaths["/api/stored-user-profile/{userId}"]["get"]["responses"][200]["content"]["application/json"];
export type StoredTeamProfile =
    trackerServerPaths["/api/stored-team-profile/{teamId}"]["get"]["responses"][200]["content"]["application/json"];

export type ResolvedUserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    teamName?: string | null;
    imageUrl?: string | null;
};

export type ResolvedSeasonTeam = {
    id: string;
    name: string;
    image?: string | null;
    points: number;
};

function splitFullName(name: string | undefined) {
    const [firstName = "", ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: firstName || undefined,
        lastName: rest.length > 0 ? rest.join(" ") : undefined,
    };
}

function mapSquadEasyUserProfile(profile: SquadEasyUserProfile): ResolvedUserProfile {
    const { firstName, lastName } = splitFullName(profile.name);
    return {
        id: profile.id,
        firstName,
        lastName,
        teamName: profile.teamName,
        imageUrl: profile.imageUrl,
    };
}

async function getStoredUserProfile(
    accessToken: string,
    userId: string,
): Promise<StoredUserProfile | undefined> {
    const result = await trackerServerClient.GET("/api/stored-user-profile/{userId}", {
        params: {
            path: {
                userId,
            },
        },
        headers: {
            authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.response.status === 404) {
        return undefined;
    }

    if (!result.data) {
        throw new Error(
            `Get stored user profile failed ${JSON.stringify(result.error)}`,
        );
    }

    return result.data;
}

async function getStoredTeamProfile(
    accessToken: string,
    teamId: string,
): Promise<StoredTeamProfile | undefined> {
    const result = await trackerServerClient.GET("/api/stored-team-profile/{teamId}", {
        params: {
            path: {
                teamId,
            },
        },
        headers: {
            authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.response.status === 404) {
        return undefined;
    }

    if (!result.data) {
        throw new Error(
            `Get stored team profile failed ${JSON.stringify(result.error)}`,
        );
    }

    return result.data;
}

function getLatestTrackedTeamPoints(
    historicalPoints: ReadonlyArray<HistoricalTeamPointsEntry>,
) {
    const latestByTeam = new Map<string, { time: number; points: number }>();

    for (const entry of historicalPoints) {
        const timestamp = new Date(entry.time).getTime();
        const current = latestByTeam.get(entry.teamId);

        if (!current || timestamp >= current.time) {
            latestByTeam.set(entry.teamId, { time: timestamp, points: entry.points });
        }
    }

    return latestByTeam;
}

export function mergeSeasonTeams(
    liveTeams: ReadonlyArray<{
        id: string;
        name: string;
        image?: string | null;
        points: number;
    }>,
    storedTeams: ReadonlyArray<StoredTeamProfile>,
    historicalPoints: ReadonlyArray<HistoricalTeamPointsEntry>,
): ResolvedSeasonTeam[] {
    const trackedPoints = getLatestTrackedTeamPoints(historicalPoints);
    const merged = new Map<string, ResolvedSeasonTeam>();

    for (const team of liveTeams) {
        merged.set(team.id, {
            id: team.id,
            name: team.name,
            image: team.image ?? null,
            points: team.points,
        });
    }

    for (const team of storedTeams) {
        const latestPoints = trackedPoints.get(team.teamId);
        if (!latestPoints || merged.has(team.teamId)) {
            continue;
        }

        merged.set(team.teamId, {
            id: team.teamId,
            name: team.name,
            image: team.imageUrl,
            points: latestPoints.points,
        });
    }

    return [...merged.values()].sort(
        (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    );
}

export function getMyChallengeQueryOptions(
    userId: Accessor<string | undefined>,
    getUserToken: () => Promise<string | undefined>,
) {
    return queryOptions({
        queryKey: ["/api/3.0/my/challenge", userId()],
        queryFn: async () => {
            const token = await getUserToken();
            if (!token) throw new Error(`token missing for user ${userId()}`);
            const result = await squadEasyClient.GET("/api/3.0/my/challenge", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        enabled: !!userId(),
        staleTime: 1 * 60 * 60 * 1000,
    });
}

export function getUserByIdQueryOptions(
    userId: Accessor<string>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions<ResolvedUserProfile>({
        queryKey: ["/api/3.0/user-profile/{userId}", userId()],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error(`token missing for user ${userId()}`);
            const result = await squadEasyClient.GET(
                "/api/3.0/user-profile/{userId}",
                {
                    params: {
                        path: {
                            userId: userId(),
                        },
                    },
                    headers: {
                        authorization: `Bearer ${token}`,
                    },
                },
            );

            if (result.data) {
                return mapSquadEasyUserProfile(result.data);
            }

            const fallback = await getStoredUserProfile(token, userId());
            if (!fallback) {
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`,
                );
            }

            return {
                id: fallback.userId,
                firstName: fallback.firstName,
                lastName: fallback.lastName,
                teamName: fallback.teamName,
                imageUrl: fallback.imageUrl,
            };
        },
        staleTime: 5 * 60 * 1000,
        enabled: enabled?.() ?? true,
    });
}

export function getMyUserQueryOptions(
    userId: Accessor<string>,
    getAccessToken: () => Promise<string | undefined>,
) {
    return queryOptions({
        queryKey: ["/api/2.0/my/user", userId()],
        queryFn: async () => {
            const token = await getAccessToken();
            const currentUserId = userId();
            if (!token) throw new Error(`token missing for user ${currentUserId}`);
            const result = await squadEasyClient.GET("/api/2.0/my/user", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function getMyTeamQueryOptions(
    userId: Accessor<string>,
    getAccessToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: ["/api/2.0/my/team", userId()],
        queryFn: async () => {
            const token = await getAccessToken();
            const currentUserId = userId();
            if (!token) throw new Error(`token missing for user ${currentUserId}`);
            const result = await squadEasyClient.GET("/api/2.0/my/team", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: (enabled?.() ?? true) && !!userId(),
    });
}

export function getSeasonRankingQueryOptions(
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    return queryOptions({
        queryKey: ["/api/2.0/my/ranking/season"],
        queryFn: async () => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");
            const result = await squadEasyClient.GET(
                "/api/3.0/ranking/{type}/{seasonId}",
                {
                    params: {
                        path: {
                            type: "season",
                            seasonId: "current",
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                },
            );
            if (!result.data)
                throw new Error(
                    `Get teams failed ${JSON.stringify(result.error)}`,
                );
            return {
                time: Date.now(),
                data: {
                    teams: (result.data.elements ?? []).map((team) => ({
                        id: team.id,
                        image: team.image,
                        name: team.name,
                        points: team.points ?? 0,
                    })),
                    raw: result.data,
                },
            };
        },
        staleTime: 5 * 60 * 1000,
        enabled: enabled?.() ?? true,
        refetchInterval,
        refetchIntervalInBackground,
        placeholderData: keepPreviousData,
    });
}

export function useStoredTeamQueries(teamIds: Accessor<string[]>) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    return useQueries(() => ({
        queries: teamIds().map((teamId) =>
            getStoredTeamProfileQueryOptions(
                () => teamId,
                getToken,
                () => !!teamId && !!mainUser.mainUserId(),
            ),
        ),
    }));
}

export function getStoredTeamProfileQueryOptions(
    teamId: Accessor<string>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: ["/api/stored-team-profile/{teamId}", teamId()],
        queryFn: async () => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            return getStoredTeamProfile(accessToken, teamId());
        },
        staleTime: 5 * 60 * 1000,
        enabled: (enabled?.() ?? true) && !!teamId(),
    });
}

export function getTeamQueryOptions(
    teamId: Accessor<string | undefined>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    return queryOptions({
        queryKey: ["/api/2.0/teams/{id}", teamId()],
        queryFn: async () => {
            const tId = teamId();
            if (!tId) throw new Error("Missing team id!");
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");
            const result = await squadEasyClient.GET("/api/2.0/teams/{id}", {
                params: {
                    path: {
                        id: tId,
                    },
                },
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Get team failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval,
        refetchIntervalInBackground,
        enabled: (enabled?.() ?? true) && !!teamId(),
    });
}

export function getUserStatisticsQueryOptions(
    userId: Accessor<string>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    return queryOptions({
        queryKey: ["/api/2.0/users/{id}/statistics", userId()],
        queryFn: async () => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");
            const result = await squadEasyClient.GET(
                "/api/2.0/users/{id}/statistics",
                {
                    params: {
                        path: {
                            id: userId(),
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                },
            );
            if (!result.data)
                throw new Error(
                    `Get user statistics failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        staleTime: 20 * 60 * 1000,
        enabled: enabled?.() ?? true,
        refetchInterval,
        refetchIntervalInBackground,
    });
}

export function getSocialPostsQueryOptions(
    userId: Accessor<string>,
    getToken: () => Promise<string | undefined>,
    sincePostId?: Accessor<string | undefined>,
    refetchIntervalInBackground?: Accessor<number>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: ["/api/3.0/social/posts", userId(), sincePostId?.()],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error(`token missing for user ${userId()}`);
            const result = await squadEasyClient.GET("/api/4.0/social/posts", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`,
                );
            return result.data.elements ?? [];
        },
        staleTime:
            sincePostId?.() === undefined ? 5 * 60 * 1000 : 30 * 60 * 1000,
        gcTime: sincePostId?.() === undefined ? 5 * 60 * 1000 : 30 * 60 * 1000,
        refetchInterval: refetchIntervalInBackground?.(),
        refetchIntervalInBackground: !!refetchIntervalInBackground,
        enabled: !!userId() && (enabled?.() ?? true),
    });
}

export function useLikePostMutation(userId: Accessor<string>) {
    const getUserToken = useGetUserToken(userId);
    return useMutation(() => ({
        mutationFn: async (targetPostId: string) => {
            const accessToken = await getUserToken();
            if (!accessToken)
                throw new Error(`token missing for user ${userId()}`);
            const likePostResult = await squadEasyClient.PUT(
                "/api/3.0/social/posts/{post_id}/like",
                {
                    params: {
                        path: {
                            post_id: targetPostId,
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                },
            );
            if (!likePostResult.data)
                throw new Error(
                    `Like post failed ${JSON.stringify(likePostResult.error)}`,
                );
            return likePostResult.data;
        },
    }));
}

export function useBoostMutation(userId: Accessor<string>) {
    const client = useQueryClient();
    const getUserToken = useGetUserToken(userId);
    return useMutation(() => ({
        mutationFn: async (targetUserId: string) => {
            const accessToken = await getUserToken();
            if (!accessToken)
                throw new Error(`token missing for user ${userId()}`);
            const boostResult = await squadEasyClient.POST(
                "/api/2.0/users/{id}/boost",
                {
                    params: {
                        path: {
                            id: targetUserId,
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                },
            );
            if (boostResult.response.status >= 400)
                throw new Error(
                    `Boost failed ${JSON.stringify(boostResult.error)}`,
                );
            return boostResult.data;
        },
        onSuccess: () => {
            client.invalidateQueries({
                queryKey: getMyTeamQueryOptions(userId, getUserToken).queryKey,
            });
        },
    }));
}

export function useGetUserToken(userId: Accessor<string | undefined>) {
    const usersTokens = useUsersTokens();
    const token = createMemo(() => {
        const id = userId();
        if (!id) return;
        const token = usersTokens().tokens.get(id);
        return token;
    });
    const refreshTokenMutation = useRefreshTokenMutation();
    return async () => {
        const currentToken = token();
        if (!currentToken) return;
        const tokenExpiresAt = parseJwt(currentToken.accessToken).exp * 1000;
        const isExpired = tokenExpiresAt - 5 * 60 * 1000 < new Date().getTime();
        if (!isExpired) return currentToken.accessToken;

        const refreshed = await refreshTokenMutation.mutateAsync({
            accessToken: currentToken.accessToken,
            refreshToken: currentToken.refreshToken,
        });
        return refreshed.accessToken;
    };
}

export function useRefreshTokenMutation() {
    const usersTokens = useUsersTokens();
    return useMutation(() => ({
        mutationKey: ["/api/3.0/auth/refresh-token"],
        mutationFn: async (variables: {
            accessToken: string;
            refreshToken: string;
        }) => {
            const loginResult = await squadEasyClient.POST(
                "/api/3.0/auth/refresh-token",
                {
                    params: {
                        header: {
                            Authorization: `Bearer ${variables.accessToken}`,
                            "Refresh-Token": variables.refreshToken,
                        },
                    },
                },
            );
            if (!loginResult.data)
                throw new Error(
                    `Login failed ${JSON.stringify(loginResult.error)}`,
                );

            const userId = parseJwt(loginResult.data.accessToken).id;
            return {
                id: userId,
                accessToken: loginResult.data.accessToken,
                refreshToken: loginResult.data.refreshToken,
            };
        },
        onSuccess: (data) => {
            usersTokens().setToken(
                data.id,
                data.accessToken,
                data.refreshToken,
            );
        },
    }));
}

export function useLoginMutation() {
    const client = useQueryClient();
    const usersTokens = useUsersTokens();
    return useMutation(() => ({
        mutationKey: ["/api/3.0/auth/login"],
        mutationFn: async (variables: { email: string; password: string }) => {
            const loginResult = await squadEasyClient.POST(
                "/api/3.0/auth/login",
                {
                    body: {
                        email: variables.email,
                        password: variables.password,
                    },
                },
            );
            if (!loginResult.data)
                throw new Error(
                    `Login failed ${JSON.stringify(loginResult.error)}`,
                );

            const myUserResult = await squadEasyClient.GET("/api/2.0/my/user", {
                headers: {
                    authorization: `Bearer ${loginResult.data.accessToken}`,
                },
            });
            if (!myUserResult.data)
                throw new Error(
                    `Get My User details failed ${JSON.stringify(
                        myUserResult.error,
                    )}`,
                );

            return {
                myUser: myUserResult.data,
                accessToken: loginResult.data.accessToken,
                refreshToken: loginResult.data.refreshToken,
            };
        },
        onSuccess: (data) => {
            client.setQueryData(
                getMyUserQueryOptions(
                    () => data.myUser.id,
                    async () => data.accessToken,
                ).queryKey,
                () => {
                    return data.myUser;
                },
            );

            usersTokens().setToken(
                data.myUser.id,
                data.accessToken,
                data.refreshToken,
            );
        },
    }));
}

export function getHistoricalTeamPointsQueryOptions(
    start: Accessor<number>,
    end: Accessor<number>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: [
            "historicalTeamPoints",
            clampRangeToNow(start(), end()).start,
            clampRangeToNow(start(), end()).end,
        ],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const range = clampRangeToNow(start(), end());

            const result = await trackerServerClient.GET("/api/team-points", {
                params: {
                    query: {
                        startDate: new Date(range.start).toISOString(),
                        endDate: new Date(range.end).toISOString(),
                    },
                },
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                signal,
            });

            if (!result.data) {
                throw new Error(
                    `Get team points failed ${JSON.stringify(result.error)}`,
                );
            }

            return result.data;
        },
        staleTime: 1000 * 60 * 1, // 1 minutes
        deferStream: true,
        gcTime: 1000 * 60 * 5, // 5 minutes
        enabled: typeof window !== "undefined" && (enabled?.() ?? true),
        placeholderData: keepPreviousData,
    });
}

export function getHistoricalTeamMembershipsQueryOptions(
    teamId: Accessor<string>,
    start: Accessor<number>,
    end: Accessor<number>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: [
            "historicalTeamMemberships",
            teamId(),
            clampRangeToNow(start(), end()).start,
            clampRangeToNow(start(), end()).end,
        ],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const range = clampRangeToNow(start(), end());

            const result = await trackerServerClient.GET(
                "/api/team-memberships/{teamId}",
                {
                    params: {
                        path: {
                            teamId: teamId(),
                        },
                        query: {
                            startDate: new Date(range.start).toISOString(),
                            endDate: new Date(range.end).toISOString(),
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                    signal,
                },
            );

            if (!result.data) {
                throw new Error(
                    `Get team memberships failed ${JSON.stringify(result.error)}`,
                );
            }

            return result.data;
        },
        staleTime: 1000 * 60 * 1,
        gcTime: 1000 * 60 * 5,
        deferStream: true,
        enabled:
            typeof window !== "undefined" &&
            !!teamId() &&
            (enabled?.() ?? true),
        placeholderData: keepPreviousData,
    });
}

export function useHistoricalUserPointsQueries(
    userIds: Accessor<string[]>,
    start: Accessor<number>,
    end: Accessor<number>,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    return useQueries(() => ({
        queries: userIds().map((userId) =>
            getHistoricalUserPointsQueryOptions(
                () => userId,
                start,
                end,
                getToken,
                () => !!mainUser.mainUserId(),
            ),
        ),
    }));
}

export function getHistoricalUserPointsQueryOptions(
    userId: Accessor<string>,
    start: Accessor<number>,
    end: Accessor<number>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: [
            "historicalUserPoints",
            userId(),
            clampRangeToNow(start(), end()).start,
            clampRangeToNow(start(), end()).end,
        ],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const range = clampRangeToNow(start(), end());

            const result = await trackerServerClient.GET(
                "/api/user-points/{userId}",
                {
                    params: {
                        path: {
                            userId: userId(),
                        },
                        query: {
                            startDate: new Date(range.start).toISOString(),
                            endDate: new Date(range.end).toISOString(),
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                    signal,
                },
            );

            if (!result.data) {
                throw new Error(
                    `Get user points failed ${JSON.stringify(result.error)}`,
                );
            }

            return result.data;
        },
        staleTime: 1000 * 60 * 1, // 1 minutes
        deferStream: true,
        gcTime: 1000 * 60 * 5, // 5 minutes
        enabled: typeof window !== "undefined" && (enabled?.() ?? true),
        placeholderData: keepPreviousData,
    });
}

export function getHistoricalUserActivityPointsQueryOptions(
    userId: Accessor<string>,
    start: Accessor<number>,
    end: Accessor<number>,
    getToken: () => Promise<string | undefined>,
    enabled?: Accessor<boolean>,
) {
    return queryOptions({
        queryKey: [
            "historicalUserActivityPoints",
            userId(),
            clampRangeToNow(start(), end()).start,
            clampRangeToNow(start(), end()).end,
        ],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const range = clampRangeToNow(start(), end());

            const result = await trackerServerClient.GET(
                "/api/user-activity-points/{userId}",
                {
                    params: {
                        path: {
                            userId: userId(),
                        },
                        query: {
                            startDate: new Date(range.start).toISOString(),
                            endDate: new Date(range.end).toISOString(),
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                    signal,
                },
            );

            if (!result.data) {
                throw new Error(
                    `Get user activity points failed ${JSON.stringify(result.error)}`,
                );
            }

            return result.data;
        },
        staleTime: 1000 * 60 * 1, // 1 minutes
        gcTime: 1000 * 60 * 5, // 5 minutes
        enabled: typeof window !== "undefined" && (enabled?.() ?? true),
        placeholderData: keepPreviousData,
    });
}
