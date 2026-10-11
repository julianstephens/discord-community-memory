import { Events, GatewayIntentBits, REST } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("bot client configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BOT_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "123456789");
  });

  it("uses the guild-scoped intents required for manual message capture", async () => {
    const { buildClient } = await import("./client.ts");
    const client = buildClient();

    expect(client.options.intents.has(GatewayIntentBits.Guilds)).toBe(true);
    expect(client.options.intents.has(GatewayIntentBits.GuildMessages)).toBe(
      true,
    );
    expect(client.options.intents.has(GatewayIntentBits.MessageContent)).toBe(
      false,
    );
  });

  it("rejects interactions outside guild contexts", async () => {
    const { guildOnlyInteractionGuard } = await import("./client.ts");
    const interaction = {
      inGuild: () => false,
      guildId: null,
      reply: vi.fn().mockResolvedValue(undefined),
    };

    const allowed = await guildOnlyInteractionGuard(interaction as any);

    expect(allowed).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
  });

  it("defers ephemeral replies before slow work", async () => {
    const { deferEphemeralReply } = await import("./client.ts");
    const interaction = {
      deferred: false,
      replied: false,
      deferReply: vi.fn().mockResolvedValue(undefined),
    };

    await deferEphemeralReply(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledWith({
      ephemeral: true,
    });
  });

  it("maps common Discord permission and not-found failures to user-friendly messages", async () => {
    const { mapDiscordRestError } = await import("./client.ts");

    expect(
      mapDiscordRestError({ code: 50001, message: "Missing Access" }),
    ).toBe("Missing permission to perform that action in this guild.");
    expect(
      mapDiscordRestError({ code: 10062, message: "Unknown interaction" }),
    ).toBe("That Discord resource could not be found.");
  });

  it("rejects interactions from non-guild contexts at the client event boundary", async () => {
    const { client } = await import("./client.ts");
    const interaction = {
      inGuild: () => false,
      guildId: null,
      isRepliable: () => true,
      isMessageContextMenuCommand: () => false,
      reply: vi.fn().mockResolvedValue(undefined),
    };

    client.emit(Events.InteractionCreate, interaction as any);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
  });

  it("reports the disabled-by-default guild state without exposing content", async () => {
    const { memoryCommand } = await import("./commands/memory.ts");
    const interaction = {
      inGuild: () => true,
      guildId: "guild-1",
      options: {
        getSubcommand: () => "status",
        getSubcommandGroup: () => false,
      },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await memoryCommand(interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Community memory is disabled"),
        ephemeral: true,
      }),
    );
  });

  it("requires ManageGuild or Administrator privileges to toggle config", async () => {
    const { memoryCommand } = await import("./commands/memory.ts");
    const interaction = {
      inGuild: () => true,
      guildId: "guild-1",
      member: {
        permissions: {
          has: vi.fn().mockReturnValue(false),
        },
      },
      options: {
        getSubcommand: () => "enable",
        getSubcommandGroup: () => "config",
      },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await memoryCommand(interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith({
      content:
        "You do not have permission to configure community memory. Requires Manage Guild or Administrator.",
      ephemeral: true,
    });
  });

  it("refuses to save messages while a guild is disabled", async () => {
    const { saveMessageCommand } = await import("./commands/save-message.ts");
    await expect(
      saveMessageCommand({ guildId: "guild-disabled" } as any),
    ).rejects.toThrow("Guild memory is disabled.");
  });

  it("registers the expected slash commands and remains idempotent when re-run", async () => {
    const { registerCommands } = await import("./commands/index.ts");
    const putSpy = vi
      .spyOn(REST.prototype, "put")
      .mockResolvedValue(undefined as any);

    await expect(registerCommands()).resolves.toBe(true);
    await expect(registerCommands()).resolves.toBe(true);

    expect(putSpy).toHaveBeenCalledTimes(2);
    expect(putSpy.mock.calls[0]?.[0]).toBe("/applications/123456789/commands");
    expect(putSpy.mock.calls[0]?.[1]).toMatchObject({
      body: expect.arrayContaining([
        expect.objectContaining({ name: "Save Message" }),
        expect.objectContaining({ name: "memory" }),
      ]),
    });

    putSpy.mockRestore();
  });
});
