import type { ServerResponse } from "node:http";
import Fastify, { type FastifyInstance } from "fastify";
import FastifySwagger from "@fastify/swagger";
import FastifySwaggerUi from "@fastify/swagger-ui";
import {
  createJsonSchemaTransform,
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransformObject,
  serializerCompiler,
  type ZodTypeProvider,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { z } from "zod/v4";

import { pool } from "./database.ts";
import { isValidAccessToken } from "./api/accessToken.ts";
import { mutationLogin } from "./api/client.ts";
import {
  getLatestTeamProfile,
  getLatestUserProfile,
  getStoredUserActivityPointsPage,
  getStoredTeamPointsPage,
  getStoredUserPointsPage,
  getTeamPointsByRange,
  getTeamMembershipsByRange,
  getUsersActivityPointsByRange,
  getUsersPointsByRange,
  testDbConnection,
} from "./services/pointsStorage.ts";
import {
  startIntervalPointsQuerying,
  stopIntervalPointsQuerying,
} from "./intervalQuery.ts";
import { initializeDatabase } from "./scripts/init-db.ts";
import cors from "@fastify/cors";
import httpProxy from "@fastify/http-proxy";
import { subscribeToPointsStream } from "./realtime/pointsEvents.ts";
import { parseJwt } from "./utils/parseJwt.ts";

const dateTimeStringSchema = z
  .iso.datetime({ offset: true })
  .describe("ISO 8601 datetime with timezone offset");

const pointsQuerySchema = z
  .object({
    startDate: dateTimeStringSchema,
    endDate: dateTimeStringSchema,
  })
  .superRefine(({ startDate, endDate }, ctx) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "startDate must be before endDate",
      });
    }

    if (start > now) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Dates cannot be in the future",
      });
    }

    if (end > now) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Dates cannot be in the future",
      });
    }
  });

const userParamsSchema = z.object({
  userId: z.string().min(1),
});

const teamParamsSchema = z.object({
  teamId: z.string().min(1),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const validationErrorResponseSchema = z.object({
  error: z.literal("Request validation failed"),
  details: z.array(
    z.object({
      path: z.string(),
      message: z.string(),
    })
  ),
});

const swaggerOauthTokenRequestSchema = z.object({
  grant_type: z.literal("password"),
  username: z.string().min(1),
  password: z.string().min(1),
  scope: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

const teamPointsResponseItemSchema = z.object({
  teamId: z.string(),
  time: dateTimeStringSchema,
  points: z.number(),
});

const userPointsResponseItemSchema = z.object({
  userId: z.string(),
  time: dateTimeStringSchema,
  points: z.number(),
});

const userActivityPointsResponseItemSchema = z.object({
  userId: z.string(),
  activityId: z.string(),
  time: dateTimeStringSchema,
  value: z.number(),
  points: z.number(),
});

const teamMembershipResponseItemSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  joinedAt: dateTimeStringSchema,
  leftAt: dateTimeStringSchema.nullable(),
  activeFrom: dateTimeStringSchema,
  activeUntil: dateTimeStringSchema,
});

const storedTeamProfileResponseSchema = z.object({
  teamId: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  updatedAt: dateTimeStringSchema,
});

const latestUserProfileResponseSchema = z.object({
  userId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  imageUrl: z.string().nullable(),
  teamId: z.string(),
  teamName: z.string().nullable(),
  updatedAt: dateTimeStringSchema,
});

const exportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  continuationToken: z.string().min(1).optional(),
});

const paginatedTeamPointsResponseSchema = z.object({
  items: z.array(teamPointsResponseItemSchema),
  continuationToken: z.string().nullable(),
});

const paginatedUserPointsResponseSchema = z.object({
  items: z.array(userPointsResponseItemSchema),
  continuationToken: z.string().nullable(),
});

const paginatedUserActivityPointsResponseSchema = z.object({
  items: z.array(userActivityPointsResponseItemSchema),
  continuationToken: z.string().nullable(),
});

const continuationTokenPayloadSchema = z.object({
  time: dateTimeStringSchema,
  id: z.string().min(1),
  secondaryId: z.string().min(1).optional(),
});

type PointsQueryString = z.infer<typeof pointsQuerySchema>;

