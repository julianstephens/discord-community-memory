import { logger } from "@/logger";
import type { Message } from "discord.js";

export const saveMessageCommand = async (message: Message) => {
  logger.info(`Saving message: ${message}`);
};
