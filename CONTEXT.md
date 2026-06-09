# SquadEasy Web Dashboard

A local web dashboard for monitoring and automating SquadEasy challenge activity.
Users can log in with multiple accounts; all automation runs client-side in the browser.

## Language

**Social Post**:
A post on the SquadEasy social wall, authored by a user (`sender`), with a `likes` object that includes `isLikedByUser`.
_Avoid_: Activity, update, entry

**Like**:
A reaction a user gives to a Social Post. Represented as a PUT to `/api/3.0/social/posts/{post_id}/like`.
_Avoid_: React, heart, upvote

**Team**:
The group of users a logged-in account belongs to. Used to filter which Social Posts qualify for Auto-Like.
_Avoid_: Group, squad

**Team Member**:
Any user whose `id` appears in the authenticated user's Team member list (`myTeam.users`).
_Avoid_: Teammate, colleague

**Backward Crawl**:
Phase 1 of the Auto-Like process. Paginates Social Posts from newest to oldest by following `offsetQueryParams.date` cursors, collecting them without liking, until no more pages exist.
_Avoid_: History scan, reverse fetch

**Page Cursor**:
The `date` string returned in `offsetQueryParams.date` from `GET /api/4.0/social/posts`. Passed as the `date` query param to fetch the next (older) page.
_Avoid_: Offset, token, sinceId

**Forward Sweep**:
Phase 2 of the Auto-Like process. Processes pages in reverse cursor order (oldest → newest), liking each unlikes Team Member post sequentially.
_Avoid_: Forward scan, catchup pass

**Incremental Pass**:
The ongoing phase after the initial Backward Crawl + Forward Sweep are complete. On each trigger (page load, 30-min interval, manual), fetches the newest page and likes any new unlikes Team Member posts.
_Avoid_: Polling, refresh pass

**Auto-Like**:
The per-user feature that automates liking Social Posts from Team Members. Enabled/disabled via a toggle in User Settings. Persists its crawl state in `localStorage`.
_Avoid_: Auto-react, auto-boost (separate concept)

**User Settings**:
A per-user page at `/settings?userId=...` that exposes automation toggles and crawl status for a specific logged-in account.
_Avoid_: User profile, preferences panel

**Main User**:
The primary logged-in account whose token is used for team/challenge queries in the main dashboard. Selected via "SET MAIN" in the nav menu.
_Avoid_: Primary account, default user

**Boost**:
The action of calling `POST /api/2.0/users/{id}/boost` targeting a Team Member. Subject to a team-level cooldown tracked by `boostAvailableAt`. A user cannot boost themselves.
_Avoid_: Power-up, buff

**Boost Count**:
The cumulative number of Boosts a user has received, as reported by the `boostCount` field on `UserRemoteEntity` from `GET /api/2.0/teams/{id}`. Tracked as a time-series alongside score changes.
_Avoid_: Boosts received, boosts given (a different concept)

**Boost Donor**:
A user who has registered their account with the backend (by providing their refresh token) to execute Boosts on behalf of their team. Auto-deregistered when their refresh token becomes invalid.
_Avoid_: Booster (ambiguous — could mean receiver), auto-booster

**Boost Request**:
A pending request from a user to receive a Boost, with a `boostByDeadline` timestamp. One active request per user. Auto-deleted on fulfillment or expiry.
_Avoid_: Boost order, boost queue item

**Boost Requester**:
A user who currently has an active Boost Request. Any dashboard user can be a Boost Requester regardless of whether they are also a Boost Donor.
_Avoid_: Boost target (ambiguous outside this context)

**Fallback Mode**:
A per-Donor configuration that determines what happens when no Boost Requests are pending for their team. Values: `none` (do nothing; default) or `top_points` (Boost the highest-points boostable Team Member).
_Avoid_: Default mode, idle strategy

**Score**:
A user's overall point total, reported as `totalPoints` on `UserStatsRemoteEntity` from `GET /api/2.0/users/{id}/statistics`. The number ranked in the Season Ranking.
_Avoid_: Points (ambiguous with Activity Points), statistic

**Activity**:
A named metric a user accumulates within a challenge (e.g. steps, distance), identified by `activityId` on `UserActivityStatsRemoteEntity`. Each Activity carries both an Activity Value and Activity Points.
_Avoid_: Statistic, metric

**Activity Value**:
The raw measured quantity of an Activity (e.g. 5,000 steps, 12 km), reported as `value` on `UserActivityStatsRemoteEntity`.
_Avoid_: Statistic value, amount

**Activity Points**:
The points a user earns from a single Activity, reported as `points` on `UserActivityStatsRemoteEntity`. Distinct from Score, which is the user's total across all sources.
_Avoid_: Statistic points

**Tracked User**:
A user the tracker server has recorded a profile for (present in `latest_user_profiles`), spanning every Team in the challenge. The population the User Comparison ranks over.
_Avoid_: Known user, seen user

**User Comparison**:
The cross-Team ranking of Tracked Users by Score, Activity Value, or Activity Points for a chosen Activity. Sourced from the tracker server's last-known snapshots, not live API reads.
_Avoid_: Leaderboard (already used for the Team ranking), user ranking

## Relationships

- A **Team** has many **Team Members**
- A **Social Post** has exactly one `sender`; it qualifies for Auto-Like only when `sender.id` is a **Team Member** and `likes.isLikedByUser` is false
- **Auto-Like** for a user proceeds through phases: Backward Crawl → Forward Sweep → Incremental Pass
- A **Page Cursor** is produced by each API response and consumed by the next backward-paginated fetch
- **User Settings** is scoped to one logged-in account and exposes the **Auto-Like** toggle and its crawl status
- A **Team** can have zero or more **Boost Donors** and zero or more **Boost Requesters**
- A **Boost Donor** executes Boosts using their stored credentials; they cannot Boost themselves
- A **Boost Request** is resolved to a Team via live API lookup (not stored)
- When a Boost becomes available, the system fulfills the **Boost Request** with the soonest deadline whose target is boostable, using any available Donor on that team (excluding the target)
- If no Boost Requests exist, the Donor's **Fallback Mode** determines behavior
- A **Tracked User** has one Score and zero or more **Activities**, each with an **Activity Value** and **Activity Points**
- The **User Comparison** ranks **Tracked Users** across all **Teams** by one chosen metric, paging through the tracker server's last-known snapshots

## Flagged ambiguities

- `sincePostId` in the old `getSocialPostsQueryOptions` was passed as a cache-key differentiator but never forwarded to the API as a query param — it was effectively a bug. Replaced by `dateCursor` which maps to the `date` API query param.
