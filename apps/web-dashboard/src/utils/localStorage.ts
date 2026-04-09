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
