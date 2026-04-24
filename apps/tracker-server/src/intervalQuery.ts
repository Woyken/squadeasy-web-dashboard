import { getAccessToken } from "./api/accessToken.ts";
import {
  ApiResponseError,
  queryMyChallenge,
  querySeasonRanking,
  querySeasonRankingContinuation,
  queryTeamById,
  queryUserStatisticsQuery,
} from "./api/client.ts";
import {
  getLatestActivityVisibilityForUsers,
  getLatestPointsForTeams,
  getLatestTeamMembershipsForUsers,
  getLatestPointsForUserActivities,
  getLatestPointsForUsers,
  storeCurrentChallengeMetadata,
  storeLatestActivityMetadata,
  storeTeamData,
  storeLatestTeamProfiles,
  storeLatestUserProfiles,
  storeUserActivities,
  storeUserTeamMemberships,
  storeUsersActivityVisibility,
  storeUsersPoints,
} from "./services/pointsStorage.ts";
import { emitPointsStreamEvent } from "./realtime/pointsEvents.ts";

type UserActivitySnapshot = {
  userId: string;
  activityId: string;
  value: number;
  points: number;
};

type TeamUserSnapshot = {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  image?: string;
  points?: number;
  isActivityPublic?: boolean;
};

type LatestUserActivityRow = Awaited<
  ReturnType<typeof getLatestPointsForUserActivities>
>[number];

type LatestUserPointsRow = Awaited<ReturnType<typeof getLatestPointsForUsers>>[number];
type LatestUserActivityVisibilityRow = Awaited<
  ReturnType<typeof getLatestActivityVisibilityForUsers>
>[number];
type LatestTeamPointsRow = Awaited<ReturnType<typeof getLatestPointsForTeams>>[number];

async function handleFetchUserActivities(
  accessToken: string,
  userIds: string[]
) {
  console.log("handling user activity fetching for ", userIds.length, " users");
  const usersActivitiesPromises = userIds.map((userId) =>
    queryUserStatisticsQuery(accessToken, userId)
  );
  const lastUsersActivities = await getLatestPointsForUserActivities(userIds);
  console.log("Last users activities fetched: ", lastUsersActivities.length);

  const userActivities = await Promise.all(usersActivitiesPromises);

  const now = Date.now();

  await storeLatestActivityMetadata(
    now,
    userActivities.flatMap((userActivityStats) =>
      (userActivityStats.activities ?? []).map((activity) => ({
        activityId: activity.activityId,
        title: activity.title,
        type: activity.type,
      }))
    )
  );

  const userActivitiesFlat = userActivities.flatMap((x) =>
    x.activities?.map((a) => ({ userId: x.id, ...a }))
  );

  console.log("Users have total activities: ", userActivitiesFlat.length);

  const onlyChangedUserActivities = userActivitiesFlat
    .filter((newActivity) => {
      if (!newActivity) return false;

      const lastPointsAndValue = lastUsersActivities.find(
        (activity: LatestUserActivityRow) =>
          activity.user_id === newActivity.userId &&
          activity.activity_id === newActivity.activityId
      );
      if (
        newActivity.points !== lastPointsAndValue?.points ||
        newActivity.value !== lastPointsAndValue.value
      )
        return true;

      return false;
    })
    .filter((x) => !!x);

  console.log("Changed users activities: ", onlyChangedUserActivities.length);

  await storeUserActivities(now, onlyChangedUserActivities);
  emitPointsStreamEvent({
    event: "user-activity-points",
    data: {
      time: new Date(now).toISOString(),
      items: onlyChangedUserActivities.map((activity) => ({
        userId: activity.userId,
        activityId: activity.activityId,
        value: activity.value,
        points: activity.points,
      })),
    },
  });
}

async function fetchTeamUsersPoints(accessToken: string, id: string) {
  try {
    const teamUsersPoints = await queryTeamById(accessToken, id);
    const teamUsers = teamUsersPoints.users?.map((x): TeamUserSnapshot => ({
      id: x.id,
      teamId: id,
      firstName: x.firstName,
      lastName: x.lastName,
      image: x.image,
      points: x.points,
      isActivityPublic: x.isActivityPublic,
    }));
    return teamUsers ?? [];
  } catch (error) {
    if (error instanceof ApiResponseError && error.statusCode === 404) {
      console.warn({ teamId: id }, "team details no longer exist, skipping");
      return [];
    }

    throw error;
  }
}

