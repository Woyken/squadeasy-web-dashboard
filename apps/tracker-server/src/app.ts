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
import {
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
  image: z.string().nullable(),
  joinedAt: dateTimeStringSchema,
  leftAt: dateTimeStringSchema.nullable(),
  activeFrom: dateTimeStringSchema,
  activeUntil: dateTimeStringSchema,
});

type PointsQueryString = z.infer<typeof pointsQuerySchema>;

const SSE_RETRY_DELAY_MS = 5000;
const SSE_HEARTBEAT_INTERVAL_MS = 15000;
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const bearerAuthSecurity = [{ bearerAuth: [] }];

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

const fastify: FastifyInstance = Fastify({
  logger: process.env.NODE_ENV === "development",
});
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
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Provide the access token as a Bearer token.",
        },
      },
    },
    tags: [
      {
        name: "Realtime",
        description: "Realtime transport endpoints.",
      },
      {
        name: "Points",
        description: "Points query endpoints.",
      },
    ],
  },
  transform: swaggerTransform,
  transformObject: jsonSchemaTransformObject,
});

fastify.register(FastifySwaggerUi, {
  routePrefix: "/docs",
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
  origin: "*",
});

// Proxy all /squadeasy/proxy/* requests to the SquadEasy API, stripping the prefix
fastify.register(httpProxy, {
  upstream: "https://api-challenge.squadeasy.com",
  prefix: "/squadeasy/proxy",
  rewritePrefix: "",
  http2: false,
});

fastify.after(() => {
  fastify.get(
    "/api/points/stream",
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
    "/api/user-activity-points/:userId",
    {
      schema: {
        tags: ["Points"],
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
    "/api/user-points/:userId",
    {
      schema: {
        tags: ["Points"],
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
    "/api/team-memberships/:teamId",
    {
      schema: {
        tags: ["Points"],
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
            image: x.image,
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
    "/api/team-points",
    {
      schema: {
        tags: ["Points"],
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
