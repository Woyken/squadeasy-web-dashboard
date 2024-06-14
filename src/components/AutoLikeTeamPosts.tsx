import {
    Accessor,
    For,
    JSX,
    ParentProps,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    untrack,
    useContext,
} from "solid-js";
import { useUsersTokens } from "./UsersTokensProvider";
import {
    useLikePostMutation,
    useMyTeamQuery,
    useMyUserQuery,
    useSocialPostsQuery,
} from "~/api/client";
import { localStorageGetItem, localStorageSetItem } from "~/utils/localStorage";
import { useToaster } from "./ToasterProvider";
import { getUserDisplayName } from "~/getUserDisplayName";

const ctx = createContext<{
    setAutoLikeTeamPosts: (userId: string, autoLike: boolean) => void;
    autoLikeTeamPosts: (userId: string) => boolean;
}>();

export function useAutoLikeTeamPosts() {
    const value = useContext(ctx);
    if (!value)
        throw new Error("Missing Auto Like Team Posts context provider");
    return value;
}

export function AutoLikeTeamPosts(props: ParentProps) {
    const tokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(tokens().tokens.keys()));
    const [userAutoLikeSetting, setUserAutoLikeSetting] = createSignal(
        new Map<
            string,
            {
                setAutoLike: (autoLike: boolean) => void;
                autoLike: Accessor<boolean>;
            }
        >(),
    );
    return (
        <ctx.Provider
            value={{
                setAutoLikeTeamPosts: (userId, autoLike) => {
                    userAutoLikeSetting().get(userId)?.setAutoLike(autoLike);
                },
                autoLikeTeamPosts: (userId) =>
                    userAutoLikeSetting().get(userId)?.autoLike() ?? false,
            }}
        >
            <For each={userIds()}>
                {(userId) => (
                    <AutoLikePostUser userId={userId}>
                        {(setAutoLike, autoLike) => {
                            setUserAutoLikeSetting((old) =>
                                new Map(old).set(userId, {
                                    setAutoLike,
                                    autoLike,
                                }),
                            );
                            onCleanup(() => {
                                setUserAutoLikeSetting((old) => {
                                    const n = new Map(old);
                                    n.delete(userId);
                                    return n;
                                });
                            });
                            return <></>;
                        }}
                    </AutoLikePostUser>
                )}
            </For>
            {props.children}
        </ctx.Provider>
    );
}

