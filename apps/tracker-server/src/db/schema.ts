import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const teamPoints = pgTable(
  "team_points",
  {
    time: timestamp("time", { mode: "date", withTimezone: true }).notNull(),
    teamId: text("team_id").notNull(),
    points: integer("points").notNull(),
  },
  (table) => [index("ix_team_id_time").on(table.teamId, table.time.desc())]
);

export const userPoints = pgTable(
  "user_points",
  {
    time: timestamp("time", { mode: "date", withTimezone: true }).notNull(),
    userId: text("user_id").notNull(),
    points: integer("points").notNull(),
  },
  (table) => [index("ix_user_id_time").on(table.userId, table.time.desc())]
);

export const userActivityPoints = pgTable(
  "user_activity_points",
  {
    time: timestamp("time", { mode: "date", withTimezone: true }).notNull(),
    userId: text("user_id").notNull(),
    activityId: text("activity_id").notNull(),
    value: integer("value").notNull(),
    points: integer("points").notNull(),
  },
  (table) => [
    index("ix_user_id_time").on(table.userId, table.time.desc()),
    index("ix_user_id_activity_id_time").on(
      table.userId,
      table.activityId,
      table.time.desc()
    ),
  ]
);

export const userActivityVisibility = pgTable(
  "user_activity_visibility",
  {
    time: timestamp("time", { mode: "date", withTimezone: true }).notNull(),
    userId: text("user_id").notNull(),
    isActivityPublic: boolean("is_activity_public").notNull(),
  },
  (table) => [
    index("ix_user_activity_visibility_user_id_time").on(
      table.userId,
      table.time.desc()
    ),
  ]
);

export const userTeamMemberships = pgTable(
  "user_team_memberships",
  {
    time: timestamp("time", { mode: "date", withTimezone: true }).notNull(),
    userId: text("user_id").notNull(),
    teamId: text("team_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    image: text("image"),
  },
  (table) => [
    index("ix_user_team_memberships_user_id_time").on(
      table.userId,
      table.time.desc()
    ),
    index("ix_user_team_memberships_team_id_time").on(
      table.teamId,
      table.time.desc()
    ),
  ]
);

export const latestTeamProfiles = pgTable("latest_team_profiles", {
  teamId: text("team_id").primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const latestUserProfiles = pgTable(
  "latest_user_profiles",
  {
    userId: text("user_id").primaryKey(),
    teamId: text("team_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    image: text("image"),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("ix_latest_user_profiles_team_id").on(table.teamId)]
);
