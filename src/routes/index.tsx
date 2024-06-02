import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";
import { useUsersTokens } from "~/components/UsersTokensProvider";

export default function Home() {
    const navigate = useNavigate();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate("/login");
    });
    return (
        <main>
            <Title>SquadEasy</Title>
            <h1>TODO: SquadEasy dashboard</h1>
        </main>
    );
}
