import { createContext, createSignal, For, onCleanup, useContext, type JSX } from "solid-js";

type Toaster = (message: string) => () => void;

const ToasterContext = createContext<Toaster>(() => () => {});

let toastId = 0;

export function ToasterProvider(props: { children: JSX.Element }) {
  const [toasts, setToasts] = createSignal<{ id: number; message: string }[]>([]);

  const toaster: Toaster = (message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message }]);
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
    return () => {
      clearTimeout(timeout);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };
  };

  return (
    <ToasterContext.Provider value={toaster}>
      {props.children}
      <div class="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2">
        <For each={toasts()}>
          {(toast) => (
            <div
              class="border-2 border-black bg-white px-4 py-3 font-mono text-xs shadow-[4px_4px_0_#000]"
              style={{ animation: "toast-in 0.2s ease-out" }}
            >
              {toast.message}
            </div>
          )}
        </For>
      </div>
    </ToasterContext.Provider>
  );
}

export function useToaster(): Toaster {
  return useContext(ToasterContext);
}
