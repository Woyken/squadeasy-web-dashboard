import { createSignal, createMemo, For, Show } from "solid-js";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { useLoginMutation } from "~/api/client";
import { useUsersTokens } from "~/components/UsersTokensProvider";
import { Avatar } from "~/components/Avatar";
import { UserLoader } from "~/components/UserLoader";

export const Route = createFileRoute("/login")({
    component: LoginPage,
});

function LoginPage() {
    const navigate = useNavigate();
    const usersTokens = useUsersTokens();
    const loginMutation = useLoginMutation();
    const [email, setEmail] = createSignal("");
    const [pass, setPass] = createSignal("");
    const [error, setError] = createSignal("");

    const existingUserIds = createMemo(() =>
        Array.from(usersTokens().tokens.keys()),
    );

    const handleLogin = async () => {
        setError("");
        if (!email() || !pass()) {
            setError("EMAIL AND PASSWORD REQUIRED");
            return;
        }
        try {
            await loginMutation.mutateAsync({
                email: email(),
                password: pass(),
            });
            navigate({ to: "/" });
        } catch (e) {
            setError(
                `AUTH_FAILED: ${e instanceof Error ? e.message : "UNKNOWN_ERROR"}`,
            );
        }
    };

    const goToDashboard = () => navigate({ to: "/" });

    return (
        <main class="grid min-h-[calc(100vh-48px)] place-items-center bg-white p-6">
            <div class="w-full max-w-105 border-[3px] border-black bg-white p-8">
                <h1 class="mb-2 font-mono text-2xl font-bold tracking-tight">
                    SQUADEASY_
                </h1>
                <div class="mb-6 bg-black px-3 py-1.5 text-[11px] tracking-widest text-(--color-brut-red)">
                    STATUS: AWAITING_AUTH
                </div>

                <Show when={error()}>
                    <div class="mb-4 border-2 border-(--color-brut-red) bg-(--color-brut-red)/5 px-3 py-2 text-[11px] text-(--color-brut-red)">
                        {error()}
                    </div>
                </Show>

                <div class="mb-4">
                    <label class="mb-1 block text-[11px] font-bold tracking-widest">
                        EMAIL:
                    </label>
                    <input
                        type="email"
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                        placeholder="user@host"
                        class="brut-input"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                </div>
                <div class="mb-6">
                    <label class="mb-1 block text-[11px] font-bold tracking-widest">
                        PASS:
                    </label>
                    <input
                        type="password"
                        value={pass()}
                        onInput={(e) => setPass(e.currentTarget.value)}
                        placeholder="********"
                        class="brut-input"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                </div>

                <button
                    class="brut-btn-primary w-full"
                    onClick={handleLogin}
                    disabled={loginMutation.isPending}
                >
                    {loginMutation.isPending
                        ? "[AUTHENTICATING...]"
                        : "[AUTHENTICATE]"}
                </button>

                <Show when={existingUserIds().length > 0}>
                    <div class="mt-6 border-t-2 border-black pt-4">
                        <span class="text-[11px] text-(--color-brut-gray)">
                            ACTIVE_SESSIONS:
                        </span>
                        <div class="mt-2 flex flex-col gap-2">
                            <For each={existingUserIds()}>
                                {(userId) => (
                                    <button
                                        class="flex w-full items-center gap-3 border-2 border-(--color-brut-light) bg-transparent px-3 py-2 text-left font-mono text-[11px] transition-colors hover:border-(--color-brut-red)"
                                        onClick={goToDashboard}
                                    >
                                        <Avatar userId={userId} size={28} />
                                        <UserLoader userId={userId}>
                                            {(query, displayName) => (
                                                <Show
                                                    when={!query.isLoading}
                                                    fallback={
                                                        <span class="h-3 w-20 brut-skeleton" />
                                                    }
                                                >
                                                    <span class="font-bold uppercase">
                                                        {displayName()}
                                                    </span>
                                                </Show>
                                            )}
                                        </UserLoader>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
        </main>
    );
}
