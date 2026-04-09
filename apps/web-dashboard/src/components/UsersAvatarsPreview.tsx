import { For, Show } from "solid-js";
import { Avatar } from "./Avatar";

export function UsersAvatarsPreview(props: { userIds: string[] }) {
  return (
    <div class="flex items-center -space-x-2">
      <For each={props.userIds.slice(0, 4)}>
        {(id) => <Avatar userId={id} size={28} />}
      </For>
      <Show when={props.userIds.length > 4}>
        <span class="brut-avatar ml-1 text-[10px]" style={{ width: "28px", height: "28px" }}>
          <span class="inline-grid h-full w-full place-items-center bg-[var(--color-brut-gray)] text-white">
            +{props.userIds.length - 4}
          </span>
        </span>
      </Show>
    </div>
  );
}
