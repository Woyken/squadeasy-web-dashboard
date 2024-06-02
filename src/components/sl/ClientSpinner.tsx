import "@shoelace-style/shoelace/dist/components/spinner/spinner.js";
import type SlSpinner from "@shoelace-style/shoelace/dist/components/spinner/spinner.js";
import { JSX } from "solid-js";

export default function Spinner(
    props: JSX.Props<SlSpinner> & JSX.HTMLAttributes<SlSpinner>
) {
    return <sl-spinner {...props}>{props.children}</sl-spinner>;
}