async function handleFetchTeamsUsersPoints(
  accessToken: string,
  teamIds: string[]
) {
  console.log(
    "handling teams users points fetching for ",
    teamIds.length,
    " teams"
  );
  const teamsUsersQueries = teamIds.map((teamId) =>
    fetchTeamUsersPoints(accessToken, teamId)
  );
  const teamsUsersPoints = await Promise.all(teamsUsersQueries);
  const teamsUsersFlat = Array.from(
    new Map(
      teamsUsersPoints.flatMap((teamUsers) => teamUsers).map((user) => [
        user.id,
        user,
      ])
    ).values()
  );

  console.log("Teams have total users: ", teamsUsersFlat.length);

  const lastUsersPoints = await getLatestPointsForUsers(
    teamsUsersFlat.map((x) => x.id)
  );
  console.log("Last users points fetched: ", lastUsersPoints.length);
  const lastUsersActivityVisibility = await getLatestActivityVisibilityForUsers(
    teamsUsersFlat.map((x) => x.id)
  );
  console.log(
    "Last users activity visibility fetched: ",
    lastUsersActivityVisibility.length
  );
  const lastUsersTeamMemberships = await getLatestTeamMembershipsForUsers(
    teamsUsersFlat.map((x) => x.id)
  );
  console.log(
    "Last users team memberships fetched: ",
    lastUsersTeamMemberships.length
  );

  const now = Date.now();

  await storeLatestUserProfiles(now, teamsUsersFlat);

  const onlyChangedUsersTeamMemberships = teamsUsersFlat.filter((newUser) => {
    const lastTeamMembership = lastUsersTeamMemberships.find(
      (x) => x.user_id === newUser.id
    )?.team_id;

    return lastTeamMembership !== newUser.teamId;
  });

  if (onlyChangedUsersTeamMemberships.length > 0) {
    console.log(
      "changed team memberships for users: ",
      onlyChangedUsersTeamMemberships.length
    );
    await storeUserTeamMemberships(
      now,
      onlyChangedUsersTeamMemberships.map((user) => ({
        userId: user.id,
        teamId: user.teamId,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
      }))
    );
  }

  const onlyChangedUsersActivityVisibility = teamsUsersFlat.filter((newUser) => {
    const lastVisibility = lastUsersActivityVisibility.find(
      (x: LatestUserActivityVisibilityRow) => x.user_id === newUser.id
    )?.is_activity_public;

    if (lastVisibility === undefined) {
      return typeof newUser.isActivityPublic === "boolean";
    }

    return newUser.isActivityPublic !== lastVisibility;
  });

  if (onlyChangedUsersActivityVisibility.length > 0) {
    console.log(
      "changed activity visibility for users: ",
      onlyChangedUsersActivityVisibility.length
    );
    await storeUsersActivityVisibility(
      now,
      onlyChangedUsersActivityVisibility.map((user) => ({
        id: user.id,
        isActivityPublic: !!user.isActivityPublic,
      }))
    );
    emitPointsStreamEvent({
      event: "user-activity-visibility",
      data: {
        time: new Date(now).toISOString(),
        items: onlyChangedUsersActivityVisibility.map((user) => ({
          userId: user.id,
          isActivityPublic: !!user.isActivityPublic,
        })),
      },
    });
  }

  const onlyChangedUsersScores = teamsUsersFlat
    .filter((newUser) => {
      const lastUserPoints = lastUsersPoints.find(
        (x: LatestUserPointsRow) => x.user_id === newUser.id
      )?.points;
      if (newUser.points === undefined) return false;

      if (newUser.points !== lastUserPoints) return true;

      return false;
    })
    .map((x) => ({ ...x, points: x.points ?? 0 }));

  if (onlyChangedUsersScores.length === 0) {
    console.log("no users scores changed");
    return;
  }

  console.log("changed scores for users: ", onlyChangedUsersScores.length);
  const usersWithPublicActivities = onlyChangedUsersScores
    .filter((x) => !!x.isActivityPublic)
    .map((x) => x.id);
  console.log(
    "users with public activities: ",
    usersWithPublicActivities.length
  );

  handleFetchUserActivities(accessToken, usersWithPublicActivities).catch((e) =>
    console.error("failed to update users activities", e)
  );

  await storeUsersPoints(now, onlyChangedUsersScores);
  emitPointsStreamEvent({
    event: "user-points",
    data: {
      time: new Date(now).toISOString(),
      items: onlyChangedUsersScores.map((user) => ({
        userId: user.id,
        points: user.points,
      })),
    },
  });
}

