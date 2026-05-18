import {
    Accessor,
    For,
    JSX,
    ParentProps,
    Suspense,
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
    getMyTeamQueryOptions,
    getMyUserQueryOptions,
    useLikePostMutation,
    useGetUserToken,
    squadEasyClient,
} from "~/api/client";
import { useQuery } from "@tanstack/solid-query";
import { localStorageGetItem, localStorageSetItem } from "~/utils/localStorage";
import { useToaster } from "./ToasterProvider";
import { getUserDisplayName } from "~/getUserDisplayName";
import * as v from "valibot";

// ---------------------------------------------------------------------------
// Schema + Types
// ---------------------------------------------------------------------------

const AutoLikeSettingsSchema = v.strictObject({
    enabled: v.boolean(),
    /**
     * undefined = initial crawl not yet started
     * string    = initial crawl in progress; this is the next page cursor to fetch
     * null      = initial crawl complete; subsequent runs are incremental
     */
    crawlCursor: v.optional(v.nullable(v.string())),
    /**
     * ISO date string of the newest post liked in the last completed sweep.
     * Updated atomically only when a sweep reaches back to the previous watermark.
     */
    lastLikedPostDate: v.optional(v.string()),
});

type AutoLikeSettings = v.InferOutput<typeof AutoLikeSettingsSchema>;

type AutoLikePhase = "idle" | "crawling";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ctx = createContext<{
    setAutoLikeTeamPosts: (userId: string, autoLike: boolean) => void;
    autoLikeTeamPosts: (userId: string) => boolean;
    triggerNow: (userId: string) => void;
    getPhase: (userId: string) => AutoLikePhase;
    getSettings: (userId: string) => AutoLikeSettings | undefined;
}>();

