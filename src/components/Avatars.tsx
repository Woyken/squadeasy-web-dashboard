import { For, Match, Show, Suspense, Switch } from "solid-js";
import { useMyUserQuery, useUserStatisticsQuery } from "~/api/client";
import { getUserInitials } from "~/getUserDisplayName";

export function Avatars(props: { userIds: string[] }) {
    return (
        <div class="avatar-group -space-x-6 rtl:space-x-reverse">
            <Show when={props.userIds.length === 0}>
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
                    props.userIds.length === 3
                        ? props.userIds
                        : props.userIds.slice(0, 2)
                }
            >
                {(userId) => {
                    const myUserQuery = useMyUserQuery(() => userId);

                    const userStatisticsQuery = useUserStatisticsQuery(
                        () => userId,
                    );

                    return (
                        <Suspense
                            fallback={
                                <div class="avatar placeholder">
                                    <div class="w-12 bg-neutral text-neutral-content">
                                        <span class="loading loading-ring loading-lg"></span>
                                    </div>
                                </div>
                            }
                        >
                            <Switch
                                fallback={
                                    <div class="avatar placeholder">
                                        <div class="w-12 bg-neutral text-neutral-content">
                                            <span class="loading loading-ring loading-lg"></span>
                                        </div>
                                    </div>
                                }
                            >
                                <Match when={!!userStatisticsQuery.data?.image}>
                                    <div class="avatar">
                                        <div class="w-12">
                                            <img
                                                src={
                                                    userStatisticsQuery.data!
                                                        .image!
                                                }
                                            />
                                        </div>
                                    </div>
                                </Match>
                                <Match
                                    when={!!getUserInitials(myUserQuery.data)}
                                >
                                    <div class="avatar placeholder">
                                        <div class="w-12 bg-neutral text-neutral-content">
                                            <span>
                                                {getUserInitials(
                                                    myUserQuery.data,
                                                ) ?? "??"}
                                            </span>
                                        </div>
                                    </div>
                                </Match>
                            </Switch>
                        </Suspense>
                    );
                }}
            </For>
            <Show when={props.userIds.length > 3}>
                <div class="avatar placeholder">
                    <div class="w-12 bg-neutral text-neutral-content">
                        <span>+{props.userIds.length - 2}</span>
                    </div>
                </div>
            </Show>
            <Show when={props.userIds.length > 3}>
                <div class="avatar placeholder">
                    <div class="w-12 bg-neutral text-neutral-content">
                        <span>+{props.userIds.length - 2}</span>
                    </div>
                </div>
            </Show>
        </div>
    );
}
