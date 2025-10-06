// commands/setspawn.js
const { PermissionsBitField } = require("discord.js");
const { loadSpawnChannels, saveSpawnChannels } = require("../db/spawnChannels");

module.exports = {
  name: "setspawn",
  description: "Set (or clear) the channel where fruits will spawn for this server.",
  async execute(message, args) {
    // Require ManageGuild or Administrator
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply("❌ You need **Manage Server** permission to use this.");
    }

    const map = loadSpawnChannels();

    // turn off
    if (args[0] && args[0].toLowerCase() === "off") {
      delete map[message.guild.id];
      saveSpawnChannels(map);
      return message.reply("🧹 Spawn channel cleared. Fruits will not spawn until you set one again.");
    }

    // set to current channel
    map[message.guild.id] = message.channel.id;
    saveSpawnChannels(map);
    return message.reply(`✅ Spawn channel set to <#${message.channel.id}>.`);
  },
};
