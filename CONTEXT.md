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

## Flagged ambiguities

- `sincePostId` in the old `getSocialPostsQueryOptions` was passed as a cache-key differentiator but never forwarded to the API as a query param — it was effectively a bug. Replaced by `dateCursor` which maps to the `date` API query param.
