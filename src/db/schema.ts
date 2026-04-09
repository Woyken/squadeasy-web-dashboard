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
