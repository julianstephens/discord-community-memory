import { describe, expect, it } from "vitest";
import {
  guildSchema,
  memoryEntrySchema,
  sourceMessageSchema,
} from "../src/core.ts";

const entry = {
  id: "00000000-0000-4000-8000-000000000001",
  guild_id: "guild",
  channel_id: "channel",
  created_by: "author",
  created_at: new Date(),
  title: null,
  deleted_at: null,
};

describe("database row schemas", () => {
  it("accepts nullable retention and database guild defaults", () => {
    const row = guildSchema.parse({
      id: "guild",
      retention_days: null,
      created_at: new Date(),
    });
    expect(row.enabled).toBe(false);
    expect(row.ingestion_mode).toBe("manual");
    expect(row.retention_days).toBeNull();
  });

  it.each([0, 3651, 1.5])("rejects invalid retention %s", (retention_days) => {
    expect(
      guildSchema.safeParse({
        id: "guild",
        retention_days,
        created_at: new Date(),
      }).success,
    ).toBe(false);
  });

  it("accepts nullable source-message timestamps", () => {
    expect(
      sourceMessageSchema.safeParse({
        guild_id: "guild",
        channel_id: "channel",
        message_id: "message",
        author_id: "author",
        content: "text",
        source_timestamp: new Date(),
        edited_at: null,
        reconciled_at: null,
        deleted_at: null,
      }).success,
    ).toBe(true);
  });

  it.each([null, undefined])(
    "accepts a saved message without duplicated content (%s)",
    (content) => {
      expect(
        memoryEntrySchema.safeParse({
          ...entry,
          kind: "message",
          source_message_id: "message",
          content,
        }).success,
      ).toBe(true);
    },
  );

  it.each(["note", "decision", "resource"])(
    "accepts %s rows with content",
    (kind) => {
      expect(
        memoryEntrySchema.safeParse({
          ...entry,
          kind,
          source_message_id: null,
          content: "text",
        }).success,
      ).toBe(true);
    },
  );

  it("checks SQL nullness rather than string truthiness", () => {
    expect(
      memoryEntrySchema.safeParse({
        ...entry,
        kind: "note",
        content: "",
        source_message_id: null,
      }).success,
    ).toBe(true);
    expect(
      memoryEntrySchema.safeParse({
        ...entry,
        kind: "message",
        source_message_id: "",
        content: null,
      }).success,
    ).toBe(true);
  });

  it.each([
    { kind: "message", source_message_id: null, content: null },
    { kind: "message", source_message_id: "message", content: "" },
    { kind: "note", source_message_id: "message", content: "text" },
    { kind: "note", source_message_id: null, content: null },
  ])("rejects invalid source/content combinations: %j", (fields) => {
    expect(memoryEntrySchema.safeParse({ ...entry, ...fields }).success).toBe(
      false,
    );
  });

  it("accepts UUID values without RFC version bits, as PostgreSQL does", () => {
    expect(
      memoryEntrySchema.safeParse({
        ...entry,
        id: "00000000-0000-0000-0000-000000000001",
        kind: "note",
        content: "text",
      }).success,
    ).toBe(true);
  });

  it("rejects non-UUID memory identifiers", () => {
    expect(
      memoryEntrySchema.safeParse({
        ...entry,
        id: "nanoid",
        kind: "note",
        content: "text",
      }).success,
    ).toBe(false);
  });
});
