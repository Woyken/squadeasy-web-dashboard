/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */


export interface paths {
  "/": {
    get: operations["Ranking_rankingGlobal"];
  };
  "/api/2.0/my/image": {
    post: operations["User_uploadImage"];
  };
  "/api/2.0/my/ranking/season": {
    get: operations["Ranking_rankingSeason"];
  };
  "/api/2.0/my/team": {
    get: operations["TeamService_myTeam"];
  };
  "/api/2.0/my/user": {
    get: operations["User_user"];
    patch: operations["User_updateUser"];
  };
  "/api/2.0/socialTags/list": {
    get: operations["Social_getSocialTags"];
  };
  "/api/2.0/teams": {
    get: operations["TeamService_teams"];
  };
  "/api/2.0/teams/{id}": {
    get: operations["TeamService_teamDetails"];
  };
  "/api/2.0/users": {
    get: operations["User_getAllUsers"];
  };
  "/api/2.0/users/{id}": {
    get: operations["User_getUser"];
  };
  "/api/2.0/users/{id}/boost": {
    post: operations["User_boostUser"];
  };
  "/api/2.0/users/{id}/statistics": {
    get: operations["User_getUserStatistics"];
  };
  "/api/3.0/auth/login": {
    post: operations["Authentication_login"];
  };
  "/api/3.0/auth/refresh-token": {
    post: operations["Authentication_refreshToken"];
  };
  "/api/3.0/my/challenge": {
    get: operations["ChallengeService_myChallenge"];
  };
  "/api/3.0/social/posts": {
    get: operations["Social_posts"];
    post: operations["Social_createPost"];
  };
  "/api/3.0/social/posts/{post_id}/like": {
    put: operations["Social_likePost"];
  };
  "/api/3.0/user-status": {
    get: operations["User_userStatus"];
  };
  "/api/4.0/histories/gps": {
    get: operations["Activity_activityHistoryList"];
  };
  "/api/4.0/histories/gps/{id}": {
    get: operations["Activity_activityHistory"];
  };
    "/api/3.0/user-profile/{userId}": {
    get: operations["UserService_getUserProfile"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    ActivityHistory: {
      id: string;
      name: ("Fast walking" | "Run") | string;
      /** Format: uri */
      icon: string;
      /** Format: date-time */
      startAt: string;
      /** Format: date-time */
      endAt: string;
      polylines: string[];
      /** Format: int32 */
      duration: number;
      /** Format: int32 */
      distance: number;
      /** Format: int32 */
      elevation: number;
      /** Format: int32 */
      points: number;
      source: "GARMIN" | string;
      cheat: boolean;
      co2ComparisonSource: "datagir" | string;
      mobilityReason: "Recreational sports" | string;
      isActivityShared: boolean;
      activities: unknown[];
      /** Format: double */
      speed: number;
      /** Format: double */
      pace: number;
      status: "OK" | string;
      externalActivityUrl: unknown;
    };
    UserProfileRemoteEntity: {
      id: string;
      isCurrentUser: boolean;
      name: string;
      firstName: string;
      lastName: string;
      teamName: string;
      entityName?: string;
      isInSameTeam: boolean;
      imageUrl?: string;
      isBlocked: boolean;
      isPrivate: boolean;
      isBoostable: boolean;
      canSendMessage: boolean;
      points?: string;
    };
    ActivityHistoryList: {
      filters: {
        filterBy: "MONTH" | string;
        /** Format: date-time */
        sinceDate: string;
        /** Format: date-time */
        minDatePossible: string;
        /** Format: date-time */
        maxDatePossible: string;
      };
      highlights: {
          name: string;
          /** Format: int32 */
          value: number;
          SIType: string;
        }[];
      activities: {
          id: string;
          name: string;
          /** Format: uri */
          icon: string;
          /** Format: date-time */
          date: string;
          /** Format: int32 */
          duration: number;
          /** Format: int32 */
          distance: number;
          /** Format: int32 */
          points: number;
          status: string;
          command: {
            name: string;
            params: {
              ACTIVITY_ID: string;
            };
          };
        }[];
    };
    ImageDataMultiPart: {
      /** Format: binary */
      image: string;
    };
    MyChallenge: {
      /** Format: uri */
      spaceImage: string;
      /** Format: uri */
      image: string;
      /** Format: date-time */
      startAt: string;
      /** Format: date-time */
      endAt: string;
      title: string;
      tagline: string;
      description: string;
      statistics: unknown;
      /** Format: date-time */
      deletionDate: string | null;
    };
    RankingMedal: {
      id: string;
      /** Format: int32 */
      minimalRank: number;
      /** Format: uri */
      image: string;
      defaultImage: string;
      color: string;
      description: string;
      name: string;
    };
    RankingTeam: {
      id: string;
      name: string;
      /** Format: int32 */
      points: number;
      /** Format: int32 */
      rank: number;
      /** Format: uri */
      image: string | null;
    };
    SocialPost: {
      id: string;
      createdAt: string;
      updatedAt?: string;
      hasModeratorRole: boolean;
      isPinned: boolean;
      sender: {
        id: string;
        firstName: string;
        lastName: string;
        image?: string;
        teamName: string;
        teamId: string;
      };
      content: {
        isEdited: boolean;
        message?: string;
        images: string[];
        socialtag?: string;
        /** Format: int32 */
        points?: number;
      };
      likes: {
        /** Format: int32 */
        count: number;
        isLikedByUser: boolean;
        images?: string[];
        firstName?: string;
        lastName?: string;
      };
      comments: unknown[];
    };
    SocialTag: {
      id: string;
      /** Format: int32 */
      remaining: number;
      availability: ("WEEKLY" | "DAILY") | string;
      /** Format: int32 */
      occurrence: number;
      /** Format: int32 */
      points: number;
      /** Format: date-time */
      date: string;
      /** Format: uri */
      image: string;
      name: string;
      description: string;
    };
    Team: {
      name: string;
      id: string;
      isDestructible: boolean;
      spaceId: string;
      captainId: string;
      /** Format: uri */
      image: string | null;
      /** Format: int32 */
      rank: number;
      /** Format: int32 */
      totalPoints: number | null;
      users: string[];
      isPrivate: boolean;
    };
    TeamDetails: {
      id: string;
      /** Format: int32 */
      totalPoints: number;
      /** Format: int32 */
      rank: number;
      /** Format: uri */
      image: string | null;
      name: string;
      code: string;
      captainId: string;
      isPrivate: boolean;
      users: ({
          id: string;
          /** Format: int32 */
          points: number;
          firstName: string;
          lastName: string;
          /** Format: uri */
          image: string | null;
          isActivityPublic: boolean;
          isCaptain: boolean;
          isBoostable: boolean;
          /** Format: int32 */
          boostCount: number;
        })[];
      /** Format: date-time */
      boostAvailableAt?: string;
    };
    TokenResponse: {
      accessToken: string;
      refreshToken: string;
    };
    UserDetails: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      userRole: "user" | string;
      userStatus: components["schemas"]["UserStatus"];
      /** Format: date-time */
      imageUpdatedAt: string;
      isActivityPublic: boolean;
      spaceId: string;
      teamId: string;
      languageCode: "en" | string;
      entityId: string | null;
      platform: "Android" | string;
      platformVersion: string;
      clientVersion: string;
      platformName: string;
      /** Format: date-time */
      lastConnectionDate: string;
      /** Format: date-time */
      consentDataShareDate: string;
      /** Format: date-time */
      consentBasicsDate: string;
      cheatLevel: "CLEAR" | string;
      image: string;
      isCaptain: boolean;
      /** Format: int32 */
      boostCount: number;
    };
    UserStatistics: {
      id: string;
      firstName: string;
      lastName: string;
      entityName: unknown;
      teamName: string;
      teamId: string;
      /** Format: int32 */
      totalPoints: number;
      /** Format: uri */
      image: string | null;
      isActivityPublic: boolean;
      activities: ({
          type: ("socialtag" | "quiz" | "mission" | "walk" | "gps") | string;
          /** Format: int32 */
          points: number;
          activityId: ("socialtag" | "quiz" | "mission" | "walk" | "statistic_walk" | "statistic_run" | "active_walk" | "bike") | string;
          /** Format: int32 */
          value: number;
          title: ("statistic_socialtag" | "statistic_quiz" | "statistic_mission" | "statistic_active_walk" | "statistic_bike") | string;
          isHistoryEmpty: boolean;
        })[];
      isBoostable: boolean;
      boostedBy: string[];
      /** Format: int32 */
      boostCount: number;
      boostEndAt: string[];
      isBlocked: boolean;
    };
    /** @enum {string} */
    UserStatus: "OK" | "NEED_UPDATE";
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export interface operations {

  Ranking_rankingGlobal: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": {
            /** Format: int32 */
            rank: number;
            teams: components["schemas"]["RankingTeam"][];
            medals: components["schemas"]["RankingMedal"][];
          };
        };
      };
    };
  };
  User_uploadImage: {
    requestBody: {
      content: {
        "multipart/form-data": components["schemas"]["ImageDataMultiPart"];
      };
    };
    responses: {
      /** @description The request has succeeded and a new resource has been created as a result. */
      201: {
        content: {
          "application/json": Record<string, never>;
        };
      };
    };
  };
  Ranking_rankingSeason: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": {
            /** Format: int32 */
            rank: number;
            teams: components["schemas"]["RankingTeam"][];
            medals: components["schemas"]["RankingMedal"][];
          };
        };
      };
    };
  };
  TeamService_myTeam: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["TeamDetails"];
        };
      };
    };
  };
  User_user: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["UserDetails"];
        };
      };
    };
  };
  User_updateUser: {
    requestBody: {
      content: {
        "application/json": {
          firstName?: string;
          lastName?: string;
          isActivityPublic?: boolean;
          languageCode?: "en" | string;
        };
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": {
            firstName: string;
            lastName: string;
            email: string;
            isActivityPublic: boolean;
            languageCode: "en" | string;
            id: string;
            userRole: "user" | string;
          };
        };
      };
    };
  };
  Social_getSocialTags: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": {
            ongoing: components["schemas"]["SocialTag"][];
            upcoming: components["schemas"]["SocialTag"][];
          };
        };
      };
    };
  };
  TeamService_teams: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["Team"][];
        };
      };
    };
  };
  TeamService_teamDetails: {
    parameters: {
      path: {
        id: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["TeamDetails"];
        };
      };
    };
  };
  User_getAllUsers: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": ({
              id: string;
              firstName: string;
              lastName: string;
              isPublic: boolean;
              teamId: string;
              entityId: unknown;
              /** Format: int32 */
              boostCount: number;
              entityName: unknown;
              /** Format: uri */
              image: string | null;
            })[];
        };
      };
    };
  };
  User_getUser: {
    parameters: {
      path: {
        id: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["UserDetails"];
        };
      };
    };
  };
  User_boostUser: {
    parameters: {
      path: {
        id: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": unknown;
        };
      };
    };
  };
  User_getUserStatistics: {
    parameters: {
      path: {
        id: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["UserStatistics"];
        };
      };
    };
  };
  Authentication_login: {
    requestBody: {
      content: {
        "application/json": {
          email: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["TokenResponse"];
        };
      };
    };
  };
  Authentication_refreshToken: {
    parameters: {
      header: {
        "refresh-token": string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["TokenResponse"];
        };
      };
    };
  };
  ChallengeService_myChallenge: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["MyChallenge"];
        };
      };
    };
  };
  Social_posts: {
    parameters: {
      query?: {
        sincePostId?: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["SocialPost"][];
        };
      };
    };
  };
  Social_createPost: {
    requestBody: {
      content: {
        "application/json": {
          message: string;
        };
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["SocialPost"];
        };
      };
    };
  };
  Social_likePost: {
    parameters: {
      path: {
        post_id: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": unknown;
        };
      };
    };
  };
  User_userStatus: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": {
            status: components["schemas"]["UserStatus"];
          };
        };
      };
    };
  };
    UserService_getUserProfile: {
    parameters: {
      path: {
        userId: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["UserProfileRemoteEntity"];
        };
      };
    };
  };
  Activity_activityHistoryList: {
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["ActivityHistoryList"];
        };
      };
    };
  };
  Activity_activityHistory: {
    parameters: {
      path: {
        id: string;
      };
    };
    responses: {
      /** @description The request has succeeded. */
      200: {
        content: {
          "application/json": components["schemas"]["ActivityHistory"];
        };
      };
    };
  };
}
