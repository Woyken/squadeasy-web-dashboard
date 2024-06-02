import "@shoelace-style/shoelace/dist/components/avatar/avatar.js";
import type SlAvatar from "@shoelace-style/shoelace/dist/components/avatar/avatar.js";
import { JSX } from "solid-js";

export default function Avatar(
    props: JSX.Props<SlAvatar> & JSX.HTMLAttributes<SlAvatar>
) {
    return <sl-avatar {...props}>{props.children}</sl-avatar>;
}
