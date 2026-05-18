import { Accessor, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { useQueries, useQuery } from "@tanstack/solid-query";
import {
    getUserByIdQueryOptions,
    getBoostDonorStatusQueryOptions,
    getBoostRequestQueryOptions,
    getBoostTeamStatusQueryOptions,
    getMyTeamQueryOptions,
    useBoostDonorRegisterMutation,
    useBoostDonorUnregisterMutation,
    useBoostRequestMutation,
    useBoostRequestCancelMutation,
    useGetUserToken,
} from "~/api/client";
import { getUserDisplayName } from "~/getUserDisplayName";
import { useUsersTokens } from "./UsersTokensProvider";

function getDefaultBoostDeadline() {
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
        date: [
            deadline.getFullYear(),
            String(deadline.getMonth() + 1).padStart(2, "0"),
            String(deadline.getDate()).padStart(2, "0"),
        ].join("-"),
        time: [
            String(deadline.getHours()).padStart(2, "0"),
            String(deadline.getMinutes()).padStart(2, "0"),
        ].join(":"),
    };
}

function formatCountdown(diffMs: number) {
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (totalMinutes < 60) {
        return `${totalMinutes}m ${String(seconds).padStart(2, "0")}s`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalHours < 24) {
        return `${totalHours}h ${String(minutes).padStart(2, "0")}m`;
    }

    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}d ${String(hours).padStart(2, "0")}h`;
}

export function BoostSettings(props: { userId: Accessor<string> }) {
    const defaultBoostDeadline = getDefaultBoostDeadline();
    const getUserToken = useGetUserToken(props.userId);
    const hasToken = createMemo(() => !!props.userId());

    const donorQuery = useQuery(() =>
        getBoostDonorStatusQueryOptions(getUserToken, hasToken),
    );
    const isDonor = createMemo(() => !!donorQuery.data);
    const requestQuery = useQuery(() =>
        getBoostRequestQueryOptions(getUserToken, hasToken),
    );
    const teamStatusQuery = useQuery(() =>
        getBoostTeamStatusQueryOptions(getUserToken, hasToken),
    );
    const myTeamQuery = useQuery(() =>
        getMyTeamQueryOptions(
            props.userId,
            getUserToken,
            () => hasToken() && isDonor(),
        ),
    );
    const teamBoostUserIds = createMemo(() => {
        const status = teamStatusQuery.data;
        if (!status) return [];

        return Array.from(
            new Set([
                ...status.donors.map((donor) => donor.userId),
                ...status.requests.map((request) => request.userId),
            ]),
        );
    });
    const teamBoostUserQueries = useQueries(() => ({
        queries: teamBoostUserIds().map((userId) =>
            getUserByIdQueryOptions(() => userId, getUserToken, hasToken),
        ),
    }));
    const teamBoostUserNames = createMemo(() => {
        const userIds = teamBoostUserIds();
        const names = new Map<string, string>();

        for (const [index, userId] of userIds.entries()) {
            const query = teamBoostUserQueries[index];
            const displayName = getUserDisplayName(query?.data);
            if (displayName) {
                names.set(userId, displayName);
            }
        }

        return names;
    });

    const registerMutation = useBoostDonorRegisterMutation(props.userId);
    const unregisterMutation = useBoostDonorUnregisterMutation(props.userId);
    const requestMutation = useBoostRequestMutation(props.userId);
    const cancelRequestMutation = useBoostRequestCancelMutation(props.userId);

    const [fallbackMode, setFallbackMode] = createSignal<"none" | "top_points">("none");
    const [deadlineDate, setDeadlineDate] = createSignal(defaultBoostDeadline.date);
    const [deadlineTime, setDeadlineTime] = createSignal(defaultBoostDeadline.time);
    const [donorCountdownMs, setDonorCountdownMs] = createSignal(0);

    const hasRequest = createMemo(() => !!requestQuery.data);
    const donorBoostAvailableAt = createMemo(() => {
        const boostAvailableAt = myTeamQuery.data?.boostAvailableAt;
        if (!boostAvailableAt) return undefined;

        const timestamp = new Date(boostAvailableAt).getTime();
        return Number.isFinite(timestamp) ? timestamp : undefined;
    });
    const donorCountdownLabel = createMemo(() => {
        const availableAt = donorBoostAvailableAt();
        if (availableAt === undefined || donorCountdownMs() <= 0) {
            return "READY NOW";
        }

        return formatCountdown(donorCountdownMs());
    });

    createEffect(() => {
        if (!isDonor()) {
            setDonorCountdownMs(0);
            return;
        }

        const availableAt = donorBoostAvailableAt();
        if (availableAt === undefined) {
            setDonorCountdownMs(0);
            return;
        }

        const updateCountdown = () =>
            setDonorCountdownMs(Math.max(0, availableAt - Date.now()));

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        onCleanup(() => clearInterval(interval));
    });

    const handleRegisterDonor = () => {
        registerMutation.mutate({ fallbackMode: fallbackMode() });
    };

    const handleUnregisterDonor = () => {
        unregisterMutation.mutate();
    };

    const handleSubmitRequest = () => {
        const date = deadlineDate();
        const time = deadlineTime();
        if (!date || !time) return;

        requestMutation.mutate({
            boostByDeadline: new Date(`${date}T${time}`).toISOString(),
        });
    };

    const handleDeadlineDateInput = (value: string) => {
        setDeadlineDate(value);

        if (!value) {
            setDeadlineTime("");
            return;
        }

        if (!deadlineTime()) {
            setDeadlineTime("09:00");
        }
    };

    const handleDeadlineTimeInput = (value: string) => {
        setDeadlineTime(value);
    };

    const handleCancelRequest = () => {
        cancelRequestMutation.mutate();
    };

    const getBoostUserLabel = (userId: string) =>
        teamBoostUserNames().get(userId) ?? `${userId.slice(0, 8)}...`;

    return (
        <div class="space-y-6">
            {/* Boost Donor Section */}
            <div class="border-2 border-black p-5">
                <div class="mb-4 flex items-center justify-between">
                    <div>
                        <div class="text-sm font-bold uppercase tracking-widest">
                            BOOST DONOR
                        </div>
                        <div class="mt-0.5 text-[10px] text-(--color-brut-gray)">
                            Let other team members request your account's boost
                        </div>
                    </div>
                    <Show
                        when={isDonor()}
                        fallback={
                            <button
                                type="button"
                                class="border-2 border-black px-4 py-1.5 text-[11px] font-bold tracking-widest bg-white text-black hover:bg-black hover:text-white"
                                onClick={handleRegisterDonor}
                                disabled={registerMutation.isPending}
                            >
                                ENABLE
                            </button>
                        }
                    >
                        <button
                            type="button"
                            class="border-2 border-black px-4 py-1.5 text-[11px] font-bold tracking-widest bg-black text-white hover:bg-(--color-brut-red) hover:border-(--color-brut-red)"
                            onClick={handleUnregisterDonor}
                            disabled={unregisterMutation.isPending}
                        >
                            DISABLE
                        </button>
                    </Show>
                </div>

                <Show when={isDonor()}>
                    <div class="border-t border-(--color-brut-light) pt-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                STATUS
                            </span>
                            <span class="text-[11px] font-bold text-green-700">
                                ACTIVE
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                FALLBACK MODE
                            </span>
                            <span class="text-[11px] font-bold">
                                {donorQuery.data?.fallbackMode === "top_points"
                                    ? "TOP POINTS"
                                    : "NONE"}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                NEXT BOOST
                            </span>
                            <span class="text-[11px] font-bold">
                                {donorCountdownLabel()}
                            </span>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                CHANGE FALLBACK:
                            </label>
                            <select
                                class="border border-black px-2 py-1 text-[11px] font-mono"
                                value={donorQuery.data?.fallbackMode ?? "none"}
                                onChange={(e) => {
                                    const mode = e.currentTarget.value as
                                        | "none"
                                        | "top_points";
                                    setFallbackMode(mode);
                                    registerMutation.mutate({ fallbackMode: mode });
                                }}
                            >
                                <option value="none">None (requests only)</option>
                                <option value="top_points">
                                    Top points member
                                </option>
                            </select>
                        </div>
                    </div>
                </Show>

                <Show when={!isDonor()}>
                    <div class="border-t border-(--color-brut-light) pt-4">
                        <div class="text-[10px] text-(--color-brut-dim) italic">
                            When enabled, your account's boost will be used to fulfill team requests or apply the fallback strategy to automatically boost team members
                        </div>
                    </div>
                </Show>
            </div>

            {/* Boost Request Section */}
            <div class="border-2 border-black p-5">
                <div class="mb-4">
                    <div class="text-sm font-bold uppercase tracking-widest">
                        REQUEST BOOST
                    </div>
                    <div class="mt-0.5 text-[10px] text-(--color-brut-gray)">
                        Ask your team's donors to boost you by a deadline
                    </div>
                </div>

                <Show
                    when={hasRequest()}
                    fallback={
                        <div class="space-y-3">
                            <div class="flex items-center gap-2">
                                <label class="text-[10px] tracking-widest text-(--color-brut-gray) shrink-0">
                                    BOOST ME UNTIL:
                                </label>
                                <input
                                    type="date"
                                    class="border border-black px-2 py-1 text-[11px] font-mono flex-1"
                                    value={deadlineDate()}
                                    onInput={(e) =>
                                        handleDeadlineDateInput(e.currentTarget.value)
                                    }
                                />
                                <input
                                    type="time"
                                    class="border border-black px-2 py-1 text-[11px] font-mono w-28"
                                    value={deadlineTime()}
                                    onInput={(e) =>
                                        handleDeadlineTimeInput(e.currentTarget.value)
                                    }
                                />
                            </div>
                            <button
                                type="button"
                                class="w-full border-2 border-black py-1.5 text-[10px] font-bold tracking-widest hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={handleSubmitRequest}
                                disabled={
                                    !deadlineDate() ||
                                    !deadlineTime() ||
                                    requestMutation.isPending
                                }
                            >
                                [SUBMIT REQUEST]
                            </button>
                        </div>
                    }
                >
                    <div class="border-t border-(--color-brut-light) pt-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                DEADLINE
                            </span>
                            <span class="text-[11px] font-bold">
                                {new Date(
                                    requestQuery.data!.boostByDeadline,
                                ).toLocaleString()}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] tracking-widest text-(--color-brut-gray)">
                                CREATED
                            </span>
                            <span class="text-[11px]">
                                {new Date(
                                    requestQuery.data!.createdAt,
                                ).toLocaleString()}
                            </span>
                        </div>
                        <button
                            type="button"
                            class="w-full border-2 border-(--color-brut-red) text-(--color-brut-red) py-1.5 text-[10px] font-bold tracking-widest hover:bg-(--color-brut-red) hover:text-white"
                            onClick={handleCancelRequest}
                            disabled={cancelRequestMutation.isPending}
                        >
                            [CANCEL REQUEST]
                        </button>
                    </div>
                </Show>
            </div>

            {/* Team Boost Status */}
            <div class="border-2 border-black p-5">
                <div class="mb-4">
                    <div class="text-sm font-bold uppercase tracking-widest">
                        TEAM BOOST STATUS
                    </div>
                    <div class="mt-0.5 text-[10px] text-(--color-brut-gray)">
                        Donors and pending requests on your team
                    </div>
                </div>

                <Show when={teamStatusQuery.data} fallback={
                    <div class="text-[10px] text-(--color-brut-dim) italic">Loading...</div>
                }>
                    {(status) => (
                        <div class="space-y-4">
                            <div>
                                <div class="text-[10px] tracking-widest text-(--color-brut-gray) mb-1">
                                    DONORS ({status().donors.length})
                                </div>
                                <Show
                                    when={status().donors.length > 0}
                                    fallback={
                                        <div class="text-[10px] text-(--color-brut-dim) italic">
                                            No donors registered
                                        </div>
                                    }
                                >
                                    <div class="space-y-1">
                                        {status().donors.map((d) => (
                                            <div class="flex items-center justify-between border border-(--color-brut-light) px-2 py-1">
                                                <span class="text-[10px] font-mono">
                                                    {getBoostUserLabel(d.userId)}
                                                </span>
                                                <span class="text-[9px] text-(--color-brut-gray)">
                                                    {d.fallbackMode === "top_points"
                                                        ? "TOP PTS"
                                                        : "REQ ONLY"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Show>
                            </div>

                            <div>
                                <div class="text-[10px] tracking-widest text-(--color-brut-gray) mb-1">
                                    REQUESTS ({status().requests.length})
                                </div>
                                <Show
                                    when={status().requests.length > 0}
                                    fallback={
                                        <div class="text-[10px] text-(--color-brut-dim) italic">
                                            No pending requests
                                        </div>
                                    }
                                >
                                    <div class="space-y-1">
                                        {status().requests.map((r) => (
                                            <div class="flex items-center justify-between border border-(--color-brut-light) px-2 py-1">
                                                <span class="text-[10px] font-mono">
                                                    {getBoostUserLabel(r.userId)}
                                                </span>
                                                <span class="text-[9px] text-(--color-brut-gray)">
                                                    by{" "}
                                                    {new Date(
                                                        r.boostByDeadline,
                                                    ).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Show>
                            </div>
                        </div>
                    )}
                </Show>
            </div>
        </div>
    );
}
