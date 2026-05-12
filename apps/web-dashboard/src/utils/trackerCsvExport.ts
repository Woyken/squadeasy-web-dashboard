import { trackerServerClient, type ResolvedSeasonTeam } from "~/api/client";
import type JSZip from "jszip";

type ChallengeSnapshot = {
    title?: string;
    tagline?: string;
    startAt?: string;
    endAt?: string;
};

type UserPointsSnapshot = {
    userId: string;
    time: string;
    points: number;
};

type UserActivityPointsSnapshot = {
    userId: string;
    activityId: string;
    time: string;
    value: number;
    points: number;
};

type TeamPointsSnapshot = {
    teamId: string;
    time: string;
    points: number;
};

type ExportBundleParams = {
    getToken: () => Promise<string | undefined>;
    teams: ResolvedSeasonTeam[];
    challenge?: ChallengeSnapshot;
    onStatus?: (status: string) => void;
};

const EXPORT_PAGE_LIMIT = 200;
const TEAM_IMAGE_FOLDER = "assets/team-images";

function escapeCsvCell(value: unknown) {
    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);
    if (/[\",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

function buildCsv<T extends Record<string, unknown>>(
    rows: T[],
    columns: Array<keyof T>,
) {
    const header = columns.join(",");
    const body = rows.map((row) =>
        columns.map((column) => escapeCsvCell(row[column])).join(","),
    );

    return `\uFEFF${[header, ...body].join("\n")}`;
}

function toFileSafeStamp(dateIsoString: string) {
    return dateIsoString.replace(/[:.]/g, "-");
}

function sanitizeFileName(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "item";
}

function getImageExtension(contentType: string | null, url: string) {
    const normalizedContentType = contentType?.toLowerCase() ?? "";
    if (normalizedContentType.includes("image/png")) return "png";
    if (normalizedContentType.includes("image/jpeg")) return "jpg";
    if (normalizedContentType.includes("image/jpg")) return "jpg";
    if (normalizedContentType.includes("image/webp")) return "webp";
    if (normalizedContentType.includes("image/gif")) return "gif";
    if (normalizedContentType.includes("image/svg+xml")) return "svg";

    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (extension && extension.length <= 5) {
        return extension;
    }

    return "img";
}

async function fetchAllUserPoints(accessToken: string, onProgress?: (count: number) => void) {
    const allItems: UserPointsSnapshot[] = [];
    let continuationToken: string | undefined;

    while (true) {
        const result = await trackerServerClient.GET("/api/v1/users/points/all", {
            params: {
                query: {
                    limit: EXPORT_PAGE_LIMIT,
                    continuationToken,
                },
            },
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
        });

        if (!result.data) {
            throw new Error(`Get all user points failed ${JSON.stringify(result.error)}`);
        }

        allItems.push(...result.data.items);
        onProgress?.(allItems.length);

        if (!result.data.continuationToken) {
            break;
        }

        continuationToken = result.data.continuationToken;
    }

    return allItems;
}

async function fetchAllUserActivityPoints(accessToken: string, onProgress?: (count: number) => void) {
    const allItems: UserActivityPointsSnapshot[] = [];
    let continuationToken: string | undefined;

    while (true) {
        const result = await trackerServerClient.GET(
            "/api/v1/users/activity-points/all",
            {
                params: {
                    query: {
                        limit: EXPORT_PAGE_LIMIT,
                        continuationToken,
                    },
                },
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            },
        );

        if (!result.data) {
            throw new Error(
                `Get all user activity points failed ${JSON.stringify(result.error)}`,
            );
        }

        allItems.push(...result.data.items);
        onProgress?.(allItems.length);

        if (!result.data.continuationToken) {
            break;
        }

        continuationToken = result.data.continuationToken;
    }

    return allItems;
}

async function fetchAllTeamPoints(accessToken: string, onProgress?: (count: number) => void) {
    const allItems: TeamPointsSnapshot[] = [];
    let continuationToken: string | undefined;

    while (true) {
        const result = await trackerServerClient.GET("/api/v1/teams/points/all", {
            params: {
                query: {
                    limit: EXPORT_PAGE_LIMIT,
                    continuationToken,
                },
            },
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
        });

        if (!result.data) {
            throw new Error(`Get all team points failed ${JSON.stringify(result.error)}`);
        }

        allItems.push(...result.data.items);
        onProgress?.(allItems.length);

        if (!result.data.continuationToken) {
            break;
        }

        continuationToken = result.data.continuationToken;
    }

    return allItems;
}

async function fetchUserProfiles(accessToken: string, userIds: string[], onProgress?: (count: number) => void) {
    const uniqueUserIds = [...new Set(userIds)];
    const profiles = new Map<
        string,
        { userId: string; firstName: string; lastName: string; teamId: string; teamName: string | null; imageUrl: string | null }
    >();
    let processedCount = 0;

    await Promise.all(
        uniqueUserIds.map(async (userId) => {
            try {
                const result = await trackerServerClient.GET("/api/v1/users/{userId}/profile", {
                    params: {
                        path: { userId },
                    },
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                });

                if (result.data) {
                    profiles.set(userId, {
                        userId,
                        firstName: result.data.firstName,
                        lastName: result.data.lastName,
                        teamId: result.data.teamId,
                        teamName: result.data.teamName,
                        imageUrl: result.data.imageUrl,
                    });
                }
            } catch {
                // Silently skip users that can't be fetched
            } finally {
                processedCount++;
                onProgress?.(processedCount);
            }
        }),
    );

    return profiles;
}

async function addTeamImagesToZip(zip: JSZip, teams: ResolvedSeasonTeam[], onProgress?: (count: number) => void) {
    const teamsWithImages = teams.filter((team) => !!team.image);
    let downloadedCount = 0;

    await Promise.all(
        teamsWithImages.map(async (team) => {
            if (!team.image) {
                return;
            }

            try {
                const response = await fetch(team.image);
                if (!response.ok) {
                    throw new Error(`Failed to download image for ${team.name}`);
                }

                const blob = await response.blob();
                const extension = getImageExtension(response.headers.get("content-type"), team.image);
                const fileName = `${sanitizeFileName(team.name)}-${team.id}.${extension}`;

                zip.file(`${TEAM_IMAGE_FOLDER}/${fileName}`, blob);
            } finally {
                downloadedCount++;
                onProgress?.(downloadedCount);
            }
        }),
    );
}

const USER_IMAGE_FOLDER = "assets/user-images";

async function addUserImagesToZip(
    zip: JSZip,
    users: Array<{ userId: string; firstName: string; lastName: string; teamId: string; teamName: string | null; imageUrl: string | null }>,
    onProgress?: (count: number) => void,
) {
    const usersWithImages = users.filter((user) => !!user.imageUrl);
    let downloadedCount = 0;

    await Promise.all(
        usersWithImages.map(async (user) => {
            if (!user.imageUrl) {
                return;
            }

            try {
                const response = await fetch(user.imageUrl);
                if (!response.ok) {
                    return; // Silently skip failed downloads
                }

                const blob = await response.blob();
                const extension = getImageExtension(response.headers.get("content-type"), user.imageUrl);
                const fileName = `${sanitizeFileName(user.firstName)}-${sanitizeFileName(user.lastName)}-${user.userId}.${extension}`;

                zip.file(`${USER_IMAGE_FOLDER}/${fileName}`, blob);
            } catch {
                // Silently skip users whose images fail to download
            } finally {
                downloadedCount++;
                onProgress?.(downloadedCount);
            }
        }),
    );
}

export async function exportDashboardCsvBundle(params: ExportBundleParams) {
    const accessToken = await params.getToken();
    if (!accessToken) {
        throw new Error("Missing token for CSV export");
    }

    const { default: JSZip } = await import("jszip");

    params.onStatus?.("Fetching user point snapshots...");
    const userPoints = await fetchAllUserPoints(
        accessToken,
        (count) => params.onStatus?.(`Fetching user point snapshots... (${count})`),
    );

    params.onStatus?.("Fetching user activity point snapshots...");
    const userActivityPoints = await fetchAllUserActivityPoints(
        accessToken,
        (count) => params.onStatus?.(`Fetching user activity point snapshots... (${count})`),
    );

    params.onStatus?.("Fetching team point snapshots...");
    const teamPoints = await fetchAllTeamPoints(
        accessToken,
        (count) => params.onStatus?.(`Fetching team point snapshots... (${count})`),
    );

    params.onStatus?.("Fetching user profiles...");
    const uniqueUserIds = [...new Set(userPoints.map((p) => p.userId))];
    const userProfiles = await fetchUserProfiles(
        accessToken,
        uniqueUserIds,
        (count) => params.onStatus?.(`Fetching user profiles... (${count}/${uniqueUserIds.length})`),
    );

    params.onStatus?.("Generating CSV files...");
    const exportedAt = new Date().toISOString();
    const stamp = toFileSafeStamp(exportedAt);
    const zip = new JSZip();

    const teams = params.teams
        .slice()
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    const imagePathByTeamId = new Map<string, string>();
    for (const team of teams) {
        if (!team.image) continue;

        const extensionHint = getImageExtension(null, team.image);
        imagePathByTeamId.set(
            team.id,
            `${TEAM_IMAGE_FOLDER}/${sanitizeFileName(team.name)}-${team.id}.${extensionHint}`,
        );
    }

    const leaderboardRows = teams.map((team, index) => ({
        rank: index + 1,
        teamId: team.id,
        name: team.name,
        points: team.points,
        imagePath: imagePathByTeamId.get(team.id) ?? "",
    }));
    const challengeRows = [
        {
            exportedAt,
            title: params.challenge?.title ?? "",
            tagline: params.challenge?.tagline ?? "",
            startAt: params.challenge?.startAt ?? "",
            endAt: params.challenge?.endAt ?? "",
        },
    ];

    zip.file(
        "overview/challenge.csv",
        buildCsv(challengeRows, ["exportedAt", "title", "tagline", "startAt", "endAt"]),
    );
    zip.file(
        "overview/leaderboard_teams.csv",
        buildCsv(leaderboardRows, ["rank", "teamId", "name", "points", "imagePath"]),
    );

    const imagePathByUserId = new Map<string, string>();
    for (const user of userProfiles.values()) {
        if (!user.imageUrl) continue;

        const extensionHint = getImageExtension(null, user.imageUrl);
        imagePathByUserId.set(
            user.userId,
            `${USER_IMAGE_FOLDER}/${sanitizeFileName(user.firstName)}-${sanitizeFileName(user.lastName)}-${user.userId}.${extensionHint}`,
        );
    }

    const usersRows = Array.from(userProfiles.values()).map((user) => ({
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        teamId: user.teamId,
        teamName: user.teamName ?? "",
        imagePath: imagePathByUserId.get(user.userId) ?? "",
    }));
    zip.file(
        "overview/users.csv",
        buildCsv(usersRows, ["userId", "firstName", "lastName", "teamId", "teamName", "imagePath"]),
    );

    zip.file("tracker/users_points_all.csv", buildCsv(userPoints, ["userId", "time", "points"]));
    zip.file(
        "tracker/users_activity_points_all.csv",
        buildCsv(userActivityPoints, ["userId", "activityId", "time", "value", "points"]),
    );
    zip.file("tracker/teams_points_all.csv", buildCsv(teamPoints, ["teamId", "time", "points"]));

    params.onStatus?.("Downloading team images...");
    await addTeamImagesToZip(
        zip,
        teams,
        (count) => params.onStatus?.(`Downloading team images... (${count}/${teams.length})`),
    );

    params.onStatus?.("Downloading user images...");
    await addUserImagesToZip(
        zip,
        Array.from(userProfiles.values()),
        (count) => params.onStatus?.(`Downloading user images... (${count})`),
    );

    params.onStatus?.("Preparing ZIP download...");
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `squadeasy-export-${stamp}.zip`;
    link.click();
    URL.revokeObjectURL(downloadUrl);

    params.onStatus?.("Export completed.");
    return 6;
}