export function useAutoLikeTeamPosts() {
    const value = useContext(ctx);
    if (!value)
        throw new Error("Missing Auto Like Team Posts context provider");
    return value;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AutoLikeTeamPosts(props: ParentProps) {
    const tokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(tokens().tokens.keys()));

    type UserState = {
        setAutoLike: (v: boolean) => void;
        autoLike: Accessor<boolean>;
        triggerNow: () => void;
        getPhase: () => AutoLikePhase;
        getSettings: () => AutoLikeSettings | undefined;
    };

    const [userStates, setUserStates] = createSignal(
        new Map<string, UserState>(),
    );

    return (
        <ctx.Provider
            value={{
                setAutoLikeTeamPosts: (userId, autoLike) =>
                    userStates().get(userId)?.setAutoLike(autoLike),
                autoLikeTeamPosts: (userId) =>
                    userStates().get(userId)?.autoLike() ?? false,
                triggerNow: (userId) =>
                    userStates().get(userId)?.triggerNow(),
                getPhase: (userId) =>
                    userStates().get(userId)?.getPhase() ?? "idle",
                getSettings: (userId) =>
                    userStates().get(userId)?.getSettings(),
            }}
        >
            <Suspense>
                <For each={userIds()}>
                    {(userId) => (
                        <AutoLikePostUser userId={userId}>
                            {(state) => {
                                setUserStates((old) =>
                                    new Map(old).set(userId, state),
                                );
                                onCleanup(() => {
                                    setUserStates((old) => {
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
            </Suspense>
            {props.children}
        </ctx.Provider>
    );
}

// ---------------------------------------------------------------------------
// Per-user engine
// ---------------------------------------------------------------------------

function AutoLikePostUser(props: {
    userId: string;
    children: (state: {
        setAutoLike: (v: boolean) => void;
        autoLike: Accessor<boolean>;
        triggerNow: () => void;
        getPhase: () => AutoLikePhase;
        getSettings: () => AutoLikeSettings | undefined;
    }) => JSX.Element;
}) {
    const getUserToken = useGetUserToken(() => props.userId);
    const likePostMutation = useLikePostMutation(() => props.userId);
    const toaster = useToaster();

    // --- Persisted settings ---
    const storageKey = () => `autoLikeSettings-${props.userId}`;

    function loadSettings(): AutoLikeSettings | undefined {
        const raw = localStorageGetItem(storageKey());
        if (!raw) return undefined;
        try {
            const result = v.safeParse(AutoLikeSettingsSchema, JSON.parse(raw));
            return result.success ? result.output : undefined;
        } catch {
            return undefined;
        }
    }

    const [settings, setSettingsSignal] = createSignal<AutoLikeSettings | undefined>(
        loadSettings(),
    );

    function persistSettings(next: AutoLikeSettings) {
        setSettingsSignal(next);
        localStorageSetItem(storageKey(), JSON.stringify(next));
    }

    function updateSettings(updater: (prev: AutoLikeSettings) => AutoLikeSettings) {
        const prev = untrack(settings) ?? { enabled: false };
        persistSettings(updater(prev));
    }

    // --- Guards ---
    const [isRunning, setIsRunning] = createSignal(false);
    const [triggerBump, setTriggerBump] = createSignal(0);
    const [phase, setPhase] = createSignal<AutoLikePhase>("idle");

    // --- Team query ---
    const myTeamQuery = useQuery(() =>
        getMyTeamQueryOptions(
            () => props.userId,
            getUserToken,
            () => !!settings()?.enabled,
        ),
    );

    const myUserQuery = useQuery(() =>
        getMyUserQueryOptions(() => props.userId, getUserToken),
    );

    const teamUserIds = createMemo(() =>
        myTeamQuery.data
            ? new Set(myTeamQuery.data.users?.map((u: { id: string }) => u.id))
            : undefined,
    );

    function isTeamPost(senderId: string): boolean {
        return teamUserIds()?.has(senderId) ?? false;
    }

    async function likePost(postId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            likePostMutation.mutate(postId, { onSuccess: () => resolve(), onError: reject });
        });
    }

    async function fetchPage(dateCursor?: string) {
        const token = await getUserToken();
        if (!token) throw new Error("no token");
        const result = await squadEasyClient.GET("/api/4.0/social/posts", {
            params: { query: dateCursor ? { date: dateCursor } : undefined },
            headers: { authorization: `Bearer ${token}` },
        });
        if (!result.data) throw new Error(`fetch failed ${JSON.stringify(result.error)}`);
        return result.data;
    }

    // ---------------------------------------------------------------------------
    // Core engine
    // ---------------------------------------------------------------------------

    async function runEngine() {
        const s = untrack(settings);
        if (!s?.enabled) return;
        if (untrack(isRunning)) return;

        setIsRunning(true);
        setPhase("crawling");
        try {
            await runBackwardSweep();
        } catch (err) {
            console.error("[AutoLike] engine error", err);
        } finally {
            setIsRunning(false);
            setPhase("idle");
        }
    }

    /**
     * Crawls from newest → oldest, liking team posts as it goes.
     *
     * Initial crawl (crawlCursor !== null):
     *   Resumes from the stored page cursor (or newest if undefined).
     *   Persists cursor to localStorage after each page so a page refresh can resume.
     *   Runs until absolute end; marks crawlCursor=null and sets lastLikedPostDate on finish.
     *
     * Incremental (crawlCursor === null):
     *   Always starts from newest. In-memory cursor only (no localStorage writes for cursor).
     *   Stops when it reaches the previous lastLikedPostDate watermark.
     *   Updates lastLikedPostDate atomically only after reaching the watermark.
     */
    async function runBackwardSweep() {
        const s = untrack(settings)!;
        const isInitialCrawl = s.crawlCursor !== null;

        // Resume from stored cursor for initial crawl; always start from newest for incremental.
        let cursor: string | undefined = isInitialCrawl
            ? (s.crawlCursor ?? undefined)
            : undefined;

        let newestPostDateThisRun: string | undefined;
        const prevWatermark = s.lastLikedPostDate;

        for (;;) {
            const page = await fetchPage(cursor);
            const posts = page.elements ?? [];

            for (const post of posts) {
                // Track the newest post seen this run (first post of first page)
                if (newestPostDateThisRun === undefined) {
                    newestPostDateThisRun = post.createdAt;
                }

                // Incremental stop condition: reached the previous watermark
                if (
                    prevWatermark &&
                    new Date(post.createdAt).getTime() <= new Date(prevWatermark).getTime()
                ) {
                    // Advance watermark only if we actually found newer posts
                    if (
                        newestPostDateThisRun &&
                        new Date(newestPostDateThisRun).getTime() > new Date(prevWatermark).getTime()
                    ) {
                        updateSettings((prev) => ({
                            ...prev,
                            lastLikedPostDate: newestPostDateThisRun,
                        }));
                    }
                    return;
                }

                if (!post.likes.isLikedByUser && isTeamPost(post.sender.id)) {
                    await likePost(post.id);
                }
            }

            const nextCursor = page.offsetQueryParams?.date;

            if (nextCursor) {
                // Persist progress only during initial crawl (enables resume after refresh)
                if (isInitialCrawl) {
                    updateSettings((prev) => ({ ...prev, crawlCursor: nextCursor }));
                }
                cursor = nextCursor;
            } else {
                // Reached absolute end of all posts
                updateSettings((prev) => ({
                    ...prev,
                    crawlCursor: null,
                    lastLikedPostDate: newestPostDateThisRun,
                }));
                return;
            }
        }
    }

    // --- Trigger effects ---

    createEffect(() => {
        const s = settings();
        void triggerBump();
        if (!s?.enabled) {
            setPhase("idle");
            return;
        }
        if (untrack(isRunning)) return;
        void runEngine();
    });

    createEffect(() => {
        const s = settings();
        if (!s?.enabled) return;
        const id = setInterval(() => void runEngine(), 30 * 60 * 1000);
        onCleanup(() => clearInterval(id));
    });

    // Toast feedback
    createEffect(() => {
        const s = settings();
        if (!s?.enabled || phase() !== "crawling") return;
        const name = getUserDisplayName(myUserQuery.data);
        if (!name) return;
        const isInitial = s.crawlCursor !== null;
        const text = isInitial
            ? `[${name}] Initial scan — liking all team posts...`
            : `[${name}] Liking new posts...`;
        const cleanup = toaster(text);
        onCleanup(cleanup);
    });

    return (
        <>
            {props.children({
                setAutoLike: (v) =>
                    updateSettings((prev) => ({ ...prev, enabled: v })),
                autoLike: () => settings()?.enabled ?? false,
                triggerNow: () => setTriggerBump((n) => n + 1),
                getPhase: phase,
                getSettings: settings,
            })}
        </>
    );
}

