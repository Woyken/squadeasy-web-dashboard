import {
    Accessor,
    ParentProps,
    createContext,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";

interface Token {
    accessToken: string;
    refreshToken: string;
}

interface CtxValue {
    tokens: Map<string, Token>;
    setToken: (
        userId: string,
        accessToken: string,
        refreshToken: string
    ) => void;
    removeToken: (userId: string) => void;
}

const ctx = createContext<Accessor<CtxValue>>();

export function useUsersTokens() {
    const c = useContext(ctx);
    if (!c) throw new Error("Missing <UsersTokensProvider/>");

    return c;
}

export function UsersTokensProvider(props: ParentProps) {
    const [tokens, setTokens] = createSignal(new Map<string, Token>());

    createEffect(() => {
        const itemsStr = window?.localStorage?.getItem("loginData");
        if (itemsStr) {
            const parsedMapData = JSON.parse(itemsStr);
            if (parsedMapData && Array.isArray(parsedMapData))
                // Too lazy to check type, assume it's valid
                setTokens(new Map(parsedMapData as any) as any);
        }
    });

    createEffect(() => {
        window?.localStorage?.setItem(
            "loginData",
            JSON.stringify(Array.from(tokens().entries()))
        );
    });

    return (
        <ctx.Provider
            value={() => ({
                setToken: (userId, accessToken, refreshToken) => {
                    setTokens((old) => {
                        const m = new Map(old);
                        m.set(userId, {
                            accessToken,
                            refreshToken,
                        });
                        return m;
                    });
                },
                removeToken: (userId) => {
                    setTokens((old) => {
                        const m = new Map(old);
                        m.delete(userId);
                        return m;
                    });
                },
                tokens: tokens(),
            })}
        >
            {props.children}
        </ctx.Provider>
    );
}
