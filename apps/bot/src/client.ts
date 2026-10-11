import { Client, Events, GatewayIntentBits } from "discord.js";
import { saveMessageCommand } from "./commands/save-message";
import { logger } from "./logger";

export const REQUIRED_GUILD_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
];

export const buildClient = () =>
  new Client({
    intents: REQUIRED_GUILD_INTENTS,
  });

export const client = buildClient();

type GuildInteractionLike = {
  inGuild: () => boolean;
  guildId: string | null;
  reply: (payload: Record<string, unknown>) => Promise<unknown>;
};

type DeferredInteractionLike = {
  deferred: boolean;
  replied: boolean;
  deferReply: (payload: Record<string, unknown>) => Promise<unknown>;
};

export const guildOnlyInteractionGuard = async (
  interaction: GuildInteractionLike,
) => {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return false;
  }

  return true;
};

export const deferEphemeralReply = async (
  interaction: DeferredInteractionLike,
) => {
  if (interaction.deferred || interaction.replied) {
    return;
  }

  await interaction.deferReply({ ephemeral: true });
};

export const mapDiscordRestError = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return "An unexpected Discord error occurred.";
  }

  const candidate = error as {
    code?: number;
    status?: number;
    message?: string;
  };

  if (candidate.code === 50001 || candidate.status === 403) {
    return "Missing permission to perform that action in this guild.";
  }

  if (candidate.code === 10062 || candidate.status === 404) {
    return "That Discord resource could not be found.";
  }

  return candidate.message ?? "An unexpected Discord error occurred.";
};

export const shutdownBot = async (bot: Client) => {
  logger.info("Shutting down bot...");
  await bot.destroy();
};

client.on(Events.ClientReady, (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.inGuild() || !interaction.guildId) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }
    return;
  }

  if (!interaction.isMessageContextMenuCommand()) {
    return;
  }

  if (interaction.commandName !== "Save Message") {
    return;
  }

  try {
    await deferEphemeralReply(interaction);
    await saveMessageCommand(interaction.targetMessage);
    await interaction.followUp({
      content: "Message saved successfully!",
      ephemeral: true,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to save message");
    await interaction
      .followUp({
        content: `Failed to save message: ${mapDiscordRestError(error)}`,
        ephemeral: true,
      })
      .catch(() => undefined);
  }
});
