import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useMyChallengeQuery } from "~/api/client";
import { useUsersTokens } from "~/components/UsersTokensProvider";

export default function Home() {
    const navigate = useNavigate();
    const users = useUsersTokens();
    createEffect(() => {
        if (users().tokens.size === 0) navigate("/login");
    });
    const firstUserId = createMemo(
        () => users().tokens.keys().next().value as string | undefined
    );
    // If user is not set, will navigate out, this page
    const query = useMyChallengeQuery(firstUserId);
    const endAtTimestamp = createMemo(() => {
        if (!query.data || !query.data.endAt) return;
        return new Date(query.data.endAt).getTime();
    });
    const [diffMs, setDiffMs] = createSignal(0);
    createEffect(() => {
        const endAtMs = endAtTimestamp();
        if (endAtMs === undefined) return;

        const interval = setInterval(() => {
            setDiffMs(endAtMs - new Date().getTime());
        }, 1000);
        onCleanup(() => clearInterval(interval));
    });

    const absDiffMs = createMemo(() => Math.abs(diffMs()));
    const sLeft = createMemo(() =>
        Math.floor((absDiffMs() % (60 * 1000)) / 1000)
            .toString()
            .padStart(2, "0")
    );
    const mLeft = createMemo(() =>
        Math.floor((absDiffMs() % (60 * 60 * 1000)) / (60 * 1000))
            .toString()
            .padStart(2, "0")
    );
    const hLeft = createMemo(() =>
        Math.floor((absDiffMs() % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
            .toString()
            .padStart(2, "0")
    );
    const dLeft = createMemo(() =>
        Math.floor(absDiffMs() / (24 * 60 * 60 * 1000))
            .toString()
            .padStart(2, "0")
    );
    return (
        <main>
            <Title>SquadEasy</Title>
            <h1>Countdown</h1>
            <h2>
                {diffMs() < 0 ? "-" : ""} {dLeft()}d {hLeft()}h:{mLeft()}m:
                {sLeft()}s
            </h2>
        </main>
    );
}
