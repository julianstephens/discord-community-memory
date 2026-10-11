import type { Client } from "discord.js";
import type { IngestionEvent } from "schemas";

interface IngestionService {
  accept(event: IngestionEvent): Promise<void>;
  reconcileMessage(
    guildId: string,
    channelId: string,
    messageId: string,
  ): Promise<void>;
  deleteMessage(guildId: string, messageId: string): Promise<void>;
}

class Service implements IngestionService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  accept = async (_event: IngestionEvent): Promise<void> => {
    // TODO: accept ingestion events and store them in the database
  };

  reconcileMessage = async (
    _guildId: string,
    _channelId: string,
    _messageId: string,
  ): Promise<void> => {
    // TODO:
    // acquire per-message serialization lock
    //
    // if deletion marker exists:
    //     return
    //
    // if channel no longer eligible:
    //     return
    //
    // fetch current message from Discord
    //
    // if fetch returns 404:
    //     mark message deleted
    //     return
    //
    // if fetch fails transiently:
    //    schedule retry
    //    return
    //
    // if message belongs to wrong scope:
    //    reject
    //
    // upsert canonical message
    // regenerate search projection
    // commit
  };

  deleteMessage = async (
    _guildId: string,
    _messageId: string,
  ): Promise<void> => {
    // TODO: delete message from database and mark it as deleted
  };
}

export default Service;
