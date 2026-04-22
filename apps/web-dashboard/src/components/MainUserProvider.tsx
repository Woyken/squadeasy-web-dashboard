import { createContext, createEffect, createMemo, createSignal, useContext, type Accessor, type JSX } from "solid-js";
import { useUsersTokens } from "./UsersTokensProvider";
import { localStorageGetItem, localStorageSetItem, localStorageRemoveItem } from "~/utils/localStorage";

const STORAGE_KEY = "sqe_main_user_id";

interface MainUserContextValue {
  mainUserId: Accessor<string | undefined>;
  setMainUserId: (userId: string) => void;
}

const MainUserContext = createContext<MainUserContextValue>({
  mainUserId: () => undefined,
  setMainUserId: () => {},
});

export function MainUserProvider(props: { children: JSX.Element }) {
  const usersTokens = useUsersTokens();
  const [selectedUserId, setSelectedUserId] = createSignal<string | undefined>(
    localStorageGetItem(STORAGE_KEY) ?? undefined,
  );

  const mainUserId = createMemo(() => {
    const keys = Array.from(usersTokens().tokens.keys());
    if (keys.length === 0) return undefined;
    const selected = selectedUserId();
    if (selected && keys.includes(selected)) return selected;
    return keys[0];
  });

  createEffect(() => {
    const id = mainUserId();
    if (id) {
      localStorageSetItem(STORAGE_KEY, id);
    } else {
      localStorageRemoveItem(STORAGE_KEY);
    }
  });

  const setMainUserId = (userId: string) => {
    setSelectedUserId(userId);
  };

  return (
    <MainUserContext.Provider value={{ mainUserId, setMainUserId }}>
      {props.children}
    </MainUserContext.Provider>
  );
}

export function useMainUser() {
  return useContext(MainUserContext);
}
