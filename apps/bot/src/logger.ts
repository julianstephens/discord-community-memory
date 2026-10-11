import pino from "pino";
import { env } from "./env";

const pinoLogger = pino(
  env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty" } }
    : {},
);

export const logger = pinoLogger.child({
  service: "bot",
});
