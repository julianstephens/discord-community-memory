import { sql, type Kysely } from "kysely";

// Migrations are frozen snapshots and must not depend on application table types.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType("memory_kind")
    .asEnum(["message", "note", "decision", "resource"])
    .execute();

  await db.schema
    .createTable("guilds")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("ingestion_mode", "text", (c) => c.notNull().defaultTo("manual"))
    .addColumn("retention_days", "integer")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "guilds_ingestion_mode_check",
      sql`ingestion_mode in ('manual', 'automatic')`,
    )
    .addCheckConstraint(
      "guilds_retention_days_check",
      sql`retention_days between 1 and 3650`,
    )
    .execute();

  await db.schema
    .createTable("indexed_channels")
    .addColumn("guild_id", "text", (c) => c.notNull().references("guilds.id"))
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("enabled_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint("indexed_channels_pkey", [
      "guild_id",
      "channel_id",
    ])
    .execute();

  await db.schema
    .createTable("source_messages")
    .addColumn("guild_id", "text", (c) => c.notNull().references("guilds.id"))
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("author_id", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("source_timestamp", "timestamptz", (c) => c.notNull())
    .addColumn("edited_at", "timestamptz")
    .addColumn("reconciled_at", "timestamptz")
    .addColumn("deleted_at", "timestamptz")
    .addPrimaryKeyConstraint("source_messages_pkey", ["guild_id", "message_id"])
    .execute();
  await db.schema
    .createIndex("source_messages_channel_idx")
    .on("source_messages")
    .columns(["guild_id", "channel_id"])
    .execute();

  await db.schema
    .createTable("memory_entries")
    .addColumn("id", "uuid", (c) => c.primaryKey())
    .addColumn("guild_id", "text", (c) => c.notNull().references("guilds.id"))
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("source_message_id", "text")
    .addColumn("kind", sql`memory_kind`, (c) => c.notNull())
    .addColumn("title", "text")
    .addColumn("content", "text")
    .addColumn("created_by", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint(
      "memory_entries_source_check",
      sql`
      (kind = 'message' and source_message_id is not null and content is null)
      or (kind <> 'message' and source_message_id is null and content is not null)
    `,
    )
    .addForeignKeyConstraint(
      "memory_entries_source_fkey",
      ["guild_id", "source_message_id"],
      "source_messages",
      ["guild_id", "message_id"],
    )
    .execute();
  await db.schema
    .createIndex("one_saved_entry_per_message")
    .unique()
    .on("memory_entries")
    .columns(["guild_id", "source_message_id"])
    .where(sql<boolean>`source_message_id is not null and deleted_at is null`)
    .execute();
  await db.schema
    .createIndex("memory_entries_channel_idx")
    .on("memory_entries")
    .columns(["guild_id", "channel_id"])
    .execute();

  // Internal event/job IDs are opaque strings; Discord IDs also remain TEXT.
  await db.schema
    .createTable("ingestion_events")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("guild_id", "text", (c) => c.notNull().references("guilds.id"))
    .addColumn("event_kind", "text", (c) => c.notNull())
    .addColumn("dedupe_key", "text", (c) => c.notNull().unique())
    .addColumn("payload", "jsonb", (c) => c.notNull())
    .addColumn("received_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("processed_at", "timestamptz")
    .addColumn("attempt_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addCheckConstraint(
      "ingestion_events_kind_check",
      sql`event_kind in ('message.observed', 'message.deleted')`,
    )
    .addCheckConstraint(
      "ingestion_events_attempt_count_check",
      sql`attempt_count >= 0`,
    )
    .execute();

  await db.schema
    .createTable("processing_jobs")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("job_type", "text", (c) => c.notNull())
    .addColumn("payload", "jsonb", (c) => c.notNull())
    .addColumn("state", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("available_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn("attempt_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("lease_owner", "text")
    .addColumn("lease_until", "timestamptz")
    .addColumn("last_error", "text")
    .addColumn("created_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "processing_jobs_state_check",
      sql`state in ('pending', 'running', 'completed', 'dead')`,
    )
    .addCheckConstraint(
      "processing_jobs_attempt_count_check",
      sql`attempt_count >= 0`,
    )
    .execute();
  await db.schema
    .createIndex("processing_jobs_pending_idx")
    .on("processing_jobs")
    .columns(["available_at", "id"])
    .where(sql<boolean>`state = 'pending'`)
    .execute();
  await db.schema
    .createIndex("processing_jobs_lease_idx")
    .on("processing_jobs")
    .column("lease_until")
    .where(sql<boolean>`state = 'running'`)
    .execute();

  // No source-message FK: a deletion marker can precede message ingestion.
  await db.schema
    .createTable("deletion_markers")
    .addColumn("guild_id", "text", (c) => c.notNull().references("guilds.id"))
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("deleted_at", "timestamptz", (c) => c.notNull())
    .addColumn("expires_at", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("deletion_markers_pkey", [
      "guild_id",
      "message_id",
    ])
    .execute();
  await db.schema
    .createIndex("deletion_markers_expiry_idx")
    .on("deletion_markers")
    .column("expires_at")
    .execute();

  await db.schema
    .createTable("search_documents")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("guild_id", "text", (c) => c.notNull().references("guilds.id"))
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("source_type", "text", (c) => c.notNull())
    .addColumn("source_id", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("search_vector", sql`tsvector`, (c) =>
      c
        .notNull()
        .generatedAlwaysAs(sql`to_tsvector('english', content)`)
        .stored(),
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("search_documents_source_key", [
      "guild_id",
      "source_type",
      "source_id",
    ])
    .addCheckConstraint(
      "search_documents_source_type_check",
      sql`source_type in ('message', 'entry')`,
    )
    .execute();
  await db.schema
    .createIndex("search_documents_fts_idx")
    .on("search_documents")
    .using("gin")
    .column("search_vector")
    .execute();
  await db.schema
    .createIndex("search_documents_scope_idx")
    .on("search_documents")
    .columns(["guild_id", "channel_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    "search_documents",
    "deletion_markers",
    "processing_jobs",
    "ingestion_events",
    "memory_entries",
    "source_messages",
    "indexed_channels",
    "guilds",
  ]) {
    await db.schema.dropTable(table).execute();
  }
  await db.schema.dropType("memory_kind").execute();
}
