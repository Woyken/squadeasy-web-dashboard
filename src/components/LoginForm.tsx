import { createForm } from "@tanstack/solid-form";
import { valibotValidator } from "@tanstack/valibot-form-adapter";
import { email, minLength, pipe, string } from "valibot";
import type { FieldApi } from "@tanstack/solid-form";
import { useLoginMutation } from "~/api/client";
import { useNavigate } from "@solidjs/router";

interface FieldInfoProps {
    field: FieldApi<any, any, any, any>;
}

function FieldInfo(props: FieldInfoProps) {
    return (
        <>
            {props.field.state.meta.touchedErrors ? (
                <em>{props.field.state.meta.touchedErrors}</em>
            ) : null}
            {props.field.state.meta.isValidating ? "Validating..." : null}
        </>
    );
}

export default function LoginForm() {
    const loginMutation = useLoginMutation();
    const navigate = useNavigate();
    // bug, doesn't support ssr. https://github.com/TanStack/form/issues/698
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
            navigate("/");
        },
        // Add a validator to support Valibot usage in Form and Field
        validatorAdapter: valibotValidator,
    }));

    return (
        <div class="flex min-h-screen items-center bg-base-200">
            <div class="card mx-auto w-full max-w-2xl shadow-xl">
                <div class="grid grid-cols-1 rounded-xl bg-base-100 md:grid-cols-1">
                    <div class="px-10 py-24">
                        <h2 class="mb-2 text-center text-2xl font-semibold">
                            Login
                        </h2>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                form.handleSubmit();
                            }}
                        >
                            <div class="mb-4">
                                <div class={`form-control w-full`}>
                                    <label class="label">
                                        <span
                                            class={
                                                "label-text text-base-content"
                                            }
                                        >
                                            Email
                                        </span>
                                    </label>
                                    <form.Field
                                        name="email"
                                        validators={{
                                            onChange: pipe(string(), email()),
                                        }}
                                        children={(field) => {
                                            return (
                                                <>
                                                    <input
                                                        type="email"
                                                        name={field().name}
                                                        value={
                                                            field().state.value
                                                        }
                                                        onBlur={
                                                            field().handleBlur
                                                        }
                                                        onInput={(e) =>
                                                            field().handleChange(
                                                                e.currentTarget
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder={
                                                            "email@example.com"
                                                        }
                                                        class="input input-bordered w-full"
                                                    />
                                                    <FieldInfo
                                                        field={field()}
                                                    />
                                                </>
                                            );
                                        }}
                                    />
                                </div>
                                <div class={`form-control w-full`}>
                                    <label class="label">
                                        <span
                                            class={
                                                "label-text text-base-content"
                                            }
                                        >
                                            Password
                                        </span>
                                    </label>
                                    <form.Field
                                        name="password"
                                        validators={{
                                            onChange: pipe(
                                                string(),
                                                minLength(3),
                                            ),
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
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    placeholder={"***********"}
                                                    class="input input-bordered w-full"
                                                />
                                                <FieldInfo field={field()} />
                                            </>
                                        )}
                                    />
                                </div>
                            </div>
                            <p class={`text-center text-error`}>
                                {loginMutation.error?.message}
                            </p>
                            <form.Subscribe
                                selector={(state) => ({
                                    canSubmit: state.canSubmit,
                                    isSubmitting: state.isSubmitting,
                                })}
                                children={(state) => {
                                    return (
                                        <button
                                            type="submit"
                                            class={
                                                "btn btn-primary mt-2 w-full"
                                            }
                                            disabled={!state().canSubmit}
                                        >
                                            {state().isSubmitting ? (
                                                <span class="loading loading-spinner"></span>
                                            ) : null}
                                            Login
                                        </button>
                                    );
                                }}
                            />
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
