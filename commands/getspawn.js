// commands/getspawn.js
const { getSpawnChannelId } = require("../db/guilds");

module.exports = {
  name: "getspawn",
  description: "Show the current fruit spawn channel for this server.",
  async execute(message) {
    if (!message.guild) {
      return message.reply("❌ This command must be used in a server.");
    }

    const channelId = getSpawnChannelId(message.guild.id);
    if (!channelId) {
      return message.channel.send("ℹ️ No spawn channel is set. Use `n!setspawn [#channel]` to configure one.");
    }

    // Try to resolve the channel mention nicely
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
      return message.channel.send(
        `⚠️ A spawn channel is configured but I can't find it (ID: \`${channelId}\`). ` +
        `You may need to run \`n!setspawn [#channel]\` again.`
      );
    }

    return message.channel.send(`✅ Current spawn channel: <#${channel.id}>`);
  },
};
