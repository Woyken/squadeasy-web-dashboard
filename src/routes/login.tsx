import { Title } from "@solidjs/meta";
import LoginForm from "~/components/LoginForm";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/login")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main>
            <Title>Login</Title>
            <LoginForm />
        </main>
    );
}
