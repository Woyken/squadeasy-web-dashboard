import {
    Match,
    Switch,
    createEffect,
    createMemo,
    createSignal,
} from "solid-js";
import { useUserByIdQuery } from "~/api/client";
import { getUserInitials } from "~/getUserDisplayName";

export function Avatar(props: { userId: string }) {
    const query = useUserByIdQuery(() => props.userId);
    const placeholder = createMemo(() => {
        if (query.isLoading || !!query.data?.imageUrl) return undefined;
        if (query.error)
            return (
                query.error?.message ??
                query.error?.name ??
                query.error?.cause ??
                "??"
            ).slice(0, 2);
        if (!query.data)
            // Don't know what to display in this case
            return query.status.slice(0, 2);
        return getUserInitials(query.data);
    });
    // If I use `query.data?.image` directly inside Switch component, it breaks for some reason
    const [userImage, setUserImage] = createSignal<string>();
    createEffect(() => {
        setUserImage(query.data?.imageUrl);
    });
    return (
        <>
            <Switch
                fallback={
                    <div class="avatar placeholder">
                        <div class="w-16 rounded-full bg-neutral text-neutral-content">
                            <span class="loading loading-ring loading-lg"></span>
                        </div>
                    </div>
                }
            >
                <Match when={!!userImage()}>
                    <div class="avatar">
                        <div class="w-16 rounded-full">
                            <img src={userImage()} />
                        </div>
                    </div>
                </Match>
                <Match when={!!placeholder()}>
                    <div class="avatar placeholder">
                        <div class="w-16 rounded-full bg-neutral text-neutral-content">
                            <span class="text-xl">{placeholder()}</span>
                        </div>
                    </div>
                </Match>
            </Switch>
        </>
    );
}
