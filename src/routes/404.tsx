import { NotFound } from "~/components/NotFoundRoutePage";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/404")({
    component: RouteComponent,
});

function RouteComponent() {
    return <NotFound />;
}
