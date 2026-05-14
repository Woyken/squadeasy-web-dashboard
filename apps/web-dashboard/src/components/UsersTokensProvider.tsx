import {
  createContext,
  createEffect,
  createSignal,
  useContext,
  type JSX,
  type Accessor,
} from "solid-js";
import { USER_TOKENS_KEY } from "~/utils/localStorage";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UsersTokensValue {
  tokens: Map<string, TokenPair>;
  setToken: (userId: string, accessToken: string, refreshToken: string) => void;
  removeToken: (userId: string) => void;
}

const UsersTokensContext = createContext<Accessor<UsersTokensValue>>();

function loadTokensFromStorage(): Map<string, TokenPair> {
  try {
    const raw = localStorage.getItem(USER_TOKENS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, TokenPair>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveTokensToStorage(tokens: Map<string, TokenPair>) {
  const obj = Object.fromEntries(tokens);
  localStorage.setItem(USER_TOKENS_KEY, JSON.stringify(obj));
}

export function UsersTokensProvider(props: { children: JSX.Element }) {
  const [tokens, setTokens] = createSignal<Map<string, TokenPair>>(
    loadTokensFromStorage(),
  );

  createEffect(() => {
    saveTokensToStorage(tokens());
  });

  const setToken = (userId: string, accessToken: string, refreshToken: string) => {
    setTokens((prev) => {
      const next = new Map(prev);
      next.set(userId, { accessToken, refreshToken });
      return next;
    });
  };

  const removeToken = (userId: string) => {
    setTokens((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const value: Accessor<UsersTokensValue> = () => ({
    tokens: tokens(),
    setToken,
    removeToken,
  });

  return (
    <UsersTokensContext.Provider value={value}>
      {props.children}
    </UsersTokensContext.Provider>
  );
}

export function useUsersTokens(): Accessor<UsersTokensValue> {
  const ctx = useContext(UsersTokensContext);
  if (!ctx) throw new Error("useUsersTokens must be inside UsersTokensProvider");
  return ctx;
}
