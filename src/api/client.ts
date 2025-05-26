import createClient from "openapi-fetch";
import { paths } from "./squadEasyApi";
import {
    createMutation,
    createQueries,
    createQuery,
    keepPreviousData,
    queryOptions,
    useQueryClient,
} from "@tanstack/solid-query";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import { Accessor, createMemo } from "solid-js";
import { parseJwt } from "~/utils/parseJwt";
import { useMainUser } from "~/components/MainUserProvider";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3231";

export const squadEasyClient = createClient<paths>({
    baseUrl: "https://api-challenge.squadeasy.com",
});

export function useMyChallengeQuery(userId: Accessor<string | undefined>) {
    const getUserToken = useGetUserToken(userId);
    return createQuery(() => ({
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
    }));
}

export function useUserByIdQuery(userId: Accessor<string>) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    return createQuery(() => ({
        queryKey: ["/api/3.0/user-profile/{userId}", userId()],
        queryFn: async () => {
            const token = await getToken();
            if (!token)
                throw new Error(
                    `token missing for user ${mainUser.mainUserId()}`,
                );
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
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!mainUser.mainUserId(),
    }));
}

export function useMyUserQuery(userId: Accessor<string>) {
    const getUserToken = useGetUserToken(userId);
    return createQuery(() => {
        return getMyUserOptions(userId(), getUserToken);
    });
}

