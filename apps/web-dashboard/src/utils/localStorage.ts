export function localStorageGetItem(key: string) {
    if (typeof window !== "object") return;
    return window.localStorage.getItem(key);
}

export function localStorageSetItem(key: string, value: string) {
    if (typeof window !== "object") return;
    return window.localStorage.setItem(key, value);
}

export function localStorageRemoveItem(key: string) {
    if (typeof window !== "object") return;
    return window.localStorage.removeItem(key);
}

export const USER_TOKENS_KEY = "sqe_user_tokens";

export function hasStoredUserTokens(): boolean {
    const raw = localStorageGetItem(USER_TOKENS_KEY);
    if (!raw) return false;
    try {
        return Object.keys(JSON.parse(raw) as Record<string, unknown>).length > 0;
    } catch {
        return false;
    }
}