const SSE_RETRY_DELAY_MS = 5000;
const SSE_HEARTBEAT_INTERVAL_MS = 15000;
const SWAGGER_OAUTH_TOKEN_PATH = "/api/v1/auth/squadeasy/token";
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const bearerAuthSecurity = [{ bearerAuth: [] }];

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  if (
    corsAllowedOrigins.length === 0 ||
    corsAllowedOrigins.includes("*")
  ) {
    return true;
  }

  return corsAllowedOrigins.includes(origin);
}

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !isAllowedCorsOrigin(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function writeSseEvent(
  raw: ServerResponse,
  event: string,
  data: unknown
): void {
  if (raw.writableEnded || raw.destroyed) {
    return;
  }

  raw.write(`event: ${event}\n`);
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeSseComment(raw: ServerResponse, comment: string): void {
  if (raw.writableEnded || raw.destroyed) {
    return;
  }

  raw.write(`: ${comment}\n\n`);
}

function encodeContinuationToken(cursor: {
  time: Date;
  id: string;
  secondaryId?: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      time: cursor.time.toISOString(),
      id: cursor.id,
      ...(cursor.secondaryId ? { secondaryId: cursor.secondaryId } : {}),
    }),
    "utf8"
  ).toString("base64url");
}

function decodeContinuationToken(
  token?: string
): { time: Date; id: string; secondaryId?: string } | undefined {
  if (!token) {
    return undefined;
  }

  const parsedPayload = continuationTokenPayloadSchema.parse(
    JSON.parse(Buffer.from(token, "base64url").toString("utf8"))
  );

  return {
    time: new Date(parsedPayload.time),
    id: parsedPayload.id,
    secondaryId: parsedPayload.secondaryId,
  };
}

const fastify: FastifyInstance = Fastify({
  logger: process.env.NODE_ENV === "development",
});
fastify.addContentTypeParser(
  /^application\/x-www-form-urlencoded\b/i,
  { parseAs: "string" },
  (_request, body, done) => {
    try {
      const formBody = typeof body === "string" ? body : body.toString("utf8");
      done(null, Object.fromEntries(new URLSearchParams(formBody).entries()));
    } catch (error) {
      done(error as Error, undefined);
    }
  }
);
const swaggerTransform = createJsonSchemaTransform({
  skipList: ["/docs", "/docs/*", "/openapi.json", "/squadeasy/proxy", "/squadeasy/proxy/*"],
});
const api = fastify.withTypeProvider<ZodTypeProvider>();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

fastify.register(FastifySwagger, {
  openapi: {
    info: {
      title: "SquadEasy Web Dashboard Tracker Server API",
      version: "1.0.0",
      description:
        "Internal API for SquadEasy dashboard tracking and points queries.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "oauth2",
          description:
            "Use your SquadEasy email as the username. Swagger UI exchanges those credentials for a SquadEasy access token and reuses it for authenticated requests.",
          flows: {
            password: {
              tokenUrl: SWAGGER_OAUTH_TOKEN_PATH,
              scopes: {},
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Realtime",
        description: "Realtime transport endpoints.",
      },
      {
        name: "Users",
        description: "User tracking endpoints.",
      },
      {
        name: "Teams",
        description: "Team tracking endpoints.",
      },
    ],
  },
  transform: swaggerTransform,
  transformObject: jsonSchemaTransformObject,
});

fastify.register(FastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    persistAuthorization: true,
  },
});

fastify.setErrorHandler((error, _request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((issue) => ({
      path: issue.instancePath.replace(/^\//, "").replace(/\//g, "."),
      message: issue.message,
    }));

    void reply.code(400).send({
      error: "Request validation failed",
      details,
    });
    return;
  }

  void reply.send(error);
});

fastify.register(cors, {
  origin(origin, callback) {
    callback(null, isAllowedCorsOrigin(origin));
  },
});

// Proxy all /squadeasy/proxy/* requests to the SquadEasy API, stripping the prefix
fastify.register(httpProxy, {
  upstream: "https://api-challenge.squadeasy.com",
  prefix: "/squadeasy/proxy",
  rewritePrefix: "",
  http2: false,
});

