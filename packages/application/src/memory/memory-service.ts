import type { Client } from "discord.js";
import { randomUUID } from "node:crypto";
import {
  memoryEntrySchema,
  type CreateEntryInput,
  type MemoryEntry,
  type RemoveEntryInput,
  type SaveMessageInput,
} from "schemas";

interface MemoryService {
  saveMessage(input: SaveMessageInput): Promise<MemoryEntry>;
  createEntry(input: CreateEntryInput): Promise<MemoryEntry>;
  removeEntry(input: RemoveEntryInput): Promise<void>;
}

class Service implements MemoryService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  private getMessage = async (channelId: string, messageId: string) => {
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      return await channel.messages.fetch(messageId);
    }
  };

  saveMessage = async (input: SaveMessageInput): Promise<MemoryEntry> => {
    const message = await this.getMessage(input.channel_id, input.message_id);
    if (!message) {
      // FIXME: improve error handling
      throw new Error("no message");
    }
    const newEntry: MemoryEntry = memoryEntrySchema.parse({
      id: randomUUID(),
      guild_id: input.guild_id,
      channel_id: input.channel_id,
      kind: "message",
      created_by: message.author.id,
      created_at: new Date(),
      source_message_id: input.message_id,
    });
    // TODO: save entry in db
    return newEntry;
  };

  createEntry = async (input: CreateEntryInput): Promise<MemoryEntry> => {
    const newEntry: MemoryEntry = memoryEntrySchema.parse({
      id: randomUUID(),
      guild_id: input.guild_id,
      channel_id: input.channel_id,
      kind: input.kind,
      created_by: input.user_id,
      created_at: new Date(),
      title: input.title,
      content: input.content,
    });
    // TODO: save entry in db
    return newEntry;
  };

  removeEntry = async (_input: RemoveEntryInput): Promise<void> => {
    // TODO: check if entry exists in db and remove it
  };
}

export default Service;
