import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import { env } from "@/env";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { ApiError } from "@/handlers";
import { toRequestErrorResponse } from "@/error-response";
import z from "zod";

const setupApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook("onSend", async (request, reply) => {
    reply.header(
      "Content-Security-Policy",
      env.NODE_ENV !== "production" && request.url.startsWith("/docs")
        ? "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        : "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    reply.header(
      "Permissions-Policy",
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
    }
  });

  if (env.NODE_ENV !== "production") {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: "Community Memory API",
          description:
            "REST API for managing the community memory Discord servers",
          version: "1.0.0",
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
      transformObject: jsonSchemaTransformObject,
    });

    await app.register(fastifySwaggerUI, {
      routePrefix: "/docs",
    });
  }

  app.addHook("preHandler", async (request) => {
    const requestPath = request.url.split("?")[0];
    const publicRoutes = new Set(["GET /api/health"]);
    const isPublicRequest =
      publicRoutes.has(`${request.method} ${requestPath}`) ||
      (env.NODE_ENV !== "production" && requestPath.startsWith("/docs"));

    if (isPublicRequest) {
      return;
    }

    // TODO: add authentication logic
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      const apiError = err as ApiError;
      return reply
        .code(apiError.statusCode)
        .send(
          toRequestErrorResponse(
            apiError.statusCode,
            apiError.message,
            req,
            apiError.details,
          ),
        );
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send(
        toRequestErrorResponse(400, "Request doesn't match the schema", req, {
          issues: err.validation,
        }),
      );
    }

    if (isResponseSerializationError(err)) {
      return reply.code(500).send(
        toRequestErrorResponse(500, "Response doesn't match the schema", req, {
          issues: err.cause.issues,
        }),
      );
    }

    return reply.code(500).send(
      toRequestErrorResponse(500, "An unexpected error occurred", req, {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "GET",
    url: "/api/health",
    schema: {
      tags: ["health"],
      response: {
        200: z.object({ status: z.literal("ok") }),
      },
    },
    handler: async () => ({ status: "ok" as const }),
  });

  return app;
};

const start = async () => {
  const fastify = await setupApp();
  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
