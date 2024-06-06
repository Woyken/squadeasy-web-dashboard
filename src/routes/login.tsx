import { clientOnly } from "@solidjs/start";
import { Title } from "@solidjs/meta";

const LoginForm = clientOnly(() => import("~/components/LoginForm"));

export default function LoginNewUser() {
    return (
        <main>
            <Title>Login</Title>
            <LoginForm />
        </main>
    );
}