export function getMyUserOptions(
    userId: string,
    getAccessToken: () => Promise<string | undefined>,
) {
    return queryOptions({
        queryKey: ["/api/2.0/my/user", userId],
        queryFn: async () => {
            const token = await getAccessToken();
            if (!token) throw new Error(`token missing for user ${userId}`);
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

function getMyTeamOptions(
    userId: string,
    getAccessToken: () => Promise<string | undefined>,
) {
    return queryOptions({
        queryKey: ["", userId],
        queryFn: async () => {
            const token = await getAccessToken();
            if (!token) throw new Error(`token missing for user ${userId}`);
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
    });
}

export function useMyTeamQuery(
    userId: Accessor<string>,
    enabled?: Accessor<boolean>,
) {
    const getUserToken = useGetUserToken(userId);
    return createQuery(() => {
        return {
            ...getMyTeamOptions(userId(), getUserToken),
            enabled: enabled?.() ?? true,
        };
    });
}

export function useSeasonRankingQuery(
    enabled?: Accessor<boolean>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    return createQuery(() => ({
        queryKey: ["/api/2.0/my/ranking/season"],
        queryFn: async () => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");
            const result = await squadEasyClient.GET(
                "/api/2.0/my/ranking/season",
                {
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                },
            );
            if (!result.data)
                throw new Error(
                    `Get teams failed ${JSON.stringify(result.error)}`,
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: (enabled?.() ?? true) && !!mainUser.mainUserId(),
        refetchInterval,
        refetchIntervalInBackground,
        placeholderData: keepPreviousData,
    }));
}

export function useTeamQuery(
    teamId: Accessor<string | undefined>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    return createQuery(() => ({
        ...teamQueryOptions(
            teamId,
            getToken,
            refetchInterval,
            refetchIntervalInBackground,
        ),
        enabled: !!teamId() && !!mainUser.mainUserId(),
    }));
}

function teamQueryOptions(
    teamId: Accessor<string | undefined>,
    getToken: () => Promise<string | undefined>,
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
    });
}

export function useUserStatisticsQuery(
    userId: Accessor<string>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    return createQuery(() =>
        userStatisticsQueryOptions(
            userId,
            getToken,
            () => true,
            refetchInterval,
            refetchIntervalInBackground,
        ),
    );
}

export function userStatisticsQueryOptions(
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
        enabled: enabled?.(),
        refetchInterval,
        refetchIntervalInBackground,
    });
}

export function useSocialPostsQuery(
    userId: Accessor<string>,
    sincePostId?: Accessor<string | undefined>,
    refetchIntervalInBackground?: Accessor<number>,
    enabled?: Accessor<boolean>,
) {
    const getToken = useGetUserToken(userId);
    return createQuery(() => ({
        queryKey: ["/api/3.0/social/posts", userId(), sincePostId?.()],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error(`token missing for user ${userId()}`);
            const result = await squadEasyClient.GET("/api/3.0/social/posts", {
                params: {
                    query: {
                        sincePostId: sincePostId?.(),
                    },
                },
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
        staleTime:
            sincePostId?.() === undefined ? 5 * 60 * 1000 : 30 * 60 * 1000,
        gcTime: sincePostId?.() === undefined ? 5 * 60 * 1000 : 30 * 60 * 1000,
        refetchInterval: refetchIntervalInBackground?.(),
        refetchIntervalInBackground: !!refetchIntervalInBackground,
        enabled: !!userId() && (enabled?.() ?? true),
    }));
}

export function useLikePostMutation(userId: Accessor<string>) {
    const getUserToken = useGetUserToken(userId);
    return createMutation(() => ({
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
    return createMutation(() => ({
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
            if (!boostResult.data)
                throw new Error(
                    `Boost failed ${JSON.stringify(boostResult.error)}`,
                );
            return boostResult.data;
        },
        onSuccess: () => {
            client.invalidateQueries({
                queryKey: getMyTeamOptions(userId(), async () => "").queryKey,
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
    return createMutation(() => ({
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
                            "refresh-token": variables.refreshToken,
                        },
                    },
                    headers: {
                        authorization: `Bearer ${variables.accessToken}`,
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
    return createMutation(() => ({
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
                getMyUserOptions(data.myUser.id, async () => data.accessToken)
                    .queryKey,
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

export function useHistoricalTeamPointsQuery(
    start: Accessor<number>,
    end: Accessor<number>,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    const query = createQuery(() => ({
        queryKey: ["historicalTeamPoints", start(), end()],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const url = `${API_BASE_URL}/api/team-points?startDate=${new Date(start()).toISOString()}&endDate=${new Date(end()).toISOString()}`;
            const resp = await fetch(url, {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                signal,
            });
            if (!resp.ok) throw new Error("Network response was not ok");
            const result = (await resp.json()) as [
                { teamId: string; time: string; points: number },
            ];
            return result;
        },
        staleTime: 1000 * 60 * 1, // 1 minutes
        cacheTime: 1000 * 60 * 5, // 5 minutes
        deferStream: true,
        gcTime: 1000 * 60 * 5, // 5 minutes
        enabled: typeof window !== "undefined",
        placeholderData: keepPreviousData,
    }));
    return query;
}

export function useHistoricalUserPointsQueries(
    userIds: Accessor<string[]>,
    start: Accessor<number>,
    end: Accessor<number>,
) {
    return createQueries(() => ({
        queries: userIds().map((userId) =>
            getHistoricalUserPointsQueryOptions(() => userId, start, end),
        ),
    }));
}

export function getHistoricalUserPointsQueryOptions(
    userId: Accessor<string>,
    start: Accessor<number>,
    end: Accessor<number>,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    const options = queryOptions<
        [
            {
                userId: string;
                time: string;
                points: number;
            },
        ],
        Error
    >({
        queryKey: ["historicalUserPoints", userId(), start(), end()],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const url = `${API_BASE_URL}/api/user-points/${userId()}?startDate=${new Date(start()).toISOString()}&endDate=${new Date(end()).toISOString()}`;
            const resp = await fetch(url, {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                signal,
            });
            if (!resp.ok) throw new Error("Network response was not ok");
            const result = (await resp.json()) as [
                { userId: string; time: string; points: number },
            ];
            return result;
        },
        staleTime: 1000 * 60 * 1, // 1 minutes
        deferStream: true,
        gcTime: 1000 * 60 * 5, // 5 minutes
        enabled: typeof window !== "undefined",
        placeholderData: keepPreviousData,
    });
    return options;
}

export function useHistoricalUserActivityPointsQuery(
    userId: Accessor<string>,
    start: Accessor<number>,
    end: Accessor<number>,
) {
    const mainUser = useMainUser();
    const getToken = useGetUserToken(mainUser.mainUserId);
    const query = createQuery(() => ({
        queryKey: ["historicalUserActivityPoints", userId(), start(), end()],
        queryFn: async ({ signal }) => {
            const accessToken = await getToken();
            if (!accessToken) throw new Error("Missing token!");

            const url = `${API_BASE_URL}/api/user-activity-points/${userId()}?startDate=${new Date(start()).toISOString()}&endDate=${new Date(end()).toISOString()}`;
            const resp = await fetch(url, {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                signal,
            });
            if (!resp.ok) throw new Error("Network response was not ok");
            const result = (await resp.json()) as [
                {
                    userId: string;
                    activityId: string;
                    time: string;
                    value: number;
                    points: number;
                },
            ];
            return result;
        },
        staleTime: 1000 * 60 * 1, // 1 minutes
        cacheTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 5, // 5 minutes
        enabled: typeof window !== "undefined",
        placeholderData: keepPreviousData,
    }));

    return query;
}
