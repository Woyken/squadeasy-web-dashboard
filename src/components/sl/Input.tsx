import "@shoelace-style/shoelace/dist/components/input/input.js";
import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import { JSX } from "solid-js";

export default function Input(
    props: JSX.Props<SlInput> & JSX.HTMLAttributes<SlInput>
) {
    return <sl-input {...props}>{props.children}</sl-input>;
}
