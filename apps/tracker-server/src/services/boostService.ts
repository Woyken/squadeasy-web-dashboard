import { eq } from "drizzle-orm";
import { db } from "../database.ts";
import { boostDonors, boostRequests } from "../db/schema.ts";
import { parseJwt } from "../utils/parseJwt.ts";
import {
  mutationBoostUser,
  mutationRefreshToken,
  queryMyTeam,
} from "../api/client.ts";

// In-memory timer map: donorUserId -> timeout handle
const donorTimers = new Map<string, ReturnType<typeof setTimeout>>();

// In-memory token cache: donorUserId -> { accessToken, refreshToken }
const donorTokenCache = new Map<
  string,
  { accessToken: string; refreshToken: string }
>();

export async function getAllDonors() {
  return db.select().from(boostDonors);
}

export async function getDonorByUserId(userId: string) {
  const rows = await db
    .select()
    .from(boostDonors)
    .where(eq(boostDonors.userId, userId));
  return rows[0] ?? null;
}

export async function registerDonor(
  userId: string,
  accessToken: string,
  refreshToken: string,
  fallbackMode: string
) {
  await db
    .insert(boostDonors)
    .values({
      userId,
      refreshToken,
      fallbackMode,
      registeredAt: new Date(),
    })
    .onConflictDoUpdate({
      target: boostDonors.userId,
      set: {
        refreshToken,
        fallbackMode,
        registeredAt: new Date(),
      },
    });

  // Cache the current valid access token + refresh token
  donorTokenCache.set(userId, { accessToken, refreshToken });
  await scheduleDonorBoost(userId);
}

export async function unregisterDonor(userId: string) {
  await db.delete(boostDonors).where(eq(boostDonors.userId, userId));
  cancelDonorTimer(userId);
  donorTokenCache.delete(userId);
}

export async function getAllRequests() {
  return db.select().from(boostRequests);
}

export async function getRequestByUserId(userId: string) {
  const rows = await db
    .select()
    .from(boostRequests)
    .where(eq(boostRequests.userId, userId));
  return rows[0] ?? null;
}

export async function upsertRequest(userId: string, boostByDeadline: Date) {
  await db
    .insert(boostRequests)
    .values({
      userId,
      boostByDeadline,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: boostRequests.userId,
      set: {
        boostByDeadline,
        createdAt: new Date(),
      },
    });
}

export async function deleteRequest(userId: string) {
  await db.delete(boostRequests).where(eq(boostRequests.userId, userId));
}

export async function deleteExpiredRequests() {
  const now = new Date();
  const allRequests = await getAllRequests();
  for (const req of allRequests) {
    if (req.boostByDeadline <= now) {
      await deleteRequest(req.userId);
    }
  }
}

function cancelDonorTimer(userId: string) {
  const existing = donorTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    donorTimers.delete(userId);
  }
}

async function getAccessTokenForDonor(
  userId: string
): Promise<string | null> {
  const cached = donorTokenCache.get(userId);
  if (!cached) {
    // Load from DB
    const donor = await getDonorByUserId(userId);
    if (!donor) return null;
    donorTokenCache.set(userId, {
      accessToken: "",
      refreshToken: donor.refreshToken,
    });
    return getAccessTokenForDonor(userId);
  }

  // Check if current access token is still valid
  if (cached.accessToken) {
    try {
      const parsed = parseJwt(cached.accessToken);
      const expiresAt = parsed.exp * 1000;
      if (expiresAt - 60_000 > Date.now()) {
        return cached.accessToken;
      }
    } catch {
      // Token invalid, refresh below
    }
  }

  // Refresh the token
  try {
    const result = await mutationRefreshToken(
      cached.accessToken || "expired",
      cached.refreshToken
    );
    cached.accessToken = result.accessToken;
    if (result.refreshToken) {
      cached.refreshToken = result.refreshToken;
      // Update refresh token in DB only if it changed
      await db
        .update(boostDonors)
        .set({ refreshToken: result.refreshToken })
        .where(eq(boostDonors.userId, userId));
    }

    return result.accessToken;
  } catch (error) {
    console.error(
      `[BoostService] Failed to refresh token for donor ${userId}, deregistering:`,
      error
    );
    await unregisterDonor(userId);
    return null;
  }
}

