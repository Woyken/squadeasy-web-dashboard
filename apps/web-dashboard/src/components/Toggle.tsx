import { Show } from "solid-js";

export function Toggle(props: {
    label: string;
    description?: string;
    checked: boolean;
    onChecked: (state: boolean) => void;
}) {
    return (
        <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/5 bg-base-300/30 px-4 py-3 transition-colors hover:bg-base-300/50">
            <div class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-base-content">
                    {props.label}
                </span>
                <Show when={props.description}>
                    <span class="block text-xs text-base-content/40">
                        {props.description}
                    </span>
                </Show>
            </div>
            <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                checked={props.checked}
                onchange={(e) => props.onChecked(e.currentTarget.checked)}
            />
        </label>
    );
}
