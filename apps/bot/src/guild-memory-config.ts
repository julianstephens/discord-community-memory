import { guildMemoryConfigSchema, type GuildMemoryConfig } from "schemas";

const guildMemoryConfigs = new Map<string, GuildMemoryConfig>();

const defaultConfig = (guildId: string): GuildMemoryConfig =>
  guildMemoryConfigSchema.parse({ guildId });

export const getGuildMemoryConfig = (guildId: string): GuildMemoryConfig => {
  const existing = guildMemoryConfigs.get(guildId);
  if (existing) {
    return { ...existing, indexedChannelIds: [...existing.indexedChannelIds] };
  }

  const config = defaultConfig(guildId);
  guildMemoryConfigs.set(guildId, config);
  return { ...config, indexedChannelIds: [...config.indexedChannelIds] };
};

export const setGuildMemoryEnabled = (guildId: string, enabled: boolean) => {
  const config = getGuildMemoryConfig(guildId);
  const nextConfig: GuildMemoryConfig = {
    ...config,
    enabled,
    updatedAt: new Date().toISOString(),
  };

  guildMemoryConfigs.set(guildId, nextConfig);
  return {
    ...nextConfig,
    indexedChannelIds: [...nextConfig.indexedChannelIds],
  };
};

export const isGuildMemoryEnabled = (guildId: string | null | undefined) => {
  if (!guildId) {
    return false;
  }

  return getGuildMemoryConfig(guildId).enabled;
};

export const assertGuildMemoryEnabled = (
  guildId: string | null | undefined,
) => {
  if (!guildId || !isGuildMemoryEnabled(guildId)) {
    throw new Error("Guild memory is disabled.");
  }
};

export const getGuildMemoryStatus = (guildId: string) => {
  const config = getGuildMemoryConfig(guildId);
  return {
    enabled: config.enabled,
    indexedChannelCount: config.indexedChannelIds.length,
    ingestionHealth: config.enabled ? "enabled" : "disabled",
  };
};