async function scheduleDonorBoost(userId: string) {
  cancelDonorTimer(userId);

  const accessToken = await getAccessTokenForDonor(userId);
  if (!accessToken) return;

  let teamData;
  try {
    teamData = await queryMyTeam(accessToken, userId);
  } catch (error) {
    console.error(
      `[BoostService] Failed to query team for donor ${userId}:`,
      error
    );
    // Retry in 5 minutes
    const timer = setTimeout(() => scheduleDonorBoost(userId), 5 * 60 * 1000);
    donorTimers.set(userId, timer);
    return;
  }

  const boostAvailableAt = teamData.boostAvailableAt;
  const boostAtTimestamp = boostAvailableAt
    ? new Date(boostAvailableAt).getTime()
    : Date.now();
  const delayMs = Math.max(0, boostAtTimestamp - Date.now());

  console.log(
    `[BoostService] Donor ${userId}: boost available in ${Math.round(delayMs / 1000)}s`
  );

  const timer = setTimeout(() => executeBoostForDonor(userId), delayMs);
  donorTimers.set(userId, timer);
}

async function executeBoostForDonor(donorUserId: string) {
  donorTimers.delete(donorUserId);

  const accessToken = await getAccessTokenForDonor(donorUserId);
  if (!accessToken) return;

  let teamData;
  try {
    teamData = await queryMyTeam(accessToken, donorUserId);
  } catch (error) {
    console.error(
      `[BoostService] Failed to query team for donor ${donorUserId}:`,
      error
    );
    // Retry in 5 minutes
    const timer = setTimeout(
      () => scheduleDonorBoost(donorUserId),
      5 * 60 * 1000
    );
    donorTimers.set(donorUserId, timer);
    return;
  }

  // Check if boost is actually available now
  if (teamData.boostAvailableAt) {
    const availableAt = new Date(teamData.boostAvailableAt).getTime();
    if (availableAt > Date.now()) {
      // Not ready yet, reschedule
      const delayMs = availableAt - Date.now();
      const timer = setTimeout(
        () => executeBoostForDonor(donorUserId),
        delayMs
      );
      donorTimers.set(donorUserId, timer);
      return;
    }
  }

  // Clean expired requests
  await deleteExpiredRequests();

  // Get all pending requests
  const allRequests = await getAllRequests();
  const teamUsers = teamData.users ?? [];
  const teamUserIds = new Set(teamUsers.map((u) => u.id));

  // Filter requests to those on this team, sorted by soonest deadline
  const teamRequests = allRequests
    .filter((r) => teamUserIds.has(r.userId) && r.userId !== donorUserId)
    .sort(
      (a, b) => a.boostByDeadline.getTime() - b.boostByDeadline.getTime()
    );

  // Find first boostable requester
  let targetUserId: string | null = null;

  for (const request of teamRequests) {
    const user = teamUsers.find((u) => u.id === request.userId);
    if (user?.isBoostable) {
      targetUserId = request.userId;
      break;
    }
  }

  // If no requests, check fallback mode
  if (!targetUserId) {
    const donor = await getDonorByUserId(donorUserId);
    if (donor?.fallbackMode === "top_points") {
      // Boost highest-points boostable member (not self)
      const boostableUsers = teamUsers
        .filter((u) => u.isBoostable && u.id !== donorUserId)
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

      if (boostableUsers.length > 0) {
        targetUserId = boostableUsers[0]!.id;
      }
    }
  }

  if (!targetUserId) {
    console.log(
      `[BoostService] Donor ${donorUserId}: no valid boost target, rescheduling`
    );
    // Reschedule to check again later
    await scheduleDonorBoost(donorUserId);
    return;
  }

  // Execute the boost
  try {
    await mutationBoostUser(accessToken, targetUserId);
    console.log(
      `[BoostService] Donor ${donorUserId} boosted user ${targetUserId}`
    );

    // Delete the fulfilled request
    await deleteRequest(targetUserId);
  } catch (error) {
    console.error(
      `[BoostService] Donor ${donorUserId} failed to boost ${targetUserId}:`,
      error
    );
  }

  // Reschedule for next boost cycle
  await scheduleDonorBoost(donorUserId);
}

export async function startBoostService() {
  console.log("[BoostService] Starting boost service...");

  const donors = await getAllDonors();
  console.log(`[BoostService] Found ${donors.length} registered donors`);

  for (const donor of donors) {
    donorTokenCache.set(donor.userId, {
      accessToken: "",
      refreshToken: donor.refreshToken,
    });
    // Schedule each donor (don't await — let them run in parallel)
    scheduleDonorBoost(donor.userId).catch((error) =>
      console.error(
        `[BoostService] Failed to schedule donor ${donor.userId}:`,
        error
      )
    );
  }
}

export function stopBoostService() {
  console.log("[BoostService] Stopping boost service...");
  for (const [userId, timer] of donorTimers) {
    clearTimeout(timer);
  }
  donorTimers.clear();
  donorTokenCache.clear();
}
