import { getAccessToken } from "./api/accessToken.ts";
import {
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
  storeTeamData,
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
  const isChallenge = await getIsChallengeOngoing(accessToken);
  if (!isChallenge) {
    console.log("Challenge not in progress, skipping");
    return;
  }
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

async function getIsChallengeOngoing(accessToken: string) {
  const challenge = await queryMyChallenge(accessToken);

  if (!challenge.startAt || !challenge.endAt) return false;

  const startAt = new Date(challenge.startAt).getTime();
  const endAt = new Date(challenge.endAt).getTime();
  const now = Date.now();

  if (startAt > now) return false;
  if (endAt < now) return false;
  return true;
}

function runWithInterval(callback: () => void, delay: number) {
  callback();
  return setInterval(callback, delay);
}

let intervalId: NodeJS.Timeout | undefined = undefined;

export function startIntervalPointsQuerying() {
  intervalId = runWithInterval(() => {
    handleScheduledTeamsFetch().catch((e) => {
      console.error("failed scheduled teams fetch task", e);
    });
  }, 1 * 60 * 1000);
}

export function stopIntervalPointsQuerying() {
  clearInterval(intervalId);
}
