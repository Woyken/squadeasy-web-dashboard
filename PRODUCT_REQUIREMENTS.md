# SquadEasy Web Dashboard PRD

## Product Overview

SquadEasy Web Dashboard is a single-page web application for monitoring SquadEasy challenge performance across teams and users, managing multiple logged-in accounts, and automating selected engagement actions.

The current product combines three core jobs:

- Give users a live view of challenge status, rankings, and score progression.
- Let users inspect team and individual performance in more detail.

## Product Goals

- Provide a fast, at-a-glance overview of the current SquadEasy challenge.
- Make it easy to move from high-level team performance to detailed user activity.
- Support users who operate multiple SquadEasy accounts from one browser session.
- Preserve session state and user preferences across refreshes.
- Automate repetitive team engagement actions where supported by the backend.

## Primary Users

- SquadEasy participants tracking challenge progress.
- Users managing multiple SquadEasy accounts.
- Users comparing team standings and individual contribution trends.
- Users who want recurring actions such as boosting or liking posts handled automatically.

## In Scope

- Multi-account authentication and session persistence.
- Dashboard view for challenge status and team leaderboard.
- Team rankings and per-team user score comparison.
- User statistics view with activity-based charts.
- Per-account automation settings.
- Browser-persisted preferences and automation state.

## User Experience Summary

Users land in a dashboard that highlights the active challenge, its timing, and current team standings. From there they can drill into team-level rankings, inspect team members, open detailed user statistics, switch between stored accounts, and configure per-account automation behavior.

## Functional Requirements

### 1. Authentication And Session Management

- The product shall provide a login page with email and password inputs.
- The product shall validate email format and minimum password length before submission.
- The product shall authenticate against SquadEasy login APIs.
- The product shall fetch the authenticated user profile immediately after successful login.
- The product shall support multiple stored logged-in accounts in the same browser.
- The product shall persist access and refresh tokens in browser local storage.
- The product shall refresh expiring access tokens automatically using the refresh token flow.
- The product shall update stored tokens after a successful refresh.
- The product shall redirect users to the login page when no stored accounts are available.

### 2. Account Context

- The product shall allow one stored account to be designated as the main user.
- The main user shall act as the default context for shared reads such as challenge, rankings, team details, and profile lookups.
- The selected main user shall persist in browser local storage.
- If no explicit main user is available, the product shall fall back to the first available stored account.
- The product shall expose an account menu in the global navigation.
- The account menu shall show the currently available logged-in accounts using avatars or fallbacks.
- The account menu shall allow navigation to per-user settings.
- The account menu shall provide an action to add another account.

### 3. Global Navigation And App Shell

- The product shall present a persistent top navigation bar.
- The navigation bar shall include links to Dashboard and Team Rankings.
- The navigation shall support mobile and desktop layouts.
- The app shell shall provide loading states for route content while data is pending.
- The app shell shall provide an application-level error fallback with retry behavior.
- The app shall provide a dedicated 404 page with a way back to the home page.

### 4. Dashboard

- The dashboard shall display the current challenge title and tagline.
- The dashboard shall derive challenge state as upcoming, active, or ended from challenge start and end times.
- The dashboard shall show a live countdown to challenge start when the challenge is upcoming.
- The dashboard shall show a live countdown to challenge end when the challenge is active.
- The dashboard shall show an ended-state message when the challenge has concluded.
- The dashboard shall display team leaderboard information sorted by total points descending.
- The dashboard shall visually emphasize the top three teams.
- The dashboard shall display additional ranked teams below the top three.
- The dashboard shall show quick summary metrics including total teams, leading team, total points, and challenge period.
- The dashboard shall include a team score progression chart over time.
- The dashboard chart shall support time-range zooming and panning.
- The dashboard chart shall constrain its visible range to the challenge window and current time.
- The dashboard chart shall allow users to click a team series to open that team in the Team Rankings page.

### 5. Team Rankings

