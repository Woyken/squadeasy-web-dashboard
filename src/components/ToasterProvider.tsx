import {
    For,
    ParentProps,
    Show,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

const ctx = createContext<(message: string) => () => void>();

export function useToaster() {
    const value = useContext(ctx);
    if (!value) throw new Error("Missing <ToasterProvider />");
    return value;
}

export function ToasterProvider(props: ParentProps) {
    const [activeToasts, setActiveToasts] = createSignal<{ message: string }[]>(
        [],
    );
    return (
        <ctx.Provider
            value={(message) => {
                const newToast = {
                    message,
                };
                // Show toast
                setActiveToasts((old) => [...old, newToast]);
                // Cleanup
                return () =>
                    setActiveToasts((old) => old.filter((x) => x !== newToast));
            }}
        >
            <Show when={activeToasts().length > 0}>
                <div class="toast toast-center">
                    <For each={activeToasts()}>
                        {(activeToast) => (
                            <div class="alert alert-info">
                                <span>{activeToast.message}</span>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
            {props.children}
        </ctx.Provider>
    );
}
