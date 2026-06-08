import { parseJwt } from "../utils/parseJwt.ts";
import {
  mutationLogin,
  mutationRefreshToken,
  queryUserById,
} from "./client.ts";
import { setTimeout } from 'node:timers'

// TODO store token in db
let currentRefreshToken = "";
let currentAccessToken = "";
let currentUserId = "";

const VALID_TOKEN_CACHE_TTL_MS = 2 * 60 * 1000;
// In-memory cache of validated tokens. Each entry carries a self-resetting
// timer that removes the token after 2 minutes of inactivity. The timer is
// rescheduled on every hit, so the entry lives as long as requests keep coming.
const validTokenCache = new Map<string, NodeJS.Timeout>();

function rememberValidToken(accessToken: string, tokenExpiresAt: number) {
  const existingTimer = validTokenCache.get(accessToken);
  if (existingTimer) clearTimeout(existingTimer);

  // Clear after 2 minutes of inactivity, or as soon as the token expires,
  // whichever comes first, so the entry never outlives the token itself.
  const ttl = Math.min(
    VALID_TOKEN_CACHE_TTL_MS,
    tokenExpiresAt - new Date().getTime()
  );
  const timer = setTimeout(() => {
    validTokenCache.delete(accessToken);
  }, ttl);
  // Don't keep the process alive just for cache cleanup.
  timer.unref?.();

  validTokenCache.set(accessToken, timer);
}

export async function isValidAccessToken(accessTokenWithBearer?: string) {
  if (!accessTokenWithBearer) return false;
  if (!accessTokenWithBearer.startsWith("Bearer ")) return false;

  const accessToken = accessTokenWithBearer.replace("Bearer ", "");

  let tokenExpiresAt: number;
  try {
    const parsed = parseJwt(accessToken);
    tokenExpiresAt = parsed.exp * 1000;
    const isExpired = tokenExpiresAt < new Date().getTime();
    if (isExpired) {
      const existingTimer = validTokenCache.get(accessToken);
      if (existingTimer) clearTimeout(existingTimer);
      validTokenCache.delete(accessToken);
      return false;
    }
  } catch (e) {
    return false;
  }

  // Check cache: if previously validated, approve it and reset the inactivity
  // timer so the entry survives as long as requests keep coming.
  if (validTokenCache.has(accessToken)) {
    rememberValidToken(accessToken, tokenExpiresAt);
    return true;
  }

  // make sure current token is initialized;
  await getAccessToken();

  try {
    // Try to find "current" user with provided credentials.
    // If found assume it's the same challenge and allow it through
    const foundUser = await queryUserById(accessToken, currentUserId);
    if (foundUser.id !== currentUserId) return false;
  } catch (e) {
    return false;
  }

  // Cache the valid token; it will be cleared after 2 minutes of inactivity.
  rememberValidToken(accessToken, tokenExpiresAt);

  return true;
}

export async function getAsyncTokenRaw() {
  if (!currentAccessToken || !currentRefreshToken) {
    console.log("access token doesn't exist yet, logging in...");
    const loginResult = await mutationLogin(
      process.env.EMAIL!,
      process.env.PASSWORD!
    );
    console.log("login success, user id:", loginResult.myUser.id);
    currentAccessToken = loginResult.accessToken;
    currentRefreshToken = loginResult.refreshToken;
    currentUserId = loginResult.myUser.id;

    return loginResult.accessToken;
  }

  const tokenExpiresAt = parseJwt(currentAccessToken).exp * 1000;
  const isExpired = tokenExpiresAt - 5 * 60 * 1000 < new Date().getTime();
  if (isExpired) {
    console.log("access token is expired, refreshing...");
    const response = await mutationRefreshToken(
      currentAccessToken,
      currentRefreshToken
    );

    console.log("token refresh success");
    currentAccessToken = response.accessToken;
    currentRefreshToken = response.refreshToken;

    return response.accessToken;
  }

  return currentAccessToken;
}

let tokenFetchingInProgressPromise: Promise<string> | undefined = undefined;

export async function getAccessToken() {
  if (tokenFetchingInProgressPromise) return tokenFetchingInProgressPromise;
  try {
    const newTokenPromise = getAsyncTokenRaw();
    tokenFetchingInProgressPromise = newTokenPromise;
    return await newTokenPromise;
  } finally {
    tokenFetchingInProgressPromise = undefined;
  }
}
