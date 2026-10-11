import { z } from "zod";

export const guildSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(false),
  ingestion_mode: z.enum(["manual", "automatic"]),
  retention_days: z.number().default(30),
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
  edited_at: z.date().optional(),
  reconciled_at: z.date().optional(),
  deleted_at: z.date().optional(),
});
export type SourceMessage = z.infer<typeof sourceMessageSchema>;

export const memoryEntrySchema = z
  .object({
    id: z.string(),
    guild_id: z.string(),
    channel_id: z.string(),
    source_message_id: z.string().optional(),
    kind: z.enum(["message", "note", "decision", "resource"]),
    title: z.string().optional(),
    content: z.string().optional(),
    created_by: z.string(),
    created_at: z.date(),
    deleted_at: z.date().optional(),
  })
  .refine(
    (val) => val.kind === "message" && val.source_message_id && !val.content,
    {
      error:
        "Content must not be empty for message kind with a source message ID",
      abort: true,
    },
  )
  .refine(
    (val) => val.kind !== "message" || !val.source_message_id || val.content,
    {
      error:
        "Content must be empty for non-message kinds or when there is no source message ID",
      abort: true,
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
