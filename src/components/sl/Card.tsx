import "@shoelace-style/shoelace/dist/components/card/card.js";
import type SlCard from "@shoelace-style/shoelace/dist/components/card/card.js";
import { JSX } from "solid-js";

export default function Card(
    props: JSX.Props<SlCard> & JSX.HTMLAttributes<SlCard>
) {
    return <sl-card {...props}>{props.children}</sl-card>;
}
