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
                const newToast = { message };
                setActiveToasts((old) => [...old, newToast]);
                return () =>
                    setActiveToasts((old) => old.filter((x) => x !== newToast));
            }}
        >
            <Show when={activeToasts().length > 0}>
                <div class="fixed left-1/2 top-20 z-[100] flex -translate-x-1/2 flex-col gap-2">
                    <For each={activeToasts()}>
                        {(activeToast) => (
                            <div class="animate-slide-down rounded-xl border border-info/20 bg-base-200/95 px-4 py-2.5 shadow-lg backdrop-blur-xl">
                                <span class="text-sm text-info">
                                    {activeToast.message}
                                </span>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
            {props.children}
        </ctx.Provider>
    );
}
