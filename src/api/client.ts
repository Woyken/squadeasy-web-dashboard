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

export const squadEasyClient = createClient<paths>({
    baseUrl: "https://api-challenge.squadeasy.com",
});

export function useMyUserQuery(userId: Accessor<string>) {
    const userTokens = useUsersTokens();
    const userToken = createMemo(
        () => userTokens().tokens.get(userId())?.accessToken
    );
    return createQuery(() => {
        const token = userToken();
        if (!token) throw new Error(`token missing for user ${userId()}`);

        return getMyUserOptions(userId(), token);
    });
}

function getMyUserOptions(userId: string, accessToken: string) {
    return queryOptions({
        queryKey: ["/api/2.0/my/user", userId],
        queryFn: async () => {
            const result = await squadEasyClient.GET("/api/2.0/my/user", {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

function getMyTeamOptions(userId: string, accessToken: string) {
    return queryOptions({
        queryKey: ["", userId],
        queryFn: async () => {
            const result = await squadEasyClient.GET("/api/2.0/my/team", {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });
            if (!result.data)
                throw new Error(
                    `Request failed ${JSON.stringify(result.error)}`
                );
            return result.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useMyTeamQuery(userId: Accessor<string>) {
    const userTokens = useUsersTokens();
    const userToken = createMemo(
        () => userTokens().tokens.get(userId())?.accessToken
    );
    return createQuery(() => {
        const token = userToken();
        if (!token) throw new Error(`token missing for user ${userId()}`);

        return getMyTeamOptions(userId(), token);
    });
}

export function useBoostMutation(userId: Accessor<string>) {
    const client = useQueryClient();
    const usersTokens = useUsersTokens();
    const userToken = createMemo(
        () => usersTokens().tokens.get(userId())?.accessToken
    );
    return createMutation(() => ({
        mutationFn: async (targetUserId: string) => {
            const accessToken = userToken();
            if (!accessToken)
                throw new Error(`token missing for user ${userId()}`);
            const boostResult = await squadEasyClient.POST(
                "/2.0/users/{id}/boost",
                {
                    params: {
                        path: {
                            id: targetUserId,
                        },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            if (!boostResult.data)
                throw new Error(
                    `Boost failed ${JSON.stringify(boostResult.error)}`
                );
            return boostResult.data;
        },
        onSuccess: () => {
            client.invalidateQueries({
                queryKey: getMyTeamOptions(userId(), "").queryKey,
            });
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
                }
            );
            if (!loginResult.data)
                throw new Error(
                    `Login failed ${JSON.stringify(loginResult.error)}`
                );

            const myUserResult = await squadEasyClient.GET("/api/2.0/my/user", {
                headers: {
                    authorization: `Bearer ${loginResult.data.accessToken}`,
                },
            });
            if (!myUserResult.data)
                throw new Error(
                    `Get My User details failed ${JSON.stringify(
                        myUserResult.error
                    )}`
                );

            return {
                myUser: myUserResult.data,
                accessToken: loginResult.data.accessToken,
                refreshToken: loginResult.data.refreshToken,
            };
        },
        onSuccess: (data) => {
            client.setQueryData(
                getMyUserOptions(data.myUser.id, data.accessToken).queryKey,
                () => {
                    return data.myUser;
                }
            );

            usersTokens().setToken(
                data.myUser.id,
                data.accessToken,
                data.refreshToken
            );
        },
    }));
}