function AutoLikePostUser(props: {
    userId: string;
    children: (
        setAutoLikeTeamPosts: (autoLike: boolean) => void,
        autoLikeTeamPosts: Accessor<boolean>,
    ) => JSX.Element;
}) {
    const [postLikeSettings, setPostLikeSettings] = createSignal<{
        enabled: boolean;
        lastCrawledPost?: { id: string; timestamp: number; ended: boolean };
        latestKnownPost?: { id: string; timestamp: number };
    }>();

    const initialAutoLikeSettings = createMemo(() => {
        const autoLikeSetting = localStorageGetItem(
            `autoLikeSettings-${props.userId}`,
        );
        if (!autoLikeSetting) return;
        const parsed = JSON.parse(autoLikeSetting);
        if (
            parsed &&
            typeof parsed === "object" &&
            "enabled" in parsed &&
            typeof parsed.enabled === "boolean"
        )
            return {
                ...parsed,
                enabled: parsed.enabled,
            };
    });

    createEffect(() => {
        const autoLikeSetting = initialAutoLikeSettings();
        if (!autoLikeSetting) return;

        setPostLikeSettings(autoLikeSetting);
    });

    createEffect(() => {
        const settings = postLikeSettings();
        if (!settings) return;
        if (initialAutoLikeSettings() === settings) return;
        localStorageSetItem(
            `autoLikeSettings-${props.userId}`,
            JSON.stringify(postLikeSettings()),
        );
    });

    const likePostMutation = useLikePostMutation(() => props.userId);

    const [latestKnownPostCrawl, setLatestKnownPostCrawl] = createSignal<{
        nextId: string;
        startedAt: { id: string; timestamp: number };
    }>();

    const socialPostsQuery = useSocialPostsQuery(
        () => props.userId,
        () => latestKnownPostCrawl()?.nextId,
        () => 30 * 60 * 1000,
        () => !!postLikeSettings()?.enabled,
    );

    const myTeamQuery = useMyTeamQuery(
        () => props.userId,
        () => !!postLikeSettings()?.enabled,
    );

    const myUserQuery = useMyUserQuery(() => props.userId);

    const myTeamUserIds = createMemo(() =>
        myTeamQuery.data
            ? new Set(myTeamQuery.data.users.map((x) => x.id))
            : undefined,
    );

    createEffect(() => {
        // Watch latest posts
        if (!socialPostsQuery.data) return;
        if (socialPostsQuery.data.length === 0) return;
        const teamUserIds = myTeamUserIds();
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
                              ...old.latestKnownPost,
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

    const toaster = useToaster();
    const showNewPostsToastText = createMemo(() => {
        if (!myUserQuery.data) return;
        const settings = postLikeSettings();
        if (!settings?.enabled) return;
        if (!settings.latestKnownPost?.id) return;
        if (!latestKnownPostCrawl()?.nextId) return;
        return `New posts found, liking... (${getUserDisplayName(myUserQuery.data)!})`;
    });

    createEffect(() => {
        const text = showNewPostsToastText();
        if (!text) return;
        const cleanupToast = toaster(text);
        onCleanup(cleanupToast);
    });

    const socialLastCheckedPostsQuery = useSocialPostsQuery(
        () => props.userId,
        () => postLikeSettings()?.lastCrawledPost?.id,
        undefined,
        () =>
            !!postLikeSettings()?.enabled &&
            !postLikeSettings()?.lastCrawledPost?.ended,
    );

    createEffect(() => {
        // Go back in history one page at a time
        if (!socialLastCheckedPostsQuery.data) return;
        if (socialLastCheckedPostsQuery.data.length === 0) {
            setPostLikeSettings((old) =>
                old?.lastCrawledPost
                    ? {
                          ...old,
                          lastCrawledPost: {
                              ...old?.lastCrawledPost,
                              ended: true,
                          },
                      }
                    : old,
            );
            return;
        }
        const teamUserIds = myTeamUserIds();
        if (!teamUserIds) return;

        socialLastCheckedPostsQuery.data.forEach((data) => {
            // is user in current team?
            const isCurrentTeam = teamUserIds.has(data.sender.id);
            const isLiked = data.likes.isLikedByUser;
            if (!isLiked && isCurrentTeam) {
                likePostMutation.mutate(data.id);
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
                          ...(old.lastCrawledPost ?? { ended: false }),
                          id: currentLastPost.id,
                          timestamp: new Date(
                              currentLastPost.createdAt,
                          ).getTime(),
                      },
                  },
        );
    });

    const showHistoryToastText = createMemo(() => {
        if (!myUserQuery.data) return;
        const settings = postLikeSettings();
        if (!settings?.enabled) return;
        if (!settings.lastCrawledPost?.id) return;
        if (settings.lastCrawledPost?.ended) return;
        return `Finding and liking older posts... (${getUserDisplayName(myUserQuery.data)!}) (${new Date(settings.lastCrawledPost?.timestamp ?? 0).toISOString().split("T")[0]})`;
    });

    createEffect(() => {
        const text = showHistoryToastText();
        if (!text) return;
        const cleanupToast = toaster(text);
        onCleanup(cleanupToast);
    });

    return (
        <>
            {props.children(
                (autoLike) => {
                    setPostLikeSettings((old) => ({
                        ...old,
                        enabled: autoLike,
                    }));
                },
                () => postLikeSettings()?.enabled ?? false,
            )}
        </>
    );
}
