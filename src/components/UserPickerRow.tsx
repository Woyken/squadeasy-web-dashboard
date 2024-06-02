import { useMyUserQuery } from "~/api/client";
import { Show } from "solid-js";
import { UserAvatar } from "./UserAvatar";
import Spinner from "./sl/Spinner";
import { A } from "@solidjs/router";

export function UserPickerRow(props: { userId: string }) {
    const query = useMyUserQuery(() => props.userId);
    return (
        <>
            <Show when={!!query.data} fallback={<Spinner />}>
                <>
                    <A href={`/user/${props.userId}`}>
                        <UserAvatar userId={props.userId} />
                        {query.data?.firstName} {query.data?.lastName}
                    </A>
                </>
            </Show>
        </>
    );
}
