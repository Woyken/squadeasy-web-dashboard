import { sql } from "drizzle-orm";

import { db } from "../database.ts";

const createTeamPointsTableSql = `
CREATE TABLE IF NOT EXISTS team_points (
    time TIMESTAMPTZ NOT NULL,
    team_id TEXT NOT NULL,
    points INTEGER NOT NULL
);`;

const createTeamPointsHypertableSql = `
SELECT create_hypertable('team_points', 'time', if_not_exists => TRUE);
`;

const createTeamPointsIndexSql = `
CREATE INDEX IF NOT EXISTS ix_team_id_time ON team_points (team_id, time DESC);
`;

const createUserPointsTableSql = `
CREATE TABLE IF NOT EXISTS user_points (
    time TIMESTAMPTZ NOT NULL,
    user_id TEXT NOT NULL,
    points INTEGER NOT NULL
);

SELECT create_hypertable('user_points', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS ix_user_id_time ON user_points (user_id, time DESC);
`;

const createUserActivityPointsTableSql = `
CREATE TABLE IF NOT EXISTS user_activity_points (
    time TIMESTAMPTZ NOT NULL,
    user_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    value INTEGER NOT NULL,
    points INTEGER NOT NULL
);

SELECT create_hypertable('user_activity_points', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS ix_user_id_time ON user_activity_points (user_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_user_id_activity_id_time ON user_activity_points (user_id, activity_id, time DESC);
`;

const createUserActivityVisibilityTableSql = `
CREATE TABLE IF NOT EXISTS user_activity_visibility (
  time TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  is_activity_public BOOLEAN NOT NULL
);

SELECT create_hypertable('user_activity_visibility', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS ix_user_activity_visibility_user_id_time ON user_activity_visibility (user_id, time DESC);
`;

const createUserTeamMembershipsTableSql = `
CREATE TABLE IF NOT EXISTS user_team_memberships (
  time TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  image TEXT
);

SELECT create_hypertable('user_team_memberships', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS ix_user_team_memberships_user_id_time ON user_team_memberships (user_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_user_team_memberships_team_id_time ON user_team_memberships (team_id, time DESC);
`;

export async function initializeDatabase() {
  console.log("Attempting to initialize the database...");

  try {
    await db.transaction(async (tx) => {
      console.log("Transaction started.");

      console.log("Executing: CREATE TABLE IF NOT EXISTS team_points...");
      await tx.execute(sql.raw(createTeamPointsTableSql));
      console.log('Table "team_points" ensured.');

      console.log(
        "Executing: SELECT create_hypertable('team_points', 'time', if_not_exists => TRUE)..."
      );
      await tx.execute(sql.raw(createTeamPointsHypertableSql));
      console.log('Hypertable "team_points" ensured.');

      console.log("Executing: CREATE INDEX IF NOT EXISTS ix_team_id_time...");
      await tx.execute(sql.raw(createTeamPointsIndexSql));
      console.log('Index "ix_team_id_time" ensured.');

      console.log("executing createUserPointsTableSql", createUserPointsTableSql);
      await tx.execute(sql.raw(createUserPointsTableSql));
      console.log("createUserPointsTableSql ensured");

      console.log(
        "executing createUserActivityPointsTableSql",
        createUserActivityPointsTableSql
      );
      await tx.execute(sql.raw(createUserActivityPointsTableSql));
      console.log("createUserActivityPointsTableSql ensured");

      console.log(
        "executing createUserActivityVisibilityTableSql",
        createUserActivityVisibilityTableSql
      );
      await tx.execute(sql.raw(createUserActivityVisibilityTableSql));
      console.log("createUserActivityVisibilityTableSql ensured");

      console.log(
        "executing createUserTeamMembershipsTableSql",
        createUserTeamMembershipsTableSql
      );
      await tx.execute(sql.raw(createUserTeamMembershipsTableSql));
      console.log("createUserTeamMembershipsTableSql ensured");
    });

    console.log("Transaction committed successfully.");
    console.log("Database initialization complete.");
  } catch (error: unknown) {
    console.error(
      "Error during database initialization, rolling back transaction."
    );
    console.log("Transaction rolled back.");

    if (error instanceof Error) {
      if ("routine" in error && "schema" in error) {
        const pgError = error as any;
        console.error(`Database Error: ${pgError.message}`);
        console.error(`  Detail: ${pgError.detail}`);
        console.error(`  Routine: ${pgError.routine}`);
        console.error(`  Code: ${pgError.code}`);
      } else {
        console.error("Initialization Error:", error.message);
        console.error(error.stack);
      }
    } else {
      console.error("An unknown error occurred during initialization:", error);
    }

    process.exit(1);
  }
}