- The product shall provide a Team Rankings page listing all teams sorted by points descending.
- Each team row shall show rank, visual identity, team name, and total points.
- A team row shall be expandable to reveal more detail.
- Expanded team state shall be addressable through the URL query string.
- When a team is preselected through the URL, the page shall expand and scroll to that team.
- Expanded team detail shall include a shortcut to the User Statistics page for that team.
- Expanded team detail shall include a chart comparing score progression across team members.
- The team member comparison chart shall show one line per user.
- The team member comparison chart shall support time-range zooming and panning.
- The team member comparison chart shall allow clicking a user series to open that user on the User Statistics page for the same team.

### 6. User Statistics

- The product shall provide a User Statistics page for a selected team.
- The page shall optionally support preselecting a specific user through the URL query string.
- The page shall list team members sorted by points descending.
- Each user row shall show rank, avatar, display name, and total points.
- Each user row shall expand and collapse on demand.
- The page shall calculate and display estimated step length when required source metrics are available.
- Expanded user detail shall show a Points by Activity chart.
- Expanded user detail shall show an Activity Values chart.
- Both charts shall group data by activity type.
- Both charts shall support time-range zooming and panning.
- Both charts shall share the same selected time window.
- When a user is preselected through navigation, that user row shall open automatically.

### 7. User Settings

- The product shall provide a per-account settings page.
- The settings page shall support toggling whether the viewed account is the main user.
- The settings page shall support enabling or disabling automatic boosting for that account.
- The settings page shall support enabling or disabling automatic liking of team posts for that account.
- Settings changes shall take effect without a full page reload.

### 8. Automation

- Auto boost shall be configurable per account.
- Auto boost settings shall persist in browser local storage.
- When auto boost is enabled, the product shall monitor the team boost availability time for that account.
- When boost becomes available, the product shall refresh team data and select the highest-scoring boostable teammate.
- The product shall trigger the boost action automatically for that teammate.
- Auto like shall be configurable per account.
- Auto like settings shall persist in browser local storage per account.
- When auto like is enabled, the product shall monitor social posts for that account.
- The product shall automatically like posts from users in the account's current team when those posts are not yet liked by the user.
- The product shall progressively crawl older posts until the historical crawl reaches the end of available history.
- The product shall show temporary toast notifications while auto-like processing is actively discovering or liking posts.

### 9. Data And Integrations

- The product shall integrate with SquadEasy API endpoints for authentication, token refresh, challenge data, current user data, user profile data, team data, user statistics, social posts, likes, and boosts.
- The product shall integrate with backend endpoints for historical team points, historical user points, and historical user activity points.
- Historical queries shall be parameterized by start and end timestamps.
- Historical query ranges shall be clamped so they do not exceed the present time.
- The product shall handle missing images gracefully by falling back to initials or placeholder states.
- The product shall show loading states while API-backed pages or charts are fetching data.

## Non-Functional Requirements

### Performance

- The product should provide responsive navigation and chart interactions on modern desktop and mobile browsers.
- The product should use cached query data where appropriate to reduce redundant requests.
- Historical chart interactions should avoid requesting time ranges outside the valid challenge period.

### Reliability

- The product shall continue operating across page reloads using persisted local state.
- The product shall recover from expired tokens through automatic refresh when possible.
- The product shall provide a visible fallback for runtime rendering errors.

### Deployment And Technical Constraints

- The product shall be implemented as a SolidJS single-page application.
- The product shall use TanStack Router for routing and TanStack Query for server-state management.
- The product shall use ECharts for time-series visualization.
- The product shall support static SPA deployment with deep-link fallback behavior.
- The product shall read the API base URL from environment configuration and default to a local backend when no override is provided.

## Success Criteria

- A user can log in and return later without re-entering credentials unless tokens are no longer valid.
- A user can manage multiple accounts and switch account context from the navigation.
- A user can move from dashboard to team view to user statistics without losing context.
- A user can inspect score trends over time through interactive charts.
- A user can enable automation for supported actions and have those actions run without manual intervention during the session.

## Open Product Gaps Observed In Current Implementation

- There is no explicit logout flow in the current UI.
- There is no visible management UI for removing stored accounts.
- There is no manual automation activity log or audit history.
- There is no permissions, roles, or administrative interface.
- There is no explicit empty-state copy for several data views beyond loading and fallback rendering.
