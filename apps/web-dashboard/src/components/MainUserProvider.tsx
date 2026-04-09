import {
    Accessor,
    ParentProps,
    Setter,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    useContext,
} from "solid-js";
import { useUsersTokens } from "./UsersTokensProvider";
import {
    localStorageGetItem,
    localStorageRemoveItem,
    localStorageSetItem,
} from "~/utils/localStorage";

const ctx = createContext<{
    mainUserId: Accessor<string | undefined>;
    setMainUserId: Setter<string | undefined>;
}>();

export function useMainUser() {
    const value = useContext(ctx);
    if (!value) throw new Error("Missing <MainUserProvider />");

    return value;
}

export function MainUserProvider(props: ParentProps) {
    let savedMainUserId = localStorageGetItem("mainUserId") ?? undefined;

    const [mainUserId, setMainUserId] = createSignal<string | undefined>();
    const users = useUsersTokens();
    const userIds = createMemo(() => Array.from(users().tokens.keys()));
    const firstUserId = createMemo(() => userIds()[0]);

    const savedMainUserExistsInLoggedInUsers = createMemo(() => {
        if (!savedMainUserId) return false;
        if (userIds().find((userId) => userId === savedMainUserId)) return true;
    });

    createEffect(() => {
        // Double check if saved main user actually exists in current logged in users list
        if (savedMainUserExistsInLoggedInUsers())
            setMainUserId(savedMainUserId);
    });

    createEffect(() => {
        const id = mainUserId();
        if (!id) localStorageRemoveItem("mainUserId");
        else localStorageSetItem("mainUserId", id);
    });

    return (
        <ctx.Provider
            value={{
                mainUserId: () => mainUserId() ?? firstUserId(),
                setMainUserId,
            }}
        >
            {props.children}
        </ctx.Provider>
    );
}
