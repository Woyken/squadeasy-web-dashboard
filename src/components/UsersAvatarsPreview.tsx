import { getMyUserOptions, useGetUserToken } from "~/api/client";
import { Avatars } from "./Avatars";
import { createQueries } from "@tanstack/solid-query";
import { createMemo } from "solid-js";
import { getUserInitials } from "~/getUserDisplayName";

export function UsersAvatarsPreview(props: { userIds: string[] }) {
    const userIdsWithTokens = createMemo(() =>
        props.userIds.map((userId) => ({
            userId,
            getToken: useGetUserToken(() => userId),
        }))
    );
    const queriesOptions = createMemo(() =>
        userIdsWithTokens().map((userIdWithToken) =>
            getMyUserOptions(userIdWithToken.userId, userIdWithToken.getToken)
        )
    );
    const queries = createQueries(() => ({
        queries: queriesOptions(),
    }));
    return (
        <Avatars
            users={queries.map((x) => {
                if (x.isLoading)
                    return {
                        loading: true,
                    };
                if (x.error)
                    return {
                        placeholder: (
                            x.error?.message ??
                            x.error?.name ??
                            x.error?.cause ??
                            "??"
                        ).slice(0, 2),
                    };
                if (!x.data)
                    return {
                        // Don't know what to display in this case
                        placeholder: x.status.slice(0, 2),
                    };
                if (x.data.image)
                    return {
                        image: x.data.image,
                    };
                return {
                    placeholder: getUserInitials(x.data) ?? "??",
                };
            })}
        />
    );
}
