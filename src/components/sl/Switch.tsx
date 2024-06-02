import "@shoelace-style/shoelace/dist/components/switch/switch.js";
import type SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.js";
import { JSX } from "solid-js";

export default function Switch(
    props: JSX.Props<SlSwitch> & JSX.HTMLAttributes<SlSwitch>
) {
    return <sl-switch {...props}>{props.children}</sl-switch>;
}