async function* getAllTeamElements() {
  const accessToken = await getAccessToken();

  console.log("[Teams] Fetching initial teams");
  const teamsDataResponse = await querySeasonRanking(accessToken);
  console.log(
    "[Teams] Found initial teams",
    teamsDataResponse.elements?.length
  );
  let lastTeamId = teamsDataResponse.elements?.at(-1)?.id;

  yield* teamsDataResponse.elements ?? [];

  while (lastTeamId) {
    const accessToken = await getAccessToken();
    console.log("[Teams] Fetching continue", "offset:", lastTeamId);
    const teamsDataResponse = await querySeasonRankingContinuation(
      accessToken,
      lastTeamId
    );
    console.log(
      "[Teams] Found more teams",
      teamsDataResponse.length,
      "offset:",
      lastTeamId
    );
    lastTeamId = teamsDataResponse.at(-1)?.id;

    yield* teamsDataResponse;
  }
}

async function handleScheduledTeamsFetch() {
  console.log(`\n--- ${new Date().toISOString()} ---`);
  console.log("Running scheduled task: Fetch and Store Team Data");
  const accessToken = await getAccessToken();
  const lastTeamsPoints = await getLatestPointsForTeams();

  console.log("Last teams points fetched: ", lastTeamsPoints.length);
  const now = Date.now();

  const teamsElementsStream = getAllTeamElements();

  let teamsElements: Awaited<
    ReturnType<typeof querySeasonRankingContinuation>
  > = [];

  for await (const team of teamsElementsStream) {
    teamsElements.push(team);
  }

  console.log("Teams total elements: ", teamsElements.length);

  const allTeamIds = teamsElements.map((team) => team.id);
  await storeLatestTeamProfiles(
    now,
    teamsElements.map((team) => ({
      id: team.id,
      name: team.name,
      image: team.image ?? undefined,
    }))
  );
  handleFetchTeamsUsersPoints(accessToken, allTeamIds).catch((e) =>
    console.error("failed to update teams users", e)
  );

  const onlyChangedTeamsScores = teamsElements?.filter((newTeam) => {
    const lastTeamScore = lastTeamsPoints.find(
      (x: LatestTeamPointsRow) => x.team_id === newTeam.id
    )?.points;

    if (newTeam.points !== lastTeamScore) return true;
    return false;
  });

  if (!onlyChangedTeamsScores || onlyChangedTeamsScores.length === 0) {
    console.log("no teams scores changed");
    return;
  }

  console.log("changed scores for teams: ", onlyChangedTeamsScores.length);

  await storeTeamData(now, onlyChangedTeamsScores);
  emitPointsStreamEvent({
    event: "team-points",
    data: {
      time: new Date(now).toISOString(),
      items: onlyChangedTeamsScores.map((team) => ({
        teamId: team.id,
        points: team.points ?? 0,
      })),
    },
  });
  console.log("scheduled task finished.");
}

type ChallengeMetadata = {
  title: string;
  startAt: string;
  endAt: string;
};

type Phase = "idle" | "waiting" | "active" | "ended";

const POINTS_INTERVAL_MS = 1 * 60 * 1000;
const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h while waiting/active
const IDLE_RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h while idle
const RECONCILE_RETRY_MS = 60 * 1000; // 1 min on unexpected failure

const state: {
  phase: Phase;
  challenge?: ChallengeMetadata;
  pointsInterval?: NodeJS.Timeout;
  recheckTimeout?: NodeJS.Timeout;
  phaseTransitionTimeout?: NodeJS.Timeout;
  stopped: boolean;
} = {
  phase: "idle",
  stopped: false,
};

async function fetchAndStoreChallengeMetadata(): Promise<ChallengeMetadata | null> {
  const accessToken = await getAccessToken();
  const challenge = await queryMyChallenge(accessToken);
  if (!challenge.title || !challenge.startAt || !challenge.endAt) {
    return null;
  }
  await storeCurrentChallengeMetadata(Date.now(), {
    title: challenge.title,
    startAt: challenge.startAt,
    endAt: challenge.endAt,
  });
  return {
    title: challenge.title,
    startAt: challenge.startAt,
    endAt: challenge.endAt,
  };
}

function determinePhase(challenge: ChallengeMetadata | null): Phase {
  if (!challenge) return "idle";
  const startAt = new Date(challenge.startAt).getTime();
  const endAt = new Date(challenge.endAt).getTime();
  const now = Date.now();
  if (now < startAt) return "waiting";
  if (now < endAt) return "active";
  return "ended";
}

function clearRecheckTimeout() {
  if (state.recheckTimeout) {
    clearTimeout(state.recheckTimeout);
    state.recheckTimeout = undefined;
  }
}

function clearPhaseTransitionTimeout() {
  if (state.phaseTransitionTimeout) {
    clearTimeout(state.phaseTransitionTimeout);
    state.phaseTransitionTimeout = undefined;
  }
}

function stopPointsInterval() {
  if (state.pointsInterval) {
    clearInterval(state.pointsInterval);
    state.pointsInterval = undefined;
  }
}

