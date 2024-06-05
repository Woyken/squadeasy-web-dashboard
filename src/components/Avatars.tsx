import { For, Match, Show, Switch } from "solid-js";

export function Avatars(props: {
    users: (
        | { image: string; placeholder?: never }
        | { placeholder: string; image?: never }
        | { loading: true; placeholder?: never; image?: never }
    )[];
}) {
    return (
        <div class="avatar-group -space-x-6 rtl:space-x-reverse">
            <Show when={props.users.length === 0}>
                <div class="avatar placeholder">
                    <div class="w-12 bg-neutral text-neutral-content">
                        <svg
                            class="text-gray-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                clip-rule="evenodd"
                            ></path>
                        </svg>
                    </div>
                </div>
            </Show>
            <For
                each={
                    props.users.length === 3
                        ? props.users
                        : props.users.slice(0, 2)
                }
            >
                {(user) => (
                    <Switch
                        fallback={
                            <div class="avatar placeholder">
                                <div class="w-12 bg-neutral text-neutral-content">
                                    <span class="loading loading-ring loading-lg"></span>
                                </div>
                            </div>
                        }
                    >
                        <Match when={!!user.image}>
                            <div class="avatar">
                                <div class="w-12">
                                    <img src={user.image} />
                                </div>
                            </div>
                        </Match>
                        <Match when={!!user.placeholder}>
                            <div class="avatar placeholder">
                                <div class="w-12 bg-neutral text-neutral-content">
                                    <span>{user.placeholder}</span>
                                </div>
                            </div>
                        </Match>
                    </Switch>
                )}
            </For>
            <Show when={props.users.length > 3}>
                <div class="avatar placeholder">
                    <div class="w-12 bg-neutral text-neutral-content">
                        <span>+{props.users.length - 2}</span>
                    </div>
                </div>
            </Show>
            <Show when={props.users.length > 3}>
                <div class="avatar placeholder">
                    <div class="w-12 bg-neutral text-neutral-content">
                        <span>+{props.users.length - 2}</span>
                    </div>
                </div>
            </Show>
        </div>
    );
}
