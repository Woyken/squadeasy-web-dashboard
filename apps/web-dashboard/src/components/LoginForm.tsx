import { createForm } from "@tanstack/solid-form";
import { email, minLength, pipe, string } from "valibot";
import type { FieldApi } from "@tanstack/solid-form";
import { useLoginMutation } from "~/api/client";
import { useNavigate } from "@tanstack/solid-router";

interface FieldInfoProps {
    field: FieldApi<any, any, any, any>;
}

function FieldInfo(props: FieldInfoProps) {
    return (
        <>
            {props.field.state.meta.touchedErrors ? (
                <em class="mt-1 text-xs text-error">
                    {props.field.state.meta.touchedErrors}
                </em>
            ) : null}
            {props.field.state.meta.isValidating ? (
                <span class="mt-1 text-xs text-info">Validating...</span>
            ) : null}
        </>
    );
}

export default function LoginForm() {
    const loginMutation = useLoginMutation();
    const navigate = useNavigate();
    const form = createForm(() => ({
        defaultValues: {
            email: "",
            password: "",
        },
        onSubmit: async ({ value }) => {
            await loginMutation.mutateAsync({
                email: value.email,
                password: value.password,
            });
            navigate({ to: "/" });
        },
    }));

    return (
        <div class="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
            <div class="gradient-card p-8 sm:p-10">
                {/* Logo */}
                <div class="mb-8 text-center">
                    <span class="text-3xl">⚡</span>
                    <h2 class="mt-2 text-2xl font-bold text-gradient">
                        SquadEasy
                    </h2>
                    <p class="mt-1 text-sm text-base-content/50">
                        Sign in to your dashboard
                    </p>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    class="flex flex-col gap-5"
                >
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-base-content/70">
                            Email
                        </label>
                        <form.Field
                            name="email"
                            validators={{
                                onChange: pipe(string(), email()),
                            }}
                            children={(field) => (
                                <>
                                    <input
                                        type="email"
                                        name={field().name}
                                        value={field().state.value}
                                        onBlur={field().handleBlur}
                                        onInput={(e) =>
                                            field().handleChange(
                                                e.currentTarget.value,
                                            )
                                        }
                                        placeholder="email@example.com"
                                        class="w-full rounded-xl border border-white/10 bg-base-300/50 px-4 py-3 text-sm text-base-content outline-none transition-all placeholder:text-base-content/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                    />
                                    <FieldInfo field={field()} />
                                </>
                            )}
                        />
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-base-content/70">
                            Password
                        </label>
                        <form.Field
                            name="password"
                            validators={{
                                onChange: pipe(string(), minLength(3)),
                            }}
                            children={(field) => (
                                <>
                                    <input
                                        type="password"
                                        name={field().name}
                                        value={field().state.value}
                                        onBlur={field().handleBlur}
                                        onInput={(e) =>
                                            field().handleChange(
                                                e.currentTarget.value,
                                            )
                                        }
                                        placeholder="•••••••••"
                                        class="w-full rounded-xl border border-white/10 bg-base-300/50 px-4 py-3 text-sm text-base-content outline-none transition-all placeholder:text-base-content/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                    />
                                    <FieldInfo field={field()} />
                                </>
                            )}
                        />
                    </div>

                    <p class="text-center text-sm text-error">
                        {loginMutation.error?.message}
                    </p>

                    <form.Subscribe
                        selector={(state) => ({
                            canSubmit: state.canSubmit,
                            isSubmitting: state.isSubmitting,
                        })}
                        children={(state) => (
                            <button
                                type="submit"
                                class="mt-1 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-content transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50"
                                disabled={!state().canSubmit}
                            >
                                {state().isSubmitting ? (
                                    <span class="loading loading-spinner loading-sm"></span>
                                ) : null}
                                Sign in
                            </button>
                        )}
                    />
                </form>
            </div>
        </div>
    );
}
