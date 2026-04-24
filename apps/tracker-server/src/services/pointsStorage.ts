import { sql, type SQL } from "drizzle-orm";

import { db } from "../database.ts";
import {
  currentChallengeMetadata,
  latestActivityMetadata,
  latestTeamProfiles,
  latestUserProfiles,
  teamPoints,
  userActivityPoints,
  userActivityVisibility,
  userPoints,
  userTeamMemberships,
} from "../db/schema.ts";

type LatestUserActivityPointsRow = {
  time: string;
  user_id: string;
  activity_id: string;
  value: number;
  points: number;
};

type UserPointsRow = {
  time: string;
  user_id: string;
  points: number;
};

type TeamPointsRow = {
  time: string;
  team_id: string;
  points: number;
};

type UserActivityPointsRow = {
  time: string;
  user_id: string;
  activity_id: string;
  value: number;
  points: number;
};

type UserActivityVisibilityRow = {
  time: string;
  user_id: string;
  is_activity_public: boolean;
};

type UserTeamMembershipRow = {
  time: string;
  user_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  image: string | null;
};

type TeamMembershipIntervalRow = {
  user_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  image: string | null;
  joined_at: string;
  left_at: string | null;
  active_from: string;
  active_until: string;
};

type LatestTeamProfileRow = {
  team_id: string;
  name: string;
  image: string | null;
  updated_at: string;
};

type LatestUserProfileRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  image: string | null;
  team_id: string;
  team_name: string | null;
  updated_at: string;
};

const CURRENT_CHALLENGE_SINGLETON_KEY = "current";

function getTimeBucket(start: Date, end: Date) {
  const entriesExpected = 50;
  const timeDifference = end.getTime() - start.getTime();
  const hoursForExpectedEntries = Math.floor(
    timeDifference / (1000 * 60 * 60) / entriesExpected
  );
  const minutesForExpectedEntries = Math.floor(
    timeDifference / (1000 * 60) / entriesExpected
  );

  if (hoursForExpectedEntries > 0) {
    return `${hoursForExpectedEntries} hours`;
  }

  if (minutesForExpectedEntries >= 10) {
    return `${minutesForExpectedEntries} minutes`;
  }

  return undefined;
}

function getTeamPointsByRangeQuery(start: Date, end: Date, timeBucket?: string): SQL {
  if (timeBucket) {
    return sql`
      WITH main_points AS (
        SELECT time_bucket(${timeBucket}, "time") AS "time", team_id, LAST(points, "time") AS points
        FROM team_points WHERE "time" >= ${start} AND "time" < ${end}
        GROUP BY 1, team_id
      ),
      before_points AS (
        SELECT DISTINCT ON (team_id) time AS "time", team_id, points
        FROM team_points
        WHERE "time" <= ${start}
        ORDER BY team_id, "time" DESC
      ),
      after_points AS (
        SELECT DISTINCT ON (team_id) time AS "time", team_id, points
        FROM team_points
        WHERE "time" >= ${end}
        ORDER BY team_id, "time" ASC
      )
      SELECT * FROM before_points
      UNION ALL
      SELECT * FROM main_points
      UNION ALL
      SELECT * FROM after_points
      ORDER BY "time" ASC, team_id ASC;
    `;
  }

  return sql`
    WITH main_points AS (
      SELECT time, team_id, points FROM team_points
      WHERE "time" >= ${start} AND "time" < ${end}
    ),
    before_points AS (
      SELECT DISTINCT ON (team_id) time AS "time", team_id, points
      FROM team_points
      WHERE "time" <= ${start}
      ORDER BY team_id, "time" DESC
    ),
    after_points AS (
      SELECT DISTINCT ON (team_id) time AS "time", team_id, points
      FROM team_points
      WHERE "time" >= ${end}
      ORDER BY team_id, "time" ASC
    )
    SELECT * FROM before_points
    UNION ALL
    SELECT * FROM main_points
    UNION ALL
    SELECT * FROM after_points
    ORDER BY "time" ASC, team_id ASC;
  `;
}

