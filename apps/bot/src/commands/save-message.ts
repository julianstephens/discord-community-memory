import { logger } from "@/logger";
import { assertGuildMemoryEnabled } from "@/guild-memory-config";
import type { Message } from "discord.js";

export const saveMessageCommand = async (message: Message) => {
  assertGuildMemoryEnabled(message.guildId);
  logger.info({ guildId: message.guildId }, "Saving message");
};
