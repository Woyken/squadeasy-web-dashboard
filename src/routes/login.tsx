import { Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
const LoginForm = clientOnly(() => import("~/components/LoginForm"));

export default function LoginNewUser() {
    return (
        <main>
            <Title>Login</Title>
            <LoginForm />
        </main>
    );
}
