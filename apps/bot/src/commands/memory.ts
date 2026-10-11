import {
  getGuildMemoryStatus,
  setGuildMemoryEnabled,
} from "@/guild-memory-config";
import { PermissionsBitField } from "discord.js";

const hasGuildConfigPermission = (interaction: any) => {
  const permissions = interaction.member?.permissions;
  if (!permissions || typeof permissions.has !== "function") {
    return false;
  }

  return (
    permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    permissions.has(PermissionsBitField.Flags.Administrator)
  );
};

export const memoryCommand = async (interaction: any) => {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const subcommandGroup = interaction.options?.getSubcommandGroup?.(false);
  const subcommand = interaction.options?.getSubcommand?.();

  if (subcommand === "status") {
    const status = getGuildMemoryStatus(interaction.guildId);
    await interaction.reply({
      content: `Community memory is ${status.enabled ? "enabled" : "disabled"} for this guild. Indexed channels: ${status.indexedChannelCount}. Ingestion: ${status.ingestionHealth}.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommandGroup !== "config") {
    return;
  }

  if (!hasGuildConfigPermission(interaction)) {
    await interaction.reply({
      content:
        "You do not have permission to configure community memory. Requires Manage Guild or Administrator.",
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "enable") {
    setGuildMemoryEnabled(interaction.guildId, true);
    await interaction.reply({
      content: "Community memory has been enabled for this guild.",
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "disable") {
    setGuildMemoryEnabled(interaction.guildId, false);
    await interaction.reply({
      content:
        "Community memory has been disabled for this guild. Existing knowledge remains stored for possible reactivation.",
      ephemeral: true,
    });
  }
};