fastify.after(() => {
  fastify.post(
    SWAGGER_OAUTH_TOKEN_PATH,
    {
      schema: {
        hide: true,
      },
    },
    async (request, reply) => {
      const parsedBody = swaggerOauthTokenRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        await reply.code(400).send({
          error: "invalid_request",
          error_description: "Swagger OAuth token requests must include username, password, and grant_type=password.",
        });
        return;
      }

      try {
        const loginResult = await mutationLogin(
          parsedBody.data.username,
          parsedBody.data.password
        );
        const expiresAtSeconds = parseJwt(loginResult.accessToken).exp;
        const expiresInSeconds = Math.max(
          0,
          expiresAtSeconds - Math.floor(Date.now() / 1000)
        );

        await reply
          .header("Cache-Control", "no-store")
          .header("Pragma", "no-cache")
          .code(200)
          .send({
            access_token: loginResult.accessToken,
            token_type: "Bearer",
            refresh_token: loginResult.refreshToken,
            expires_in: expiresInSeconds,
          });
      } catch (error: unknown) {
        fastify.log.warn({ err: error }, "Swagger OAuth token exchange failed");
        await reply.code(401).send({
          error: "invalid_grant",
          error_description: "SquadEasy login failed.",
        });
      }
    }
  );

  fastify.get(
    "/healthz",
    {
      schema: {
        hide: true,
      },
    },
    async (_request, reply) => {
      await reply.code(200).send({ status: "ok" });
    }
  );

  fastify.get(
    "/readyz",
    {
      schema: {
        hide: true,
      },
    },
    async (_request, reply) => {
      try {
        await pool.query("SELECT 1");
        await reply.code(200).send({ status: "ready" });
      } catch (error: unknown) {
        fastify.log.warn({ err: error }, "Readiness check failed");
        await reply.code(503).send({ status: "unavailable" });
      }
    }
  );

  fastify.get(
    "/api/v1/realtime/points",
    {
      schema: {
        tags: ["Realtime"],
        summary: "Stream live points updates over Server-Sent Events",
        description:
          "Use fetch with the standard Authorization header and read the text/event-stream response body incrementally on the client.",
        security: bearerAuthSecurity,
        response: {
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      reply.hijack();

      const raw = reply.raw;
      raw.writeHead(200, {
        ...getCorsHeaders(request.headers.origin),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      raw.flushHeaders?.();
      raw.write(`retry: ${SSE_RETRY_DELAY_MS}\n\n`);

      writeSseEvent(raw, "connected", {
        time: new Date().toISOString(),
      });

      fastify.log.info({ url: request.url }, "SSE client connected");

      let closed = false;
      const cleanup = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeatInterval);
        unsubscribe();
        request.raw.off("aborted", cleanup);
        request.raw.off("close", cleanup);
        raw.off("close", cleanup);
        raw.off("error", cleanup);
        fastify.log.info({ url: request.url }, "SSE client disconnected");
      };

      const unsubscribe = subscribeToPointsStream((event) => {
        try {
          writeSseEvent(raw, event.event, event.data);
        } catch (error) {
          fastify.log.warn({ err: error }, "Failed to write SSE event");
          cleanup();
        }
      });

      const heartbeatInterval = setInterval(() => {
        writeSseComment(raw, `keepalive ${new Date().toISOString()}`);
      }, SSE_HEARTBEAT_INTERVAL_MS);

      request.raw.on("aborted", cleanup);
      request.raw.on("close", cleanup);
      raw.on("close", cleanup);
      raw.on("error", cleanup);
    },
  );

  api.get(
    "/api/v1/users/points/all",
    {
      schema: {
        tags: ["Users"],
        summary: "Get all stored user point snapshots",
        description:
          "Returns raw stored user point records ordered newest-first. Pass the continuationToken from the previous page to continue exporting.",
        security: bearerAuthSecurity,
        querystring: exportQuerySchema,
        response: {
          200: paginatedUserPointsResponseSchema,
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      let cursor: { time: Date; id: string } | undefined;
      try {
        cursor = decodeContinuationToken(request.query.continuationToken);
      } catch {
        await reply.code(400).send({
          error: "Request validation failed",
          details: [
            {
              path: "continuationToken",
              message: "Invalid continuation token",
            },
          ],
        });
        return;
      }

      try {
        const result = await getStoredUserPointsPage(
          request.query.limit,
          cursor
            ? {
                time: cursor.time,
                userId: cursor.id,
              }
            : undefined
        );

        await reply.code(200).send({
          items: result.items.map((x) => ({
            userId: x.user_id,
            time: new Date(x.time).toISOString(),
            points: x.points,
          })),
          continuationToken: result.nextCursor
            ? encodeContinuationToken({
                time: result.nextCursor.time,
                id: result.nextCursor.userId,
              })
            : null,
        });
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/users/activity-points/all",
    {
      schema: {
        tags: ["Users"],
        summary: "Get all stored user activity point snapshots",
        description:
          "Returns raw stored user activity point records, including scores and values, ordered newest-first. Pass the continuationToken from the previous page to continue exporting.",
        security: bearerAuthSecurity,
        querystring: exportQuerySchema,
        response: {
          200: paginatedUserActivityPointsResponseSchema,
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      let cursor: { time: Date; id: string; secondaryId?: string } | undefined;
      try {
        cursor = decodeContinuationToken(request.query.continuationToken);
      } catch {
        await reply.code(400).send({
          error: "Request validation failed",
          details: [
            {
              path: "continuationToken",
              message: "Invalid continuation token",
            },
          ],
        });
        return;
      }

      if (cursor && !cursor.secondaryId) {
        await reply.code(400).send({
          error: "Request validation failed",
          details: [
            {
              path: "continuationToken",
              message: "Invalid continuation token",
            },
          ],
        });
        return;
      }

      try {
        const result = await getStoredUserActivityPointsPage(
          request.query.limit,
          cursor
            ? {
                time: cursor.time,
                userId: cursor.id,
                activityId: cursor.secondaryId!,
              }
            : undefined
        );

        await reply.code(200).send({
          items: result.items.map((x) => ({
            userId: x.user_id,
            activityId: x.activity_id,
            time: new Date(x.time).toISOString(),
            value: x.value,
            points: x.points,
          })),
          continuationToken: result.nextCursor
            ? encodeContinuationToken({
                time: result.nextCursor.time,
                id: result.nextCursor.userId,
                secondaryId: result.nextCursor.activityId,
              })
            : null,
        });
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/users/:userId/activity-points",
    {
      schema: {
        tags: ["Users"],
        summary: "Get a user's activity points",
        security: bearerAuthSecurity,
        params: userParamsSchema,
        querystring: pointsQuerySchema,
        response: {
          200: z.array(userActivityPointsResponseItemSchema),
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      const { userId } = request.params;
      const { startDate: startDateStr, endDate: endDateStr } = request.query;

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      try {
        const result = await getUsersActivityPointsByRange(userId, start, end);

        await reply.code(200).send(
          result.map((x) => ({
            userId: x.user_id,
            activityId: x.activity_id,
            time: new Date(x.time).toISOString(),
            value: x.value,
            points: x.points,
          }))
        );
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/users/:userId/points",
    {
      schema: {
        tags: ["Users"],
        summary: "Get a user's total points",
        security: bearerAuthSecurity,
        params: userParamsSchema,
        querystring: pointsQuerySchema,
        response: {
          200: z.array(userPointsResponseItemSchema),
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      const { userId } = request.params;
      const { startDate: startDateStr, endDate: endDateStr } = request.query;

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      try {
        const result = await getUsersPointsByRange(userId, start, end);

        await reply.code(200).send(
          result.map((x) => ({
            userId: x.user_id,
            time: new Date(x.time).toISOString(),
            points: x.points,
          }))
        );
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/teams/:teamId/memberships",
    {
      schema: {
        tags: ["Teams"],
        summary: "Get a team's user membership history",
        security: bearerAuthSecurity,
        params: teamParamsSchema,
        querystring: pointsQuerySchema,
        response: {
          200: z.array(teamMembershipResponseItemSchema),
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      const { teamId } = request.params;
      const { startDate: startDateStr, endDate: endDateStr } = request.query;

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      try {
        const result = await getTeamMembershipsByRange(teamId, start, end);

        await reply.code(200).send(
          result.map((x) => ({
            teamId: x.team_id,
            userId: x.user_id,
            firstName: x.first_name,
            lastName: x.last_name,
            joinedAt: new Date(x.joined_at).toISOString(),
            leftAt: x.left_at ? new Date(x.left_at).toISOString() : null,
            activeFrom: new Date(x.active_from).toISOString(),
            activeUntil: new Date(x.active_until).toISOString(),
          }))
        );
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/teams/:teamId/profile",
    {
      schema: {
        tags: ["Teams"],
        summary: "Get the latest stored team profile",
        security: bearerAuthSecurity,
        params: teamParamsSchema,
        response: {
          200: storedTeamProfileResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      try {
        const result = await getLatestTeamProfile(request.params.teamId);

        if (!result) {
          await reply.code(404).send({ error: "Stored team profile not found." });
          return;
        }

        await reply.code(200).send({
          teamId: result.team_id,
          name: result.name,
          imageUrl: result.image,
          updatedAt: new Date(result.updated_at).toISOString(),
        });
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/users/:userId/profile",
    {
      schema: {
        tags: ["Users"],
        summary: "Get the latest stored user profile",
        security: bearerAuthSecurity,
        params: userParamsSchema,
        response: {
          200: latestUserProfileResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      try {
        const result = await getLatestUserProfile(request.params.userId);

        if (!result) {
          await reply.code(404).send({ error: "Stored user profile not found." });
          return;
        }

        await reply.code(200).send({
          userId: result.user_id,
          firstName: result.first_name,
          lastName: result.last_name,
          imageUrl: result.image,
          teamId: result.team_id,
          teamName: result.team_name,
          updatedAt: new Date(result.updated_at).toISOString(),
        });
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/teams/points/all",
    {
      schema: {
        tags: ["Teams"],
        summary: "Get all stored team point snapshots",
        description:
          "Returns raw stored team point records ordered newest-first. Pass the continuationToken from the previous page to continue exporting.",
        security: bearerAuthSecurity,
        querystring: exportQuerySchema,
        response: {
          200: paginatedTeamPointsResponseSchema,
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      let cursor: { time: Date; id: string } | undefined;
      try {
        cursor = decodeContinuationToken(request.query.continuationToken);
      } catch {
        await reply.code(400).send({
          error: "Request validation failed",
          details: [
            {
              path: "continuationToken",
              message: "Invalid continuation token",
            },
          ],
        });
        return;
      }

      try {
        const result = await getStoredTeamPointsPage(
          request.query.limit,
          cursor
            ? {
                time: cursor.time,
                teamId: cursor.id,
              }
            : undefined
        );

        await reply.code(200).send({
          items: result.items.map((x) => ({
            teamId: x.team_id,
            time: new Date(x.time).toISOString(),
            points: x.points,
          })),
          continuationToken: result.nextCursor
            ? encodeContinuationToken({
                time: result.nextCursor.time,
                id: result.nextCursor.teamId,
              })
            : null,
        });
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  api.get(
    "/api/v1/teams/points",
    {
      schema: {
        tags: ["Teams"],
        summary: "Get team points over a time range",
        security: bearerAuthSecurity,
        querystring: pointsQuerySchema,
        response: {
          200: z.array(teamPointsResponseItemSchema),
          400: validationErrorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!(await isValidAccessToken(request.headers.authorization))) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      const { startDate: startDateStr, endDate: endDateStr } = request.query;

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      try {
        const result = await getTeamPointsByRange(start, end);

        await reply.code(200).send(
          result.map((x) => ({
            teamId: x.team_id,
            time: new Date(x.time).toISOString(),
            points: x.points,
          }))
        );
      } catch (error: unknown) {
        console.error("Error executing query:", error);
        fastify.log.error({ err: error }, "Error executing query:");
        await reply.code(500).send({ error: "Failed to retrieve data." });
      }
    }
  );

  fastify.get(
    "/openapi.json",
    {
      schema: {
        hide: true,
      },
    },
    async (_request, reply) => {
      await reply.code(200).send(fastify.swagger());
    }
  );
});

async function startServer(): Promise<void> {
  try {
    await testDbConnection();

    await initializeDatabase();

    startIntervalPointsQuerying();

    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error({ err }, "Application failed to start"); // Use fastify logger
    // Ensure pool is closed even if startup fails partially
    await pool
      .end()
      .catch((poolErr) =>
        fastify.log.error(
          { poolErr },
          "Error closing pool during failed startup"
        )
      );
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log("\nReceived shutdown signal. Closing resources...");
  try {
    stopIntervalPointsQuerying();

    await fastify.close();
    console.log("Fastify server closed.");

    await pool.end();
    console.log("Database connection pool closed.");

    process.exit(0);
  } catch (error: unknown) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}

startServer().catch((e) => {
  console.error("startServer failed", e);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
