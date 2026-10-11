import { env } from "@/env";
import { logger } from "@/logger";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  REST,
  Routes,
} from "discord.js";

export const commands = [
  {
    name: "Save Message",
    type: ApplicationCommandType.Message,
  },
  {
    name: "memory",
    description: "Manage community memory",
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: "search",
        description: "Search accessible community knowledge",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "query",
            description: "The text to search for",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "add",
        description: "Create a manually authored knowledge record",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "title",
            description: "The knowledge record title",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "content",
            description: "The content to store",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "type",
            description: "The knowledge record type",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "note", value: "note" },
              { name: "decision", value: "decision" },
              { name: "resource", value: "resource" },
            ],
          },
        ],
      },
      {
        name: "remove",
        description: "Remove a knowledge record or saved message",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "id",
            description: "The record identifier to remove",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "status",
        description: "Show memory configuration and health status",
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: "config",
        description: "Configure community memory",
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: "enable",
            description: "Enable memory for this guild",
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: "disable",
            description: "Disable memory for this guild",
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: "channel-add",
            description: "Add a channel to the automated indexing set",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: "channel",
                description: "The channel to index",
                type: ApplicationCommandOptionType.Channel,
                required: true,
              },
            ],
          },
          {
            name: "channel-remove",
            description: "Remove a channel from automated indexing",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: "channel",
                description: "The channel to remove",
                type: ApplicationCommandOptionType.Channel,
                required: true,
              },
            ],
          },
          {
            name: "retention",
            description: "Set the retention period for memory data",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: "days",
                description: "Retention period in days",
                type: ApplicationCommandOptionType.Integer,
                required: true,
              },
            ],
          },
          {
            name: "purge",
            description: "Purge stored memory data",
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
    ],
  },
];

export const registerCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(env.BOT_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(env.CLIENT_ID), {
      body: commands,
    });
    return true;
  } catch (error) {
    logger.error({ err: error }, "Failed to register commands");
    return false;
  }
};