function getUsersPointsByRangeQuery(
  userId: string,
  start: Date,
  end: Date,
  timeBucket?: string
): SQL {
  if (timeBucket) {
    return sql`
      WITH main_points AS (
        SELECT time_bucket(${timeBucket}, "time") AS "time", user_id, LAST(points, "time") AS points
        FROM user_points WHERE user_id = ${userId} AND "time" >= ${start} AND "time" < ${end}
        GROUP BY 1, user_id
      ),
      before_points AS (
        SELECT DISTINCT ON (user_id) time AS "time", user_id, points
        FROM user_points
        WHERE user_id = ${userId} AND "time" <= ${start}
        ORDER BY user_id, "time" DESC
      ),
      after_points AS (
        SELECT DISTINCT ON (user_id) time AS "time", user_id, points
        FROM user_points
        WHERE user_id = ${userId} AND "time" >= ${end}
        ORDER BY user_id, "time" ASC
      )
      SELECT * FROM before_points
      UNION ALL
      SELECT * FROM main_points
      UNION ALL
      SELECT * FROM after_points
      ORDER BY "time" ASC, user_id ASC;
    `;
  }

  return sql`
    WITH main_points AS (
      SELECT time, user_id, points FROM user_points
      WHERE user_id = ${userId} AND "time" >= ${start} AND "time" < ${end}
    ),
    before_points AS (
      SELECT DISTINCT ON (user_id) time AS "time", user_id, points
      FROM user_points
      WHERE user_id = ${userId} AND "time" <= ${start}
      ORDER BY user_id, "time" DESC
    ),
    after_points AS (
      SELECT DISTINCT ON (user_id) time AS "time", user_id, points
      FROM user_points
      WHERE user_id = ${userId} AND "time" >= ${end}
      ORDER BY user_id, "time" ASC
    )
    SELECT * FROM before_points
    UNION ALL
    SELECT * FROM main_points
    UNION ALL
    SELECT * FROM after_points
    ORDER BY "time" ASC, user_id ASC;
  `;
}

function getUsersActivityPointsByRangeQuery(
  userId: string,
  start: Date,
  end: Date,
  timeBucket?: string
): SQL {
  if (timeBucket) {
    return sql`
      WITH main_points AS (
        SELECT time_bucket(${timeBucket}, "time") AS "time", user_id, activity_id, LAST(value, "time") AS value, LAST(points, "time") AS points
        FROM user_activity_points WHERE user_id = ${userId} AND "time" >= ${start} AND "time" < ${end}
        GROUP BY 1, user_id, activity_id
      ),
      before_points AS (
        SELECT DISTINCT ON (user_id, activity_id) time AS "time", user_id, activity_id, value, points
        FROM user_activity_points
        WHERE user_id = ${userId} AND "time" <= ${start}
        ORDER BY user_id, activity_id, "time" DESC
      ),
      after_points AS (
        SELECT DISTINCT ON (user_id, activity_id) time AS "time", user_id, activity_id, value, points
        FROM user_activity_points
        WHERE user_id = ${userId} AND "time" >= ${end}
        ORDER BY user_id, activity_id, "time" ASC
      )
      SELECT * FROM before_points
      UNION ALL
      SELECT * FROM main_points
      UNION ALL
      SELECT * FROM after_points
      ORDER BY "time" ASC, user_id ASC, activity_id ASC;
    `;
  }

  return sql`
    WITH main_points AS (
      SELECT time, user_id, activity_id, value, points FROM user_activity_points
      WHERE user_id = ${userId} AND "time" >= ${start} AND "time" < ${end}
    ),
    before_points AS (
      SELECT DISTINCT ON (user_id, activity_id) time AS "time", user_id, activity_id, value, points
      FROM user_activity_points
      WHERE user_id = ${userId} AND "time" <= ${start}
      ORDER BY user_id, activity_id, "time" DESC
    ),
    after_points AS (
      SELECT DISTINCT ON (user_id, activity_id) time AS "time", user_id, activity_id, value, points
      FROM user_activity_points
      WHERE user_id = ${userId} AND "time" >= ${end}
      ORDER BY user_id, activity_id, "time" ASC
    )
    SELECT * FROM before_points
    UNION ALL
    SELECT * FROM main_points
    UNION ALL
    SELECT * FROM after_points
    ORDER BY "time" ASC, user_id ASC, activity_id ASC;
  `;
}

export async function getLatestPointsForUserActivities(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as LatestUserActivityPointsRow[];
  }

  const result = await db.execute<LatestUserActivityPointsRow>(sql`
    select time, user_id, activity_id, value, points
    from user_activity_points up
    where up.time = (
        select max(up1.time)
        from user_activity_points up1
        where up1.user_id = up.user_id
        and up1.activity_id = up.activity_id
        )
      and up.user_id in (${sql.join(
        userIds.map((userId) => sql`${userId}`),
        sql`, `
      )})
  `);
  return result.rows;
}

