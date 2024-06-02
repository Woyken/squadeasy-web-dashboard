import "@shoelace-style/shoelace/dist/components/drawer/drawer.js";
import type SlDrawer from "@shoelace-style/shoelace/dist/components/drawer/drawer.js";
import { JSX } from "solid-js";

export default function Drawer(
    props: JSX.Props<SlDrawer> & JSX.HTMLAttributes<SlDrawer>
) {
    return <sl-drawer {...props}>{props.children}</sl-drawer>;
}
