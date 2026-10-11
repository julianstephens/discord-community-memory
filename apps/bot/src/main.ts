import { env } from "@/env";
import { buildClient, shutdownBot } from "@/client";
import { registerCommands } from "@/commands";
import { logger } from "@/logger";

const client = buildClient();

const shutdown = async () => {
  await shutdownBot(client);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const main = async () => {
  logger.info("Starting bot...");
  await registerCommands();
  logger.info("Commands registered successfully.");
  await client.login(env.BOT_TOKEN);
};

main().catch((error) => {
  logger.error({ err: error }, "Bot startup failed");
  process.exit(1);
});