export async function getLatestPointsForUsers(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as UserPointsRow[];
  }

  const result = await db.execute<UserPointsRow>(sql`
    select time, user_id, points
    from user_points up
    where up.time = (
        select max(up1.time)
        from user_points up1
        where up1.user_id = up.user_id
        )
      and up.user_id in (${sql.join(
        userIds.map((userId) => sql`${userId}`),
        sql`, `
      )})
  `);
  return result.rows;
}

export async function getLatestPointsForTeams() {
  const result = await db.execute<TeamPointsRow>(sql`
    select time, team_id, points
    from team_points tp
    where tp.time = (
        select max(tp1.time)
        from team_points tp1
        where tp1.team_id = tp.team_id
    )
  `);
  return result.rows;
}

export async function getLatestActivityVisibilityForUsers(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as UserActivityVisibilityRow[];
  }

  const result = await db.execute<UserActivityVisibilityRow>(sql`
    select time, user_id, is_activity_public
    from user_activity_visibility uav
    where uav.time = (
        select max(uav1.time)
        from user_activity_visibility uav1
        where uav1.user_id = uav.user_id
    )
      and uav.user_id in (${sql.join(
        userIds.map((userId) => sql`${userId}`),
        sql`, `
      )})
  `);

  return result.rows;
}

export async function getLatestTeamMembershipsForUsers(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as UserTeamMembershipRow[];
  }

  const result = await db.execute<UserTeamMembershipRow>(sql`
    select time, user_id, team_id, first_name, last_name, image
    from user_team_memberships utm
    where utm.time = (
        select max(utm1.time)
        from user_team_memberships utm1
        where utm1.user_id = utm.user_id
    )
      and utm.user_id in (${sql.join(
        userIds.map((userId) => sql`${userId}`),
        sql`, `
      )})
  `);

  return result.rows;
}

export async function getLatestTeamProfile(teamId: string) {
  const result = await db.execute<LatestTeamProfileRow>(sql`
    select
      ltp.team_id,
      ltp.name,
      ltp.image,
      ltp.updated_at
    from latest_team_profiles ltp
    where ltp.team_id = ${teamId}
    limit 1
  `);

  return result.rows[0];
}

export async function getLatestUserProfile(userId: string) {
  const result = await db.execute<LatestUserProfileRow>(sql`
    select
      lup.user_id,
      lup.first_name,
      lup.last_name,
      lup.image,
      lup.team_id,
      ltp.name as team_name,
      lup.updated_at
    from latest_user_profiles lup
    left join latest_team_profiles ltp on ltp.team_id = lup.team_id
    where lup.user_id = ${userId}
    limit 1
  `);

  return result.rows[0];
}

