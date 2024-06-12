import { For, createEffect, createMemo, createSignal, untrack } from "solid-js";
import { useUsersTokens } from "./UsersTokensProvider";
import {
    useLikePostMutation,
    useMyTeamQuery,
    useSocialPostsQuery,
} from "~/api/client";

export function AutoLikeTeamPosts() {
    const tokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(tokens().tokens.keys()));
    // TODO add provider to enable this as a setting
    return (
        <For each={userIds()}>
            {(userId) => <AutoLikePostUser userId={userId} />}
        </For>
    );
}

function AutoLikePostUser(props: { userId: string }) {
    const [postLikeSettings, setPostLikeSettings] = createSignal<{
        enabled: boolean;
        lastCrawledPost?: { id: string; timestamp: number };
        latestKnownPost?: { id: string; timestamp: number };
    }>();
    // TODO store settings in local storage

    const likePostMutation = useLikePostMutation(() => props.userId);

    const [latestKnownPostCrawl, setLatestKnownPostCrawl] = createSignal<{
        nextId: string;
        startedAt: { id: string; timestamp: number };
    }>();

    const socialPostsQuery = useSocialPostsQuery(
        () => props.userId,
        () => latestKnownPostCrawl()?.nextId,
    );

    const myTeamQuery = useMyTeamQuery(() => props.userId);
    const myTeamUserIds = createMemo(() =>
        myTeamQuery.data
            ? new Set(myTeamQuery.data.users.map((x) => x.id))
            : undefined,
    );

    createEffect(() => {
        // Watch latest posts
        if (!socialPostsQuery.data) return;
        if (socialPostsQuery.data.length === 0) return;
        const teamUserIds = myTeamUserIds()
        if (!teamUserIds) return;
        const currentLatest = socialPostsQuery.data[0]!;
        const latestKnownPost = untrack(
            () => postLikeSettings()?.latestKnownPost,
        );
        const storedLatestKnownPostCrawl = untrack(() =>
            latestKnownPostCrawl(),
        );

        if (latestKnownPost === undefined) {
            // Initial setup, we don't know about any posts, initialize to start from current latest
            setLatestKnownPostCrawl(undefined);
            setPostLikeSettings((old) =>
                !old || old.latestKnownPost?.id === currentLatest.id
                    ? old
                    : {
                          ...old,
                          latestKnownPost: {
                              id: currentLatest.id,
                              timestamp: new Date(
                                  currentLatest.createdAt,
                              ).getTime(),
                          },
                      },
            );
        }

        // There was query some time ago, now more posts exist, check if we can find last known post
        if (
            latestKnownPost !== undefined &&
            storedLatestKnownPostCrawl === undefined
        ) {
            // Need to find latestKnownPost
            if (
                !!socialPostsQuery.data.find(
                    (x) =>
                        x.id === latestKnownPost.id ||
                        new Date(x.createdAt).getTime() <
                            latestKnownPost.timestamp,
                )
            ) {
                // Latest known query is in current page!
                // Update latestKnownPost to match current latest
                setLatestKnownPostCrawl(undefined);
                setPostLikeSettings((old) =>
                    !old || old.latestKnownPost?.id === currentLatest.id
                        ? old
                        : {
                              ...old,
                              latestKnownPost: {
                                  id: currentLatest.id,
                                  timestamp: new Date(
                                      currentLatest.createdAt,
                                  ).getTime(),
                              },
                          },
                );
            } else {
                // Doesn't exist in current query, query later posts
                setLatestKnownPostCrawl({
                    nextId: socialPostsQuery.data[
                        socialPostsQuery.data.length - 1
                    ]!.id,
                    startedAt: {
                        id: currentLatest.id,
                        timestamp: new Date(currentLatest.createdAt).getTime(),
                    },
                });
            }
        }

        if (
            latestKnownPost !== undefined &&
            storedLatestKnownPostCrawl !== undefined
        ) {
            // This is subsequent query to find latest known post
            // Need to find latestKnownPost
            if (
                !!socialPostsQuery.data.find(
                    (x) =>
                        x.id === latestKnownPost?.id ||
                        new Date(x.createdAt).getTime() <
                            latestKnownPost!.timestamp,
                )
            ) {
                // Latest known query is in current page!
                // Update latestKnownPost to match where crawling started at
                setLatestKnownPostCrawl(undefined);
                setPostLikeSettings((old) =>
                    !old ||
                    old.latestKnownPost?.id ===
                        storedLatestKnownPostCrawl.startedAt.id
                        ? old
                        : {
                              ...old,
                              latestKnownPost: {
                                  id: storedLatestKnownPostCrawl.startedAt.id,
                                  timestamp:
                                      storedLatestKnownPostCrawl.startedAt
                                          .timestamp,
                              },
                          },
                );
            } else {
                // Need to go further down the history
                setLatestKnownPostCrawl((old) =>
                    !old
                        ? old
                        : {
                              ...old,
                              nextId: socialPostsQuery.data[
                                  socialPostsQuery.data.length - 1
                              ]!.id,
                          },
                );
            }
        }

        socialPostsQuery.data.forEach((data) => {
            // is user in current team?
            const isCurrentTeamUser = teamUserIds.has(data.sender.id);
            const isLiked = data.likes.isLikedByUser;
            if (!isLiked && isCurrentTeamUser) {
                likePostMutation.mutate(data.id);
            }
        });
    });

    const socialLastCheckedPostsQuery = useSocialPostsQuery(
        () => props.userId,
        () => postLikeSettings()?.lastCrawledPost?.id,
    );

    createEffect(() => {
        // Go back in history one page at a time
        if (!socialLastCheckedPostsQuery.data) return;
        if (socialLastCheckedPostsQuery.data.length === 0) return;

        socialLastCheckedPostsQuery.data.forEach((data) => {
            // is user in current team?
            const isCurrentTeam = !![].find(() => !!data.sender.id);
            const isLiked = data.likes.isLikedByUser;
            if (!isLiked && isCurrentTeam) {
                // Do mutation to like it or save to list for todo
            }
        });
        const currentLastPost =
            socialLastCheckedPostsQuery.data[
                socialLastCheckedPostsQuery.data.length - 1
            ]!;
        setPostLikeSettings((old) =>
            !old || old.lastCrawledPost?.id === currentLastPost.id
                ? old
                : {
                      ...old,
                      lastCrawledPost: {
                          id: currentLastPost.id,
                          timestamp: new Date(
                              currentLastPost.createdAt,
                          ).getTime(),
                      },
                  },
        );
    });

    return <></>;
}