function startPointsInterval() {
  if (state.pointsInterval) return;
  state.pointsInterval = setInterval(() => {
    handleScheduledTeamsFetch().catch((e) => {
      console.error("failed scheduled teams fetch task", e);
    });
  }, POINTS_INTERVAL_MS);
}

function runPointsFetchOnce() {
  return handleScheduledTeamsFetch().catch((e) => {
    console.error("failed scheduled teams fetch task", e);
  });
}

function scheduleReconcile(delayMs: number) {
  clearRecheckTimeout();
  if (state.stopped) return;
  state.recheckTimeout = setTimeout(() => {
    void reconcile();
  }, Math.max(0, delayMs));
}

function schedulePhaseTransition(delayMs: number, handler: () => void) {
  clearPhaseTransitionTimeout();
  if (state.stopped) return;
  state.phaseTransitionTimeout = setTimeout(handler, Math.max(0, delayMs));
}

async function onChallengeStart() {
  console.log("[phase] challenge start boundary reached");
  state.phase = "active";
  // Immediate one loop of querying, then start the recurring interval.
  await runPointsFetchOnce();
  startPointsInterval();
  // Re-reconcile to set up end-of-challenge transition and periodic rechecks.
  await reconcile();
}

async function onChallengeEnd() {
  console.log("[phase] challenge end boundary reached");
  // Final immediate query so we capture last-moment changes.
  await runPointsFetchOnce();
  stopPointsInterval();
  clearPhaseTransitionTimeout();
  clearRecheckTimeout();
  state.phase = "ended";
  console.log("[phase] ended - no more scheduled work");
}

async function reconcile(): Promise<void> {
  if (state.stopped) return;
  clearRecheckTimeout();

  let challenge: ChallengeMetadata | null;
  try {
    challenge = await fetchAndStoreChallengeMetadata();
  } catch (err) {
    console.error("failed to fetch challenge metadata during reconcile", err);
    scheduleReconcile(RECONCILE_RETRY_MS);
    return;
  }

  state.challenge = challenge ?? undefined;
  const phase = determinePhase(challenge);
  const previousPhase = state.phase;
  state.phase = phase;

  console.log(
    `[phase] reconcile: previous=${previousPhase} new=${phase}`,
    challenge
      ? `startAt=${challenge.startAt} endAt=${challenge.endAt}`
      : "(no challenge)"
  );

  if (phase === "idle") {
    stopPointsInterval();
    clearPhaseTransitionTimeout();
    scheduleReconcile(IDLE_RECHECK_INTERVAL_MS);
    return;
  }

  if (phase === "ended") {
    stopPointsInterval();
    clearPhaseTransitionTimeout();
    // No more checks while ended - server must be restarted to reset.
    return;
  }

  if(!challenge) {
    console.error("unexpected missing challenge metadata during reconcile while in non-idle phase");
    scheduleReconcile(RECONCILE_RETRY_MS);
    return;
  }

  const startAt = new Date(challenge.startAt).getTime();
  const endAt = new Date(challenge.endAt).getTime();
  const now = Date.now();

  if (phase === "waiting") {
    stopPointsInterval();
    const msUntilStart = startAt - now;
    if (msUntilStart <= RECHECK_INTERVAL_MS) {
      // Close enough - schedule the exact start trigger.
      schedulePhaseTransition(msUntilStart, () => {
        onChallengeStart().catch((e) =>
          console.error("failed onChallengeStart", e)
        );
      });
      clearRecheckTimeout();
    } else {
      clearPhaseTransitionTimeout();
      scheduleReconcile(RECHECK_INTERVAL_MS);
    }
    return;
  }

  // phase === "active"
  if (previousPhase !== "active") {
    // We just discovered (e.g. after server restart) that the challenge is ongoing.
    // Kick off an immediate points fetch so we recover quickly.
    void runPointsFetchOnce();
  }
  startPointsInterval();

  const msUntilEnd = endAt - now;
  if (msUntilEnd <= RECHECK_INTERVAL_MS) {
    schedulePhaseTransition(msUntilEnd, () => {
      onChallengeEnd().catch((e) =>
        console.error("failed onChallengeEnd", e)
      );
    });
    clearRecheckTimeout();
  } else {
    clearPhaseTransitionTimeout();
    scheduleReconcile(RECHECK_INTERVAL_MS);
  }
}

export function startIntervalPointsQuerying() {
  state.stopped = false;
  reconcile().catch((e) => {
    console.error("initial reconcile failed", e);
    scheduleReconcile(RECONCILE_RETRY_MS);
  });
}

export function stopIntervalPointsQuerying() {
  state.stopped = true;
  stopPointsInterval();
  clearRecheckTimeout();
  clearPhaseTransitionTimeout();
}