export async function storeCurrentChallengeMetadata(
  timestamp: number,
  challenge: {
    title: string;
    startAt: string | Date;
    endAt: string | Date;
  }
): Promise<void> {
  const updatedAt = new Date(timestamp);
  const startAt = new Date(challenge.startAt);
  const endAt = new Date(challenge.endAt);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(currentChallengeMetadata)
        .values({
          singleton: CURRENT_CHALLENGE_SINGLETON_KEY,
          title: challenge.title,
          startAt,
          endAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: currentChallengeMetadata.singleton,
          set: {
            title: sql`excluded.title`,
            startAt: sql`excluded.start_at`,
            endAt: sql`excluded.end_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    });
  } catch (error) {
    console.error("Error storing current challenge metadata:", error);
  }
}

export async function storeLatestActivityMetadata(
  timestamp: number,
  activities: {
    activityId: string;
    title: string;
    type: string;
  }[]
): Promise<void> {
  if (activities.length === 0) {
    return;
  }

  const updatedAt = new Date(timestamp);
  const uniqueActivities = Array.from(
    new Map(
      activities.map((activity) => [
        activity.activityId,
        {
          activityId: activity.activityId,
          title: activity.title,
          type: activity.type,
          updatedAt,
        },
      ])
    ).values()
  );

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(latestActivityMetadata)
        .values(uniqueActivities)
        .onConflictDoUpdate({
          target: latestActivityMetadata.activityId,
          set: {
            title: sql`excluded.title`,
            type: sql`excluded.type`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    });
  } catch (error) {
    console.error("Error storing latest activity metadata:", error);
  }
}

export async function storeUserActivities(
  timestamp: number,
  activities: {
    userId: string;
    activityId: string;
    value: number;
    points: number;
  }[]
): Promise<void> {
  if (activities.length === 0) {
    console.log("No activities data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store data for ${
      activities.length
    } activities at ${insertTime.toISOString()} using Drizzle.`
  );

  try {
    await db.transaction(async (tx) => {
      await tx.insert(userActivityPoints).values(
        activities.map((activity) => ({
          time: insertTime,
          userId: activity.userId,
          activityId: activity.activityId,
          value: activity.value,
          points: activity.points,
        }))
      );
    });

    console.log(`Successfully stored ${activities.length} records using Drizzle.`);
  } catch (error) {
    console.error("Error storing data:", error);
  }
}

export async function storeUsersPoints(
  timestamp: number,
  users: {
    id: string;
    points: number;
  }[]
): Promise<void> {
  if (users.length === 0) {
    console.log("No users data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store data for ${
      users.length
    } users at ${insertTime.toISOString()} using Drizzle.`
  );

  try {
    await db.transaction(async (tx) => {
      await tx.insert(userPoints).values(
        users.map((user) => ({
          time: insertTime,
          userId: user.id,
          points: user.points,
        }))
      );
    });

    console.log(`Successfully stored ${users.length} records using Drizzle.`);
  } catch (error) {
    console.error("Error storing data:", error);
  }
}

export async function storeUsersActivityVisibility(
  timestamp: number,
  users: {
    id: string;
    isActivityPublic: boolean;
  }[]
): Promise<void> {
  if (users.length === 0) {
    console.log("No user activity visibility data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store visibility data for ${
      users.length
    } users at ${insertTime.toISOString()} using Drizzle.`
  );

  try {
    await db.transaction(async (tx) => {
      await tx.insert(userActivityVisibility).values(
        users.map((user) => ({
          time: insertTime,
          userId: user.id,
          isActivityPublic: user.isActivityPublic,
        }))
      );
    });

    console.log(
      `Successfully stored visibility data for ${users.length} users using Drizzle.`
    );
  } catch (error) {
    console.error("Error storing user activity visibility data:", error);
  }
}

export async function storeUserTeamMemberships(
  timestamp: number,
  memberships: {
    userId: string;
    teamId: string;
    firstName: string;
    lastName: string;
    image?: string;
  }[]
): Promise<void> {
  if (memberships.length === 0) {
    console.log("No user team memberships provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store ${
      memberships.length
    } user team memberships at ${insertTime.toISOString()} using Drizzle.`
  );

  try {
    await db.transaction(async (tx) => {
      await tx.insert(userTeamMemberships).values(
        memberships.map((membership) => ({
          time: insertTime,
          userId: membership.userId,
          teamId: membership.teamId,
          firstName: membership.firstName,
          lastName: membership.lastName,
          image: membership.image,
        }))
      );
    });

    console.log(
      `Successfully stored ${memberships.length} user team memberships using Drizzle.`
    );
  } catch (error) {
    console.error("Error storing user team memberships:", error);
  }
}

export async function storeLatestUserProfiles(
  timestamp: number,
  users: {
    id: string;
    teamId: string;
    firstName: string;
    lastName: string;
    image?: string;
  }[]
): Promise<void> {
  if (users.length === 0) {
    console.log("No user profiles provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to upsert ${users.length} user profiles at ${insertTime.toISOString()} using Drizzle.`
  );

  const uniqueUsers = Array.from(
    new Map(
      users.map((user) => [
        user.id,
        {
          userId: user.id,
          teamId: user.teamId,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.image,
          updatedAt: insertTime,
        },
      ])
    ).values()
  );

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(latestUserProfiles)
        .values(uniqueUsers)
        .onConflictDoUpdate({
          target: latestUserProfiles.userId,
          set: {
            teamId: sql`excluded.team_id`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            image: sql`excluded.image`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    });

    console.log(
      `Successfully upserted ${uniqueUsers.length} user profiles using Drizzle.`
    );
  } catch (error) {
    console.error("Error storing user profiles:", error);
  }
}

export async function storeLatestTeamProfiles(
  timestamp: number,
  teams: {
    id: string;
    name: string;
    image?: string;
  }[]
): Promise<void> {
  if (teams.length === 0) {
    console.log("No team profiles provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to upsert ${teams.length} team profiles at ${insertTime.toISOString()} using Drizzle.`
  );

  const uniqueTeams = Array.from(
    new Map(
      teams.map((team) => [
        team.id,
        {
          teamId: team.id,
          name: team.name,
          image: team.image,
          updatedAt: insertTime,
        },
      ])
    ).values()
  );

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(latestTeamProfiles)
        .values(uniqueTeams)
        .onConflictDoUpdate({
          target: latestTeamProfiles.teamId,
          set: {
            name: sql`excluded.name`,
            image: sql`excluded.image`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    });

    console.log(
      `Successfully upserted ${uniqueTeams.length} team profiles using Drizzle.`
    );
  } catch (error) {
    console.error("Error storing team profiles:", error);
  }
}

export async function storeTeamData(
  timestamp: number,
  teams: {
    id: string;
    points?: number;
  }[]
): Promise<void> {
  if (!teams || teams.length === 0) {
    console.log("No team data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store data for ${
      teams.length
    } teams at ${insertTime.toISOString()} using Drizzle.`
  );

  const validTeams = teams.filter(
    (team) => typeof team.id === "string" && typeof team.points === "number"
  );

  if (validTeams.length === 0) {
    console.log("No valid team records to insert after filtering.");
    return;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(teamPoints).values(
        validTeams.map((team) => ({
          time: insertTime,
          teamId: team.id,
          points: team.points ?? 0,
        }))
      );
    });

    console.log(`Successfully stored ${validTeams.length} records using Drizzle.`);
  } catch (error) {
    console.error("Error storing data:", error);
  }
}

export async function testDbConnection(): Promise<void> {
  try {
    await db.execute(sql`SELECT NOW()`);
    console.log("Successfully connected to TimescaleDB via Drizzle.");
  } catch (error) {
    console.error("Unable to connect to the database via Drizzle:", error);
    process.exit(1);
  }
}

export async function getTeamPointsByRange(start: Date, end: Date) {
  const timeBucket = getTimeBucket(start, end);
  const query = getTeamPointsByRangeQuery(start, end, timeBucket);

  console.info("Executing team points query with params:", [
    start.toISOString(),
    end.toISOString(),
    ...(timeBucket ? [timeBucket] : []),
  ]);

  const result = await db.execute<TeamPointsRow>(query);

  return result.rows;
}

export async function getUsersPointsByRange(
  userId: string,
  start: Date,
  end: Date
) {
  const timeBucket = getTimeBucket(start, end);
  const query = getUsersPointsByRangeQuery(userId, start, end, timeBucket);

  console.info("Executing user points query with params:", [
    start.toISOString(),
    end.toISOString(),
    userId,
    ...(timeBucket ? [timeBucket] : []),
  ]);

  const result = await db.execute<UserPointsRow>(query);

  return result.rows;
}

export async function getUsersActivityPointsByRange(
  userId: string,
  start: Date,
  end: Date
) {
  const timeBucket = getTimeBucket(start, end);
  const query = getUsersActivityPointsByRangeQuery(
    userId,
    start,
    end,
    timeBucket
  );

  console.info("Executing user activity points query with params:", [
    start.toISOString(),
    end.toISOString(),
    userId,
    ...(timeBucket ? [timeBucket] : []),
  ]);

  const result = await db.execute<UserActivityPointsRow>(query);

  return result.rows;
}

export async function getTeamMembershipsByRange(
  teamId: string,
  start: Date,
  end: Date
) {
  const result = await db.execute<TeamMembershipIntervalRow>(sql`
    WITH relevant_users AS (
      SELECT DISTINCT user_id
      FROM user_team_memberships
      WHERE team_id = ${teamId} AND "time" < ${end}
    ),
    ordered_memberships AS (
      SELECT
        user_id,
        team_id,
        first_name,
        last_name,
        image,
        "time" AS joined_at,
        LEAD("time") OVER (PARTITION BY user_id ORDER BY "time" ASC) AS left_at
      FROM user_team_memberships
      WHERE user_id IN (SELECT user_id FROM relevant_users) AND "time" < ${end}
    )
    SELECT
      user_id,
      team_id,
      first_name,
      last_name,
      image,
      joined_at,
      left_at,
      GREATEST(joined_at, ${start}) AS active_from,
      LEAST(COALESCE(left_at, ${end}), ${end}) AS active_until
    FROM ordered_memberships
    WHERE team_id = ${teamId} AND COALESCE(left_at, ${end}) > ${start}
    ORDER BY active_from ASC, user_id ASC;
  `);

  return result.rows;
}
