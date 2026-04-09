import { Title } from "@solidjs/meta";
import LoginForm from "~/components/LoginForm";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/login")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main class="flex flex-1 items-center justify-center bg-base-200 bg-grid">
            <div class="bg-glow absolute inset-0" />
            <Title>Login — SquadEasy</Title>
            <LoginForm />
        </main>
    );
}
