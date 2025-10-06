// commands/unsetspawn.js
const { unsetSpawnChannelId } = require("../db/guilds");

module.exports = {
  name: "unsetspawn",
  description: "Clear the spawn channel for this server.",
  async execute(message) {
    if (!message.guild) {
      return message.reply("❌ This command must be used in a server.");
    }

    // Permission check
    const member = await message.guild.members.fetch(message.author.id);
    const canManage =
      member.permissions.has("ManageGuild") || member.permissions.has("Administrator");
    if (!canManage) {
      return message.reply("❌ You need **Manage Server** permission to unset the spawn channel.");
    }

    unsetSpawnChannelId(message.guild.id);
    return message.channel.send("✅ Spawn channel cleared. Fruits will not spawn until a channel is set.");
  },
};
