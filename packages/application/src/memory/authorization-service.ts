import { ChannelType, PermissionsBitField, type Client } from "discord.js";

interface AuthorizationService {
  readableChannels(guildId: string, userId: string): Promise<string[]>;

  canReadChannel(
    guildId: string,
    userId: string,
    channelId: string,
  ): Promise<boolean>;
}

class Service implements AuthorizationService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  readableChannels = async (
    guildId: string,
    userId: string,
  ): Promise<string[]> => {
    const guild = await this.client.guilds.fetch(guildId);
    const channels = guild.channels.cache;
    const userChannels = channels.filter((ch) => {
      if (
        ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildAnnouncement
      )
        return false;
      return ch
        .permissionsFor(userId)
        ?.has(PermissionsBitField.Flags.ViewChannel);
    });
    return userChannels.map((ch) => ch.id);
  };

  canReadChannel = async (
    guildId: string,
    userId: string,
    channelId: string,
  ): Promise<boolean> => {
    const readableChannels = await this.readableChannels(guildId, userId);
    return readableChannels.indexOf(channelId) > 0;
  };
}

export default Service;
