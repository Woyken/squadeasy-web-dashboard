import { createForm } from "@tanstack/solid-form";
import { valibotValidator } from "@tanstack/valibot-form-adapter";
import { customAsync, email, minLength, pipe, string } from "valibot";
import type { FieldApi } from "@tanstack/solid-form";
import { useLoginMutation } from "~/api/client";
import Button from "./sl/ClientButton";
import Input from "./sl/Input";

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
        },
        // Add a validator to support Valibot usage in Form and Field
        validatorAdapter: valibotValidator,
    }));

    return (
        <>
            <div class="min-h-screen bg-base-200 flex items-center">
                <div class="card mx-auto w-full max-w-2xl shadow-xl">
                    <div class="grid  md:grid-cols-1 grid-cols-1  bg-base-100 rounded-xl">
                        <div class="py-24 px-10">
                            <h2 class="text-2xl font-semibold mb-2 text-center">
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
                                                    "label-text text-base-content "
                                                }
                                            >
                                                Email
                                            </span>
                                        </label>
                                        <form.Field
                                            name="email"
                                            validators={{
                                                onChange: pipe(
                                                    string(),
                                                    email()
                                                ),
                                            }}
                                            children={(field) => {
                                                return (
                                                    <>
                                                        <input
                                                            type="email"
                                                            name={field().name}
                                                            value={
                                                                field().state
                                                                    .value
                                                            }
                                                            onBlur={
                                                                field()
                                                                    .handleBlur
                                                            }
                                                            onInput={(e) =>
                                                                field().handleChange(
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                            placeholder={
                                                                "email@example.com"
                                                            }
                                                            class="input input-bordered w-full "
                                                        />
                                                        <FieldInfo
                                                            field={field()}
                                                        />
                                                    </>
                                                );
                                            }}
                                        />
                                    </div>
                                    <div class={`form-control w-full `}>
                                        <label class="label">
                                            <span
                                                class={
                                                    "label-text text-base-content "
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
                                                    minLength(3)
                                                ),
                                            }}
                                            children={(field) => (
                                                <>
                                                    <input
                                                        type="password"
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
                                                                    .value
                                                            )
                                                        }
                                                        placeholder={
                                                            "***********"
                                                        }
                                                        class="input input-bordered w-full "
                                                    />
                                                    <FieldInfo
                                                        field={field()}
                                                    />
                                                </>
                                            )}
                                        />
                                    </div>
                                </div>
                                <p class={`text-center  text-error`}>
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
                                                    "btn mt-2 w-full btn-primary"
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
            <div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                >
                    <div>
                        {/* A type-safe field component*/}
                        <form.Field
                            name="email"
                            validators={{
                                onChange: pipe(string(), email()),
                            }}
                            children={(field) => {
                                // Avoid hasty abstractions. Render props are great!
                                return (
                                    <>
                                        <Input
                                            prop:type="email"
                                            prop:label="Email"
                                            id={field().name}
                                            prop:name={field().name}
                                            prop:value={field().state.value}
                                            onBlur={field().handleBlur}
                                            onInput={(e) =>
                                                field().handleChange(
                                                    e.currentTarget.value
                                                )
                                            }
                                        />
                                        <FieldInfo field={field()} />
                                    </>
                                );
                            }}
                        />
                    </div>
                    <div></div>
                    <form.Subscribe
                        selector={(state) => ({
                            canSubmit: state.canSubmit,
                            isSubmitting: state.isSubmitting,
                        })}
                        children={(state) => {
                            return (
                                <Button
                                    prop:type="submit"
                                    prop:disabled={!state().canSubmit}
                                >
                                    {state().isSubmitting ? "..." : "Submit"}
                                </Button>
                            );
                        }}
                    />
                </form>
            </div>
        </>
    );
}
