import { Client, GatewayIntentBits } from "discord.js";

export const REQUIRED_GUILD_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
];

export const buildClient = () =>
  new Client({
    intents: REQUIRED_GUILD_INTENTS,
  });
