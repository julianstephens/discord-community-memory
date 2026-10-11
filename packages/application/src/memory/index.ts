import type { SourceMessage } from "schemas";

export * from "./authorization-service";
export * from "./ingestion-service";
export * from "./memory-service";

export interface MessageSource {
  fetchMessage(
    guildId: string,
    channelId: string,
    messageId: string,
  ): Promise<SourceMessage | null>;
}
