import type {
  ColumnType,
  Generated,
  GeneratedAlways,
  JSONColumnType,
} from "kysely";
import type {
  Guild,
  IndexedChannel,
  MemoryEntry,
  MessageEvent,
  SourceMessage,
} from "schemas";

/** pg returns TIMESTAMPTZ as Date; writes also accept ISO timestamp strings. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type DefaultTimestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null,
  Date | string | null
>;

/** Optional schema properties correspond to SQL NULL, never undefined in rows. */
type Nullable<T> = Exclude<T, undefined> | (undefined extends T ? null : never);
type DatabaseColumn<T> = [Extract<T, Date>] extends [never]
  ? Nullable<T>
  : ColumnType<Nullable<T>, Nullable<T> | string, Nullable<T> | string>;
type TableFromSchema<T> = { [K in keyof T]-?: DatabaseColumn<T[K]> };

export interface GuildTable extends Omit<
  TableFromSchema<Guild>,
  "enabled" | "ingestion_mode" | "created_at"
> {
  enabled: Generated<Guild["enabled"]>;
  ingestion_mode: Generated<Guild["ingestion_mode"]>;
  created_at: DefaultTimestamp;
}

export interface IndexedChannelTable extends Omit<
  TableFromSchema<IndexedChannel>,
  "enabled" | "enabled_at"
> {
  enabled: Generated<IndexedChannel["enabled"]>;
  enabled_at: DefaultTimestamp;
}

export type SourceMessageTable = TableFromSchema<SourceMessage>;

export interface MemoryEntryTable extends Omit<
  TableFromSchema<MemoryEntry>,
  "created_at"
> {
  created_at: DefaultTimestamp;
}

// Queue defaults below should also be declared by the corresponding migrations.
export interface IngestionEventTable {
  id: string;
  guild_id: Guild["id"];
  event_kind: MessageEvent["kind"];
  dedupe_key: string;
  payload: JSONColumnType<MessageEvent, MessageEvent, MessageEvent>;
  received_at: DefaultTimestamp;
  processed_at: NullableTimestamp;
  attempt_count: Generated<number>;
  last_error: string | null;
}

export interface ProcessingJobTable {
  id: string;
  job_type: string;
  payload: JSONColumnType<
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >;
  state: Generated<"pending" | "running" | "completed" | "dead">;
  available_at: DefaultTimestamp;
  attempt_count: Generated<number>;
  lease_owner: string | null;
  lease_until: NullableTimestamp;
  last_error: string | null;
  created_at: DefaultTimestamp;
}

export interface DeletionMarkerTable {
  guild_id: SourceMessage["guild_id"];
  message_id: SourceMessage["message_id"];
  deleted_at: Timestamp;
  expires_at: Timestamp;
}

export interface SearchDocumentTable {
  id: string;
  guild_id: Guild["id"];
  channel_id: IndexedChannel["channel_id"];
  source_type: "message" | "entry";
  source_id: string;
  content: string;
  search_vector: GeneratedAlways<string>;
  updated_at: DefaultTimestamp;
}

export interface Database {
  guilds: GuildTable;
  indexed_channels: IndexedChannelTable;
  source_messages: SourceMessageTable;
  memory_entries: MemoryEntryTable;
  ingestion_events: IngestionEventTable;
  processing_jobs: ProcessingJobTable;
  deletion_markers: DeletionMarkerTable;
  search_documents: SearchDocumentTable;
}
