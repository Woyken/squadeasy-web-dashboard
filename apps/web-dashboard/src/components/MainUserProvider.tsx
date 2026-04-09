import { createContext, createMemo, useContext, type Accessor, type JSX } from "solid-js";
import { useUsersTokens } from "./UsersTokensProvider";

interface MainUserContextValue {
  mainUserId: Accessor<string | undefined>;
}

const MainUserContext = createContext<MainUserContextValue>({
  mainUserId: () => undefined,
});

export function MainUserProvider(props: { children: JSX.Element }) {
  const usersTokens = useUsersTokens();
  const mainUserId = createMemo(() => {
    const keys = Array.from(usersTokens().tokens.keys());
    return keys[0];
  });

  return (
    <MainUserContext.Provider value={{ mainUserId }}>
      {props.children}
    </MainUserContext.Provider>
  );
}

export function useMainUser() {
  return useContext(MainUserContext);
}
