import "@shoelace-style/shoelace/dist/components/button/button.js";
import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import { JSX } from "solid-js";

export default function Button(
    props: JSX.Props<SlButton> & JSX.HTMLAttributes<SlButton>
) {
    return <sl-button {...props}>{props.children}</sl-button>;
}
