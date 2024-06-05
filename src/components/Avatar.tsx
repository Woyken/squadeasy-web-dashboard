import { Match, Switch, createMemo } from "solid-js";
import { useMyUserQuery } from "~/api/client";

export function Avatar(props: { userId: string }) {
    const query = useMyUserQuery(() => props.userId);
    const placeholder = createMemo(() => {
        if (query.isLoading || !!query.data?.image) return undefined;
        if (query.error)
            return (
                (query.error as any)?.message ??
                (query.error as any)?.name ??
                (query.error as any)?.cause ??
                "??"
            ).slice(0, 2);
        if (!!query.data?.firstName && !!query.data?.lastName)
            return (
                query.data.firstName.slice(0, 1) +
                query.data.lastName.slice(0, 1)
            ).toUpperCase();
        if (!query.data)
            // Don't know what to display in this case
            return query.status.slice(0, 2);
        return (query.data.firstName ?? query.data.lastName ?? query.data.email)
            .slice(0, 2)
            .toUpperCase();
    });
    return (
        <>
            <Switch
                fallback={
                    <div class="avatar placeholder">
                        <div class="bg-neutral text-neutral-content rounded-full w-16">
                            <span class="loading loading-ring loading-lg"></span>
                        </div>
                    </div>
                }
            >
                <Match when={!!query.data?.image}>
                    <div class="avatar">
                        <div class="w-16 rounded-full">
                            <img src={query.data?.image} />
                        </div>
                    </div>
                </Match>
                <Match when={!!placeholder()}>
                    <div class="avatar placeholder">
                        <div class="bg-neutral text-neutral-content rounded-full w-16">
                            <span class="text-xl">{placeholder()}</span>
                        </div>
                    </div>
                </Match>
            </Switch>
        </>
    );
}