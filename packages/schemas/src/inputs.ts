import { z } from "zod";

export const saveMessageInputSchema = z.object({
  guild_id: z.string(),
  channel_id: z.string(),
  message_id: z.string(),
  user_id: z.string(),
});
export type SaveMessageInput = z.infer<typeof saveMessageInputSchema>;

export const createEntryInputSchema = z.object({
  guild_id: z.string(),
  channel_id: z.string(),
  user_id: z.string(),
  kind: z.enum(["note", "decision", "resource"]),
  title: z.string().min(1),
  content: z.string().min(1),
});
export type CreateEntryInput = z.infer<typeof createEntryInputSchema>;

export const removeEntryInputSchema = z.object({
  guild_id: z.string(),
  id: z.string(),
  user_id: z.string(),
});
export type RemoveEntryInput = z.infer<typeof removeEntryInputSchema>;
