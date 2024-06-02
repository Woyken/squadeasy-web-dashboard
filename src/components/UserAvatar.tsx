import { useMyUserQuery } from "~/api/client";
import Avatar from "./sl/Avatar";
import { Show } from "solid-js";
import Spinner from "./sl/Spinner";

export function UserAvatar(props: { userId: string; onclick?: () => void }) {
    const query = useMyUserQuery(() => props.userId);
    return (
        <>
            <Show
                when={!!query.data}
                fallback={
                    <Show
                        when={!query.isLoading}
                        fallback={
                            <Spinner
                                onclick={props.onclick}
                                style="font-size: 3rem;"
                            />
                        }
                    >
                        <Avatar
                            onclick={props.onclick}
                            prop:label="Avatar of user"
                            prop:image="https://images.unsplash.com/photo-1529778873920-4da4926a72c2?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80"
                        />
                    </Show>
                }
            >
                <Avatar
                    onclick={props.onclick}
                    prop:label="Avatar of user"
                    prop:initials={`${query.data?.firstName[0]}${query.data?.lastName[0]}`}
                    prop:image={query.data?.image}
                />
            </Show>
        </>
    );
}
