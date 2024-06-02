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
                <div>
                    <form.Field
                        name="password"
                        validators={{
                            onChange: pipe(string(), minLength(3)),
                        }}
                        children={(field) => (
                            <>
                                <Input
                                    prop:type="password"
                                    prop:label="Password"
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
                        )}
                    />
                </div>
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
    );
}
