import { z } from "zod";

export const guildMemoryConfigSchema = z.object({
  guildId: z.string(),
  enabled: z.boolean().default(false),
  indexedChannelIds: z.array(z.string()).default([]),
  retentionDays: z.number().default(30),
  updatedAt: z.string().optional(),
});
export type GuildMemoryConfig = z.infer<typeof guildMemoryConfigSchema>;
