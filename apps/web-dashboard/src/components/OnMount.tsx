import { onMount } from "solid-js";

export function OnMount(props: { onMount: () => void }) {
    onMount(() => {
        props.onMount();
    });
    return <></>;
}
