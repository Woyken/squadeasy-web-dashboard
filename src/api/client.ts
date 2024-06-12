import createClient from "openapi-fetch";
import { paths } from "./squadEasyApi";
import {
    createMutation,
    createQuery,
    queryOptions,
    useQueryClient,
} from "@tanstack/solid-query";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import { Accessor, createMemo } from "solid-js";
import { parseJwt } from "~/utils/parseJwt";

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
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
    return createQuery(() => ({
        queryKey: ["/api/2.0/users/{id}", userId()],
        queryFn: async () => {
            const token = await getToken();
            if (!token)
                throw new Error(`token missing for user ${firstUserId()}`);
            const result = await squadEasyClient.GET("/api/2.0/users/{id}", {
                params: {
                    path: {
                        id: userId(),
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
        staleTime: 5 * 60 * 1000,
        enabled: !!firstUserId(),
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

export function useMyTeamQuery(userId: Accessor<string>) {
    const getUserToken = useGetUserToken(userId);
    return createQuery(() => {
        return getMyTeamOptions(userId(), getUserToken);
    });
}

export function useSeasonRankingQuery(
    enabled?: Accessor<boolean>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
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
        enabled: (enabled?.() ?? true) && !!firstUserId(),
        refetchInterval,
        refetchIntervalInBackground,
    }));
}

export function useTeamQuery(
    teamId: Accessor<string | undefined>,
    refetchInterval?: number,
    refetchIntervalInBackground?: boolean,
) {
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
    return createQuery(() => ({
        ...teamQueryOptions(
            teamId,
            getToken,
            refetchInterval,
            refetchIntervalInBackground,
        ),
        enabled: !!teamId() && !!firstUserId(),
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
    const users = useUsersTokens();
    const firstUserId = createMemo(() => Array.from(users().tokens.keys())[0]);
    const getToken = useGetUserToken(firstUserId);
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
        enabled: !!userId(),
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
