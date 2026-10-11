import { z } from "zod";

export const guildSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(false),
  ingestion_mode: z.enum(["manual", "automatic"]).default("manual"),
  retention_days: z.number().int().min(1).max(3650).nullable(),
  created_at: z.date(),
});
export type Guild = z.infer<typeof guildSchema>;

export const indexedChannelSchema = z.object({
  guild_id: z.string(),
  channel_id: z.string(),
  enabled: z.boolean().default(true),
  enabled_at: z.date(),
});
export type IndexedChannel = z.infer<typeof indexedChannelSchema>;

export const sourceMessageSchema = z.object({
  guild_id: z.string(),
  channel_id: z.string(),
  message_id: z.string(),
  author_id: z.string(),
  content: z.string(),
  source_timestamp: z.date(),
  edited_at: z.date().nullish(),
  reconciled_at: z.date().nullish(),
  deleted_at: z.date().nullish(),
});
export type SourceMessage = z.infer<typeof sourceMessageSchema>;

export const memoryEntrySchema = z
  .object({
    // PostgreSQL UUID accepts any 128-bit value, regardless of version bits.
    id: z.guid(),
    guild_id: z.string(),
    channel_id: z.string(),
    source_message_id: z.string().nullish(),
    kind: z.enum(["message", "note", "decision", "resource"]),
    title: z.string().nullish(),
    content: z.string().nullish(),
    created_by: z.string(),
    created_at: z.date(),
    deleted_at: z.date().nullish(),
  })
  .refine(
    (val) =>
      val.kind === "message"
        ? val.source_message_id != null && val.content == null
        : val.source_message_id == null && val.content != null,
    {
      error:
        "Messages require a source message ID and no content; other kinds require content and no source message ID",
    },
  );
export type MemoryEntry = z.infer<typeof memoryEntrySchema>;

export type MessageEvent =
  | {
      kind: "message.observed";
      guildId: string;
      channelId: string;
      messageId: string;
      eventId: string;
      observedAt: string;
    }
  | {
      kind: "message.deleted";
      guildId: string;
      messageId: string;
      eventId: string;
      observedAt: string;
    };

export type IngestionEvent = {
  schemaVersion: 1;
  idempotencyKey: string;
  payload: MessageEvent;
};
