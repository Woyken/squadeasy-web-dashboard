import {
    Accessor,
    For,
    ParentProps,
    Setter,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    useContext,
} from "solid-js";
import { useUsersTokens } from "./UsersTokensProvider";
import { useBoostMutation, useMyTeamQuery } from "~/api/client";

function AutoBoosterUser(props: { userId: string }) {
    // const myUserQuery = useMyUserQuery(() => props.userId);
    const myTeamQuery = useMyTeamQuery(() => props.userId);
    const boostMutation = useBoostMutation(() => props.userId);

    createEffect(() => {
        const data = myTeamQuery.data;
        if (!data) return;

        const boostAtTimestamp = new Date(
            data.boostAvailableAt ?? ""
        ).getTime();
        const boostInMs = boostAtTimestamp - new Date().getTime();
        const timeout = setTimeout(
            () => {
                const t = myTeamQuery
                    .refetch()
                    .then((x) =>
                        x.data?.users
                            .toSorted((u1, u2) => u2.points - u1.points)
                            .find((x) => x.isBoostable)
                    )
                    .then((user) => {
                        if (user) boostMutation.mutate(user.id);
                    });
            },
            boostInMs < 0 ? 0 : boostInMs
        );
        onCleanup(() => {
            clearTimeout(timeout);
        });
    });
    return <></>;
}

const ctx = createContext<
    Accessor<{
        settings: { userId: string; autoBoost: boolean }[];
        setSettings: Setter<{ userId: string; autoBoost: boolean }[]>;
    }>
>();

function useCtx() {
    const data = useContext(ctx);
    if (!data) throw new Error("ctx.Provider missing");

    return data;
}

export function useAutoBoosterSetting(userId: Accessor<string>) {
    const data = useCtx();
    return {
        autoBoost: createMemo(
            () =>
                data().settings.find((x) => x.userId === userId())?.autoBoost ??
                false
        ),
        setAutoBoost: (value: boolean) =>
            data().setSettings((old) => [
                ...old.filter((x) => x.userId !== userId()),
                {
                    autoBoost: value,
                    userId: userId(),
                },
            ]),
    };
}

export function AutoBooster(props: ParentProps) {
    const tokens = useUsersTokens();
    const userIds = createMemo(() => Array.from(tokens().tokens.keys()));
    const [userSettings, setUserSettings] = createSignal<
        { userId: string; autoBoost: boolean }[]
    >([]);

    createEffect(() => {
        const itemsStr = window?.localStorage?.getItem("boostSettings");
        if (itemsStr) {
            const parsedData = JSON.parse(itemsStr);
            if (parsedData && Array.isArray(parsedData))
                // Too lazy to check type, assume it's valid
                setUserSettings(parsedData as any);
        }
    });

    createEffect(() => {
        window?.localStorage?.setItem(
            "boostSettings",
            JSON.stringify(userSettings())
        );
    });

    return (
        <>
            <ctx.Provider
                value={() => ({
                    settings: userSettings(),
                    setSettings: setUserSettings,
                })}
            >
                <For each={userIds()}>
                    {(userId) => <AutoBoosterUser userId={userId} />}
                </For>
                {props.children}
            </ctx.Provider>
        </>
    );
}
